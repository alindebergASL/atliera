import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadCuratedC3Context, parseCuratedC3Context } from "../../src/c3/curated-context.ts";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { createC3ModelRequest, createGenerationRecord, assertReplayIdentity } from "../../src/c3/draft.ts";
import { renderC3Page } from "../../src/c3/render.ts";
import { newPlanningBrief, updatePlanningBrief } from "../../src/c3/planning.ts";
import { startC3Server } from "../../src/c3/service.ts";
import { DisabledC3ModelProvider } from "../../src/c3/provider.ts";
const fixture = "fixtures/account-intelligence/c3-curated/missouri.json";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const input = async () => JSON.parse(await readFile(fixture, "utf8"));
const provenanceLiterals = [
  "Proposed and unreviewed local content.",
  "Admitted public context",
  "This orientation reuses admitted C2 evidence.",
  "and the C2 disposition does not approve generated C3 content",
  "Admitted entity relationships",
];
const collisionText = `${provenanceLiterals.join(" | ")} <exact> & "quoted" 'text'`;
const escapedCollisionText = `${provenanceLiterals.join(" | ")} &lt;exact&gt; &amp; &quot;quoted&quot; &#39;text&#39;`;
async function collisionContext() {
  // Synthetic copy only: keep the official fixture bytes untouched.
  const value = await input();
  const source = value.sources[0];
  source.text = `Retained prefix\n${collisionText}\nRetained suffix`;
  source.sha256 = sha(source.text);
  source.excerpts = [{ id: source.excerpts[0].id, text: collisionText }];
  value.statements = ["quote", "interpretation", "recommendation"].map(kind => ({
    kind, text: collisionText, entityId: source.entityId, evidenceIds: [source.excerpts[0].id],
  }));
  return parseCuratedC3Context(JSON.stringify(value), "acc_university_of_missouri");
}
function assertCuratedLabels(page: string) {
  assert.ok(page.includes("<p>Agent-curated proposed/template context. No human approval, owner disposition, policy admission or model recording. Owner and date unassigned. Session-only;"));
  assert.ok(page.includes('<p class="meta">Proposed entity relationships do not establish personal decision authority.</p>'));
}
test("curated labels preserve all provenance literals in exact source, excerpt and statement locations", async () => {
  const frozen = await collisionContext();
  for (const state of [{ page: "home" } as const, { page: "planning", brief: newPlanningBrief("strategy") } as const]) {
    const page = renderC3Page(frozen, state, "test");
    assert.ok(page.includes(`<blockquote>${escapedCollisionText}</blockquote>`), `${state.page}: exact excerpt`);
    assert.ok(page.includes(`<pre class="source-text" tabindex="0">Retained prefix\n${escapedCollisionText}\nRetained suffix</pre>`), `${state.page}: full source`);
    assert.ok(page.includes(`<article><p>${escapedCollisionText}</p><p class="support">`), `${state.page}: quoted statement`);
    assertCuratedLabels(page);
    if (state.page === "home") {
      assert.ok(page.includes(`<p class="lede">${escapedCollisionText}</p>`));
      assert.ok(page.includes('<strong>Sources used</strong>'));
      assert.ok(page.includes('<p class="boundary">This orientation uses agent-curated public excerpts, not admitted C2 evidence. It does not claim that the legacy “meaningfully changed” bucket proves temporal change, and no C2 owner disposition or generated C3 content exists.</p>'));
    }
  }
});
test("curated labels preserve provenance literals in saved planning setup and section text", async () => {
  const frozen = await collisionContext();
  for (const kind of ["strategy", "next-steps"] as const) {
    let brief = newPlanningBrief(kind);
    brief = updatePlanningBrief(brief, { version: brief.version, audience: provenanceLiterals[4], intendedOutcome: collisionText, detail: collisionText }).brief;
    brief = updatePlanningBrief(brief, { version: brief.version, section: brief.sections[0]!.id, text: collisionText }).brief;
    const page = renderC3Page(frozen, { page: "planning", brief }, "test");
    const textarea = (id: string) => new RegExp(`<textarea id="${id}"[^>]*>\\n([\\s\\S]*?)</textarea>`, "u").exec(page)?.[1];
    assert.equal(textarea("plan-audience"), provenanceLiterals[4]);
    assert.equal(textarea("plan-intendedOutcome"), escapedCollisionText);
    assert.equal(textarea("plan-detail"), escapedCollisionText);
    assert.equal(textarea(`plan-${brief.sections[0]!.id}`), escapedCollisionText);
    assert.ok(page.includes(`<p data-setup-summary>${provenanceLiterals[4]} · ${escapedCollisionText}</p>`));
    assert.ok(page.includes(`<p class="meta" data-detail-summary>${escapedCollisionText}</p>`));
    assert.ok(page.includes(`<p data-saved-copy class="user-copy">${escapedCollisionText}</p>`));
    assertCuratedLabels(page);
  }
});
test("curated Missouri retains exact evidence without owner, policy or model claims", async () => {
  const frozen = await loadCuratedC3Context(fixture, "acc_university_of_missouri");
  assert.equal(frozen.context.ownerDecisionSource, null);
  assert.equal(frozen.context.custody.policyReceipt, null);
  assert.deepEqual(frozen.context.ownerCorrections, []);
  assert.equal(frozen.context.admittedSources.length, 5);
  assert.equal(frozen.context.admittedSources.flatMap(s => s.excerpts).length, 13);
  for (const s of frozen.context.admittedSources) {
    assert.equal(sha(s.fullBoundedCleanText), s.retrievedContentSha256);
    assert.equal(s.publicationDate, null);
    for (const e of s.excerpts) {
      assert.equal(s.fullBoundedCleanText.slice(e.sourceCharStart, e.sourceCharEnd), e.exactExcerpt);
      assert.equal(sha(e.exactExcerpt), e.exactExcerptSha256);
    }
  }
  const page = renderC3Page(frozen, { page: "home" }, "test");
  assert.match(page, /Agent-curated/);
  assert.match(page, /UM System/);
  assert.doesNotMatch(page, /Admitted public context|reuses admitted C2 evidence/);
  const planning = renderC3Page(frozen, { page: "planning", brief: newPlanningBrief("strategy") }, "test");
  assert.match(planning, /not AI-generated/);
  assert.throws(() => createC3ModelRequest(frozen, {}), /curated/i);
  assert.throws(() => createGenerationRecord({} as never, "{}", frozen), /curated/i);
  assert.throws(() => assertReplayIdentity({} as never, frozen), /curated/i);
  const server = await startC3Server({ context: frozen, provider: new DisabledC3ModelProvider(), listen: false, expectedHost: "127.0.0.1:4317" });
  assert.equal(server.status().ownerDisposition, "absent");
  assert.equal(server.status().generationAttempted, 0);
  await server.close();
});
test("curated input refuses unknown keys, identities, altered bytes and mismatched scope/references", async () => {
  for (const mutate of [
    (v: any) => { v.approved = true; },
    (v: any) => { v.sources[0].sha256 = "0".repeat(64); },
    (v: any) => { v.sources[0].excerpts[0].text += " invented"; },
    (v: any) => { v.statements[0].evidenceIds = ["unknown"]; },
    (v: any) => { v.statements[0].entityId = "unknown"; },
    (v: any) => { v.statements[0].evidenceIds = [v.sources[4].excerpts[0].id]; },
    (v: any) => { v.sources[0].url = "javascript:alert(1)"; },
  ]) {
    const value = await input(); mutate(value);
    assert.throws(() => parseCuratedC3Context(JSON.stringify(value), "acc_university_of_missouri"));
  }
  await assert.rejects(loadCuratedC3Context(fixture, "unknown"));
});
test("Utah canonical identity remains byte-for-byte historical", async () => {
  const frozen = await loadC3AccountContext({ broadInputPath: "fixtures/account-intelligence/c2-01/broad-account-research-input.json", proposalPath: "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json", ownerDecisionPath: "docs/decisions/c2-owner-disposition-record.json", accountId: "acc_university_of_utah" });
  assert.equal(frozen.sha256, "f1947ebb32991cebfcc7ae713bb201fe1ced275be79efeae3f1e6bc660761a6f");
  assert.ok(!("provenance" in frozen.context));
  const page = renderC3Page(frozen, { page: "home" }, "test");
  assert.ok(page.includes("<p>Proposed and unreviewed local content. Session-only;"));
  assert.ok(page.includes("<strong>Sources used</strong>"));
  assert.ok(page.includes('<p class="boundary">This orientation reuses admitted C2 evidence. It does not claim that the legacy “meaningfully changed” bucket proves temporal change, and the C2 disposition does not approve generated C3 content.</p>'));
  assert.ok(page.includes('<p class="meta">Admitted entity relationships do not establish personal decision authority.</p>'));
  assert.doesNotMatch(page, /Agent-curated public context|Agent-curated proposed\/template context/);
});
