import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { getArticleUseCase } from '../../application/use-cases/get-article.ts';
import { articleId, invokeArticleTool } from './shared.ts';

export function registerGetArticle(server: McpServer, userId: string | null) {
  server.registerTool('get_article', {
    description: 'Прочитать точную статью и её версию перед изменением.', inputSchema: z.object({ id: articleId }),
    annotations: { readOnlyHint: true },
  }, (input) => invokeArticleTool(userId, () => getArticleUseCase.execute(input.id)));
}
