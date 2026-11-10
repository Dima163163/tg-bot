import { ArticleError, publicArticle } from '../contracts.ts';
import { parseArticleId } from '../validation.ts';
import { articleRepository } from '../../repositories/article-repository.ts';

export const listArticlesUseCase = {
  async execute(input: { limit: number; beforeId: string | null }) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
      throw new ArticleError('INVALID_INPUT', 'Размер страницы должен быть от 1 до 50.');
    }
    const beforeId = input.beforeId === null ? null : parseArticleId(input.beforeId);
    const rows = await articleRepository.list(input.limit + 1, beforeId);
    return { data: rows.slice(0, input.limit).map(publicArticle), hasMore: rows.length > input.limit };
  },
};
