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
  "runtime-model-only-controlled-corpus-v2-status.md",
);

test("v2 controlled-corpus status records one sanitized completed run without usefulness or readiness claims", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: completed for one approved v2 corrected controlled-corpus model-only harness run/i,
    /Approval packet: `runtime-model-only-controlled-corpus-v2-approval-packet\.md`/i,
    /PR #193/i,
    /The approval has now been consumed/i,
    /A failed or completed run consumes this approval/i,
    /No retry was performed/i,
    /No further provider call is authorized/i,
    /job_id: controlled-corpus-v2-run-20260604a/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /corpus_ref: controlled-corpus\/model-only-harness-smoke-v1/i,
    /prompt_contract_ref: prompts\/controlled-corpus-model-only-v2/i,
    /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
    /status: completed/i,
    /reason_code: model_only_harness_v2_completed/i,
    /stable_error_code: none/i,
    /provider_calls_executed: 1/i,
    /transport_calls_observed_by_runner: 1/i,
    /accepted_output_received: true/i,
    /v2_contract_validated: true/i,
    /v2_account_ref_count: 3/i,
    /corpus_size: 3/i,
    /corpus_roles: representative, edge-case, calibration/i,
    /v2_counts\.excerpts: 9/i,
    /v2_counts\.claims: 7/i,
    /v2_counts\.account_objects: 3/i,
    /input_tokens_observed: 410/i,
    /output_tokens_observed: 886/i,
    /observed_cost_usd: 0/i,
    /approved_max_cost_usd: 1/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /raw_controlled_account_text_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /usefulness_evaluated: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /This status does not evaluate whether the output is useful/i,
    /The next safe step is a separate no-spend usefulness assessment/i,
  ]) {
    assert.match(doc, required, `status doc must contain ${required}`);
  }

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /provider_calls_executed: [2-9]/i,
    /transport_calls_observed_by_runner: [2-9]/i,
    /raw_request_committed: true/i,
    /raw_response_committed: true/i,
    /raw_controlled_account_text_committed: true/i,
    /model_output_committed: true/i,
    /private_evidence_committed: true/i,
    /usefulness_evaluated: true/i,
    /default_model_selection_claim: true/i,
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
    /exception\.private/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `status doc must not contain ${forbidden}`);
  }
});
