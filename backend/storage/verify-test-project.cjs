// Explicit manual integration check. Private config and reports stay outside Git.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const configRoot=path.join(os.homedir(),'STUDYante-private-config');
const {Client}=require(path.join(configRoot,'verification-tools/node_modules/pg'));
const config=require('../node_modules/dotenv').parse(fs.readFileSync(path.join(configRoot,'supabase-test.env')));
const namespace='synthetic_parity_'+Date.now().toString(36);
const reportRoot=path.join(os.homedir(),'STUDYante-private-reports','backend-parity-'+new Date().toISOString().replace(/[:.]/g,'-'));
const report={passed:false,syntheticNamespace:namespace};let client,repository,before;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeFail=code=>Object.assign(new Error(code),{safeCode:code});
async function snapshot(){
  const tables=(await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  const counts={},fingerprints={};
  for(const {tablename:t}of tables){if(!/^[a-z_]+$/.test(t))throw safeFail('UNEXPECTED_TABLE');
    const rows=(await client.query(`select to_jsonb(t) as data from public."${t}" t order by to_jsonb(t)::text`)).rows;
    counts[t]=rows.length;fingerprints[t]=digest(rows);
  }
  const objects=(await client.query('select bucket_id,name,metadata from storage.objects order by bucket_id,name')).rows;
  const archives=[];
  for(const o of objects.filter(o=>o.bucket_id==='migration-archive')){
    const response=await fetch(config.SUPABASE_URL+'/storage/v1/object/authenticated/'+o.bucket_id+'/'+o.name.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:config.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+config.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw safeFail('ARCHIVE_READ_FAILED');archives.push({name:o.name,checksum:crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')});
  }
  return {counts,fingerprints,objects,archives,authUsers:(await client.query('select count(*)::int as n from auth.users')).rows[0].n};
}
async function clean(){
  // Prefix contains no user-provided text; only this run's namespace is eligible.
  const prefix=namespace+'/';
  const objects=(await client.query('select bucket_id,name from storage.objects where left(name,$1)=$2',[prefix.length,prefix])).rows;
  for(const o of objects){if(o.bucket_id==='migration-archive')throw safeFail('UNEXPECTED_SYNTHETIC_ARCHIVE');await repository.deleteObject(o.bucket_id,o.name);}
  await client.query('delete from public.source_documents where left(name,$1)=$2',[prefix.length,prefix]);
  return {documentsRemaining:(await client.query('select count(*)::int as n from source_documents where left(name,$1)=$2',[prefix.length,prefix])).rows[0].n,objectsRemaining:(await client.query('select count(*)::int as n from storage.objects where left(name,$1)=$2',[prefix.length,prefix])).rows[0].n};
}
(async()=>{
  fs.mkdirSync(reportRoot,{recursive:true,mode:0o700});
  config.SUPABASE_URL=new URL(config.SUPABASE_URL).origin;
  const api=new URL(config.SUPABASE_URL),db=new URL(config.SUPABASE_DB_URL),ref=api.hostname.split('.')[0];
  if(!api.hostname.endsWith('.supabase.co')||(!db.hostname.includes(ref)&&!decodeURIComponent(db.username).includes(ref)))throw safeFail('PROJECT_REFERENCE_MISMATCH');
  client=new Client({connectionString:config.SUPABASE_DB_URL,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(path.join(configRoot,'supabase-test-ca.crt'))},connectionTimeoutMillis:15000,statement_timeout:30000});await client.connect();
  before=await snapshot();
  const buckets=(await client.query("select count(*)::int as total,count(*) filter(where public)::int as public from storage.buckets where id in ('documents','images','circle-files','attachments','profile-images','migration-archive')")).rows[0];
  const foreignKeys=(await client.query("select count(*)::int as total,count(*) filter(where not convalidated)::int as invalid from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'")).rows[0];
  if(buckets.total!==6 || buckets.public!==0 || foreignKeys.invalid!==0)throw safeFail('PRIVATE_BUCKET_OR_FOREIGN_KEY_CHECK_FAILED');
  report.privateBuckets=buckets.total;report.validForeignKeys=foreignKeys.total;
  const excluded=new Set(['source_documents','migration_runs','migration_records']);const recordCount=Object.entries(before.counts).filter(([t])=>!excluded.has(t)).reduce((n,[,count])=>n+count,0);
  if(recordCount!==405 || before.counts.source_documents!==7 || before.archives.length!==7 || before.objects.length!==7)throw safeFail('IMPORTED_BASELINE_CHANGED');
  report.protectedRecords=recordCount;report.protectedArchives=before.archives.length;
  // Apply only the new RPC definition; no import or original-record updates.
  await client.query(fs.readFileSync(path.join(root,'backend/migrations/004_runtime_documents.sql'),'utf8'));
  const privileges=(await client.query("select has_function_privilege('anon','public.commit_studyante_documents(text,jsonb)','execute') as anon,has_function_privilege('authenticated','public.commit_studyante_documents(text,jsonb)','execute') as authenticated,has_function_privilege('service_role','public.commit_studyante_documents(text,jsonb)','execute') as service")).rows[0];
  if(privileges.anon || privileges.authenticated || !privileges.service)throw safeFail('RPC_PERMISSION_CHECK_FAILED');
  const {createRepository}=await import(pathToFileURL(path.join(__dirname,'repository.js')));
  repository=createRepository({env:{...config,STORAGE_DRIVER:'supabase'},allowNetwork:true});
  Object.assign(process.env,{SUPABASE_URL:config.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:config.SUPABASE_SERVICE_ROLE_KEY});
  const {runScenario}=await import(pathToFileURL(path.join(__dirname,'parity-scenario.js')));
  const local=await runScenario({driver:'file',namespace:namespace+'_file'});
  const remote=await runScenario({driver:'supabase',namespace,mock:false});
  const normalize=rows=>rows.map(r=>({...r,route:r.route.replace(/\/[^/]+(?=\/(?:file|approve|respond|invitations|messages|materials|results)$)/g,'/:id').replace(/\/(?:circle_|chat_)[^/]+/g,'/:id').replace(/\/[^/]*:generated/g,'/:generated')}));
  if(JSON.stringify(normalize(local.transcript))!==JSON.stringify(normalize(remote.transcript)))throw safeFail('LIVE_RESPONSE_PARITY_MISMATCH');
  report.file={assertions:local.assertions,requests:local.requests};report.supabase={assertions:remote.assertions,requests:remote.requests};report.responseParity=true;
})().catch(e=>{report.errorCode=e.safeCode||'SYNTHETIC_VERIFICATION_FAILED';process.exitCode=1;}).finally(async()=>{
  try{
    if(client && repository)report.cleanup=await clean();
    if(client && before){const after=await snapshot();report.originalRecordsUnchanged=digest(before)===digest(after);report.passed=!report.errorCode && report.originalRecordsUnchanged && report.cleanup.documentsRemaining===0 && report.cleanup.objectsRemaining===0; if(!report.passed)process.exitCode=1;}
  }catch{report.errorCode='CLEANUP_OR_PRESERVATION_CHECK_FAILED';report.passed=false;process.exitCode=1;}
  fs.mkdirSync(reportRoot,{recursive:true,mode:0o700});fs.writeFileSync(path.join(reportRoot,'verification.json'),JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify(report));if(client)await client.end().catch(()=>{});
});
