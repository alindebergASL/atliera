/** Version dispatch for integration. Historical implementation and shared draft types stay frozen. */
import * as historical from './draft.ts';
import * as v6 from './generation-contract-v6.ts';
import * as v7 from './generation-contract-v7.ts';
import { canonicalJson } from './context.ts';
import { deepFreezeOwnData } from '../authority/strict-json.ts';
import { assertC3GenerationContext, type FrozenC3ViewContext } from './view-context.ts';

// Common display and revision shapes are unchanged; callers can migrate their import as a unit.
export { C3_MODEL_REQUEST_KIND, C3_MODEL_REQUEST_VERSION, snapshotMeetingRequest, snapshotMeetingFormState } from './draft.ts';
export type { C3TemporalOutcome, C3SupportCategory, C3MeetingRequest, C3MeetingFormState,
  C3SupportedText, C3DraftQuestion, C3MeetingDraftCandidate, C3DraftWarning, C3ProposedDraft, C3RevisionContext } from './draft.ts';

export type C3GenerationContractVersion = historical.C3GenerationContractVersion | '7';
export type C3ModelRequest = historical.C3ModelRequest | v7.C3V7ModelRequest;
export type C3VerificationRequest = v6.C3VerificationRequest | v7.C3V7VerificationRequest;
export type C3Verification = v6.C3Verification | v7.C3V7Verification;
export interface C3V7GenerationRecord extends Omit<historical.C3GenerationRecord, 'generationContractVersion' | 'verification' | 'refusal'> {
  readonly generationContractVersion: '7';
  readonly verification?: v7.C3V7Verification;
  readonly refusal?: { readonly code: 'invalid_model_candidate'; readonly message: string; readonly failureKind: v7.C3V7FailureKind };
}
export type C3GenerationRecord = historical.C3GenerationRecord | C3V7GenerationRecord;
export const CURRENT_C3_GENERATION_CONTRACT_VERSION = '7' as const;

/** This historical helper reads only the common record fields, never its generation marker. */
export function createC3RevisionContext(record: C3GenerationRecord, correctionNoteInput: unknown,
  revisionNumber: number): historical.C3RevisionContext {
  return historical.createC3RevisionContext(record as historical.C3GenerationRecord, correctionNoteInput, revisionNumber);
}

export function c3GenerationContractVersion(value: { readonly generationContractVersion?: C3GenerationContractVersion }): C3GenerationContractVersion {
  if (!Object.hasOwn(value, 'generationContractVersion')) return '2';
  return value.generationContractVersion === '7' ? '7' : historical.c3GenerationContractVersion(value as historical.C3ModelRequest);
}

export function createC3ModelRequest(context: FrozenC3ViewContext, requestInput: unknown,
  revision: historical.C3RevisionContext | null = null,
  version: C3GenerationContractVersion = CURRENT_C3_GENERATION_CONTRACT_VERSION): C3ModelRequest {
  c3GenerationContractVersion({ generationContractVersion: version });
  return version === '7' ? v7.createV7ModelRequest(context, historical.snapshotMeetingRequest(requestInput), revision)
    : historical.createC3ModelRequest(context, requestInput, revision, version);
}

export function reconstructC3ModelRequest(context: FrozenC3ViewContext,
  saved: Pick<C3GenerationRecord, 'generationContractVersion' | 'meetingRequest' | 'revision'>): C3ModelRequest {
  return c3GenerationContractVersion(saved) === '7'
    ? createC3ModelRequest(context, saved.meetingRequest, saved.revision, '7')
    : historical.reconstructC3ModelRequest(context, saved as historical.C3GenerationRecord);
}

export function createC3VerificationRequest(request: C3ModelRequest, rawResponse: string,
  context: FrozenC3ViewContext, schemaVersion: v6.C3VerificationSchemaVersion = '2'): C3VerificationRequest {
  if (request.generationContractVersion === '7') {
    if (schemaVersion !== '2') throw new Error('Contract 7 requires evidence verification schema 2.');
    return v7.createV7VerificationRequest(request, rawResponse, context);
  }
  return v6.createC3VerificationRequest(request, rawResponse, context, schemaVersion);
}

export function retainC3Verification(request: C3VerificationRequest, rawResponse: string | null): C3Verification {
  return request.generationContractVersion === '7' ? v7.retainV7Verification(request, rawResponse)
    : v6.retainC3Verification(request, rawResponse);
}

export function validateC3Candidate(rawResponse: string, context: FrozenC3ViewContext, meetingDate?: string,
  version: C3GenerationContractVersion = CURRENT_C3_GENERATION_CONTRACT_VERSION,
  verification?: C3Verification, request?: C3ModelRequest): historical.C3ProposedDraft {
  c3GenerationContractVersion({ generationContractVersion: version });
  if (version !== '7') return historical.validateC3Candidate(rawResponse, context, meetingDate, version,
    verification as v6.C3Verification | undefined, request as historical.C3ModelRequest | undefined);
  if (!request || request.generationContractVersion !== '7') {
    throw new v7.C3V7ValidationError('verifier_format', 'Independent evidence check requires a contract 7 model request.');
  }
  return v7.validateV7Candidate(rawResponse, context, request, verification as v7.C3V7Verification | undefined);
}

export function createGenerationRecord(request: C3ModelRequest, rawResponse: string,
  context: FrozenC3ViewContext, verification?: C3Verification): C3GenerationRecord {
  if (request.generationContractVersion !== '7') return historical.createGenerationRecord(request, rawResponse, context,
    verification as v6.C3Verification | undefined);
  assertC3GenerationContext(context);
  if (canonicalJson(reconstructC3ModelRequest(context, request)) !== canonicalJson(request)) {
    throw new Error('model request identity or prompt mismatch');
  }
  const rawResponseSha256 = v7.v7Hash(rawResponse), modelRequestSha256 = v7.v7Hash(canonicalJson(request));
  const recordId = `c3_${v7.v7Hash(`${context.sha256}\n${modelRequestSha256}\n${rawResponseSha256}\n${v7.v7Hash(canonicalJson(verification ?? null))}`).slice(0, 24)}`;
  const base = { kind: 'atliera.c3.generation-record' as const, schemaVersion: '2' as const,
    generationContractVersion: '7' as const, recordId, contextSha256: context.sha256,
    meetingRequest: request.meetingRequest, meetingRequestSha256: request.meetingRequestSha256,
    revision: request.revision, revisionSha256: request.revisionSha256, modelRequestSha256,
    rawResponse, rawResponseSha256,
    ...(verification === undefined ? {} : { verification: verification as v7.C3V7Verification }) };
  try {
    const draft = validateC3Candidate(rawResponse, context, request.meetingRequest.meetingDate, '7', verification, request);
    return deepFreezeOwnData({ ...base, outcome: 'succeeded', draft });
  } catch (error) {
    return deepFreezeOwnData({ ...base, outcome: 'refused', refusal: { code: 'invalid_model_candidate',
      failureKind: error instanceof v7.C3V7ValidationError ? error.failureKind : 'structural',
      message: error instanceof Error ? error.message : 'invalid model candidate' } });
  }
}

export function assertReplayIdentity(record: C3GenerationRecord, context: FrozenC3ViewContext): void {
  if (record.generationContractVersion !== '7') return historical.assertReplayIdentity(record, context);
  assertC3GenerationContext(context);
  if (record.contextSha256 !== context.sha256 || record.meetingRequestSha256 !== v7.v7Hash(canonicalJson(record.meetingRequest)) ||
      record.rawResponseSha256 !== v7.v7Hash(record.rawResponse)) throw new Error('recorded generation identity mismatch');
  if (record.revisionSha256 !== (record.revision === null ? null : v7.v7Hash(canonicalJson(record.revision))) ||
      (record.revision !== null && record.revision.priorRawResponseSha256 !== v7.v7Hash(record.revision.priorRawResponse))) {
    throw new Error('recorded revision identity mismatch');
  }
  const rebuilt = createGenerationRecord(reconstructC3ModelRequest(context, record), record.rawResponse, context, record.verification);
  if (canonicalJson(rebuilt) !== canonicalJson(record)) throw new Error('recorded generation replay mismatch');
}
