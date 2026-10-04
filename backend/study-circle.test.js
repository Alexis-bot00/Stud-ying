import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createStudyCircleRouter } from './study-circle.js';
async function fixture(fn, legacy) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'circle-v2-'));
  const users=['alice','bob','charlie',...Array.from({length:130},(_,i)=>'user'+i)].map(id=>({id,name:id,email:id+'@example.com'}));
  const library={studyMaterials:[{id:'note1',userId:'alice',type:'notes',name:'Personal BFS',data:{notes:'BFS uses a queue.'}}]};
  if(legacy) fs.writeFileSync(path.join(directory,'study-circles.json'),JSON.stringify(legacy));
  const app=express();app.use(express.json());app.use('/circle',createStudyCircleRouter({directory,readUsers:()=>users,readLibrary:()=>library,requireAuth:(req,res,next)=>{req.user={id:req.headers['x-user']};next();}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
  const request=async(user,route='',body,method)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/circle'+route,{method:method || (body?'POST':'GET'),headers:{'x-user':user,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  const create=async(privacy='public')=>(await request('alice','',{circleName:'DSA Buddies',subject:'Data Structures',description:'Together',privacy})).data.session.id;
  const join=async(circle,user)=>{await request(user,'/'+circle+'/requests',{});const r=(await request('alice','/'+circle)).data.session.requests.find(r=>r.userId===user);return request('alice','/'+circle+'/requests/'+r.id,{status:'accepted'});};
  try{await fn({request,create,join,library,directory});}finally{await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});}
}
test('creator naming, case-insensitive discovery, pending consent and creator-only approval',()=>fixture(async({request,create,join})=>{
  assert.equal((await request('unknown')).status,401);
  assert.equal((await request('alice','',{circleName:'',privacy:'public'})).status,400);
  const id=await create();
  const home=(await request('alice')).data;assert.equal(home.sessions[0].circleName,'DSA Buddies');assert.equal(home.sessions[0].memberCount,1);
  assert.equal((await request('bob','?search=dSa')).data.discover.length,1);
  assert.equal((await request('bob','?search=Data Structures')).data.discover.length,0);
  assert.equal((await request('bob','/'+id)).status,403);
  await request('bob','/'+id+'/requests',{});await request('bob','/'+id+'/requests',{});
  assert.equal((await request('bob')).data.discover[0].status,'pending');
  let room=(await request('alice','/'+id)).data.session;assert.equal(room.requests.length,1);assert.equal(room.memberCount,1);
  assert.equal((await request('bob','/'+id+'/requests/'+room.requests[0].id,{status:'accepted'})).status,403);
  assert.equal((await request('bob','/'+id+'/messages',{message:'Private?'})).status,403);
  await request('alice','/'+id+'/requests/'+room.requests[0].id,{status:'declined'});
  assert.equal((await request('bob','/'+id)).status,403);
  await join(id,'bob');assert.equal((await request('bob','/'+id)).data.session.memberCount,2);
  assert.equal((await request('bob','/'+id,{circleName:'Renamed',privacy:'public'},'PATCH')).status,403);
  assert.equal((await request('alice','/'+id,{circleName:'Our own name',subject:'DSA',description:'Changed',privacy:'private'},'PATCH')).status,200);
  assert.equal((await request('charlie')).data.discover.length,0);
  assert.equal((await request('bob','/'+id)).data.session.circleName,'Our own name');
}));
test('private invitations need explicit consent, members can be removed and leave',()=>fixture(async({request,create})=>{
  const id=await create('private');assert.equal((await request('bob')).data.discover.length,0);
  assert.equal((await request('bob','/'+id+'/requests',{})).status,404);
  await request('alice','/'+id+'/invitations',{email:'bob@example.com'});
  assert.equal((await request('bob')).data.invitations.length,1);assert.equal((await request('bob','/'+id)).status,403);
  await request('bob','/'+id+'/respond',{status:'accepted'});assert.equal((await request('bob','/'+id)).status,200);
  assert.equal((await request('bob','/'+id+'/members/alice',undefined,'DELETE')).status,403);
  assert.equal((await request('alice','/'+id+'/members/alice',undefined,'DELETE')).status,400);
  await request('alice','/'+id+'/members/bob',undefined,'DELETE');assert.equal((await request('bob','/'+id)).status,403);
  await request('alice','/'+id+'/invitations',{email:'bob@example.com'});await request('bob','/'+id+'/respond',{status:'accepted'});
  await request('bob','/'+id,undefined,'DELETE');assert.equal((await request('bob','/'+id)).status,403);
  await request('alice','/'+id,undefined,'DELETE');assert.equal((await request('alice','/'+id)).status,403);
}));
test('membership has no cap and actual account IDs represent every member',()=>fixture(async({request,create,join})=>{
  const id=await create();for(let i=0;i<130;i++)assert.equal((await join(id,'user'+i)).status,200);
  const room=(await request('alice','/'+id)).data.session;assert.equal(room.memberCount,131);assert.equal(new Set(room.participants.map(m=>m.userId)).size,131);assert.equal(room.participants[0].role,'creator');
}));
test('Circle chat is isolated, sender identity cannot be forged, outsiders cannot access materials',()=>fixture(async({request,create,join})=>{
  const a=await create(),b=await create();await join(a,'bob');await join(b,'bob');
  await request('bob','/'+a+'/messages',{message:'Only A',senderUserId:'alice',circleId:b});
  const messages=(await request('alice','/'+a)).data.session.messages;assert.equal(messages[0].senderUserId,'bob');assert.equal(messages[0].circleId,a);assert.ok(messages[0].createdAt);
  assert.equal((await request('alice','/'+b)).data.session.messages.length,0);
  assert.equal((await request('charlie','/'+a)).status,403);
  assert.equal((await request('charlie','/'+a+'/materials',{materialType:'notes',title:'Intruder',content:{notes:'No'}})).status,403);
}));
test('all accepted members manage all material types; personal notes survive replacement and deletion',()=>fixture(async({request,create,join,library})=>{
  const id=await create();await join(id,'bob');const initial=JSON.stringify(library);
  const copy=await request('alice','/'+id+'/materials',{resourceId:'note1'});assert.equal(copy.status,201);
  assert.equal((await request('bob','/'+id+'/materials',{resourceId:'note1'})).status,404);
  assert.equal((await request('bob','/'+id+'/materials/'+copy.data.material.id,{materialType:'notes',title:'Circle copy',content:{notes:'Changed'},replace:true},'PUT')).status,200);
  await request('bob','/'+id+'/materials/'+copy.data.material.id,undefined,'DELETE');assert.equal(JSON.stringify(library),initial);
  const inputs=[{materialType:'notes',title:'Note',content:{notes:'Collaborative'}},{materialType:'flashcards',title:'Cards',content:{cards:[{front:'BFS?',back:'Queue'}]}},{materialType:'tests',title:'Test',content:{questions:[{type:'multiple-choice',question:'BFS?',answer:'Queue',options:['Queue','Stack']},{type:'true-false',question:'BFS uses queue?',answer:'True'},{type:'identification',question:'BFS structure?',answer:'Queue'}]}},...['matching','quick-quiz','word-scramble','group-challenge'].map(kind=>({materialType:'games',title:kind,content:{kind,pairs:[{front:'BFS?',back:'Queue'}]}}))];
  for(const input of inputs){const r=await request('bob','/'+id+'/materials',input);assert.equal(r.status,201);const m=r.data.material;
    assert.equal((await request('bob','/'+id+'/materials/'+m.id,{...input,title:'Edited'},'PUT')).status,200);
    if(input.materialType==='games'){assert.equal((await request('bob','/'+id+'/materials/'+m.id+'/start',{})).status,200);if(input.content.kind==='group-challenge'){const result=await request('bob','/'+id+'/materials/'+m.id+'/results',{answers:['queue'],score:999});assert.equal(result.data.score,1);assert.equal((await request('alice','/'+id)).data.session.materials.find(x=>x.id===m.id).results[0].userId,'bob');}}
    assert.equal((await request('charlie','/'+id+'/materials/'+m.id,undefined,'DELETE')).status,403);
    assert.equal((await request('bob','/'+id+'/materials/'+m.id,undefined,'DELETE')).status,200);
  }
  const room=(await request('alice','/'+id)).data.session;assert.equal(room.materials.length,0);assert.ok(room.activity.some(a=>a.userId==='bob' && a.action==='replaced'));assert.ok(room.activity.every(a=>a.circleId===id));
  assert.equal((await request('bob','/'+id+'/materials',{materialType:'tests',title:'Invalid',content:{questions:[{type:'multiple-choice',question:'?',options:['A','B'],answer:'C'}]}})).status,400);
}));
test('legacy circles migrate privately with independent notes and accepted membership preserved',()=>fixture(async({request,directory})=>{
  const r=(await request('alice','/old')).data.session;assert.equal(r.circleName,'Biology');assert.equal(r.privacy,'private');assert.equal(r.materials[0].content.notes,'Cells');assert.equal(r.participants.length,2);assert.equal(r.messages[0].senderUserId,'bob');
  assert.equal((await request('charlie')).data.discover.length,0);
  await request('bob','/old/materials',{materialType:'notes',title:'New',content:{notes:'Saved'}});
  const saved=JSON.parse(fs.readFileSync(path.join(directory,'study-circles.json'),'utf8'));assert.equal(saved.sessions[0].circleName,'Biology');
},{sessions:[{id:'old',ownerId:'alice',title:'Biology',notes:'Cells',createdAt:'2026-01-01T00:00:00Z',invites:[{userId:'bob',status:'accepted'}],messages:[{id:'m',userId:'bob',text:'Hi',sentAt:'2026-01-01T00:00:00Z'}]}]}));

test('empty Library users create Circles first and upload shared Notes afterwards',()=>fixture(async({request,library,directory})=>{
  library.studyMaterials=[];
  const created=await request('alice','',{circleName:'No Notes Needed',privacy:'public'});assert.equal(created.status,201);
  const circle=created.data.session.id;assert.equal((await request('alice','/'+circle)).data.session.materials.length,0);
  const file=(name='BFS.txt',content='BFS uses a queue.')=>{const form=new FormData();form.append('file',new Blob([content],{type:'text/plain'}),name);return form;};
  assert.equal((await request('bob','/'+circle+'/notes/import',file())).status,403);
  await request('bob','/'+circle+'/requests',{});assert.equal((await request('bob','/'+circle+'/notes/import',file())).status,403);
  const pending=(await request('alice','/'+circle)).data.session.requests[0];await request('alice','/'+circle+'/requests/'+pending.id,{status:'accepted'});
  const imported=await request('bob','/'+circle+'/notes/import',file());assert.equal(imported.status,200);assert.equal(imported.data.title,'BFS');assert.equal(imported.data.notes,'BFS uses a queue.');
  const {zipSync,strToU8}=await import('fflate');
  const docx=zipSync({
    '[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>BFS uses a queue.</w:t></w:r></w:p></w:body></w:document>'),
  });
  const word=await request('bob','/'+circle+'/notes/import',file('BFS.docx',docx));assert.equal(word.status,200);assert.match(word.data.notes,/BFS uses a queue/);
  const stream='BT /F1 12 Tf 72 720 Td (BFS uses a queue.) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream'];
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  const portable=await request('bob','/'+circle+'/notes/import',file('BFS.pdf',pdf));assert.equal(portable.status,200);assert.match(portable.data.notes,/BFS uses a queue/);
  assert.equal((await request('alice','/'+circle)).data.session.materials.length,0); // Import is reviewed before sharing.
  const saved=await request('bob','/'+circle+'/materials',{materialType:'notes',title:imported.data.title,content:{notes:imported.data.notes}});assert.equal(saved.status,201);
  assert.equal((await request('alice','/'+circle)).data.session.materials[0].addedByUserId,'bob');assert.deepEqual(library.studyMaterials,[]);
  assert.equal((await request('bob','/'+circle+'/notes/import',file('file.exe'))).status,400);
  assert.equal((await request('bob','/'+circle+'/notes/import',file('empty.txt',''))).status,400);
  assert.equal((await request('bob','/'+circle+'/notes/import',file('invalid.pdf','not a PDF'))).status,400);
  assert.equal((await request('bob','/'+circle+'/notes/import',file('long.txt','x'.repeat(200001)))).status,400);
  assert.equal((await request('bob','/'+circle+'/notes/import',file('huge.txt','x'.repeat(8*1024*1024+1)))).status,400);
  assert.deepEqual(fs.readdirSync(directory),['study-circles.json']); // No personal Library file or uploaded binary is stored.
}));
