import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ASSESSMENT_DOC = join(REPO_ROOT, "docs/runbooks/runtime-model-only-live-provider-moderate-proof-assessment.md");
const STATUS_DOC = join(REPO_ROOT, "docs/runbooks/runtime-model-only-live-provider-moderate-proof-status.md");

function assertNoAssessmentBroadening(label: string, doc: string): void {
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
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /raw_evidence_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /^-\s*request_identifier(?:_ref)?:/im,
    /^-\s*request_id(?:_ref)?:/im,
    /atliera_runtime_model_mode_wired:\s*true/i,
    /atliera_runtime_executed:\s*true/i,
    /runtime_model_mode_integration_proven:\s*true/i,
    /graph_ingestion_safety_proven:\s*true/i,
    /production_writes_safety_proven:\s*true/i,
    /default_model_selection_proven:\s*true/i,
    /provider_comparison_proven:\s*true/i,
    /provider_quality_conclusion_proven:\s*true/i,
    /product_readiness_proven:\s*true/i,
    /production_readiness_proven:\s*true/i,
    /launch_readiness_proven:\s*true/i,
    /provider_lock_in_justified:\s*true/i,
    /provider_call_requires_new_approval:\s*false/i,
    /retry_requires_new_approval:\s*false/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

test("live provider moderate proof assessment classifies useful but bounded evidence", () => {
  const assessment = readFileSync(ASSESSMENT_DOC, "utf8");
  const status = readFileSync(STATUS_DOC, "utf8");

  assert.match(status, /Status: completed approved live provider structured-generation proof/i);
  assert.match(status, /^- provider_calls_executed: 1$/im);
  assert.match(status, /^- observed_cost_usd: 0$/im);

  assert.match(assessment, /assessment_id: runtime-model-only-live-provider-moderate-proof-assessment-20260605d/i);
  assert.match(assessment, /assessed_status: runtime-model-only-live-provider-moderate-proof-20260605c/i);
  assert.match(assessment, /assessment_classification: useful_but_bounded_structured_generation_signal/i);
  assert.match(assessment, /^- schema_constrained_generation_observed: true$/im);
  assert.match(assessment, /^- synthetic_graph_shape_observed: true$/im);
  assert.match(assessment, /^- strict_json_validation_passed: true$/im);
  assert.match(assessment, /^- citation_link_validation_passed: true$/im);
  assert.match(assessment, /^- per_account_lens_coverage_passed: true$/im);
  assert.match(assessment, /^- observed_cost_usd: 0$/im);
  assert.match(assessment, /^- provider_spend: false$/im);

  assert.match(assessment, /^- atliera_runtime_model_mode_wired: false$/im);
  assert.match(assessment, /^- atliera_runtime_executed: false$/im);
  assert.match(assessment, /^- runtime_model_mode_integration_proven: false$/im);
  assert.match(assessment, /^- graph_ingestion_safety_proven: false$/im);
  assert.match(assessment, /^- production_writes_safety_proven: false$/im);
  assert.match(assessment, /^- default_model_selection_proven: false$/im);
  assert.match(assessment, /^- provider_comparison_proven: false$/im);
  assert.match(assessment, /^- provider_quality_conclusion_proven: false$/im);
  assert.match(assessment, /^- product_readiness_proven: false$/im);
  assert.match(assessment, /^- production_readiness_proven: false$/im);
  assert.match(assessment, /^- launch_readiness_proven: false$/im);
  assert.match(assessment, /^- provider_lock_in_justified: false$/im);

  assert.match(assessment, /Add a deterministic verifier module/i);
  assert.match(assessment, /Add an out-of-repo verifier CLI/i);
  assert.match(assessment, /lab\/test-only runtime execution harness/i);
  assert.match(assessment, /validate-but-do-not-ingest conversion/i);
  assert.match(assessment, /non-production Workshop previews/i);

  assert.match(assessment, /^- authorizes_retry: false$/im);
  assert.match(assessment, /^- authorizes_future_runtime_model_mode_execution: false$/im);
  assert.match(assessment, /^- authorizes_provider_comparison: false$/im);
  assert.match(assessment, /^- authorizes_product_preview_expansion: false$/im);
  assert.match(assessment, /^- authorizes_default_model_selection: false$/im);
  assert.match(assessment, /^- authorizes_graph_ingestion: false$/im);
  assert.match(assessment, /^- authorizes_production_use: false$/im);
  assert.match(assessment, /^- provider_payload_committed: false$/im);
  assert.match(assessment, /^- model_output_committed: false$/im);
  assert.match(assessment, /^- raw_evidence_committed: false$/im);
  assert.match(assessment, /^- private_evidence_committed: false$/im);
  assert.match(assessment, /^- credential_material_committed: false$/im);
  assert.match(assessment, /^- request_identifier_committed: false$/im);
  assert.match(assessment, /^- provider_call_requires_new_approval: true$/im);
  assert.match(assessment, /^- retry_requires_new_approval: true$/im);

  assertNoAssessmentBroadening("live proof assessment", assessment);
});

test("live provider moderate proof assessment rejects appended broadening contradictions", () => {
  const assessment = readFileSync(ASSESSMENT_DOC, "utf8");
  const contradictions = [
    "- authorizes_retry: true",
    "- authorizes_future_runtime_model_mode_execution: true",
    "- authorizes_graph_ingestion: true",
    "- provider_payload_committed: true",
    "- model_output_committed: true",
    "- raw_evidence_committed: true",
    "- private_evidence_committed: true",
    "- credential_material_committed: true",
    "- request_identifier: nonpublic-handle",
    "- request_id: nonpublic-handle",
    "- atliera_runtime_model_mode_wired: true",
    "- graph_ingestion_safety_proven: true",
    "- default_model_selection_proven: true",
    "- provider_comparison_proven: true",
    "- provider_quality_conclusion_proven: true",
    "- product_readiness_proven: true",
    "- production_readiness_proven: true",
    "- launch_readiness_proven: true",
    "- provider_lock_in_justified: true",
    "- provider_call_requires_new_approval: false",
    "- retry_requires_new_approval: false",
  ];

  for (const contradiction of contradictions) {
    assert.throws(
      () => assertNoAssessmentBroadening("live proof assessment", `${assessment}\n${contradiction}\n`),
      /forbidden pattern/,
      `expected contradiction to fail live proof assessment: ${contradiction}`,
    );
  }
});
