import assert from "node:assert/strict";
import test from "node:test";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { loadCuratedC3Context } from "../../src/c3/curated-context.ts";
import { renderC3Page } from "../../src/c3/render.ts";
import { parseWorkspaceRoute, researchUrl } from "../../src/c3/workspace-route.ts";
import { WORKSPACE_CSS } from "../../src/c3/workspace-style.ts";
import { projectAccount } from "../../src/c3/account-projection.ts";
const request = { audience: "CIO", intendedOutcome: "Learn priorities", durationMinutes: 30 as const, meetingDate: "2026-09-12" };
const load = () => loadC3AccountContext({ broadInputPath: "fixtures/account-intelligence/c2-01/broad-account-research-input.json", proposalPath: "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json", ownerDecisionPath: "docs/decisions/c2-owner-disposition-record.json", accountId: "acc_university_of_utah" });
const missouri = () => loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri");
const main = (html: string) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const esc = (value: string) => value.replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

test("workspace URL parsing preserves legacy routes and rejects unknown destinations and topics", () => {
  const parse = (query: string) => parseWorkspaceRoute(new URLSearchParams(query));
  assert.deepEqual(parse(''), { destination: 'overview' });
  assert.deepEqual(parse('view=workshop'), { destination: 'workshop' });
  assert.deepEqual(parse('view=research&topic=technology&reading=redtail-platform'), { destination: 'research', topic: 'technology', reading: 'redtail-platform' });
  for (const task of ['prepare', 'draft']) assert.deepEqual(parse(`${task}=1`), { destination: 'workshop', task });
  for (const task of ['strategy', 'next-steps']) assert.deepEqual(parse(`kind=${task}`), { destination: 'workshop', task });
  assert.deepEqual(parse('draft=1&prepare=1'), { destination: 'workshop', task: 'draft' });
  for (const query of ['view=other', 'view=research&topic=unknown', 'kind=other', 'view=research&reading=%3Cimg%3E']) assert.throws(() => parse(query));
});
test("shared frame has one account identity and three destinations with exact semantic tokens", async () => {
  const context = await load();
  for (const page of ['home', 'research', 'workshop'] as const) {
    const html = renderC3Page(context, page === 'research' ? { page, topic: 'people' } : page === 'home' ? { page } : { page }, 'test');
    const nav = html.match(/<nav class="workspace-nav"[\s\S]*?<\/nav>/u)![0];
    assert.equal((nav.match(/<a /gu) ?? []).length, 3);
    assert.equal((nav.match(/aria-current="page"/gu) ?? []).length, 1);
    assert.match(html, /<header class="workspace-header"><span class="account-identity">University of Utah<\/span>/);
    assert.doesNotMatch(html, /Georgia|parchment|account-atmosphere|linear-gradient|>Settings</);
  }
  for (const token of ['--atl-canvas: #f6f7f9', '--atl-ink: #171a1f', '--atl-muted: #626b78', '--atl-accent: #6652c6', '--atl-sidebar: 208px', '--atl-inspector: 420px']) assert.ok(WORKSPACE_CSS.includes(token));
  assert.match(WORKSPACE_CSS, /background:var\(--atl-question-surface\);color:var\(--atl-question-ink\)/);
  assert.match(WORKSPACE_CSS, /safe-area-inset-bottom/);
  assert.match(WORKSPACE_CSS, /focus-visible/);
});
test("Overview contains compact synthesis and real priority routes without an appended library or full topic dump", async () => {
  for (const context of [await load(), await missouri()]) {
    const html = main(renderC3Page(context, { page: 'home' }, 'test'));
    assert.match(html, /Priorities &amp; initiatives/);
    assert.match(html, /People &amp; operating context/);
    assert.match(html, /Technology landscape/);
    assert.doesNotMatch(html, /id="account-research"|id="account-unreviewed-research"|class="research-source"|id="original-account-proposal"|id="account-hypotheses"/);
    const projection = projectAccount(context);
    assert.match(html, /class="lede"/);
    assert.match(html, /Public research · details/);
    const priorityRoutes = [...html.matchAll(/class="priority-tile" href="([^"]+)"/g)].map(item => item[1]);
    assert.equal(priorityRoutes.length, 3);
    for (const route of priorityRoutes) assert.ok(projection.readings.some(note => route === esc(researchUrl('initiatives', note.id))));
    for (const link of html.matchAll(/data-evidence-link[^>]+href="#([^"]+)"/gu)) assert.ok(html.includes(`id="${link[1]}"`));
  }
});
test("Research retains exact reading text and qualifiers and targeted unknown readings recover locally", async () => {
  for (const context of [await load(), await missouri()]) {
    for (const note of projectAccount(context).readings) {
      const topic = note.topic === 'people' || note.topic === 'technology' ? note.topic : 'initiatives';
      const html = main(renderC3Page(context, { page: 'research', topic, reading: note.id }, 'test'));
      assert.ok(html.includes(`<p>${esc(note.text)}</p>`), note.id);
      if (note.limit) assert.ok(html.includes(esc(note.limit)), note.id);
      assert.equal((html.match(/<dialog data-evidence-dialog/gu) ?? []).length, 1);
    }
    const unknown = main(renderC3Page(context, { page: 'research', topic: 'technology', reading: 'missing' }, 'test'));
    assert.match(unknown, /That reading is not available/);
    assert.match(unknown, /Technology &amp; services/);
  }
});
test("Prepare retains editable inputs, disclosed options and context, with unavailable state before submit", async () => {
  const context = await load();
  const html = main(renderC3Page(context, { page: 'prepare', request }, 'test'));
  assert.match(html, /for="audience">Who is this for\?/);
  assert.match(html, /<details class="meeting-options">/);
  assert.match(html, /Generation unavailable/);
  assert.match(html, /<button type="submit" disabled hidden>Prepare brief<\/button>/);
  assert.ok(html.indexOf('type="submit"') < html.indexOf('class="brief-context"'));
  assert.match(html, /Context for this brief/);
  const available = main(renderC3Page(context, { page: 'prepare', request, generation: { available: true, explanation: 'Configured provider route.' } }, 'test'));
  assert.match(available, /<button type="submit">Prepare brief<\/button>/);
  const curated = main(renderC3Page(await missouri(), { page: 'prepare', request }, 'test'));
  assert.match(curated, /no model-generated meeting draft or recording is available/);
  assert.doesNotMatch(curated, /data-generate/);
});
test("Workshop has honest empty and current-draft states with working secondary worksheets", async () => {
  const context = await load();
  const empty = main(renderC3Page(context, { page: 'workshop', work: { available: true, documentId: '', version: 0, workVersion: 0, saved: false, savedWorks: [] } }, 'test'));
  assert.match(empty, /No meeting brief yet/);
  assert.match(empty, /href="\/\?kind=strategy"/);
  assert.match(empty, /href="\/\?kind=next-steps"/);
  const current = main(renderC3Page(context, { page: 'workshop', hasDraft: true }, 'test'));
  assert.match(current, /href="\/\?draft=1">Reopen session draft/);
  assert.doesNotMatch(current, />Saved</);
});

test("Brief context labels thesis support and retains distinct exact evidence anchors", async () => {
  const context = await load();
  const { briefContext } = await import('../../src/c3/planning-render.ts');
  const html = briefContext(context);
  assert.match(html, /data-thesis-state=/);
  assert.match(html, /Related evidence context/);
  const evidence = context.context.admittedSources.flatMap(source => source.excerpts);
  for (const id of context.context.proposal.accountThesis.evidenceIds.slice(0, 3)) {
    const index = evidence.findIndex(item => item.evidenceId === id);
    assert.ok(html.includes(`Evidence ${index + 1} ·`));
    assert.ok(html.includes(`<blockquote>${esc(evidence[index]!.exactExcerpt)}</blockquote>`));
    assert.ok(html.includes(`href="#evidence-${index + 1}"`));
  }
  const direct = { ...context, context: { ...context.context, proposal: { ...context.context.proposal, accountThesis: { ...context.context.proposal.accountThesis, state: 'source-backed fact' as const } } } };
  assert.match(briefContext(direct), /Direct supporting evidence/);
});
test("Research preserves substantive initiative scope and specific unknowns across Utah and Missouri", async () => {
  const research = (context: Awaited<ReturnType<typeof load>> | Awaited<ReturnType<typeof missouri>>) => (['initiatives', 'people', 'technology', 'sources'] as const).map(topic => main(renderC3Page(context, { page: 'research', topic }, 'test'))).join('');
  const utah = research(await load());
  for (const text of ['Responsible AI workforce', 'Strategic reinvestment', 'Redtail', 'HPE', 'NVIDIA', 'CHPC', 'Health AI Vault', 'sponsored awards', 'What research-computing services, support and data-governance arrangements are currently offered, if any?', 'data-access', 'Source summary · unreviewed']) assert.ok(utah.includes(text), text);
  const m = research(await missouri());
  for (const text of ['Student success', 'Research &amp; scholarship', 'MizzouForward', 'UM System', 'Mun Choi', 'Exact source context · unreviewed', 'What research-computing services, support and data-governance arrangements are currently offered, if any?', 'September 2024']) assert.ok(m.includes(text), text);
  assert.doesNotMatch(m, /Stanford|Account score|data-generate/);
});

test('populated brief keeps exact content and evidence while grouping support and annotation controls', async () => {
  const { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } = await import('../fixtures/c3-workshop.ts');
  const { createC3ModelRequest, createGenerationRecord } = await import('../../src/c3/draft.ts');
  const context = syntheticWorkshopContext();
  const request = { ...syntheticMeetingRequest, intendedOutcome: 'Explore <constraints> & agree a useful next step' };
  const record = createGenerationRecord(createC3ModelRequest(context, request, null, "5"), syntheticMeetingCandidate(context), context);
  assert.ok(record.draft);
  const html = main(renderC3Page(context, { page: 'draft', record, correctionNote: 'My exact general note', sectionNotes: { Opening: 'My exact opening note' }, work: { available: true, documentId: 'doc_' + '1'.repeat(24), version: 2, workVersion: 3, saved: true, savedWorks: [] } }, 'test'));
  assert.ok(html.includes(esc(request.intendedOutcome)), 'Full outcome remains in document details');
  assert.ok((html.match(/<h1 data-work-title>(.*?)<\/h1>/)?.[1] ?? '').length < esc(request.intendedOutcome).length, 'Suggested title is concise');
  const labels = ['>Situation</h2>', '>Opening</h2>', '>Three questions</h2>', '>Useful close</h2>'];
  assert.deepEqual(labels.map(label => html.indexOf(label)), labels.map(label => html.indexOf(label)).sort((a,b) => a-b));
  for (const item of [record.draft.audienceThesis, record.draft.opening, record.draft.objective, record.draft.closeCriterion, ...record.draft.risksUnknowns]) assert.ok(html.includes(esc(item.text)));
  for (const q of record.draft.questions) assert.ok(html.includes(esc(q.question)));
  for (const warning of record.draft.warnings) assert.ok(html.includes(esc(warning.message)));
  for (const label of ['Situation for this audience', 'Opening', 'Questions', 'Useful close']) assert.ok(html.includes(`data-section="${label}"`), 'Historical annotation keys remain stable');
  assert.match(html, /My exact general note/); assert.match(html, /My exact opening note/);
  assert.match(html, /data-save-work hidden>Save/);
  assert.doesNotMatch(html, /Refine this section|Refine these questions|Note or correction|>Source [0-9]+<|Your meeting brief/);
  for (const link of html.matchAll(/data-evidence-link[^>]+href="#([^"]+)"/gu)) assert.ok(html.includes(`id="${link[1]}"`));
});

test('Workshop groups saved and current work and suppresses only the derived-title outcome duplicate',async()=>{
 const {syntheticWorkshopContext}=await import('../fixtures/c3-workshop.ts');
 const html=main(renderC3Page(syntheticWorkshopContext(),{page:'workshop',hasDraft:true,work:{available:true,documentId:'doc_'+'1'.repeat(24),version:1,workVersion:1,saved:true,savedWorks:[
 {documentId:'doc_'+'1'.repeat(24),version:1,audience:'CIO',intendedOutcome:'Fallback outcome',meetingDate:'2026-09-12',origin:'unknown'},
 {documentId:'doc_'+'2'.repeat(24),version:2,audience:'Research team',title:'Distinct title',intendedOutcome:'Distinct outcome',savedAt:'2026-09-09T03:00:00.000Z',origin:'synthetic'}]}},'test'));
 assert.equal((html.match(/Fallback outcome/g)??[]).length,1);for(const text of ['Distinct title','Distinct outcome','CIO','Sep 12, 2026','Research team','Last saved','Origin not established','Synthetic example','Current brief'])assert.ok(html.includes(text),text);
 assert.match(html,/class="workshop-groups"/);assert.equal((html.match(/class="workshop-list"/g)??[]).length,1);assert.ok(!html.includes('Continue working'), 'Saved current record is not duplicated');
});
