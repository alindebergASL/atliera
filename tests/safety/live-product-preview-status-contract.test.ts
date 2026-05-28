import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-status.md");
const APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-approval.md");
const EXIT_PATH = join(REPO_ROOT, "docs", "strategy", "fake-mode-workshop-surface-exit-criteria.md");
const SCOPE_PATH = join(REPO_ROOT, "docs", "strategy", "product-facing-fake-mode-runtime-scope.md");
const STRATEGY_PATH = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");

const MANIFEST_HASH = "cc8c6b2cdf8f9941e5bcdbf097e442777f10ebaf19c391d5a1069dcc4fe75606";

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  const forbiddenPatterns = [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
    /lab\d*\.[a-z0-9-]+\.[a-z]{2,}/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoPositiveReadinessOrBroadening(label: string, text: string): void {
  const forbiddenPatterns = [
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /multi-account (?:readiness|corpus readiness) (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /paid fallback (?:is )?(?:approved|authorized|allowed)/i,
    /production writes (?:are )?(?:approved|authorized|allowed)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened interpretation with ${pattern}`);
  }
}

function assertLiveProductPreviewStatus(text: string): void {
  assert.match(text, /live product preview sanitized execution status/i);
  assert.match(text, /approval PR was docs-only and did not execute the run/i);
  assert.match(text, /commit `344c89b`/i);
  assert.match(text, /OpenRouter `owl-alpha`/i);
  assert.match(text, /`graph\.propose`/i);
  assert.match(text, /external-corpus\/live-product-preview\//i);
  assert.match(text, /selected role: representative/i);
  assert.match(text, /account count: 1/i);
  assert.match(text, /provider calls approved: 1/i);
  assert.match(text, /provider calls executed: 1/i);
  assert.match(text, /Workshop renders approved: 1/i);
  assert.match(text, /activation gates/i);
  assert.match(text, /credential status/i);
  assert.match(text, /provider call/i);
  assert.match(text, /response contract/i);
  assert.match(text, /cost ledger/i);
  assert.match(text, /full-pipeline packaging/i);
  assert.match(text, /bootstrap evidence verifier/i);
  assert.match(text, /Workshop preview/i);
  assert.match(text, /input tokens: 817/i);
  assert.match(text, /output tokens: 391/i);
  assert.match(text, /observed provider cost: \$0\.00/i);
  assert.match(text, /estimated ledger cost: \$0\.01/i);
  assert.match(text, /output counts: excerpts 1, claims 1, account_objects 1/i);
  assert.match(text, /Workshop provider calls made: 0/i);
  assert.match(text, /Workshop production writes: false/i);
  assert.match(text, new RegExp(MANIFEST_HASH));
  assert.match(text, /tools_or_plugins_requested: false/i);
  assert.match(text, /online_model_variant_requested: false/i);
  assert.match(text, /web_search_requested: false/i);
  assert.match(text, /private evidence retained outside the repository/i);
  assert.match(text, /production writes: none/i);
  assert.match(text, /runtime\/model-mode integration: none/i);
  assert.match(text, /launch_readiness_claim: false/i);
  assert.match(text, /product_readiness_claim: false/i);
  assert.match(text, /production_readiness_claim: false/i);
  assert.match(text, /broad_model_quality_claim: false/i);
  assert.match(text, /provider_or_model_comparison: false/i);
  assert.match(text, /corpus_expansion: false/i);
  assert.match(text, /does not imply launch readiness/i);
  assert.match(text, /does not imply product readiness/i);
  assert.match(text, /does not establish production readiness/i);
  assert.match(text, /does not establish broad model quality/i);
  assert.match(text, /does not establish multi-account readiness/i);
  assert.match(text, /not OpenRouter lock-in/i);
  assert.match(text, /not an `owl-alpha` quality conclusion/i);
}

test("safety: live product preview sanitized status", async (t) => {
  await t.test("records bounded execution facts without private evidence", () => {
    const docs = readRepoFile(STATUS_PATH);
    assertLiveProductPreviewStatus(docs);
    assertNoPrivateLeakage("status doc", docs);
    assertNoPositiveReadinessOrBroadening("status doc", docs);
  });

  await t.test("links the status from durable transition documents independently", () => {
    const docs = [
      ["approval", APPROVAL_PATH],
      ["fake-mode exit", EXIT_PATH],
      ["product fake-mode scope", SCOPE_PATH],
      ["strategy", STRATEGY_PATH],
    ] as const;
    for (const [label, path] of docs) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-status\.md/i, `${label} must link status doc`);
      assert.match(text, /live product preview/i, `${label} must preserve preview context`);
      assert.match(text, /does not imply launch readiness|launch_readiness_claim: false|no-readiness/i, `${label} must preserve no-readiness boundary`);
      assert.match(text, /runtime\/model-mode integration|runtime\/model-mode/i, `${label} must preserve runtime boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoPositiveReadinessOrBroadening(label, text);
    }
  });
});
