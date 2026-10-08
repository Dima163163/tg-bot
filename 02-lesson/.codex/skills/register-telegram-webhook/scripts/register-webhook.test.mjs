import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { parseProjectUrl, validateBotToken, validateWebhookSecret } from './register-webhook.mjs';

test('личный Supabase URL преобразуется в точный маршрут webhook', () => {
  assert.deepEqual(parseProjectUrl('https://abcdefghijklmnopqrst.supabase.co/'), {
    projectRef: 'abcdefghijklmnopqrst',
    webhookUrl: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/webhook/telegram',
  });
});

test('запрещены общий проект и подмена адреса', () => {
  for (const value of [
    'https://cappgvetnxvjhnxufhkz.supabase.co',
    'http://abcdefghijklmnopqrst.supabase.co',
    'https://abcdefghijklmnopqrst.supabase.co/other',
    'https://abcdefghijklmnopqrst.supabase.co?x=1',
    'https://abcdefghijklmnopqrst.supabase.co.evil.example',
    'https://user@abcdefghijklmnopqrst.supabase.co',
  ]) {
    assert.throws(() => parseProjectUrl(value), { name: 'Error' });
  }
});

test('формат токена и Telegram webhook secret проверяется до сетевых запросов', () => {
  assert.equal(validateBotToken('123456:ABC_def-123'), '123456:ABC_def-123');
  assert.throws(() => validateBotToken('bad token'));
  assert.equal(validateWebhookSecret('a_1-Z'), 'a_1-Z');
  assert.equal(validateWebhookSecret('x'.repeat(256)).length, 256);
  for (const value of ['', 'x'.repeat(257), 'has space', 'line\nbreak', 'кириллица']) {
    assert.throws(() => validateWebhookSecret(value));
  }
});

test('неинтерактивный запуск ничего не меняет и не выводит секреты', () => {
  const script = fileURLToPath(new URL('./register-webhook.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', input: '' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /интерактивном терминале/);
});
