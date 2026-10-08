import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Client } from './model/client';
import { getClients } from './model/client';
import type { Message } from './model/message';
import { getClientMessagesQueryKey, getMessages, messagesQueryKey } from './model/message';
import { useMessengerStore } from './model/store';
import { useRealtimeMessages } from './model/use-realtime-messages';
import { Avatar, AvatarFallback } from '../../shared/ui/avatar';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { ScrollArea } from '../../shared/ui/scroll-area';
import { Separator } from '../../shared/ui/separator';
import './messenger.css';

const clientsQueryKey = ['clients'] as const;

function clientName(client: Client): string {
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ').trim();
  return name || client.user_telegram_id || 'Без имени';
}

function clientInitials(client: Client): string {
  const initials = [client.first_name, client.last_name]
    .filter(Boolean)
    .map((part) => part?.[0]?.toUpperCase())
    .join('');
  return initials || '??';
}

function formatDate(value: string | null, withDate = false): string {
  if (!value) return 'Нет сообщений';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Недавно';
  return new Intl.DateTimeFormat('ru-RU', {
    day: withDate ? '2-digit' : undefined,
    month: withDate ? 'short' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function initialsFromAuthor(author: string | null): string {
  if (!author) return 'TG';
  return author.replace(/^@/, '').slice(0, 2).toUpperCase();
}

function isBotMessage(message: Message): boolean {
  return message.messenger_type === 'telegram_bot';
}

export function MessengerPage() {
  const queryClient = useQueryClient();
  const selectedClientId = useMessengerStore((state) => state.selectedClientId);
  useRealtimeMessages(selectedClientId);
  const selectClient = useMessengerStore((state) => state.selectClient);
  const search = useMessengerStore((state) => state.search);
  const setSearch = useMessengerStore((state) => state.setSearch);
  const newMessagesCount = useMessengerStore((state) => state.newMessagesCount);
  const addNewMessages = useMessengerStore((state) => state.addNewMessages);
  const clearNewMessages = useMessengerStore((state) => state.clearNewMessages);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null);
  const ignoreScrollRef = useRef(false);
  const hasUserScrolledRef = useRef(false);
  const shouldScrollToBottomRef = useRef(true);
  const scrollToBottomAfterFetchRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const latestMessageRef = useRef<{ clientId: number | null; messageId: number | null }>({
    clientId: null,
    messageId: null,
  });

  const clientsQuery = useQuery({
    queryKey: clientsQueryKey,
    queryFn: getClients,
    refetchInterval: 30_000,
  });
  const messagesQuery = useInfiniteQuery({
    queryKey: getClientMessagesQueryKey(selectedClientId),
    queryFn: ({ pageParam }) => {
      if (selectedClientId === null) throw new Error('Клиент не выбран');
      return getMessages({ clientId: selectedClientId, cursor: pageParam });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: selectedClientId !== null,
    refetchInterval: 30_000,
  });

  const clients = clientsQuery.data ?? [];
  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('ru-RU');
    if (!normalizedSearch) return clients;

    return clients.filter((client) =>
      [clientName(client), client.user_telegram_id]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase('ru-RU').includes(normalizedSearch)),
    );
  }, [clients, search]);

  useEffect(() => {
    if (selectedClientId === null && clients[0]) {
      selectClient(clients[0].id);
    }
  }, [clients, selectClient, selectedClientId]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const messages = useMemo(
    () =>
      (messagesQuery.data?.pages.flatMap((page) => page.data) ?? [])
        .filter((message) => message.client_id === selectedClientId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messagesQuery.data, selectedClientId],
  );

  useLayoutEffect(() => {
    shouldScrollToBottomRef.current = true;
    restoreScrollRef.current = null;
    scrollToBottomAfterFetchRef.current = false;
    isNearBottomRef.current = true;
    hasUserScrolledRef.current = false;
    latestMessageRef.current = { clientId: selectedClientId, messageId: null };
    clearNewMessages();
  }, [selectedClientId]);

  const latestMessageId = messages.at(-1)?.id ?? null;

  useEffect(() => {
    if (selectedClientId === null || latestMessageId === null) return;

    const previous = latestMessageRef.current;
    if (previous.clientId !== selectedClientId) {
      latestMessageRef.current = { clientId: selectedClientId, messageId: latestMessageId };
      return;
    }

    const previousMessageId = previous.messageId;
    if (previousMessageId !== null && latestMessageId > previousMessageId) {
      const newMessages = messages.filter((message) => message.id > previousMessageId).length;
      if (isNearBottomRef.current) {
        shouldScrollToBottomRef.current = true;
        clearNewMessages();
      } else {
        addNewMessages(Math.max(newMessages, 1));
      }
    }

    latestMessageRef.current = { clientId: selectedClientId, messageId: latestMessageId };
  }, [addNewMessages, clearNewMessages, latestMessageId, messages, selectedClientId]);

  function scrollToBottom(behavior: ScrollBehavior) {
    const element = messagesScrollRef.current;
    if (!element) return;

    ignoreScrollRef.current = true;
    element.scrollTo({ top: element.scrollHeight, behavior });
    requestAnimationFrame(() => {
      ignoreScrollRef.current = false;
    });
  }

  useLayoutEffect(() => {
    const element = messagesScrollRef.current;
    if (!element || messages.length === 0) return;

    if (
      scrollToBottomAfterFetchRef.current &&
      !messagesQuery.isFetching &&
      !messagesQuery.isPending
    ) {
      restoreScrollRef.current = null;
      scrollToBottomAfterFetchRef.current = false;
      shouldScrollToBottomRef.current = false;
      scrollToBottom('smooth');
      return;
    }

    const previousScroll = restoreScrollRef.current;
    if (previousScroll) {
      ignoreScrollRef.current = true;
      element.scrollTop = previousScroll.top + (element.scrollHeight - previousScroll.height);
      restoreScrollRef.current = null;
      requestAnimationFrame(() => {
        ignoreScrollRef.current = false;
      });
      return;
    }

    if (shouldScrollToBottomRef.current) {
      scrollToBottom('auto');
      shouldScrollToBottomRef.current = false;
    }
  }, [messages.length, messagesQuery.data, messagesQuery.isFetchingNextPage, messagesQuery.isPending, selectedClientId]);

  function handleMessagesScroll() {
    const element = messagesScrollRef.current;
    if (!element) return;

    isNearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    if (
      ignoreScrollRef.current ||
      !hasUserScrolledRef.current ||
      element.scrollHeight <= element.clientHeight ||
      element.scrollTop > 72 ||
      !messagesQuery.hasNextPage ||
      messagesQuery.isFetchingNextPage ||
      messagesQuery.isPending
    ) {
      return;
    }

    restoreScrollRef.current = { height: element.scrollHeight, top: element.scrollTop };
    void messagesQuery.fetchNextPage().catch(() => {
      restoreScrollRef.current = null;
    });
  }

  function markUserScroll() {
    hasUserScrolledRef.current = true;
  }

  function showNewMessages() {
    clearNewMessages();
    restoreScrollRef.current = null;
    shouldScrollToBottomRef.current = true;
    hasUserScrolledRef.current = false;

    if (messagesQuery.isFetching) {
      scrollToBottomAfterFetchRef.current = true;
      return;
    }

    scrollToBottom('smooth');
    shouldScrollToBottomRef.current = false;
  }

  function refreshData() {
    void queryClient.invalidateQueries({ queryKey: clientsQueryKey });
    void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
  }

  return (
    <main className="messenger-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <p className="eyebrow">Telegram inbox</p>
            <h1>Диалоги</h1>
          </div>
        </div>
        <nav className="app-navigation" aria-label="Основная навигация">
          <Link activeProps={{ 'aria-current': 'page' }} className="app-nav-link" to="/">Диалоги</Link>
          <Link activeProps={{ 'aria-current': 'page' }} className="app-nav-link" to="/articles">Статьи</Link>
        </nav>
        <Button className="refresh-button" onClick={refreshData} type="button" variant="outline" size="sm" aria-label="Обновить диалоги">
          <span aria-hidden="true">↻</span>
          Обновить
        </Button>
      </header>

      <section className="messenger-grid" aria-label="Сообщения клиентов">
        <aside className="clients-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Входящие</p>
              <h2>Клиенты <span>{clients.length}</span></h2>
            </div>
            <Badge className="live-indicator"><i /> live</Badge>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти клиента" aria-label="Найти клиента" />
          </label>
          <ScrollArea className="client-list" aria-label="Список клиентов">
            {clientsQuery.isPending && <div className="state-message">Загружаю клиентов…</div>}
            {clientsQuery.isError && <div className="state-message error-state">{clientsQuery.error.message}</div>}
            {!clientsQuery.isPending && !clientsQuery.isError && filteredClients.length === 0 && (
              <div className="state-message">Клиенты не найдены</div>
            )}
            {filteredClients.map((client) => (
              <Button
                className={`client-row ${selectedClientId === client.id ? 'is-selected' : ''}`}
                key={client.id}
                onClick={() => selectClient(client.id)}
                type="button"
              >
                <Avatar className="avatar"><AvatarFallback>{clientInitials(client)}</AvatarFallback></Avatar>
                <span className="client-copy">
                  <strong>{clientName(client)}</strong>
                  <small>{client.last_message_at ? formatDate(client.last_message_at) : 'Новый клиент'}</small>
                </span>
                <span className="row-arrow" aria-hidden="true">›</span>
              </Button>
            ))}
          </ScrollArea>
          <p className="panel-footer">Обновляется автоматически · 30 сек</p>
        </aside>

        <section className="conversation-panel" aria-label="Выбранный диалог">
          {!selectedClient && (
            <div className="empty-conversation">
              <div className="empty-icon" aria-hidden="true">✦</div>
              <h2>Выберите диалог</h2>
              <p>Здесь появится история сообщений выбранного клиента.</p>
            </div>
          )}
          {selectedClient && (
            <>
              <header className="conversation-header">
                <div className="conversation-person">
                  <Avatar className="avatar avatar-large"><AvatarFallback>{clientInitials(selectedClient)}</AvatarFallback></Avatar>
                  <div>
                    <h2>{clientName(selectedClient)}</h2>
                    <p>{selectedClient.user_telegram_id ? `Telegram ID ${selectedClient.user_telegram_id}` : 'Telegram'}</p>
                  </div>
                </div>
                <div className="conversation-meta">
                  <span className="status-dot" />
                  <span>в сети</span>
                </div>
              </header>
              <ScrollArea
                className="messages-scroll"
                onKeyDown={markUserScroll}
                onPointerDown={markUserScroll}
                onScroll={handleMessagesScroll}
                onTouchMove={markUserScroll}
                onWheel={markUserScroll}
                ref={messagesScrollRef}
              >
                <div className="day-divider"><Separator /><span>История переписки</span><Separator /></div>
                {messagesQuery.isPending && <div className="state-message">Загружаю сообщения…</div>}
                {messagesQuery.isError && <div className="state-message error-state">{messagesQuery.error.message}</div>}
                {messagesQuery.isFetchingNextPage && <div className="older-loading">Загружаю более старые сообщения…</div>}
                {!messagesQuery.isPending && !messagesQuery.isError && messages.length === 0 && (
                  <div className="state-message">Сообщений пока нет</div>
                )}
                {messages.map((message: Message) => (
                  <article className={`message-row ${isBotMessage(message) ? 'is-bot' : ''}`} key={message.id}>
                    <span className="message-avatar">{isBotMessage(message) ? 'BOT' : initialsFromAuthor(message.author)}</span>
                    <div className="message-bubble">
                      <div className="message-topline">
                        <strong>{isBotMessage(message) ? 'Бот' : message.author ? `@${message.author.replace(/^@/, '')}` : 'Клиент'}</strong>
                        <time dateTime={message.created_at}>{formatDate(message.created_at, true)}</time>
                      </div>
                      <p>{message.body || 'Сообщение без текста'}</p>
                    </div>
                  </article>
                ))}
              </ScrollArea>
              {newMessagesCount > 0 && (
                <button className="new-messages-badge" onClick={showNewMessages} type="button">
                  <span aria-hidden="true">↓</span>
                  {newMessagesCount > 99 ? '99+' : newMessagesCount}
                  <span className="sr-only">новых сообщений</span>
                </button>
              )}
              <div className="conversation-note"><span>⌁</span> Сообщения поступают через Telegram webhook</div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
