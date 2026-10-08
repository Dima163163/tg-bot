import { RealtimeClient } from '@supabase/realtime-js';
import { supabaseApiKey, supabaseUrl } from './supabase-config';

let realtimeClient: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (realtimeClient) {
    return realtimeClient;
  }

  if (!supabaseApiKey) {
    throw new Error('Укажите VITE_SUPABASE_PUBLISHABLE_KEY или VITE_SUPABASE_ANON_KEY в .env');
  }

  realtimeClient = new RealtimeClient(`${supabaseUrl}/realtime/v1`, {
    params: { apikey: supabaseApiKey },
  });

  return realtimeClient;
}
