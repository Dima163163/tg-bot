import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'GET') {
      return Response.json({ message: 'Method not allowed' }, {
        status: 405, headers: { Allow: 'GET' },
      });
    }

    try {
      const { data, error } = await ctx.supabaseAdmin.from('messages').select('*');
      if (error) throw error;
      return Response.json(data);
    } catch (error) {
      console.error('Failed to load messages', error);
      return Response.json({ message: 'Failed to load messages' }, { status: 500 });
    }
  }),
};
