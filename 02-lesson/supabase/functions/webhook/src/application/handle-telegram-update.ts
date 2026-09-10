import { formatRate } from '../domain/currency.ts';
import type { GetUsdRateResult } from './get-usd-rate.ts';

interface TelegramMessage {
  chat?: {
    id?: number;
  };
  text?: unknown;
}

export interface TelegramUpdate {
  message?: TelegramMessage;
}

interface TelegramClient {
  sendMessage(input: { chatId: number; text: string }): Promise<void>;
}

interface HandleTelegramUpdateOptions {
  getUsdRate: (messageText: unknown) => Promise<GetUsdRateResult>;
  telegramClient: TelegramClient;
}

function getReplyText(result: GetUsdRateResult): string {
  if (result.type === 'invalid-currency') {
    return 'Отправь трёхбуквенный код валюты, например: EUR, GBP или JPY.';
  }

  if (result.type === 'unsupported-currency') {
    return (
      'Frankfurter не предоставляет курс для ' +
      result.currency +
      '. Попробуй EUR, GBP или JPY.'
    );
  }

  if (result.type === 'rate-unavailable') {
    return 'Не удалось получить курс. Попробуй ещё раз чуть позже.';
  }

  const date = result.date ? '\nДата курса: ' + result.date : '';
  return '1 USD = ' + formatRate(result.rate) + ' ' + result.currency + date;
}

export function createHandleTelegramUpdate({
  getUsdRate,
  telegramClient,
}: HandleTelegramUpdateOptions): (update: unknown) => Promise<void> {
  return async function handleTelegramUpdate(update) {
    const message = isTelegramUpdate(update) ? update.message : undefined;
    const chatId = message?.chat?.id;

    if (chatId === undefined || chatId === null) {
      return;
    }

    const result = await getUsdRate(message.text);
    await telegramClient.sendMessage({
      chatId,
      text: getReplyText(result),
    });
  };
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null && 'message' in value;
}
