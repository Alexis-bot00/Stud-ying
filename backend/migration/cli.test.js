import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('CLI dry-run works with no secrets; existing reports and unapproved apply fail closed',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'studyante-cli-')),source=path.join(root,'library'),report=path.join(root,'private-report.json');
  try{
    await fs.mkdir(source);await fs.writeFile(path.join(source,'users.json'),'[]');await fs.writeFile(path.join(source,'index.json'),'{}');await fs.writeFile(path.join(source,'chats.json'),'[]');
    const run=args=>spawnSync(process.execPath,[fileURLToPath(new URL('./cli.js',import.meta.url)),...args],{encoding:'utf8',env:{...process.env,STORAGE_DRIVER:'file',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''}});
    const args=['--source',source,'--report',report,'--dry-run'];
    const result=run(args);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).dryRun,true);
    const original=await fs.readFile(report);assert.notEqual(run(args).status,0);assert.deepEqual(await fs.readFile(report),original);
    assert.notEqual(run(['--source',source,'--report',path.join(root,'apply.json'),'--apply']).status,0);
    assert.notEqual(run(['--source',source,'--report',path.join(source,'report.json'),'--dry-run']).status,0);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(source,'users.json'),'utf8')),[]);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
