/** Authored synthetic local demonstration data. Nothing in this module is a model recording. */
import { createHash } from "node:crypto";
import { admitAccountResearch } from "../../src/account-intelligence/admission.ts";
import { createAccountResearchPlan } from "../../src/account-intelligence/research-plan.ts";
import { snapshotAdmittedResearchPolicy } from "../../src/account-intelligence/research-policy.ts";
import { createAccountIntelligencePrompt, snapshotAccountIntelligenceProposal } from "../../src/account-intelligence/proposal.ts";
import { canonicalJson, type C3AccountContext, type FrozenC3AccountContext } from "../../src/c3/context.ts";
import { deepFreezeOwnData } from "../../src/authority/strict-json.ts";
import { makeC2FixtureInput, proposalFromModelPrompt } from "./c2-account-intelligence.ts";

export function syntheticWorkshopContext(account: "harbor" | "cedar" = "harbor", mode: "normal" | "conflict" | "sparse" = "normal"): FrozenC3AccountContext {
  const input = makeC2FixtureInput({ accountId: `acct-${account}`, accountName: account === "harbor" ? "Harbor Transit" : "Cedar Works",
    domain: `${account}.example.org`, requestNotes: ["Synthetic demonstration account. No real customer research."],
    declaredConflictIds: mode === "conflict" ? ["Synthetic conflict: the funding status differs between supplied reports; resolve before use."] : [] });
  const plan = createAccountResearchPlan(input.request);
  const policy = snapshotAdmittedResearchPolicy(input.researchPolicy);
  const admitted = admitAccountResearch(input.request, plan, policy, input.discoveries, input.retrievedSources);
  const proposal = snapshotAccountIntelligenceProposal(proposalFromModelPrompt(createAccountIntelligencePrompt(input.request, plan, admitted.sources)), input.request, admitted.sources);
  const ownerRaw = JSON.stringify({ decision: "Synthetic local demonstration only; no owner approval is represented." });
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  const sources = admitted.sources.map((source) => ({ ...source,
    fullBoundedCleanText: input.retrievedSources.find((item) => item.retrievalId === source.retrievalId)!.retrievedText,
    custody: policy.policy.sourceCustody.find((item) => item.custodyId === source.custodyId)!,
    taxonomyAuthorities: policy.policy.taxonomyAuthorities.filter((item) => source.taxonomyAuthorizationIds.includes(item.authorizationId)) }));
  const sparseStatement = { ...proposal.accountThesis, text: "No source-backed account orientation is available. Start by establishing audience priorities.", evidenceIds: [] };
  const context: C3AccountContext = {
    kind: "atliera.c3.account-context", schemaVersion: "2", account: input.request, priorRevision: null,
    temporalBoundary: { priorRevisionAvailable: false, legacyMeaningfullyChangedIsTemporalProof: false,
      allowedOutcomes: ["initial_dated_event_discovery", "no_material_change_established", "insufficient_context"] },
    entities: policy.policy.admittedEntities, relationships: policy.policy.admittedEntities.map((item) => ({ entityId: item.entityId, relationshipToAccount: item.relationshipToAccount })),
    discoveryLineage: mode === "sparse" ? [] : admitted.discoveries, admittedSources: mode === "sparse" ? [] : sources,
    proposal: mode === "sparse" ? { ...proposal, accountThesis: sparseStatement, establishedContext: [], meaningfullyChanged: [], whyChangeMayMatter: [],
      recommendedNextMove: { ...sparseStatement, text: "Establish priorities and obtain appropriate evidence before choosing a direction.", state: "recommendation" } } : proposal,
    declaredContradictions: mode === "conflict" ? input.retrievedSources[0]!.declaredConflictIds : [],
    materialGaps: mode === "sparse" ? ["No admitted sources are supplied. Stakeholders, developments, and priorities remain unestablished."] : proposal.materialGaps,
    rendererAnnotations: [], ownerDecisionSource: { sourceKind: "repository_owner_decision_record", rawJson: ownerRaw, rawSha256: digest(ownerRaw), record: JSON.parse(ownerRaw) },
    ownerCorrections: [], relevanceCandidates: [], custody: { policyReceipt: admitted.policyReceipt,
      boundedCleanTextMeaning: "full supplied bounded-clean-text projection; not original web/PDF completeness", localTestOnly: true, authorizesPersistence: false },
  };
  const serialized = canonicalJson(context);
  return { context: deepFreezeOwnData(context), canonicalJson: serialized, sha256: digest(serialized) };
}

export const syntheticMeetingRequest = { audience: "Operations lead", intendedOutcome: "Clarify priorities and agree a useful follow-up.", durationMinutes: 30 as const, meetingDate: "2026-09-14" };
export const syntheticCorrection = "Focus the close on confirming an owner for the follow-up.";

/** Hand-authored candidate for testing the real validator. Not an AI recording. */
export function syntheticMeetingCandidate(context: FrozenC3AccountContext, revised = false): string {
  const evidence = context.context.admittedSources[0]?.excerpts[0];
  const refs = evidence ? [evidence.evidenceId] : [];
  return JSON.stringify({ temporalOutcome: evidence ? "no_material_change_established" : "insufficient_context",
    objective: { text: "Clarify audience priorities and agree a useful follow-up.", supportCategory: "recommendation", evidenceRefs: [] },
    audienceThesis: evidence ? { text: evidence.exactExcerpt, supportCategory: "direct_support", evidenceRefs: refs } : { text: "Current priorities are not established.", supportCategory: "unknown", evidenceRefs: [] },
    opening: { text: "Confirm what matters to this audience before proposing a direction.", supportCategory: "recommendation", evidenceRefs: [] },
    questions: ["Which outcome matters most?", "What constraints should we understand?", "Who could help resolve the next open question?"].map((question) => ({ question, intendedLearning: "Confirm the audience’s perspective.", evidenceRefs: refs, supportCategory: "open_question" })),
    risksUnknowns: [{ text: "Current audience priorities and decision authority are not established.", supportCategory: "unknown", evidenceRefs: [] }],
    closeCriterion: { text: revised ? "Confirm who could own a useful follow-up before agreeing to continue." : "Agree whether a narrower follow-up would be useful.", supportCategory: "recommendation", evidenceRefs: [] },
    selectedEvidenceRefs: refs });
}
