import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {C3_CLIENT_SCRIPT} from '../../src/c3/render.ts';

// Exercise the actual shared inspector program, with deterministic DOM/focus/scroll seams.
const supplied = process.env.UI02_BASELINE_HTML ? readFileSync(process.env.UI02_BASELINE_HTML,'utf8').match(/<script>([\s\S]*)<\/script>/)![1]! : C3_CLIENT_SCRIPT;
const program = supplied.slice(supplied.indexOf('  const evidenceDialog ='), supplied.indexOf("  if (typeof window !== 'undefined') window.addEventListener('hashchange'"));
function inspector(wide=false){
 let active:any=null;let pageScroll=[0,620];const handlers:Record<string,((event:any)=>void)[]>={};const changes:Record<string,()=>void>={};let revisionReturns=0;
 class Node {
  textContent='';hidden=false;open=false;scrollTop=0;attrs:Record<string,string>={};children:any[]=[];nodes:Record<string,Node>={};parents:Record<string,Node>={};handlers:Record<string,(event:any)=>void>={};
  getAttribute(name:string){return this.attrs[name]??null;}setAttribute(name:string,value:string){this.attrs[name]=value;}removeAttribute(name:string){delete this.attrs[name];}
  querySelector(selector:string){return this.nodes[selector]??null;}closest(selector:string){return this.parents[selector]??null;}
  addEventListener(name:string,handler:(event:any)=>void){this.handlers[name]=handler;}focus(){active=this;}
  showModal(){this.open=true;}show(){this.open=true;}close(){this.open=false;this.handlers.close?.({});}
  cloneNode(){return this;}replaceChildren(...children:any[]){this.children=children;}
  click(){active=this;this.handlers.click?.({});}
 }
 const dialog=new Node(),panel=new Node(),support=new Node(),title=new Node(),back=new Node(),close=new Node(),revisionReturn=new Node(),revision=new Node();
 dialog.nodes={'[data-evidence-panel-body]':panel,'[data-evidence-support]':support,'#evidence-panel-title':title,'[data-inspector-back]':back,'[data-evidence-close]':close,'[data-return-revision]':revisionReturn,'[data-revision-panel]':revision};
 const detail=new Node(),detailContent=new Node(),detailLink=new Node();detail.attrs={'data-detail-title':'CHPC · research computing'};detail.nodes={'[data-detail-content]':detailContent};detailLink.attrs={'data-detail-target':'detail-chpc',href:'/?view=research&topic=people&reading=chpc'};detailLink.parents={'a[data-detail-link]':detailLink};
 const evidence=new Node(),evidenceContent=new Node(),summary=new Node(),citation=new Node();summary.textContent='Retained operating scope';evidence.nodes={'[data-evidence-content]':evidenceContent,summary};citation.attrs={href:'#detail-evidence-1','data-context':'CHPC','data-support':'Related source context'};citation.parents={'a[data-evidence-link], a[data-research-link]':citation,'[data-detail-content]':detailContent};
 const direct=new Node();direct.attrs={href:'#detail-evidence-1','data-context':'Opening'};direct.parents={'a[data-evidence-link], a[data-research-link]':direct};
 const document={body:{style:{overflow:'auto'}},get activeElement(){return active;},querySelector:(selector:string)=>selector==='[data-evidence-dialog]'?dialog:selector==='#detail-evidence-1'?evidence:null,getElementById:(id:string)=>id==='detail-chpc'?detail:null,addEventListener:(name:string,fn:(event:any)=>void)=>{handlers[name]=[...(handlers[name]??[]),fn];}};
 const window={scrollX:0,scrollY:620,matchMedia:()=>({matches:wide}),scrollTo:(...position:number[])=>{pageScroll=position;},addEventListener:(name:string,fn:()=>void)=>{changes[name]=fn;},setTimeout:(fn:()=>void)=>fn()};
 vm.runInNewContext(program,{document,window,openRevisionSheet:()=>revisionReturns++});
 const click=(node:Node,options={})=>{active=node;let prevented=false;const event={target:node,button:0,preventDefault(){prevented=true;},...options};for(const handler of handlers.click??[])handler(event);return prevented;};
 return {dialog,panel,back,close,revisionReturn,revision,title,detailContent,detailLink,citation,direct,click,active:()=>active,pageScroll:()=>pageScroll,body:document.body,returns:()=>revisionReturns,resize(value:boolean){wide=value;changes.resize?.();}};
}
test('detail → citation → Back restores the exact retained detail, focus and independent scroll',()=>{
 const ui=inspector();assert.equal(ui.click(ui.detailLink),true);assert.equal(ui.dialog.open,true);assert.equal(ui.panel.children[0],ui.detailContent);
 ui.panel.scrollTop=240;ui.click(ui.citation);assert.equal(ui.back.hidden,false);assert.equal(ui.back.textContent,'Back to CHPC · research computing');assert.equal(ui.panel.scrollTop,0);
 ui.back.click();assert.equal(ui.panel.children[0],ui.detailContent);assert.equal(ui.panel.scrollTop,240);assert.equal(ui.active(),ui.citation);
 ui.close.click();assert.equal(ui.active(),ui.detailLink);assert.deepEqual(ui.pageScroll(),[0,620]);assert.equal(ui.body.style.overflow,'auto');assert.equal(ui.detailLink.getAttribute('data-inspected'),null);
});
test('direct citations have no invented item Back route, and modified detail clicks stay native',()=>{
 const ui=inspector();assert.equal(ui.click(ui.detailLink,{ctrlKey:true}),false);assert.equal(ui.dialog.open,false);
 ui.click(ui.direct);assert.equal(ui.dialog.open,true);assert.equal(ui.back.hidden,true);ui.close.click();assert.equal(ui.active(),ui.direct);
});
test('readable desktop docks the one inspector and retains its first origin across item changes',()=>{
 const ui=inspector(true);ui.click(ui.detailLink);assert.equal(ui.dialog.getAttribute('data-docked'),'true');assert.equal(ui.body.style.overflow,'auto');
 ui.click(ui.citation);ui.back.click();ui.close.click();assert.equal(ui.active(),ui.detailLink);
});


test('resizing between docked and modal keeps the selected detail and original focus receipt',()=>{
 const ui=inspector(true);ui.click(ui.detailLink);ui.panel.scrollTop=180;
 ui.resize(false);assert.equal(ui.dialog.open,true);assert.equal(ui.body.style.overflow,'hidden');assert.equal(ui.panel.children[0],ui.detailContent);
 ui.resize(true);assert.equal(ui.dialog.open,true);assert.equal(ui.body.style.overflow,'auto');assert.equal(ui.panel.scrollTop,180);
 ui.close.click();assert.equal(ui.active(),ui.detailLink);assert.deepEqual(ui.pageScroll(),[0,620]);
});
