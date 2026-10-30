export async function callEdgeFunction<T>(functionName: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (init?.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    headers.set('X-WM-Request', '1');
  }

  const response = await fetch(`/api/functions/${functionName}`, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Сессия истекла. Войдите снова.');
    if (response.status === 403) throw new Error('Нет доступа: аккаунт не назначен оператором.');
    let detail = '';
    try {
      const body = (await response.json()) as { message?: string };
      detail = body.message ? `: ${body.message}` : '';
    } catch {
      // Keep the HTTP status as the useful error when the function returned no JSON.
    }
    throw new Error(`Не удалось загрузить данные (${response.status})${detail}`);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
