import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,readFileSync,readdirSync,renameSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {startC3Server} from '../../src/c3/service.ts';import {DisabledC3ModelProvider} from '../../src/c3/provider.ts';import {researchBrowser} from '../helpers/c3-research-browser.ts';import {LocalWorkStore,newWorkDocumentId} from '../../src/c3/work-store.ts';
import {syntheticWorkshopContext,syntheticMeetingCandidate,syntheticMeetingRequest} from '../fixtures/c3-workshop.ts';import {createC3ModelRequest,createGenerationRecord} from '../../src/c3/generation-contract.ts';
import {LocalInformationStore} from '../../src/c3/account-information-store.ts';import {newInformation,reviseInformation,informationAttachment} from '../../src/c3/account-information.ts';
const context=syntheticWorkshopContext(),accountId=context.context.account.accountId,principal='synthetic.operator';
const record=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest,undefined,'5'),syntheticMeetingCandidate(context),context);
test('disabled production journey includes, saves, reopens, compares and explicitly refreshes immutable snapshots',async t=>{
 const root=mkdtempSync(join(tmpdir(),'uv1-work-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const workStore={root:join(root,'work'),principal};
 const store=new LocalWorkStore(workStore,context);const documentId=newWorkDocumentId();const raw=record.rawResponse;
 store.save(documentId,0,{record,records:[record],correctionNote:'Preserve annotation',sectionNotes:{},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1});
 const options={context,provider:new DisabledC3ModelProvider(),workStore,accounts:[],listen:process.env.C3_TEST_REAL_HTTP==='1'};let server=await startC3Server(options);
 const information=new LocalInformationStore(workStore,accountId);
 const a={accountId,principal,at:'2026-09-13T12:00:00.000Z'};
 const item=newInformation({text:'Synthetic useful uncertainty.',entity:accountId,timeScope:'Unknown',evidence:[],origin:{kind:'source',contextSha256:context.sha256,binding:'synthetic-test'}},a);information.save(item,0);
 try{
  let b=researchBrowser(server);await b.call(accountId,'/');assert.equal((await b.call(accountId,'/api/reopen',{documentId})).status,200);
  let accountPage=await b.call(accountId,'/');assert.match(accountPage.text,/data-working-brief-status role="status">Brief saved/);assert.ok(accountPage.text.includes('href="/accounts/'+accountId+'/?draft=1">Return to working brief'));
  let state=(await b.call(accountId,'/api/work-state',{})).json();
  const change={action:'add',id:item.id,informationVersion:1,workVersion:state.workVersion,recordId:record.recordId};
  const included=await b.call(accountId,'/api/work/information',change);assert.equal(included.status,200,included.text);assert.equal(included.json().saved,false);
  assert.equal((await b.call(accountId,'/api/work/information',change)).status,409);state=(await b.call(accountId,'/api/work-state',{})).json();assert.equal(state.saved,false);
  accountPage=await b.call(accountId,'/');assert.match(accountPage.text,/data-working-brief-status role="status">Pending brief changes/);assert.equal(store.load(documentId).version,1);
  const save=()=>b.call(accountId,'/api/save',{recordId:record.recordId,documentId:state.documentId,expectedVersion:state.version,workVersion:state.workVersion,informationAttachmentsSha256:state.attachmentDigest});
  const saved=await save();assert.equal(saved.status,200,saved.text);assert.equal(saved.json().version,2);
  accountPage=await b.call(accountId,'/');assert.match(accountPage.text,/data-working-brief-status role="status">Brief saved/);
  const bytes=readFileSync(join(workStore.root,readdirSync(workStore.root).find(n=>n.endsWith('v000002.json'))!),'utf8');
  assert.equal(store.load(documentId).schemaVersion,'4');assert.equal(store.load(documentId).work.record.rawResponse,raw);
  let revised=reviseInformation(item,{action:'validate',reason:'Observed directly',firsthand:'I attended',evidenceIds:[]},a);information.save(revised,1);
  revised=reviseInformation(revised,{action:'reopen',reason:'Freshness now needs a recheck'},a);information.save(revised,2);
  await server.close();server=await startC3Server(options);b=researchBrowser(server);await b.call(accountId,'/');await b.call(accountId,'/api/reopen',{documentId});
  let page=await b.call(accountId,'/?draft=1');assert.match(page.text,/Current status changed/);assert.match(page.text,/Not independently checked/);assert.match(page.text,/Preserve annotation/);
  state=(await b.call(accountId,'/api/work-state',{})).json();assert.equal(state.version,2);assert.equal(state.snapshot.informationAttachments[0].snapshot.version,1);
  const refresh=await b.call(accountId,'/api/work/information',{...change,action:'refresh',informationVersion:3,workVersion:state.workVersion});assert.equal(refresh.status,200,refresh.text);
  state=(await b.call(accountId,'/api/work-state',{})).json();assert.equal(state.version,2);assert.equal(state.saved,false);assert.equal(store.load(documentId).version,2);
  assert.equal((await save()).json().version,3);assert.equal(readFileSync(join(workStore.root,readdirSync(workStore.root).find(n=>n.endsWith('v000002.json'))!),'utf8'),bytes);
  state=(await b.call(accountId,'/api/work-state',{})).json();const copy=await b.call(accountId,'/api/save-copy',{recordId:record.recordId,documentId:state.documentId,expectedVersion:state.version,workVersion:state.workVersion,informationAttachments:state.snapshot.informationAttachments});assert.equal(copy.status,200,copy.text);assert.equal(store.load(copy.json().documentId).work.informationAttachments?.length,1);
  renameSync(information.root,information.root+'.unavailable');page=await b.call(accountId,'/?draft=1');assert.match(page.text,/Current status unavailable/);assert.match(page.text,/Synthetic useful uncertainty/);
  assert.equal(server.status().generationAttempted,0);
 }finally{await server.close();}
});
test('successful generation guard and attachment principal binding remain mandatory',()=>{
 const root=mkdtempSync(join(tmpdir(),'uv1-guard-'));try{const store=new LocalWorkStore({root:join(root,'work'),principal},context);const failed=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest),'{}',context);
 const work={record:failed,records:[failed],correctionNote:'',sectionNotes:{},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1};assert.throws(()=>store.save(newWorkDocumentId(),0,work),/successful/);
 const item=newInformation({text:'Synthetic statement',entity:accountId,timeScope:'Unknown',evidence:[],origin:{kind:'source',contextSha256:context.sha256,binding:'synthetic'}},{accountId,principal:'foreign.operator',at:'2026-09-13T12:00:00.000Z'});
 assert.throws(()=>store.save(newWorkDocumentId(),0,{...work,record,records:[record],informationAttachments:[informationAttachment(item)]}),/identity/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('new retained research stays inspectable in attachment without grafting into original context',async t=>{
 const {mkdirSync}=await import('node:fs');const {BoundedResearchExecution}=await import('../../src/c3/research-run.ts');const {RESEARCH_HARD_LIMITS}=await import('../../src/c3/research-source.ts');
 const root=mkdtempSync(join(tmpdir(),'uv1-new-evidence-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const workStore={root:join(root,'work'),principal};const researchRoot=join(root,'research');mkdirSync(researchRoot,{mode:0o700});
 const config={accountId,principal,enabled:false,retentionRoot:researchRoot,validFrom:'2026-09-13T00:00:00.000Z',validUntil:'2026-09-14T00:00:00.000Z',scope:{accountId,principal,question:'Synthetic current pilot evidence',authorizationRef:'Offline fixture only',allowedHosts:['synthetic.example.org'],targets:[{url:'https://synthetic.example.org/pilot',publisher:'New synthetic source',entityId:accountId,relationshipToAccount:'account' as const,redirectUrls:[]}],limits:{...RESEARCH_HARD_LIMITS}}};
 const excerpt='SYNTHETIC newly retained evidence: the pilot began in September 2026. No real research.';
 const execution=new BoundedResearchExecution({...config,enabled:true,transport:async()=>({status:200,mediaType:'text/plain',bodyComplete:true,body:Buffer.from(excerpt)})});await execution.start({accountId,principal,sessionId:'offline-test'},'new-evidence').completion;
 const store=new LocalWorkStore(workStore,context);const doc=newWorkDocumentId();store.save(doc,0,{record,records:[record],correctionNote:'',sectionNotes:{},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1});
 const server=await startC3Server({context,provider:new DisabledC3ModelProvider(),workStore,research:{config,networkEnabled:()=>false},accounts:[],listen:process.env.C3_TEST_REAL_HTTP==='1'});
 try{const b=researchBrowser(server);await b.call(accountId,'/');const listing=(await b.call(accountId,'/api/information/list',{})).json();const selected=listing.evidence.find((e:any)=>e.custody.kind==='research');assert.ok(selected);const item=listing.items[0];
 const changed=await b.call(accountId,'/api/information/change',{id:item.id,expectedVersion:item.version,additionalEvidenceIds:[selected.id],change:{action:'assess',reason:'Synthetic source concerns this proposition; support is not independently established',evidenceIds:[selected.id],effect:'does-not-resolve',entity:item.entity,timeScope:item.timeScope,independence:'unknown',origins:[]}});assert.equal(changed.status,200,changed.text);
 await b.call(accountId,'/api/reopen',{documentId:doc});let state=(await b.call(accountId,'/api/work-state',{})).json();assert.equal((await b.call(accountId,'/api/work/information',{action:'add',id:item.id,informationVersion:changed.json().item.version,workVersion:state.workVersion,recordId:record.recordId})).status,200);
 state=(await b.call(accountId,'/api/work-state',{})).json();const saved=await b.call(accountId,'/api/save',{documentId:doc,expectedVersion:state.version,workVersion:state.workVersion,recordId:record.recordId,informationAttachments:state.snapshot.informationAttachments});assert.equal(saved.status,200,saved.text);
 const retained=store.loadWithContext(doc);assert.equal(retained.context.sha256,context.sha256);assert.equal(retained.context.canonicalJson,context.canonicalJson);assert.ok(!context.canonicalJson.includes(excerpt));assert.equal(retained.saved.work.informationAttachments?.[0]?.snapshot.evidence.find(e=>e.id===selected.id)?.excerpt,excerpt);
 renameSync(researchRoot,researchRoot+'-offline');
 const validation=await b.call(accountId,'/api/information/change',{id:item.id,expectedVersion:changed.json().item.version,additionalEvidenceIds:[],change:{action:'validate',reason:'Firsthand reasoning does not depend on research availability',firsthand:'I observed this synthetic event',evidenceIds:[]}});assert.equal(validation.status,200,validation.text);
 renameSync(workStore.root+'.information',workStore.root+'.information-offline');const page=await b.call(accountId,'/?draft=1');assert.match(page.text,/Current status unavailable/);assert.ok(page.text.includes(excerpt));assert.equal(server.status().generationAttempted,0);
 state=(await b.call(accountId,'/api/work-state',{})).json();const removed=await b.call(accountId,'/api/work/information',{action:'remove',id:item.id,informationVersion:changed.json().item.version,recordId:record.recordId,workVersion:state.workVersion});assert.equal(removed.status,200,removed.text);assert.deepEqual(removed.json().attachments,[]);assert.equal(store.load(doc).work.informationAttachments?.length,1);
 }finally{await server.close();}
});

test('revision Apply, Keep, failure and cancellation preserve attachments; genuine new generation clears them',async t=>{
 const {scriptedFullCoverage}=await import('./c3-generation-scripted.ts');
 const root=mkdtempSync(join(tmpdir(),'uv1-lifecycle-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 let mode:'success'|'failure'|'wait'='success';let started:(()=>void)|undefined;
 const provider={name:'synthetic-lifecycle-test',executionMode:'local' as const,generate:async(request:ReturnType<typeof createC3ModelRequest>,signal:AbortSignal)=>{started?.();if(mode==='failure')throw Error('Synthetic failure');if(mode==='wait')await new Promise<void>((_,reject)=>signal.addEventListener('abort',()=>reject(Error('Synthetic cancelled')),{once:true}));return syntheticMeetingCandidate(context,Boolean(request.revision));},verify:async(request:Parameters<typeof scriptedFullCoverage>[0])=>scriptedFullCoverage(request)};
 const server=await startC3Server({context,provider,workStore:{root:join(root,'work'),principal},accounts:[],listen:process.env.C3_TEST_REAL_HTTP==='1'});
 try{const b=researchBrowser(server);await b.call(accountId,'/');let operation=0;
 const generate=(recordId:string|null,token:string|null=null,request=syntheticMeetingRequest)=>b.call(accountId,'/api/generate',{recordId,pendingRevisionToken:token,request,operationId:String(++operation).padStart(32,'x')});
 let generated=await generate(null);assert.equal(generated.status,200,generated.text);let current=generated.json().recordId;
 const listing=(await b.call(accountId,'/api/information/list',{})).json();const item=listing.items[0];let state=(await b.call(accountId,'/api/work-state',{})).json();assert.equal((await b.call(accountId,'/api/work/information',{action:'add',id:item.id,informationVersion:item.version,recordId:current,workVersion:state.workVersion})).status,200);
 const attachment=(await b.call(accountId,'/api/work-state',{})).json().snapshot.informationAttachments;
 const same=async()=>assert.deepEqual((await b.call(accountId,'/api/work-state',{})).json().snapshot.informationAttachments,attachment);
 const reason='Refine the synthetic close.';let stage=(await b.call(accountId,'/api/revise',{recordId:current,note:reason,priorNote:''})).json();let proposal=await generate(current,stage.pendingRevisionToken);assert.equal(proposal.status,200,proposal.text);
 const applied=await b.call(accountId,'/api/apply-revision',{recordId:current,proposalId:proposal.json().proposalId,pendingRevisionToken:stage.pendingRevisionToken,instruction:reason});assert.equal(applied.status,200,applied.text);current=applied.json().recordId;await same();
 stage=(await b.call(accountId,'/api/revise',{recordId:current,note:'Another synthetic instruction',priorNote:''})).json();assert.equal((await b.call(accountId,'/api/discard-revision',{recordId:current,pendingRevisionToken:stage.pendingRevisionToken})).status,200);await same();
 mode='failure';const newRequest={...syntheticMeetingRequest,intendedOutcome:'A different synthetic outcome'};generated=await generate(current,null,newRequest);assert.equal(generated.status,502);await same();
 mode='wait';const ready=new Promise<void>(resolve=>{started=resolve;});const opId=String(operation+1).padStart(32,'x');const pending=generate(current,null,newRequest);await ready;
 assert.equal((await b.call(accountId,'/api/cancel',{recordId:current,pendingRevisionToken:null,request:newRequest,operationId:opId})).status,200);await pending;await same();
 mode='success';generated=await generate(current,null,newRequest);assert.equal(generated.status,200,generated.text);assert.deepEqual((await b.call(accountId,'/api/work-state',{})).json().snapshot.informationAttachments,[]);
 }finally{await server.close();}
});

test('legacy conflict snapshot stays byte-exact after resolution; refresh plus explicit Save retains scoped judgment on reopen',async t=>{
 const {informationConflicts}=await import('../../src/c3/account-information.ts');
 const root=mkdtempSync(join(tmpdir(),'trust-loop-saved-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const workStore={root:join(root,'work'),principal};
 const store=new LocalWorkStore(workStore,context),documentId=newWorkDocumentId();const information=new LocalInformationStore(workStore,accountId);
 const a={accountId,principal,at:'2026-09-14T12:00:00.000Z'};
 // Public synthetic retained evidence, admitted through the normal account adapter.
 const {sourceInformation}=await import('../../src/c3/account-information-adapter.ts');
 let item=sourceInformation(context,a)[0]!;
 item={...item,schemaVersion:'2'};information.save(item,0);
 item={...reviseInformation(item,{action:'assess',reason:'Synthetic conflict retained before schema 3',evidenceIds:[item.evidence[0]!.id],entity:item.entity,timeScope:item.timeScope,effect:'contradicts',independence:'unknown',origins:[]},a),schemaVersion:'2'};information.save(item,1);
 const snapshot=informationAttachment(item);
 store.save(documentId,0,{record,records:[record],correctionNote:'Keep original brief',sectionNotes:{},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1,informationAttachments:[snapshot]});
 const name=readdirSync(workStore.root).find(n=>n.endsWith('v000001.json'))!,bytes=readFileSync(join(workStore.root,name),'utf8');
 const options={context,provider:new DisabledC3ModelProvider(),workStore,accounts:[],listen:process.env.C3_TEST_REAL_HTTP==='1'};let server=await startC3Server(options);
 try{
  let b=researchBrowser(server);await b.call(accountId,'/');await b.call(accountId,'/api/reopen',{documentId});
  const resolved=await b.call(accountId,'/api/information/change',{id:item.id,expectedVersion:item.version,additionalEvidenceIds:[],change:{action:'resolve',reason:'Distinguish the synthetic events',contradictionIds:[informationConflicts(item)[0]!.id],text:item.text,entity:item.entity,timeScope:item.timeScope,category:'firsthand',basis:'The cancelled synthetic event was a different pilot.',firsthand:'I attended the synthetic pilot named in the statement.',evidenceIds:[]}});assert.equal(resolved.status,200,resolved.text);
  let state=(await b.call(accountId,'/api/work-state',{})).json();assert.deepEqual(state.snapshot.informationAttachments,[snapshot]);
  const page=await b.call(accountId,'/?draft=1');assert.match(page.text,/Included snapshot[^]*?Conflicting evidence/);assert.match(page.text,/Current status changed/);
  const refresh=await b.call(accountId,'/api/work/information',{action:'refresh',id:item.id,informationVersion:resolved.json().item.version,workVersion:state.workVersion,recordId:record.recordId});assert.equal(refresh.status,200,refresh.text);
  assert.deepEqual(store.load(documentId).work.informationAttachments,[snapshot]);
  state=(await b.call(accountId,'/api/work-state',{})).json();assert.equal(state.saved,false);
  const saved=await b.call(accountId,'/api/save',{recordId:record.recordId,documentId,expectedVersion:state.version,workVersion:state.workVersion,informationAttachmentsSha256:state.attachmentDigest});assert.equal(saved.status,200,saved.text);
  assert.equal(readFileSync(join(workStore.root,name),'utf8'),bytes);assert.equal(store.load(documentId).work.record.rawResponse,record.rawResponse);
  await server.close();server=await startC3Server(options);b=researchBrowser(server);await b.call(accountId,'/');await b.call(accountId,'/api/reopen',{documentId});
  state=(await b.call(accountId,'/api/work-state',{})).json();const current=state.snapshot.informationAttachments[0].snapshot;assert.equal(current.schemaVersion,'3');assert.ok(informationConflicts(current)[0]!.resolution);assert.deepEqual(current,resolved.json().item);
  assert.equal(server.status().generationAttempted,0);
 }finally{await server.close();}
});
