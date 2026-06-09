import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const APPROVAL = join(ROOT, "docs/runbooks/runtime-route-guarded-lab-proof-approval-packet.md");
const HARDENING = join(ROOT, "docs/runbooks/runtime-route-chain-no-call-hardening-status.md");
const ROUTE_CATALOG = join(ROOT, "fixtures/model/validated-route-catalog-snapshot-20260609-runtime-route-guarded-lab-proof.json");
const REVALIDATION_PLAN = join(ROOT, "docs/plans/2026-06-06-runtime-route-recency-revalidation.md");
const USEFULNESS_ASSESSMENT = join(ROOT, "docs/runbooks/runtime-route-fresh-lab-proof-usefulness-assessment.md");
const RUNTIME_MODEL_ONLY_PREFLIGHT = join(ROOT, "src/model/runtime-model-only-proof-preflight.ts");
const LAB_RUNTIME_PROOF_VERIFIER = join(ROOT, "src/validation/live-provider-moderate-proof-verifier.ts");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertContainsAll(label: string, text: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(text, pattern, `${label} must contain ${pattern}`);
}

function assertExactMarker(label: string, text: string, marker: string, value: string): void {
  assert.match(text, new RegExp(`^- ${marker}: ${value}$`, "mi"), `${label} must contain exact marker ${marker}: ${value}`);
}

function assertNoLeakage(label: string, text: string): void {
  for (const pattern of [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]\s*bearer/i,
    /bearer\s+[A-Za-z0-9._-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoForbiddenBroadening(label: string, text: string): void {
  for (const pattern of [
    /provider_call_executed_in_this_pr:\s*true/i,
    /adds_runtime_provider_call_source:\s*true/i,
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /current_effective_authorization:\s*(?!none\b)\S+/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_revalidation_run:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_corpus_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /authorizes_production_use:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /authorizes_mcp:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_comparison_claim:\s*true/i,
    /provider_quality_conclusion:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /^- max_attempts:\s*(?!1$)\d+/im,
    /^- max_provider_calls:\s*(?!1$)\d+/im,
    /^- max_transport_calls:\s*(?!1$)\d+/im,
    /^- max_cost_usd:\s*(?!1$)\d+/im,
    /^- proposed_future_attempts:\s*(?!1$)\d+/im,
    /standing approval/i,
    /may retry without/i,
    /production ready/i,
    /launch ready/i,
    /default model selected/i,
    /(?:approves|authorizes|allows|enables|permits|greenlights)\s+(?:a\s+)?(?:retry|revalidation run|provider comparison|model comparison|default model|graph ingestion|production use|production write|product-preview expansion|corpus expansion|tools|web search|plugins|retrieval|mcp)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

function assertEveryPreflightCallRequiresFresh(label: string, text: string): void {
  const calls = text.match(/preflightRuntimeModelExecution\(\{[\s\S]*?\n\s*\}\);/g) ?? [];
  assert.ok(calls.length > 0, `${label} must call preflightRuntimeModelExecution`);
  for (const call of calls) {
    assert.match(call, /requiredRouteEvidenceStatus: "fresh"/, `${label} preflight call must require fresh route evidence`);
  }
}

test("guarded lab proof approval packet is docs-only and depends on route-chain hardening", () => {
  const approval = read(APPROVAL);
  const hardening = read(HARDENING);

  assert.match(hardening, /Status: completed no-call route-chain hardening/i);
  assert.match(hardening, /runtime-route-guarded-lab-proof-approval-packet\.md/i);
  assert.match(hardening, /pre-run docs-only scope packet/i);
  assert.match(hardening, /validation_age_days_reported_at_observed_time: true/i);
  assert.match(hardening, /current_effective_authorization: none/i);

  assertContainsAll("guarded lab proof approval", approval, [
    /Runtime Route Guarded Lab Proof Approval Packet/i,
    /Status: pre-run docs-only approval packet\. This PR does not execute a provider call\./i,
    /runtime-route-chain-no-call-hardening-status\.md/i,
    /preflight-recomputed route recency/i,
    /selected route and preflight route identity must match/i,
    /status must match preflight outcome/i,
    /validation age must be derived at observedAt/i,
    /provider_call_executed_in_this_pr: false/i,
    /adds_runtime_provider_call_source: false/i,
    /execution_requires_explicit_operator_instruction_after_merge: true/i,
    /approval_effective_before_merge_and_operator_execution_instruction: false/i,
    /authorizes_provider_call: false` marker describes the current and this-PR boundary/i,
    /any later single lab call still needs merge plus that separate operator instruction/i,
  ]);

  assertExactMarker("guarded lab proof approval", approval, "current_effective_authorization", "none");
  assertNoLeakage("guarded lab proof approval", approval);
  assertNoForbiddenBroadening("guarded lab proof approval", approval);
});

test("guarded lab proof approval names exact one-attempt fresh-route scope", () => {
  const approval = read(APPROVAL);

  assertContainsAll("guarded lab proof scope", approval, [
    /approval_id: runtime-route-guarded-lab-proof-20260609a/i,
    /route_ref: gpt-5\.5-openai-codex-repeatability-20260604h/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_ref: injected-model-provider-lab-runtime-harness/i,
    /environment: lab/i,
    /operation: graph\.propose/i,
    /corpus_ref: external-corpus\/lab-runtime-model-proof\.json/i,
    /corpus_scope: synthetic-only/i,
    /route_kind: candidate/i,
    /route_recency_status_required: fresh/i,
    /fresh_route_required_at_execution_time: true/i,
    /stale, expired, nearing-expiry, or candidate-label-only route evidence blocks before provider access/i,
    /If route evidence is not fresh at execution preflight, record a blocked status with provider_calls_executed: 0 and provider_spend: false/i,
    /no route substitution/i,
    /no shell, curl, Hermes session, Claude Code session, or autonomous-agent substitution/i,
  ]);

  assertExactMarker("guarded lab proof scope", approval, "proposed_future_attempts", "1");
  assertExactMarker("guarded lab proof scope", approval, "max_attempts", "1");
  assertExactMarker("guarded lab proof scope", approval, "max_provider_calls", "1");
  assertExactMarker("guarded lab proof scope", approval, "max_transport_calls", "1");
  assertExactMarker("guarded lab proof scope", approval, "max_cost_usd", "1");
  assertNoForbiddenBroadening("guarded lab proof scope", approval);
});

test("guarded lab proof approval pins selected route provenance to a committed catalog snapshot", () => {
  const approval = read(APPROVAL);
  const catalog = JSON.parse(read(ROUTE_CATALOG)) as {
    schema_version: string;
    provider_calls_executed: number;
    provider_spend: boolean;
    default_model_selection_claim: boolean;
    provider_lock_in: boolean;
    validated_routes: Array<{
      route_ref: string;
      provider_ref: string;
      model_label: string;
      route_kind: string;
      validated_at: string;
      evidence_expires_at: string;
      validation_refs: string[];
    }>;
  };

  assertContainsAll("guarded lab proof route provenance", approval, [
    /route_catalog_snapshot: fixtures\/model\/validated-route-catalog-snapshot-20260609-runtime-route-guarded-lab-proof\.json/i,
    /route_validated_at: 2026-06-05T00:00:00\.000Z/i,
    /route_evidence_expires_at: 2026-07-05T00:00:00\.000Z/i,
    /route_validation_ref: docs\/runbooks\/runtime-model-only-tiny-live-runtime-proof-remediated-status\.md/i,
    /route_validation_ref: docs\/runbooks\/runtime-model-only-tiny-live-runtime-proof-remediated-assessment\.md/i,
    /route_validation_ref: docs\/runbooks\/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet\.md/i,
  ]);

  assert.equal(catalog.schema_version, "atliera.validated_model_route_catalog.snapshot.v1");
  assert.equal(catalog.provider_calls_executed, 0);
  assert.equal(catalog.provider_spend, false);
  assert.equal(catalog.default_model_selection_claim, false);
  assert.equal(catalog.provider_lock_in, false);

  const selectedRoute = catalog.validated_routes.find(
    (route) => route.route_ref === "gpt-5.5-openai-codex-repeatability-20260604h",
  );
  assert.ok(selectedRoute, "committed route catalog snapshot must contain selected route_ref");
  assert.equal(selectedRoute.provider_ref, "openai-codex");
  assert.equal(selectedRoute.model_label, "gpt-5.5");
  assert.equal(selectedRoute.route_kind, "candidate");
  assert.equal(selectedRoute.validated_at, "2026-06-05T00:00:00.000Z");
  assert.equal(selectedRoute.evidence_expires_at, "2026-07-05T00:00:00.000Z");
  assert.deepEqual(selectedRoute.validation_refs, [
    "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-status.md",
    "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-assessment.md",
    "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-remediated-approval-packet.md",
  ]);
  assertNoLeakage("guarded lab proof route provenance", approval);
  assertNoForbiddenBroadening("guarded lab proof route provenance", approval);
});

test("guarded lab proof approval requires future status to bind explicit instruction, approval id, and ledger cap", () => {
  const approval = read(APPROVAL);

  assertContainsAll("guarded lab proof future status", approval, [
    /operator_execution_instruction_ref_required: true/i,
    /status_must_quote_or_reference_explicit_operator_instruction: true/i,
    /status_must_record_approval_id: runtime-route-guarded-lab-proof-20260609a/i,
    /status_must_record_runtime_approval_id_matches_packet: true/i,
    /status_must_record_budget_cap_usd: 1/i,
    /status_must_record_cost_ledger_headroom_before_call: true/i,
    /status_must_record_provider_calls_with_same_approval_id: true/i,
  ]);

  assertNoLeakage("guarded lab proof future status", approval);
  assertNoForbiddenBroadening("guarded lab proof future status", approval);
});

test("guarded lab proof runtime entrypoints require fresh route evidence at preflight", () => {
  const runtimeModelOnlyPreflight = read(RUNTIME_MODEL_ONLY_PREFLIGHT);
  const labRuntimeProofVerifier = read(LAB_RUNTIME_PROOF_VERIFIER);

  assertEveryPreflightCallRequiresFresh("runtime model-only proof preflight", runtimeModelOnlyPreflight);
  assertEveryPreflightCallRequiresFresh("lab runtime proof verifier", labRuntimeProofVerifier);
});

test("route recency revalidation plan defines expiry handling without authorizing revalidation", () => {
  const plan = read(REVALIDATION_PLAN);

  assertContainsAll("route recency revalidation plan", plan, [
    /expiry handling contract/i,
    /nearing-expiry evidence may warn but must not become a provider call, retry, revalidation run, comparison, graph ingestion, production use, or default model selection/i,
    /expired-needs-revalidation evidence must block before provider access/i,
    /a revalidation run requires a separate approval packet/i,
    /revalidation status must be sanitized/i,
    /authorizes_revalidation_run: false/i,
    /current_effective_authorization: none/i,
  ]);

  assertNoLeakage("route recency revalidation plan", plan);
  assertNoForbiddenBroadening("route recency revalidation plan", plan);
});

test("fresh route usefulness assessment defines when route proofing is enough before returning to product work", () => {
  const assessment = read(USEFULNESS_ASSESSMENT);

  assertContainsAll("route proofing enough criteria", assessment, [
    /route-proofing frontier enough criteria/i,
    /one exact-route lab runtime proof exists/i,
    /no-call route-chain hardening is tested/i,
    /fresh-only execution preflight enforcement exists/i,
    /future live attempts require separate approval/i,
    /return to product\/Gate 3-4 work with fake, sanitized, or no-spend fixtures/i,
  ]);

  assertNoLeakage("route proofing enough criteria", assessment);
  assertNoForbiddenBroadening("route proofing enough criteria", assessment);
});

test("guarded lab proof approval preserves closed boundaries and separate sanitized status", () => {
  const approval = read(APPROVAL);

  assertContainsAll("guarded lab proof boundaries", approval, [
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_revalidation_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_product_preview_expansion: false/i,
    /authorizes_corpus_expansion: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_graph_ingestion: false/i,
    /authorizes_production_use: false/i,
    /authorizes_tools: false/i,
    /authorizes_web_search: false/i,
    /authorizes_plugins: false/i,
    /authorizes_retrieval: false/i,
    /authorizes_mcp: false/i,
    /provider_payload_committed: false/i,
    /model_output_committed: false/i,
    /raw_prompt_committed: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /private_evidence_committed: false/i,
    /credential_material_committed: false/i,
    /request_identifier_committed: false/i,
    /default_model_selection_claim: false/i,
    /provider_comparison_claim: false/i,
    /provider_quality_conclusion: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /provider_lock_in: false/i,
    /The later status follow-up must be sanitized and separate from this packet/i,
    /status: completed, exception, or blocked/i,
    /non-authorizing boundary markers/i,
    /raw prompt text/i,
    /raw request, raw response, or provider payload bodies/i,
    /model output text/i,
    /request identifiers/i,
    /credential-bearing values or auth headers/i,
    /private evidence paths or local evidence locations/i,
  ]);

  assertNoLeakage("guarded lab proof boundaries", approval);
  assertNoForbiddenBroadening("guarded lab proof boundaries", approval);
});
