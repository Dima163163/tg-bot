import { env } from 'node:process';
import { KnowledgeError } from '../application/contracts.ts';
import type { KnowledgeVector } from '../application/contracts.ts';
import { groqClient } from './groq.ts';

declare const Supabase: { ai: { Session: new (name: string) => {
  run(input: string, options: { mean_pool: boolean; normalize: boolean }): Promise<unknown>;
} } };
let session: InstanceType<typeof Supabase.ai.Session> | undefined;

function validVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 384 &&
    value.every(item => typeof item === 'number' && Number.isFinite(item) && Number.isFinite(Math.fround(item))) &&
    value.some(item => Math.fround(item) !== 0);
}

export const knowledgeEmbeddings = {
  model(): string { return `supabase/gte-small:groq-en-v1:${groqClient.model()}`; },
  async generate(text: string): Promise<KnowledgeVector> {
    if (!text.trim() || text.length > 13_000) throw new KnowledgeError('INVALID_INPUT', 'Текст для поиска пустой или слишком длинный.');
    // Local MCP preparation uses the protected Edge endpoint; native inference
    // is available only inside the hosted Supabase runtime.
    if (typeof Supabase === 'undefined') {
      const url = env.RAG_ADMIN_URL;
      const token = env.RAG_ADMIN_TOKEN;
      if (!url || !token) throw new KnowledgeError('CONFIGURATION', 'Настройте RAG_ADMIN_URL и RAG_ADMIN_TOKEN для локального MCP.');
      const endpoint = new URL(url);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new KnowledgeError('CONFIGURATION', 'Для RAG_ADMIN_URL требуется HTTPS без учётных данных в адресе.');
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(40_000),
          headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'embedding', text }),
        });
      } catch { throw new KnowledgeError('PROVIDER', 'Сервис embeddings недоступен.'); }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || payload === null || typeof payload !== 'object' ||
        !('embedding' in payload) || !validVector(payload.embedding) ||
        !('model' in payload) || payload.model !== knowledgeEmbeddings.model()) {
        throw new KnowledgeError('INVALID_OUTPUT', 'Сервис вернул некорректный embedding.');
      }
      return { embedding: payload.embedding, model: payload.model };
    }
    const english = await groqClient.searchText(text);
    // English ASCII <=480 chars stays below the 512-token WordPiece limit.
    session ??= new Supabase.ai.Session('gte-small');
    const embedding = await session.run(english, { mean_pool: true, normalize: true });
    if (!validVector(embedding)) throw new KnowledgeError('INVALID_OUTPUT', 'Supabase AI не вернул вектор из 384 чисел.');
    return { embedding, model: knowledgeEmbeddings.model() };
  },
};
