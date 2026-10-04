import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PGlite } from '@electric-sql/pglite';
import { buildMigrationPlan, executeMigration } from './plan.js';
import { createRepository } from '../storage/repository.js';

async function fixture() {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'studyante-migration-'));
  const user={id:'existing-text-id',email:'fixture@example.com',password:'$2b$10$fixturehashunchanged',createdAt:'2026-01-01T00:00:00.000Z',profilePicture:'data:image/png;base64,fixture',unknown:{keep:true}};
  const data={
    'users.json':[user],
    'index.json':{folders:[{id:'folder',userId:user.id}],files:[{id:'pdf',userId:user.id,folderId:'folder',storedName:'original.pdf',name:'Original.pdf',text:'Original text'}],flashcardSets:[{id:'deck',userId:user.id,flashcards:[{question:'Q',answer:'A'}]}],studyMaterials:[{id:'note',userId:user.id,type:'notes',name:'Notes',data:{notes:'All notes'},communityStatus:'approved'}]},
    'chats.json':[{id:'chat',userId:user.id,messages:[{id:'message',role:'user',content:'kept'}]}],
    'study-circles.json':{sessions:[{id:'circle',circleName:'Circle',creatorId:user.id,members:[{userId:user.id,role:'creator',capybara:{jacketColor:'green'}}],requests:[],invites:[],messages:[],materials:[],activity:[]}]},
  };
  for(const[name,payload]of Object.entries(data))await fs.writeFile(path.join(root,name),JSON.stringify(payload));
  await fs.mkdir(path.join(root,'files'));await fs.writeFile(path.join(root,'files/original.pdf'),'%PDF fixture bytes');
  await fs.writeFile(path.join(root,'unexpected.backup'),'unknown bytes kept');
  return {root,data,cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
async function database() {
  const db=new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);');
  for(const name of ['001_foundation.sql','002_transactional_import.sql','003_private_buckets.sql']){
    const sql=await fs.readFile(new URL('../migrations/'+name,import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  }
  return db;
}
test('planning is deterministic, lossless, document-aware and dry-run performs no writes',async()=>{
  const f=await fixture();try{
    const a=await buildMigrationPlan(f.root),b=await buildMigrationPlan(f.root);
    assert.deepEqual(a,b);assert.deepEqual(a.issues,[]);
    assert.deepEqual(a.bundle.documents.find(d=>d.name==='users.json').payload,f.data['users.json']);
    assert.ok(a.objects.some(o=>o.bucket==='documents'&&o.contentType==='application/pdf'));
    assert.ok(!a.objects.some(o=>o.bucket==='images'));assert.ok(a.objects.some(o=>o.relative==='unexpected.backup'));
    const report=await executeMigration(a,{putObject(){throw Error('write forbidden');},importBundle(){throw Error('write forbidden');}});
    assert.equal(report.dryRun,true);assert.equal(report.migrated,0);
  }finally{await f.cleanup();}
});
test('ordered SQL reruns; transactional Supabase adapter import preserves IDs/hashes and skips duplicates',async()=>{
  const f=await fixture(),db=await database(),objects=new Map();try{
    const plan=await buildMigrationPlan(f.root);
    const repo=createRepository({env:{STORAGE_DRIVER:'supabase',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only'},allowNetwork:true,fetchImpl:async(url,options)=>{
      const route=new URL(url).pathname;
      if(route.includes('import_studyante_bundle')){const{p_bundle}=JSON.parse(options.body);const result=await db.query('select import_studyante_bundle($1::jsonb) as result',[JSON.stringify(p_bundle)]);return new Response(JSON.stringify(result.rows[0].result));}
      if(route.startsWith('/storage/v1/object/authenticated/'))return new Response(objects.get(route.replace('/authenticated','')));
      if(route.startsWith('/storage/v1/object/')){if(objects.has(route))return new Response('',{status:409});objects.set(route,Buffer.from(options.body));return new Response('{}');}
      throw Error('Unexpected mocked request');
    }});
    const first=await executeMigration(plan,repo,{dryRun:false});assert.equal(first.migrated,plan.bundle.records.length);
    const second=await executeMigration(plan,repo,{dryRun:false});assert.equal(second.migrated,0);assert.equal(second.skipped,first.migrated);assert.equal(second.uploaded,0);
    const users=(await db.query('select id,password_hash,payload from users')).rows;assert.equal(users.length,1);assert.equal(users[0].id,f.data['users.json'][0].id);assert.equal(users[0].password_hash,f.data['users.json'][0].password);assert.deepEqual(users[0].payload,f.data['users.json'][0]);
    assert.equal((await db.query('select count(*)::int as n from migration_runs')).rows[0].n,1);
    assert.equal((await db.query('select public from storage.buckets')).rows.every(b=>b.public===false),true);
    await db.exec('set role anon');await assert.rejects(db.query('select * from users'),/permission denied/);await db.exec('reset role');
  }finally{await db.close();await f.cleanup();}
});
test('foreign-key failure rolls back the entire DB import and CAS rejects stale updates',async()=>{
  const f=await fixture(),db=await database();try{
    const plan=await buildMigrationPlan(f.root),broken=structuredClone(plan.bundle);
    broken.records.find(r=>r.table==='uploaded_files').folderId='nonexistent';
    await assert.rejects(db.query('select import_studyante_bundle($1::jsonb)',[JSON.stringify(broken)]),/foreign key/);
    assert.equal((await db.query('select count(*)::int as n from users')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from migration_runs')).rows[0].n,0);
    await db.query('select import_studyante_bundle($1::jsonb)',[JSON.stringify(plan.bundle)]);
    await assert.rejects(db.query('select replace_source_document($1,$2::jsonb,$3,$4)',['users.json','[]','0'.repeat(64),'1'.repeat(64)]),/Concurrent/);
    const changed=structuredClone(plan.bundle);changed.records.find(r=>r.table==='users').payload.unknown.keep=false;await assert.rejects(db.query('select import_studyante_bundle($1::jsonb)',[JSON.stringify(changed)]),/differs/);
  }finally{await db.close();await f.cleanup();}
});
test('changed source, corrupt JSON, duplicate IDs and missing ownership/files stop imports',async()=>{
  const f=await fixture();try{
    const plan=await buildMigrationPlan(f.root);await fs.writeFile(path.join(f.root,'files/original.pdf'),'changed');
    await assert.rejects(executeMigration(plan,{driver:'supabase',putObject(){throw Error('must not write');}},{dryRun:false}),/Source changed/);
    await fs.unlink(path.join(f.root,'files/original.pdf'));const missing=await buildMigrationPlan(f.root);assert.ok(missing.issues.some(i=>i.type==='missing-binary'));await assert.rejects(executeMigration(missing,{}),/Unresolved/);
    await fs.writeFile(path.join(f.root,'users.json'),'{broken');await assert.rejects(buildMigrationPlan(f.root),/invalid/);
    await fs.writeFile(path.join(f.root,'users.json'),JSON.stringify([f.data['users.json'][0],f.data['users.json'][0]]));await assert.rejects(buildMigrationPlan(f.root),/Duplicate/);
  }finally{await f.cleanup();}
});
