import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrankfurterRateProvider } from '../functions/webhook/src/adapters/frankfurter-rate-provider.ts';
import { createTelegramBotClient } from '../functions/webhook/src/adapters/telegram-bot-client.ts';
import { createGetUsdRate } from '../functions/webhook/src/application/get-usd-rate.ts';
import { createHandleTelegramUpdate } from '../functions/webhook/src/application/handle-telegram-update.ts';
import { createWebhookHandler } from '../functions/webhook/src/http/webhook-handler.ts';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createTestHandler(
  requests: Array<{ url: string; options?: RequestInit }>,
): (request: Request) => Promise<Response> {
  const fetchFn: typeof fetch = async (input, options) => {
    const url = String(input);
    requests.push({ url, options });

    if (url.startsWith('https://api.frankfurter.dev/')) {
      return createJsonResponse({
        date: '2026-09-02',
        rates: { EUR: 0.86371 },
      });
    }

    return createJsonResponse({ ok: true });
  };

  const rateProvider = createFrankfurterRateProvider({ fetchFn });
  const getUsdRate = createGetUsdRate({ rateProvider });
  const telegramClient = createTelegramBotClient({
    botToken: 'test-token',
    fetchFn,
  });
  const handleTelegramUpdate = createHandleTelegramUpdate({
    getUsdRate,
    telegramClient,
  });

  return createWebhookHandler({
    botToken: 'test-token',
    webhookSecret: 'test-secret',
    handleTelegramUpdate,
  });
}

function createTelegramRequest(body: unknown, path = '/functions/v1/webhook/telegram') {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': 'test-secret',
    },
    body: JSON.stringify(body),
  });
}

test('replies with the USD rate for a currency code', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests);

  const response = await handler(
    createTelegramRequest({
      message: { chat: { id: 123 }, text: 'eur' },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /base=USD$/);
  assert.deepEqual(JSON.parse(String(requests[1].options?.body)), {
    chat_id: 123,
    text: '1 USD = 0,86371 EUR\nДата курса: 2026-09-02',
  });
});

test('explains the message format for invalid input', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests);

  const response = await handler(
    createTelegramRequest({
      message: { chat: { id: 123 }, text: 'курс рубля' },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(requests.length, 1);
  assert.equal(
    JSON.parse(String(requests[0].options?.body)).text,
    'Отправь трёхбуквенный код валюты, например: EUR, GBP или JPY.',
  );
});

test('rejects requests without Telegram webhook secret', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests);
  const request = createTelegramRequest({ message: { chat: { id: 123 } } });
  request.headers.set('x-telegram-bot-api-secret-token', 'wrong-secret');

  const response = await handler(request);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false });
  assert.equal(requests.length, 0);
});

test('returns not found for another path', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests);

  const response = await handler(
    createTelegramRequest({}, '/functions/v1/webhook/other'),
  );

  assert.equal(response.status, 404);
  assert.equal(requests.length, 0);
});
