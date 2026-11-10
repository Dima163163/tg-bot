import { authorizeWebhookUseCase } from '../application/authorize-webhook.ts';
import { handleTelegramUpdateUseCase } from '../application/handle-telegram-update.ts';

const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const TELEGRAM_WEBHOOK_PATH = '/webhook/telegram';

export async function handleWebhookRequest(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '');

  if (
    pathname !== TELEGRAM_WEBHOOK_PATH &&
    !pathname.endsWith(TELEGRAM_WEBHOOK_PATH)
  ) {
    return Response.json({ ok: false }, { status: 404 });
  }

  if (request.method !== 'POST') {
    return Response.json(
      { ok: false, error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'POST' } },
    );
  }

  const access = await authorizeWebhookUseCase.execute(request.headers.get(TELEGRAM_SECRET_HEADER) ?? '');
  if (access !== 'allowed') return Response.json({ ok: false }, { status: access === 'denied' ? 401 : 500 });

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    await handleTelegramUpdateUseCase.execute(update);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Telegram update handling failed', error instanceof Error ? error.name : 'Unknown');
    return Response.json({ ok: false }, { status: 502 });
  }
}
