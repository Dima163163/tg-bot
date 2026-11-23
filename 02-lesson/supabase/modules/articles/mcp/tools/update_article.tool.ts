import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { updateArticleUseCase } from '../../application/use-cases/update-article.ts';
import { articleContent, articleId, invokeArticleTool } from './shared.ts';

export function registerUpdateArticle(server: McpServer, userId: string | null) {
  server.registerTool('update_article', {
    description: 'Обновить статью и её embedding; expected_updated_at возьмите из get_article.',
    inputSchema: z.object({ id: articleId, ...articleContent, expected_updated_at: z.string() }),
  }, (input) => invokeArticleTool(userId, () => updateArticleUseCase.execute(input)));
}
