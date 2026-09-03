import { spawn } from 'node:child_process';

import { startServer } from '../server.js';

const port = Number(process.env.PORT) || 3000;
const tunnelHost = process.env.TUNNEL_HOST || 'localhost.run';
const tunnelUser = process.env.TUNNEL_USER || 'nokey';
const tunnelSshPort = process.env.TUNNEL_SSH_PORT || '22';
const tunnelRemotePort = process.env.TUNNEL_REMOTE_PORT || '80';
const startupTimeoutMs = Number(process.env.TUNNEL_STARTUP_TIMEOUT_MS) || 30_000;

let app;
let tunnel;
let startupTimer;
let publicUrl;
let shuttingDown = false;
let outputBuffer = '';

function printPublicUrl(output) {
  outputBuffer = (outputBuffer + output).slice(-8_000);

  const match = outputBuffer.match(/https:\/\/[a-z0-9.-]+\.lhr\.life/i);
  if (!match || match[0] === publicUrl) {
    return;
  }

  publicUrl = match[0];
  clearTimeout(startupTimer);

  console.log('Public URL: ' + publicUrl);
  console.log('Open in browser: ' + publicUrl + '/');
  console.log('Webhook endpoint: ' + publicUrl + '/webhook');
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  clearTimeout(startupTimer);
  tunnel?.kill('SIGTERM');
  await app?.close();
  console.log('Tunnel stopped (' + signal + ')');
  process.exit(exitCode);
}

async function start() {
  app = await startServer({
    port,
    host: '127.0.0.1',
  });

  console.log('Origin is ready at http://127.0.0.1:' + port);
  console.log('Starting HTTPS tunnel through ' + tunnelHost + '...');

  tunnel = spawn(
    process.env.SSH_BIN || 'ssh',
    [
      '-T',
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'ServerAliveInterval=30',
      '-o',
      'ServerAliveCountMax=3',
      '-p',
      tunnelSshPort,
      '-R',
      tunnelRemotePort + ':127.0.0.1:' + port,
      tunnelUser + '@' + tunnelHost,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  tunnel.stdout.on('data', (chunk) => printPublicUrl(chunk.toString()));
  tunnel.stderr.on('data', (chunk) => printPublicUrl(chunk.toString()));

  tunnel.once('error', (error) => {
    console.error('Failed to start HTTPS tunnel: ' + error.message);
    void shutdown('tunnel error', 1);
  });

  tunnel.once('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error('Tunnel process exited (' + (code ?? signal ?? 'unknown') + ')');
      void shutdown('tunnel exit', code || 1);
    }
  });

  startupTimer = setTimeout(() => {
    if (!publicUrl) {
      console.error('Tunnel did not provide a public URL within the startup timeout.');
      void shutdown('tunnel startup timeout', 1);
    }
  }, startupTimeoutMs);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

start().catch(async (error) => {
  console.error(error.message);
  await app?.close();
  process.exit(1);
});
