// Runtime model-only live transport injection seam.
//
// This module adds the no-call injection seam required to unblock the
// approved runtime model-only live proof. It accepts an injected
// transport callable, validates the candidate request/response shape,
// and emits a sanitized proof that the boundary is testable — but it
// never invokes the transport. The actual live call still requires a
// fresh approval packet and a separate execution PR.
//
// No provider SDK is imported here. No network or env access. No
// readiness or authorization claim is made.

import type { ModelProviderRequest, ModelProviderResponse } from "./provider.ts";

export type ModelOnlyLiveTransport = (
  request: ModelProviderRequest,
) => Promise<ModelProviderResponse>;

export interface RuntimeModelOnlyLiveTransportInjectionSeamOptions {
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly maxCostUsd: number;
  readonly transport: ModelOnlyLiveTransport;
}

export interface RuntimeModelOnlyLiveTransportInjectionSeamProof {
  readonly status: "no-call-injection-seam-proven";
  readonly provider_ref: string;
  readonly model_label: string;
  readonly max_cost_usd: number;
  readonly request_shape: "exact";
  readonly response_shape: "exact";
  readonly transport_injection_seam_proven: true;
  readonly transport_invoked: false;
  readonly model_only_live_transport_implemented: false;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_provider_call: false;
  readonly authorizes_candidate_calls: false;
  readonly authorizes_comparison_run: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
  readonly production_readiness_claim: false;
  readonly product_readiness_claim: false;
  readonly launch_readiness_claim: false;
  readonly retry_requires_new_approval: true;
}

export interface RuntimeModelOnlyLiveTransportInjectionSeam {
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly maxCostUsd: number;
  proveInjectionSeamNoCall(
    request: ModelProviderRequest,
    responseFixture: ModelProviderResponse,
  ): Promise<RuntimeModelOnlyLiveTransportInjectionSeamProof>;
}

const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const SAFE_RELATIVE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;
const OPTION_KEYS = ["providerRef", "modelLabel", "maxCostUsd", "transport"];
const REQUEST_KEYS = [
  "operation",
  "mode",
  "model",
  "prompt",
  "inputGraphRef",
  "idempotencyKey",
  "maxOutputTokens",
  "temperature",
  "metadata",
];
const METADATA_KEYS = [
  "prompt_contract_ref",
  "tools",
  "shell_access",
  "file_access",
  "web_search",
  "plugins",
  "mcp",
  "retrieval",
];
const RESPONSE_KEYS = ["provider", "model", "idempotencyKey", "output", "usage", "cost"];
const OUTPUT_KEYS = ["excerpts", "claims", "account_objects"];
const USAGE_KEYS = ["inputTokens", "outputTokens", "totalTokens"];
const COST_KEYS = ["currency", "amount"];
const SURFACE_FALSE_KEYS = [
  "tools",
  "shell_access",
  "file_access",
  "web_search",
  "plugins",
  "mcp",
  "retrieval",
];

function assertPlainOwnDataObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(label);
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error(label);
  if (Object.getOwnPropertySymbols(value as object).length > 0) throw new Error(label);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors)) {
    if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) throw new Error(label);
  }
}

function assertExactKeys(value: unknown, expected: readonly string[], label: string): asserts value is Record<string, unknown> {
  assertPlainOwnDataObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(label);
}

// Materialize a frozen plain own-data snapshot from `value`'s descriptors.
// Reads happen via `Object.getOwnPropertyDescriptors`, which invokes the
// proxy's `ownKeys` / `getOwnPropertyDescriptor` traps but NOT `[[Get]]`.
// Every subsequent read in this module comes from the returned frozen
// snapshot rather than the original, so a hostile `get` trap on the
// caller's request/response cannot leak unsafe values into validation
// or proof emission after the validation passed.
function materializePlainSnapshot(value: unknown, label: string): Record<string, unknown> {
  assertPlainOwnDataObject(value, label);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    // assertPlainOwnDataObject already rejected accessors / non-enumerable
    // / symbol-keyed entries; we still gate here as defense in depth.
    if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) throw new Error(label);
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

// Materialize a frozen empty-array snapshot. The seam's response contract
// requires every output array to be empty, so general-array support is
// unnecessary; this also blocks length-getter / numeric-index smuggling.
function materializeEmptyArraySnapshot(value: unknown, label: string): readonly never[] {
  if (!Array.isArray(value)) throw new Error(label);
  if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error(label);
  if (Object.getOwnPropertySymbols(value as object).length > 0) throw new Error(label);
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor | undefined>;
  const lengthDescriptor = descriptors["length"];
  if (!lengthDescriptor || "get" in lengthDescriptor || "set" in lengthDescriptor || lengthDescriptor.value !== 0) {
    throw new Error(label);
  }
  const extraKeys = Object.keys(descriptors).filter((key) => key !== "length");
  if (extraKeys.length !== 0) throw new Error(label);
  return Object.freeze([]) as readonly never[];
}

function assertSafeLogicalId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SAFE_LOGICAL_ID.test(value) || value.includes("..") || value.includes("://") || value.includes("\\")) throw new Error(label);
}

function assertSafeRelativeRef(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SAFE_RELATIVE_REF.test(value) || value.includes("..") || value.includes("://") || value.includes("\\")) throw new Error(label);
}

function assertSyntheticRef(value: unknown, prefix: string, label: string): asserts value is string {
  assertSafeRelativeRef(value, label);
  if (!value.startsWith(prefix)) throw new Error(label);
}

interface RequestSnapshot {
  readonly operation: unknown;
  readonly mode: unknown;
  readonly model: unknown;
  readonly prompt: unknown;
  readonly inputGraphRef: unknown;
  readonly idempotencyKey: unknown;
  readonly maxOutputTokens: unknown;
  readonly temperature: unknown;
  readonly metadata: Record<string, unknown>;
}

interface ResponseSnapshot {
  readonly provider: unknown;
  readonly model: unknown;
  readonly idempotencyKey: unknown;
  readonly output: {
    readonly excerpts: readonly never[];
    readonly claims: readonly never[];
    readonly account_objects: readonly never[];
  };
  readonly usage: { readonly inputTokens: unknown; readonly outputTokens: unknown; readonly totalTokens: unknown };
  readonly cost: { readonly currency: unknown; readonly amount: unknown };
}

function snapshotRequest(request: ModelProviderRequest, modelLabel: string): RequestSnapshot {
  // 1. Materialize top-level snapshot — every subsequent read here is from
  //    `req`, not `request`.
  const req = materializePlainSnapshot(request, "runtime model-only live transport injection seam request rejected");
  const actualReqKeys = Object.keys(req).sort();
  const expectedReqKeys = [...REQUEST_KEYS].sort();
  if (actualReqKeys.length !== expectedReqKeys.length || actualReqKeys.some((key, i) => key !== expectedReqKeys[i])) {
    throw new Error("runtime model-only live transport injection seam request rejected");
  }
  if (req.operation !== "graph.propose" || req.mode !== "model" || req.model !== modelLabel) {
    throw new Error("runtime model-only live transport injection seam request rejected");
  }
  if (typeof req.prompt !== "string" || req.prompt.length === 0 || req.prompt.length > 4000) {
    throw new Error("runtime model-only live transport injection seam request rejected");
  }
  assertSyntheticRef(req.inputGraphRef, "corpus/synthetic-", "runtime model-only live transport injection seam synthetic scope rejected");
  assertSafeLogicalId(req.idempotencyKey, "runtime model-only live transport injection seam request rejected");
  if (!Number.isSafeInteger(req.maxOutputTokens) || (req.maxOutputTokens as number) <= 0 || (req.maxOutputTokens as number) > 8192) {
    throw new Error("runtime model-only live transport injection seam request rejected");
  }
  if (typeof req.temperature !== "number" || !Number.isFinite(req.temperature) || req.temperature < 0 || req.temperature > 2) {
    throw new Error("runtime model-only live transport injection seam request rejected");
  }
  // 2. Materialize nested metadata snapshot — never re-read from
  //    `request.metadata`.
  const metadata = materializePlainSnapshot(req.metadata, "runtime model-only live transport injection seam surface rejected");
  const actualMetaKeys = Object.keys(metadata).sort();
  const expectedMetaKeys = [...METADATA_KEYS].sort();
  if (actualMetaKeys.length !== expectedMetaKeys.length || actualMetaKeys.some((key, i) => key !== expectedMetaKeys[i])) {
    throw new Error("runtime model-only live transport injection seam surface rejected");
  }
  assertSyntheticRef(metadata.prompt_contract_ref, "prompts/synthetic-", "runtime model-only live transport injection seam synthetic scope rejected");
  for (const key of SURFACE_FALSE_KEYS) {
    if (metadata[key] !== "false") throw new Error("runtime model-only live transport injection seam surface rejected");
  }
  return Object.freeze({
    operation: req.operation,
    mode: req.mode,
    model: req.model,
    prompt: req.prompt,
    inputGraphRef: req.inputGraphRef,
    idempotencyKey: req.idempotencyKey,
    maxOutputTokens: req.maxOutputTokens,
    temperature: req.temperature,
    metadata,
  });
}

function snapshotResponse(
  response: ModelProviderResponse,
  requestSnapshot: RequestSnapshot,
  providerRef: string,
  modelLabel: string,
  maxCostUsd: number,
): ResponseSnapshot {
  // 1. Top-level response snapshot. Subsequent reads use `resp`, not
  //    `response`.
  const resp = materializePlainSnapshot(response, "runtime model-only live transport injection seam response rejected");
  const actualKeys = Object.keys(resp).sort();
  const expectedKeys = [...RESPONSE_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, i) => key !== expectedKeys[i])) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }
  if (resp.provider !== providerRef || resp.model !== modelLabel || resp.idempotencyKey !== requestSnapshot.idempotencyKey) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }
  // 2. Nested output / usage / cost snapshots.
  const output = materializePlainSnapshot(resp.output, "runtime model-only live transport injection seam response rejected");
  const outputKeys = Object.keys(output).sort();
  const expectedOutputKeys = [...OUTPUT_KEYS].sort();
  if (outputKeys.length !== expectedOutputKeys.length || outputKeys.some((key, i) => key !== expectedOutputKeys[i])) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }
  const excerpts = materializeEmptyArraySnapshot(output.excerpts, "runtime model-only live transport injection seam response rejected");
  const claims = materializeEmptyArraySnapshot(output.claims, "runtime model-only live transport injection seam response rejected");
  const account_objects = materializeEmptyArraySnapshot(output.account_objects, "runtime model-only live transport injection seam response rejected");

  const usage = materializePlainSnapshot(resp.usage, "runtime model-only live transport injection seam response rejected");
  const usageKeys = Object.keys(usage).sort();
  const expectedUsageKeys = [...USAGE_KEYS].sort();
  if (usageKeys.length !== expectedUsageKeys.length || usageKeys.some((key, i) => key !== expectedUsageKeys[i])) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }
  if (!Number.isSafeInteger(usage.inputTokens) || !Number.isSafeInteger(usage.outputTokens) || !Number.isSafeInteger(usage.totalTokens)) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }
  if ((usage.inputTokens as number) + (usage.outputTokens as number) !== (usage.totalTokens as number)) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }

  const cost = materializePlainSnapshot(resp.cost, "runtime model-only live transport injection seam response rejected");
  const costKeys = Object.keys(cost).sort();
  const expectedCostKeys = [...COST_KEYS].sort();
  if (costKeys.length !== expectedCostKeys.length || costKeys.some((key, i) => key !== expectedCostKeys[i])) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }
  if (cost.currency !== "USD" || typeof cost.amount !== "number" || !Number.isFinite(cost.amount) || cost.amount < 0 || cost.amount > maxCostUsd) {
    throw new Error("runtime model-only live transport injection seam response rejected");
  }

  return Object.freeze({
    provider: resp.provider,
    model: resp.model,
    idempotencyKey: resp.idempotencyKey,
    output: Object.freeze({ excerpts, claims, account_objects }),
    usage: Object.freeze({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }),
    cost: Object.freeze({ currency: cost.currency, amount: cost.amount }),
  });
}

function snapshotOptions(options: RuntimeModelOnlyLiveTransportInjectionSeamOptions): RuntimeModelOnlyLiveTransportInjectionSeamOptions {
  assertExactKeys(options, OPTION_KEYS, "runtime model-only live transport injection seam options rejected");
  // Read each option exactly once via descriptors-based snapshot to defeat
  // hostile getters/Proxies. The transport callable is held by reference
  // but never invoked anywhere in this module. Runtime validations
  // (assertSafeLogicalId / budget bounds) below assert the field types
  // after this snapshot is taken.
  const descriptors = Object.getOwnPropertyDescriptors(options);
  const providerRef = descriptors.providerRef?.value as unknown;
  const modelLabel = descriptors.modelLabel?.value as unknown;
  const maxCostUsd = descriptors.maxCostUsd?.value as unknown;
  const transport = descriptors.transport?.value as unknown;
  if (typeof transport !== "function" || (transport as ModelOnlyLiveTransport).length !== 1) {
    throw new Error("runtime model-only live transport injection seam transport rejected");
  }
  if (typeof providerRef !== "string" || typeof modelLabel !== "string" || typeof maxCostUsd !== "number") {
    throw new Error("runtime model-only live transport injection seam options rejected");
  }
  return Object.freeze({
    providerRef,
    modelLabel,
    maxCostUsd,
    transport: transport as ModelOnlyLiveTransport,
  });
}

export function bindRuntimeModelOnlyLiveTransportInjectionSeam(
  options: RuntimeModelOnlyLiveTransportInjectionSeamOptions,
): RuntimeModelOnlyLiveTransportInjectionSeam {
  const snapshot = snapshotOptions(options);
  assertSafeLogicalId(snapshot.providerRef, "runtime model-only live transport injection seam provider rejected");
  assertSafeLogicalId(snapshot.modelLabel, "runtime model-only live transport injection seam model rejected");
  if (typeof snapshot.maxCostUsd !== "number" || !Number.isFinite(snapshot.maxCostUsd) || snapshot.maxCostUsd <= 0 || snapshot.maxCostUsd > 1) {
    throw new Error("runtime model-only live transport injection seam budget rejected");
  }

  return Object.freeze({
    providerRef: snapshot.providerRef,
    modelLabel: snapshot.modelLabel,
    maxCostUsd: snapshot.maxCostUsd,
    async proveInjectionSeamNoCall(
      request: ModelProviderRequest,
      responseFixture: ModelProviderResponse,
    ): Promise<RuntimeModelOnlyLiveTransportInjectionSeamProof> {
      // Materialize frozen descriptor snapshots of the request and the
      // response (and every nested object/array) BEFORE any value-level
      // validation. After this line, no code path in the seam re-reads
      // from `request`, `responseFixture`, or any of their nested
      // objects/arrays — a hostile Proxy `get` trap cannot leak.
      const reqSnap = snapshotRequest(request, snapshot.modelLabel);
      // `responseFixture` is held only as an opaque reference here; the
      // returned `respSnap` is fully owned by this function.
      void snapshotResponse(responseFixture, reqSnap, snapshot.providerRef, snapshot.modelLabel, snapshot.maxCostUsd);
      // Deliberately do NOT call `snapshot.transport(...)`. This proof is
      // structural — the seam exists and accepts a transport-shaped
      // callable, but invoking it is reserved for a separate live-proof
      // PR with a fresh approval packet.
      return Object.freeze({
        status: "no-call-injection-seam-proven",
        provider_ref: snapshot.providerRef,
        model_label: snapshot.modelLabel,
        max_cost_usd: snapshot.maxCostUsd,
        request_shape: "exact",
        response_shape: "exact",
        transport_injection_seam_proven: true,
        transport_invoked: false,
        model_only_live_transport_implemented: false,
        provider_calls_executed: 0,
        provider_spend: false,
        authorizes_provider_call: false,
        authorizes_candidate_calls: false,
        authorizes_comparison_run: false,
        default_model_selection_claim: false,
        provider_lock_in: false,
        production_readiness_claim: false,
        product_readiness_claim: false,
        launch_readiness_claim: false,
        retry_requires_new_approval: true,
      });
    },
  });
}
