import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const useColors = Boolean(stdout.isTTY) && !("NO_COLOR" in process.env);
const color = (code, value) => (useColors ? `\u001b[${code}m${value}\u001b[0m` : value);

const styles = {
  title: (value) => color("1;36", value),
  user: (value) => color("1;34", value),
  assistant: (value) => color("1;32", value),
  hint: (value) => color("2", value),
};

function printWelcome() {
  stdout.write("\n");
  stdout.write(`  ${styles.title("CastomChat")}\n`);
  stdout.write("  Простой чат в консоли. Напиши сообщение — бот повторит его.\n");
  stdout.write(`  ${styles.hint("/help — команды   /clear — очистить экран   /exit — выйти")}\n\n`);
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

function printHelp() {
  stdout.write("\n  Команды:\n");
  stdout.write("  /help   показать эту подсказку\n");
  stdout.write("  /clear  очистить экран и начать с чистого листа\n");
  stdout.write("  /exit   завершить чат\n\n");
}

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout });

  printWelcome();

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
        if (stdout.isTTY) {
          stdout.write("\u001b[2J\u001b[H");
        }
        printWelcome();
        continue;
      }

      if (!message.trim()) {
        continue;
      }

      printAssistantReply(`CastomChat: ${message}`);
    }
  } finally {
    terminal.close();
    stdout.write("\n  Чат завершён. Пока!\n");
  }
}

await main();
