import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs/runbooks/runtime-model-only-live-provider-moderate-proof-status.md");

function assertLiveStatusHasNoLeakageOrBroadening(label: string, doc: string): void {
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
    /local evidence location/i,
    /private[-_ ]provider[-_ ]evidence/i,
    /request id/i,
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
    /provider_calls_executed:\s*(?:0|[2-9]|\d{2,})\b/i,
    /provider_spend:\s*true/i,
    /runtime_model_mode_execution:\s*true/i,
    /runtime_model_mode_integration:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes_performed:\s*true/i,
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /raw_evidence_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /^-\s*request_identifier(?:_ref)?:/im,
    /^-\s*request_id(?:_ref)?:/im,
    /default_model_selection_claim:\s*true/i,
    /provider_comparison_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /provider_quality_conclusion:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /provider_call_requires_new_approval:\s*false/i,
    /retry_requires_new_approval:\s*false/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    /may retry without/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

test("live provider moderate proof status records one approved structured generation without broadening", () => {
  const status = readFileSync(STATUS_DOC, "utf8");

  assert.match(status, /Status: completed approved live provider structured-generation proof/i);
  assert.match(status, /status_id: runtime-model-only-live-provider-moderate-proof-20260605c/i);
  assert.match(status, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(status, /provider_ref: openai-codex/i);
  assert.match(status, /model_label: gpt-5\.5/i);
  assert.match(status, /provider_path: hermes-openai-codex-operator/i);
  assert.match(status, /source_scope: synthetic-only/i);
  assert.match(status, /user_approval_scope: live provider proof approved in current operator chat/i);

  assert.match(status, /^- codex_exit_code: 0$/im);
  assert.match(status, /^- provider_api_requests_attempted: 2$/im);
  assert.match(status, /^- failed_schema_request_count: 1$/im);
  assert.match(status, /^- successful_structured_generations: 1$/im);
  assert.match(status, /^- provider_calls_executed: 1$/im);
  assert.match(status, /^- observed_cost_usd: 0$/im);
  assert.match(status, /^- provider_spend: false$/im);
  assert.match(status, /^- tokens_used_total: 10158$/im);
  assert.match(status, /^- elapsed_seconds: 25\.36$/im);

  assert.match(status, /^- strict_json_ok: true$/im);
  assert.match(status, /^- schema_version_ok: true$/im);
  assert.match(status, /^- source_scope_ok: true$/im);
  assert.match(status, /^- accounts_observed: 3$/im);
  assert.match(status, /^- excerpts_observed: 6$/im);
  assert.match(status, /^- claims_observed: 6$/im);
  assert.match(status, /^- account_objects_observed: 9$/im);
  assert.match(status, /^- citation_links_ok: true$/im);
  assert.match(status, /^- per_account_lens_coverage_ok: true$/im);
  assert.match(status, /^- boundary_flags_ok: true$/im);
  assert.match(status, /^- validation_errors_count: 0$/im);

  assert.match(status, /^- atliera_runtime_executed: false$/im);
  assert.match(status, /^- runtime_model_mode_execution: false$/im);
  assert.match(status, /^- runtime_model_mode_integration: false$/im);
  assert.match(status, /^- graph_ingestion_performed: false$/im);
  assert.match(status, /^- production_writes_performed: false$/im);
  assert.match(status, /^- provider_payload_committed: false$/im);
  assert.match(status, /^- model_output_committed: false$/im);
  assert.match(status, /^- raw_evidence_committed: false$/im);
  assert.match(status, /^- private_evidence_committed: false$/im);
  assert.match(status, /^- credential_material_committed: false$/im);
  assert.match(status, /^- request_identifier_committed: false$/im);

  assert.match(status, /^- provider_quality_conclusion: false$/im);
  assert.match(status, /^- product_readiness_claim: false$/im);
  assert.match(status, /^- production_readiness_claim: false$/im);
  assert.match(status, /^- launch_readiness_claim: false$/im);
  assert.match(status, /^- default_model_selection_claim: false$/im);
  assert.match(status, /^- provider_comparison_claim: false$/im);
  assert.match(status, /^- provider_lock_in: false$/im);
  assert.match(status, /^- authorizes_retry: false$/im);
  assert.match(status, /^- authorizes_future_runtime_model_mode_execution: false$/im);
  assert.match(status, /^- authorizes_provider_comparison: false$/im);
  assert.match(status, /^- authorizes_product_preview_expansion: false$/im);
  assert.match(status, /^- authorizes_default_model_selection: false$/im);
  assert.match(status, /^- authorizes_tools: false$/im);
  assert.match(status, /^- authorizes_web_search: false$/im);
  assert.match(status, /^- authorizes_plugins: false$/im);
  assert.match(status, /^- authorizes_retrieval: false$/im);
  assert.match(status, /^- authorizes_graph_ingestion: false$/im);
  assert.match(status, /^- authorizes_production_use: false$/im);
  assert.match(status, /^- provider_call_requires_new_approval: true$/im);
  assert.match(status, /^- retry_requires_new_approval: true$/im);

  assertLiveStatusHasNoLeakageOrBroadening("live provider moderate proof status", status);
});

test("live provider moderate proof status rejects appended leakage and broadening contradictions", () => {
  const status = readFileSync(STATUS_DOC, "utf8");
  const contradictions = [
    "- authorizes_retry: true",
    "- authorizes_future_runtime_model_mode_execution: true",
    "- provider_calls_executed: 2",
    "- provider_spend: true",
    "- runtime_model_mode_execution: true",
    "- runtime_model_mode_integration: true",
    "- graph_ingestion_performed: true",
    "- production_writes_performed: true",
    "- provider_payload_committed: true",
    "- model_output_committed: true",
    "- raw_evidence_committed: true",
    "- private_evidence_committed: true",
    "- credential_material_committed: true",
    "- request_identifier: nonpublic-handle",
    "- request_id: nonpublic-handle",
    "- provider_quality_conclusion: true",
    "- product_readiness_claim: true",
    "- production_readiness_claim: true",
    "- launch_readiness_claim: true",
    "- default_model_selection_claim: true",
    "- provider_comparison_claim: true",
    "- provider_lock_in: true",
    "- provider_call_requires_new_approval: false",
    "- retry_requires_new_approval: false",
  ];

  for (const contradiction of contradictions) {
    assert.throws(
      () => assertLiveStatusHasNoLeakageOrBroadening("live provider moderate proof status", `${status}\n${contradiction}\n`),
      /forbidden pattern/,
      `expected contradiction to fail live status contract: ${contradiction}`,
    );
  }
});
