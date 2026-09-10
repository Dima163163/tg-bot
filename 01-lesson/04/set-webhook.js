const webhookPath = process.env.WEBHOOK_PATH || '/webhook/telegram';
const inputUrl = process.argv[2] || process.env.TELEGRAM_WEBHOOK_URL;
const token = process.env.BOT_TOKEN || '';

function getWebhookUrl(value) {
  if (!value) {
    throw new Error(
      'Передайте публичный HTTPS URL: npm run set-webhook -- https://example.com',
    );
  }

  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('Telegram принимает webhook только по HTTPS');
  }

  if (url.pathname === '/') {
    url.pathname = webhookPath;
  }

  return url.toString();
}

async function main() {
  if (!token) {
    throw new Error('BOT_TOKEN is missing in 04/.env');
  }

  const webhookUrl = getWebhookUrl(inputUrl);
  const response = await fetch(
    'https://api.telegram.org/bot' + token + '/setWebhook',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
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
