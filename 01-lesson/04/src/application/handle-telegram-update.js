import { formatRate } from '../domain/currency.js';

function getReplyText(result) {
  if (result.type === 'invalid-currency') {
    return 'Отправь трёхбуквенный код валюты, например: EUR, GBP или JPY.';
  }

  if (result.type === 'unsupported-currency') {
    return 'Frankfurter не предоставляет курс для ' + result.currency + '. Попробуй EUR, GBP или JPY.';
  }

  if (result.type === 'rate-unavailable') {
    return 'Не удалось получить курс. Попробуй ещё раз чуть позже.';
  }

  const date = result.date ? '\nДата курса: ' + result.date : '';
  return '1 USD = ' + formatRate(result.rate) + ' ' + result.currency + date;
}

export function createHandleTelegramUpdate({ getUsdRate, telegramClient }) {
  return async function handleTelegramUpdate(update) {
    const message = update?.message;
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
