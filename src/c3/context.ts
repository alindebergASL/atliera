import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { admitAccountResearch } from "../account-intelligence/admission.ts";
import { deepFreezeOwnData } from "../authority/strict-json.ts";
import type {
  AccountEntityBoundary,
  AccountIntelligenceProposal,
  AccountResearchRequest,
  AdmittedAccountSource,
  AdmittedResearchPolicyReceipt,
  IntelligenceStatement,
  RetainedSourceCustody,
  SearchDiscoveryRecord,
  TaxonomyAdmissionAuthority,
} from "../account-intelligence/contracts.ts";
import { snapshotAccountIntelligenceProposal } from "../account-intelligence/proposal.ts";
import { createAccountResearchPlan, snapshotAccountResearchRequest } from "../account-intelligence/research-plan.ts";
import { snapshotAdmittedResearchPolicy } from "../account-intelligence/research-policy.ts";

export const C3_ACCOUNT_CONTEXT_KIND = "atliera.c3.account-context" as const;
export const C3_ACCOUNT_CONTEXT_VERSION = "2" as const;

export interface C3RetainedSource extends AdmittedAccountSource {
  readonly fullBoundedCleanText: string;
  readonly custody: RetainedSourceCustody;
  readonly taxonomyAuthorities: readonly TaxonomyAdmissionAuthority[];
}

export interface C3ContextAnnotation {
  readonly kind: "source_context_caveat" | "freshness_recheck";
  readonly sourceId: string;
  readonly evidenceIds: readonly string[];
  readonly text: string;
}

export interface C3OwnerCorrection {
  readonly kind: "content_priority" | "content_disposition" | "content_caveat";
  readonly text: string;
  readonly recordedState: "effective_owner_disposition";
  readonly authorizesApprovalOrPersistence: false;
  readonly derivedInterpretation: true;
  readonly sourceOwnerDecisionRawSha256: string;
}

export interface C3OwnerDecisionSource {
  readonly sourceKind: "repository_owner_decision_record";
  /** Exact repository file bytes. This is provenance, not a new owner act. */
  readonly rawJson: string;
  readonly rawSha256: string;
  readonly record: Readonly<Record<string, unknown>>;
}

export interface C3RelevanceCandidate {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly reasons: readonly string[];
}

export interface C3AccountContext {
  readonly kind: typeof C3_ACCOUNT_CONTEXT_KIND;
  readonly schemaVersion: typeof C3_ACCOUNT_CONTEXT_VERSION;
  readonly account: Pick<AccountResearchRequest, "accountId" | "accountName" | "canonicalPublicDomains" | "knownAliases" |
    "admittedContext" | "requestedAt">;
  readonly priorRevision: null;
  readonly temporalBoundary: {
    readonly priorRevisionAvailable: false;
    readonly legacyMeaningfullyChangedIsTemporalProof: false;
    readonly allowedOutcomes: readonly ["initial_dated_event_discovery", "no_material_change_established", "insufficient_context"];
  };
  readonly entities: readonly AccountEntityBoundary[];
  readonly relationships: readonly { readonly entityId: string; readonly relationshipToAccount: string }[];
  readonly discoveryLineage: readonly SearchDiscoveryRecord[];
  readonly admittedSources: readonly C3RetainedSource[];
  readonly proposal: AccountIntelligenceProposal;
  readonly declaredContradictions: readonly string[];
  readonly materialGaps: readonly string[];
  readonly rendererAnnotations: readonly C3ContextAnnotation[];
  readonly ownerDecisionSource: C3OwnerDecisionSource;
  readonly ownerCorrections: readonly C3OwnerCorrection[];
  readonly relevanceCandidates: readonly C3RelevanceCandidate[];
  readonly custody: {
    readonly policyReceipt: AdmittedResearchPolicyReceipt;
    readonly boundedCleanTextMeaning: "full supplied bounded-clean-text projection; not original web/PDF completeness";
    readonly localTestOnly: true;
    readonly authorizesPersistence: false;
  };
}

export interface FrozenC3AccountContext {
  readonly context: Readonly<C3AccountContext>;
  readonly canonicalJson: string;
  readonly sha256: string;
}

interface LoadContextOptions {
  readonly broadInputPath: string;
  readonly proposalPath: string;
  readonly ownerDecisionPath: string;
  readonly accountId: string;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") throw new Error("canonical JSON refuses non-JSON values");
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

function findAccount(root: unknown, accountId: string): Record<string, unknown> {
  const accounts = record(root, "broad input").accounts;
  if (!Array.isArray(accounts)) throw new Error("broad input accounts must be an array");
  const found = accounts.find((value) => record(value, "account").request !== undefined &&
    record(record(value, "account").request, "request").accountId === accountId);
  if (found === undefined) throw new Error(`account ${accountId} not found in broad input`);
  return record(found, "selected account");
}

function retainedTextByRetrievalId(account: Record<string, unknown>): Map<string, string> {
  if (!Array.isArray(account.retrievedSources)) throw new Error("retrievedSources must be an array");
  return new Map(account.retrievedSources.map((value, index) => {
    const source = record(value, `retrievedSources[${String(index)}]`);
    return [stringValue(source.retrievalId, "retrievalId"), stringValue(source.retrievedText, "retrievedText")];
  }));
}

function verifyAndJoinSources(
  admitted: readonly AdmittedAccountSource[],
  account: Record<string, unknown>,
  policySources: readonly RetainedSourceCustody[],
  authorities: readonly TaxonomyAdmissionAuthority[],
): C3RetainedSource[] {
  const textById = retainedTextByRetrievalId(account);
  return admitted.map((source) => {
    const text = textById.get(source.retrievalId);
    const custody = policySources.find((item) => item.custodyId === source.custodyId);
    if (text === undefined || custody === undefined || sha256(text) !== source.retrievedContentSha256 ||
        Buffer.byteLength(text, "utf8") !== source.retrievedByteSize) {
      throw new Error(`retained clean-text custody mismatch for ${source.retrievalId}`);
    }
    for (const excerpt of source.excerpts) {
      if (text.slice(excerpt.sourceCharStart, excerpt.sourceCharEnd) !== excerpt.exactExcerpt ||
          sha256(excerpt.exactExcerpt) !== excerpt.exactExcerptSha256) {
        throw new Error(`retained excerpt custody mismatch for ${excerpt.evidenceId}`);
      }
    }
    return {
      ...source,
      fullBoundedCleanText: text,
      custody,
      taxonomyAuthorities: authorities.filter((item) => source.taxonomyAuthorizationIds.includes(item.authorizationId)),
    };
  });
}

function annotations(sources: readonly C3RetainedSource[]): C3ContextAnnotation[] {
  const result: C3ContextAnnotation[] = [];
  for (const source of sources) {
    if (source.publicationDate === null && source.eventDate === null && source.evidenceCurrentThrough === null) {
      result.push({
        kind: "freshness_recheck",
        sourceId: source.sourceId,
        evidenceIds: source.excerpts.map((item) => item.evidenceId),
        text: "Publication, event, and evidence-current-through dates are not established; recheck before meeting use.",
      });
    }
    const tableExcerpt = source.excerpts.find((item) => /^Responsible AI\s+\$[\d,.]+\s+\$[\d,.]+/u.test(item.exactExcerpt));
    if (tableExcerpt !== undefined) {
      const tableHeader = source.excerpts.find((item) => item.exactExcerpt ===
        "REINVESTMENT AREA APPROVED 3-YR CURRENT 3-YR NET CHANGE");
      result.push({
        kind: "source_context_caveat",
        sourceId: source.sourceId,
        evidenceIds: tableHeader === undefined ? [tableExcerpt.evidenceId] : [tableHeader.evidenceId, tableExcerpt.evidenceId],
        text: tableHeader === undefined
          ? "Read this funding row in its full retained source context; the row alone does not establish the column meanings or available purchasing funds."
          : `The same retained source includes the header “${tableHeader.exactExcerpt}”. Read this funding row alongside that header; three-year plan figures do not establish remaining purchasing funds, allowable vendor spend, or buying intent.`,
      });
    }
  }
  return result;
}

function ownerCorrections(accountId: string, decisionValue: unknown, ownerDecisionRawSha256: string): C3OwnerCorrection[] {
  const decision = stringValue(record(decisionValue, "owner decision").decision, "owner decision.decision");
  const shared = { recordedState: "effective_owner_disposition" as const, authorizesApprovalOrPersistence: false as const,
    derivedInterpretation: true as const, sourceOwnerDecisionRawSha256: ownerDecisionRawSha256 };
  if (accountId === "acc_university_of_utah") {
    if (!decision.includes("Utah: Continue to C3")) throw new Error("Utah owner disposition is not present");
    return [
      { kind: "content_disposition", text: "Derived interpretation: Utah may continue to C3; this does not approve a C3 draft or durable account truth.", ...shared },
      { kind: "content_priority", text: "Derived correction interpretation: elevate Redtail and UHAIV when relevant; treat their undated support as recheck-first.", ...shared },
      { kind: "content_caveat", text: "Derived correction interpretation: do not infer purchasing budget or vendor intent from funding and investment statements.", ...shared },
    ];
  }
  if (accountId === "acc_fedex_corp") {
    if (!decision.includes("FedEx: Revise before C3")) throw new Error("FedEx owner disposition is not present");
    const exactFedEx = decision.slice(decision.indexOf("FedEx: Revise before C3"));
    return [{ kind: "content_disposition", text: `Derived gate interpretation (verbatim owner text is retained separately): ${exactFedEx} This account context is not enabled for the C3 journey.`, ...shared }];
  }
  return [];
}

function allStatements(proposal: AccountIntelligenceProposal): readonly IntelligenceStatement[] {
  return [proposal.accountThesis, ...proposal.establishedContext, ...proposal.meaningfullyChanged,
    ...proposal.whyChangeMayMatter, ...proposal.stillOpenQuestions, proposal.recommendedNextMove];
}

function relevanceCandidates(sources: readonly C3RetainedSource[], proposal: AccountIntelligenceProposal,
  corrections: readonly C3OwnerCorrection[]): C3RelevanceCandidate[] {
  const proposalEvidence = new Set(allStatements(proposal).flatMap((item) => item.evidenceIds));
  const priorities = corrections.filter((item) => item.kind === "content_priority").map((item) => item.text.toLowerCase());
  return sources.flatMap((source) => source.excerpts.map((excerpt) => {
    const reasons: string[] = [];
    const combined = `${source.title} ${excerpt.exactExcerpt}`.toLowerCase();
    if (priorities.some((priority) => /redtail|uhaiv/u.test(priority) && /redtail|uhaiv|ai vault/u.test(combined))) {
      reasons.push("matches a recorded owner content priority");
    }
    const taxonomy = source.taxonomyEvidenceBindings.filter((binding) => binding.evidenceIds.includes(excerpt.evidenceId))
      .map((binding) => binding.taxonomy);
    if (taxonomy.some((item) => ["recent_changes", "digital_modernization", "partnerships_technology", "constraints"].includes(item))) {
      reasons.push(`covers decision-relevant taxonomy: ${taxonomy.join(", ")}`);
    }
    if (proposalEvidence.has(excerpt.evidenceId)) reasons.push("selected in the validated C2 proposal");
    if (source.eventDate !== null || source.publicationDate !== null) reasons.push("has an explicit event or publication date");
    return { evidenceId: excerpt.evidenceId, sourceId: source.sourceId, reasons };
  })).filter((item) => item.reasons.length > 0)
    .sort((a, b) => b.reasons.length - a.reasons.length || a.evidenceId.localeCompare(b.evidenceId)).slice(0, 10);
}

export async function loadC3AccountContext(options: LoadContextOptions): Promise<FrozenC3AccountContext> {
  const [broadRaw, proposalRaw, ownerRaw] = await Promise.all([
    readFile(options.broadInputPath, "utf8"), readFile(options.proposalPath, "utf8"), readFile(options.ownerDecisionPath, "utf8"),
  ]);
  const accountInput = findAccount(JSON.parse(broadRaw), options.accountId);
  const request = snapshotAccountResearchRequest(accountInput.request);
  const plan = createAccountResearchPlan(request);
  const policy = snapshotAdmittedResearchPolicy(accountInput.researchPolicy);
  const admitted = admitAccountResearch(request, plan, policy, accountInput.discoveries, accountInput.retrievedSources);
  const proposal = snapshotAccountIntelligenceProposal(JSON.parse(proposalRaw), request, admitted.sources);
  const sources = verifyAndJoinSources(admitted.sources, accountInput, policy.policy.sourceCustody, policy.policy.taxonomyAuthorities);
  const ownerRecord = record(JSON.parse(ownerRaw), "owner decision");
  const ownerDecisionRawSha256 = sha256(ownerRaw);
  const corrections = ownerCorrections(options.accountId, ownerRecord, ownerDecisionRawSha256);
  const entities = policy.policy.admittedEntities;
  const context: C3AccountContext = {
    kind: C3_ACCOUNT_CONTEXT_KIND,
    schemaVersion: C3_ACCOUNT_CONTEXT_VERSION,
    account: { accountId: request.accountId, accountName: request.accountName, canonicalPublicDomains: request.canonicalPublicDomains,
      knownAliases: request.knownAliases, admittedContext: request.admittedContext, requestedAt: request.requestedAt },
    priorRevision: null,
    temporalBoundary: { priorRevisionAvailable: false, legacyMeaningfullyChangedIsTemporalProof: false,
      allowedOutcomes: ["initial_dated_event_discovery", "no_material_change_established", "insufficient_context"] },
    entities,
    relationships: entities.map((entity) => ({ entityId: entity.entityId, relationshipToAccount: entity.relationshipToAccount })),
    discoveryLineage: admitted.discoveries,
    admittedSources: sources,
    proposal,
    declaredContradictions: [...new Set([
      ...sources.flatMap((source) => source.declaredConflictIds),
      ...proposal.riskConflictFlags.filter((flag) => flag.flag === "authoritative_conflict").map((flag) => flag.reason),
    ])],
    materialGaps: proposal.materialGaps,
    rendererAnnotations: annotations(sources),
    ownerDecisionSource: { sourceKind: "repository_owner_decision_record", rawJson: ownerRaw,
      rawSha256: ownerDecisionRawSha256, record: ownerRecord },
    ownerCorrections: corrections,
    relevanceCandidates: relevanceCandidates(sources, proposal, corrections),
    custody: { policyReceipt: admitted.policyReceipt,
      boundedCleanTextMeaning: "full supplied bounded-clean-text projection; not original web/PDF completeness",
      localTestOnly: true, authorizesPersistence: false },
  };
  const serialized = canonicalJson(context);
  return Object.freeze({ context: deepFreezeOwnData(context), canonicalJson: serialized, sha256: sha256(serialized) });
}
