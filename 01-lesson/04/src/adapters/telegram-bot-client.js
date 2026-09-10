export function createTelegramBotClient({ botToken, fetchFn = fetch }) {
  return {
    async sendMessage({ chatId, text }) {
      const response = await fetchFn(
        'https://api.telegram.org/bot' + botToken + '/sendMessage',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        },
      );

      if (!response.ok) {
        throw new Error('Telegram API request failed');
      }
    },
  };
}
