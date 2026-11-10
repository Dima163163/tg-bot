import { ArticleError, publicArticle } from '../contracts.ts';
import { parseArticleId } from '../validation.ts';
import { articleRepository } from '../../repositories/article-repository.ts';
import { prepareArticleContentUseCase } from './prepare-article-content.ts';

export const indexArticleUseCase = {
  async execute(value: unknown) {
    const id = parseArticleId(value);
    const current = await articleRepository.find(id);
    if (!current) throw new ArticleError('NOT_FOUND', 'Статья не найдена.');
    const content = await prepareArticleContentUseCase.execute({
      title: current.title, body: current.body, existingEmbeddingModel: current.embedding_model,
    });
    if (!content.embedding) throw new ArticleError('EMBEDDING_UNAVAILABLE', 'Модель embeddings не настроена.');
    const updated = await articleRepository.update(id, current.updated_at, content);
    if (!updated) throw new ArticleError('CONFLICT', 'Статья изменилась во время индексации.');
    return publicArticle(updated);
  },
};
