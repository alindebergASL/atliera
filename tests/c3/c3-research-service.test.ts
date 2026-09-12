import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startC3Server, type C3ServerOptions } from '../../src/c3/service.ts';
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';
import { createGenerationRecord, createC3ModelRequest, createC3RevisionContext } from '../../src/c3/generation-contract.ts';
import { DisabledC3ModelProvider } from '../../src/c3/provider.ts';
import { RESEARCH_HARD_LIMITS, researchHash, type ResearchTransport } from '../../src/c3/research-source.ts';
import { questionPassages } from '../../src/c3/research-render.ts';
import { AccountResearchService, validateAccountResearchConfiguration, type AccountResearchConfiguration } from '../../src/c3/research-service.ts';
import { readResearchConfiguration, researchLaunchArguments } from '../../src/c3/research-config.ts';
import { researchBrowser } from '../helpers/c3-research-browser.ts';
const now = () => new Date('2026-09-12T12:00:00.000Z');
const provider = new DisabledC3ModelProvider();
const root = () => mkdtempSync(join(tmpdir(),'c2-synthetic-'));
const text = 'Navigation home menu. SYNTHETIC service access requires a reviewed application. This source statement does not prove current service readiness. <script>hostile()</script>';
const response = (value = text) => ({status:200,mediaType:'text/plain',body:Buffer.from(value),bodyComplete:true});
const start = (options:C3ServerOptions) => startC3Server({...options,listen:process.env.C3_TEST_REAL_HTTP === '1'});
function configuration(accountId:string, retentionRoot:string): AccountResearchConfiguration {
  return {principal:'synthetic.operator',accountId,retentionRoot,enabled:true,validFrom:'2026-09-12T00:00:00.000Z',validUntil:'2026-09-13T00:00:00.000Z',
    scope:{principal:'synthetic.operator',accountId,question:'SYNTHETIC service access requirements',authorizationRef:'Synthetic fixture, no live grant',allowedHosts:['research.example.org'],
      targets:[{url:'https://research.example.org/access',redirectUrls:[],publisher:'Synthetic publisher',entityId:accountId,relationshipToAccount:'account'}],limits:{...RESEARCH_HARD_LIMITS}}};
}
async function settled(b:ReturnType<typeof researchBrowser>, id:string) {
  for(let i=0;i<30;i++) {
    const result=await b.call(id,'/api/research/status',{});assert.equal(result.status,200,result.text);
    const data=result.json();
    if(data.display.run && ['completed','failed','cancelled','interrupted'].includes(data.display.run.state)) return data;
    await new Promise(resolve=>setImmediate(resolve));
  }
  throw Error('Synthetic run did not settle');
}
test('SYNTHETIC real handler: two account acquisition, idempotency, source inspection, stale/foreign selection and restart',async t=>{
  t.diagnostic(process.env.C3_TEST_REAL_HTTP === '1' ? 'Local TCP only; synthetic source transport' : 'Production request handler and streams; no TCP or live source calls');
  const a=syntheticWorkshopContext('harbor'),z=syntheticWorkshopContext('cedar');
  const aid=a.context.account.accountId,zid=z.context.account.accountId;
  const ar=root(),zr=root();t.after(()=>{rmSync(ar,{recursive:true,force:true});rmSync(zr,{recursive:true,force:true});});
  const ac=configuration(aid,ar),zc=configuration(zid,zr);let calls=0,zCalls=0;
  const options={context:a,provider,now,research:{config:ac,testOnlyTransport:async()=>{calls++;return response();}},
    accounts:[{context:z,provider,now,research:{config:zc,testOnlyTransport:async()=>{zCalls++;return response('SYNTHETIC Cedar service access is source-reported to require review.');}}}]};
  let server=await start(options);
  try {
    const b=researchBrowser(server),other=researchBrowser(server);
    await b.call(aid,'/?view=research');await b.call(zid,'/?view=research');await other.call(aid,'/');
    assert.equal(calls,0);assert.equal(zCalls,0);assert.deepEqual(readdirSync(ar),[]);
    for(const body of [{url:'https://research.example.org/access'},{principal:'other'},{approved:true},{retentionRoot:'/tmp/no'},{accountId:zid}]) assert.equal((await b.call(aid,'/api/research/start',body)).status,409);
    assert.equal((await b.call(aid,'/api/research/start',{}, {'origin':'https://evil.invalid'})).status,403);
    assert.equal((await b.call(aid,'/api/research/start',{}, {'x-c3-account':zid})).status,403);
    assert.equal((await b.call(aid,'/api/research/start',{})).status,200);
    assert.equal((await b.call(aid,'/api/research/start',{})).status,200);
    const first=await settled(b,aid); assert.equal(calls,1); assert.equal(first.display.run.state,'completed');
    const old=first.display.snapshots[0],source=old.sources[0];
    assert.equal(source.rawSha256,researchHash(Buffer.from(text)));assert.equal(source.generationEligible,false);assert.equal(source.acquisition,'direct-source');
    assert.equal((await other.call(aid,'/api/research/run',{runId:old.runId})).status,409);
    assert.equal((await other.call(aid,'/api/research/cancel',{runId:old.runId})).status,409);
    assert.equal((await other.call(aid,'/api/research/snapshot',{snapshotId:old.snapshotId})).status,200,'historical snapshot belongs to account/principal, not ephemeral session');
    assert.equal((await b.call(zid,'/api/research/snapshot',{snapshotId:old.snapshotId})).status,409);
    const inspect=await b.call(aid,'/api/research/source',{snapshotId:old.snapshotId,sourceId:source.sourceId});assert.equal(inspect.status,200);
    assert.match(inspect.json().inspectionHtml,/Full retained clean-text/);assert.match(inspect.json().inspectionHtml,/&lt;script&gt;/);assert.doesNotMatch(inspect.json().inspectionHtml,/<script>/);
    assert.match(inspect.json().inspectionHtml,/Unknown \/ unknown \/ unknown/);assert.match(inspect.json().inspectionHtml,/positions/);
    const passage=questionPassages(source,ac.scope.question)[0]!;
    const selected={snapshotId:old.snapshotId,sourceId:source.sourceId,passageSha256:passage.sha256};
    const selection=(await b.call(aid,'/api/research/select',selected)).json().selection;assert.equal(selection.generationEligible,false);assert.equal(selection.findingId,null);assert.equal(selection.passage.text,source.cleanText.slice(passage.start,passage.end));
    await b.call(zid,'/api/research/start',{});await settled(b,zid);assert.equal(zCalls,1);assert.equal(calls,1);
    await b.call(aid,'/api/research/refresh',{snapshotId:old.snapshotId});await b.call(aid,'/api/research/refresh',{snapshotId:old.snapshotId});
    const refreshed=await settled(b,aid);assert.equal(calls,2);assert.equal(refreshed.display.comparison[0].change,'unchanged');
    assert.equal((await b.call(aid,'/api/research/select',selected)).status,409);assert.equal((await b.call(aid,'/api/research/snapshot',{snapshotId:old.snapshotId})).status,200);
    assert.equal((await b.call(aid,'/api/research/refresh',{snapshotId:refreshed.display.snapshots[1].snapshotId})).status,409);assert.equal(calls,2);
    await server.close();server=await start(options);
    const fresh=researchBrowser(server);const page=await fresh.call(aid,'/?view=research&topic=sources');assert.equal(page.status,200);assert.match(page.text,/2\/2|1\/1 requested sources captured/);
    const reopened=await fresh.call(aid,'/api/research/source',{snapshotId:old.snapshotId,sourceId:source.sourceId});assert.equal(reopened.status,200);assert.deepEqual(reopened.json().inspectedSource,source);assert.equal(calls,2);
    assert.equal((await fresh.call(aid,'/api/research/run',{runId:old.runId})).status,409);
    assert.equal(server.status().generationAttempted,0);
    const wrong=configuration(aid,ar);assert.throws(()=>new AccountResearchService({config:{...wrong,principal:'other',scope:{...wrong.scope,principal:'other'}},testOnlyTransport:async()=>response()},{accountId:aid},now),/ownership|scope/);
  } finally { await server.close(); }
});
test('SYNTHETIC handler cancellation, failure, changed bytes, expiry, no configuration and network disable',async t=>{
  const context=syntheticWorkshopContext('harbor'),other=syntheticWorkshopContext('cedar'),id=context.context.account.accountId;
  const dir=root();t.after(()=>rmSync(dir,{recursive:true,force:true}));let calls=0,enabled=true;
  let release!:(value:ReturnType<typeof response>)=>void;const gate=new Promise<ReturnType<typeof response>>(resolve=>{release=resolve;});
  const transport:ResearchTransport=async()=>{calls++;return calls===1?gate:response('SYNTHETIC service access application process has a different raw body.');};
  const server=await start({context,provider,now,research:{config:configuration(id,dir),testOnlyTransport:transport,networkEnabled:()=>enabled},accounts:[{context:other,provider}]});
  try {
    const b=researchBrowser(server);await b.call(id,'/?view=research');
    const unavailable=await b.call(other.context.account.accountId,'/?view=research');assert.match(unavailable.text,/No trusted per-account scope/);
    assert.equal((await b.call(other.context.account.accountId,'/api/research/start',{})).status,409);
    enabled=false;assert.equal((await b.call(id,'/api/research/start',{})).status,409);assert.equal(calls,0);enabled=true;
    const started=(await b.call(id,'/api/research/start',{})).json();
    assert.equal((await b.call(id,'/api/research/cancel',{runId:started.display.run.runId})).status,200);
    const cancelled=await settled(b,id);assert.equal(cancelled.display.run.state,'cancelled');release(response());
    await b.call(id,'/api/research/refresh',{snapshotId:cancelled.display.snapshots[0].snapshotId});
    const second=await settled(b,id);assert.equal(second.display.run.state,'completed');assert.equal(second.display.comparison[0].change,'added');assert.equal(calls,2);
  } finally {await server.close();}
  const expiredDir=root();t.after(()=>rmSync(expiredDir,{recursive:true,force:true}));
  const expired=await start({context,provider,now,research:{config:{...configuration(id,expiredDir),validUntil:'2026-09-12T01:00:00.000Z'},testOnlyTransport:async()=>{calls++;return response();}},accounts:[]});
  try {const b=researchBrowser(expired);await b.call(id,'/');assert.equal((await b.call(id,'/api/research/start',{})).status,409);assert.equal(calls,2);}finally{await expired.close();}
});
test('SYNTHETIC research does not mutate existing brief, notes, saved original evidence or pending work',async t=>{
  const context=syntheticWorkshopContext('harbor'),id=context.context.account.accountId,dir=root(),work=root();
  t.after(()=>{rmSync(dir,{recursive:true,force:true});rmSync(work,{recursive:true,force:true});});
  const record=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest,undefined,'5'),syntheticMeetingCandidate(context),context);
  const correction='Use the authored revised opening.';
  const revision=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest,createC3RevisionContext(record,correction,1),'5'),syntheticMeetingCandidate(context,true),context);
  assert.equal(record.outcome,'succeeded');assert.equal(revision.outcome,'succeeded');
  const options:C3ServerOptions={context,now,provider:{name:'synthetic-authored-preview',executionMode:'local',generate:async request=>request.revision?revision.rawResponse:record.rawResponse},
    syntheticPreview:true,recordedReplay:{initialRequest:syntheticMeetingRequest,correctionNote:correction,priorRecord:record,revisionRecord:revision},
    workStore:{root:work,principal:'synthetic.operator'},research:{config:configuration(id,dir),testOnlyTransport:async()=>response()},accounts:[]};
  let server=await start(options);
  try {
    const b=researchBrowser(server);await b.call(id,'/');
    const generated=await b.call(id,'/api/generate',{request:syntheticMeetingRequest,recordId:null,pendingRevisionToken:null,operationId:'a'.repeat(32)});
    assert.equal(generated.status,200,generated.text);assert.equal(generated.json().outcome,'succeeded');
    assert.equal((await b.call(id,'/api/note',{recordId:record.recordId,note:'Original unsaved note',priorNote:''})).status,200);
    const staged=(await b.call(id,'/api/revise',{recordId:record.recordId,note:correction,priorNote:'Original unsaved note'})).json();
    assert.equal((await b.call(id,'/api/generate',{request:syntheticMeetingRequest,recordId:record.recordId,pendingRevisionToken:staged.pendingRevisionToken,operationId:'b'.repeat(32)})).json().proposalReady,true);
    const before=(await b.call(id,'/api/work-state',{})).json();
    assert.equal((await b.call(id,'/api/research/start',{}, {'x-c3-document':'stale'})).status,409);
    await b.call(id,'/api/research/start',{});await settled(b,id);
    const after=(await b.call(id,'/api/work-state',{})).json();assert.deepEqual(after,before);
    const save=await b.call(id,'/api/save',{recordId:record.recordId,documentId:after.documentId,workVersion:after.workVersion,expectedVersion:after.version});
    assert.equal(save.status,200,save.text);
    const saved=save.json();
    const originalPage=(await b.call(id,'/?draft=1')).text;
    const snapshot=(await b.call(id,'/api/research/status',{})).json().display.snapshots[0];
    await b.call(id,'/api/research/refresh',{snapshotId:snapshot.snapshotId});await settled(b,id);
    assert.deepEqual((await b.call(id,'/api/work-state',{})).json().snapshot,before.snapshot);
    assert.equal((await b.call(id,'/?draft=1')).text,originalPage,'research never replaces historical workContext');
    await server.close();server=await start(options);
    const fresh=researchBrowser(server);await fresh.call(id,'/');
    const reopened=await fresh.call(id,'/api/reopen',{documentId:saved.documentId});assert.equal(reopened.status,200,reopened.text);
    const reopenedState=(await fresh.call(id,'/api/work-state',{})).json();assert.deepEqual(reopenedState.snapshot,before.snapshot);assert.equal(reopenedState.recordId,record.recordId);
  } finally {await server.close();}
});
test('SYNTHETIC CLI config is explicit, private, account-bound and disabled without enable flag',()=>{
  assert.deepEqual(researchLaunchArguments([]),{recording:undefined,configPath:undefined,enable:false});
  assert.throws(()=>researchLaunchArguments(['--enable-research']));assert.throws(()=>researchLaunchArguments(['--approved']));
  const dir=root(),retention=root(),accountId='synthetic_account',config=configuration(accountId,retention),file=join(dir,'config.json');
  try {
    writeFileSync(file,JSON.stringify([config]),{mode:0o600});
    assert.equal(readResearchConfiguration(file,false,[accountId])[0]!.enabled,false);
    assert.equal(readResearchConfiguration(file,true,[accountId])[0]!.enabled,true);
    assert.throws(()=>readResearchConfiguration(file,true,['other']));
    assert.throws(()=>validateAccountResearchConfiguration(config,accountId,'other'));
    assert.throws(()=>validateAccountResearchConfiguration(config,accountId,undefined,retention));
    assert.throws(()=>validateAccountResearchConfiguration({...config,approved:true} as any,accountId));
    assert.deepEqual(readdirSync(retention),[]);
  } finally {rmSync(dir,{recursive:true,force:true});rmSync(retention,{recursive:true,force:true});}
});

test('SYNTHETIC handler interrupted reservation: reads inert, explicit recovery keeps receipts and cap',async t=>{
  const {ResearchStore}=await import('../../src/c3/research-store.ts');
  const {researchIdentity}=await import('../../src/c3/research-source.ts');
  const {closeSync}=await import('node:fs');
  const context=syntheticWorkshopContext('harbor'),id=context.context.account.accountId,dir=root(),config=configuration(id,dir);
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const caller={principal:config.principal,accountId:id,sessionId:'browser_dead_session'};
  const scopeSha256=researchIdentity(config.scope),idempotencyKey='initial';
  const runId=`run_${researchIdentity([caller.principal,id,caller.sessionId,idempotencyKey,scopeSha256])}`;
  const store=new ResearchStore(dir,config.scope),lease=store.lock();
  try {store.append({...caller,kind:'atliera.c3.research-run',schemaVersion:'1',runId,idempotencyKey,ordinal:1,scope:config.scope,scopeSha256,state:'started',updatedAt:now().toISOString(),attempts:[],sources:[],error:null,snapshotId:null},lease);}finally{closeSync(lease);}
  const original=readFileSync(join(dir,'receipt-0001.json'));let calls=0;
  const server=await start({context,provider,now,research:{config,testOnlyTransport:async()=>{calls++;return response();}},accounts:[]});
  try {
    const b=researchBrowser(server);await b.call(id,'/?view=research');
    const status=(await b.call(id,'/api/research/status',{})).json();assert.equal(status.display.snapshots[0].state,'interrupted');assert.equal(status.display.remainingRuns,1);
    assert.equal(readdirSync(dir).length,1);assert.equal(calls,0);
    assert.equal((await b.call(id,'/api/research/recover',{})).status,200);assert.equal(readdirSync(dir).length,2);assert.equal(calls,0);assert.deepEqual(readFileSync(join(dir,'receipt-0001.json')),original);
    assert.equal((await b.call(id,'/api/research/refresh',{snapshotId:status.display.snapshots[0].snapshotId})).status,200);
    const done=await settled(b,id);assert.equal(done.display.remainingRuns,0);assert.equal(calls,1);assert.equal(done.display.run.state,'completed');
  } finally {await server.close();}
});
test('SYNTHETIC handler refresh reports changed bytes or unavailable acquisition; historical sources remain exact',async t=>{
  for(const failure of [false,true]) {
    const context=syntheticWorkshopContext('harbor'),id=context.context.account.accountId,dir=root();t.after(()=>rmSync(dir,{recursive:true,force:true}));let calls=0;
    const server=await start({context,provider,now,research:{config:configuration(id,dir),testOnlyTransport:async()=>{calls++;return calls===1?response():failure?{...response(),status:503}:response(text+' New source-reported service access text.');}},accounts:[]});
    try {
      const b=researchBrowser(server);await b.call(id,'/');await b.call(id,'/api/research/start',{});const first=(await settled(b,id)).display.snapshots[0];
      await b.call(id,'/api/research/refresh',{snapshotId:first.snapshotId});const second=await settled(b,id);
      assert.equal(second.display.comparison[0].change,failure?'unavailable':'changed');assert.equal(second.display.run.state,failure?'failed':'completed');
      if(failure)assert.equal(second.display.run.error,'http_status_refused');
      const retained=(await b.call(id,'/api/research/snapshot',{snapshotId:first.snapshotId})).json().inspectedSnapshot;assert.deepEqual(retained,first);assert.equal(calls,2);
    } finally {await server.close();}
  }
});
test('SYNTHETIC operator kill switch cancels active acquisition and refuses all future dispatch',async t=>{
  const context=syntheticWorkshopContext('harbor'),id=context.context.account.accountId,dir=root();t.after(()=>rmSync(dir,{recursive:true,force:true}));let calls=0;
  const server=await start({context,provider,now,research:{config:configuration(id,dir),testOnlyTransport:async()=>{calls++;return new Promise(()=>{});}},accounts:[]});
  try {
    const b=researchBrowser(server);await b.call(id,'/');await b.call(id,'/api/research/start',{});
    server.disableResearch(id);const cancelled=await settled(b,id);assert.equal(cancelled.display.run.state,'cancelled');assert.equal(cancelled.display.available,false);
    assert.equal((await b.call(id,'/api/research/refresh',{snapshotId:cancelled.display.snapshots[0].snapshotId})).status,409);assert.equal(calls,1);
  } finally {await server.close();}
});
