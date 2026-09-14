import { createHash } from 'node:crypto';
import { canonicalJson } from './context.ts';
import { assertReplayIdentity, createC3RevisionContext, type C3GenerationRecord } from './generation-contract.ts';
import { validateV7Integrity, displayFields } from './generation-contract-v7.ts';
import { validateOriginReceipt, type RecordOriginReceipt } from './work-store.ts';
import { validateResearchRun, type ResearchRun } from './research-store.ts';
import { evidenceSnapshot, newInformation, informationHash, type InformationAuthority, type InformationEvidence, type AccountInformation } from './account-information.ts';
import type { FrozenC3ViewContext } from './view-context.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function contextIdentity(context:FrozenC3ViewContext,authority:InformationAuthority):void {
 if(context.context.account.accountId!==authority.accountId||canonicalJson(context.context)!==context.canonicalJson||hash(context.canonicalJson)!==context.sha256)throw Error('Exact account context required');
}
export function contextInformationEvidence(context:FrozenC3ViewContext,authority:InformationAuthority):InformationEvidence[] {
 contextIdentity(context,authority);
 return context.context.admittedSources.filter(s=>!s.untrustedInstructionsDetected).flatMap(s=>s.excerpts.map(e=>{
  if(e.sourceId!==s.sourceId||e.exactExcerptSha256!==hash(e.exactExcerpt)||s.fullBoundedCleanText.slice(e.sourceCharStart,e.sourceCharEnd)!==e.exactExcerpt)throw Error('Source excerpt identity mismatch');
  return evidenceSnapshot({accountId:authority.accountId,sourceId:s.sourceId,lineage:s.canonicalUrl,title:s.title,url:s.canonicalUrl,excerpt:e.exactExcerpt,entity:s.entity.entityId,publicationDate:s.publicationDate,currentThrough:s.evidenceCurrentThrough,retrievedAt:s.retrievedAt,custody:{kind:'context',identity:context.sha256+':'+e.evidenceId,contentSha256:s.retrievedContentSha256,excerptSha256:e.exactExcerptSha256,principal:null}});
 }));
}
export function sourceInformation(context:FrozenC3ViewContext,authority:InformationAuthority):AccountInformation[] {
 return contextInformationEvidence(context,authority).filter(e=>e.excerpt.length<=1200).slice(0,40).map(e=>newInformation({text:e.excerpt,entity:e.entity,timeScope:e.publicationDate??'Unknown',evidence:[e],origin:{kind:'source',contextSha256:context.sha256,binding:e.custody.identity}},authority));
}
/** Presentation admission only. Never creates/repairs a successful generation record. */
export function candidateInformation(record:C3GenerationRecord,context:FrozenC3ViewContext,authority:InformationAuthority):AccountInformation[] {
 contextIdentity(context,authority);assertReplayIdentity(record,context);
 if(record.outcome!=='refused'||!['7','8'].includes(record.generationContractVersion??'')||!['verifier_format','semantic_refusal','verifier_transport'].includes((record.refusal as {failureKind?:string}).failureKind??''))throw Error('No eligible completed failed-check candidate');
 const draft=validateV7Integrity(record.rawResponse,context,record.meetingRequest.meetingDate);
 const evidence=contextInformationEvidence(context,authority);
 // Only substantive situation/risk fields, with field-local citations; no raw response dump.
 return displayFields(draft).filter(f=>f.path==='audienceThesis.text'||/^risksUnknowns\[[0-9]+\]\.text$/u.test(f.path)).filter(f=>f.evidenceRefs.length).map(f=>{
  const sources=f.evidenceRefs.map(id=>{const e=evidence.find(e=>e.custody.identity===context.sha256+':'+id);if(!e)throw Error('Foreign evidence');return e;});
  return newInformation({text:f.text,entity:sources.map(e=>e.entity).filter((v,i,a)=>a.indexOf(v)===i).join('; '),timeScope:'Unknown',evidence:sources,origin:{kind:'failed-check',contextSha256:context.sha256,binding:record.recordId+':'+f.path,recordSha256:informationHash(record),failure:(record.refusal as {failureKind:string}).failureKind}},authority);
 });
}
export interface RetainedInformationAttempt {readonly record:C3GenerationRecord;readonly context:FrozenC3ViewContext;readonly ancestry:readonly C3GenerationRecord[];readonly receipt:RecordOriginReceipt;}
export function admitRetainedInformationAttempt(attempt:RetainedInformationAttempt,authority:InformationAuthority):AccountInformation[] {
 validateOriginReceipt(attempt.receipt,attempt.record);
 let prior:C3GenerationRecord|undefined;
 for(const record of [...attempt.ancestry,attempt.record]){
  assertReplayIdentity(record,attempt.context);
  if(record.revision){if(!prior||prior.outcome!=='succeeded'||canonicalJson(record.revision)!==canonicalJson(createC3RevisionContext(prior,record.revision.correctionNote,(prior.revision?.revisionNumber??0)+1)))throw Error('Retained attempt ancestry mismatch');}
  else if(prior)throw Error('Unrelated retained ancestry');prior=record;
 }
 return candidateInformation(attempt.record,attempt.context,authority);
}
export function researchInformationEvidence(run:ResearchRun,authority:InformationAuthority):InformationEvidence[] {
 validateResearchRun(run,run.scope);
 if(run.accountId!==authority.accountId||run.principal!==authority.principal||run.state!=='completed'||!run.snapshotId)throw Error('Retained research authority mismatch');
 return run.sources.flatMap(s=>s.passages.map(p=>evidenceSnapshot({accountId:run.accountId,sourceId:s.sourceId,lineage:s.requestedUrl,title:s.publisher,url:s.finalUrl,excerpt:p.text,entity:s.entityId,publicationDate:s.publicationDate,currentThrough:s.evidenceCurrentThrough,retrievedAt:s.retrievedAt,custody:{kind:'research',identity:run.snapshotId+':'+s.sourceId+':'+p.sha256,contentSha256:s.rawSha256,excerptSha256:p.sha256,principal:run.principal}})));
}
