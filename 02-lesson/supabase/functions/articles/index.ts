import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import { handleArticlesRequest } from './src/http/articles-handler.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, (request, context) =>
    handleArticlesRequest(request, context.userClaims?.id ?? null)),
};
