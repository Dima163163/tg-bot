import assert from 'node:assert/strict';
import test, { afterEach, mock } from 'node:test';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createArticleMcpServer } from '../modules/articles/mcp/tools.ts';

afterEach(() => mock.restoreAll());
const version = '2026-11-09T10:00:00+00:00';

async function rpc(userId: string | null, method: string, params: unknown) {
  const handler = createMcpHandler(() => createArticleMcpServer(userId));
  const response = await handler.fetch(new Request('https://example.test/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }));
  assert.equal(response.status, 200);
  const text = await response.text();
  const line = text.split('\n').find((part) => part.startsWith('data: '));
  assert.ok(line);
  return JSON.parse(line.slice(6));
}

function database(operator: boolean) {
  process.env.SUPABASE_URL = 'https://database.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  process.env.EMBEDDINGS_PROVIDER = '';
  process.env.EMBEDDINGS_API_URL = '';
  const writes: { method: string; query: URLSearchParams; body: unknown }[] = [];
  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/panel_operators')) return Response.json(operator ? [{ id: 1 }] : []);
    assert.equal(url.pathname, '/rest/v1/articles');
    if (init?.method !== 'GET') {
      writes.push({ method: init?.method ?? '', query: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : null });
      return Response.json([]);
    }
    return Response.json([{ id: 1, title: 'Old', body: 'Text', created_at: version, updated_at: version, embedding_model: null }]);
  });
  return writes;
}

test('MCP exposes article tools through the protocol', async () => {
  const result = await rpc('operator', 'tools/list', {});
  assert.deepEqual(result.result.tools.map((tool: { name: string }) => tool.name),
    ['list_articles', 'get_article', 'create_article', 'update_article', 'delete_article']);
});

test('MCP checks operator membership before accessing articles', async () => {
  const writes = database(false);
  const result = await rpc('not-operator', 'tools/call', { name: 'create_article', arguments: { title: 'A', body: 'B' } });
  assert.equal(result.result.isError, true);
  assert.equal(JSON.parse(result.result.content[0].text).code, 'FORBIDDEN');
  assert.equal(writes.length, 0);
});

test('MCP rejects stale updates and conditions deletion on the version', async () => {
  const writes = database(true);
  const update = await rpc('operator', 'tools/call', { name: 'update_article', arguments: {
    id: '1', title: 'New', body: 'New', expected_updated_at: '2026-11-09T10:01:00+00:00',
  } });
  assert.equal(JSON.parse(update.result.content[0].text).code, 'CONFLICT');
  assert.equal(writes.length, 0);
  const deletion = await rpc('operator', 'tools/call', { name: 'delete_article', arguments: { id: '1', expected_updated_at: version } });
  assert.equal(JSON.parse(deletion.result.content[0].text).code, 'CONFLICT');
  assert.equal(writes[0].query.get('updated_at'), `eq.${version}`);
});
