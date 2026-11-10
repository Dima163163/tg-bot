import { ArticleError, publicArticle } from '../contracts.ts';
import { parseArticleContent, parseArticleId, parseExpectedUpdatedAt } from '../validation.ts';
import { articleRepository } from '../../repositories/article-repository.ts';
import { prepareArticleContentUseCase } from './prepare-article-content.ts';

export const updateArticleUseCase = {
  async execute(input: { id?: unknown; title?: unknown; body?: unknown; expected_updated_at?: unknown }) {
    const id = parseArticleId(input.id);
    const { title, body } = parseArticleContent(input);
    const expectedUpdatedAt = parseExpectedUpdatedAt(input.expected_updated_at);
    const current = await articleRepository.find(id);
    if (!current) throw new ArticleError('NOT_FOUND', 'Статья уже удалена.');
    if (current.updated_at !== expectedUpdatedAt) {
      throw new ArticleError('CONFLICT', 'Статья уже изменена. Обновите список и откройте редактирование заново.');
    }
    if (current.title === title && current.body === body) return publicArticle(current);
    const content = await prepareArticleContentUseCase.execute({ title, body, existingEmbeddingModel: current.embedding_model });
    const updated = await articleRepository.update(id, expectedUpdatedAt, content);
    if (!updated) {
      throw new ArticleError('CONFLICT', 'Пока статья сохранялась, её изменили или удалили. Обновите список.');
    }
    return publicArticle(updated);
  },
};
