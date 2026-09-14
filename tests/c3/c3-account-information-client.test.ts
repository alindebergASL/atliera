import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {INFORMATION_CLIENT_SCRIPT} from '../../src/c3/account-information-client.ts';
function fixture(result:unknown|Error){
 const fields:Record<string,any>={action:{value:'validate'},reason:{value:'My specific reasoning'},firsthand:{value:'I attended the synthetic meeting'},text:{value:'Original text'},entity:{value:'Harbor'},timeScope:{value:'Unknown'},resolutionText:{value:'Original text'},resolutionCategory:{value:'firsthand'},resolutionBasis:{value:'Different synthetic event'},restoreTarget:{value:JSON.stringify({contradictionId:'ih_conflict',resolutionId:'ih_resolution'})},temporal:{value:'unresolved'},temporalBasis:{value:'The retained dates do not establish the current period'}};
 const handlers:Record<string,any>={};const status={textContent:''};let replaced=false;let sent:any;
 let cancel=()=>{};let reset=false;const detail={open:true,querySelector:()=>({focus(){}})};
 const form:any={reset:()=>{reset=true;fields.reason.value='';},dataset:{id:'info_'+'a'.repeat(64),version:'1'},elements:{namedItem:(n:string)=>fields[n]},addEventListener:(n:string,f:any)=>{handlers[n]=f;},querySelectorAll:(selector:string)=>selector==='input,textarea,select,button'?Object.values(fields):[],querySelector:(selector:string)=>selector==='[data-information-cancel]'?{addEventListener:(_event:string,fn:()=>void)=>{cancel=fn;}}:status,closest:(selector:string)=>selector==='[data-information-detail]'?detail:({replaceWith:()=>{replaced=true;}})};
 const root={hasAttribute:()=>true};const windowHandlers:Record<string,any>={};
 const context:any={document:{querySelector:(selector:string)=>selector==='[data-account-information]'?root:null,querySelectorAll:()=>[form],addEventListener:()=>{}},window:{location:{hash:''},addEventListener:(n:string,f:any)=>{windowHandlers[n]=f;},confirm:()=>false},requestJson:async(route:string,body:any)=>{sent={route,body};if(result instanceof Error)throw result;return result;},confirmDirtyNavigation:()=>true,saveBusy:false,reviewBusy:false};
 vm.runInNewContext(INFORMATION_CLIENT_SCRIPT,context);
 return {fields,status,form,context,windowHandlers,cancel:()=>cancel(),reset:()=>reset,detail,submitted:()=>sent,replaced:()=>replaced,submit:()=>handlers.submit({preventDefault(){}}),input:()=>handlers.input()};
}
test('refused or unconfirmed saves keep typed reasoning and restore controls, with exact client schema',async()=>{
 for(const response of [new Error('Stale information version'),new Error('Information store capacity reached. Change not saved: room is required to restore each resolved conflict. Reasoning kept.'),{saved:false},{saved:true,item:{id:'foreign',version:2}}]){
  const f=fixture(response);f.input();await f.submit();assert.equal(f.fields.reason.value,'My specific reasoning');assert.equal(f.replaced(),false);assert.equal(f.fields.reason.disabled,false);
  const submitted=f.submitted();assert.equal(submitted.route,'/api/information/change');assert.deepEqual(JSON.parse(JSON.stringify(submitted.body)),{id:'info_'+'a'.repeat(64),expectedVersion:1,change:{action:'validate',reason:'My specific reasoning',firsthand:'I attended the synthetic meeting',evidenceIds:[]},additionalEvidenceIds:[]});
  assert.ok(f.status.textContent);assert.equal(f.context.confirmDirtyNavigation(),false);let prevented=false;f.windowHandlers.beforeunload({preventDefault(){prevented=true;}});assert.equal(prevented,true);
 }
});

test('time-scope review submits its separate basis and scope without actor or origin endorsement',async()=>{
 const f=fixture(new Error('Synthetic refused save'));f.fields.action.value='assess-time';f.input();await f.submit();
 assert.deepEqual(JSON.parse(JSON.stringify(f.submitted().body.change)),{action:'assess-time',reason:'My specific reasoning',evidenceIds:[],entity:'Harbor',timeScope:'Unknown',temporal:'unresolved',basis:'The retained dates do not establish the current period'});
 assert.deepEqual(JSON.parse(JSON.stringify(f.submitted().body.additionalEvidenceIds)),[]);
 assert.equal(f.fields.temporalBasis.value,'The retained dates do not establish the current period');assert.equal(f.fields.temporal.disabled,false);
});

// Input serialization only; parent owns actual Chromium interaction evidence.
test('resolution and reversal serialize exact displayed scope and target without client attribution',async()=>{
 const f=fixture(new Error('Synthetic refusal'));const originalQuery=f.form.querySelectorAll;f.form.querySelectorAll=(selector:string)=>selector==='[name="contradiction"]:checked'?[{value:'ih_selected'}]:originalQuery(selector);f.fields.action.value='resolve';await f.submit();
 assert.deepEqual(JSON.parse(JSON.stringify(f.submitted().body.change)),{action:'resolve',reason:'My specific reasoning',contradictionIds:['ih_selected'],text:'Original text',entity:'Harbor',timeScope:'Unknown',category:'firsthand',basis:'Different synthetic event',firsthand:'I attended the synthetic meeting',evidenceIds:[]});
 f.fields.action.value='restore-conflict';await f.submit();
 assert.deepEqual(JSON.parse(JSON.stringify(f.submitted().body.change)),{action:'restore-conflict',reason:'My specific reasoning',contradictionId:'ih_conflict',resolutionId:'ih_resolution'});
 assert.equal(f.fields.reason.disabled,false);assert.equal(f.fields.reason.value,'My specific reasoning');
});


test('missing validation basis is caught before a request and keeps reasoning and dirty departure guard',async()=>{
 const f=fixture(new Error('Must not submit'));f.fields.firsthand.value='  ';f.input();await f.submit();
 assert.equal(f.submitted(),undefined);assert.equal(f.replaced(),false);assert.match(f.status.textContent,/Select an attached evidence passage/);
 assert.equal(f.fields.reason.value,'My specific reasoning');assert.equal(f.context.confirmDirtyNavigation(),false);
 f.fields.firsthand.value='A specific observation';await f.submit();assert.equal(f.submitted().route,'/api/information/change');
});


test('cancel requires deliberate discard of dirty review and never sends a save',()=>{
 const f=fixture({saved:false});f.input();f.cancel();assert.equal(f.reset(),false);assert.equal(f.detail.open,true);
 assert.equal(f.fields.reason.value,'My specific reasoning');assert.equal(f.context.confirmDirtyNavigation(),false);
 f.context.window.confirm=()=>true;f.cancel();assert.equal(f.reset(),true);assert.equal(f.detail.open,false);
 assert.equal(f.context.confirmDirtyNavigation(),true);assert.equal(f.submitted(),undefined);
});
