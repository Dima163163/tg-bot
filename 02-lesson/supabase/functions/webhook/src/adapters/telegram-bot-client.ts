export interface SendMessageInput {
  chatId: number;
  text: string;
}

export interface TelegramBotClient {
  sendMessage(input: SendMessageInput): Promise<void>;
}

interface TelegramBotClientOptions {
  botToken: string;
  fetchFn?: typeof fetch;
}

export function createTelegramBotClient({
  botToken,
  fetchFn = fetch,
}: TelegramBotClientOptions): TelegramBotClient {
  return {
    async sendMessage({ chatId, text }) {
      const response = await fetchFn(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
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
