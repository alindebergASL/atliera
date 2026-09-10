import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir, chmod, symlink, link, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { LocalWorkStore, MAX_WORK_DOCUMENTS, type WorkingBrief } from '../../src/c3/work-store.ts';
import { syntheticWorkshopContext, syntheticMeetingCandidate, syntheticMeetingRequest } from '../fixtures/c3-workshop.ts';
import { createC3ModelRequest, createGenerationRecord } from '../../src/c3/draft.ts';
import { canonicalJson } from '../../src/c3/context.ts';
const context=syntheticWorkshopContext();
const record=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest,null,'5'),syntheticMeetingCandidate(context),context);
const work:WorkingBrief={record,records:[record],correctionNote:'Original note',sectionNotes:{Opening:'Private annotation'},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1};
const id=(n:number)=>`doc_${n.toString(16).padStart(24,'0')}`;
const options=(root:string)=>({root,principal:'operator-one'});
async function fixture(fn:(root:string)=>Promise<void>) {
  const root=await mkdtemp(join(tmpdir(),'c3-store-recovery-'));
  try {await fn(root);} finally {await rm(root,{recursive:true,force:true});}
}
async function bytes(root:string) {
  return Object.fromEntries(await Promise.all((await readdir(root)).filter(n=>n.endsWith('.json')).map(async n=>[n,await readFile(join(root,n),'utf8')])));
}
for(const stage of ['before-publish','after-link','after-publish']) test(`actual SIGKILL ${stage} releases Save lock and preserves published versions`,{timeout:20000},()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);store.save(id(1),0,work);
  const original=await bytes(root);
  const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
  const child=spawn(process.execPath,['--import','tsx','tests/c3/work-store-process.ts',root,stage,id(1),'1'],{stdio:['ignore','pipe','pipe'],env:childEnv});
  const exited=once(child,'exit');let stderr='';child.stderr.on('data',data=>{stderr+=data;});
  try {
    await new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error(`child readiness timeout: ${stderr}`)),10000);
      child.stdout.on('data',data=>{if(String(data).includes('SAVE_PAUSED')) {clearTimeout(timer);resolve();}});
      child.once('exit',()=>{clearTimeout(timer);reject(Error(`child exited before pause: ${stderr}`));});
    });
    assert.throws(()=>store.save(id(2),0,work),/busy/,'a live process cannot be evicted');
    child.kill('SIGKILL');const [,signal]=await exited;assert.equal(signal,'SIGKILL');
    const restarted=new LocalWorkStore(options(root),context);
    const expected=stage==='before-publish'?1:2;
    assert.equal(store.load(id(1)).version,expected,'a reader opened before process death recovers the same latest version');
    assert.equal(restarted.load(id(1)).version,expected);
    assert.equal((await readdir(root)).some(name=>name.startsWith('.pending-')),stage==='before-publish','published staging links are detached on failed read recovery');
    assert.throws(()=>restarted.save(id(1),expected-1,work),/conflict/);
    assert.equal(restarted.save(id(1),expected,work).version,expected+1);
    const after=await bytes(root);for(const [name,raw] of Object.entries(original))assert.equal(after[name],raw);
  } finally {if(child.exitCode===null && child.signalCode===null){child.kill('SIGKILL');await exited;}}
}));
test('abandoned legacy directory lock does not disable the new process-lifetime protocol',()=>fixture(async root=>{
  await mkdir(join(root,'.write-lock'),{mode:0o700});
  const store=new LocalWorkStore(options(root),context);
  assert.equal(store.save(id(1),0,work).version,1);
  assert.deepEqual(await readdir(join(root,'.write-lock')),[],'legacy artifact is left untouched');
}));
test('one unreadable latest record is isolated without falling back or modifying any version',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);
  store.save(id(1),0,work);store.save(id(1),1,work);store.save(id(2),0,work);
  const latest=(await readdir(root)).find(n=>n.includes(id(1)) && n.endsWith('v000002.json'))!;
  await writeFile(join(root,latest),'{broken');const original=await bytes(root);
  const listed=store.listWithDiagnostics();assert.deepEqual(listed.briefs.map(b=>b.documentId),[id(2)]);assert.deepEqual(listed.unreadableDocumentIds,[id(1)]);
  assert.deepEqual(store.list().map(b=>b.documentId),[id(2)]);assert.throws(()=>store.load(id(1)));
  assert.deepEqual(await bytes(root),original);
}));
test('unsafe latest file does not hide another readable brief',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);store.save(id(1),0,work);store.save(id(2),0,work);
  const name=(await readdir(root)).find(n=>n.includes(id(1)))!;
  await chmod(join(root,name),0o644);assert.deepEqual(store.listWithDiagnostics().unreadableDocumentIds,[id(1)]);
  await rm(join(root,name));await symlink(join(root,(await readdir(root))[0]!),join(root,name));
  assert.deepEqual(store.list().map(b=>b.documentId),[id(2)]);
}));
test('Save enforces document capacity under the lock but permits updates; invalid documents still count',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);
  for(let n=1;n<=MAX_WORK_DOCUMENTS;n++)assert.equal(store.save(id(n),0,work).version,1);
  assert.equal(store.list().length,MAX_WORK_DOCUMENTS);const original=await bytes(root);
  assert.throws(()=>store.save(id(101),0,work),/document limit/);assert.deepEqual(await bytes(root),original);
  assert.equal(store.save(id(1),1,work).version,2);
  const bad=(await readdir(root)).find(n=>n.includes(id(2)))!;await writeFile(join(root,bad),'bad');
  assert.throws(()=>store.save(id(101),0,work),/document limit/);assert.equal(store.list().length,99);
}));
test('historical reopen and subsequent Save use exact retained context across refreshed sources',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);const first=store.save(id(1),0,work);const original=await bytes(root);
  const refreshed=syntheticWorkshopContext('harbor','sparse');assert.notEqual(context.sha256,refreshed.sha256);
  const restarted=new LocalWorkStore(options(root),refreshed);const {saved,context:historical}=restarted.loadWithContext(id(1));
  assert.equal(historical.canonicalJson,context.canonicalJson);assert.equal(historical.sha256,context.sha256);assert.deepEqual(saved.work,work);assert.equal(saved.principal,first.principal);assert.equal(saved.accountId,first.accountId);assert.equal(saved.work.record.recordId,record.recordId);
  assert.equal(restarted.list().length,1);
  assert.throws(()=>restarted.save(id(1),1,work,undefined,refreshed));
  assert.equal(restarted.save(id(1),1,{...work,correctionNote:'New annotation'},undefined,historical).contextSha256,context.sha256);
  assert.equal(restarted.save(id(2),0,work,undefined,historical).contextSha256,context.sha256);
  const after=await bytes(root);for(const [name,raw] of Object.entries(original))assert.equal(after[name],raw);
  assert.throws(()=>new LocalWorkStore({...options(root),principal:'other-operator'},refreshed).load(id(1)));
  assert.throws(()=>new LocalWorkStore(options(root),syntheticWorkshopContext('cedar')).load(id(1)));
}));
test('legacy schemas require exact retained context after refresh and remain byte-for-byte unchanged',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);store.save(id(1),0,work);
  const path=join(root,(await readdir(root))[0]!);const value=JSON.parse(await readFile(path,'utf8'));delete value.contextCanonicalJson;
  for(const schemaVersion of ['1','2']) {
    const legacy={...value,schemaVersion};if(schemaVersion==='1')delete legacy.metadata;
    const raw=JSON.stringify(legacy,null,2)+'\n';await writeFile(path,raw);
    assert.deepEqual(store.load(id(1)),legacy);
    const refreshed=syntheticWorkshopContext('harbor','sparse');assert.throws(()=>new LocalWorkStore(options(root),refreshed).load(id(1)),/original context unavailable/);
    const restored=new LocalWorkStore({...options(root),retainedContexts:[context]},refreshed);
    assert.deepEqual(restored.load(id(1)),legacy);assert.equal(restored.loadWithContext(id(1)).context.canonicalJson,context.canonicalJson);assert.equal(await readFile(path,'utf8'),raw);
  }
}));
test('retained context tampering, cross-account context and edited historical content fail full validation',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);store.save(id(1),0,work);const path=join(root,(await readdir(root))[0]!);const raw=await readFile(path,'utf8');
  const altered=JSON.parse(context.canonicalJson);altered.materialGaps.push('Injected');const serialized=canonicalJson(altered);
  for(const patch of [
    {contextCanonicalJson:serialized},
    {contextCanonicalJson:serialized,contextSha256:createHash('sha256').update(serialized).digest('hex')},
    {contextCanonicalJson:syntheticWorkshopContext('cedar').canonicalJson,contextSha256:syntheticWorkshopContext('cedar').sha256},
    {contextCanonicalJson:undefined},
  ]) {await writeFile(path,JSON.stringify({...JSON.parse(raw),...patch}));assert.throws(()=>store.load(id(1)));}
  const changed=JSON.parse(raw);changed.work.record.rawResponse+=' ';await writeFile(path,JSON.stringify(changed));assert.throws(()=>store.load(id(1)));
  await writeFile(path,raw);assert.deepEqual(store.load(id(1)).work,work);
}));

test('staging recovery leaves unrecognized, public, symlinked, and extra hardlinks untouched',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);store.save(id(1),0,work);
  const published=join(root,(await readdir(root))[0]!);const original=await readFile(published,'utf8');
  const pending=join(root,'.pending-'+'a'.repeat(32));const extra=join(root,'unexpected-link');
  await link(published,pending);await link(published,extra);
  store.recoverInterruptedSave();assert.equal((await stat(published)).nlink,3);assert.throws(()=>store.load(id(1)));
  await rm(extra);store.recoverInterruptedSave();assert.equal((await stat(published)).nlink,1);assert.equal(await readFile(published,'utf8'),original);assert.equal(store.load(id(1)).version,1);
  const orphan=join(root,'.pending-'+'b'.repeat(32));await writeFile(orphan,'incomplete',{mode:0o600});
  const unknown=join(root,'unrecognized');await writeFile(unknown,'kept',{mode:0o600});
  const unpaired=join(root,'.pending-'+'c'.repeat(32));await link(unknown,unpaired);
  const publicPending=join(root,'.pending-'+'d'.repeat(32));await writeFile(publicPending,'kept',{mode:0o644});
  const symlinkPending=join(root,'.pending-'+'e'.repeat(32));await symlink(published,symlinkPending);
  store.recoverInterruptedSave();const names=await readdir(root);assert.ok(!names.includes(orphan.split('/').at(-1)!));
  for(const path of [unknown,unpaired,publicPending,symlinkPending])assert.ok(names.includes(path.split('/').at(-1)!));
  assert.equal(await readFile(published,'utf8'),original);
}));
test('preexisting over-capacity stores remain listable but cannot admit another document',()=>fixture(async root=>{
  const store=new LocalWorkStore(options(root),context);const saved=store.save(id(1),0,work);
  const name=(await readdir(root))[0]!;
  for(let n=2;n<=101;n++)await writeFile(join(root,name.replace(id(1),id(n))),canonicalJson({...saved,documentId:id(n)})+'\n',{mode:0o600});
  const original=await bytes(root);assert.equal(store.list().length,101);
  assert.throws(()=>store.save(id(102),0,work),/document limit/);assert.deepEqual(await bytes(root),original);
  assert.equal(store.save(id(1),1,work).version,2);
}));
