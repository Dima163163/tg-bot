import { spawn } from 'node:child_process';

import { startServer } from '../server.js';

const port = Number(process.env.PORT) || 3000;
const origin = process.env.ORIGIN_URL || 'http://127.0.0.1:' + port;
const protocol = process.env.CLOUDFLARED_PROTOCOL || 'http2';
const cloudflaredBinary = process.env.CLOUDFLARED_BIN || 'cloudflared';

let app;
let tunnel;
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  tunnel?.kill('SIGTERM');
  await app?.close();
  console.log('Cloudflare Tunnel stopped (' + signal + ')');
  process.exit(exitCode);
}

async function start() {
  app = await startServer({
    port,
    host: '127.0.0.1',
  });

  console.log('Origin is ready at ' + origin);
  console.log('The public trycloudflare.com URL will be printed by cloudflared.');

  tunnel = spawn(
    cloudflaredBinary,
    [
      'tunnel',
      '--no-autoupdate',
      '--protocol',
      protocol,
      '--edge-ip-version',
      '4',
      '--url',
      origin,
    ],
    {
      env: {
        ...process.env,
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost',
      },
      stdio: 'inherit',
    },
  );

  tunnel.once('error', (error) => {
    console.error('Failed to start cloudflared: ' + error.message);
    void shutdown('cloudflared error', 1);
  });

  tunnel.once('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error('cloudflared exited (' + (code ?? signal ?? 'unknown') + ')');
      void shutdown('cloudflared exit', code || 1);
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

start().catch(async (error) => {
  console.error(error.message);
  await app?.close();
  process.exit(1);
});
