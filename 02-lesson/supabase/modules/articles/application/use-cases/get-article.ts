import { ArticleError, publicArticle } from '../contracts.ts';
import { parseArticleId } from '../validation.ts';
import { articleRepository } from '../../repositories/article-repository.ts';

export const getArticleUseCase = {
  async execute(id: unknown) {
    const article = await articleRepository.find(parseArticleId(id));
    if (!article) throw new ArticleError('NOT_FOUND', 'Статья не найдена.');
    return publicArticle(article);
  },
};
