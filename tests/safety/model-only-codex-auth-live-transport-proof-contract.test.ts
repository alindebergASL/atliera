import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { proveModelOnlyCodexAuthLiveTransport } from "../../src/model/model-only-codex-auth-live-transport-proof.ts";
import type { ModelOnlyCodexAuthLiveTransportProofInput } from "../../src/model/model-only-codex-auth-live-transport-proof.ts";

const DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "runbooks",
  "model-only-codex-auth-live-transport-proof.md",
);

function safeInput(): ModelOnlyCodexAuthLiveTransportProofInput {
  return {
    routeRef: "gpt-5.5-openai-codex-20260602a",
    providerRef: "openai-codex",
    modelLabel: "gpt-5.5",
    transportKind: "model-only-codex-auth",
    approvedMaxCostUsd: 1,
    boundary: {
      acceptsModelProviderRequestOnly: true,
      returnsModelProviderResponseOnly: true,
      requestShapeExact: true,
      responseShapeExact: true,
      syntheticScopeOnly: true,
      credentialNeutral: true,
      privateEvidenceOutsideRepo: true,
      noTools: true,
      noShell: true,
      noFileAccess: true,
      noWebSearch: true,
      noPlugins: true,
      noMcp: true,
      noRetrieval: true,
      noSessionCarryover: true,
    },
    accounting: {
      transportInvoked: false,
      providerCallsExecuted: 0,
      observedCostUsd: 0,
      rawEvidenceCommitted: false,
    },
  };
}

test("model-only codex-auth live transport proof helper preserves non-authorizing, no-call markers", () => {
  const proof = proveModelOnlyCodexAuthLiveTransport(safeInput());

  // No-call / no-spend invariants.
  assert.equal(proof.transport_invoked, false);
  assert.equal(proof.provider_calls_executed, 0);
  assert.equal(proof.provider_spend, false);
  assert.equal(proof.observed_cost_usd, 0);
  assert.equal(proof.model_only_live_transport_implemented, false);

  // No raw / credential evidence may be committed or observed.
  assert.equal(proof.raw_evidence_committed, false);
  assert.equal(proof.credential_value_observed, false);

  // Forbidden surfaces all proven absent.
  for (const key of [
    "no_tools",
    "no_shell",
    "no_file_access",
    "no_web_search",
    "no_plugins",
    "no_mcp",
    "no_retrieval",
    "no_session_carryover",
  ] as const) {
    assert.equal(proof[key], true, `${key} must be proven true`);
  }

  // Non-authorizing markers.
  for (const key of [
    "authorizes_provider_call",
    "authorizes_candidate_calls",
    "authorizes_comparison_run",
    "default_model_selection_claim",
    "provider_lock_in",
    "production_readiness_claim",
    "product_readiness_claim",
    "launch_readiness_claim",
  ] as const) {
    assert.equal(proof[key], false, `${key} must remain false`);
  }
  assert.equal(proof.retry_requires_new_approval, true);
  assert.equal(proof.requires_fresh_approval_before_live_proof, true);
});

test("model-only codex-auth live transport proof runbook stays a no-call prerequisite, not the live proof", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-call prerequisite proof contract/i,
    /This PR does not execute a provider call/i,
    /prerequisite, not the live proof itself/i,
    /never references or invokes any transport callable/i,
    /fresh approval packet/i,
    /private raw evidence/i,
    // Route boundary.
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /approved_max_cost_usd: 1/i,
    // Sanitized outcome markers.
    /model_only_transport_proven: true/i,
    /model_only_live_transport_implemented: false/i,
    /transport_invoked: false/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /observed_cost_usd: 0/i,
    /raw_evidence_committed: false/i,
    /credential_value_observed: false/i,
    /no_tools: true/i,
    /no_shell: true/i,
    /no_file_access: true/i,
    /no_web_search: true/i,
    /no_plugins: true/i,
    /no_mcp: true/i,
    /no_retrieval: true/i,
    /no_session_carryover: true/i,
    // Forbidden surfaces.
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no provider comparison/i,
    /no default model selection/i,
    /no provider lock-in/i,
    /no autonomous-agent substitution/i,
    // Non-authorizing markers.
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    /requires_fresh_approval_before_live_proof: true/i,
    /no automatic retry/i,
  ]) {
    assert.match(doc, required, `proof runbook must contain: ${required}`);
  }

  // The proof must NOT imply a completed/executed live proof, spend,
  // authorization, default selection, comparison, readiness, or any
  // raw/private evidence.
  for (const forbidden of [
    /live proof completed/i,
    /live proof executed/i,
    /transport_invoked: true/i,
    /provider_calls_executed: [1-9]/i,
    /provider_spend: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_candidate_calls: true/i,
    /authorizes_comparison_run: true/i,
    /default model selection authorized/i,
    /provider_lock_in: true/i,
    /\bproduction[ -]ready\b/i,
    /launch ready/i,
    /retries authorized/i,
    /comparison authorized/i,
    /raw prompt/i,
    /raw response body/i,
    /private evidence path/i,
    /raw_evidence_committed: true/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `proof runbook must not contain: ${forbidden}`);
  }
});
