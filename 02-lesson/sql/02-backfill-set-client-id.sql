BEGIN;

UPDATE public.messages AS m
SET client_id = c.id
    FROM public.clients AS c
WHERE m.messenger_type = 'telegram'
  AND m.messenger_user_id IS NOT NULL
  AND m.messenger_user_id <> ''
  AND c.user_telegram_id = m.messenger_user_id
  AND m.client_id IS NULL;

COMMIT;