import { createHash } from "node:crypto";
import { createModelProviderRequest, type ModelProvider } from "../model/provider.ts";
import type {
  AccountIntelligenceProposal,
  AccountResearchPlan,
  AccountResearchRequest,
  AdmittedAccountSource,
} from "./contracts.ts";
import {
  accountIntelligencePromptSha256,
  createAccountIntelligencePrompt,
  snapshotAccountIntelligenceProposal,
} from "./proposal.ts";

export interface AccountIntelligenceProviderReceipt {
  readonly provider: string;
  readonly model: string;
  readonly promptSha256: string;
  readonly boundaryConfigurationSha256: string;
  readonly inputTokens: number;
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

export class AccountIntelligenceProviderRefusal extends Error {
  readonly receipt: Readonly<{
    code: "output_token_limit_exceeded";
    provider: string;
    model: string;
    reportedOutputTokens: number;
    maxOutputTokens: number;
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

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,255}$/u;
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Explicit one-call review boundary. Only local configuration is snapshotted.
 * The injected provider remains an external mutable dependency: its behavior,
 * storage, tools, and network effects are not frozen or established here.
 * The returned response identity, shape, usage, cost, and output are validated.
 */
export class AccountIntelligenceProviderBoundary {
  readonly #provider: ModelProvider;
  readonly #providerName: string;
  readonly #model: string;
  readonly #corpusRef: string;
  readonly #maxOutputTokens: number;
  readonly #maxCostUsd: number;
  readonly #configurationSha256: string;
  #consumed = false;

  constructor(options: AccountIntelligenceProviderBoundaryOptions) {
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
    this.#configurationSha256 = sha256(JSON.stringify({
      providerName: this.#providerName,
      model: this.#model,
      corpusRef: this.#corpusRef,
      maxOutputTokens: this.#maxOutputTokens,
      maxCostUsd: this.#maxCostUsd,
      providerBehavior: "external_variable_response_validated",
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
    const prompt = createAccountIntelligencePrompt(request, plan, sources);
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
    if (response.idempotencyKey !== idempotencyKey || response.model !== this.#model ||
        response.provider !== this.#providerName || response.cost.currency !== "USD" ||
        response.cost.amount < 0 || response.cost.amount > this.#maxCostUsd ||
        !Number.isSafeInteger(response.usage.inputTokens) || response.usage.inputTokens < 0 ||
        !Number.isSafeInteger(response.usage.outputTokens) || response.usage.outputTokens < 0 ||
        response.usage.totalTokens !== response.usage.inputTokens + response.usage.outputTokens) {
      throw new Error("account intelligence provider receipt refused");
    }
    if (response.usage.outputTokens > this.#maxOutputTokens) {
      throw new AccountIntelligenceProviderRefusal({
        code: "output_token_limit_exceeded",
        provider: this.#providerName,
        model: this.#model,
        reportedOutputTokens: response.usage.outputTokens,
        maxOutputTokens: this.#maxOutputTokens,
        callsAttempted: 1,
        callsSucceeded: 0,
        providerBehavior: "external_variable_response_validated",
        storage: "unestablished",
        tools: "unestablished",
        networkEffects: "unestablished",
      });
    }
    const rawObjects = response.output.account_objects as unknown;
    if (!Array.isArray(rawObjects) || rawObjects.length !== 1) {
      throw new Error("provider must return exactly one account intelligence proposal");
    }
    const proposal = snapshotAccountIntelligenceProposal(rawObjects[0], request, sources);
    return Object.freeze({
      proposal,
      receipt: Object.freeze({
        provider: response.provider,
        model: response.model,
        promptSha256,
        boundaryConfigurationSha256: this.#configurationSha256,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
        costUsd: response.cost.amount,
        callsAttempted: 1,
        callsSucceeded: 1,
        retries: 0,
        providerBehavior: "external_variable_response_validated",
        storage: "unestablished",
        tools: "unestablished",
        networkEffects: "unestablished",
      }),
    });
  }
}
