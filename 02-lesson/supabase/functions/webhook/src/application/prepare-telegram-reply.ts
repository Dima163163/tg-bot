import { answerKnowledgeQuestionUseCase } from '../../../../modules/knowledge/application/answer-question.ts';
import { KnowledgeError } from '../../../../modules/knowledge/application/contracts.ts';
import { answerConversationUseCase } from '../../../../modules/ai/application/answer-conversation.ts';
import type { TelegramIncomingUpdate } from './contracts.ts';

export const prepareTelegramReplyUseCase = {
  async execute(update: TelegramIncomingUpdate): Promise<string> {
    const { body } = update;
    if (!body?.trim()) return 'Напишите вопрос текстом — я поищу ответ в базе знаний.';
    if (/^\/(start|help)(@\w+)?(?:\s|$)/i.test(body.trim())) {
      return 'Я отвечаю по базе знаний. Сейчас в ней учебные статьи о вымышленном коворкинге «Атлас». Спросите о ценах, графике работы, переговорной, Wi-Fi, адресе или отмене брони.';
    }
    if (body.trim().length > 2000) return 'Пожалуйста, сократите вопрос до 2000 символов.';
    let result: Awaited<ReturnType<typeof answerKnowledgeQuestionUseCase.execute>>;
    try { result = await answerKnowledgeQuestionUseCase.execute(body); }
    catch (error) {
      if (error instanceof KnowledgeError && error.code === 'RATE_LIMIT') return 'Вернитесь с вашим вопросом позже.';
      console.error('Knowledge answer failed', error instanceof Error ? error.name : 'Unknown');
      return 'Поиск по базе знаний временно недоступен. Пожалуйста, попробуйте позже.';
    }
    if (result.sources.length) return result.answer;
    try {
      return await answerConversationUseCase.execute({ updateId: update.updateId, userId: update.userId, question: body });
    } catch (error) {
      if (error instanceof KnowledgeError && error.code === 'RATE_LIMIT') return 'Вернитесь с вашим вопросом позже.';
      console.error('AI fallback failed', error instanceof Error ? error.name : 'Unknown');
      return 'Сервис ответа временно недоступен. Пожалуйста, попробуйте позже.';
    }
  },
};
