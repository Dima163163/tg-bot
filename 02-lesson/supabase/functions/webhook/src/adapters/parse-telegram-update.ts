import type { TelegramIncomingUpdate } from '../application/contracts.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const telegramUpdateParser = {
  parse(value: unknown): TelegramIncomingUpdate | null {
    if (!isRecord(value) || !Number.isSafeInteger(value.update_id)) return null;
    const message = value.message;
    if (!isRecord(message) || !isRecord(message.chat) || !isRecord(message.from)) return null;
    const { chat, from, date, text, caption } = message;
    if (!Number.isSafeInteger(chat.id) || !Number.isSafeInteger(from.id) ||
      typeof date !== 'number' || !Number.isSafeInteger(date) || date < 0 || date > 8_640_000_000_000 ||
      typeof from.first_name !== 'string' ||
      (from.last_name !== undefined && typeof from.last_name !== 'string') ||
      (from.username !== undefined && typeof from.username !== 'string') ||
      (from.is_bot !== undefined && typeof from.is_bot !== 'boolean') ||
      (text !== undefined && typeof text !== 'string') ||
      (caption !== undefined && typeof caption !== 'string') || from.is_bot) return null;

    return {
      updateId: value.update_id as number,
      chatId: chat.id as number,
      userId: String(from.id),
      firstName: from.first_name,
      lastName: from.last_name ?? null,
      author: from.username ?? [from.first_name, from.last_name].filter(Boolean).join(' '),
      body: text ?? caption ?? null,
      sentAt: new Date(date * 1000).toISOString(),
    };
  },
};
