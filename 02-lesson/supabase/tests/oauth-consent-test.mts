import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test, { afterEach, mock } from 'node:test';
import { createAuthApi } from '../../server/auth-api.mjs';

afterEach(() => mock.restoreAll());

function request(api: ReturnType<typeof createAuthApi>, path: string, options: { method?: string; cookie?: string; body?: unknown; verified?: boolean } = {}) {
  const req = Readable.from(options.body ? [Buffer.from(JSON.stringify(options.body))] : []);
  Object.assign(req, { url: path, method: options.method ?? 'GET', headers: {
    host: 'panel.example.test', ...(options.cookie ? { cookie: options.cookie } : {}),
    ...(options.verified ? { 'x-wm-request': '1', origin: 'https://panel.example.test' } : {}),
  } });
  const result: { status: number; headers: Record<string, string>; body: string } = { status: 0, headers: {}, body: '' };
  const res = {
    setHeader(name: string, value: string) { result.headers[name.toLowerCase()] = value; },
    writeHead(status: number, headers: Record<string, string>) { result.status = status; Object.assign(result.headers, headers); },
    end(body = '') { result.body = body.toString(); },
  };
  return api(req, res).then(() => result);
}

test('OAuth consent API requires a session and validates mutations', async () => {
  const api = createAuthApi({ supabaseUrl: 'https://supabase.example.test', apiKey: 'test', cookieSecret: Buffer.alloc(32).toString('base64') });
  const get = await request(api, '/auth/oauth/authorization?id=test');
  assert.equal(get.status, 401);
  const post = await request(api, '/auth/oauth/authorization', { method: 'POST', body: { id: 'test', action: 'approve' } });
  assert.equal(post.status, 403);
});

test('OAuth consent API forwards only validated decisions using the session', async () => {
  const api = createAuthApi({ supabaseUrl: 'https://supabase.example.test', apiKey: 'test', cookieSecret: Buffer.alloc(32).toString('base64') });
  const calls: string[] = [];
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/token?grant_type=password')) {
      return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, token_type: 'bearer', user: { id: 'user', email: 'user@example.test' } });
    }
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer access');
    assert.deepEqual(JSON.parse(String(init?.body)), { action: 'approve' });
    return Response.json({ redirect_url: 'http://localhost/callback?code=example' });
  });
  const login = await request(api, '/auth/login', { method: 'POST', verified: true, body: { email: 'user@example.test', password: 'password' } });
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'].split(';')[0];
  const invalid = await request(api, '/auth/oauth/authorization', { method: 'POST', verified: true, cookie, body: { id: '../invalid', action: 'approve' } });
  assert.equal(invalid.status, 400);
  const decision = await request(api, '/auth/oauth/authorization', { method: 'POST', verified: true, cookie, body: { id: 'authorization-id', action: 'approve' } });
  assert.equal(decision.status, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith('/oauth/authorizations/authorization-id/consent'));
});
