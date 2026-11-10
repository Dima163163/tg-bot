import assert from 'node:assert/strict';
import { test, beforeEach, after } from 'node:test';
import { handleWebhookRequest } from '../functions/webhook/src/http/webhook-handler.ts';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const vector = Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0);
Object.defineProperty(globalThis, 'Supabase', { configurable: true, value: { ai: { Session: class {
  async run() { return vector; }
} } } });
const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
let claim = 'claimed';
let failRpc = '';
let rejectTelegram = false;
let failGroq = false;
let emptySearch = false;
const json = (value: unknown, status = 200) => Response.json(value, { status });
beforeEach(() => {
  calls.length = 0;
  claim = 'claimed'; failRpc = ''; rejectTelegram = false; failGroq = false; emptySearch = false;
  Object.assign(process.env, {
    SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'server-key',
    BOT_TOKEN: 'bot-test', TELEGRAM_WEBHOOK_SECRET: 'secret-test', GROQ_API_KEY: 'groq-test',
    GROQ_MODEL: 'openai/gpt-oss-20b', RAG_MIN_SIMILARITY: '0.5',
  });
  globalThis.fetch = async (url, options) => {
    const name = String(url).split('/').at(-1)!;
    const input = JSON.parse(String(options?.body)) as Record<string, unknown>;
    calls.push({ name, input });
    if (name === failRpc) return json({ error: 'unavailable' }, 503);
    if (name === 'claim_telegram_reply') return json(claim);
    if (name === 'search_articles') return json(emptySearch ? [] : [{ id: 2, title: 'Цены', body: 'День стоит 900 рублей.', similarity: 0.8 }]);
    if (name === 'completions') {
      if (failGroq) return json({ error: 'private provider details' }, 429);
      const messages = input.messages as Array<{ content: string }>;
      const answer = messages[0].content.startsWith('Create an English')
        ? { search_text: 'Atlas coworking day pass price' } : { answer: 'Дневной пропуск стоит 900 рублей.', source_ids: [2] };
      return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }] });
    }
    if (name === 'sendMessage') return json(rejectTelegram ? { ok: false } : { ok: true, result: { date: 1_789_632_100 } });
    return new Response(null, { status: 204 });
  };
});
after(() => { globalThis.fetch = originalFetch; process.env = originalEnv; Reflect.deleteProperty(globalThis, 'Supabase'); });
function update(text: string | undefined = 'Сколько стоит день?') {
  return { update_id: 100, message: { date: 1_789_632_000, chat: { id: -100123 }, from: { id: 456, first_name: 'Анна', username: 'anna' }, ...(text === undefined ? {} : { text }) } };
}
function request(body: unknown = update(), secret = 'secret-test', path = '/functions/v1/webhook/telegram') {
  return new Request(`https://edge.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(body) });
}
const names = () => calls.map(call => call.name);

test('webhook: saves incoming, retrieves sources, sends grounded answer, then records confirmed delivery', async () => {
  assert.equal((await handleWebhookRequest(request())).status, 200);
  assert.deepEqual(names(), ['save_telegram_message', 'claim_telegram_reply', 'completions', 'search_articles', 'completions', 'sendMessage', 'complete_telegram_reply']);
  assert.equal(calls[0].input.p_user_id, '456');
  assert.equal(calls[0].input.p_author, 'anna');
  assert.equal(calls[0].input.p_sent_at, new Date(1_789_632_000 * 1000).toISOString());
  assert.equal(calls[5].input.chat_id, -100123);
  assert.match(String(calls[5].input.text), /900.*\n\nИсточники: Цены/);
  assert.equal(calls[6].input.p_body, calls[5].input.text);
  assert.equal(calls[6].input.p_sent_at, new Date(1_789_632_100 * 1000).toISOString());
  assert.equal(calls[1].input.p_attempt, calls[6].input.p_attempt);
});
test('webhook: completed duplicate does not call AI or Telegram', async () => {
  claim = 'sent';
  assert.equal((await handleWebhookRequest(request())).status, 200);
  assert.deepEqual(names(), ['save_telegram_message', 'claim_telegram_reply']);
});
test('webhook: concurrent duplicate gets retryable response without a second send', async () => {
  claim = 'busy';
  assert.equal((await handleWebhookRequest(request())).status, 502);
  assert.ok(!names().includes('sendMessage'));
});
test('webhook: invalid/missing secret, method, path and JSON cannot write data', async () => {
  for (const secret of ['', 'wrong']) assert.equal((await handleWebhookRequest(request(update(), secret))).status, 401);
  assert.equal((await handleWebhookRequest(request({}, 'secret-test', '/webhook/other'))).status, 404);
  assert.equal((await handleWebhookRequest(new Request('https://edge.test/webhook/telegram'))).status, 405);
  const malformed = new Request('https://edge.test/webhook/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'secret-test' }, body: '{' });
  assert.equal((await handleWebhookRequest(malformed)).status, 400);
  assert.equal(calls.length, 0);
});
test('webhook: missing server secret fails closed', async () => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  assert.equal((await handleWebhookRequest(request())).status, 500);
  assert.equal(calls.length, 0);
});
test('webhook: database save/claim failures prevent AI and send', async () => {
  for (const rpc of ['save_telegram_message', 'claim_telegram_reply']) {
    calls.length = 0; failRpc = rpc;
    assert.equal((await handleWebhookRequest(request())).status, 502);
    assert.ok(!names().includes('completions'));
    assert.ok(!names().includes('sendMessage'));
  }
});
test('webhook: Telegram JSON rejection is not recorded as sent and releases attempt for retry', async () => {
  rejectTelegram = true;
  assert.equal((await handleWebhookRequest(request(update('/start')))).status, 502);
  assert.ok(!names().includes('complete_telegram_reply'));
  assert.equal(names().at(-1), 'fail_telegram_reply');
});
test('webhook: completion database failure remains retryable', async () => {
  failRpc = 'complete_telegram_reply';
  assert.equal((await handleWebhookRequest(request(update('/start')))).status, 502);
  assert.ok(names().includes('sendMessage'));
  assert.ok(!names().includes('fail_telegram_reply'));
});
test('webhook: provider outage returns a temporary message without inventing an answer', async () => {
  failGroq = true;
  assert.equal((await handleWebhookRequest(request())).status, 200);
  assert.match(String(calls.find(call => call.name === 'sendMessage')?.input.text), /временно недоступен/);
});
test('webhook: no search results avoids answer model and tells user information is missing', async () => {
  emptySearch = true;
  assert.equal((await handleWebhookRequest(request())).status, 200);
  assert.equal(names().filter(name => name === 'completions').length, 1);
  assert.equal(calls.find(call => call.name === 'sendMessage')?.input.text, 'Мы обрабатываем ваш запрос');
});
test('webhook: commands and overlong messages avoid AI calls', async () => {
  for (const text of ['/start', '/help@atlas_bot', 'a'.repeat(2001)]) {
    calls.length = 0;
    assert.equal((await handleWebhookRequest(request(update(text)))).status, 200);
    assert.ok(!names().includes('completions'));
  }
});
test('webhook: captions and non-text messages preserve incoming body', async () => {
  const value = update('/help');
  const { text, ...message } = value.message;
  await handleWebhookRequest(request({ ...value, message: { ...message, caption: '/help' } }));
  assert.equal(calls[0].input.p_body, '/help');
  calls.length = 0;
  await handleWebhookRequest(request({ ...value, message }));
  assert.equal(calls[0].input.p_body, null);
  assert.ok(!names().includes('completions'));
});
test('webhook: ignores unrelated, malformed updates and bots', async () => {
  for (const value of [null, {}, { update_id: 1, callback_query: {} }, { ...update(), message: { ...update().message, from: { id: 1, first_name: 'Bot', is_bot: true } } }]) {
    assert.equal((await handleWebhookRequest(request(value))).status, 200);
  }
  assert.equal(calls.length, 0);
});
