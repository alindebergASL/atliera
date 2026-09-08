import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';
import { startC3Server, type RunningC3Server } from '../../src/c3/service.ts';
import { createC3ModelRequest, createGenerationRecord } from '../../src/c3/draft.ts';
import { LocalWorkStore } from '../../src/c3/work-store.ts';
const ctx = syntheticWorkshopContext();
const request = syntheticMeetingRequest;
class Response extends EventEmitter {
  status = 200; headers: Record<string,string> = {}; text = ''; writableEnded = false;
  done: Promise<void>; finish!: () => void;
  constructor() { super(); this.done = new Promise(resolve => { this.finish = resolve; }); }
  setHeader(k:string,v:string) { this.headers[k] = v; }
  writeHead(s:number,h:Record<string,string>) { this.status=s; Object.assign(this.headers,h); }
  end(s:string) { this.text=s; this.writableEnded=true; this.finish(); }
}
async function browser(server:RunningC3Server) {
  let cookie='',csrf='',documentId='';
  const call = async (path:string, body?:unknown, displayedDocument?:string) => {
    const req = new PassThrough() as unknown as IncomingMessage;
    Object.assign(req,{ method:body === undefined?'GET':'POST',url:path,headers:{host:'127.0.0.1:4317',cookie,origin:server.origin,'content-type':'application/json','x-c3-csrf':csrf,'x-c3-document':displayedDocument ?? documentId} });
    const res = new Response(); server.server.emit('request',req,res as unknown as ServerResponse);
    (req as unknown as PassThrough).end(body === undefined?undefined:JSON.stringify(body)); await res.done;
    if(res.status<300){const meta=res.text.match(/name="c3-document" content="([^"]+)"/);if(meta)documentId=meta[1]!;if(body!==undefined){const result=JSON.parse(res.text);if(result.documentId)documentId=result.documentId;else if(result.html){const rendered=result.html.match(/name="c3-document" content="([^"]+)"/);if(rendered)documentId=rendered[1]!;}}}
    return {status:res.status,text:res.text,json:()=>JSON.parse(res.text),headers:res.headers};
  };
  const home=await call('/'); cookie=home.headers['set-cookie']!.split(';')[0]!; csrf=home.text.match(/name="c3-csrf" content="([^"]+)"/)![1]!;
  return {call};
}
let operation=0;
const envelope=(recordId:string|null=null,pendingRevisionToken:string|null=null)=>({request,recordId,pendingRevisionToken,operationId:String(++operation).padStart(32,'x')});
const provider={name:'synthetic',executionMode:'local' as const,async generate(model:ReturnType<typeof createC3ModelRequest>) { const raw=JSON.parse(syntheticMeetingCandidate(ctx)); if(model.revision) raw.opening.text='Ask which outcome should guide this conversation.'; return JSON.stringify(raw); }};
test('revision is a proposal; stale instruction/base cannot apply; annotations survive Apply and Keep',async()=>{
  const server=await startC3Server({context:ctx,provider,listen:false});
  try {
    const b=await browser(server); const first=(await b.call('/api/generate',envelope())).json();
    assert.equal((await b.call('/api/section-note',{recordId:first.recordId,section:'Opening',text:'Separate annotation',priorText:''})).status,200);
    const stage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve the opening.',priorNote:''})).json();
    assert.equal(stage.location,'/?draft=1');
    const proposed=(await b.call('/api/generate',envelope(first.recordId,stage.pendingRevisionToken))).json();
    assert.equal(proposed.proposalReady,true); assert.equal(proposed.recordId,first.recordId);
    assert.match((await b.call('/?draft=1')).text,/Confirm what matters to this audience before proposing a direction/);
    assert.equal((await b.call('/api/revision-instruction',{recordId:first.recordId,instruction:'A newer instruction',priorInstruction:'Improve the opening.'})).status,200);
    const apply={recordId:first.recordId,proposalId:proposed.proposalId,instruction:'Improve the opening.',pendingRevisionToken:stage.pendingRevisionToken};
    assert.equal((await b.call('/api/apply-revision',apply)).status,409);
    assert.equal((await b.call('/api/revision-instruction',{recordId:first.recordId,instruction:'Improve the opening.',priorInstruction:'A newer instruction'})).status,200);
    assert.equal((await b.call('/api/apply-revision',{...apply,recordId:'c3_'+'0'.repeat(24)})).status,409);
    assert.equal((await b.call('/api/apply-revision',apply)).status,409,'editing back does not freshen an invalidated proposal');
    const regeneratedStage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve the opening.',priorNote:''})).json();
    const regenerated=(await b.call('/api/generate',envelope(first.recordId,regeneratedStage.pendingRevisionToken))).json();
    const applied=await b.call('/api/apply-revision',{...apply,proposalId:regenerated.proposalId,pendingRevisionToken:regeneratedStage.pendingRevisionToken}); assert.equal(applied.status,200); assert.notEqual(applied.json().recordId,first.recordId);
    assert.match((await b.call('/?draft=1')).text,/Separate annotation/);
    const second=(await b.call('/api/revise',{recordId:applied.json().recordId,note:'Try another opening.',priorNote:''})).json();
    assert.equal((await b.call('/api/discard-revision',{recordId:applied.json().recordId,pendingRevisionToken:second.pendingRevisionToken})).status,200);
    assert.match((await b.call('/?draft=1')).text,/Separate annotation/);
  } finally {await server.close();}
});
const work = () => { const record=createGenerationRecord(createC3ModelRequest(ctx,request),syntheticMeetingCandidate(ctx),ctx); return {record,records:[record],correctionNote:'Private note',sectionNotes:{Opening:'Note'},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1}; };
test('private store validates identities, CAS, corruption, and failed acknowledgement without overwriting good history',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-work-'));
 try {
  const store=new LocalWorkStore({root,principal:'operator-one'},ctx);
  const one=store.save('doc_123456789012345678901234',0,work()); assert.equal(one.version,1);
  assert.equal(new LocalWorkStore({root,principal:'operator-one'},ctx).load(one.documentId).work.correctionNote,'Private note');
  assert.throws(()=>store.save(one.documentId,0,work()),/conflict/i);
  assert.throws(()=>new LocalWorkStore({root,principal:'operator-two'},ctx).load(one.documentId));
  assert.throws(()=>new LocalWorkStore({root,principal:'operator-one'},syntheticWorkshopContext('harbor','sparse')).load(one.documentId));
  const failing=new LocalWorkStore({root,principal:'operator-one',fault(stage){if(stage==='after-publish')throw Error('readback failure');}},ctx);
  assert.throws(()=>failing.save(one.documentId,1,{...work(),workVersion:2}),/readback failure/);
  assert.equal(store.load(one.documentId).version,2); assert.throws(()=>store.save(one.documentId,1,work()),/conflict/i);
  const files=(await readdir(root)).filter(f=>f.endsWith('.json')); assert.equal(files.length,2);
  const latest=files.sort().at(-1)!; const payload=JSON.parse(await readFile(join(root,latest),'utf8')); payload.work.record.rawResponse='corrupt'; await writeFile(join(root,latest),JSON.stringify(payload));
  assert.throws(()=>store.load(one.documentId)); assert.ok((await readFile(join(root,files.sort()[0]!),'utf8')).includes('Private note'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('save and reopen survive restart plus fresh browser and stale save is refused',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-restart-')); const options={context:ctx,provider,listen:false,workStore:{root,principal:'operator-one'}};
 let server=await startC3Server(options);
 try{
  const a=await browser(server); const generated=(await a.call('/api/generate',envelope())).json();
  const state=(await a.call('/api/work-state',{})).json();
  const saved=await a.call('/api/save',{recordId:generated.recordId,documentId:state.documentId,expectedVersion:0,workVersion:state.workVersion});
  assert.equal(saved.status,200); assert.equal(saved.json().saved,true);
  await server.close(); server=await startC3Server(options);
  const b=await browser(server); assert.match((await b.call('/?view=workshop')).text,/Reopen saved brief/);
  const reopened=await b.call('/api/reopen',{documentId:state.documentId}); assert.equal(reopened.status,200);
  assert.equal((await b.call('/api/work-state',{})).json().recordId,generated.recordId);
  assert.equal((await b.call('/api/save',{recordId:generated.recordId,documentId:state.documentId,expectedVersion:0,workVersion:state.workVersion})).status,409);
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});

test('notes and newer instruction survive a running revision; stale result never applies',async()=>{
 let finish!:(raw:string)=>void;let secondRequest:ReturnType<typeof createC3ModelRequest>|undefined;
 const running=await startC3Server({context:ctx,listen:false,provider:{name:'deferred',executionMode:'local',async generate(model){if(!model.revision)return syntheticMeetingCandidate(ctx);secondRequest=model;return new Promise(resolve=>{finish=resolve;});}}});
 try{
  const b=await browser(running);const first=(await b.call('/api/generate',envelope())).json();
  const stage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve opening',priorNote:''})).json();
  const generating=b.call('/api/generate',envelope(first.recordId,stage.pendingRevisionToken));await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await b.call('/api/section-note',{recordId:first.recordId,section:'Opening',text:'Note during generation',priorText:''})).status,200);
  assert.equal((await b.call('/api/revision-instruction',{recordId:first.recordId,instruction:'Newer typing during generation',priorInstruction:'Improve opening'})).status,200);
  finish(syntheticMeetingCandidate(ctx));const result=(await generating).json();assert.equal(result.recordId,first.recordId);assert.equal(result.stale,true);
  assert.equal(secondRequest!.revision!.priorRawResponse,syntheticMeetingCandidate(ctx));assert.deepEqual(secondRequest!.meetingRequest,request);
  assert.equal((await b.call('/api/apply-revision',{recordId:first.recordId,proposalId:result.proposalId,instruction:'Improve opening',pendingRevisionToken:stage.pendingRevisionToken})).status,409);
  const page=(await b.call('/?draft=1')).text;assert.match(page,/Note during generation/);assert.match(page,/Newer typing during generation/);
 }finally{await running.close();}
});

test('pending proposal and separate notes reopen after restart; acknowledgement failure never claims Saved',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-proposal-recovery-'));let fail=false;
 const options={context:ctx,provider,listen:false,workStore:{root,principal:'operator-one',fault(stage:string){if(fail && stage==='after-publish')throw Error('Injected acknowledgement failure');}}};
 let running=await startC3Server(options);
 try{
  const b=await browser(running);const first=(await b.call('/api/generate',envelope())).json();
  await b.call('/api/note',{recordId:first.recordId,note:'Independent note',priorNote:''});
  const stage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve opening',priorNote:'Independent note'})).json();
  const proposal=(await b.call('/api/generate',envelope(first.recordId,stage.pendingRevisionToken))).json();
  const state=(await b.call('/api/work-state',{})).json();fail=true;
  const payload={recordId:first.recordId,documentId:state.documentId,expectedVersion:0,workVersion:state.workVersion,principal:'browser-impersonation'};
  const rejected=await b.call('/api/save',payload);assert.equal(rejected.status,409);assert.equal((await b.call('/api/work-state',{})).json().saved,false);
  fail=false;assert.equal((await b.call('/api/save',payload)).status,409);
  await running.close();running=await startC3Server(options);
  const fresh=await browser(running);assert.equal((await fresh.call('/api/reopen',{documentId:state.documentId})).status,200);
  const page=(await fresh.call('/?draft=1')).text;assert.match(page,/Independent note/);assert.match(page,/Improve opening/);assert.match(page,/data-proposal-id="c3_/);
  assert.equal((await fresh.call('/api/apply-revision',{recordId:first.recordId,proposalId:proposal.proposalId,instruction:'Improve opening',pendingRevisionToken:stage.pendingRevisionToken})).status,200);
  assert.equal((await fresh.call('/api/work-state',{})).json().saved,false);
 }finally{await running.close();await rm(root,{recursive:true,force:true});}
});

test('private store refuses symlink and public roots, unsafe identifiers and pre-publication failure',async()=>{
 const {symlink,chmod,mkdir}=await import('node:fs/promises');const parent=await mkdtemp(join(tmpdir(),'c3-store-safety-'));const root=join(parent,'private');await mkdir(root,{mode:0o700});
 try{
  await symlink(root,join(parent,'alias'));assert.throws(()=>new LocalWorkStore({root:join(parent,'alias'),principal:'operator-one'},ctx));
  await chmod(root,0o755);assert.throws(()=>new LocalWorkStore({root,principal:'operator-one'},ctx));await chmod(root,0o700);
  assert.throws(()=>new LocalWorkStore({root:process.cwd(),principal:'operator-one'},ctx));
  const store=new LocalWorkStore({root,principal:'operator-one'},ctx);assert.throws(()=>store.save('../escape',0,work()));
  const first=store.save('doc_123456789012345678901234',0,work());
  const broken=new LocalWorkStore({root,principal:'operator-one',fault(){throw Error('Injected write failure');}},ctx);
  assert.throws(()=>broken.save(first.documentId,1,{...work(),workVersion:2}),/Injected write failure/);
  assert.equal(store.load(first.documentId).version,1);assert.deepEqual((await readdir(root)).filter(name=>name.startsWith('.')),[]);
  const file=(await readdir(root))[0]!;await rm(join(root,file));await symlink('/dev/zero',join(root,file));assert.throws(()=>store.load(first.documentId));
 }finally{await rm(parent,{recursive:true,force:true});}
});

test('two browser sessions use CAS; conflict keeps local notes and Save a copy offers recovery',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-cas-'));const running=await startC3Server({context:ctx,provider,listen:false,workStore:{root,principal:'operator-one'}});
 try{
  const a=await browser(running);const first=(await a.call('/api/generate',envelope())).json();const state=(await a.call('/api/work-state',{})).json();
  const save=(b:Awaited<ReturnType<typeof browser>>,state:any,route='/api/save')=>b.call(route,{recordId:first.recordId,documentId:state.documentId,expectedVersion:state.version,workVersion:state.workVersion});
  assert.equal((await save(a,state)).status,200);
  const b=await browser(running);assert.equal((await b.call('/api/reopen',{documentId:state.documentId})).status,200);
  await a.call('/api/note',{recordId:first.recordId,note:'First editor note',priorNote:''});await b.call('/api/note',{recordId:first.recordId,note:'Second editor note',priorNote:''});
  const as=(await a.call('/api/work-state',{})).json(),bs=(await b.call('/api/work-state',{})).json();
  assert.equal((await b.call('/api/reopen',{documentId:state.documentId})).status,409,'reopen does not silently discard unsaved notes');
  const attempts=await Promise.all([save(a,as),save(b,bs)]);assert.deepEqual(attempts.map(item=>item.status).sort(),[200,409]);
  const loser=attempts[0]!.status===409?a:b,losingState=attempts[0]!.status===409?as:bs;
  assert.match((await loser.call('/?draft=1')).text,/editor note/);assert.equal((await loser.call('/api/work-state',{})).json().saved,false);
  const copy=await save(loser,losingState,'/api/save-copy');assert.equal(copy.status,200);assert.notEqual(copy.json().documentId,state.documentId);
  const keptNote=attempts[0]!.status===409?'First editor note':'Second editor note';
  assert.equal((await loser.call('/api/note',{recordId:first.recordId,note:'Wrong document edit',priorNote:keptNote},state.documentId)).status,409,'same generation record cannot authorize edits to a different work document');
  assert.equal((await loser.call('/api/work-state',{})).json().saved,true);
  const fresh=await browser(running);assert.equal(((await fresh.call('/?view=workshop')).text.match(/>Reopen saved brief</g)??[]).length,2);
 }finally{await running.close();await rm(root,{recursive:true,force:true});}
});

test('stored envelope account and principal mismatches and edited model prose fail canonical load',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-work-validation-'));
 try{
  const store=new LocalWorkStore({root,principal:'operator-one'},ctx);const saved=store.save('doc_123456789012345678901234',0,work());const path=join(root,(await readdir(root))[0]!);const original=await readFile(path,'utf8');
  for(const mismatch of [{principal:'forged-operator'},{accountId:'other-account'},{contextSha256:'0'.repeat(64)},{version:99}]){await writeFile(path,JSON.stringify({...JSON.parse(original),...mismatch}));assert.throws(()=>store.load(saved.documentId));}
  const changed=JSON.parse(original);changed.work.record.draft.opening.text='Edited historical model prose';await writeFile(path,JSON.stringify(changed));assert.throws(()=>store.load(saved.documentId));
  await writeFile(path,original);assert.equal(store.load(saved.documentId).work.record.rawResponse,work().record.rawResponse);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('omitted optional date uses the disclosed freshness reference without changing the canonical request schema',async()=>{
 let captured:ReturnType<typeof createC3ModelRequest>|undefined;
 const running=await startC3Server({context:ctx,listen:false,now:()=>new Date('2026-09-08T12:00:00Z'),provider:{name:'synthetic',async generate(model){captured=model;return syntheticMeetingCandidate(ctx);}}});
 try{const b=await browser(running);const response=await b.call('/api/generate',{...envelope(),request:{...request,meetingDate:''}});assert.equal(response.status,200);assert.equal(captured!.meetingRequest.meetingDate,'2026-09-15');assert.deepEqual(Object.keys(captured!.meetingRequest).sort(),Object.keys(request).sort());}
 finally{await running.close();}
});


test('work-state binds same-session annotations and instruction to CAS without exposing owner identity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-snapshot-'));
 const running=await startC3Server({context:ctx,provider,listen:false,workStore:{root,principal:'operator-one'}});
 try{
  const tabs=await browser(running);const first=(await tabs.call('/api/generate',envelope())).json();
  const a=(await tabs.call('/api/work-state',{})).json();
  assert.deepEqual(a.snapshot,{correctionNote:'',sectionNotes:{},instruction:'',pendingRevisionToken:null,proposalId:null,proposalStale:false});
  await tabs.call('/api/note',{recordId:first.recordId,note:'Other tab general note',priorNote:''});
  await tabs.call('/api/section-note',{recordId:first.recordId,section:'Opening',text:'Other tab section note',priorText:''});
  await tabs.call('/api/revision-instruction',{recordId:first.recordId,instruction:'Other tab instruction',priorInstruction:''});
  const b=(await tabs.call('/api/work-state',{})).json();
  assert.equal(a.documentId,b.documentId);assert.equal(a.recordId,b.recordId);assert.equal(b.workVersion,a.workVersion+3);
  assert.deepEqual(b.snapshot,{correctionNote:'Other tab general note',sectionNotes:{Opening:'Other tab section note'},instruction:'Other tab instruction',pendingRevisionToken:null,proposalId:null,proposalStale:false});
  assert.doesNotMatch(JSON.stringify(b),/operator-one|principal|owner/);
  assert.equal((await tabs.call('/api/save',{recordId:a.recordId,documentId:a.documentId,expectedVersion:a.version,workVersion:a.workVersion})).status,409);
  assert.equal((await tabs.call('/api/save-copy',{recordId:a.recordId,documentId:a.documentId,expectedVersion:a.version,workVersion:a.workVersion})).status,409);
 }finally{await running.close();await rm(root,{recursive:true,force:true});}
});
