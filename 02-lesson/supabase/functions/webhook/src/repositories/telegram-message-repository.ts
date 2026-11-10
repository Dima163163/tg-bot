import { env } from 'node:process';
import type { IncomingTelegramMessage } from '../application/handle-telegram-update.ts';

async function rpc(name: string, input: Record<string, unknown>): Promise<unknown> {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Telegram database is not configured');
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch { throw new Error('Telegram database request failed'); }
  if (!response.ok) throw new Error('Telegram database rejected the operation');
  return response.status === 204 ? null : response.json();
}

export const telegramMessageRepository = {
  async saveIncoming(message: IncomingTelegramMessage): Promise<void> {
    await rpc('save_telegram_message', {
      p_update_id: message.updateId, p_user_id: message.userId, p_first_name: message.firstName,
      p_last_name: message.lastName, p_author: message.author, p_body: message.body, p_sent_at: message.sentAt,
    });
  },
  async claim(updateId: number, attempt: string): Promise<'claimed' | 'sent' | 'busy'> {
    const status = await rpc('claim_telegram_reply', { p_update_id: updateId, p_attempt: attempt });
    if (status !== 'claimed' && status !== 'sent' && status !== 'busy') throw new Error('Invalid reply lease');
    return status;
  },
  async complete(input: { updateId: number; attempt: string; userId: string; body: string; sentAt: string }): Promise<void> {
    await rpc('complete_telegram_reply', {
      p_update_id: input.updateId, p_attempt: input.attempt, p_user_id: input.userId,
      p_body: input.body, p_sent_at: input.sentAt,
    });
  },
  async fail(updateId: number, attempt: string): Promise<void> {
    await rpc('fail_telegram_reply', { p_update_id: updateId, p_attempt: attempt });
  },
};
