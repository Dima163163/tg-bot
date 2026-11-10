# Индекс документации

Проверено 2026-11-09 по исходникам проекта `02-lesson`. Описания текущей
реализации сверены с кодом; наличие SQL-файла само по себе не подтверждает,
что миграция применена в удалённом Supabase-проекте. Отдельная проверка
связанного проекта подтвердила обе RAG-миграции, публикацию articles, knowledge-admin
и webhook, шесть демостатей с vector(384), SQL-тесты embeddings/lease с откатом
и восемь реальных запросов RAG. Webhook отвечает по статьям; без информации
возвращает «Мы обрабатываем ваш запрос». Groq используется вместе с native gte-small.
Проверена регистрация Telegram webhook; тестовые сообщения в реальные чаты
не отправлялись.

## Руководства проекта

| Файл | Назначение и связь с кодом |
| --- | --- |
| [`../README.md`](../README.md) | Пользовательский сценарий, доступ операторов и локальная серверная прослойка с зашифрованной HttpOnly cookie. |
| [`../AGENTS.md`](../AGENTS.md) | Карта архитектуры и контрактов: React Router, `/api` для cookie-сессии, JWT в Edge Functions и RLS для Realtime. |
| [`../web-messenger/AGENTS.md`](../web-messenger/AGENTS.md) | Правила page-first FSD, React Query, Zustand и `react-hook-form`; карта клиентских вызовов `/api`. |
| [`../.codex/skills/register-telegram-webhook/SKILL.md`](../.codex/skills/register-telegram-webhook/SKILL.md) | Безопасная инструкция для подключения личного Telegram-бота к отдельному Supabase-проекту. Сверена со скриптом `../.codex/skills/register-telegram-webhook/scripts/register-webhook.mjs`: ввод секретов скрытый и интерактивный, перед записью требуется подтверждение. |

## Работа со статьями и MCP

| Файл | Статус и связь с кодом |
| --- | --- |
| [`articles-setup.md`](articles-setup.md) | Запуск миграций, CRUD, активный провайдер и авторизация Codex MCP. Backend: `../supabase/functions/articles/src/`; MCP: `../.codex/config.toml`, `../scripts/prepare-article-write.mjs`. Описывает три слоя с прямыми импортами без DI. |

| [`rag-runtime.md`](rag-runtime.md) | Рабочая связка Groq + Supabase gte-small(384), защищённый knowledge-admin, демостатьи, проверки, ограничения и следующий этап. |

## Планы реализации

| Файл | Статус и связь с кодом |
| --- | --- |
| [`rag-implementation-plan.md`](rag-implementation-plan.md) | Одна небольшая articles-запись — готовый чанк. Первый этап подготовлен в `../supabase/migrations/20261109104038_add_article_embeddings_384.sql`: vector(384), HNSW, search_articles и права. Внешний обработчик сохраняет новый текст и пересчитанный вектор одним UPDATE. SQL-проверки — `../supabase/tests/article-embeddings-test.sql`; миграция и полный SQL-тест подтверждены на БД. Embeddings и ответы уже подключены; очереди и измерение качества — следующие этапы. |

## Архитектурные решения

| Файл | Решение | Текущая связь с кодом |
| --- | --- | --- |
| [`adr/0001-no-local-supabase-stack.md`](adr/0001-no-local-supabase-stack.md) | Не запускать полный стек `supabase start`; использовать CLI для миграций и публикации функций. | Команды CLI есть в `../package.json`; тест webhook запускается Node.js. Запись соответствует текущему рабочему соглашению. |
| [`adr/0002-enable-realtime-for-messages.md`](adr/0002-enable-realtime-for-messages.md) | Историческое решение об анонимном Realtime. | Анонимное чтение отменено миграцией `../supabase/migrations/20261019101411_restrict_panel_access_to_operators.sql`; текущая подписка передаёт JWT оператора. |

## Диаграммы

| Файл | Назначение и связь с кодом |
| --- | --- |
| [`telegram-webhook/telegram-webhook-sequence.puml`](telegram-webhook/telegram-webhook-sequence.puml) | Фактический поток webhook: проверка запроса, запись входящего сообщения, lease, поиск/Groq, отправка ответа по статьям или fallback и запись ответа бота. Сверена с `../supabase/functions/webhook/` и SQL RPC. PlantUML-исходник просмотрен вручную. |
| [`auth/auth-refresh-sequence.puml`](auth/auth-refresh-sequence.puml) | Концептуальный пример собственной auth-службы с хранением хэша refresh token в своей БД. Не описывает реализацию проекта: `/api/auth/*` использует Supabase Auth через `@supabase/auth-js` и зашифрованную HttpOnly cookie; фактический поток показан в `auth/supabase-spa-auth-sequence.puml` и реализован в `../server/auth-api.mjs`. |
| [`auth/supabase-spa-auth-sequence.puml`](auth/supabase-spa-auth-sequence.puml) | Локальные вход, восстановление пароля через recovery-only cookie, обновление сессии, Realtime, Edge Functions и выход. Сверена с `../server/auth-api.mjs` и `../web-messenger/src/`; публикация в удалённом проекте не проверена. |

## Ограничения проверки

- Диаграммы сверены с кодом вручную. Локальный `plantuml` не найден, поэтому синтаксический разбор и отрисовка не выполнялись.
- Общий аудит отражает файлы репозитория. Дополнительно выполнены SQL-тесты embeddings и lease с ROLLBACK и реальная проверка RAG через защищённый endpoint. Полная нагрузочная проверка HNSW и end-to-end отправка тестовых сообщений в Telegram не выполнялись.
