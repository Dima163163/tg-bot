import type { IncomingTelegramMessage } from '../contracts.ts';
import { telegramMessageRepository } from '../../repositories/telegram-message-repository.ts';

export const saveIncomingTelegramMessageUseCase = {
  async execute(message: IncomingTelegramMessage): Promise<void> {
    // The RPC updates the client and stores the incoming message atomically.
    await telegramMessageRepository.saveIncoming(message);
  },
};
