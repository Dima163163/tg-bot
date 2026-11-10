import { ArticleError } from '../supabase/functions/articles/src/application/contracts.ts';
import { prepareArticleWriteUseCase } from '../supabase/functions/articles/src/application/use-cases/prepare-article-write.ts';

// Stdio presentation for the MCP preparation use case. This never writes to DB.
try {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 100_000) throw new ArticleError('INVALID_INPUT', 'Слишком большой запрос.');
  }
  const input = JSON.parse(raw);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ArticleError('INVALID_INPUT', 'Ожидается JSON-объект.');
  }
  process.stdout.write(`${JSON.stringify(await prepareArticleWriteUseCase.execute(input))}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    message: error instanceof ArticleError ? error.message : 'Не удалось подготовить запись статьи. Проверьте входной JSON.',
    code: error instanceof ArticleError ? error.code : 'INVALID_INPUT',
  })}\n`);
  process.exitCode = 1;
}
