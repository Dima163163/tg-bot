import { env } from 'node:process';

export const knowledgeAdminAccess = {
  async valid(token: string): Promise<boolean> {
    const expected = env.RAG_ADMIN_TOKEN;
    if (!expected || token.length > 256) return false;
    const digest = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const [a, b] = await Promise.all([digest(token), digest(expected)]);
    const left = new Uint8Array(a);
    const right = new Uint8Array(b);
    let difference = 0;
    for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
    return difference === 0;
  },
};
