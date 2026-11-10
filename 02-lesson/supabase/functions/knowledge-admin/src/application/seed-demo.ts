import { demoArticles } from '../../../_shared/knowledge/data/demo-articles.ts';
import { knowledgeEmbeddings } from '../../../_shared/knowledge/adapters/embeddings.ts';
import { createArticleUseCase } from '../../../articles/src/application/use-cases/create-article.ts';
import { indexArticleUseCase } from '../../../articles/src/application/use-cases/index-article.ts';
import { articleRepository } from '../../../articles/src/repositories/article-repository.ts';

export const seedDemoArticlesUseCase = {
  async execute() {
    const result: Array<{ id: number; title: string; state: string }> = [];
    for (const input of demoArticles) {
      const existing = await articleRepository.findByTitle(input.title);
      if (!existing) {
        const created = await createArticleUseCase.execute(input);
        result.push({ id: created.id, title: created.title, state: 'created' });
      } else if (existing.embedding_model !== knowledgeEmbeddings.model()) {
        const indexed = await indexArticleUseCase.execute(existing.id);
        result.push({ id: indexed.id, title: indexed.title, state: 'indexed' });
      } else {
        result.push({ id: existing.id, title: existing.title, state: 'exists' });
      }
    }
    return { articles: result };
  },
};
