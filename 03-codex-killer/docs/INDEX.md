# Индекс документации

## Обзор проекта

- [README.md](../README.md) — запуск, конфигурация OpenAI API, файловые инструменты и память сессий; реализовано в `chat.mjs`, `openai-adapter.mjs`, `file-tools.mjs` и `memory-repository.mjs`.

## Архитектура

- [C4: контекст системы](diagrams/c4-context.puml) — текущая система целиком: пользователь, консоль, OpenAI и локальные возможности; соответствует `chat.mjs`, `memory-repository.mjs`, `file-tools.mjs` и `openai-adapter.mjs`.
- [C4: контейнеры](diagrams/c4-containers.puml) — приложение Node.js, отдельные JSON-файлы сессий, папка `workspace/` и внешний Responses API; соответствует `package.json` и четырём основным модулям.
- [C4: компоненты](diagrams/c4-components.puml) — цикл диалога, порядок сохранения сообщений, адаптер, SDK, файловые инструменты и цикл вызовов; соответствует `chat.mjs`, `memory-repository.mjs`, `file-tools.mjs` и `openai-adapter.mjs`.
- [C4: код](diagrams/c4-code.puml) — контракт `getTextResponse(messages): Promise<string>`, модули памяти, файловые инструменты и OpenAI-адаптер; соответствует `chat.mjs`, `memory-repository.mjs`, `file-tools.mjs` и `openai-adapter.mjs`.

Диаграммы описывают текущую реализацию. Каждый запуск и команда `/clear` создают новую сессию; предыдущие файлы не загружаются автоматически. Потоковая выдача не используется.
