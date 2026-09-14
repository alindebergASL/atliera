import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {startC3Server} from '../../src/c3/service.ts';import {DisabledC3ModelProvider} from '../../src/c3/provider.ts';import {researchBrowser} from '../helpers/c3-research-browser.ts';
import {syntheticWorkshopContext,syntheticMeetingRequest,syntheticMeetingCandidate} from '../fixtures/c3-workshop.ts';
import {createC3ModelRequest,createGenerationRecord} from '../../src/c3/generation-contract.ts';import {createRecordOriginReceipt} from '../../src/c3/work-store.ts';
const context=syntheticWorkshopContext(),accountId=context.context.account.accountId,principal='synthetic.operator';
const record=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest),syntheticMeetingCandidate(context),context);
const attempt={context,record,ancestry:[],receipt:createRecordOriginReceipt(record,'synthetic','uv1-test-custody')};
test('actual disabled handler: failed candidate admission, validation, spoof/CSRF/stale guards and restart',async t=>{
 const root=mkdtempSync(join(tmpdir(),'uv1-http-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const options={context,provider:new DisabledC3ModelProvider(),workStore:{root:join(root,'work'),principal},retainedInformationAttempts:[attempt],accounts:[{context:syntheticWorkshopContext('cedar'),provider:new DisabledC3ModelProvider(),workStore:{root:join(root,'work'),principal}}],listen:process.env.C3_TEST_REAL_HTTP==='1'};
 let server=await startC3Server(options);
 try{
  const b=researchBrowser(server);let page=await b.call(accountId,'/');assert.equal(page.status,200);assert.match(page.text,/Check incomplete/);
  const list=await b.call(accountId,'/api/information/list',{});assert.equal(list.status,200,list.text);const item=list.json().items.find((x:any)=>x.origin.kind==='failed-check');assert.ok(item);
  const body={id:item.id,expectedVersion:item.version,additionalEvidenceIds:[],change:{action:'validate',reason:'I observed the synthetic event',firsthand:'I attended the synthetic event',evidenceIds:[]}};
  assert.equal((await b.call(accountId,'/api/information/change',body,{'x-c3-csrf':'forged'})).status,403);
  assert.equal((await b.call(accountId,'/api/information/change',{...body,change:{...body.change,principal:'attacker'}})).status,409);
  assert.equal((await b.call(accountId,'/api/information/change')).status,404);
  const changed=await b.call(accountId,'/api/information/change',body);assert.equal(changed.status,200,changed.text);assert.equal(changed.json().saved,true);assert.equal(changed.json().item.history[0].actor,principal);
  assert.equal((await b.call(accountId,'/api/information/change',body)).status,409);
  await b.call('acct-cedar','/');assert.equal((await b.call('acct-cedar','/api/information/change',body)).status,409);
  assert.equal(server.status().generationAttempted,0);assert.equal(server.status().provider,'disabled');
  await server.close();server=await startC3Server(options);const again=researchBrowser(server);page=await again.call(accountId,'/');assert.match(page.text,/Operator validated/);assert.match(page.text,/Not independently checked/);
  assert.equal((await again.call(accountId,'/api/work-state',{})).json().recordId,null);
 }finally{await server.close();}
});

test('time-scope review public handler binds server attribution and retained evidence, then survives restart',async t=>{
 const root=mkdtempSync(join(tmpdir(),'uv1-time-http-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const options={context,provider:new DisabledC3ModelProvider(),workStore:{root:join(root,'work'),principal},accounts:[],listen:process.env.C3_TEST_REAL_HTTP==='1'};
 let server=await startC3Server(options);
 try{
  const b=researchBrowser(server);const page=await b.call(accountId,'/');assert.equal(page.status,200,page.text);
  const listed=await b.call(accountId,'/api/information/list',{});assert.equal(listed.status,200,listed.text);const list=listed.json();const item=list.items.find((x:any)=>x.evidence.length>0);assert.ok(item);
  const edit=await b.call(accountId,'/api/information/change',{id:item.id,expectedVersion:item.version,additionalEvidenceIds:[],change:{action:'edit',reason:'Limit to documentary history',text:'Synthetic historical statement',entity:item.entity,timeScope:'Historical reporting period'}});
  assert.equal(edit.status,200,edit.text);const current=edit.json().item;
  const body={id:item.id,expectedVersion:current.version,additionalEvidenceIds:[],change:{action:'assess-time',reason:'Check dates separately',entity:current.entity,timeScope:current.timeScope,evidenceIds:[current.evidence[0].id],temporal:'unresolved',basis:'The excerpt does not establish the exact historical period'}};
  for(const change of [{...body.change,basis:' '},{...body.change,timeScope:'Other period'},{...body.change,actor:'forged'},{...body.change,evidenceIds:['unknown']}])assert.equal((await b.call(accountId,'/api/information/change',{...body,change})).status,409);
  const saved=await b.call(accountId,'/api/information/change',body);assert.equal(saved.status,200,saved.text);
  assert.equal(saved.json().item.schemaVersion,'3');assert.equal(saved.json().item.history.at(-1).actor,principal);assert.match(saved.json().html,/Temporal basis:/);
  assert.equal((await b.call(accountId,'/api/information/change',body)).status,409);
  await server.close();server=await startC3Server(options);const again=researchBrowser(server);await again.call(accountId,'/');
  const restored=(await again.call(accountId,'/api/information/list',{})).json().items.find((x:any)=>x.id===item.id);assert.deepEqual(restored,saved.json().item);
  assert.equal(server.status().generationAttempted,0);
 }finally{await server.close();}
});

test('resolution handler refuses actor/version/foreign evidence and targets without publication; exact restore survives reopen',async t=>{
 const {informationConflicts}=await import('../../src/c3/account-information.ts');
 const root=mkdtempSync(join(tmpdir(),'trust-loop-handler-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const options={context,provider:new DisabledC3ModelProvider(),workStore:{root:join(root,'work'),principal},accounts:[{context:syntheticWorkshopContext('cedar'),provider:new DisabledC3ModelProvider(),workStore:{root:join(root,'work'),principal}}],listen:process.env.C3_TEST_REAL_HTTP==='1'};
 let server=await startC3Server(options);
 try{
  let b=researchBrowser(server);await b.call(accountId,'/');
  const listing=(await b.call(accountId,'/api/information/list',{})).json();let x=listing.items.find((i:any)=>i.evidence.length);assert.ok(x);
  const change=async(c:unknown,extra:string[]=[],version=x.version)=>b.call(accountId,'/api/information/change',{id:x.id,expectedVersion:version,additionalEvidenceIds:extra,change:c});
  const contradicted=await change({action:'assess',reason:'Synthetic retained source disputes the proposition',evidenceIds:[x.evidence[0].id],entity:x.entity,timeScope:x.timeScope,effect:'contradicts',independence:'unknown',origins:[]});assert.equal(contradicted.status,200,contradicted.text);x=contradicted.json().item;
  const target=informationConflicts(x)[0]!.id;
  const resolution={action:'resolve',reason:'Specific synthetic firsthand judgment',contradictionIds:[target],text:x.text,entity:x.entity,timeScope:x.timeScope,category:'firsthand',basis:'I observed the synthetic event; the report describes a separate event.',firsthand:'I attended the synthetic event on the stated date.',evidenceIds:[x.evidence[0].id]};
  const before=JSON.stringify(x);
  for(const c of [{...resolution,actor:'attacker'},{...resolution,at:'2026-09-14T00:00:00.000Z'},{...resolution,evidenceIds:['foreign']},{...resolution,contradictionIds:[target,target]},{...resolution,contradictionIds:['ih_'+'f'.repeat(64)]},{...resolution,text:'Another proposition'},{...resolution,basis:''}])assert.equal((await change(c)).status,409);
  assert.equal((await change(resolution,[x.evidence[0].id])).status,409);
  assert.equal((await change(resolution,[],x.version-1)).status,409);
  const other=listing.items.find((i:any)=>i.id!==x.id);assert.ok(other);
  assert.equal((await b.call(accountId,'/api/information/change',{id:other.id,expectedVersion:other.version,additionalEvidenceIds:[],change:{...resolution,text:other.text,entity:other.entity,timeScope:other.timeScope}})).status,409);
  await b.call('acct-cedar','/');assert.equal((await b.call('acct-cedar','/api/information/change',{id:x.id,expectedVersion:x.version,additionalEvidenceIds:[],change:resolution})).status,409);
  assert.equal(JSON.stringify((await b.call(accountId,'/api/information/list',{})).json().items.find((i:any)=>i.id===x.id)),before);
  const saved=await change(resolution);assert.equal(saved.status,200,saved.text);x=saved.json().item;assert.equal(x.history.at(-1).actor,principal);assert.match(saved.json().html,/Restore a resolved conflict/);
  const judgment=informationConflicts(x)[0]!.resolution!.id;
  assert.equal((await change(resolution)).status,409);
  const reopened=await change({action:'reopen',reason:'Recheck support only'});assert.equal(reopened.status,200,reopened.text);x=reopened.json().item;assert.equal(informationConflicts(x)[0]!.resolution!.id,judgment);
  const restore={action:'restore-conflict',reason:'The event distinction is uncertain',contradictionId:target,resolutionId:judgment};
  assert.equal((await change({...restore,resolutionId:target})).status,409);
  const restored=await change(restore);assert.equal(restored.status,200,restored.text);x=restored.json().item;assert.equal(informationConflicts(x)[0]!.resolution,undefined);
  assert.equal((await change(restore)).status,409);
  await server.close();server=await startC3Server(options);b=researchBrowser(server);await b.call(accountId,'/');
  assert.deepEqual((await b.call(accountId,'/api/information/list',{})).json().items.find((i:any)=>i.id===x.id),x);assert.equal(server.status().generationAttempted,0);
 }finally{await server.close();}
});
