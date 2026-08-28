import { createHash } from "node:crypto";
import {
  assertExactKeys,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import { createModelProviderRequest, type ModelProvider } from "../model/provider.ts";
import type {
  AccountIntelligenceProposal,
  AccountResearchPlan,
  AccountResearchRequest,
  AdmittedAccountSource,
} from "./contracts.ts";
import { createC2DraftPrompt, materializeC2DraftProposal } from "./c2-draft.ts";
import {
  accountIntelligencePromptSha256,
  accountIntelligenceRejectedProposalSha256,
  accountIntelligenceValidatorIssueFromError,
  renderAccountIntelligenceCorrectiveText,
  type AccountIntelligenceValidationIssueCode,
} from "./proposal.ts";

export interface AccountIntelligenceProviderReceipt {
  readonly provider: string;
  readonly model: string;
  readonly promptSha256: string;
  readonly boundaryConfigurationSha256: string;
  readonly inputTokens: number;
  readonly requestedMaxOutputTokens: number;
  readonly requestedLocalOutputTokenCeiling: number;
  readonly transmittedProviderOutputTokenCeiling: null;
  readonly observedOutputTokens: number;
  readonly externalOutputTokenEnforcement: "unestablished";
  readonly structuredOutputEnforcement: "local_deterministic_validation_only";
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly costUsd: number;
  readonly callsAttempted: 1;
  readonly callsSucceeded: 1;
  readonly retries: 0;
  readonly providerBehavior: "external_variable_response_validated";
  readonly storage: "unestablished";
  readonly tools: "unestablished";
  readonly networkEffects: "unestablished";
}

export interface AccountIntelligenceValidationIssue {
  readonly code: AccountIntelligenceValidationIssueCode;
  readonly path: string;
  readonly accountId: string;
  readonly originalPromptSha256: string;
  readonly rejectedProposalSha256: string;
  readonly correctiveText: string;
}

const INTERNAL_VALIDATION_REFUSAL = Symbol("account-intelligence-validation-refusal");
const INTERNAL_CORRECTION_ISSUE = Symbol("account-intelligence-correction-issue");
const CONTROLLER_OWNED_VALIDATION_REFUSALS = new WeakSet<object>();

export class AccountIntelligenceProposalValidationRefusal extends Error {
  override readonly name = "AccountIntelligenceProposalValidationRefusal";
  readonly issue: Readonly<AccountIntelligenceValidationIssue>;
  readonly receipt: Readonly<AccountIntelligenceProviderReceipt>;

  constructor(
    token: symbol,
    issue: Readonly<AccountIntelligenceValidationIssue>,
    receipt: Readonly<AccountIntelligenceProviderReceipt>,
  ) {
    if (token !== INTERNAL_VALIDATION_REFUSAL) throw new Error("validation refusal construction refused");
    super(issue.correctiveText);
    const materializedStack = typeof this.stack === "string" ? this.stack : undefined;
    Object.defineProperty(this, "stack", {
      configurable: false,
      enumerable: false,
      value: materializedStack,
      writable: false,
    });
    this.issue = Object.freeze({ ...issue });
    this.receipt = Object.freeze({ ...receipt });
    Object.freeze(this);
    CONTROLLER_OWNED_VALIDATION_REFUSALS.add(this);
  }
}

export class AccountIntelligenceProviderRefusal extends Error {
  readonly receipt: Readonly<{
    code: "output_token_limit_exceeded";
    provider: string;
    model: string;
    reportedOutputTokens: number;
    maxOutputTokens: number;
    requestedLocalOutputTokenCeiling: number;
    transmittedProviderOutputTokenCeiling: null;
    observedOutputTokens: number;
    externalOutputTokenEnforcement: "unestablished";
    callsAttempted: 1;
    callsSucceeded: 0;
    providerBehavior: "external_variable_response_validated";
    storage: "unestablished";
    tools: "unestablished";
    networkEffects: "unestablished";
  }>;
  constructor(receipt: AccountIntelligenceProviderRefusal["receipt"]) {
    super("account intelligence provider output token limit exceeded");
    this.name = "AccountIntelligenceProviderRefusal";
    this.receipt = Object.freeze(receipt);
  }
}

export interface AccountIntelligenceProviderResult {
  readonly proposal: Readonly<AccountIntelligenceProposal>;
  readonly receipt: Readonly<AccountIntelligenceProviderReceipt>;
}

export interface AccountIntelligenceProviderBoundaryOptions {
  readonly provider: ModelProvider;
  readonly model: string;
  readonly outOfRepoCorpusRef: string;
  readonly maxOutputTokens: number;
  readonly maxCostUsd: number;
}

interface InternalAccountIntelligenceProviderBoundaryOptions extends AccountIntelligenceProviderBoundaryOptions {
  readonly [INTERNAL_CORRECTION_ISSUE]?: Readonly<AccountIntelligenceValidationIssue>;
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,255}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const PROVIDER_RESPONSE_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 100,
  max_depth: 12,
  max_expanded_json_value_occurrences: 12_000,
  max_nodes: 4_000,
  max_object_fields: 24,
  max_string_utf8_bytes: 512_000,
  max_total_string_utf8_bytes: 1_024_000,
});
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

interface SnapshottedProviderResponse {
  readonly provider: string;
  readonly model: string;
  readonly idempotencyKey: string;
  readonly excerpts: readonly StrictJsonValue[];
  readonly claims: readonly StrictJsonValue[];
  readonly accountObjects: readonly StrictJsonValue[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly currency: string;
  readonly costAmount: number;
}

function primitiveString(value: StrictJsonValue | undefined, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} must be string`);
  return value;
}

function primitiveNumber(value: StrictJsonValue | undefined, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be finite number`);
  return value;
}

function snapshotProviderResponse(value: unknown): Readonly<SnapshottedProviderResponse> {
  const root = strictJsonObject(
    snapshotStrictJson(value, "accountIntelligenceProviderResponse", PROVIDER_RESPONSE_LIMITS),
    "accountIntelligenceProviderResponse",
  );
  assertExactKeys(root, ["provider", "model", "idempotencyKey", "output", "usage", "cost"],
    "accountIntelligenceProviderResponse");
  const output = strictJsonObject(root.output as StrictJsonValue, "accountIntelligenceProviderResponse.output");
  assertExactKeys(output, ["excerpts", "claims", "account_objects"], "accountIntelligenceProviderResponse.output");
  const usage = strictJsonObject(root.usage as StrictJsonValue, "accountIntelligenceProviderResponse.usage");
  assertExactKeys(usage, ["inputTokens", "outputTokens", "totalTokens"], "accountIntelligenceProviderResponse.usage");
  const cost = strictJsonObject(root.cost as StrictJsonValue, "accountIntelligenceProviderResponse.cost");
  assertExactKeys(cost, ["currency", "amount"], "accountIntelligenceProviderResponse.cost");
  return Object.freeze({
    provider: primitiveString(root.provider, "accountIntelligenceProviderResponse.provider"),
    model: primitiveString(root.model, "accountIntelligenceProviderResponse.model"),
    idempotencyKey: primitiveString(root.idempotencyKey, "accountIntelligenceProviderResponse.idempotencyKey"),
    excerpts: Object.freeze(strictJsonArray(output.excerpts, "accountIntelligenceProviderResponse.output.excerpts", 100)),
    claims: Object.freeze(strictJsonArray(output.claims, "accountIntelligenceProviderResponse.output.claims", 100)),
    accountObjects: Object.freeze(strictJsonArray(
      output.account_objects, "accountIntelligenceProviderResponse.output.account_objects", 100,
    )),
    inputTokens: primitiveNumber(usage.inputTokens, "accountIntelligenceProviderResponse.usage.inputTokens"),
    outputTokens: primitiveNumber(usage.outputTokens, "accountIntelligenceProviderResponse.usage.outputTokens"),
    totalTokens: primitiveNumber(usage.totalTokens, "accountIntelligenceProviderResponse.usage.totalTokens"),
    currency: primitiveString(cost.currency, "accountIntelligenceProviderResponse.cost.currency"),
    costAmount: primitiveNumber(cost.amount, "accountIntelligenceProviderResponse.cost.amount"),
  });
}

/**
 * Creates the local correction boundary from one real deterministic rejection.
 * Public proposal options never accept prose or issue objects. The expected
 * rejected hash is an explicit custody check; no prior model prose is reused.
 */
export function createAccountIntelligenceCorrectionBoundary(
  options: AccountIntelligenceProviderBoundaryOptions,
  priorFailure: unknown,
  expectedRejectedProposalSha256: string,
): AccountIntelligenceProviderBoundary {
  if (!(priorFailure instanceof AccountIntelligenceProposalValidationRefusal)) {
    throw new Error("typed deterministic validation refusal required");
  }
  if (!CONTROLLER_OWNED_VALIDATION_REFUSALS.has(priorFailure)) {
    throw new Error("validator-owned deterministic validation refusal required");
  }
  const issue = priorFailure.issue;
  if (!SHA256.test(expectedRejectedProposalSha256) ||
      issue.rejectedProposalSha256 !== expectedRejectedProposalSha256) {
    throw new Error("rejected proposal hash mismatch");
  }
  const internalOptions: InternalAccountIntelligenceProviderBoundaryOptions = {
    ...options,
    [INTERNAL_CORRECTION_ISSUE]: issue,
  };
  return new AccountIntelligenceProviderBoundary(internalOptions);
}

/**
 * Explicit one-call review boundary. Only local configuration is snapshotted.
 * The injected provider remains an external mutable dependency: its behavior,
 * storage, tools, network effects, structured-output support, and server-side
 * output ceiling are not established here. Deterministic semantic validation
 * and the requested output-token boundary remain local and fail closed.
 */
export class AccountIntelligenceProviderBoundary {
  readonly #provider: ModelProvider;
  readonly #providerName: string;
  readonly #model: string;
  readonly #corpusRef: string;
  readonly #maxOutputTokens: number;
  readonly #maxCostUsd: number;
  readonly #correctionIssue: Readonly<AccountIntelligenceValidationIssue> | null;
  readonly #configurationSha256: string;
  #consumed = false;

  constructor(publicOptions: AccountIntelligenceProviderBoundaryOptions) {
    const options = publicOptions as InternalAccountIntelligenceProviderBoundaryOptions;
    for (const forbidden of ["correctiveValidatorErrors", "correctiveValidationFailure", "correction", "validationIssue"]) {
      if (Object.hasOwn(options, forbidden)) throw new Error("public corrective feedback refused");
    }
    if (!SAFE_REF.test(options.outOfRepoCorpusRef) || options.outOfRepoCorpusRef.includes("..") ||
        options.outOfRepoCorpusRef.startsWith("/") || options.outOfRepoCorpusRef.includes("://")) {
      throw new Error("out-of-repo corpus reference refused");
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/u.test(options.model)) throw new Error("model id refused");
    if (!Number.isInteger(options.maxOutputTokens) || options.maxOutputTokens < 1 || options.maxOutputTokens > 25_000) {
      throw new Error("max output tokens refused");
    }
    if (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd <= 0 || options.maxCostUsd > 10) {
      throw new Error("provider cost cap refused");
    }
    const nameDescriptor = Object.getOwnPropertyDescriptor(options.provider, "name");
    let generateOwner: object | null = options.provider;
    let generateDescriptor: PropertyDescriptor | undefined;
    while (generateOwner !== null && generateDescriptor === undefined) {
      generateDescriptor = Object.getOwnPropertyDescriptor(generateOwner, "generate");
      generateOwner = Object.getPrototypeOf(generateOwner);
    }
    if (nameDescriptor === undefined || !("value" in nameDescriptor) || typeof nameDescriptor.value !== "string" ||
        generateDescriptor === undefined || !("value" in generateDescriptor) || typeof generateDescriptor.value !== "function") {
      throw new Error("provider dependency shape refused");
    }
    this.#provider = options.provider;
    this.#providerName = nameDescriptor.value;
    this.#model = options.model;
    this.#corpusRef = options.outOfRepoCorpusRef;
    this.#maxOutputTokens = options.maxOutputTokens;
    this.#maxCostUsd = options.maxCostUsd;
    this.#correctionIssue = options[INTERNAL_CORRECTION_ISSUE] ?? null;
    this.#configurationSha256 = sha256(JSON.stringify({
      providerName: this.#providerName,
      model: this.#model,
      corpusRef: this.#corpusRef,
      maxOutputTokens: this.#maxOutputTokens,
      maxCostUsd: this.#maxCostUsd,
      correctionIssueSha256: sha256(JSON.stringify(this.#correctionIssue)),
      providerBehavior: "external_variable_response_validated",
      providerOutputTokenEnforcement: "local_only_external_unestablished",
      structuredOutputEnforcement: "local_deterministic_validation_only",
      storage: "unestablished",
      tools: "unestablished",
      networkEffects: "unestablished",
    }));
  }

  async propose(
    request: Readonly<AccountResearchRequest>,
    plan: Readonly<AccountResearchPlan>,
    sources: readonly AdmittedAccountSource[],
  ): Promise<AccountIntelligenceProviderResult> {
    if (this.#consumed) throw new Error("account intelligence provider boundary already consumed");
    this.#consumed = true;
    if (plan.accountId !== request.accountId || sources.length === 0 || sources.length > plan.admittedSourceLimit) {
      throw new Error("model prompt inputs refused");
    }
    const originalPrompt = createC2DraftPrompt(request, sources);
    const originalPromptSha256 = accountIntelligencePromptSha256(originalPrompt);
    if (this.#correctionIssue !== null &&
        (this.#correctionIssue.accountId !== request.accountId ||
          this.#correctionIssue.originalPromptSha256 !== originalPromptSha256)) {
      throw new Error("corrective issue does not match governed account input");
    }
    const prompt = this.#correctionIssue === null ? originalPrompt : JSON.stringify({
      ...JSON.parse(originalPrompt) as Record<string, unknown>,
      correction: {
        kind: "deterministic_validator_issue",
        issue: this.#correctionIssue,
      },
    });
    const promptSha256 = accountIntelligencePromptSha256(prompt);
    const idempotencyKey = `c2_${sha256(`${request.accountId}\n${promptSha256}`).slice(0, 24)}`;
    const modelRequest = createModelProviderRequest({
      operation: "graph.propose",
      mode: "model",
      model: this.#model,
      prompt,
      inputGraphRef: this.#corpusRef,
      idempotencyKey,
      maxOutputTokens: this.#maxOutputTokens,
      temperature: 0,
      metadata: {
        operation_contract: "account-intelligence.propose.v2",
        prompt_sha256: promptSha256,
        boundary_configuration_sha256: this.#configurationSha256,
      },
    });
    const response = await this.#provider.generate(modelRequest);
    const trustedResponse = snapshotProviderResponse(response);
    if (trustedResponse.idempotencyKey !== idempotencyKey || trustedResponse.model !== this.#model ||
        trustedResponse.provider !== this.#providerName || trustedResponse.currency !== "USD" ||
        trustedResponse.costAmount < 0 || trustedResponse.costAmount > this.#maxCostUsd ||
        !Number.isSafeInteger(trustedResponse.inputTokens) || trustedResponse.inputTokens < 0 ||
        !Number.isSafeInteger(trustedResponse.outputTokens) || trustedResponse.outputTokens < 0 ||
        trustedResponse.totalTokens !== trustedResponse.inputTokens + trustedResponse.outputTokens) {
      throw new Error("account intelligence provider receipt refused");
    }
    if (trustedResponse.outputTokens > this.#maxOutputTokens) {
      throw new AccountIntelligenceProviderRefusal({
        code: "output_token_limit_exceeded",
        provider: this.#providerName,
        model: this.#model,
        reportedOutputTokens: trustedResponse.outputTokens,
        maxOutputTokens: this.#maxOutputTokens,
        requestedLocalOutputTokenCeiling: this.#maxOutputTokens,
        transmittedProviderOutputTokenCeiling: null,
        observedOutputTokens: trustedResponse.outputTokens,
        externalOutputTokenEnforcement: "unestablished",
        callsAttempted: 1,
        callsSucceeded: 0,
        providerBehavior: "external_variable_response_validated",
        storage: "unestablished",
        tools: "unestablished",
        networkEffects: "unestablished",
      });
    }
    if (trustedResponse.excerpts.length !== 0 || trustedResponse.claims.length !== 0 || trustedResponse.accountObjects.length !== 1) {
      throw new Error("provider must return exactly one account intelligence proposal and no graph excerpts or claims");
    }
    const rejectedOrValidatedProposal = trustedResponse.accountObjects[0] as StrictJsonValue;
    const receipt: Readonly<AccountIntelligenceProviderReceipt> = Object.freeze({
      provider: trustedResponse.provider,
      model: trustedResponse.model,
      promptSha256,
      boundaryConfigurationSha256: this.#configurationSha256,
      inputTokens: trustedResponse.inputTokens,
      requestedMaxOutputTokens: this.#maxOutputTokens,
      requestedLocalOutputTokenCeiling: this.#maxOutputTokens,
      transmittedProviderOutputTokenCeiling: null,
      observedOutputTokens: trustedResponse.outputTokens,
      externalOutputTokenEnforcement: "unestablished",
      structuredOutputEnforcement: "local_deterministic_validation_only",
      outputTokens: trustedResponse.outputTokens,
      totalTokens: trustedResponse.totalTokens,
      costUsd: trustedResponse.costAmount,
      callsAttempted: 1,
      callsSucceeded: 1,
      retries: 0,
      providerBehavior: "external_variable_response_validated",
      storage: "unestablished",
      tools: "unestablished",
      networkEffects: "unestablished",
    });
    try {
      const proposal = materializeC2DraftProposal(rejectedOrValidatedProposal, request, sources);
      return Object.freeze({ proposal, receipt });
    } catch (error) {
      const seed = accountIntelligenceValidatorIssueFromError(error);
      if (seed === null) throw error;
      const issue: Readonly<AccountIntelligenceValidationIssue> = Object.freeze({
        code: seed.code,
        path: seed.path,
        accountId: request.accountId,
        originalPromptSha256,
        rejectedProposalSha256: accountIntelligenceRejectedProposalSha256(rejectedOrValidatedProposal),
        correctiveText: renderAccountIntelligenceCorrectiveText(seed),
      });
      throw new AccountIntelligenceProposalValidationRefusal(
        INTERNAL_VALIDATION_REFUSAL,
        issue,
        receipt,
      );
    }
  }
}
