import { env } from 'node:process';

export const webhookAccess = {
  async authorize(secret: string): Promise<'allowed' | 'denied' | 'unconfigured'> {
    const expected = env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected || !env.BOT_TOKEN) return 'unconfigured';
    if (!secret || secret.length > 256) return 'denied';
    const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [actual, configured] = await Promise.all([digest(secret), digest(expected)]);
    let difference = 0;
    for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ configured[index];
    return difference === 0 ? 'allowed' : 'denied';
  },
};
