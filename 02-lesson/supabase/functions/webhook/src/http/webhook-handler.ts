const TELEGRAM_SECRET_HEADER = 'x-telegram-bot-api-secret-token';
const TELEGRAM_WEBHOOK_PATH = '/webhook/telegram';

interface WebhookHandlerOptions {
  botToken: string;
  webhookSecret: string;
  handleTelegramUpdate: (update: unknown) => Promise<void>;
}

export function createWebhookHandler({
  botToken,
  webhookSecret,
  handleTelegramUpdate,
}: WebhookHandlerOptions): (request: Request) => Promise<Response> {
  return async function webhookHandler(request) {
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

    if (!botToken) {
      console.error('BOT_TOKEN is missing');
      return Response.json({ ok: false }, { status: 500 });
    }

    if (!webhookSecret) {
      console.error('TELEGRAM_WEBHOOK_SECRET is missing');
      return Response.json({ ok: false }, { status: 500 });
    }

    if (
      request.headers.get(TELEGRAM_SECRET_HEADER) !== webhookSecret
    ) {
      return Response.json({ ok: false }, { status: 401 });
    }

    let update: unknown;
    try {
      update = await request.json();
    } catch {
      return Response.json({ ok: false }, { status: 400 });
    }

    try {
      await handleTelegramUpdate(update);
      return Response.json({ ok: true });
    } catch (error) {
      console.error('Telegram update handling failed', error);
      return Response.json({ ok: false }, { status: 502 });
    }
  };
}
