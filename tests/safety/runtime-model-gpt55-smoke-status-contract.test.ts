import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const STATUS = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-gpt55-smoke-status.md");
const APPROVAL = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-gpt55-smoke-approval.md");

test("runtime GPT-5.5 smoke status records blocked safe-transport state", () => {
  const status = readFileSync(STATUS, "utf8");
  const approval = readFileSync(APPROVAL, "utf8");
  assert.match(approval, /Status: pre-run docs-only approval packet/i);
  for (const required of [
    /Status: blocked before provider call/i,
    /runtime-model-gpt55-smoke-approval\.md/i,
    /safe runtime transport unavailable/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /authorizes_provider_call: false/i,
    /retry_requires_new_approval: true/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
  ]) assert.match(status, required);

  for (const forbidden of [/api[_-]?key/i, /raw prompt/i, /raw response body/i, /source text/i, /account ref/i, /production ready/i, /default production model/i]) {
    assert.doesNotMatch(status, forbidden);
  }
});
