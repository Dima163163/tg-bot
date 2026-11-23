import { McpServer } from '@modelcontextprotocol/server';
import { registerCreateArticle } from './tools/create_article.tool.ts';
import { registerDeleteArticle } from './tools/delete_article.tool.ts';
import { registerGetArticle } from './tools/get_article.tool.ts';
import { registerListArticles } from './tools/list_articles.tool.ts';
import { registerUpdateArticle } from './tools/update_article.tool.ts';

export function createArticleMcpServer(userId: string | null) {
  const server = new McpServer({ name: 'articles', version: '1.0.0' });
  registerListArticles(server, userId);
  registerGetArticle(server, userId);
  registerCreateArticle(server, userId);
  registerUpdateArticle(server, userId);
  registerDeleteArticle(server, userId);
  return server;
}
