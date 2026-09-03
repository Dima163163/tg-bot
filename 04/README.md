# Telegram webhook на Fastify

В `04` оставлен один HTTP endpoint:

```text
POST /webhook/telegram
```

Сервер читает `BOT_TOKEN` из файла `04/.env` и не выводит токен в лог.

Запуск:

```bash
npm install
npm start
```

Telegram присылает update в `/webhook/telegram`. Каждый update выводится в консоль. Для обычного сообщения сервер отвечает пользователю через Telegram Bot API.

Регистрация webhook после размещения сервера на публичном HTTPS-домене:

```bash
npm run set-webhook -- https://example.com/webhook/telegram
```

Если передать только домен, путь `/webhook/telegram` добавится автоматически:

```bash
npm run set-webhook -- https://example.com
```

Туннелей в этой версии нет. Telegram должен иметь доступ к вашему публичному HTTPS-домену. При деплое на Vercel значение `BOT_TOKEN` нужно добавить в Environment Variables проекта.

Для Vercel добавлен serverless entrypoint `api/index.js`. Он направляет публичный путь `/webhook/telegram` в Fastify endpoint.
