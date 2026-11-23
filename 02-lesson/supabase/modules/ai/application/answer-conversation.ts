import { recentTelegramMessagesRepository } from '../../conversations/repositories/recent-telegram-messages-repository.ts';
import { groqClient } from '../../knowledge/adapters/groq.ts';

export const answerConversationUseCase = {
  async execute(input: { updateId: number; userId: string; question: string }): Promise<string> {
    const messages = await recentTelegramMessagesRepository.findForUpdate(input);
    return groqClient.answerConversation(messages);
  },
};
