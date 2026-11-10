-- Run after the article embeddings migration in a dedicated managed test project.
-- Invoke with psql -v ON_ERROR_STOP=1 -f supabase/tests/article-embeddings-test.sql.
-- Test rows are rolled back. PostgreSQL identity sequences can still advance.
begin;
set local role service_role;
-- Keep assertions deterministic even if the test project has other models/data.
-- HNSW recall and query plans need a separate check on representative real data.
set local enable_indexscan = off;

do $$
declare
  model_id text := '__article_embeddings_test_' || txid_current();
  query_vector extensions.vector :=
    (array[1::real] || array_fill(0::real, array[383]))::extensions.vector;
  other_vector extensions.vector :=
    (array[0::real, 1::real] || array_fill(0::real, array[382]))::extensions.vector;
  zero_vector extensions.vector := array_fill(0::real, array[384])::extensions.vector;
  first_id bigint;
  second_id bigint;
  pending_id bigint;
  foreign_model_id bigint;
  first_result record;
  test_row public.articles%rowtype;
  invalid_count integer;
  invalid_threshold double precision;
begin
  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_index i on i.indexrelid = c.oid
    join pg_catalog.pg_am am on am.oid = c.relam
    where c.oid = 'public.articles_embedding_hnsw_idx'::regclass
      and am.amname = 'hnsw' and i.indisvalid
  ) then
    raise exception 'The HNSW index must exist and be valid';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.articles'::regclass) then
    raise exception 'Articles must have RLS enabled';
  end if;
  if (select prosecdef from pg_catalog.pg_proc
    where oid = 'public.search_articles(extensions.vector,text,integer,double precision)'::regprocedure) then
    raise exception 'Search must use SECURITY INVOKER';
  end if;

  insert into public.articles (title, body)
    values ('Pending article', 'Editable without an embedding') returning id into pending_id;
  select * into strict test_row from public.articles where id = pending_id;
  if test_row.embedding is not null or test_row.embedding_model is not null then
    raise exception 'Existing article INSERT contract must allow NULL embedding metadata';
  end if;

  insert into public.articles (title, body, embedding, embedding_model)
    values ('Closest article', 'First body', query_vector, model_id) returning id into first_id;
  insert into public.articles (title, body, embedding, embedding_model)
    values ('Orthogonal article', 'Second body', other_vector, model_id) returning id into second_id;
  insert into public.articles (title, body, embedding, embedding_model)
    values ('Another model', 'Must be excluded', query_vector, model_id || '_other')
    returning id into foreign_model_id;

  select * into strict first_result
  from public.search_articles(query_vector, model_id, 1, -1);
  if first_result.id <> first_id or abs(first_result.similarity - 1) > 0.00001 then
    raise exception 'Search must return the closest article and cosine similarity';
  end if;
  if (select count(*) from public.search_articles(query_vector, model_id, 20, -1)) <> 2 then
    raise exception 'Search must exclude other models and articles without embeddings';
  end if;
  if (select count(*) from public.search_articles(query_vector, model_id, 20, 0.5)) <> 1 then
    raise exception 'Similarity threshold must exclude the orthogonal vector';
  end if;

  begin
    update public.articles set embedding = '[1,2,3]'::extensions.vector where id = first_id;
    raise exception 'A vector with the wrong dimension was accepted';
  exception when data_exception then null;
  end;
  begin
    update public.articles set body = 'Rejected update', embedding = zero_vector
      where id = first_id;
    raise exception 'A zero embedding was accepted';
  exception when check_violation then null;
  end;
  select * into strict test_row from public.articles where id = first_id;
  if test_row.body <> 'First body'
    or test_row.embedding::text is distinct from query_vector::text then
    raise exception 'A rejected embedding update must leave the original content and vector intact';
  end if;
  begin
    update public.articles set embedding_model = null where id = first_id;
    raise exception 'An embedding without its model was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.search_articles('[1,2,3]'::extensions.vector, model_id);
    raise exception 'RPC accepted the wrong vector dimension';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.search_articles(zero_vector, model_id);
    raise exception 'RPC accepted a zero query vector';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.search_articles(null, model_id);
    raise exception 'RPC accepted a NULL query vector';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.search_articles(query_vector, ' ');
    raise exception 'RPC accepted a blank model';
  exception when invalid_parameter_value then null;
  end;

  foreach invalid_count in array array[0, 21, null::integer] loop
    begin
      perform public.search_articles(query_vector, model_id, invalid_count);
      raise exception 'RPC accepted an invalid result count';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  foreach invalid_threshold in array array[-2::double precision, 2, 'NaN', null] loop
    begin
      perform public.search_articles(query_vector, model_id, 5, invalid_threshold);
      raise exception 'RPC accepted an invalid similarity threshold';
    exception when invalid_parameter_value then null;
    end;
  end loop;

  update public.articles set body = body, title = title where id = first_id;
  select * into strict test_row from public.articles where id = first_id;
  if test_row.embedding is null then
    raise exception 'Saving unchanged content must preserve its embedding';
  end if;

  update public.articles set title = 'Changed title', body = 'Changed body',
    embedding = other_vector, embedding_model = model_id || '_updated'
    where id = first_id;
  select * into strict test_row from public.articles where id = first_id;
  if test_row.title <> 'Changed title' or test_row.body <> 'Changed body'
    or test_row.embedding::text is distinct from other_vector::text
    or test_row.embedding_model is distinct from model_id || '_updated' then
    raise exception 'One UPDATE must preserve the new content, embedding and model together';
  end if;
  if not exists (
    select 1 from public.search_articles(other_vector, model_id || '_updated', 5, 0.9)
    where id = first_id
  ) then
    raise exception 'The new embedding must immediately be searchable with its model';
  end if;
  update public.articles set title = 'Text-only update' where id = first_id;
  select * into strict test_row from public.articles where id = first_id;
  if test_row.embedding::text is distinct from other_vector::text
    or test_row.embedding_model is distinct from model_id || '_updated' then
    raise exception 'The database must not automatically clear embedding metadata on text changes';
  end if;

  delete from public.articles where id in (first_id, second_id);
  if exists (select 1 from public.search_articles(query_vector, model_id))
    or exists (select 1 from public.search_articles(other_vector, model_id || '_updated')) then
    raise exception 'Deleted articles must not be searchable';
  end if;

  if has_function_privilege('anon',
    'public.search_articles(extensions.vector,text,integer,double precision)', 'execute')
    or has_function_privilege('authenticated',
    'public.search_articles(extensions.vector,text,integer,double precision)', 'execute') then
    raise exception 'Search RPC must only be callable by the server';
  end if;
  if has_table_privilege('anon', 'public.articles', 'select')
    or has_table_privilege('authenticated', 'public.articles', 'select') then
    raise exception 'Articles must not be directly readable by public clients';
  end if;
end;
$$;

rollback;
select 'Article embedding checks passed; test rows rolled back' as result;
