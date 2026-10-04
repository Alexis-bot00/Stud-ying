// Synthetic-only HTTP scenario. No production config, backups or records are read.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checksum } from './repository.js';
import { friendCode } from '../cappy-friends.js';

export async function runScenario({ driver, namespace = 'synthetic_local_parity', mock = driver === 'supabase' } = {}) {
  if (!['file','supabase'].includes(driver) || !/^synthetic_[a-z0-9_]+$/.test(namespace)) throw new Error('Synthetic configuration required');
  const originalCwd = process.cwd(), root = fs.mkdtempSync(path.join(os.tmpdir(),'studyante-parity-'));
  const nativeFetch = globalThis.fetch, documents = new Map(), objects = new Map();
  let conflict = false, unavailable = false;
  const envKeys = ['STORAGE_DRIVER','STORAGE_NAMESPACE','JWT_SECRET','STUDYANTE_NO_LISTEN','ADMIN_EMAILS','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','SMTP_HOST','SMTP_USER','SMTP_PASS'];
  const originalEnv = Object.fromEntries(envKeys.map(k => [k,process.env[k]]));
  const initialPassword = await bcrypt.hash('SyntheticPassword1!',10);
  const users = ['owner','other','admin'].map(id=>({id:`synthetic_${id}`,name:`Synthetic ${id}`,email:`${id}@synthetic.invalid`,password:initialPassword,createdAt:'2026-01-01T00:00:00.000Z',...(id==='admin'?{role:'admin'}:{})}));
  const initial = {'users.json':users,'index.json':{folders:[],files:[],flashcardSets:[],studyMaterials:[]},'chats.json':[],'study-circles.json':{sessions:[]},'cappy-friends.json':{links:[],messages:[]},'announcements.json':[],'admin-logs.json':[]};
  let server; const transcript=[]; let assertions=0;
  const check=(condition,label)=>{ assertions++; if (!condition) throw new Error(`Synthetic parity failed: ${label}`); };
  try {
    process.chdir(root); fs.mkdirSync(path.join(root,'library'));
    Object.assign(process.env,{STORAGE_DRIVER:driver,STORAGE_NAMESPACE:namespace,JWT_SECRET:'synthetic-only-jwt-secret-123456789',STUDYANTE_NO_LISTEN:'1',ADMIN_EMAILS:'admin@synthetic.invalid',GEMINI_API_KEY:'',SMTP_HOST:'',SMTP_USER:'',SMTP_PASS:''});
    if (driver==='file') for(const [name,value]of Object.entries(initial))fs.writeFileSync(path.join(root,'library',name),JSON.stringify(value));
    else if (mock) {
      process.env.SUPABASE_URL='https://synthetic.invalid/unneeded/path'; process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-only-service-key';
      for(const[name,payload]of Object.entries(initial))documents.set(`${namespace}/${name}`,{name:`${namespace}/${name}`,payload,checksum:checksum(Buffer.from(JSON.stringify(payload)))});
      globalThis.fetch=async(url,options={})=>{
        const u=new URL(url);if(u.hostname!=='synthetic.invalid')return nativeFetch(url,options);
        if(unavailable)return new Response('',{status:503});
        if(u.pathname==='/rest/v1/source_documents')return Response.json([...documents.values()].map(r=>structuredClone(r)));
        if(u.pathname==='/rest/v1/rpc/commit_studyante_documents'){
          const b=JSON.parse(options.body);if(conflict || b.p_changes.some(c=> (documents.get(`${b.p_namespace}/${c.name}`)?.checksum ?? null)!==c.expectedChecksum))return new Response('',{status:409});
          for(const c of b.p_changes)documents.set(`${b.p_namespace}/${c.name}`,{name:`${b.p_namespace}/${c.name}`,payload:c.payload,checksum:c.checksum});return new Response('');
        }
        if(u.pathname.startsWith('/storage/v1/object/authenticated/')){const k=decodeURIComponent(u.pathname.slice('/storage/v1/object/authenticated/'.length));return objects.has(k)?new Response(objects.get(k)):new Response('',{status:404});}
        if(u.pathname.startsWith('/storage/v1/object/')){
          const k=decodeURIComponent(u.pathname.slice('/storage/v1/object/'.length));
          if(options.method==='DELETE'){for(const p of JSON.parse(options.body).prefixes)objects.delete(`${k}/${p}`);return Response.json([]);}
          if(objects.has(k))return new Response('',{status:409});objects.set(k,Buffer.from(options.body));return Response.json({});
        }
        throw new Error('Unexpected synthetic transport');
      };
    } else {
      const {createRepository}=await import('./repository.js');const repository=createRepository({allowNetwork:true});
      await repository.commitDocuments(namespace,Object.entries(initial).map(([name,payload])=>({name,payload,expectedChecksum:null,checksum:checksum(Buffer.from(JSON.stringify(payload)))})));
    }
    const {default:app}=await import(`../server.js?scenario=${namespace}`);
    let lastPrompt='';app.locals.askProvider=async(provider,prompt)=>{lastPrompt=prompt;return 'Synthetic AI response with safe deterministic content.';};
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
    const tokens=Object.fromEntries(users.map(u=>[u.id,jwt.sign({id:u.id,email:u.email},process.env.JWT_SECRET,{expiresIn:'1h'})]));
    const shape=v=>v===null?'null':Array.isArray(v)?v.map(shape):typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,shape(x)])):typeof v;
    const call=async(method,route,{as='synthetic_owner',body,status=200,binary=false,headers={}}={})=>{
      let response;
      try { response=await nativeFetch(base+route,{method,signal:AbortSignal.timeout(15000),headers:{...(as?{Authorization:`Bearer ${tokens[as] || as}`} :{}),...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})}); }
      catch { throw new Error(`Synthetic request did not complete: ${method} ${route}`); }
      const result=binary?Buffer.from(await response.arrayBuffer()):await response.json();
      check(response.status===status,`${method} ${route} status (expected ${status}, got ${response.status})${mock && result.message ? ': '+result.message : ''}`);
      transcript.push({method,route:route.replace(/[0-9][0-9a-z_-]{8,}/g,':generated'),status:response.status,shape:binary?'bytes':shape(result)});return result;
    };
    await call('GET','/api/library',{as:null,status:401});await call('GET','/api/library',{as:'invalid-token',status:401});
    const login=await call('POST','/api/auth/login',{as:null,body:{email:users[0].email,password:'SyntheticPassword1!'}});check(login.user.id===users[0].id,'bcrypt login retained ID');
    const me=await call('GET','/api/auth/me');check(me.user.id===users[0].id,'JWT identity');
    await call('POST','/api/auth/register',{as:null,body:{name:'Synthetic new account',email:'new@synthetic.invalid',password:'SyntheticPassword1!'}});
    const folder=(await call('POST','/api/library/folders',{body:{name:'Synthetic folder'}})).folder;
    check(!!folder?.id,'folder created');
    const upload=async(name,text)=>{const body=new FormData();body.set('file',new Blob([text],{type:'text/plain'}),name);body.set('folderId',folder.id);return(await call('POST','/api/library',{body})).file;};
    const content='Synthetic lesson text about cells and biology. This record is only for migration testing.';
    const a=await upload('synthetic-a.txt',content), b=await upload('synthetic-b.txt',content+' A second source.');
    check((await call('GET',`/api/library/${a.id}/file`,{binary:true})).toString()===content,'download bytes');
    check((await call('GET',`/api/library/${a.id}/file`,{binary:true,headers:{Range:'bytes=0-8'},status:206})).toString()===content.slice(0,9),'download range');
    await call('GET',`/api/library/${a.id}/file`,{as:'synthetic_other',status:404});
    const generated=await call('POST','/api/generate',{body:{type:'notes',libraryIds:[a.id,b.id]}});check(generated.file==='synthetic-a.txt, synthetic-b.txt' && lastPrompt.includes('SOURCE 2'),'combined generation includes both sources');
    // Existing invalid-selection behavior is a 500 JSON response.
    const savedError=console.error;console.error=()=>{};
    try{await call('POST','/api/generate',{as:'synthetic_other',body:{type:'notes',libraryIds:[a.id,b.id]},status:500});}finally{console.error=savedError;}
    const cards=(await call('POST','/api/library/flashcards',{body:{name:'Synthetic cards',flashcards:[{question:'Synthetic Q',answer:'Synthetic A'}],folderId:folder.id}})).flashcardSet;
    await call('PATCH',`/api/library/files/${a.id}`,{body:{folderId:folder.id}});
    await call('PATCH',`/api/library/flashcards/${cards.id}`,{body:{name:'Synthetic cards edited'}});
    await call('PATCH',`/api/library/flashcards/${cards.id}`,{as:'synthetic_other',body:{name:'Synthetic forbidden'},status:404});
    for(const[type,data]of [['notes',{notes:'Synthetic notes'}],['test',{questions:[{question:'Synthetic Q',answer:'A',choices:['A','B']}]}],['game',{game:[{question:'Synthetic Q',answer:'A',choices:['A','B']}]}]]) {
      const material=await call('POST','/api/library/study-materials',{body:{type,name:`Synthetic ${type}`,folderId:folder.id,data}});check(material.item.type===type,'material type');
      await call('PATCH',`/api/library/study-materials/${material.item.id}`,{body:{name:`Synthetic ${type} edited`,data}});
    }
    const offline=await call('GET','/api/library');check(Array.isArray(offline.files) && Array.isArray(offline.flashcardSets) && Array.isArray(offline.studyMaterials),'offline Library arrays');
    await call('POST','/api/presence/heartbeat');
    await call('PATCH','/api/account/profile',{body:{name:'Synthetic owner edited',email:users[0].email}});
    const image=new FormData();image.set('profilePicture',new Blob([Buffer.from([137,80,78,71])],{type:'image/png'}),'synthetic.png');
    const profile=await call('PATCH','/api/account/profile',{body:image});check(profile.user.profilePicture.startsWith('data:image/png;base64,'),'offline profile contract');
    await call('POST',`/api/community/submit/file/${a.id}`);
    await call('GET','/api/admin/community/pending',{as:'synthetic_other',status:403});
    await call('POST',`/api/admin/community/file/${a.id}/approve`,{as:'synthetic_admin'});await call('GET','/api/community');await call('GET',`/api/community/file/${a.id}/content`,{as:'synthetic_other'});
    const chat=await call('POST','/api/chat',{body:{question:'Synthetic question',libraryIds:[a.id,b.id]}});check(!!chat.chatId,'AI chat saved');await call('GET','/api/chats');await call('GET',`/api/chats/${chat.chatId}`);await call('GET',`/api/chats/${chat.chatId}`,{as:'synthetic_other',status:404});
    await call('POST','/api/cappy/friends/request',{body:{code:friendCode(users[1].id)},status:201});await call('POST','/api/cappy/friends/accept',{as:'synthetic_other',body:{id:users[0].id}});await call('POST',`/api/cappy/friends/${users[1].id}/messages`,{body:{text:'Synthetic friend message'},status:201});await call('GET',`/api/cappy/friends/${users[0].id}/messages`,{as:'synthetic_other'});
    const circle=(await call('POST','/api/cappy/circles',{body:{circleName:'Synthetic Circle',subject:'Synthetic',privacy:'private'},status:201})).session;
    await call('GET',`/api/cappy/circles/${circle.id}`,{as:'synthetic_other',status:403});await call('POST',`/api/cappy/circles/${circle.id}/invitations`,{body:{email:users[1].email}});await call('POST',`/api/cappy/circles/${circle.id}/respond`,{as:'synthetic_other',body:{status:'accepted'}});await call('POST',`/api/cappy/circles/${circle.id}/messages`,{body:{text:'Synthetic Circle message'},status:201});
    for(const[materialType,content]of [['notes',{notes:'Synthetic Circle notes'}],['flashcards',{cards:[{front:'Q',back:'A'}]}],['tests',{questions:[{type:'identification',question:'Q',answer:'A'}]}],['games',{kind:'group-challenge',pairs:[{front:'Q',back:'A'}]}]]) {
      const material=(await call('POST',`/api/cappy/circles/${circle.id}/materials`,{body:{title:`Synthetic ${materialType}`,materialType,content},status:201})).material;
      if(materialType==='games')await call('POST',`/api/cappy/circles/${circle.id}/materials/${material.id}/results`,{body:{answers:['A']}});
    }
    await call('GET',`/api/cappy/circles/${circle.id}`,{as:'synthetic_other'});
    const noteUpload=new FormData();noteUpload.set('file',new Blob(['Synthetic imported Circle notes'],{type:'text/plain'}),'synthetic-notes.txt');
    const imported=await call('POST',`/api/cappy/circles/${circle.id}/notes/import`,{as:'synthetic_other',body:noteUpload});check(imported.notes==='Synthetic imported Circle notes','Circle import after multipart binding');
    const announcement=await call('POST','/api/admin/announcements',{as:'synthetic_admin',body:{title:'Synthetic announcement',message:'Synthetic message'}});await call('GET','/api/announcements');await call('GET','/api/admin/logs',{as:'synthetic_admin'});await call('GET','/api/admin/dashboard',{as:'synthetic_admin'});
    const read=async name=>driver==='file'?JSON.parse(fs.readFileSync(path.join(root,'library',name),'utf8')):mock?documents.get(`${namespace}/${name}`).payload:(await (await nativeFetch(new URL(process.env.SUPABASE_URL).origin+`/rest/v1/source_documents?name=eq.${namespace}%2F${name}&select=payload`,{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`}})).json())[0].payload;
    check((await read('users.json')).find(u=>u.id===users[0].id).password===initialPassword,'unchanged hash during profile edits');check((await read('chats.json'))[0].messages.length===2,'chat relationship');check((await read('admin-logs.json')).length>0,'admin records persisted');
    await call('PATCH','/api/account/password',{body:{currentPassword:'SyntheticPassword1!',newPassword:'SyntheticPassword2!'}});await call('POST','/api/auth/login',{as:null,body:{email:users[0].email,password:'SyntheticPassword2!'}});
    if(mock && driver==='supabase'){
      const before=JSON.stringify(await read('index.json'));conflict=true;await call('POST','/api/library/folders',{body:{name:'Synthetic rejected'},status:503});conflict=false;check(JSON.stringify(await read('index.json'))===before,'CAS rejection does not lose data');
      unavailable=true;await call('GET','/api/auth/me',{status:503});unavailable=false;
    }
    await call('DELETE',`/api/library/${b.id}`);await call('GET',`/api/library/${b.id}/file`,{status:404});
    await call('DELETE',`/api/chats/${chat.chatId}`);await call('DELETE',`/api/cappy/circles/${circle.id}`);await call('DELETE',`/api/cappy/friends/${users[1].id}`);await call('DELETE',`/api/library/folders/${folder.id}`);
    check((await read('index.json')).files.find(f=>f.id===a.id)?.folderId===null,'folder deletion moves files to root');
    await call('DELETE',`/api/library/${a.id}`);
    await call('DELETE',`/api/library/flashcards/${cards.id}`);
    if(mock && driver==='supabase')check([...objects.keys()].every(k=>k.startsWith('profile-images/')),'library objects deleted');
    return {assertions,requests:transcript.length,transcript};
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}globalThis.fetch=nativeFetch;process.chdir(originalCwd);
    for(const[k,v]of Object.entries(originalEnv))if(v===undefined)delete process.env[k];else process.env[k]=v;
    fs.rmSync(root,{recursive:true,force:true});
  }
}

if(process.argv.includes('--scenario')) {
  try{const result=await runScenario({driver:process.argv.at(-1)});process.stdout.write(JSON.stringify(result));}
  catch(error){process.stderr.write(error.message);process.exitCode=1;}
}
