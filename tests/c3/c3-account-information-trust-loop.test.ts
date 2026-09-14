import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {newInformation,reviseInformation,designation,informationHash,validateInformation,informationAttachment,type AccountInformation} from '../../src/c3/account-information.ts';
import {renderInformationAttachments} from '../../src/c3/account-information-render.ts';
import {evidenceSnapshot} from '../../src/c3/account-information.ts';
const a={accountId:'acct-synthetic',principal:'synthetic.operator',at:'2026-09-14T12:00:00.000Z'};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const e=evidenceSnapshot({accountId:a.accountId,sourceId:'synthetic-report',lineage:'synthetic-author',title:'Synthetic contradictory report',url:'https://synthetic.example/report',excerpt:'Synthetic pilot was cancelled.',entity:'Synthetic entity',publicationDate:null,currentThrough:null,retrievedAt:a.at,custody:{kind:'context',identity:'synthetic',contentSha256:sha('Synthetic pilot was cancelled.'),excerptSha256:sha('Synthetic pilot was cancelled.'),principal:null}});
const fixture=()=>newInformation({text:'Synthetic pilot started.',entity:e.entity,timeScope:'September 2026',origin:{kind:'failed-check',contextSha256:'a'.repeat(64),binding:'synthetic',failure:'semantic_refusal'},evidence:[e]},a);
const conflict=(x:AccountInformation,reason='Synthetic report contradicts start')=>reviseInformation(x,{action:'assess',reason,evidenceIds:[e.id],effect:'contradicts',entity:x.entity,timeScope:x.timeScope,independence:'unknown',origins:[]},a);
const edit=(x:AccountInformation)=>reviseInformation(x,{action:'edit',reason:'Narrow the proposition',text:x.text+' Revised.',entity:'Other synthetic entity',timeScope:'October 2026'},a);
const id=(x:AccountInformation,index:number)=>'ih_'+informationHash([x.id,x.accountId,x.principal,index+1,x.history[index]]);
const resolve=(x:AccountInformation,targets=[id(x,0)])=>({action:'resolve',reason:'Different pilot in the retained report',contradictionIds:targets,text:x.text,entity:x.entity,timeScope:x.timeScope,category:'different-scope',basis:'Report concerns the cancelled demonstration, not the September production pilot.',firsthand:'I attended the synthetic production pilot.',evidenceIds:[e.id]});
test('trust loop carries conflict across edits; exact scoped human resolution and restore retain evidence',()=>{
 let x=conflict(fixture());const original=structuredClone(x.history[0]);x=edit(x);
 assert.ok(designation(x).labels.includes('Conflicting evidence'));
 x=reviseInformation(x,resolve(x),a);assert.equal(x.schemaVersion,'3');assert.ok(!designation(x).labels.includes('Conflicting evidence'));
 assert.ok(!designation(x).labels.includes('Operator validated'));assert.ok(!designation(x).labels.includes('Independently corroborated'));
 const resolution=id(x,2);x=reviseInformation(x,{action:'reopen',reason:'Check supporting evidence again'},a);assert.ok(!designation(x).labels.includes('Conflicting evidence'));
 x=reviseInformation(x,{action:'restore-conflict',reason:'The pilot distinction was mistaken',contradictionId:id(x,0),resolutionId:resolution},a);
 assert.ok(designation(x).labels.includes('Conflicting evidence'));assert.deepEqual(x.history[0],original);assert.deepEqual(x.evidence,[e]);
 validateInformation(JSON.parse(JSON.stringify(x)),a.accountId,a.principal);
});
test('edit invalidates resolved scope and later contradictions remain independently open',()=>{
 let x=conflict(fixture());x=reviseInformation(x,resolve(x),a);x=conflict(x,'Later independently selected conflict');
 assert.ok(designation(x).labels.includes('Conflicting evidence'));
 assert.throws(()=>reviseInformation(x,resolve(x),a));
 x=reviseInformation(x,resolve(x,[id(x,2)]),a);assert.ok(!designation(x).labels.includes('Conflicting evidence'));
 x=edit(x);assert.ok(designation(x).labels.includes('Conflicting evidence'));
 assert.match(designation(x).reason,/2 unresolved/);
});
test('resolution rejects missing, foreign, duplicate, future, spoofed or unsupported targets; replay rejects forged transitions',()=>{
 const x=conflict(fixture());const good=resolve(x);
 for(const bad of [{...good,contradictionIds:[]},{...good,contradictionIds:[id(x,0),id(x,0)]},{...good,contradictionIds:['ih_'+'f'.repeat(64)]},{...good,text:'Other proposition'},{...good,basis:' '},{...good,firsthand:'',evidenceIds:[]},{...good,evidenceIds:['foreign']},{...good,actor:'forged'}])assert.throws(()=>reviseInformation(x,bad,a));
 const resolved=reviseInformation(x,good,a);
 const forged=structuredClone(resolved);(forged.history as any[]).push({...forged.history[1]});(forged as any).version++;
 assert.throws(()=>validateInformation(forged,a.accountId,a.principal));
 const outOfOrder=structuredClone(resolved);(outOfOrder.history as any[]).reverse();assert.throws(()=>validateInformation(outOfOrder,a.accountId,a.principal));
 const wrongRevision=structuredClone(edit(x));(wrongRevision.history[1] as any).revision=1;assert.throws(()=>validateInformation(wrongRevision,a.accountId,a.principal));
});
test('legacy attachment labels stay as saved while current comparison carries earlier conflict',()=>{
 const x={...edit(conflict(fixture())),schemaVersion:'2' as const};const attachment=informationAttachment(x);const bytes=JSON.stringify(attachment);
 validateInformation(x,a.accountId,a.principal);assert.ok(designation(x).labels.includes('Conflicting evidence'));
 const html=renderInformationAttachments([attachment],[x],1);
 const included=html.split('Included snapshot')[1]!.split('Current information')[0]!;
 assert.doesNotMatch(included,/information-labels[^]*?<strong>Conflicting evidence/);
 assert.equal(JSON.stringify(attachment),bytes);
});

test('multiple selected conflicts restore individually; old resolution cannot reopen a later judgment',()=>{
 let x=conflict(conflict(fixture()),'Second synthetic conflict');const ids=[id(x,0),id(x,1)];
 x=reviseInformation(x,resolve(x,ids),a);const resolutionId=id(x,2);
 const restore={action:'restore-conflict',reason:'First judgment needs review',contradictionId:ids[0],resolutionId};
 x=reviseInformation(x,restore,a);assert.match(designation(x).reason,/1 unresolved/);
 x=reviseInformation(x,resolve(x,[ids[0]!]),a);assert.throws(()=>reviseInformation(x,restore,a));
 const serialized=JSON.parse(JSON.stringify(x));validateInformation(serialized,a.accountId,a.principal);
 const edited=edit(x);assert.throws(()=>reviseInformation(edited,{...restore,contradictionId:ids[1]},a));
 assert.match(designation(edited).reason,/2 unresolved/);
 for(const schemaVersion of ['1','2','4'])assert.throws(()=>validateInformation({...x,schemaVersion} as AccountInformation,a.accountId,a.principal));
});

test('new schema resolves legacy contradictions without changing historical snapshot labels or bytes',()=>{
 for(const schemaVersion of ['1','2'] as const){
  const legacy={...conflict(fixture()),schemaVersion};const old=informationAttachment(legacy),bytes=JSON.stringify(old);
  const x=reviseInformation(legacy,resolve(legacy),a);assert.equal(x.schemaVersion,'3');
  assert.deepEqual(x.history.slice(0,-1),legacy.history);assert.deepEqual(x.statements,legacy.statements);
  const html=renderInformationAttachments([old],[x],1);
  assert.match(html,/Included snapshot[^]*?Conflicting evidence/);assert.match(html,/Current status changed/);assert.match(html,/Refresh working snapshot/);
  assert.equal(JSON.stringify(old),bytes);
 }
});
