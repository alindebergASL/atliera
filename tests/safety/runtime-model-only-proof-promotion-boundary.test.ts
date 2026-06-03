import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "runbooks",
  "runtime-model-only-proof-promotion-boundary.md",
);

test("model-only proof promotion boundary keeps the completed tiny proof from authorizing broader runtime work", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-call promotion-boundary runbook/i,
    /gpt-5\.5-openai-codex-20260602a/i,
    /proof_status: completed/i,
    /provider_calls_executed: 1/i,
    /accepted_output_received: true/i,
    /output_source: delta/i,
    /only the following narrow facts/i,
    /approved route was reachable for one synthetic request/i,
    /model-only boundary/i,
    /delta-first stream collector/i,
    /tiny exact output contract/i,
    /default model selection/i,
    /provider lock-in/i,
    /provider comparison/i,
    /controlled-corpus validation/i,
    /product-preview validation/i,
    /Production or background orchestration/i,
    /Hermes-like orchestration may trigger predefined harness jobs only if explicitly authorized/i,
    /must not bypass the Atliera-owned harness/i,
    /next allowed work is no-call harness design/i,
    /fake-mode harness implementation/i,
    /fresh approval packet/i,
    /separate sanitized status record/i,
    /provider_call_executed_in_this_pr: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_controlled_corpus_run: false/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator: false/i,
    /authorizes_production_use: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
  ]) {
    assert.match(doc, required, `promotion boundary must contain ${required}`);
  }

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_controlled_corpus_run: true/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator: true/i,
    /authorizes_production_use: true/i,
    /provider_lock_in: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /default production model/i,
    /production ready/i,
    /launch ready/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `promotion boundary must not contain ${forbidden}`);
  }
});
