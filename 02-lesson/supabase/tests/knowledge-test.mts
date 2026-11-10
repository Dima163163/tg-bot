import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { answerKnowledgeQuestionUseCase } from '../functions/_shared/knowledge/application/answer-question.ts';
import { knowledgeEmbeddings } from '../functions/_shared/knowledge/adapters/embeddings.ts';
import { articleEmbeddings } from '../functions/articles/src/adapters/http-embedding-client.ts';
import { handleKnowledgeAdminRequest } from '../functions/knowledge-admin/src/http/handler.ts';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let vector: unknown;
let searchText: unknown;
let answer: unknown;
let sources: unknown;
let providerStatus = 200;
let groqCalls = 0;
let databaseCalls = 0;
let aiInput = '';
let answerInput: { sources: Array<{ body: string }> } | undefined;
function installNativeAI() {
  Object.defineProperty(globalThis, 'Supabase', { configurable: true, value: { ai: { Session: class {
    async run(input: string, options: unknown) { aiInput = input; assert.deepEqual(options, { mean_pool: true, normalize: true }); return vector; }
  } } } });
}
beforeEach(() => {
  installNativeAI();
  Object.assign(process.env, { GROQ_API_KEY: 'test', GROQ_MODEL: 'openai/gpt-oss-20b', SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'server', EMBEDDINGS_PROVIDER: 'supabase-groq', RAG_ADMIN_TOKEN: 'admin-test', RAG_MIN_SIMILARITY: '0.5' });
  vector = Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0);
  searchText = 'Atlas coworking day pass price';
  answer = { answer: 'День стоит 900 рублей.', source_ids: [2] };
  sources = [{ id: 2, title: 'Цены', body: 'День стоит 900 рублей.', similarity: 0.8 }];
  providerStatus = 200; groqCalls = 0; databaseCalls = 0; aiInput = ''; answerInput = undefined;
  globalThis.fetch = async (url, options) => {
    const input = JSON.parse(String(options?.body)) as Record<string, unknown>;
    if (String(url).includes('api.groq.com')) {
      groqCalls++;
      if (providerStatus !== 200) return Response.json({ error: 'private provider error' }, { status: providerStatus });
      const messages = input.messages as Array<{ content: string }>;
      if (!messages[0].content.startsWith('Create an English')) answerInput = JSON.parse(messages[1].content);
      const result = messages[0].content.startsWith('Create an English') ? { search_text: searchText } : answer;
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
    }
    assert.match(String(url), /\/rpc\/search_articles$/);
    databaseCalls++;
    assert.equal(input.query_embedding_model, knowledgeEmbeddings.model());
    assert.equal(input.match_count, 3);
    assert.equal(input.min_similarity, 0.5);
    return Response.json(sources);
  };
});
after(() => { globalThis.fetch = originalFetch; process.env = originalEnv; Reflect.deleteProperty(globalThis, 'Supabase'); });

test('RAG: article embedding uses Groq projection, native normalized gte-small and a versioned model tag', async () => {
  searchText = 'Atlas “day pass” costs 900 ₽ — Wi-Fi included.';
  const result = await articleEmbeddings.generate('Цены', 'День стоит 900 рублей.');
  assert.equal(result?.embedding.length, 384);
  assert.equal(result?.model, 'supabase/gte-small:groq-en-v1:openai/gpt-oss-20b');
  assert.equal(aiInput, 'Atlas "day pass" costs 900 RUB - Wi-Fi included.');
});
test('RAG: malformed or overlong English projection retries once and never reaches vector search', async () => {
  for (const value of ['', 'русский текст', 'a'.repeat(481)]) {
    groqCalls = 0; searchText = value;
    await assert.rejects(() => answerKnowledgeQuestionUseCase.execute('Цена?'), { code: 'INVALID_OUTPUT' });
    assert.equal(groqCalls, 2);
    assert.equal(databaseCalls, 0);
  }
});
test('RAG: rejects invalid native dimensions, zero and non-finite vectors', async () => {
  for (const value of [Array(383).fill(1), Array(384).fill(0), Array(384).fill(Infinity), Array(384).fill(1e40)]) {
    vector = value;
    await assert.rejects(() => knowledgeEmbeddings.generate('Цена'), { code: 'INVALID_OUTPUT' });
  }
});
test('RAG: unrelated question with nearby articles still returns requested fallback if model finds no answer', async () => {
  answer = { answer: 'В статьях нет информации о погоде.', source_ids: [] };
  assert.deepEqual(await answerKnowledgeQuestionUseCase.execute('Какая погода?'), { answer: 'Мы обрабатываем ваш запрос', sources: [] });
});
test('RAG: no matching articles skips answer generation and returns fallback', async () => {
  sources = [];
  assert.equal((await answerKnowledgeQuestionUseCase.execute('Цена?')).answer, 'Мы обрабатываем ваш запрос');
  assert.equal(groqCalls, 1);
});
test('RAG: invalid source citation and malformed answer are rejected', async () => {
  for (const value of [{ answer: 'Invented', source_ids: [999] }, { answer: 'Invented', source_ids: ['2'] }, { answer: '', source_ids: [2] }]) {
    answer = value;
    await assert.rejects(() => answerKnowledgeQuestionUseCase.execute('Цена?'), { code: 'INVALID_OUTPUT' });
  }
});
test('RAG: answer context preserves an article within the supported 12000-character limit', async () => {
  const body = `${'a'.repeat(4900)} Цена дня — 900 рублей.`;
  sources = [{ id: 2, title: 'Цены', body, similarity: 0.8 }];
  await answerKnowledgeQuestionUseCase.execute('Цена?');
  assert.equal(answerInput?.sources[0].body, body);
});
test('RAG: provider error exposes no provider response', async () => {
  providerStatus = 429;
  await assert.rejects(() => answerKnowledgeQuestionUseCase.execute('Цена?'), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Groq отклонил запрос.');
    return true;
  });
  assert.equal(databaseCalls, 0);
});
test('RAG: invalid questions and threshold fail before expensive downstream steps', async () => {
  for (const value of ['', 'a'.repeat(2001), null]) await assert.rejects(() => answerKnowledgeQuestionUseCase.execute(value), { code: 'INVALID_INPUT' });
  assert.equal(groqCalls, 0);
  process.env.RAG_MIN_SIMILARITY = 'invalid';
  await assert.rejects(() => answerKnowledgeQuestionUseCase.execute('Цена?'), { code: 'CONFIGURATION' });
  assert.equal(databaseCalls, 0);
});
test('knowledge-admin: secret gate prevents unauthenticated embedding and seed operations', async () => {
  for (const token of ['', 'wrong']) {
    const request = new Request('https://edge.test/knowledge-admin', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'seed' }) });
    assert.equal((await handleKnowledgeAdminRequest(request)).status, 401);
  }
  assert.equal(groqCalls, 0); assert.equal(databaseCalls, 0);
});
test('knowledge-admin: malformed input and unknown actions cannot call providers', async () => {
  for (const body of ['{', JSON.stringify({ action: 'other' }), JSON.stringify({ action: 'embedding', text: 123 })]) {
    const response = await handleKnowledgeAdminRequest(new Request('https://edge.test/knowledge-admin', { method: 'POST', headers: { Authorization: 'Bearer admin-test' }, body }));
    assert.equal(response.status, 400);
  }
  assert.equal(groqCalls, 0);
});
test('MCP: local embedding helper uses the protected Edge endpoint and validates response', async () => {
  Reflect.deleteProperty(globalThis, 'Supabase');
  process.env.RAG_ADMIN_URL = 'https://edge.test/knowledge-admin';
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), process.env.RAG_ADMIN_URL);
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer admin-test');
    assert.deepEqual(JSON.parse(String(options?.body)), { action: 'embedding', text: 'Цены' });
    return Response.json({ embedding: vector, model: knowledgeEmbeddings.model() });
  };
  assert.equal((await knowledgeEmbeddings.generate('Цены')).embedding.length, 384);
  vector = [1];
  await assert.rejects(() => knowledgeEmbeddings.generate('Цены'), { code: 'INVALID_OUTPUT' });
});
