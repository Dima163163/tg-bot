import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

import { createFrankfurterRateProvider } from './src/adapters/frankfurter-rate-provider.js';
import { createTelegramBotClient } from './src/adapters/telegram-bot-client.js';
import { createGetUsdRate } from './src/application/get-usd-rate.js';
import { createHandleTelegramUpdate } from './src/application/handle-telegram-update.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const BOT_TOKEN = process.env.BOT_TOKEN || '';

export function createApp({ botToken = BOT_TOKEN, fetchFn = fetch, logger = true } = {}) {
  const fastify = Fastify({ logger });
  const rateProvider = createFrankfurterRateProvider({ fetchFn });
  const getUsdRate = createGetUsdRate({ rateProvider });
  const telegramClient = createTelegramBotClient({ botToken, fetchFn });
  const handleTelegramUpdate = createHandleTelegramUpdate({
    getUsdRate,
    telegramClient,
  });

  fastify.post('/webhook/telegram', async (request, reply) => {
    console.log(request.body);

    if (!botToken) {
      fastify.log.error('BOT_TOKEN is missing in 04/.env');
      return reply.code(500).send({ ok: false });
    }

    try {
      await handleTelegramUpdate(request.body);
      return { ok: true };
    } catch (error) {
      fastify.log.error(error, 'Telegram update handling failed');
      return reply.code(502).send({ ok: false });
    }
  });

  return fastify;
}

const fastify = createApp();

export default fastify;

const currentFile = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === currentFile
  : false;

if (isMainModule) {
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN is missing in 04/.env');
  }

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log('Server is running at http://localhost:' + PORT);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}
