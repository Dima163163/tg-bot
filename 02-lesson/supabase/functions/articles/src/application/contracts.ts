export type ArticleErrorCode =
  | 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'EMBEDDING_UNAVAILABLE' | 'EMBEDDING_TIMEOUT' | 'EMBEDDING_REJECTED'
  | 'INVALID_EMBEDDING' | 'SCHEMA_NOT_READY' | 'STORAGE_FAILED';

export class ArticleError extends Error {
  readonly code: ArticleErrorCode;
  constructor(code: ArticleErrorCode, message: string) {
    super(message);
    this.name = 'ArticleError';
    this.code = code;
  }
}

export interface Article {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface StoredArticle extends Article {
  embedding_model: string | null;
}

export interface ArticleWrite {
  title: string;
  body: string;
  embedding: number[] | null;
  embedding_model: string | null;
}

export interface ArticleRepository {
  list(limit: number, beforeId: string | null): Promise<StoredArticle[]>;
  find(id: string): Promise<StoredArticle | null>;
  findByTitle(title: string): Promise<StoredArticle | null>;
  create(input: ArticleWrite): Promise<StoredArticle>;
  update(id: string, expectedUpdatedAt: string, input: ArticleWrite): Promise<StoredArticle | null>;
  delete(id: string): Promise<boolean>;
}

export interface OperatorRepository {
  isOperator(userId: string): Promise<boolean>;
}

export interface ArticleEmbedding {
  embedding: number[];
  model: string;
}

export type GenerateArticleEmbedding = (title: string, body: string) => Promise<ArticleEmbedding | null>;

export function publicArticle(article: StoredArticle): Article {
  return {
    id: article.id, title: article.title, body: article.body,
    created_at: article.created_at, updated_at: article.updated_at,
  };
}
