import { ArticleError } from '../application/contracts.ts';
import type { ArticleErrorCode } from '../application/contracts.ts';
import { parseArticleId } from '../application/validation.ts';
import { authorizeArticlesUseCase } from '../application/use-cases/authorize-articles.ts';
import { createArticleUseCase } from '../application/use-cases/create-article.ts';
import { deleteArticleUseCase } from '../application/use-cases/delete-article.ts';
import { listArticlesUseCase } from '../application/use-cases/list-articles.ts';
import { updateArticleUseCase } from '../application/use-cases/update-article.ts';

const errorStatuses: Record<ArticleErrorCode, number> = {
  INVALID_INPUT: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403,
  NOT_FOUND: 404, CONFLICT: 409, EMBEDDING_UNAVAILABLE: 503,
  EMBEDDING_TIMEOUT: 504, EMBEDDING_REJECTED: 422, INVALID_EMBEDDING: 502,
  SCHEMA_NOT_READY: 503, STORAGE_FAILED: 500,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function encodeCursor(id: number): string {
  return btoa(JSON.stringify({ id: String(id) })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(value: string): string {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const parsed: unknown = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    if (isRecord(parsed) && typeof parsed.id === 'string') return parseArticleId(parsed.id);
  } catch {
    // Base64, JSON and cursor-shape errors share a transport validation error.
  }
  throw new ArticleError('INVALID_INPUT', 'Некорректный курсор страницы.');
}

async function readInput(request: Request): Promise<Record<string, unknown>> {
  let input: unknown;
  try { input = await request.json(); }
  catch { throw new ArticleError('INVALID_INPUT', 'Тело запроса должно содержать корректный JSON.'); }
  if (!isRecord(input)) throw new ArticleError('INVALID_INPUT', 'Ожидается JSON-объект.');
  return input;
}

export async function handleArticlesRequest(request: Request, userId: string | null): Promise<Response> {
  try {
      await authorizeArticlesUseCase.execute(userId);
      const url = new URL(request.url);
      if (request.method === 'GET') {
        const limitValue = url.searchParams.get('limit') ?? '20';
        if (!/^\d+$/.test(limitValue) || Number(limitValue) < 1 || !Number.isFinite(Number(limitValue))) {
          throw new ArticleError('INVALID_INPUT', 'Размер страницы должен быть положительным целым числом.');
        }
        const cursorValue = url.searchParams.get('cursor');
        const result = await listArticlesUseCase.execute({
          limit: Math.min(Number(limitValue), 50), beforeId: cursorValue ? decodeCursor(cursorValue) : null,
        });
        const last = result.data.at(-1);
        return Response.json({ ...result, nextCursor: result.hasMore && last ? encodeCursor(last.id) : null });
      }
      if (request.method === 'POST') {
        return Response.json(await createArticleUseCase.execute(await readInput(request)), { status: 201 });
      }
      if (request.method === 'PATCH') {
        return Response.json(await updateArticleUseCase.execute(await readInput(request)));
      }
      if (request.method === 'DELETE') {
        await deleteArticleUseCase.execute(url.searchParams.get('id'));
        return new Response(null, { status: 204 });
      }
      return Response.json({ message: 'Метод не поддерживается.' }, {
        status: 405, headers: { Allow: 'GET, POST, PATCH, DELETE' },
      });
    } catch (error) {
      if (error instanceof ArticleError) {
        return Response.json({ message: error.message }, { status: errorStatuses[error.code] });
      }
      console.error('Articles request failed', error instanceof Error ? error.name : 'UnknownError');
      return Response.json({ message: 'Не удалось выполнить операцию со статьёй.' }, { status: 500 });
    }
}
