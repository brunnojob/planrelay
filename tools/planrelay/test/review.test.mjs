import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { apply, emptyState, latest, feedback, markdownFeedback } from '../core.mjs';
import { store } from '../store.mjs';
import { startServer } from '../server.mjs';
const now = '2026-11-15T00:00:00.000Z';
function fixture() {
  let state = emptyState(), seq = 0;
  return {
    get state() { return state; },
    run(input) { const result = apply(state, { generation:state.generation,...input }, {id:`id-${++seq}`,revision:`revision-${seq}`,now});state=result.state;return result; },
    get a() { return state.artifacts[0]; },
    act(input) { return this.run({id:this.a.id,revision:latest(this.a).revision,...input}); }
  };
}
function create(f) { return f.run({action:'import',title:'Rollout',kind:'plan',content:'Step one\nStep two'}); }
// Catches approval accidentally carried over to content the reviewer has never seen.
test('new revision resets approval and preserves original review history',()=>{
  const f=fixture();create(f);f.act({action:'decide',decision:'approved'});
  const approved = structuredClone(f.a.versions[0]);
  f.act({action:'import',title:'Rollout',kind:'plan',content:'Completely different'});
  assert.equal(feedback(f.a).ready,false);assert.equal(f.a.versions.length,2);assert.deepEqual(f.a.versions[0],approved);
});
// Catches an unresolved or reopened blocker letting an agent continue.
test('blockers prevent approval; reopening invalidates the decision',()=>{
  const f=fixture();create(f);f.act({action:'comment',line:1,severity:'blocker',body:'Need rollback'});
  assert.throws(()=>f.act({action:'decide',decision:'approved'}),/Resolve open blockers/);
  const commentId=latest(f.a).comments[0].id;
  f.act({action:'resolve',commentId,resolved:true});f.act({action:'decide',decision:'approved'});assert.equal(feedback(f.a).ready,true);
  f.act({action:'resolve',commentId,resolved:false});assert.equal(feedback(f.a).ready,false);
});
test('any new feedback invalidates an existing approval',()=>{
  const f=fixture();create(f);f.act({action:'decide',decision:'approved'});
  f.act({action:'comment',line:2,severity:'note',body:'Reconsider this'});assert.equal(feedback(f.a).decision,'pending');
});
// Catches stale browser tabs overwriting a newer review or anchoring to old lines.
test('rejects stale generation and stale revision without changing state',()=>{
  const f=fixture();create(f);const before=structuredClone(f.state);
  assert.throws(()=>f.act({action:'decide',decision:'approved',generation:0}),/workspace changed/);
  assert.throws(()=>f.act({action:'comment',line:1,severity:'note',body:'Old',revision:'old'}),/document changed/);
  assert.deepEqual(f.state,before);
});
test('validates line anchors, severity, resolution and unknown actions',()=>{
  const f=fixture();create(f);
  for(const line of [0,3,1.5])assert.throws(()=>f.act({action:'comment',line,severity:'note',body:'x'}),/Line outside/);
  assert.throws(()=>f.act({action:'comment',line:1,severity:'urgent',body:'x'}),/severity/);
  assert.throws(()=>f.act({action:'run-shell'}),/Unknown action/);
  assert.throws(()=>f.run({action:'import',title:'x',kind:'script',content:'x'}),/kind/);
});
test('export refers to the exact reviewed revision and preserves literal feedback',()=>{
  const f=fixture();create(f);f.act({action:'comment',line:2,severity:'suggestion',body:'<script>alert(1)</script>'});
  assert.equal(feedback(f.a).revision,latest(f.a).revision);assert.equal(feedback(f.a).comments[0].line,2);
  assert.match(markdownFeedback(f.a),/<script>alert\(1\)<\/script>/);
});
test('atomic store persists approval, ignores duplicate imports, and rejects concurrent writers',()=>{
  const dir=mkdtempSync(join(tmpdir(),'planrelay-store-'));
  try {
    const path=join(dir,'state.json'),db=store(path);
    let result=db.mutate({action:'import',generation:0,title:'Plan',kind:'plan',content:'Do something'});
    const artifact=result.state.artifacts[0];
    db.mutate({action:'decide',generation:1,id:artifact.id,revision:latest(artifact).revision,decision:'approved'});
    result=db.mutate({action:'import',generation:2,id:artifact.id,title:'Plan',kind:'plan',content:'Do something'});
    assert.equal(result.unchanged,true);assert.equal(store(path).read().generation,2);assert.equal(feedback(db.read().artifacts[0]).ready,true);
    writeFileSync(`${path}.lock`,'busy');
    assert.throws(()=>db.mutate({action:'decide',generation:2,id:artifact.id,revision:latest(artifact).revision,decision:'pending'}),/busy/);
    assert.equal(JSON.parse(readFileSync(path,'utf8')).generation,2);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('corrupt state is reported and never silently replaced',()=>{
  const dir=mkdtempSync(join(tmpdir(),'planrelay-corrupt-'));
  try {const path=join(dir,'state.json');writeFileSync(path,'not json');assert.throws(()=>store(path).mutate({action:'import',generation:0,title:'x',kind:'plan',content:'x'}));assert.equal(readFileSync(path,'utf8'),'not json');}
  finally {rmSync(dir,{recursive:true,force:true});}
});
// Exercises the actual HTTP boundary rather than only the pure state machine.
test('HTTP rejects foreign hosts/origins, missing token, malformed body and unsafe paths',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'planrelay-http-'));
  const {server,origin}=await startServer({path:join(dir,'state.json')});
  try {
    const state=await (await fetch(`${origin}/api/state`)).json();
    const headers={'Content-Type':'application/json','X-PlanRelay-Token':state.token};
    const input={action:'import',generation:0,title:'Plan',kind:'html',content:'<script>alert(1)</script>'};
    const foreignHostStatus=await new Promise((resolve,reject)=>{const req=httpRequest(origin+'/api/state',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
    assert.equal(foreignHostStatus,403);
    assert.equal((await fetch(`${origin}/api/state`,{headers:{Origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(`${origin}/api/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).status,403);
    assert.equal((await fetch(`${origin}/api/action`,{method:'POST',headers,body:'{'})).status,400);
    const accepted=await fetch(`${origin}/api/action`,{method:'POST',headers,body:JSON.stringify(input)});assert.equal(accepted.status,200);
    const result=await accepted.json();
    const page=await fetch(origin);assert.match(page.headers.get('content-security-policy'),/frame-src 'none'/);assert.doesNotMatch(await page.text(),/<script>alert/);
    for (const path of ['/core.mjs','/app.mjs','/style.css'])assert.equal((await fetch(origin+path)).status,200);
    assert.equal((await fetch(`${origin}/store.mjs`)).status,404);
    assert.equal((await fetch(`${origin}/api/export?id=${result.id}`)).status,200);
    assert.equal((await fetch(`${origin}/api/action`,{method:'POST',headers,body:JSON.stringify({...input,generation:0})})).status,409);
  } finally {await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
test('HTTP enforces body size and does not persist the oversized import',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'planrelay-large-'));const {server,origin,db}=await startServer({path:join(dir,'state.json')});
  try {
    const state=await (await fetch(origin+'/api/state')).json();
    const response=await fetch(origin+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-PlanRelay-Token':state.token},body:JSON.stringify({action:'import',generation:0,title:'large',kind:'plan',content:'x'.repeat(1250000)})});
    assert.equal(response.status,413);assert.equal(db.read().artifacts.length,0);
  } finally {await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
const cli=new URL('../cli.mjs',import.meta.url);
test('CLI check returns 2 for pending, 0 for approved and 1 for missing review',()=>{
  const dir=mkdtempSync(join(tmpdir(),'planrelay-cli-'));
  try {
    const path=join(dir,'state.json'),file=join(dir,'plan.md');writeFileSync(file,'# A real plan');
    const run=args=>spawnSync(process.execPath,[fileURLToPath(cli),...args,'--store',path],{encoding:'utf8'});
    const imported=run(['import',file]);assert.equal(imported.status,0,imported.stderr);const item=JSON.parse(imported.stdout);
    assert.equal(run(['check',item.id]).status,2);
    const db=store(path);db.mutate({action:'decide',generation:1,id:item.id,revision:item.revision,decision:'approved'});
    assert.equal(run(['check',item.id]).status,0);assert.equal(run(['check','missing']).status,1);
    writeFileSync(file,'# A changed plan');assert.equal(run(['import',file,'--id',item.id]).status,0);assert.equal(run(['check',item.id]).status,2);
    assert.match(run(['export',item.id,'--format','markdown']).stdout,/# Review/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('CLI imports a real tracked Git diff without accepting option injection',()=>{
  const dir=mkdtempSync(join(tmpdir(),'planrelay-git-'));
  try {
    const git=args=>spawnSync('git',args,{cwd:dir,encoding:'utf8'});
    assert.equal(git(['init']).status,0);writeFileSync(join(dir,'a.txt'),'old\n');git(['add','.']);assert.equal(git(['-c','user.name=Test','-c','user.email=test@example.com','commit','-m','initial']).status,0);
    writeFileSync(join(dir,'a.txt'),'new\n');
    const run=ref=>spawnSync(process.execPath,[fileURLToPath(cli),'diff','--ref',ref,'--store',join(dir,'state.json')],{cwd:dir,encoding:'utf8'});
    const result=run('HEAD');assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).kind,'diff');assert.match(latest(store(join(dir,'state.json')).read().artifacts[0]).content,/\+new/);
    assert.equal(run('--output=stolen.txt').status,1);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
