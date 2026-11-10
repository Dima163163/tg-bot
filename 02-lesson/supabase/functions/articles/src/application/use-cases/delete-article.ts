import { ArticleError } from '../contracts.ts';
import { parseArticleId } from '../validation.ts';
import { articleRepository } from '../../repositories/article-repository.ts';

export const deleteArticleUseCase = {
  async execute(id: unknown): Promise<void> {
    if (!await articleRepository.delete(parseArticleId(id))) {
      throw new ArticleError('NOT_FOUND', 'Статья уже удалена.');
    }
  },
};
