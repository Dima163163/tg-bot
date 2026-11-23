import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { listArticlesUseCase } from '../../application/use-cases/list-articles.ts';
import { articleId, invokeArticleTool } from './shared.ts';

export function registerListArticles(server: McpServer, userId: string | null) {
  server.registerTool('list_articles', {
    description: 'Получить страницу статей. Для следующей страницы передайте ID последней статьи как before_id.',
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20), before_id: articleId.nullable().default(null) }),
    annotations: { readOnlyHint: true },
  }, (input) => invokeArticleTool(userId, () => listArticlesUseCase.execute({ limit: input.limit, beforeId: input.before_id })));
}
