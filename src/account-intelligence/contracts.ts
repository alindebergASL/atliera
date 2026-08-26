export const ACCOUNT_INTELLIGENCE_REQUEST_KIND = "atliera.account-intelligence-refresh-request" as const;
export const ACCOUNT_INTELLIGENCE_REQUEST_VERSION = "1" as const;
export const ACCOUNT_INTELLIGENCE_PROPOSAL_KIND = "atliera.account-intelligence-proposal" as const;
export const ACCOUNT_INTELLIGENCE_PROPOSAL_VERSION = "2" as const;

export const ACCOUNT_RESEARCH_TAXONOMY = Object.freeze([
  "identity_structure",
  "strategic_direction",
  "financial_context",
  "digital_modernization",
  "leadership_governance",
  "procurement",
  "partnerships_technology",
  "constraints",
  "recent_changes",
  "gaps_contradictions",
] as const);

export type AccountResearchTaxonomy = typeof ACCOUNT_RESEARCH_TAXONOMY[number];

export interface TrustedOfficialHost {
  readonly hostname: string;
  readonly allowSubdomains: boolean;
  readonly entityIds: readonly string[];
}

export interface AccountResearchRequest {
  readonly kind: typeof ACCOUNT_INTELLIGENCE_REQUEST_KIND;
  readonly schemaVersion: typeof ACCOUNT_INTELLIGENCE_REQUEST_VERSION;
  readonly accountId: string;
  readonly accountName: string;
  readonly canonicalPublicDomains: readonly string[];
  readonly knownAliases: readonly string[];
  readonly admittedContext: {
    readonly sector: string | null;
    readonly geography: string | null;
    readonly notes: readonly string[];
  };
  readonly requestedAt: string;
}

export interface AccountResearchQuery {
  readonly queryId: string;
  readonly taxonomy: AccountResearchTaxonomy;
  readonly query: string;
  readonly preferredSourceClasses: readonly ["official_primary", "reputable_secondary_if_needed"];
}

export interface AccountResearchPlan {
  readonly kind: "atliera.account-research-plan";
  readonly schemaVersion: "1";
  readonly accountId: string;
  readonly generatedFromRequestSha256: string;
  readonly queries: readonly AccountResearchQuery[];
  readonly queryLimit: 30;
  readonly admittedSourceLimit: 15;
  readonly priorities: typeof ACCOUNT_RESEARCH_TAXONOMY;
}

export interface SearchDiscoveryRecord {
  readonly queryId: string;
  readonly queryKind: "generated_taxonomy" | "operator_research_lead" | "owner_authorized_exact_url";
  readonly researchLeadReason: string | null;
  readonly exactQuery: string;
  readonly resultUrl: string | null;
  readonly resultTitle: string | null;
  readonly derivedRetrievalUrls: readonly string[];
  readonly discoveredAt: string;
  readonly snippetUsedAsEvidence: false;
}

export type AccountEntityKind =
  | "account"
  | "subsidiary"
  | "business_unit"
  | "governing_body"
  | "government"
  | "foundation"
  | "hospital"
  | "research_unit"
  | "other_related_entity";

export interface AccountEntityBoundary {
  readonly entityId: string;
  readonly name: string;
  readonly kind: AccountEntityKind;
  readonly relationshipToAccount: string;
}

export type AccountSourceClass = "official_primary" | "reputable_secondary";

export interface RetainedSourceCustody {
  readonly custodyId: string;
  readonly accountId: string;
  readonly retainedCorpusId: string;
  readonly canonicalUrl: string;
  readonly retrievedContentSha256: string;
  readonly sourceClass: AccountSourceClass;
  readonly title: string;
  readonly publisher: string;
  readonly primaryEntityId: string;
  readonly retrievedAt: string;
  readonly authorizedBy: string;
  readonly authorizedAt: string;
  readonly scope: "local_test_only";
  readonly authorizesPersistence: false;
}

export interface TaxonomyAdmissionAuthority {
  readonly authorizationId: string;
  readonly accountId: string;
  readonly custodyId: string;
  readonly canonicalUrl: string;
  readonly retrievedContentSha256: string;
  readonly exactExcerptSha256: string;
  readonly taxonomy: AccountResearchTaxonomy;
  readonly authorizedBy: string;
  readonly authorizedAt: string;
  readonly scope: "local_test_only";
  readonly authorizesPersistence: false;
}

export interface AdmittedResearchPolicy {
  readonly kind: "atliera.admitted-account-research-policy";
  readonly schemaVersion: "2";
  readonly policyId: string;
  readonly accountId: string;
  readonly primaryAccountEntity: AccountEntityBoundary;
  readonly admittedEntities: readonly AccountEntityBoundary[];
  readonly trustedOfficialHosts: readonly TrustedOfficialHost[];
  readonly sourceCustody: readonly RetainedSourceCustody[];
  readonly taxonomyAuthorities: readonly TaxonomyAdmissionAuthority[];
  readonly authorizedAt: string;
  readonly scope: "local_test_only";
  readonly authorizesPersistence: false;
  readonly authorizesPrivateSources: false;
}

export interface AdmittedResearchPolicyReceipt {
  readonly policyId: string;
  readonly accountId: string;
  readonly policySha256: string;
  readonly entityCatalogSha256: string;
  readonly sourceCustodySha256: string;
  readonly taxonomyAuthoritiesSha256: string;
  readonly authorizedAt: string;
  readonly scope: "local_test_only";
  readonly authorizesPersistence: false;
  readonly authorizesPrivateSources: false;
}

export interface RetrievedSourceInput {
  readonly retrievalId: string;
  readonly discoveredByQueryIds: readonly string[];
  readonly entity: AccountEntityBoundary;
  readonly relatedEntities: readonly AccountEntityBoundary[];
  readonly canonicalUrl: string;
  readonly title: string;
  readonly publisher: string;
  readonly sourceClass: AccountSourceClass;
  readonly publicationDate: string | null;
  readonly eventDate: string | null;
  readonly retrievedAt: string;
  readonly evidenceCurrentThrough: string | null;
  readonly retrievalContentKind: "bounded_clean_text_projection";
  readonly retrievedText: string;
  readonly candidateExcerpts: readonly string[];
  readonly taxonomyCoverage: readonly AccountResearchTaxonomy[];
  readonly taxonomyEvidence: readonly {
    readonly taxonomy: AccountResearchTaxonomy;
    readonly candidateExcerptIndexes: readonly number[];
  }[];
  readonly declaredConflictIds: readonly string[];
}

export interface AdmittedEvidenceExcerpt {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly entityId: string;
  readonly exactExcerpt: string;
  readonly exactExcerptSha256: string;
  readonly sourceCharStart: number;
  readonly sourceCharEnd: number;
}

export interface AdmittedAccountSource {
  readonly sourceId: string;
  readonly retrievalId: string;
  readonly custodyId: string;
  readonly researchPolicySha256: string;
  readonly taxonomyAuthorizationIds: readonly string[];
  readonly entity: AccountEntityBoundary;
  readonly relatedEntities: readonly AccountEntityBoundary[];
  readonly canonicalUrl: string;
  readonly title: string;
  readonly publisher: string;
  readonly sourceClass: AccountSourceClass;
  readonly publicationDate: string | null;
  readonly eventDate: string | null;
  readonly retrievedAt: string;
  readonly evidenceCurrentThrough: string | null;
  readonly retrievalContentKind: "bounded_clean_text_projection";
  readonly retrievedContentSha256: string;
  readonly retrievedByteSize: number;
  readonly untrustedInstructionsDetected: boolean;
  readonly taxonomyCoverage: readonly AccountResearchTaxonomy[];
  readonly taxonomyEvidenceBindings: readonly {
    readonly taxonomy: AccountResearchTaxonomy;
    readonly evidenceIds: readonly string[];
  }[];
  readonly declaredConflictIds: readonly string[];
  readonly discoveredByQueryIds: readonly string[];
  readonly excerpts: readonly AdmittedEvidenceExcerpt[];
}

export type IntelligenceStatementState =
  | "source-backed fact"
  | "evidence-linked proposed claim"
  | "evidence-informed interpretation"
  | "unresolved question"
  | "recommendation";

export type IntelligenceRiskFlag =
  | "entity_boundary"
  | "funding_status_ambiguity"
  | "authoritative_conflict"
  | "stale_evidence"
  | "secondary_support"
  | "unsupported_commercial_assumption"
  | "insufficient_evidence";

export interface IntelligenceStatement {
  readonly statementId: string;
  readonly state: IntelligenceStatementState;
  readonly text: string;
  readonly evidenceIds: readonly string[];
  readonly entityIds: readonly string[];
  readonly riskFlags: readonly IntelligenceRiskFlag[];
}

export interface ResearchCoverageItem {
  readonly taxonomy: AccountResearchTaxonomy;
  readonly sourceIds: readonly string[];
  readonly status: "partial" | "gap";
  readonly gap: string;
}

export interface AccountIntelligenceProposal {
  readonly kind: typeof ACCOUNT_INTELLIGENCE_PROPOSAL_KIND;
  readonly schemaVersion: typeof ACCOUNT_INTELLIGENCE_PROPOSAL_VERSION;
  readonly accountId: string;
  readonly accountThesis: IntelligenceStatement;
  readonly establishedContext: readonly IntelligenceStatement[];
  readonly meaningfullyChanged: readonly IntelligenceStatement[];
  readonly whyChangeMayMatter: readonly IntelligenceStatement[];
  readonly stillOpenQuestions: readonly IntelligenceStatement[];
  readonly recommendedNextMove: IntelligenceStatement;
  readonly sourceAndEntityBoundaries: readonly {
    readonly entityId: string;
    readonly boundary: string;
  }[];
  readonly riskConflictFlags: readonly {
    readonly flag: IntelligenceRiskFlag;
    readonly statementIds: readonly string[];
    readonly needsReview: boolean;
    readonly reason: string;
  }[];
  readonly researchCoverage: readonly ResearchCoverageItem[];
  readonly materialGaps: readonly string[];
  readonly reviewStatus: "proposed_unreviewed" | "needs_review";
}

export interface AccountIntelligenceEffectReceipt {
  readonly kind: "atliera.account-intelligence-effect-receipt";
  readonly schemaVersion: "2";
  readonly accountId: string;
  readonly recordedQueryTexts: readonly string[];
  readonly retainedCanonicalUrls: readonly string[];
  readonly recordedDiscoveryRecords: number;
  readonly retainedSourceCandidates: number;
  readonly admittedSources: number;
  readonly excludedSourceCandidates: number;
  readonly providerCallsAttempted: number;
  readonly providerCallsSucceeded: number;
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
  readonly estimatedCostUsd: number;
  readonly providerBehavior: "external_variable_response_validated";
  readonly providerStorage: "unestablished";
  readonly providerToolCalls: "unestablished";
  readonly providerNetworkEffects: "unestablished";
  readonly databaseWrites: 0;
  readonly graphWrites: 0;
  readonly persistenceWrites: 0;
  readonly deployments: 0;
  readonly publications: 0;
  readonly customerActions: 0;
}

export interface ValidatedAccountIntelligence {
  readonly request: AccountResearchRequest;
  readonly plan: AccountResearchPlan;
  readonly discoveries: readonly SearchDiscoveryRecord[];
  readonly admittedSources: readonly AdmittedAccountSource[];
  readonly researchPolicyReceipt: AdmittedResearchPolicyReceipt;
  readonly proposal: AccountIntelligenceProposal;
  readonly effectReceipt: AccountIntelligenceEffectReceipt;
}
