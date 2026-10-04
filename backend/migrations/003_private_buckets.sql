begin;
-- Never convert an existing public bucket in place without investigating it.
do $$ begin
  if exists(select 1 from storage.buckets where id in ('documents','images','circle-files','attachments','profile-images','migration-archive') and public) then
    raise exception 'Existing bucket is public; review before migration';
  end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit)
values ('documents','documents',false,20971520),('images','images',false,20971520),
 ('circle-files','circle-files',false,20971520),('attachments','attachments',false,20971520),
 ('profile-images','profile-images',false,10485760),('migration-archive','migration-archive',false,null)
on conflict(id) do nothing;
-- No anon/authenticated policies: the backend's service-role credentials
-- authorize each owner/member before download/signing. Do not add public read.
commit;
