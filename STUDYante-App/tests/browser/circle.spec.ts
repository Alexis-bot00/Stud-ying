import { test, expect, Page } from './render-fixture';
async function setup(page:Page,count=2) {
  await page.addInitScript(()=>localStorage.setItem('studyingToken','test-token'));
  const participants=Array.from({length:count},(_,i)=>({userId:i===0?'test-user':'member'+i,name:i===0?'Alexis':'Member '+i,role:i===1?'creator':'member',online:i<3,joinedAt:'2026-01-01T00:00:00Z'}));
  let joined=true, pending=false;
  const room:any={id:'circle1',circleName:'DSA Buddies',subject:'Data Structures',description:'Learn together',privacy:'public',creatorId:'member1',creatorName:'Member 1',memberCount:count,mine:false,status:'accepted',currentUserId:'test-user',participants,messages:[{id:'m0',senderUserId:'member1',circleId:'circle1',message:'Welcome to our table',createdAt:new Date().toISOString(),name:'Member 1'}],materials:[],activity:[],requests:[]};
  const discover={...room,id:'circle2',circleName:'Biology Club',status:'none',memberCount:1};
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),pathname=url.pathname;let data:any={};
    if(pathname.endsWith('/api/auth/me'))data={user:{id:'test-user',name:'Alexis Test',email:'test@example.com'}};
    else if(pathname.endsWith('/api/admin/me'))data={isAdmin:false};
    else if(pathname.endsWith('/api/library'))data={flashcardSets:[{id:'deck1',name:'Personal deck',flashcards:[{question:'Q',answer:'A'}]}],studyMaterials:[{id:'note1',name:'Personal BFS',type:'notes',data:{notes:'BFS uses a queue'}},{id:'test1',name:'Personal test',type:'test',data:{questions:[{question:'Q',choices:['A','B'],answer:0}]}},{id:'game1',name:'Personal game',type:'game',data:{game:[{question:'Q',choices:['A','B'],answer:0}]}}]};
    else if(pathname.includes('/api/cappy/circles')) {
      if(pathname.endsWith('/capybara')){room.participants.find((m:any)=>m.userId==='test-user').capybara=req.postDataJSON();data={success:true};}
      else if(pathname.endsWith('/requests')){pending=true;data={success:true};}
      else if(pathname.endsWith('/messages')){const b=req.postDataJSON();room.messages.push({id:'m'+room.messages.length,senderUserId:'test-user',circleId:room.id,message:b.message,createdAt:new Date().toISOString(),name:'Alexis'});data={success:true};}
      else if(pathname.endsWith('/materials') && req.method()==='POST'){const b=req.postDataJSON();const m={...b,id:'material'+room.materials.length,circleId:room.id};if(b.resourceId){Object.assign(m,b.resourceType==='flashcards'?{materialType:'flashcards',title:'Personal deck',content:{cards:[{front:'Q',back:'A'}]}}:b.resourceType==='test'?{materialType:'tests',title:'Personal test',content:{questions:[{type:'multiple-choice',question:'Q',options:['A','B'],answer:'A'}]}}:b.resourceType==='game'?{materialType:'games',title:'Personal game',content:{kind:'quick-quiz',pairs:[{front:'Q',back:'A'}]}}:{materialType:'notes',title:'Personal BFS',content:{notes:'BFS uses a queue'}});}room.materials.push(m);data={material:m};}
      else if(pathname.includes('/materials/')){const id=pathname.split('/').at(-1);if(req.method()==='DELETE')room.materials=room.materials.filter((m:any)=>m.id!==id);else if(req.method()==='PUT'){const index=room.materials.findIndex((m:any)=>m.id===id);room.materials[index]={...room.materials[index],...req.postDataJSON()};}data={success:true};}
      else if(pathname.endsWith('/circle1'))data={session:room};
      else if(req.method()==='POST'){Object.assign(room,req.postDataJSON(),{mine:true,creatorId:'test-user',creatorName:'Alexis',memberCount:1,participants:[{userId:'test-user',name:'Alexis',role:'creator',online:true}]});data={session:room};}
      else {const q=url.searchParams.get('search')?.toLowerCase() || '';data={currentUserId:'test-user',sessions:joined && room.circleName.toLowerCase().includes(q)?[room]:[],discover:discover.circleName.toLowerCase().includes(q)?[{...discover,status:pending?'pending':'none'}]:[],invitations:[]};}
    } else data={files:[],folders:[],chats:[],studyMaterials:[]};
    await route.fulfill({json:data});
  });
  await page.goto('/');await expect(page.getByText('Hello, Alexis!',{exact:true})).toBeVisible();await page.getByText('Circle',{exact:true}).click();
  return room;
}
async function enter(page:Page){await page.getByRole('button',{name:'Enter DSA Buddies',exact:true}).click();}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);}
test('Circle home replaces friend codes; creator name, search and pending request work',async({page})=>{
  await setup(page);await expect(page.getByText('MY CODE',{exact:true})).toHaveCount(0);await expect(page.getByText('Start with your notes',{exact:true})).toHaveCount(0);
  await page.getByLabel('Search circle name...', {exact:true}).fill('BIOLOGY');await expect(page.getByText('Biology Club',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Enter DSA Buddies'})).toHaveCount(0);
  await page.getByRole('button',{name:'Request to Join',exact:true}).click();await expect(page.getByRole('button',{name:'Request Sent',exact:true})).toBeDisabled();
  await page.getByLabel('Search circle name...', {exact:true}).fill('');await page.getByRole('button',{name:'+ Create Circle',exact:true}).click();await page.getByLabel('Circle Name',{exact:true}).fill('My chosen room');await page.getByLabel('Subject',{exact:true}).fill('Algorithms');await page.getByRole('button',{name:'Create Study Circle',exact:true}).click();await expect(page.getByText('My chosen room',{exact:true})).toBeVisible();
});
for(const count of [2,3,4,5,48]) test('capybara room fits phone with '+count+' real members and correct speech bubbles',async({page})=>{
  await page.setViewportSize({width:320,height:740});await setup(page,count);await enter(page);await expect(page.getByRole('button',{name:'Open Circle chat with Alexis',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open Circle chat with Member 1',exact:true}).getByText('Welcome to our table',{exact:true})).toBeVisible();
  await page.getByLabel('Type a message...', {exact:true}).fill('BFS uses a queue!');await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByRole('button',{name:'Open shared notes',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/circle-cozy-'+count+'-320.png'});
  await expect(page.getByRole('button',{name:'Open Circle chat with Alexis',exact:true}).getByText('BFS uses a queue!',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open Circle chat with Member 1',exact:true}).getByText('BFS uses a queue!',{exact:true})).toHaveCount(0);
  expect(await page.getByRole('img',{name:/Capybara for/}).count()).toBe(Math.min(count,4));await fits(page);
  if(count>4){await page.getByRole('button',{name:'+'+(count-4)+' Members',exact:true}).click();await page.getByLabel('Search members',{exact:true}).fill('Member '+(count-1));await expect(page.getByText('Member '+(count-1)+' · Member · Offline',{exact:true})).toBeVisible();}
  await page.screenshot({path:'test-results/circle-room-'+count+'-320.png',fullPage:true});
});
test('all members share, edit and delete Circle notes with confirmation; flashcards flip and tests score',async({page})=>{
  const room=await setup(page);await enter(page);await page.getByRole('button',{name:'Open shared notes',exact:true}).click();await page.getByRole('button',{name:'+ Add notes',exact:true}).click();await page.getByRole('button',{name:'Choose from my Library',exact:true}).click();await page.getByRole('button',{name:'Share Personal BFS',exact:true}).click();
  await page.getByRole('button',{name:'Options for Personal BFS',exact:true}).click();await page.getByRole('button',{name:'Edit Personal BFS',exact:true}).click();await page.getByLabel('Shared Note',{exact:true}).fill('Circle copy changed');await page.getByRole('button',{name:'Save shared notes',exact:true}).click();
  await page.getByRole('button',{name:'Open Personal BFS',exact:true}).click();await expect(page.getByText('Circle copy changed',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Delete Personal BFS',exact:true}).click();await expect(page.getByText('Personal Library originals stay intact.')).toBeVisible();expect(room.materials.length).toBe(1);await page.getByRole('button',{name:'Confirm Delete',exact:true}).click();expect(room.materials.length).toBe(0);await expect(page.getByRole('button',{name:'+ Add notes',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Room',exact:true}).click();await page.getByRole('button',{name:'Open shared flashcards',exact:true}).click();await page.getByRole('button',{name:'+ Add Deck',exact:true}).click();await page.getByLabel('Material name',{exact:true}).fill('BFS deck');await page.getByLabel('Question / front 1',{exact:true}).fill('BFS structure?');await page.getByLabel('Answer / back 1',{exact:true}).fill('Queue');await page.getByRole('button',{name:'Save shared flashcards',exact:true}).click();await page.getByRole('button',{name:'Open BFS deck',exact:true}).click();await page.getByRole('button',{name:'Flip card',exact:true}).click();await expect(page.getByText('Queue',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Room',exact:true}).click();await page.getByRole('button',{name:'Open shared tests',exact:true}).click();await page.getByRole('button',{name:'+ Add Test',exact:true}).click();await page.getByLabel('Material name',{exact:true}).fill('BFS test');await page.getByLabel('Question 1',{exact:true}).fill('BFS structure?');await page.getByLabel('Correct answer 1',{exact:true}).fill('Queue');await page.getByRole('button',{name:'Save shared tests',exact:true}).click();await page.getByRole('button',{name:'Open BFS test',exact:true}).click();await page.getByLabel('Your answer 1',{exact:true}).fill('queue');await page.getByRole('button',{name:'Finish and show score',exact:true}).click();await expect(page.getByText('1 / 1',{exact:true})).toBeVisible();await fits(page);
});

test('matching, quick quiz, word scramble and Group Challenge are playable',async({page})=>{
  const room=await setup(page);
  room.materials=['matching','quick-quiz','word-scramble','group-challenge'].map((kind,i)=>({id:'game'+i,materialType:'games',title:kind,content:{kind,pairs:[{front:'BFS structure?',back:'Queue'}]}}));
  await enter(page);await page.getByRole('button',{name:'Open shared games',exact:true}).click();
  await page.getByRole('button',{name:'Open matching',exact:true}).click();await page.getByRole('button',{name:'BFS structure?',exact:true}).click();await page.getByRole('button',{name:'Queue',exact:true}).click();await expect(page.getByText('Great job! 1 / 1',{exact:true})).toBeVisible();
  for(const kind of ['quick-quiz','word-scramble']){await page.getByRole('button',{name:'Back to shared games',exact:true}).click();await page.getByRole('button',{name:'Open '+kind,exact:true}).click();await page.getByLabel('Your answer 1',{exact:true}).fill('Queue');await page.getByRole('button',{name:'Finish and show score',exact:true}).click();await expect(page.getByText('1 / 1',{exact:true})).toBeVisible();}
  await page.route('**/materials/game3/results',async route=>{expect(route.request().postDataJSON().answers).toEqual(['Queue']);room.materials[3].results=[{userId:'test-user',score:1,total:1}];await route.fulfill({json:{score:1,total:1}});});
  await page.getByRole('button',{name:'Back to shared games',exact:true}).click();await page.getByRole('button',{name:'Open group-challenge',exact:true}).click();await page.getByLabel('Your answer 1',{exact:true}).fill('Queue');await page.getByRole('button',{name:'Finish and show score',exact:true}).click();await expect(page.getByText('Alexis · 1 / 1',{exact:true})).toBeVisible();
});

test('desktop displays six capybaras and creator can approve and decline real requests',async({page})=>{
  await page.setViewportSize({width:1100,height:900});const room=await setup(page,48);room.mine=true;room.creatorId='test-user';room.requests=[{id:'r1',userId:'requester1',name:'Requesting Member'},{id:'r2',userId:'requester2',name:'Another Member'}];
  await page.route('**/circle1/requests/*',async route=>{const id=route.request().url().split('/').at(-1);const r=room.requests.find((r:any)=>r.id===id);if(route.request().postDataJSON().status==='accepted'){room.participants.push({userId:r.userId,name:r.name,role:'member',online:false});room.memberCount++;}room.requests=room.requests.filter((r:any)=>r.id!==id);await route.fulfill({json:{success:true}});});
  await enter(page);await expect(page.getByRole('button',{name:'+42 Members',exact:true})).toBeVisible();expect(await page.getByRole('img',{name:/Capybara for/}).count()).toBe(6);await fits(page);
  await page.getByRole('button',{name:'Join Requests (2)',exact:true}).click();await page.getByRole('button',{name:'Accept Requesting Member',exact:true}).click();await expect(page.getByText('Requesting Member',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Decline Another Member',exact:true}).click();await expect(page.getByText('No pending requests.',{exact:true})).toBeVisible();expect(room.memberCount).toBe(49);
});

for(const width of [320,1024]) test('Circle creation has clear privacy choices and a separate home at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:900});await setup(page);
  const search=page.getByLabel('Search circle name...',{exact:true});
  const searchBox=await search.boundingBox();const circlesBox=await page.getByText('YOUR CIRCLES',{exact:true}).boundingBox();expect(searchBox!.y).toBeLessThan(circlesBox!.y);
  await page.getByRole('button',{name:'+ Create Circle',exact:true}).click();
  await expect(search).toHaveCount(0);await expect(page.getByText('YOUR CIRCLES',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'+ Create Circle',exact:true})).toHaveCount(0);
  const publicChoice=page.getByRole('radio',{name:'Public / Searchable',exact:true}), privateChoice=page.getByRole('radio',{name:'Private / Invite Only',exact:true});
  await expect(publicChoice).toBeChecked();await expect(privateChoice).not.toBeChecked();await privateChoice.click();await expect(privateChoice).toBeChecked();await expect(publicChoice).not.toBeChecked();
  await expect(page.getByText('Hidden from search. Only people you invite can join.',{exact:true})).toBeVisible();await fits(page);await page.screenshot({path:'test-results/circle-create-clear-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(search).toBeVisible();await page.getByRole('button',{name:'+ Create Circle',exact:true}).click();await expect(publicChoice).toBeChecked();
});

test('create an empty Circle then upload a Note directly into it',async({page})=>{
  const room=await setup(page);await page.route('**/api/library',route=>route.fulfill({json:{studyMaterials:[]}}));
  await page.getByRole('button',{name:'+ Create Circle',exact:true}).click();await page.getByLabel('Circle Name',{exact:true}).fill('Start without Notes');await page.getByRole('button',{name:'Create Study Circle',exact:true}).click();
  await expect(page.getByText('Start without Notes',{exact:true})).toBeVisible();expect(room.materials).toHaveLength(0);
  await page.getByRole('button',{name:'Open shared notes',exact:true}).click();
  let uploaded=false;
  await page.route('**/circle1/notes/import',async route=>{expect(route.request().headers()['content-type']).toContain('multipart/form-data');expect(route.request().postDataBuffer()!.toString()).toContain('A queue keeps BFS in order.');uploaded=true;await route.fulfill({json:{title:'Uploaded BFS',notes:'A queue keeps BFS in order.',filename:'Uploaded BFS.txt'}});});
  await page.getByRole('button',{name:'+ Add notes',exact:true}).click();const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload Note file',exact:true}).click();const chooser=await chooserPromise;await chooser.setFiles({name:'Uploaded BFS.txt',mimeType:'text/plain',buffer:Buffer.from('A queue keeps BFS in order.')});
  await expect(page.getByLabel('Shared Note',{exact:true})).toHaveValue('A queue keeps BFS in order.');expect(uploaded).toBe(true);expect(room.materials).toHaveLength(0);
  await page.getByRole('button',{name:'Save shared notes',exact:true}).click();await page.getByRole('button',{name:'Open Uploaded BFS',exact:true}).click();await expect(page.getByText('A queue keeps BFS in order.',{exact:true})).toBeVisible();expect(room.materials).toHaveLength(1);
});

test('old Circle servers do not instruct users to choose Library Notes',async({page})=>{
  await setup(page);await page.route('**/api/cappy/circles',route=>route.fulfill({status:404,json:{message:'Choose notes you created in your library.'}}));
  await page.getByRole('button',{name:'+ Create Circle',exact:true}).click();await page.getByLabel('Circle Name',{exact:true}).fill('No Notes');await page.getByRole('button',{name:'Create Study Circle',exact:true}).click();
  await expect(page.getByText('Choose notes you created in your library.',{exact:true})).toHaveCount(0);
  await expect(page.getByText('The account server needs the Circle update before you can create a Circle without Notes.',{exact:true})).toBeVisible();
});

test('Circle preview uses the configured API server in the browser',async({page})=>{
  const expected=process.env.EXPO_PUBLIC_API_URL;
  test.skip(!expected,'Set EXPO_PUBLIC_API_URL to verify the exported preview connection.');
  await page.addInitScript(()=>localStorage.setItem('studyingToken','circle-routing-probe'));
  const requestPromise=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/auth/me');
  await page.goto(process.env.CIRCLE_PREVIEW_URL || '/');const request=await requestPromise;
  expect(new URL(request.url()).origin).toBe(new URL(expected!).origin);
});



test('share existing Library decks tests and games into their Circle tabs',async({page})=>{
  const room=await setup(page);await enter(page);
  for(const [tab,name] of [['Flashcards','Personal deck'],['Tests','Personal test'],['Games','Personal game']]){
    await page.getByRole('button',{name:tab,exact:true}).click();await page.getByRole('button',{name:'Choose from my Library',exact:true}).click();await page.getByRole('button',{name:'Share '+name,exact:true}).click();await expect(page.getByRole('button',{name:'Open '+name,exact:true})).toBeVisible();
  }
  expect(room.materials.map((m:any)=>m.materialType)).toEqual(['flashcards','tests','games']);
});






test('colored original jacket saves locally when the old server lacks customization',async({page})=>{
  await page.setViewportSize({width:320,height:740});await setup(page);await enter(page);await page.route('**/api/cappy/circles/circle1/capybara',route=>route.fulfill({status:404,contentType:'text/html',body:'Cannot PATCH'}));await page.getByRole('button',{name:'Customize my capybara',exact:true}).click();for(const color of ['Orange','Yellow','Red','Black']){await page.getByRole('radio',{name:color,exact:true}).click();await expect(page.getByRole('img',{name:'Capybara for you - Studying - '+color.toLowerCase()+' jacket',exact:true})).toBeVisible();}await fits(page);await expect(page.getByRole('img',{name:'Capybara for you - Studying - black jacket',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save my capybara',exact:true}).click();await expect(page.getByText('Jacket saved on this device. Other members will see the new color after the Circle server update.',{exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Capybara for Alexis - Studying - black jacket',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to Study Circle',exact:true}).click();await enter(page);await expect(page.getByRole('img',{name:'Capybara for Alexis - Studying - black jacket',exact:true})).toBeVisible();
});
test('colored original jacket saves for Circle members on the updated server',async({page})=>{
  const room=await setup(page);await enter(page);await page.getByRole('button',{name:'Customize my capybara',exact:true}).click();await page.getByRole('radio',{name:'Pink',exact:true}).click();await page.getByRole('button',{name:'Save my capybara',exact:true}).click();expect(room.participants[0].capybara).toEqual({jacketColor:'pink'});await expect(page.getByText('Jacket saved for this Circle.',{exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Capybara for Alexis - Studying - pink jacket',exact:true})).toBeVisible();
});

test('Circle materials use clear Library errors formatted notes and friendly game choices',async({page})=>{
  const room=await setup(page);room.materials=[{id:'md',materialType:'notes',title:'Readable note',content:{notes:'# Overview\n**Important** idea\n- First point'}}];await enter(page);await page.getByRole('button',{name:'Notes',exact:true}).click();await page.getByRole('button',{name:'Open Readable note',exact:true}).click();await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();await expect(page.getByText('# Overview',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Games',exact:true}).click();await page.getByRole('button',{name:'+ Add Game',exact:true}).click();await expect(page.getByText('Match the pairs',{exact:false})).toBeVisible();await expect(page.getByText('Unscramble an answer using the clue.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel editing',exact:true}).click();
  await page.getByRole('button',{name:'Flashcards',exact:true}).click();await page.getByRole('button',{name:'Choose from my Library',exact:true}).click();await page.getByLabel('Search my Library',{exact:true}).fill('deck');await page.route('**/api/cappy/circles/circle1/materials',route=>route.fulfill({status:404,json:{message:'Choose your own Library Note.'}}));await page.getByRole('button',{name:'Share Personal deck',exact:true}).click();await expect(page.getByText('Your flashcards could not be shared because the Circle server needs the Library sharing update. You can still create one here.',{exact:true})).toBeVisible();await expect(page.getByText('Choose your own Library Note.',{exact:true})).toHaveCount(0);
});

test('Library sharing works with servers whose resource lookup only accepts Notes',async({page})=>{
  const room=await setup(page);await enter(page);
  await page.route('**/api/cappy/circles/circle1/materials',async route=>{const body=route.request().postDataJSON();if(body.resourceId){await route.fulfill({status:404,json:{message:'Choose your own Library Note.'}});return;}expect(body.content).toBeTruthy();room.materials.push({...body,id:'copy'+room.materials.length});await route.fulfill({status:201,json:{material:room.materials.at(-1)}});});
  for(const [tab,name] of [['Flashcards','Personal deck'],['Tests','Personal test'],['Games','Personal game']]){await page.getByRole('button',{name:tab,exact:true}).click();await page.getByRole('button',{name:'Choose from my Library',exact:true}).click();await page.getByRole('button',{name:'Share '+name,exact:true}).click();await expect(page.getByRole('button',{name:'Open '+name,exact:true})).toBeVisible();}
  expect(room.materials[0].content.cards).toEqual([{front:'Q',back:'A'}]);expect(room.materials[1].content.questions[0].answer).toBe('A');expect(room.materials[2].content.pairs).toEqual([{front:'Q',back:'A'}]);
});

test('Circle bubbles fit short messages and expand for longer chat text',async({page})=>{
  await page.setViewportSize({width:320,height:740});await setup(page);await enter(page);
  await page.getByLabel('Type a message...',{exact:true}).fill('Hi');await page.getByRole('button',{name:'Send',exact:true}).click();const bubble=page.getByTestId('circle-bubble-test-user');await expect(bubble).toBeVisible();const short=await bubble.boundingBox();
  const long='This is a longer study message that wraps onto several lines. '.repeat(12);await page.getByLabel('Type a message...',{exact:true}).fill(long);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(bubble.getByText(long.trim(),{exact:true})).toBeVisible();const tall=await bubble.boundingBox();expect(tall!.height).toBeGreaterThan(short!.height);expect(tall!.width).toBeGreaterThan(short!.width);expect(tall!.height).toBeLessThanOrEqual(152);await fits(page);
});
