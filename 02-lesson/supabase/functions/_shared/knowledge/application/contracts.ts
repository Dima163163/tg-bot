export class KnowledgeError extends Error {
  readonly code: 'CONFIGURATION' | 'PROVIDER' | 'INVALID_INPUT' | 'INVALID_OUTPUT' | 'STORAGE' | 'FORBIDDEN';
  constructor(code: KnowledgeError['code'], message: string) {
    super(message);
    this.name = 'KnowledgeError';
    this.code = code;
  }
}
export interface KnowledgeSource { id: number; title: string; body: string; similarity: number; }
export interface KnowledgeVector { embedding: number[]; model: string; }
