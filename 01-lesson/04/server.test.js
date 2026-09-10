import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from './server.js';

test('replies with the USD rate for a currency code', async (t) => {
  const requests = [];
  const fastify = createApp({
    botToken: 'test-token',
    logger: false,
    fetchFn: async (url, options) => {
      requests.push({ url, options });

      if (url.startsWith('https://api.frankfurter.dev/')) {
        return {
          ok: true,
          json: async () => ({
            date: '2026-09-02',
            rates: { EUR: 0.86371 },
          }),
        };
      }

      return { ok: true };
    },
  });

  t.after(async () => {
    await fastify.close();
  });

  const webhook = await fastify.inject({
    method: 'POST',
    url: '/webhook/telegram',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({
      message: { chat: { id: 123 }, text: 'eur' },
    }),
  });

  assert.equal(webhook.statusCode, 200);
  assert.deepEqual(webhook.json(), { ok: true });
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /base=USD$/);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    chat_id: 123,
    text: '1 USD = 0,86371 EUR\nДата курса: 2026-09-02',
  });
});

test('explains the message format for invalid input', async (t) => {
  const requests = [];
  const fastify = createApp({
    botToken: 'test-token',
    logger: false,
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    },
  });

  t.after(async () => {
    await fastify.close();
  });

  const webhook = await fastify.inject({
    method: 'POST',
    url: '/webhook/telegram',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({
      message: { chat: { id: 123 }, text: 'курс рубля' },
    }),
  });

  assert.equal(webhook.statusCode, 200);
  assert.equal(requests.length, 1);
  assert.equal(
    JSON.parse(requests[0].options.body).text,
    'Отправь трёхбуквенный код валюты, например: EUR, GBP или JPY.',
  );
});
