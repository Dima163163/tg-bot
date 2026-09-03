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

Telegram присылает update в `/webhook/telegram`. Каждый update выводится в консоль.

Чтобы получить курс относительно доллара, отправьте боту трёхбуквенный код валюты:

```text
EUR
```

Бот ответит в формате:

```text
1 USD = 0,86371 EUR
Дата курса: 2026-09-02
```

Курсы берутся из Frankfurter с базовой валютой `USD`. Если валюты нет в данных сервиса, бот сообщит об этом. Например, Frankfurter сейчас не публикует курс `RUB`.

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
