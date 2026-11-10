import '@supabase/functions-js/edge-runtime.d.ts';
import { handleWebhookRequest } from './src/http/webhook-handler.ts';

export default { fetch: handleWebhookRequest };
