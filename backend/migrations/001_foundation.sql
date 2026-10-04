begin;
create table if not exists public.source_documents (
  name text primary key,
  payload jsonb not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);
create table if not exists public.migration_runs (
  id text primary key, source_checksum text not null unique,
  report jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.users (
  id text primary key, payload jsonb not null,
  password_hash text not null,
  email text not null,
  created_at timestamptz, updated_at timestamptz
);
create unique index if not exists users_email_unique on public.users(lower(email));
create table if not exists public.circles (
  id text primary key, user_id text not null references public.users(id) deferrable initially deferred,
  payload jsonb not null, created_at timestamptz, updated_at timestamptz
);
create table if not exists public.folders (
  id text primary key, user_id text not null references public.users(id) deferrable initially deferred,
  folder_id text references public.folders(id) deferrable initially deferred,
  payload jsonb not null, created_at timestamptz, updated_at timestamptz
);
-- Child content stays JSONB to preserve ordering, old question formats and
-- every field. These are projections; source_documents is the lossless source.
do $$
declare t text;
begin
  foreach t in array array['profiles','user_settings','uploaded_files','study_materials','flashcard_sets',
    'notes','flashcards','tests','games','ai_chats','ai_messages','community_materials',
    'circle_members','circle_join_requests','circle_invitations','circle_messages',
    'circle_materials','circle_activity','circle_game_results','friendships','friend_messages',
    'calendar_activities','schedules','notifications','cappy_state','planner_states',
    'tasks','expenses','subjects','attendance','announcements','admin_logs']
  loop
    execute format('create table if not exists public.%I (
      id text primary key,
      user_id text references public.users(id) deferrable initially deferred,
      folder_id text references public.folders(id) deferrable initially deferred,
      circle_id text references public.circles(id) deferrable initially deferred,
      payload jsonb not null,
      created_at timestamptz, updated_at timestamptz)', t);
    execute format('create index if not exists %I on public.%I(user_id)', t || '_user_idx', t);
    execute format('create index if not exists %I on public.%I(folder_id)', t || '_folder_idx', t);
    execute format('create index if not exists %I on public.%I(circle_id)', t || '_circle_idx', t);
  end loop;
end $$;
create index if not exists circles_creator_idx on public.circles(user_id);
create index if not exists folders_owner_idx on public.folders(user_id);
create unique index if not exists circle_members_unique on public.circle_members(circle_id,user_id);
alter table public.ai_messages add column if not exists chat_id text references public.ai_chats(id) deferrable initially deferred;
alter table public.circle_game_results add column if not exists material_id text references public.circle_materials(id) deferrable initially deferred;
create index if not exists ai_messages_chat_idx on public.ai_messages(chat_id);
create index if not exists circle_game_results_material_idx on public.circle_game_results(material_id);
create table if not exists public.migration_records (
  run_id text not null references public.migration_runs(id),
  table_name text not null, record_id text not null,
  primary key(run_id,table_name,record_id)
);
-- Backend JWTs are NOT Supabase Auth JWTs. No browser/client table access.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' and tablename in (
    'source_documents','migration_runs','migration_records','users','circles','folders',
    'profiles','user_settings','uploaded_files','study_materials','flashcard_sets','notes','flashcards','tests','games',
    'ai_chats','ai_messages','community_materials','circle_members','circle_join_requests','circle_invitations',
    'circle_messages','circle_materials','circle_activity','circle_game_results','friendships','friend_messages',
    'calendar_activities','schedules','notifications','cappy_state','planner_states','tasks','expenses','subjects',
    'attendance','announcements','admin_logs')
  loop
    execute format('alter table public.%I enable row level security',t.tablename);
    execute format('revoke all on public.%I from anon, authenticated',t.tablename);
    execute format('grant select, insert, update on public.%I to service_role',t.tablename);
  end loop;
end $$;
commit;
