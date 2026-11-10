import { KnowledgeError } from '../../../_shared/knowledge/application/contracts.ts';
import { knowledgeEmbeddings } from '../../../_shared/knowledge/adapters/embeddings.ts';

export const generateKnowledgeEmbeddingUseCase = {
  async execute(text: unknown) {
    if (typeof text !== 'string') throw new KnowledgeError('INVALID_INPUT', 'Передайте текст.');
    return await knowledgeEmbeddings.generate(text);
  },
};
