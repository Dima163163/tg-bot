import { readFile, writeFile, chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

// Values stay in memory and a private temporary file, never in command arguments.
// CLI diagnostics are redacted. This script targets the known bot project.
try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--source-env')) throw new Error('usage: configure-knowledge.mjs [--source-env path]');
  const source = parseEnv(await readFile(args[1] || '.env', 'utf8'));
  if (!source.GROQ_API_KEY?.trim()) throw new Error('missing_groq_key');
  const original = await readFile('.env', 'utf8');
  const existing = parseEnv(original);
  const model = source.GROQ_MODEL || 'openai/gpt-oss-20b';
  const token = existing.RAG_ADMIN_TOKEN || randomBytes(32).toString('hex');
  const secrets = {
    GROQ_API_KEY: source.GROQ_API_KEY,
    GROQ_MODEL: model,
    EMBEDDINGS_PROVIDER: 'supabase-groq',
    RAG_ADMIN_TOKEN: token,
  };
  if (Object.values(secrets).some(value => !value || /[\r\n]/.test(value))) throw new Error('invalid_secret_format');
  const temporary = await mkdtemp(join(tmpdir(), 'rag-secrets-'));
  const secretFile = join(temporary, 'secrets.env');
  await writeFile(secretFile, Object.entries(secrets).map(([name, value]) => `${name}=${value}`).join('\n') + '\n', { mode: 0o600 });
  let diagnostic = '';
  let status;
  try { status = await new Promise((resolve, reject) => {
    const child = spawn('./node_modules/.bin/supabase', [
      'secrets', 'set', '--project-ref', 'cappgvetnxvjhnxufhkz', '--env-file', secretFile,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { diagnostic += chunk.toString(); });
    child.stderr.on('data', chunk => { diagnostic += chunk.toString(); });
    child.on('error', reject);
    child.on('close', resolve);
    child.stdin.end();
  }); } finally { await rm(temporary, { recursive: true, force: true }); }
  if (status !== 0) {
    for (const value of Object.values(secrets)) diagnostic = diagnostic.split(value).join('[REDACTED]');
    console.error(diagnostic.slice(0, 2000));
    throw new Error('supabase_secret_configuration_failed');
  }
  const local = {
    EMBEDDINGS_PROVIDER: 'supabase-groq', GROQ_MODEL: model,
    RAG_ADMIN_URL: 'https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1/knowledge-admin',
    RAG_ADMIN_TOKEN: token,
  };
  let updated = original;
  for (const [name, value] of Object.entries(local)) {
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    const line = `${name}=${value}`;
    updated = pattern.test(updated) ? updated.replace(pattern, line) : `${updated.trimEnd()}\n${line}\n`;
  }
  if (await readFile('.env', 'utf8') !== original) throw new Error('local_env_changed_concurrently');
  await writeFile('.env', updated, { mode: 0o600 });
  await chmod('.env', 0o600);
  console.log(JSON.stringify({ configured: Object.keys(secrets), localConfigured: Object.keys(local), model, secretValuesPrinted: false }));
} catch (error) {
  console.error(JSON.stringify({ stage: error instanceof Error ? error.message : 'configuration_failed', secretValuesPrinted: false }));
  process.exitCode = 1;
}
