import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const APPROVAL_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-approval.md");
const EXIT_DOC = join(REPO_ROOT, "docs", "strategy", "fake-mode-workshop-surface-exit-criteria.md");
const WORKSHOP_DEMO_DOC = join(REPO_ROOT, "docs", "runbooks", "workshop-runtime-preview-demo.md");
const SCOPE_DOC = join(REPO_ROOT, "docs", "strategy", "product-facing-fake-mode-runtime-scope.md");

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
  /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
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

describe("safety: live product preview approval packet", () => {
  test("is a docs-only approval packet for exactly one bounded live product preview", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    assert.match(docs, /Live Product Preview Approval/i);
    assert.match(docs, /Status: pre-run docs-only approval packet/i);
    assert.match(docs, /This PR does not execute the run/i);
    assert.match(docs, /approves exactly one controlled live-provider product preview/i);
    assert.match(docs, /one representative account/i);
    assert.match(docs, /one `graph\.propose` provider call/i);
    assert.match(docs, /one Workshop preview render/i);
    assert.match(docs, /atliera\.model_activation_approval\.v1/i);
    assert.match(docs, /external-corpus\/live-product-preview\//i);
    assert.match(docs, /private evidence outside the repository/i);
    assert.match(docs, /sanitized status follow-up/i);
    assertNoPrivateLeakage("approval doc", docs);
    assertNoScopeContradictions("approval doc", docs);
  });

  test("pins provider, model, budget, no-tool boundaries, and private-evidence handling", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /provider route: OpenRouter/i,
      /public model id: `owl-alpha`/i,
      /provider tier: free-tier/i,
      /model id is not a launch model or production default/i,
      /expected observed provider cost[^\n]*\$0\.00/i,
      /max run cost[^\n]*\$0\.50/i,
      /cumulative product-preview cap[^\n]*\$0\.50/i,
      /no paid fallback/i,
      /no provider comparison/i,
      /no corpus expansion/i,
      /no production writes/i,
      /no runtime\/model-mode integration/i,
      /no launch, product, or production readiness claim/i,
      /no `:online` model variant/i,
      /no OpenRouter `web` plugin/i,
      /no `openrouter:web_search` server tool/i,
      /no tools or plugins of any kind/i,
      /account-default plugins must be disabled or request-disabled/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("approval doc", docs);
    assertNoScopeContradictions("approval doc", docs);
  });

  test("locks success criteria, failure modes, and pre-run decision tree before execution", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /Activation gates must pass/i,
      /credential readiness must pass/i,
      /response contract must pass/i,
      /cost ledger entry must be succeeded/i,
      /graph validation and quality gate must pass/i,
      /Workshop preview must render from the produced graph/i,
      /provider integration and product preview both pass/i,
      /substrate passes but Workshop usefulness is weak/i,
      /validation, packaging, or bootstrap verification fails/i,
      /activation or credential failure occurs before the call/i,
      /provider refusal, outage, rate limit, or routing failure/i,
      /sanitized refusal evidence/i,
      /no post-output substitution/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("approval doc", docs);
    assertNoScopeContradictions("approval doc", docs);
  });

  test("preserves provider portability and separates this run from future web-search/tool capability", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    assert.match(docs, /not OpenRouter lock-in/i);
    assert.match(docs, /same `ModelProvider` boundary/i);
    assert.match(docs, /Anthropic API/i);
    assert.match(docs, /OpenAI API/i);
    assert.match(docs, /gateway and direct provider routes/i);
    assert.match(docs, /OpenRouter web\/search capability is a separate future approval surface/i);
    assert.match(docs, /spend, provenance, and evidence semantics/i);
    assertNoPrivateLeakage("approval doc", docs);
    assertNoScopeContradictions("approval doc", docs);
  });

  test("is linked from every durable fake-mode Workshop transition document", () => {
    for (const path of [EXIT_DOC, WORKSHOP_DEMO_DOC, SCOPE_DOC]) {
      const docs = readRepoFile(path);
      assert.match(docs, /live-product-preview-approval\.md/i);
      assert.match(docs, /live product preview approval/i);
      assertNoPrivateLeakage(path, docs);
      assertNoScopeContradictions(path, docs);
    }
  });
});
