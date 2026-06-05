import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DIAGNOSIS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-exception-diagnosis.md",
);
const FRESH_STATUS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-fresh-status.md",
);

function assertNoLeakageOrBroadening(label: string, doc: string): void {
  const forbidden = [
    /raw prompt/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider body/i,
    /wrapper log/i,
    /auth header/i,
    /credential value/i,
    /secret material/i,
    /source material/i,
    /local evidence location/i,
    /private[-_ ]provider[-_ ]evidence/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /retry is authorized/i,
    /may retry without/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

test("tiny live runtime proof exception diagnosis isolates v2 allowlist mismatch without retry authorization", () => {
  const diagnosis = readFileSync(DIAGNOSIS_DOC, "utf8");
  const freshStatus = readFileSync(FRESH_STATUS_DOC, "utf8");

  assert.match(freshStatus, /Status: exception/i);
  assert.match(freshStatus, /provider_calls_executed: 1/i);
  assert.match(freshStatus, /accepted_output_received: false/i);
  assert.match(freshStatus, /v2_contract_validated: false/i);
  assert.match(freshStatus, /retry_requires_new_approval: true/i);

  assert.match(diagnosis, /Status: diagnosed/i);
  assert.match(diagnosis, /diagnosed_status_ref: `runtime-model-only-tiny-live-runtime-proof-fresh-status\.md`/i);
  assert.match(diagnosis, /approval_id: runtime-model-only-tiny-live-runtime-proof-fresh-20260604k/i);
  assert.match(diagnosis, /previous_status: exception/i);
  assert.match(diagnosis, /previous_provider_calls_executed: 1/i);
  assert.match(diagnosis, /previous_retry_attempted: false/i);
  assert.match(diagnosis, /diagnosis_provider_calls_executed: 0/i);
  assert.match(diagnosis, /diagnosis_provider_spend: false/i);
  assert.match(diagnosis, /diagnosis_observed_cost_usd: 0/i);

  assert.match(diagnosis, /request_shape_failure: false/i);
  assert.match(diagnosis, /transport_parsing_failure: false/i);
  assert.match(diagnosis, /streaming_event_handling_failure: false/i);
  assert.match(diagnosis, /v2_contract_mismatch: true/i);
  assert.match(diagnosis, /root_cause_bucket: prompt_contract_to_v2_allowlist_mismatch/i);
  assert.match(diagnosis, /failing_contract_gate: account_object_type_allowlist/i);
  assert.match(diagnosis, /stable_diagnosis_code: account_object_type_allowlist_mismatch/i);
  assert.match(diagnosis, /strict JSON parsing succeeded/i);
  assert.match(diagnosis, /account-object type check/i);
  assert.match(diagnosis, /runtime-model-only-tiny-live-runtime-proof-contract-remediation\.md/i);
  assert.match(diagnosis, /A separate fresh one-call approval is still required/i);

  assert.match(diagnosis, /Enumerate the exact account-object type allowlist/i);
  assert.match(diagnosis, /prove that the prompt contract and validator allowlist are aligned/i);
  assert.match(diagnosis, /authorizes_provider_call: false/i);
  assert.match(diagnosis, /authorizes_retry: false/i);
  assert.match(diagnosis, /authorizes_runtime_model_mode_execution: false/i);
  assert.match(diagnosis, /authorizes_provider_comparison: false/i);
  assert.match(diagnosis, /authorizes_product_preview_expansion: false/i);
  assert.match(diagnosis, /authorizes_default_model_selection: false/i);
  assert.match(diagnosis, /authorizes_tools: false/i);
  assert.match(diagnosis, /authorizes_web_search: false/i);
  assert.match(diagnosis, /authorizes_plugins: false/i);
  assert.match(diagnosis, /authorizes_retrieval: false/i);
  assert.match(diagnosis, /graph_ingestion_performed: false/i);
  assert.match(diagnosis, /production_writes: false/i);
  assert.match(diagnosis, /product_readiness_claim: false/i);
  assert.match(diagnosis, /production_readiness_claim: false/i);
  assert.match(diagnosis, /launch_readiness_claim: false/i);
  assert.match(diagnosis, /retry_requires_new_approval: true/i);

  assertNoLeakageOrBroadening("tiny live exception diagnosis", diagnosis);
});
