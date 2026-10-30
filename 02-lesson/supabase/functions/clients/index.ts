import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'GET') {
      return Response.json({ message: 'Method not allowed' }, {
        status: 405, headers: { Allow: 'GET' },
      });
    }

    try {
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ message: 'Unauthorized' }, { status: 401 });

      const { data: operator, error: operatorError } = await ctx.supabaseAdmin
        .from('panel_operators').select('id').eq('user_id', userId).maybeSingle();
      if (operatorError) throw operatorError;
      if (!operator) return Response.json({ message: 'Operator access required' }, { status: 403 });

      const { data, error } = await ctx.supabaseAdmin.from('clients').select('*').order('created_at', {ascending: false});
      if (error) throw error;
      return Response.json(data);
    } catch (error) {
      console.error('Failed to load clients', error);
      return Response.json({ message: 'Failed to load clients' }, { status: 500 });
    }
  }),
};
