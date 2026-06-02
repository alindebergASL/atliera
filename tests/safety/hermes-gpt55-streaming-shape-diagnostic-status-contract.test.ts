import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-streaming-shape-diagnostic-status.md");
const DIRECTION_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-model-only-transport-direction.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: Hermes GPT-5.5 streaming shape diagnostic status records root cause without raw evidence", () => {
  const status = readRepoFile(STATUS_DOC);

  assert.match(status, /Status: sanitized request-shape diagnostic record/i);
  assert.match(status, /provider_calls_executed: 3/i);
  assert.match(status, /nonstream_with_max_output_tokens/i);
  assert.match(status, /nonstream_no_max_output_tokens/i);
  assert.match(status, /stream_no_max_output_tokens/i);
  assert.match(status, /Stream must be set to true/i);
  assert.match(status, /accepted_output_observed: true/i);
  assert.match(status, /accepted_output_chars: 14/i);
  assert.match(status, /root_cause: nonstreaming Responses requests are rejected by the Codex backend/i);
  assert.match(status, /proof_update: provider payload uses the observed accepted shape with `stream: true` and without `max_output_tokens`/i);
  assert.match(status, /raw_evidence_committed: false/i);
  assert.match(status, /credential_value_observed: false/i);
  assert.match(status, /authorizes_comparison_run: false/i);
  assert.match(status, /retry_requires_new_approval: false/i);
  assert.match(status, /Atliera runtime `ModelProvider` execution remains unimplemented/i);

  for (const forbidden of [
    /\/tmp\/atliera-gpt55-live-smoke-private/i,
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /raw[_ -]?(?:provider|model)?[_ -]?(?:request|response|payload)\s*[:=]/i,
    /sk-[A-Za-z0-9]/i,
    /session_id\s*[:=]/i,
    /Return exactly/i,
    /\{"smoke":"ok"\}/i,
    /comparison run (?:is )?(?:approved|authorized|executed)/i,
    /production readiness (?:is )?(?:proven|claimed|established)/i,
  ]) {
    assert.doesNotMatch(status, forbidden);
  }

  const direction = readRepoFile(DIRECTION_DOC);
  assert.match(direction, /hermes-gpt55-streaming-shape-diagnostic-status\.md/i);
  assert.match(direction, /uses the observed accepted shape with `stream: true`/i);
  assert.match(direction, /without `max_output_tokens`/i);
});
