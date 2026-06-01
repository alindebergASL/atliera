import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const APPROVAL_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-six-slot-approval.md");
const BROADER_STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-broader-batch-status.md");
const BROADER_USEFULNESS_DOC = join(
  REPO_ROOT,
  "docs",
  "runbooks",
  "live-product-preview-broader-batch-usefulness-assessment.md",
);
const OWL_ALPHA_DOC = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");
const USEFULNESS_GATE_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-gate.md");

const FORBIDDEN_PRIVATE_MARKERS = [
  /\/home\//i,
  /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
  /run[-_]evidence\.(?:json|jsonl|txt|log)/i,
  /api[_ -]?key\s*[:=]/i,
  /credential\s*(?:value|contents?|name)\s*[:=]/i,
  /authorization\s*[:=]/i,
  /bearer\s+[A-Za-z0-9._-]+/i,
  /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
  /raw[_ -]?body\s*[:=]/i,
  /raw[_ -]?prompt\s*[:=]/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  /\blab\d*\.[a-z0-9-]+\.(?:com|net|org|io)\b/i,
];

const FORBIDDEN_SCOPE_CONTRADICTIONS = [
  /This PR executes the slice/i,
  /This PR executes the batch/i,
  /This PR executes the run/i,
  /(?:is|as|becomes|remains) a standing approval/i,
  /(?:authorizes|allows|approves)\s+(?:paid fallback|production writes?|production deployment|runtime\/model-mode integration)/i,
  /(?:authorizes|allows|approves|enables)\s+(?:web search|openrouter:web_search|`:online`|plugins?|tools?)/i,
  /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
  /multi-provider comparison (?:is )?(?:approved|authorized|allowed)/i,
  /paid fallback (?:is )?(?:approved|authorized|allowed)/i,
  /production writes? (?:is|are )?(?:approved|authorized|allowed)/i,
  /production deployment (?:is )?(?:approved|authorized|allowed)/i,
  /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
  /launch readiness (?:is )?(?:proven|claimed|approved|established|implied)/i,
  /product readiness (?:is )?(?:proven|claimed|approved|established|implied)/i,
  /production readiness (?:is )?(?:proven|claimed|approved|established|implied)/i,
  /multi-account readiness (?:is )?(?:proven|claimed|approved|established|implied)/i,
  /provider quality (?:is )?(?:proven|claimed|approved|established|implied)/i,
  /OpenRouter\s+(?:is|as)\s+(?:required|committed|locked in|the only route)/i,
  /owl-alpha\s+(?:is|as)\s+(?:launch model|production default|quality winner|the chosen quality model)/i,
  /web search (?:is )?(?:approved|authorized|allowed|enabled)/i,
  /openrouter:web_search (?:is )?(?:approved|authorized|allowed|enabled)/i,
  /`:online` (?:is )?(?:approved|authorized|allowed|enabled)/i,
  /plugins? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
  /tools? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
  /(?:authorizes|allows|approves)\s+(?:any\s+)?(?:slice|batch|retry set|corpus growth)\s+beyond\s+(?:the\s+)?(?:six|6)[- ]slot/i,
];

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, docs: string): void {
  for (const pattern of FORBIDDEN_PRIVATE_MARKERS) {
    assert.doesNotMatch(docs, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeContradictions(label: string, docs: string): void {
  for (const pattern of FORBIDDEN_SCOPE_CONTRADICTIONS) {
    assert.doesNotMatch(docs, pattern, `${label} broadened approval scope with ${pattern}`);
  }
}

describe("safety: live product preview six-slot approval packet", () => {
  test("is a docs-only bounded approval after the useful broader-batch assessment", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    assert.match(docs, /Live Product Preview Six-Slot Approval/i);
    assert.match(docs, /Status: pre-run docs-only approval packet/i);
    assert.match(docs, /This PR does not execute the slice/i);
    assert.match(docs, /after the useful broader-batch assessment/i);
    assert.match(docs, /live-product-preview-broader-batch-usefulness-assessment\.md/i);
    assert.match(docs, /classified the batch as `useful`/i);
    assert.match(docs, /approves_expansion_or_comparison: false/i);
    assert.match(docs, /separate review surface/i);
    assert.match(docs, /not a standing approval/i);
    assert.match(docs, /does not authorize any slice, batch, retry set, model route, provider comparison, or corpus growth beyond the exact six-slot scope/i);
    assertNoPrivateLeakage("six-slot approval doc", docs);
    assertNoScopeContradictions("six-slot approval doc", docs);
  });

  test("pins route, six-slot scope, call limits, budget, and private evidence boundaries", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /provider route: OpenRouter/i,
      /public model id: `owl-alpha`/i,
      /provider tier: free-tier/i,
      /operation: `graph\.propose`/i,
      /activation approval schema: `atliera\.model_activation_approval\.v1`/i,
      /corpus reference prefix: `external-corpus\/live-product-preview-six-slot\/`/i,
      /selected scope: exactly six screened account slots/i,
      /provider calls: at most six, one per screened account/i,
      /Workshop renders: at most six, one render from each produced and validated graph/i,
      /expected observed provider cost[^\n]*\$0\.00/i,
      /max slice cost[^\n]*\$3\.00/i,
      /cumulative six-slot product-preview cap[^\n]*\$3\.00/i,
      /no paid fallback/i,
      /private evidence outside the repository/i,
      /sanitized status follow-up/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("six-slot approval doc", docs);
    assertNoScopeContradictions("six-slot approval doc", docs);
  });

  test("requires screened roles and stops before calls when prerequisites fail", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /exactly six screened account slots/i,
      /two representative accounts expected to support Signals, Maps, and Plays/i,
      /two edge-case accounts expected to stress sparse, ambiguous, or uneven Maps\/Plays evidence/i,
      /one calibration account expected to support at least two Workshop lenses/i,
      /one sparse-control account expected to test visibly bounded empty or low-evidence states/i,
      /at least two of Signals, Maps, and Plays/i,
      /cover Signals, Maps, and Plays category markers/i,
      /does not pre-write graph objects, claims, or Workshop items/i,
      /only sanitized category-presence markers and role labels/i,
      /not raw source text, private account details, or account identifiers/i,
      /If an account's source-evidence screen fails, that account is skipped before the provider call/i,
      /If fewer than four account slots pass the pre-call screen, or if no representative slot passes, the slice stops before provider execution/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("six-slot approval doc", docs);
    assertNoScopeContradictions("six-slot approval doc", docs);
  });

  test("preserves render-source guardrails and refuses metrics summaries as GraphBundles", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /Workshop fixture\/render guardrails/i,
      /renderable GraphBundles from sanitized validation metrics/i,
      /generated_from: "graph_bundle_fixture"/i,
      /provider_calls_made: 0/i,
      /production_writes: false/i,
      /readiness: false/i,
      /shape-based refusal of sanitized metrics\/status summaries/i,
      /preview_ref/i,
      /output_counts/i,
      /workshop_surface/i,
      /No sanitized validation metrics\/status summary is treated as a renderable GraphBundle/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("six-slot approval doc", docs);
    assertNoScopeContradictions("six-slot approval doc", docs);
  });

  test("preserves no-tool, no-search, no-production, no-comparison, and no-readiness boundaries", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /no provider comparison/i,
      /no multi-provider comparison/i,
      /no production writes/i,
      /no production deployment/i,
      /no runtime\/model-mode integration/i,
      /no worker-loop or autonomous runtime execution/i,
      /no customer-data access/i,
      /no launch, product, or production readiness claim/i,
      /no broad provider quality claim/i,
      /no multi-account readiness claim/i,
      /no standing corpus expansion beyond the six screened account slots/i,
      /no unbounded product-preview expansion beyond this slice/i,
      /no `:online` model variant/i,
      /no OpenRouter `web` plugin/i,
      /no `openrouter:web_search` server tool/i,
      /no tools or plugins of any kind/i,
      /account-default plugins must be disabled or request-disabled/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("six-slot approval doc", docs);
    assertNoScopeContradictions("six-slot approval doc", docs);
  });

  test("locks success criteria, failure interpretation, sanitized follow-up, and portability", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /At least four screened account slots execute through the provider path/i,
      /At least one representative slot executes through the provider path/i,
      /Activation gates pass for each executed account/i,
      /Each executed provider call returns a response accepted by the response contract/i,
      /Each cost ledger entry is succeeded/i,
      /Graph validation and quality gate pass for each produced graph output/i,
      /Bootstrap evidence verification passes/i,
      /Sanitized graph-supported lens counts are recorded for Signals, Maps, and Plays/i,
      /Sparse-control outcomes are reported separately/i,
      /No post-output substitution is used/i,
      /next step is not launch/i,
      /separate no-spend six-slot usefulness assessment/i,
      /proposal-extraction review/i,
      /sanitized refusal evidence/i,
      /historical facts from one approved slice/i,
      /Raw provider request\/response material, credentials, wrapper logs, source account content/i,
      /per-slot and aggregate graph-supported lens counts/i,
      /not OpenRouter lock-in/i,
      /not an `owl-alpha` quality conclusion/i,
      /same `ModelProvider` boundary/i,
      /Anthropic API and OpenAI API/i,
      /does not prove provider quality/i,
      /does not prove launch readiness/i,
      /does not prove product readiness/i,
      /does not prove production readiness/i,
      /does not prove multi-account readiness/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("six-slot approval doc", docs);
    assertNoScopeContradictions("six-slot approval doc", docs);
  });

  test("is linked from durable handoff docs without turning the usefulness gate into approval", () => {
    const handoffDocs = [BROADER_STATUS_DOC, BROADER_USEFULNESS_DOC, OWL_ALPHA_DOC, USEFULNESS_GATE_DOC];
    for (const path of handoffDocs) {
      const docs = readRepoFile(path);
      assert.match(docs, /live-product-preview-six-slot-approval\.md/i, `${path} must link the approval packet`);
      assertNoPrivateLeakage(path, docs);
      assertNoScopeContradictions(path, docs);
    }

    const broaderUsefulness = readRepoFile(BROADER_USEFULNESS_DOC);
    assert.match(broaderUsefulness, /approves_expansion_or_comparison: false/i);
    assert.match(broaderUsefulness, /does not approve expansion/i);
    assert.match(broaderUsefulness, /does not approve comparison/i);
    assert.match(broaderUsefulness, /does not request another provider call/i);
    assert.match(broaderUsefulness, /pre-run docs-only approval surface/i);
  });
});
