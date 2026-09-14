import test from 'node:test';import assert from 'node:assert/strict';
import { syntheticWorkshopContext,syntheticMeetingCandidate,syntheticMeetingRequest } from '../fixtures/c3-workshop.ts';
import { createC3ModelRequest,createGenerationRecord } from '../../src/c3/generation-contract.ts';
import { candidateInformation,sourceInformation } from '../../src/c3/account-information-adapter.ts';
const context=syntheticWorkshopContext();const authority={accountId:context.context.account.accountId,principal:'synthetic-operator',at:'2026-09-13T12:00:00.000Z'};
test('failed check preserves exact failure and field provenance without admitting a brief',()=>{
 const request=createC3ModelRequest(context,syntheticMeetingRequest);const record=createGenerationRecord(request,syntheticMeetingCandidate(context),context);const before=JSON.stringify(record);
 assert.equal(record.outcome,'refused');const items=candidateInformation(record,context,authority);
 assert.ok(items.length);assert.equal(items[0]!.origin.kind,'failed-check');assert.equal(JSON.stringify(record),before);
 assert.throws(()=>candidateInformation(record,context,{...authority,accountId:'foreign'}));
 const malformed=createGenerationRecord(request,'<script>alert(1)</script>',context);assert.throws(()=>candidateInformation(malformed,context,authority));
 assert.ok(sourceInformation(context,authority).length);
});

test('semantic rejection remains explicit, invalid verifier format is incomplete, foreign citations refuse',async()=>{
 const {createC3VerificationRequest,retainC3Verification}=await import('../../src/c3/generation-contract.ts');const {scriptedFullCoverage}=await import('./c3-generation-scripted.ts');const {designation,reviseInformation}=await import('../../src/c3/account-information.ts');
 const request=createC3ModelRequest(context,syntheticMeetingRequest),raw=syntheticMeetingCandidate(context);const check=createC3VerificationRequest(request,raw,context);
 const format=createGenerationRecord(request,raw,context,retainC3Verification(check,'not JSON'));
 assert.equal(candidateInformation(format,context,authority)[0]?.origin.failure,'verifier_format');
 const result=JSON.parse(scriptedFullCoverage(check));result.findings[0].verdict='contradicted';
 const rejected=createGenerationRecord(request,raw,context,retainC3Verification(check,JSON.stringify(result)));
 assert.equal(candidateInformation(rejected,context,authority)[0]?.origin.failure,'semantic_refusal');
 const broken=JSON.parse(raw);broken.audienceThesis.evidenceRefs=['foreign'];assert.throws(()=>candidateInformation(createGenerationRecord(request,JSON.stringify(broken),context),context,authority));
 const source=sourceInformation(context,authority)[0]!;assert.ok(designation(source).labels.includes('Source-backed'));
 const edited=reviseInformation(source,{action:'edit',reason:'Different wording',text:'A new unverified proposition',entity:source.entity,timeScope:source.timeScope},authority);
 assert.ok(designation(edited).labels.includes('Not independently checked'));assert.equal(edited.statements[0]?.text,source.text);
});
