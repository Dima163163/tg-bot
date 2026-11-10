import { ArticleError } from '../../../articles/src/application/contracts.ts';
import { KnowledgeError } from '../../../_shared/knowledge/application/contracts.ts';
import { answerKnowledgeQuestionUseCase } from '../../../_shared/knowledge/application/answer-question.ts';
import { indexArticleUseCase } from '../../../articles/src/application/use-cases/index-article.ts';
import { authorizeKnowledgeAdminUseCase } from '../application/authorize.ts';
import { generateKnowledgeEmbeddingUseCase } from '../application/generate-embedding.ts';
import { seedDemoArticlesUseCase } from '../application/seed-demo.ts';

export async function handleKnowledgeAdminRequest(request: Request): Promise<Response> {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    await authorizeKnowledgeAdminUseCase.execute(authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
    if (request.method !== 'POST') return Response.json({ message: 'Требуется POST.' }, { status: 405, headers: { Allow: 'POST' } });
    const input: unknown = await request.json().catch(() => null);
    if (input === null || typeof input !== 'object' || !('action' in input)) {
      throw new KnowledgeError('INVALID_INPUT', 'Передайте JSON с action.');
    }
    if (input.action === 'embedding' && 'text' in input) {
      return Response.json(await generateKnowledgeEmbeddingUseCase.execute(input.text));
    }
    if (input.action === 'seed') return Response.json(await seedDemoArticlesUseCase.execute());
    if (input.action === 'index' && 'id' in input) return Response.json(await indexArticleUseCase.execute(input.id));
    if (input.action === 'answer' && 'question' in input) return Response.json(await answerKnowledgeQuestionUseCase.execute(input.question));
    throw new KnowledgeError('INVALID_INPUT', 'Неизвестная операция.');
  } catch (error) {
    if (error instanceof KnowledgeError) {
      return Response.json({ message: error.message, code: error.code }, {
        status: error.code === 'FORBIDDEN' ? 401 : error.code === 'INVALID_INPUT' ? 400 : 503,
      });
    }
    if (error instanceof ArticleError) {
      return Response.json({ message: error.message, code: error.code }, {
        status: error.code === 'INVALID_INPUT' ? 400 : error.code === 'CONFLICT' ? 409 : error.code === 'NOT_FOUND' ? 404 : 503,
      });
    }
    console.error('Knowledge operation failed', error instanceof Error ? error.name : 'Unknown');
    return Response.json({ message: 'Операция с базой знаний завершилась ошибкой.' }, { status: 500 });
  }
}
