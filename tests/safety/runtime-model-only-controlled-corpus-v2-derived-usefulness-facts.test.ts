import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  assessControlledCorpusV2UsefulnessFacts,
  validateControlledCorpusV2UsefulnessFacts,
} from "../../src/validation/controlled-corpus-v2-usefulness-facts.ts";

const DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "runbooks",
  "runtime-model-only-controlled-corpus-v2-derived-usefulness-facts.md",
);

const sanitizedFacts = [
  {
    account_ref: "acct-representative",
    role: "representative",
    output_counts: { excerpts: 3, claims: 2, account_objects: 1 },
    hard_invariants: {
      v2_contract_validated: true,
      canonical_account_ref: true,
      no_invented_ids: true,
      all_claims_supported: true,
      all_account_objects_supported: true,
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
    output_counts: { excerpts: 3, claims: 2, account_objects: 1 },
    hard_invariants: {
      v2_contract_validated: true,
      canonical_account_ref: true,
      no_invented_ids: true,
      all_claims_supported: true,
      all_account_objects_supported: true,
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
    output_counts: { excerpts: 3, claims: 3, account_objects: 1 },
    hard_invariants: {
      v2_contract_validated: true,
      canonical_account_ref: true,
      no_invented_ids: true,
      all_claims_supported: true,
      all_account_objects_supported: true,
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

test("derived v2 usefulness facts classify as useful bounded signal without authorizing next action", () => {
  const assessment = assessControlledCorpusV2UsefulnessFacts(
    validateControlledCorpusV2UsefulnessFacts([...sanitizedFacts]),
  );

  assert.equal(assessment.ok, true);
  assert.equal(assessment.status, "pass");
  assert.equal(assessment.overall_classification, "useful_bounded_signal");
  assert.equal(assessment.metrics.total_accounts, 3);
  assert.equal(assessment.metrics.useful_accounts, 3);
  assert.equal(assessment.metrics.weak_accounts, 0);
  assert.equal(assessment.metrics.hard_blocked_accounts, 0);
  assert.deepEqual(assessment.metrics.output_counts, { excerpts: 9, claims: 7, account_objects: 3 });
  assert.equal(assessment.safety.provider_calls_executed_by_assessment, 0);
  assert.equal(assessment.safety.authorizes_product_preview_run, false);
  assert.equal(assessment.launch_readiness_claim, false);
});

test("derived v2 usefulness fact status is public-safe and non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-spend sanitized per-account v2 usefulness fact derivation/i,
    /Source status: `runtime-model-only-controlled-corpus-v2-status\.md`/i,
    /Rubric: `runtime-model-only-controlled-corpus-v2-usefulness-fact-rubric\.md`/i,
    /provider_calls_executed_by_derivation: 0/i,
    /provider_spend_by_derivation: false/i,
    /raw_or_model_output_committed: false/i,
    /facts_status: derived/i,
    /assessment_status: pass/i,
    /overall_classification: useful_bounded_signal/i,
    /total_accounts: 3/i,
    /useful_accounts: 3/i,
    /weak_accounts: 0/i,
    /hard_blocked_accounts: 0/i,
    /excerpts: 9/i,
    /claims: 7/i,
    /account_objects: 3/i,
    /acct-representative/i,
    /acct-edge-case/i,
    /acct-calibration/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /product-preview approval recommended: false/i,
    /next step: separate docs-only product-preview approval packet decision/i,
  ]) {
    assert.match(doc, required, `derived fact doc must contain ${required}`);
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
    /product-preview approval recommended: true/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    /private-provider-evidence/i,
    /raw_provider_output_text/i,
    /raw_harness_transport_request/i,
    /raw_provider_metadata/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `derived fact doc must not contain ${forbidden}`);
  }
});
