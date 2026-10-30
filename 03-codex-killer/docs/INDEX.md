# Индекс документации

## Обзор проекта

- [README.md](../README.md) — запуск, конфигурация OpenAI API и контракт адаптера; реализовано в `chat.mjs` и `openai-adapter.mjs`.

## Архитектура

- [C4: контекст системы](diagrams/c4-context.puml) — пользователь, CustomChat и OpenAI Platform; соответствует `chat.mjs` и `openai-adapter.mjs`.
- [C4: контейнеры](diagrams/c4-containers.puml) — процесс Node.js и внешний Responses API; соответствует `package.json`, `chat.mjs` и `openai-adapter.mjs`.
- [C4: компоненты](diagrams/c4-components.puml) — цикл консоли, адаптер, OpenAI JavaScript SDK и внешний API; соответствует `chat.mjs` и `openai-adapter.mjs`.
- [C4: код](diagrams/c4-code.puml) — контракт `getTextResponse(prompt): Promise<string>` и извлечение полного `output_text`; соответствует `chat.mjs` и `openai-adapter.mjs`.

Диаграммы описывают текущую реализацию. История чата и потоковая выдача в коде отсутствуют.
