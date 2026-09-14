import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { C3_CLIENT_SCRIPT } from '../../src/c3/render.ts';

class Element {
  value='';textContent='';hidden=false;disabled=false;attrs:Record<string,string>={};listeners=new Map<string,(event:any)=>any>();
  getAttribute(key:string){return this.attrs[key]??null;}
  setAttribute(key:string,value:string){this.attrs[key]=value;}
  addEventListener(name:string,fn:(event:any)=>any){this.listeners.set(name,fn);}
  querySelector(_key:string):any{return null;}
  querySelectorAll(){return [];}
  select(){}
  remove(){}
  click(){return this.listeners.get('click')?.({preventDefault(){},currentTarget:this});}
}
const recordId='c3_'+'1'.repeat(24),documentId='doc_'+'2'.repeat(24);
function client(fetcher:(route:string,body:any)=>Promise<any>,denied=false){
  const selectors:Record<string,Element>={};
  for(const key of ['data-brief-record','data-authored-form','data-authored-status','data-brief-export-status','data-brief-export-note','data-brief-copy','data-brief-fallback','data-work-status','data-work-controls','data-save-work','data-save-copy','data-brief-saved-state']) selectors['['+key+']']=new Element();
  const page=selectors['[data-brief-record]']!;page.attrs={'data-brief-record':recordId,'data-brief-work-version':'7','data-brief-storage-version':'2','data-brief-attachment-digest':'digest'};
  const docMeta=new Element();docMeta.attrs={content:documentId};selectors['meta[name="c3-document"]']=docMeta;
  const prefix=new Element();prefix.attrs={content:'/accounts/cedar'};selectors['meta[name="c3-account-path"]']=prefix;
  const fields:Record<string,Element>={};for(const key of ['title','audience','duration','purpose','facts','interpretation','opening','q0question','q0probe','q1question','q1probe','q2question','q2probe','close','uncertainty','evidence'])fields[key]=new Element();
  fields.title!.value='Cedar priorities';fields.purpose!.value='Understand priorities';fields.evidence!.value='first\nsecond';fields.facts!.value='Fact one\nFact two\nFact three';fields.q0question!.value='What matters?';
  const reset=new Element(),clear=new Element();const initial=Object.fromEntries(Object.entries(fields).map(([key,item])=>[key,item.value]));
  const form=selectors['[data-authored-form]']!;form.querySelector=key=>key==='[data-authored-reset]'?reset:key==='[data-authored-clear]'?clear:fields[key.match(/data-authored="([^"]+)"/)?.[1]??'']??null;
  Object.assign(form,{reset(){for(const [key,value]of Object.entries(initial))fields[key]!.value=value;}});
  selectors['[data-work-controls]']!.attrs={'data-store-available':'true'};
  const download=new Element();download.attrs={'data-brief-download':'md'};
  const events:Record<string,((event:any)=>void)[]>={};const calls:{route:string;body:any}[]=[];let reloads=0,copied='',downloaded=false,blob:Blob|undefined;
  const scope={document:{querySelector:(key:string)=>selectors[key]??null,querySelectorAll:(key:string)=>key==='[data-brief-download]'?[download]:[],addEventListener(){},createElement(){const e=new Element();e.click=()=>{downloaded=true;};return e;},body:{appendChild(){}}},window:{addEventListener(name:string,fn:(e:any)=>void){(events[name]??=[]).push(fn);},confirm:()=>false,location:{reload(){reloads++;}}},navigator:{clipboard:{async writeText(text:string){if(denied)throw Error('denied');copied=text;}}},URL:{createObjectURL(value:Blob){blob=value;return 'blob:local';},revokeObjectURL(){}},Blob,setTimeout:()=>0,clearTimeout(){},fetch:async(route:string,init:any)=>{const body=JSON.parse(init.body);calls.push({route,body});const value=await fetcher(route,body);return {ok:true,json:async()=>value};}};
  vm.runInNewContext(C3_CLIENT_SCRIPT,scope);
  return {fields,form,reset,clear,calls,selectors,events,download,reloads:()=>reloads,copied:()=>copied,blob:()=>blob,downloaded:()=>downloaded,submit:()=>form.listeners.get('submit')!({preventDefault(){}}),copy:()=>selectors['[data-brief-copy]']!.click(),save:()=>selectors['[data-save-work]']!.click(),status:()=>selectors['[data-authored-status]']!.textContent,exportStatus:()=>selectors['[data-brief-export-status]']!.textContent,workStatus:()=>selectors['[data-work-status]']!.textContent};
}

test('composed brief initializes without legacy nodes, copies fresh reading and sends displayed CAS with multiline input',async()=>{
  const ui=client(async(route,body)=>route.endsWith('brief-export')?{recordId,exportText:'Canonical displayed brief'}:{kept:true,recordId,authoredCopy:body.copy});
  await ui.copy();assert.equal(ui.copied(),'Canonical displayed brief');assert.equal(ui.calls[0]!.body.workVersion,7);
  await ui.submit();assert.equal(ui.reloads(),1);
  const sent=ui.calls.at(-1)!;assert.equal(sent.route,'/accounts/cedar/api/authored-copy');assert.equal(sent.body.workVersion,7);
  assert.deepEqual(sent.body.copy.facts,['Fact one','Fact two','Fact three']);assert.deepEqual(sent.body.copy.selectedEvidenceRefs,['first','second']);
  assert.equal(ui.calls.some(call=>call.route.endsWith('work-state')),false);
});
test('composed brief blocks dirty exports/save, reset restores baseline, denial gives canonical manual copy, Blob carries text',async()=>{
  const ui=client(async()=>({recordId,exportText:'Exact export'}),true);ui.fields.title!.value='Unsubmitted';await ui.copy();await ui.save();
  assert.equal(ui.calls.length,0);assert.match(ui.workStatus(),/Keep or reset/);
  await ui.reset.click();await ui.copy();assert.match(ui.exportStatus(),/denied/);assert.equal(ui.selectors['[data-brief-fallback]']!.value,'Exact export');
  await ui.download.click();assert.equal(ui.downloaded(),true);assert.equal(await ui.blob()!.text(),'Exact export');assert.match(ui.exportStatus(),/Download requested/);
});
test('composed brief failure/cancel and typing during Keep preserve unsubmitted text',async()=>{
  const failed=client(async()=>{throw Error('Conflict');});failed.fields.title!.value='Keep this typing';await failed.submit();assert.equal(failed.fields.title!.value,'Keep this typing');assert.equal(failed.reloads(),0);assert.match(failed.status(),/remains/);
  await failed.clear.click();assert.equal(failed.calls.length,1,'cancelled Clear does not POST');
  let finish!:(value:any)=>void;const ui=client(async()=>new Promise(resolve=>{finish=resolve;}));const keeping=ui.submit();ui.fields.title!.value='Newer typing';finish({kept:true,recordId,authoredCopy:{}});await keeping;
  assert.equal(ui.reloads(),0);assert.equal(ui.fields.title!.value,'Newer typing');assert.match(ui.status(),/Newer typing remains/);
});
test('composed brief Save is explicit, binds storage and work versions, and rejects false acknowledgement',async()=>{
  const ui=client(async(_route,body)=>({saved:true,recordId,documentId,workVersion:body.workVersion,version:3}));assert.equal(ui.calls.length,0);await ui.save();
  assert.deepEqual(ui.calls[0],{route:'/accounts/cedar/api/save',body:{recordId,documentId,expectedVersion:2,workVersion:7,informationAttachmentsSha256:'digest'}});assert.equal(ui.workStatus(),'Saved');
  const bad=client(async()=>({saved:true,recordId,documentId,workVersion:99,version:3}));await bad.save();assert.match(bad.workStatus(),/not confirmed/);
});
