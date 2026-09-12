import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { contextFor } from '../../src/c3/cli.ts';
import { projectAccount } from '../../src/c3/account-projection.ts';
import { renderC3Page, type C3PageState, type WorkDisplayState } from '../../src/c3/render.ts';
import { WORKSPACE_CSS } from '../../src/c3/workspace-style.ts';
import { createC3ModelRequest, createGenerationRecord } from '../../src/c3/draft.ts';
import { syntheticWorkshopContext, syntheticMeetingCandidate, syntheticMeetingRequest as request } from '../fixtures/c3-workshop.ts';

const esc = (value: string) => value.replace(/[&<>"']/gu, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const main = (html: string) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const markup = (html: string) => html.split('<script>')[0]!;
const emptyWork: WorkDisplayState = {available:true,documentId:'',version:0,workVersion:0,saved:false,savedWorks:[]};
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');

test('B2 real account composition: distinct retained context, native destinations, locally scoped evidence and art', async () => {
  const contexts = [await contextFor('acc_university_of_utah'), await contextFor('acc_fedex_corp')];
  const accounts = contexts.map(c => c.context.account);
  for (const [index, context] of contexts.entries()) {
    const before = JSON.stringify(context);
    const id = context.context.account.accountId;
    assert.equal(context.context.admittedSources.length, index === 0 ? 10 : 9);
    const states: C3PageState[] = [{page:'home'}, ...(['initiatives','people','technology','sources'] as const).map(topic => ({page:'research' as const,topic})), {page:'workshop'}, {page:'prepare',request}];
    for (const state of states) {
      const page = renderC3Page(context, {...state,work:emptyWork,generation:{available:false,explanation:index === 0 ? 'Generation unavailable. No configured model provider.' : 'Preparation held pending the recorded C2 revision.'}}, 'account-csrf', undefined, {accountId:id,accounts});
      const html = markup(page);
      assert.match(html, /Switch account/);
      assert.ok(html.includes(`name="c3-account" content="${id}"`));
      assert.ok(html.includes(`name="c3-account-path" content="/accounts/${id}"`));
      for (const href of html.matchAll(/href="(\/[^"<>]*)"/gu)) assert.ok(href[1]!.startsWith('/accounts/'), href[1]);
      assert.ok(html.includes(`href="/accounts/${id}/?view=workshop"`));
      assert.match(main(page), state.page === 'home' ? new RegExp(`<h1>${context.context.account.accountName}</h1>`) : /<main/);
      const other = contexts[1-index]!;
      for (const source of other.context.admittedSources) {
        assert.ok(!main(page).includes(esc(source.fullBoundedCleanText)), 'No opposite-account source text');
        assert.ok(!html.includes(`data-source-id="${source.sourceId}"`));
      }
      for (const citation of html.matchAll(/data-evidence-link[^>]+href="#([^"]+)"/gu)) assert.ok(html.includes(`id="${citation[1]}"`), citation[1]);
      const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map(match => match[1]);
      assert.equal(ids.length, new Set(ids).size, 'Unique evidence and return IDs');
      assert.doesNotMatch(html, /(?:src|poster)="https?:|@import|url\(\s*['"]?https?:/u);
      if (index === 1) assert.doesNotMatch(main(page), /campus-concept|Redtail|UHAIV|Huntsman/);
      if (state.page === 'prepare') {
        assert.match(html, /data-generation-available="false"/);
        assert.match(html, /<input id="audience" name="audience" required/);
        assert.doesNotMatch(html, /<input id="audience"[^>]+disabled/);
      }
    }
    const home = main(renderC3Page(context,{page:'home',work:emptyWork},'test'));
    assert.match(home,/No saved briefs for this account/);
    if (index === 0) {
      assert.match(home,/src="\/assets\/campus-concept.png"/);
      assert.match(home,/Campus illustration · not a documented photograph/);
      assert.equal(projectAccount(context).retainedSections.length,0);
    } else {
      assert.match(home,/Retained proposal context/);
      assert.equal(projectAccount(context).readings.length,0,'No invented matched dossier set');
    }
    const sources = markup(renderC3Page(context,{page:'research',topic:'sources'},'test'));
    for (const source of context.context.admittedSources) {
      assert.ok(sources.includes(esc(source.fullBoundedCleanText)));
      for (const excerpt of source.excerpts) assert.ok(sources.includes(`<blockquote>${esc(excerpt.exactExcerpt)}</blockquote>`));
    }
    assert.equal(JSON.stringify(context),before);
    assert.equal(hash(context.canonicalJson),context.sha256);
  }
});

test('B2 generic retained sections preserve exact proposal text/status and fail closed on missing or changed support', async () => {
  const context = await contextFor('acc_fedex_corp');
  const projection = projectAccount(context);
  assert.ok(projection.retainedSections.length > 0);
  const original = [...context.context.proposal.establishedContext,...context.context.proposal.meaningfullyChanged,...context.context.proposal.whyChangeMayMatter,...context.context.proposal.stillOpenQuestions];
  const html = main(renderC3Page(context,{page:'research',topic:'initiatives'},'test'));
  for (const item of projection.retainedSections) {
    assert.ok(original.some(record => record.text === item.text && record.state === item.state && JSON.stringify(record.evidenceIds) === JSON.stringify(item.evidenceIds)));
    assert.ok(html.includes(esc(item.text)));
    assert.ok(html.includes(esc(item.state)));
  }
  assert.match(html,/do not establish change since an earlier review/);
  for (const admittedSources of [[],context.context.admittedSources.map(source=>({...source,excerpts:source.excerpts.map(excerpt=>({...excerpt,exactExcerpt:'changed'}))}))]) {
    const changed = {...context,context:{...context.context,admittedSources}};
    assert.deepEqual(projectAccount(changed).retainedSections,[]);
  }
});

test('B2 runtime capability labels and real saved library rows are shared by Overview and Workshop', async () => {
  const context = await contextFor('acc_university_of_utah');
  const savedWorks = [{documentId:'doc_1234567890abcdef12345678',version:2,audience:'Retained audience',title:'Exact saved title',intendedOutcome:'Exact retained outcome',origin:'historical-replay' as const}];
  for (const page of ['home','workshop'] as const) {
    const html = markup(renderC3Page(context,{...(page === 'home' ? {page} : {page}),work:{...emptyWork,savedWorks}},'test'));
    assert.match(html,/data-reopen-work="doc_1234567890abcdef12345678"/);
    assert.match(html,/data-work-list-status role="status"/);
    assert.match(html,/>Exact saved title<\/button>/);
    assert.match(html,/Exact retained outcome/);
    assert.doesNotMatch(html,/No saved briefs/);
    assert.match(html,/<a class="button" href="\/\?prepare=1">Set up brief<\/a>/);
  }
  for (const available of [false,true]) {
    const html = markup(renderC3Page(context,{page:'prepare',request,generation:{available,explanation:available?'Configured provider route.':'Provider unavailable.'}},'test'));
    assert.ok(html.includes(`data-generation-available="${available}"`));
    assert.ok(html.includes(available ? '<button type="submit">Prepare brief</button>' : '<button type="submit" disabled hidden>Prepare brief</button>'));
  }
  const replay = markup(renderC3Page(context,{page:'prepare',request,generation:{available:true,explanation:'Historical replay only.'}},'test',{initialRequest:request,correctionNote:'Exact correction'}));
  assert.match(replay,/Replay exact recorded response/);
  assert.match(replay,/Edited inputs are refused; no live provider will be called/);
});

test('B2 Brief, Notes and Revision retain exact records, original/support bytes, explicit Apply and Save', () => {
  const context = syntheticWorkshopContext();
  const record = createGenerationRecord(createC3ModelRequest(context,request,null,'5'),syntheticMeetingCandidate(context),context);
  const note = '  Exact note <with> & spacing\nSecond line.  ';
  const sectionNotes = {Opening:' Original section note\n<unchanged> & exact. '};
  const before = JSON.stringify({record,context,note,sectionNotes});
  const html = markup(renderC3Page(context,{page:'draft',record,correctionNote:note,sectionNotes,work:{...emptyWork,documentId:'doc_123',workVersion:3},generation:{available:true,explanation:'Configured provider route.'}},'test'));
  for (const item of [record.draft!.opening,record.draft!.audienceThesis,record.draft!.objective,record.draft!.closeCriterion,...record.draft!.risksUnknowns]) assert.ok(html.includes(esc(item.text)));
  assert.ok(html.includes(esc(note)));
  assert.ok(html.includes(esc(sectionNotes.Opening)));
  assert.ok(html.includes(`data-revision-original>${esc(record.draft!.opening.text)}</p>`));
  assert.match(html,/data-apply-revision disabled>Apply revision/);
  assert.match(html,/data-save-work>Save/);
  assert.match(html,/Use Save to retain the brief and notes across restart/);
  for (const id of record.draft!.selectedEvidenceRefs) {
    const excerpt = context.context.admittedSources.flatMap(s=>s.excerpts).find(e=>e.evidenceId===id)!;
    assert.ok(html.includes(`<blockquote>${esc(excerpt.exactExcerpt)}</blockquote>`));
  }
  assert.equal(JSON.stringify({record,context,note,sectionNotes}),before);
});

test('B2 approved local art bytes, neutral palette and mobile reachability contracts', async () => {
  const assetHash = '1c408f7baa31b2537cdc3aa54fb6fdf0a087a3574a9a314a807b1f0d0fea2618';
  assert.equal(hash(await readFile('src/c3/assets/campus-concept.png')),assetHash);
  assert.equal(hash(await readFile('dist/c3/assets/campus-concept.png')),assetHash,'Build carries the identical local asset');
  assert.doesNotMatch(WORKSPACE_CSS,/#6652c6|#5542b2|#efecfa|violet|@import|https?:/i);
  for (const token of ['--atl-canvas: #faf9f7','--atl-accent: #272731','--atl-sidebar: 0px','--atl-warning-soft: #ffb981']) assert.ok(WORKSPACE_CSS.includes(token));
  assert.match(WORKSPACE_CSS,/priority-tile\[data-detail-target="detail-redtail-access"\] \.reading-limit\{[^}]+background:var\(--atl-warning-soft\)/);
  assert.match(WORKSPACE_CSS,/@media\(max-width:700px\)/);
  assert.match(WORKSPACE_CSS,/\.workspace-header \.workspace-nav\{order:4;display:grid;width:100%/);
  assert.match(WORKSPACE_CSS,/\.account-readout.has-illustration\{grid-template-columns:minmax\(0,1fr\);gap:12px/);
  assert.match(WORKSPACE_CSS,/safe-area-inset-bottom/);
  assert.match(WORKSPACE_CSS,/focus-visible/);
  // These are static reachability contracts, not browser geometry/keyboard execution claims.
});
