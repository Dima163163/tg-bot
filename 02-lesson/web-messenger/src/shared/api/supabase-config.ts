const fallbackSupabaseUrl = 'https://cappgvetnxvjhnxufhkz.supabase.co';

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl).replace(/\/+$/, '');

export const supabaseApiKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
