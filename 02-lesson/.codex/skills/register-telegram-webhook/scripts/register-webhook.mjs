import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SHARED_PROJECT_REF = 'cappgvetnxvjhnxufhkz';
const WEBHOOK_PATH = '/functions/v1/webhook/telegram';

export function parseProjectUrl(input) {
  const match = /^https:\/\/([a-z0-9-]{6,64})\.supabase\.co\/?$/.exec(input.trim());
  if (!match) {
    throw new Error('Нужен адрес проекта вида https://<project-ref>.supabase.co без пути и параметров.');
  }
  if (match[1] === SHARED_PROJECT_REF) {
    throw new Error('Это общий проект репозитория. Укажите свой отдельный Supabase-проект.');
  }
  return {
    projectRef: match[1],
    webhookUrl: `https://${match[1]}.supabase.co${WEBHOOK_PATH}`,
  };
}

export function validateBotToken(value) {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Неверный формат токена Telegram-бота.');
  }
  return value;
}

export function validateWebhookSecret(value) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) {
    throw new Error('Секрет должен содержать 1–256 символов A-Z, a-z, 0-9, _ или -.');
  }
  return value;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(question).finally(() => rl.close());
}

function askHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stdin.setRawMode) {
    throw new Error('Секреты можно вводить только в интерактивном терминале.');
  }
  process.stdout.write(question);
  return new Promise((resolveAnswer, reject) => {
    let answer = '';
    const finish = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolveAnswer(answer);
    };
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') return finish(new Error('Операция отменена.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') answer = answer.slice(0, -1);
        else if (char >= ' ' && char <= '~') answer += char;
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function telegramRequest(botToken, method, payload) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'content-type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(`Не удалось связаться с Telegram API (${method}).`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(`Telegram отклонил запрос ${method}. Проверьте данные бота и повторите попытку.`);
  }
  return data.result;
}

async function checkFunction(webhookUrl) {
  let response;
  try {
    response = await fetch(webhookUrl, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Edge Function недоступна по указанному адресу.');
  }
  if (response.status !== 405) {
    throw new Error(`Edge Function ответила HTTP ${response.status}, ожидался 405 для GET. Проверьте публикацию функции и verify_jwt = false.`);
  }
}

function describeExistingWebhook(url, expectedUrl) {
  if (!url) return 'не установлен';
  return url === expectedUrl ? 'уже указывает на этот проект' : 'установлен на другом адресе (адрес скрыт)';
}

async function saveSecrets(projectRef, botToken, webhookSecret) {
  const bundledCli = resolve(REPOSITORY_ROOT, 'node_modules/.bin/supabase');
  const cli = existsSync(bundledCli) ? bundledCli : 'supabase';
  const args = ['secrets', 'set', '--project-ref', projectRef, '--env-file', '/dev/stdin'];
  const body = `BOT_TOKEN=${botToken}\nTELEGRAM_WEBHOOK_SECRET=${webhookSecret}\n`;
  await new Promise((resolveDone, reject) => {
    const child = spawn(cli, args, {
      cwd: REPOSITORY_ROOT,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    child.on('error', () => reject(new Error('Не удалось запустить Supabase CLI. Проверьте установку.')));
    child.on('close', (code) => {
      if (code === 0) resolveDone();
      else reject(new Error('Supabase CLI не сохранила секреты. Проверьте вход в CLI и права Owner/Admin на проект.'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(body);
  });
}

export async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Запустите скрипт в своём интерактивном терминале, не через чат или перенаправление ввода.');
  }
  console.log('Подключение личного Telegram-бота к отдельному Supabase-проекту.');
  const { projectRef, webhookUrl } = parseProjectUrl(await ask('URL своего Supabase-проекта: '));
  const botToken = validateBotToken(await askHidden('Токен бота (ввод скрыт): '));
  const enteredSecret = await askHidden('Секрет webhook (ввод скрыт; Enter — создать случайный): ');
  const webhookSecret = validateWebhookSecret(enteredSecret || randomBytes(32).toString('base64url'));
  if (!enteredSecret) console.log('Создан случайный секрет webhook.');

  const [bot, currentWebhook] = await Promise.all([
    telegramRequest(botToken, 'getMe'),
    telegramRequest(botToken, 'getWebhookInfo'),
    checkFunction(webhookUrl),
  ]);
  if (!bot?.is_bot || !/^[A-Za-z0-9_]+$/.test(bot?.username ?? '')) {
    throw new Error('Telegram не подтвердил учётную запись бота.');
  }

  console.log(`\nПроект: ${projectRef}`);
  console.log(`Бот: @${bot.username}`);
  console.log(`Текущий webhook: ${describeExistingWebhook(currentWebhook?.url, webhookUrl)}`);
  console.log(`Новый webhook: ${webhookUrl}`);
  console.log('Будут изменены секреты Edge Function и webhook в Telegram.');
  const confirmation = (await ask('Подтвердить? Напишите ДА: ')).trim();
  if (confirmation !== 'ДА') {
    console.log('Отменено без изменений.');
    return;
  }

  await saveSecrets(projectRef, botToken, webhookSecret);
  console.log('Секреты Edge Function сохранены. Регистрирую webhook...');
  try {
    await telegramRequest(botToken, 'setWebhook', {
      url: webhookUrl,
      secret_token: webhookSecret,
    });
    const info = await telegramRequest(botToken, 'getWebhookInfo');
    if (info?.url !== webhookUrl) {
      throw new Error('Telegram пока не подтвердил ожидаемый адрес webhook.');
    }
  } catch (error) {
    throw new Error(`Секреты Edge Function уже изменены, но регистрация webhook не подтверждена. ${error.message}`);
  }
  console.log(`Готово: webhook бота @${bot.username} установлен на ${webhookUrl}.`);
  console.log('Отправьте /start боту и проверьте обработку сообщения.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
