import type { IncomingMessage, ServerResponse } from 'node:http';

export interface AuthApiOptions {
  supabaseUrl: string;
  apiKey: string | undefined;
  cookieSecret: string | undefined;
  secureCookie: boolean;
}

export function createAuthApi(options: AuthApiOptions): (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void>;
