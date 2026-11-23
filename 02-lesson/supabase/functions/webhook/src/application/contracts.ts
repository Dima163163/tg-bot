import type { IncomingTelegramMessage } from '../../../../modules/conversations/application/contracts.ts';

export interface TelegramIncomingUpdate extends IncomingTelegramMessage {
  chatId: number;
}
