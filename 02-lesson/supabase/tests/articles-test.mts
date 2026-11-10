import assert from 'node:assert/strict';
import test, { afterEach, mock } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ArticleError } from '../functions/articles/src/application/contracts.ts';
import type { ArticleWrite, GenerateArticleEmbedding, StoredArticle } from '../functions/articles/src/application/contracts.ts';
import { handleArticlesRequest } from '../functions/articles/src/http/articles-handler.ts';
import { articleEmbeddings } from '../functions/articles/src/adapters/http-embedding-client.ts';

afterEach(() => mock.restoreAll());
const originalDate = '2026-11-09T10:00:00+00:00';
const laterDate = '2026-11-09T10:01:00+00:00';
const vector = Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0);

function configureEmbeddings(options: { apiUrl?: string; model?: string; apiKey?: string; documentPrefix?: string } = {}) {
  process.env.EMBEDDINGS_PROVIDER = '';
  process.env.EMBEDDINGS_API_URL = options.apiUrl ?? '';
  process.env.EMBEDDINGS_MODEL = options.model ?? '';
  process.env.EMBEDDINGS_API_KEY = options.apiKey ?? '';
  process.env.EMBEDDINGS_DOCUMENT_PREFIX = options.documentPrefix ?? '';
}

// Test doubles live at HTTP boundaries. Production modules use direct imports.
function fixture({ model = null, generate, access = 'authorized' }: {
  model?: string | null;
  generate?: GenerateArticleEmbedding;
  access?: 'authorized' | 'unauthenticated' | 'forbidden';
} = {}) {
  configureEmbeddings(generate ? { apiUrl: 'https://embeddings.example.test', model: 'new-model' } : {});
  process.env.SUPABASE_URL = 'https://database.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
  const rows = new Map<string, StoredArticle>([['1', {
    id: 1, title: 'Old title', body: 'Old body', created_at: originalDate,
    updated_at: originalDate, embedding_model: model,
  }]]);
  const writes: ArticleWrite[] = [];
  let nextId = 2;
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === 'embeddings.example.test') {
      assert.ok(generate);
      const payload = JSON.parse(String(init?.body));
      const [title, ...body] = String(payload.input).split('\n\n');
      try {
        const result = await generate(title, body.join('\n\n'));
        return Response.json({ data: [{ embedding: result?.embedding }] });
      } catch (error) {
        if (error instanceof ArticleError) return Response.json({ error: 'Provider unavailable' }, { status: 503 });
        throw error;
      }
    }
    assert.equal(url.hostname, 'database.example.test');
    assert.equal(new Headers(init?.headers).get('apikey'), 'test-server-key');
    if (url.pathname.endsWith('/panel_operators')) {
      return Response.json(access === 'authorized' ? [{ id: 1 }] : []);
    }
    assert.equal(url.pathname, '/rest/v1/articles');
    const idFilter = url.searchParams.get('id');
    const expected = url.searchParams.get('updated_at')?.replace(/^eq\./, '');
    const matching = [...rows.values()].filter((row) => {
      if (!idFilter) return true;
      if (idFilter.startsWith('eq.')) return row.id === Number(idFilter.slice(3));
      return row.id < Number(idFilter.slice(3));
    }).filter((row) => !expected || row.updated_at === expected);
    if (init?.method === 'POST') {
      const content: ArticleWrite = JSON.parse(String(init.body));
      writes.push(content);
      const row = { ...content, id: nextId++, created_at: originalDate, updated_at: originalDate };
      rows.set(String(row.id), row);
      return Response.json([row], { status: 201 });
    }
    if (init?.method === 'PATCH') {
      if (!matching.length) return Response.json([]);
      const content: ArticleWrite = JSON.parse(String(init.body));
      writes.push(content);
      const row = { ...matching[0], ...content, updated_at: laterDate };
      rows.set(String(row.id), row);
      return Response.json([row]);
    }
    if (init?.method === 'DELETE') {
      matching.forEach((row) => rows.delete(String(row.id)));
      return Response.json(matching.map((row) => ({ id: row.id })));
    }
    return Response.json(matching.sort((a, b) => b.id - a.id).slice(0, Number(url.searchParams.get('limit') ?? 50)));
  });
  const handler = (request: Request) => handleArticlesRequest(request, access === 'unauthenticated' ? null : 'operator');
  return { handler, rows, writes };
}

function stubEmbeddingEndpoint(options: {
  apiUrl?: string; model?: string; apiKey?: string; documentPrefix?: string; fetchFn?: typeof fetch;
}) {
  configureEmbeddings(options);
  if (options.fetchFn) mock.method(globalThis, 'fetch', options.fetchFn);
  return articleEmbeddings.generate;
}

function request(method: string, body?: unknown, query = '') {
  return new Request(`https://example.test/functions/v1/articles${query}`, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });
}

function updateInput() {
  return { id: 1, title: 'New title', body: 'New body', expected_updated_at: originalDate };
}

test('articles: text CRUD works before a model is configured', async () => {
  const { handler, rows, writes } = fixture();
  const create = await handler(request('POST', { title: '  New article  ', body: 'Text' }));
  assert.equal(create.status, 201);
  const created = await create.json();
  assert.equal(created.title, 'New article');
  assert.equal('embedding' in created, false);
  assert.deepEqual(writes[0], { title: 'New article', body: 'Text', embedding: null, embedding_model: null });
  const update = await handler(request('PATCH', updateInput()));
  assert.equal(update.status, 200);
  assert.equal(rows.get('1')?.title, 'New title');
  assert.equal(rows.get('1')?.body, 'New body');
  assert.equal((await handler(request('DELETE', undefined, '?id=1'))).status, 204);
  assert.equal((await handler(request('DELETE', undefined, '?id=1'))).status, 404);
});

test('articles: configured embeddings and new content are saved in the same write', async () => {
  const calls: string[] = [];
  const { handler, writes } = fixture({
    model: 'old-model',
    generate: async (title, body) => { calls.push(`${title}|${body}`); return { embedding: vector, model: 'new-model' }; },
  });
  assert.equal((await handler(request('PATCH', updateInput()))).status, 200);
  assert.deepEqual(calls, ['New title|New body']);
  assert.deepEqual(writes, [{ title: 'New title', body: 'New body', embedding: vector, embedding_model: 'new-model' }]);
});

test('articles: provider failure leaves the old article intact', async () => {
  const { handler, rows, writes } = fixture({
    model: 'old-model', generate: async () => { throw new ArticleError('EMBEDDING_UNAVAILABLE', 'Provider unavailable'); },
  });
  assert.equal((await handler(request('PATCH', updateInput()))).status, 503);
  assert.equal(rows.get('1')?.body, 'Old body');
  assert.equal(writes.length, 0);
});

test('articles: removing provider configuration cannot silently stale an existing embedding', async () => {
  const { handler, rows, writes } = fixture({ model: 'existing-model' });
  assert.equal((await handler(request('PATCH', updateInput()))).status, 503);
  assert.equal(rows.get('1')?.title, 'Old title');
  assert.equal(writes.length, 0);
});

test('articles: stale editor and a race during embedding generation return 409', async () => {
  const first = fixture();
  assert.equal((await first.handler(request('PATCH', { ...updateInput(), expected_updated_at: laterDate }))).status, 409);
  assert.equal(first.writes.length, 0);

  const second = fixture({ generate: async () => {
    const row = second.rows.get('1');
    assert.ok(row);
    second.rows.set('1', { ...row, title: 'Another editor', updated_at: laterDate });
    return { embedding: vector, model: 'model' };
  } });
  assert.equal((await second.handler(request('PATCH', updateInput()))).status, 409);
  assert.equal(second.rows.get('1')?.title, 'Another editor');
  assert.equal(second.writes.length, 0);
});

test('articles: unauthenticated and non-operator requests cannot write or call the provider', async () => {
  for (const [access, expected] of [['unauthenticated', 401], ['forbidden', 403]] as const) {
    const { handler, writes } = fixture({ access, generate: async () => { assert.fail('Provider must not be called'); } });
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      assert.equal((await handler(request(method, method === 'GET' || method === 'DELETE' ? undefined : updateInput()))).status, expected);
    }
    assert.equal(writes.length, 0);
  }
});

test('articles: blank/oversized content, bad JSON, ID and cursor are rejected', async () => {
  const { handler, writes } = fixture();
  for (const input of [{ title: ' ', body: 'text' }, { title: 'title', body: ' ' }, { title: 'x'.repeat(201), body: 'text' }, { title: 'title', body: 'x'.repeat(12_001) }]) {
    assert.equal((await handler(request('POST', input))).status, 400);
  }
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', body: '{' }))).status, 400);
  assert.equal((await handler(request('PATCH', { ...updateInput(), id: -1 }))).status, 400);
  assert.equal((await handler(request('PATCH', { ...updateInput(), expected_updated_at: null }))).status, 400);
  assert.equal((await handler(request('PATCH', { ...updateInput(), id: 99 }))).status, 404);
  assert.equal((await handler(request('GET', undefined, '?cursor=bad'))).status, 400);
  assert.equal(writes.length, 0);
});

test('articles: pagination cursor loads older rows without leaking internal model metadata', async () => {
  const { handler } = fixture();
  for (let i = 0; i < 3; i++) await handler(request('POST', { title: `Article ${i}`, body: 'Text' }));
  const page1 = await (await handler(request('GET', undefined, '?limit=2'))).json();
  assert.deepEqual(page1.data.map((row: { id: number }) => row.id), [4, 3]);
  assert.equal(page1.hasMore, true);
  assert.equal('embedding_model' in page1.data[0], false);
  const page2 = await (await handler(request('GET', undefined, `?limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`))).json();
  assert.deepEqual(page2.data.map((row: { id: number }) => row.id), [2, 1]);
  assert.equal(page2.nextCursor, null);
});

test('embedding client: absent configuration allows unindexed CRUD, partial configuration fails closed', async () => {
  assert.equal(await stubEmbeddingEndpoint({})('Title', 'Body'), null);
  await assert.rejects(stubEmbeddingEndpoint({ model: 'chosen' })('Title', 'Body'), { code: 'EMBEDDING_UNAVAILABLE' });
});

test('embedding client: sends the new title/body with a configured document prefix', async () => {
  const generate = stubEmbeddingEndpoint({
    apiUrl: 'https://embeddings.example.test/v1/embeddings', model: 'chosen-model', apiKey: 'secret', documentPrefix: 'passage: ',
    fetchFn: async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer secret');
      assert.deepEqual(JSON.parse(String(init?.body)), { model: 'chosen-model', input: 'passage: Title\n\nBody', encoding_format: 'float' });
      assert.equal(init?.redirect, 'error');
      return Response.json({ data: [{ embedding: vector }] });
    },
  });
  assert.deepEqual(await generate('Title', 'Body'), { embedding: vector, model: 'chosen-model' });
});

test('embedding client: rejects wrong dimensions, zero, overflow and malformed responses', async () => {
  for (const payload of [{ data: [{ embedding: [1, 2, 3] }] }, { data: [{ embedding: Array(384).fill(0) }] }, { data: [{ embedding: vector.map((value) => value ? 1e100 : 0) }] }, { data: [{ embedding: vector }, { embedding: vector }] }, { message: 'unexpected' }]) {
    const generate = stubEmbeddingEndpoint({ apiUrl: 'https://example.test', model: 'model', fetchFn: async () => Response.json(payload) });
    await assert.rejects(generate('Title', 'Body'), { code: 'INVALID_EMBEDDING' });
  }
});

test('embedding client: reports provider errors and timeout without exposing its response', async () => {
  const failed = stubEmbeddingEndpoint({ apiUrl: 'https://example.test', model: 'model', fetchFn: async () => new Response('private provider response', { status: 429 }) });
  await assert.rejects(failed('Title', 'Body'), (error: unknown) => error instanceof ArticleError && error.code === 'EMBEDDING_UNAVAILABLE' && !error.message.includes('private'));
  const timeout = stubEmbeddingEndpoint({ apiUrl: 'https://example.test', model: 'model', fetchFn: async () => { throw new DOMException('Timeout', 'TimeoutError'); } });
  await assert.rejects(timeout('Title', 'Body'), { code: 'EMBEDDING_TIMEOUT' });
});

async function prepareMcpWrite(input: unknown) {
  return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--experimental-strip-types', fileURLToPath(new URL('../../scripts/prepare-article-write.mjs', import.meta.url)),
    ], {
      env: { ...process.env, EMBEDDINGS_API_URL: '', EMBEDDINGS_MODEL: '', EMBEDDINGS_API_KEY: '', EMBEDDINGS_DOCUMENT_PREFIX: '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

test('MCP helper: encodes article contents as SQL data and never executes a database call', async () => {
  const body = "O'Reilly \\ $$; drop table articles; --";
  const result = await prepareMcpWrite({ operation: 'create', title: 'Title', body });
  assert.equal(result.status, 0);
  const prepared = JSON.parse(result.stdout);
  assert.equal(prepared.body, body);
  assert.equal(prepared.embedding_model, null);
  assert.ok(prepared.sql.includes(Buffer.from(body).toString('base64')));
  assert.equal(prepared.sql.includes('drop table'), false);
});

test('MCP helper: guards timestamp/model and refuses an indexed write without a provider', async () => {
  const input = { operation: 'update', ...updateInput(), expected_embedding_model: null };
  const result = await prepareMcpWrite(input);
  assert.equal(result.status, 0);
  const prepared = JSON.parse(result.stdout);
  assert.match(prepared.sql, /where id = 1 and updated_at =/);
  assert.match(prepared.sql, /embedding_model is not distinct from null/);
  const rejected = await prepareMcpWrite({ ...input, expected_embedding_model: 'existing-model' });
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, '');
  assert.equal(JSON.parse(rejected.stderr).code, 'EMBEDDING_UNAVAILABLE');
});
