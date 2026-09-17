BEGIN;

INSERT INTO public.clients (
    user_telegram_id,
    first_name,
    last_name,
    last_message_at
)
SELECT
    messenger_user_id,
    NULLIF(
            split_part(
                    regexp_replace(trim(author), '\s+', ' ', 'g'),
                    ' ',
                    1
            ),
            ''
    ),
    CASE
        WHEN regexp_replace(trim(author), '\s+', ' ', 'g') LIKE '% %'
            THEN NULLIF(
                substring(
                        regexp_replace(trim(author), '\s+', ' ', 'g')
                        FROM position(
                                     ' ' IN regexp_replace(trim(author), '\s+', ' ', 'g')
                             ) + 1
                ),
                ''
                 )
        ELSE NULL
        END,
    created_at AT TIME ZONE 'UTC'
FROM (
         SELECT DISTINCT ON (messenger_user_id)
             messenger_user_id,
             author,
             created_at
         FROM public.messages
         WHERE messenger_type = 'telegram'
           AND messenger_user_id IS NOT NULL
           AND messenger_user_id <> ''
         ORDER BY
             messenger_user_id,
             created_at DESC,
             id DESC
     ) AS latest_messages;

COMMIT;