import {
  ModelModeNotActivatedError,
  type RuntimeMode,
} from "../modes/index.ts";

export type ModelProviderOperation = "graph.propose";

export interface ModelProviderGraphOutput {
  excerpts: never[];
  claims: never[];
  account_objects: never[];
}

export interface ModelProviderRequestInput {
  operation: ModelProviderOperation;
  mode: RuntimeMode;
  model: string;
  prompt: string;
  inputGraphRef: string;
  idempotencyKey: string;
  maxOutputTokens: number;
  temperature: number;
  metadata?: Record<string, string>;
}

export interface ModelProviderRequest extends ModelProviderRequestInput {
  metadata: Record<string, string>;
}

export interface ModelProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelProviderCost {
  currency: "USD";
  amount: number;
}

export interface ModelProviderResponse {
  provider: string;
  model: string;
  idempotencyKey: string;
  output: ModelProviderGraphOutput;
  usage: ModelProviderUsage;
  cost: ModelProviderCost;
}

export type ModelProviderValidationFailure =
  | "invalid_json"
  | "schema_mismatch"
  | "hallucinated_source_ids"
  | "excerpt_text_mismatch"
  | "claim_without_evidence";

export type ModelProviderValidationAction =
  | "retry_once_then_fail_stage"
  | "reject_without_retry";

export interface ModelProviderSafetyContract {
  readonly budget: {
    readonly requiresPreCallEstimate: true;
    readonly estimateMustBeCheckedAgainstRemainingBudget: true;
    readonly requiresCumulativeLedgerAcrossRuns: true;
    readonly refuseBeforeCallWhenEstimateWouldExceedBudget: true;
    readonly postCallCostIsReportingOnly: true;
  };
  readonly responseValidation: Readonly<
    Record<ModelProviderValidationFailure, ModelProviderValidationAction>
  >;
  readonly activation: {
    readonly requiredGates: readonly [
      "explicit_model_mode",
      "provider",
      "model",
      "max_cost",
      "out_of_repo_corpus_path",
      "operator_approval",
    ];
    readonly aggregateMissingGatesBeforeRefusal: true;
  };
  readonly credentials: {
    readonly refuseBeforeCallWhenMissingOrInvalid: true;
    readonly errorNamesMissingCredential: true;
    readonly neverPrintCredentialValue: true;
    readonly exitsNonZeroForCliActivation: true;
  };
  readonly imports: {
    readonly noStaticProviderSdkImports: true;
    readonly dynamicImportOnlyInsideActivatedProviderPath: true;
    readonly fakeAndFixtureModesMustNotLoadProviderSdk: true;
  };
  readonly fakeProvider: {
    readonly implementsSameInterfaceAsRealProviders: true;
    readonly deterministicNoSpendOutput: true;
    readonly rejectedByProductionLikePreflight: true;
    readonly realProvidersUseSameModelProviderBoundary: true;
  };
}

export const MODEL_PROVIDER_SAFETY_CONTRACT: ModelProviderSafetyContract = Object.freeze({
  budget: Object.freeze({
    requiresPreCallEstimate: true,
    estimateMustBeCheckedAgainstRemainingBudget: true,
    requiresCumulativeLedgerAcrossRuns: true,
    refuseBeforeCallWhenEstimateWouldExceedBudget: true,
    postCallCostIsReportingOnly: true,
  }),
  responseValidation: Object.freeze({
    invalid_json: "retry_once_then_fail_stage",
    schema_mismatch: "retry_once_then_fail_stage",
    hallucinated_source_ids: "reject_without_retry",
    excerpt_text_mismatch: "reject_without_retry",
    claim_without_evidence: "reject_without_retry",
  }),
  activation: Object.freeze({
    requiredGates: [
      "explicit_model_mode",
      "provider",
      "model",
      "max_cost",
      "out_of_repo_corpus_path",
      "operator_approval",
    ] as const,
    aggregateMissingGatesBeforeRefusal: true,
  }),
  credentials: Object.freeze({
    refuseBeforeCallWhenMissingOrInvalid: true,
    errorNamesMissingCredential: true,
    neverPrintCredentialValue: true,
    exitsNonZeroForCliActivation: true,
  }),
  imports: Object.freeze({
    noStaticProviderSdkImports: true,
    dynamicImportOnlyInsideActivatedProviderPath: true,
    fakeAndFixtureModesMustNotLoadProviderSdk: true,
  }),
  fakeProvider: Object.freeze({
    implementsSameInterfaceAsRealProviders: true,
    deterministicNoSpendOutput: true,
    rejectedByProductionLikePreflight: true,
    realProvidersUseSameModelProviderBoundary: true,
  }),
});

export interface ModelProvider {
  readonly name: string;
  generate(request: ModelProviderRequest): Promise<ModelProviderResponse>;
}

const OPERATIONS: readonly ModelProviderOperation[] = ["graph.propose"];
const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_RELATIVE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function createModelProviderRequest(
  input: ModelProviderRequestInput,
): ModelProviderRequest {
  const request: ModelProviderRequest = {
    operation: input.operation,
    mode: input.mode,
    model: input.model,
    prompt: input.prompt,
    inputGraphRef: input.inputGraphRef,
    idempotencyKey: input.idempotencyKey,
    maxOutputTokens: input.maxOutputTokens,
    temperature: input.temperature,
    metadata: copyModelProviderRequestMetadata(input.metadata),
  };
  assertSafeModelProviderRequest(request);
  return request;
}

function copyModelProviderRequestMetadata(metadata: Record<string, string> | undefined): Record<string, string> {
  if (metadata === undefined) {
    return {};
  }
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    throw new Error("metadata must be a plain string record");
  }

  const copy: Record<string, string> = {};
  try {
    for (const key of Object.keys(metadata)) {
      const descriptor = Object.getOwnPropertyDescriptor(metadata, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string") {
        throw new Error("metadata must be a plain string record");
      }
      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: descriptor.value,
        writable: true,
      });
    }
  } catch {
    throw new Error("metadata must be a plain string record");
  }
  return copy;
}

export function assertSafeModelProviderRequest(request: ModelProviderRequest): void {
  if (!OPERATIONS.includes(request.operation)) {
    throw new Error(`operation must be one of ${OPERATIONS.join(", ")}`);
  }

  assertSafeLogicalId("model", request.model, "model must be a safe logical model id");

  if (
    !SAFE_RELATIVE_REF.test(request.inputGraphRef) ||
    request.inputGraphRef.includes("..") ||
    request.inputGraphRef.startsWith("/") ||
    request.inputGraphRef.includes("://") ||
    request.inputGraphRef.includes("\\")
  ) {
    throw new Error("inputGraphRef must be a safe relative reference");
  }

  assertSafeLogicalId(
    "idempotencyKey",
    request.idempotencyKey,
    "idempotencyKey must be a safe logical id",
  );

  if (
    !Number.isInteger(request.maxOutputTokens) ||
    request.maxOutputTokens < 1 ||
    request.maxOutputTokens > 200000
  ) {
    throw new Error("maxOutputTokens must be an integer from 1 to 200000");
  }

  if (
    typeof request.temperature !== "number" ||
    !Number.isFinite(request.temperature) ||
    request.temperature < 0 ||
    request.temperature > 2
  ) {
    throw new Error("temperature must be a number from 0 to 2");
  }
}

function assertSafeLogicalId(field: string, value: string, message: string): void {
  if (
    value.trim() !== value ||
    !SAFE_LOGICAL_ID.test(value) ||
    value.includes("://") ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new Error(`${message}: ${field}`);
  }
}

export class FakeModelProvider implements ModelProvider {
  readonly name = "fake";

  async generate(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    assertSafeModelProviderRequest(request);
    if (request.mode === "model") {
      throw new ModelModeNotActivatedError(request.mode);
    }

    return {
      provider: this.name,
      model: request.model,
      idempotencyKey: request.idempotencyKey,
      output: {
        excerpts: [],
        claims: [],
        account_objects: [],
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      cost: {
        currency: "USD",
        amount: 0,
      },
    };
  }
}
