interface TelegramMessage {
  chat: {
    id: number;
  };
  date: number;
  from: {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  text?: string;
  caption?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message: TelegramMessage;
}

export interface IncomingTelegramMessage {
  updateId: number;
  userId: string;
  firstName: string;
  lastName: string | null;
  author: string;
  body: string | null;
  sentAt: string;
}

export interface OutgoingTelegramMessage {
  body: string;
  sentAt: string;
  userId: string;
}

interface TelegramClient {
  sendMessage(input: { chatId: number; text: string }): Promise<void>;
}

interface HandleTelegramUpdateOptions {
  telegramClient: TelegramClient;
  saveBotReply: (message: OutgoingTelegramMessage) => Promise<void>;
  saveMessage: (message: IncomingTelegramMessage) => Promise<void>;
}

const ACKNOWLEDGEMENT = 'Мы получили ваш запрос';

export function createHandleTelegramUpdate({
  telegramClient,
  saveBotReply,
  saveMessage,
}: HandleTelegramUpdateOptions): (update: unknown) => Promise<void> {
  return async function handleTelegramUpdate(update) {
    if (!isTelegramUpdate(update) || update.message.from.is_bot) return;
    const { message } = update;
    const chatId = message.chat.id;

    await saveMessage({
      updateId: update.update_id,
      userId: String(message.from.id),
      firstName: message.from.first_name,
      lastName: message.from.last_name ?? null,
      author: message.from.username ?? [message.from.first_name, message.from.last_name].filter(Boolean).join(' '),
      body: message.text ?? message.caption ?? null,
      sentAt: new Date(message.date * 1000).toISOString(),
    });

    await telegramClient.sendMessage({
      chatId,
      text: ACKNOWLEDGEMENT,
    });
    await saveBotReply({
      body: ACKNOWLEDGEMENT,
      sentAt: new Date().toISOString(),
      userId: String(message.from.id),
    });
  };
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  if (!isRecord(value) || !Number.isSafeInteger(value.update_id)) return false;
  const message = value.message;
  if (!isRecord(message) || !isRecord(message.chat) || !isRecord(message.from)) return false;
  return Number.isSafeInteger(message.chat.id)
    && Number.isSafeInteger(message.from.id)
    && typeof message.date === 'number'
    && Number.isSafeInteger(message.date)
    && message.date >= 0
    && message.date <= 8_640_000_000_000
    && typeof message.from.first_name === 'string'
    && (message.from.last_name === undefined || typeof message.from.last_name === 'string')
    && (message.from.username === undefined || typeof message.from.username === 'string')
    && (message.from.is_bot === undefined || typeof message.from.is_bot === 'boolean')
    && (message.text === undefined || typeof message.text === 'string')
    && (message.caption === undefined || typeof message.caption === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
