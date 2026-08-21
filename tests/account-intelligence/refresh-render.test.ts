import assert from "node:assert/strict";
import test from "node:test";

import { renderC2AccountHome } from "../../src/account-intelligence/account-home.ts";
import { AccountIntelligenceProviderBoundary } from "../../src/account-intelligence/provider.ts";
import { executeAccountIntelligenceRefresh } from "../../src/account-intelligence/refresh.ts";
import { FixtureAccountIntelligenceProvider, makeC2FixtureInput } from "../fixtures/c2-account-intelligence.ts";

async function runFixture(options: Parameters<typeof makeC2FixtureInput>[0] = {}) {
  const input = makeC2FixtureInput(options);
  const provider = new FixtureAccountIntelligenceProvider();
  const boundary = new AccountIntelligenceProviderBoundary({
    provider,
    model: "fixture-model",
    outOfRepoCorpusRef: `external-corpus/c2/${input.request.accountId}`,
    maxOutputTokens: 4_000,
    maxCostUsd: 1,
  });
  const result = await executeAccountIntelligenceRefresh({ ...input, providerBoundary: boundary });
  return { input, provider, boundary, result };
}

test("refresh produces one validated proposal and truthful zero-side-effect receipt", async () => {
  const { provider, result } = await runFixture();
  assert.equal(provider.calls, 1);
  assert.equal(result.effectReceipt.searchQueriesExecuted, 1);
  assert.equal(result.effectReceipt.retrievalsExecuted, 1);
  assert.equal(result.effectReceipt.admittedSources, 1);
  assert.equal(result.effectReceipt.providerCallsExecuted, 1);
  assert.equal(result.effectReceipt.inputTokens, 500);
  assert.equal(result.effectReceipt.outputTokens, 300);
  assert.equal(result.effectReceipt.estimatedCostUsd, 0);
  for (const key of ["privateNetworkEffects", "databaseWrites", "graphWrites", "persistenceWrites",
    "deployments", "publications", "customerActions"] as const) assert.equal(result.effectReceipt[key], 0);
  assert.ok(result.proposal.establishedContext[0]!.evidenceIds.every((id) =>
    result.admittedSources.some((source) => source.excerpts.some((excerpt) => excerpt.evidenceId === id))));
});

test("provider boundary is single-use and refuses retry", async () => {
  const { input, boundary } = await runFixture();
  await assert.rejects(() => executeAccountIntelligenceRefresh({ ...input, providerBoundary: boundary }), /already consumed/u);
});

test("changing account input changes plan, evidence, and synthesis without changing product code", async () => {
  const first = await runFixture({ accountId: "acct-harbor", accountName: "Harbor Transit", domain: "harbor.example.org" });
  const second = await runFixture({ accountId: "acct-northstar", accountName: "Northstar Manufacturing", domain: "northstar.example.org" });
  assert.notDeepEqual(first.result.plan.queries, second.result.plan.queries);
  assert.notEqual(first.result.admittedSources[0]!.retrievedContentSha256, second.result.admittedSources[0]!.retrievedContentSha256);
  assert.notEqual(first.result.proposal.accountThesis.text, second.result.proposal.accountThesis.text);
  assert.equal(first.result.proposal.researchCoverage.length, second.result.proposal.researchCoverage.length);
});

test("Editorial Evidence Synthesis renderer keeps answers first and machinery behind disclosure", async () => {
  const { result } = await runFixture();
  const artifact = renderC2AccountHome(result);
  assert.equal(artifact.kind, "c2-governed-account-intelligence-home");
  assert.match(artifact.html, /Established/u);
  assert.match(artifact.html, /Meaningfully changed/u);
  assert.match(artifact.html, /Still open/u);
  assert.match(artifact.html, /Recommended next move/u);
  assert.equal((artifact.html.match(/class="stage-num"/gu) ?? []).length, 4);
  assert.equal((artifact.html.match(/class="decision-plane"/gu) ?? []).length, 1);
  assert.match(artifact.html, /<details class="research-disclosure">/u);
  assert.match(artifact.html, /<dialog class="evidence-dialog"/u);
  assert.match(artifact.html, /connect-src &#39;none&#39;/u);
  assert.doesNotMatch(artifact.html, /\b(?:dashboard|activity timeline|confidence gauge|Package Inspector)\b/iu);
  assert.doesNotMatch(artifact.html, /<a\b[^>]*>Workshop<\/a>|<button\b[^>]*>Workshop<\/button>/iu);
  assert.doesNotMatch(artifact.html, /source_[a-f0-9]+|evidence_[a-f0-9]+|retrieval-/iu);
  assert.equal(artifact.boundary.clientNetworkCalls, 0);
  assert.equal(artifact.boundary.providerCalls, 0);
  assert.equal(artifact.boundary.workshopBehavior, 0);
});

test("malicious HTML from admitted source is inert escaped text in the renderer", async () => {
  const established = "Harbor Transit publishes an official record.";
  const changed = '<img src=x onerror="alert(1)"> Harbor Transit proposed funding.';
  const { result } = await runFixture({ retrievedText: `${established}\n${changed}`, candidateExcerpts: [established, changed] });
  const html = renderC2AccountHome(result).html;
  assert.doesNotMatch(html, /<img\b/iu);
  assert.doesNotMatch(html, /onerror="alert\(1\)"/u);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/u);
});
