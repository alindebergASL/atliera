import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..", "docs", "runbooks");
const OPTIONS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-next-slice-options-analysis.md");
const APPROVAL = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-approval-packet.md");
const SOURCE_ASSESSMENT = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment.md");
const SOURCE_STATUS = join(ROOT, "runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status.md");

const privateLeakagePatterns = [
  /\/home\//i,
  /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
  /credential\s*(?:value|contents?)\s*[:=]/i,
  /authorization\s*[:=]/i,
  /bearer\s+[A-Za-z0-9._-]+/i,
  /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
  /raw[_ -]?body\s*[:=]/i,
  /raw[_ -]?prompt\s*[:=]/i,
  /wrapper\s*log\s*[:=]/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  /acct-[A-Za-z0-9-]+/i,
  /screened account:/i,
];

const forbiddenApprovalContradictions = [
  /This PR executes (?:a provider call|the slice|the run)/i,
  /current_pr_executes_provider_call:\s*true/i,
  /max_attempts:\s*(?:[2-9]|\d{2,})\b/i,
  /max_provider_calls:\s*(?:[7-9]|\d{2,})\b/i,
  /approved_max_cost_usd:\s*(?:[7-9]|\d{2,})\b/i,
  /future_authorized_provider_call_count:\s*(?:[7-9]|\d{2,})\b/i,
  /future_authorized_attempt_count:\s*(?:[2-9]|\d{2,})\b/i,
  /authorizes_retry_after_this_attempt:\s*true/i,
  /authorizes_provider_comparison:\s*true/i,
  /authorizes_default_model_selection:\s*true/i,
  /authorizes_runtime_model_mode_integration:\s*true/i,
  /authorizes_background_orchestrator_bypass:\s*true/i,
  /authorizes_production_use:\s*true/i,
  /authorizes_graph_ingestion:\s*true/i,
  /product_readiness_claim:\s*true/i,
  /production_readiness_claim:\s*true/i,
  /launch_readiness_claim:\s*true/i,
  /provider_lock_in:\s*true/i,
  /tools:\s*true/i,
  /web_search:\s*true/i,
  /online_model_variant:\s*true/i,
  /plugins:\s*true/i,
  /mcp:\s*true/i,
  /shell:\s*true/i,
  /file_access:\s*true/i,
  /retrieval:\s*true/i,
  /session_carryover:\s*true/i,
  /background_orchestrator:\s*true/i,
  /production_writes:\s*true/i,
  /graph_ingestion:\s*true/i,
  /replacement_accounts_allowed_without_new_approval:\s*true/i,
  /no_paid_fallback:\s*false/i,
  /no_retry_beyond_approved_call_count:\s*false/i,
  /no_prompt_or_corpus_change_without_new_approval:\s*false/i,
  /product ready/i,
  /production ready/i,
  /launch ready/i,
  /default production model (?:is )?(?:selected|approved|authorized|chosen)/i,
  /provider comparison (?:is )?(?:approved|authorized|enabled|executed)/i,
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(content: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(content, pattern);
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of privateLeakagePatterns) assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
}

function assertNoApprovalContradictions(label: string, text: string): void {
  for (const pattern of forbiddenApprovalContradictions) assert.doesNotMatch(text, pattern, `${label} broadened approval with ${pattern}`);
}

test("next-slice options analysis is no-spend and selects a separate six-slot approval packet", () => {
  const doc = read(OPTIONS);
  assertAll(doc, [
    /Runtime Model-Only Product-Preview Runtime Smoke Next-Slice Options Analysis/i,
    /Status: no-spend options analysis\. This document does not execute or approve a provider call\./i,
    /source_usefulness_assessment: runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment\.md/i,
    /source_usefulness_classification: useful/i,
    /source_provider_calls_executed_by_assessment: 0/i,
    /recommended_next_slice: six-slot-runtime-model-mode-product-preview-approval/i,
    /why_not_provider_comparison_yet: three-slot signal is useful but still tiny/i,
    /why_not_runtime_defaulting_yet: no default model or runtime selection is authorized/i,
    /selected_slice_is_docs_only: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_product_preview_expansion: false/i,
    /requires_separate_execution_after_merge: true/i,
  ]);
  assertNoPrivateLeakage("options doc", doc);
});

test("six-slot expansion approval is docs-only, pre-run, and tied to the useful three-slot assessment", () => {
  const doc = read(APPROVAL);
  assertAll(doc, [
    /Runtime Model-Only Product-Preview Runtime Smoke Six-Slot Expansion Approval Packet/i,
    /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i,
    /No execution may occur in this approval PR/i,
    /runtime-model-only-product-preview-runtime-smoke-next-slice-options-analysis\.md/i,
    /runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment\.md/i,
    /runtime-model-only-product-preview-runtime-smoke-tiny-expansion-status\.md/i,
    /three_slot_runtime_smoke_usefulness_status: pass/i,
    /three_slot_runtime_smoke_usefulness_classification: useful/i,
    /three_slot_runtime_smoke_assessment_authorizes_provider_call: false/i,
    /three_slot_runtime_smoke_assessment_authorizes_product_preview_expansion: false/i,
    /This packet is the separate reviewed approval surface/i,
  ]);
  assertNoPrivateLeakage("approval doc", doc);
  assertNoApprovalContradictions("approval doc", doc);
});

test("six-slot expansion approval pins exact future scope, route, dry-run planner, and limits", () => {
  const doc = read(APPROVAL);
  assertAll(doc, [
    /approval_id: runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-20260604g/i,
    /approval_kind: six_slot_runtime_model_mode_product_preview_expansion/i,
    /max_attempts: 1/i,
    /max_provider_calls: 6/i,
    /approved_max_cost_usd: 6/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /runtime_surface: app-owned-model-only-harness/i,
    /corpus_ref: product-preview\/runtime-smoke-six-slot-screened-v1/i,
    /prompt_contract_ref: prompts\/product-preview-model-only-v1-runtime-smoke-v2-type-remediation/i,
    /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
    /remediation_helper_ref: src\/product-preview\/runtime-smoke-v2-remediation\.ts/i,
    /screened_account_slots: 6/i,
    /required_slot_roles: representative-a, representative-b, edge-case-a, edge-case-b, calibration, sparse-control/i,
    /npm run product-preview:plan/i,
    /product-preview-runtime-smoke-six-slot-expansion-20260604g/i,
    /--max-provider-calls 6/i,
    /--max-cost-usd 6/i,
    /--slot-roles representative-a,representative-b,edge-case-a,edge-case-b,calibration,sparse-control/i,
    /dry_run: true/i,
    /provider_calls_executed: 0/i,
    /provider_spend_authorized_by_plan: false/i,
    /raw_private_evidence_read: false/i,
    /network_access_performed: false/i,
    /authorizes_provider_call: false/i,
  ]);
  assertNoPrivateLeakage("approval doc", doc);
  assertNoApprovalContradictions("approval doc", doc);
});

test("six-slot expansion approval requires screening, stop rules, and no-tool runtime boundary", () => {
  const doc = read(APPROVAL);
  assertAll(doc, [
    /private_source_screening_required_before_each_call: true/i,
    /stop_instead_of_substitute_if_slot_fails_screening: true/i,
    /required_representative_slots: 2/i,
    /required_edge_case_slots: 2/i,
    /required_calibration_slots: 1/i,
    /required_sparse_control_slots: 1/i,
    /replacement_accounts_allowed_without_new_approval: false/i,
    /no_paid_fallback: true/i,
    /no_retry_beyond_approved_call_count: true/i,
    /no_prompt_or_corpus_change_without_new_approval: true/i,
    /If any required slot fails screening, stop before provider access for that slot/i,
    /Skipped or failed slots do not authorize replacement accounts/i,
    /tools: false/i,
    /web_search: false/i,
    /online_model_variant: false/i,
    /plugins: false/i,
    /mcp: false/i,
    /shell: false/i,
    /file_access: false/i,
    /retrieval: false/i,
    /session_carryover: false/i,
    /background_orchestrator: false/i,
    /production_writes: false/i,
    /graph_ingestion: false/i,
    /must not use Hermes as a product runtime/i,
    /must not use an autonomous agent surface/i,
  ]);
  assertNoPrivateLeakage("approval doc", doc);
  assertNoApprovalContradictions("approval doc", doc);
});

test("six-slot expansion approval authorizes only a future bounded slice and preserves non-claims", () => {
  const doc = read(APPROVAL);
  assertAll(doc, [
    /current_pr_executes_provider_call: false/i,
    /future_execution_authorized_after_merge: true/i,
    /future_authorized_provider_call_count: 6/i,
    /future_authorized_attempt_count: 1/i,
    /future_authorized_six_slot_product_preview_expansion: true/i,
    /authorizes_retry_after_this_attempt: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_runtime_model_mode_integration: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /provider_lock_in: false/i,
    /status_followup_required: true/i,
    /approval_consumed_if_any_provider_request_is_attempted: true/i,
    /retry_requires_new_approval_after_attempt: true/i,
    /sanitized_status_renderer_required: true/i,
    /No raw\/model\/private evidence may be committed/i,
    /broader validation readiness/i,
    /broad model quality/i,
    /bounded historical product-preview signal only/i,
    /would require a separate approval packet/i,
    /not a default production model selection/i,
    /not a provider-quality conclusion/i,
    /future routes and direct provider APIs remain replaceable/i,
  ]);
  assertNoPrivateLeakage("approval doc", doc);
  assertNoApprovalContradictions("approval doc", doc);
});

test("source usefulness assessment links the later approval while preserving historical false authorization markers", () => {
  const assessment = read(SOURCE_ASSESSMENT);
  assert.match(assessment, /runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-approval-packet\.md/i);
  assert.match(assessment, /later separate docs-only six-slot approval/i);
  assert.match(assessment, /authorizes_provider_call: false/i);
  assert.match(assessment, /authorizes_product_preview_expansion: false/i);
  assert.match(assessment, /authorizes_default_model_selection: false/i);
  assert.match(assessment, /authorizes_graph_ingestion: false/i);
  assert.match(assessment, /product_readiness_claim: false/i);
  assertNoPrivateLeakage("source assessment", assessment);
});

test("source status remains historical and consumed", () => {
  const status = read(SOURCE_STATUS);
  assert.match(status, /approval_consumed: true/i);
  assert.match(status, /retry_requires_new_approval: true/i);
  assert.match(status, /Follow-up interpretation: `runtime-model-only-product-preview-runtime-smoke-tiny-expansion-usefulness-assessment\.md`/i);
  assert.match(status, /usefulness_evaluated: false/i);
  assertNoPrivateLeakage("source status", status);
});
