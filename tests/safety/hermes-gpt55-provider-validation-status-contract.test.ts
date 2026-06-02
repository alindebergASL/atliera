import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-provider-validation-status.md");
const DIRECTION_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-model-only-transport-direction.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: Hermes GPT-5.5 provider validation status is sanitized and bounded", () => {
  const status = readRepoFile(STATUS_DOC);
  const direction = readRepoFile(DIRECTION_DOC);

  for (const required of [
    /Status: sanitized successful provider-validation status/i,
    /approved synthetic provider-boundary validation/i,
    /ExternalCommandModelProvider/i,
    /provider: `openai-codex`/i,
    /model: `gpt-5\.5`/i,
    /provider_call: pass/i,
    /response_contract: pass/i,
    /prompt_contract_output: pass/i,
    /cost_ledger_entry: pass/i,
    /ledger_status: succeeded/i,
    /observed_cost_usd: 0/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /raw_evidence_committed: false/i,
    /private_wrapper_committed: false/i,
    /private_runner_committed: false/i,
    /credentials_committed: false/i,
    /provider_body_committed: false/i,
    /authorizes_comparison_run: false/i,
    /approved_gpt55_comparison_executed: false/i,
    /launch_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
  ]) {
    assert.match(status, required);
  }

  assert.match(direction, /hermes-gpt55-provider-validation-status\.md/i);
  assert.match(direction, /provider validation succeeded through `ExternalCommandModelProvider`/i);
  assert.match(direction, /comparison execution remains blocked/i);

  for (const forbidden of [
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /(?:^|\s)token\s*[:=]/i,
    /raw[_ -]?request\s*[:=]/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?transcript\s*[:=]/i,
    /provider_call:\s*fail/i,
    /response_contract:\s*fail/i,
    /authorizes_comparison_run: true/i,
    /approved_gpt55_comparison_executed: true/i,
    /launch_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
  ]) {
    assert.doesNotMatch(status, forbidden);
  }
});
