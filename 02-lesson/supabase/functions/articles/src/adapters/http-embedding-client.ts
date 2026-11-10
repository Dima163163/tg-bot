import { env } from 'node:process';
import { ArticleError } from '../application/contracts.ts';
import type { GenerateArticleEmbedding } from '../application/contracts.ts';
import { knowledgeEmbeddings } from '../../../_shared/knowledge/adapters/embeddings.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Accepts an OpenAI-compatible endpoint. The model is configured after selection.
export const articleEmbeddings = {
  async generate(title: string, body: string) {
    if (env.EMBEDDINGS_PROVIDER === 'supabase-groq') {
      try {
        return await knowledgeEmbeddings.generate(`${title}\n\n${body}`);
      } catch (error) {
        console.error('Article embedding failed', { code: error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN' });
        throw new ArticleError('EMBEDDING_UNAVAILABLE', 'Не удалось пересчитать вектор статьи. Изменения не сохранены.');
      }
    }
    const apiUrl = env.EMBEDDINGS_API_URL ?? '';
    const model = env.EMBEDDINGS_MODEL ?? '';
    const apiKey = env.EMBEDDINGS_API_KEY ?? '';
    const documentPrefix = env.EMBEDDINGS_DOCUMENT_PREFIX ?? '';
    if (!apiUrl && !model && !apiKey && !documentPrefix) return null;
    if (!apiUrl || !model.trim() || model !== model.trim()) {
      throw new ArticleError('EMBEDDING_UNAVAILABLE', 'Сервис подготовки поиска настроен не полностью. Обратитесь к администратору.');
    }
    let endpoint: URL;
    try {
      endpoint = new URL(apiUrl);
    } catch {
      throw new ArticleError('EMBEDDING_UNAVAILABLE', 'Адрес сервиса подготовки поиска настроен некорректно.');
    }
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
      throw new ArticleError('EMBEDDING_UNAVAILABLE', 'Для сервиса подготовки поиска требуется HTTPS-адрес без учётных данных.');
    }
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model, input: `${documentPrefix}${title}\n\n${body}`, encoding_format: 'float' }),
      });
    } catch (error) {
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
        throw new ArticleError('EMBEDDING_TIMEOUT', 'Сервис подготовки поиска не ответил вовремя. Статья не сохранена. Повторите попытку.');
      }
      throw new ArticleError('INVALID_EMBEDDING', 'Сервис подготовки поиска недоступен. Статья не сохранена.');
    }
    if (!response.ok) {
      const rejectedInput = [400, 413, 422].includes(response.status);
      throw new ArticleError(rejectedInput ? 'EMBEDDING_REJECTED' : 'EMBEDDING_UNAVAILABLE', rejectedInput
        ? 'Сервис поиска не принял текст. Проверьте его длину и повторите сохранение.'
        : 'Не удалось подготовить статью для поиска. Статья не сохранена. Повторите попытку позже.');
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ArticleError('INVALID_EMBEDDING', 'Сервис подготовки поиска вернул некорректный ответ.');
    }
    const entry: unknown = isRecord(payload) && Array.isArray(payload.data) && payload.data.length === 1
      ? payload.data[0] : null;
    const embedding: unknown = isRecord(entry) ? entry.embedding : null;
    if (
      !Array.isArray(embedding) || embedding.length !== 384 ||
      !embedding.every((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Number.isFinite(Math.fround(value))) ||
      !embedding.some((value) => Math.fround(value) !== 0)
    ) {
      throw new ArticleError('INVALID_EMBEDDING', 'Сервис поиска должен вернуть ненулевой вектор из 384 чисел. Статья не сохранена.');
    }
    return { embedding, model };
  },
} satisfies { generate: GenerateArticleEmbedding };
