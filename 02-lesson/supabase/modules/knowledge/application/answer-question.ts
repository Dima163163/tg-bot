import { KnowledgeError } from './contracts.ts';
import { knowledgeEmbeddings } from '../adapters/embeddings.ts';
import { groqClient } from '../adapters/groq.ts';
import { knowledgeSearchRepository } from '../repositories/search-repository.ts';

const NO_ANSWER = 'Мы обрабатываем ваш запрос';
export const answerKnowledgeQuestionUseCase = {
  async execute(question: unknown) {
    if (typeof question !== 'string' || !question.trim() || question.trim().length > 2000) {
      throw new KnowledgeError('INVALID_INPUT', 'Введите вопрос длиной от 1 до 2000 символов.');
    }
    const vector = await knowledgeEmbeddings.generate(question.trim());
    const sources = await knowledgeSearchRepository.search(vector);
    if (!sources.length) return { answer: NO_ANSWER, sources: [] };
    const result = await groqClient.answer(question.trim(), sources);
    if (!result.sourceIds.length) return { answer: NO_ANSWER, sources: [] };
    const used = sources.filter(source => result.sourceIds.includes(source.id));
    return {
      answer: `${result.answer}\n\nИсточники: ${used.map(source => source.title.slice(0, 150)).join('; ')}`,
      sources: used.map(({ id, title, similarity }) => ({ id, title, similarity })),
    };
  },
};
