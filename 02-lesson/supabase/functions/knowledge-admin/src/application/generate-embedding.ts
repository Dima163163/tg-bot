import { KnowledgeError } from '../../../../modules/knowledge/application/contracts.ts';
import { knowledgeEmbeddings } from '../../../../modules/knowledge/adapters/embeddings.ts';

export const generateKnowledgeEmbeddingUseCase = {
  async execute(text: unknown) {
    if (typeof text !== 'string') throw new KnowledgeError('INVALID_INPUT', 'Передайте текст.');
    return await knowledgeEmbeddings.generate(text);
  },
};
