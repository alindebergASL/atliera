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
  "runtime-model-only-controlled-corpus-v2-usefulness-fact-rubric.md",
);

test("v2 usefulness fact rubric documents sanitized fact shape and non-authorizing boundaries", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-spend sanitized per-account fact-shape\/rubric/i,
    /does not execute a provider call/i,
    /does not read raw provider output/i,
    /does not authorize product preview/i,
    /account_ref: canonical `acct-\*` reference/i,
    /role: one of `representative`, `edge-case`, `calibration`/i,
    /v2_contract_validated/i,
    /canonical_account_ref/i,
    /no_invented_ids/i,
    /all_claims_supported/i,
    /all_account_objects_supported/i,
    /no_private_leakage/i,
    /materiality/i,
    /specificity/i,
    /account_usefulness/i,
    /lens_usefulness/i,
    /source_fit/i,
    /useful_bounded_signal/i,
    /weak_but_structurally_valid/i,
    /hard_invariant_blocked/i,
    /provider_calls_executed_by_assessment: 0/i,
    /provider_spend_by_assessment: false/i,
    /raw_or_model_output_read_by_assessment: false/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_default_model_selection: false/i,
    /launch_readiness_claim: false/i,
    /The next step is to derive a sanitized per-account fact set/i,
  ]) {
    assert.match(doc, required, `rubric doc must contain ${required}`);
  }

  for (const forbidden of [
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_default_model_selection: true/i,
    /launch_readiness_claim: true/i,
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
    assert.doesNotMatch(doc, forbidden, `rubric doc must not contain ${forbidden}`);
  }
});
