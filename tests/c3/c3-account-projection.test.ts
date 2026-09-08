import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { projectAccount } from "../../src/c3/account-projection.ts";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { loadCuratedC3Context } from "../../src/c3/curated-context.ts";
import { renderC3Page } from "../../src/c3/render.ts";
import type { FrozenC3ViewContext } from "../../src/c3/view-context.ts";
const utah = () => loadC3AccountContext({ broadInputPath: "fixtures/account-intelligence/c2-01/broad-account-research-input.json", proposalPath: "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json", ownerDecisionPath: "docs/decisions/c2-owner-disposition-record.json", accountId: "acc_university_of_utah" });
const missouri = () => loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

test("Account projection is read-only with exact evidence identity and all six substantive topic groups", async () => {
  for (const frozen of [await utah(), await missouri()]) {
    const before = JSON.stringify(frozen);
    const projected = projectAccount(frozen);
    for (const topic of ["overview", "priorities", "people", "technology", "discoveries", "hypotheses"]) assert.ok(projected.readings.some(note => note.topic === topic), topic);
    for (const note of projected.readings) {
      assert.ok(note.evidenceIds.length > 0);
      for (const id of note.evidenceIds) {
        const source = frozen.context.admittedSources.find(source => source.excerpts.some(excerpt => excerpt.evidenceId === id))!;
        const excerpt = source.excerpts.find(excerpt => excerpt.evidenceId === id)!;
        assert.equal(source.fullBoundedCleanText.slice(excerpt.sourceCharStart, excerpt.sourceCharEnd), excerpt.exactExcerpt);
        assert.equal(hash(excerpt.exactExcerpt), excerpt.exactExcerptSha256);
      }
    }
    for (const note of projected.readings.filter(note => note.topic === "hypotheses")) {
      assert.equal(note.kind, "hypothesis");
      assert.ok(note.limit?.startsWith("Unvalidated:"));
    }
    renderC3Page(frozen, { page: "home" }, "test");
    assert.equal(JSON.stringify(frozen), before, "Rendering must not rewrite or ratify any existing context");
    assert.equal(frozen.sha256, hash(frozen.canonicalJson));
  }
});

test("Authored reading fails closed when source identity, dates, scope or exact excerpt change", async () => {
  const frozen = await missouri();
  const source = frozen.context.admittedSources.find(source => source.sourceId === "mu_source_3")!;
  for (const changed of [
    { ...source, sourceId: "different_source" },
    { ...source, eventDate: "2026-09-08" },
    { ...source, entity: { ...source.entity, entityId: "different_entity" } },
    { ...source, untrustedInstructionsDetected: true },
    { ...source, excerpts: source.excerpts.map(excerpt => ({ ...excerpt, exactExcerpt: "changed bytes" })) },
    { ...source, fullBoundedCleanText: "changed text" },
  ]) {
    const context = { ...frozen, context: { ...frozen.context, admittedSources: frozen.context.admittedSources.map(item => item.sourceId === source.sourceId ? changed : item) } };
    assert.ok(!projectAccount(context).readings.some(note => note.evidenceIds.includes("mu_evidence_3_2")));
  }
});

test("Raw-only role passages remain source inspection without inventing selected evidence IDs", async () => {
  const frozen = await missouri();
  const projected = projectAccount(frozen);
  const role = projected.passages.find(passage => passage.id === "public-leadership")!;
  assert.ok(role.exactText.includes("President Mun Choi"));
  assert.ok(role.source.fullBoundedCleanText.includes(role.exactText));
  assert.ok(!role.source.excerpts.some(excerpt => excerpt.exactExcerpt.includes("Mun Choi")));
  assert.ok(!("evidenceId" in role));
  const source = { ...role.source, fullBoundedCleanText: role.source.fullBoundedCleanText.replace("Mun Choi", "Another name") };
  const changed = { ...frozen, context: { ...frozen.context, admittedSources: frozen.context.admittedSources.map(item => item.sourceId === source.sourceId ? source : item) } };
  assert.ok(!projectAccount(changed).passages.some(passage => passage.id === role.id));
});

test("Account identity never selects a school-specific reading and sparse/conflicting inputs stay inspectable", async () => {
  const frozen = await missouri();
  const renamed = { ...frozen, context: { ...frozen.context, account: { ...frozen.context.account, accountId: "another_account", accountName: "Different name", knownAliases: [] } } };
  assert.deepEqual(projectAccount(renamed), projectAccount(frozen));
  const sparse: FrozenC3ViewContext = { ...frozen, context: { ...frozen.context, admittedSources: [], declaredContradictions: ["Retained sources disagree about the service scope."] } };
  assert.deepEqual(projectAccount(sparse).readings, []);
  const html = renderC3Page(sparse, { page: "home" }, "test");
  assert.ok(html.includes("There is not enough matched evidence"));
  assert.ok(html.includes("Conflicting context."));
  const technology = html.slice(html.indexOf('id="account-technology"'), html.indexOf('id="account-discoveries"'));
  assert.ok(technology.includes('href="#account-research-technology"'), "Separate research remains inspectable with sparse historical context");
  assert.ok(!technology.includes('id="reading-'), "No technology reading is inferred from missing historical evidence");
  assert.ok(!html.includes('id="account-priorities"'));
  assert.ok(html.includes("No earlier account review to compare"));
});

test("All Account contextual evidence links resolve to exact inspectable content with unique navigation IDs", async () => {
  for (const frozen of [await utah(), await missouri()]) {
    const html = renderC3Page(frozen, { page: "home" }, "test");
    const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map(match => match[1]!);
    assert.equal(ids.length, new Set(ids).size, "duplicate IDs would break contextual return");
    for (const match of html.matchAll(/data-evidence-link[^>]+href="#([^"]+)"/gu)) assert.ok(ids.includes(match[1]!), match[1]);
    const orderedEvidence = frozen.context.admittedSources.flatMap(source => source.excerpts);
    for (const source of frozen.context.admittedSources) {
      const start = html.indexOf(`<article class="research-source" data-source-id="${source.sourceId}">`);
      assert.ok(start >= 0);
      const visibleEntry = html.slice(start, html.indexOf('<details>', start));
      for (const excerpt of source.excerpts) {
        const number = orderedEvidence.findIndex(item => item.evidenceId === excerpt.evidenceId) + 1;
        assert.ok(visibleEntry.includes(`href="#evidence-${number}"`), "Research entry must offer each excerpt without another disclosure");
      }
    }
    for (const match of html.matchAll(/class="account-topics"[^>]*>(.*?)<\/nav>/gsu)) {
      for (const link of match[1]!.matchAll(/href="#([^"]+)"/gu)) assert.ok(ids.includes(link[1]!), link[1]);
    }
    assert.ok(html.includes("Full retained source context"));
    assert.ok(html.includes("Acquisition is not publication or currentness."));
  }
});

test("A consumer cannot rewrite a reading note or its evidence for a later Account render", async () => {
  const frozen = await missouri();
  const projected = projectAccount(frozen);
  assert.throws(() => { (projected.readings[0] as { text: string }).text = "Fabricated new claim"; }, TypeError);
  assert.throws(() => { (projected.readings[0]!.evidenceIds as string[]).push("invented_id"); }, TypeError);
  assert.ok(!renderC3Page(frozen, { page: "home" }, "test").includes("Fabricated new claim"));
});
