# Индекс документации

Проверено 2026-10-19 по исходникам проекта `02-lesson`. Описания текущей
реализации сверены с кодом; наличие SQL-файла само по себе не подтверждает,
что миграция применена в удалённом Supabase-проекте.

## Руководства проекта

| Файл | Назначение и связь с кодом |
| --- | --- |
| [`../README.md`](../README.md) | Пользовательский сценарий Telegram-бота, поля данных, HTTP API статей и сообщений, ручная настройка SQL и публикация функций. Основные описания совпадают с Edge Functions и клиентом панели. |
| [`../AGENTS.md`](../AGENTS.md) | Карта архитектуры, API, данных и команд проекта. **Нужно обновить:** текст утверждает, что панель не использует Realtime, и описывает каталог миграций как содержащий только миграцию ответов бота. Сейчас код панели подписывается на INSERT `messages`, а в каталоге есть базовая схема, статьи, Realtime и сохранение ответов бота. |
| [`../web-messenger/AGENTS.md`](../web-messenger/AGENTS.md) | Правила page-first FSD, владения состоянием, React Query и Zustand. Карта включает Realtime-hook; опрос клиентов и сообщений раз в 30 секунд работает параллельно с подпиской на новые сообщения. |
| [`../.codex/skills/register-telegram-webhook/SKILL.md`](../.codex/skills/register-telegram-webhook/SKILL.md) | Безопасная инструкция для подключения личного Telegram-бота к отдельному Supabase-проекту. Сверена со скриптом `../.codex/skills/register-telegram-webhook/scripts/register-webhook.mjs`: ввод секретов скрытый и интерактивный, перед записью требуется подтверждение. |

## Архитектурные решения

| Файл | Решение | Текущая связь с кодом |
| --- | --- | --- |
| [`adr/0001-no-local-supabase-stack.md`](adr/0001-no-local-supabase-stack.md) | Не запускать полный стек `supabase start`; использовать CLI для миграций и публикации функций. | Команды CLI есть в `../package.json`; тест webhook запускается Node.js. Запись соответствует текущему рабочему соглашению. |
| [`adr/0002-enable-realtime-for-messages.md`](adr/0002-enable-realtime-for-messages.md) | Включить `public.messages` в Supabase Realtime и открыть чтение строк роли `anon`. | Настройка есть в `../sql/telegram-sync.sql` и `../supabase/migrations/20261008110335_enable_messages_realtime.sql`. **Устарел пункт о том, что панель не подписывается:** `../web-messenger/src/pages/messenger/model/use-realtime-messages.ts` слушает INSERT для выбранного клиента и инвалидирует Query; 30-секундный polling остаётся. Политика также разрешает anon читать все строки `messages`. |

## Диаграммы

| Файл | Назначение и связь с кодом |
| --- | --- |
| [`telegram-webhook/telegram-webhook-sequence.puml`](telegram-webhook/telegram-webhook-sequence.puml) | Фактический поток webhook: проверка запроса, запись входящего сообщения, отправка фиксированного ответа и запись ответа бота. Сверена с `../supabase/functions/webhook/` и SQL RPC. PlantUML-исходник просмотрен вручную. |
| [`auth/auth-refresh-sequence.puml`](auth/auth-refresh-sequence.puml) | Общая схема авторизации с access/refresh-токенами и cookie. В проекте не найдены соответствующие auth-маршруты или middleware; пометьте её как пример/предложение либо уточните, что она описывает. |
| [`auth/supabase-spa-auth-sequence.puml`](auth/supabase-spa-auth-sequence.puml) | Справочная схема Supabase Auth для SPA; сам файл явно отмечает, что это не реализация `web-messenger`. В проекте нет `@supabase/supabase-js` или собственного auth-flow. Ссылки на официальные материалы Supabase проверены 2026-10-19. |

## Ограничения проверки

- Диаграммы сверены с кодом вручную. Локальный `plantuml` не найден, поэтому синтаксический разбор и отрисовка не выполнялись.
- Проверка отражает состояние файлов репозитория на указанную дату и не подтверждает состояние удалённых баз Supabase.
