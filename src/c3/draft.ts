import { createHash } from "node:crypto";
import * as originalContract from "./generation-contract-v2.ts";
import * as v3Contract from "./generation-contract-v3.ts";
import * as v4Contract from "./generation-contract-v4.ts";
import * as v5Contract from "./generation-contract-v5.ts";
import { createV6ModelRequest, validateV6Integrity, assertV6Verification, type C3Verification } from "./generation-contract-v6.ts";

import { deepFreezeOwnData } from "../authority/strict-json.ts";
import { canonicalJson } from "./context.ts";
import { assertC3GenerationContext, type FrozenC3ViewContext as FrozenC3AccountContext } from "./view-context.ts";

export const C3_MODEL_REQUEST_KIND = "atliera.c3.meeting-draft-model-request" as const;
export const C3_MODEL_REQUEST_VERSION = "2" as const;

/** Missing markers identify the original contract, never the runtime/provider mode. */
export type C3GenerationContractVersion = "2" | "3" | "4" | "5" | "6";
export const CURRENT_C3_GENERATION_CONTRACT_VERSION = "6" as const;
export function c3GenerationContractVersion(value: { readonly generationContractVersion?: C3GenerationContractVersion }): C3GenerationContractVersion {
  if (!Object.hasOwn(value, "generationContractVersion")) return "2";
  if (value.generationContractVersion !== "2" && value.generationContractVersion !== "3" && value.generationContractVersion !== "4" && value.generationContractVersion !== "5" && value.generationContractVersion !== "6") {
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
  readonly verification?: C3Verification;
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

export function createC3ModelRequest(context: FrozenC3AccountContext, requestInput: unknown,
  revision: C3RevisionContext | null = null,
  generationContractVersion: C3GenerationContractVersion = CURRENT_C3_GENERATION_CONTRACT_VERSION): C3ModelRequest {
  c3GenerationContractVersion({ generationContractVersion });
  if (generationContractVersion === "2") return deepFreezeOwnData({
    ...originalContract.createC3ModelRequest(context, requestInput, revision), generationContractVersion });
  if (generationContractVersion === "3") return v3Contract.createC3ModelRequest(context, requestInput, revision, "3");
  if (generationContractVersion === "4") return v4Contract.createC3ModelRequest(context, requestInput, revision, "4");
  if (generationContractVersion === "5") return v5Contract.createC3ModelRequest(context, requestInput, revision, "5");
  assertC3GenerationContext(context);
  return createV6ModelRequest(context, snapshotMeetingRequest(requestInput), revision);
}

/** V6 validation without its bound independent check always fails closed. */
export function validateC3Candidate(rawText: string, context: FrozenC3AccountContext, meetingDate?: string,
  generationContractVersion: C3GenerationContractVersion = CURRENT_C3_GENERATION_CONTRACT_VERSION,
  verification?: C3Verification, modelRequest?: C3ModelRequest): C3ProposedDraft {
  c3GenerationContractVersion({ generationContractVersion });
  if (generationContractVersion === "2") return originalContract.validateC3Candidate(rawText, context, meetingDate);
  if (generationContractVersion === "3") return v3Contract.validateC3Candidate(rawText, context, meetingDate, "3");
  if (generationContractVersion === "4") return v4Contract.validateC3Candidate(rawText, context, meetingDate, "4");
  if (generationContractVersion === "5") return v5Contract.validateC3Candidate(rawText, context, meetingDate, "5");
  const draft = validateV6Integrity(rawText, context, meetingDate);
  if (!modelRequest) throw new Error("Independent evidence check is required for this candidate.");
  assertV6Verification(modelRequest, rawText, context, verification);
  return draft;
}

export function createGenerationRecord(modelRequest: C3ModelRequest, rawResponse: string,
  context: FrozenC3AccountContext, verification?: C3Verification): C3GenerationRecord {
  assertC3GenerationContext(context);
  const generationContractVersion = c3GenerationContractVersion(modelRequest);
  const expectedRequest = reconstructC3ModelRequest(context, modelRequest);
  if (canonicalJson(expectedRequest) !== canonicalJson(modelRequest)) throw new Error("model request identity or prompt mismatch");
  const marker = Object.hasOwn(modelRequest, "generationContractVersion") ? { generationContractVersion } : {};
  if (generationContractVersion === "2") return deepFreezeOwnData({
    ...originalContract.createGenerationRecord(modelRequest, rawResponse, context), ...marker });
  if (generationContractVersion !== "6" && verification !== undefined) throw new Error("Historical contracts do not accept new verification");
  const retainedVerification = verification === undefined ? {} : { verification };
  const rawResponseSha256 = hash(rawResponse);
  const modelRequestSha256 = hash(canonicalJson(modelRequest));
  const recordId = `c3_${hash(`${context.sha256}\n${modelRequestSha256}\n${rawResponseSha256}${generationContractVersion === "6" ? `\n${hash(canonicalJson(verification ?? null))}` : ""}`).slice(0, 24)}`;
  try {
    const draft = validateC3Candidate(rawResponse, context, modelRequest.meetingRequest.meetingDate, generationContractVersion, verification, modelRequest);
    return deepFreezeOwnData({ kind: "atliera.c3.generation-record", schemaVersion: "2", ...marker, ...retainedVerification, recordId,
      contextSha256: context.sha256, meetingRequest: modelRequest.meetingRequest,
      meetingRequestSha256: modelRequest.meetingRequestSha256, revision: modelRequest.revision,
      revisionSha256: modelRequest.revisionSha256, modelRequestSha256,
      rawResponse, rawResponseSha256, outcome: "succeeded", draft });
  } catch (error) {
    return deepFreezeOwnData({ kind: "atliera.c3.generation-record", schemaVersion: "2", ...marker, ...retainedVerification, recordId,
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
  const rebuilt = createGenerationRecord(reconstructC3ModelRequest(context, record), record.rawResponse, context, record.verification);
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
