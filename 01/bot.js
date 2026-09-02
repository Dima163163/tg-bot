const fs = require('fs');
const token = fs.readFileSync('.env', 'utf8').split('=')[1]?.trim();
let offset = 0;
let isRequestRunning = false;

async function main() {
  if (isRequestRunning) return;
  isRequestRunning = true;

  try {
    if (!token) throw new Error('В .env не найден BOT_TOKEN');

    const response = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0`,
    );
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'Ошибка Telegram API');
    }

    const updates = data.result;
    console.log(JSON.stringify(data, null, 2));

    if (updates.length) {
      offset = updates[updates.length - 1].update_id + 1;
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    isRequestRunning = false;
  }
}

main();
setInterval(main, 5000);
