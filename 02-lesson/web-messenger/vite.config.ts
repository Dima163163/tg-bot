import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createAuthApi } from '../server/auth-api.mjs';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const createMiddleware = () => createAuthApi({
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://cappgvetnxvjhnxufhkz.supabase.co',
    apiKey: env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    cookieSecret: env.AUTH_COOKIE_SECRET,
    secureCookie: env.AUTH_COOKIE_SECURE === 'true',
  });

  return {
    root: 'web-messenger',
    envDir: '..',
    plugins: [
      react(),
      {
        name: 'web-messenger-auth-api',
        configureServer(server) {
          server.middlewares.use('/api', createMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api', createMiddleware());
        },
      },
    ],
  };
});
