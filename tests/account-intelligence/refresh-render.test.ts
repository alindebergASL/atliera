import assert from "node:assert/strict";
import test from "node:test";

import { renderC2AccountHome } from "../../src/account-intelligence/account-home.ts";
import { AccountIntelligenceProviderBoundary, AccountIntelligenceProviderRefusal } from "../../src/account-intelligence/provider.ts";
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

test("refresh distinguishes retained records from external execution and reports local zero-write effects", async () => {
  const { provider, result } = await runFixture();
  assert.equal(provider.calls, 1);
  assert.deepEqual(Object.keys(provider.lastDraft!).sort(), ["claims", "factSelections", "schemaVersion"]);
  assert.equal((provider.lastDraft as unknown as Record<string, unknown>).accountId, undefined);
  assert.equal(result.proposal.kind, "atliera.account-intelligence-proposal");
  assert.equal(result.effectReceipt.recordedQueryTexts.length, 1);
  assert.equal(result.effectReceipt.recordedDiscoveryRecords, 1);
  assert.equal(result.effectReceipt.retainedSourceCandidates, 1);
  assert.equal(result.effectReceipt.admittedSources, 1);
  assert.equal(result.effectReceipt.excludedSourceCandidates, 0);
  assert.equal(result.effectReceipt.providerCallsAttempted, 1);
  assert.equal(result.effectReceipt.providerCallsSucceeded, 1);
  assert.equal(result.effectReceipt.inputTokens, 500);
  assert.equal(result.effectReceipt.requestedMaxOutputTokens, 4_000);
  assert.equal(result.effectReceipt.requestedLocalOutputTokenCeiling, 4_000);
  assert.equal(result.effectReceipt.transmittedProviderOutputTokenCeiling, null);
  assert.equal(result.effectReceipt.observedOutputTokens, 300);
  assert.equal(result.effectReceipt.externalOutputTokenEnforcement, "unestablished");
  assert.equal(result.effectReceipt.structuredOutputEnforcement, "local_deterministic_validation_only");
  assert.equal(result.effectReceipt.outputTokens, 300);
  assert.match(result.effectReceipt.promptSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.effectReceipt.boundaryConfigurationSha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.effectReceipt.estimatedCostUsd, 0);
  assert.equal(result.effectReceipt.providerBehavior, "external_variable_response_validated");
  assert.equal(result.effectReceipt.providerStorage, "unestablished");
  assert.equal(result.effectReceipt.providerToolCalls, "unestablished");
  assert.equal(result.effectReceipt.providerNetworkEffects, "unestablished");
  for (const key of ["databaseWrites", "graphWrites", "persistenceWrites",
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

test("provider behavior remains external and mutable this-state is detected through response validation", async () => {
  const input = makeC2FixtureInput();
  const delegate = new FixtureAccountIntelligenceProvider({ name: "mutable-provider" });
  const provider = {
    name: "mutable-provider",
    mode: "stable",
    async generate(request: Parameters<typeof delegate.generate>[0]) {
      const response = await delegate.generate(request);
      return { ...response, provider: this.mode === "stable" ? this.name : "mutated-provider" };
    },
  };
  const boundary = new AccountIntelligenceProviderBoundary({ provider, model: "fixture-model",
    outOfRepoCorpusRef: "external-corpus/c2/provider-snapshot", maxOutputTokens: 4_000, maxCostUsd: 1 });
  provider.mode = "mutated";
  await assert.rejects(() => executeAccountIntelligenceRefresh({ ...input, providerBoundary: boundary }),
    /provider receipt refused/u);
  const accessorProvider = Object.defineProperties({}, {
    name: { enumerable: true, get: () => "getter-provider" },
    generate: { enumerable: true, get: () => async () => undefined },
  });
  assert.throws(() => new AccountIntelligenceProviderBoundary({ provider: accessorProvider as never,
    model: "fixture-model", outOfRepoCorpusRef: "external-corpus/c2/accessor", maxOutputTokens: 4_000,
    maxCostUsd: 1 }), /dependency shape refused/u);
});

test("provider output above requested maximum fails closed with a truthful refusal receipt", async () => {
  const input = makeC2FixtureInput();
  const provider = new FixtureAccountIntelligenceProvider({ outputTokens: 301 });
  const boundary = new AccountIntelligenceProviderBoundary({ provider, model: "fixture-model",
    outOfRepoCorpusRef: "external-corpus/c2/output-cap", maxOutputTokens: 300, maxCostUsd: 1 });
  await assert.rejects(() => executeAccountIntelligenceRefresh({ ...input, providerBoundary: boundary }), (error: unknown) => {
    assert.ok(error instanceof AccountIntelligenceProviderRefusal);
    assert.deepEqual(error.receipt, {
      code: "output_token_limit_exceeded", provider: "fixture-account-intelligence-provider", model: "fixture-model",
      reportedOutputTokens: 301, maxOutputTokens: 300, callsAttempted: 1, callsSucceeded: 0,
      requestedLocalOutputTokenCeiling: 300, transmittedProviderOutputTokenCeiling: null,
      observedOutputTokens: 301, externalOutputTokenEnforcement: "unestablished",
      providerBehavior: "external_variable_response_validated", storage: "unestablished", tools: "unestablished",
      networkEffects: "unestablished",
    });
    return true;
  });
});

test("freshness cue distinguishes single, mixed, missing, and stale material evidence", async () => {
  const { result } = await runFixture();
  const source = result.admittedSources[0]!;
  assert.match(renderC2AccountHome(result).html, /Evidence current through Aug 20, 2026/u);
  const extra = (id: string, currentThrough: string | null) => ({ ...source, sourceId: id,
    canonicalUrl: `https://harbor-transit.example.org/${id}`, evidenceCurrentThrough: currentThrough, excerpts: [] });
  const mixed = { ...result, admittedSources: [source, extra("source-mixed", "2025-01-15")] };
  assert.match(renderC2AccountHome(mixed).html, /Evidence current-through span Jan 15, 2025–Aug 20, 2026 · recheck older support/u);
  const missing = { ...result, admittedSources: [source, extra("source-missing", null)] };
  assert.match(renderC2AccountHome(missing).html, /Evidence freshness mixed · through Aug 20, 2026 where established · recheck/u);
  const stale = { ...result, admittedSources: [extra("source-stale", "2023-01-01"), source] };
  assert.match(renderC2AccountHome(stale).html, /Jan 1, 2023–Aug 20, 2026 · recheck older support/u);
});
