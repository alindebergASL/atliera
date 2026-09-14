import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {INFORMATION_CLIENT_SCRIPT} from '../../src/c3/account-information-client.ts';
import {renderAccountInformation} from '../../src/c3/account-information-render.ts';
import {newInformation} from '../../src/c3/account-information.ts';
import {readInformationLaunch,INFORMATION_PREVIEW_MODE} from '../../src/c3/account-information-config.ts';
import {startC3Server} from '../../src/c3/service.ts';
import {syntheticWorkshopContext} from '../fixtures/c3-workshop.ts';
import {researchBrowser} from '../helpers/c3-research-browser.ts';

// Minimal DOM doubles exercise the actual client script. Browser layout/AT proof is parent-owned.
function clientFixture() {
 const searchHandlers:Record<string,()=>void>={},formHandlers:Record<string, (...args:any[])=>any>={};
 let clear=()=>{},click:(e:any)=>Promise<void>=async()=>{};
 let focused='',requests:any[]=[];
 const count={textContent:''};
 const briefStatus={textContent:'Brief saved · information reviews are separate.'};
 const status:any={textContent:'',children:[] as any[],append(node:any){this.children.push(node);},setAttribute(){},focus(){focused='status';}};
 const fields:any={action:{value:'validate'},reason:{value:'Keep my typed review reasoning'},firsthand:{value:'Synthetic firsthand basis'}};
 const detail={open:false};
 const form:any={dataset:{id:'info_'+'a'.repeat(64),version:'1'},elements:{namedItem:(n:string)=>fields[n]},addEventListener:(n:string,f:any)=>{formHandlers[n]=f;},querySelectorAll:(s:string)=>s==='input,textarea,select,button'?Object.values(fields):[],querySelector:()=>status,closest:()=>cards[0]};
 const card=(text:string):any=>({hidden:false,text,querySelectorAll(s:string){assert.equal(s,'[data-information-search-text]');return [{textContent:this.text}];},querySelector:(s:string)=>s==='[data-information-detail]'?detail:status,replaceWith(next:any){cards[0]=next;}});
 const cards=[card('Synthetic access passage Harbor source newsletter 2026 access plan'),card('Synthetic budget statement Cedar source annual report 2020 budget scope')];
 const panel={hasAttribute:()=>true,querySelectorAll:()=>cards,querySelector:()=>count,getAttribute:()=> 'record-synthetic',matches:()=>false};
 const search={value:'',closest:()=>panel,addEventListener:(n:string,f:()=>void)=>{searchHandlers[n]=f;},focus:()=>{focused='search';}};
 let replacement=card('Changed synthetic passage Cedar');
 let response:any={saved:true,item:{id:form.dataset.id,version:2},html:'public synthetic response'};
 const context:any={document:{querySelector:(s:string)=>s==='[data-working-brief-status]'?briefStatus:s==='[data-account-information]'?panel:s==='[data-information-search]'?search:s==='[data-information-search-count]'?count:s==='[data-information-search-clear]'?{addEventListener:(_n:string,f:()=>void)=>{clear=f;}}:null,querySelectorAll:()=>[form],addEventListener:(_n:string,f:any)=>{click=f;},getElementById:()=>cards[0],importNode:(n:any)=>n,createElement:(tag:string)=>({tag})},window:{location:{hash:''},addEventListener(){},confirm:()=>false},DOMParser:class{parseFromString(){return {querySelector:()=>replacement};}},requestJson:async(route:string,body:any)=>{requests.push({route,body});return route==='/api/work-state'?{recordId:'record-synthetic',documentId:'document-synthetic',workVersion:1,saved:false}:response;},confirmDirtyNavigation:()=>true,saveBusy:false,reviewBusy:false,workDocumentId:'document-synthetic',accountUrl:(route:string)=>'/accounts/acct-harbor'+route};
 vm.runInNewContext(INFORMATION_CLIENT_SCRIPT,context);
 return {cards,fields,status,briefStatus,count,search,requests,context,focused:()=>focused,setResponse:(r:any)=>{response=r;},filter:(q:string)=>{search.value=q;searchHandlers.input!();},nativeClear:()=>{search.value='';searchHandlers.search!();},clear:()=>clear(),input:()=>formHandlers.input!(),submit:()=>formHandlers.submit!({preventDefault(){}} as never),add:()=>click({preventDefault(){},target:{closest:()=>({dataset:{id:form.dataset.id,informationVersion:'1'},getAttribute:()=> 'add',closest:(s:string)=>s==='article'?{querySelector:()=>status}:panel})}})};
}

test('local information search matches statement/entity/scope/source without status boilerplate, bounds literal input and clears without mutation',()=>{
 const f=clientFixture();const before=JSON.stringify(f.fields);const nodes=[...f.cards];
 assert.equal(f.count.textContent,'2 of 2 information cards');
 for(const q of ['ACCESS','harbor','newsletter','2026 access plan']){
  f.filter(q);assert.equal(f.cards[0].hidden,false,q);assert.equal(f.cards[1].hidden,true,q);assert.equal(f.count.textContent,'1 of 2 information cards');
 }
 f.filter('not independently checked');assert.ok(f.cards.every(c=>c.hidden));
 f.filter('<script>throw Error()</script>');assert.ok(f.cards.every(c=>c.hidden));assert.match(f.count.textContent,/0 of 2.*No matches/);
 f.filter('x'.repeat(300));assert.equal(f.search.value.length,200);
 f.clear();assert.ok(f.cards.every(c=>!c.hidden));assert.equal(f.focused(),'search');assert.equal(f.count.textContent,'2 of 2 information cards');
 f.filter('no match');f.nativeClear();assert.ok(f.cards.every(c=>!c.hidden));
 assert.deepEqual(f.cards,nodes);assert.equal(JSON.stringify(f.fields),before);assert.deepEqual(f.requests,[]);
});

test('filter preserves dirty reasoning and reapplies after confirmed card replacement without focusing a hidden card',async()=>{
 const f=clientFixture();f.input();f.filter('harbor');f.clear();assert.equal(f.fields.reason.value,'Keep my typed review reasoning');assert.equal(f.context.confirmDirtyNavigation(),false);
 f.filter('harbor');await f.submit();assert.equal(f.cards[0].hidden,true);assert.match(f.count.textContent,/Information review saved.*0 of 2/);assert.equal(f.focused(),'search');assert.equal(f.search.value,'harbor');assert.equal(f.requests.length,1);
 assert.equal(f.requests[0].route,'/api/information/change');assert.ok(!JSON.stringify(f.requests[0].body).includes('harbor'));
});

test('confirmed Account addition exposes an account-qualified Save link and explicit unsaved status without saving',async()=>{
 const f=clientFixture();f.setResponse({saved:false,attachments:[],workVersion:2,status:'Working context updated locally. Save the brief to retain this version.'});await f.add();
 assert.match(f.status.textContent,/updated locally.*Save the brief/);assert.deepEqual(f.status.children,[{tag:'a',href:'/accounts/acct-harbor/?draft=1',textContent:'Return to brief and Save'}]);
 assert.deepEqual(f.requests.map(r=>r.route),['/api/work-state','/api/work/information']);
 const failed=clientFixture();failed.setResponse({saved:true,attachments:[],workVersion:2});await failed.add();assert.equal(failed.status.children.length,0);assert.match(failed.status.textContent,/not confirmed/);
});

test('no-change addition invalidates a stale saved banner without claiming brief persistence',async()=>{
 const f=clientFixture();f.setResponse({saved:false,attachments:[],workVersion:1,noChange:true});await f.add();
 assert.doesNotMatch(f.briefStatus.textContent,/Brief saved/);
 assert.match(f.briefStatus.textContent,/Inspect the brief.*Save status/);
 assert.deepEqual(f.requests.map(r=>r.route),['/api/work-state','/api/work/information']);
});

test('search markup is labeled, bounded, keyboard-native and rendering leaves information bytes unchanged',()=>{
 const item=newInformation({text:'Synthetic <statement>',entity:'Harbor',timeScope:'Unknown',evidence:[],origin:{kind:'source',contextSha256:'a'.repeat(64),binding:'synthetic'}},{principal:'synthetic.operator',accountId:'acct-harbor',at:'2026-09-14T00:00:00.000Z'});
 const before=JSON.stringify(item);const html=renderAccountInformation([item],[],true,true,1);
 assert.match(html,/<label for="information-search">Find information<\/label>/);assert.match(html,/type="search" maxlength="200"/);assert.match(html,/data-information-search-clear>Clear search/);assert.match(html,/data-information-search-count role="status" aria-live="polite" aria-atomic="true"/);assert.match(html,/class="user-copy" data-information-search-text>Synthetic &lt;statement&gt;/);assert.equal(JSON.stringify(item),before);
});

function launchFixture(t:any) {
 const root=mkdtempSync(join(tmpdir(),'c3-ux-public-synthetic-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const config={kind:'atliera.c3.retained-information-launch',schemaVersion:'1',workStore:{root:join(root,'work'),principal:'synthetic.operator'},accounts:[{context:syntheticWorkshopContext(),attempts:[],origins:[]}]};
 const path=join(root,'launch.json');
 return {config,read:(value:unknown)=>{writeFileSync(path,JSON.stringify(value),{mode:0o600});return readInformationLaunch(path);}};
}

test('retained launch accepts absent preview, rejects malformed/extra metadata and freezes validated exact identity',t=>{
 const f=launchFixture(t);assert.equal(f.read(f.config)[0]!.informationPreview,undefined);
 const preview={mode:INFORMATION_PREVIEW_MODE,buildSha:'a'.repeat(40)};
 for(const invalid of [null,[],{},'text',{...preview,buildSha:'a'.repeat(39)},{...preview,buildSha:'a'.repeat(41)},{...preview,buildSha:'<script>'},{...preview,buildSha:'A'.repeat(40)},{...preview,mode:'<b>Fresh verification</b>'},{...preview,enabled:true}])assert.throws(()=>f.read({...f.config,preview:invalid}),/Invalid retained information preview/);
 const valid=f.read({...f.config,preview});assert.deepEqual(valid[0]!.informationPreview,preview);assert.ok(Object.isFrozen(valid[0]!.informationPreview));assert.equal(valid[0]!.provider.name,'disabled');
});

test('serve-information preview reaches rendered header and root/account health only when configured; effects stay disabled',async t=>{
 const f=launchFixture(t);const preview={mode:INFORMATION_PREVIEW_MODE,buildSha:'b'.repeat(40)};
 for(const configured of [false,true]){
  const entries=f.read({...f.config,...(configured?{preview}:{})});const server=await startC3Server({...entries[0]!,accounts:[],listen:false});
  try{
   const b=researchBrowser(server);const page=await b.call('acct-harbor','/');assert.equal(page.status,200,page.text);
   for(const account of ['','acct-harbor']){const health=await b.call(account,'/healthz');assert.equal(health.status,200);assert.deepEqual(health.json().preview,configured?preview:undefined);assert.equal(health.json().generationAttempted,0);}
   if(configured){assert.match(page.text,/aria-label="Preview identity"/);assert.ok(page.text.includes(preview.buildSha));assert.ok(page.text.includes(preview.mode));assert.match(page.text,/Configured operator only; no multi-user sign-in/);assert.match(page.text,/not fresh verification/);assert.match(page.text,/not a signature or permission/);}else assert.ok(!page.text.includes('aria-label="Preview identity"'));
  }finally{await server.close();}
 }
});
