import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import { C3_CLIENT_SCRIPT } from '../../src/c3/render.ts';
const request = { audience: 'Original audience', intendedOutcome: 'Original outcome', durationMinutes: 15, meetingDate: '2026-09-12' };
const priorId='c3_'+'1'.repeat(24),nextId='c3_'+'2'.repeat(24);
class Element {
 value='';textContent='';disabled=false;hidden=false; childNodes:any[]=[];
 attrs:Record<string,string>={};listeners=new Map<string,(event:any)=>any>();
 addEventListener(name:string,fn:(event:any)=>any){const prior=this.listeners.get(name);this.listeners.set(name,prior?(event:any)=>{prior(event);return fn(event);}:fn);}
 getAttribute(name:string){return this.attrs[name]??null;}
 setAttribute(name:string,value:string){this.attrs[name]=value;}
 querySelectorAll(){return [];}
 replaceChildren(...children:any[]){this.childNodes=children;}
 append(...children:any[]){this.childNodes.push(...children);}
 click(){return this.listeners.get('click')?.({preventDefault(){},currentTarget:this});}
 input(){return this.listeners.get('input')?.({target:this});}
}
function client(fetcher:(url:string,body:any)=>Promise<any>, options: { cache?: Map<string,string>; section?: string } = {}){
 const form=new Element();form.attrs={'data-record-id':priorId,'data-meeting-request':JSON.stringify(request)};
 const note=new Element();note.value='Separate annotation';const instruction=new Element();instruction.value='Improve opening';
 const revise=new Element(),stop=new Element(),apply=new Element(),discard=new Element(),status=new Element(),comparison=new Element(),panel=new Element();panel.attrs={'data-generation-available':'true'};
 let generated='Prior brief';const region={getAttribute:()=> 'opening',replaceChildren:(...children:string[])=>{generated=children.join('');}};
 const selectors:Record<string,any>={'[data-note-form]':form,'[data-correction-note]':note,'[data-revision-instruction]':instruction,'[data-revision-panel]':panel,'[data-revise]':revise,'[data-stop-revision]':stop,'[data-apply-revision]':apply,'[data-discard-revision]':discard,'[data-review-status]':new Element(),'[data-revision-status]':status,'[data-proposal-comparison]':comparison};
 const documentMeta=new Element();documentMeta.attrs={content:'doc_'+'3'.repeat(24)};selectors['meta[name="c3-document"]']=documentMeta;
 const save=new Element(),saveCopy=new Element(),workStatus=new Element(),workControls=new Element();workControls.attrs={'data-store-available':'true'};Object.assign(selectors,{'[data-save-work]':save,'[data-save-copy]':saveCopy,'[data-work-status]':workStatus,'[data-work-controls]':workControls});
 const section=new Element();section.value=options.section??'';Object.assign(section,{name:'text',maxLength:1000});
 const sectionStatus=new Element(),sectionCopy=new Element(),sectionCancel=new Element();
 const sectionForm=new Element();Object.assign(sectionForm,{dataset:{recordId:priorId,section:'Opening',editKey:'meeting-opening',endpoint:'/api/section-note'},
 querySelectorAll:(s:string)=>s==='textarea'?[section]:[],querySelector:(s:string)=>s==='[data-local-status]'?sectionStatus:sectionCancel,
 closest:()=>({open:false,querySelector:()=>sectionCopy})});
 const cache=options.cache??new Map<string,string>();
 workStatus.textContent='Saved · private local version 1';
 const events=new Map<string,((event:any)=>void)[]>();
 const calls:{url:string;body:any}[]=[];
 const document={querySelector:(s:string)=>selectors[s]??null,querySelectorAll:(s:string)=>s==='[data-generated-region]'?[region]:s==='[data-local-edit]'&&options.section!==undefined?[sectionForm]:[],addEventListener(name:string,fn:(event:any)=>void){events.set(name,[...(events.get(name)??[]),fn]);},createElement:()=>new Element()};
 class Parser {parseFromString(html:string){
  const forms=Array.from(html.matchAll(/<form\b([^>]*)>/g),([,attrs])=>{const f=new Element();for(const [,name,value]of attrs!.matchAll(/(data-[\w-]+)(?:="([^"]*)")?/g))f.attrs[name!]=value??'';return f;});
  return {querySelector:(s:string)=>s==='[data-note-form]'?forms.find(f=>f.getAttribute('data-note-form')!==null)??null:s.startsWith('[data-generated-region=')&&html.includes('data-generated-region')?{childNodes:['Revised brief']}:null,querySelectorAll:()=>forms.filter(f=>f.getAttribute('data-local-edit')!==null)};
 }}
 vm.runInNewContext(C3_CLIENT_SCRIPT,{document,window:{crypto:webcrypto,addEventListener(){},sessionStorage:{getItem:(key:string)=>cache.get(key),setItem:(key:string,value:string)=>cache.set(key,value),removeItem:(key:string)=>cache.delete(key)}},DOMParser:Parser,fetch:async(url:string,init:any)=>{const body=JSON.parse(init.body);calls.push({url,body});const payload=url==='/api/revision-instruction'?{instruction:body.instruction}:await fetcher(url,body);return {ok:true,json:async()=>payload};},Error,JSON,Number,String});
 return {cache,section,sectionStatus,keepSection:()=>sectionForm.listeners.get('submit')?.({preventDefault(){}}),typeSection(value:string){section.value=value;sectionForm.input();for(const fn of events.get('input')??[])fn({target:{closest:()=>true}});},form,note,instruction,revise,stop,apply,discard,status,comparison,calls,save,saveCopy,workStatus,typeNote(value:string){note.value=value;for(const fn of events.get('input')??[])fn({target:{closest:()=>true}});},generated:()=>generated};
}
const snapshot=()=>({correctionNote:'Separate annotation',sectionNotes:{},instruction:'Improve opening',pendingRevisionToken:null,proposalId:null,proposalStale:false});
const staged=(body:any)=>({revisionReady:true,recordId:body.recordId,request,savedNote:'Separate annotation',instruction:body.note,pendingRevisionToken:'a'.repeat(32)});
const proposed=(body:any)=>({outcome:'succeeded',operation:body,proposalReady:true,proposalId:nextId,recordId:priorId,instruction:'Improve opening',stale:false,proposal:{opening:{text:'Revised opening'}},original:{opening:{text:'Original opening'}}});
const returnedHtml=(recordId=nextId,sectionId=recordId)=>`<section data-generated-region="opening">Revised brief</section><form data-note-form data-record-id="${recordId}"></form><form data-local-edit data-section="Opening" data-record-id="${sectionId}"></form>`;
const success=()=>({applied:true,outcome:'succeeded',recordId:nextId,savedNote:'Separate annotation',sectionNotes:{},changedSections:['Opening'],html:returnedHtml()});
test('generation stages a comparison; explicit Apply alone replaces content and preserves newer note typing',async()=>{
 let finish!:(payload:any)=>void;
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/apply-revision'?success():new Promise(resolve=>{finish=resolve;}));
 const work=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.generated(),'Prior brief');
 ui.note.value='Newer typing';finish(proposed(ui.calls.at(-1)!.body));await work;
 assert.equal(ui.generated(),'Prior brief');assert.equal(ui.form.getAttribute('data-record-id'),priorId);assert.equal(ui.apply.disabled,false);
 await ui.apply.click();assert.equal(ui.generated(),'Revised brief');assert.equal(ui.note.value,'Newer typing');assert.equal(ui.form.getAttribute('data-record-id'),nextId);
});
test('editing instruction during generation leaves result stale and current brief intact',async()=>{
 let finish!:(payload:any)=>void;const ui=client(async(url,body)=>url==='/api/revise'?staged(body):new Promise(resolve=>{finish=resolve;}));
 const work=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));const generation=ui.calls.at(-1)!.body;
 ui.instruction.value='Newer instruction';ui.instruction.input();finish(proposed(generation));await work;
 assert.equal(ui.generated(),'Prior brief');assert.equal(ui.instruction.value,'Newer instruction');assert.equal(ui.apply.disabled,true);
 await ui.apply.click();assert.equal(ui.calls.some(c=>c.url==='/api/apply-revision'),false);
});
test('stop during staging prevents generation and Keep original discards instruction while preserving annotation typing',async()=>{
 let finish!:(payload:any)=>void;const ui=client(async(url)=>url==='/api/revise'?new Promise(resolve=>{finish=resolve;}):({discarded:true,recordId:priorId,savedNote:'Separate annotation'}));
 const work=ui.revise.click();ui.stop.click();ui.note.value='Newer note';await new Promise(resolve=>setImmediate(resolve));finish(staged(ui.calls[0]!.body));await work;
 assert.equal(ui.calls.some(c=>c.url==='/api/generate'),false);await ui.discard.click();assert.equal(ui.instruction.value,'');assert.equal(ui.note.value,'Newer note');assert.equal(ui.generated(),'Prior brief');
});
test('failure preserves current content; regenerate obtains a new operation',async()=>{
 let attempts=0;const ui=client(async(url,body)=>url==='/api/revise'?staged(body):++attempts===1?{outcome:'failed',operation:body,error:'Synthetic failure'}:proposed(body));
 await ui.revise.click();assert.match(ui.status.textContent,/Synthetic failure/);assert.equal(ui.generated(),'Prior brief');await ui.revise.click();
 const calls=ui.calls.filter(c=>c.url==='/api/generate');assert.notEqual(calls[0]!.body.operationId,calls[1]!.body.operationId);assert.equal(ui.generated(),'Prior brief');assert.equal(ui.apply.disabled,false);
});
for(const [label,invalid]of Object.entries({missingId:{recordId:undefined},emptyId:{recordId:''},wrongId:{recordId:'next'},validFormatMismatchedId:{recordId:'c3_'+'9'.repeat(24)},mismatchedSectionId:{html:returnedHtml(undefined,'c3_'+'9'.repeat(24))},missingCanonicalForm:{html:'<section data-generated-region="opening">Revised brief</section>'},missingCanonicalId:{html:returnedHtml().replace('data-record-id="'+nextId+'"','')},missingSectionId:{html:returnedHtml(undefined,'')},differentNote:{savedNote:'UNACKNOWLEDGED DIFFERENT NOTE'},newerNote:{savedNote:'Newer typing'},arrayNotes:{sectionNotes:[]},invalidNoteText:{sectionNotes:{Opening:42}},unknownNote:{sectionNotes:{alien:''}},invalidChange:{changedSections:[42]},unknownChange:{changedSections:['Alien']},missingHtml:{html:undefined},emptyHtml:{html:''},incompleteHtml:{html:'<p>Incomplete</p>'}}))test('malformed Apply acknowledgement preserves displayed record and newer typing: '+label,async()=>{
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/generate'?proposed(body):({...success(),...invalid}));
 await ui.revise.click();ui.note.value='Newer typing';await ui.apply.click();assert.equal(ui.generated(),'Prior brief');assert.equal(ui.form.getAttribute('data-record-id'),priorId);assert.equal(ui.form.getAttribute('data-revised'),null);assert.equal(ui.note.value,'Newer typing');
});

test('durable Save acknowledgement cannot mark newer textarea typing Saved',async()=>{
 let finish!:(payload:any)=>void;const documentId='doc_'+'3'.repeat(24);
 const ui=client(async(url)=>url==='/api/work-state'?{recordId:priorId,documentId,version:0,workVersion:1,snapshot:snapshot()}:new Promise(resolve=>{finish=resolve;}));
 const saving=ui.save.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.calls.at(-1)!.url,'/api/save');ui.typeNote('Typed after Save started');
 finish({saved:true,recordId:priorId,documentId,version:1,workVersion:1});await saving;
 assert.equal(ui.note.value,'Typed after Save started');assert.match(ui.workStatus.textContent,/Newer edits are unsaved/);
});
test('Save rejects an acknowledgement for a different document or version',async()=>{
 const documentId='doc_'+'3'.repeat(24);const ui=client(async(url)=>url==='/api/work-state'?{recordId:priorId,documentId,version:0,workVersion:1,snapshot:snapshot()}:{saved:true,recordId:priorId,documentId:'doc_'+'4'.repeat(24),version:99,workVersion:1});
 await ui.save.click();assert.match(ui.workStatus.textContent,/Durable save was not confirmed/);assert.doesNotMatch(ui.workStatus.textContent,/Saved ·/);
});

test('Overview and Prepare do not acquire document-save unload warnings',()=>{
 const events=new Map<string,((event:any)=>void)[]>();const register=(name:string,fn:(event:any)=>void)=>events.set(name,[...(events.get(name)??[]),fn]);
 vm.runInNewContext(C3_CLIENT_SCRIPT,{document:{querySelector:()=>null,querySelectorAll:()=>[],addEventListener:register},window:{addEventListener:register}});
 for(const fn of events.get('input')??[])fn({target:{closest:()=>true}});
 let blocked=false;for(const fn of events.get('beforeunload')??[])fn({preventDefault(){blocked=true;}});assert.equal(blocked,false);
});

for(const [label,change] of Object.entries({generalNote:{correctionNote:'Other tab note'},sectionNote:{sectionNotes:{Opening:'Other tab section'}},instruction:{instruction:'Other tab instruction'},proposal:{proposalId:nextId},pendingRevision:{pendingRevisionToken:'b'.repeat(32)}}))test('same-session unchanged stale tab refuses unseen '+label+' on Save and Save a copy',async()=>{
 const documentId='doc_'+'3'.repeat(24);
 const shared={recordId:priorId,documentId,version:1,workVersion:2,snapshot:{...snapshot(),...change}};
 const ui=client(async(url)=>url==='/api/work-state'?shared:{saved:true,recordId:priorId,documentId,version:2,workVersion:2});
 await ui.save.click();
 assert.equal(ui.calls.some(call=>call.url==='/api/save'),false,'same document/record is insufficient when another tab kept different work');
 assert.match(ui.workStatus.textContent,/changed|stale|unseen/i);await ui.saveCopy.click();assert.equal(ui.calls.some(call=>call.url==='/api/save-copy'),false);
 assert.equal(ui.note.value,'Separate annotation');assert.equal(ui.instruction.value,'Improve opening');
});

test('composed Save, type section note, refresh recovery, Keep, Save requires a real durable acknowledgement',async()=>{
 const documentId='doc_'+'3'.repeat(24);let version=0,workVersion=1,kept='';let failNote=false;
 const fetcher=async(url:string,body:any)=>{
  if(url==='/api/section-note'){if(failNote)throw Error('Synthetic note network failure');assert.equal(body.priorText,kept);kept=body.text;workVersion++;return {recordId:priorId,section:'Opening',savedText:kept,noChange:false,status:'Note kept for this session.'};}
  if(url==='/api/work-state')return {recordId:priorId,documentId,version,workVersion,snapshot:{...snapshot(),sectionNotes:{Opening:kept}}};
  assert.equal(url,'/api/save');assert.equal(body.workVersion,workVersion);return {saved:true,recordId:priorId,documentId,version:++version,workVersion};
 };
 const first=client(fetcher,{section:''});await first.save.click();assert.match(first.workStatus.textContent,/^Saved ·/);
 first.typeSection('Unsent section note');
 const restored=client(fetcher,{section:'',cache:first.cache});assert.equal(restored.section.value,'Unsent section note');
 assert.match(restored.workStatus.textContent,/Unsaved/);
 await restored.keepSection();assert.match(restored.workStatus.textContent,/Unsaved/);assert.equal(version,1);
 await restored.save.click();assert.match(restored.workStatus.textContent,/^Saved · private local version 2/);
 restored.typeSection('Typing retained after failure');failNote=true;await restored.keepSection();
 assert.equal(restored.section.value,'Typing retained after failure');assert.match(restored.sectionStatus.textContent,/Synthetic note network failure/);assert.match(restored.workStatus.textContent,/Unsaved/);
});

test('section note acknowledgement during generation marks document unsaved and keeps newer typing',async()=>{
 let finish!:(payload:any)=>void;
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/section-note'?{recordId:priorId,section:'Opening',savedText:body.text,noChange:false,status:'Kept'}:new Promise(resolve=>{finish=resolve;}),{section:''});
 const generation=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));
 ui.workStatus.textContent='Saved · private local version 1';ui.section.value='Kept during generation';await ui.keepSection();
 assert.match(ui.workStatus.textContent,/Unsaved/);
 finish(proposed(ui.calls.find(call=>call.url==='/api/generate')!.body));await generation;
 assert.equal(ui.section.value,'Kept during generation');
});


test('two tabs sharing one session keep distinct section displays; stale Save cannot adopt the other tab note',async()=>{
 const documentId='doc_'+'3'.repeat(24);let kept='',workVersion=1;let writes=0;
 const shared=async(url:string,body:any)=>{
  if(url==='/api/section-note'){assert.equal(body.priorText,kept);kept=body.text;workVersion++;return {recordId:priorId,section:'Opening',savedText:kept,noChange:false,status:'Kept'};}
  if(url==='/api/work-state')return {recordId:priorId,documentId,version:1,workVersion,snapshot:{...snapshot(),sectionNotes:{Opening:kept}}};
  writes++;return {saved:true,recordId:priorId,documentId,version:2,workVersion};
 };
 const a=client(shared,{section:''}),b=client(shared,{section:''});
 b.typeSection('Tab B annotation');await b.keepSection();await a.save.click();
 assert.equal(writes,0);assert.equal(a.section.value,'');assert.equal(b.section.value,'Tab B annotation');assert.match(a.workStatus.textContent,/another tab/);
 await b.save.click();assert.equal(writes,1);assert.match(b.workStatus.textContent,/^Saved ·/);
});
