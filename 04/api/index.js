import fastify from '../server.js';

const ready = fastify.ready();

export default async function handler(request, response) {
  await ready;

  // Vercel invokes /api, while Telegram must call /webhook/telegram.
  const query = request.url?.includes('?')
    ? request.url.slice(request.url.indexOf('?'))
    : '';
  request.url = '/webhook/telegram' + query;

  fastify.server.emit('request', request, response);
}
