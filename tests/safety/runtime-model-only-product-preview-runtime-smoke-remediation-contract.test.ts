import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-product-preview-runtime-smoke-remediation.md");

const forbidden = [
  /authorizes_provider_call: true/i,
  /authorizes_retry: true/i,
  /authorizes_runtime_model_mode_smoke_retry: true/i,
  /authorizes_product_preview_expansion: true/i,
  /authorizes_provider_comparison: true/i,
  /authorizes_graph_ingestion: true/i,
  /authorizes_production_use: true/i,
  /product ready/i,
  /production ready/i,
  /launch ready/i,
  /default production model/i,
  /private evidence root/i,
  /raw_provider/i,
  /raw_harness/i,
  /bearer /i,
];

test("runtime smoke remediation records no-spend type remediation without approving retry", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-spend runtime\/model-mode smoke remediation/i,
    /Source status: `runtime-model-only-product-preview-runtime-smoke-status\.md`/i,
    /stable_error_code: v2_contract_account_object_type_invalid/i,
    /provider_calls_executed_during_remediation: 0/i,
    /network_access_during_remediation: false/i,
    /raw_or_model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /observed_blocker_class: recoverable_account_object_type_label/i,
    /product_preview_runtime_smoke_summary/i,
    /canonical_normalization: account_snapshot/i,
    /Allowed account_object\.type values/i,
    /account_snapshot, signal, risk, play, map, relationship, milestone, recommendation, stakeholder, initiative, open_question/i,
    /prompt_contract_amended: true/i,
    /validator_mapping_added: true/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_runtime_model_mode_smoke_retry: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_graph_ingestion: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /retry_requires_separate_approval_packet: true/i,
  ]) assert.match(doc, required);

  for (const pattern of forbidden) assert.doesNotMatch(doc, pattern);
});
