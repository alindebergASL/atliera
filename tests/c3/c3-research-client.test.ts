import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { RESEARCH_CLIENT_SCRIPT, questionPassages } from '../../src/c3/research-render.ts';
import { C3_CLIENT_SCRIPT } from '../../src/c3/render.ts';
import { assertC3ClientSurface } from '../helpers/c3-client-surface.ts';

test('SYNTHETIC research client: explicit actions, busy clicks, lost response retry; only research panel changes',async()=>{
  let click!:(event:any)=>void,resolve!:(response:any)=>void;
  const calls:{route:string;body:unknown}[]=[];const writes:string[]=[];const timers:Function[]=[];
  const dirty={note:'Unsent note',audience:'Unsent audience',proposal:'Existing proposal',document:'saved-document'};
  const before={...dirty};const message={textContent:''};
  const panel={set innerHTML(value:string){writes.push(value);},querySelector:(selector:string)=>selector==='[data-research-message]'?message:null,
    addEventListener:(_event:string,fn:typeof click)=>{click=fn;}};
  runInNewContext(RESEARCH_CLIENT_SCRIPT,{document:{querySelector:()=>panel},setTimeout:(fn:Function)=>{timers.push(fn);return 1;},clearTimeout:()=>{},
    requestJson:(route:string,body:unknown)=>{calls.push({route,body});return new Promise(done=>{resolve=done;});}});
  assert.equal(calls.length,0,'render never starts acquisition or refresh');assert.equal(timers.length,0);
  const button={disabled:false,dataset:{snapshot:'snapshot_original'},hasAttribute:(attr:string)=>attr==='data-research-refresh'};
  click({target:{closest:()=>button}});click({target:{closest:()=>button}});assert.equal(calls.length,1);
  assert.equal(calls[0]!.route,'/api/research/refresh');assert.equal(JSON.stringify(calls[0]!.body),JSON.stringify({snapshotId:'snapshot_original'}));
  resolve({panelHtml:'server-escaped-research-panel'});await new Promise(done=>setImmediate(done));
  assert.deepEqual(writes,['server-escaped-research-panel']);assert.deepEqual(dirty,before);
  click({target:{closest:()=>button}});assert.equal(calls.length,2);assert.equal(JSON.stringify(calls[1]),JSON.stringify(calls[0]),'retry retains identical snapshot identity');
  resolve({selection:{reason:'Admission required',snapshotId:'snapshot_original',sourceId:'source_a',passage:{sha256:'passage_hash'}}});await new Promise(done=>setImmediate(done));
  assert.match(message.textContent,/Admission required/);assert.deepEqual(dirty,before);
  assert.doesNotMatch(RESEARCH_CLIENT_SCRIPT,/replacePage\(|saveWork\(|applyRevision\(/);
  assert.match(RESEARCH_CLIENT_SCRIPT,/if \(result.location\) \{ window.location.assign\(result.location\); return; \}/);
});
test('composed C2 research endpoints: passing baseline precedes hostile route mutations',()=>{
  assertC3ClientSurface();
  for(const changed of [
    C3_CLIENT_SCRIPT.replace("requestJson('/api/research/start'","requestJson('/api/research/auto-start'"),
    C3_CLIENT_SCRIPT.replace("requestJson('/api/research/source'","requestJson('https://example.invalid/source'"),
    C3_CLIENT_SCRIPT.replace("requestJson('/api/research/select'","requestJson(button.dataset.url"),
    C3_CLIENT_SCRIPT.replace('route => accountPrefix + route','route => route'),
  ]) assert.throws(()=>assertC3ClientSurface(changed));
});

test('exact-passage navigation locates question terms beyond a long menu prefix', () => {
  const cleanText = 'Menu navigation '.repeat(100) + 'Service access requires an application and sponsor review before an account can be considered. ' + 'Retained context '.repeat(80);
  const source = { cleanText } as Parameters<typeof questionPassages>[0];
  const passages = questionPassages(source, 'Service access requirements');
  assert.ok(passages.length > 0);
  assert.match(passages[0]!.text, /access requires an application/);
  assert.ok(passages[0]!.start > 900);
  for (const passage of passages) assert.equal(passage.text, cleanText.slice(passage.start, passage.end));
});

// Exact C2→CD1 migration: only explicit validated preparation may navigate.
test('SYNTHETIC explicit validated selection navigates the server account route exactly once', async () => {
  let click: any, prepareClick: any;
  const locations: string[] = [], calls: string[] = [];
  const selection = { snapshotId: 'snapshot_exact', sourceId: 'source_exact', passage: { sha256: 'passage_exact' }, reason: 'Admission required' };
  const inspection = { append: (_button: unknown) => {}, setAttribute: () => {}, focus: () => {} };
  const panel = { querySelector: (s: string) => s === '[data-research-inspection]' ? inspection : null, addEventListener: (_event: string, fn: unknown) => { click = fn; } };
  runInNewContext(RESEARCH_CLIENT_SCRIPT, { document: { querySelector: () => panel, createElement: () => ({ addEventListener: (_event: string, fn: unknown) => { prepareClick = fn; } }) },
    window: { location: { assign: (value: string) => locations.push(value) } }, clearTimeout: () => {}, setTimeout: () => 0,
    requestJson: async (route: string) => { calls.push(route); return route.endsWith('/select') ? { selection } : { location: '/accounts/acct-synthetic/?prepare=1' }; } });
  click({ target: { closest: () => ({ disabled: false, dataset: { snapshot: selection.snapshotId, source: selection.sourceId, passage: selection.passage.sha256 }, hasAttribute: (attr: string) => attr === 'data-research-select' }) } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(locations, []);
  prepareClick(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['/api/research/select', '/api/research/prepare']);
  assert.deepEqual(locations, ['/accounts/acct-synthetic/?prepare=1']);
});
