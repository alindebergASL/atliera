import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const APPROVAL_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md",
);
const DIAGNOSIS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-exception-diagnosis.md",
);
const REMEDIATION_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-contract-remediation.md",
);

const REQUIRED_TYPES = [
  "account_snapshot",
  "signal",
  "risk",
  "play",
  "map",
  "relationship",
  "milestone",
  "recommendation",
  "stakeholder",
  "initiative",
  "open_question",
] as const;

const REQUIRED_SLOT_ROLES = ["representative", "edge-case", "calibration"] as const;

const requiredApprovalPatterns = [
  /Status: pre-run docs-only remediated approval packet\. This PR does not execute a provider call\./i,
  /approval_id: runtime-model-only-tiny-live-runtime-proof-remediated-20260605a/i,
  /approval_kind: three_slot_tiny_live_runtime_model_proof_remediated_suite/i,
  /source_status: `runtime-model-only-tiny-live-runtime-proof-fresh-status\.md`/i,
  /source_diagnosis: `runtime-model-only-tiny-live-runtime-proof-exception-diagnosis\.md`/i,
  /source_remediation: `runtime-model-only-tiny-live-runtime-proof-contract-remediation\.md`/i,
  /source_diagnosis_code: account_object_type_allowlist_mismatch/i,
  /max_attempts: 1/i,
  /max_provider_calls: 3/i,
  /approved_max_cost_usd: 3/i,
  /free_route_expected: true/i,
  /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i,
  /provider_ref: openai-codex/i,
  /model_label: gpt-5\.5/i,
  /transport_kind: model-only-codex-auth/i,
  /corpus_ref: runtime-model-only\/tiny-live-remediated-three-slot-v1/i,
  /route_kind: candidate/i,
  /pre_run_transport_interpreter: pinned-hermes-uv-project/i,
  /runtime_mode: model-only-smoke/i,
  /test_slots: 3/i,
  /historical_future_authorized_test_slot_count: 3/i,
  /historical_future_authorized_provider_call_count: 3/i,
  /historical_future_authorized_attempt_count: 1/i,
  /historical_future_execution_authorized_after_merge: true/i,
  /current_future_execution_authorized_after_status: false/i,
  /current_future_authorized_test_slot_count: 0/i,
  /current_future_authorized_provider_call_count: 0/i,
  /current_future_authorized_attempt_count: 0/i,
  /current_future_authorized_runtime_model_mode_suite: false/i,
  /approval_consumed_by_status: true/i,
  /status_followup: runtime-model-only-tiny-live-runtime-proof-remediated-status\.md/i,
  /current_pr_executes_provider_call: false/i,
  /provider_calls_executed_in_this_pr: 0/i,
  /provider_spend_in_this_pr: false/i,
  /npm run product-preview:plan/i,
  /run the no-provider-call planner before any provider access/i,
  /provider_calls_executed: 0/i,
  /authorizes_provider_call: false/i,
  /raw_private_evidence_read: false/i,
  /network_access_performed: false/i,
  /private_source_screening_required_before_each_slot: true/i,
  /stop_before_provider_access_if_preflight_fails: true/i,
  /stop_before_provider_access_if_route_is_not_expected_free_route: true/i,
  /no_retry_beyond_approved_three_slot_suite: true/i,
  /status_followup_required: true/i,
  /retry_requires_new_approval_after_suite: true/i,
  /authorizes_provider_comparison: false/i,
  /authorizes_default_model_selection: false/i,
  /authorizes_product_preview_expansion: false/i,
  /authorizes_tools: false/i,
  /authorizes_web_search: false/i,
  /authorizes_plugins: false/i,
  /authorizes_retrieval: false/i,
  /authorizes_graph_ingestion: false/i,
  /authorizes_production_use: false/i,
  /product_readiness_claim: false/i,
  /production_readiness_claim: false/i,
  /launch_readiness_claim: false/i,
  /provider_lock_in: false/i,
] as const;

const forbiddenBroadeningPatterns = [
  /^-\s*future_execution_authorized_after_merge:\s*true/im,
  /^-\s*future_authorized_runtime_model_mode_suite:\s*true/im,
  /^-\s*future_authorized_provider_call_count:\s*(?:[1-9]|\d{2,})\b/im,
  /^-\s*future_authorized_test_slot_count:\s*(?:[1-9]|\d{2,})\b/im,
  /^-\s*future_authorized_attempt_count:\s*(?:[1-9]|\d{2,})\b/im,
  /^-\s*authorizes_provider_call:\s*true/im,
  /max_attempts:\s*(?:[2-9]|\d{2,})\b/i,
  /max_provider_calls:\s*(?:[4-9]|\d{2,})\b/i,
  /future_authorized_provider_call_count:\s*(?:[4-9]|\d{2,})\b/i,
  /future_authorized_test_slot_count:\s*(?:[4-9]|\d{2,})\b/i,
  /approved_max_cost_usd:\s*(?:[4-9]|\d{2,})\b/i,
  /paid_fallback_allowed:\s*true/i,
  /retry_allowed_without_new_approval:\s*true/i,
  /authorizes_retry_after_suite:\s*true/i,
  /replacement_slots_allowed_without_new_approval:\s*true/i,
  /authorizes_provider_comparison:\s*true/i,
  /authorizes_default_model_selection:\s*true/i,
  /authorizes_product_preview_expansion:\s*true/i,
  /authorizes_tools:\s*true/i,
  /authorizes_web_search:\s*true/i,
  /authorizes_plugins:\s*true/i,
  /authorizes_retrieval:\s*true/i,
  /authorizes_graph_ingestion:\s*true/i,
  /authorizes_production_use:\s*true/i,
  /product_readiness_claim:\s*true/i,
  /production_readiness_claim:\s*true/i,
  /launch_readiness_claim:\s*true/i,
  /provider_lock_in:\s*true/i,
  /raw_request_committed:\s*true/i,
  /raw_response_committed:\s*true/i,
  /model_output_committed:\s*true/i,
  /private_evidence_committed:\s*true/i,
  /provider_payload_committed:\s*true/i,
  /credential_material_committed:\s*true/i,
  /request_identifier_committed:\s*true/i,
  /^-\s*tools:\s*true/im,
  /^-\s*web_search:\s*true/im,
  /^-\s*plugins:\s*true/im,
  /^-\s*mcp:\s*true/im,
  /^-\s*shell:\s*true/im,
  /^-\s*file_access:\s*true/im,
  /^-\s*retrieval:\s*true/im,
  /^-\s*session_carryover:\s*true/im,
  /^-\s*background_orchestrator:\s*true/im,
  /^-\s*production_writes:\s*true/im,
  /^-\s*graph_ingestion:\s*true/im,
  /^.*required_slot_roles:\s*representative, edge-case, calibration, exploratory.*$/im,
  /production ready/i,
  /launch ready/i,
  /default production model/i,
] as const;

const trueFlag = (name: string) => `${name}: ${"true"}`;

const broadeningContradictions = [
  "- future_execution_authorized_after_merge: true",
  "- future_authorized_runtime_model_mode_suite: true",
  "- future_authorized_provider_call_count: 1",
  "- future_authorized_test_slot_count: 1",
  "- future_authorized_attempt_count: 1",
  "- authorizes_provider_call: true",
  "max_attempts: 2",
  "max_provider_calls: 4",
  "max_provider_calls: 10",
  "future_authorized_provider_call_count: 4",
  "future_authorized_test_slot_count: 4",
  "approved_max_cost_usd: 4",
  trueFlag("paid_fallback_allowed"),
  trueFlag("retry_allowed_without_new_approval"),
  trueFlag("authorizes_retry_after_suite"),
  trueFlag("replacement_slots_allowed_without_new_approval"),
  trueFlag("authorizes_provider_comparison"),
  trueFlag("authorizes_default_model_selection"),
  trueFlag("authorizes_product_preview_expansion"),
  trueFlag("authorizes_tools"),
  trueFlag("authorizes_web_search"),
  trueFlag("authorizes_plugins"),
  trueFlag("authorizes_retrieval"),
  trueFlag("authorizes_graph_ingestion"),
  trueFlag("authorizes_production_use"),
  trueFlag("product_readiness_claim"),
  trueFlag("production_readiness_claim"),
  trueFlag("launch_readiness_claim"),
  trueFlag("provider_lock_in"),
  trueFlag("raw_request_committed"),
  trueFlag("raw_response_committed"),
  trueFlag("model_output_committed"),
  trueFlag("private_evidence_committed"),
  trueFlag("provider_payload_committed"),
  trueFlag("credential_material_committed"),
  trueFlag("request_identifier_committed"),
  `- tools: ${"true"}`,
  `- web_search: ${"true"}`,
  `- plugins: ${"true"}`,
  `- mcp: ${"true"}`,
  `- shell: ${"true"}`,
  `- file_access: ${"true"}`,
  `- retrieval: ${"true"}`,
  `- session_carryover: ${"true"}`,
  `- background_orchestrator: ${"true"}`,
  `- production_writes: ${"true"}`,
  `- graph_ingestion: ${"true"}`,
  "required_slot_roles: representative, edge-case, calibration, exploratory",
] as const;

function assertRemediatedApprovalContract(doc: string): void {
  for (const pattern of requiredApprovalPatterns) {
    assert.match(doc, pattern, `remediated approval packet must contain ${pattern}`);
  }

  for (const type of REQUIRED_TYPES) {
    assert.match(doc, new RegExp(`\\b${type}\\b`, "i"), `approval must list canonical type ${type}`);
  }

  for (const role of REQUIRED_SLOT_ROLES) {
    assert.match(doc, new RegExp(`\\b${role}\\b`, "i"), `approval must list slot role ${role}`);
  }
  assert.match(doc, /required_slot_roles: representative, edge-case, calibration/i);
  assert.doesNotMatch(
    doc,
    /^.*required_slot_roles: .*exploratory.*$/im,
    "forbidden broadening marker matched: required_slot_roles exploratory",
  );

  for (const pattern of forbiddenBroadeningPatterns) {
    assert.doesNotMatch(doc, pattern, `forbidden broadening marker matched: ${pattern}`);
  }
}

test("remediated tiny live runtime proof approval is docs-only, free-route, three-slot, and bounded", () => {
  const diagnosis = readFileSync(DIAGNOSIS_DOC, "utf8");
  const remediation = readFileSync(REMEDIATION_DOC, "utf8");
  const approval = readFileSync(APPROVAL_DOC, "utf8");

  assert.match(diagnosis, /stable_diagnosis_code: account_object_type_allowlist_mismatch/i);
  assert.match(remediation, /validator_allowlist_aligned: true/i);
  assert.match(remediation, /canonical_account_object_type_allowlist:/i);
  assert.match(remediation, /A corrected tiny live runtime proof retry.*must be requested in a separate docs\/tests-only approval packet/i);

  assertRemediatedApprovalContract(approval);
});

test("remediated approval contract rejects appended contradictory broadening markers", () => {
  const approval = readFileSync(APPROVAL_DOC, "utf8");
  for (const contradiction of broadeningContradictions) {
    assert.throws(
      () => assertRemediatedApprovalContract(`${approval}\n${contradiction}\n`),
      /forbidden broadening marker matched/,
      `expected contradiction to fail the contract: ${contradiction}`,
    );
  }
});
