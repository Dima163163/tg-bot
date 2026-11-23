import { createMcpHandler } from '@modelcontextprotocol/server';
import { pipeline } from '@supabase/middleware';
import { withOAuthProtectedResource, withSupabase } from '@supabase/server';
import { createArticleMcpServer } from './tools.ts';

export const articleMcpHandler = pipeline(
  [withOAuthProtectedResource(), withSupabase({ auth: 'user' })],
  (request, context) => createMcpHandler(() => createArticleMcpServer(context.userClaims?.id ?? null)).fetch(request),
);
