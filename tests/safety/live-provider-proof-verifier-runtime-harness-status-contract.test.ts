import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs/runbooks/live-provider-proof-verifier-runtime-harness-status.md");

function assertNoBroadening(label: string, doc: string): void {
  const forbidden = [
    /raw prompt/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider body/i,
    /provider metadata/i,
    /auth header/i,
    /credential value/i,
    /secret material/i,
    /local evidence location/i,
    /request id/i,
    /raw_provider_output_committed:\s*true/i,
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes_performed:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_comparison_claim:\s*true/i,
    /provider_quality_conclusion:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_future_runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /authorizes_production_use:\s*true/i,
    /provider_call_requires_new_approval:\s*false/i,
    /retry_requires_new_approval:\s*false/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(doc, pattern, `${label} contains ${pattern}`);
}

test("live proof verifier/runtime status documents steps 2-5 without broadening", () => {
  const status = readFileSync(STATUS_DOC, "utf8");
  assert.match(status, /status_id: live-provider-proof-verifier-runtime-harness-20260605e/i);
  assert.match(status, /deterministic_verifier_module: true/i);
  assert.match(status, /out_of_repo_verifier_cli_added: true/i);
  assert.match(status, /lab_test_only_runtime_model_execution_harness_added: true/i);
  assert.match(status, /validate_without_ingest_graphbundle_conversion_added: true/i);
  assert.match(status, /command_result: pass/i);
  assert.match(status, /tests_passed: 8/i);
  assert.match(status, /typecheck_result: pass/i);
  assert.match(status, /^- default_test_mode_provider_calls: 0$/im);
  assert.match(status, /^- committed_fixture_is_synthetic: true$/im);
  assert.match(status, /^- graph_ingestion_performed: false$/im);
  assert.match(status, /^- production_writes_performed: false$/im);
  assert.match(status, /rejects repository input paths and repository output paths/i);
  assert.match(status, /lab\/test only/i);
  assert.match(status, /validation only/i);
  assert.match(status, /^- provider_call_requires_new_approval: true$/im);
  assert.match(status, /^- retry_requires_new_approval: true$/im);
  assertNoBroadening("live proof verifier/runtime status", status);
});
