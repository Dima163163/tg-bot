import '@supabase/functions-js/edge-runtime.d.ts';
import { handleKnowledgeAdminRequest } from './src/http/handler.ts';

export default { fetch: handleKnowledgeAdminRequest };
