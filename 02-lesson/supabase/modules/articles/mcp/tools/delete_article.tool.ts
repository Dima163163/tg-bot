import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { deleteArticleIfUnchangedUseCase } from '../../application/use-cases/delete-article-if-unchanged.ts';
import { articleId, invokeArticleTool } from './shared.ts';

export function registerDeleteArticle(server: McpServer, userId: string | null) {
  server.registerTool('delete_article', {
    description: 'Удалить статью по ID и версии из get_article.',
    inputSchema: z.object({ id: articleId, expected_updated_at: z.string() }),
    annotations: { destructiveHint: true },
  }, (input) => invokeArticleTool(userId, async () => { await deleteArticleIfUnchangedUseCase.execute(input); return { deleted: true }; }));
}
