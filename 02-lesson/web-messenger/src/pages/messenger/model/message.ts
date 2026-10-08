import { callEdgeFunction } from '../../../shared/api/edge-functions';

export const MESSAGE_PAGE_SIZE = 7;
export const messagesQueryKey = ['messages'] as const;

export function getClientMessagesQueryKey(clientId: number | null) {
  return [...messagesQueryKey, clientId] as const;
}

export interface Message {
  id: number;
  created_at: string;
  author: string | null;
  body: string | null;
  messenger_user_id: string | null;
  messenger_type: string | null;
  client_id: number;
  telegram_update_id: number | null;
}

export interface MessagePage {
  data: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface GetMessagesOptions {
  clientId: number;
  cursor: string | null;
  limit?: number;
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<Message>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.client_id === 'number' &&
    typeof candidate.created_at === 'string'
  );
}

interface LegacyCursor {
  kind: 'legacy';
  clientId: number;
  offset: number;
}

function encodeLegacyCursor(cursor: LegacyCursor): string {
  return btoa(JSON.stringify(cursor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeLegacyOffset(cursor: string | null, clientId: number): number {
  if (!cursor) return 0;

  try {
    const normalized = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded)) as Partial<LegacyCursor>;
    if (parsed.kind !== 'legacy' || parsed.clientId !== clientId || !Number.isInteger(parsed.offset)) return 0;
    return Math.max(0, parsed.offset ?? 0);
  } catch {
    return 0;
  }
}

function normalizeMessagePage(
  response: unknown,
  { clientId, cursor, limit }: GetMessagesOptions & { limit: number },
): MessagePage {
  if (!response || typeof response !== 'object') {
    return { data: [], hasMore: false, nextCursor: null };
  }

  if (Array.isArray(response)) {
    const allMessages = response
      .filter(isMessage)
      .filter((message) => message.client_id === clientId)
      .sort((a, b) => {
        const byDate = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return byDate || b.id - a.id;
      });
    const offset = decodeLegacyOffset(cursor, clientId);
    const data = allMessages.slice(offset, offset + limit);
    const nextOffset = offset + data.length;

    return {
      data,
      hasMore: nextOffset < allMessages.length,
      nextCursor: nextOffset < allMessages.length
        ? encodeLegacyCursor({ kind: 'legacy', clientId, offset: nextOffset })
        : null,
    };
  }

  const candidate = response as Partial<MessagePage>;
  const data = Array.isArray(candidate.data)
    ? candidate.data.filter(isMessage).filter((message) => message.client_id === clientId).slice(0, limit)
    : [];

  return {
    data,
    hasMore: candidate.hasMore === true,
    nextCursor: typeof candidate.nextCursor === 'string' ? candidate.nextCursor : null,
  };
}

export async function getMessages({ clientId, cursor, limit = MESSAGE_PAGE_SIZE }: GetMessagesOptions): Promise<MessagePage> {
  const params = new URLSearchParams({
    client_id: String(clientId),
    limit: String(limit),
  });

  if (cursor) params.set('cursor', cursor);

  const response = await callEdgeFunction<unknown>(`messages?${params.toString()}`);
  return normalizeMessagePage(response, { clientId, cursor, limit });
}
