import { callEdgeFunction } from '../../../shared/api/edge-functions';

export interface Client {
  id: number;
  created_at: string;
  user_telegram_id: string | null;
  first_name: string | null;
  last_name: string | null;
  last_message_at: string | null;
}

export async function getClients(): Promise<Client[]> {
  return callEdgeFunction<Client[]>('clients');
}
