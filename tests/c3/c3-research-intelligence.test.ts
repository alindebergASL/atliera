import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';
import { researchHash, researchPassage, RESEARCH_HARD_LIMITS, type ResearchScope } from '../../src/c3/research-source.ts';
import { questionPassages } from '../../src/c3/research-render.ts';
import { BoundedResearchExecution } from '../../src/c3/research-run.ts';
import { admitResearchIntelligence, validateResearchIntelligence } from '../../src/c3/research-intelligence.ts';
import { canonicalJson } from '../../src/c3/context.ts';
import { createC3ModelRequest, createC3VerificationRequest, createGenerationRecord, retainC3Verification } from '../../src/c3/generation-contract.ts';
import { LocalWorkStore, newWorkDocumentId } from '../../src/c3/work-store.ts';
import { validateV7Integrity } from '../../src/c3/generation-contract-v7.ts';
import { startC3Server } from '../../src/c3/service.ts';
import { DisabledC3ModelProvider } from '../../src/c3/provider.ts';
import { researchBrowser } from '../helpers/c3-research-browser.ts';
const nav = 'Resources Access Training Support Allocations User Services Documentation Accounts Navigation Menu Research Computing Access Help Training Service Availability ';
const prose = 'The synthetic research center invites institutional researchers to propose challenge projects for early access to its computing resource. Once full operations begin, access will be managed through quarterly allocations. The center will provide training and onboarding support through its user representatives.';
const text = nav.repeat(3) + prose;
const now = () => new Date('2026-09-12T12:00:00.000Z');
async function fixture(account: 'harbor' | 'cedar' = 'harbor') {
  const base = syntheticWorkshopContext(account), principal = 'synthetic.operator';
  const accountId = base.context.account.accountId;
  const root = mkdtempSync(join(tmpdir(), 'cd1-synthetic-'));
  const scope: ResearchScope = { principal, accountId, question: 'Research computing access training support allocations service availability',
    authorizationRef: 'SYNTHETIC no live authority', allowedHosts: ['research.example.org'], targets: [{url:'https://research.example.org/access',redirectUrls:[],publisher:'Synthetic Research Center',entityId:accountId,relationshipToAccount:'account'}], limits:{...RESEARCH_HARD_LIMITS} };
  const execution = new BoundedResearchExecution({ principal, accountId, scope, retentionRoot:root, enabled:true, now,
    transport:async()=>({status:200,mediaType:'text/plain',body:Buffer.from(text),bodyComplete:true}) });
  const caller = {principal,accountId,sessionId:'synthetic_browser'};
  const run = await execution.start(caller,'initial').completion;
  const source = run.sources[0]!;
  const selected = questionPassages(source,scope.question).find(p=>p.text.includes('Once full operations'))!;
  return {base,principal,accountId,root,scope,execution,caller,run,source,selected,close:()=>rmSync(root,{recursive:true,force:true})};
}
test('SYNTHETIC duplicate navigation containing question terms yields substantive access and conditional allocation prose with exact offsets',async()=>{
  const f=await fixture();try {
    const passages=questionPassages(f.source,f.scope.question);
    assert.ok(passages.some(p=>p.text.includes('invites institutional researchers')));
    assert.ok(passages.some(p=>p.text.includes('Once full operations begin')));
    assert.ok(passages.every(p=>!p.text.includes('Navigation Menu')));
    for(const p of passages)assert.deepEqual(p,researchPassage(f.source.cleanText,p.start,p.end));
  }finally{f.close();}
});
for(const account of ['harbor','cedar'] as const)test(`SYNTHETIC ${account} exact direct acquisition → validated proposed findings, no search fabrication`,async()=>{
  const f=await fixture(account);try {
    const context=admitResearchIntelligence(f.base,f.run,f.source.sourceId,f.selected.sha256,f.caller);
    validateResearchIntelligence(context,f.principal);
    assert.deepEqual(context.context.discoveryLineage,f.base.context.discoveryLineage);
    assert.equal(context.context.admittedSources.at(-1)!.discoveredByQueryIds.length,0);
    assert.equal(context.context.directResearch!.sourceId,f.source.sourceId);
    assert.equal(context.context.directResearch!.run.snapshotId,f.run.snapshotId);
    assert.equal(context.context.directResearch!.humanApproved,false);
    assert.notEqual(context.context.admittedSources.at(-1)!.sourceId,f.source.sourceId);
    assert.ok(context.context.proposal.establishedContext.some(p=>p.text.includes('Once full operations begin')));
    assert.equal(context.context.admittedSources.at(-1)!.publicationDate,null);
    const request=createC3ModelRequest(context,syntheticMeetingRequest);
    assert.match(request.prompt,/TARGETED SOURCE SELECTION/);assert.match(request.prompt,/audienceThesis \(Situation\), opening, or at least one question evidenceRefs/);assert.doesNotMatch(request.prompt,/rawBase64|baseContextCanonicalJson/);
    assert.throws(()=>validateV7Integrity(syntheticMeetingCandidate(f.base),context),/selected fresh evidence/);
    for(const bad of [{...f.caller,accountId:'foreign'},{...f.caller,principal:'foreign'}])assert.throws(()=>admitResearchIntelligence(f.base,f.run,f.source.sourceId,f.selected.sha256,bad));
    assert.throws(()=>admitResearchIntelligence(f.base,f.run,'foreign_source',f.selected.sha256,f.caller));
    assert.throws(()=>admitResearchIntelligence(f.base,f.run,f.source.sourceId,'0'.repeat(64),f.caller));
    for(const mutate of [(c:any)=>c.directResearch.run.sources[0].cleanText+=' altered',(c:any)=>c.directResearch.acquisition.rawSha256='0'.repeat(64),(c:any)=>c.directResearch.selectedEvidenceId=c.admittedSources[0].excerpts[0].evidenceId]) {
      const value=JSON.parse(context.canonicalJson);mutate(value);const json=canonicalJson(value);
      assert.throws(()=>validateResearchIntelligence({context:value,canonicalJson:json,sha256:researchHash(json)},f.principal));
    }
  }finally{f.close();}
});
test('SYNTHETIC source selection after process recreation is principal-bound; new context survives Save and reconstructed store reopen',async()=>{
  const f=await fixture(),work=mkdtempSync(join(tmpdir(),'cd1-work-'));try {
    const context=admitResearchIntelligence(f.base,f.run,f.source.sourceId,f.selected.sha256,f.caller);
    const candidate=JSON.parse(syntheticMeetingCandidate(f.base));
    const excerpt=context.context.admittedSources.at(-1)!.excerpts.find(e=>e.evidenceId===context.context.directResearch!.selectedEvidenceId)!;
    candidate.audienceThesis={text:excerpt.exactExcerpt,supportCategory:'direct_support',evidenceRefs:[excerpt.evidenceId]};
    candidate.selectedEvidenceRefs.push(excerpt.evidenceId);
    const raw=JSON.stringify(candidate),request=createC3ModelRequest(context,syntheticMeetingRequest),check=createC3VerificationRequest(request,raw,context);
    const fields=JSON.parse(check.prompt.split('DISPLAY FIELDS\n')[1]!.split('\n\nCOMPLETE ORIGINAL')[0]!);
    const verification=retainC3Verification(check,JSON.stringify({kind:'atliera.c3.evidence-verification',schemaVersion:check.schemaVersion,contextSha256:check.contextSha256,modelRequestSha256:check.modelRequestSha256,rawResponseSha256:check.rawResponseSha256,findings:fields.map((field:any)=>({...field,kind:'non_assertion',entityScope:'Synthetic',dateScope:'Synthetic',modality:'Synthetic',verdict:'supported',reason:'Injected synthetic verdict, not semantic verification.'}))}));
    const record=createGenerationRecord(request,raw,context,verification);assert.equal(record.outcome,'succeeded',JSON.stringify(record.refusal));
    const store=new LocalWorkStore({root:work,principal:f.principal},f.base),id=newWorkDocumentId();
    const saved=store.save(id,0,{workVersion:1,record,records:[record],correctionNote:'Synthetic retained note',instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,sectionNotes:{}},undefined,context);
    const reloaded=new LocalWorkStore({root:work,principal:f.principal},f.base).loadWithContext(id);
    assert.deepEqual(reloaded.saved,saved);assert.equal(reloaded.context.sha256,context.sha256);
    assert.equal(reloaded.saved.work.correctionNote,'Synthetic retained note');
    const server=await startC3Server({context:f.base,provider:new DisabledC3ModelProvider(),listen:process.env.C3_TEST_REAL_HTTP==='1',now,accounts:[],research:{config:{principal:f.principal,accountId:f.accountId,retentionRoot:f.root,scope:f.scope,enabled:false,validFrom:'2026-09-12T00:00:00.000Z',validUntil:'2026-09-13T00:00:00.000Z'}}});
    try {
      const browser=researchBrowser(server);await browser.call(f.accountId,'/');
      const selection={snapshotId:f.run.snapshotId,sourceId:f.source.sourceId,passageSha256:f.selected.sha256};
      const prepared=await browser.call(f.accountId,'/api/research/prepare',selection);assert.equal(prepared.status,200,prepared.text);assert.equal(prepared.json().contextSha256,context.sha256);
      const page=await browser.call(f.accountId,'/?prepare=1');assert.match(page.text,/Selected fresh source findings/);assert.match(page.text,/Once full operations begin/);
      const refreshed=await f.execution.start(f.caller,'refresh').completion;
      assert.notEqual(refreshed.snapshotId,f.run.snapshotId);
      assert.equal((await browser.call(f.accountId,'/api/generate',{request:syntheticMeetingRequest,recordId:null,pendingRevisionToken:null,operationId:'c'.repeat(32)},{'x-c3-context':context.sha256})).status,409);
      assert.equal((await browser.call(f.accountId,'/api/research/prepare',selection)).status,409);
      assert.equal(new LocalWorkStore({root:work,principal:f.principal},f.base).loadWithContext(id).context.sha256,context.sha256);
    }finally{await server.close();}
  }finally{f.close();rmSync(work,{recursive:true,force:true});}
});

test('SYNTHETIC targeted handler generation → independent checker → revision proposal → Apply → note → Save → new server reopen',async()=>{
  const f=await fixture(),work=mkdtempSync(join(tmpdir(),'cd1-targeted-journey-'));let generates=0,verifies=0;
  const context=admitResearchIntelligence(f.base,f.run,f.source.sourceId,f.selected.sha256,f.caller);
  const target=context.context.admittedSources.at(-1)!.excerpts.find(e=>e.evidenceId===context.context.directResearch!.selectedEvidenceId)!;
  const options={context:f.base,listen:process.env.C3_TEST_REAL_HTTP==='1',now,accounts:[],workStore:{root:work,principal:f.principal},research:{config:{principal:f.principal,accountId:f.accountId,retentionRoot:f.root,scope:f.scope,enabled:false,validFrom:'2026-09-12T00:00:00.000Z',validUntil:'2026-09-13T00:00:00.000Z'}},provider:{name:'synthetic-targeted',executionMode:'local' as const,
    generate:async(request:any)=>{generates++;assert.equal(request.contextSha256,context.sha256);assert.match(request.prompt,/Once full operations begin/);
      const c=JSON.parse(syntheticMeetingCandidate(f.base,Boolean(request.revision)));c.audienceThesis={text:target.exactExcerpt,supportCategory:'direct_support',evidenceRefs:[target.evidenceId]};c.selectedEvidenceRefs.push(target.evidenceId);return JSON.stringify(c);},
    verify:async(check:any)=>{verifies++;assert.equal(check.contextSha256,context.sha256);assert.match(check.prompt,/Once full operations begin/);
      const fields=JSON.parse(check.prompt.split('DISPLAY FIELDS\n')[1].split('\n\nCOMPLETE ORIGINAL')[0]);
      return JSON.stringify({kind:'atliera.c3.evidence-verification',schemaVersion:check.schemaVersion,contextSha256:check.contextSha256,modelRequestSha256:check.modelRequestSha256,rawResponseSha256:check.rawResponseSha256,findings:fields.map((field:any)=>({...field,kind:'non_assertion',entityScope:'Synthetic',dateScope:'Synthetic',modality:'Synthetic',verdict:'supported',reason:'Synthetic checker injection, not semantic evidence.'}))});}}};
  let server=await startC3Server(options);
  try {
    const browser=researchBrowser(server);await browser.call(f.accountId,'/');
    const before=(await browser.call(f.accountId,'/api/work-state',{})).json();
    const prepare=await browser.call(f.accountId,'/api/research/prepare',{snapshotId:f.run.snapshotId,sourceId:f.source.sourceId,passageSha256:f.selected.sha256});
    assert.equal(prepare.status,200,prepare.text);assert.equal(prepare.json().location,`/accounts/${f.accountId}/?prepare=1`);
    assert.deepEqual((await browser.call(f.accountId,'/api/work-state',{})).json(),before,'selection does not Apply or Save');
    await browser.call(f.accountId,'/?prepare=1');
    assert.equal((await browser.call(f.accountId,'/api/generate',{request:syntheticMeetingRequest,recordId:null,pendingRevisionToken:null,operationId:'0'.repeat(32)},{'x-c3-context':f.base.sha256})).status,409);
    assert.equal(generates,0);assert.equal(verifies,0);
    const initial=await browser.call(f.accountId,'/api/generate',{request:syntheticMeetingRequest,recordId:null,pendingRevisionToken:null,operationId:'1'.repeat(32)},{'x-c3-context':context.sha256});
    assert.equal(initial.status,200,initial.text);const original=initial.json().recordId;
    const instruction='Clarify who could own a useful follow-up.';
    const staged=(await browser.call(f.accountId,'/api/revise',{recordId:original,note:instruction,priorNote:''})).json();
    const revised=await browser.call(f.accountId,'/api/generate',{request:syntheticMeetingRequest,recordId:original,pendingRevisionToken:staged.pendingRevisionToken,operationId:'2'.repeat(32)});
    assert.equal(revised.status,200,revised.text);assert.equal(revised.json().proposalReady,true);
    assert.equal((await browser.call(f.accountId,'/api/work-state',{})).json().recordId,original);
    const apply=await browser.call(f.accountId,'/api/apply-revision',{recordId:original,proposalId:revised.json().proposalId,pendingRevisionToken:staged.pendingRevisionToken,instruction});
    assert.equal(apply.status,200,apply.text);
    const state=(await browser.call(f.accountId,'/api/work-state',{})).json();assert.notEqual(state.recordId,original);
    assert.equal((await browser.call(f.accountId,'/api/note',{recordId:state.recordId,note:'SYNTHETIC saved targeted note',priorNote:''})).status,200);
    const annotated=(await browser.call(f.accountId,'/api/work-state',{})).json();
    const saved=await browser.call(f.accountId,'/api/save',{recordId:annotated.recordId,documentId:annotated.documentId,workVersion:annotated.workVersion,expectedVersion:annotated.version});
    assert.equal(saved.status,200,saved.text);assert.equal(generates,2);assert.equal(verifies,2);
    await server.close();server=await startC3Server({...options,provider:new DisabledC3ModelProvider()});
    const fresh=researchBrowser(server);await fresh.call(f.accountId,'/');
    const reopened=await fresh.call(f.accountId,'/api/reopen',{documentId:saved.json().documentId});assert.equal(reopened.status,200,reopened.text);
    const reopenedState=(await fresh.call(f.accountId,'/api/work-state',{})).json();assert.deepEqual(reopenedState.snapshot,annotated.snapshot);
    const loaded=new LocalWorkStore({root:work,principal:f.principal},f.base).loadWithContext(saved.json().documentId);
    assert.equal(loaded.context.sha256,context.sha256);assert.equal(loaded.saved.work.records[0]!.recordId,original);
    assert.equal(generates,2);assert.equal(verifies,2);
  } finally {await server.close();f.close();rmSync(work,{recursive:true,force:true});}
});
