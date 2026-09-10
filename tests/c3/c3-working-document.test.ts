import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate as issuedMeetingCandidate } from '../fixtures/c3-workshop.ts';
import { startC3Server as startProductionC3Server, type RunningC3Server } from '../../src/c3/service.ts';
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord as createOriginalGenerationRecord, type C3GenerationRecord } from '../../src/c3/draft.ts';
import { createRecordOriginReceipt, type RecordOriginReceipt, LocalWorkStore } from '../../src/c3/work-store.ts';
import { RecordedReplayC3ModelProvider } from '../../src/c3/provider.ts';
import { createC3VerificationRequest, retainC3Verification } from '../../src/c3/generation-contract-v6.ts';
import { scriptedFullCoverage } from './c3-generation-scripted.ts';
import { canonicalJson } from '../../src/c3/context.ts';

// Authored fresh-operation fixtures: scripted checks exercise custody and Apply, not evidence semantics.
const syntheticMeetingCandidate: typeof issuedMeetingCandidate = (...args) =>
  JSON.stringify({ ...JSON.parse(issuedMeetingCandidate(...args)), assertions: [] });
const createGenerationRecord: typeof createOriginalGenerationRecord = (model, raw, context, verification) => {
  if (model.generationContractVersion === '6' && !verification) {
    const check = createC3VerificationRequest(model, raw, context);
    verification = retainC3Verification(check, scriptedFullCoverage(check));
  }
  return createOriginalGenerationRecord(model, raw, context, verification);
};
const startC3Server: typeof startProductionC3Server = options => startProductionC3Server({
  ...options,
  provider: { name: options.provider.name, executionMode: options.provider.executionMode,
    generate: (request, signal) => options.provider.generate(request, signal),
    verify: (request, signal) => options.provider.verify ? options.provider.verify(request, signal) : Promise.resolve(scriptedFullCoverage(request)) },
  generationAudit: options.generationAudit ?? { async retainCandidate() {}, async retainRecord() {}, async retainFailure() {} },
});
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
  const call = async (path:string, body?:unknown, displayedDocument?:string, headerOverrides:Record<string,string|undefined>={}) => {
    const req = new PassThrough() as unknown as IncomingMessage;
    Object.assign(req,{ method:body === undefined?'GET':'POST',url:path,headers:{host:'127.0.0.1:4317',cookie,origin:server.origin,'content-type':'application/json','x-c3-csrf':csrf,'x-c3-document':displayedDocument ?? documentId,...headerOverrides} });
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
test('explicit authored replay custody stays synthetic through proposal, Apply, save and restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-authored-origin-'));
 const initial=createOriginalGenerationRecord(createC3ModelRequest(ctx,request,undefined,'5'),issuedMeetingCandidate(ctx),ctx);
 const correction='Use the authored revised opening.';
 const revision=createOriginalGenerationRecord(createC3ModelRequest(ctx,request,createC3RevisionContext(initial,correction,1),'5'),issuedMeetingCandidate(ctx,true),ctx);
 const options={context:ctx,syntheticPreview:true,listen:false,provider:{name:'synthetic-authored-preview',executionMode:'local' as const,async generate(model:ReturnType<typeof createC3ModelRequest>){return model.revision?revision.rawResponse:initial.rawResponse;}},recordedReplay:{initialRequest:request,correctionNote:correction,priorRecord:initial,revisionRecord:revision},workStore:{root,principal:'synthetic-operator'}};
 let server=await startProductionC3Server(options);
 try{
  const b=await browser(server);const setup=await b.call('/?prepare=1');assert.match(setup.text,/Open exact authored example/);assert.match(setup.text,/Only the exact authored example request is available/);assert.doesNotMatch(setup.text,/Replay exact recorded response/);const generated=await b.call('/api/generate',envelope());assert.equal(generated.status,200);
  const check=(html:string)=>{assert.match(html,/>Synthetic example<\/span>/);assert.match(html,/Hand-authored fixtures/);assert.doesNotMatch(html,/>Historical replay<\/span>/);assert.doesNotMatch(html,/Recorded instruction/);};
  check(generated.json().html);
  const stage=(await b.call('/api/revise',{recordId:initial.recordId,note:correction,priorNote:''})).json();
  const proposed=(await b.call('/api/generate',envelope(initial.recordId,stage.pendingRevisionToken))).json();assert.equal(proposed.proposalReady,true);assert.equal(proposed.proposalId,revision.recordId);
  const applied=await b.call('/api/apply-revision',{recordId:initial.recordId,proposalId:revision.recordId,instruction:correction,pendingRevisionToken:stage.pendingRevisionToken});assert.equal(applied.status,200);check(applied.json().html);
  const state=(await b.call('/api/work-state',{})).json();const saved=await b.call('/api/save',{recordId:revision.recordId,documentId:state.documentId,expectedVersion:0,workVersion:state.workVersion});assert.equal(saved.status,200);
  const stored=JSON.parse(await readFile(join(root,(await readdir(root)).find(f=>f.endsWith('.json'))!),'utf8'));assert.deepEqual(stored.metadata.origins.map((receipt:RecordOriginReceipt)=>receipt.origin),['synthetic','synthetic']);
  await server.close();server=await startProductionC3Server(options);const fresh=await browser(server);const reopened=await fresh.call('/api/reopen',{documentId:state.documentId});assert.equal(reopened.status,200);check((await fresh.call('/?draft=1')).text);
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
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
  const b=await browser(server); assert.ok((await b.call('/?view=workshop')).text.includes(`data-reopen-work="${state.documentId}"`));
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

for (const kind of ['general', 'section'] as const) for (const timing of ['running', 'returned'] as const) {
 test(`${kind} note change ${timing} revision invalidates Apply across Save and restart; no-change stays current`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-note-stale-'));
  let release!: (raw: string) => void;
  const options = { context: ctx, listen: false, workStore: { root, principal: 'operator-one' },
   provider: { name: 'synthetic', executionMode: 'local' as const, async generate(model: ReturnType<typeof createC3ModelRequest>) {
    if (!model.revision || timing === 'returned') return syntheticMeetingCandidate(ctx);
    return new Promise<string>(resolve => { release = resolve; });
   } } };
  let server = await startC3Server(options);
  try {
   const b = await browser(server);
   const first = (await b.call('/api/generate', envelope())).json();
   const stage = (await b.call('/api/revise', { recordId: first.recordId, note: 'Improve opening', priorNote: '' })).json();
   const generating = b.call('/api/generate', envelope(first.recordId, stage.pendingRevisionToken));
   await new Promise(resolve => setImmediate(resolve));
   let proposed = timing === 'returned' ? (await generating).json() : undefined;
   const note = (text: string, prior: string) => kind === 'general'
    ? b.call('/api/note', { recordId: first.recordId, note: text, priorNote: prior })
    : b.call('/api/section-note', { recordId: first.recordId, section: 'Opening', text, priorText: prior });
   assert.equal((await note('', '')).json().noChange, true);
   assert.equal((await b.call('/api/work-state', {})).json().snapshot.proposalStale, false);
   assert.equal((await note('Changed in another tab', '')).status, 200);
   assert.equal((await b.call('/api/work-state', {})).json().snapshot.proposalStale, true);
   // Reverting text never revives a proposal generated before the edit.
   assert.equal((await note('', 'Changed in another tab')).status, 200);
   if (timing === 'running') { release(syntheticMeetingCandidate(ctx)); proposed = (await generating).json(); }
   assert.equal((await b.call('/api/work-state', {})).json().snapshot.proposalStale, true);
   const apply = { recordId: first.recordId, proposalId: proposed.proposalId, instruction: 'Improve opening', pendingRevisionToken: stage.pendingRevisionToken };
   assert.equal((await b.call('/api/apply-revision', apply)).status, 409);
   const state = (await b.call('/api/work-state', {})).json();
   assert.equal((await b.call('/api/save', { recordId: first.recordId, documentId: state.documentId, expectedVersion: 0, workVersion: state.workVersion })).status, 200);
   await server.close(); server = await startC3Server(options);
   const fresh = await browser(server);
   assert.equal((await fresh.call('/api/reopen', { documentId: state.documentId })).status, 200);
   assert.equal((await fresh.call('/api/work-state', {})).json().snapshot.proposalStale, true);
   assert.equal((await fresh.call('/api/apply-revision', apply)).status, 409);
  } finally { release?.(syntheticMeetingCandidate(ctx)); await server.close(); await rm(root, { recursive: true, force: true }); }
 });
}

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
  const fresh=await browser(running);assert.equal(((await fresh.call('/?view=workshop')).text.match(/data-reopen-work="doc_[a-f0-9]{24}"/g)??[]).length,2);
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

 test('title uses bounded CAS, preserves pending work, and Save supplies durable metadata',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c3-title-'));
  const options={context:ctx,provider,listen:false,now:()=>new Date('2026-09-09T08:30:00.000Z'),workStore:{root,principal:'operator-one'}};
  let running=await startC3Server(options);
  try{
    const b=await browser(running);const first=(await b.call('/api/generate',envelope())).json();
    await b.call('/api/note',{recordId:first.recordId,note:'Retain note',priorNote:''});
    const stage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve opening',priorNote:'Retain note'})).json();
    await b.call('/api/generate',envelope(first.recordId,stage.pendingRevisionToken));
    const before=(await b.call('/api/work-state',{})).json();
    assert.equal(before.title,request.intendedOutcome);assert.equal(before.origin,'unknown');assert.equal(before.savedAt,undefined);
    const title={recordId:first.recordId,title:'Leadership preparation',workVersion:before.workVersion};
    const edited=await b.call('/api/work/title',title);assert.equal(edited.status,200);assert.deepEqual(edited.json(),{title:title.title,workVersion:before.workVersion+1});
    assert.equal((await b.call('/api/work/title',title)).status,409);
    for(const value of ['', ' ', 'x'.repeat(161), 'bad\nline', 1, null]) assert.equal((await b.call('/api/work/title',{...title,title:value,workVersion:before.workVersion+1})).status,400);
    assert.equal((await b.call('/api/work/title',{...title,origin:'live',workVersion:before.workVersion+1})).status,400);
    const after=(await b.call('/api/work-state',{})).json();assert.deepEqual(after.snapshot,before.snapshot);assert.equal(after.saved,false);
    const save=await b.call('/api/save',{recordId:first.recordId,documentId:after.documentId,expectedVersion:0,workVersion:after.workVersion});
    assert.equal(save.status,200);assert.equal(save.json().savedAt,'2026-09-09T08:30:00.000Z');assert.equal(save.json().origin,'unknown');
    await running.close();running=await startC3Server(options);
    const fresh=await browser(running);assert.equal((await fresh.call('/api/reopen',{documentId:after.documentId})).status,200);
    const reopened=(await fresh.call('/api/work-state',{})).json();assert.equal(reopened.title,title.title);assert.equal(reopened.savedAt,save.json().savedAt);assert.deepEqual(reopened.snapshot,before.snapshot);
  }finally{await running.close();await rm(root,{recursive:true,force:true});}
 });

const oldFixture=async(version: 2 | 3 | 4 = 2)=>JSON.parse(await readFile(new URL(version === 2 ? '../fixtures/c3-old-contract.json' : version === 3 ? '../fixtures/c3-v3-contract.json' : '../fixtures/c3-v4-contract.json',import.meta.url),'utf8'));
const oldReplay=(old:Awaited<ReturnType<typeof oldFixture>>)=>({initialRequest:old.initial.meetingRequest,correctionNote:old.revised.revision.correctionNote,priorRecord:old.initial,revisionRecord:old.revised});
const oldProvider=(old:Awaited<ReturnType<typeof oldFixture>>)=>new RecordedReplayC3ModelProvider([{request:old.initialRequest,rawResponse:old.initial.rawResponse},{request:old.revisedRequest,rawResponse:old.revised.rawResponse}]);

for (const origin of ['historical-replay', 'unknown'] as const) for (const pending of [false, true]) {
 test(`upgraded replay refuses another pair's ${origin} initial, pending=${pending}, without generation effects or lost notes`, async () => {
  const old = await oldFixture(4), root = await mkdtemp(join(tmpdir(), 'c3-replay-availability-'));
  // Identical meeting inputs and correction still cannot authorize a different full base.
  const correctionNote = old.revised.revision.correctionNote;
  const initialModel = createC3ModelRequest(old.context, old.initial.meetingRequest);
  const priorRecord = createGenerationRecord(initialModel, syntheticMeetingCandidate(old.context), old.context);
  const revisionModel = createC3ModelRequest(old.context, old.initial.meetingRequest, createC3RevisionContext(priorRecord, correctionNote, 1));
  const revisionRecord = createGenerationRecord(revisionModel, syntheticMeetingCandidate(old.context, true), old.context);
  assert.equal(priorRecord.outcome, 'succeeded'); assert.equal(revisionRecord.outcome, 'succeeded');
  const replay = new RecordedReplayC3ModelProvider([{request:initialModel,rawResponse:priorRecord.rawResponse},{request:revisionModel,rawResponse:revisionRecord.rawResponse}]);
  let calls = 0;
  const originReceipt = (record: C3GenerationRecord) => origin === 'historical-replay' && canonicalJson(record) === canonicalJson(old.initial)
    ? createRecordOriginReceipt(record, 'historical-replay', 'synthetic-old-custody') : undefined;
  const workStore = {root, principal:'synthetic-operator', originReceipt};
  const store = new LocalWorkStore(workStore, old.context);
  const saved = store.save('doc_777777777777777777777777', 0, {
    record:old.initial, records:[old.initial], correctionNote:'Keep old annotation', sectionNotes:{Opening:'Keep old section note'},
    instruction:pending ? correctionNote : '', pendingRevision:pending ? createC3RevisionContext(old.initial, correctionNote, 1) : null,
    pendingRevisionToken:pending ? 'p'.repeat(32) : null, proposal:null, proposalStale:false, workVersion:1,
  });
  const file = join(root, (await readdir(root))[0]!), bytes = await readFile(file, 'utf8');
  const running = await startProductionC3Server({context:old.context, listen:false, workStore,
    provider:{name:replay.name, executionMode:'local', async generate(model, signal){calls++; return replay.generate(model, signal);}},
    recordedReplay:{initialRequest:old.initial.meetingRequest, correctionNote, priorRecord, revisionRecord}});
  try {
    const b = await browser(running);
    assert.equal((await b.call('/api/reopen', {documentId:saved.documentId})).status, 200);
    const before = (await b.call('/api/work-state', {})).json(), status = running.status();
    assert.equal(before.origin, origin);
    const page = (await b.call('/?draft=1')).text;
    assert.match(page, /Revision unavailable\. No recorded response is configured for this exact brief/);
    assert.match(page, /data-revise disabled/);
    assert.match(page, /data-revision-panel[^>]*data-generation-available="false"/);
    assert.doesNotMatch(page, /<pre data-recorded-note>|<button[^>]*data-use-recorded-note/);
    assert.match(page, origin === 'historical-replay' ? />Historical replay<\/span>/ : /Origin not established/);
    const refused = await b.call('/api/revise', {recordId:old.initial.recordId, note:correctionNote, priorNote:'Keep old annotation'});
    assert.equal(refused.status, 409); assert.match(refused.json().error, /no revision staged or provider work started/);
    if (pending) {
      const attempt = {...envelope(old.initial.recordId, before.snapshot.pendingRevisionToken), request:old.initial.meetingRequest};
      for (let retry = 0; retry < 2; retry++) {
        const refused = await b.call('/api/generate', attempt);
        assert.equal(refused.status, 409); assert.match(refused.json().error, /no recorded response matches this brief and correction/);
      }
    } else {
      assert.equal((await b.call('/api/generate', {...envelope(old.initial.recordId), request:old.initial.meetingRequest})).json().noChange, true);
    }
    assert.deepEqual((await b.call('/api/work-state', {})).json(), before);
    assert.deepEqual(running.status(), status); assert.equal(calls, 0);
    assert.equal(await readFile(file, 'utf8'), bytes);
    assert.equal((await b.call('/api/note', {recordId:old.initial.recordId, note:'Updated old annotation', priorNote:'Keep old annotation'})).status, 200);
    const after = (await b.call('/api/work-state', {})).json();
    assert.equal((await b.call('/api/save', {recordId:old.initial.recordId, documentId:saved.documentId, expectedVersion:1, workVersion:after.workVersion})).status, 200);
    const retained = store.load(saved.documentId);
    assert.deepEqual(retained.work.record, old.initial); assert.deepEqual(retained.work.records, [old.initial]);
    assert.equal(retained.work.correctionNote, 'Updated old annotation'); assert.deepEqual(retained.work.sectionNotes, {Opening:'Keep old section note'});
    assert.deepEqual(retained.metadata?.origins, saved.metadata?.origins); assert.equal(await readFile(file, 'utf8'), bytes);
    // A new session can still complete the configured v6 pair, with no live/verifier fallback.
    const fresh = await browser(running);
    const generated = await fresh.call('/api/generate', {...envelope(), request:priorRecord.meetingRequest});
    assert.equal(generated.status, 200); assert.equal(generated.json().recordId, priorRecord.recordId);
    assert.match(generated.json().html, /<pre data-recorded-note>/); assert.doesNotMatch(generated.json().html, /data-revise disabled/);
    const stage = (await fresh.call('/api/revise', {recordId:priorRecord.recordId, note:correctionNote, priorNote:''})).json();
    const proposed = await fresh.call('/api/generate', {...envelope(priorRecord.recordId, stage.pendingRevisionToken), request:priorRecord.meetingRequest});
    assert.equal(proposed.status, 200); assert.equal(proposed.json().proposalId, revisionRecord.recordId);
    const applied = await fresh.call('/api/apply-revision', {recordId:priorRecord.recordId, proposalId:revisionRecord.recordId, instruction:correctionNote, pendingRevisionToken:stage.pendingRevisionToken});
    assert.equal(applied.status, 200); assert.match(applied.json().html, /No further recorded response is available/);
    assert.match(applied.json().html, /data-revise disabled/); assert.match(applied.json().html, /data-revision-panel[^>]*data-generation-available="false"/);
    assert.equal(calls, 2);
  } finally { await running.close(); await rm(root, {recursive:true, force:true}); }
 });
}
for (const version of [2, 3, 4] as const) test(`exact v${version} recorded service initial→revision→Apply→note→Save→restart→new browser keeps old identities`,async()=>{
 const old=await oldFixture(version);const root=await mkdtemp(join(tmpdir(),'c3-old-service-'));
 const options={context:old.context,provider:oldProvider(old),recordedReplay:oldReplay(old),listen:false,workStore:{root,principal:'synthetic-operator'},now:()=>new Date('2026-09-09T10:00:00Z')};
 let running=await startC3Server(options);
 try{
  const b=await browser(running);const first=await b.call('/api/generate',{...envelope(),request:old.initial.meetingRequest});
  assert.equal(first.status,200);assert.equal(first.json().recordId,old.initial.recordId);
  assert.equal((await b.call('/api/work-state',{})).json().origin,'historical-replay');
  const stage=(await b.call('/api/revise',{recordId:old.initial.recordId,note:old.revised.revision.correctionNote,priorNote:''})).json();
  const proposal=(await b.call('/api/generate',{...envelope(old.initial.recordId,stage.pendingRevisionToken),request:old.initial.meetingRequest})).json();
  assert.equal(proposal.proposalId,old.revised.recordId);assert.equal(proposal.recordId,old.initial.recordId);
  assert.equal((await b.call('/api/apply-revision',{recordId:old.initial.recordId,proposalId:proposal.proposalId,instruction:old.revised.revision.correctionNote,pendingRevisionToken:stage.pendingRevisionToken})).status,200);
  await b.call('/api/note',{recordId:old.revised.recordId,note:'Retained after Apply',priorNote:''});
  const state=(await b.call('/api/work-state',{})).json();
  const saved=(await b.call('/api/save',{recordId:state.recordId,documentId:state.documentId,workVersion:state.workVersion,expectedVersion:0})).json();
  assert.equal(saved.origin,'historical-replay');assert.equal(saved.savedAt,'2026-09-09T10:00:00.000Z');
  const stored=JSON.parse(await readFile(join(root,(await readdir(root)).find(name=>name.endsWith('.json'))!),'utf8'));
  assert.deepEqual(stored.work.records,[old.initial,old.revised]);assert.equal(stored.metadata.origins.length,2);
  await running.close();running=await startC3Server(options);
  const fresh=await browser(running);assert.equal((await fresh.call('/api/reopen',{documentId:state.documentId})).status,200);
  assert.equal((await fresh.call('/api/work-state',{})).json().snapshot.correctionNote,'Retained after Apply');
  assert.equal((await fresh.call('/api/work-state',{})).json().recordId,old.revised.recordId);
  await fresh.call('/?draft=1');assert.equal(running.status().generationAttempted,0);
 }finally{await running.close();await rm(root,{recursive:true,force:true});}
});
for (const version of [2, 3, 4] as const) test(`v${version} pending work opens without mutation; Apply keeps old proposal; genuinely new Generate uses v6`,async()=>{
 const old=await oldFixture(version);const root=await mkdtemp(join(tmpdir(),'c3-old-pending-'));
 for(const file of old.files)await writeFile(join(root,file.name),file.bytes,{mode:0o600});
 const captures:ReturnType<typeof createC3ModelRequest>[]=[];
 const running=await startC3Server({context:old.context,listen:false,provider:{name:'recorded-replay',executionMode:'external',async generate(model){captures.push(model);return syntheticMeetingCandidate(old.context,true);}},workStore:{root,principal:'synthetic-operator'}});
 try{
  const b=await browser(running);const pending=JSON.parse(old.files.find((file:any)=>JSON.parse(file.bytes).work.proposal!==null).bytes);
  assert.equal((await b.call('/api/reopen',{documentId:pending.documentId})).status,200);
  const before=(await b.call('/api/work-state',{})).json();assert.equal(before.origin,'unknown');assert.equal(before.savedAt,undefined);assert.equal(before.title,pending.work.record.meetingRequest.intendedOutcome);
  await b.call('/?draft=1');assert.equal(captures.length,0);
  assert.equal((await b.call('/api/apply-revision',{recordId:old.initial.recordId,proposalId:old.revised.recordId,instruction:pending.work.instruction,pendingRevisionToken:pending.work.pendingRevisionToken})).status,200);
  const stage=(await b.call('/api/revise',{recordId:old.revised.recordId,note:'Clarify next steps.',priorNote:pending.work.correctionNote})).json();
  const generated=await b.call('/api/generate',{...envelope(old.revised.recordId,stage.pendingRevisionToken),request:old.revised.meetingRequest});
  assert.equal(generated.status,200);assert.equal(captures[0]!.generationContractVersion,'6');assert.equal(captures[0]!.revision!.priorRawResponse,old.revised.rawResponse);
  for(const file of old.files)assert.equal(await readFile(join(root,file.name),'utf8'),file.bytes);
  const awaiting=JSON.parse(old.files.find((file:any)=>{const w=JSON.parse(file.bytes).work;return w.pendingRevision && !w.proposal;}).bytes);
  const fresh=await browser(running);assert.equal((await fresh.call('/api/reopen',{documentId:awaiting.documentId})).status,200);
  const state=(await fresh.call('/api/work-state',{})).json();assert.equal(state.snapshot.pendingRevisionToken,awaiting.work.pendingRevisionToken);assert.equal(state.snapshot.proposalId,null);
 }finally{await running.close();await rm(root,{recursive:true,force:true});}
});
test('versioned metadata verifies exact trusted custody, rejects forged origin, and leaves legacy bytes untouched',async()=>{
 const old=await oldFixture();const root=await mkdtemp(join(tmpdir(),'c3-origin-store-'));
 try{
  const file=old.files[2];await writeFile(join(root,file.name),file.bytes,{mode:0o600});const legacy=JSON.parse(file.bytes);
  const admitted=new Map<string,RecordOriginReceipt>([old.initial,old.revised].map((record:C3GenerationRecord)=>[record.recordId,createRecordOriginReceipt(record,'historical-replay',`admitted:${record.recordId}`)]));
  const originReceipt=(record:C3GenerationRecord)=>admitted.get(record.recordId);
  const store=new LocalWorkStore({root,principal:'synthetic-operator',originReceipt,now:()=>new Date('2026-09-09T12:00:00Z')},old.context);
  assert.deepEqual(store.load(legacy.documentId),legacy);assert.equal(store.origin(legacy.work.record),'historical-replay');
  assert.equal(new LocalWorkStore({root,principal:'synthetic-operator'},old.context).origin(legacy.work.record),'unknown');
  const saved=store.save(legacy.documentId,legacy.version,legacy.work,{title:'Preparation title'});assert.equal(saved.schemaVersion,'2');
  assert.deepEqual(saved.work,legacy.work);assert.equal(await readFile(join(root,file.name),'utf8'),file.bytes);
  const path=join(root,(await readdir(root)).find(name=>name!==file.name)!);const bytes=await readFile(path,'utf8');
  for(const patch of [{origin:'live'},{recordId:'c3_'+'0'.repeat(24)},{contextSha256:'0'.repeat(64)},{modelRequestSha256:'0'.repeat(64)},{rawResponseSha256:'0'.repeat(64)},{recordSha256:'0'.repeat(64)},{custodyReceiptId:'forged'}]){
   const changed=JSON.parse(bytes);Object.assign(changed.metadata.origins[0],patch);await writeFile(path,JSON.stringify(changed));assert.throws(()=>store.load(saved.documentId));
  }
  for(const metadata of [{title:''},{savedAt:'yesterday'},{origin:'live'},{origins:[saved.metadata!.origins[0],saved.metadata!.origins[0]]}]){
   const changed=JSON.parse(bytes);Object.assign(changed.metadata,metadata);await writeFile(path,JSON.stringify(changed));assert.throws(()=>store.load(saved.documentId));
  }
  await writeFile(path,bytes);assert.equal(store.load(saved.documentId).metadata!.title,'Preparation title');
  assert.throws(()=>new LocalWorkStore({root,principal:'synthetic-operator'},old.context).load(saved.documentId),/custody/);
  assert.equal(await readFile(join(root,file.name),'utf8'),file.bytes);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('fresh receipt origin survives Save/restart and Apply retains prior custody; runtime names grant nothing',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-live-receipt-'));const receipts=new Map<string,RecordOriginReceipt>();
 const trustedProvider={name:'deterministic-provider',executionMode:'external' as const,async generate(model:ReturnType<typeof createC3ModelRequest>){
  const raw=syntheticMeetingCandidate(ctx,model.revision!==null);const record=createGenerationRecord(model,raw,ctx);
  receipts.set(record.recordId,createRecordOriginReceipt(record,'live',`test-custody:${record.recordId}`));return raw;
 }};
 const options={context:ctx,provider:trustedProvider,listen:false,originReceipt:(record:C3GenerationRecord)=>receipts.get(record.recordId),workStore:{root,principal:'operator-one'}};
 let running=await startC3Server(options);
 try{
  const b=await browser(running);const first=(await b.call('/api/generate',envelope())).json();assert.equal((await b.call('/api/work-state',{})).json().origin,'live');
  const stage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve opening',priorNote:''})).json();
  const proposal=(await b.call('/api/generate',envelope(first.recordId,stage.pendingRevisionToken))).json();
  await b.call('/api/apply-revision',{recordId:first.recordId,proposalId:proposal.proposalId,instruction:'Improve opening',pendingRevisionToken:stage.pendingRevisionToken});
  const state=(await b.call('/api/work-state',{})).json();assert.equal(state.origin,'live');
  assert.equal((await b.call('/api/save',{recordId:state.recordId,documentId:state.documentId,expectedVersion:0,workVersion:state.workVersion})).json().origin,'live');
  await running.close();running=await startC3Server(options);const fresh=await browser(running);
  assert.equal((await fresh.call('/api/reopen',{documentId:state.documentId})).status,200);assert.equal((await fresh.call('/api/work-state',{})).json().origin,'live');
  const loaded=new LocalWorkStore({...options.workStore,originReceipt:options.originReceipt},ctx).load(state.documentId);
  assert.equal(loaded.metadata!.origins.length,2);assert.deepEqual(loaded.metadata!.origins.map(r=>r.recordId),loaded.work.records.map(r=>r.recordId));
 }finally{await running.close();await rm(root,{recursive:true,force:true});}
});

test('an admitted historical bundle and runtime preview flags cannot relabel unrelated saved records',async()=>{
 const old=await oldFixture();const root=await mkdtemp(join(tmpdir(),'c3-unrelated-origin-'));
 const record=createGenerationRecord(createC3ModelRequest(old.context,old.initial.meetingRequest,null,"5"),old.initial.rawResponse,old.context);
 const prior=JSON.parse(old.files[2].bytes).work;
 const store=new LocalWorkStore({root,principal:'synthetic-operator'},old.context);
 const saved=store.save('doc_555555555555555555555555',0,{...prior,record,records:[record],proposal:null,pendingRevision:null,pendingRevisionToken:null});
 const filename=(await readdir(root))[0]!;const bytes=await readFile(join(root,filename),'utf8');
 const running=await startC3Server({context:old.context,provider:oldProvider(old),recordedReplay:oldReplay(old),syntheticPreview:true,listen:false,workStore:{root,principal:'synthetic-operator'}});
 try{
  const b=await browser(running);assert.equal((await b.call('/api/reopen',{documentId:saved.documentId})).status,200);
  const state=(await b.call('/api/work-state',{})).json();assert.equal(state.origin,'unknown');
  const page=(await b.call('/?draft=1')).text;assert.doesNotMatch(page,/Recorded initial — before correction|Recorded revised — after correction|Synthetic initial/);
  assert.equal(running.status().generationAttempted,0);assert.equal(await readFile(join(root,filename),'utf8'),bytes);
 }finally{await running.close();await rm(root,{recursive:true,force:true});}
});

test('explicit invalidation validates identity and CAS, leaves notes untouched, and survives Save and restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'c3-unsent-invalidation-'));const options={context:ctx,provider,listen:false,workStore:{root,principal:'operator-one'}};let server=await startC3Server(options);
 try{
  const b=await browser(server);const first=(await b.call('/api/generate',envelope())).json();
  const stage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve opening',priorNote:''})).json();
  const proposal=(await b.call('/api/generate',envelope(first.recordId,stage.pendingRevisionToken))).json();
  const state=(await b.call('/api/work-state',{})).json();const invalidation={recordId:first.recordId,pendingRevisionToken:stage.pendingRevisionToken,proposalId:proposal.proposalId,workVersion:state.workVersion};
  for(const change of [{recordId:'c3_'+'f'.repeat(24)},{pendingRevisionToken:'z'.repeat(32)},{proposalId:null},{workVersion:state.workVersion-1},{note:'Must not submit typing'}, {proposalStale:false}])assert.equal((await b.call('/api/revision-invalidate',{...invalidation,...change})).status,409);
  assert.equal((await b.call('/api/revision-invalidate',invalidation,'doc_'+'f'.repeat(24))).status,409);
  for(const headers of [{'x-c3-csrf':'invalid'},{origin:'http://untrusted.invalid'},{'content-type':'text/plain'}])assert.equal((await b.call('/api/revision-invalidate',invalidation,undefined,headers)).status,403);
  assert.equal((await b.call('/api/work-state',{})).json().snapshot.proposalStale,false);
  const result=await b.call('/api/revision-invalidate',invalidation);assert.equal(result.status,200);assert.equal(result.json().workVersion,state.workVersion+1);
  const next=(await b.call('/api/work-state',{})).json();assert.equal(next.snapshot.proposalStale,true);assert.equal(next.snapshot.correctionNote,'');assert.deepEqual(next.snapshot.sectionNotes,{});assert.equal((await readdir(root)).length,0,'session invalidation alone never saves');
  assert.equal((await b.call('/api/revision-invalidate',{...invalidation,workVersion:next.workVersion})).json().workVersion,next.workVersion,'idempotent at current version');
  assert.equal((await b.call('/api/save',{recordId:first.recordId,documentId:state.documentId,expectedVersion:0,workVersion:next.workVersion})).status,200);
  await server.close();server=await startC3Server(options);const fresh=await browser(server);assert.equal((await fresh.call('/api/reopen',{documentId:state.documentId})).status,200);
  assert.equal((await fresh.call('/api/work-state',{})).json().snapshot.proposalStale,true);assert.match((await fresh.call('/?draft=1')).text,/data-proposal-stale="true"/);
  assert.equal((await fresh.call('/api/apply-revision',{...invalidation,instruction:'Improve opening'})).status,409);
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
