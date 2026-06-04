import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "runbooks",
  "runtime-model-only-controlled-corpus-remediation-plan.md",
);

test("controlled-corpus remediation plan diagnoses support gap without authorizing another provider call", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-spend remediation plan/i,
    /source usefulness status: `runtime-model-only-controlled-corpus-usefulness-status\.md`/i,
    /overall_classification: unsupported\/invented/i,
    /representative slot provenance-support gap/i,
    /entity-label split/i,
    /root diagnosis: output-contract weakness/i,
    /root diagnosis: prompt-contract weakness/i,
    /root diagnosis: account-label normalization weakness/i,
    /No provider call is authorized by this remediation plan/i,
    /no-spend contract remediation before any retry/i,
    /require every account_object to include nonempty supporting_excerpt_ids/i,
    /require supporting_excerpt_ids to resolve to known excerpt ids/i,
    /require a canonical account_ref on excerpts, claims, and account_objects/i,
    /reject display-name-only account labels/i,
    /reject account_objects without provenance/i,
    /fake-mode regression before live retry/i,
    /separate approval packet before any corrected run/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_corrected_run: false/i,
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
    assert.match(doc, required, `remediation plan must contain ${required}`);
  }

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_corrected_run: true/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /provider_lock_in: true/i,
    /product-preview approval recommended: true/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `remediation plan must not contain ${forbidden}`);
  }
});
