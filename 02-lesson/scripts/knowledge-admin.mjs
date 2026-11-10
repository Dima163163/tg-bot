import { env } from 'node:process';

try {
  if (!env.RAG_ADMIN_URL || !env.RAG_ADMIN_TOKEN) throw new Error('Configure RAG_ADMIN_URL and RAG_ADMIN_TOKEN first');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 100_000) throw new Error('Request is too large');
  }
  const payload = JSON.parse(input);
  const response = await fetch(env.RAG_ADMIN_URL, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(140_000),
    headers: { Authorization: `Bearer ${env.RAG_ADMIN_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({ message: 'Non-JSON response' }));
  const output = result && Array.isArray(result.embedding)
    ? { dimensions: result.embedding.length, model: result.model } : result;
  process.stdout.write(JSON.stringify({ status: response.status, result: output }) + '\n');
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Knowledge request failed');
  process.exitCode = 1;
}
