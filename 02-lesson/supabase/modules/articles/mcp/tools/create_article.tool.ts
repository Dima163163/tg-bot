import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { createArticleUseCase } from '../../application/use-cases/create-article.ts';
import { articleContent, invokeArticleTool } from './shared.ts';

export function registerCreateArticle(server: McpServer, userId: string | null) {
  server.registerTool('create_article', {
    description: 'Создать статью и одновременно вычислить её embedding.', inputSchema: z.object(articleContent),
  }, (input) => invokeArticleTool(userId, () => createArticleUseCase.execute(input)));
}
