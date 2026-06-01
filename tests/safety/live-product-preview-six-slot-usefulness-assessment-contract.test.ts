import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ASSESSMENT_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-six-slot-usefulness-assessment.md");
const SIX_SLOT_STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-six-slot-status.md");
const INPUT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-six-slot-20260601a-usefulness-input.json",
);
const ASSESSMENT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-six-slot-20260601a-usefulness-assessment.json",
);

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
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
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeBroadening(label: string, text: string): void {
  for (const pattern of [
    /(?:authorizes|approves|allows|enables)\s+(?:a\s+)?(?:live provider call|provider spend|provider comparison|model comparison|corpus expansion|product-preview expansion|production write|production deployment|runtime\/model-mode integration|web search|tools?\/plugins?)/i,
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /multi-account readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /product-preview expansion (?:is )?(?:approved|authorized|allowed)/i,
    /paid fallback (?:is )?(?:approved|authorized|allowed)/i,
    /readiness_claim"?\s*:\s*true/i,
    /web_search_requested"?\s*:\s*true/i,
    /tools_or_plugins_requested"?\s*:\s*true/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: six-slot live product preview usefulness assessment", async (t) => {
  await t.test("records a useful no-spend six-slot assessment from sanitized facts only", () => {
    const docs = readRepoFile(ASSESSMENT_DOC);

    assert.match(docs, /Six-Slot Live Product Preview Usefulness Assessment/i);
    assert.match(docs, /Status: applied no-spend assessment/i);
    assert.match(docs, /assessLiveProductPreviewUsefulness\(\.\.\.\)/i);
    assert.match(docs, /live-product-preview-six-slot-20260601a/i);
    assert.match(docs, /preview_usefulness_classification: `useful`/i);
    assert.match(docs, /reason count: 0/i);
    assert.match(docs, /account_count: 6/i);
    assert.match(docs, /provider_calls_executed: 6/i);
    assert.match(docs, /output counts: excerpts 18, claims 18, account_objects 18/i);
    assert.match(docs, /per-account graph-output floor: each selected role has at least one of each graph fact type/i);
    assert.match(docs, /useful_lens_count: 3/i);
    assert.match(docs, /useful_lenses: `signals`, `maps`, `plays`/i);
    assert.match(docs, /selected roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control/i);
    assert.match(docs, /validation chain: passed/i);
    assert.match(docs, /request surface: no tools, no plugins, no online model variant, no web search/i);
    assert.match(docs, /Workshop side-effect boundary: HTML rendered, provider calls made 0, production writes false/i);
    assert.match(docs, /runtime\/model-mode integration: false/i);
    assert.match(docs, /Sparse-control caveat/i);
    assert.match(docs, /does not prove that sparse accounts are broadly product-ready/i);
    assert.match(docs, /launch_readiness_claim: false/i);
    assert.match(docs, /product_readiness_claim: false/i);
    assert.match(docs, /production_readiness_claim: false/i);
    assert.match(docs, /approves_expansion_or_comparison: false/i);
    assert.match(docs, /live_provider_call: false/i);
    assert.match(docs, /provider_spend: false/i);
    assert.match(docs, /provider_or_model_comparison: false/i);
    assert.match(docs, /corpus_expansion: false/i);
    assert.match(docs, /product_preview_expansion: false/i);
    assert.match(docs, /web_search_or_tools: false/i);
    assert.match(docs, /does not approve expansion/i);
    assert.match(docs, /does not approve comparison/i);
    assert.match(docs, /does not request another provider call/i);
    assert.match(docs, /separate approval packet/i);
    assertNoPrivateLeakage("six-slot assessment doc", docs);
    assertNoScopeBroadening("six-slot assessment doc", docs);
  });

  await t.test("keeps public six-slot fixtures sanitized and scoped to gate inputs and output", () => {
    const input = readRepoFile(INPUT_FIXTURE);
    const assessment = readRepoFile(ASSESSMENT_FIXTURE);
    for (const [label, text] of [
      ["six-slot assessment input fixture", input],
      ["six-slot assessment output fixture", assessment],
    ] as const) {
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
      assert.match(text, /live-product-preview-six-slot-20260601a/i);
      assert.doesNotMatch(text, /raw[_ -]?(?:provider[_ -]?)?response|credential\s*(?:value|contents?)\s*[:=]|authorization\s*[:=]|bearer\s+[A-Za-z0-9._~+/=-]+/i);
    }
    assert.match(input, /"account_count": 6/i);
    assert.match(input, /"provider_calls_executed": 6/i);
    assert.match(input, /"slot_output_counts"/i);
    assert.match(input, /"role": "representative-a"/i);
    assert.match(input, /"role": "representative-b"/i);
    assert.match(input, /"role": "edge-case-a"/i);
    assert.match(input, /"role": "edge-case-b"/i);
    assert.match(input, /"role": "calibration"/i);
    assert.match(input, /"role": "sparse-control"/i);
    assert.match(input, /"useful_lenses": \[\s*"signals",\s*"maps",\s*"plays"\s*\]/i);
    assert.match(assessment, /"slot_output_counts"/i);
    assert.match(assessment, /"preview_usefulness_classification": "useful"/i);
    assert.match(assessment, /"approves_expansion_or_comparison": false/i);
    assert.match(assessment, /"reasons": \[\]/i);
  });

  await t.test("links the six-slot assessment from the status handoff", () => {
    const status = readRepoFile(SIX_SLOT_STATUS_DOC);
    assert.match(status, /live-product-preview-six-slot-usefulness-assessment\.md/i);
    assert.match(status, /separate no-spend six-slot usefulness assessment/i);
    assert.match(status, /launch_readiness_claim: false|does not imply launch readiness/i);
    assertNoPrivateLeakage("six-slot status doc", status);
    assertNoScopeBroadening("six-slot status doc", status);
  });
});
