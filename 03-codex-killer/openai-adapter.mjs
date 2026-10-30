import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-6-luna";
let client;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Задай OPENAI_API_KEY в переменных окружения, чтобы отправлять запросы.");
  }

  client ??= new OpenAI({ apiKey });
  return client;
}

function getStatusCode(error) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  return Number(error.status);
}

/** Принимает переписку и возвращает полный текстовый ответ модели. */
export async function getTextResponse(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError("Переписка должна быть непустым массивом сообщений.");
  }

  const conversation = messages.map((message) => {
    if (
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      throw new TypeError("Каждое сообщение должно содержать роль и непустой текст.");
    }

    return { role: message.role, content: message.content };
  });

  const openai = getClient();
  let response;

  try {
    response = await openai.responses.create({
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
      input: conversation,
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode === 401) {
      throw new Error("OpenAI API отклонил ключ. Проверь OPENAI_API_KEY.");
    }

    if (statusCode === 403) {
      throw new Error("У API-ключа нет доступа к выбранной модели.");
    }

    if (statusCode === 404) {
      throw new Error("Модель не найдена. Проверь OPENAI_MODEL.");
    }

    if (statusCode === 429) {
      throw new Error("OpenAI API ограничил запрос. Проверь лимиты и биллинг.");
    }

    throw new Error("Не удалось получить ответ от OpenAI API. Проверь подключение и настройки.");
  }

  if (typeof response.output_text !== "string" || response.output_text.length === 0) {
    throw new Error("Модель вернула пустой ответ.");
  }

  return response.output_text;
}
