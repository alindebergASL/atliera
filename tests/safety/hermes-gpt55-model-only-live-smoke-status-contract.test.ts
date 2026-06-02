import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-model-only-live-smoke-status.md");
const DIRECTION_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-model-only-transport-direction.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: Hermes GPT-5.5 model-only live smoke status records sanitized failed call without broad authorization", () => {
  const status = readRepoFile(STATUS_DOC);

  assert.match(status, /Status: sanitized failed single-call smoke record/i);
  assert.match(status, /approved_max_cost_usd: 1\.00/i);
  assert.match(status, /provider_calls_executed: 1/i);
  assert.match(status, /provider_spend_authorized: true/i);
  assert.match(status, /status: exception/i);
  assert.match(status, /error_code: BadRequestError/i);
  assert.match(status, /model_only_transport_proven: false/i);
  assert.match(status, /authorizes_comparison_run: false/i);
  assert.match(status, /raw_evidence_committed: false/i);
  assert.match(status, /credential_value_observed: false/i);
  assert.match(status, /tools_sent: false/i);
  assert.match(status, /tool_choice_sent: false/i);
  assert.match(status, /parallel_tool_calls_sent: false/i);
  assert.match(status, /web_search_sent: false/i);
  assert.match(status, /mcp_sent: false/i);
  assert.match(status, /plugins_sent: false/i);
  assert.match(status, /retrieval_sent: false/i);
  assert.match(status, /synthetic_only: true/i);
  assert.match(status, /retry_requires_new_approval: true/i);
  assert.match(status, /private evidence retained outside the repository/i);

  for (const forbidden of [
    /\/tmp\/atliera-gpt55-live-smoke-private/i,
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /raw[_ -]?(?:provider|model)?[_ -]?(?:request|response|payload)\s*[:=]/i,
    /sk-[A-Za-z0-9]/i,
    /session_id\s*[:=]/i,
    /output_text\s*[:=]/i,
    /strict JSON parsed: true/i,
    /provider-quality conclusion/i,
    /production readiness (?:is )?(?:proven|claimed|established)/i,
    /comparison run (?:is )?(?:approved|authorized|executed)/i,
  ]) {
    assert.doesNotMatch(status, forbidden);
  }

  const direction = readRepoFile(DIRECTION_DOC);
  assert.match(direction, /hermes-gpt55-model-only-live-smoke-status\.md/i);
  assert.match(direction, /BadRequestError/i);
  assert.match(direction, /model_only_transport_proven: false/i);
});
