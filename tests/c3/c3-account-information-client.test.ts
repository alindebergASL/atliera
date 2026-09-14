import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {INFORMATION_CLIENT_SCRIPT} from '../../src/c3/account-information-client.ts';
function fixture(result:unknown|Error){
 const fields:Record<string,any>={action:{value:'validate'},reason:{value:'My specific reasoning'},firsthand:{value:'I attended the synthetic meeting'},text:{value:'Original text'},entity:{value:'Harbor'},timeScope:{value:'Unknown'},temporal:{value:'unresolved'},temporalBasis:{value:'The retained dates do not establish the current period'}};
 const handlers:Record<string,any>={};const status={textContent:''};let replaced=false;let sent:any;
 const form:any={dataset:{id:'info_'+'a'.repeat(64),version:'1'},elements:{namedItem:(n:string)=>fields[n]},addEventListener:(n:string,f:any)=>{handlers[n]=f;},querySelectorAll:(selector:string)=>selector==='input,textarea,select,button'?Object.values(fields):[],querySelector:()=>status,closest:()=>({replaceWith:()=>{replaced=true;}})};
 const root={hasAttribute:()=>true};const windowHandlers:Record<string,any>={};
 const context:any={document:{querySelector:(selector:string)=>selector==='[data-account-information]'?root:null,querySelectorAll:()=>[form],addEventListener:()=>{}},window:{location:{hash:''},addEventListener:(n:string,f:any)=>{windowHandlers[n]=f;},confirm:()=>false},requestJson:async(route:string,body:any)=>{sent={route,body};if(result instanceof Error)throw result;return result;},confirmDirtyNavigation:()=>true,saveBusy:false,reviewBusy:false};
 vm.runInNewContext(INFORMATION_CLIENT_SCRIPT,context);
 return {fields,status,form,context,windowHandlers,submitted:()=>sent,replaced:()=>replaced,submit:()=>handlers.submit({preventDefault(){}}),input:()=>handlers.input()};
}
test('refused or unconfirmed saves keep typed reasoning and restore controls, with exact client schema',async()=>{
 for(const response of [new Error('Stale information version'),{saved:false},{saved:true,item:{id:'foreign',version:2}}]){
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
