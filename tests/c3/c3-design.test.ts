import assert from "node:assert/strict";
import test from "node:test";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { loadCuratedC3Context } from "../../src/c3/curated-context.ts";
import { renderC3Page } from "../../src/c3/render.ts";
const request = { audience: "CIO", intendedOutcome: "Learn priorities", durationMinutes: 30 as const, meetingDate: "2026-09-12" };
const load = () => loadC3AccountContext({ broadInputPath: "fixtures/account-intelligence/c2-01/broad-account-research-input.json", proposalPath: "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json", ownerDecisionPath: "docs/decisions/c2-owner-disposition-record.json", accountId: "acc_university_of_utah" });
const main = (html: string) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
test("Account leads with intact insight and action, with deliberate evidence exploration", async () => {
  const context = await load();
  const html = main(renderC3Page(context, { page: "home" }, "test"));
  assert.match(html, /<h1>What to explore<\/h1>/);
  assert.match(html, />Prepare for…<\/a>/);
  assert.ok(html.indexOf("Proposed next action") < html.indexOf("Full account context"));
  assert.match(html, /<details class="evidence-list"><summary>Sources used<\/summary>/);
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
test("Account CTA precedes lengthy action copy while retaining all understanding", async () => {
  for (const context of [await load(), await loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri")]) {
    const html = main(renderC3Page(context, { page: "home" }, "test"));
    const hero = html.slice(html.indexOf('class="account-hero"'), html.indexOf('</section>'));
    assert.equal((hero.match(/>Prepare for…<\/a>/g) ?? []).length, 1);
    assert.ok(hero.indexOf('>Prepare for…</a>') < hero.indexOf(escapeHtml(context.context.proposal.recommendedNextMove.text)));
    assert.ok(hero.includes(escapeHtml(context.context.proposal.accountThesis.text)));
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
test("Account secondary context uses useful labels and omits duplicate implications", async () => {
  for (const context of [await load(), await loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri")]) {
    const html = main(renderC3Page(context, { page: "home" }, "test"));
    const strip = html.match(/<section class="context-strip">(.*?)<\/section>/s)![1]!;
    assert.match(strip, /<strong>Sources used<\/strong>/);
    assert.doesNotMatch(strip, /Admitted|Agent-curated|\d+ material gaps?/);
    assert.ok((strip.match(/<div>/g) ?? []).length <= 3);
    if (context.context.proposal.whyChangeMayMatter[0]?.text === context.context.proposal.accountThesis.text) assert.doesNotMatch(html, /Why this is worth checking/);
  }
});
