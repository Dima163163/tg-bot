import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

const defaultPort = Number(process.env.PORT) || 3000;
const defaultHost = process.env.HOST || '127.0.0.1';
const defaultWebhookPath = process.env.WEBHOOK_PATH || '/webhook';
const defaultWebhookSecret = process.env.WEBHOOK_SECRET || '';
const maxStoredEvents = Number(process.env.WEBHOOK_MAX_EVENTS) || 100;

function parseRawBody(request, body, done) {
  const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
  const contentType = String(request.headers['content-type'] || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();

  request.rawBody = rawBody;

  if (contentType === 'application/json' || contentType.endsWith('+json')) {
    try {
      done(null, rawBody.length > 0 ? JSON.parse(rawBody.toString('utf8')) : null);
    } catch {
      const error = new Error('Request body must contain valid JSON');
      error.statusCode = 400;
      done(error);
    }
    return;
  }

  done(null, rawBody.toString('utf8'));
}

function getSignature(request) {
  return (
    request.headers['x-webhook-signature'] ||
    request.headers['x-hub-signature-256'] ||
    request.headers['x-signature'] ||
    ''
  );
}

function isValidSignature(rawBody, receivedSignature, secret) {
  if (!secret) {
    return true;
  }

  const signature = String(receivedSignature).replace(/^sha256=/i, '').trim();

  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature.toLowerCase(), 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );
}

export function buildApp({
  logger = true,
  webhookPath = defaultWebhookPath,
  webhookSecret = defaultWebhookSecret,
  eventLimit = maxStoredEvents,
} = {}) {
  const app = Fastify({
    logger,
    bodyLimit: 1024 * 1024,
  });
  const webhookEvents = [];

  // Keep the exact bytes so providers can sign the original request body.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser(
    ['application/json', 'text/plain', 'application/octet-stream'],
    { parseAs: 'buffer' },
    parseRawBody,
  );
  app.addContentTypeParser('*', { parseAs: 'buffer' }, parseRawBody);

  app.get('/', async () => ({
    message: 'Welcome to Fastify backend!',
    webhook: `POST ${webhookPath}`,
  }));

  app.get('/hello', async () => ({
    message: 'Hello from Fastify backend!',
  }));

  app.get('/time', async () => ({
    currentTime: new Date().toISOString(),
  }));

  app.get('/status', async () => ({
    status: 'ok',
    message: 'Server is running',
    webhook: 'ready',
  }));

  app.get(webhookPath, async () => ({
    status: 'ready',
    method: 'POST',
    path: webhookPath,
    signature: webhookSecret ? 'required' : 'disabled',
  }));

  app.options(webhookPath, async (_request, reply) => {
    return reply.code(204).send();
  });

  app.post(webhookPath, async (request, reply) => {
    const rawBody = request.rawBody || Buffer.alloc(0);

    if (!isValidSignature(rawBody, getSignature(request), webhookSecret)) {
      return reply.code(401).send({
        received: false,
        error: 'Invalid webhook signature',
      });
    }

    const event = {
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      eventType: request.headers['x-event-type'] || null,
      contentType: request.headers['content-type'] || null,
      body: request.body ?? null,
    };

    webhookEvents.unshift(event);
    webhookEvents.length = Math.min(webhookEvents.length, eventLimit);

    request.log.info(
      { eventId: event.id, eventType: event.eventType },
      'Webhook received',
    );

    return reply.code(202).send({
      received: true,
      id: event.id,
      receivedAt: event.receivedAt,
    });
  });

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send({ error: 'Route Not Found' });
  });

  app.setErrorHandler(async (error, _request, reply) => {
    const statusCode = error.statusCode && error.statusCode < 500
      ? error.statusCode
      : 500;

    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.code(statusCode).send({
      error: statusCode === 400 ? error.message : 'Internal Server Error',
    });
  });

  return app;
}

export async function startServer({
  port = defaultPort,
  host = defaultHost,
  ...options
} = {}) {
  const app = buildApp(options);

  try {
    await app.listen({ port, host });
    console.log(`Server is running at http://${host}:${port}`);
    return app;
  } catch (error) {
    app.log.error(error);
    await app.close();
    throw error;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1]
  ? resolve(process.argv[1]) === currentFile
  : false;

if (isMainModule) {
  const app = await startServer();

  const shutdown = async (signal) => {
    app.log.info({ signal }, 'Shutting down server');
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
