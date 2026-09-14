import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {LocalInformationStore} from '../../src/c3/account-information-store.ts';import {newInformation,reviseInformation} from '../../src/c3/account-information.ts';
const a={principal:'synthetic-operator',accountId:'acct-harbor',at:'2026-09-13T12:00:00.000Z'};
test('private immutable CAS, restart, no-change and interrupted acknowledgement',()=>{
 const root=mkdtempSync(join(tmpdir(),'uv1-store-'));try{
 const opts={root:join(root,'work'),principal:a.principal};let s=new LocalInformationStore(opts,a.accountId);const x=newInformation({text:'Synthetic uncertain statement',entity:'Harbor',timeScope:'Unknown',evidence:[],origin:{kind:'source',contextSha256:'a'.repeat(64),binding:'synthetic'}},a);
 assert.deepEqual(s.save(x,0),x);s=new LocalInformationStore(opts,a.accountId);assert.deepEqual(s.load(x.id),x);assert.deepEqual(s.save(x,1),x);
 assert.equal(new LocalInformationStore({...opts,principal:'second-operator'},a.accountId).list().length,0);
 assert.equal(new LocalInformationStore(opts,'acct-cedar').list().length,0);
 const next=reviseInformation(x,{action:'validate',reason:'Observed directly',firsthand:'I attended',evidenceIds:[]},a);
 assert.throws(()=>s.save(next,0),/conflict/i);
 const faulty=new LocalInformationStore({...opts,fault:(stage:string)=>{if(stage==='after-publish')throw Error('Interrupted readback');}},a.accountId);
 assert.throws(()=>faulty.save(next,1),/Interrupted/);assert.deepEqual(s.load(x.id),next);assert.throws(()=>s.load('../escape'));
 }finally{rmSync(root,{recursive:true,force:true});rmSync(join(root,'work.information'),{recursive:true,force:true});}
});
