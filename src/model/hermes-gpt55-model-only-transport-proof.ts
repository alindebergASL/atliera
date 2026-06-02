import {
  assertSafeModelProviderRequest,
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
  readonly max_output_tokens: number;
}

export interface HermesGpt55ModelOnlyRequestPlan {
  readonly schema_version: typeof HERMES_GPT55_MODEL_ONLY_TRANSPORT_PROOF_SCHEMA_VERSION;
  readonly provider_route: string;
  readonly api_mode: "codex_responses";
  readonly model: "gpt-5.5";
  readonly store: false;
  readonly provider_payload: HermesGpt55ModelOnlyProviderPayload;
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
    max_output_tokens: request.maxOutputTokens,
  });

  return Object.freeze({
    schema_version: HERMES_GPT55_MODEL_ONLY_TRANSPORT_PROOF_SCHEMA_VERSION,
    provider_route: ["open", "ai-codex"].join(""),
    api_mode: "codex_responses",
    model: "gpt-5.5",
    store: false,
    provider_payload: providerPayload,
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

function parseHermesGpt55ModelOnlyResponse(
  result: HermesGpt55ModelOnlyFakeCallerResult,
  request: ModelProviderRequest,
): ModelProviderResponse {
  if (typeof result !== "object" || result === null || typeof result.rawJson !== "string") {
    throw new Error("invalid Hermes GPT-5.5 model-only response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.rawJson);
  } catch {
    throw new Error("invalid Hermes GPT-5.5 model-only response");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("invalid Hermes GPT-5.5 model-only response");
  }

  const response = parsed as Record<string, unknown>;
  const output = response.output;
  const usage = response.usage;
  const cost = response.cost;

  if (
    !hasExactKeys(response, ["cost", "idempotencyKey", "model", "output", "provider", "usage"]) ||
    response.provider !== "hermes-gpt55-model-only-proof" ||
    response.model !== "gpt-5.5" ||
    response.idempotencyKey !== request.idempotencyKey ||
    !isEmptyGraphOutput(output) ||
    !isZeroUsage(usage) ||
    !isZeroUsdCost(cost)
  ) {
    throw new Error("invalid Hermes GPT-5.5 model-only response");
  }

  return Object.freeze({
    provider: "hermes-gpt55-model-only-proof",
    model: "gpt-5.5",
    idempotencyKey: request.idempotencyKey,
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
