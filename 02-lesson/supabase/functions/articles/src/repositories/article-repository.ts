import { ArticleError } from '../application/contracts.ts';
import type { ArticleRepository, ArticleWrite, StoredArticle } from '../application/contracts.ts';
import { requestDatabase } from './database.ts';

const ARTICLE_COLUMNS = 'id,title,body,created_at,updated_at,embedding_model';

function parseStoredArticle(value: unknown): StoredArticle {
  if (
    value === null || typeof value !== 'object' ||
    !('id' in value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id < 1 ||
    !('title' in value) || typeof value.title !== 'string' ||
    !('body' in value) || typeof value.body !== 'string' ||
    !('created_at' in value) || typeof value.created_at !== 'string' ||
    !('updated_at' in value) || typeof value.updated_at !== 'string' ||
    !('embedding_model' in value) || (value.embedding_model !== null && typeof value.embedding_model !== 'string')
  ) throw new ArticleError('STORAGE_FAILED', 'База вернула некорректные данные статьи.');
  return {
    id: value.id, title: value.title, body: value.body,
    created_at: value.created_at, updated_at: value.updated_at, embedding_model: value.embedding_model,
  };
}

export const articleRepository = {
  async findByTitle(title: string): Promise<StoredArticle | null> {
    const rows = await requestDatabase('articles', 'GET', { select: ARTICLE_COLUMNS, title: `eq.${title}`, limit: '2' });
    if (rows.length > 1) throw new ArticleError('CONFLICT', 'Найдено несколько статей с одинаковым заголовком.');
    return rows.length ? parseStoredArticle(rows[0]) : null;
  },
  async list(limit: number, beforeId: string | null): Promise<StoredArticle[]> {
    return (await requestDatabase('articles', 'GET', {
      select: ARTICLE_COLUMNS, order: 'id.desc', limit: String(limit), ...(beforeId ? { id: `lt.${beforeId}` } : {}),
    })).map(parseStoredArticle);
  },
  async find(id: string): Promise<StoredArticle | null> {
    const rows = await requestDatabase('articles', 'GET', { select: ARTICLE_COLUMNS, id: `eq.${id}`, limit: '1' });
    return rows.length ? parseStoredArticle(rows[0]) : null;
  },
  async create(input: ArticleWrite): Promise<StoredArticle> {
    const rows = await requestDatabase('articles', 'POST', { select: ARTICLE_COLUMNS }, input);
    return parseStoredArticle(rows[0]);
  },
  async update(id: string, expectedUpdatedAt: string, input: ArticleWrite): Promise<StoredArticle | null> {
    const rows = await requestDatabase('articles', 'PATCH', {
      select: ARTICLE_COLUMNS, id: `eq.${id}`, updated_at: `eq.${expectedUpdatedAt}`,
    }, input);
    return rows.length ? parseStoredArticle(rows[0]) : null;
  },
  async delete(id: string): Promise<boolean> {
    return (await requestDatabase('articles', 'DELETE', { select: 'id', id: `eq.${id}` })).length > 0;
  },
} satisfies ArticleRepository;
