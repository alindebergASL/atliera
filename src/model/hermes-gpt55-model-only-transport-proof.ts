import {
  assertSafeModelProviderRequest,
  type ModelProvider,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "./provider.ts";

export const HERMES_GPT55_MODEL_ONLY_TRANSPORT_PROOF_SCHEMA_VERSION =
  "atliera.hermes_gpt55_model_only_transport_proof.v1" as const;

export interface HermesGpt55ModelOnlyProviderPayload {
  readonly model: "gpt-5.5";
  readonly instructions: string;
  readonly input: readonly [
    {
      readonly role: "user";
      readonly content: readonly [
        {
          readonly type: "input_text";
          readonly text: string;
        },
      ];
    },
  ];
  readonly store: false;
  readonly stream: true;
}

export interface HermesGpt55ModelOnlyRequestPlan {
  readonly schema_version: typeof HERMES_GPT55_MODEL_ONLY_TRANSPORT_PROOF_SCHEMA_VERSION;
  readonly provider_route: string;
  readonly api_mode: "codex_responses";
  readonly model: "gpt-5.5";
  readonly store: false;
  readonly provider_payload: HermesGpt55ModelOnlyProviderPayload;
  readonly requested_max_output_tokens_not_sent: number;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_candidate_calls: false;
  readonly model_only_transport_proven: false;
  readonly tool_use_allowed: false;
  readonly shell_access_allowed: false;
  readonly file_access_allowed: false;
  readonly web_search_allowed: false;
  readonly plugins_allowed: false;
  readonly retrieval_allowed: false;
  readonly skills_loaded: false;
  readonly memory_loaded: false;
  readonly mcp_allowed: false;
}

export interface HermesGpt55ModelOnlyFakeCallerResult {
  readonly rawJson: string;
}

export interface HermesGpt55ModelOnlyFakeCaller {
  readonly kind: "no-spend-fake-caller";
  respond(payload: HermesGpt55ModelOnlyProviderPayload): HermesGpt55ModelOnlyFakeCallerResult;
}

export interface HermesGpt55ModelOnlyInjectedTransportProofOptions {
  readonly fakeCaller: HermesGpt55ModelOnlyFakeCaller;
}

export interface HermesGpt55StreamingTextDeltaEvent {
  readonly type: "response.output_text.delta";
  readonly delta: string;
}

export interface HermesGpt55StreamingTerminalEvent {
  readonly type: "response.completed" | "response.failed" | "response.incomplete";
}

export type HermesGpt55StreamingEvent =
  | HermesGpt55StreamingTextDeltaEvent
  | HermesGpt55StreamingTerminalEvent;

export interface HermesGpt55InjectedStreamCaller {
  readonly kind: "injected-stream-caller";
  stream(payload: HermesGpt55ModelOnlyProviderPayload): AsyncIterable<HermesGpt55StreamingEvent>;
}

export interface HermesGpt55StreamingModelProviderOptions {
  readonly streamCaller: HermesGpt55InjectedStreamCaller;
}

const MODEL_ONLY_INSTRUCTIONS =
  "Return only an Atliera ModelProviderResponse-compatible JSON object. Do not call tools, browse, retrieve, execute code, or use external state.";

const FORBIDDEN_METADATA_KEYS = new Set([
  "api_key",
  "authorization",
  "base_url",
  "endpoint",
  "file_access",
  "mcp",
  "memory",
  "parallel_tool_calls",
  "plugin",
  "plugins",
  "prompt_cache_key",
  "retrieval",
  "session_id",
  "shell_access",
  "skills",
  "tool_choice",
  "tools",
  "web_search",
]);

export function createHermesGpt55ModelOnlyRequestPlan(
  request: ModelProviderRequest,
): HermesGpt55ModelOnlyRequestPlan {
  assertSafeModelProviderRequest(request);
  assertNoForbiddenMetadata(request.metadata);

  if (request.model !== "gpt-5.5") {
    throw new Error("Hermes GPT-5.5 transport proof requires model gpt-5.5");
  }

  const providerPayload: HermesGpt55ModelOnlyProviderPayload = Object.freeze({
    model: "gpt-5.5",
    instructions: MODEL_ONLY_INSTRUCTIONS,
    input: Object.freeze([
      Object.freeze({
        role: "user",
        content: Object.freeze([
          Object.freeze({
            type: "input_text",
            text: request.prompt,
          }),
        ]),
      }),
    ]) as HermesGpt55ModelOnlyProviderPayload["input"],
    store: false,
    stream: true,
  });

  return Object.freeze({
    schema_version: HERMES_GPT55_MODEL_ONLY_TRANSPORT_PROOF_SCHEMA_VERSION,
    provider_route: ["open", "ai-codex"].join(""),
    api_mode: "codex_responses",
    model: "gpt-5.5",
    store: false,
    provider_payload: providerPayload,
    requested_max_output_tokens_not_sent: request.maxOutputTokens,
    provider_calls_executed: 0,
    provider_spend: false,
    authorizes_candidate_calls: false,
    model_only_transport_proven: false,
    tool_use_allowed: false,
    shell_access_allowed: false,
    file_access_allowed: false,
    web_search_allowed: false,
    plugins_allowed: false,
    retrieval_allowed: false,
    skills_loaded: false,
    memory_loaded: false,
    mcp_allowed: false,
  });
}

function assertNoForbiddenMetadata(metadata: Record<string, string>): void {
  for (const key of Object.keys(metadata)) {
    const normalized = key.trim().toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.has(normalized)) {
      throw new Error(`forbidden metadata key for Hermes GPT-5.5 model-only transport: ${key}`);
    }
  }
}

export class HermesGpt55ModelOnlyInjectedTransportProof {
  readonly name = "hermes-gpt55-model-only-proof";
  readonly #fakeCaller: HermesGpt55ModelOnlyFakeCaller;

  constructor(options: HermesGpt55ModelOnlyInjectedTransportProofOptions) {
    if (
      typeof options !== "object" ||
      options === null ||
      typeof options.fakeCaller !== "object" ||
      options.fakeCaller === null ||
      options.fakeCaller.kind !== "no-spend-fake-caller" ||
      typeof options.fakeCaller.respond !== "function"
    ) {
      throw new Error("Hermes GPT-5.5 injected transport proof requires a no-spend fake caller");
    }
    this.#fakeCaller = options.fakeCaller;
  }

  generateNoSpendProof(request: ModelProviderRequest): ModelProviderResponse {
    const plan = createHermesGpt55ModelOnlyRequestPlan(request);
    const result = this.#fakeCaller.respond(plan.provider_payload);
    return parseHermesGpt55ModelOnlyResponse(result, request);
  }
}

export class HermesGpt55StreamingModelProvider implements ModelProvider {
  readonly name = "hermes-gpt55-streaming-adapter";
  readonly #streamCaller: HermesGpt55InjectedStreamCaller;

  constructor(options: HermesGpt55StreamingModelProviderOptions) {
    if (
      typeof options !== "object" ||
      options === null ||
      typeof options.streamCaller !== "object" ||
      options.streamCaller === null ||
      options.streamCaller.kind !== "injected-stream-caller" ||
      typeof options.streamCaller.stream !== "function"
    ) {
      throw new Error("Hermes GPT-5.5 streaming adapter requires an injected stream caller");
    }
    this.#streamCaller = options.streamCaller;
  }

  async generate(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const plan = createHermesGpt55ModelOnlyRequestPlan(request);
    const events = this.#streamCaller.stream(plan.provider_payload);
    if (typeof events !== "object" || events === null || typeof events[Symbol.asyncIterator] !== "function") {
      throw new Error("Hermes GPT-5.5 streaming adapter requires an async event stream");
    }

    let rawJson = "";
    let completed = false;
    for await (const event of events) {
      if (completed) {
        throw new Error("invalid Hermes GPT-5.5 streaming event order");
      }
      if (!isStreamingEvent(event)) {
        throw new Error("invalid Hermes GPT-5.5 streaming event");
      }
      if (event.type === "response.output_text.delta") {
        rawJson += event.delta;
      } else if (event.type === "response.completed") {
        completed = true;
      } else {
        throw new Error("Hermes GPT-5.5 streaming response failed");
      }
    }

    if (!completed || rawJson.trim() === "") {
      throw new Error("invalid Hermes GPT-5.5 streaming response");
    }

    return parseHermesGpt55StreamingResponse(rawJson, request);
  }
}

function parseHermesGpt55ModelOnlyResponse(
  result: HermesGpt55ModelOnlyFakeCallerResult,
  request: ModelProviderRequest,
): ModelProviderResponse {
  if (typeof result !== "object" || result === null || typeof result.rawJson !== "string") {
    throw new Error("invalid Hermes GPT-5.5 model-only response");
  }

  return parseHermesGpt55ResponseJson({
    rawJson: result.rawJson,
    request,
    expectedProvider: "hermes-gpt55-model-only-proof",
    invalidMessage: "invalid Hermes GPT-5.5 model-only response",
  });
}

function parseHermesGpt55StreamingResponse(
  rawJson: string,
  request: ModelProviderRequest,
): ModelProviderResponse {
  return parseHermesGpt55ResponseJson({
    rawJson,
    request,
    expectedProvider: "hermes-gpt55-streaming-adapter",
    invalidMessage: "invalid Hermes GPT-5.5 streaming response",
  });
}

function parseHermesGpt55ResponseJson(input: {
  readonly rawJson: string;
  readonly request: ModelProviderRequest;
  readonly expectedProvider: string;
  readonly invalidMessage: string;
}): ModelProviderResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawJson);
  } catch {
    throw new Error(input.invalidMessage);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(input.invalidMessage);
  }

  const response = parsed as Record<string, unknown>;
  const output = response.output;
  const usage = response.usage;
  const cost = response.cost;

  if (
    !hasExactKeys(response, ["cost", "idempotencyKey", "model", "output", "provider", "usage"]) ||
    response.provider !== input.expectedProvider ||
    response.model !== "gpt-5.5" ||
    response.idempotencyKey !== input.request.idempotencyKey ||
    !isEmptyGraphOutput(output) ||
    !isZeroUsage(usage) ||
    !isZeroUsdCost(cost)
  ) {
    throw new Error(input.invalidMessage);
  }

  return Object.freeze({
    provider: input.expectedProvider,
    model: "gpt-5.5",
    idempotencyKey: input.request.idempotencyKey,
    output: Object.freeze({
      excerpts: Object.freeze([]) as never[],
      claims: Object.freeze([]) as never[],
      account_objects: Object.freeze([]) as never[],
    }),
    usage: Object.freeze({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }),
    cost: Object.freeze({
      currency: "USD",
      amount: 0,
    }),
  });
}

function isStreamingEvent(event: unknown): event is HermesGpt55StreamingEvent {
  if (typeof event !== "object" || event === null || Array.isArray(event)) return false;
  const record = event as Record<string, unknown>;
  if (record.type === "response.output_text.delta") {
    return typeof record.delta === "string" && hasExactKeys(record, ["delta", "type"]);
  }
  return (
    (record.type === "response.completed" ||
      record.type === "response.failed" ||
      record.type === "response.incomplete") &&
    hasExactKeys(record, ["type"])
  );
}

function isEmptyGraphOutput(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  return (
    hasExactKeys(output, ["account_objects", "claims", "excerpts"]) &&
    Array.isArray(output.excerpts) &&
    output.excerpts.length === 0 &&
    Array.isArray(output.claims) &&
    output.claims.length === 0 &&
    Array.isArray(output.account_objects) &&
    output.account_objects.length === 0
  );
}

function isZeroUsage(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const usage = value as Record<string, unknown>;
  return (
    hasExactKeys(usage, ["inputTokens", "outputTokens", "totalTokens"]) &&
    usage.inputTokens === 0 &&
    usage.outputTokens === 0 &&
    usage.totalTokens === 0
  );
}

function isZeroUsdCost(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cost = value as Record<string, unknown>;
  return hasExactKeys(cost, ["amount", "currency"]) && cost.currency === "USD" && cost.amount === 0;
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expectedKeys.length && expectedKeys.every((key, index) => keys[index] === key);
}
