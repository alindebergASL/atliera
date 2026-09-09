import assert from 'node:assert/strict';
import test from 'node:test';
import { loadC3AccountContext } from '../../src/c3/context.ts';
import { loadCuratedC3Context } from '../../src/c3/curated-context.ts';
import { projectAccount } from '../../src/c3/account-projection.ts';
import { renderC3Page, type WorkDisplayState } from '../../src/c3/render.ts';
import { createC3ModelRequest, createGenerationRecord } from '../../src/c3/draft.ts';
import { syntheticWorkshopContext, syntheticMeetingCandidate, syntheticMeetingRequest } from '../fixtures/c3-workshop.ts';
const utah = () => loadC3AccountContext({ broadInputPath:'fixtures/account-intelligence/c2-01/broad-account-research-input.json', proposalPath:'docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json', ownerDecisionPath:'docs/decisions/c2-owner-disposition-record.json', accountId:'acc_university_of_utah' });
const main = (html:string) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const esc = (text:string) => text.replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const ctx = syntheticWorkshopContext();
const request = {...syntheticMeetingRequest,intendedOutcome:'Understand research priorities and agree a useful next step for the university'};
const record = createGenerationRecord(createC3ModelRequest(ctx,request),syntheticMeetingCandidate(ctx),ctx);
const work:WorkDisplayState = {available:true,documentId:'doc_'+'1'.repeat(24),version:1,workVersion:1,saved:true,title:request.intendedOutcome,origin:'historical-replay',savedWorks:[]};

test('expanded Detail organizes retained specifics across two accounts; Evidence keeps the entire original quotation',async()=>{
  const contexts = [await utah(),await loadCuratedC3Context('fixtures/account-intelligence/c3-curated/missouri.json','acc_university_of_missouri')];
  for(const context of contexts){
    const before=JSON.stringify(context);
    const projection=projectAccount(context);
    const expanded=projection.details.filter(detail=>detail.sections.some(section=>section.summary));
    assert.ok(expanded.length >= 2,'Expansion is not a single-subject demonstration');
    const html=renderC3Page(context,{page:'home'},'offline');
    for(const detail of expanded){
      for(const section of detail.sections.filter(section=>section.summary)){
        assert.notEqual(section.summary,section.exactText);
        assert.ok(html.includes(`<p>${esc(section.summary!)}</p>`));
        const source=context.context.admittedSources.find(source=>source.sourceId===section.sourceId)!;
        const excerpt=source.excerpts.find(excerpt=>excerpt.evidenceId===section.evidenceId)!;
        assert.ok(html.includes(`<blockquote>${esc(excerpt.exactExcerpt)}</blockquote>`));
      }
    }
    assert.equal(JSON.stringify(context),before,'Rendering cannot alter source bytes or admission');
    assert.doesNotMatch(main(html),/Cedar University|data-generate/);
  }
});

test('content review fixes retain cited evidence, distinguish amounts and report used detail sources',async()=>{
 const u=projectAccount(await utah());
 for(const detail of u.details) for(const section of detail.sections) assert.ok(!u.unmatchedSourceIds.includes(section.sourceId));
 assert.ok(u.details.find(d=>d.readingId==='strategic-reinvestment')!.sections.some(s=>s.evidenceId==='evidence_57ea55e4883fc4627b20'));
 assert.match(u.details.find(d=>d.readingId==='redtail-platform')!.sections.map(s=>s.summary).join(' '),/does not establish that these are separate amounts/);
 assert.match(u.details.find(d=>d.readingId==='strategic-reinvestment')!.sections.map(s=>s.summary).join(' '),/USHE requires degree-granting institutions/);
 const m=projectAccount(await loadCuratedC3Context('fixtures/account-intelligence/c3-curated/missouri.json','acc_university_of_missouri'));
 assert.ok(m.details.find(d=>d.readingId==='research-infrastructure')!.sections.some(s=>s.evidenceId==='mu_evidence_4_1'));
 assert.match(m.readings.find(r=>r.id==='meaningful-engagement')!.limit!,/undated/);
 for(const p of [u,m]) for(const r of p.readings) assert.doesNotMatch(r.question||'',/the current service catalog/);
});

test('expanded summaries fail closed when supplemental evidence changes while the base subject remains',async()=>{
 const context=await utah();
 const changed={...context,context:{...context.context,admittedSources:context.context.admittedSources.map(source=>({...source,excerpts:source.excerpts.map(excerpt=>excerpt.evidenceId==='evidence_ea94995bdcd28e1409d3'?{...excerpt,exactExcerpt:'Changed supplemental scope'}:excerpt)}))}};
 const detail=projectAccount(changed).details.find(detail=>detail.readingId==='redtail-access')!;
 assert.ok(detail,'Other exact evidence still supports this subject');
 assert.ok(!detail.sections.some(section=>section.evidenceId==='evidence_ea94995bdcd28e1409d3'),'Changed evidence cannot activate an authored summary');
});

test('short public role research offers one Detail entry and discloses its limited evidence',async()=>{
 const context=await utah();const html=main(renderC3Page(context,{page:'research',topic:'people'},'offline'));
 const entry=html.match(/<article class="research-inspection-entry"><h3>Jake Johansen<\/h3>[\s\S]*?<\/article>/)![0];
 assert.equal((entry.match(/data-detail-link/g)||[]).length,1);assert.doesNotMatch(entry,/Inspect source|Inspect exact excerpt/);
 assert.match(html,/Only a short public passage is retained for this subject/);
 assert.match(html,/Source-reported role<\/h3><p>Chief Information Officer \(interim\)/);
 assert.match(html,/<blockquote>Jake Johansen\nChief Information Officer \(interim\)<\/blockquote>/);
});

test('concise legacy title is display-only and the full outcome and original title remain editable',()=>{
 const before=JSON.stringify(record);
 const html=main(renderC3Page(ctx,{page:'draft',record,correctionNote:'Exact note',work},'offline'));
 assert.match(html,/<h1 data-work-title>Understand research priorities<\/h1>/);
 assert.match(html,/<summary>Document details<\/summary>/);
 assert.ok(html.includes(`value="${request.intendedOutcome}"`));
 assert.ok(html.includes(`Intended outcome: ${request.intendedOutcome}`));
 assert.match(html,/Last-saved time was not recorded/);
 assert.doesNotMatch(html,/>Close<\/h2>|Workshop \/ Meeting brief/);
 assert.equal(JSON.stringify(record),before);
 const explicit=main(renderC3Page(ctx,{page:'draft',record,correctionNote:'',work:{...work,title:'Explicit user title, retained exactly even when deliberately longer than the suggested title'}},'offline'));
 assert.ok(explicit.includes('Explicit user title, retained exactly even when deliberately longer than the suggested title</h1>'));
});

test('saved current work has one open entry; unsaved work explains its relationship and legacy records have honest identifiers',()=>{
 const savedWorks=[{documentId:work.documentId,version:1,audience:'CIO',title:request.intendedOutcome,intendedOutcome:request.intendedOutcome,origin:'historical-replay' as const}, {documentId:'doc_'+'2'.repeat(24),version:1,audience:'CIO',title:request.intendedOutcome,intendedOutcome:request.intendedOutcome,origin:'historical-replay' as const}];
 const html=main(renderC3Page(ctx,{page:'workshop',hasDraft:true,work:{...work,savedWorks}},'offline'));
 assert.equal((html.match(/data-current-work="true"/g)||[]).length,1);
 assert.match(html,/<a class="saved-title" href="\/\?draft=1">Understand research priorities<\/a>/);
 assert.doesNotMatch(html,/Continue working|Last-saved time not available/);
 assert.match(html,/Record 11111111/);assert.match(html,/Record 22222222/);
 assert.match(html,/Historical replay/);assert.ok(html.includes(request.intendedOutcome));
 const dirty=main(renderC3Page(ctx,{page:'workshop',hasDraft:true,work:{...work,saved:false,savedWorks}},'offline'));
 assert.match(dirty,/Unsaved changes to the saved brief below/);assert.match(dirty,/Current session has unsaved changes/);
 assert.match(dirty,/data-replaces-unsaved="true"/);
});

test('fixed replay instruction is read-only and disclosed before execution; fresh revision remains editable',()=>{
 const state={page:'draft' as const,record,correctionNote:'Exact separate note',instruction:'Previously kept instruction',work,generation:{available:true,explanation:'Isolated fixture'}};
 const replay=main(renderC3Page(ctx,state,'offline',{correctionNote:'Fixed retained instruction',initialRequest:request,syntheticPreview:true}));
 assert.match(replay,/<textarea[^>]+data-revision-instruction[^>]+readonly aria-describedby="replay-instruction-help"/);
 assert.match(replay,/only the fixed recorded instruction below has a response/);
 assert.ok(replay.indexOf('only the fixed recorded instruction')<replay.indexOf('data-revise'));
 assert.match(replay,/data-recorded-note>Fixed retained instruction<\/pre>/);
 assert.match(replay,/Previously kept instruction<\/textarea>/,'Do not silently overwrite previously kept input');
 const fresh=main(renderC3Page(ctx,state,'offline'));
 assert.doesNotMatch(fresh,/<textarea[^>]+data-revision-instruction[^>]+readonly/);
 assert.match(fresh,/data-original-sections=/);assert.match(fresh,/data-original-heading/);
 assert.ok(fresh.indexOf('Your instruction')<fresh.indexOf('data-original-preview'));
});

test('a newer saved version of the same document is not presented as the current displayed version',()=>{
 const html=main(renderC3Page(ctx,{page:'workshop',hasDraft:true,work:{...work,savedWorks:[{documentId:work.documentId,version:2,audience:'CIO',title:'Newer stored title',origin:'historical-replay'}]}},'offline'));
 assert.match(html,/Current session shows saved version 1/);
 assert.match(html,/Current session is based on saved version 1/);
 assert.match(html,/<button[^>]+data-reopen-work=/);
 assert.doesNotMatch(html,/<a class="saved-title" href="\/\?draft=1"/,'Newer saved row must reopen the actual stored version');
});
