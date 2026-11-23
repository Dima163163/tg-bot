import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';

interface ConsentDetails {
  client: { name: string };
  redirect_uri: string;
  scope: string;
  user: { email: string };
}

async function requestConsent(id: string, action?: 'approve' | 'deny'): Promise<ConsentDetails | { redirect_url: string }> {
  const response = await fetch(`/api/auth/oauth/authorization${action ? '' : `?id=${encodeURIComponent(id)}`}`, {
    method: action ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(action ? { headers: { 'Content-Type': 'application/json', 'X-WM-Request': '1' }, body: JSON.stringify({ id, action }) } : {}),
  });
  if (response.status === 401) throw new Error('AUTH_REQUIRED');
  if (!response.ok) throw new Error('Запрос авторизации недействителен или истёк.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Некорректный ответ сервера авторизации.');
  if ('redirect_url' in data && typeof data.redirect_url === 'string') return { redirect_url: data.redirect_url };
  if ('client' in data && data.client && typeof data.client === 'object' && 'name' in data.client && typeof data.client.name === 'string' &&
      'redirect_uri' in data && typeof data.redirect_uri === 'string' && 'scope' in data && typeof data.scope === 'string' &&
      'user' in data && data.user && typeof data.user === 'object' && 'email' in data.user && typeof data.user.email === 'string') {
    return { client: { name: data.client.name }, redirect_uri: data.redirect_uri, scope: data.scope, user: { email: data.user.email } };
  }
  throw new Error('Некорректный ответ сервера авторизации.');
}

export function OAuthConsentPage() {
  const [params] = useSearchParams();
  const id = params.get('authorization_id') ?? '';
  const validId = /^[a-zA-Z0-9_-]{1,200}$/.test(id);
  const query = useQuery({ queryKey: ['oauth-consent', id], queryFn: () => requestConsent(id), enabled: validId, retry: false });
  const mutation = useMutation({ mutationFn: (action: 'approve' | 'deny') => requestConsent(id, action), onSuccess: (data) => {
    if ('redirect_url' in data) window.location.assign(data.redirect_url);
  } });
  const result = query.data;
  if (result && 'redirect_url' in result) {
    return <main className="login-shell"><p>Согласие уже предоставлено.</p><a href={result.redirect_url}>Вернуться в приложение</a></main>;
  }
  return <main className="login-shell"><section className="login-card" aria-labelledby="consent-title">
    <h1 id="consent-title">Подключение приложения</h1>
    {!validId && <p role="alert">Некорректный запрос авторизации.</p>}
    {query.isPending && validId && <p role="status">Загружаем запрос…</p>}
    {query.error?.message === 'AUTH_REQUIRED' && <p>Для продолжения <Link to={`/login?authorization_id=${encodeURIComponent(id)}`}>войдите в панель</Link>.</p>}
    {query.error && query.error.message !== 'AUTH_REQUIRED' && <p role="alert">{query.error.message}</p>}
    {result && 'client' in result && <>
      <p>Приложение «{result.client.name}» запрашивает доступ от имени {result.user.email}.</p>
      <p>Запрошенные разрешения: {result.scope || 'не указаны'}. Адрес возврата: {result.redirect_uri}</p>
      <p>Подключённое приложение сможет использовать доступные вам инструменты работы со статьями.</p>
      <div className="login-form">
        <button disabled={mutation.isPending} onClick={() => mutation.mutate('approve')} type="button">Разрешить</button>
        <button disabled={mutation.isPending} onClick={() => mutation.mutate('deny')} type="button">Отклонить</button>
      </div>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </>}
  </section></main>;
}
