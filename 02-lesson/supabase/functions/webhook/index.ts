import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

import { createFrankfurterRateProvider } from './src/adapters/frankfurter-rate-provider.ts';
import { createTelegramBotClient } from './src/adapters/telegram-bot-client.ts';
import { createGetUsdRate } from './src/application/get-usd-rate.ts';
import { createHandleTelegramUpdate } from './src/application/handle-telegram-update.ts';
import { createWebhookHandler } from './src/http/webhook-handler.ts';

const botToken = Deno.env.get('BOT_TOKEN') ?? '';
const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

const rateProvider = createFrankfurterRateProvider();
const getUsdRate = createGetUsdRate({ rateProvider });
const telegramClient = createTelegramBotClient({ botToken });
export const handler = withSupabase({ auth: 'none' }, async (req, ctx) => {
  const handleTelegramUpdate = createHandleTelegramUpdate({
    getUsdRate,
    telegramClient,
    async saveMessage(message) {
      const { error } = await ctx.supabaseAdmin.rpc('save_telegram_message', {
        p_update_id: message.updateId,
        p_user_id: message.userId,
        p_first_name: message.firstName,
        p_last_name: message.lastName,
        p_author: message.author,
        p_body: message.body,
        p_sent_at: message.sentAt,
      });
      if (error) throw error;
    },
    async saveBotReply(message) {
      const { error } = await ctx.supabaseAdmin.rpc('save_telegram_bot_reply', {
        p_user_id: message.userId,
        p_body: message.body,
        p_sent_at: message.sentAt,
      });
      if (error) throw error;
    },
  });

  return createWebhookHandler({
    botToken,
    webhookSecret,
    handleTelegramUpdate,
  })(req);
});

export default { fetch: handler };
