import { createHash } from "node:crypto";

import { deepFreezeOwnData } from "../authority/strict-json.ts";
import { canonicalJson, type FrozenC3AccountContext } from "./context.ts";

export const C3_MODEL_REQUEST_KIND = "atliera.c3.meeting-draft-model-request" as const;
export const C3_MODEL_REQUEST_VERSION = "2" as const;

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
    return "Prioritize security ownership, controls, risk boundaries, evidence freshness, and decision-relevant unknowns.";
  }
  if (/\b(?:cio|engineering|technology|platform|architect)\b/iu.test(audience)) {
    return "Prioritize architecture, operating model, integration dependencies, delivery sequencing, and technical learning.";
  }
  return "Adapt priorities and question ordering to the named audience without changing source facts.";
}

export function createC3ModelRequest(context: FrozenC3AccountContext, requestInput: unknown,
  revision: C3RevisionContext | null = null): C3ModelRequest {
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
    "Prepare a small, useful meeting draft from the supplied admitted account context.",
    "For a 15-minute meeting, favor three prioritized questions: current priority, the audience's key constraint, and one useful next step. Keep each question focused rather than combining a list of workstreams. Longer meetings may use more questions.",
    "Use plain seller-facing language: say sources, current priorities, and what to confirm—not retained material, admitted context, controller authorization, excerpt-level support, or schema. Keep governance/session/approval explanations out of the meeting content; the application displays those states separately. An unknown field must identify an actual account or evidence unknown, not explain the application.",
    "Write a concise natural spoken opening inviting the audience to confirm the most relevant account-specific priority. Prefer a recommendation phrased as an invitation to consider or a cautious hypothesis, rather than an isolated literal quotation with no conversational bridge. Keep source facts exact under the support contract; do not turn a paraphrase into direct_support.",
    "Avoid repeating the same generic caveat in every field. In risksUnknowns, keep the few consequential source/date/entity/funding uncertainties, tied to their affected evidence and the learning decision. Neither brevity nor conversational wording permits dropping a known contradiction or consequential warning.",
    "Return exactly one JSON object matching the supplied schema, with no markdown and no additional fields.",
    "You select meaningful evidence and write the prose. Do not merely repeat the relevance candidates; they are candidates with reasons, not conclusions.",
    "Preserve facts, entity boundaries, declared contradictions, material gaps, owner corrections, source dates, and renderer annotations.",
    "NO-NEW-ACCOUNT-FACT CONTRACT: direct_support is a source fact and the entire text field must equal one cited exactExcerpt byte-for-byte. cautious_inference must be explicitly tentative, cite related evidence, and must not state a new incident, commercial status, vendor selection, or other account fact. recommendation is an action to consider, not a claim about the account. open_question is only for questions and their learning goals; it must not smuggle a factual presupposition. unknown must explicitly say what is unknown or not established.",
    "Never assert available purchasing budget, procurement status, buying intent, urgency, vendor preference, approval, a security incident, or a named vendor relationship unless the whole field is direct_support and exactly equals its cited excerpt. Explicit uncertainty such as 'The retained funding statements do not establish an available purchasing budget; use the meeting to learn constraints.' is appropriate.",
    "A dated event found in initial research is not a change against a prior revision. No prior revision exists here, so change_against_prior_revision is invalid.",
    "Use no_material_change_established for a useful steady-state agenda and insufficient_context when evidence cannot support useful preparation.",
    "A valid direct_support example copies one exactExcerpt as the whole text field. A mixed source summary plus proposed discussion is NOT direct_support; represent it as an explicitly tentative cautious_inference or split it into an exact fact and a recommendation. Questions always use open_question even when evidenceRefs provide related context.",
    "Ask 3-7 ordered questions. Keep the thesis concise. Cite only supplied evidence IDs and include every cited ID once in selectedEvidenceRefs.",
    audiencePriority(meetingRequest.audience),
    `MEETING REQUEST\n${canonicalJson(meetingRequest)}`,
    revision === null ? "REVISION CONTEXT\nnone" : `REVISION CONTEXT (session-only correction; does not mutate or ratify account truth; SHA-256 ${revisionSha256!})\n${canonicalJson(revision)}`,
    `OUTPUT SCHEMA\n${canonicalJson(schema)}`,
    `FULL VERSIONED ACCOUNT CONTEXT (canonical SHA-256 ${context.sha256})\n${context.canonicalJson}`,
  ].join("\n\n");
  return deepFreezeOwnData({ kind: C3_MODEL_REQUEST_KIND, schemaVersion: C3_MODEL_REQUEST_VERSION,
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
  if (supportCategory === "cautious_inference" &&
      !/\b(?:may|might|could|suggests?|appears?|hypothesis|potential|worth (?:asking|clarifying|exploring)|to explore)\b/iu.test(valueText)) {
    throw new Error(`${path} cautious_inference must be explicitly tentative`);
  }
  if (supportCategory === "unknown" &&
      !/\b(?:unknown|unclear|not established|not known|insufficient|remains? (?:open|to be learned|unverified)|cannot establish|(?:does|do) not establish)\b/iu.test(valueText)) {
    throw new Error(`${path} unknown must explicitly identify an unknown or limit`);
  }
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

const HIGH_RISK_ASSERTION = /\b(?:suffered|experienced|was hit by)\b.{0,80}\b(?:ransomware|cyber ?attack|data breach)\b|\b(?:appointed|selected|chose|chosen|contracted with|preferred)\b.{0,80}\b(?:vendor|provider|partner|recovery|deployment)\b|\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b.{0,60}\b(?:purchasing\s+)?(?:budget|funding|funds?)\b|\b(?:budget|funding|funds?)\b.{0,40}\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b|\$\s*\d[\d,.]*\s*(?:million|m)?\b.{0,60}\b(?:ready to spend|available|approved budget)\b|\b(?:already approved|approved purchase|active procurement)\b|\b(?:allocate|spend)\b.{0,80}\b(?:budget|funding|funds?)\b.{0,80}\b(?:buy|purchase)\b|\b(?:must|should)\s+(?:we\s+)?(?:buy|purchase|select|replace)\b/iu;
const HIGH_RISK_ASSERTIONS = new RegExp(HIGH_RISK_ASSERTION.source, `${HIGH_RISK_ASSERTION.flags}g`);
const COMMERCIAL_AVAILABILITY_ASSERTION = /\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b.{0,60}\b(?:purchasing\s+)?(?:budget|funding|funds?)\b|\b(?:budget|funding|funds?)\b.{0,40}\b(?:available|approved|allocated|ready[- ]to[- ]spend)\b/iu;

function isBoundedCommercialNonAssumption(value: string, match: RegExpMatchArray): boolean {
  if (!COMMERCIAL_AVAILABILITY_ASSERTION.test(match[0])) return false;
  if (/\b(?:confirm(?:s|ed|ing)?|assert(?:s|ed|ing)?)\b/iu.test(match[0]) &&
      !/\b(?:does not|do not|cannot|can not|without)\s+(?:confirm|assert)\b/iu.test(match[0])) return false;
  const start = match.index ?? 0;
  const before = value.slice(Math.max(0, start - 180), start);
  const after = value.slice(start + match[0].length, start + match[0].length + 100);
  const scopedCaution = /(?:\bavoid(?:ing)? assumptions? about\b|\bwithout assuming\b)(?:(?![.!?;]|\b(?:but|however|yet|confirm(?:s|ed|ing)?|assert(?:s|ed|ing)?)\b)[\s\S]){0,140}$/iu;
  const scopedEvidenceLimit = /\b(?:does not|do not|cannot|can not|no evidence (?:of|that))\s+(?:establish|confirm|show|prove)\b[^.!?;]{0,100}$/iu;
  const scopedEvidenceLimitWithinMatch = /\b(?:does not|do not|cannot|can not|no evidence (?:of|that))\s+(?:establish|confirm|show|prove)\b/iu;
  const scopedUnknown = /^[^.!?;]{0,80}\b(?:unknown|not established|unclear|unverified)\b/iu;
  return scopedCaution.test(before) || scopedEvidenceLimit.test(before) ||
    scopedEvidenceLimitWithinMatch.test(match[0]) || scopedUnknown.test(after);
}

function assertNoUnsupportedAccountAssertion(value: string, category: C3SupportCategory, path: string): void {
  if (category === "direct_support") return;
  for (const match of value.matchAll(HIGH_RISK_ASSERTIONS)) {
    if (!isBoundedCommercialNonAssumption(value, match)) {
      throw new Error(`${path} introduces a clearly unsupported incident, commercial assertion, vendor relationship, approval, or prescriptive purchase`);
    }
  }
}

export function validateC3Candidate(rawText: string, context: FrozenC3AccountContext, meetingDate?: string): C3ProposedDraft {
  if (Buffer.byteLength(rawText, "utf8") > 256 * 1024) throw new Error("model response exceeds output bound");
  let parsed: unknown;
  try { parsed = JSON.parse(rawText); } catch { throw new Error("model response must be one strict JSON object"); }
  const root = object(parsed, "candidate");
  exactKeys(root, ["temporalOutcome", "objective", "audienceThesis", "opening", "questions", "risksUnknowns", "closeCriterion", "selectedEvidenceRefs"], "candidate");
  const known = new Set(context.context.admittedSources.flatMap((source) => source.excerpts.map((item) => item.evidenceId)));
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
  }
  return deepFreezeOwnData({ ...candidate, status: "proposed_unreviewed", durablySaved: false,
    warnings: draftWarnings(candidate, context, evidenceSource, meetingDate) });
}

export function createGenerationRecord(modelRequest: C3ModelRequest, rawResponse: string,
  context: FrozenC3AccountContext): C3GenerationRecord {
  const rawResponseSha256 = hash(rawResponse);
  const modelRequestSha256 = hash(canonicalJson(modelRequest));
  const recordId = `c3_${hash(`${context.sha256}\n${modelRequestSha256}\n${rawResponseSha256}`).slice(0, 24)}`;
  try {
    const draft = validateC3Candidate(rawResponse, context, modelRequest.meetingRequest.meetingDate);
    return deepFreezeOwnData({ kind: "atliera.c3.generation-record", schemaVersion: "2", recordId,
      contextSha256: context.sha256, meetingRequest: modelRequest.meetingRequest,
      meetingRequestSha256: modelRequest.meetingRequestSha256, revision: modelRequest.revision,
      revisionSha256: modelRequest.revisionSha256, modelRequestSha256,
      rawResponse, rawResponseSha256, outcome: "succeeded", draft });
  } catch (error) {
    return deepFreezeOwnData({ kind: "atliera.c3.generation-record", schemaVersion: "2", recordId,
      contextSha256: context.sha256, meetingRequest: modelRequest.meetingRequest,
      meetingRequestSha256: modelRequest.meetingRequestSha256, revision: modelRequest.revision,
      revisionSha256: modelRequest.revisionSha256, modelRequestSha256,
      rawResponse, rawResponseSha256, outcome: "refused",
      refusal: { code: "invalid_model_candidate" as const, message: error instanceof Error ? error.message : "invalid model candidate" } });
  }
}

export function assertReplayIdentity(record: C3GenerationRecord, context: FrozenC3AccountContext): void {
  if (record.contextSha256 !== context.sha256 || record.meetingRequestSha256 !== hash(canonicalJson(record.meetingRequest)) ||
      record.rawResponseSha256 !== hash(record.rawResponse)) throw new Error("recorded generation identity mismatch");
  if (record.revisionSha256 !== (record.revision === null ? null : hash(canonicalJson(record.revision))) ||
      (record.revision !== null && record.revision.priorRawResponseSha256 !== hash(record.revision.priorRawResponse))) {
    throw new Error("recorded revision identity mismatch");
  }
  const rebuilt = createGenerationRecord(createC3ModelRequest(context, record.meetingRequest, record.revision), record.rawResponse, context);
  if (rebuilt.modelRequestSha256 !== record.modelRequestSha256 || rebuilt.recordId !== record.recordId || rebuilt.outcome !== record.outcome ||
      canonicalJson(rebuilt.draft ?? null) !== canonicalJson(record.draft ?? null) ||
      canonicalJson(rebuilt.refusal ?? null) !== canonicalJson(record.refusal ?? null)) {
    throw new Error("recorded generation replay mismatch");
  }
}
