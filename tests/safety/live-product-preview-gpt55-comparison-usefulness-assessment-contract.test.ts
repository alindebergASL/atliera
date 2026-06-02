import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ASSESSMENT_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-usefulness-assessment.md");
const GPT55_STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-status.md");
const INPUT_FIXTURE = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-gpt55-vs-owl-alpha-usefulness-input.json");
const ASSESSMENT_FIXTURE = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-gpt55-vs-owl-alpha-usefulness-assessment.json");
const GPT55_USEFULNESS_INPUT = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-gpt55-comparison-20260602a-usefulness-input.json");
const GPT55_USEFULNESS_OUTPUT = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-gpt55-comparison-20260602a-usefulness-assessment.json");

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
    /["']?api[_-]?key["']?\s*[:=]/i,
    /["']?raw[_ -]?(?:provider[_ -]?)?(?:request|response|body|transcript)["']?\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /["']?source_text["']?\s*[:=]/i,
    /["']?account_ref["']?\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeBroadening(label: string, text: string): void {
  for (const pattern of [
    /(?:authorizes|approves|allows|enables)\s+(?:a\s+)?(?:live provider call|provider spend|provider comparison|model comparison|corpus expansion|product-preview expansion|production write|production deployment|runtime\/model-mode integration|web search|tools?\/plugins?)/i,
    /(?:selects|sets|chooses)\s+gpt-5\.5\s+as\s+(?:the\s+)?(?:default|production)/i,
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /provider lock-?in (?:is )?(?:approved|selected|required|established)/i,
    /readiness_claim"?\s*:\s*true/i,
    /default_model_selection_claim"?\s*:\s*true/i,
    /provider_lock_in"?\s*:\s*true/i,
    /approves_provider_call"?\s*:\s*true/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: GPT-5.5 versus owl-alpha comparison usefulness assessment", async (t) => {
  await t.test("records a no-spend comparison usefulness assessment from sanitized facts only", () => {
    const docs = readRepoFile(ASSESSMENT_DOC);

    assert.match(docs, /GPT-5\.5 Versus Owl Alpha Usefulness Assessment/i);
    assert.match(docs, /Status: applied no-spend comparison usefulness assessment/i);
    assert.match(docs, /compareLiveProductPreviewProviderUsefulness\(\.\.\.\)/i);
    assert.match(docs, /baseline: `owl-alpha` from `live-product-preview-six-slot-20260601a`/i);
    assert.match(docs, /candidate: `gpt-5\.5` via `openai-codex` from `live-product-preview-gpt55-comparison-20260602a`/i);
    assert.match(docs, /comparison_usefulness_classification: `candidate-comparable-useful`/i);
    assert.match(docs, /recommended_next_step: `provider-neutral-runtime-integration-planning`/i);
    assert.match(docs, /baseline preview_usefulness_classification: `useful`/i);
    assert.match(docs, /candidate preview_usefulness_classification: `useful`/i);
    assert.match(docs, /output count delta: excerpts 0, claims 0, account_objects 0/i);
    assert.match(docs, /useful_lens_count delta: 0/i);
    assert.match(docs, /output token delta: -687/i);
    assert.match(docs, /estimated_cost_usd delta: 0/i);
    assert.match(docs, /live_provider_call: false/i);
    assert.match(docs, /provider_spend: false/i);
    assert.match(docs, /raw_private_evidence_read: false/i);
    assert.match(docs, /runtime_model_mode_integration: false/i);
    assert.match(docs, /provider_or_model_selection: false/i);
    assert.match(docs, /corpus_expansion: false/i);
    assert.match(docs, /product_preview_expansion: false/i);
    assert.match(docs, /web_search_or_tools: false/i);
    assert.match(docs, /launch_readiness_claim: false/i);
    assert.match(docs, /product_readiness_claim: false/i);
    assert.match(docs, /production_readiness_claim: false/i);
    assert.match(docs, /default_model_selection_claim: false/i);
    assert.match(docs, /provider_lock_in: false/i);
    assert.match(docs, /approves_provider_call: false/i);
    assert.match(docs, /approves_expansion_or_comparison: false/i);
    assert.match(docs, /does not select GPT-5\.5 as a default production model/i);
    assert.match(docs, /does not deprecate `owl-alpha`/i);
    assertNoPrivateLeakage("comparison usefulness doc", docs);
    assertNoScopeBroadening("comparison usefulness doc", docs);
  });

  await t.test("keeps public comparison fixtures sanitized and scoped", () => {
    for (const [label, path] of [
      ["GPT-5.5 usefulness input", GPT55_USEFULNESS_INPUT],
      ["GPT-5.5 usefulness output", GPT55_USEFULNESS_OUTPUT],
      ["comparison usefulness input", INPUT_FIXTURE],
      ["comparison usefulness output", ASSESSMENT_FIXTURE],
    ] as const) {
      const text = readRepoFile(path);
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
      assert.doesNotMatch(text, /raw[_ -]?(?:provider[_ -]?)?(?:request|response|body|transcript)|credential\s*(?:value|contents?)\s*[:=]/i);
    }

    const assessment = readRepoFile(ASSESSMENT_FIXTURE);
    assert.match(assessment, /"comparison_usefulness_classification": "candidate-comparable-useful"/i);
    assert.match(assessment, /"recommended_next_step": "provider-neutral-runtime-integration-planning"/i);
    assert.match(assessment, /"output_tokens": -687/i);
    assert.match(assessment, /"default_model_selection_claim": false/i);
    assert.match(assessment, /"approves_provider_call": false/i);
  });

  await t.test("links the no-spend assessment from the GPT-5.5 status handoff", () => {
    const status = readRepoFile(GPT55_STATUS_DOC);
    assert.match(status, /live-product-preview-gpt55-comparison-usefulness-assessment\.md/i);
    assert.match(status, /no-spend comparison usefulness assessment/i);
    assertNoPrivateLeakage("GPT-5.5 comparison status", status);
    assertNoScopeBroadening("GPT-5.5 comparison status", status);
  });
});
