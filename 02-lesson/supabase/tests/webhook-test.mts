import assert from 'node:assert/strict';
import test from 'node:test';

import { createTelegramBotClient } from '../functions/webhook/src/adapters/telegram-bot-client.ts';
import { createHandleTelegramUpdate } from '../functions/webhook/src/application/handle-telegram-update.ts';
import type {
  IncomingTelegramMessage,
  OutgoingTelegramMessage,
} from '../functions/webhook/src/application/handle-telegram-update.ts';
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
  saveBotReply: (message: OutgoingTelegramMessage) => Promise<void> = async () => {},
): (request: Request) => Promise<Response> {
  const fetchFn: typeof fetch = async (input, options) => {
    const url = String(input);
    requests.push({ url, options });
    return createJsonResponse({ ok: true });
  };

  const telegramClient = createTelegramBotClient({
    botToken: 'test-token',
    fetchFn,
  });
  const handleTelegramUpdate = createHandleTelegramUpdate({
    telegramClient,
    saveMessage,
    saveBotReply,
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

test('replies with a fixed acknowledgement without calling a currency API', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests);

  const response = await handler(
    createTelegramRequest(telegramUpdate('eur')),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /^https:\/\/api\.telegram\.org\//);
  assert.deepEqual(JSON.parse(String(requests[0].options?.body)), {
    chat_id: 123,
    text: 'Мы получили ваш запрос',
  });
});

test('uses the same acknowledgement for arbitrary message text', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const handler = createTestHandler(requests);

  for (const text of ['курс рубля', 'любой другой текст']) {
    const response = await handler(createTelegramRequest(telegramUpdate(text)));
    assert.equal(response.status, 200);
  }

  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((request) => JSON.parse(String(request.options?.body)).text),
    ['Мы получили ваш запрос', 'Мы получили ваш запрос'],
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

test('saves a bot reply after Telegram accepts it', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const savedReplies: OutgoingTelegramMessage[] = [];
  const handler = createTestHandler(
    requests,
    async () => {},
    async (message) => {
      assert.equal(requests.length, 1);
      savedReplies.push(message);
    },
  );

  const response = await handler(createTelegramRequest(telegramUpdate('eur')));

  assert.equal(response.status, 200);
  assert.equal(savedReplies.length, 1);
  assert.equal(savedReplies[0].userId, '123');
  assert.equal(savedReplies[0].body, 'Мы получили ваш запрос');
  assert.ok(Number.isFinite(Date.parse(savedReplies[0].sentAt)));
});

test('does not save a bot reply when Telegram rejects it', async () => {
  let savedReplies = 0;
  const handleTelegramUpdate = createHandleTelegramUpdate({
    telegramClient: {
      async sendMessage() {
        throw new Error('Telegram API request failed');
      },
    },
    saveMessage: async () => {},
    saveBotReply: async () => {
      savedReplies += 1;
    },
  });

  await assert.rejects(() => handleTelegramUpdate(telegramUpdate()));
  assert.equal(savedReplies, 0);
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
