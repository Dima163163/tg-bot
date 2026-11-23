import { ArticleError } from '../contracts.ts';
import { parseArticleContent } from '../validation.ts';
import { articleEmbeddings } from '../../adapters/http-embedding-client.ts';

export const prepareArticleContentUseCase = {
  async execute(input: { title?: unknown; body?: unknown; existingEmbeddingModel?: string | null }) {
    const { title, body } = parseArticleContent(input);
    const generated = await articleEmbeddings.generate(title, body);
    if (!generated && input.existingEmbeddingModel != null) {
      throw new ArticleError('EMBEDDING_UNAVAILABLE', 'Пересчёт вектора пока не настроен. Изменение этой статьи временно недоступно.');
    }
    return {
      title, body, embedding: generated?.embedding ?? null,
      embedding_model: generated?.model ?? null,
    };
  },
};
