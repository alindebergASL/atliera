import { createHash } from "node:crypto";
import {
  createModelProviderRequest,
  type ModelProvider,
} from "../model/provider.ts";
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
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly costUsd: number;
  readonly callsAttempted: 1;
  readonly callsSucceeded: 1;
  readonly retries: 0;
  readonly storage: false;
}

export class AccountIntelligenceProviderRefusal extends Error {
  readonly receipt: Readonly<{ code: "output_token_limit_exceeded"; provider: string; model: string; reportedOutputTokens: number; maxOutputTokens: number; callsAttempted: 1; callsSucceeded: 0; storage: false }>;
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
  readonly providerStorage: false;
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{2,255}$/u;

/**
 * Explicit one-call review boundary. The injected provider may be the existing
 * ExternalCommandModelProvider. No SDK, credential, environment, persistence,
 * network, or retry behavior is constructed here.
 */
export class AccountIntelligenceProviderBoundary {
  readonly #providerName: string;
  readonly #generate: ModelProvider["generate"];
  readonly #model: string;
  readonly #corpusRef: string;
  readonly #maxOutputTokens: number;
  readonly #maxCostUsd: number;
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
    if (options.providerStorage !== false) throw new Error("provider storage must be false");
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
    this.#providerName = nameDescriptor.value;
    this.#generate = generateDescriptor.value.bind(options.provider) as ModelProvider["generate"];
    this.#model = options.model;
    this.#corpusRef = options.outOfRepoCorpusRef;
    this.#maxOutputTokens = options.maxOutputTokens;
    this.#maxCostUsd = options.maxCostUsd;
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
    const idempotencyKey = `c2_${createHash("sha256").update(`${request.accountId}\n${promptSha256}`, "utf8").digest("hex").slice(0, 24)}`;
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
        operation_contract: "account-intelligence.propose.v1",
        prompt_sha256: promptSha256,
      },
    });
    const response = await this.#generate(modelRequest);
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
        code: "output_token_limit_exceeded", provider: this.#providerName, model: this.#model,
        reportedOutputTokens: response.usage.outputTokens, maxOutputTokens: this.#maxOutputTokens,
        callsAttempted: 1, callsSucceeded: 0, storage: false,
      });
    }
    const rawObjects = response.output.account_objects as unknown as readonly unknown[];
    if (rawObjects.length !== 1) throw new Error("provider must return exactly one account intelligence proposal");
    const proposal = snapshotAccountIntelligenceProposal(rawObjects[0], request, sources);
    return Object.freeze({
      proposal,
      receipt: Object.freeze({
        provider: response.provider,
        model: response.model,
        promptSha256,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
        costUsd: response.cost.amount,
        callsAttempted: 1,
        callsSucceeded: 1,
        retries: 0,
        storage: false,
      }),
    });
  }
}
