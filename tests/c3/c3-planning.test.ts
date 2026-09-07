import assert from "node:assert/strict";
import test from "node:test";
import { newPlanningBrief, updatePlanningBrief } from "../../src/c3/planning.ts";
import { businessGapLabel } from "../../src/c3/planning-render.ts";
import { renderC3Page, type C3PageState } from "../../src/c3/render.ts";
import { createC3ModelRequest, createGenerationRecord } from "../../src/c3/draft.ts";
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate, syntheticCorrection } from "../fixtures/c3-workshop.ts";

const escaped = (text: string) => text.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Inspect initial disclosure state, not browser layout. Summaries remain visible when details are closed.
function closedView(html: string): string {
  const stack: boolean[] = [];
  let summary = false;
  return (html.match(/<[^>]+>|[^<]+/gu) ?? []).filter((token) => {
    if (/^<details\b/u.test(token)) { stack.push(/\sopen(?:[\s=>])/u.test(token)); return false; }
    if (token === "</details>") { stack.pop(); return false; }
    if (/^<summary\b/u.test(token)) { summary = true; return false; }
    if (token === "</summary>") { summary = false; return false; }
    return !token.startsWith("<") && (summary ? stack.slice(0, -1) : stack).every(Boolean);
  }).join(" ");
}

test("preview provenance is one compact disclosure and draft navigation appears only with a draft", () => {
  const ctx = syntheticWorkshopContext();
  const record = createGenerationRecord(createC3ModelRequest(ctx, syntheticMeetingRequest), syntheticMeetingCandidate(ctx), ctx);
  const states: C3PageState[] = [{ page: "home" }, { page: "prepare", request: syntheticMeetingRequest },
    { page: "planning", brief: newPlanningBrief("strategy") }, { page: "planning", brief: newPlanningBrief("next-steps") },
    { page: "draft", record, correctionNote: "" }];
  for (const state of states) {
    const html = renderC3Page(ctx, state, "test-csrf", { syntheticPreview: true, initialRequest: syntheticMeetingRequest, correctionNote: syntheticCorrection });
    const body = html.slice(html.indexOf("<body>"), html.indexOf("<script>"));
    assert.equal((body.match(/class="recorded-mode"/gu) ?? []).length, 1);
    assert.match(body, /<details class="recorded-mode"><summary>Synthetic local preview · Session-only<\/summary>/);
    assert.match(body, /Hand-authored fixtures · No AI recordings/);
    assert.doesNotMatch(closedView(body), /Every meeting response|server restart loses/);
    const navigation = body.match(/<nav class="journey-nav"[\s\S]*?<\/nav>/u)![0];
    assert.equal(navigation.includes("Meeting draft"), state.page === "draft");
    assert.doesNotMatch(body, /as of /iu);
  }
  assert.match(renderC3Page(ctx, { page: "home", hasDraft: true }, "test-csrf"), /href="\/\?draft=1">Meeting draft<\/a>/);
});

test("account overview precedes gaps; business labels disclose every exact raw gap", () => {
  const ctx = syntheticWorkshopContext();
  const html = renderC3Page(ctx, { page: "home" }, "test-csrf");
  const main = html.match(/<main\b[\s\S]*?<\/main>/u)![0];
  const visible = closedView(main);
  assert.ok(main.indexOf("Overall account context") < main.indexOf("Still to establish"));
  assert.ok(visible.includes(escaped(ctx.context.proposal.establishedContext[0]!.text)));
  assert.match(visible, /Strategic direction not established in supplied evidence/);
  assert.doesNotMatch(visible, /controller-authorized|taxonomy:/);
  for (const raw of ctx.context.materialGaps) assert.ok(main.includes(`<p>${escaped(raw)}</p>`));
  assert.match(main, /<details class="technical-detail"><summary>Raw gap and conflict details/);
  assert.match(visible, /Context requested .*request date, not evidence of freshness/);
  assert.equal(businessGapLabel("Unexpected category: preserve this exact detail."), "Unexpected category: preserve this exact detail.");
});

test("planning keeps exact account-specific context beside purpose work with direct evidence access", () => {
  for (const account of ["harbor", "cedar"] as const) for (const kind of ["strategy", "next-steps"] as const) {
    const ctx = syntheticWorkshopContext(account);
    const before = JSON.stringify(ctx);
    const brief = updatePlanningBrief(newPlanningBrief(kind), { version: 0, audience: "Operations lead", intendedOutcome: "Choose a validation priority", detail: "This quarter" }).brief;
    const html = renderC3Page(ctx, { page: "planning", brief }, "test-csrf");
    const main = html.match(/<main\b[\s\S]*?<\/main>/u)![0];
    const visible = closedView(main);
    const work = main.match(/<aside class="work-context"[\s\S]*?<\/aside>/u)![0];
    const exact = kind === "strategy" ? ctx.context.proposal.meaningfullyChanged[0]! : ctx.context.proposal.establishedContext[0]!;
    assert.ok(work.includes(escaped(exact.text)), "working context includes an exact supplied account fact");
    assert.ok(work.includes(escaped(ctx.context.proposal.accountThesis.text)));
    assert.match(work, /Proposed · evidence-informed interpretation/);
    assert.match(work, /Proposed · source-backed fact/);
    assert.match(visible, /Operations lead · Choose a validation priority/);
    assert.match(visible, /Open gap:/);
    assert.doesNotMatch(visible, /controller-authorized|taxonomy:|Full retained source context/);
    assert.ok(main.indexOf(work) < main.indexOf(`>${brief.sections[0]!.title}</h2>`));
    assert.doesNotMatch(main, account === "harbor" ? /Cedar Works/ : /Harbor Transit/);
    for (const link of work.matchAll(/href="#(evidence-\d+)"/gu)) {
      assert.ok(main.includes(`<details id="${link[1]}">`));
    }
    const ids = [...main.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]!);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => !/\s/u.test(id)));
    for (const source of ctx.context.admittedSources) {
      assert.ok(main.includes(escaped(source.fullBoundedCleanText)));
      for (const excerpt of source.excerpts) assert.ok(main.includes(escaped(excerpt.exactExcerpt)));
    }
    assert.equal(JSON.stringify(ctx), before, "rendering leaves admitted data and identity unchanged");
  }
});

test("sparse and conflicting context stays visible with all disclosures closed", () => {
  for (const mode of ["sparse", "conflict"] as const) {
    const ctx = syntheticWorkshopContext("harbor", mode);
    for (const state of [{ page: "home" }, ...(["strategy", "next-steps"] as const).map((kind) => ({ page: "planning", brief: newPlanningBrief(kind) }))] as C3PageState[]) {
      const html = renderC3Page(ctx, state, "test-csrf");
      const visible = closedView(html.match(/<main\b[\s\S]*?<\/main>/u)![0]);
      assert.match(visible, mode === "sparse" ? /No admitted sources/ : /Conflicting context/);
      if (mode === "conflict") for (const conflict of ctx.context.declaredContradictions) assert.ok(visible.includes(escaped(conflict)));
    }
  }
});

test("planning kinds have useful distinct sections and isolated session edits", () => {
  const strategy = newPlanningBrief("strategy");
  const steps = newPlanningBrief("next-steps");
  assert.deepEqual(strategy.sections.map((s) => s.id), ["direction", "options", "decision"]);
  assert.deepEqual(steps.sections.map((s) => s.id), ["actions", "owners", "checkpoint"]);
  const edited = updatePlanningBrief(strategy, { version: 0, section: "options", text: "Compare a pilot with waiting for evidence." });
  assert.equal(edited.brief.version, 1);
  assert.equal(steps.version, 0);
  assert.equal(edited.brief.sections[1]!.authorship, "user");
  assert.equal(updatePlanningBrief(edited.brief, { version: 1, section: "options", text: edited.brief.sections[1]!.text }).noChange, true);
  assert.throws(() => updatePlanningBrief(edited.brief, { version: 0, section: "options", text: "stale" }), /stale/);
  assert.throws(() => updatePlanningBrief(strategy, { version: 0, section: "actions", text: "wrong kind" }), /section/);
  assert.equal(updatePlanningBrief(edited.brief, { version: 1, section: "options", text: "" }).brief.sections[1]!.text, "");
});

test("setup changes preserve authored sections and reject unbounded or foreign state", () => {
  const brief = newPlanningBrief("strategy");
  const edited = updatePlanningBrief(brief, { version: 0, section: "direction", text: "Local strategy" }).brief;
  const setup = updatePlanningBrief(edited, { version: 1, audience: "CIO", intendedOutcome: "Choose an investigation", detail: "Next quarter" }).brief;
  assert.equal(setup.sections[0]!.text, "Local strategy");
  assert.equal(setup.audience, "CIO");
  assert.throws(() => updatePlanningBrief(setup, { version: 2, audience: "", intendedOutcome: "x", detail: "" }));
  assert.throws(() => updatePlanningBrief(setup, { version: 2, section: "direction", text: "x".repeat(4001) }));
  assert.throws(() => updatePlanningBrief(setup, { version: 2, section: "direction", text: "safe", approved: true }));
});

test("proposed next step is exact, bounded, account-evidenced and uses the brief version", () => {
  const brief = newPlanningBrief("next-steps");
  const proposal = { concern: "\nExact concern ", action: "Keep raw provenance replacement phrases", owner: "", targetDate: "", questionOrBlocker: "", evidenceIds: ["known"] };
  const kept = updatePlanningBrief(brief, { version: 0, proposedNextStep: proposal }, ["known"]).brief;
  assert.deepEqual(kept.proposedNextStep, proposal);
  assert.equal(kept.version, 1);
  const proseEdit = updatePlanningBrief(kept, { version: 1, section: "actions", text: "Additional planning" }).brief;
  assert.deepEqual(proseEdit.proposedNextStep, proposal);
  assert.equal(proseEdit.version, 2);
  assert.equal(updatePlanningBrief(kept, { version: 1, proposedNextStep: proposal }, ["known"]).noChange, true);
  assert.throws(() => updatePlanningBrief(kept, { version: 0, proposedNextStep: proposal }, ["known"]), /stale/);
  assert.throws(() => updatePlanningBrief(newPlanningBrief("strategy"), { version: 0, proposedNextStep: proposal }, ["known"]));
  for (const delta of [{ concern: " " }, { action: "" }, { action: "x".repeat(4001) }, { concern: "x".repeat(2001) }, { owner: "x".repeat(161) }, { questionOrBlocker: "x".repeat(2001) }, { action: "bad\u0000text" }, { targetDate: "2026-02-29" }, { targetDate: "2026-9-01" }, { evidenceIds: ["foreign"] }, { evidenceIds: ["https://example.test"] }, { evidenceIds: ["known", "known"] }, { approved: true }]) {
    assert.throws(() => updatePlanningBrief(brief, { version: 0, proposedNextStep: { ...proposal, ...delta } }, ["known"]));
  }
  assert.equal(updatePlanningBrief(brief, { version: 0, proposedNextStep: { ...proposal, targetDate: "2028-02-29" } }, ["known"]).brief.proposedNextStep?.targetDate, "2028-02-29");
});

test("proposed form preserves exact provenance phrases and keeps suggestion separate and before context", () => {
  const ctx = syntheticWorkshopContext();
  const text = '\nAdmitted public context | Proposed and unreviewed local content. <exact> & "quoted"';
  const proposal = { concern: text, action: text, owner: "", targetDate: "", questionOrBlocker: text, evidenceIds: [ctx.context.admittedSources[0]!.excerpts[0]!.evidenceId] };
  const brief = updatePlanningBrief(newPlanningBrief("next-steps"), { version: 0, proposedNextStep: proposal }, proposal.evidenceIds).brief;
  const page = renderC3Page(ctx, { page: "planning", brief, strategySuggestion: { id: "decision", title: "Decision", text: "Separate read-only suggestion", authorship: "user" } }, "test");
  for (const field of ["concern", "action", "questionOrBlocker"]) assert.ok(page.includes(`name="${field}" maxlength="${field === "action" ? 4000 : 2000}"${field === "questionOrBlocker" ? "" : " required"}>\n${escaped(text)}</textarea>`));
  assert.match(page, /not an accepted decision/);
  assert.match(page, /data-proposed-value="owner">Unassigned/);
  assert.ok(page.indexOf('data-proposed-next-step') < page.indexOf('class="work-context"'));
  assert.doesNotMatch(page.match(/<form data-local-edit data-proposed-next-step[\s\S]*?<\/form>/)![0], /Separate read-only suggestion/);
});
