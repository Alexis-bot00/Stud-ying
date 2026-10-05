import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { createRuntimeStore } from './runtime.js';
let results={};
test('Supabase root GET and HEAD liveness do not read private documents',()=>{
  const store=createRuntimeStore({repository:{driver:'supabase',readDocuments(){throw Error('Liveness must not read storage');}}});
  for(const method of ['GET','HEAD']){
    let continued=false,bound=false;
    const req={method,path:'/'},res=new EventEmitter();
    store.middleware(req,res,()=>{continued=true;store.bind(req,res,()=>{bound=true;});});
    assert.equal(continued,true);assert.equal(bound,true);
  }
});
test('Supabase liveness bypasses a pending API transaction without bypassing API persistence',async()=>{
  let resolveRead,reads=0,apiFinished=false;
  const pending=new Promise(resolve=>{resolveRead=resolve;});
  const store=createRuntimeStore({repository:{driver:'supabase',readDocuments(){reads++;return pending;}}});
  const response=new EventEmitter();let finish;
  const finished=new Promise(resolve=>{finish=resolve;});
  response.end=()=>{apiFinished=true;finish();};
  store.middleware({method:'GET',path:'/api/library'},response,()=>{
    assert.equal(store.read('users.json'),'[]');response.end();
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reads,1);assert.equal(apiFinished,false);
  let healthy=false;
  store.middleware({method:'GET',path:'/'},new EventEmitter(),()=>{healthy=true;});
  assert.equal(healthy,true);assert.equal(reads,1);
  resolveRead({'users.json':{payload:[]},'index.json':{payload:{files:[]}}});
  await finished;assert.equal(apiFinished,true);
});
for(const driver of ['file','supabase'])test(`active Express synthetic HTTP parity: ${driver}`,()=>{
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('./parity-scenario.js',import.meta.url)),'--scenario',driver],{encoding:'utf8',timeout:120000,env:{...process.env,SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_DB_URL:'',NODE_OPTIONS:''}});
  assert.equal(child.status,0,child.stderr);
  results[driver]=JSON.parse(child.stdout);assert.ok(results[driver].assertions>60);
});
test('file and Supabase response status/shape contracts match',()=>{
  const normalize=rows=>rows.filter(r=>r.status!==503).map(r=>({...r,route:r.route.replace(/\/[^/]+(?=\/(?:file|approve|respond|invitations|messages|materials|results)$)/g,'/:id').replace(/\/(?:circle_|chat_)[^/]+/g,'/:id').replace(/\/[^/]*:generated/g,'/:generated')}));
  assert.deepEqual(normalize(results.file.transcript),normalize(results.supabase.transcript));
});
test('atomic runtime CAS rolls back every document on conflict and restricts RPC permissions',async()=>{
  const db=new PGlite();try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(await fs.readFile(new URL('../migrations/001_foundation.sql',import.meta.url),'utf8'));
    const sql=await fs.readFile(new URL('../migrations/004_runtime_documents.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
    const change=(name,payload,expectedChecksum=null)=>({name,payload,expectedChecksum,checksum:'a'.repeat(64)});
    const commit=c=>db.query('select commit_studyante_documents($1,$2::jsonb)',['synthetic_sql',JSON.stringify(c)]);
    await commit([change('users.json',[]),change('chats.json',[])]);
    await assert.rejects(commit([change('users.json',[{id:'synthetic'}],'a'.repeat(64)),change('chats.json',[],null)]),/Concurrent/);
    assert.deepEqual((await db.query("select payload from source_documents where name='synthetic_sql/users.json'")).rows[0].payload,[]);
    await db.exec('set role authenticated');await assert.rejects(commit([]),/permission denied/);await db.exec('reset role');
    await assert.rejects(commit([change('../users.json',[])]),/Invalid document/);
    assert.equal((await db.query("select count(*)::int as n from source_documents where name not like 'synthetic_sql/%'")).rows[0].n,0);
  }finally{await db.close();}
});
