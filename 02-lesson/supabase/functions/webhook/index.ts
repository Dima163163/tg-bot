import '@supabase/functions-js/edge-runtime.d.ts';

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
const handleTelegramUpdate = createHandleTelegramUpdate({
  getUsdRate,
  telegramClient,
});

export const handler = createWebhookHandler({
  botToken,
  webhookSecret,
  handleTelegramUpdate,
});

export default { fetch: handler };
