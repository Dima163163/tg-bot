import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import { executeFileTool, fileTools } from "./file-tools.mjs";

const DEFAULT_MODEL = "gpt-6-luna";
const MAX_TOOL_ROUNDS = 8;
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

function toUserFacingApiError(error) {
  const statusCode = getStatusCode(error);

  if (statusCode === 401) {
    return new Error("OpenAI API отклонил ключ. Проверь OPENAI_API_KEY.");
  }

  if (statusCode === 403) {
    return new Error("У API-ключа нет доступа к выбранной модели.");
  }

  if (statusCode === 404) {
    return new Error("Модель не найдена. Проверь OPENAI_MODEL.");
  }

  if (statusCode === 429) {
    return new Error("OpenAI API ограничил запрос. Проверь лимиты и биллинг.");
  }

  return new Error("Не удалось получить ответ от OpenAI API. Проверь подключение и настройки.");
}

async function createModelResponse(openai, model, input) {
  try {
    return await openai.responses.create({
      model,
      input,
      tools: fileTools,
      store: false,
      instructions:
        "Only use create_file or read_file when the user asks to create or read a file. Paths are relative to workspace/. Do not claim success unless the tool result confirms it.",
    });
  } catch (error) {
    throw toUserFacingApiError(error);
  }
}

async function executeToolCall(call) {
  let result;

  try {
    const args = JSON.parse(call.arguments);
    const toolResult = await executeFileTool(call.name, args);
    result = { ok: true, ...toolResult };
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось выполнить инструмент.",
    };
  }

  return {
    type: "function_call_output",
    call_id: call.call_id,
    output: JSON.stringify(result),
  };
}

function getFinalText(response) {
  if (typeof response.output_text === "string" && response.output_text.length > 0) {
    return response.output_text;
  }

  const refusal = response.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content)
    .find((part) => part.type === "refusal");

  if (refusal?.refusal) {
    return refusal.refusal;
  }

  throw new Error("Модель вернула пустой ответ.");
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
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const input = conversation;
  let toolRounds = 0;

  while (true) {
    const response = await createModelResponse(openai, model, input);

    if (response.status !== "completed") {
      throw new Error("Ответ модели завершился до получения готового текста.");
    }

    const calls = response.output.filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      return getFinalText(response);
    }

    if (toolRounds >= MAX_TOOL_ROUNDS) {
      throw new Error("Модель превысила лимит последовательных вызовов инструментов.");
    }

    toolRounds += 1;
    input.push(...toResponseInputItems(response.output));

    for (const call of calls) {
      input.push(await executeToolCall(call));
    }
  }
}
