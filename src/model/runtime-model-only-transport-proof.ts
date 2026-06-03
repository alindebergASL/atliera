import type { ModelProviderRequest, ModelProviderResponse } from "./provider.ts";

export interface RuntimeModelOnlyTransportPayload {
  readonly provider_ref: string;
  readonly model: string;
  readonly operation: string;
  readonly idempotency_key: string;
  readonly input_graph_ref: string;
  readonly max_output_tokens: number;
  readonly temperature: number;
  readonly store: false;
  readonly metadata: Readonly<Record<string, string>>;
}

export type RuntimeModelOnlyInjectedCaller = (payload: RuntimeModelOnlyTransportPayload) => Promise<string>;

export interface RuntimeModelOnlyTransportProofOptions {
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly caller: RuntimeModelOnlyInjectedCaller;
}

export interface RuntimeModelOnlyTransportProofResult {
  readonly response: ModelProviderResponse;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_candidate_calls: false;
  readonly model_only_transport_proven: false;
  readonly runtime_model_provider_implemented: false;
}

export interface RuntimeModelOnlyTransportProof {
  readonly providerRef: string;
  readonly modelLabel: string;
  generateNoSpendProof(request: ModelProviderRequest): Promise<RuntimeModelOnlyTransportProofResult>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FORBIDDEN_METADATA = /tool|shell|file|web|search|plugin|mcp|retrieval|endpoint|auth|credential|secret|token|session/i;

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value)) throw new Error(`${label} rejected`);
}

function ownEnumerableKeys(value: unknown, label: string): string[] {
  if (value === null || typeof value !== "object") throw new Error(`${label} rejected`);
  if (Object.getOwnPropertySymbols(value).length > 0) throw new Error(`${label} rejected`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) throw new Error(`${label} rejected`);
    if ("get" in descriptor || "set" in descriptor) throw new Error(`${label} rejected`);
  }
  return Object.keys(value);
}

function assertExactKeys(value: unknown, expected: readonly string[], label: string): asserts value is Record<string, unknown> {
  const actual = ownEnumerableKeys(value, label).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(`${label} rejected`);
  }
}

function snapshotMetadata(metadata: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const actualKeys = ownEnumerableKeys(metadata, "runtime model-only proof metadata");
  for (const key of actualKeys) {
    if (FORBIDDEN_METADATA.test(key)) throw new Error("runtime model-only proof metadata rejected");
  }
  assertExactKeys(metadata, ["prompt_contract_ref"], "runtime model-only proof metadata");
  const value = metadata.prompt_contract_ref;
  if (typeof value !== "string") {
    throw new Error("runtime model-only proof metadata rejected");
  }
  try {
    assertSafeRelativeRef(value, "runtime model-only proof metadata");
  } catch {
    throw new Error("runtime model-only proof metadata rejected");
  }
  return Object.freeze({ prompt_contract_ref: value });
}

function assertArrayOfNever(value: unknown, label: string): asserts value is never[] {
  if (!Array.isArray(value) || value.length !== 0) throw new Error(`${label} rejected`);
}

function parseResponse(text: string, providerRef: string, modelLabel: string, idempotencyKey: string): ModelProviderResponse {
  if (typeof text !== "string" || text.trimStart().startsWith("```") || text.trim() === "") {
    throw new Error("runtime model-only proof response rejected");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("runtime model-only proof response rejected");
  }
  try {
    assertExactKeys(parsed, ["provider", "model", "idempotencyKey", "output", "usage", "cost"], "runtime model-only proof response");
    if (parsed.provider !== providerRef || parsed.model !== modelLabel || parsed.idempotencyKey !== idempotencyKey) {
      throw new Error("mismatch");
    }

    assertExactKeys(parsed.output, ["excerpts", "claims", "account_objects"], "runtime model-only proof response");
    assertArrayOfNever(parsed.output.excerpts, "runtime model-only proof response");
    assertArrayOfNever(parsed.output.claims, "runtime model-only proof response");
    assertArrayOfNever(parsed.output.account_objects, "runtime model-only proof response");

    assertExactKeys(parsed.usage, ["inputTokens", "outputTokens", "totalTokens"], "runtime model-only proof response");
    const inputTokens = parsed.usage.inputTokens;
    const outputTokens = parsed.usage.outputTokens;
    const totalTokens = parsed.usage.totalTokens;
    if (typeof inputTokens !== "number" || typeof outputTokens !== "number" || typeof totalTokens !== "number" || !Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens) || !Number.isSafeInteger(totalTokens)) {
      throw new Error("usage");
    }
    if (inputTokens < 0 || outputTokens < 0 || totalTokens !== inputTokens + outputTokens) {
      throw new Error("usage");
    }

    assertExactKeys(parsed.cost, ["currency", "amount"], "runtime model-only proof response");
    const costAmount = parsed.cost.amount;
    if (parsed.cost.currency !== "USD" || costAmount !== 0) {
      throw new Error("cost");
    }

    return Object.freeze({
      provider: parsed.provider,
      model: parsed.model,
      idempotencyKey: parsed.idempotencyKey,
      output: Object.freeze({ excerpts: Object.freeze([]) as never[], claims: Object.freeze([]) as never[], account_objects: Object.freeze([]) as never[] }),
      usage: Object.freeze({ inputTokens, outputTokens, totalTokens }),
      cost: Object.freeze({ currency: "USD", amount: costAmount }),
    });
  } catch {
    throw new Error("runtime model-only proof response rejected");
  }
}

function assertSafeRelativeRef(value: string, label: string): void {
  if (typeof value !== "string" || value.startsWith("/") || value.includes("..") || value.includes("://") || value.includes("\\") || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)) {
    throw new Error(`${label} rejected`);
  }
}

function assertSafeRequest(request: ModelProviderRequest, modelLabel: string): void {
  assertExactKeys(request, [
    "operation",
    "mode",
    "model",
    "prompt",
    "inputGraphRef",
    "idempotencyKey",
    "maxOutputTokens",
    "temperature",
    "metadata",
  ], "runtime model-only proof request");
  if (request.operation !== "graph.propose") throw new Error("runtime model-only proof request rejected");
  if (request.mode !== "model") throw new Error("runtime model-only proof request rejected");
  if (request.model !== modelLabel) throw new Error("runtime model-only proof request rejected");
  assertSafeRelativeRef(request.inputGraphRef, "runtime model-only proof request");
  if (typeof request.idempotencyKey !== "string" || !SAFE_ID.test(request.idempotencyKey)) throw new Error("runtime model-only proof request rejected");
  if (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens <= 0 || request.maxOutputTokens > 8192) throw new Error("runtime model-only proof request rejected");
  if (typeof request.temperature !== "number" || !Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2) throw new Error("runtime model-only proof request rejected");
}

export function createRuntimeModelOnlyTransportProof(options: RuntimeModelOnlyTransportProofOptions): RuntimeModelOnlyTransportProof {
  assertSafeId(options.providerRef, "providerRef");
  assertSafeId(options.modelLabel, "modelLabel");
  if (typeof options.caller !== "function") throw new Error("runtime model-only proof caller rejected");

  return Object.freeze({
    providerRef: options.providerRef,
    modelLabel: options.modelLabel,
    async generateNoSpendProof(request: ModelProviderRequest): Promise<RuntimeModelOnlyTransportProofResult> {
      assertSafeRequest(request, options.modelLabel);
      const metadata = snapshotMetadata(request.metadata);
      const payload: RuntimeModelOnlyTransportPayload = Object.freeze({
        provider_ref: options.providerRef,
        model: options.modelLabel,
        operation: request.operation,
        idempotency_key: request.idempotencyKey,
        input_graph_ref: request.inputGraphRef,
        max_output_tokens: request.maxOutputTokens,
        temperature: request.temperature,
        store: false,
        metadata,
      });
      const responseText = await options.caller(payload);
      const response = parseResponse(responseText, options.providerRef, options.modelLabel, request.idempotencyKey);
      return Object.freeze({
        response,
        provider_calls_executed: 0,
        provider_spend: false,
        authorizes_candidate_calls: false,
        model_only_transport_proven: false,
        runtime_model_provider_implemented: false,
      });
    },
  });
}
