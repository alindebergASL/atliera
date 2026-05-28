import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ASSESSMENT_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-assessment.md");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-status.md");
const GATE_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-gate.md");
const FRAMING_DOC = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");
const STRATEGY_DOC = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const SCOPE_DOC = join(REPO_ROOT, "docs", "strategy", "product-facing-fake-mode-runtime-scope.md");
const INPUT_FIXTURE = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-20260528a-usefulness-input.json");
const ASSESSMENT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-20260528a-usefulness-assessment.json",
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
    /bearer\s+[A-Za-z0-9._-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
    /lab\d*\.[a-z0-9-]+\.[a-z]{2,}/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeBroadening(label: string, text: string): void {
  for (const pattern of [
    /(?:authorizes|approves|allows)\s+(?:a\s+)?(?:live provider call|provider spend|provider comparison|model comparison|corpus expansion|product-preview expansion|production write|production deployment|runtime\/model-mode integration|web search|tools?\/plugins?)/i,
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /corpus expansion (?:is )?(?:approved|authorized|allowed)/i,
    /product-preview expansion (?:is )?(?:approved|authorized|allowed)/i,
    /paid fallback (?:is )?(?:approved|authorized|allowed)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: applied live product preview usefulness assessment", async (t) => {
  await t.test("records a weak-but-valid no-spend assessment from sanitized facts only", () => {
    const docs = readRepoFile(ASSESSMENT_DOC);

    assert.match(docs, /Live Product Preview Usefulness Assessment/i);
    assert.match(docs, /Status: applied no-spend assessment/i);
    assert.match(docs, /assessLiveProductPreviewUsefulness\(\.\.\.\)/i);
    assert.match(docs, /live-product-preview-20260528a/i);
    assert.match(docs, /preview_usefulness_classification: `weak-but-valid`/i);
    assert.match(docs, /insufficient_useful_lenses/i);
    assert.match(docs, /useful_lens_count: 1/i);
    assert.match(docs, /useful_lenses: `signals`/i);
    assert.match(docs, /output counts: excerpts 1, claims 1, account_objects 1/i);
    assert.match(docs, /validation chain: passed/i);
    assert.match(docs, /request surface: no tools, no plugins, no online model variant, no web search/i);
    assert.match(docs, /Workshop side-effect boundary: HTML rendered, provider calls made 0, production writes false/i);
    assert.match(docs, /runtime\/model-mode integration: false/i);
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
    assert.match(docs, /next step is no-spend remediation/i);
    assertNoPrivateLeakage("assessment doc", docs);
    assertNoScopeBroadening("assessment doc", docs);
  });

  await t.test("keeps public fixtures sanitized and scoped to gate inputs and output", () => {
    const input = readRepoFile(INPUT_FIXTURE);
    const assessment = readRepoFile(ASSESSMENT_FIXTURE);
    for (const [label, text] of [
      ["assessment input fixture", input],
      ["assessment output fixture", assessment],
    ] as const) {
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
      assert.match(text, /live-product-preview-20260528a/i);
      assert.doesNotMatch(text, /raw[_ -]?(?:provider[_ -]?)?response|raw[_ -]?body|credential\s*(?:value|contents?)\s*[:=]|authorization\s*[:=]|bearer\s+[A-Za-z0-9._-]+/i);
    }
    assert.match(input, /"useful_lenses": \[\s*"signals"\s*\]/i);
    assert.match(assessment, /"preview_usefulness_classification": "weak-but-valid"/i);
    assert.match(assessment, /"approves_expansion_or_comparison": false/i);
  });

  await t.test("links the applied assessment from durable live-preview docs independently", () => {
    for (const [label, path] of [
      ["status", STATUS_DOC],
      ["gate", GATE_DOC],
      ["owl-alpha framing", FRAMING_DOC],
      ["strategy", STRATEGY_DOC],
      ["product fake-mode scope", SCOPE_DOC],
    ] as const) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-usefulness-assessment\.md/i, `${label} must link applied assessment`);
      assert.match(text, /weak-but-valid|usefulness assessment|no-spend/i, `${label} must preserve assessment context`);
      assert.match(text, /launch_readiness_claim: false|does not imply launch readiness|no-readiness/i, `${label} must preserve no-readiness boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
    }
  });
});
