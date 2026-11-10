import { publicArticle } from '../contracts.ts';
import { articleRepository } from '../../repositories/article-repository.ts';
import { prepareArticleContentUseCase } from './prepare-article-content.ts';

export const createArticleUseCase = {
  async execute(input: { title?: unknown; body?: unknown }) {
    const content = await prepareArticleContentUseCase.execute(input);
    return publicArticle(await articleRepository.create(content));
  },
};
