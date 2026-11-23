import { saveIncomingTelegramMessageUseCase } from '../../../../modules/conversations/application/use-cases/save-incoming-telegram-message.ts';
import type { TelegramIncomingUpdate } from './contracts.ts';
import { sendTelegramReplyUseCase } from './send-telegram-reply.ts';

export const handleTelegramUpdateUseCase = {
  async execute(update: TelegramIncomingUpdate): Promise<void> {
    await saveIncomingTelegramMessageUseCase.execute(update);
    await sendTelegramReplyUseCase.execute(update);
  },
};
