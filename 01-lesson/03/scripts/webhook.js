import SmeeClient from 'smee-client';

import { startServer } from '../server.js';

const port = Number(process.env.PORT) || 3000;
const host = '127.0.0.1';
const webhookPath = process.env.WEBHOOK_PATH || '/webhook';
const target = `http://${host}:${port}${webhookPath}`;
const retryDelayMs = Number(process.env.WEBHOOK_RETRY_DELAY_MS) || 3000;

let app;
let relay;
let shuttingDown = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectRelay(source) {
  while (!shuttingDown) {
    relay = new SmeeClient({
      source,
      target,
      logger: console,
      maxConnectionTimeout: 10_000,
    });

    try {
      await relay.start();
      return;
    } catch (error) {
      console.error(`Smee connection failed: ${error.message}`);
      await relay.stop();
      relay = undefined;
      await wait(retryDelayMs);
    }
  }
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await relay?.stop();
  await app?.close();
  console.log(`Webhook relay stopped (${signal})`);
  process.exit(0);
}

async function start() {
  app = await startServer({ port, host });
  const source = process.env.SMEE_URL || await SmeeClient.createChannel();

  console.log(`Public webhook URL: ${source}`);
  console.log(`Forwarding to: ${target}`);
  await connectRelay(source);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

start().catch(async (error) => {
  console.error(error.message);
  await app?.close();
  process.exit(1);
});
