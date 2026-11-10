-- One row in articles is one manually prepared knowledge chunk.
-- Existing articles remain editable and are searchable after embedding generation.
begin;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

-- IF NOT EXISTS does not relocate an already installed extension.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector' and n.nspname = 'extensions'
  ) then
    raise exception 'The vector extension must be installed in the extensions schema'
      using errcode = '55000',
        hint = 'Check the existing vector extension schema before applying this migration.';
  end if;
end;
$$;

alter table public.articles
  add column embedding extensions.vector(384),
  add column embedding_model text,
  add constraint articles_embedding_metadata_check check (
    (embedding is null and embedding_model is null)
    or (
      embedding is not null
      and embedding_model is not null
      and embedding_model = btrim(embedding_model)
      and embedding_model <> ''
    )
  ),
  add constraint articles_embedding_nonzero_check check (
    embedding is null or extensions.vector_norm(embedding) > 0
  );

comment on column public.articles.embedding is
  '384-dimensional embedding of this article. NULL means it is not searchable yet.';
comment on column public.articles.embedding_model is
  'Embedding model/configuration ID. Must match the model used for the query vector.';

create index articles_embedding_hnsw_idx
  on public.articles using hnsw (embedding extensions.vector_cosine_ops);

-- The external writer generates an embedding from the new title/body first,
-- then saves the content, embedding and model together in a single UPDATE.

-- PostgreSQL function signatures do not enforce vector type modifiers.
-- Validate dimensions explicitly even though the column itself is vector(384).
create function public.search_articles(
  query_embedding extensions.vector,
  query_embedding_model text,
  match_count integer default 5,
  min_similarity double precision default -1.0
)
returns table (
  id bigint,
  title text,
  body text,
  similarity double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if query_embedding is null
    or extensions.vector_dims(query_embedding) <> 384
    or extensions.vector_norm(query_embedding) = 0 then
    raise exception 'query_embedding must be a nonzero vector with 384 dimensions'
      using errcode = '22023';
  end if;

  if query_embedding_model is null
    or query_embedding_model = ''
    or query_embedding_model <> btrim(query_embedding_model) then
    raise exception 'query_embedding_model must be a non-empty trimmed model identifier'
      using errcode = '22023';
  end if;

  if match_count is null or match_count not between 1 and 20 then
    raise exception 'match_count must be between 1 and 20'
      using errcode = '22023';
  end if;

  if min_similarity is null or min_similarity not between -1.0 and 1.0 then
    raise exception 'min_similarity must be between -1 and 1'
      using errcode = '22023';
  end if;

  return query
  select
    a.id,
    a.title,
    a.body,
    1.0 - (a.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.articles a
  where a.embedding is not null
    and a.embedding_model = query_embedding_model
    and (a.embedding operator(extensions.<=>) query_embedding) <= 1.0 - min_similarity
  -- Keep the raw distance in ORDER BY so the HNSW index is usable.
  order by a.embedding operator(extensions.<=>) query_embedding
  limit match_count;
end;
$$;

comment on function public.search_articles(extensions.vector, text, integer, double precision) is
  'Server-only cosine search of article chunks. Default threshold -1 applies no relevance cutoff; tune it on real questions. HNSW results are approximate.';

alter table public.articles enable row level security;
revoke all on table public.articles from public, anon, authenticated;
grant select, insert, update, delete on table public.articles to service_role;
grant usage on schema extensions to service_role;

revoke all on function public.search_articles(extensions.vector, text, integer, double precision)
  from public, anon, authenticated;
grant execute on function public.search_articles(extensions.vector, text, integer, double precision)
  to service_role;

commit;
