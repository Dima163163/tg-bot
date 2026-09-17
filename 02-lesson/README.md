# Telegram → Supabase

Бот: https://t.me/currentExchange_Rate_Bot

Просмотр данных в браузере:

- Клиенты: https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1/clients
- Сообщения: https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1/messages

После отправки сообщения обнови страницу с JSON. Данные не обновляются на уже
открытой странице автоматически. Простые GET-функции возвращают до лимита Data API
(сейчас 1000 записей за один запрос).

## Как проходит сообщение

1. Пользователь пишет боту или нажимает Start: Telegram присылает `/start` как сообщение.
   Простое открытие окна бота без отправки сообщения ничего не записывает.
2. Telegram отправляет POST на
   `https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1/webhook/telegram`.
3. `webhook/src/http/webhook-handler.ts` проверяет метод POST и секретный заголовок
   `X-Telegram-Bot-Api-Secret-Token`. Только после этого начинает обрабатывать данные.
4. `webhook/src/application/handle-telegram-update.ts` берёт отправителя, текст,
   дату и `update_id` из события Telegram. Дату в секундах переводит в ISO-строку UTC.
5. `webhook/index.ts` вызывает через `ctx.supabaseAdmin.rpc(...)` SQL-функцию
   `save_telegram_message`. RPC означает вызов функции, которая выполняется в базе.
6. SQL-функция создаёт или обновляет клиента, затем сохраняет сообщение со ссылкой
   на этого клиента. Обе записи выполняются в одной транзакции: при ошибке
   изменения этой операции откатываются.
7. После сохранения бот продолжает прежнюю логику ответа о курсе валют.
8. Открытие `/clients` или `/messages` вызывает отдельную Edge Function:
   `ctx.supabaseAdmin.from('clients' или 'messages').select('*')` читает таблицу,
   а `Response.json(data)` возвращает массив в браузер.

## Какие поля сохраняются

| Таблица и поле | Источник |
| --- | --- |
| `clients.user_telegram_id` | `message.from.id`, записанный строкой |
| `clients.first_name` | `message.from.first_name` |
| `clients.last_name` | `message.from.last_name`, либо `null` |
| `clients.last_message_at` | Дата самого нового сообщения, UTC |
| `clients.created_at` | Время создания клиента, выставляет база |
| `messages.telegram_update_id` | `update_id` события Telegram |
| `messages.created_at` | `message.date` — время отправки сообщения |
| `messages.author` | Username; если его нет — имя и фамилия |
| `messages.body` | `message.text`, либо подпись `message.caption`, либо `null` |
| `messages.messenger_user_id` | `message.from.id`, записанный строкой |
| `messages.messenger_type` | Строка `telegram` |
| `messages.client_id` | ID соответствующего клиента в нашей базе |

Вложения не скачиваются. У сообщения без текста и подписи `body` будет `null`.
Хранятся входящие сообщения пользователей, а не ответы самого бота.

## Зачем нужны изменения SQL

`sql/tables.sql` описывает актуальную структуру для создания таблиц с нуля.
Для уже существующих таблиц использован `sql/telegram-sync.sql`:

- уникальный индекс `clients.user_telegram_id` не позволяет создать двух клиентов
  для одного Telegram-пользователя;
- поле и уникальный индекс `messages.telegram_update_id` защищают от повторной
  записи одного события, если Telegram повторит доставку;
- `save_telegram_message` выполняет `INSERT ... ON CONFLICT` для клиента:
  создаёт новую строку или обновляет существующую;
- `greatest(...)` сохраняет самое позднее время сообщения. Поздно доставленное
  старое сообщение также не заменяет имя и фамилию более старыми значениями;
- запись сообщения использует `ON CONFLICT ... DO NOTHING`, поэтому повтор
  того же события не создаёт ещё одну строку;
- выполнять SQL-функцию разрешено только роли `service_role`, используемой
  серверным `ctx.supabaseAdmin`.

## Проверка и публикация

Из папки `02-lesson`:

```bash
npm test
npx supabase functions deploy webhook --use-api
npx supabase functions deploy clients --use-api
npx supabase functions deploy messages --use-api
```

`npm test` проверяет обработку Telegram, сохранение до ответа, ошибки и секретный
заголовок. `supabase/tests/telegram-sync-test.sql` проверяет SQL-сохранение, защиту
от дублей и обновление времени; тестовые записи откатываются через `ROLLBACK`.

Для переноса в другой проект сначала создай таблицы, затем выполни
`sql/telegram-sync.sql` в SQL Editor, настрой `BOT_TOKEN` и
`TELEGRAM_WEBHOOK_SECRET` в Edge Function Secrets и опубликуй функции.
Webhook можно направить в новый проект командой:

```bash
npm run set-webhook -- https://YOUR_PROJECT_REF.supabase.co
```

Текущие `/clients` и `/messages` публичные и используют `supabaseAdmin`, который
обходит RLS. Любой, у кого есть адрес, может прочитать возвращаемые данные.
