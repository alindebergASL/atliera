import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-product-preview-retry-status.md");

test("product-preview retry status records sanitized completion without authorizing follow-up actions", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: completed for one approved model-only product-preview retry/i,
    /Retry approval packet: `runtime-model-only-product-preview-retry-approval-packet\.md`/i,
    /Prior consumed approval status: `runtime-model-only-product-preview-status\.md`/i,
    /Transport remediation: `runtime-model-only-product-preview-transport-remediation\.md`/i,
    /approval_consumed: true/i,
    /retry_requires_new_approval: true/i,
    /job_id: product-preview-retry-20260604b/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /corpus_ref: product-preview\/single-screened-account-v1/i,
    /prompt_contract_ref: prompts\/product-preview-model-only-v1/i,
    /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
    /screened_account_slots: 1/i,
    /status: completed/i,
    /reason_code: model_only_product_preview_completed/i,
    /stable_error_code: none/i,
    /provider_calls_executed: 1/i,
    /transport_calls_observed_by_runner: 1/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /v2_excerpts: 4/i,
    /v2_claims: 3/i,
    /v2_account_objects: 1/i,
    /account_ref_count: 1/i,
    /input_tokens_observed: 352/i,
    /output_tokens_observed: 450/i,
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
    /usefulness_evaluated: false/i,
    /bounded historical product-preview transport and contract signal only/i,
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
    /product ready/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
    /private-provider-evidence/i,
    /raw_provider_output_text/i,
    /raw_harness_transport_request/i,
    /raw_provider_metadata/i,
    /HarborOps/i,
  ]) assert.doesNotMatch(doc, forbidden);
});
