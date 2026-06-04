import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { assessControlledCorpusUsefulness } from "../../src/validation/controlled-corpus-usefulness.ts";

const DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "runbooks",
  "runtime-model-only-controlled-corpus-usefulness-status.md",
);

const sanitizedFacts = [
  {
    account_ref: "acct-representative",
    role: "representative",
    output_counts: { excerpts: 3, claims: 2, account_objects: 1 },
    hard_invariants: {
      no_invented_ids: true,
      provenance_required: false,
      graph_validates: true,
      no_private_leakage: true,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
    },
  },
  {
    account_ref: "acct-edge-case",
    role: "edge-case",
    output_counts: { excerpts: 3, claims: 1, account_objects: 1 },
    hard_invariants: {
      no_invented_ids: true,
      provenance_required: true,
      graph_validates: true,
      no_private_leakage: true,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
    },
  },
  {
    account_ref: "acct-calibration",
    role: "calibration",
    output_counts: { excerpts: 3, claims: 2, account_objects: 1 },
    hard_invariants: {
      no_invented_ids: true,
      provenance_required: true,
      graph_validates: true,
      no_private_leakage: true,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
    },
  },
] as const;

test("sanitized controlled-corpus facts classify as unsupported/invented without approving product preview", () => {
  const assessment = assessControlledCorpusUsefulness([...sanitizedFacts]);

  assert.equal(assessment.ok, false);
  assert.equal(assessment.status, "fail");
  assert.equal(assessment.overall_classification, "unsupported/invented");
  assert.equal(assessment.metrics.total_accounts, 3);
  assert.equal(assessment.metrics.useful_accounts, 2);
  assert.equal(assessment.metrics.unsupported_or_invented_accounts, 1);
  assert.deepEqual(assessment.metrics.roles, { representative: 1, "edge-case": 1, calibration: 1 });
  assert.equal(assessment.safety.live_provider_call, false);
  assert.equal(assessment.safety.provider_spend, false);
  assert.equal(assessment.safety.production_writes, false);
  assert.equal(assessment.safety.runtime_model_mode_integration, false);
  assert.equal(assessment.launch_readiness_claim, false);
});

test("controlled-corpus usefulness status records sanitized fail result and non-authorizing boundaries", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-spend usefulness assessment/i,
    /uses only sanitized facts/i,
    /does not read raw provider output/i,
    /does not execute a provider call/i,
    /source status: `runtime-model-only-controlled-corpus-status\.md`/i,
    /provider_calls_executed_by_assessment: 0/i,
    /provider_spend_by_assessment: false/i,
    /status: fail/i,
    /overall_classification: unsupported\/invented/i,
    /total_accounts: 3/i,
    /useful_accounts: 2/i,
    /unsupported_or_invented_accounts: 1/i,
    /representative: 1/i,
    /edge-case: 1/i,
    /calibration: 1/i,
    /representative slot had a provenance-support gap/i,
    /entity-label split/i,
    /product-preview approval recommended: false/i,
    /next step: no-spend diagnosis\/remediation/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]) {
    assert.match(doc, required, `status doc must contain ${required}`);
  }

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /provider_lock_in: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /product-preview approval recommended: true/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `status doc must not contain ${forbidden}`);
  }
});
