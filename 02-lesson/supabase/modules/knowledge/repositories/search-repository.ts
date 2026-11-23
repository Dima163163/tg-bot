import { env } from 'node:process';
import { KnowledgeError } from '../application/contracts.ts';
import type { KnowledgeSource, KnowledgeVector } from '../application/contracts.ts';

export const knowledgeSearchRepository = {
  async search(vector: KnowledgeVector): Promise<KnowledgeSource[]> {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new KnowledgeError('CONFIGURATION', 'Подключение к базе знаний не настроено.');
    const threshold = Number(env.RAG_MIN_SIMILARITY || '0.5');
    if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new KnowledgeError('CONFIGURATION', 'Некорректный порог поиска.');
    const response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/search_articles`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query_embedding: vector.embedding, query_embedding_model: vector.model, match_count: 3, min_similarity: threshold }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) throw new KnowledgeError('STORAGE', 'Не удалось найти статьи.');
    const sources: KnowledgeSource[] = [];
    for (const row of payload) {
      if (row === null || typeof row !== 'object' ||
        !('id' in row) || typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || row.id < 1 ||
        !('title' in row) || typeof row.title !== 'string' ||
        !('body' in row) || typeof row.body !== 'string' ||
        !('similarity' in row) || typeof row.similarity !== 'number' || !Number.isFinite(row.similarity)) {
        throw new KnowledgeError('STORAGE', 'База вернула некорректную статью.');
      }
      sources.push({ id: row.id, title: row.title, body: row.body, similarity: row.similarity });
    }
    return sources;
  },
};
