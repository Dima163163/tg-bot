import { callEdgeFunction } from '../../../shared/api/edge-functions';

export const ARTICLE_PAGE_SIZE = 20;
export const articlesQueryKey = ['articles'] as const;

export interface Article {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ArticlePage {
  data: Article[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface GetArticlesOptions {
  cursor: string | null;
  limit?: number;
}

export interface CreateArticleInput {
  title: string;
  body: string;
}

export interface UpdateArticleBodyInput {
  id: number;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isArticle(value: unknown): value is Article {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

function parseArticle(response: unknown): Article {
  if (!isArticle(response)) {
    throw new Error('Сервер вернул некорректные данные статьи');
  }

  return response;
}

function parseArticlePage(response: unknown): ArticlePage {
  if (
    !isRecord(response) ||
    !Array.isArray(response.data) ||
    typeof response.hasMore !== 'boolean' ||
    (response.nextCursor !== null && typeof response.nextCursor !== 'string')
  ) {
    throw new Error('Сервер вернул некорректную страницу статей');
  }

  const data: Article[] = [];
  for (const article of response.data) {
    if (!isArticle(article)) {
      throw new Error('Сервер вернул некорректные данные статьи');
    }
    data.push(article);
  }

  return {
    data,
    hasMore: response.hasMore,
    nextCursor: response.nextCursor,
  };
}

export async function getArticles({ cursor, limit = ARTICLE_PAGE_SIZE }: GetArticlesOptions): Promise<ArticlePage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const response = await callEdgeFunction<unknown>(`articles?${params.toString()}`);
  return parseArticlePage(response);
}

export async function createArticle(input: CreateArticleInput): Promise<Article> {
  const response = await callEdgeFunction<unknown>('articles', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return parseArticle(response);
}

export async function updateArticleBody(input: UpdateArticleBodyInput): Promise<Article> {
  const response = await callEdgeFunction<unknown>('articles', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  return parseArticle(response);
}

export async function deleteArticle(id: number): Promise<void> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('ID статьи должен быть положительным целым числом');
  }

  await callEdgeFunction<void>(`articles?id=${id}`, { method: 'DELETE' });
}
