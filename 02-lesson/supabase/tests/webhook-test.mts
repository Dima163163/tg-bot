import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrankfurterRateProvider } from '../functions/webhook/src/adapters/frankfurter-rate-provider.ts';
import { createTelegramBotClient } from '../functions/webhook/src/adapters/telegram-bot-client.ts';
import { createGetUsdRate } from '../functions/webhook/src/application/get-usd-rate.ts';
import { createHandleTelegramUpdate } from '../functions/webhook/src/application/handle-telegram-update.ts';
import type { IncomingTelegramMessage } from '../functions/webhook/src/application/handle-telegram-update.ts';
import { createWebhookHandler } from '../functions/webhook/src/http/webhook-handler.ts';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createTestHandler(
  requests: Array<{ url: string; options?: RequestInit }>,
  saveMessage: (message: IncomingTelegramMessage) => Promise<void> = async () => {},
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
    saveMessage,
  });

  return createWebhookHandler({
    botToken: 'test-token',
    webhookSecret: 'test-secret',
    handleTelegramUpdate,
  });
}

function telegramUpdate(text = 'eur') {
  return {
    update_id: 100,
    message: {
      message_id: 5,
      date: 1_789_632_000,
      chat: { id: 123 },
      from: { id: 123, is_bot: false, first_name: 'Anna', last_name: 'Test', username: 'anna_test' },
      text,
    },
  };
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
    createTelegramRequest(telegramUpdate('eur')),
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
    createTelegramRequest(telegramUpdate('курс рубля')),
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

test('saves sender, body and Telegram timestamp before replying', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const saved: IncomingTelegramMessage[] = [];
  const handler = createTestHandler(requests, async (message) => {
    assert.equal(requests.length, 0);
    saved.push(message);
  });
  const response = await handler(createTelegramRequest(telegramUpdate('Hello')));
  assert.equal(response.status, 200);
  assert.deepEqual(saved, [{
    updateId: 100, userId: '123', firstName: 'Anna', lastName: 'Test',
    author: 'anna_test', body: 'Hello', sentAt: new Date(1_789_632_000 * 1000).toISOString(),
  }]);
});

test('uses the sender ID rather than group chat ID and preserves captions', async () => {
  const saved: IncomingTelegramMessage[] = [];
  const handler = createTestHandler([], async (message) => { saved.push(message); });
  const update = {
    update_id: 101,
    message: {
      date: 1_789_632_000, chat: { id: -100123 },
      from: { id: 456, first_name: 'Ivan' }, caption: 'Photo caption',
    },
  };
  assert.equal((await handler(createTelegramRequest(update))).status, 200);
  assert.equal(saved[0].userId, '456');
  assert.equal(saved[0].body, 'Photo caption');
  assert.equal(saved[0].author, 'Ivan');
  assert.equal(saved[0].lastName, null);
});

test('stores messages without text with a null body', async () => {
  const saved: IncomingTelegramMessage[] = [];
  const handler = createTestHandler([], async (message) => { saved.push(message); });
  const { text, ...message } = telegramUpdate().message;
  await handler(createTelegramRequest({ update_id: 102, message }));
  assert.equal(saved[0].body, null);
});

test('database failures return a retryable error and do not send a bot reply', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests, async () => { throw new Error('Database unavailable'); });
  const response = await handler(createTelegramRequest(telegramUpdate()));
  assert.equal(response.status, 502);
  assert.equal(requests.length, 0);
});

test('invalid webhook secret cannot write data', async () => {
  let writes = 0;
  const handler = createTestHandler([], async () => { writes += 1; });
  const request = createTelegramRequest(telegramUpdate());
  request.headers.set('x-telegram-bot-api-secret-token', 'wrong');
  assert.equal((await handler(request)).status, 401);
  assert.equal(writes, 0);
});

test('ignores unrelated updates, invalid messages and other bots', async () => {
  let writes = 0;
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests, async () => { writes += 1; });
  const botUpdate = telegramUpdate();
  botUpdate.message.from.is_bot = true;
  for (const update of [null, {}, { message: null }, { update_id: 103, callback_query: {} }, botUpdate]) {
    assert.equal((await handler(createTelegramRequest(update))).status, 200);
  }
  assert.equal(writes, 0);
  assert.equal(requests.length, 0);
});
