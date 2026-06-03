import type { ModelProviderRequest, ModelProviderResponse } from "./provider.ts";

export interface RuntimeModelOnlyLiveTransportHarnessOptions {
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly maxCostUsd: number;
  readonly responseFixture: ModelProviderResponse;
}

export interface RuntimeModelOnlyLiveTransportHarnessProof {
  readonly status: "no-call-harness-boundary-proven";
  readonly provider_ref: string;
  readonly model_label: string;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_provider_call: false;
  readonly authorizes_candidate_calls: false;
  readonly authorizes_comparison_run: false;
  readonly model_only_live_transport_implemented: false;
  readonly request_shape: "exact";
  readonly response_shape: "exact";
  readonly max_cost_usd: number;
}

export interface RuntimeModelOnlyLiveTransportHarness {
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly maxCostUsd: number;
  proveNoCallBoundary(request: ModelProviderRequest): Promise<RuntimeModelOnlyLiveTransportHarnessProof>;
}

const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const SAFE_RELATIVE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;
const REQUEST_KEYS = ["operation", "mode", "model", "prompt", "inputGraphRef", "idempotencyKey", "maxOutputTokens", "temperature", "metadata"];
const METADATA_KEYS = ["prompt_contract_ref", "tools", "shell_access", "file_access", "web_search", "plugins", "mcp", "retrieval"];
const RESPONSE_KEYS = ["provider", "model", "idempotencyKey", "output", "usage", "cost"];
const OUTPUT_KEYS = ["excerpts", "claims", "account_objects"];
const USAGE_KEYS = ["inputTokens", "outputTokens", "totalTokens"];
const COST_KEYS = ["currency", "amount"];
const SURFACE_FALSE_KEYS = ["tools", "shell_access", "file_access", "web_search", "plugins", "mcp", "retrieval"];

function ownKeys(value: object, label: string): string[] {
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error(label);
  if (Object.getOwnPropertySymbols(value).length > 0) throw new Error(label);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors)) {
    if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) throw new Error(label);
  }
  return Object.keys(descriptors).sort();
}

function assertExactKeys(value: unknown, expected: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(label);
  const actual = ownKeys(value, label);
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(label);
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

function assertSafeRequest(request: ModelProviderRequest, modelLabel: string): void {
  assertExactKeys(request, REQUEST_KEYS, "runtime model-only live transport request rejected");
  if (request.operation !== "graph.propose" || request.mode !== "model" || request.model !== modelLabel) {
    throw new Error("runtime model-only live transport request rejected");
  }
  if (typeof request.prompt !== "string" || request.prompt.length === 0 || request.prompt.length > 4000) throw new Error("runtime model-only live transport request rejected");
  assertSyntheticRef(request.inputGraphRef, "corpus/synthetic-", "runtime model-only live transport synthetic scope rejected");
  assertSafeLogicalId(request.idempotencyKey, "runtime model-only live transport request rejected");
  if (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0 || request.maxOutputTokens > 8192) throw new Error("runtime model-only live transport request rejected");
  if (typeof request.temperature !== "number" || !Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2) throw new Error("runtime model-only live transport request rejected");
  assertExactKeys(request.metadata, METADATA_KEYS, "runtime model-only live transport surface rejected");
  assertSyntheticRef(request.metadata.prompt_contract_ref, "prompts/synthetic-", "runtime model-only live transport synthetic scope rejected");
  for (const key of SURFACE_FALSE_KEYS) {
    if (request.metadata[key] !== "false") throw new Error("runtime model-only live transport surface rejected");
  }
}

function assertEmptyArray(value: unknown): void {
  if (!Array.isArray(value) || value.length !== 0) throw new Error("runtime model-only live transport response rejected");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).filter((key) => key !== "length");
  if (keys.length !== 0 || Object.getOwnPropertySymbols(value).length !== 0) throw new Error("runtime model-only live transport response rejected");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || "get" in lengthDescriptor || "set" in lengthDescriptor || lengthDescriptor.value !== 0) throw new Error("runtime model-only live transport response rejected");
}

function assertSafeResponse(response: ModelProviderResponse, request: ModelProviderRequest, providerRef: string, modelLabel: string, maxCostUsd: number): void {
  assertExactKeys(response, RESPONSE_KEYS, "runtime model-only live transport response rejected");
  if (response.provider !== providerRef || response.model !== modelLabel || response.idempotencyKey !== request.idempotencyKey) throw new Error("runtime model-only live transport response rejected");
  assertExactKeys(response.output, OUTPUT_KEYS, "runtime model-only live transport response rejected");
  assertEmptyArray(response.output.excerpts);
  assertEmptyArray(response.output.claims);
  assertEmptyArray(response.output.account_objects);
  assertExactKeys(response.usage, USAGE_KEYS, "runtime model-only live transport response rejected");
  if (!Number.isSafeInteger(response.usage.inputTokens) || !Number.isSafeInteger(response.usage.outputTokens) || !Number.isSafeInteger(response.usage.totalTokens)) throw new Error("runtime model-only live transport response rejected");
  if (response.usage.inputTokens + response.usage.outputTokens !== response.usage.totalTokens) throw new Error("runtime model-only live transport response rejected");
  assertExactKeys(response.cost, COST_KEYS, "runtime model-only live transport response rejected");
  if (response.cost.currency !== "USD" || typeof response.cost.amount !== "number" || !Number.isFinite(response.cost.amount) || response.cost.amount < 0 || response.cost.amount > maxCostUsd) throw new Error("runtime model-only live transport response rejected");
}

function snapshotOptions(options: RuntimeModelOnlyLiveTransportHarnessOptions): RuntimeModelOnlyLiveTransportHarnessOptions {
  assertExactKeys(options, ["providerRef", "modelLabel", "maxCostUsd", "responseFixture"], "runtime model-only live transport fixture rejected");
  return Object.freeze({
    providerRef: options.providerRef,
    modelLabel: options.modelLabel,
    maxCostUsd: options.maxCostUsd,
    responseFixture: options.responseFixture,
  });
}

export function createRuntimeModelOnlyLiveTransportHarness(options: RuntimeModelOnlyLiveTransportHarnessOptions): RuntimeModelOnlyLiveTransportHarness {
  const snapshot = snapshotOptions(options);
  assertSafeLogicalId(snapshot.providerRef, "runtime model-only live transport provider rejected");
  assertSafeLogicalId(snapshot.modelLabel, "runtime model-only live transport model rejected");
  if (typeof snapshot.maxCostUsd !== "number" || !Number.isFinite(snapshot.maxCostUsd) || snapshot.maxCostUsd <= 0 || snapshot.maxCostUsd > 1) throw new Error("runtime model-only live transport budget rejected");

  return Object.freeze({
    providerRef: snapshot.providerRef,
    modelLabel: snapshot.modelLabel,
    maxCostUsd: snapshot.maxCostUsd,
    async proveNoCallBoundary(request: ModelProviderRequest): Promise<RuntimeModelOnlyLiveTransportHarnessProof> {
      assertSafeRequest(request, snapshot.modelLabel);
      assertSafeResponse(snapshot.responseFixture, request, snapshot.providerRef, snapshot.modelLabel, snapshot.maxCostUsd);
      return Object.freeze({
        status: "no-call-harness-boundary-proven",
        provider_ref: snapshot.providerRef,
        model_label: snapshot.modelLabel,
        provider_calls_executed: 0,
        provider_spend: false,
        authorizes_provider_call: false,
        authorizes_candidate_calls: false,
        authorizes_comparison_run: false,
        model_only_live_transport_implemented: false,
        request_shape: "exact",
        response_shape: "exact",
        max_cost_usd: snapshot.maxCostUsd,
      });
    },
  });
}
