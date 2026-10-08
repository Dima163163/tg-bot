import { REALTIME_POSTGRES_CHANGES_LISTEN_EVENT, REALTIME_SUBSCRIBE_STATES } from '@supabase/realtime-js';
import type { RealtimeChannel, RealtimeClient } from '@supabase/realtime-js';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getRealtimeClient } from '../../../shared/api/realtime-client';
import { getClientMessagesQueryKey } from './message';

let nextChannelId = 0;

export function useRealtimeMessages(clientId: number | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (clientId === null) return;

    let isActive = true;
    let realtimeClient: RealtimeClient | null = null;
    let channel: RealtimeChannel | null = null;

    try {
      realtimeClient = getRealtimeClient();
      const channelTopic = `messages:client-${clientId}:${++nextChannelId}`;

      channel = realtimeClient
        .channel(channelTopic, { config: {} })
        .on(
          'postgres_changes',
          {
            event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT,
            schema: 'public',
            table: 'messages',
            filter: `client_id=eq.${clientId}`,
          },
          () => {
            if (!isActive) return;
            void queryClient.invalidateQueries({
              queryKey: getClientMessagesQueryKey(clientId),
            });
          },
        )
        .subscribe((status, error) => {
          if (!isActive) return;
          if (
            status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
            status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
            status === REALTIME_SUBSCRIBE_STATES.CLOSED
          ) {
            console.error(
              `Supabase Realtime subscription failed for client ${clientId}: ${status}`,
              error,
            );
          }
        });
    } catch (error) {
      console.error(`Could not start Supabase Realtime for client ${clientId}`, error);
    }

    return () => {
      isActive = false;
      if (realtimeClient && channel) {
        void realtimeClient.removeChannel(channel);
      }
    };
  }, [clientId, queryClient]);
}
