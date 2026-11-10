import { Buffer } from 'node:buffer';
import type { ArticleWrite } from '../application/contracts.ts';

function sqlText(value: string): string {
  return `convert_from(decode('${Buffer.from(value, 'utf8').toString('base64')}', 'base64'), 'UTF8')`;
}
const returning = 'returning id, title, body, created_at, updated_at, embedding_model;';

export const mcpArticleWriteRepository = {
  prepareCreate(input: ArticleWrite): string {
    const embedding = input.embedding ? `'${JSON.stringify(input.embedding)}'::extensions.vector` : 'null';
    const model = input.embedding_model ? sqlText(input.embedding_model) : 'null';
    return `insert into public.articles (title, body, embedding, embedding_model)\nvalues (${sqlText(input.title)}, ${sqlText(input.body)}, ${embedding}, ${model})\n${returning}`;
  },
  prepareUpdate(id: string, updatedAt: string, expectedModel: string | null, input: ArticleWrite): string {
    const embedding = input.embedding ? `'${JSON.stringify(input.embedding)}'::extensions.vector` : 'null';
    const model = input.embedding_model ? sqlText(input.embedding_model) : 'null';
    return `update public.articles\nset title = ${sqlText(input.title)}, body = ${sqlText(input.body)}, embedding = ${embedding}, embedding_model = ${model}\nwhere id = ${id} and updated_at = ${sqlText(updatedAt)}::timestamptz\n  and embedding_model is not distinct from ${expectedModel === null ? 'null' : sqlText(expectedModel)}\n${returning}`;
  },
};
