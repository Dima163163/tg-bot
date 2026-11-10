export interface AuthSession {
  user: { id: string; email?: string };
  accessToken: string;
  expiresAt: number;
}

function parseAuthSession(value: unknown): AuthSession {
  if (!value || typeof value !== 'object') throw new Error('Некорректный ответ сервера авторизации.');
  const session = value as Record<string, unknown>;
  const user = session.user;
  if (
    !user || typeof user !== 'object' ||
    typeof (user as Record<string, unknown>).id !== 'string' ||
    typeof session.accessToken !== 'string' ||
    !Number.isFinite(session.expiresAt)
  ) throw new Error('Некорректный ответ сервера авторизации.');

  const authUser = user as Record<string, unknown>;
  if (authUser.email !== undefined && typeof authUser.email !== 'string') {
    throw new Error('Некорректный ответ сервера авторизации.');
  }
  return {
    user: { id: authUser.id as string, email: authUser.email as string | undefined },
    accessToken: session.accessToken,
    expiresAt: session.expiresAt as number,
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // The response may not have a JSON body.
  }
  return `Ошибка авторизации (${response.status})`;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await readError(response));
  return parseAuthSession(await response.json());
}

async function postAuthMutation(path: string, body: Record<string, string>): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-WM-Request': '1' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function requestPasswordReset(email: string): Promise<void> {
  await postAuthMutation('/api/auth/password-reset', { email });
}

export async function acceptPasswordRecovery(accessToken: string, refreshToken: string): Promise<void> {
  await postAuthMutation('/api/auth/password-recovery/session', { accessToken, refreshToken });
}

export async function updatePassword(password: string): Promise<void> {
  await postAuthMutation('/api/auth/password-recovery/update', { password });
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-WM-Request': '1' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return parseAuthSession(await response.json());
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-WM-Request': '1' },
  });
  if (!response.ok) throw new Error(await readError(response));
}
