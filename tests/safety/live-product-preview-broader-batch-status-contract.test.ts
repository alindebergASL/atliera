import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-broader-batch-status.md");
const APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-broader-batch-approval.md");
const THREE_LANE_STATUS_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-three-lane-status.md");
const THREE_LANE_ASSESSMENT_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-three-lane-usefulness-assessment.md");
const USEFULNESS_GATE_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-gate.md");
const OWL_ALPHA_PATH = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");

const MANIFEST_HASHES = [
  "78ff9ebfa1969b6b49151851a8404ac8574dce2b7e03ee4f4b460de7eb7c38ff",
  "00bd78564dcffbf931641bd85b53d1a0d78596a963bb5f7604ed075043644781",
  "4c2ec8622f1bb4a04bc75d75a8e3575b2fafafa9c0a217d5266f8c75c3c8a6fe",
] as const;

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
    /account_ref\s*[:=]/i,
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
    /(?:authorizes|allows|approves|enables)\s+(?:web search|openrouter:web_search|`:online`|plugins?|tools?)/i,
    /(?:authorizes|allows|approves)\s+(?:paid fallback|production writes?|production deployment|runtime\/model-mode integration)/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened interpretation with ${pattern}`);
  }
}

function assertBroaderBatchStatus(text: string): void {
  assert.match(text, /broader live product preview batch sanitized execution status/i);
  assert.match(text, /approval PR was docs-only and did not execute the batch/i);
  assert.match(text, /live-product-preview-broader-batch-approval\.md/i);
  assert.match(text, /commit `10b26bc`/i);
  assert.match(text, /OpenRouter `owl-alpha`/i);
  assert.match(text, /`graph\.propose`/i);
  assert.match(text, /external-corpus\/live-product-preview-broader-batch\//i);
  assert.match(text, /selected roles: representative, edge-case, calibration/i);
  assert.match(text, /account slot count: 3/i);
  assert.match(text, /source-evidence screen passed count: 3/i);
  assert.match(text, /provider calls approved: 3/i);
  assert.match(text, /provider calls executed: 3/i);
  assert.match(text, /Workshop renders approved: 3/i);
  assert.match(text, /maximum output tokens per call: 900/i);
  assert.match(text, /temperature: 0/i);
  assert.match(text, /maximum batch cost: `\$1\.50`/i);
  assert.match(text, /cumulative broader-batch product-preview cap: `\$1\.50`/i);
  assert.match(text, /source-evidence screen: passed/i);
  assert.match(text, /screened slots: 3/i);
  assert.match(text, /signals_category_present: true/i);
  assert.match(text, /maps_category_present: true/i);
  assert.match(text, /plays_category_present: true/i);
  assert.match(text, /raw source text committed: false/i);
  assert.match(text, /prewrote graph objects: false/i);
  assert.match(text, /replacement accounts used: false/i);
  assert.match(text, /activation gates: passed for representative, edge-case, and calibration/i);
  assert.match(text, /credential status: passed for representative, edge-case, and calibration/i);
  assert.match(text, /provider call: passed for representative, edge-case, and calibration/i);
  assert.match(text, /response contract: passed for representative, edge-case, and calibration/i);
  assert.match(text, /cost ledger: succeeded for representative, edge-case, and calibration/i);
  assert.match(text, /full-pipeline packaging: passed for representative, edge-case, and calibration/i);
  assert.match(text, /bootstrap evidence verifier: passed for representative, edge-case, and calibration/i);
  assert.match(text, /Workshop preview: passed for representative, edge-case, and calibration/i);
  assert.match(text, /input tokens: 2833/i);
  assert.match(text, /output tokens: 2596/i);
  assert.match(text, /maximum output tokens per call records the request cap/i);
  assert.match(text, /provider-reported usage field/i);
  assert.match(text, /observed provider cost: \$0\.00/i);
  assert.match(text, /estimated ledger cost: \$0\.03/i);
  assert.match(text, /output counts: excerpts 9, claims 9, account_objects 9/i);
  assert.match(text, /graph-supported lens counts: Signals 3, Maps 3, Plays 3/i);
  assert.match(text, /lens evidence packet counts: Signals 3, Maps 3, Plays 3/i);
  assert.match(text, /Workshop provider calls made: 0/i);
  assert.match(text, /Workshop production writes: false/i);
  assert.match(text, /no_post_output_substitution_used: true/i);
  assert.match(text, /ok slot count: 3/i);
  for (const hash of MANIFEST_HASHES) {
    assert.match(text, new RegExp(hash));
  }
  assert.match(text, /tools_or_plugins_requested: false/i);
  assert.match(text, /online_model_variant_requested: false/i);
  assert.match(text, /web_search_requested: false/i);
  assert.match(text, /paid_fallback_used: false/i);
  assert.match(text, /private evidence retained outside the repository/i);
  assert.match(text, /committed private source text: false/i);
  assert.match(text, /production writes: none/i);
  assert.match(text, /runtime\/model-mode integration: none/i);
  assert.match(text, /provider_lock_in: false/i);
  assert.match(text, /launch_readiness_claim: false/i);
  assert.match(text, /product_readiness_claim: false/i);
  assert.match(text, /production_readiness_claim: false/i);
  assert.match(text, /broad_model_quality_claim: false/i);
  assert.match(text, /multi_account_readiness_claim: false/i);
  assert.match(text, /provider_or_model_comparison: false/i);
  assert.match(text, /corpus_expansion_beyond_approved_slots: false/i);
  assert.match(text, /does not imply launch readiness/i);
  assert.match(text, /does not imply product readiness/i);
  assert.match(text, /does not establish production readiness/i);
  assert.match(text, /does not establish broad model quality/i);
  assert.match(text, /does not establish multi-account readiness/i);
  assert.match(text, /not OpenRouter lock-in/i);
  assert.match(text, /not an `owl-alpha` quality conclusion/i);
  assert.match(text, /not a provider comparison/i);
  assert.match(text, /separate no-spend batch usefulness assessment/i);
  assert.match(text, /Any further provider run, provider comparison, corpus expansion beyond these three screened slots, web\/tool-enabled retrieval, paid fallback, production write, deployment, or runtime\/model-mode integration needs another separate approval packet/i);
}

test("safety: broader live product preview batch sanitized status", async (t) => {
  await t.test("records bounded three-slot execution facts without private evidence", () => {
    const docs = readRepoFile(STATUS_PATH);
    assertBroaderBatchStatus(docs);
    assertNoPrivateLeakage("broader batch status doc", docs);
    assertNoPositiveReadinessOrBroadening("broader batch status doc", docs);
  });

  await t.test("links the broader-batch status from durable handoff docs independently", () => {
    const docs = [
      ["broader batch approval", APPROVAL_PATH],
      ["three-lane status", THREE_LANE_STATUS_PATH],
      ["three-lane usefulness assessment", THREE_LANE_ASSESSMENT_PATH],
      ["usefulness gate", USEFULNESS_GATE_PATH],
      ["owl-alpha framing", OWL_ALPHA_PATH],
    ] as const;
    for (const [label, path] of docs) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-broader-batch-status\.md/i, `${label} must link broader-batch status doc`);
      assert.match(text, /broader|batch|product preview/i, `${label} must preserve broader-batch context`);
      assert.match(text, /launch_readiness_claim: false|no-readiness|not launch|does not imply launch readiness|does not prove launch readiness/i, `${label} must preserve no-readiness boundary`);
      assert.match(text, /runtime\/model-mode integration|runtime\/model-mode/i, `${label} must preserve runtime boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoPositiveReadinessOrBroadening(label, text);
    }
  });

  await t.test("preserves approval packet pre-run semantics while adding status handoff", () => {
    const approval = readRepoFile(APPROVAL_PATH);
    assert.match(approval, /Status: pre-run docs-only approval packet\. This PR does not execute the batch\./);
    assert.match(approval, /The later sanitized execution record is `live-product-preview-broader-batch-status\.md`\./);
    assert.match(approval, /not a standing approval/i);
    assert.match(approval, /exactly three screened account slots/i);
    assert.match(approval, /at most three `graph\.propose` provider calls/i);
    assert.match(approval, /no paid fallback/i);
    assert.match(approval, /no tools or plugins of any kind/i);
    assert.match(approval, /no provider comparison/i);
    assert.match(approval, /no production writes/i);
    assert.match(approval, /no runtime\/model-mode integration/i);
    assert.match(approval, /no launch, product, or production readiness claim/i);
    assert.match(approval, /Skipped or failed slots do not create authority to substitute replacement accounts inside this packet/i);
  });
});
