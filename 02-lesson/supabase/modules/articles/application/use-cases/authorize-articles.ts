import { ArticleError } from '../contracts.ts';
import { operatorRepository } from '../../repositories/operator-repository.ts';

export const authorizeArticlesUseCase = {
  async execute(userId: string | null): Promise<void> {
    if (!userId) throw new ArticleError('UNAUTHENTICATED', 'Войдите в аккаунт.');
    if (!await operatorRepository.isOperator(userId)) {
      throw new ArticleError('FORBIDDEN', 'Доступ разрешён только операторам.');
    }
  },
};
