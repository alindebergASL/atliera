import type { ModelProvider, ModelProviderRequest, ModelProviderResponse } from "../../src/model/provider.ts";
import {
  ACCOUNT_RESEARCH_TAXONOMY,
  type AccountIntelligenceProposal,
  type AccountResearchRequest,
  type RetrievedSourceInput,
  type SearchDiscoveryRecord,
} from "../../src/account-intelligence/contracts.ts";
import { createAccountResearchPlan } from "../../src/account-intelligence/research-plan.ts";

export interface C2FixtureInput {
  readonly request: AccountResearchRequest;
  readonly researchPolicy: unknown;
  readonly discoveries: SearchDiscoveryRecord[];
  readonly retrievedSources: RetrievedSourceInput[];
}

export function makeC2FixtureInput(options: {
  accountId?: string;
  accountName?: string;
  domain?: string;
  sourceClass?: "official_primary" | "reputable_secondary";
  retrievedText?: string;
  candidateExcerpts?: string[];
  evidenceCurrentThrough?: string | null;
  declaredConflictIds?: string[];
} = {}): C2FixtureInput {
  const accountId = options.accountId ?? "acct-harbor-transit";
  const accountName = options.accountName ?? "Harbor Transit";
  const domain = options.domain ?? "harbor-transit.example.org";
  const request: AccountResearchRequest = {
    kind: "atliera.account-intelligence-refresh-request",
    schemaVersion: "1",
    accountId,
    accountName,
    canonicalPublicDomains: [domain],
    knownAliases: [],
    admittedContext: {
      sector: "transportation",
      geography: "North America",
      notes: [],
    },
    requestedAt: "2026-08-21T12:00:00.000Z",
  };
  const plan = createAccountResearchPlan(request);
  const established = `${accountName} publishes its mission and operating structure in an official public record.`;
  const changed = `${accountName} proposed up to $2 million of restricted matching funding over three years, subject to approval.`;
  const retrievedText = options.retrievedText ?? `${established}\n\n${changed}`;
  const candidateExcerpts = options.candidateExcerpts ?? [established, changed];
  const canonicalUrl = `https://${domain}/official-record`;
  return {
    request,
    researchPolicy: {
      kind: "atliera.admitted-account-research-policy", schemaVersion: "1",
      policyId: `policy-${accountId}`, accountId,
      primaryAccountEntity: { entityId: accountId, name: accountName, kind: "account", relationshipToAccount: "The account itself." },
      trustedOfficialHosts: [{ hostname: domain, allowSubdomains: false, entityIds: [accountId] }],
      authorizedAt: "2026-08-21T11:59:00.000Z", scope: "local_test_only",
      authorizesPersistence: false, authorizesPrivateSources: false,
    },
    discoveries: [{
      queryId: plan.queries[0]!.queryId,
      queryKind: "generated_taxonomy",
      researchLeadReason: null,
      exactQuery: plan.queries[0]!.query,
      resultUrl: canonicalUrl,
      resultTitle: `${accountName} official record`,
      derivedRetrievalUrls: [],
      discoveredAt: "2026-08-21T12:01:00.000Z",
      snippetUsedAsEvidence: false,
    }],
    retrievedSources: [{
      retrievalId: `retrieval-${accountId}`,
      discoveredByQueryIds: [plan.queries[0]!.queryId],
      entity: { entityId: accountId, name: accountName, kind: "account", relationshipToAccount: "The account itself." },
      relatedEntities: [],
      canonicalUrl,
      title: `${accountName} official record`,
      publisher: accountName,
      sourceClass: options.sourceClass ?? "official_primary",
      publicationDate: "2026-07-01",
      eventDate: "2026-07-01",
      retrievedAt: "2026-08-21T12:02:00.000Z",
      evidenceCurrentThrough: options.evidenceCurrentThrough === undefined ? "2026-08-20" : options.evidenceCurrentThrough,
      retrievalContentKind: "bounded_clean_text_projection",
      retrievedText,
      candidateExcerpts,
      taxonomyCoverage: ACCOUNT_RESEARCH_TAXONOMY,
      taxonomyEvidence: ACCOUNT_RESEARCH_TAXONOMY.map((taxonomy) => ({ taxonomy, candidateExcerptIndexes: [0, 1] })),
      declaredConflictIds: options.declaredConflictIds ?? [],
    }],
  };
}

export function proposalFromModelPrompt(prompt: string, mutate?: (proposal: AccountIntelligenceProposal) => void): AccountIntelligenceProposal {
  const parsed = JSON.parse(prompt) as {
    request: AccountResearchRequest;
    sourceData: Array<{
      sourceId: string;
      entity: { entityId: string; name: string };
      excerpts: Array<{ evidenceId: string; exactExcerpt: string }>;
    }>;
  };
  const source = parsed.sourceData[0]!;
  const establishedEvidence = source.excerpts[0]!;
  const changedEvidence = source.excerpts[1] ?? establishedEvidence;
  const proposal: AccountIntelligenceProposal = {
    kind: "atliera.account-intelligence-proposal",
    schemaVersion: "1",
    accountId: parsed.request.accountId,
    accountThesis: {
      statementId: "thesis-01",
      state: "evidence-informed interpretation",
      text: `${parsed.request.accountName} has an established operating context and a qualified change worth understanding before any solution positioning.`,
      evidenceIds: [establishedEvidence.evidenceId, changedEvidence.evidenceId],
      entityIds: [source.entity.entityId],
      riskFlags: [],
    },
    establishedContext: [{
      statementId: "established-01",
      state: "source-backed fact",
      text: establishedEvidence.exactExcerpt,
      evidenceIds: [establishedEvidence.evidenceId],
      entityIds: [source.entity.entityId],
      riskFlags: [],
    }],
    meaningfullyChanged: [{
      statementId: "changed-01",
      state: "source-backed fact",
      text: changedEvidence.exactExcerpt,
      evidenceIds: [changedEvidence.evidenceId],
      entityIds: [source.entity.entityId],
      riskFlags: ["funding_status_ambiguity"],
    }],
    whyChangeMayMatter: [{
      statementId: "meaning-01",
      state: "evidence-informed interpretation",
      text: "The qualified funding language may signal an emerging decision frame, but it does not establish execution or purchasing intent.",
      evidenceIds: [changedEvidence.evidenceId],
      entityIds: [source.entity.entityId],
      riskFlags: [],
    }],
    stillOpenQuestions: [{
      statementId: "open-01",
      state: "unresolved question",
      text: "What is the funding availability, remaining amount, procurement status, eligible uses, decision authority or controlling entity, and vendor intent or preference?",
      evidenceIds: [],
      entityIds: [source.entity.entityId],
      riskFlags: [],
    }],
    recommendedNextMove: {
      statementId: "next-01",
      state: "recommendation",
      text: "Verify the decision frame and broader operating priorities before positioning any solution.",
      evidenceIds: [changedEvidence.evidenceId],
      entityIds: [source.entity.entityId],
      riskFlags: [],
    },
    sourceAndEntityBoundaries: [{ entityId: source.entity.entityId, boundary: `${source.entity.name} is treated as the account entity represented by this source.` }],
    riskConflictFlags: [{
      flag: "funding_status_ambiguity",
      statementIds: ["changed-01"],
      needsReview: true,
      reason: "The source describes proposed, bounded, multi-year, restricted, matching funding subject to approval; availability and execution are not established.",
    }],
    researchCoverage: ACCOUNT_RESEARCH_TAXONOMY.map((taxonomy) => ({ taxonomy, sourceIds: [source.sourceId], status: "partial" as const, gap: "Only one official record was admitted in this focused fixture." })),
    materialGaps: ["Approval, execution, procurement, and decision-owner status remain unestablished."],
    reviewStatus: "needs_review",
  };
  mutate?.(proposal);
  return proposal;
}

export class FixtureAccountIntelligenceProvider implements ModelProvider {
  readonly name: string;
  readonly #mutate: ((proposal: AccountIntelligenceProposal) => void) | undefined;
  readonly #outputTokens: number;
  calls = 0;

  constructor(options: { name?: string; mutate?: (proposal: AccountIntelligenceProposal) => void; outputTokens?: number } = {}) {
    this.name = options.name ?? "fixture-account-intelligence-provider";
    this.#mutate = options.mutate;
    this.#outputTokens = options.outputTokens ?? 300;
  }

  async generate(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    this.calls += 1;
    const proposal = proposalFromModelPrompt(request.prompt, this.#mutate);
    return {
      provider: this.name,
      model: request.model,
      idempotencyKey: request.idempotencyKey,
      output: { excerpts: [], claims: [], account_objects: [proposal] as never[] },
      usage: { inputTokens: 500, outputTokens: this.#outputTokens, totalTokens: 500 + this.#outputTokens },
      cost: { currency: "USD", amount: 0 },
    };
  }
}
