import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const STATUS = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-live-proof-status.md");

test("runtime model-only live proof status is sanitized and fail-closed", () => {
  const status = readFileSync(STATUS, "utf8");
  for (const required of [
    /Status: blocked before provider access/i,
    /approval packet: `runtime-model-only-live-proof-approval\.md`/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /approved_max_cost_usd: 1/i,
    /status: blocked/i,
    /reason_code: model_only_live_transport_unavailable/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_value_observed: false/i,
    /authorizes_comparison_run: false/i,
    /authorizes_candidate_calls: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    /no automatic retry/i,
    /autonomous agent execution surface/i,
    /not a proven injected `model-only-codex-auth` transport/i,
  ]) assert.match(status, required);

  for (const forbidden of [
    /provider_calls_executed: [1-9]/i,
    /provider_spend: true/i,
    /live proof completed/i,
    /model_only_transport_proven: true/i,
    /production ready/i,
    /default production model/i,
    /comparison authorized/i,
    /raw provider response/i,
    /api[_-]?key/i,
    /authorization header/i,
  ]) assert.doesNotMatch(status, forbidden);
});
