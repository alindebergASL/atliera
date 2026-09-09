import { createHash } from "node:crypto";
import * as originalContract from "./generation-contract-v2.ts";
import * as v3Contract from "./generation-contract-v3.ts";
import * as v4Contract from "./generation-contract-v4.ts";
import { assertC3ClaimSupport, C3_CLAIM_CONTRACT_INSTRUCTIONS } from "./generation-claims-v5.ts";

import { deepFreezeOwnData } from "../authority/strict-json.ts";
import { canonicalJson } from "./context.ts";
import { assertC3GenerationContext, type FrozenC3ViewContext as FrozenC3AccountContext } from "./view-context.ts";

export const C3_MODEL_REQUEST_KIND = "atliera.c3.meeting-draft-model-request" as const;
export const C3_MODEL_REQUEST_VERSION = "2" as const;

/** Missing markers identify the original contract, never the runtime/provider mode. */
export type C3GenerationContractVersion = "2" | "3" | "4" | "5";
export const CURRENT_C3_GENERATION_CONTRACT_VERSION = "5" as const;
export function c3GenerationContractVersion(value: { readonly generationContractVersion?: C3GenerationContractVersion }): C3GenerationContractVersion {
  if (!Object.hasOwn(value, "generationContractVersion")) return "2";
  if (value.generationContractVersion !== "2" && value.generationContractVersion !== "3" && value.generationContractVersion !== "4" && value.generationContractVersion !== "5") {
    throw new Error("unsupported generation contract version");
  }
  return value.generationContractVersion;
}

export type C3TemporalOutcome = "initial_dated_event_discovery" | "change_against_prior_revision" |
  "no_material_change_established" | "insufficient_context";
export type C3SupportCategory = "direct_support" | "cautious_inference" | "recommendation" | "open_question" | "unknown";

export interface C3MeetingRequest {
  readonly audience: string;
  readonly intendedOutcome: string;
  readonly durationMinutes: 15 | 30 | 45 | 60;
  readonly meetingDate: string;
}

export interface C3MeetingFormState {
  readonly audience: string;
  readonly intendedOutcome: string;
  readonly durationMinutes: 15 | 30 | 45 | 60;
  readonly meetingDate: string;
}

export interface C3SupportedText {
  readonly text: string;
  readonly evidenceRefs: readonly string[];
  readonly supportCategory: C3SupportCategory;
}

export interface C3DraftQuestion {
  readonly question: string;
  readonly intendedLearning: string;
  readonly evidenceRefs: readonly string[];
  readonly supportCategory: "open_question";
}

export interface C3MeetingDraftCandidate {
  readonly temporalOutcome: C3TemporalOutcome;
  readonly objective: C3SupportedText;
  readonly audienceThesis: C3SupportedText;
  readonly opening: C3SupportedText;
  readonly questions: readonly C3DraftQuestion[];
  readonly risksUnknowns: readonly C3SupportedText[];
  readonly closeCriterion: C3SupportedText;
  readonly selectedEvidenceRefs: readonly string[];
}

export interface C3DraftWarning {
  readonly code: "known_contradiction" | "source_date_unknown" | "evidence_stale_for_meeting" |
    "task_date_after_context" | "related_context_only";
  readonly message: string;
  readonly evidenceRefs: readonly string[];
}

export interface C3ProposedDraft extends C3MeetingDraftCandidate {
  readonly status: "proposed_unreviewed";
  readonly durablySaved: false;
  readonly warnings: readonly C3DraftWarning[];
}

export interface C3ModelRequest {
  readonly generationContractVersion?: C3GenerationContractVersion;
  readonly kind: typeof C3_MODEL_REQUEST_KIND;
  readonly schemaVersion: typeof C3_MODEL_REQUEST_VERSION;
  readonly contextSha256: string;
  readonly meetingRequestSha256: string;
  readonly meetingRequest: C3MeetingRequest;
  readonly revision: C3RevisionContext | null;
  readonly revisionSha256: string | null;
  readonly prompt: string;
}

export interface C3RevisionContext {
  readonly revisionNumber: number;
  readonly correctionNote: string;
  readonly priorRecordId: string;
  readonly priorModelRequestSha256: string;
  readonly priorRawResponse: string;
  readonly priorRawResponseSha256: string;
  readonly priorOutcome: "succeeded" | "refused";
  readonly priorDraft?: C3ProposedDraft;
  readonly priorRefusal?: { readonly code: "invalid_model_candidate"; readonly message: string };
  readonly changesAccountTruth: false;
  readonly impliesApprovalOrPersistence: false;
}

export interface C3GenerationRecord {
  readonly generationContractVersion?: C3GenerationContractVersion;
  readonly kind: "atliera.c3.generation-record";
  readonly schemaVersion: "2";
  readonly recordId: string;
  readonly contextSha256: string;
  readonly meetingRequest: C3MeetingRequest;
  readonly meetingRequestSha256: string;
  readonly revision: C3RevisionContext | null;
  readonly revisionSha256: string | null;
  readonly modelRequestSha256: string;
  readonly rawResponse: string;
  readonly rawResponseSha256: string;
  readonly outcome: "succeeded" | "refused";
  readonly refusal?: { readonly code: "invalid_model_candidate"; readonly message: string };
  readonly draft?: C3ProposedDraft;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${path} has unexpected or missing fields`);
  }
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, max = 1_200): string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 3 || value.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw new Error(`${path} must be bounded safe text`);
  return value;
}

function array(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${path} has invalid length`);
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${path} is invalid`);
  return value as T;
}

function date(value: unknown, path: string): string {
  const result = text(value, path, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(result) || new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result) {
    throw new Error(`${path} must be an explicit calendar date`);
  }
  return result;
}

export function snapshotMeetingRequest(value: unknown): C3MeetingRequest {
  const root = object(value, "meetingRequest");
  exactKeys(root, ["audience", "intendedOutcome", "durationMinutes", "meetingDate"], "meetingRequest");
  const duration = root.durationMinutes;
  if (typeof duration !== "number" || ![15, 30, 45, 60].includes(duration)) throw new Error("durationMinutes is invalid");
  return Object.freeze({
    audience: text(root.audience, "meetingRequest.audience", 160),
    intendedOutcome: text(root.intendedOutcome, "meetingRequest.intendedOutcome", 500),
    durationMinutes: duration as C3MeetingRequest["durationMinutes"],
    meetingDate: date(root.meetingDate, "meetingRequest.meetingDate"),
  });
}

/** Safe session form bytes may be incomplete; only snapshotMeetingRequest authorizes generation. */
export function snapshotMeetingFormState(value: unknown): C3MeetingFormState {
  const root = object(value, "meetingForm");
  exactKeys(root, ["audience", "intendedOutcome", "durationMinutes", "meetingDate"], "meetingForm");
  const bounded = (input: unknown, path: string, max: number): string => {
    if (typeof input !== "string" || input.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input)) {
      throw new Error(`${path} must be bounded form text`);
    }
    return input;
  };
  const duration = root.durationMinutes;
  if (typeof duration !== "number" || ![15, 30, 45, 60].includes(duration)) throw new Error("meetingForm.durationMinutes is invalid");
  return Object.freeze({ audience: bounded(root.audience, "meetingForm.audience", 160),
    intendedOutcome: bounded(root.intendedOutcome, "meetingForm.intendedOutcome", 500),
    durationMinutes: duration as C3MeetingFormState["durationMinutes"],
    meetingDate: bounded(root.meetingDate, "meetingForm.meetingDate", 10) });
}

export function createC3RevisionContext(record: C3GenerationRecord, correctionNoteInput: unknown,
  revisionNumber: number): C3RevisionContext {
  const correctionNote = text(correctionNoteInput, "correctionNote", 1_000);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1 || revisionNumber > 20) throw new Error("revision number refused");
  const revision: C3RevisionContext = {
    revisionNumber,
    correctionNote,
    priorRecordId: record.recordId,
    priorModelRequestSha256: record.modelRequestSha256,
    priorRawResponse: record.rawResponse,
    priorRawResponseSha256: record.rawResponseSha256,
    priorOutcome: record.outcome,
    ...(record.draft === undefined ? {} : { priorDraft: record.draft }),
    ...(record.refusal === undefined ? {} : { priorRefusal: record.refusal }),
    changesAccountTruth: false,
    impliesApprovalOrPersistence: false,
  };
  return deepFreezeOwnData(revision);
}

function audiencePriority(audience: string): string {
  if (/\b(?:ciso|security|risk)\b/iu.test(audience)) {
    return "Use the CISO or security audience as a secondary framing lens after outcome and evidence ranking. Emphasize security ownership, controls, risk boundaries, evidence freshness, and decision-relevant unknowns only where they help the stated outcome; the title alone does not establish a security problem or required follow-up.";
  }
  if (/\b(?:cio|engineering|technology|platform|architect)\b/iu.test(audience)) {
    return "Use the CIO or engineering audience as a secondary framing lens after outcome and evidence ranking. Operating model, architecture, integration, sequencing, and technical learning may be relevant, but the title alone does not make any of them the priority, binding constraint, or required follow-up.";
  }
  return "Use the named audience as a secondary framing lens after outcome and evidence ranking. Adapt language and question ordering without letting the title establish a priority, constraint, or follow-up, and without changing source facts.";
}

export function createC3ModelRequest(context: FrozenC3AccountContext, requestInput: unknown,
  revision: C3RevisionContext | null = null,
  generationContractVersion: C3GenerationContractVersion = CURRENT_C3_GENERATION_CONTRACT_VERSION): C3ModelRequest {
  c3GenerationContractVersion({ generationContractVersion });
  if (generationContractVersion === "2") return deepFreezeOwnData({
    ...originalContract.createC3ModelRequest(context, requestInput, revision), generationContractVersion });
  if (generationContractVersion === "3") return v3Contract.createC3ModelRequest(context, requestInput, revision, "3");
  if (generationContractVersion === "4") return v4Contract.createC3ModelRequest(context, requestInput, revision, "4");
  assertC3GenerationContext(context);
  const meetingRequest = snapshotMeetingRequest(requestInput);
  const meetingRequestSha256 = hash(canonicalJson(meetingRequest));
  const revisionSha256 = revision === null ? null : hash(canonicalJson(revision));
  const schema = {
    temporalOutcome: "initial_dated_event_discovery | change_against_prior_revision | no_material_change_established | insufficient_context",
    objective: { text: "string", evidenceRefs: ["evidenceId"], supportCategory: "recommendation | unknown" },
    audienceThesis: { text: "string", evidenceRefs: ["evidenceId"], supportCategory: "direct_support | cautious_inference | unknown" },
    opening: { text: "string", evidenceRefs: ["evidenceId"], supportCategory: "direct_support | cautious_inference | recommendation" },
    questions: [{ question: "string ending ?", intendedLearning: "string", evidenceRefs: ["related evidenceId"], supportCategory: "open_question" }],
    risksUnknowns: [{ text: "string", evidenceRefs: ["evidenceId"], supportCategory: "direct_support | cautious_inference | unknown" }],
    closeCriterion: { text: "string", evidenceRefs: ["evidenceId"], supportCategory: "recommendation | unknown" },
    selectedEvidenceRefs: ["evidenceId"],
  };
  const prompt = [
    "Rank the draft outcome-first: intended outcome, owner priorities, strongest relevant evidence/roles, then audience lens; never narrow by title alone.",
    "ownerCorrections content_priority is a meaningful selection directive; use relevanceCandidates reasons, not as conclusions. Unless the specific meeting request and admitted evidence provide an evidenced reason otherwise, it must visibly affect selectedEvidenceRefs and thesis, opening or main questions, not only risksUnknowns. Keep content_caveat as limits.",
    "For 15 minutes: exactly three MAIN must-ask questions, ordered by current outcome; its owner/binding constraint; whether a next step helps and what it accomplishes. Avoid stock wording: at least one MAIN question must earn its wording from a selected evidence anchor to ask whether/how it matters to the chosen outcome. It must not presume that anchor is today's priority. insufficient_context may stay generic. Longer meetings: 3-7 ordered questions.",
    "Include one or two—and no more—unmistakably optional follow-up probes for 15 minutes: opening/intendedLearning, one short sentence beginning exactly 'Optional probe:', conditional on a relevant answer. An optional probe is not a fourth MAIN question, mandatory discovery or menu.",
    "Ground thesis and natural spoken opening in one or two concrete evidence anchors or known reported roles. The opening limit is not a cap on useful material across the brief: retain distinct material anchors (plans, resourcing lead time, enabling scope, named boundaries) in main questions/probes/risks. There is no evidence-count quota and no license for a broad source-summary dump.",
    "Credit and source-attribute roles already reported by the evidence; ask only if they still apply and which boundary matters now. Keep initiative, operating-unit, and institution-wide boundaries distinct. Staffing, data, infrastructure, architecture, security and governance are possible enabling constraints, not assumed dependencies. Ground probes conditionally; preserve flexibility for a CIO or engineering audience to name a different priority.",
    "Use plain seller-facing prose (sources, priorities, what to confirm), no governance/session/approval explanations or instruction jargon. Unknowns concern account/evidence, not app states. Bridge quotes to cautious hypotheses/invitations. Never imply unsupported current status, a pilot, vendor activity, an incident, budget availability, or a purchase.",
    "Preserve facts, entities, owner corrections, source dates, renderer annotations, contradictions, material gaps and consequential warnings. risksUnknowns: consequential source/date/entity/funding limits tied to evidence/learning; avoid repetition. closeCriterion must allow a useful next step or no follow-up is warranted. Do not require a technical dependency, follow-up owner, format, or date unless established useful in conversation.",
    "Return one JSON object matching OUTPUT SCHEMA, no markdown/extra fields/post-receipt repair. Cite only supplied eligible IDs, each once in selectedEvidenceRefs. Questions/intendedLearning use open_question. Procurement, buying intent, urgency and vendor preference also require whole-field direct_support.",
    C3_CLAIM_CONTRACT_INSTRUCTIONS.replace("GENERATION CONTRACT 4", "GENERATION CONTRACT 5"),
    "EMISSION FORMS: Every claim must remain semantically faithful to cited sources; adapt examples only where facts/relevance are supported.",
    "Source report: 'The source describes ...' or 'The sources describe ...'; supported institution names, roles, plans, technical detail and scope follow the lead with matching evidenceRefs, never prefix it. Do not extend roles to current ownership/authority.",
    "Relevance: qualify each implication before its predicate: 'The sources describe planned platform work; this planned work may be a useful topic to confirm.' Never use categorical 'are useful anchors' or another clause's caution.",
    "Compact inquiry: 'Ask whether the reported role still applies to the chosen outcome.' Or 'Could we explore whether the reported role still applies to your chosen outcome?' Apply to every question/intendedLearning clause, including punctuation/conjunctions; never confirm unestablished facts.",
    "Separate organizational unknowns: 'Current ownership is not established by the sources. Decision authority is not established by the sources.' No long lists sharing one negative predicate or erased reported roles/boundaries.",
    "Source-led financial limits: 'The sources do not establish available purchasing budget, remaining amounts, eligible uses, procurement status, or buying intent.' Use applicable limits; separate exact funding facts/conditions. Proposals, awards, staffing allocations and matching amounts do not imply purchasing availability.",
    "Conditional probe: 'Optional probe: If staffing matters to the chosen outcome, ask whether the reported lead time is relevant.' Use only cited, supported detail.",
    "Temporal: initial_dated_event_discovery requires selected eligible admitted eventDate, not publication/retrieval/meeting/current-through dates alone. Use no_material_change_established for useful steady-state preparation, insufficient_context otherwise. change_against_prior_revision requires a supported change against an actual account priorRevision, never a meeting revision; none exists here.",
    audiencePriority(meetingRequest.audience),
    `MEETING REQUEST\n${canonicalJson(meetingRequest)}`,
    revision === null ? "REVISION CONTEXT\nnone" : `REVISION CONTEXT (session-only correction; does not mutate or ratify account truth; SHA-256 ${revisionSha256!})\n${canonicalJson(revision)}`,
    `OUTPUT SCHEMA\n${canonicalJson(schema)}`,
    context.context.admittedSources.some((source) => source.untrustedInstructionsDetected) ?
      `ELIGIBLE ACCOUNT CONTEXT PROJECTION (original context SHA-256 ${context.sha256}; hostile-instruction sources excluded from model evidence, original inspection record unchanged)\n${canonicalJson({ ...context.context,
        admittedSources: context.context.admittedSources.filter((source) => !source.untrustedInstructionsDetected),
        discoveryLineage: context.context.discoveryLineage.filter((discovery) => !context.context.admittedSources.some((source) =>
          source.untrustedInstructionsDetected && (discovery.resultUrl === source.canonicalUrl || discovery.derivedRetrievalUrls.includes(source.canonicalUrl)))),
        relevanceCandidates: context.context.relevanceCandidates.filter((item) => context.context.admittedSources.some((source) => !source.untrustedInstructionsDetected && source.sourceId === item.sourceId)) })}` :
      `FULL VERSIONED ACCOUNT CONTEXT (canonical SHA-256 ${context.sha256})\n${context.canonicalJson}`,
  ].join("\n\n");
  return deepFreezeOwnData({ kind: C3_MODEL_REQUEST_KIND, schemaVersion: C3_MODEL_REQUEST_VERSION, generationContractVersion,
    contextSha256: context.sha256, meetingRequestSha256, meetingRequest, revision, revisionSha256, prompt });
}

function evidenceRefs(value: unknown, path: string, known: Set<string>, min = 0): string[] {
  const rows = array(value, path, min, 20).map((item, index) => text(item, `${path}[${String(index)}]`, 128));
  if (new Set(rows).size !== rows.length || rows.some((id) => !known.has(id))) throw new Error(`${path} cites unknown or duplicate evidence`);
  return rows;
}

function supportedText(value: unknown, path: string, known: Set<string>, allowed: readonly C3SupportCategory[]): C3SupportedText {
  const root = object(value, path);
  exactKeys(root, ["text", "evidenceRefs", "supportCategory"], path);
  const supportCategory = enumValue(root.supportCategory, allowed, `${path}.supportCategory`);
  const refs = evidenceRefs(root.evidenceRefs, `${path}.evidenceRefs`, known,
    supportCategory === "direct_support" || supportCategory === "cautious_inference" ? 1 : 0);
  const valueText = text(root.text, `${path}.text`);
  return { text: valueText, evidenceRefs: refs, supportCategory };
}

function draftWarnings(candidate: C3MeetingDraftCandidate, context: FrozenC3AccountContext,
  evidenceSource: ReadonlyMap<string, FrozenC3AccountContext["context"]["admittedSources"][number]>, meetingDate?: string): C3DraftWarning[] {
  const warnings: C3DraftWarning[] = [];
  if (context.context.declaredContradictions.length > 0) warnings.push({ code: "known_contradiction",
    message: `Known context conflict remains unresolved: ${context.context.declaredContradictions.join("; ")}`, evidenceRefs: [] });
  const cited = candidate.selectedEvidenceRefs;
  const undated = cited.filter((id) => {
    const source = evidenceSource.get(id);
    return source?.publicationDate === null && source.eventDate === null && source.evidenceCurrentThrough === null;
  });
  if (undated.length > 0) warnings.push({ code: "source_date_unknown",
    message: "Some selected support has no established publication, event, or current-through date; recheck it for this meeting.", evidenceRefs: undated });
  const stale = cited.filter((id) => {
    const source = evidenceSource.get(id);
    return source?.evidenceCurrentThrough !== null && source?.evidenceCurrentThrough !== undefined &&
      source.evidenceCurrentThrough < (meetingDate ?? context.context.account.requestedAt.slice(0, 10));
  });
  if (stale.length > 0) warnings.push({ code: "evidence_stale_for_meeting",
    message: "Selected evidence predates the account-context request date; its meeting-date currentness is not established.", evidenceRefs: stale });
  if (candidate.audienceThesis.supportCategory !== "direct_support") warnings.push({ code: "related_context_only",
    message: "The audience thesis is proposed inference or an explicit unknown; cited evidence is context, not direct semantic proof.",
    evidenceRefs: candidate.audienceThesis.evidenceRefs });
  if (meetingDate !== undefined && meetingDate > context.context.account.requestedAt.slice(0, 10)) warnings.push({ code: "task_date_after_context",
    message: `The meeting is dated ${meetingDate}, after the account context was captured; time-sensitive status must be rechecked separately from draft status.`,
    evidenceRefs: [] });
  return warnings;
}

const HIGH_RISK_ASSERTION = /\b(?:suffered|experienced|was hit by)\b.{0,80}\b(?:ransomware|cyber ?attack|data breach)\b|\b(?:appointed|selected|chose|chosen|contracted with|preferred)\b.{0,80}\b(?:vendor|provider|partner|recovery|deployment)\b|\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b[^;.!?]{0,60}?\b(?:purchasing\s+)?(?:budget|funding|funds?)\b|\b(?:budget|funding|funds?)\b[^;.!?]{0,40}?\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b|\$\s*\d[\d,.]*\s*(?:million|m)?\b.{0,60}\b(?:ready to spend|available|approved budget)\b|\b(?:already approved|approved purchase|active procurement)\b|\b(?:allocate|spend)\b.{0,80}\b(?:budget|funding|funds?)\b.{0,80}\b(?:buy|purchase)\b|\b(?:must|should)\s+(?:we\s+)?(?:buy|purchase|select|replace)\b/iu;
const HIGH_RISK_ASSERTIONS = new RegExp(HIGH_RISK_ASSERTION.source, `${HIGH_RISK_ASSERTION.flags}g`);
const COMMERCIAL_AVAILABILITY_ASSERTION = /\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b[^;.!?]{0,60}?\b(?:purchasing\s+)?(?:budget|funding|funds?)\b|\b(?:budget|funding|funds?)\b[^;.!?]{0,40}?\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b/iu;

function isBoundedCommercialNonAssumption(value: string, match: RegExpMatchArray): boolean {
  if (!COMMERCIAL_AVAILABILITY_ASSERTION.test(match[0])) return false;
  if (/\b(?:confirm(?:s|ed|ing)?|assert(?:s|ed|ing)?)\b/iu.test(match[0]) &&
      !/\b(?:does not|do not|cannot|can not|without)\s+(?:confirm|assert)\b/iu.test(match[0])) return false;
  const start = match.index ?? 0;
  const before = value.slice(0, start).split(/[.!?;]/u).at(-1) ?? "";
  const after = value.slice(start + match[0].length).split(/[.!?;]/u)[0] ?? "";
  // Exceptions belong to this proposition, not to an arbitrary nearby
  // 'unknown'. Commercial lists may share one trailing predicate, but an
  // unrelated subject such as 'ownership remains unknown' cannot excuse it.
  const scopedCaution = /(?:\bavoid(?:ing)? assumptions? about\b|\bwithout assuming\b|\bdo not assume\b)(?:(?!\b(?:but|however|yet|while|instead|then|confirm(?:s|ed|ing)?|assert(?:s|ed|ing)?)\b)[\s\S])*$/iu;
  const scopedEvidenceLimit = /\b(?:does not|do not|cannot|can not|no evidence (?:of|that))\s+(?:establish|confirm|show|prove)\b(?:(?!\b(?:but|however|yet|while|instead|then)\b)[\s\S])*$/iu;
  const scopedEvidenceLimitWithinMatch = /\b(?:does not|do not|cannot|can not|no evidence (?:of|that))\s+(?:establish|confirm|show|prove)\b/iu;
  const listItem = "(?:procurement status|eligible (?:commercial|vendor) uses|buying intent|decision authority|urgency|vendor (?:preference|intent)|(?:(?:available|remaining) )?(?:purchasing )?(?:budget|funding|funds))";
  // A trailing source attribution still qualifies this same unknown predicate;
  // do not let it absorb a contrasting clause or a new asserted predicate.
  const sourceAttribution = String.raw`(?:\s+by\s+(?:(?!\b(?:but|however|yet|while|instead|then|which|that|confirm(?:s|ed|ing)?|assert(?:s|ed|ing)?|establish(?:es|ed|ing)?|prove(?:s|d)?|show(?:s|ed|ing)?|says?|states?|is|are|has|have|had|was|were|will|can|may|must|should)\b)[^;.!?]){1,160})?`;
  const scopedUnknown = new RegExp(`^(?:(?:,\\s*(?:and\\s+)?|\\s+(?:and|or)\\s+)${listItem})*\\s+(?:is|are|remains|remain)\\s+(?:unknown|not established|unclear|unverified)${sourceAttribution}\\s*$`, "iu");
  const internalContrast = /\b(?:but|however|yet|while|instead|then)\b/iu.test(match[0]);
  return !internalContrast && (scopedCaution.test(before) || scopedEvidenceLimit.test(before) ||
    scopedEvidenceLimitWithinMatch.test(match[0]) || scopedUnknown.test(after));
}

const COMMERCIAL_COMMITMENT = /\b(?:sign(?:s|ed|ing)?|execut(?:e[sd]?|ing))\s+(?:(?:a|the|an)\s+)?(?:[\w-]+\s+){0,3}(?:contract|agreement)\b|\b(?:purchased|bought|procured|acquired)\b|\b(?:your|the)\s+(?:[\w-]+\s+){0,4}(?:purchase|signed contract)\b/giu;
function assertNoCommercialPresupposition(value: string, path: string): void {
  for (const match of value.matchAll(COMMERCIAL_COMMITMENT)) {
    const before = value.slice(0, match.index).split(/[.!?;]/u).at(-1) ?? "";
    // Inquiry scopes only its own clause; a later assertion cannot borrow 'whether'.
    if (/\b(?:whether|if)\b(?:(?!\b(?:but|however|then|and|which|that|you)\b)[^.!?;])*$/iu.test(before) ||
        /\b(?:whether|if)\s+(?:you|they|the account)\s+(?:(?:have|has|ever|already|any)\s+)*$/iu.test(before)) continue;
    throw new Error(`${path} introduces an unsupported commercial commitment or purchase presupposition`);
  }
}

function assertNoUnsupportedAccountAssertion(value: string, category: C3SupportCategory, path: string): void {
  if (category === "direct_support") return;
  for (const match of value.matchAll(HIGH_RISK_ASSERTIONS)) {
    if (!isBoundedCommercialNonAssumption(value, match)) {
      throw new Error(`${path} introduces a clearly unsupported incident, commercial assertion, vendor relationship, approval, or prescriptive purchase`);
    }
  }
  assertNoCommercialPresupposition(value, path);
}

export function validateC3Candidate(rawText: string, context: FrozenC3AccountContext, meetingDate?: string,
  generationContractVersion: C3GenerationContractVersion = CURRENT_C3_GENERATION_CONTRACT_VERSION): C3ProposedDraft {
  c3GenerationContractVersion({ generationContractVersion });
  if (generationContractVersion === "2") return originalContract.validateC3Candidate(rawText, context, meetingDate);
  if (generationContractVersion === "3") return v3Contract.validateC3Candidate(rawText, context, meetingDate, "3");
  if (generationContractVersion === "4") return v4Contract.validateC3Candidate(rawText, context, meetingDate, "4");
  if (Buffer.byteLength(rawText, "utf8") > 256 * 1024) throw new Error("model response exceeds output bound");
  let parsed: unknown;
  try { parsed = JSON.parse(rawText); } catch { throw new Error("model response must be one strict JSON object"); }
  const root = object(parsed, "candidate");
  exactKeys(root, ["temporalOutcome", "objective", "audienceThesis", "opening", "questions", "risksUnknowns", "closeCriterion", "selectedEvidenceRefs"], "candidate");
  const known = new Set(context.context.admittedSources.filter((source) => !source.untrustedInstructionsDetected).flatMap((source) => source.excerpts.map((item) => item.evidenceId)));
  const temporalOutcome = enumValue(root.temporalOutcome, ["initial_dated_event_discovery", "change_against_prior_revision",
    "no_material_change_established", "insufficient_context"] as const, "candidate.temporalOutcome");
  if (temporalOutcome === "change_against_prior_revision" && context.context.priorRevision === null) {
    throw new Error("change_against_prior_revision requires an actual prior revision");
  }
  const objective = supportedText(root.objective, "candidate.objective", known, ["recommendation", "unknown"]);
  const audienceThesis = supportedText(root.audienceThesis, "candidate.audienceThesis", known,
    ["direct_support", "cautious_inference", "unknown"]);
  const opening = supportedText(root.opening, "candidate.opening", known,
    ["direct_support", "cautious_inference", "recommendation"]);
  const questions = array(root.questions, "candidate.questions", 3, 7).map((value, index): C3DraftQuestion => {
    const path = `candidate.questions[${String(index)}]`;
    const question = object(value, path);
    exactKeys(question, ["question", "intendedLearning", "evidenceRefs", "supportCategory"], path);
    const supportCategory = enumValue(question.supportCategory, ["open_question"] as const, `${path}.supportCategory`);
    const questionText = text(question.question, `${path}.question`);
    const intendedLearning = text(question.intendedLearning, `${path}.intendedLearning`);
    if (!questionText.endsWith("?")) throw new Error(`${path}.question must be an actual question`);
    assertNoUnsupportedAccountAssertion(questionText, supportCategory, `${path}.question`);
    assertNoUnsupportedAccountAssertion(intendedLearning, supportCategory, `${path}.intendedLearning`);
    return { question: questionText, intendedLearning,
      evidenceRefs: evidenceRefs(question.evidenceRefs, `${path}.evidenceRefs`, known), supportCategory };
  });
  const risksUnknowns = array(root.risksUnknowns, "candidate.risksUnknowns", 1, 8)
    .map((value, index) => supportedText(value, `candidate.risksUnknowns[${String(index)}]`, known,
      ["direct_support", "cautious_inference", "unknown"]));
  const closeCriterion = supportedText(root.closeCriterion, "candidate.closeCriterion", known, ["recommendation", "unknown"]);
  const selectedEvidenceRefs = evidenceRefs(root.selectedEvidenceRefs, "candidate.selectedEvidenceRefs", known,
    temporalOutcome === "insufficient_context" ? 0 : 1);
  const cited = new Set([...objective.evidenceRefs, ...audienceThesis.evidenceRefs, ...opening.evidenceRefs,
    ...questions.flatMap((item) => item.evidenceRefs), ...risksUnknowns.flatMap((item) => item.evidenceRefs), ...closeCriterion.evidenceRefs]);
  if (selectedEvidenceRefs.length !== cited.size || selectedEvidenceRefs.some((id) => !cited.has(id))) {
    throw new Error("selectedEvidenceRefs must exactly equal the candidate's cited evidence set");
  }
  const candidate: C3MeetingDraftCandidate = { temporalOutcome, objective,
    audienceThesis, opening, questions, risksUnknowns, closeCriterion, selectedEvidenceRefs };
  const evidenceSource = new Map<string, FrozenC3AccountContext["context"]["admittedSources"][number]>();
  for (const source of context.context.admittedSources) for (const excerpt of source.excerpts) evidenceSource.set(excerpt.evidenceId, source);
  if (temporalOutcome === "initial_dated_event_discovery" && !selectedEvidenceRefs.some((id) => evidenceSource.get(id)?.eventDate !== null)) {
    throw new Error("initial_dated_event_discovery requires selected support with an explicit admitted event date; publication alone is insufficient");
  }
  for (const [path, item] of [
    ["candidate.objective", objective], ["candidate.audienceThesis", audienceThesis], ["candidate.opening", opening],
    ...risksUnknowns.map((item, index) => [`candidate.risksUnknowns[${String(index)}]`, item] as const),
    ["candidate.closeCriterion", closeCriterion],
  ] as readonly (readonly [string, C3SupportedText])[]) {
    if (item.supportCategory === "direct_support" && !item.evidenceRefs.some((id) =>
      evidenceSource.get(id)?.excerpts.some((excerpt) => excerpt.evidenceId === id && excerpt.exactExcerpt === item.text))) {
      throw new Error(`${path} direct_support requires whole-field verbatim equality with one cited exact excerpt`);
    }
    assertNoUnsupportedAccountAssertion(item.text, item.supportCategory, path);
    const excerpts = item.evidenceRefs.flatMap(id => evidenceSource.get(id)?.excerpts.filter(excerpt => excerpt.evidenceId === id).map(excerpt => excerpt.exactExcerpt) ?? []);
    assertC3ClaimSupport(item.text, item.supportCategory, excerpts, path);
  }
  for (const [index, question] of questions.entries()) {
    const excerpts = question.evidenceRefs.flatMap(id => evidenceSource.get(id)?.excerpts.filter(excerpt => excerpt.evidenceId === id).map(excerpt => excerpt.exactExcerpt) ?? []);
    assertC3ClaimSupport(question.question, "open_question", excerpts, `candidate.questions[${index}].question`);
    assertC3ClaimSupport(question.intendedLearning, "open_question", excerpts, `candidate.questions[${index}].intendedLearning`);
  }
  return deepFreezeOwnData({ ...candidate, status: "proposed_unreviewed", durablySaved: false,
    warnings: draftWarnings(candidate, context, evidenceSource, meetingDate) });
}

export function createGenerationRecord(modelRequest: C3ModelRequest, rawResponse: string,
  context: FrozenC3AccountContext): C3GenerationRecord {
  assertC3GenerationContext(context);
  const generationContractVersion = c3GenerationContractVersion(modelRequest);
  const expectedRequest = reconstructC3ModelRequest(context, modelRequest);
  if (canonicalJson(expectedRequest) !== canonicalJson(modelRequest)) throw new Error("model request identity or prompt mismatch");
  const marker = Object.hasOwn(modelRequest, "generationContractVersion") ? { generationContractVersion } : {};
  if (generationContractVersion === "2") return deepFreezeOwnData({
    ...originalContract.createGenerationRecord(modelRequest, rawResponse, context), ...marker });
  const rawResponseSha256 = hash(rawResponse);
  const modelRequestSha256 = hash(canonicalJson(modelRequest));
  const recordId = `c3_${hash(`${context.sha256}\n${modelRequestSha256}\n${rawResponseSha256}`).slice(0, 24)}`;
  try {
    const draft = validateC3Candidate(rawResponse, context, modelRequest.meetingRequest.meetingDate, generationContractVersion);
    return deepFreezeOwnData({ kind: "atliera.c3.generation-record", schemaVersion: "2", ...marker, recordId,
      contextSha256: context.sha256, meetingRequest: modelRequest.meetingRequest,
      meetingRequestSha256: modelRequest.meetingRequestSha256, revision: modelRequest.revision,
      revisionSha256: modelRequest.revisionSha256, modelRequestSha256,
      rawResponse, rawResponseSha256, outcome: "succeeded", draft });
  } catch (error) {
    return deepFreezeOwnData({ kind: "atliera.c3.generation-record", schemaVersion: "2", ...marker, recordId,
      contextSha256: context.sha256, meetingRequest: modelRequest.meetingRequest,
      meetingRequestSha256: modelRequest.meetingRequestSha256, revision: modelRequest.revision,
      revisionSha256: modelRequest.revisionSha256, modelRequestSha256,
      rawResponse, rawResponseSha256, outcome: "refused",
      refusal: { code: "invalid_model_candidate" as const, message: error instanceof Error ? error.message : "invalid model candidate" } });
  }
}

export function assertReplayIdentity(record: C3GenerationRecord, context: FrozenC3AccountContext): void {
  assertC3GenerationContext(context);
  if (record.contextSha256 !== context.sha256 || record.meetingRequestSha256 !== hash(canonicalJson(record.meetingRequest)) ||
      record.rawResponseSha256 !== hash(record.rawResponse)) throw new Error("recorded generation identity mismatch");
  if (record.revisionSha256 !== (record.revision === null ? null : hash(canonicalJson(record.revision))) ||
      (record.revision !== null && record.revision.priorRawResponseSha256 !== hash(record.revision.priorRawResponse))) {
    throw new Error("recorded revision identity mismatch");
  }
  const rebuilt = createGenerationRecord(reconstructC3ModelRequest(context, record), record.rawResponse, context);
  if (canonicalJson(rebuilt) !== canonicalJson(record)) throw new Error("recorded generation replay mismatch");
}

/** Reconstruct exact saved request bytes. Never default a historical record to today's prompt. */
export function reconstructC3ModelRequest(context: FrozenC3AccountContext,
  saved: Pick<C3GenerationRecord, "meetingRequest" | "revision" | "generationContractVersion">): C3ModelRequest {
  const version = c3GenerationContractVersion(saved);
  if (!Object.hasOwn(saved, "generationContractVersion")) {
    return originalContract.createC3ModelRequest(context, saved.meetingRequest, saved.revision);
  }
  return createC3ModelRequest(context, saved.meetingRequest, saved.revision, version);
}
