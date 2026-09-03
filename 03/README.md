# Fastify server and webhook

Публичный URL для просмотра стартового endpoint:

```bash
npm install
npm run tunnel
```

В терминале появится HTTPS-адрес вида `https://....lhr.life`. Открой его в браузере — туннель передаст запрос в Fastify, и `/` вернёт JSON:

```json
{
  "message": "Welcome to Fastify backend!",
  "webhook": "POST /webhook"
}
```

Локальные адреса: `http://localhost:3000/`, `http://localhost:3000/status` и `http://localhost:3000/webhook`.

Для webhook через HTTPS-релей Smee:

```bash
npm run webhook
```

Эта команда создаёт публичный Smee-канал и пересылает события в `POST /webhook`.

Проверка:

```bash
curl -X POST "PUBLIC_WEBHOOK_URL" \
  -H 'content-type: application/json' \
  -H 'x-event-type: test.created' \
  -d '{"hello":"world"}'
```

Для повторного использования канала задайте `SMEE_URL`. `WEBHOOK_SECRET` включает HMAC-SHA256-проверку для прямых запросов к `/webhook`; для Smee-релея оставляйте его пустым, потому что Smee пересобирает тело запроса.

Адрес localhost.run временный и используется для разработки. Если нужен именно Cloudflare Quick Tunnel, запусти:

```bash
npm run tunnel:cloudflare
```

Он выдаёт адрес `trycloudflare.com`, но требует доступного Cloudflare edge-маршрута. Если VPN блокирует этот маршрут, адрес может напечататься, но не открыться — это ограничение сети, а не Fastify.
