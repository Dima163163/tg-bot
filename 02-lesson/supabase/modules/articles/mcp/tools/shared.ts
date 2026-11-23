import { z } from 'zod';
import { ArticleError } from '../../application/contracts.ts';
import { authorizeArticlesUseCase } from '../../application/use-cases/authorize-articles.ts';

export const articleId = z.string().regex(/^[1-9]\d*$/).describe('ID статьи');
export const articleContent = { title: z.string(), body: z.string() };

export async function invokeArticleTool(userId: string | null, action: () => Promise<unknown>) {
  try {
    await authorizeArticlesUseCase.execute(userId);
    return { content: [{ type: 'text' as const, text: JSON.stringify(await action()) }] };
  } catch (error) {
    if (error instanceof ArticleError) {
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ code: error.code, message: error.message }) }] };
    }
    console.error('MCP article operation failed', error instanceof Error ? error.name : 'UnknownError');
    return { isError: true, content: [{ type: 'text' as const, text: 'Не удалось выполнить операцию со статьёй.' }] };
  }
}
