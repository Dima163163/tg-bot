const defaultWebhookPath = '/functions/v1/webhook/telegram';
const inputUrl = process.argv[2] || process.env.TELEGRAM_WEBHOOK_URL;
const botToken = process.env.BOT_TOKEN || '';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

function getWebhookUrl(value) {
  if (!value) {
    throw new Error(
      'Передайте публичный HTTPS URL: npm run set-webhook -- https://project.supabase.co',
    );
  }

  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('Telegram принимает webhook только по HTTPS');
  }

  if (url.pathname === '/') {
    url.pathname = defaultWebhookPath;
  }

  return url.toString();
}

function validateWebhookSecret(value) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) {
    throw new Error(
      'TELEGRAM_WEBHOOK_SECRET должен содержать 1-256 символов A-Z, a-z, 0-9, _ или -',
    );
  }
}

async function main() {
  if (!botToken) {
    throw new Error('BOT_TOKEN отсутствует в .env');
  }

  if (!webhookSecret) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET отсутствует в .env');
  }

  validateWebhookSecret(webhookSecret);
  const webhookUrl = getWebhookUrl(inputUrl);
  const response = await fetch(
    'https://api.telegram.org/bot' + botToken + '/setWebhook',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
      }),
    },
  );
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || 'Не удалось зарегистрировать webhook');
  }

  console.log('Telegram webhook установлен: ' + webhookUrl);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
