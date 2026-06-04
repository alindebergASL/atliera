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
  "runtime-model-only-controlled-corpus-v2-usefulness-status.md",
);

test("v2 usefulness status uses only sanitized facts and stops before product preview approval", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-spend v2 usefulness-readiness assessment/i,
    /Source status: `runtime-model-only-controlled-corpus-v2-status\.md`/i,
    /uses only sanitized v2 status facts/i,
    /does not read raw provider output/i,
    /does not read model output text/i,
    /does not execute a provider call/i,
    /provider_calls_executed_by_assessment: 0/i,
    /provider_spend_by_assessment: false/i,
    /assessment_status: structural_pass_usefulness_deferred/i,
    /v2_contract_validated: true/i,
    /v2_account_ref_count: 3/i,
    /v2_counts\.excerpts: 9/i,
    /v2_counts\.claims: 7/i,
    /v2_counts\.account_objects: 3/i,
    /hard_blockers_remaining: false/i,
    /material_usefulness_evaluated: false/i,
    /product-preview approval recommended: false/i,
    /next step: no-spend sanitized per-account usefulness rubric/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]) {
    assert.match(doc, required, `usefulness doc must contain ${required}`);
  }

  for (const forbidden of [
    /provider_calls_executed_by_assessment: [1-9]/i,
    /provider_spend_by_assessment: true/i,
    /material_usefulness_evaluated: true/i,
    /product-preview approval recommended: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /provider_lock_in: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    /private-provider-evidence/i,
    /raw_provider_output_text/i,
    /raw_harness_transport_request/i,
    /raw_provider_metadata/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `usefulness doc must not contain ${forbidden}`);
  }
});
