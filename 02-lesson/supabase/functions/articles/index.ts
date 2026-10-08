import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

interface ArticleCursor {
  id: string;
}

function encodeCursor(cursor: ArticleCursor): string {
  return btoa(JSON.stringify(cursor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(value: string | null): ArticleCursor | null {
  if (!value) return null;

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded)) as Partial<ArticleCursor>;

    if (typeof parsed.id !== 'string' || !/^[1-9]\d*$/.test(parsed.id)) {
      return null;
    }

    return { id: parsed.id };
  } catch {
    return null;
  }
}

function parseArticleId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const id = String(value);
  return /^[1-9]\d*$/.test(id) ? id : null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await req.json();
    return isJsonObject(value) ? value : null;
  } catch {
    return null;
  }
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method === 'GET') {
      try {
        const url = new URL(req.url);
        const requestedPageSize = Number(url.searchParams.get('limit') ?? DEFAULT_PAGE_SIZE);
        const cursorValue = url.searchParams.get('cursor');
        const cursor = decodeCursor(cursorValue);

        if (cursorValue && !cursor) {
          return Response.json({ message: 'cursor is invalid' }, { status: 400 });
        }

        const pageSize = Math.min(
          Math.max(
            Number.isFinite(requestedPageSize) ? Math.floor(requestedPageSize) : DEFAULT_PAGE_SIZE,
            1,
          ),
          MAX_PAGE_SIZE,
        );

        let query = ctx.supabaseAdmin
          .from('articles')
          .select('id, title, body, created_at, updated_at')
          .order('id', { ascending: false })
          .limit(pageSize + 1);

        if (cursor) query = query.lt('id', cursor.id);

        const { data, error } = await query;
        if (error) throw error;

        const rows = data ?? [];
        const hasMore = rows.length > pageSize;
        const items = hasMore ? rows.slice(0, pageSize) : rows;
        const lastItem = items.at(-1);

        return Response.json({
          data: items,
          hasMore,
          nextCursor: hasMore && lastItem
            ? encodeCursor({ id: String(lastItem.id) })
            : null,
        });
      } catch (error) {
        console.error('Failed to load articles', error);
        return Response.json({ message: 'Failed to load articles' }, { status: 500 });
      }
    }

    if (req.method === 'POST') {
      const input = await readJsonObject(req);
      if (!input) {
        return Response.json({ message: 'Request body must be a JSON object' }, { status: 400 });
      }

      if (typeof input.title !== 'string' || !input.title.trim()) {
        return Response.json({ message: 'title must be a non-empty string' }, { status: 400 });
      }

      if (typeof input.body !== 'string') {
        return Response.json({ message: 'body must be a string' }, { status: 400 });
      }

      try {
        const { data, error } = await ctx.supabaseAdmin
          .from('articles')
          .insert({ title: input.title, body: input.body })
          .select('id, title, body, created_at, updated_at')
          .single();

        if (error) throw error;
        return Response.json(data, { status: 201 });
      } catch (error) {
        console.error('Failed to create article', error);
        return Response.json({ message: 'Failed to create article' }, { status: 500 });
      }
    }

    if (req.method === 'PATCH') {
      const input = await readJsonObject(req);
      if (!input) {
        return Response.json({ message: 'Request body must be a JSON object' }, { status: 400 });
      }

      const id = parseArticleId(input.id);
      if (!id) {
        return Response.json({ message: 'id must be a positive integer' }, { status: 400 });
      }

      if (typeof input.body !== 'string') {
        return Response.json({ message: 'body must be a string' }, { status: 400 });
      }

      try {
        const { data, error } = await ctx.supabaseAdmin
          .from('articles')
          .update({ body: input.body })
          .eq('id', id)
          .select('id, title, body, created_at, updated_at')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return Response.json({ message: 'Article not found' }, { status: 404 });
        }

        return Response.json(data);
      } catch (error) {
        console.error('Failed to update article', error);
        return Response.json({ message: 'Failed to update article' }, { status: 500 });
      }
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const id = parseArticleId(url.searchParams.get('id'));
      if (!id) {
        return Response.json({ message: 'id must be a positive integer' }, { status: 400 });
      }

      try {
        const { data, error } = await ctx.supabaseAdmin
          .from('articles')
          .delete()
          .eq('id', id)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return Response.json({ message: 'Article not found' }, { status: 404 });
        }

        return new Response(null, { status: 204 });
      } catch (error) {
        console.error('Failed to delete article', error);
        return Response.json({ message: 'Failed to delete article' }, { status: 500 });
      }
    }

    return Response.json({ message: 'Method not allowed' }, {
      status: 405,
      headers: { Allow: 'GET, POST, PATCH, DELETE' },
    });
  }),
};
