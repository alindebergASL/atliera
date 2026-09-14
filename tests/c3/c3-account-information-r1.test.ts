import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {newInformation,reviseInformation,designation,evidenceSnapshot,informationAttachment,validateInformationAttachments,validateInformation,type AccountInformation,type InformationChange} from '../../src/c3/account-information.ts';
import {LocalInformationStore} from '../../src/c3/account-information-store.ts';
import {renderAccountInformation,renderInformationAttachments} from '../../src/c3/account-information-render.ts';
const a={principal:'synthetic-operator',accountId:'acct-harbor',at:'2026-09-13T12:00:00.000Z'};
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(date:string|null='2020-01-01',scope='2026-09-13') {
 const evidence=['first','second','contradiction'].map(source=>evidenceSnapshot({accountId:a.accountId,sourceId:source,lineage:'https://'+source+'.example.org',title:'Synthetic '+source,url:'https://'+source+'.example.org',excerpt:'Synthetic report '+source,entity:'Harbor Transit',publicationDate:date,currentThrough:date,retrievedAt:a.at,custody:{kind:'research',identity:'synthetic:'+source,contentSha256:digest(source),excerptSha256:digest('Synthetic report '+source),principal:a.principal}}));
 const item=newInformation({text:'Synthetic pilot status',entity:'Harbor Transit',timeScope:scope,evidence,origin:{kind:'source',contextSha256:'a'.repeat(64),binding:'synthetic'}},a);
 const support:InformationChange={action:'assess',reason:'Separate witnesses address this proposition',evidenceIds:evidence.slice(0,2).map(e=>e.id),effect:'supports',entity:item.entity,timeScope:scope,independence:'established',origins:evidence.slice(0,2).map(e=>({evidenceId:e.id,group:e.sourceId,basis:'Independent direct witness of this proposition'}))};
 const temporal:InformationChange={action:'assess-time',reason:'Review the documentary period separately',entity:item.entity,timeScope:scope,evidenceIds:evidence.slice(0,2).map(e=>e.id),temporal:'addresses-scope',basis:'Both reports explicitly describe the January 2020 pilot; the claim is limited to that historical period. Later retrieval is not the basis.'};
 return {item,evidence,support,temporal};
}
test('R1 contradictions survive later support, reopening, temporal assessment and store restart',()=>{
 const {item,evidence,support,temporal}=fixture('2020-01-01','January 2020');
 let x=reviseInformation(item,{...support,effect:'contradicts',reason:'Third report disputes this exact pilot',independence:'unknown',origins:[],evidenceIds:[evidence[2]!.id]},a);
 const contradiction=structuredClone(x.history[0]);
 assert.equal(reviseInformation(x,{action:'edit',reason:'Whitespace only is no change',text:' '+x.text+' ',entity:' '+x.entity+' ',timeScope:' '+x.timeScope+' '},a),x);
 x=reviseInformation(x,support,a);
 assert.ok(designation(x).labels.includes('Independently corroborated'));
 assert.ok(designation(x).labels.includes('Conflicting evidence'));
 x=reviseInformation(x,temporal,a);
 assert.ok(designation(x).labels.includes('Needs confirmation'));
 x=reviseInformation(x,{action:'reopen',reason:'Reconsider the report'},a);
 assert.ok(designation(x).labels.includes('Conflicting evidence'));
 assert.deepEqual(x.history[0],contradiction);
 assert.throws(()=>reviseInformation(x,{action:'resolve',reason:'Declare it true'},a),/Unknown/);
 const root=mkdtempSync(join(tmpdir(),'uv1-r1-conflict-'));
 try {
  const options={root:join(root,'work'),principal:a.principal};const s=new LocalInformationStore(options,a.accountId);
  let stored=s.save(item,0);
  for(const h of x.history)stored=s.save(reviseInformation(stored,h.change,a),stored.version);
  const reopened=new LocalInformationStore(options,a.accountId).load(item.id);
  assert.deepEqual(reopened,x);assert.ok(designation(reopened).labels.includes('Conflicting evidence'));
  const attachment=informationAttachment(reopened);validateInformationAttachments([attachment],a.accountId,a.principal);
  const html=renderInformationAttachments([attachment],[reopened],1);
  assert.match(html,/unresolved contradiction/);assert.match(html,/Third report disputes/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('R1 stale and missing dates remain attention despite equal arbitrary scope and independent support',()=>{
 for(const date of ['2020-01-01',null])for(const scope of ['2026-09-13','arbitrary matching scope']){
  const {item,support}=fixture(date,scope);const x=reviseInformation(item,support,a);
  assert.ok(designation(x).labels.includes('Independently corroborated'));
  assert.ok(designation(x).labels.includes('Needs confirmation'));
  assert.ok(!designation(x).labels.includes('No unresolved attention recorded'));
  const html=renderAccountInformation([x],[],true,false,0);
  assert.match(html,/Time scope needs confirmation/);assert.match(html,date?/Current through: 2020-01-01/:/Current through: Unknown/);
 }
});
test('R1 historical scope can be assessed separately with attributed revision/evidence-bound temporal basis',()=>{
 const {item,support,temporal}=fixture('2020-01-01','January 2020');let x=reviseInformation(item,support,a);
 assert.ok(designation(x).labels.includes('Needs confirmation'));
 for(const invalid of [{...temporal,basis:' '},{...temporal,timeScope:'2026'},{...temporal,entity:'Other'},{...temporal,evidenceIds:[]},{...temporal,evidenceIds:['ev_unknown']},{...temporal,actor:'spoof'}])assert.throws(()=>reviseInformation(x,invalid,a));
 x=reviseInformation(x,temporal,a);
 assert.ok(!designation(x).labels.includes('Needs confirmation'));
 assert.ok(designation(x).labels.includes('Time scope assessed by operator'));
 assert.match(designation(x).reason,/synthetic-operator.*January 2020/);
 assert.equal(x.evidence[0]?.currentThrough,'2020-01-01');
 assert.equal(x.history.at(-1)?.revision,x.revision);
 const html=renderAccountInformation([x],[],true,false,0);assert.match(html,/Temporal basis:/);assert.match(html,/Assess time scope/);
 assert.ok(designation(reviseInformation(x,{...temporal,temporal:'unresolved',basis:'The period is still unclear'},a)).labels.includes('Needs confirmation'));
 assert.ok(designation(reviseInformation(x,{...temporal,evidenceIds:[item.evidence[0]!.id]},a)).labels.includes('Needs confirmation'));
 assert.ok(designation(reviseInformation(x,{action:'reopen',reason:'Recheck the period'},a)).labels.includes('Needs confirmation'));
 const unknown=fixture(null,'Unknown');assert.throws(()=>reviseInformation(unknown.item,unknown.temporal,a),/bounded scope/);
 // A time-scope assessment alone does not establish semantic support or independent origins.
 const candidate={...item,origin:{...item.origin,kind:'failed-check' as const}};
 const timed=reviseInformation(candidate,temporal,a);
 assert.ok(designation(timed).labels.includes('Not independently checked'));
 assert.ok(designation(timed).labels.includes('Needs confirmation'));
});
test('R1 full statement/entity/time edit and does-not-resolve cannot inherit source support or temporal assessment',()=>{
 const {item,support,temporal}=fixture('2020-01-01','January 2020');
 let x=reviseInformation(reviseInformation(item,support,a),temporal,a);
 x=reviseInformation(x,{action:'edit',reason:'Change all scope fields',text:'Entirely unrelated assertion',entity:'Different entity',timeScope:'2099'},a);
 assert.ok(!designation(x).labels.includes('Source-backed'));assert.ok(!designation(x).labels.includes('Time scope assessed by operator'));
 x=reviseInformation(x,{...support,entity:x.entity,timeScope:x.timeScope,effect:'does-not-resolve',independence:'unknown',origins:[]},a);
 assert.ok(!designation(x).labels.includes('Source-backed'));assert.ok(designation(x).labels.includes('Needs confirmation'));
 x=reviseInformation(x,{...support,entity:x.entity,timeScope:x.timeScope,independence:'unknown',origins:[],reason:'Explicit assessment of the new wording and scope'},a);
 assert.ok(designation(x).labels.includes('Source-backed'));assert.ok(!designation(x).labels.includes('Independently corroborated'));
 assert.ok(designation(x).labels.includes('Needs confirmation'));assert.equal(x.origin,item.origin);
});
test('R1 schema 1 assessment stores and attachment bytes remain readable; explicit temporal review promotes to schema 2',()=>{
 const {item,support,temporal}=fixture('2020-01-01','January 2020');
 const legacy:AccountInformation={...item,schemaVersion:'1'};
 const legacyReviewed:AccountInformation={...reviseInformation(legacy,support,a),schemaVersion:'1'};
 const attachment=informationAttachment(legacyReviewed);const retained=JSON.stringify(attachment);
 validateInformationAttachments([attachment],a.accountId,a.principal);
 assert.ok(designation(legacyReviewed).labels.includes('Independently corroborated'));assert.ok(designation(legacyReviewed).labels.includes('Needs confirmation'));
 const root=mkdtempSync(join(tmpdir(),'uv1-r1-legacy-'));
 try{
  const opts={root:join(root,'work'),principal:a.principal};let s=new LocalInformationStore(opts,a.accountId);
  s.save(legacy,0);s.save(legacyReviewed,1);
  const files=readdirSync(s.root).map(name=>({name,bytes:readFileSync(join(s.root,name),'utf8')}));
  s=new LocalInformationStore(opts,a.accountId);assert.deepEqual(s.load(item.id),legacyReviewed);
  const next=s.save(reviseInformation(s.load(item.id),temporal,a),2);assert.equal(next.schemaVersion,'2');assert.deepEqual(next.history.slice(0,-1),legacyReviewed.history);
  for(const f of files)assert.equal(readFileSync(join(s.root,f.name),'utf8'),f.bytes);
  assert.deepEqual(new LocalInformationStore(opts,a.accountId).load(item.id),next);
  assert.throws(()=>validateInformation({...next,schemaVersion:'1'},a.accountId,a.principal),/schema 2/);
  assert.equal(JSON.stringify(attachment),retained);validateInformationAttachments([attachment],a.accountId,a.principal);validateInformationAttachments([informationAttachment(next)],a.accountId,a.principal);
  assert.throws(()=>validateInformationAttachments([{...attachment,schemaVersion:'2' as '1'}],a.accountId,a.principal),/attachment snapshot/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
