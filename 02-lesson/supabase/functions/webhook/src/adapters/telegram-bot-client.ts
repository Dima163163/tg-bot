import { env } from 'node:process';

export const telegramBotClient = {
  async sendMessage(input: { chatId: number; text: string }): Promise<{ sentAt: string }> {
    const token = env.BOT_TOKEN;
    if (!token) throw new Error('Telegram is not configured');
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: input.chatId, text: input.text }),
      });
    } catch { throw new Error('Telegram request failed'); }
    const payload: unknown = await response.json().catch(() => null);
    const result = payload && typeof payload === 'object' && 'result' in payload ? payload.result : null;
    if (!response.ok || !payload || typeof payload !== 'object' || !('ok' in payload) || payload.ok !== true ||
      !result || typeof result !== 'object' || !('date' in result) || typeof result.date !== 'number' ||
      !Number.isSafeInteger(result.date) || result.date < 0 || result.date > 8_640_000_000_000) {
      throw new Error('Telegram did not confirm delivery');
    }
    return { sentAt: new Date(result.date * 1000).toISOString() };
  },
};
