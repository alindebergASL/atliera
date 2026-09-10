import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import { C3_CLIENT_SCRIPT } from '../../src/c3/render.ts';
const request = { audience: 'Original audience', intendedOutcome: 'Original outcome', durationMinutes: 15, meetingDate: '2026-09-12' };
const priorId='c3_'+'1'.repeat(24),nextId='c3_'+'2'.repeat(24);
class Element {
 value='';textContent='';disabled=false;readOnly=false;hidden=false; childNodes:any[]=[];
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
function client(fetcher:(url:string,body:any)=>Promise<any>, options: { cache?: Map<string,string>; section?: string; title?: string; inspector?: boolean } = {}){
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
 const titleInput=new Element(),titleForm=new Element(),titleStatus=new Element(),titleHeading=new Element(),lastSaved=new Element(),savedTimestamp=new Element();titleInput.value=options.title??'';
 if(options.title!==undefined)Object.assign(selectors,{'[data-title-input]':titleInput,'[data-title-form]':titleForm,'[data-title-status]':titleStatus,'[data-work-title]':titleHeading,'[data-last-saved]':lastSaved,'[data-saved-timestamp]':savedTimestamp});
 const cache=options.cache??new Map<string,string>();
 workStatus.textContent='Saved · private local version 1';
 const events=new Map<string,((event:any)=>void)[]>();
 const calls:{url:string;body:any}[]=[];
 const dialog=new Element(),evidenceBody=new Element(),evidenceSupport=new Element(),inspectorTitle=new Element(),returnRevision=new Element(),original=new Element(),originalHeading=new Element();
 const selectQuestions=new Element(),evidenceLink=new Element(),evidence=new Element(),evidenceContent=new Element(),useRecorded=new Element(),recordedNote=new Element(),replayHelp=new Element();
 if(options.inspector){
  panel.attrs['data-original-sections']=JSON.stringify({Opening:'Original opening',Questions:'Original questions'});
  panel.hidden=true;original.textContent='Original opening';originalHeading.textContent='Original opening';
  const inspectorNodes:Record<string,Element>={'[data-evidence-panel-body]':evidenceBody,'[data-evidence-support]':evidenceSupport,'#evidence-panel-title':inspectorTitle,'[data-return-revision]':returnRevision,'[data-revision-panel]':panel};
  Object.assign(dialog,{open:false,showModal(){this.open=true;},querySelector:(s:string)=>inspectorNodes[s]??null});
  Object.assign(selectQuestions,{closest:(s:string)=>s==='[data-refine-section]'?selectQuestions:null});selectQuestions.attrs={'data-refine-section':'Questions'};
  Object.assign(evidenceLink,{closest:(s:string)=>s==='a[data-evidence-link], a[data-research-link]'?evidenceLink:null});evidenceLink.attrs={href:'#evidence-1','data-context':'Questions'};
  evidenceContent.textContent='Exact retained evidence';Object.assign(evidenceContent,{cloneNode:()=>evidenceContent});
  Object.assign(evidence,{querySelector:(s:string)=>s==='[data-evidence-content]'?evidenceContent:null});
  recordedNote.textContent='Improve opening';replayHelp.textContent='Historical replay · only the fixed recorded instruction below has a response.';
  Object.assign(selectors,{'[data-evidence-dialog]':dialog,'[data-revision-original]':original,'[data-original-heading]':originalHeading,'#evidence-1':evidence,'[data-use-recorded-note]':useRecorded,'[data-recorded-note]':recordedNote,'#replay-instruction-help':replayHelp});
 }
 const clickEntry=(target:Element)=>{const event={target,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const fn of events.get('click')??[])fn(event);};
 let active:any=null;const notes=new Element();Object.assign(notes,{open:false});const addNote=new Element();selectors['#review']=notes;selectors['[data-add-note]']=addNote;Object.assign(note,{focus:()=>{active=note;}});
 const document={querySelector:(s:string)=>selectors[s]??null,querySelectorAll:(s:string)=>s==='[data-generated-region]'?[region]:s==='[data-local-edit]'&&options.section!==undefined?[sectionForm]:[],addEventListener(name:string,fn:(event:any)=>void){events.set(name,[...(events.get(name)??[]),fn]);},createElement:()=>new Element()};
 class Parser {parseFromString(html:string){
  const forms=Array.from(html.matchAll(/<form\b([^>]*)>/g),([,attrs])=>{const f=new Element();for(const [,name,value]of attrs!.matchAll(/(data-[\w-]+)(?:="([^"]*)")?/g))f.attrs[name!]=value??'';return f;});
  const nextPanel=new Element(),nextOriginal=new Element(),nextHelp=new Element(),nextInstruction=new Element(),nextRecorded=new Element();
  const availability=html.match(/data-generation-available="([^"]*)"/)?.[1];
  if(availability!==undefined)nextPanel.attrs['data-generation-available']=availability;
  nextHelp.textContent=html.match(/<p id="replay-instruction-help">([^<]*)<\/p>/)?.[1]??'';
  const instructionAttrs=html.match(/<textarea data-revision-instruction([^>]*)>/)?.[1];
  nextInstruction.readOnly=/\breadonly\b/.test(instructionAttrs??'');
  const recordedAttrs=html.match(/<button data-use-recorded-note([^>]*)>/)?.[1];
  nextRecorded.disabled=/\bdisabled\b/.test(recordedAttrs??'');
  const sections=html.match(/data-original-sections="([^"]*)"/)?.[1];
  if(sections!==undefined)nextPanel.attrs['data-original-sections']=sections.replaceAll('&quot;','"').replaceAll('&amp;','&');
  nextOriginal.textContent=html.match(/<p data-revision-original>([^<]*)<\/p>/)?.[1]??'';
  return {querySelector:(s:string)=>s==='[data-note-form]'?forms.find(f=>f.getAttribute('data-note-form')!==null)??null:s==='[data-revision-panel]'&&(sections!==undefined||availability!==undefined)?nextPanel:s==='#replay-instruction-help'&&html.includes('id="replay-instruction-help"')?nextHelp:s==='[data-revision-instruction]'&&instructionAttrs!==undefined?nextInstruction:s==='[data-use-recorded-note]'&&recordedAttrs!==undefined?nextRecorded:s==='[data-revision-original]'&&sections!==undefined?nextOriginal:s.startsWith('[data-generated-region=')&&html.includes('data-generated-region')?{childNodes:['Revised brief']}:null,querySelectorAll:()=>forms.filter(f=>f.getAttribute('data-local-edit')!==null)};
 }}
 vm.runInNewContext(C3_CLIENT_SCRIPT,{document,setTimeout,clearTimeout,window:{crypto:webcrypto,addEventListener(){},sessionStorage:{getItem:(key:string)=>cache.get(key),setItem:(key:string,value:string)=>cache.set(key,value),removeItem:(key:string)=>cache.delete(key)}},DOMParser:Parser,fetch:async(url:string,init:any)=>{const body=JSON.parse(init.body);calls.push({url,body});const payload=url==='/api/revision-instruction'?{instruction:body.instruction}:await fetcher(url,body);return {ok:true,json:async()=>payload};},Error,JSON,Number,String});
 return {useRecorded,replayHelp,panel,original,originalHeading,inspectorTitle,evidenceBody,returnRevision,selectQuestions:()=>clickEntry(selectQuestions),openEvidence:()=>clickEntry(evidenceLink),notes,addNote,active:()=>active,readOnly(){for(const fn of events.get('click')??[])fn({target:{closest:()=>null}});},typeTitle(value:string){titleInput.value=value;for(const fn of events.get('input')??[])fn({target:{closest:(selector:string)=>selector==='main, [data-revision-panel]'?titleForm:null}});},titleInput,titleStatus,titleHeading,lastSaved,savedTimestamp,keepTitle:()=>titleForm.listeners.get('submit')?.({preventDefault(){}}),cache,section,sectionStatus,keepSection:()=>sectionForm.listeners.get('submit')?.({preventDefault(){}}),typeSection(value:string){section.value=value;sectionForm.input();for(const fn of events.get('input')??[])fn({target:{closest:(selector:string)=>selector==='[data-local-edit][data-section]'?sectionForm:true}});},form,note,instruction,revise,stop,apply,discard,status,comparison,calls,save,saveCopy,workStatus,typeNote(value:string){note.value=value;Object.assign(note,{closest:()=>true});for(const fn of events.get('input')??[])fn({target:note});},generated:()=>generated};
}
const snapshot=()=>({correctionNote:'Separate annotation',sectionNotes:{},instruction:'Improve opening',pendingRevisionToken:null,proposalId:null,proposalStale:false});
const staged=(body:any)=>({revisionReady:true,recordId:body.recordId,request,savedNote:'Separate annotation',instruction:body.note,pendingRevisionToken:'a'.repeat(32)});
const proposed=(body:any)=>({outcome:'succeeded',operation:body,proposalReady:true,proposalId:nextId,recordId:priorId,instruction:'Improve opening',stale:false,proposal:{opening:{text:'Revised opening'}},original:{opening:{text:'Original opening'}}});
const returnedHtml=(recordId=nextId,sectionId=recordId)=>`<section data-generated-region="opening">Revised brief</section><form data-note-form data-record-id="${recordId}"></form><form data-local-edit data-section="Opening" data-record-id="${sectionId}"></form>`;
const success=()=>({applied:true,outcome:'succeeded',recordId:nextId,savedNote:'Separate annotation',sectionNotes:{},changedSections:['Opening'],html:returnedHtml()});
test('per-record unavailable revision remains disabled when the sheet opens and controls refresh', () => {
 const ui=client(async()=>assert.fail('Opening unavailable revision must not request generation'),{inspector:true});
 ui.panel.setAttribute('data-generation-available','false');
 ui.selectQuestions();assert.equal(ui.revise.disabled,true);
 ui.instruction.input();assert.equal(ui.revise.disabled,true);
 ui.typeNote('Another annotation');assert.equal(ui.revise.disabled,true);
 assert.equal(ui.instruction.value,'Improve opening','nonempty retained instructions do not enable revision');
 assert.equal(ui.calls.length,0);
});

test('disabled recorded instruction invocation does not mutate typing or POST an instruction',async()=>{
 const ui=client(async()=>assert.fail('Disabled recorded selector must not request anything'),{inspector:true});
 ui.instruction.value='Local typed draft';ui.instruction.input();await new Promise(resolve=>setImmediate(resolve));
 const before=ui.calls.length;ui.useRecorded.disabled=true;
 await ui.useRecorded.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ui.calls.length,before);assert.equal(ui.instruction.value,'Local typed draft');
});
for(const replay of [true,false])test(`Apply synchronizes server revision controls and preserves local work (${replay?'recorded':'live'})`,async()=>{
 const help='Server-owned availability explanation after Apply';
 let finish!:(payload:any)=>void;
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/generate'?proposed(body):new Promise(resolve=>{finish=resolve;}),{inspector:true,section:'Retained section note'});
 const panel=ui.panel,instruction=ui.instruction,button=ui.useRecorded;
 ui.selectQuestions();await ui.revise.click();
 const applying=ui.apply.click();await new Promise(resolve=>setImmediate(resolve));
 ui.instruction.value='Newer local instruction';ui.note.value='Newer local note';ui.section.value='Newer section draft';
 finish({...success(),sectionNotes:{Opening:'Retained section note'},html:returnedHtml()+`<div data-revision-panel data-generation-available="${!replay}" data-original-sections="{&quot;Questions&quot;:&quot;Applied questions&quot;}"><p id="replay-instruction-help">${help}</p><textarea data-revision-instruction${replay?' readonly':''}></textarea>${replay?'':'<button data-use-recorded-note></button>'}</div>`});
 await applying;
 assert.match(ui.status.textContent,/Revision applied/);
 assert.equal(ui.panel.getAttribute('data-generation-available'),String(!replay));
 assert.equal(ui.replayHelp.textContent,help);assert.equal(ui.useRecorded.disabled,replay);assert.equal(ui.instruction.readOnly,replay);
 assert.equal(ui.instruction.value,'Newer local instruction');assert.equal(ui.note.value,'Newer local note');assert.equal(ui.section.value,'Newer section draft');
 assert.equal(ui.panel,panel);assert.equal(ui.instruction,instruction);assert.equal(ui.useRecorded,button);
 assert.equal(ui.inspectorTitle.textContent,'Revise questions');assert.equal(ui.original.textContent,'Applied questions');
 ui.instruction.input();await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.revise.disabled,replay);assert.equal(ui.replayHelp.textContent,help);
 if(replay){
  const before=ui.calls.length;await ui.useRecorded.click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.calls.length,before,'disabled invocation must not POST an instruction');assert.equal(ui.instruction.value,'Newer local instruction');
 }
});
test('selected Questions → revision → Apply → Evidence → Return to revision preserves the heading and applied questions',async()=>{
 const appliedQuestions='Applied question one?\nLearning one\n\nApplied question two?\nLearning two';
 const sections=JSON.stringify({Opening:'Applied opening',Questions:appliedQuestions});
 let rawProposal:any,rawBefore='';
 const ui=client(async(url,body)=>{
  if(url==='/api/revise')return staged(body);
  if(url==='/api/generate'){
   rawProposal={...proposed(body),proposal:{opening:{text:'Applied opening'},questions:[{question:'Applied question one?',intendedLearning:'Learning one'},{question:'Applied question two?',intendedLearning:'Learning two'}]},original:{opening:{text:'Original opening'},questions:[{question:'Original questions',intendedLearning:'Original learning'}]}};
   rawBefore=JSON.stringify(rawProposal);return rawProposal;
  }
  assert.equal(url,'/api/apply-revision');
  assert.deepEqual(body,{recordId:priorId,proposalId:nextId,pendingRevisionToken:'a'.repeat(32),instruction:'Improve opening'});
  return {...success(),sectionNotes:{Opening:'Retained section note'},changedSections:['Opening','Questions'],html:returnedHtml()+`<div data-revision-panel data-original-sections="${sections.replaceAll('&','&amp;').replaceAll('"','&quot;')}"><p data-revision-original>Applied opening</p></div>`};
 },{inspector:true,section:'Retained section note'});
 ui.selectQuestions();assert.equal(ui.inspectorTitle.textContent,'Revise questions');assert.equal(ui.originalHeading.textContent,'Original questions');assert.equal(ui.original.textContent,'Original questions');
 ui.useRecorded.click();assert.equal(ui.instruction.value,'Improve opening');assert.equal(ui.inspectorTitle.textContent,'Revise questions');assert.equal(ui.originalHeading.textContent,'Original questions');assert.equal(ui.original.textContent,'Original questions');
 await ui.revise.click();assert.equal(ui.apply.disabled,false);assert.equal(ui.generated(),'Prior brief');assert.equal(ui.original.textContent,'Original questions');
 await ui.apply.click();assert.match(ui.status.textContent,/Revision applied/);assert.equal(ui.generated(),'Revised brief');assert.equal(ui.form.getAttribute('data-record-id'),nextId);
 const checkPreview=()=>{assert.equal(ui.inspectorTitle.textContent,'Revise questions');assert.equal(ui.originalHeading.textContent,'Original questions');assert.equal(ui.original.textContent,appliedQuestions);assert.equal(ui.panel.hidden,false);};
 checkPreview();ui.openEvidence();assert.equal(ui.inspectorTitle.textContent,'Evidence');assert.equal(ui.panel.hidden,true);assert.equal(ui.evidenceBody.childNodes[0].textContent,'Exact retained evidence');assert.equal(ui.returnRevision.hidden,false);
 ui.returnRevision.click();checkPreview();assert.equal(ui.evidenceBody.hidden,true);assert.equal(ui.returnRevision.hidden,true);
 assert.equal(ui.note.value,'Separate annotation');assert.equal(ui.section.value,'Retained section note');assert.equal(ui.instruction.value,'');assert.equal(ui.apply.disabled,true);assert.equal(ui.comparison.hidden,true);assert.equal(ui.workStatus.textContent,'Unsaved changes');
 assert.equal(JSON.stringify(rawProposal),rawBefore,'display updates must preserve the exact returned proposal and original');
 assert.deepEqual(ui.calls.map(call=>call.url),['/api/revise','/api/generate','/api/apply-revision']);
});
test('note changes during generation keep the proposal unapplied and preserve typing',async()=>{
 let finish!:(payload:any)=>void;
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/apply-revision'?success():new Promise(resolve=>{finish=resolve;}));
 const work=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.generated(),'Prior brief');
 ui.note.value='Newer typing';finish(proposed(ui.calls.at(-1)!.body));await work;
 assert.equal(ui.generated(),'Prior brief');assert.equal(ui.form.getAttribute('data-record-id'),priorId);assert.equal(ui.apply.disabled,true);
 await ui.apply.click();assert.equal(ui.generated(),'Prior brief');assert.equal(ui.note.value,'Newer typing');assert.equal(ui.calls.some(call=>call.url==='/api/apply-revision'),false);
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
 const work=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));ui.stop.click();ui.note.value='Newer note';finish(staged(ui.calls[0]!.body));await work;
 assert.equal(ui.calls.some(c=>c.url==='/api/generate'),false);await ui.discard.click();assert.equal(ui.instruction.value,'');assert.equal(ui.note.value,'Newer note');assert.equal(ui.generated(),'Prior brief');
});
test('failure preserves current content; regenerate obtains a new operation',async()=>{
 let attempts=0;const ui=client(async(url,body)=>url==='/api/revise'?staged(body):++attempts===1?{outcome:'failed',operation:body,error:'Synthetic failure'}:proposed(body));
 await ui.revise.click();assert.match(ui.status.textContent,/Revision could not be prepared/);assert.equal(ui.generated(),'Prior brief');await ui.revise.click();
 const calls=ui.calls.filter(c=>c.url==='/api/generate');assert.notEqual(calls[0]!.body.operationId,calls[1]!.body.operationId);assert.equal(ui.generated(),'Prior brief');assert.equal(ui.apply.disabled,false);
});
for(const [label,invalid]of Object.entries({missingId:{recordId:undefined},emptyId:{recordId:''},wrongId:{recordId:'next'},validFormatMismatchedId:{recordId:'c3_'+'9'.repeat(24)},mismatchedSectionId:{html:returnedHtml(undefined,'c3_'+'9'.repeat(24))},missingCanonicalForm:{html:'<section data-generated-region="opening">Revised brief</section>'},missingCanonicalId:{html:returnedHtml().replace('data-record-id="'+nextId+'"','')},missingSectionId:{html:returnedHtml(undefined,'')},differentNote:{savedNote:'UNACKNOWLEDGED DIFFERENT NOTE'},newerNote:{savedNote:'Newer typing'},arrayNotes:{sectionNotes:[]},invalidNoteText:{sectionNotes:{Opening:42}},unknownNote:{sectionNotes:{alien:''}},invalidChange:{changedSections:[42]},unknownChange:{changedSections:['Alien']},missingHtml:{html:undefined},emptyHtml:{html:''},incompleteHtml:{html:'<p>Incomplete</p>'}}))test('malformed Apply acknowledgement preserves displayed record and newer typing: '+label,async()=>{
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/generate'?proposed(body):({...success(),...invalid}));
 await ui.revise.click();const applying=ui.apply.click();ui.note.value='Newer typing';await applying;assert.equal(ui.generated(),'Prior brief');assert.equal(ui.form.getAttribute('data-record-id'),priorId);assert.equal(ui.form.getAttribute('data-revised'),null);assert.equal(ui.note.value,'Newer typing');
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
 await ui.save.click();assert.match(ui.workStatus.textContent,/Save was not confirmed/);assert.doesNotMatch(ui.workStatus.textContent,/Saved ·/);
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
 assert.match(ui.workStatus.textContent,/Save was not confirmed/i);await ui.saveCopy.click();assert.equal(ui.calls.some(call=>call.url==='/api/save-copy'),false);
 assert.equal(ui.note.value,'Separate annotation');assert.equal(ui.instruction.value,'Improve opening');
});

test('composed Save, type section note, refresh recovery, Keep, Save requires a real durable acknowledgement',async()=>{
 const documentId='doc_'+'3'.repeat(24);let version=0,workVersion=1,kept='';let failNote=false;
 const fetcher=async(url:string,body:any)=>{
  if(url==='/api/section-note'){if(failNote)throw Error('Synthetic note network failure');assert.equal(body.priorText,kept);kept=body.text;workVersion++;return {recordId:priorId,section:'Opening',savedText:kept,noChange:false,status:'Note kept for this session.'};}
  if(url==='/api/work-state')return {recordId:priorId,documentId,version,workVersion,snapshot:{...snapshot(),sectionNotes:{Opening:kept}}};
  assert.equal(url,'/api/save');assert.equal(body.workVersion,workVersion);return {saved:true,recordId:priorId,documentId,version:++version,workVersion};
 };
 const first=client(fetcher,{section:''});await first.save.click();assert.match(first.workStatus.textContent,/^Saved$/);
 first.typeSection('Unsent section note');
 const restored=client(fetcher,{section:'',cache:first.cache});assert.equal(restored.section.value,'Unsent section note');
 assert.match(restored.workStatus.textContent,/Unsaved/);
 await restored.keepSection();assert.match(restored.workStatus.textContent,/Unsaved/);assert.equal(version,1);
 await restored.save.click();assert.match(restored.workStatus.textContent,/^Saved$/);
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
 assert.equal(writes,0);assert.equal(a.section.value,'');assert.equal(b.section.value,'Tab B annotation');assert.match(a.workStatus.textContent,/Save was not confirmed/);
 await b.save.click();assert.equal(writes,1);assert.match(b.workStatus.textContent,/^Saved$/);
});

test('acknowledged Save becomes quiet, and a new edit restores the Save action', async () => {
 const documentId='doc_'+'3'.repeat(24);
 const ui=client(async url=>url==='/api/work-state'?{recordId:priorId,documentId,version:0,workVersion:1,snapshot:snapshot()}:{saved:true,recordId:priorId,documentId,version:1,workVersion:1});
 const saving=ui.save.click();
 assert.equal(ui.workStatus.textContent,'Saving…');
 await saving;
 assert.equal(ui.workStatus.textContent,'Saved');assert.equal(ui.save.hidden,true);
 ui.typeNote('An additional note');
 assert.equal(ui.workStatus.textContent,'Unsaved changes');assert.equal(ui.save.hidden,false);
});


test('unchanged instruction and notes allow explicit Apply, preserving annotations',async()=>{
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/generate'?proposed(body):success());
 await ui.revise.click();assert.equal(ui.apply.disabled,false);assert.equal(ui.generated(),'Prior brief');
 await ui.apply.click();assert.equal(ui.generated(),'Revised brief');assert.equal(ui.note.value,'Separate annotation');
});


test('title contract uses exact record and workVersion, keeps dirty state and displays only acknowledged savedAt',async()=>{
 const documentId='doc_'+'3'.repeat(24);let title='Existing title',workVersion=4;
 const ui=client(async(url,body)=>{
  if(url==='/api/work-state')return {recordId:priorId,documentId,version:1,workVersion,title,snapshot:snapshot()};
  if(url==='/api/work/title'){assert.deepEqual(body,{recordId:priorId,title:'Focused meeting title',workVersion:4});title=body.title;return {title,workVersion:++workVersion};}
  assert.equal(url,'/api/save');return {saved:true,recordId:priorId,documentId,version:2,workVersion,savedAt:'2026-09-09T10:30:00.000Z'};
 },{title:'Existing title'});
 ui.titleInput.value='Focused meeting title';await ui.keepTitle();assert.equal(ui.titleHeading.textContent,'Focused meeting title');
 assert.equal(ui.workStatus.textContent,'Unsaved changes');assert.equal(ui.lastSaved.textContent,'');
 await ui.save.click();assert.equal(ui.workStatus.textContent,'Saved');assert.match(ui.lastSaved.textContent,/Saved/);assert.match(ui.savedTimestamp.textContent,/Sep 9, 2026/);assert.match(ui.savedTimestamp.textContent,/10:30/);
});
test('title conflict or missing acknowledgement never replaces visible title or reports success',async()=>{
 const documentId='doc_'+'3'.repeat(24);
 for(const conflict of [true,false]){
  const ui=client(async url=>url==='/api/work-state'?{recordId:priorId,documentId,workVersion:4,title:conflict?'Other tab title':'Existing title'}:{workVersion:5},{title:'Existing title'});
  ui.titleInput.value='My title';await ui.keepTitle();assert.equal(ui.titleInput.value,'My title');assert.equal(ui.titleHeading.textContent,'');assert.match(ui.titleStatus.textContent,/could not be kept/);
  if(conflict)assert.equal(ui.calls.some(call=>call.url==='/api/work/title'),false);
 }
});


test('changed-note proposal Save requires server stale acknowledgement and remains unappliable',async()=>{
 for(const serverStale of [false,true]){
  const documentId='doc_'+'3'.repeat(24);let note='Separate annotation';
  const ui=client(async(url,body)=>{
   if(url==='/api/revise')return staged(body);
   if(url==='/api/generate')return proposed(body);
   if(url==='/api/note'){note=body.note;return {savedNote:note};}
   if(url==='/api/work-state')return {recordId:priorId,documentId,version:0,workVersion:3,snapshot:{...snapshot(),correctionNote:note,pendingRevisionToken:'a'.repeat(32),proposalId:nextId,proposalStale:serverStale}};
   if(url==='/api/revision-invalidate')return {error:'Synthetic refused invalidation'};
   assert.equal(url,'/api/save');return {saved:true,recordId:priorId,documentId,version:1,workVersion:3};
  });
  await ui.revise.click();ui.typeNote('Changed proposal context');assert.equal(ui.apply.disabled,true);await ui.save.click();
  assert.equal(ui.calls.some(call=>call.url==='/api/save'),serverStale);assert.equal(ui.apply.disabled,true);
  assert.equal(ui.note.value,'Changed proposal context');assert.equal(ui.instruction.value,'Improve opening');
 }
});

for(const kind of ['general','section'] as const) for(const timing of ['running','returned'] as const) test(`unsent ${kind} change then revert ${timing} stays stale and explicit Save synchronizes only invalidation`,async()=>{
 const documentId='doc_'+'3'.repeat(24);let finish!:(payload:any)=>void;let serverStale=false,workVersion=3;
 const ui=client(async(url,body)=>{
  if(url==='/api/revise')return staged(body);
  if(url==='/api/generate')return timing==='running'?new Promise(resolve=>{finish=resolve;}):proposed(body);
  if(url==='/api/revision-invalidate'){assert.deepEqual(body,{recordId:priorId,pendingRevisionToken:'a'.repeat(32),proposalId:nextId,workVersion:3});serverStale=true;return {...body,proposalStale:true,workVersion:++workVersion};}
  if(url==='/api/work-state')return {recordId:priorId,documentId,version:0,workVersion,snapshot:{...snapshot(),sectionNotes:{Opening:'Original section'},pendingRevisionToken:'a'.repeat(32),proposalId:nextId,proposalStale:serverStale}};
  assert.equal(url,'/api/save');assert.equal(body.workVersion,workVersion);assert.equal(serverStale,true);return {saved:true,recordId:priorId,documentId,version:1,workVersion};
 },{section:'Original section'});
 const generating=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));if(timing==='returned')await generating;
 const type=kind==='general'?ui.typeNote:ui.typeSection;const original=kind==='general'?'Separate annotation':'Original section';
 type('Changed unsent text');type(original);
 if(timing==='running'){finish(proposed(ui.calls.find(c=>c.url==='/api/generate')!.body));await generating;}
 assert.equal(ui.apply.disabled,true);await ui.apply.click();assert.equal(ui.calls.some(c=>c.url==='/api/apply-revision'),false);
 assert.deepEqual(ui.calls.map(c=>c.url),['/api/revise','/api/generate'],'typing must not submit annotations, invalidate remotely or persist');
 await ui.save.click();assert.equal(ui.workStatus.textContent,'Saved');assert.equal(ui.apply.disabled,true);
 assert.equal(ui.calls.filter(c=>c.url==='/api/revision-invalidate').length,1);
});
test('unchanged note input, read-only navigation and title edits do not invalidate a proposal',async()=>{
 const ui=client(async(url,body)=>url==='/api/revise'?staged(body):url==='/api/generate'?proposed(body):({...success(),sectionNotes:{Opening:'Original section'}}),{section:'Original section',title:'Original title'});
 await ui.revise.click();ui.workStatus.textContent='Saved';ui.typeNote('Separate annotation');ui.typeSection('Original section');
 assert.equal(ui.workStatus.textContent,'Saved');assert.equal(ui.apply.disabled,false);ui.readOnly();ui.typeTitle('Another title');assert.equal(ui.apply.disabled,false);
 await ui.apply.click();assert.equal(ui.generated(),'Revised brief');
});
test('Add note cancels native fragment action for pointer and keyboard activation and preserves text',()=>{
 for(const detail of [1,0]){
  const ui=client(async()=>{throw Error('No request expected');});let prevented=false;
  ui.addNote.listeners.get('click')?.({detail,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal((ui.notes as any).open,true);assert.equal(ui.active(),ui.note);assert.equal(ui.note.value,'Separate annotation');assert.equal(ui.calls.length,0);
 }
});

test('Keep original after a stale proposal still permits Save without an invalidation request',async()=>{
 const documentId='doc_'+'3'.repeat(24);const ui=client(async(url,body)=>{
  if(url==='/api/revise')return staged(body);if(url==='/api/generate')return proposed(body);
  if(url==='/api/discard-revision')return {discarded:true,recordId:priorId};
  if(url==='/api/work-state')return {recordId:priorId,documentId,version:0,workVersion:4,snapshot:{...snapshot(),instruction:'',proposalStale:true}};
  assert.equal(url,'/api/save');return {saved:true,recordId:priorId,documentId,version:1,workVersion:4};
 });
 await ui.revise.click();ui.typeNote('Temporary');ui.typeNote('Separate annotation');await ui.discard.click();await ui.save.click();assert.equal(ui.workStatus.textContent,'Saved');assert.equal(ui.calls.some(c=>c.url==='/api/revision-invalidate'),false);
});
test('edit then revert during a Save acknowledgement cannot clear the newer stale latch',async()=>{
 const documentId='doc_'+'3'.repeat(24);let finish!:(payload:any)=>void;
 const ui=client(async(url,body)=>{
  if(url==='/api/revise')return staged(body);if(url==='/api/generate')return proposed(body);
  if(url==='/api/work-state')return {recordId:priorId,documentId,version:0,workVersion:3,snapshot:{...snapshot(),pendingRevisionToken:'a'.repeat(32),proposalId:nextId}};
  assert.equal(url,'/api/save');return new Promise(resolve=>{finish=resolve;});
 });
 await ui.revise.click();const saving=ui.save.click();await new Promise(resolve=>setImmediate(resolve));ui.typeNote('Temporary');ui.typeNote('Separate annotation');
 finish({saved:true,recordId:priorId,documentId,version:1,workVersion:3});await saving;assert.equal(ui.apply.disabled,true);assert.match(ui.workStatus.textContent,/Newer edits are unsaved/);await ui.apply.click();assert.equal(ui.calls.some(c=>c.url==='/api/apply-revision'),false);
});

for(const kind of ['section','general'] as const) for(const edit of ['changed','reverted','silent','harmless'] as const) test(`held ${kind} note acknowledgement with ${edit} preparation input preserves Apply eligibility`,async()=>{
 let acknowledge!:()=>void;let acknowledged=kind==='section'?'Original section':'Separate annotation';
 const proposals:{payload:any;exact:string}[]=[];
 const noteRoute=kind==='section'?'/api/section-note':'/api/note';
 const ui=client(async(url,body)=>{
  if(url===noteRoute){
   assert.equal(kind==='section'?body.priorText:body.priorNote,acknowledged);
   const submitted=kind==='section'?body.text:body.note;
   return new Promise(resolve=>{acknowledge=()=>{acknowledged=submitted;resolve(kind==='section'?{recordId:body.recordId,section:body.section,savedText:submitted}:{savedNote:submitted});};});
  }
  if(url==='/api/revise')return staged(body);
  if(url==='/api/generate'){const payload=proposed(body);proposals.push({payload,exact:JSON.stringify(payload)});return payload;}
  assert.equal(url,'/api/apply-revision');
  return {...success(),savedNote:kind==='general'?acknowledged:'Separate annotation',sectionNotes:{Opening:kind==='section'?acknowledged:'Original section'}};
 },{section:'Original section',title:'Original title'});
 const type=kind==='section'?ui.typeSection:ui.typeNote;const field=kind==='section'?ui.section:ui.note;
 type('Submitted A');const revising=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(ui.calls.map(c=>c.url),[noteRoute]);
 assert.equal(kind==='section'?ui.calls[0]!.body.text:ui.calls[0]!.body.note,'Submitted A');
 assert.equal(acknowledged,kind==='section'?'Original section':'Separate annotation');
 if(edit==='harmless'){type('Submitted A');ui.readOnly();ui.typeTitle('Another title');}
 else if(edit==='silent')field.value='Newer unsent B';
 else {type('Newer unsent B');if(edit==='reverted')type('Submitted A');}
 acknowledge();await revising;
 assert.equal(acknowledged,'Submitted A');
 const expectedText=edit==='changed'||edit==='silent'?'Newer unsent B':'Submitted A';
 assert.equal(field.value,expectedText);assert.equal(ui.generated(),'Prior brief');assert.equal(ui.form.getAttribute('data-record-id'),priorId);
 assert.deepEqual(ui.calls.map(c=>c.url),[noteRoute,'/api/revise','/api/generate']);
 const disabled=ui.apply.disabled;
 await ui.apply.click();
 assert.equal(ui.calls.some(c=>c.url==='/api/apply-revision'),edit==='harmless','stale preparation must never send Apply');
 assert.equal(disabled,edit!=='harmless','only harmless input permits Apply');
 assert.equal(field.value,expectedText);assert.equal(ui.generated(),edit==='harmless'?'Revised brief':'Prior brief');
 assert.equal(ui.form.getAttribute('data-record-id'),edit==='harmless'?nextId:priorId);
 assert.equal(proposals.length,1);for(const {payload,exact} of proposals)assert.equal(JSON.stringify(payload),exact,'exact proposal response must remain unchanged');
});

for(const kind of ['section','general'] as const) test(`repeat revision accepts legitimately acknowledged ${kind} note after stale preparation`,async()=>{
 let acknowledge!:()=>void;let hold=true;let acknowledged=kind==='section'?'Original section':'Separate annotation';
 const noteRoute=kind==='section'?'/api/section-note':'/api/note';
 const proposals:{payload:any;exact:string}[]=[];
 const ui=client(async(url,body)=>{
  if(url===noteRoute){
   assert.equal(kind==='section'?body.priorText:body.priorNote,acknowledged);
   const submitted=kind==='section'?body.text:body.note;
   const result=()=>{acknowledged=submitted;return kind==='section'?{recordId:body.recordId,section:body.section,savedText:submitted}:{savedNote:submitted};};
   if(hold)return new Promise(resolve=>{acknowledge=()=>resolve(result());});
   return result();
  }
  if(url==='/api/revise')return staged(body);
  if(url==='/api/generate'){const payload=proposed(body);proposals.push({payload,exact:JSON.stringify(payload)});return payload;}
  assert.equal(url,'/api/apply-revision');
  return {...success(),savedNote:kind==='general'?acknowledged:'Separate annotation',sectionNotes:{Opening:kind==='section'?acknowledged:'Original section'}};
 },{section:'Original section'});
 const type=kind==='section'?ui.typeSection:ui.typeNote;const field=kind==='section'?ui.section:ui.note;
 type('Submitted A');const revising=ui.revise.click();await new Promise(resolve=>setImmediate(resolve));
 type('Newer unsent B');acknowledge();await revising;
 assert.equal(ui.apply.disabled,true);await ui.apply.click();assert.equal(ui.calls.some(c=>c.url==='/api/apply-revision'),false);
 hold=false;await ui.revise.click();
 assert.equal(acknowledged,'Newer unsent B');assert.equal(field.value,'Newer unsent B');assert.equal(ui.apply.disabled,false);
 assert.equal(ui.generated(),'Prior brief');assert.equal(ui.form.getAttribute('data-record-id'),priorId);
 assert.deepEqual(ui.calls.map(c=>c.url),[noteRoute,'/api/revise','/api/generate',noteRoute,'/api/revise','/api/generate']);
 const generations=ui.calls.filter(c=>c.url==='/api/generate');assert.notEqual(generations[0]!.body.operationId,generations[1]!.body.operationId);
 await ui.apply.click();assert.equal(ui.generated(),'Revised brief');assert.equal(ui.form.getAttribute('data-record-id'),nextId);assert.equal(field.value,'Newer unsent B');
 assert.equal(ui.calls.filter(c=>c.url==='/api/apply-revision').length,1);
 assert.equal(proposals.length,2);for(const {payload,exact} of proposals)assert.equal(JSON.stringify(payload),exact,'exact proposal response must remain unchanged');
});


test('section revision shows that section’s original and retains its title on return from evidence',()=>{
 const start=C3_CLIENT_SCRIPT.indexOf("  let revisionSection = 'Brief';");
 const end=C3_CLIENT_SCRIPT.indexOf('  const sameOperation',start);
 const original={textContent:''},heading={textContent:''},title={textContent:''};
 const sections={'Opening':'Exact original opening','Situation for this audience':'Exact original situation','Questions':'First question\nPurpose kept','Useful close':'Exact original close'};
 const revisionPanel={hidden:true,scrollTop:0,getAttribute:()=>JSON.stringify(sections)};
 const panel={hidden:false},support={hidden:false};
 const scope:any={revisionPanel,evidenceDialog:{querySelector:(s:string)=>s==='[data-evidence-panel-body]'?panel:s==='[data-evidence-support]'?support:title},document:{querySelector:(s:string)=>s==='[data-revision-original]'?original:s==='[data-original-heading]'?heading:null},retainInspectorView(){},presentInspector(){},controls(){},inspectorRoutes(){},instruction:{focus(){}},revisionScroll:135};
 vm.runInNewContext(C3_CLIENT_SCRIPT.slice(start,end)+';globalThis.openRevision=openRevisionSheet;',scope);
 scope.openRevision('Questions');assert.equal(original.textContent,sections.Questions);assert.equal(heading.textContent,'Original questions');assert.equal(title.textContent,'Revise questions');
 scope.openRevision('Brief',true);assert.equal(title.textContent,'Revise questions');assert.equal(revisionPanel.scrollTop,135);
 scope.openRevision('Situation for this audience');assert.equal(original.textContent,sections['Situation for this audience']);assert.equal(title.textContent,'Revise situation');
});
