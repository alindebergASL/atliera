import test from 'node:test';
import assert from 'node:assert/strict';
import { newInformation, reviseInformation, designation } from '../../src/c3/account-information.ts';
const authority={principal:'synthetic-operator',accountId:'acct-harbor',at:'2026-09-13T12:00:00.000Z'};
const item=()=>newInformation({text:'A useful unconfirmed statement.',entity:'Harbor Transit',timeScope:'Unknown',evidence:[],origin:{kind:'source',contextSha256:'a'.repeat(64),binding:'synthetic'}},authority);
test('firsthand validation remains unchecked; edits and withdrawal retain history without carrying validation',()=>{
 let x=item(); assert.deepEqual(designation(x).labels,['Not independently checked','Needs confirmation']);
 assert.throws(()=>reviseInformation(x,{action:'validate',reason:' ',firsthand:'I observed this',evidenceIds:[]},authority));
 x=reviseInformation(x,{action:'validate',reason:'I observed the event',firsthand:'I attended the synthetic event',evidenceIds:[]},authority);
 assert.ok(designation(x).labels.includes('Operator validated')); assert.ok(!designation(x).labels.includes('Independently corroborated'));
 assert.equal(reviseInformation(x,{action:'validate',reason:'I observed the event',firsthand:'I attended the synthetic event',evidenceIds:[]},authority),x);
 const edited=reviseInformation(x,{action:'edit',reason:'Narrow the wording',text:'A narrower statement.',entity:x.entity,timeScope:x.timeScope},authority);
 assert.ok(!designation(edited).labels.includes('Operator validated')); assert.equal(edited.history.length,2);
 const withdrawn=reviseInformation(x,{action:'withdraw',reason:'My recollection was incomplete'},authority);
 assert.ok(!designation(withdrawn).labels.includes('Operator validated')); assert.equal(withdrawn.history.length,2);
});
test('client cannot supply actor, time or final designation',()=>{
 for(const extra of [{principal:'attacker'},{at:authority.at},{corroborated:true}]) assert.throws(()=>reviseInformation(item(),{action:'reopen',reason:'Recheck',...extra},authority));
});

test('corroboration is an attributed relevance and independent origins assessment; conflict preserves validation',async()=>{
 const {evidenceSnapshot}=await import('../../src/c3/account-information.ts');const {createHash}=await import('node:crypto');
 const evidence=(source:string,text:string)=>evidenceSnapshot({accountId:authority.accountId,sourceId:source,lineage:'https://'+source+'.example.org',title:'Synthetic '+source,url:'https://'+source+'.example.org',excerpt:text,entity:'Harbor Transit',publicationDate:null,currentThrough:null,retrievedAt:authority.at,custody:{kind:'research',identity:'snapshot-synthetic:'+source,contentSha256:createHash('sha256').update(text).digest('hex'),excerptSha256:createHash('sha256').update(text).digest('hex'),principal:authority.principal}});
 const first=evidence('first','Synthetic first independently authored report.'),second=evidence('second','Synthetic second independent author report.'),conflict=evidence('conflict','Synthetic contradictory report.');
 let x=reviseInformation(item(),{action:'edit',reason:'Establish a bounded proposition',text:'Synthetic pilot began in September 2026.',entity:'Harbor Transit',timeScope:'September 2026'},authority);
 x=reviseInformation(x,{action:'validate',reason:'I attended',firsthand:'Direct observation',evidenceIds:[]},authority);
 const assessment={action:'assess',reason:'Each independent reporter witnessed the September pilot for Harbor Transit',effect:'supports',entity:x.entity,timeScope:x.timeScope,independence:'established',evidenceIds:[first.id,second.id],origins:[{evidenceId:first.id,group:'first author',basis:'Direct witness of the September Harbor pilot'},{evidenceId:second.id,group:'second author',basis:'Separate direct witness of the same September Harbor pilot'}]};
 assert.throws(()=>reviseInformation(x,{...assessment,entity:'Other entity'},authority,[first,second]));
 assert.throws(()=>reviseInformation(x,{...assessment,timeScope:'2020'},authority,[first,second]));
 assert.throws(()=>reviseInformation(x,{...assessment,origins:assessment.origins.map(o=>({...o,group:'same author'}))},authority,[first,second]));
 const duplicate=evidence('second',first.excerpt);assert.throws(()=>reviseInformation(x,{...assessment,evidenceIds:[first.id,duplicate.id],origins:[assessment.origins[0],{...assessment.origins[1],evidenceId:duplicate.id}]},authority,[first,duplicate]),/lineage/);
 const unchecked=reviseInformation(x,{...assessment,independence:'unknown',origins:[]},authority,[first,second]);assert.ok(!designation(unchecked).labels.includes('Independently corroborated'));
 x=reviseInformation(x,assessment,authority,[first,second]);assert.ok(designation(x).labels.includes('Independently corroborated'));assert.ok(designation(x).labels.includes('Operator validated'));
 x=reviseInformation(x,{...assessment,reason:'Later retained source contradicts this proposition',effect:'contradicts',independence:'unknown',evidenceIds:[conflict.id],origins:[]},authority,[conflict]);
 assert.ok(designation(x).labels.includes('Conflicting evidence'));assert.ok(designation(x).labels.includes('Operator validated'));assert.equal(x.history.at(-2)?.actor,authority.principal);
});
