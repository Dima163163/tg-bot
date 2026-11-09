# Индекс документации

Проверено 2026-11-09 по исходникам проекта `02-lesson`. Описания текущей
реализации сверены с кодом; наличие SQL-файла само по себе не подтверждает,
что миграция применена в удалённом Supabase-проекте. На дату проверки webhook
сохраняет входящее сообщение и отправляет фиксированный ответ, а `articles`
поддерживает CRUD; генерация embeddings, векторный поиск и RAG-ответы ещё не
реализованы.

## Руководства проекта

| Файл | Назначение и связь с кодом |
| --- | --- |
| [`../README.md`](../README.md) | Пользовательский сценарий, доступ операторов и локальная серверная прослойка с зашифрованной HttpOnly cookie. |
| [`../AGENTS.md`](../AGENTS.md) | Карта архитектуры и контрактов: React Router, `/api` для cookie-сессии, JWT в Edge Functions и RLS для Realtime. |
| [`../web-messenger/AGENTS.md`](../web-messenger/AGENTS.md) | Правила page-first FSD, React Query, Zustand и `react-hook-form`; карта клиентских вызовов `/api`. |
| [`../.codex/skills/register-telegram-webhook/SKILL.md`](../.codex/skills/register-telegram-webhook/SKILL.md) | Безопасная инструкция для подключения личного Telegram-бота к отдельному Supabase-проекту. Сверена со скриптом `../.codex/skills/register-telegram-webhook/scripts/register-webhook.mjs`: ввод секретов скрытый и интерактивный, перед записью требуется подтверждение. |

## Архитектурные решения

| Файл | Решение | Текущая связь с кодом |
| --- | --- | --- |
| [`adr/0001-no-local-supabase-stack.md`](adr/0001-no-local-supabase-stack.md) | Не запускать полный стек `supabase start`; использовать CLI для миграций и публикации функций. | Команды CLI есть в `../package.json`; тест webhook запускается Node.js. Запись соответствует текущему рабочему соглашению. |
| [`adr/0002-enable-realtime-for-messages.md`](adr/0002-enable-realtime-for-messages.md) | Историческое решение об анонимном Realtime. | Анонимное чтение отменено миграцией `../supabase/migrations/20261019101411_restrict_panel_access_to_operators.sql`; текущая подписка передаёт JWT оператора. |

## Диаграммы

| Файл | Назначение и связь с кодом |
| --- | --- |
| [`telegram-webhook/telegram-webhook-sequence.puml`](telegram-webhook/telegram-webhook-sequence.puml) | Фактический поток webhook: проверка запроса, запись входящего сообщения, отправка фиксированного ответа и запись ответа бота. Сверена с `../supabase/functions/webhook/` и SQL RPC. PlantUML-исходник просмотрен вручную. |
| [`auth/auth-refresh-sequence.puml`](auth/auth-refresh-sequence.puml) | Концептуальный пример собственной auth-службы с хранением хэша refresh token в своей БД. Не описывает реализацию проекта: `/api/auth/*` использует Supabase Auth через `@supabase/auth-js` и зашифрованную HttpOnly cookie; фактический поток показан в `auth/supabase-spa-auth-sequence.puml` и реализован в `../server/auth-api.mjs`. |
| [`auth/supabase-spa-auth-sequence.puml`](auth/supabase-spa-auth-sequence.puml) | Локальные вход, восстановление пароля через recovery-only cookie, обновление сессии, Realtime, Edge Functions и выход. Сверена с `../server/auth-api.mjs` и `../web-messenger/src/`; публикация в удалённом проекте не проверена. |

## Ограничения проверки

- Диаграммы сверены с кодом вручную. Локальный `plantuml` не найден, поэтому синтаксический разбор и отрисовка не выполнялись.
- Проверка отражает состояние файлов репозитория на указанную дату и не подтверждает состояние удалённых баз Supabase.
