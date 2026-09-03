import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';

function getCurrencyCode(text) {
  const currency = String(text || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function formatRate(rate) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 6,
  }).format(rate);
}

export function createApp({ botToken = BOT_TOKEN, fetchFn = fetch, logger = true } = {}) {
  const fastify = Fastify({ logger });

  fastify.post('/webhook/telegram', async (request, reply) => {
    console.log(request.body);

    const message = request.body?.message;
    const chatId = message?.chat?.id;

    if (chatId === undefined || chatId === null) {
      return { ok: true };
    }

    if (!botToken) {
      fastify.log.error('BOT_TOKEN is missing in 04/.env');
      return reply.code(500).send({ ok: false });
    }

    const currency = getCurrencyCode(message.text);
    let text = 'Отправь трёхбуквенный код валюты, например: EUR, GBP или JPY.';

    if (currency === 'USD') {
      text = '1 USD = 1 USD';
    } else if (currency) {
      try {
        const rateResponse = await fetchFn(FRANKFURTER_URL);
        const rateData = await rateResponse.json();
        const rate = rateData.rates?.[currency];

        text = rateResponse.ok && typeof rate === 'number'
          ? '1 USD = ' + formatRate(rate) + ' ' + currency + '\nДата курса: ' + rateData.date
          : 'Frankfurter не предоставляет курс для ' + currency + '. Попробуй EUR, GBP или JPY.';
      } catch (error) {
        fastify.log.error(error, 'Frankfurter API request failed');
        text = 'Не удалось получить курс. Попробуй ещё раз чуть позже.';
      }
    }

    const telegramResponse = await fetchFn(
      'https://api.telegram.org/bot' + botToken + '/sendMessage',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );

    if (!telegramResponse.ok) {
      fastify.log.error(
        { statusCode: telegramResponse.status },
        'Telegram API request failed',
      );
      return reply.code(502).send({ ok: false });
    }

    return { ok: true };
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
