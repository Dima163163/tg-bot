# Telegram → Supabase

Бот: https://t.me/currentExchange_Rate_Bot

API панели (требуется access token назначенного оператора):

- Клиенты: https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1/clients
- Сообщения: `https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1/messages?client_id=CLIENT_ID&limit=7`
- Статьи: `https://cappgvetnxvjhnxufhkz.supabase.co/functions/v1/articles?limit=20`

Список клиентов возвращается одним запросом, а
сообщения выдаются страницами по 7 записей (максимум 50 за запрос).
Статьи выдаются страницами по 20 записей (максимум 50); `cursor` передаётся из
`nextCursor`. Edge Function `articles` также создаёт статью через `POST` с JSON
`{ "title": "Заголовок", "body": "Текст" }`, меняет её текст через `PATCH` с
JSON `{ "id": 123, "body": "Новый текст" }` и удаляет по ID через
`DELETE /functions/v1/articles?id=123`.
В панели управления экран статей доступен по маршруту `/articles`; список можно
подгружать следующими страницами, а каждую статью — создавать, редактировать и удалять.
Шапка панели показывает текущего пользователя Supabase Auth после проверки сессии
или ссылку на `/login`. Форма использует `react-hook-form` и отправляет пароль на
локальный `/api/auth/login`. Ссылка «Забыли пароль?» открывает `/password-reset`:
сервер отправляет письмо через Supabase Auth, обменивает recovery-токены на
ограниченную сессию в зашифрованной `HttpOnly` cookie и разрешает этой сессии
только сменить пароль. После смены cookie удаляется. Серверная прослойка также
хранит обычную сессию с refresh token в `HttpOnly` cookie и возвращает браузеру
access token для Realtime. Запросы данных идут через `/api/functions/*`;
прослойка передаёт JWT в Edge Functions, которые проверяют назначение оператором.
В шапке авторизованного пользователя есть кнопка `Sign out`.

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
7. После сохранения бот отвечает «Мы получили ваш запрос». После успешной
   отправки этот ответ также сохраняется у того же клиента как исходящее
   сообщение бота. Внешний API курсов валют не вызывается.
8. Открытие `/clients` или `/messages` вызывает отдельную Edge Function:
   `ctx.supabaseAdmin.from('clients' или 'messages').select('*')` читает таблицу.
   Сообщения загружаются курсорами: функция принимает `client_id`, `limit` и
   необязательный `cursor`, возвращая `{ data, hasMore, nextCursor }`. Следующий
   `cursor` запрашивает более старую страницу сообщений.

## Какие поля сохраняются

| Таблица и поле | Источник |
| --- | --- |
| `clients.user_telegram_id` | `message.from.id`, записанный строкой |
| `clients.first_name` | `message.from.first_name` |
| `clients.last_name` | `message.from.last_name`, либо `null` |
| `clients.last_message_at` | Дата самого нового сообщения, UTC |
| `clients.created_at` | Время создания клиента, выставляет база |
| `messages.telegram_update_id` | `update_id` входящего события Telegram; у исходящего ответа бота — `null` |
| `messages.created_at` | `message.date` для клиента; время успешной отправки для ответа бота |
| `messages.author` | Username клиента; для ответа бота — `bot` |
| `messages.body` | Текст/подпись клиента или текст ответа бота |
| `messages.messenger_user_id` | `message.from.id`, записанный строкой; для ответа бота — `null` |
| `messages.messenger_type` | `telegram` для клиента, `telegram_bot` для ответа бота |
| `messages.client_id` | ID соответствующего клиента в нашей базе |

Вложения не скачиваются. У сообщения без текста и подписи `body` будет `null`.
Хранятся и входящие сообщения пользователей, и успешные ответы самого бота.

## Зачем нужны изменения SQL

`sql/tables.sql` описывает структуру `clients` и `messages` для создания с нуля.
Для уже существующих таблиц использован `sql/telegram-sync.sql`:

- уникальный индекс `clients.user_telegram_id` не позволяет создать двух клиентов
  для одного Telegram-пользователя;
- поле и уникальный индекс `messages.telegram_update_id` защищают от повторной
  записи одного события, если Telegram повторит доставку;
- `save_telegram_message` выполняет `INSERT ... ON CONFLICT` для клиента:
  создаёт новую строку или обновляет существующую;
- `messages` добавлена в публикацию `supabase_realtime`; читать строки через RLS
  и получать события могут только назначенные операторы;
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

## Доступ операторов

Миграция `supabase/migrations/20261019101411_restrict_panel_access_to_operators.sql`
создаёт `public.panel_operators`, закрывает прямой доступ к `clients` и анонимное
чтение `messages`. `clients`, `messages` и `articles` проверяют JWT и наличие
`auth.users.id` в `panel_operators`. Для Realtime действует та же проверка через RLS.
Самостоятельная регистрация Supabase Auth не даёт доступ к панели.

Миграция `supabase/migrations/20261019112702_restrict_public_default_privileges.sql`
отменяет автоматические права `anon` и `authenticated` на будущие таблицы,
последовательности и функции, созданные ролью `postgres` в `public`. Для нового
объекта права Data API теперь нужно выдавать явно. Текущие права и RLS, включая
подписку назначенного оператора на `messages`, миграция не меняет.

Администратор проекта сначала создаёт учётную запись оператора в Supabase Auth,
затем выполняет в SQL Editor:

```sql
insert into public.panel_operators (user_id)
select id from auth.users where email = 'operator@example.com'
on conflict (user_id) do nothing;
```

Замените email на адрес назначенного оператора. Если пользователя с таким email
нет, запрос не добавит строку. Для отзыва доступа удалите соответствующую строку
из `panel_operators`. Для Realtime браузеру нужны `VITE_SUPABASE_PUBLISHABLE_KEY`
(или устаревший `VITE_SUPABASE_ANON_KEY`) и правильный `VITE_SUPABASE_URL`.
Серверная прослойка использует те же значения и `AUTH_COOKIE_SECRET` из `.env`;
этот секрет нельзя передавать в переменной `VITE_*`.

При публикации нового варианта сначала примените миграцию и назначьте операторов,
затем разверните `clients`, `messages`, `articles` с `verify_jwt = true` и обновите
SPA вместе с серверной прослойкой. Статический хостинг без серверного `/api`
не поддерживает этот способ входа. Пока миграция и функции не опубликованы вместе,
удалённый проект может оставаться публичным; локальные файлы не изменяют его права.

Для локального запуска задайте `AUTH_COOKIE_SECRET` в `.env` (32 случайных байта
в base64, например результат `openssl rand -base64 32`) и выполните `npm run dev`.
На localhost cookie имеет `HttpOnly`, `SameSite=Strict`, `Path=/api`; при HTTPS
установите `AUTH_COOKIE_SECURE=true`. Если секрет не задан, при запуске создаётся
временный ключ и после перезапуска сервера потребуется войти заново. Access token
остаётся только в памяти страницы и обновляется через `/api/auth/session`. Для
восстановления пароля в Supabase Dashboard → Authentication → URL Configuration →
Redirect URLs добавьте `http://localhost:5173/password-reset` (если Vite выбрал
другой порт или вы открываете `127.0.0.1`, добавьте фактический URL). Встроенная
почта Supabase отправляет только на адреса участников команды проекта и сейчас
ограничена двумя письмами в час; для других адресов настройте Custom SMTP.
