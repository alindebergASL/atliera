import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-live-proof-status-writer.md");

test("runtime model-only live proof status writer doc remains sanitized and non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");
  for (const required of [
    /Status: sanitized status writer contract/i,
    /This PR does not execute a provider call/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_value_observed: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /retry_requires_new_approval: true/i,
    /no automatic retry/i,
  ]) assert.match(doc, required);

  for (const forbidden of [/raw prompt/i, /raw response body/i, /private evidence path/i, /provider_calls_executed: [2-9]/i, /production ready/i, /default production model/i]) {
    assert.doesNotMatch(doc, forbidden);
  }
});
