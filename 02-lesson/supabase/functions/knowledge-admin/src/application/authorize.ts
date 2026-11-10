import { KnowledgeError } from '../../../_shared/knowledge/application/contracts.ts';
import { knowledgeAdminAccess } from '../adapters/access.ts';

export const authorizeKnowledgeAdminUseCase = {
  async execute(token: string): Promise<void> {
    if (!await knowledgeAdminAccess.valid(token)) throw new KnowledgeError('FORBIDDEN', 'Доступ запрещён.');
  },
};
