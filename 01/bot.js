const fs = require('fs');
const token = fs.readFileSync('.env', 'utf8').split('=')[1]?.trim();

async function main() {
  try {
    if (!token) throw new Error('В .env не найден BOT_TOKEN');

    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'Ошибка Telegram API');
    }

    console.log(data.result);
  } catch (error) {
    console.error('Ошибка:', error.message);
    process.exitCode = 1;
  }
}

main();
