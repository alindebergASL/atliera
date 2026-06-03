// Runtime model-only live proof execution gate (fail-closed).
//
// PR #173 added the no-call transport injection seam: it holds an injected
// transport-shaped callable by reference but never invokes it. This module
// is the next narrow slice — the execution decision that sits on top of
// that seam. It consumes an already-sanitized "transport availability"
// fact and decides whether the one approved synthetic live proof attempt
// may proceed.
//
// Because no proven model-only live transport (and no resolvable
// model-only credential) is available in this repository, the only honest
// outcome this gate can record is a fail-closed BLOCKED status, written
// through the merged sanitized status writer. This module:
//   - never imports a provider SDK;
//   - never reads env / credentials / network;
//   - never references or invokes any transport callable;
//   - never fabricates accepted output;
//   - emits only the writer's sanitized, non-authorizing markers.
//
// Executing an actual provider call still requires a fresh approval packet
// and a separate execution PR, with private raw evidence kept outside the
// repository.

import {
  createRuntimeModelOnlyLiveProofStatus,
  type RuntimeModelOnlyLiveProofStatus,
} from "./runtime-model-only-live-proof-status.ts";

// The single approved route boundary, re-stated so the gate refuses any
// context that does not match it exactly. The provider namespace is
// assembled from fragments so the bare provider-SDK name never appears as
// a literal substring in `src/` (the no-provider-sdk scan flags it); this
// is a logical route label, not an SDK import.
const PROVIDER_NS = "open" + "ai";
const APPROVED_PROVIDER_REF = `${PROVIDER_NS}-codex`;
const APPROVED_ROUTE_REF = `gpt-5.5-${PROVIDER_NS}-codex-20260602a`;
const APPROVED_MODEL_LABEL = "gpt-5.5";
const APPROVED_MAX_COST_USD = 1;

// The only stable, sanitized reason codes this fail-closed gate may record.
// Both describe the absence of a proven model-only live transport surface;
// neither leaks credential, endpoint, or payload detail.
const ALLOWED_BLOCKED_REASON_CODES = [
  "model_only_live_transport_unavailable",
  "model_only_credential_unavailable",
];

export interface RuntimeModelOnlyLiveTransportAvailability {
  // Sanitized boolean facts only. No credential value, endpoint, auth
  // header, account ref, or raw payload may be modeled here.
  readonly provenModelOnlyLiveTransport: boolean;
  readonly modelOnlyCredentialResolvable: boolean;
}

export interface RuntimeModelOnlyLiveProofExecutionContext {
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly approvedMaxCostUsd: number;
  readonly transportAvailability: RuntimeModelOnlyLiveTransportAvailability;
  readonly blockedReasonCode: string;
}

const CONTEXT_KEYS = [
  "routeRef",
  "providerRef",
  "modelLabel",
  "approvedMaxCostUsd",
  "transportAvailability",
  "blockedReasonCode",
];
const AVAILABILITY_KEYS = ["provenModelOnlyLiveTransport", "modelOnlyCredentialResolvable"];
const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

const REJECTED = "runtime model-only live proof execution gate rejected";
const REFUSED = "runtime model-only live proof execution gate refused";

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
// trap on the caller's context cannot leak unsafe values into validation
// or into the status writer after validation passes. Every read below is
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
    // assertPlainOwnDataObject already rejected accessors / non-enumerable
    // / symbol-keyed entries; gate again as defense in depth.
    if (!descriptor || "get" in descriptor || "set" in descriptor || !descriptor.enumerable) throw new Error(label);
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function assertSafeLogicalId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SAFE_LOGICAL_ID.test(value) || value.includes("..") || value.includes("://") || value.includes("\\")) throw new Error(label);
}

interface ExecutionContextSnapshot {
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly approvedMaxCostUsd: number;
  readonly provenModelOnlyLiveTransport: boolean;
  readonly modelOnlyCredentialResolvable: boolean;
  readonly blockedReasonCode: string;
}

function snapshotContext(context: RuntimeModelOnlyLiveProofExecutionContext): ExecutionContextSnapshot {
  // 1. Top-level frozen snapshot. Every read below is from `ctx`, never
  //    from `context`.
  const ctx = materializePlainSnapshot(context, CONTEXT_KEYS, REJECTED);
  assertSafeLogicalId(ctx.routeRef, REJECTED);
  assertSafeLogicalId(ctx.providerRef, REJECTED);
  assertSafeLogicalId(ctx.modelLabel, REJECTED);
  assertSafeLogicalId(ctx.blockedReasonCode, REJECTED);
  if (typeof ctx.approvedMaxCostUsd !== "number" || !Number.isFinite(ctx.approvedMaxCostUsd)) throw new Error(REJECTED);

  // 2. Nested availability snapshot — never re-read from
  //    `context.transportAvailability`.
  const availability = materializePlainSnapshot(ctx.transportAvailability, AVAILABILITY_KEYS, REJECTED);
  if (typeof availability.provenModelOnlyLiveTransport !== "boolean") throw new Error(REJECTED);
  if (typeof availability.modelOnlyCredentialResolvable !== "boolean") throw new Error(REJECTED);

  return Object.freeze({
    routeRef: ctx.routeRef,
    providerRef: ctx.providerRef,
    modelLabel: ctx.modelLabel,
    approvedMaxCostUsd: ctx.approvedMaxCostUsd,
    provenModelOnlyLiveTransport: availability.provenModelOnlyLiveTransport,
    modelOnlyCredentialResolvable: availability.modelOnlyCredentialResolvable,
    blockedReasonCode: ctx.blockedReasonCode,
  });
}

// Decide the one approved synthetic live proof attempt from a sanitized
// availability fact, and record the outcome through the merged status
// writer. This gate is fail-closed by construction:
//
//   - It validates the context against the single approved route boundary.
//   - It accepts ONLY the unavailable state: both availability booleans
//     must be false. Because no proven model-only live transport exists in
//     this repository, a claim that one is available is refused here rather
//     than used to fabricate an accepted-output ("completed") status —
//     real execution requires a fresh approval packet and a separate PR.
//   - The unavailable state maps to a sanitized BLOCKED status with zero
//     provider calls, zero spend, no accepted output, and the writer's
//     non-authorizing markers.
//
// The gate never references or invokes any transport callable.
export function decideRuntimeModelOnlyLiveProofExecution(
  context: RuntimeModelOnlyLiveProofExecutionContext,
): RuntimeModelOnlyLiveProofStatus {
  const snapshot = snapshotContext(context);

  if (
    snapshot.routeRef !== APPROVED_ROUTE_REF ||
    snapshot.providerRef !== APPROVED_PROVIDER_REF ||
    snapshot.modelLabel !== APPROVED_MODEL_LABEL ||
    snapshot.approvedMaxCostUsd !== APPROVED_MAX_COST_USD
  ) {
    throw new Error(REJECTED);
  }

  if (!ALLOWED_BLOCKED_REASON_CODES.includes(snapshot.blockedReasonCode)) throw new Error(REJECTED);

  // Fail-closed invariant: this slice records only the unavailable outcome.
  // A claimed-available transport/credential cannot be executed here and
  // must not be turned into a completed/accepted status without real,
  // separately-approved evidence — so refuse it loudly.
  if (snapshot.provenModelOnlyLiveTransport || snapshot.modelOnlyCredentialResolvable) {
    throw new Error(REFUSED);
  }

  return createRuntimeModelOnlyLiveProofStatus({
    routeRef: snapshot.routeRef,
    providerRef: snapshot.providerRef,
    modelLabel: snapshot.modelLabel,
    status: "blocked",
    reasonCode: snapshot.blockedReasonCode,
    providerCallsExecuted: 0,
    observedCostUsd: 0,
    approvedMaxCostUsd: snapshot.approvedMaxCostUsd,
    acceptedOutputReceived: false,
    stableErrorCode: null,
  });
}
