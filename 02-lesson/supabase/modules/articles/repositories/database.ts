import { env } from 'node:process';
import { ArticleError } from '../application/contracts.ts';
import type { ArticleWrite } from '../application/contracts.ts';

// Database transport and PostgREST details belong to the repository layer.
export async function requestDatabase(
  table: 'articles' | 'panel_operators',
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  query: Record<string, string>,
  body?: ArticleWrite,
): Promise<unknown[]> {
  const baseUrl = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new ArticleError('STORAGE_FAILED', 'Серверное подключение к базе не настроено.');
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/rest/v1/${table}`);
  url.search = new URLSearchParams(query).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method, signal: AbortSignal.timeout(10_000), redirect: 'error',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json',
        ...(method === 'GET' ? {} : { Prefer: 'return=representation' }),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ArticleError('STORAGE_FAILED', 'База данных временно недоступна.');
  }
  const payload: unknown = response.status === 204 ? [] : await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
      ? payload.code : 'UNKNOWN';
    console.error('Articles database request failed', { code, status: response.status });
    if (['42703', 'PGRST204'].includes(code)) {
      throw new ArticleError('SCHEMA_NOT_READY', 'Схема базы статей ещё не обновлена. Администратору нужно применить миграцию RAG.');
    }
    throw new ArticleError('STORAGE_FAILED', 'Не удалось выполнить операцию со статьёй.');
  }
  if (!Array.isArray(payload)) throw new ArticleError('STORAGE_FAILED', 'База вернула некорректные данные.');
  return payload;
}
