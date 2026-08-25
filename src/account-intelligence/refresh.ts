import { deepFreezeOwnData } from "../authority/strict-json.ts";
import { admitAccountResearch } from "./admission.ts";
import type {
  AccountIntelligenceEffectReceipt,
  RetrievedSourceInput,
  SearchDiscoveryRecord,
  ValidatedAccountIntelligence,
} from "./contracts.ts";
import { AccountIntelligenceProviderBoundary } from "./provider.ts";
import { createAccountResearchPlan, snapshotAccountResearchRequest } from "./research-plan.ts";
import { snapshotAdmittedResearchPolicy } from "./research-policy.ts";

export interface AccountIntelligenceRefreshInput {
  readonly request: unknown;
  readonly researchPolicy: unknown;
  readonly discoveries: readonly SearchDiscoveryRecord[];
  readonly retrievedSources: readonly RetrievedSourceInput[];
  readonly providerBoundary: AccountIntelligenceProviderBoundary;
}

/**
 * Bounded orchestration over explicit retained inputs. Discovery and source
 * records do not prove that external searches or retrievals executed. This
 * function creates no database, Graph, persistence, deployment, publication,
 * or customer effects. Provider behavior remains an external variable effect.
 */
export async function executeAccountIntelligenceRefresh(
  input: AccountIntelligenceRefreshInput,
): Promise<Readonly<ValidatedAccountIntelligence>> {
  const request = snapshotAccountResearchRequest(input.request);
  const plan = createAccountResearchPlan(request);
  const researchPolicy = snapshotAdmittedResearchPolicy(input.researchPolicy);
  const admitted = admitAccountResearch(request, plan, researchPolicy, input.discoveries, input.retrievedSources);
  const recordedQueryTexts = [...new Set(admitted.discoveries
    .filter((item) => item.queryKind !== "owner_authorized_exact_url")
    .map((item) => item.exactQuery))];
  if (recordedQueryTexts.length === 0 || recordedQueryTexts.length > plan.queryLimit) {
    throw new Error("account research query-record budget refused");
  }
  if (admitted.sources.length === 0 || admitted.sources.length > plan.admittedSourceLimit) {
    throw new Error("account research source budget refused");
  }
  const providerResult = await input.providerBoundary.propose(request, plan, admitted.sources);
  const receipt: AccountIntelligenceEffectReceipt = {
    kind: "atliera.account-intelligence-effect-receipt",
    schemaVersion: "2",
    accountId: request.accountId,
    recordedQueryTexts,
    retainedCanonicalUrls: admitted.sources.map((source) => source.canonicalUrl),
    recordedDiscoveryRecords: admitted.discoveries.length,
    retainedSourceCandidates: input.retrievedSources.length,
    admittedSources: admitted.sources.length,
    excludedSourceCandidates: input.retrievedSources.length - admitted.sources.length,
    providerCallsAttempted: providerResult.receipt.callsAttempted,
    providerCallsSucceeded: providerResult.receipt.callsSucceeded,
    provider: providerResult.receipt.provider,
    model: providerResult.receipt.model,
    promptSha256: providerResult.receipt.promptSha256,
    boundaryConfigurationSha256: providerResult.receipt.boundaryConfigurationSha256,
    inputTokens: providerResult.receipt.inputTokens,
    outputTokens: providerResult.receipt.outputTokens,
    estimatedCostUsd: providerResult.receipt.costUsd,
    providerBehavior: providerResult.receipt.providerBehavior,
    providerStorage: providerResult.receipt.storage,
    providerToolCalls: providerResult.receipt.tools,
    providerNetworkEffects: providerResult.receipt.networkEffects,
    databaseWrites: 0,
    graphWrites: 0,
    persistenceWrites: 0,
    deployments: 0,
    publications: 0,
    customerActions: 0,
  };
  return deepFreezeOwnData({
    request,
    plan,
    discoveries: admitted.discoveries,
    admittedSources: admitted.sources,
    researchPolicyReceipt: admitted.policyReceipt,
    proposal: providerResult.proposal,
    effectReceipt: receipt,
  });
}
