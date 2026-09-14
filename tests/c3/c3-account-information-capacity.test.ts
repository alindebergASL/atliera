import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync,readdirSync,readFileSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalJson} from '../../src/c3/context.ts';
import {newInformation,reviseInformation,informationConflicts,informationHash,evidenceSnapshot,validateInformation,designation,informationAttachment,type AccountInformation} from '../../src/c3/account-information.ts';
import {LocalInformationStore} from '../../src/c3/account-information-store.ts';
import {LocalWorkStore,newWorkDocumentId} from '../../src/c3/work-store.ts';
import {startC3Server} from '../../src/c3/service.ts';
import {DisabledC3ModelProvider} from '../../src/c3/provider.ts';
import {researchBrowser} from '../helpers/c3-research-browser.ts';
import {syntheticWorkshopContext,syntheticMeetingRequest,syntheticMeetingCandidate} from '../fixtures/c3-workshop.ts';
import {createC3ModelRequest,createGenerationRecord} from '../../src/c3/generation-contract.ts';
const a={accountId:'acct-harbor',principal:'synthetic.operator',at:'2026-09-14T12:00:00.000Z'};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function fixture(authority=a,length=10,count=1,text='Synthetic pilot started'):AccountInformation {
 const evidence=Array.from({length:count},(_,i)=>{const excerpt='\ud800'.repeat(length);return evidenceSnapshot({accountId:authority.accountId,sourceId:`synthetic-${i}`,lineage:`synthetic-${i}`,title:'Synthetic report',url:'https://synthetic.example/report',excerpt,entity:'Synthetic entity',publicationDate:null,currentThrough:null,retrievedAt:a.at,custody:{kind:'context',identity:`synthetic-${i}`,contentSha256:hash(excerpt),excerptSha256:hash(excerpt),principal:null}});});
 return newInformation({text,entity:'Synthetic entity',timeScope:'September 2026',evidence,origin:{kind:'failed-check',binding:'synthetic-capacity',contextSha256:'a'.repeat(64)}},authority);
}
const conflict=(x:AccountInformation,reason='Synthetic contradiction')=>reviseInformation(x,{action:'assess',reason,evidenceIds:[x.evidence[0]!.id],entity:x.entity,timeScope:x.timeScope,effect:'contradicts',independence:'unknown',origins:[]},a);
const judgment=(x:AccountInformation)=>({action:'resolve',reason:'Synthetic scope judgment',contradictionIds:informationConflicts(x).filter(c=>!c.resolution).map(c=>c.id),text:x.text,entity:x.entity,timeScope:x.timeScope,category:'firsthand',basis:'Different synthetic pilot',firsthand:'Synthetic attendance',evidenceIds:[]});
const restore=(x:AccountInformation,reason='Synthetic judgment reversed')=>{const c=informationConflicts(x).find(c=>c.resolution)!;return {action:'restore-conflict',reason,contradictionId:c.id,resolutionId:c.resolution!.id};};
function pad(x:AccountInformation,length:number):AccountInformation {
 // Public local-store simulation of ordinary distinct reviews; validate full replay.
 const history=[...x.history];while(history.length<length)history.push({revision:x.revision,actor:x.principal,at:a.at,change:{action:'reopen',reason:`Synthetic review ${history.length}`}});
 const result={...x,history,version:history.length+1};validateInformation(result,x.accountId,x.principal);return result;
}
const envelope=(x:AccountInformation)=>canonicalJson({item:x,sha256:informationHash(x)})+'\n';
function seed(s:LocalInformationStore,x:AccountInformation):void {
 // Seed one valid boundary-sized latest publication instead of thousands of fsynced
 // historical writes. Production load, CAS, prefix, quota and publication run unchanged.
 validateInformation(x,x.accountId,x.principal);
 writeFileSync(join(s.root,informationHash([x.principal,x.accountId]).slice(0,32)+'-'+x.id+'.v'+String(x.version).padStart(6,'0')+'.json'),envelope(x),{mode:0o600});
}
function fill(s:LocalInformationStore,total:number):void {
 const count=readdirSync(s.root).length;for(let i=count;i<total;i++)writeFileSync(join(s.root,`.synthetic-quota-${i}`),'',{mode:0o600});
 // Inert synthetic directory entries exercise the actual shared names() quota.
 assert.equal(readdirSync(s.root).length,total);
}
function bytes(root:string){return Object.fromEntries(readdirSync(root).sort().map(n=>[n,hash(readFileSync(join(root,n),'utf8'))]));}

test('model rejects history-99 judgment cleanly; previous judgments retain room through later reviews and exact edge restore',()=>{
 const x=pad(conflict(fixture()),99),before=envelope(x);
 assert.throws(()=>reviseInformation(x,judgment(x),a),/history capacity.*not saved/i);assert.equal(envelope(x),before);
 let accepted=reviseInformation(pad(conflict(fixture()),97),judgment(x),a);
 accepted=reviseInformation(accepted,{action:'reopen',reason:'Last ordinary review'},a);
 assert.equal(accepted.history.length,99);
 assert.throws(()=>reviseInformation(accepted,{action:'withdraw',reason:'Cannot consume restore slot'},a),/history capacity/);
 assert.equal(reviseInformation(accepted,{action:'reopen',reason:'Last ordinary review'},a),accepted);
 assert.equal(reviseInformation(accepted,{action:'edit',reason:'Same wording',text:accepted.text,entity:accepted.entity,timeScope:accepted.timeScope},a),accepted);
 const reversed=reviseInformation(accepted,restore(accepted),a);assert.equal(reversed.history.length,100);assert.equal(informationConflicts(reversed)[0]!.resolution,undefined);
 assert.ok(!designation(accepted).labels.includes('Operator validated'));assert.ok(!designation(accepted).labels.includes('Independently corroborated'));
});

test('model reserves each target separately; partial restoration and edit expiration release only their reservations',()=>{
 const x=pad(conflict(conflict(fixture()),'Second synthetic contradiction'),97);
 const accepted=reviseInformation(x,judgment(x),a);assert.equal(accepted.history.length,98);
 assert.throws(()=>reviseInformation(accepted,{action:'reopen',reason:'Would strand target two'},a),/history capacity/);
 const partial=reviseInformation(accepted,restore(accepted),a);assert.equal(informationConflicts(partial).filter(c=>c.resolution).length,1);
 assert.throws(()=>reviseInformation(partial,{action:'reopen',reason:'Would strand remaining target'},a),/history capacity/);
 assert.equal(reviseInformation(partial,restore(partial),a).history.length,100);
 const edited=reviseInformation(accepted,{action:'edit',reason:'New scope',text:'Other synthetic pilot',entity:accepted.entity,timeScope:accepted.timeScope},a);
 assert.equal(informationConflicts(edited).filter(c=>c.resolution).length,0);
 assert.equal(reviseInformation(edited,{action:'reopen',reason:'Released capacity'},a).history.length,100);
});

test('store refuses unsafe direct history publication without changing records; legacy no-change still reads unchanged',t=>{
 const root=mkdtempSync(join(tmpdir(),'capacity-history-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const s=new LocalInformationStore({root:join(root,'work'),principal:a.principal},a.accountId);
 const x=pad(conflict(fixture()),99);seed(s,x);const before=bytes(s.root);
 const unsafe={...x,version:101,history:[...x.history,{revision:x.revision,actor:a.principal,at:a.at,change:judgment(x)}]} as AccountInformation;
 validateInformation(unsafe,a.accountId,a.principal);assert.throws(()=>s.save(unsafe,x.version),/history capacity/);assert.deepEqual(bytes(s.root),before);
 for(const schemaVersion of ['1','2'] as const){const legacy={...x,schemaVersion};seed(s,legacy);assert.deepEqual(s.load(x.id),legacy);assert.deepEqual(s.save(legacy,legacy.version),legacy);}
});

test('shared quota protects multi-target restores from same-item, unrelated-item, new-item and other-authority writes',t=>{
 const root=mkdtempSync(join(tmpdir(),'capacity-quota-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const opts={root:join(root,'work'),principal:a.principal};const s=new LocalInformationStore(opts,a.accountId);
 const x=conflict(conflict(fixture()),'Second synthetic contradiction');seed(s,x);
 const otherAuthority={...a,accountId:'acct-cedar',principal:'other.operator'};const other=new LocalInformationStore({...opts,principal:otherAuthority.principal},otherAuthority.accountId);const unrelated=fixture(otherAuthority);other.save(unrelated,0);
 const sameAccount=fixture(a,10,1,'Another synthetic item');s.save(sameAccount,0);
 fill(s,4087);let accepted=s.save(reviseInformation(x,judgment(x),a),x.version);assert.equal(readdirSync(s.root).length,4088);
 const before=bytes(s.root);
 assert.throws(()=>s.save(reviseInformation(accepted,{action:'reopen',reason:'Steal reserved slot'},a),accepted.version),/store capacity/);
 assert.throws(()=>s.save(reviseInformation(sameAccount,{action:'reopen',reason:'Unrelated review'},a),1),/store capacity/);
 assert.throws(()=>other.save(reviseInformation(unrelated,{action:'reopen',reason:'Other account and principal'},otherAuthority),1),/store capacity/);
 const fresh=fixture(a,10,1,'New synthetic item');assert.throws(()=>s.save(fresh,0),/store capacity/);assert.deepEqual(bytes(s.root),before);
 assert.deepEqual(s.save(accepted,accepted.version),accepted);
 accepted=s.save(reviseInformation(accepted,restore(accepted),a),accepted.version);assert.equal(readdirSync(s.root).length,4089);
 assert.throws(()=>other.save(reviseInformation(unrelated,{action:'reopen',reason:'Remaining reservation'},otherAuthority),1),/store capacity/);
 accepted=s.save(reviseInformation(accepted,restore(accepted),a),accepted.version);assert.equal(readdirSync(s.root).length,4090);assert.equal(informationConflicts(accepted).filter(c=>c.resolution).length,0);
 assert.deepEqual(new LocalInformationStore(opts,a.accountId).load(x.id),accepted);
});

test('store rejects NEW judgment at shared quota edge before saving',t=>{
 const root=mkdtempSync(join(tmpdir(),'capacity-new-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const s=new LocalInformationStore({root:join(root,'work'),principal:a.principal},a.accountId);
 const x=conflict(fixture());seed(s,x);fill(s,4089);const before=bytes(s.root);
 assert.throws(()=>s.save(reviseInformation(x,judgment(x),a),x.version),/store capacity.*not saved/i);assert.deepEqual(bytes(s.root),before);assert.deepEqual(s.load(x.id),x);
});

test('shared reservation scan keeps no-follow, checksum and authority binding; immutable prefix still rejects rewrites',t=>{
 const root=mkdtempSync(join(tmpdir(),'capacity-security-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const opts={root:join(root,'work'),principal:a.principal},s=new LocalInformationStore(opts,a.accountId);
 const x=conflict(fixture());seed(s,x);const next=reviseInformation(x,{action:'reopen',reason:'Ordinary synthetic review'},a);
 const rewritten=structuredClone(next);(rewritten.history[0]!.change as {reason:string}).reason='Rewritten original';assert.throws(()=>s.save(rewritten,x.version),/Historical information changed/);
 const otherAuthority={...a,principal:'other.operator',accountId:'acct-cedar'},other=new LocalInformationStore({...opts,principal:otherAuthority.principal},otherAuthority.accountId),unrelated=fixture(otherAuthority);other.save(unrelated,0);
 const name=readdirSync(s.root).find(n=>n.includes(unrelated.id))!,path=join(s.root,name),original=readFileSync(path,'utf8');
 renameSync(path,path+'.synthetic-backup');symlinkSync(path+'.synthetic-backup',path);
 assert.throws(()=>s.save(next,x.version));unlinkSync(path);renameSync(path+'.synthetic-backup',path);
 writeFileSync(path,original.replace(informationHash(unrelated),'0'.repeat(64)));assert.throws(()=>s.save(next,x.version),/readback mismatch/);
 writeFileSync(path,envelope({...unrelated,principal:a.principal}));assert.throws(()=>s.save(next,x.version),/readback mismatch/);
 writeFileSync(path,original);assert.deepEqual(s.load(x.id),x);assert.deepEqual(s.save(next,x.version),next);
});

const longestReason='\ud800'.repeat(1200);
const farFuture={...a,at:'+010000-01-01T00:00:00.000Z'};
function largeCandidate(length:number){const prior=conflict(fixture(a,length,40)),next=reviseInformation(prior,judgment(prior),a);return {prior,next,restored:reviseInformation(next,restore(next,longestReason),farFuture)};}
test('2 MB envelope reserves worst legal restore bytes; near-limit judgment and later oversized reviews refuse cleanly',t=>{
 const root=mkdtempSync(join(tmpdir(),'capacity-bytes-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const s=new LocalInformationStore({root:join(root,'work'),principal:a.principal},a.accountId);
 // Each extra lone surrogate in each of 40 excerpts adds exactly 240 envelope
 // bytes; identities and hashes stay fixed-width. Avoid repeated huge fixtures.
 const sample=largeCandidate(8000);
 const low=8000+Math.floor((2_000_000-Buffer.byteLength(envelope(sample.restored)))/240);
 const safe=largeCandidate(low),unsafe=largeCandidate(low+1);
 assert.ok(Buffer.byteLength(envelope(safe.restored))>1_999_750);assert.ok(Buffer.byteLength(envelope(unsafe.next))<2_000_000);
 seed(s,unsafe.prior);const before=bytes(s.root);assert.throws(()=>s.save(unsafe.next,unsafe.prior.version),/record capacity/);assert.deepEqual(bytes(s.root),before);
 seed(s,safe.prior);const accepted=s.save(safe.next,safe.prior.version),published=bytes(s.root);
 assert.throws(()=>s.save(reviseInformation(accepted,{action:'reopen',reason:longestReason},a),accepted.version),/record capacity/);assert.deepEqual(bytes(s.root),published);
 assert.deepEqual(s.save(safe.restored,accepted.version),safe.restored);assert.deepEqual(s.load(accepted.id),safe.restored);
});

test('service capacity refusal preserves item bytes, saved attachment, work state and submitted reason; exact edge reversal succeeds',async t=>{
 const root=mkdtempSync(join(tmpdir(),'capacity-service-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const context=syntheticWorkshopContext(),workStore={root:join(root,'work'),principal:a.principal};
 const s=new LocalInformationStore(workStore,a.accountId),x=pad(conflict(fixture()),99);seed(s,x);
 const record=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest,undefined,'5'),syntheticMeetingCandidate(context),context),work=new LocalWorkStore(workStore,context),documentId=newWorkDocumentId(),attachment=informationAttachment(x);
 work.save(documentId,0,{record,records:[record],correctionNote:'Synthetic capacity proof',sectionNotes:{},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1,informationAttachments:[attachment]});
 const server=await startC3Server({context,provider:new DisabledC3ModelProvider(),workStore,accounts:[],listen:process.env.C3_TEST_REAL_HTTP==='1'});
 try{
  const b=researchBrowser(server);await b.call(a.accountId,'/');assert.equal((await b.call(a.accountId,'/api/reopen',{documentId})).status,200);
  const before=bytes(s.root),savedBytes=bytes(workStore.root),state=(await b.call(a.accountId,'/api/work-state',{})).json();const change=judgment(x),reason=change.reason;
  const response=await b.call(a.accountId,'/api/information/change',{id:x.id,expectedVersion:x.version,additionalEvidenceIds:[],change});assert.equal(response.status,409);assert.match(response.json().error,/history capacity.*not saved.*Reasoning kept/);assert.equal(change.reason,reason);
  assert.deepEqual(bytes(s.root),before);assert.deepEqual(bytes(workStore.root),savedBytes);assert.deepEqual((await b.call(a.accountId,'/api/work-state',{})).json(),state);assert.deepEqual(work.load(documentId).work.informationAttachments,[attachment]);
  // Separate accepted boundary fixture; service uses the real latest record and CAS.
  const prior=pad(conflict(fixture(a,10,1,'Second synthetic pilot')),98),accepted=reviseInformation(prior,judgment(prior),a);seed(s,accepted);
  const refusal=await b.call(a.accountId,'/api/information/change',{id:accepted.id,expectedVersion:accepted.version,additionalEvidenceIds:[],change:{action:'reopen',reason:'Cannot steal history'}});assert.equal(refusal.status,409);
  const reversed=await b.call(a.accountId,'/api/information/change',{id:accepted.id,expectedVersion:accepted.version,additionalEvidenceIds:[],change:restore(accepted)});assert.equal(reversed.status,200,reversed.text);assert.equal(reversed.json().item.history.length,100);assert.equal(informationConflicts(reversed.json().item).filter(c=>c.resolution).length,0);
  assert.deepEqual(bytes(workStore.root),savedBytes);assert.equal(server.status().generationAttempted,0);
 }finally{await server.close();}
});
