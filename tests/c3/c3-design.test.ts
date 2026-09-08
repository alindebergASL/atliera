import assert from "node:assert/strict";
import test from "node:test";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { loadCuratedC3Context } from "../../src/c3/curated-context.ts";
import { renderC3Page } from "../../src/c3/render.ts";
const request = { audience: "CIO", intendedOutcome: "Learn priorities", durationMinutes: 30 as const, meetingDate: "2026-09-12" };
const load = () => loadC3AccountContext({ broadInputPath: "fixtures/account-intelligence/c2-01/broad-account-research-input.json", proposalPath: "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json", ownerDecisionPath: "docs/decisions/c2-owner-disposition-record.json", accountId: "acc_university_of_utah" });
const main = (html: string) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
test("Account leads with organization and substantive topics without requiring a meeting", async () => {
  const context = await load();
  const html = main(renderC3Page(context, { page: "home" }, "test"));
  assert.ok(html.includes("<h1>University of Utah</h1>"), "Account identity should lead instead of What to explore");
  assert.match(html, />Prepare for…<\/a>/);
  assert.match(html, /aria-label="Account topics"/);
  for (const topic of ["Priorities &amp; initiatives", "People &amp; operating context", "Technology &amp; services", "Discoveries &amp; timing", "Opportunity hypotheses", "Worth understanding"]) assert.ok(html.includes(topic), topic);
  assert.match(html, /Open research/);
  assert.match(html, /No earlier account review to compare/);
  assert.doesNotMatch(html, /class="account-overview"/);
});
test("Prepare keeps primary inputs ahead of secondary options and carries account context", async () => {
  const context = await load();
  const html = main(renderC3Page(context, { page: "prepare", request }, "test"));
  assert.match(html, /for="audience">Who is this for\?/);
  assert.match(html, /for="outcome">What outcome do you want\?/);
  assert.match(html, /<details class="meeting-options"><summary>More options · <span data-options-summary>2026-09-12 · 30 minutes<\/span><\/summary>/);
  assert.match(html, /Context for this brief/);
  assert.ok(html.indexOf('id="audience"') < html.indexOf('class="brief-context"'));
  assert.match(html, />Prepare brief<\/button>/);
  assert.ok((html.match(/data-context="brief anchor/g) ?? []).length <= 3);
});
test("Missouri preparation remains unavailable and includes exact account context", async () => {
  const context = await loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri");
  const html = main(renderC3Page(context, { page: "prepare", request }, "test"));
  assert.match(html, /no model-generated meeting draft or recording is available/);
  assert.match(html, /Context for this brief/);
  assert.match(html, /Open strategy template/);
  assert.doesNotMatch(html, /data-generate/);
});

const escapeHtml = (value: string) => value.replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
test("Account keeps one optional Prepare action early and retains the original proposal separately", async () => {
  for (const context of [await load(), await loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri")]) {
    const html = main(renderC3Page(context, { page: "home" }, "test"));
    const hero = html.slice(html.indexOf('class="account-hero"'), html.indexOf('id="account-topics"'));
    assert.equal((hero.match(/>Prepare for…<\/a>/g) ?? []).length, 1);
    assert.ok(!/Proposed next action|Who is this for|What outcome do you want/.test(hero), "Account opening must stand alone without meeting advice");
    assert.ok(html.includes(escapeHtml(context.context.proposal.accountThesis.text)));
    assert.ok(html.includes(escapeHtml(context.context.proposal.recommendedNextMove.text)));
    assert.ok(html.indexOf('>Prepare for…</a>') < html.indexOf('id="account-priorities"'));
  }
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
    assert.ok(html.includes(`<blockquote>${escapeHtml(evidence[index]!.exactExcerpt)}</blockquote>`));
    assert.ok(html.includes(`href="#evidence-${index + 1}"`));
  }
  const direct = { ...context, context: { ...context.context, proposal: { ...context.context.proposal, accountThesis: { ...context.context.proposal.accountThesis, state: 'source-backed fact' as const } } } };
  assert.match(briefContext(direct), /Direct supporting evidence/);
});
test("Account preserves exact evidence and source identity in shared research inspection", async () => {
  for (const context of [await load(), await loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri")]) {
    const html = main(renderC3Page(context, { page: "home" }, "test"));
    assert.ok(html.includes("<dialog data-evidence-dialog"), "Account evidence should use the working modal");
    assert.match(html, /id="account-research"/);
    for (const source of context.context.admittedSources) {
      assert.ok(html.includes(`data-source-id="${source.sourceId}"`));
      assert.ok(html.includes(escapeHtml(source.fullBoundedCleanText)));
      for (const excerpt of source.excerpts) assert.ok(html.includes(`<blockquote>${escapeHtml(excerpt.exactExcerpt)}</blockquote>`), excerpt.evidenceId);
    }
    assert.doesNotMatch(html, /Last active|Engagement score|New this week|Changed since your last visit/);
  }
});

test("Shared Account reading covers initiative scope and specific unknowns for Utah and Missouri", async () => {
  const utah = main(renderC3Page(await load(), { page: "home" }, "test"));
  for (const text of ["Responsible AI workforce", "Strategic reinvestment", "Redtail", "HPE", "NVIDIA", "CHPC", "Health AI Vault", "sponsored awards", "current service catalog", "data-access", "Source summary · unreviewed"]) assert.ok(utah.includes(text), text);
  const missouriContext = await loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri");
  const missouri = main(renderC3Page(missouriContext, { page: "home" }, "test"));
  for (const text of ["Student success", "Research &amp; scholarship", "MizzouForward", "UM System", "Mun Choi", "Exact source context · unreviewed", "current service catalog", "September 2024"]) assert.ok(missouri.includes(text), text);
  const renamed = { ...missouriContext, context: { ...missouriContext.context, account: { ...missouriContext.context.account, accountName: "Renamed account" } } };
  const renamedHtml = main(renderC3Page(renamed, { page: "home" }, "test"));
  assert.match(renamedHtml, /<h1>Renamed account<\/h1>/);
  assert.ok(renamedHtml.includes("MizzouForward"));
  assert.doesNotMatch(missouri, /Stanford|Account score|data-generate/);
});
