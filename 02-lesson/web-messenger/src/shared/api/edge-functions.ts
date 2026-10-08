import { supabaseApiKey, supabaseUrl } from './supabase-config';

export async function callEdgeFunction<T>(functionName: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  if (supabaseApiKey) {
    headers.set('apikey', supabaseApiKey);
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
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
