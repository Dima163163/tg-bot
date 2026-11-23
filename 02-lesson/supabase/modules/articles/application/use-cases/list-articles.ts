import { ArticleError, publicArticle } from '../contracts.ts';
import { parseArticleId } from '../validation.ts';
import { articleRepository } from '../../repositories/article-repository.ts';

export const listArticlesUseCase = {
  async execute(input: { limit: number; beforeId: string | null; search?: string }) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
      throw new ArticleError('INVALID_INPUT', 'Размер страницы должен быть от 1 до 50.');
    }
    const beforeId = input.beforeId === null ? null : parseArticleId(input.beforeId);
    const search = (input.search ?? '').trim();
    if (search.length > 100 || /[\u0000-\u001f\u007f]/.test(search)) {
      throw new ArticleError('INVALID_INPUT', 'Поисковый запрос должен содержать не более 100 символов без управляющих символов.');
    }
    const rows = await articleRepository.list(input.limit + 1, beforeId, search);
    return { data: rows.slice(0, input.limit).map(publicArticle), hasMore: rows.length > input.limit };
  },
};
