import assert from 'node:assert/strict';
import test from 'node:test';
import { renderC3Page, type WorkDisplayState } from '../../src/c3/render.ts';
import { createC3ModelRequest, createGenerationRecord } from '../../src/c3/draft.ts';
import { syntheticWorkshopContext, syntheticMeetingCandidate, syntheticMeetingRequest } from '../fixtures/c3-workshop.ts';
const context = syntheticWorkshopContext();
const record = createGenerationRecord(createC3ModelRequest(context, syntheticMeetingRequest, null, '5'), syntheticMeetingCandidate(context), context);
const main = (html: string) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const work: WorkDisplayState = {available:true,documentId:'',version:0,workVersion:0,saved:false,savedWorks:[]};
const savedWorks = ['1','2','3'].map(c => ({documentId:`doc_aaaaaaaa${c}bbbbbbbbbbbbbbb`,title:'Understand priorities',audience:'CIO',meetingDate:'2026-09-11',version:1}));

test('Workshop absence requires a settled successful empty saved list and no session', () => {
  for (const saved of [savedWorks, []]) for (const hasDraft of [false, true]) {
    const html = main(renderC3Page(context,{page:'workshop',hasDraft,work:{...work,savedWorks:saved}},'test'));
    assert.equal(html.includes('No meeting brief yet'), !hasDraft && saved.length === 0);
    assert.match(html,/href="\/\?prepare=1">Set up brief<\/a>/);
  }
});
test('unknown, unavailable and failed saved lists never imply absence; partial results remain actionable', () => {
  for (const state of [undefined,{...work,available:false},{...work,storageError:'Read failed'},{...work,storageError:'Partial failure',savedWorks}]) {
    const html = main(renderC3Page(context,{page:'workshop',work:state},'test'));
    assert.doesNotMatch(html,/No meeting brief yet|No saved briefs for this account/);
    assert.match(html,/href="\/\?prepare=1">Set up brief<\/a>/);
    if(state?.storageError) assert.match(html,/could not be loaded|Some saved briefs are unavailable/);
    if(state?.savedWorks.length) assert.equal((html.match(/data-reopen-work=/g)||[]).length,3);
  }
});
test('identical saved rows expose collision-safe IDs in the open action and visible metadata without mutation', () => {
  const before=JSON.stringify(savedWorks);
  const html=main(renderC3Page(context,{page:'workshop',work:{...work,savedWorks}},'test'));
  const rows=html.match(/<article class="workshop-item"[\s\S]*?<\/article>/g)!;
  const labels=rows.map(row=>row.match(/data-saved-identity>([^<]+)</)?.[1]);
  assert.equal(labels.length,3);assert.ok(labels.every(Boolean));assert.equal(new Set(labels).size,3);
  for(const [i,row] of rows.entries()) {
    assert.ok(row.indexOf('data-saved-identity') < row.indexOf('<details'));
    assert.ok(row.includes(`aria-label="Understand priorities · ${labels[i]}"`));
    assert.ok(row.includes(`data-reopen-work="${savedWorks[i]!.documentId}"`));
  }
  assert.equal(JSON.stringify(savedWorks),before);
});
test('collision labels escape supplied strings and remain stable when rows reorder', () => {
  const items = ['doc_<a&"same','doc_<b&"same'].map(documentId=>({...savedWorks[0]!,documentId,title:'<Same>'}));
  const render=(savedWorks:typeof items)=>main(renderC3Page(context,{page:'workshop',work:{...work,savedWorks}},'test'));
  const html=render(items), reversed=render([...items].reverse());
  assert.doesNotMatch(html,/<Same>|doc_<[ab]/);
  const labels=(s:string)=>[...s.matchAll(/data-saved-identity>([^<]+)</g)].map(m=>m[1]).sort();
  assert.equal(labels(html).length,2);assert.notEqual(labels(html)[0],labels(html)[1]);assert.deepEqual(labels(html),labels(reversed));
});
const reason='Revision unavailable. No recorded response is configured for this exact brief. You can still add notes.';
for(const instruction of ['', 'My retained <instruction>']) test(`unavailable revision preserves useful actions and ${instruction ? 'local draft' : 'no empty editor'}`, () => {
  const html=main(renderC3Page(context,{page:'draft',record,correctionNote:'Kept note',instruction,revisionUnavailableReason:reason,generation:{available:true,explanation:'Recorded replay'}},'test'));
  const panel=html.slice(html.indexOf('<div data-revision-panel'),html.indexOf('</dialog>'));
  assert.match(panel,/No recorded response is configured/);
  assert.match(panel,/data-revision-add-note/);
  assert.doesNotMatch(panel,/data-revise(?:\s|>)/);
  if(instruction) assert.match(panel,/My retained &lt;instruction&gt;<\/textarea>/);
  else assert.doesNotMatch(panel,/data-revision-instruction|data-original-preview|data-stop-revision|data-apply-revision|data-discard-revision/);
  assert.match(html,/Kept note<\/textarea>/);assert.match(html,/data-evidence-close/);
});
for(const proposal of [null,record]) test(`unavailable revision keeps ${proposal ? 'proposal' : 'staged recovery'} and stale handling reachable`, () => {
  const html=main(renderC3Page(context,{page:'draft',record,correctionNote:'Kept note',instruction:'Retained request',revisionUnavailableReason:reason,revisionPending:true,pendingRevisionToken:'a'.repeat(32),proposal,proposalStale:true},'test'));
  assert.match(html,/Retained request<\/textarea>/);assert.match(html,/data-discard-revision/);
  assert.match(html,/data-proposal-stale="true"/);assert.match(html,/data-pending-revision-token=/);
  if(proposal) assert.match(html,/data-apply-revision/);
  assert.doesNotMatch(html,/<button[^>]*data-revise(?:\s|>)/);
});
