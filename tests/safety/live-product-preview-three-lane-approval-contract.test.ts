import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const APPROVAL_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-three-lane-approval.md");
const EXIT_DOC = join(REPO_ROOT, "docs", "strategy", "fake-mode-workshop-surface-exit-criteria.md");
const LENS_DIAGNOSTIC_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-lens-diagnostic.md");
const REMEDIATION_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-remediation.md");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-status.md");
const OWL_ALPHA_DOC = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");

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
  /This PR executes the run/i,
  /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
  /multi-provider comparison (?:is )?(?:approved|authorized|allowed)/i,
  /paid fallback (?:is )?(?:approved|authorized|allowed)/i,
  /production writes? (?:is|are )?(?:approved|authorized|allowed)/i,
  /production deployment (?:is )?(?:approved|authorized|allowed)/i,
  /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
  /launch readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /product readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /production readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /multi-account readiness (?:is )?(?:proven|claimed|approved|established)/i,
  /provider quality (?:is )?(?:proven|claimed|approved|established)/i,
  /OpenRouter\s+(?:is|as)\s+(?:required|committed|locked in|the only route)/i,
  /owl-alpha\s+(?:is|as)\s+(?:launch model|production default|quality winner|the chosen quality model)/i,
  /web search (?:is )?(?:approved|authorized|allowed|enabled)/i,
  /openrouter:web_search (?:is )?(?:approved|authorized|allowed|enabled)/i,
  /`:online` (?:is )?(?:approved|authorized|allowed|enabled)/i,
  /plugins? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
  /tools? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
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

describe("safety: live product preview three-lane approval packet", () => {
  test("is a docs-only one-run approval after fake-mode three-lane evidence", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    assert.match(docs, /Live Product Preview Three-Lane Approval/i);
    assert.match(docs, /Status: pre-run docs-only approval packet/i);
    assert.match(docs, /This PR does not execute the run/i);
    assert.match(docs, /approves exactly one controlled live-provider product preview/i);
    assert.match(docs, /one screened account/i);
    assert.match(docs, /one `graph\.propose` provider call/i);
    assert.match(docs, /one Workshop preview render/i);
    assert.match(docs, /fake-mode-workshop-surface-exit-criteria\.md/i);
    assert.match(docs, /runtime-preview-demo-report\.json/i);
    assert.match(docs, /lensItemCounts/i);
    assert.match(docs, /lensEvidencePacketCounts/i);
    assert.match(docs, /two_materially_useful_lenses_in_fixture_mode_against_supported_existing_outputs/i);
    assertNoPrivateLeakage("three-lane approval doc", docs);
    assertNoScopeContradictions("three-lane approval doc", docs);
  });

  test("pins provider route, account-screening prerequisites, budget, and no-tool boundaries", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /provider route: OpenRouter/i,
      /public model id: `owl-alpha`/i,
      /provider tier: free-tier/i,
      /operation: `graph\.propose`/i,
      /corpus reference prefix: `external-corpus\/live-product-preview-three-lane\/`/i,
      /screened source-evidence prerequisites/i,
      /Signals plus at least one of Maps or Plays/i,
      /proposal-extraction screen/i,
      /expected observed provider cost[^\n]*\$0\.00/i,
      /max run cost[^\n]*\$0\.50/i,
      /cumulative three-lane product-preview cap[^\n]*\$0\.50/i,
      /no paid fallback/i,
      /private evidence outside the repository/i,
      /sanitized status follow-up/i,
      /no `:online` model variant/i,
      /no OpenRouter `web` plugin/i,
      /no `openrouter:web_search` server tool/i,
      /no tools or plugins of any kind/i,
      /account-default plugins must be disabled or request-disabled/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("three-lane approval doc", docs);
    assertNoScopeContradictions("three-lane approval doc", docs);
  });

  test("blocks first-account remediation drift and locks post-run interpretation", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /does not reopen current-account remediation/i,
      /does not pressure prompts or schemas to invent unsupported Maps or Plays/i,
      /Activation gates must pass/i,
      /credential readiness must pass/i,
      /response contract must pass/i,
      /cost ledger entry must be succeeded/i,
      /graph validation and quality gate must pass/i,
      /Workshop preview must render from the produced graph/i,
      /sanitized graph-supported lens counts/i,
      /provider integration and product preview both pass/i,
      /source-evidence screen fails/i,
      /structure-absent at graph level/i,
      /proposal-extraction review/i,
      /sanitized refusal evidence/i,
      /no post-output substitution/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("three-lane approval doc", docs);
    assertNoScopeContradictions("three-lane approval doc", docs);
  });

  test("preserves provider portability and explicit non-readiness limitations", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    assert.match(docs, /not OpenRouter lock-in/i);
    assert.match(docs, /not an `owl-alpha` quality conclusion/i);
    assert.match(docs, /same `ModelProvider` boundary/i);
    assert.match(docs, /Anthropic API/i);
    assert.match(docs, /OpenAI API/i);
    assert.match(docs, /gateway and direct provider routes/i);
    assert.match(docs, /does not prove provider quality/i);
    assert.match(docs, /does not prove launch readiness/i);
    assert.match(docs, /does not prove product readiness/i);
    assert.match(docs, /does not prove production readiness/i);
    assert.match(docs, /does not prove multi-account readiness/i);
    assertNoPrivateLeakage("three-lane approval doc", docs);
    assertNoScopeContradictions("three-lane approval doc", docs);
  });

  test("is linked from every durable handoff doc without overwriting the historical first preview", () => {
    const handoffDocs = [EXIT_DOC, LENS_DIAGNOSTIC_DOC, REMEDIATION_DOC, STATUS_DOC, OWL_ALPHA_DOC];
    for (const path of handoffDocs) {
      const docs = readRepoFile(path);
      assert.match(docs, /live-product-preview-three-lane-approval\.md/i, `${path} must link the next approval packet`);
      assertNoPrivateLeakage(path, docs);
      assertNoScopeContradictions(path, docs);
    }

    const firstApproval = readRepoFile(join(REPO_ROOT, "docs", "runbooks", "live-product-preview-approval.md"));
    assert.match(firstApproval, /Sanitized execution status is now recorded in `live-product-preview-status\.md`/i);
    assert.match(firstApproval, /The approved preview is one representative account/i);
    assertNoPrivateLeakage("first approval doc", firstApproval);
    assertNoScopeContradictions("first approval doc", firstApproval);
  });
});
