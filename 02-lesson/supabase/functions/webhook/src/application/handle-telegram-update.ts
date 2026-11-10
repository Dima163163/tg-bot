import { answerKnowledgeQuestionUseCase } from '../../../_shared/knowledge/application/answer-question.ts';
import { telegramBotClient } from '../adapters/telegram-bot-client.ts';
import { telegramMessageRepository } from '../repositories/telegram-message-repository.ts';

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

export const handleTelegramUpdateUseCase = {
  async execute(update: unknown): Promise<void> {
    if (!isTelegramUpdate(update) || update.message.from.is_bot) return;
    const { message } = update;
    const chatId = message.chat.id;

    const body = message.text ?? message.caption ?? null;
    await telegramMessageRepository.saveIncoming({
      updateId: update.update_id,
      userId: String(message.from.id),
      firstName: message.from.first_name,
      lastName: message.from.last_name ?? null,
      author: message.from.username ?? [message.from.first_name, message.from.last_name].filter(Boolean).join(' '),
      body,
      sentAt: new Date(message.date * 1000).toISOString(),
    });

    const attempt = crypto.randomUUID();
    const claim = await telegramMessageRepository.claim(update.update_id, attempt);
    if (claim === 'sent') return;
    if (claim === 'busy') throw new Error('Reply is already being processed');

    let answer: string;
    if (!body?.trim()) answer = 'Напишите вопрос текстом — я поищу ответ в базе знаний.';
    else if (/^\/(start|help)(@\w+)?(?:\s|$)/i.test(body.trim())) {
      answer = 'Я отвечаю по базе знаний. Сейчас в ней учебные статьи о вымышленном коворкинге «Атлас». Спросите о ценах, графике работы, переговорной, Wi-Fi, адресе или отмене брони.';
    } else if (body.trim().length > 2000) answer = 'Пожалуйста, сократите вопрос до 2000 символов.';
    else {
      try { answer = (await answerKnowledgeQuestionUseCase.execute(body)).answer; }
      catch (error) {
        console.error('Knowledge answer failed', error instanceof Error ? error.name : 'Unknown');
        answer = 'Поиск по базе знаний временно недоступен. Пожалуйста, попробуйте позже.';
      }
    }

    let delivery: { sentAt: string };
    try { delivery = await telegramBotClient.sendMessage({ chatId, text: answer }); }
    catch (error) {
      await telegramMessageRepository.fail(update.update_id, attempt);
      throw error;
    }
    await telegramMessageRepository.complete({
      updateId: update.update_id, attempt, body: answer,
      sentAt: delivery.sentAt, userId: String(message.from.id),
    });
  },
};

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
