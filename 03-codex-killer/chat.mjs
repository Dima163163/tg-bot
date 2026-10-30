import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { getTextResponse } from "./openai-adapter.mjs";
import { createMemorySession } from "./memory-repository.mjs";

const useColors = Boolean(stdout.isTTY) && !("NO_COLOR" in process.env);
const color = (code, value) => (useColors ? `\u001b[${code}m${value}\u001b[0m` : value);

const styles = {
  title: (value) => color("1;36", value),
  user: (value) => color("1;34", value),
  assistant: (value) => color("1;32", value),
  error: (value) => color("1;31", value),
  hint: (value) => color("2", value),
};

function printWelcome(sessionFileName) {
  stdout.write("\n");
  stdout.write(`  ${styles.title("CustomChat")}\n`);
  stdout.write("  Диалог сохраняется в отдельный файл для каждой сессии.\n");
  stdout.write(`  Память: memory/${sessionFileName}\n`);
  stdout.write("  Файловые инструменты работают только внутри workspace/.\n");
  stdout.write(`  ${styles.hint("/help — команды   /clear — новая сессия   /exit — выйти")}\n\n`);
}

function wrapLine(line, maxLength) {
  const words = line.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const wrapped = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + word.length + 1 <= maxLength) {
      current += ` ${word}`;
    } else {
      wrapped.push(current);
      current = word;
    }

    while (current.length > maxLength) {
      wrapped.push(current.slice(0, maxLength));
      current = current.slice(maxLength);
    }
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped;
}

function printAssistantReply(message) {
  const contentWidth = Math.max(20, Math.min(100, (stdout.columns ?? 88) - 6));
  const lines = message
    .split(/\r?\n/)
    .flatMap((line) => wrapLine(line, contentWidth));

  stdout.write("\n");
  for (const [index, line] of lines.entries()) {
    const prefix = index === 0 ? `  ${styles.assistant("✦")} ` : "    ";
    stdout.write(`${prefix}${line}\n`);
  }
}

function printError(message) {
  stdout.write(`\n  ${styles.error("✕")} ${message}\n`);
}

function printHelp() {
  stdout.write("\n  Команды:\n");
  stdout.write("  /help   показать эту подсказку\n");
  stdout.write("  /clear  начать новую сессию в отдельном файле\n");
  stdout.write("  /exit   завершить чат\n");
  stdout.write("  Создание и чтение файлов доступны только в workspace/.\n\n");
}

async function appendToMemory(session, message) {
  session.messages.push(message);

  try {
    await session.save();
  } catch (error) {
    session.messages.pop();
    throw error;
  }
}

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout });
  let session;

  try {
    session = await createMemorySession();
  } catch (error) {
    terminal.close();
    printError(error instanceof Error ? error.message : "Не удалось создать файл переписки.");
    return;
  }

  printWelcome(session.fileName);

  try {
    while (true) {
      let message;

      try {
        message = await terminal.question(`${styles.user("> ")}`);
      } catch {
        break;
      }

      const command = message.trim().toLowerCase();

      if (command === "/exit" || command === "/quit") {
        break;
      }

      if (command === "/help") {
        printHelp();
        continue;
      }

      if (command === "/clear") {
        try {
          session = await createMemorySession();
          if (stdout.isTTY) {
            stdout.write("\u001b[2J\u001b[H");
          }
          printWelcome(session.fileName);
        } catch (error) {
          printError(error instanceof Error ? error.message : "Не удалось создать новую сессию.");
        }
        continue;
      }

      if (!message.trim()) {
        continue;
      }

      try {
        await appendToMemory(session, { role: "user", content: message });
      } catch (error) {
        printError(error instanceof Error ? error.message : "Не удалось сохранить сообщение.");
        continue;
      }

      let answer;
      try {
        answer = await getTextResponse(session.messages);
      } catch (error) {
        printError(error instanceof Error ? error.message : "Произошла неизвестная ошибка.");
        continue;
      }

      try {
        await appendToMemory(session, { role: "assistant", content: answer });
      } catch (error) {
        printAssistantReply(`CustomChat: ${answer}`);
        printError(error instanceof Error ? error.message : "Не удалось сохранить ответ.");
        continue;
      }

      printAssistantReply(`CustomChat: ${answer}`);
    }
  } finally {
    terminal.close();
    stdout.write("\n  Чат завершён. Пока!\n");
  }
}

await main();
