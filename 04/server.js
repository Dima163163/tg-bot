import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const BOT_TOKEN = process.env.BOT_TOKEN || '';

const fastify = Fastify({ logger: true });

fastify.post('/webhook/telegram', async (request, reply) => {
  console.log(request.body);

  const message = request.body?.message;
  const chatId = message?.chat?.id;

  if (chatId === undefined || chatId === null) {
    return { ok: true };
  }

  if (!BOT_TOKEN) {
    fastify.log.error('BOT_TOKEN is missing in 04/.env');
    return reply.code(500).send({ ok: false });
  }

  const telegramResponse = await fetch(
    'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'Получил сообщение: ' + (message.text || 'обновление'),
      }),
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
