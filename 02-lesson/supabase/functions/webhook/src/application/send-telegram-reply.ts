import { telegramMessageRepository } from '../../../../modules/conversations/repositories/telegram-message-repository.ts';
import { telegramBotClient } from '../adapters/telegram-bot-client.ts';
import type { TelegramIncomingUpdate } from './contracts.ts';
import { prepareTelegramReplyUseCase } from './prepare-telegram-reply.ts';

export const sendTelegramReplyUseCase = {
  async execute(update: TelegramIncomingUpdate): Promise<void> {
    const attempt = crypto.randomUUID();
    const claim = await telegramMessageRepository.claim(update.updateId, attempt);
    if (claim === 'sent') return;
    if (claim === 'busy') throw new Error('Reply is already being processed');

    const answer = await prepareTelegramReplyUseCase.execute(update);
    let delivery: { sentAt: string };
    try { delivery = await telegramBotClient.sendMessage({ chatId: update.chatId, text: answer }); }
    catch (error) {
      await telegramMessageRepository.fail(update.updateId, attempt);
      throw error;
    }
    await telegramMessageRepository.complete({
      updateId: update.updateId, attempt, body: answer,
      sentAt: delivery.sentAt, userId: update.userId,
    });
  },
};
