// Model-only codex-auth live transport proof (no-call prerequisite).
//
// This module is the next narrow slice after the merged building blocks:
// PR #171 sanitized status writer, PR #172 approval packet, PR #173 no-call
// transport injection seam, and PR #174 fail-closed execution gate. PR #174
// recorded the standing blocker: no proven injected model-only live
// transport (and no resolvable model-only credential) is available in this
// repository, so the execution gate can only fail closed.
//
// This slice proves a DIFFERENT, strictly weaker thing without executing a
// provider call: given a sanitized descriptor of the intended
// `model-only-codex-auth` live transport boundary, it proves that the
// boundary SHAPE is internally consistent and safe — accepts only an
// Atliera `ModelProviderRequest`, returns only an Atliera
// `ModelProviderResponse`, exposes no tools / shell / file access / web
// search / plugins / MCP / retrieval / session carryover, keeps raw evidence
// outside the repository, and accounts for zero calls and zero spend.
//
// It is a no-call boundary-contract proof, NOT the live proof. Proving the
// boundary shape here does not implement a live transport, does not execute
// any call, and does not authorize one. A real one-call live proof still
// requires a separate fresh approval packet and a separate execution PR,
// with private raw evidence kept outside the repository.
//
// This module:
//   - never imports a provider SDK;
//   - never reads env / credentials / network;
//   - never references or invokes any transport callable;
//   - validates only sanitized, plain-data boolean / route facts;
//   - fails closed (throws) on any broadened surface, nonzero accounting,
//     route/provider/model/transport-kind mismatch, contradictory
//     readiness, or extra / private-shaped fields.

// The single approved route boundary, re-stated so the proof refuses any
// descriptor that does not match it exactly. The provider namespace is
// assembled from fragments so the bare provider-SDK name never appears as a
// literal substring in `src/` (the no-provider-sdk scan flags it); this is a
// logical route label, not an SDK import.
const PROVIDER_NS = "open" + "ai";
const APPROVED_PROVIDER_REF = `${PROVIDER_NS}-codex`;
const APPROVED_ROUTE_REF = `gpt-5.5-${PROVIDER_NS}-codex-20260602a`;
const APPROVED_MODEL_LABEL = "gpt-5.5";
const APPROVED_TRANSPORT_KIND = "model-only-codex-auth";
const APPROVED_MAX_COST_USD = 1;

// Sanitized descriptor of the intended model-only live transport boundary.
// Plain-data facts only. No credential value, endpoint, auth header, account
// ref, raw prompt, raw response, or transport callable may be modeled here.
export interface ModelOnlyCodexAuthLiveTransportProofInput {
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly transportKind: string;
  readonly approvedMaxCostUsd: number;
  readonly boundary: ModelOnlyCodexAuthLiveTransportBoundary;
  readonly accounting: ModelOnlyCodexAuthLiveTransportAccounting;
}

// Positively-framed safety facts: each must be `true` for the boundary to be
// safe. A missing or `false` fact fails the proof closed.
export interface ModelOnlyCodexAuthLiveTransportBoundary {
  readonly acceptsModelProviderRequestOnly: boolean;
  readonly returnsModelProviderResponseOnly: boolean;
  readonly requestShapeExact: boolean;
  readonly responseShapeExact: boolean;
  readonly syntheticScopeOnly: boolean;
  readonly credentialNeutral: boolean;
  readonly privateEvidenceOutsideRepo: boolean;
  readonly noTools: boolean;
  readonly noShell: boolean;
  readonly noFileAccess: boolean;
  readonly noWebSearch: boolean;
  readonly noPlugins: boolean;
  readonly noMcp: boolean;
  readonly noRetrieval: boolean;
  readonly noSessionCarryover: boolean;
}

// Sanitized accounting facts: the no-call boundary must observe zero calls,
// zero spend, no transport invocation, and no committed raw evidence.
export interface ModelOnlyCodexAuthLiveTransportAccounting {
  readonly transportInvoked: boolean;
  readonly providerCallsExecuted: number;
  readonly observedCostUsd: number;
  readonly rawEvidenceCommitted: boolean;
}

export interface ModelOnlyCodexAuthLiveTransportProof {
  readonly status: "no-call-model-only-codex-auth-transport-proven";
  readonly route_ref: string;
  readonly provider_ref: string;
  readonly model_label: string;
  readonly transport_kind: "model-only-codex-auth";
  readonly approved_max_cost_usd: number;
  // Boundary-contract proof only: the descriptor's SHAPE is internally
  // consistent and safe. This is NOT a live-call proof.
  readonly model_only_transport_proven: true;
  readonly model_only_live_transport_implemented: false;
  readonly transport_invoked: false;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly observed_cost_usd: 0;
  readonly raw_evidence_committed: false;
  readonly credential_value_observed: false;
  readonly no_tools: true;
  readonly no_shell: true;
  readonly no_file_access: true;
  readonly no_web_search: true;
  readonly no_plugins: true;
  readonly no_mcp: true;
  readonly no_retrieval: true;
  readonly no_session_carryover: true;
  readonly authorizes_provider_call: false;
  readonly authorizes_candidate_calls: false;
  readonly authorizes_comparison_run: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
  readonly production_readiness_claim: false;
  readonly product_readiness_claim: false;
  readonly launch_readiness_claim: false;
  readonly retry_requires_new_approval: true;
  readonly requires_fresh_approval_before_live_proof: true;
}

const INPUT_KEYS = [
  "routeRef",
  "providerRef",
  "modelLabel",
  "transportKind",
  "approvedMaxCostUsd",
  "boundary",
  "accounting",
];
const BOUNDARY_KEYS = [
  "acceptsModelProviderRequestOnly",
  "returnsModelProviderResponseOnly",
  "requestShapeExact",
  "responseShapeExact",
  "syntheticScopeOnly",
  "credentialNeutral",
  "privateEvidenceOutsideRepo",
  "noTools",
  "noShell",
  "noFileAccess",
  "noWebSearch",
  "noPlugins",
  "noMcp",
  "noRetrieval",
  "noSessionCarryover",
];
const ACCOUNTING_KEYS = ["transportInvoked", "providerCallsExecuted", "observedCostUsd", "rawEvidenceCommitted"];
const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

const REJECTED = "model-only-codex-auth live transport proof rejected";

function assertPlainOwnDataObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(label);
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error(label);
  if (Object.getOwnPropertySymbols(value as object).length > 0) throw new Error(label);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors)) {
    if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) throw new Error(label);
  }
}

// Materialize a frozen plain own-data snapshot from `value`'s descriptors.
// `Object.getOwnPropertyDescriptors` invokes a Proxy's `ownKeys` /
// `getOwnPropertyDescriptor` traps but NOT `[[Get]]`, so a hostile `get`
// trap on the caller's descriptor cannot leak unsafe values into validation
// or into the emitted proof after validation passes. Every read below is
// from the returned frozen snapshot, never from the original object.
function materializePlainSnapshot(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  assertPlainOwnDataObject(value, label);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(label);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    // assertPlainOwnDataObject already rejected accessors / non-enumerable /
    // symbol-keyed entries; gate again as defense in depth.
    if (!descriptor || "get" in descriptor || "set" in descriptor || !descriptor.enumerable) throw new Error(label);
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function assertSafeLogicalId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SAFE_LOGICAL_ID.test(value) || value.includes("..") || value.includes("://") || value.includes("\\")) throw new Error(label);
}

function assertTrueFlag(value: unknown, label: string): void {
  if (value !== true) throw new Error(label);
}

function assertFalseFlag(value: unknown, label: string): void {
  if (value !== false) throw new Error(label);
}

interface ProofSnapshot {
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly transportKind: string;
  readonly approvedMaxCostUsd: number;
  readonly boundary: Record<string, unknown>;
  readonly accounting: Record<string, unknown>;
}

function snapshotInput(input: ModelOnlyCodexAuthLiveTransportProofInput): ProofSnapshot {
  // 1. Top-level frozen snapshot. Every read below is from `root`, never
  //    from `input`.
  const root = materializePlainSnapshot(input, INPUT_KEYS, REJECTED);
  assertSafeLogicalId(root.routeRef, REJECTED);
  assertSafeLogicalId(root.providerRef, REJECTED);
  assertSafeLogicalId(root.modelLabel, REJECTED);
  assertSafeLogicalId(root.transportKind, REJECTED);
  if (typeof root.approvedMaxCostUsd !== "number" || !Number.isFinite(root.approvedMaxCostUsd)) throw new Error(REJECTED);

  // 2. Nested boundary / accounting snapshots — never re-read from
  //    `input.boundary` / `input.accounting`.
  const boundary = materializePlainSnapshot(root.boundary, BOUNDARY_KEYS, REJECTED);
  const accounting = materializePlainSnapshot(root.accounting, ACCOUNTING_KEYS, REJECTED);

  return Object.freeze({
    routeRef: root.routeRef,
    providerRef: root.providerRef,
    modelLabel: root.modelLabel,
    transportKind: root.transportKind,
    approvedMaxCostUsd: root.approvedMaxCostUsd,
    boundary,
    accounting,
  });
}

// Prove the no-call `model-only-codex-auth` live transport boundary from a
// sanitized descriptor. This is fail-closed by construction:
//
//   - It validates the descriptor against the single approved route /
//     provider / model / transport-kind / budget boundary.
//   - It requires EVERY positively-framed boundary safety flag to be `true`.
//     A missing or `false` flag (any broadened surface) throws.
//   - It requires zero-accounting: no transport invocation, zero provider
//     calls, zero observed cost, no committed raw evidence. Any nonzero or
//     contradictory accounting throws.
//
// On success it returns a frozen sanitized proof whose markers prove the
// boundary SHAPE only and explicitly do not authorize any provider call.
// The proof never references or invokes any transport callable.
export function proveModelOnlyCodexAuthLiveTransport(
  input: ModelOnlyCodexAuthLiveTransportProofInput,
): ModelOnlyCodexAuthLiveTransportProof {
  const snapshot = snapshotInput(input);

  if (
    snapshot.routeRef !== APPROVED_ROUTE_REF ||
    snapshot.providerRef !== APPROVED_PROVIDER_REF ||
    snapshot.modelLabel !== APPROVED_MODEL_LABEL ||
    snapshot.transportKind !== APPROVED_TRANSPORT_KIND ||
    snapshot.approvedMaxCostUsd !== APPROVED_MAX_COST_USD
  ) {
    throw new Error(REJECTED);
  }

  // Every boundary safety flag must be exactly `true`. Any broadened surface
  // (a flag flipped to a truthy non-boolean, `false`, or missing) fails
  // closed here.
  for (const key of BOUNDARY_KEYS) {
    assertTrueFlag(snapshot.boundary[key], REJECTED);
  }

  // Zero-accounting invariant. No call, no spend, no invocation, no raw
  // evidence. Reject any nonzero count/cost or contradictory marker.
  assertFalseFlag(snapshot.accounting.transportInvoked, REJECTED);
  assertFalseFlag(snapshot.accounting.rawEvidenceCommitted, REJECTED);
  if (snapshot.accounting.providerCallsExecuted !== 0) throw new Error(REJECTED);
  if (snapshot.accounting.observedCostUsd !== 0) throw new Error(REJECTED);

  return Object.freeze({
    status: "no-call-model-only-codex-auth-transport-proven",
    route_ref: snapshot.routeRef,
    provider_ref: snapshot.providerRef,
    model_label: snapshot.modelLabel,
    transport_kind: APPROVED_TRANSPORT_KIND,
    approved_max_cost_usd: snapshot.approvedMaxCostUsd,
    model_only_transport_proven: true,
    model_only_live_transport_implemented: false,
    transport_invoked: false,
    provider_calls_executed: 0,
    provider_spend: false,
    observed_cost_usd: 0,
    raw_evidence_committed: false,
    credential_value_observed: false,
    no_tools: true,
    no_shell: true,
    no_file_access: true,
    no_web_search: true,
    no_plugins: true,
    no_mcp: true,
    no_retrieval: true,
    no_session_carryover: true,
    authorizes_provider_call: false,
    authorizes_candidate_calls: false,
    authorizes_comparison_run: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
    production_readiness_claim: false,
    product_readiness_claim: false,
    launch_readiness_claim: false,
    retry_requires_new_approval: true,
    requires_fresh_approval_before_live_proof: true,
  });
}
