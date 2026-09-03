import assert from 'node:assert/strict';
import test from 'node:test';

import fastify from './server.js';

test('only Telegram webhook is available', async (t) => {
  t.after(async () => {
    await fastify.close();
  });

  const root = await fastify.inject({ method: 'GET', url: '/' });
  const webhook = await fastify.inject({
    method: 'POST',
    url: '/webhook/telegram',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ update_id: 1 }),
  });

  assert.equal(root.statusCode, 404);
  assert.equal(webhook.statusCode, 200);
  assert.deepEqual(webhook.json(), { ok: true });
});
