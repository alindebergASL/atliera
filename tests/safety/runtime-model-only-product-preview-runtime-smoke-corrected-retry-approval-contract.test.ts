import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-product-preview-runtime-smoke-corrected-retry-approval-packet.md");

const required = [
  /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i,
  /approval_id: runtime-model-only-product-preview-runtime-smoke-corrected-retry-20260604e/i,
  /approval_kind: one_call_single_slot_runtime_model_mode_smoke_corrected_retry/i,
  /source_status: runtime-model-only-product-preview-runtime-smoke-status\.md/i,
  /source_remediation: runtime-model-only-product-preview-runtime-smoke-remediation\.md/i,
  /max_attempts: 1/i,
  /max_provider_calls: 1/i,
  /approved_max_cost_usd: 1/i,
  /route_ref: gpt-5\.5-openai-codex-20260602a/i,
  /provider_ref: openai-codex/i,
  /model_label: gpt-5\.5/i,
  /transport_kind: model-only-codex-auth/i,
  /corpus_ref: product-preview\/runtime-smoke-single-slot-v1/i,
  /prompt_contract_ref: prompts\/product-preview-model-only-v1-runtime-smoke-v2-type-remediation/i,
  /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
  /remediation_helper_ref: src\/product-preview\/runtime-smoke-v2-remediation\.ts/i,
  /slot_role: calibration/i,
  /runtime_mode: model-only-smoke/i,
  /run the no-provider-call planner before the retry/i,
  /product-preview-runtime-smoke-corrected-retry-20260604e/i,
  /dry_run: true/i,
  /provider_calls_executed: 0/i,
  /authorizes_provider_call: false/i,
  /apply the runtime smoke v2 type remediation before v2 validation/i,
  /status follow-up required/i,
  /authorizes_provider_call: true/i,
  /authorizes_provider_call_count: 1/i,
  /authorizes_retry: false/i,
  /authorizes_live_expansion: false/i,
  /authorizes_provider_comparison_execution: false/i,
  /authorizes_default_model_selection: false/i,
  /authorizes_graph_ingestion: false/i,
  /authorizes_background_orchestrator_bypass: false/i,
  /authorizes_production_use: false/i,
  /product_readiness_claim: false/i,
  /production_readiness_claim: false/i,
  /launch_readiness_claim: false/i,
];

const forbidden = [
  /max_attempts:\s*(?:[2-9]|\d{2,})\b/i,
  /max_provider_calls:\s*(?:[2-9]|\d{2,})\b/i,
  /authorizes_provider_call_count:\s*(?:[2-9]|\d{2,})\b/i,
  /approved_max_cost_usd:\s*(?:[2-9]|\d{2,})\b/i,
  /authorizes_retry:\s*true/i,
  /authorizes_live_expansion:\s*true/i,
  /authorizes_provider_comparison_execution:\s*true/i,
  /authorizes_default_model_selection:\s*true/i,
  /authorizes_graph_ingestion:\s*true/i,
  /authorizes_background_orchestrator_bypass:\s*true/i,
  /authorizes_production_use:\s*true/i,
  /product_readiness_claim:\s*true/i,
  /production_readiness_claim:\s*true/i,
  /launch_readiness_claim:\s*true/i,
  /paid_fallback_allowed:\s*true/i,
  /retry_allowed_without_new_approval:\s*true/i,
  /additional_slots_allowed:\s*true/i,
  /live_expansion_allowed:\s*true/i,
  /provider_comparison_execution_allowed:\s*true/i,
  /default_model_selection_allowed:\s*true/i,
  /workshop_runtime_render_allowed:\s*true/i,
  /tools_allowed:\s*true/i,
  /web_search_allowed:\s*true/i,
  /plugins_allowed:\s*true/i,
  /mcp_allowed:\s*true/i,
  /shell_allowed:\s*true/i,
  /file_access_allowed:\s*true/i,
  /retrieval_allowed:\s*true/i,
  /session_carryover_allowed:\s*true/i,
  /production_writes_allowed:\s*true/i,
  /graph_ingestion_allowed:\s*true/i,
  /background_orchestrator_allowed:\s*true/i,
  /product ready/i,
  /production ready/i,
  /launch ready/i,
  /default production model/i,
  /private evidence root/i,
  /raw provider body/i,
  /bearer /i,
];

const broadeningContradictions = [
  "max_attempts: 2",
  "max_attempts: 10",
  "max_provider_calls: 2",
  "max_provider_calls: 10",
  "approved_max_cost_usd: 2",
  "authorizes_provider_call_count: 2",
  "authorizes_retry: true",
  "authorizes_live_expansion: true",
  "authorizes_provider_comparison_execution: true",
  "authorizes_default_model_selection: true",
  "authorizes_graph_ingestion: true",
  "authorizes_background_orchestrator_bypass: true",
  "authorizes_production_use: true",
  "product_readiness_claim: true",
  "production_readiness_claim: true",
  "launch_readiness_claim: true",
  "retry_allowed_without_new_approval: true",
  "additional_slots_allowed: true",
  "live_expansion_allowed: true",
  "provider_comparison_execution_allowed: true",
  "default_model_selection_allowed: true",
  "workshop_runtime_render_allowed: true",
  "tools_allowed: true",
  "web_search_allowed: true",
  "plugins_allowed: true",
  "mcp_allowed: true",
  "shell_allowed: true",
  "file_access_allowed: true",
  "retrieval_allowed: true",
  "session_carryover_allowed: true",
  "production_writes_allowed: true",
  "graph_ingestion_allowed: true",
  "background_orchestrator_allowed: true",
];

function assertApprovalPacketContract(doc: string): void {
  for (const pattern of required) assert.match(doc, pattern);
  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `forbidden broadening marker matched: ${pattern}`);
  }
}

test("corrected runtime smoke retry approval is docs-only, one-call, remediated, and bounded", () => {
  const doc = readFileSync(DOC, "utf8");
  assertApprovalPacketContract(doc);
});

test("approval contract test catches contradictory broadening markers appended to the packet", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const contradiction of broadeningContradictions) {
    assert.throws(
      () => assertApprovalPacketContract(`${doc}\n${contradiction}\n`),
      /forbidden broadening marker matched/,
      `expected contradiction to fail the contract: ${contradiction}`,
    );
  }
});
