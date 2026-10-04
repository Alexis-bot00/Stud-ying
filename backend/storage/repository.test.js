import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRepository, authorizeObject } from './repository.js';
const credentials={STORAGE_DRIVER:'supabase',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only'};
test('file is default, round-trips every field/hash and fails on corrupt JSON',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'studyante-repo-'));
  try {
    const repo=createRepository({env:{},directory,fetchImpl:()=>{throw Error('Network must never be called');}});
    assert.equal(repo.driver,'file');const users=[{id:'legacy-id',password:'existing-hash',custom:{offline:true}}];
    await repo.write('users.json',users);assert.deepEqual(await repo.read('users.json'),users);
    assert.deepEqual(await repo.read('chats.json',[]),[]);
    await fs.writeFile(path.join(directory,'users.json'),'{broken');await assert.rejects(repo.read('users.json',[]));
    await assert.rejects(repo.write('../users.json',[]));
    const bytes=Buffer.from('document bytes');assert.equal((await repo.putObject('documents','alice/file.pdf',bytes)).skipped,false);
    assert.equal((await repo.putObject('documents','alice/file.pdf',bytes)).skipped,true);
    await assert.rejects(repo.putObject('documents','alice/file.pdf',Buffer.from('changed')),/differs/);
    await assert.rejects(repo.getObject('documents','alice/file.pdf',{id:'bob'},{userId:'alice'}),/Forbidden/);
    assert.deepEqual(await repo.getObject('documents','alice/file.pdf',{id:'alice'},{userId:'alice',bucket:'documents',key:'alice/file.pdf'}),bytes);
    await assert.rejects(repo.getObject('documents','alice/file.pdf',{id:'alice'},{userId:'alice',bucket:'documents',key:'other.pdf'}),/Forbidden/);
    await assert.rejects(repo.putObject('documents','../outside',bytes),/Invalid storage path/);
  } finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('Supabase mode fails closed without explicit network opt-in',async()=>{
  let calls=0;const repo=createRepository({env:credentials,fetchImpl:()=>{calls++;}});
  await assert.rejects(repo.read('users.json'),/disabled/);assert.equal(calls,0);
  assert.throws(()=>createRepository({env:{STORAGE_DRIVER:'bad'}}));
  assert.throws(()=>createRepository({env:{STORAGE_DRIVER:'supabase'}}));
});
test('Supabase transport round-trips JSON, CAS writes and membership-gated signing',async()=>{
  const calls=[];const repo=createRepository({env:credentials,allowNetwork:true,fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/sign/'))return new Response(JSON.stringify({signedURL:'/object/sign/circle-files/a.pdf?token=fixture'}));
    return new Response(JSON.stringify([{payload:[{id:'same',password:'same-hash'}]}]));
  }});
  assert.deepEqual(await repo.read('users.json'),[{id:'same',password:'same-hash'}]);
  await assert.rejects(repo.write('users.json',[]),/expected checksum/);
  await repo.write('users.json',[],{expectedChecksum:'a'.repeat(64)});
  assert.match(calls[1].url,/replace_source_document/);assert.equal(JSON.parse(calls[1].options.body).p_expected_checksum,'a'.repeat(64));
  await assert.rejects(repo.signedUrl('circle-files','a.pdf',{id:'bob'},{circleId:'c'},[]),/Forbidden/);
  assert.match(await repo.signedUrl('circle-files','a.pdf',{id:'alice'},{circleId:'c',bucket:'circle-files',key:'a.pdf'},[{circleId:'c',userId:'alice',accepted:true}]),/^https:\/\/fixture.invalid\/storage\/v1\/object\/sign/);
  await assert.rejects(repo.signedUrl('circle-files','other.pdf',{id:'alice'},{circleId:'c',bucket:'circle-files',key:'a.pdf'},[{circleId:'c',userId:'alice',accepted:true}]),/Forbidden/);
  assert.equal(authorizeObject({id:'alice',suspended:true},{userId:'alice'}),false);
});
test('remote retries verify bytes; differing object is never overwritten',async()=>{
  const bytes=Buffer.from('PDF fixture');let uploaded=0;
  const repo=createRepository({env:credentials,allowNetwork:true,fetchImpl:async(url,options)=>{
    if(options.method==='POST'){uploaded++;assert.equal(options.headers['x-upsert'],'false');return new Response('',{status:409});}
    return new Response(bytes);
  }});
  assert.equal((await repo.putObject('documents','a.pdf',bytes)).skipped,true);
  await assert.rejects(repo.putObject('documents','a.pdf',Buffer.from('different')),/differs/);assert.equal(uploaded,2);
});
