import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-product-preview-status.md");

test("product-preview status records sanitized blocked exception without retry/readiness claims", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const required of [
    /Status: exception for one approved model-only product-preview attempt/i,
    /Approval packet: `runtime-model-only-product-preview-approval-packet\.md`/i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /status: exception/i,
    /reason_code: model_only_product_preview_transport_dependency_unavailable/i,
    /stable_error_code: private_transport_dependency_unavailable/i,
    /provider_api_requests_executed: 0/i,
    /transport_calls_observed_by_runner: 1/i,
    /harness_transport_invocation_counter: 1/i,
    /accepted_output_received: false/i,
    /v2_contract_validated: false/i,
    /screened_account_slots: 1/i,
    /approved_max_cost_usd: 1/i,
    /observed_cost_usd: 0/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /raw_screened_account_text_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
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
  ]) assert.doesNotMatch(doc, forbidden);
});
