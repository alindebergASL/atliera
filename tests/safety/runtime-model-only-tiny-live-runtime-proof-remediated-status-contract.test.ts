import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-status.md",
);
const APPROVAL_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md",
);

const REQUIRED_SLOT_ROLES = ["representative", "edge-case", "calibration"] as const;

function assertNoLeakageOrBroadening(label: string, doc: string): void {
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
    /authorizes_retry_after_suite:\s*true/i,
    /authorizes_future_runtime_model_mode_execution:\s*true/i,
    /future_execution_authorized_after_merge:\s*true/i,
    /future_authorized_runtime_model_mode_suite:\s*true/i,
    /future_authorized_provider_call_count:\s*(?:[1-9]|\d{2,})\b/i,
    /future_authorized_test_slot_count:\s*(?:[1-9]|\d{2,})\b/i,
    /approved_future_attempts:\s*(?:[2-9]|\d{2,})\b/i,
    /attempts_executed:\s*(?:[2-9]|\d{2,})\b/i,
    /approved_future_slots:\s*(?:[4-9]|\d{2,})\b/i,
    /slots_executed:\s*(?:[4-9]|\d{2,})\b/i,
    /transport_calls_observed_by_runner:\s*(?:[4-9]|\d{2,})\b/i,
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
    /default_model_selection_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /provider_spend:\s*true/i,
    /^-\s*provider_payload_committed:\s*true/im,
    /^-\s*model_output_committed:\s*true/im,
    /^-\s*private_evidence_committed:\s*true/im,
    /^-\s*credential_material_committed:\s*true/im,
    /^-\s*request_identifier_committed:\s*true/im,
    /^-\s*request_identifier(?:_ref)?:/im,
    /^-\s*request_id(?:_ref)?:/im,
    /^- provider_calls_executed:\s*(?:[4-9]|\d{2,})$/im,
    /slot_provider_calls_executed:\s*(?:[2-9]|\d{2,})\b/i,
    /may retry without/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

function getSlotBlock(doc: string, role: string): string {
  const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = doc.match(new RegExp(`^- slot_role: ${escapedRole}\\n([\\s\\S]*?)(?=^- slot_role: |^## Boundary markers)`, "im"));
  assert.ok(match, `status must contain isolated ${role} slot block`);
  return match[0];
}

test("remediated tiny live runtime proof status records completed three-slot suite without retry or broadening", () => {
  const approval = readFileSync(APPROVAL_DOC, "utf8");
  const doc = readFileSync(STATUS_DOC, "utf8");

  assert.match(approval, /approval_id: runtime-model-only-tiny-live-runtime-proof-remediated-20260605a/i);
  assert.match(approval, /max_attempts: 1/i);
  assert.match(approval, /max_provider_calls: 3/i);
  assert.match(approval, /runtime-model-only-tiny-live-runtime-proof-remediated-status\.md/i);

  assert.match(doc, /Status: completed for one approved remediated three-slot tiny live runtime\/model proof suite/i);
  assert.match(doc, /approval_id: runtime-model-only-tiny-live-runtime-proof-remediated-20260605a/i);
  assert.match(doc, /approval_consumed: true/i);
  assert.match(doc, /^- approved_future_attempts: 1$/im);
  assert.match(doc, /^- attempts_executed: 1$/im);
  assert.match(doc, /^- approved_future_slots: 3$/im);
  assert.match(doc, /^- slots_executed: 3$/im);
  assert.match(doc, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(doc, /provider_ref: openai-codex/i);
  assert.match(doc, /model_label: gpt-5\.5/i);
  assert.match(doc, /transport_kind: model-only-codex-auth/i);
  assert.match(doc, /corpus_ref: runtime-model-only\/tiny-live-remediated-three-slot-v1/i);
  assert.match(doc, /prompt_contract_ref: prompts\/runtime-model-only-tiny-live-runtime-proof-v2-allowlist-remediated/i);
  assert.match(doc, /^- status: completed$/im);
  assert.match(doc, /reason_code: tiny_live_runtime_proof_remediated_suite_completed/i);
  assert.match(doc, /stable_error_code: none/i);
  assert.match(doc, /^- provider_calls_executed: 3$/im);
  assert.match(doc, /^- transport_calls_observed_by_runner: 3$/im);
  assert.match(doc, /^- provider_spend: false$/im);
  assert.match(doc, /^- observed_cost_usd: 0$/im);
  assert.match(doc, /input_tokens_observed: 1317/i);
  assert.match(doc, /output_tokens_observed: 1681/i);
  assert.match(doc, /accepted_output_received: true/i);
  assert.match(doc, /v2_contract_validated: true/i);
  assert.match(doc, /canonical_allowlist_remediation_applied: true/i);
  assert.match(doc, /private_screening_performed_before_each_slot: true/i);
  assert.match(doc, /planner_ran_before_provider_access: true/i);
  assert.match(doc, /excerpts: 12/i);
  assert.match(doc, /claims: 9/i);
  assert.match(doc, /account_objects: 12/i);

  const slotRoles = [...doc.matchAll(/^- slot_role: (.+)$/gim)].map((match) => match[1]);
  assert.deepEqual(slotRoles, [...REQUIRED_SLOT_ROLES]);

  for (const role of REQUIRED_SLOT_ROLES) {
    const block = getSlotBlock(doc, role);
    assert.match(block, new RegExp(`^- slot_role: ${role}$`, "im"), `status must record ${role} slot`);
    assert.match(block, /^  - slot_status: completed$/im);
    assert.match(block, /^  - slot_provider_calls_executed: 1$/im);
    assert.match(block, /^  - slot_accepted_output_received: true$/im);
    assert.match(block, /^  - slot_v2_contract_validated: true$/im);
    assert.match(block, /^  - slot_output_counts: excerpts 4, claims 3, account_objects 4$/im);
    assert.doesNotMatch(block, /^  - slot_provider_calls_executed:\s*(?:[2-9]|\d{2,})\b/im);
    assert.doesNotMatch(block, /^  - slot_accepted_output_received: false$/im);
    assert.doesNotMatch(block, /^  - slot_v2_contract_validated: false$/im);
  }

  assert.match(doc, /authorizes_provider_call: false/i);
  assert.match(doc, /authorizes_retry: false/i);
  assert.match(doc, /authorizes_future_runtime_model_mode_execution: false/i);
  assert.match(doc, /authorizes_provider_comparison: false/i);
  assert.match(doc, /authorizes_product_preview_expansion: false/i);
  assert.match(doc, /authorizes_default_model_selection: false/i);
  assert.match(doc, /authorizes_tools: false/i);
  assert.match(doc, /authorizes_web_search: false/i);
  assert.match(doc, /authorizes_plugins: false/i);
  assert.match(doc, /authorizes_retrieval: false/i);
  assert.match(doc, /authorizes_graph_ingestion: false/i);
  assert.match(doc, /authorizes_production_use: false/i);
  assert.match(doc, /graph_ingestion_performed: false/i);
  assert.match(doc, /production_writes: false/i);
  assert.match(doc, /provider_payload_committed: false/i);
  assert.match(doc, /model_output_committed: false/i);
  assert.match(doc, /private_evidence_committed: false/i);
  assert.match(doc, /credential_material_committed: false/i);
  assert.match(doc, /request_identifier_committed: false/i);
  assert.match(doc, /default_model_selection_claim: false/i);
  assert.match(doc, /provider_lock_in: false/i);
  assert.match(doc, /product_readiness_claim: false/i);
  assert.match(doc, /production_readiness_claim: false/i);
  assert.match(doc, /launch_readiness_claim: false/i);
  assert.match(doc, /retry_requires_new_approval: true/i);
  assert.match(doc, /bounded historical runtime\/model-mode contract signal only/i);
  assertNoLeakageOrBroadening("remediated tiny live status", doc);
});

test("remediated tiny live runtime proof status rejects appended leakage and committed-evidence contradictions", () => {
  const doc = readFileSync(STATUS_DOC, "utf8");
  const contradictions = [
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
      () => assertNoLeakageOrBroadening("remediated tiny live status", `${doc}\n${contradiction}\n`),
      /forbidden pattern/,
      `expected contradiction to fail the contract: ${contradiction}`,
    );
  }
});
