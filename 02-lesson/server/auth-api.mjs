import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { GoTrueClient } from '@supabase/auth-js';

const COOKIE_NAME = 'web_messenger_session';
const COOKIE_AGE_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_BEFORE_SECONDS = 120;
const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_FUNCTIONS = new Set(['clients', 'messages', 'articles']);

export function createAuthApi({ supabaseUrl, apiKey, cookieSecret, secureCookie = false }) {
  if (!supabaseUrl || !apiKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for the auth API');
  }

  const key = cookieSecret ? Buffer.from(cookieSecret, 'base64') : randomBytes(32);
  if (key.length !== 32) {
    throw new Error('AUTH_COOKIE_SECRET must be a base64-encoded 32-byte key');
  }

  const refreshFlights = new Map();
  const authUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;

  function createAuthClient() {
    return new GoTrueClient({
      url: authUrl,
      headers: { apikey: apiKey },
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    });
  }

  function encryptSession(session) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  }

  function decryptSession(value) {
    if (!value || value.length > 8000) return null;
    try {
      const bytes = Buffer.from(value, 'base64url');
      if (bytes.length < 29) return null;
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const session = JSON.parse(Buffer.concat([
        decipher.update(bytes.subarray(28)), decipher.final(),
      ]).toString('utf8'));
      if (
        !session || typeof session.access_token !== 'string' ||
        typeof session.refresh_token !== 'string' ||
        !Number.isFinite(session.expires_at)
      ) return null;
      return session;
    } catch {
      return null;
    }
  }

  function getCookie(req) {
    const cookies = (req.headers.cookie ?? '').split(';');
    for (const cookie of cookies) {
      const [name, ...value] = cookie.trim().split('=');
      if (name === COOKIE_NAME) return value.join('=');
    }
    return null;
  }

  function cookieHeader(value, maxAge = COOKIE_AGE_SECONDS) {
    return `${COOKIE_NAME}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
  }

  function setSessionCookie(res, session) {
    res.setHeader('Set-Cookie', cookieHeader(encryptSession(session)));
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', cookieHeader('', 0));
  }

  function sendJson(res, status, value) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Pragma': 'no-cache',
      'Vary': 'Cookie',
    });
    res.end(JSON.stringify(value));
  }

  async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  function validMutation(req, res) {
    if (req.headers['x-wm-request'] !== '1') {
      sendJson(res, 403, { message: 'Request verification failed' });
      return false;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          sendJson(res, 403, { message: 'Origin is not allowed' });
          return false;
        }
      } catch {
        sendJson(res, 403, { message: 'Origin is not allowed' });
        return false;
      }
    }
    return true;
  }

  async function loadSession(req, res) {
    const cookie = getCookie(req);
    const session = decryptSession(cookie);
    if (!session) {
      clearSessionCookie(res);
      return null;
    }
    if (session.expires_at > Date.now() / 1000 + REFRESH_BEFORE_SECONDS) return session;

    const flightKey = createHash('sha256').update(cookie).digest('hex');
    let flight = refreshFlights.get(flightKey);
    if (!flight) {
      flight = (async () => {
        const { data, error } = await createAuthClient().refreshSession({
          refresh_token: session.refresh_token,
        });
        if (error || !data.session) return null;
        return {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        };
      })();
      refreshFlights.set(flightKey, flight);
      void flight.then(
        () => refreshFlights.delete(flightKey),
        () => refreshFlights.delete(flightKey),
      );
    }

    const refreshed = await flight;
    if (!refreshed) {
      clearSessionCookie(res);
      return null;
    }
    setSessionCookie(res, refreshed);
    return refreshed;
  }

  return async function authApi(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !validMutation(req, res)) return;

      if (path === '/auth/login' && method === 'POST') {
        const body = JSON.parse((await readBody(req)).toString('utf8'));
        if (typeof body.email !== 'string' || typeof body.password !== 'string') {
          sendJson(res, 400, { message: 'Email and password are required' });
          return;
        }
        const { data, error } = await createAuthClient().signInWithPassword({
          email: body.email.trim(), password: body.password,
        });
        if (error || !data.session) {
          sendJson(res, 401, { message: 'Неверный email или пароль.' });
          return;
        }
        setSessionCookie(res, {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        });
        sendJson(res, 200, {
          user: { id: data.user.id, email: data.user.email },
          accessToken: data.session.access_token,
          expiresAt: data.session.expires_at,
        });
        return;
      }

      if (path === '/auth/session' && method === 'GET') {
        const session = await loadSession(req, res);
        if (!session) return sendJson(res, 401, { message: 'No session' });
        const { data, error } = await createAuthClient().getUser(session.access_token);
        if (error || !data.user) {
          clearSessionCookie(res);
          return sendJson(res, 401, { message: 'No session' });
        }
        sendJson(res, 200, {
          user: { id: data.user.id, email: data.user.email },
          accessToken: session.access_token,
          expiresAt: session.expires_at,
        });
        return;
      }

      if (path === '/auth/logout' && method === 'POST') {
        const session = await loadSession(req, res);
        if (session) {
          const response = await fetch(`${authUrl}/logout?scope=local`, {
            method: 'POST',
            headers: { apikey: apiKey, Authorization: `Bearer ${session.access_token}` },
          });
          if (!response.ok) return sendJson(res, 502, { message: 'Не удалось завершить сессию.' });
        }
        clearSessionCookie(res);
        res.writeHead(204, { 'Cache-Control': 'private, no-store' });
        res.end();
        return;
      }

      const match = /^\/functions\/(clients|messages|articles)$/.exec(path);
      if (match && ALLOWED_FUNCTIONS.has(match[1])) {
        const session = await loadSession(req, res);
        if (!session) return sendJson(res, 401, { message: 'No session' });
        const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(req);
        const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/${match[1]}${url.search}`, {
          method,
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${session.access_token}`,
            ...(body ? { 'Content-Type': req.headers['content-type'] ?? 'application/json' } : {}),
          },
          body,
        });
        res.writeHead(response.status, {
          'Content-Type': response.headers.get('content-type') ?? 'application/json',
          'Cache-Control': 'private, no-store',
          'Pragma': 'no-cache',
          'Vary': 'Cookie',
        });
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }

      sendJson(res, 404, { message: 'Not found' });
    } catch (error) {
      console.error('Auth API request failed', error);
      sendJson(res, 500, { message: 'Сервер авторизации недоступен.' });
    }
  };
}
