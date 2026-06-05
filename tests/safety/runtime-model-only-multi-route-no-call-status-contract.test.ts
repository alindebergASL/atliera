import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs/runbooks/runtime-model-only-multi-route-no-call-status.md");

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
    /provider_calls_executed:\s*(?:[1-9]|\d{2,})\b/i,
    /provider_spend:\s*true/i,
    /network_access:\s*true/i,
    /private_evidence_read:\s*true/i,
    /runtime_model_mode_execution:\s*true/i,
    /runtime_model_mode_integration:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes_performed:\s*true/i,
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /^-\s*request_identifier(?:_ref)?:/im,
    /^-\s*request_id(?:_ref)?:/im,
    /default_model_selection_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
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

test("multi-route no-call status records provider-neutral route replaceability without broadening", () => {
  const status = readFileSync(STATUS_DOC, "utf8");

  assert.match(status, /Status: completed multi-route no-call runtime integration slice/i);
  assert.match(status, /status_id: runtime-model-only-multi-route-no-call-20260605b/i);
  assert.match(status, /predecessor_status: runtime-model-only-remediated-route-chain-no-call-20260605a/i);
  assert.match(status, /status_classification: provider-neutral multi-route no-call plumbing signal/i);
  assert.match(status, /command: `npx tsx --test tests\/model\/runtime-multi-route-no-call\.integration\.test\.ts`/i);
  assert.match(status, /command_result: pass/i);
  assert.match(status, /tests_passed: 2/i);

  assert.match(status, /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i);
  assert.match(status, /provider_ref: openai-codex/i);
  assert.match(status, /model_label: gpt-5\.5/i);
  assert.match(status, /route_ref: owl-alpha-openrouter-validation-20260601a/i);
  assert.match(status, /provider_ref: openrouter/i);
  assert.match(status, /model_label: owl-alpha/i);

  assert.match(status, /route_catalog_validation_exercised: true/i);
  assert.match(status, /explicit_route_selection_exercised: true/i);
  assert.match(status, /multi_route_selection_exercised: true/i);
  assert.match(status, /runtime_composition_exercised: true/i);
  assert.match(status, /execution_preflight_exercised: true/i);
  assert.match(status, /sanitized_observability_exercised: true/i);
  assert.match(status, /model_provider_boundary_replaceable: true/i);
  assert.match(status, /default_model_shortcut_refused: true/i);
  assert.match(status, /unknown_route_ref_refused: true/i);
  assert.match(status, /duplicate_route_ref_refused: true/i);
  assert.match(status, /provider_lock_in_route_refused: true/i);

  assert.match(status, /^- provider_calls_executed: 0$/im);
  assert.match(status, /^- provider_spend: false$/im);
  assert.match(status, /^- observed_cost_usd: 0$/im);
  assert.match(status, /^- network_access: false$/im);
  assert.match(status, /^- private_evidence_read: false$/im);
  assert.match(status, /^- production_writes: false$/im);
  assert.match(status, /^- graph_ingestion: false$/im);
  assert.match(status, /authorizes_provider_call: false/i);
  assert.match(status, /authorizes_default_model_selection: false/i);
  assert.match(status, /authorizes_provider_comparison: false/i);
  assert.match(status, /runtime_model_mode_execution: false/i);
  assert.match(status, /runtime_model_mode_integration: false/i);
  assert.match(status, /provider_payload_committed: false/i);
  assert.match(status, /model_output_committed: false/i);
  assert.match(status, /private_evidence_committed: false/i);
  assert.match(status, /credential_material_committed: false/i);
  assert.match(status, /request_identifier_committed: false/i);
  assert.match(status, /product_readiness_claim: false/i);
  assert.match(status, /production_readiness_claim: false/i);
  assert.match(status, /launch_readiness_claim: false/i);
  assert.match(status, /default_model_selection_claim: false/i);
  assert.match(status, /provider_lock_in: false/i);
  assert.match(status, /provider_call_requires_new_approval: true/i);
  assert.match(status, /retry_requires_new_approval: true/i);

  assertNoLeakageOrBroadening("multi-route no-call status", status);
});

test("multi-route no-call status rejects appended leakage and broadening contradictions", () => {
  const status = readFileSync(STATUS_DOC, "utf8");
  const contradictions = [
    "- authorizes_provider_call: true",
    "- authorizes_provider_comparison: true",
    "- authorizes_default_model_selection: true",
    "- provider_calls_executed: 1",
    "- provider_spend: true",
    "- network_access: true",
    "- runtime_model_mode_execution: true",
    "- runtime_model_mode_integration: true",
    "- provider_payload_committed: true",
    "- model_output_committed: true",
    "- private_evidence_committed: true",
    "- credential_material_committed: true",
    "- request_identifier: nonpublic-handle",
    "- request_id: nonpublic-handle",
    "- product_readiness_claim: true",
    "- production_readiness_claim: true",
    "- launch_readiness_claim: true",
    "- default_model_selection_claim: true",
    "- provider_lock_in: true",
    "- provider_call_requires_new_approval: false",
    "- retry_requires_new_approval: false",
  ];

  for (const contradiction of contradictions) {
    assert.throws(
      () => assertNoLeakageOrBroadening("multi-route no-call status", `${status}\n${contradiction}\n`),
      /forbidden pattern/,
      `expected contradiction to fail multi-route status contract: ${contradiction}`,
    );
  }
});
