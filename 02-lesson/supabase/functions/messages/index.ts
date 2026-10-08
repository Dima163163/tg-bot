import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

const DEFAULT_PAGE_SIZE = 7;
const MAX_PAGE_SIZE = 50;

interface MessageCursor {
  createdAt: string;
  id: number;
}

function encodeCursor(cursor: MessageCursor): string {
  return btoa(JSON.stringify(cursor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(value: string | null): MessageCursor | null {
  if (!value) return null;

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded)) as Partial<MessageCursor>;
    const date = new Date(parsed.createdAt ?? '');

    if (!Number.isInteger(parsed.id) || parsed.id <= 0 || Number.isNaN(date.getTime())) {
      return null;
    }

    return { createdAt: parsed.createdAt as string, id: parsed.id };
  } catch {
    return null;
  }
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'GET') {
      return Response.json({ message: 'Method not allowed' }, {
        status: 405, headers: { Allow: 'GET' },
      });
    }

    try {
      const url = new URL(req.url);
      const clientId = Number(url.searchParams.get('client_id'));
      const requestedPageSize = Number(url.searchParams.get('limit') ?? DEFAULT_PAGE_SIZE);
      const cursorValue = url.searchParams.get('cursor');
      const cursor = decodeCursor(cursorValue);

      if (!Number.isInteger(clientId) || clientId <= 0) {
        return Response.json({ message: 'client_id must be a positive integer' }, { status: 400 });
      }

      if (cursorValue && !cursor) {
        return Response.json({ message: 'cursor is invalid' }, { status: 400 });
      }

      const pageSize = Math.min(
        Math.max(Number.isFinite(requestedPageSize) ? Math.floor(requestedPageSize) : DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE,
      );

      let query = ctx.supabaseAdmin
        .from('messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize + 1);

      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const page = data ?? [];
      const hasMore = page.length > pageSize;
      const items = hasMore ? page.slice(0, pageSize) : page;
      const lastItem = items.at(-1);

      return Response.json({
        data: items,
        hasMore,
        nextCursor: hasMore && lastItem
          ? encodeCursor({ createdAt: lastItem.created_at, id: lastItem.id })
          : null,
      });
    } catch (error) {
      console.error('Failed to load messages', error);
      return Response.json({ message: 'Failed to load messages' }, { status: 500 });
    }
  }),
};
