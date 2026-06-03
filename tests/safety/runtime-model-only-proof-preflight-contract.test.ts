import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-proof-preflight.md");

test("runtime model-only proof preflight doc preserves no-spend non-authorizing boundary", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const required of [
    /no-spend activation preflight proof/i,
    /ready_for_one_synthetic_live_proof: true/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /credential_value_observed: false/i,
    /raw_evidence_committed: false/i,
    /authorizes_comparison_run: false/i,
    /authorizes_candidate_calls: false/i,
    /model_only_transport_proven: false/i,
    /runtime_model_provider_implemented: false/i,
    /external-corpus\/synthetic-/i,
    /prompts\/synthetic-/i,
    /separate docs-only approval packet/i,
  ]) assert.match(doc, required);

  for (const forbidden of [/provider call executed/i, /live proof completed/i, /production ready/i, /default production model/i, /comparison authorized/i]) {
    assert.doesNotMatch(doc, forbidden);
  }
});
