import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ASSESSMENT_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md",
);
const STATUS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-status.md",
);
const APPROVAL_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md",
);

const REQUIRED_SLOT_ROLES = ["representative", "edge-case", "calibration"] as const;

function assertNoAssessmentLeakageOrBroadening(label: string, doc: string): void {
  const forbidden = [
    /raw prompt/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider body/i,
    /provider metadata/i,
    /wrapper log/i,
    /auth header/i,
    /credential value/i,
    /secret material/i,
    /source material/i,
    /account reference/i,
    /local evidence location/i,
    /private[-_ ]provider[-_ ]evidence/i,
    /request id/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_future_runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /authorizes_production_use:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes:\s*true/i,
    /assessment_provider_calls_executed:\s*(?:[1-9]|\d{2,})\b/i,
    /assessment_provider_spend:\s*true/i,
    /assessment_private_evidence_read:\s*true/i,
    /assessment_network_access:\s*true/i,
    /assessment_production_writes:\s*true/i,
    /next_allowed_work:\s*provider call/i,
    /next_allowed_work:\s*retry/i,
    /next_allowed_work:\s*provider comparison/i,
    /next_allowed_work:\s*product-preview expansion/i,
    /provider_call_requires_new_approval:\s*false/i,
    /retry_requires_new_approval:\s*false/i,
    /default_model_selection_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /^-\s*provider_payload_committed:\s*true/im,
    /^-\s*model_output_committed:\s*true/im,
    /^-\s*private_evidence_committed:\s*true/im,
    /^-\s*credential_material_committed:\s*true/im,
    /^-\s*request_identifier_committed:\s*true/im,
    /^-\s*request_identifier(?:_ref)?:/im,
    /^-\s*request_id(?:_ref)?:/im,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    /may retry without/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

function getSlotBlock(doc: string, role: string): string {
  const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = doc.match(new RegExp(`^- slot_role: ${escapedRole}\\n([\\s\\S]*?)(?=^- slot_role: |^## Classification)`, "im"));
  assert.ok(match, `assessment must contain isolated ${role} slot block`);
  return match[0];
}

test("remediated tiny live proof assessment is no-spend and classifies only a bounded contract signal", () => {
  const assessment = readFileSync(ASSESSMENT_DOC, "utf8");
  const status = readFileSync(STATUS_DOC, "utf8");
  const approval = readFileSync(APPROVAL_DOC, "utf8");

  assert.match(status, /Status: completed for one approved remediated three-slot tiny live runtime\/model proof suite/i);
  assert.match(status, /^- provider_calls_executed: 3$/im);
  assert.match(status, /^- slots_executed: 3$/im);
  assert.match(approval, /current_future_authorized_provider_call_count: 0/i);
  assert.match(approval, /current_authorizes_retry_after_suite: false/i);

  assert.match(assessment, /Status: no-spend assessment over the sanitized remediated tiny live runtime\/model proof status/i);
  assert.match(assessment, /assessment_id: runtime-model-only-tiny-live-runtime-proof-remediated-assessment-20260605a/i);
  assert.match(assessment, /status_ref: runtime-model-only-tiny-live-runtime-proof-remediated-status\.md/i);
  assert.match(assessment, /approval_ref: runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet\.md/i);
  assert.match(assessment, /assessed_approval_consumed: true/i);
  assert.match(assessment, /assessed_route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(assessment, /assessed_provider_ref: openai-codex/i);
  assert.match(assessment, /assessed_model_label: gpt-5\.5/i);
  assert.match(assessment, /assessed_transport_kind: model-only-codex-auth/i);
  assert.match(assessment, /assessment_provider_calls_executed: 0/i);
  assert.match(assessment, /assessment_provider_spend: false/i);
  assert.match(assessment, /assessment_private_evidence_read: false/i);
  assert.match(assessment, /assessment_network_access: false/i);
  assert.match(assessment, /assessment_production_writes: false/i);

  assert.match(assessment, /approved_future_slots: 3/i);
  assert.match(assessment, /slots_executed: 3/i);
  assert.match(assessment, /provider_calls_recorded_by_status: 3/i);
  assert.match(assessment, /total_output_counts: excerpts 12, claims 9, account_objects 12/i);

  const slotRoles = [...assessment.matchAll(/^- slot_role: (.+)$/gim)].map((match) => match[1]);
  assert.deepEqual(slotRoles, [...REQUIRED_SLOT_ROLES]);

  for (const role of REQUIRED_SLOT_ROLES) {
    const block = getSlotBlock(assessment, role);
    assert.match(block, new RegExp(`^- slot_role: ${role}$`, "im"));
    assert.match(block, /^  - status_fact: completed$/im);
    assert.match(block, /^  - provider_calls_recorded_by_status: 1$/im);
    assert.match(block, /^  - accepted_output_received: true$/im);
    assert.match(block, /^  - v2_contract_validated: true$/im);
    assert.match(block, /^  - output_counts: excerpts 4, claims 3, account_objects 4$/im);
    assert.match(block, /^  - underproduced_against_suite_floor: false$/im);
  }

  assert.match(assessment, /assessment_classification: useful_but_bounded_contract_signal/i);
  assert.match(assessment, /reason_code: remediated_three_slot_suite_contract_useful/i);
  assert.match(assessment, /minimum_role_coverage_met: true/i);
  assert.match(assessment, /all_slots_contract_valid: true/i);
  assert.match(assessment, /all_slots_returned_accepted_public_output: true/i);
  assert.match(assessment, /remediation_cleared_previous_allowlist_mismatch: true/i);
  assert.match(assessment, /product_quality_signal: not_evaluated/i);
  assert.match(assessment, /provider_quality_signal: not_evaluated/i);
  assert.match(assessment, /graph_ingestion_signal: not_evaluated/i);
  assert.match(assessment, /readiness_signal: not_evaluated/i);
  assert.match(assessment, /useful enough to justify provider-neutral no-call route planning and no-call integration tests/i);

  assert.match(assessment, /next_allowed_work: provider-neutral no-call route-chain planning/i);
  assert.match(assessment, /next_allowed_work: no-call route catalog and explicit route-selection tests/i);
  assert.match(assessment, /next_disallowed_without_new_approval: provider call/i);
  assert.match(assessment, /next_disallowed_without_new_approval: retry/i);
  assert.match(assessment, /next_disallowed_without_new_approval: provider comparison/i);
  assert.match(assessment, /next_disallowed_without_new_approval: product-preview expansion/i);
  assert.match(assessment, /not as a hidden default/i);

  assert.match(assessment, /authorizes_provider_call: false/i);
  assert.match(assessment, /authorizes_retry: false/i);
  assert.match(assessment, /authorizes_future_runtime_model_mode_execution: false/i);
  assert.match(assessment, /authorizes_provider_comparison: false/i);
  assert.match(assessment, /authorizes_product_preview_expansion: false/i);
  assert.match(assessment, /authorizes_default_model_selection: false/i);
  assert.match(assessment, /authorizes_tools: false/i);
  assert.match(assessment, /authorizes_web_search: false/i);
  assert.match(assessment, /authorizes_plugins: false/i);
  assert.match(assessment, /authorizes_retrieval: false/i);
  assert.match(assessment, /authorizes_graph_ingestion: false/i);
  assert.match(assessment, /authorizes_production_use: false/i);
  assert.match(assessment, /provider_payload_committed: false/i);
  assert.match(assessment, /model_output_committed: false/i);
  assert.match(assessment, /private_evidence_committed: false/i);
  assert.match(assessment, /credential_material_committed: false/i);
  assert.match(assessment, /request_identifier_committed: false/i);
  assert.match(assessment, /product_readiness_claim: false/i);
  assert.match(assessment, /production_readiness_claim: false/i);
  assert.match(assessment, /launch_readiness_claim: false/i);
  assert.match(assessment, /provider_lock_in: false/i);
  assert.match(assessment, /retry_requires_new_approval: true/i);
  assert.match(assessment, /provider_call_requires_new_approval: true/i);
  assertNoAssessmentLeakageOrBroadening("remediated tiny live assessment", assessment);
});

test("remediated tiny live proof assessment rejects appended leakage and broadening contradictions", () => {
  const assessment = readFileSync(ASSESSMENT_DOC, "utf8");
  const contradictions = [
    "- authorizes_provider_call: true",
    "- authorizes_retry: true",
    "- authorizes_future_runtime_model_mode_execution: true",
    "- authorizes_provider_comparison: true",
    "- authorizes_product_preview_expansion: true",
    "- authorizes_default_model_selection: true",
    "- authorizes_tools: true",
    "- authorizes_web_search: true",
    "- authorizes_plugins: true",
    "- authorizes_retrieval: true",
    "- authorizes_graph_ingestion: true",
    "- authorizes_production_use: true",
    "- graph_ingestion_performed: true",
    "- production_writes: true",
    "- default_model_selection_claim: true",
    "- assessment_provider_calls_executed: 1",
    "- assessment_provider_spend: true",
    "- assessment_private_evidence_read: true",
    "- assessment_network_access: true",
    "- assessment_production_writes: true",
    "- next_allowed_work: provider call",
    "- next_allowed_work: retry",
    "- next_allowed_work: provider comparison",
    "- next_allowed_work: product-preview expansion",
    "- provider_call_requires_new_approval: false",
    "- retry_requires_new_approval: false",
    "- product_readiness_claim: true",
    "- production_readiness_claim: true",
    "- launch_readiness_claim: true",
    "- provider_lock_in: true",
    "- provider_payload_committed: true",
    "- model_output_committed: true",
    "- private_evidence_committed: true",
    "- credential_material_committed: true",
    "- request_identifier_committed: true",
    "- request_identifier: nonpublic-handle",
    "- request_identifier_ref: nonpublic-handle",
    "- request_id: nonpublic-handle",
    "- request_id_ref: nonpublic-handle",
  ];

  for (const contradiction of contradictions) {
    assert.throws(
      () => assertNoAssessmentLeakageOrBroadening("remediated tiny live assessment", `${assessment}\n${contradiction}\n`),
      /forbidden pattern/,
      `expected contradiction to fail assessment contract: ${contradiction}`,
    );
  }
});
