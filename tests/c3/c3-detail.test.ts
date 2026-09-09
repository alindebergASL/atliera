import assert from 'node:assert/strict';
import test from 'node:test';
import { projectAccount } from '../../src/c3/account-projection.ts';
import { loadC3AccountContext } from '../../src/c3/context.ts';
import { loadCuratedC3Context } from '../../src/c3/curated-context.ts';
import { renderC3Page } from '../../src/c3/render.ts';
const utah = () => loadC3AccountContext({broadInputPath:'fixtures/account-intelligence/c2-01/broad-account-research-input.json',proposalPath:'docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json',ownerDecisionPath:'docs/decisions/c2-owner-disposition-record.json',accountId:'acc_university_of_utah'});
test('retained details add scoped passages beyond summaries, with exact fail-closed bindings',async()=>{
 const context=await utah(); const before=JSON.stringify(context);const projection=projectAccount(context);
 for(const id of ['strategic-reinvestment','chpc','redtail-platform','public-presidency']) {
  const detail=projection.details.find(item=>item.readingId===id)!;
  assert.ok(detail?.sections.length, id);
  for(const section of detail.sections){
   const source=context.context.admittedSources.find(item=>item.sourceId===section.sourceId)!;
   assert.ok(source.fullBoundedCleanText.includes(section.exactText));
   assert.notEqual(section.exactText,projection.readings.find(item=>item.id===id)!.text);
  }
 }
 assert.ok(projection.details.find(item=>item.readingId==='strategic-reinvestment')!.sections.some(item=>item.exactText.includes('FY 2028')));
 assert.ok(projection.details.find(item=>item.readingId==='chpc')!.sections.some(item=>item.exactText.includes('commercial sector')));
 assert.equal(JSON.stringify(context),before);
 const altered={...context,context:{...context.context,admittedSources:context.context.admittedSources.map(source=>({...source,fullBoundedCleanText:'changed'}))}};
 assert.deepEqual(projectAccount(altered).details,[]);
});
test('single detail inspector spans Overview, Research and Prepare with stable Research identity',async()=>{
 const context=await utah();
 for(const state of [{page:'home'},{page:'research',topic:'people',reading:'chpc'},{page:'prepare',request:{audience:'CIO',intendedOutcome:'Understand services',durationMinutes:30,meetingDate:'2026-09-12'}}] as const){
  const html=renderC3Page(context,state,'ui02');
  assert.equal([...html.matchAll(/<dialog\b/g)].length,1);
  assert.match(html,/data-detail-link/);assert.match(html,/View details/);
  assert.match(html,/data-inspector-back/);assert.match(html,/data-inspector-account/);
  assert.match(html,/data-detail-content/);
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);assert.equal(ids.length,new Set(ids).size,'unique DOM ids');
 }
 const research=renderC3Page(context,{page:'research',topic:'people',reading:'chpc'},'ui02');
 assert.match(research,/id="reading-chpc"[^>]+data-selected="true"/);
 assert.match(research,/for="research-topic"/);
 assert.match(research,/data-open-research[^>]+topic=people&amp;reading=chpc/);
});
test('sparse Missouri detail admits only retained context and preserves conflicts',async()=>{
 const context=await loadCuratedC3Context('fixtures/account-intelligence/c3-curated/missouri.json','acc_university_of_missouri');
 assert.ok(projectAccount(context).details.some(item=>item.readingId==='research-infrastructure'));
 const sparse={...context,context:{...context.context,admittedSources:[],declaredContradictions:['Source scope conflicts.']}};
 const html=renderC3Page(sparse,{page:'home'},'ui02');assert.match(html,/Source scope conflicts/);assert.ok(!html.includes('<div data-detail-content'));
});
test('saved rows use explicit metadata and never infer replay from rendering mode',async()=>{
 const context=await utah();const work={available:true,documentId:'doc_'+'1'.repeat(24),version:2,workVersion:3,saved:true,savedWorks:[{documentId:'doc_'+'1'.repeat(24),version:2,audience:'CIO',title:'Plan research access',intendedOutcome:'Confirm scope',meetingDate:'2026-09-12',savedAt:'2026-09-09T10:30:00.000Z',origin:'unknown' as const}]};
 const html=renderC3Page(context,{page:'workshop',work},'ui02');
 assert.match(html,/<h3>Plan research access<\/h3>/);assert.match(html,/Confirm scope/);assert.match(html,/Last saved/);assert.match(html,/Origin not established/);
 const replay=renderC3Page(context,{page:'workshop',work:{...work,savedWorks:[{...work.savedWorks[0]!,origin:'historical-replay'}]}},'ui02');assert.match(replay,/Historical replay/);
});


test('unavailable saved-work listing does not claim that no saved briefs exist',async()=>{
 const context=await utah();const html=renderC3Page(context,{page:'workshop',work:{available:true,documentId:'doc_'+'1'.repeat(24),version:0,workVersion:0,saved:false,savedWorks:[],storageError:'Synthetic store inspection failure'}},'ui02');
 assert.ok(html.includes('Saved briefs could not be loaded. Current work is kept.'));
 assert.ok(!html.includes('No saved briefs for this account.'));assert.ok(html.includes('<summary>Exact diagnostics</summary>'));
});
