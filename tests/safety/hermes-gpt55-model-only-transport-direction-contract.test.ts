import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DIRECTION_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-model-only-transport-direction.md");
const CODEX_STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "codex-auth-model-only-transport-proof-status.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: Hermes GPT-5.5 direction records provider route without authorizing this operator session", () => {
  const direction = readRepoFile(DIRECTION_DOC);
  const codexStatus = readRepoFile(CODEX_STATUS_DOC);

  for (const required of [
    /Status: no-spend direction record/i,
    /same underlying provider route/i,
    /not this live Hermes operator session/i,
    /not this agent API/i,
    /openai-codex/i,
    /api_mode: `codex_responses`/i,
    /ResponsesApiTransport/i,
    /ProviderProfile/i,
    /model-only adapter/i,
    /HermesGpt55ModelOnlyInjectedTransportProof/i,
    /injected transport proof seam/i,
    /injected fake caller/i,
    /generateNoSpendProof/i,
    /exact-schema strict JSON back into Atliera `ModelProviderResponse`/i,
    /rejects malformed or extra-field responses/i,
    /zero spend/i,
    /intentionally not a `ModelProvider` runtime implementation/i,
    /createHermesGpt55ActivationPreflightProof/i,
    /no-spend activation preflight proof/i,
    /ready_for_one_synthetic_smoke: true/i,
    /credential_value_observed: false/i,
    /authorizes_comparison_run: false/i,
    /sanitized injected credential readiness/i,
    /prompts\/synthetic-\*/i,
    /already-materialized plain data/i,
    /hostile JavaScript Proxy objects are outside this proof boundary/i,
    /HermesGpt55StreamingModelProvider/i,
    /injected streaming-response adapter seam/i,
    /implements `ModelProvider` only through injected stream caller/i,
    /consumes `response.output_text.delta` events/i,
    /fails closed on `response.failed` and `response.incomplete`/i,
    /does not construct credentials, clients, SDK imports, or network access/i,
    /comparison execution remains blocked/i,
    /Atliera `ModelProviderRequest`/i,
    /Atliera `ModelProviderResponse`/i,
    /tools omitted when no functions are exposed/i,
    /no skills loaded/i,
    /no memory loaded/i,
    /no terminal/i,
    /no file tools/i,
    /no browser/i,
    /no web search/i,
    /no MCP/i,
    /no plugins/i,
    /no retrieval/i,
    /credential-neutral/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /authorizes_candidate_calls: false/i,
    /model_only_transport_proven: false/i,
    /approved_gpt55_comparison_executed: false/i,
  ]) {
    assert.match(direction, required);
  }

  assert.match(codexStatus, /model_only_transport_proven: false/i);
  assert.match(codexStatus, /authorizes_candidate_calls: false/i);

  for (const forbidden of [
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /(?:^|\s)token\s*[:=]/i,
    /OPENAI_API_KEY/i,
    /OPENROUTER_API_KEY/i,
    /CODEX_AUTH(?:_|\s*[:=])/,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?request\s*[:=]/i,
    /raw[_ -]?transcript\s*[:=]/i,
    /authorizes_candidate_calls: true/i,
    /model_only_transport_proven: true/i,
    /provider_calls_executed: [1-9]/i,
    /provider_spend: true/i,
    /approved_gpt55_comparison_executed: true/i,
    /point Atliera at this Hermes session/i,
    /use the live operator session as a provider/i,
    /skills (?:are|enabled|loaded) for candidate calls/i,
    /tools? (?:are|is )?(?:approved|authorized|allowed|enabled) for candidate calls/i,
  ]) {
    assert.doesNotMatch(direction, forbidden);
  }
});
