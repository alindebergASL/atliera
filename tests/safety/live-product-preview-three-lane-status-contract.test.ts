import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-three-lane-status.md");
const APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-three-lane-approval.md");
const FIRST_STATUS_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-status.md");
const LENS_DIAGNOSTIC_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-lens-diagnostic.md");
const EXIT_PATH = join(REPO_ROOT, "docs", "strategy", "fake-mode-workshop-surface-exit-criteria.md");
const OWL_ALPHA_PATH = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");

const MANIFEST_HASH = "910ea9773912f09641668c49e299bf375eda19210c346fa2cced5c503387d810";

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  const forbiddenPatterns = [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /source_text\s*[:=]/i,
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
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
    /tools?\/plugins?\/search (?:are )?(?:approved|authorized|allowed)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened interpretation with ${pattern}`);
  }
}

function assertThreeLaneStatus(text: string): void {
  assert.match(text, /three-lane live product preview sanitized execution status/i);
  assert.match(text, /approval PR was docs-only and did not execute the run/i);
  assert.match(text, /commit `608686d`/i);
  assert.match(text, /OpenRouter `owl-alpha`/i);
  assert.match(text, /`graph\.propose`/i);
  assert.match(text, /external-corpus\/live-product-preview-three-lane\//i);
  assert.match(text, /selected role: screened_three_lane/i);
  assert.match(text, /account count: 1/i);
  assert.match(text, /provider calls approved: 1/i);
  assert.match(text, /provider calls executed: 1/i);
  assert.match(text, /Workshop renders approved: 1/i);
  assert.match(text, /source-evidence screen: passed/i);
  assert.match(text, /signals_category_present: true/i);
  assert.match(text, /maps_category_present: true/i);
  assert.match(text, /plays_category_present: true/i);
  assert.match(text, /raw source text committed: false/i);
  assert.match(text, /prewrote graph objects: false/i);
  assert.match(text, /activation gates/i);
  assert.match(text, /credential status/i);
  assert.match(text, /provider call/i);
  assert.match(text, /response contract/i);
  assert.match(text, /cost ledger/i);
  assert.match(text, /full-pipeline packaging/i);
  assert.match(text, /bootstrap evidence verifier/i);
  assert.match(text, /Workshop preview/i);
  assert.match(text, /input tokens: 939/i);
  assert.match(text, /output tokens: 967/i);
  assert.match(text, /maximum output tokens records the request cap/i);
  assert.match(text, /provider-reported usage field/i);
  assert.match(text, /observed provider cost: \$0\.00/i);
  assert.match(text, /estimated ledger cost: \$0\.01/i);
  assert.match(text, /output counts: excerpts 3, claims 3, account_objects 3/i);
  assert.match(text, /graph-supported lens counts: Signals 1, Maps 1, Plays 1/i);
  assert.match(text, /lens evidence packet counts: Signals 1, Maps 1, Plays 1/i);
  assert.match(text, /Workshop provider calls made: 0/i);
  assert.match(text, /Workshop production writes: false/i);
  assert.match(text, /no_post_output_substitution_used: true/i);
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
  assert.match(text, /multi_account_readiness_claim: false/i);
  assert.match(text, /provider_or_model_comparison: false/i);
  assert.match(text, /corpus_expansion: false/i);
  assert.match(text, /does not imply launch readiness/i);
  assert.match(text, /does not imply product readiness/i);
  assert.match(text, /does not establish production readiness/i);
  assert.match(text, /does not establish broad model quality/i);
  assert.match(text, /does not establish multi-account readiness/i);
  assert.match(text, /not OpenRouter lock-in/i);
  assert.match(text, /not an `owl-alpha` quality conclusion/i);
  assert.match(text, /not a provider comparison/i);
}

test("safety: three-lane live product preview sanitized status", async (t) => {
  await t.test("records bounded one-run execution facts without private evidence", () => {
    const docs = readRepoFile(STATUS_PATH);
    assertThreeLaneStatus(docs);
    assertNoPrivateLeakage("three-lane status doc", docs);
    assertNoPositiveReadinessOrBroadening("three-lane status doc", docs);
  });

  await t.test("links the three-lane status from durable handoff docs independently", () => {
    const docs = [
      ["three-lane approval", APPROVAL_PATH],
      ["first live status", FIRST_STATUS_PATH],
      ["lens diagnostic", LENS_DIAGNOSTIC_PATH],
      ["fake-mode exit", EXIT_PATH],
      ["owl-alpha framing", OWL_ALPHA_PATH],
    ] as const;
    for (const [label, path] of docs) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-three-lane-status\.md/i, `${label} must link three-lane status doc`);
      assert.match(text, /three-lane|live product preview/i, `${label} must preserve preview context`);
      assert.match(text, /does not imply launch readiness|launch_readiness_claim: false|no-readiness|not launch/i, `${label} must preserve no-readiness boundary`);
      assert.match(text, /runtime\/model-mode integration|runtime\/model-mode/i, `${label} must preserve runtime boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoPositiveReadinessOrBroadening(label, text);
    }
  });
});
