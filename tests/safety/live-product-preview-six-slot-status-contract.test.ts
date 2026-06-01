import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-six-slot-status.md");
const APPROVAL_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-six-slot-approval.md");

const MANIFEST_HASHES = [
  "a3bb8fda0ce49aebc53fb281ce2245639e67b74717cb80d34feb6e9a040e41a4",
  "6a5ae5bbb4a3e702ca570478c96c852ba0dce3af982fa49604ffe8da476d49ce",
  "003ba3cf56ce7eae0f67dd0d55103f85ddf1a328df087b0d3f8aaa2f7e6a2928",
  "ecdc8a46e26b950f5f18da3755077fcdda4074c742781c948aa98120c7b9d0a3",
  "8af8b20d514f400ba0a89fbeec301bee647a9682cecd0e6309462974f4412e56",
  "ab6082dbe0fc97ef32c9f0911592f6c266ec411d885931c8591eee90812da20d",
] as const;

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  const forbiddenPatterns = [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /raw[_ -]?prompt\s*[:=]/i,
    /prompt material\s*[:=]/i,
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

test("safety: six-slot live product preview sanitized status", async (t) => {
  await t.test("records bounded six-slot execution facts without private evidence", () => {
    const docs = readRepoFile(STATUS_PATH);
    assert.match(docs, /six-slot live product-preview slice/i);
    assert.match(docs, /approval PR was docs-only and did not execute the slice/i);
    assert.match(docs, /live-product-preview-six-slot-approval\.md/i);
    assert.match(docs, /commit `6451767`/i);
    assert.match(docs, /OpenRouter `owl-alpha`/i);
    assert.match(docs, /`graph\.propose`/i);
    assert.match(docs, /external-corpus\/live-product-preview-six-slot\//i);
    assert.match(docs, /selected roles: representative, representative, edge-case, edge-case, calibration, sparse-control/i);
    assert.match(docs, /account slot count: 6/i);
    assert.match(docs, /source-evidence screen passed count: 6/i);
    assert.match(docs, /provider calls approved: 6/i);
    assert.match(docs, /provider calls executed: 6/i);
    assert.match(docs, /Workshop renders approved: 6/i);
    assert.match(docs, /maximum output tokens per call: 900/i);
    assert.match(docs, /temperature: 0/i);
    assert.match(docs, /maximum slice cost: `\$3\.00`/i);
    assert.match(docs, /cumulative six-slot product-preview cap: `\$3\.00`/i);
    assert.match(docs, /source-evidence screen: passed/i);
    assert.match(docs, /screened slots: 6/i);
    assert.match(docs, /representative slots passed: 2/i);
    assert.match(docs, /edge-case slots passed: 2/i);
    assert.match(docs, /calibration slots passed: 1/i);
    assert.match(docs, /sparse-control slots passed: 1/i);
    assert.match(docs, /signals_category_present: true/i);
    assert.match(docs, /maps_category_present: true/i);
    assert.match(docs, /plays_category_present: true/i);
    assert.match(docs, /raw source text committed: false/i);
    assert.match(docs, /prewrote graph objects: false/i);
    assert.match(docs, /replacement accounts used: false/i);
    assertNoPrivateLeakage("six-slot status doc", docs);
    assertNoPositiveReadinessOrBroadening("six-slot status doc", docs);
  });

  await t.test("records all validation layers, counts, costs, and boundaries", () => {
    const docs = readRepoFile(STATUS_PATH);
    for (const required of [
      /activation gates: passed/i,
      /credential status: passed/i,
      /provider call: passed/i,
      /response contract: passed/i,
      /cost ledger: succeeded/i,
      /full-pipeline packaging: passed/i,
      /bootstrap evidence verifier: passed/i,
      /Workshop preview: passed/i,
      /input tokens: 5958/i,
      /output tokens: 5317/i,
      /observed provider cost: \$0\.00/i,
      /estimated ledger cost: \$0\.06/i,
      /output counts: excerpts 18, claims 18, account_objects 18/i,
      /graph-supported lens counts: Signals 6, Maps 6, Plays 6/i,
      /lens evidence packet counts: Signals 6, Maps 6, Plays 6/i,
      /Workshop provider calls made: 0/i,
      /Workshop production writes: false/i,
      /no_post_output_substitution_used: true/i,
      /ok slot count: 6/i,
      /tools_or_plugins_requested: false/i,
      /online_model_variant_requested: false/i,
      /web_search_requested: false/i,
      /paid_fallback_used: false/i,
      /private evidence retained outside the repository/i,
      /committed private source text: false/i,
      /production writes: none/i,
      /runtime\/model-mode integration: none/i,
      /provider_lock_in: false/i,
      /launch_readiness_claim: false/i,
      /product_readiness_claim: false/i,
      /production_readiness_claim: false/i,
      /broad_model_quality_claim: false/i,
      /multi_account_readiness_claim: false/i,
      /provider_or_model_comparison: false/i,
      /corpus_expansion_beyond_approved_slots: false/i,
    ]) {
      assert.match(docs, required);
    }
    for (const hash of MANIFEST_HASHES) {
      assert.match(docs, new RegExp(hash));
    }
    assertNoPrivateLeakage("six-slot status doc", docs);
    assertNoPositiveReadinessOrBroadening("six-slot status doc", docs);
  });

  await t.test("preserves interpretation limits and next no-spend assessment step", () => {
    const docs = readRepoFile(STATUS_PATH);
    assert.match(docs, /Sparse-control interpretation/i);
    assert.match(docs, /bounded historical observation from one screened low-evidence control slot/i);
    assert.match(docs, /not evidence that sparse accounts are broadly product-ready/i);
    assert.match(docs, /does not imply launch readiness/i);
    assert.match(docs, /does not imply product readiness/i);
    assert.match(docs, /does not establish production readiness/i);
    assert.match(docs, /does not establish broad model quality/i);
    assert.match(docs, /does not establish multi-account readiness/i);
    assert.match(docs, /not OpenRouter lock-in/i);
    assert.match(docs, /not an `owl-alpha` quality conclusion/i);
    assert.match(docs, /not a provider comparison/i);
    assert.match(docs, /separate no-spend six-slot usefulness assessment/i);
    assert.match(docs, /Any further provider run, provider comparison, corpus expansion beyond these six screened slots, web\/tool-enabled retrieval, paid fallback, production write, deployment, or runtime\/model-mode integration needs another separate approval packet/i);
    assertNoPrivateLeakage("six-slot status doc", docs);
    assertNoPositiveReadinessOrBroadening("six-slot status doc", docs);
  });

  await t.test("preserves approval packet pre-run semantics while linking status", () => {
    const approval = readRepoFile(APPROVAL_PATH);
    assert.match(approval, /Status: pre-run docs-only approval packet\. This PR does not execute the slice\./);
    assert.match(approval, /The later sanitized execution record is `live-product-preview-six-slot-status\.md`\./);
    assert.match(approval, /not a standing approval/i);
    assert.match(approval, /exactly six screened account slots/i);
    assert.match(approval, /at most six `graph\.propose` provider calls/i);
    assert.match(approval, /no paid fallback/i);
    assert.match(approval, /no tools or plugins of any kind/i);
    assert.match(approval, /no provider comparison/i);
    assert.match(approval, /no production writes/i);
    assert.match(approval, /no runtime\/model-mode integration/i);
    assert.match(approval, /no launch, product, or production readiness claim/i);
    assert.match(approval, /Skipped or failed slots do not create authority to substitute replacement accounts inside this packet/i);
    assertNoPrivateLeakage("six-slot approval doc", approval);
    assertNoPositiveReadinessOrBroadening("six-slot approval doc", approval);
  });
});
