import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import { requestedLibraryIds, resolveGenerationLesson } from './generation-lesson.js';
const library = { files: [{id:'a',userId:'alice',name:'A.pdf',text:'A lesson'}, {id:'b',userId:'alice',name:'B.txt',text:'B lesson'}, {id:'secret',userId:'bob',name:'Private',text:'private text'}] };
const dependencies = { readLibrary: () => library, extractText: async () => 'raw text', prepareText: text => text.trim() };
test('combined sources preserve order, deduplicate IDs and reject foreign/missing records', async () => {
  const req = ids => ({body:{libraryIds:ids},user:{id:'alice'}});
  const result = await resolveGenerationLesson(req('["b","a","b"]'), dependencies);
  assert.equal(result.name,'B.txt, A.pdf'); assert.match(result.lesson,/B lesson[\s\S]*A lesson/);
  await assert.rejects(resolveGenerationLesson(req(['a','secret']),dependencies),/not found/);
  await assert.rejects(resolveGenerationLesson(req(['missing']),dependencies),/not found/);
  for (const ids of ['nope','{}',[],[null],['']]) assert.throws(()=>requestedLibraryIds({libraryIds:ids}),/valid list/);
});
test('single libraryId, one-element libraryIds and upload contracts are preserved', async () => {
  for (const body of [{libraryId:'a'},{libraryIds:['a']}]) assert.deepEqual(await resolveGenerationLesson({body,user:{id:'alice'}},dependencies),{lesson:'A lesson',name:'A.pdf'});
  assert.deepEqual(await resolveGenerationLesson({body:{},user:{id:'alice'},file:{path:'temporary',originalname:'Upload.txt'}},dependencies),{lesson:'raw text',name:'Upload.txt'});
});
test('actual /api/generate handler uses the combined resolver and preserves response shape', async () => {
  const source = fs.readFileSync(new URL('./server.js',import.meta.url),'utf8');
  const helper = source.slice(source.indexOf('async function getLesson('),source.indexOf('app.post(',source.indexOf('async function getLesson(')));
  const start = source.indexOf('app.post(\n  "/api/generate"');
  assert.ok(start>0);
  const route = source.slice(start,source.indexOf('app.get(',start));
  const app=express(); app.use(express.json());
  const context=vm.createContext({ store: { bind: (req,res,next) => next() },app,readLibrary:dependencies.readLibrary,extractText:dependencies.extractText,prepareText:dependencies.prepareText,resolveGenerationLesson,
    requireAuth:(req,res,next)=>{req.user={id:req.headers['x-user']};next();},upload:{single:()=> (req,res,next)=>next()},
    getFlashcardCount:()=>20,getQuestionCount:()=>20,buildPrompt:(type,lesson)=>lesson,
    askProvider:async(provider,prompt)=>{assert.match(prompt,/A lesson[\s\S]*B lesson/);return 'Combined notes';},removeFile(){},console:{error(){}},parseAIJSON:JSON.parse});
  vm.runInContext(helper+route,context);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
  try {
    const send=body=>fetch(`http://127.0.0.1:${server.address().port}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json','x-user':'alice'},body:JSON.stringify(body)});
    const ok=await send({type:'notes',libraryIds:['a','b']});assert.equal(ok.status,200);
    const result=await ok.json();assert.equal(result.success,true);assert.equal(result.file,'A.pdf, B.txt');assert.equal(result.data.notes,'Combined notes');
    const forbidden=await send({type:'notes',libraryIds:['a','secret']});assert.equal(forbidden.status,500);assert.equal((await forbidden.json()).success,false);
  } finally { await new Promise(r=>server.close(r)); }
});
