import { env } from 'node:process';
import type { ConversationMessage } from '../../ai/application/contracts.ts';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function getMessages(query: Record<string, string>): Promise<unknown[]> {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Telegram database is not configured');
  const url = new URL(`${base.replace(/\/+$/, '')}/rest/v1/messages`);
  url.search = new URLSearchParams(query).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  } catch { throw new Error('Telegram history request failed'); }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data)) throw new Error('Telegram history request failed');
  return data;
}

export const recentTelegramMessagesRepository = {
  async findForUpdate(input: { updateId: number; userId: string; question: string }): Promise<ConversationMessage[]> {
    const current = await getMessages({
      select: 'id,client_id', telegram_update_id: `eq.${input.updateId}`,
      messenger_user_id: `eq.${input.userId}`, messenger_type: 'eq.telegram', limit: '1',
    });
    const incoming = current[0];
    if (!record(incoming) || !Number.isSafeInteger(incoming.id) || !Number.isSafeInteger(incoming.client_id) ||
        Number(incoming.id) < 1 || Number(incoming.client_id) < 1) throw new Error('Incoming Telegram message is missing');
    const rows = await getMessages({
      select: 'id,body,messenger_type', client_id: `eq.${incoming.client_id}`, id: `lte.${incoming.id}`,
      messenger_type: 'in.(telegram,telegram_bot)', order: 'created_at.desc,id.desc', limit: '5',
    });
    const history: ConversationMessage[] = [];
    for (const row of rows) {
      if (!record(row) || !Number.isSafeInteger(row.id) ||
          (row.messenger_type !== 'telegram' && row.messenger_type !== 'telegram_bot') ||
          (row.body !== null && typeof row.body !== 'string')) throw new Error('Invalid Telegram history');
      if (row.id === incoming.id || typeof row.body !== 'string' || !row.body.trim()) continue;
      history.push({ role: row.messenger_type === 'telegram_bot' ? 'assistant' : 'user', content: row.body.slice(0, 2000) });
    }
    return [...history.slice(0, 4).reverse(), { role: 'user', content: input.question }];
  },
};
