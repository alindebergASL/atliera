import { createHash } from 'node:crypto';
import { canonicalJson } from './context.ts';

export const informationHash=(value:unknown):string=>createHash('sha256').update(canonicalJson(value)).digest('hex');
export interface InformationAuthority { readonly principal:string; readonly accountId:string; readonly at:string; }
/** Documentary snapshot. Link identity is provenance, never an assessment of semantic support. */
export interface InformationEvidence {
 readonly id:string; readonly accountId:string; readonly sourceId:string; readonly lineage:string;
 readonly title:string; readonly url:string; readonly excerpt:string; readonly entity:string;
 readonly publicationDate:string|null; readonly currentThrough:string|null; readonly retrievedAt:string;
 readonly custody: { readonly kind:'context'|'research'; readonly identity:string; readonly contentSha256:string; readonly excerptSha256:string; readonly principal:string|null };
}
export interface InformationOrigin { readonly kind:'source'|'failed-check'; readonly contextSha256:string; readonly binding:string; readonly recordSha256?:string; readonly failure?:string; }
export interface InformationEntry { readonly revision:number; readonly actor:string; readonly at:string; readonly change:InformationChange; }
export interface AccountInformation {
 readonly kind:'atliera.c3.account-information'; readonly schemaVersion:'1'|'2'|'3'; readonly id:string;
 readonly accountId:string; readonly principal:string; readonly version:number; readonly revision:number;
 readonly text:string; readonly entity:string; readonly timeScope:string;
 readonly statements:readonly {text:string;entity:string;timeScope:string}[];
 readonly origin:InformationOrigin; readonly evidence:readonly InformationEvidence[]; readonly history:readonly InformationEntry[];
}
export type InformationChange =
 | {action:'resolve';reason:string;contradictionIds:readonly string[];text:string;entity:string;timeScope:string;category:'evidence-correction'|'different-scope'|'firsthand';basis:string;firsthand:string;evidenceIds:readonly string[]}
 | {action:'restore-conflict';reason:string;contradictionId:string;resolutionId:string}
 | {action:'assess-time';reason:string;evidenceIds:readonly string[];entity:string;timeScope:string;temporal:'addresses-scope'|'unresolved';basis:string}
 | {action:'validate';reason:string;firsthand:string;evidenceIds:readonly string[]}
 | {action:'edit';reason:string;text:string;entity:string;timeScope:string}
 | {action:'withdraw'|'reopen';reason:string}
 | {action:'assess';reason:string;evidenceIds:readonly string[];effect:'supports'|'contradicts'|'does-not-resolve';entity:string;timeScope:string;independence:'unknown'|'established';origins:readonly {evidenceId:string;group:string;basis:string}[]};
export function informationText(value:unknown,max=1200):string {
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))throw Error('Nonblank bounded text required');return value.trim();
}
function keys(value:object,allowed:string[]):void {if(Object.keys(value).sort().join(',')!==allowed.sort().join(','))throw Error('Unexpected or missing information fields');}
export function validateInformationEvidence(e:InformationEvidence,accountId:string,principal:string):void {
 keys(e,['id','accountId','sourceId','lineage','title','url','excerpt','entity','publicationDate','currentThrough','retrievedAt','custody']);
 keys(e.custody,['kind','identity','contentSha256','excerptSha256','principal']);
 if(e.accountId!==accountId||!['context','research'].includes(e.custody.kind)||e.custody.kind==='research'&&e.custody.principal!==principal)throw Error('Evidence authority mismatch');
 for(const value of [e.sourceId,e.lineage,e.title,e.entity,e.retrievedAt,e.custody.identity])informationText(value,2000);
 informationText(e.excerpt,12000); if(!/^https?:\/\//u.test(e.url)||e.url.length>2000)throw Error('Unsafe source URL');
 for(const date of [e.publicationDate,e.currentThrough])if(date!==null&&(!/^\d{4}-\d{2}-\d{2}$/u.test(date)||!Number.isFinite(Date.parse(date))))throw Error('Invalid evidence date');
 if(!/^[a-f0-9]{64}$/u.test(e.custody.contentSha256)||e.custody.excerptSha256!==createHash('sha256').update(e.excerpt).digest('hex'))throw Error('Evidence content mismatch');
 const {id,...payload}=e;if(id!=='ev_'+informationHash(payload))throw Error('Evidence snapshot mismatch');
}
export function evidenceSnapshot(payload:Omit<InformationEvidence,'id'>):InformationEvidence {return {...payload,id:'ev_'+informationHash(payload)};}
export function newInformation(input:Pick<AccountInformation,'text'|'entity'|'timeScope'|'origin'|'evidence'>,authority:InformationAuthority):AccountInformation {
 const payload={...input,text:informationText(input.text),entity:informationText(input.entity),timeScope:informationText(input.timeScope)};
 const value:AccountInformation={kind:'atliera.c3.account-information',schemaVersion:'3',id:'info_'+informationHash([authority.accountId,authority.principal,payload]),accountId:authority.accountId,principal:authority.principal,version:1,revision:1,...payload,statements:[{text:payload.text,entity:payload.entity,timeScope:payload.timeScope}],history:[]};
 validateInformation(value,authority.accountId,authority.principal);return value;
}
function checkedChange(value:unknown,item:AccountInformation):InformationChange {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid information action');
 const c=value as InformationChange;
 const fields=c.action==='resolve'?['contradictionIds','text','entity','timeScope','category','basis','firsthand','evidenceIds']:c.action==='restore-conflict'?['contradictionId','resolutionId']:c.action==='validate'?['firsthand','evidenceIds']:c.action==='edit'?['text','entity','timeScope']:c.action==='assess-time'?['evidenceIds','entity','timeScope','temporal','basis']:c.action==='assess'?['evidenceIds','effect','entity','timeScope','independence','origins']:['withdraw','reopen'].includes(c.action)?[]:null;
 if(!fields)throw Error('Unknown information action');keys(c,['action','reason',...fields]);informationText(c.reason);
 if(c.action==='resolve'||c.action==='restore-conflict'){
  if(item.schemaVersion!=='3')throw Error('Conflict resolution requires information schema 3');
  const conflicts=informationConflicts(item);
  if(c.action==='restore-conflict'){
   if(typeof c.contradictionId!=='string'||typeof c.resolutionId!=='string'||!conflicts.some(x=>x.id===c.contradictionId&&x.resolution?.id===c.resolutionId))throw Error('Resolution is missing, foreign, expired or already restored');
  }else{
   if(!Array.isArray(c.contradictionIds)||!c.contradictionIds.length||c.contradictionIds.length>20||new Set(c.contradictionIds).size!==c.contradictionIds.length||c.contradictionIds.some(id=>!conflicts.some(x=>x.id===id&&!x.resolution)))throw Error('Unknown, duplicate or already resolved contradiction');
   if(c.text!==item.text||c.entity!==item.entity||c.timeScope!==item.timeScope)throw Error('Resolution must name the exact current proposition, entity and time scope');
   if(!['evidence-correction','different-scope','firsthand'].includes(c.category))throw Error('Invalid resolution category');
   informationText(c.basis);
   if(c.category==='firsthand'&&!c.firsthand?.trim())throw Error('Specific firsthand basis required');
  }
 }
 if(c.action==='edit')return {...c,text:informationText(c.text),entity:informationText(c.entity),timeScope:informationText(c.timeScope)};
 if(c.action==='validate'||c.action==='resolve'||c.action==='assess'||c.action==='assess-time'){
  if(!Array.isArray(c.evidenceIds)||c.evidenceIds.length>20||new Set(c.evidenceIds).size!==c.evidenceIds.length||c.evidenceIds.some(id=>!item.evidence.some(e=>e.id===id)))throw Error('Unknown or duplicate evidence reference');
  if(c.action==='validate'||c.action==='resolve'){if(typeof c.firsthand!=='string'||c.firsthand.length>1200)throw Error('Invalid firsthand basis');if(c.firsthand)informationText(c.firsthand);if(!c.evidenceIds.length&&!c.firsthand.trim())throw Error('Specific evidence or firsthand basis required');}
  else if(c.action==='assess-time'){
   if(item.schemaVersion==='1')throw Error('Temporal assessment requires information schema 2');
   if(!c.evidenceIds.length||!['addresses-scope','unresolved'].includes(c.temporal))throw Error('Invalid temporal assessment');
   informationText(c.basis);informationText(c.entity);informationText(c.timeScope);
   if(c.entity!==item.entity||c.timeScope!==item.timeScope)throw Error('Temporal assessment must address this exact entity and time scope');
   if(c.temporal==='addresses-scope'&&(c.timeScope.toLowerCase()==='unknown'||c.evidenceIds.some(id=>item.evidence.find(e=>e.id===id)!.entity!==item.entity)))throw Error('Temporal relevance requires a bounded scope and matching evidence entity');
  }
  else {
   if(!['supports','contradicts','does-not-resolve'].includes(c.effect)||!['unknown','established'].includes(c.independence)||!c.evidenceIds.length||!Array.isArray(c.origins)||c.origins.length>20)throw Error('Invalid evidence assessment');
   informationText(c.entity);informationText(c.timeScope);
   if(c.entity!==item.entity||c.timeScope!==item.timeScope)throw Error('Assessment must address this exact entity and time scope');
   const seen=new Set<string>();for(const origin of c.origins){keys(origin,['evidenceId','group','basis']);informationText(origin.group);informationText(origin.basis);if(!c.evidenceIds.includes(origin.evidenceId)||seen.has(origin.evidenceId))throw Error('Invalid origin assessment');seen.add(origin.evidenceId);}
   if(c.independence==='established'){
    if(c.effect!=='supports'||c.timeScope==='Unknown'||seen.size!==c.evidenceIds.length||new Set(c.origins.map(o=>o.group)).size<2)throw Error('Independent origin and relevance assessment incomplete');
    const evidence=c.evidenceIds.map(id=>item.evidence.find(e=>e.id===id)!);
    if(evidence.some(e=>e.entity!==item.entity))throw Error('Independent assessment evidence entity mismatch');
    if(new Set(evidence.map(e=>e.lineage)).size<2||new Set(evidence.map(e=>e.custody.contentSha256)).size<2)throw Error('Repeated source lineage cannot corroborate itself');
    // Same documentary lineage must retain a common origin group, regardless of URLs.
    for(const a of evidence)for(const b of evidence)if(a.lineage===b.lineage&&c.origins.find(o=>o.evidenceId===a.id)!.group!==c.origins.find(o=>o.evidenceId===b.id)!.group)throw Error('Common origin mismatch');
   }
  }
 }
 return structuredClone(c);
}
export function reviseInformation(item:AccountInformation,input:unknown,authority:InformationAuthority,additional:readonly InformationEvidence[]=[]):AccountInformation {
 validateInformation(item,authority.accountId,authority.principal);
 if(additional.length&&(input as InformationChange)?.action!=='assess')throw Error('New evidence requires an assessment');
 const evidence=[...item.evidence];for(const e of additional){validateInformationEvidence(e,item.accountId,item.principal);if(!evidence.some(x=>x.id===e.id))evidence.push(structuredClone(e));}
 const change=checkedChange(input,{...item,schemaVersion:'3',evidence});
 const prior=item.history.at(-1);
 if(!additional.some(e=>!item.evidence.some(x=>x.id===e.id))&&prior?.revision===item.revision&&canonicalJson(prior.change)===canonicalJson(change))return item;
 if(change.action==='edit'&&change.text===item.text&&change.entity===item.entity&&change.timeScope===item.timeScope)return item;
 const revision=item.revision+(change.action==='edit'?1:0);
 const result:AccountInformation={...item,schemaVersion:'3',statements:change.action==='edit'?[...item.statements,{text:informationText(change.text),entity:informationText(change.entity),timeScope:informationText(change.timeScope)}]:item.statements,...(change.action==='edit'?{text:informationText(change.text),entity:informationText(change.entity),timeScope:informationText(change.timeScope)}:{}),evidence,revision,version:item.version+1,history:[...item.history,{revision,actor:authority.principal,at:authority.at,change}]};
 assertInformationRestorationCapacity(result);
 validateInformation(result,authority.accountId,authority.principal);return result;
}
export function validateInformation(item:AccountInformation,accountId:string,principal:string):void {
 keys(item,['kind','schemaVersion','id','accountId','principal','version','revision','text','entity','timeScope','statements','origin','evidence','history']);
 if(item.kind!=='atliera.c3.account-information'||!['1','2','3'].includes(item.schemaVersion)||item.accountId!==accountId||item.principal!==principal||!/^info_[a-f0-9]{64}$/u.test(item.id)||!Number.isSafeInteger(item.version)||item.version<1||!Number.isSafeInteger(item.revision)||item.revision<1||item.revision>item.version||!Array.isArray(item.history)||item.history.length>100||item.version!==item.history.length+1||!Array.isArray(item.evidence)||item.evidence.length>40)throw Error('Invalid information identity/version');
 informationText(item.text);informationText(item.entity);informationText(item.timeScope);
 if(!Array.isArray(item.statements)||item.statements.length!==item.revision||item.statements.length>100||canonicalJson(item.statements.at(-1))!==canonicalJson({text:item.text,entity:item.entity,timeScope:item.timeScope}))throw Error('Statement revision mismatch');
 for(const statement of item.statements){keys(statement,['text','entity','timeScope']);informationText(statement.text);informationText(statement.entity);informationText(statement.timeScope);}
 if(!item.origin||!['source','failed-check'].includes(item.origin.kind)||!/^[a-f0-9]{64}$/u.test(item.origin.contextSha256))throw Error('Invalid information origin');informationText(item.origin.binding,2000);
 for(const e of item.evidence)validateInformationEvidence(e,accountId,principal);
 if(new Set(item.evidence.map(e=>e.id)).size!==item.evidence.length)throw Error('Repeated evidence');
 // Replay each action against its strict preceding history, never the final state.
 // A well-shaped resolution cannot reference future, foreign or already closed history.
 let revision=1;const prefix:InformationEntry[]=[];
 for(const h of item.history){
  keys(h,['revision','actor','at','change']);
  if(h.actor!==principal||typeof h.at!=='string'||!Number.isFinite(Date.parse(h.at))||new Date(h.at).toISOString()!==h.at)throw Error('Invalid review attribution');
  const before={...item,...item.statements[revision-1]!,revision,history:prefix};
  const c=checkedChange(h.change,before);
  if(c.action==='edit'){
   revision++;
   if(canonicalJson(item.statements[revision-1])!==canonicalJson({text:c.text,entity:c.entity,timeScope:c.timeScope}))throw Error('Edited statement history mismatch');
  }
  if(h.revision!==revision)throw Error('Nonsequential statement revision');
  prefix.push(h);
 }
 if(revision!==item.revision)throw Error('Incomplete statement history');
}
/** Stable identity binds the exact immutable entry, its position, item and authority. */
export function informationEntryId(item:AccountInformation,index:number):string {
 return 'ih_'+informationHash([item.id,item.accountId,item.principal,index+1,item.history[index]]);
}
export interface InformationConflict {
 id:string;entry:InformationEntry;statement:AccountInformation['statements'][number];
 resolution?:{id:string;entry:InformationEntry};
}
/** Derived state only. Edits expire judgments; review reopening never changes them. */
export function informationConflicts(item:AccountInformation):InformationConflict[] {
 const conflicts:InformationConflict[]=[];
 item.history.forEach((entry,index)=>{
  const c=entry.change,id=informationEntryId(item,index);
  if(c.action==='edit')for(const conflict of conflicts)delete conflict.resolution;
  if(c.action==='assess'&&c.effect==='contradicts')conflicts.push({id,entry,statement:item.statements[entry.revision-1]!});
  if(c.action==='resolve')for(const conflict of conflicts)if(c.contradictionIds.includes(conflict.id))conflict.resolution={id,entry};
  if(c.action==='restore-conflict'){
   const conflict=conflicts.find(x=>x.id===c.contradictionId&&x.resolution?.id===c.resolutionId);
   if(conflict)delete conflict.resolution;
  }
 });
 return conflicts;
}
/** Write-time invariant only: historical records and snapshots remain readable unchanged. */
export function assertInformationRestorationCapacity(item:AccountInformation):void {
 if(item.history.length+informationConflicts(item).filter(c=>c.resolution).length>100)
  throw Error('Information history capacity reached. Change not saved: room is required to restore each resolved conflict. Reasoning kept.');
}
export function designation(item:AccountInformation,asSaved=false):{labels:string[];reason:string} {
 const current=item.history.filter(h=>h.revision===item.revision);
 const validation=current.filter(h=>['validate','withdraw'].includes(h.change.action)).at(-1);
 const assessment=current.filter(h=>h.change.action==='assess'||h.change.action==='reopen').at(-1);
 const c=assessment?.change;const corroborated=c?.action==='assess'&&c.effect==='supports'&&c.independence==='established';
 const supported=c?.action==='assess'&&c.effect==='supports'||item.origin.kind==='source'&&item.revision===1&&item.evidence.length>0;
 // Preserve historical snapshot labels; live review carries conflicts across revisions.
 const historical=asSaved&&item.schemaVersion!=='3';
 const conflicts=historical?current.filter(h=>h.change.action==='assess'&&h.change.effect==='contradicts'):informationConflicts(item).filter(c=>!c.resolution);
 const temporalEntry=current.filter(h=>h.change.action==='assess-time'||h.change.action==='reopen').at(-1);
 const temporal=temporalEntry?.change;
 const supportIds=c?.action==='assess'&&c.effect==='supports'?c.evidenceIds:supported?item.evidence.map(e=>e.id):[];
 const timeAssessed=temporal?.action==='assess-time'&&temporal.temporal==='addresses-scope'&&supportIds.length>0&&supportIds.every(id=>temporal.evidenceIds.includes(id));
 const labels=[corroborated?'Independently corroborated':supported?'Source-backed':'Not independently checked'];
 if(conflicts.length)labels.push('Conflicting evidence');
 if(!timeAssessed||!corroborated||conflicts.length)labels.push('Needs confirmation');
 if(timeAssessed)labels.push('Time scope assessed by operator');
 if(validation?.change.action==='validate')labels.push('Operator validated');
 const temporalReason=timeAssessed?`Time-scope basis recorded by ${temporalEntry!.actor} at ${temporalEntry!.at}: ${temporal!.action==='assess-time'?temporal!.basis:''}`
  :temporal?.action==='assess-time'?`Time scope still needs confirmation for the supporting evidence. Recorded temporal basis: ${temporal.basis}`
  :'Time scope needs confirmation: evidence dates, missing dates and relevance to this exact statement have not been separately assessed. Older evidence may address a historical claim; retrieval and independent origins do not establish currentness.';
 const conflictReason=conflicts.length?(historical?` ${conflicts.length} unresolved contradiction(s) for this statement revision remain in history. Later support and reopening do not resolve them; conflict resolution is not available in UV1.`:` ${conflicts.length} unresolved contradiction(s), including earlier statement scopes, require explicit review. Edits, later support and reopening do not clear conflict attention.`):'';
 return {labels,reason:[c?.reason,temporalReason+conflictReason].filter(Boolean).join(' ')};
}
export interface InformationAttachment {readonly kind:'atliera.c3.information-attachment';readonly schemaVersion:'1';readonly snapshot:AccountInformation;readonly snapshotSha256:string;}
export function informationAttachment(snapshot:AccountInformation):InformationAttachment {return {kind:'atliera.c3.information-attachment',schemaVersion:'1',snapshot:structuredClone(snapshot),snapshotSha256:informationHash(snapshot)};}
export function validateInformationAttachments(items:readonly InformationAttachment[],accountId:string,principal?:string):void {
 if(!Array.isArray(items)||items.length>20||new Set(items.map(x=>x.snapshot.id)).size!==items.length)throw Error('Invalid information attachments');
 for(const item of items){keys(item,['kind','schemaVersion','snapshot','snapshotSha256']);if(item.kind!=='atliera.c3.information-attachment'||item.schemaVersion!=='1'||item.snapshotSha256!==informationHash(item.snapshot))throw Error('Invalid attachment snapshot');validateInformation(item.snapshot,accountId,principal??item.snapshot.principal);}
}
