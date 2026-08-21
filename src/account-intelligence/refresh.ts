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

export interface AccountIntelligenceRefreshInput {
  readonly request: unknown;
  readonly discoveries: readonly SearchDiscoveryRecord[];
  readonly retrievedSources: readonly RetrievedSourceInput[];
  readonly providerBoundary: AccountIntelligenceProviderBoundary;
}

/**
 * Bounded orchestration over explicit injected inputs. Search and retrieval are
 * performed by an authorized outer adapter; this function creates no network,
 * database, Graph, persistence, deployment, publication, or customer effects.
 */
export async function executeAccountIntelligenceRefresh(
  input: AccountIntelligenceRefreshInput,
): Promise<Readonly<ValidatedAccountIntelligence>> {
  const request = snapshotAccountResearchRequest(input.request);
  const plan = createAccountResearchPlan(request);
  const admitted = admitAccountResearch(request, plan, input.discoveries, input.retrievedSources);
  const exactSearchQueries = [...new Set(admitted.discoveries.map((item) => item.exactQuery))];
  if (exactSearchQueries.length === 0 || exactSearchQueries.length > plan.queryLimit) {
    throw new Error("account research query budget refused");
  }
  if (admitted.sources.length === 0 || admitted.sources.length > plan.admittedSourceLimit) {
    throw new Error("account research source budget refused");
  }
  const providerResult = await input.providerBoundary.propose(request, plan, admitted.sources);
  const receipt: AccountIntelligenceEffectReceipt = {
    kind: "atliera.account-intelligence-effect-receipt",
    schemaVersion: "1",
    accountId: request.accountId,
    exactSearchQueries,
    retrievedUrls: admitted.sources.map((source) => source.canonicalUrl),
    searchQueriesExecuted: exactSearchQueries.length,
    retrievalsExecuted: admitted.sources.length,
    admittedSources: admitted.sources.length,
    providerCallsExecuted: providerResult.receipt.callsSucceeded,
    provider: providerResult.receipt.provider,
    model: providerResult.receipt.model,
    inputTokens: providerResult.receipt.inputTokens,
    outputTokens: providerResult.receipt.outputTokens,
    estimatedCostUsd: providerResult.receipt.costUsd,
    privateNetworkEffects: 0,
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
    proposal: providerResult.proposal,
    effectReceipt: receipt,
  });
}
