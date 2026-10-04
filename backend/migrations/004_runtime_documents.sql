begin;
create or replace function public.commit_studyante_documents(p_namespace text,p_changes jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c jsonb; k text; current_checksum text;
begin
  if p_namespace is null or (p_namespace<>'' and p_namespace !~ '^synthetic_[a-z0-9_]+$') then raise exception 'Invalid namespace'; end if;
  perform pg_advisory_xact_lock(73423001);
  for c in select value from jsonb_array_elements(p_changes) loop
    if c->>'name' is null or c->>'name' <> all(array['users.json','index.json','chats.json','admin-logs.json','announcements.json','cappy-friends.json','study-circles.json']) then raise exception 'Invalid document'; end if;
    if c->>'checksum' is null or c->>'checksum' !~ '^[a-f0-9]{64}$' or not (c ? 'payload') then raise exception 'Invalid checksum or payload'; end if;
    k:=case when p_namespace='' then c->>'name' else p_namespace || '/' || (c->>'name') end;
    select checksum into current_checksum from source_documents where name=k for update;
    if current_checksum is distinct from (c->>'expectedChecksum') then raise exception 'Concurrent document change'; end if;
    insert into source_documents(name,payload,checksum) values(k,c->'payload',c->>'checksum')
    on conflict(name) do update set payload=excluded.payload,checksum=excluded.checksum,updated_at=now();
  end loop;
end $$;
revoke all on function public.commit_studyante_documents(text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_studyante_documents(text,jsonb) to service_role;
commit;
