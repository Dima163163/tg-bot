import { ArticleError } from '../contracts.ts';
import { parseArticleId, parseExpectedUpdatedAt } from '../validation.ts';
import { articleRepository } from '../../repositories/article-repository.ts';

export const deleteArticleIfUnchangedUseCase = {
  async execute(input: { id: unknown; expected_updated_at: unknown }): Promise<void> {
    const id = parseArticleId(input.id);
    const expectedUpdatedAt = parseExpectedUpdatedAt(input.expected_updated_at);
    if (!await articleRepository.deleteIfUnchanged(id, expectedUpdatedAt)) {
      throw new ArticleError('CONFLICT', 'Статья изменилась или была удалена. Прочитайте её заново.');
    }
  },
};
