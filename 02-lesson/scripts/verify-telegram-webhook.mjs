import { env } from 'node:process';
import assert from 'node:assert/strict';

try {
  const base = 'https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1';
  const unauthorized = await fetch(`${base}/webhook/telegram`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(unauthorized.status, 401);
  const admin = await fetch(`${base}/knowledge-admin`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'seed' }),
  });
  assert.equal(admin.status, 401);
  if (!env.TELEGRAM_WEBHOOK_SECRET || !env.BOT_TOKEN) throw new Error('Local Telegram configuration missing; no messages were sent');
  // Empty update proves the deployed secret gate works without writing a message.
  const authorized = await fetch(`${base}/webhook/telegram`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': env.TELEGRAM_WEBHOOK_SECRET }, body: '{}',
  });
  assert.equal(authorized.status, 200);
  const webhook = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`);
  const payload = await webhook.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.result.url, `${base}/webhook/telegram`);
  console.log(JSON.stringify({ unauthorizedWebhook: unauthorized.status, unauthorizedAdmin: admin.status, authorizedEmptyUpdate: authorized.status, telegramUrlMatches: true, pendingUpdates: payload.result.pending_update_count, messagesSent: 0 }));
} catch {
  console.error('Telegram deployment verification failed; no test messages were sent.');
  process.exitCode = 1;
}
