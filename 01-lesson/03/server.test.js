import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { buildApp } from './server.js';

test('root and status endpoints are available', async (t) => {
  const app = buildApp({ logger: false });
  t.after(() => app.close());

  const root = await app.inject({ method: 'GET', url: '/' });
  const status = await app.inject({ method: 'GET', url: '/status' });

  assert.equal(root.statusCode, 200);
  assert.equal(root.json().webhook, 'POST /webhook');
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().status, 'ok');
});

test('webhook accepts JSON and returns an acknowledgement', async (t) => {
  const app = buildApp({ logger: false });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/webhook',
    headers: {
      'content-type': 'application/json',
      'x-event-type': 'test.created',
    },
    payload: JSON.stringify({ id: 42, action: 'created' }),
  });

  assert.equal(response.statusCode, 202);
  assert.equal(response.json().received, true);
  assert.match(response.json().id, /^[0-9a-f-]{36}$/);
});

test('webhook verifies HMAC-SHA256 when a secret is configured', async (t) => {
  const secret = 'local-test-secret';
  const payload = JSON.stringify({ ok: true });
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const app = buildApp({ logger: false, webhookSecret: secret });
  t.after(() => app.close());

  const accepted = await app.inject({
    method: 'POST',
    url: '/webhook',
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': `sha256=${signature}`,
    },
    payload,
  });
  const rejected = await app.inject({
    method: 'POST',
    url: '/webhook',
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': 'sha256=invalid',
    },
    payload,
  });

  assert.equal(accepted.statusCode, 202);
  assert.equal(rejected.statusCode, 401);
});
