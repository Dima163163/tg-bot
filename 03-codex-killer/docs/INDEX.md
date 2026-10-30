# Индекс документации

## Обзор проекта

- [README.md](../README.md) — запуск, конфигурация OpenAI API, интерфейс адаптера и сохранение отдельных сессий; реализовано в `chat.mjs`, `openai-adapter.mjs` и `memory-repository.mjs`.

## Архитектура

- [C4: контекст системы](diagrams/c4-context.puml) — пользователь, CustomChat и OpenAI Platform; соответствует `chat.mjs`, `memory-repository.mjs` и `openai-adapter.mjs`.
- [C4: контейнеры](diagrams/c4-containers.puml) — процесс Node.js, файлы отдельных сессий и внешний Responses API; соответствует `package.json`, `chat.mjs`, `memory-repository.mjs` и `openai-adapter.mjs`.
- [C4: компоненты](diagrams/c4-components.puml) — цикл консоли, memory repository, адаптер, OpenAI JavaScript SDK и внешний API; соответствует `chat.mjs`, `memory-repository.mjs` и `openai-adapter.mjs`.
- [C4: код](diagrams/c4-code.puml) — контракт `getTextResponse(messages): Promise<string>`, запись сессии и извлечение полного `output_text`; соответствует `chat.mjs`, `memory-repository.mjs` и `openai-adapter.mjs`.

Диаграммы описывают текущую реализацию. Каждый запуск и команда `/clear` создают новую сессию; предыдущие файлы не загружаются автоматически. Потоковая выдача не используется.
