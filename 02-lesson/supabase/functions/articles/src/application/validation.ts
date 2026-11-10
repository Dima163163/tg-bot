import { ArticleError } from './contracts.ts';

export function parseArticleId(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new ArticleError('INVALID_INPUT', 'Некорректный ID статьи.');
  }
  if ((typeof value === 'number' && !Number.isSafeInteger(value)) || !/^[1-9]\d*$/.test(String(value))) {
    throw new ArticleError('INVALID_INPUT', 'Некорректный ID статьи.');
  }
  return String(value);
}

export function parseArticleContent(input: { title?: unknown; body?: unknown }): { title: string; body: string } {
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) {
    throw new ArticleError('INVALID_INPUT', 'Укажите заголовок от 1 до 200 символов.');
  }
  if (typeof input.body !== 'string' || !input.body.trim() || input.body.trim().length > 12_000) {
    throw new ArticleError('INVALID_INPUT', 'Укажите текст статьи от 1 до 12000 символов.');
  }
  return { title: input.title.trim(), body: input.body.trim() };
}

export function parseExpectedUpdatedAt(value: unknown): string {
  if (
    typeof value !== 'string' || value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new ArticleError('INVALID_INPUT', 'Передайте expected_updated_at из загруженной статьи.');
  }
  return value;
}
