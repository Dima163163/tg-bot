import { ArticleError } from '../contracts.ts';
import { parseArticleId, parseExpectedUpdatedAt } from '../validation.ts';
import { mcpArticleWriteRepository } from '../../repositories/mcp-article-write-repository.ts';
import { prepareArticleContentUseCase } from './prepare-article-content.ts';

export const prepareArticleWriteUseCase = {
  async execute(input: Record<string, unknown>) {
    if (input.operation !== 'create' && input.operation !== 'update') {
      throw new ArticleError('INVALID_INPUT', 'operation: create или update.');
    }
    let id = '';
    let expectedUpdatedAt = '';
    let expectedModel: string | null = null;
    if (input.operation === 'update') {
      id = parseArticleId(input.id);
      expectedUpdatedAt = parseExpectedUpdatedAt(input.expected_updated_at);
      const model = input.expected_embedding_model;
      if (model !== null && (typeof model !== 'string' || !model.trim())) {
        throw new ArticleError('INVALID_INPUT', 'Передайте expected_embedding_model из прочитанной статьи, включая null.');
      }
      expectedModel = model;
    }
    const content = await prepareArticleContentUseCase.execute({
      title: input.title, body: input.body, existingEmbeddingModel: expectedModel,
    });
    const sql = input.operation === 'create'
      ? mcpArticleWriteRepository.prepareCreate(content)
      : mcpArticleWriteRepository.prepareUpdate(id, expectedUpdatedAt, expectedModel, content);
    return { title: content.title, body: content.body, embedding_model: content.embedding_model, sql };
  },
};
