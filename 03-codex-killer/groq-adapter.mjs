import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import { executeFileTool, fileTools } from "./file-tools.mjs";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MAX_TOOL_ROUNDS = 8;
let client;

function getClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Задай GROQ_API_KEY в файле .env, чтобы отправлять запросы.");
  }

  client ??= new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
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
    return new Error("Groq отклонил ключ. Проверь GROQ_API_KEY в файле .env.");
  }

  if (statusCode === 403) {
    return new Error("У API-ключа нет доступа к выбранной модели.");
  }

  if (statusCode === 404) {
    return new Error("Модель не найдена. Проверь GROQ_MODEL в файле .env.");
  }

  if (statusCode === 429) {
    return new Error("Groq ограничил запрос. Проверь лимиты или повтори попытку позже.");
  }

  return new Error("Не удалось получить ответ от Groq API. Проверь подключение и настройки.");
}

async function createModelResponse(providerClient, model, input) {
  try {
    return await providerClient.responses.create({
      model,
      input,
      tools: fileTools,
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

  const groq = getClient();
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const input = conversation;
  let toolRounds = 0;

  while (true) {
    const response = await createModelResponse(groq, model, input);

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
