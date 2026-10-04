begin;
create or replace function public.import_studyante_bundle(p_bundle jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb; d jsonb; t text; existing jsonb; migrated integer:=0; skipped integer:=0;
begin
  perform pg_advisory_xact_lock(73423001);
  if p_bundle->>'sourceChecksum' !~ '^[a-f0-9]{64}$' or p_bundle->>'id' is null then raise exception 'Invalid migration identity'; end if;
  if exists(select 1 from migration_runs where id=p_bundle->>'id' and source_checksum<>p_bundle->>'sourceChecksum') then raise exception 'Migration identity conflict'; end if;
  insert into migration_runs(id,source_checksum,report) values(p_bundle->>'id',p_bundle->>'sourceChecksum',p_bundle->'report') on conflict(id) do nothing;
  for d in select value from jsonb_array_elements(p_bundle->'documents') loop
    select payload into existing from source_documents where name=d->>'name';
    if found and existing is distinct from d->'payload' then raise exception 'Existing source document differs'; end if;
    insert into source_documents(name,payload,checksum) values(d->>'name',d->'payload',d->>'checksum') on conflict(name) do nothing;
  end loop;
  for r in select value from jsonb_array_elements(p_bundle->'records') loop
    t:=r->>'table';
    if t <> all(array['users','circles','folders','profiles','user_settings','uploaded_files','study_materials',
      'flashcard_sets','notes','flashcards','tests','games','ai_chats','ai_messages','community_materials',
      'circle_members','circle_join_requests','circle_invitations','circle_messages','circle_materials',
      'circle_activity','circle_game_results','friendships','friend_messages','calendar_activities','schedules',
      'notifications','cappy_state','planner_states','tasks','expenses','subjects','attendance','announcements','admin_logs']) or t is null then
      raise exception 'Unsupported projection table';
    end if;
    execute format('select payload from public.%I where id=$1',t) into existing using r->>'id';
    if existing is not null then
      if existing is distinct from r->'payload' then raise exception 'Existing record differs'; end if;
      skipped:=skipped+1;
    else
      if t='users' then
        execute 'insert into users(id,payload,password_hash,email,created_at,updated_at) values($1,$2,$3,$4,$5,$6)'
          using r->>'id',r->'payload',r->'payload'->>'password',r->'payload'->>'email',(r->>'createdAt')::timestamptz,(r->>'updatedAt')::timestamptz;
      elsif t='circles' then
        execute 'insert into circles(id,user_id,payload,created_at,updated_at) values($1,$2,$3,$4,$5)'
          using r->>'id',r->>'userId',r->'payload',(r->>'createdAt')::timestamptz,(r->>'updatedAt')::timestamptz;
      elsif t='folders' then
        execute 'insert into folders(id,user_id,folder_id,payload,created_at,updated_at) values($1,$2,$3,$4,$5,$6)'
          using r->>'id',r->>'userId',r->>'folderId',r->'payload',(r->>'createdAt')::timestamptz,(r->>'updatedAt')::timestamptz;
      else
        execute format('insert into public.%I(id,user_id,folder_id,circle_id,payload,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7)',t)
          using r->>'id',r->>'userId',r->>'folderId',r->>'circleId',r->'payload',(r->>'createdAt')::timestamptz,(r->>'updatedAt')::timestamptz;
      end if;
      migrated:=migrated+1;
    end if;
    if t='ai_messages' then update ai_messages set chat_id=r->'payload'->>'chatId' where id=r->>'id'; end if;
    if t='circle_game_results' then update circle_game_results set material_id=r->'payload'->>'materialId' where id=r->>'id'; end if;
    insert into migration_records(run_id,table_name,record_id) values(p_bundle->>'id',t,r->>'id') on conflict do nothing;
  end loop;
  return jsonb_build_object('migrated',migrated,'skipped',skipped,'failed',0);
end $$;
create or replace function public.replace_source_document(p_name text,p_payload jsonb,p_expected_checksum text,p_checksum text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_checksum !~ '^[a-f0-9]{64}$' then raise exception 'Invalid checksum'; end if;
  update source_documents set payload=p_payload,checksum=p_checksum,updated_at=now()
    where name=p_name and checksum=p_expected_checksum;
  if not found then raise exception 'Concurrent document update or missing document'; end if;
end $$;
revoke all on function public.import_studyante_bundle(jsonb) from public, anon, authenticated;
revoke all on function public.replace_source_document(text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.import_studyante_bundle(jsonb) to service_role;
grant execute on function public.replace_source_document(text,jsonb,text,text) to service_role;
commit;
