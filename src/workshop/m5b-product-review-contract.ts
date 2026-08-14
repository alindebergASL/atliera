import { isAbsolute, normalize } from "node:path";

import {
  assertExactKeys,
  deepFreezeOwnData,
  sha256CanonicalJson,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";

export const M5B_PRODUCT_REVIEW_REQUEST_KIND = "m5b-product-review-request" as const;
export const M5B_PRODUCT_REVIEW_REQUEST_VERSION = "2" as const;
export const M5B_PRODUCT_REVIEW_SUPERSESSION_EXPLANATION =
  "Supersession preserves the old package bytes and producer identity; it does not rewrite historical provenance." as const;
export const M5B_PRODUCT_REVIEW_ROUTE_STATUS = Object.freeze({
  preferredCurrentRoute: "generic_m5b_product_review" as const,
  legacyFedExRoute: "preserved_historical_reference_behavior" as const,
  legacyBytesMayBeRewritten: false as const,
  legacyValidatorsRemainSupported: true as const,
});
export const M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION =
  "Prepare and review a draft targeted-meeting brief; keep it internal, editable, and unsent." as const;

export const M5B_PRODUCT_REVIEW_LIMITS = Object.freeze({
  requestBytes: 128 * 1024,
  sourceBytesEach: 512 * 1024,
  sourceBytesTotal: 1536 * 1024,
  sourceCountMin: 2,
  sourceCountMax: 4,
  evidenceCountMax: 16,
  proposalCountMax: 12,
  excerptBytesEach: 800,
  excerptBytesTotal: 8 * 1024,
});

const REQUEST_JSON_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 32,
  max_depth: 8,
  max_expanded_json_value_occurrences: 1_024,
  max_nodes: 256,
  max_object_fields: 20,
  max_string_utf8_bytes: 8 * 1024,
  max_total_string_utf8_bytes: 96 * 1024,
});

const HASH_JSON_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 1_024,
  max_depth: 16,
  max_expanded_json_value_occurrences: 32_000,
  max_nodes: 8_000,
  max_object_fields: 64,
  max_string_utf8_bytes: 512 * 1024,
  max_total_string_utf8_bytes: 4 * 1024 * 1024,
});

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const SOURCE_ID = /^src_[a-z0-9][a-z0-9_-]{0,51}$/;
const EVIDENCE_ID = /^evd_[a-z0-9][a-z0-9_-]{0,51}$/;
const PROPOSAL_ID = /^prp_[a-z0-9][a-z0-9_-]{0,51}$/;
const SUBJECT_ID = /^[a-z][a-z0-9_-]{1,63}$/;
const AUTHORIZATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SINGLE_LINE_CONTROL = /[\u0000-\u001f\u007f]/u;
const FORGED_TRUST = /\b(?:independently[ -]verified|human[ -]ratified|quality[ -]passed|durable)\b/iu;
const EFFECTFUL_TASK =
  /\b(?:send|email|forward|share|transmit|dispatch|deliver|contact|call|message|notify|schedule|book|invite|publish|post|upload|submit|deploy|apply|execute|run|trigger|persist|delete|purchase|order|sync|export|reach\s+out|update\s+(?:the\s+)?crm|write\s+to\s+(?:a\s+|the\s+)?(?:graph|database|crm))\b/iu;

export function m5bProductReviewTextClaimsForbiddenTrust(value: string): boolean {
  return FORGED_TRUST.test(value);
}

export function m5bProductReviewTextRequestsEffect(value: string): boolean {
  return EFFECTFUL_TASK.test(value);
}

export type M5bProductReviewSourceKind =
  | "synthetic_fixture"
  | "exact_public_acquisition_custody";
export type M5bProductReviewContentEncoding =
  | "raw_utf8"
  | "m4_public_http_fetch_custody_v1"
  | "exact_sec_archive_custody_v1";
export type M5bProductReviewClassification =
  | "source_fact"
  | "analysis"
  | "recommendation";
export type M5bProductReviewLens = "signal" | "map" | "play";
export type M5bProductReviewEvidenceRole =
  | "account_identity"
  | "account_context"
  | "material_change";

export interface M5bProductReviewSubject {
  readonly teamId: string;
  readonly accountId: string;
  readonly accountName: string;
}

export interface M5bProductReviewAuthority {
  readonly ownerAuthorizationId: string;
  readonly currentEffectiveAuthorization: "none";
  readonly ratificationStatus: "unratified";
  readonly armingStatus: "unarmed";
  readonly applyEligibility: false;
}

export interface M5bProductReviewExecution {
  readonly commit: string;
  readonly tree: string;
  readonly preparedAt: string;
}

export interface M5bProductReviewSupersession {
  readonly supersededPackageResultSha256: string;
  readonly explanation: typeof M5B_PRODUCT_REVIEW_SUPERSESSION_EXPLANATION;
}

export interface M5bProductReviewQuestions {
  readonly whoIsThisAccount: string;
  readonly whatMeaningfullyChanged: string;
  readonly whatMeaningfullyChangedEvidenceBindingIds: readonly string[];
  readonly whyDoesItMatter: string;
  readonly whatNeedsAttention: string;
  readonly safeNextTask: string;
}

export interface M5bProductReviewSourceRequest {
  readonly sourceId: string;
  readonly title: string;
  readonly localPath: string;
  readonly sourceKind: M5bProductReviewSourceKind;
  readonly contentEncoding: M5bProductReviewContentEncoding;
  readonly expectedByteSize: number;
  readonly rawSha256: string;
  readonly decodedByteSize: number;
  readonly decodedSha256: string;
  readonly canonicalUrl: string;
  readonly acquiredAt: string;
  readonly evidenceCurrentThrough: string | null;
  readonly publisher: string;
  readonly sourceType: string;
}

export interface M5bProductReviewEvidenceRequest {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly exactQuote: string;
  readonly evidenceRole: M5bProductReviewEvidenceRole;
}

export interface M5bProductReviewSafeTask {
  readonly kind: "draft_targeted_meeting_brief";
  readonly description: string;
}

export interface M5bProductReviewProposalRequest {
  readonly proposalId: string;
  readonly classification: M5bProductReviewClassification;
  readonly lens: M5bProductReviewLens;
  readonly title: string;
  readonly summary: string;
  readonly evidenceBindingIds: readonly string[];
  readonly supportingProposalIds: readonly string[];
  readonly caveats: readonly string[];
  readonly safeTask: M5bProductReviewSafeTask | null;
}

export interface M5bProductReviewRequest {
  readonly kind: typeof M5B_PRODUCT_REVIEW_REQUEST_KIND;
  readonly schemaVersion: typeof M5B_PRODUCT_REVIEW_REQUEST_VERSION;
  readonly subject: M5bProductReviewSubject;
  readonly authority: M5bProductReviewAuthority;
  readonly execution: M5bProductReviewExecution;
  readonly supersession: M5bProductReviewSupersession;
  readonly customerQuestions: M5bProductReviewQuestions;
  readonly sources: readonly M5bProductReviewSourceRequest[];
  readonly evidenceBindings: readonly M5bProductReviewEvidenceRequest[];
  readonly proposals: readonly M5bProductReviewProposalRequest[];
}

export class M5bProductReviewRefusal extends Error {
  constructor(public readonly code: string) {
    super(`M5b product review refused: ${code}`);
    this.name = "M5bProductReviewRefusal";
  }
}

export function refuseM5bProductReview(code: string): never {
  throw new M5bProductReviewRefusal(code);
}

function objectAt(value: StrictJsonValue | undefined, path: string): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(value as StrictJsonValue, path);
  } catch {
    refuseM5bProductReview("request_shape");
  }
}

function arrayAt(
  value: StrictJsonValue | undefined,
  path: string,
  max: number,
  requireNonEmpty = true,
): StrictJsonValue[] {
  try {
    return strictJsonArray(value, path, max, requireNonEmpty);
  } catch {
    refuseM5bProductReview("request_shape");
  }
}

function exactKeys(
  value: { [key: string]: StrictJsonValue },
  expected: readonly string[],
): void {
  try {
    assertExactKeys(value, expected, "request");
  } catch {
    refuseM5bProductReview("request_shape");
  }
}

function stringAt(
  value: StrictJsonValue | undefined,
  code: string,
  minBytes: number,
  maxBytes: number,
  singleLine = true,
): string {
  if (typeof value !== "string") refuseM5bProductReview(code);
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < minBytes || bytes > maxBytes || value.trim() !== value ||
      (singleLine && SINGLE_LINE_CONTROL.test(value))) {
    refuseM5bProductReview(code);
  }
  return value;
}

function uniqueStrings(
  value: StrictJsonValue | undefined,
  code: string,
  max: number,
  pattern: RegExp,
  allowEmpty: boolean,
): string[] {
  const array = arrayAt(value, code, max, !allowEmpty);
  const out = array.map((item) => stringAt(item, code, 5, 56));
  if (out.some((item) => !pattern.test(item)) || new Set(out).size !== out.length) {
    refuseM5bProductReview(code);
  }
  return out;
}

export function isM5bProductReviewIsoTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value;
}

function parseSubject(value: StrictJsonValue | undefined): M5bProductReviewSubject {
  const object = objectAt(value, "request.subject");
  exactKeys(object, ["teamId", "accountId", "accountName"]);
  const teamId = stringAt(object.teamId, "subject", 2, 64);
  const accountId = stringAt(object.accountId, "subject", 2, 64);
  const accountName = stringAt(object.accountName, "subject", 2, 160);
  if (!SUBJECT_ID.test(teamId) || !SUBJECT_ID.test(accountId) || FORGED_TRUST.test(accountName)) {
    refuseM5bProductReview("subject");
  }
  return { teamId, accountId, accountName };
}

function parseAuthority(value: StrictJsonValue | undefined): M5bProductReviewAuthority {
  const object = objectAt(value, "request.authority");
  exactKeys(object, ["ownerAuthorizationId", "currentEffectiveAuthorization", "ratificationStatus",
    "armingStatus", "applyEligibility"]);
  const ownerAuthorizationId = stringAt(object.ownerAuthorizationId, "owner_authorization", 1, 128);
  if (!AUTHORIZATION_ID.test(ownerAuthorizationId) || object.currentEffectiveAuthorization !== "none" ||
      object.ratificationStatus !== "unratified" || object.armingStatus !== "unarmed" ||
      object.applyEligibility !== false) {
    refuseM5bProductReview("authority");
  }
  return { ownerAuthorizationId, currentEffectiveAuthorization: "none", ratificationStatus: "unratified",
    armingStatus: "unarmed", applyEligibility: false };
}

function parseExecution(value: StrictJsonValue | undefined): M5bProductReviewExecution {
  const object = objectAt(value, "request.execution");
  exactKeys(object, ["commit", "tree", "preparedAt"]);
  const commit = stringAt(object.commit, "execution_identity", 40, 40);
  const tree = stringAt(object.tree, "execution_identity", 40, 40);
  const preparedAt = stringAt(object.preparedAt, "execution_identity", 20, 24);
  if (!GIT_OID.test(commit) || !GIT_OID.test(tree) || !isM5bProductReviewIsoTimestamp(preparedAt)) {
    refuseM5bProductReview("execution_identity");
  }
  return { commit, tree, preparedAt };
}

function parseSupersession(value: StrictJsonValue | undefined): M5bProductReviewSupersession {
  const object = objectAt(value, "request.supersession");
  exactKeys(object, ["supersededPackageResultSha256", "explanation"]);
  const supersededPackageResultSha256 = stringAt(
    object.supersededPackageResultSha256, "supersession", 64, 64,
  );
  if (!SHA256.test(supersededPackageResultSha256) ||
      object.explanation !== M5B_PRODUCT_REVIEW_SUPERSESSION_EXPLANATION) {
    refuseM5bProductReview("supersession");
  }
  return { supersededPackageResultSha256, explanation: M5B_PRODUCT_REVIEW_SUPERSESSION_EXPLANATION };
}

function parseQuestions(value: StrictJsonValue | undefined): M5bProductReviewQuestions {
  const object = objectAt(value, "request.customerQuestions");
  exactKeys(object, ["whoIsThisAccount", "whatMeaningfullyChanged", "whyDoesItMatter",
    "whatNeedsAttention", "safeNextTask", "whatMeaningfullyChangedEvidenceBindingIds"]);
  const questions: M5bProductReviewQuestions = {
    whoIsThisAccount: stringAt(object.whoIsThisAccount, "customer_questions", 12, 1_200),
    whatMeaningfullyChanged: stringAt(object.whatMeaningfullyChanged, "customer_questions", 12, 1_200),
    whatMeaningfullyChangedEvidenceBindingIds: uniqueStrings(
      object.whatMeaningfullyChangedEvidenceBindingIds, "material_change_question",
      M5B_PRODUCT_REVIEW_LIMITS.evidenceCountMax, EVIDENCE_ID, false,
    ),
    whyDoesItMatter: stringAt(object.whyDoesItMatter, "customer_questions", 12, 1_200),
    whatNeedsAttention: stringAt(object.whatNeedsAttention, "customer_questions", 12, 1_200),
    safeNextTask: stringAt(object.safeNextTask, "customer_questions", 12, 1_200),
  };
  for (const answer of [questions.whoIsThisAccount, questions.whatMeaningfullyChanged,
    questions.whyDoesItMatter, questions.whatNeedsAttention, questions.safeNextTask]) {
    if (FORGED_TRUST.test(answer)) refuseM5bProductReview("customer_questions_trust");
  }
  if (questions.safeNextTask !== M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION) {
    refuseM5bProductReview("unsafe_next_task");
  }
  return questions;
}

export function isM5bProductReviewCanonicalHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const canonicalDnsHostname = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u
      .test(hostname);
    const unsafeHostname = hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal") || !canonicalDnsHostname;
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" &&
      parsed.hostname !== "" && parsed.hash === "" && parsed.search === "" && !unsafeHostname &&
      parsed.href === value;
  } catch {
    return false;
  }
}

function parseCanonicalHttpsUrl(value: StrictJsonValue | undefined): string {
  const text = stringAt(value, "source_url", 12, 2_048);
  if (!isM5bProductReviewCanonicalHttpsUrl(text)) refuseM5bProductReview("source_url");
  return text;
}

function parseSource(value: StrictJsonValue, index: number): M5bProductReviewSourceRequest {
  const object = objectAt(value, `request.sources[${index}]`);
  exactKeys(object, ["sourceId", "title", "localPath", "sourceKind", "contentEncoding", "expectedByteSize",
    "rawSha256", "decodedByteSize", "decodedSha256", "canonicalUrl", "acquiredAt",
    "evidenceCurrentThrough", "publisher", "sourceType"]);
  const sourceId = stringAt(object.sourceId, "source_id", 5, 56);
  const title = stringAt(object.title, "source_metadata", 2, 240);
  const localPath = stringAt(object.localPath, "source_path", 1, 2_048);
  const rawSha256 = stringAt(object.rawSha256, "source_identity", 64, 64);
  const decodedSha256 = stringAt(object.decodedSha256, "source_identity", 64, 64);
  const acquiredAt = stringAt(object.acquiredAt, "source_timestamp", 20, 24);
  const publisher = stringAt(object.publisher, "source_metadata", 1, 160);
  const sourceType = stringAt(object.sourceType, "source_metadata", 1, 96);
  const currentThrough = object.evidenceCurrentThrough === null
    ? null
    : stringAt(object.evidenceCurrentThrough, "evidence_currency", 1, 160);
  if (!isAbsolute(localPath) || normalize(localPath) !== localPath) refuseM5bProductReview("source_path");
  if (!SOURCE_ID.test(sourceId) ||
      (object.sourceKind !== "synthetic_fixture" && object.sourceKind !== "exact_public_acquisition_custody") ||
      (object.contentEncoding !== "raw_utf8" && object.contentEncoding !== "m4_public_http_fetch_custody_v1" &&
        object.contentEncoding !== "exact_sec_archive_custody_v1") ||
      !Number.isSafeInteger(object.expectedByteSize) || typeof object.expectedByteSize !== "number" ||
      object.expectedByteSize <= 0 || object.expectedByteSize > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
      !Number.isSafeInteger(object.decodedByteSize) || typeof object.decodedByteSize !== "number" ||
      object.decodedByteSize <= 0 || object.decodedByteSize > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
      !SHA256.test(rawSha256) || !SHA256.test(decodedSha256) ||
      !isM5bProductReviewIsoTimestamp(acquiredAt)) {
    refuseM5bProductReview("source_identity");
  }
  if (object.contentEncoding === "raw_utf8" &&
      (object.expectedByteSize !== object.decodedByteSize || rawSha256 !== decodedSha256)) {
    refuseM5bProductReview("raw_source_decoded_identity");
  }
  if ((object.sourceKind === "exact_public_acquisition_custody") !==
      (object.contentEncoding !== "raw_utf8")) {
    if (!(object.sourceKind === "synthetic_fixture" && object.contentEncoding === "m4_public_http_fetch_custody_v1")) {
      refuseM5bProductReview("source_classification_encoding");
    }
  }
  return {
    sourceId,
    title,
    localPath,
    sourceKind: object.sourceKind,
    contentEncoding: object.contentEncoding,
    expectedByteSize: object.expectedByteSize,
    rawSha256,
    decodedByteSize: object.decodedByteSize,
    decodedSha256,
    canonicalUrl: parseCanonicalHttpsUrl(object.canonicalUrl),
    acquiredAt,
    evidenceCurrentThrough: currentThrough,
    publisher,
    sourceType,
  };
}

function parseEvidence(value: StrictJsonValue, index: number): M5bProductReviewEvidenceRequest {
  const object = objectAt(value, `request.evidenceBindings[${index}]`);
  exactKeys(object, ["evidenceId", "sourceId", "exactQuote", "evidenceRole"]);
  const evidenceId = stringAt(object.evidenceId, "evidence_id", 5, 56);
  const sourceId = stringAt(object.sourceId, "evidence_source", 5, 56);
  const exactQuote = stringAt(object.exactQuote, "evidence_quote", 8,
    M5B_PRODUCT_REVIEW_LIMITS.excerptBytesEach);
  if (!EVIDENCE_ID.test(evidenceId) || !SOURCE_ID.test(sourceId) ||
      (object.evidenceRole !== "account_identity" && object.evidenceRole !== "account_context" &&
        object.evidenceRole !== "material_change")) {
    refuseM5bProductReview("evidence_binding");
  }
  return { evidenceId, sourceId, exactQuote, evidenceRole: object.evidenceRole };
}

const LEGAL_ENTITY_SUFFIXES = new Set([
  "ag", "bv", "co", "company", "corp", "corporation", "gmbh", "group", "holdings", "inc",
  "incorporated", "limited", "llc", "lp", "ltd", "nv", "plc", "sa", "se",
]);
const IDENTITY_LABEL_TOKENS = new Set([
  "a", "account", "alias", "an", "as", "b", "business", "called", "charter", "corporate", "d",
  "delaware", "doing", "domestic", "entity", "exact", "foreign", "formation", "formed", "formerly",
  "in", "incorporation", "is", "issuer", "its", "jurisdiction", "known", "laws", "legal", "name", "of",
  "organisation", "organization", "registrant", "s", "specified", "state", "the", "under",
]);
const IDENTITY_METADATA_TAIL = /\b(?:cik|lei|nasdaq|nyse|ticker)\b.*$/giu;
const EXPLICIT_STATIC_CLASSIFICATION_LABEL =
  /(?:\b(?:business\s+(?:category|classification|description|type)|industry|sector)\b\s*(?::|=|[—–-]|\bis\b|\bcode\b)|\b(?:naics|sic)\b(?:\s+code)?\s*(?::|=|#)?\s*\d)/iu;
const IDENTITY_NAME_LABEL_WORDS = new Set([
  "account", "business", "company", "corporate", "entity", "issuer", "legal", "registrant",
]);
const SHORT_IDENTITY_LABEL_WORDS = new Set([
  "exact", "issuer", "legal", "registrant", "s", "the",
]);
const MATERIAL_CHANGE_MARKER_WORDS = new Set([
  "acquire", "acquired", "acquires", "acquiring", "acquisition", "acquisitions", "adopt", "adopted",
  "adopting", "adoption", "adopts", "appoint", "appointed", "appointing", "appointment", "appointments",
  "appoints", "bankrupt", "bankruptcy", "breach", "breached", "breaches", "cancel", "canceled",
  "cancelled", "cancellation", "cancels", "change", "changed", "changes", "changing", "close", "closed",
  "closes", "closing", "closure", "closures", "complete", "completed", "completes", "completion",
  "consolidate", "consolidated", "consolidates", "consolidation", "cut", "cuts", "decrease", "decreased",
  "decreases", "depart", "departed", "departure", "discontinue", "discontinued", "discontinues", "disrupt",
  "disrupted", "disruption", "disruptions", "divest", "divested", "divestiture", "expand", "expanded",
  "expanding", "expands", "expansion", "increase", "increased", "increases", "introduce", "introduced",
  "introduces", "introduction", "invest", "invested", "launch", "launched", "launches", "layoff", "layoffs",
  "merge", "merged", "merger", "merges", "open", "opened", "opening", "opens", "outage", "outages",
  "partnered", "partnership", "pivot", "pivoted", "pivoting", "pivots", "promote", "promoted", "promotion",
  "recall", "recalled", "recalls", "reconfigure", "reconfigured", "reconfiguration", "reduce", "reduced",
  "reduces", "reduction", "reorganize", "reorganized", "reorganization", "replace", "replaced", "replacement",
  "replaces", "resign", "resigned", "resignation", "resigns", "restate", "restated", "restatement",
  "restructure", "restructured", "restructures", "restructuring", "retire", "retired", "retirement", "retires",
  "rise", "rose", "sale", "sell", "sells", "sold", "suspend", "suspended", "suspension", "terminate",
  "terminated", "terminates", "termination", "transition", "transitioned", "transitions",
]);
const MATERIAL_CHANGE_FINITE_ACTION_WORDS = new Set([
  "acquired", "acquires", "adopted", "adopts", "appointed", "appoints", "breached", "breaches",
  "canceled", "cancelled", "cancels", "changed", "changes", "closed", "closes", "completed",
  "completes", "consolidated", "consolidates", "cut", "cuts", "decreased", "decreases", "departed",
  "discontinued", "discontinues", "disrupted", "divested", "expanded", "expands", "increased", "increases",
  "introduced", "introduces", "invested", "launched", "launches", "merged", "merges", "opened", "opens",
  "partnered", "pivoted", "pivots", "promoted", "recalled", "recalls", "reconfigured", "reduced", "reduces",
  "reorganized", "replaced", "replaces", "resigned", "resigns", "restated", "restructured", "restructures",
  "retired", "retires", "rose", "sells", "sold", "suspended", "terminated", "terminates", "transitioned",
  "transitions",
]);
const MATERIAL_CHANGE_BASE_ACTION_WORDS = new Set([
  "acquire", "adopt", "appoint", "breach", "cancel", "change", "close", "complete", "consolidate",
  "decrease", "depart", "discontinue", "disrupt", "divest", "expand", "increase", "introduce", "invest",
  "launch", "merge", "open", "pivot", "promote", "recall", "reconfigure", "reduce", "reorganize", "replace",
  "resign", "restate", "restructure", "retire", "sell", "suspend", "terminate", "transition",
]);
const MATERIAL_CHANGE_PARTICIPLE_WORDS = new Set([
  "acquiring", "adopting", "appointing", "changing", "closing", "expanding", "pivoting", "restructuring",
]);
const MATERIAL_CHANGE_AUXILIARY_WORDS = new Set([
  "am", "are", "be", "been", "being", "can", "could", "did", "do", "does", "had", "has", "have", "is",
  "may", "might", "must", "shall", "should", "to", "was", "were", "will", "would",
]);
const MATERIAL_CHANGE_EVENT_NOUN_WORDS = new Set([
  "acquisition", "acquisitions", "adoption", "appointment", "appointments", "bankruptcy", "breach",
  "cancellation", "change", "changes", "closure", "closures", "completion", "consolidation", "departure",
  "disruption", "disruptions", "divestiture", "expansion", "introduction", "layoff", "layoffs", "merger",
  "opening", "outage", "outages", "partnership", "promotion", "reconfiguration", "reduction", "reorganization",
  "replacement", "resignation", "restatement", "restructuring", "retirement", "rise", "sale", "suspension",
  "termination", "transition",
]);
const MATERIAL_CHANGE_EVENT_CONNECTORS = new Set([
  "across", "after", "among", "as", "at", "between", "by", "during", "following", "for", "from", "in",
  "into", "of", "on", "over", "throughout", "to", "under", "with",
]);
const MATERIAL_CHANGE_REPORT_WORDS = new Set([
  "announce", "announced", "announces", "announcing", "disclose", "disclosed", "discloses", "report",
  "reported", "reports",
]);
const STATIC_LEGAL_OR_DESCRIPTOR_TAILS = new Set([
  ...LEGAL_ENTITY_SUFFIXES, "companies", "consulting", "enterprises", "industries", "industry", "logistics",
  "network", "networks", "partners", "services", "software", "solutions", "systems", "technologies",
  "technology", "transportation",
]);

function normalizedAccountIdentity(value: string): string {
  const tokens = (value.normalize("NFKD").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => !LEGAL_ENTITY_SUFFIXES.has(token) && !IDENTITY_LABEL_TOKENS.has(token))
    .filter((token, index, all) => all.indexOf(token) === index);
  return tokens.join(" ");
}

function normalizedAccountIdentityVariants(value: string, identityField: boolean): ReadonlySet<string> {
  const withoutQualifiers = identityField
    ? value.replace(/\([^)]*\)|\[[^\]]*\]/gu, " ")
    : value.replace(/(?:\(|\[)\s*(?:(?:[Cc][Ii][Kk]|[Ll][Ee][Ii]|[Nn][Aa][Ss][Dd][Aa][Qq]|[Nn][Yy][Ss][Ee]|[Tt][Ii][Cc][Kk][Ee][Rr])\b[^)\]]*|[Ff]ictional|[A-Z0-9._-]{1,20})\s*(?:\)|\])/gu,
      " ");
  const withoutDelimitedMetadata = identityField
    ? value.replace(/[/|].*$/u, " ")
    : value.replace(/\s*[/|]\s*[A-Z0-9._-]{1,20}\s*$/u, " ");
  const withoutLeadingMetadataLabel = value.replace(
    /^\s*(?:cik|lei|nasdaq|nyse|ticker)\b\s*:?\s*/iu, "");
  const withoutLeadingMetadataValue = withoutLeadingMetadataLabel === value ? value :
    withoutLeadingMetadataLabel.replace(/^[\p{L}\p{N}._-]+\s*(?:[:/|—–-])\s*/u, "");
  return new Set([value, withoutQualifiers, withoutDelimitedMetadata, withoutLeadingMetadataLabel,
    withoutLeadingMetadataValue,
    value.replace(IDENTITY_METADATA_TAIL, " "), withoutQualifiers.replace(IDENTITY_METADATA_TAIL, " "),
    withoutDelimitedMetadata.replace(IDENTITY_METADATA_TAIL, " ")]
    .map(normalizedAccountIdentity)
    .filter((identity) => identity.length > 0));
}

function normalizedQuoteWords(value: string): readonly string[] {
  return value.normalize("NFKD").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isExplicitIdentityLabel(value: string): boolean {
  for (const delimiter of value.matchAll(/:|=|[—–-]|\bis\b/giu)) {
    if (delimiter.index === undefined || delimiter.index > 120) break;
    const prefixWords = normalizedQuoteWords(value.slice(0, delimiter.index));
    if (prefixWords.length === 0 || prefixWords.length > 16) continue;
    if (prefixWords.includes("name") &&
        prefixWords.some((word) => IDENTITY_NAME_LABEL_WORDS.has(word))) return true;
    if (prefixWords.some((word) => word === "issuer" || word === "registrant") &&
        prefixWords.every((word) => SHORT_IDENTITY_LABEL_WORDS.has(word))) return true;
  }
  return false;
}

function hasMaterialChangeAction(words: readonly string[]): boolean {
  return words.some((word, index) => index > 0 && (
    MATERIAL_CHANGE_FINITE_ACTION_WORDS.has(word) ||
    ((MATERIAL_CHANGE_BASE_ACTION_WORDS.has(word) || MATERIAL_CHANGE_PARTICIPLE_WORDS.has(word)) &&
      MATERIAL_CHANGE_AUXILIARY_WORDS.has(words[index - 1]!))
  ));
}

function hasConnectedMaterialChangeEvent(words: readonly string[]): boolean {
  return words.some((word, index) => MATERIAL_CHANGE_EVENT_NOUN_WORDS.has(word) &&
    MATERIAL_CHANGE_EVENT_CONNECTORS.has(words[index + 1] ?? ""));
}

function hasReportedMaterialChangeEvent(words: readonly string[]): boolean {
  return words.some((word, index) => MATERIAL_CHANGE_EVENT_NOUN_WORDS.has(word) &&
    words.slice(Math.max(1, index - 8), index).some((prefix) => MATERIAL_CHANGE_REPORT_WORDS.has(prefix)));
}

export function assertM5bProductReviewMaterialChangeQuote(
  accountName: string,
  exactQuote: string,
): void {
  const quoteIdentities = normalizedAccountIdentityVariants(exactQuote, false);
  const subjectIdentities = normalizedAccountIdentityVariants(accountName, true);
  const quoteWords = normalizedQuoteWords(exactQuote);
  if (quoteIdentities.size === 0) refuseM5bProductReview("material_change_uninformative");
  if (EXPLICIT_STATIC_CLASSIFICATION_LABEL.test(exactQuote) || isExplicitIdentityLabel(exactQuote)) {
    refuseM5bProductReview("material_change_identity_only");
  }
  if ([...quoteIdentities].some((identity) => subjectIdentities.has(identity))) {
    refuseM5bProductReview("material_change_identity_only");
  }
  const hasMarker = quoteWords.some((word) => MATERIAL_CHANGE_MARKER_WORDS.has(word));
  if (!hasMarker) {
    refuseM5bProductReview("material_change_identity_only");
  }
  if (quoteWords.length === 1) refuseM5bProductReview("material_change_uninformative");

  const hasAction = hasMaterialChangeAction(quoteWords);
  const hasConnectedEvent = hasConnectedMaterialChangeEvent(quoteWords);
  const hasReportedEvent = hasReportedMaterialChangeEvent(quoteWords);
  // A connected noun phrase can itself be a legal name when it ends in a static descriptor.
  // Such a tail requires an action clause or a non-leading reporting construction.
  if (STATIC_LEGAL_OR_DESCRIPTOR_TAILS.has(quoteWords.at(-1)!) && !hasAction && !hasReportedEvent) {
    refuseM5bProductReview("material_change_identity_only");
  }
  // This is bounded syntactic admission, not semantic proof of materiality. A finite action,
  // connected event noun, or reporting verb plus event noun is required; weak reporting/planning
  // language alone is deliberately insufficient.
  if (!hasAction && !hasConnectedEvent && !hasReportedEvent) {
    refuseM5bProductReview("material_change_identity_only");
  }
}

function parseSafeTask(value: StrictJsonValue | undefined): M5bProductReviewSafeTask {
  const object = objectAt(value, "request.proposal.safeTask");
  exactKeys(object, ["kind", "description"]);
  const description = stringAt(object.description, "safe_task", 12, 500);
  if (object.kind !== "draft_targeted_meeting_brief" ||
      description !== M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION || EFFECTFUL_TASK.test(description) ||
      FORGED_TRUST.test(description) || !/\bbrief\b/iu.test(description)) {
    refuseM5bProductReview("safe_task");
  }
  return { kind: "draft_targeted_meeting_brief", description };
}

function parseProposal(value: StrictJsonValue, index: number): M5bProductReviewProposalRequest {
  const object = objectAt(value, `request.proposals[${index}]`);
  exactKeys(object, ["proposalId", "classification", "lens", "title", "summary", "evidenceBindingIds",
    "supportingProposalIds", "caveats", "safeTask"]);
  const proposalId = stringAt(object.proposalId, "proposal_id", 5, 56);
  const title = stringAt(object.title, "proposal_text", 8, 1_200);
  const summary = stringAt(object.summary, "proposal_text", 20, 1_200);
  if (!PROPOSAL_ID.test(proposalId) ||
      (object.classification !== "source_fact" && object.classification !== "analysis" &&
        object.classification !== "recommendation") ||
      (object.lens !== "signal" && object.lens !== "map" && object.lens !== "play")) {
    refuseM5bProductReview("proposal_shape");
  }
  const evidenceBindingIds = uniqueStrings(object.evidenceBindingIds, "proposal_evidence",
    M5B_PRODUCT_REVIEW_LIMITS.evidenceCountMax, EVIDENCE_ID, false);
  const supportingProposalIds = uniqueStrings(object.supportingProposalIds, "proposal_dependencies",
    M5B_PRODUCT_REVIEW_LIMITS.proposalCountMax, PROPOSAL_ID, true);
  const caveatValues = arrayAt(object.caveats, "proposal_caveats", 4,
    object.classification !== "source_fact");
  const caveats = caveatValues.map((item) => stringAt(item, "proposal_caveats", 8, 500));
  if (caveats.some((caveat) => FORGED_TRUST.test(caveat))) {
    refuseM5bProductReview("proposal_trust_claim");
  }
  const safeTask = object.safeTask === null ? null : parseSafeTask(object.safeTask);
  return {
    proposalId,
    classification: object.classification,
    lens: object.lens,
    title,
    summary,
    evidenceBindingIds,
    supportingProposalIds,
    caveats,
    safeTask,
  };
}

function validateRequestRelationships(request: M5bProductReviewRequest): void {
  const sourceIds = new Set(request.sources.map((source) => source.sourceId));
  if (sourceIds.size !== request.sources.length) refuseM5bProductReview("duplicate_source_id");
  const evidenceIds = new Set(request.evidenceBindings.map((binding) => binding.evidenceId));
  if (evidenceIds.size !== request.evidenceBindings.length) refuseM5bProductReview("duplicate_evidence_id");
  const proposalIds = new Set(request.proposals.map((proposal) => proposal.proposalId));
  if (proposalIds.size !== request.proposals.length) refuseM5bProductReview("duplicate_proposal_id");

  let excerptBytes = 0;
  const evidenceById = new Map(request.evidenceBindings.map((binding) => [binding.evidenceId, binding]));
  for (const binding of request.evidenceBindings) {
    excerptBytes += Buffer.byteLength(binding.exactQuote, "utf8");
    if (!sourceIds.has(binding.sourceId)) refuseM5bProductReview("evidence_source");
    if (binding.evidenceRole === "material_change") {
      assertM5bProductReviewMaterialChangeQuote(request.subject.accountName, binding.exactQuote);
    }
  }
  if (excerptBytes > M5B_PRODUCT_REVIEW_LIMITS.excerptBytesTotal) {
    refuseM5bProductReview("evidence_budget");
  }
  for (const sourceId of sourceIds) {
    if (!request.evidenceBindings.some((binding) => binding.sourceId === sourceId)) {
      refuseM5bProductReview("source_without_evidence");
    }
  }
  for (const evidenceId of evidenceIds) {
    if (!request.proposals.some((proposal) => proposal.evidenceBindingIds.includes(evidenceId))) {
      refuseM5bProductReview("unused_evidence_binding");
    }
  }

  const proposalsById = new Map(request.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const classifications = new Set(request.proposals.map((proposal) => proposal.classification));
  const lenses = new Set(request.proposals.map((proposal) => proposal.lens));
  if (!["source_fact", "analysis", "recommendation"].every((value) => classifications.has(value as M5bProductReviewClassification)) ||
      !["signal", "map", "play"].every((value) => lenses.has(value as M5bProductReviewLens))) {
    refuseM5bProductReview("product_first_minimum");
  }
  if (new Set(request.proposals.map((proposal) => proposal.summary)).size !== request.proposals.length) {
    refuseM5bProductReview("useful_lenses");
  }

  const transitiveEvidence = (proposal: M5bProductReviewProposalRequest, visiting = new Set<string>()): Set<string> => {
    if (visiting.has(proposal.proposalId)) refuseM5bProductReview("proposal_dependency_cycle");
    const next = new Set(visiting).add(proposal.proposalId);
    const out = new Set<string>(proposal.evidenceBindingIds);
    for (const dependencyId of proposal.supportingProposalIds) {
      const dependency = proposalsById.get(dependencyId);
      if (!dependency) refuseM5bProductReview("proposal_dependency");
      for (const evidenceId of transitiveEvidence(dependency, next)) out.add(evidenceId);
    }
    return out;
  };

  const materialEvidenceIds = new Set(request.evidenceBindings
    .filter((binding) => binding.evidenceRole === "material_change")
    .map((binding) => binding.evidenceId));
  if (materialEvidenceIds.size === 0) refuseM5bProductReview("material_change_evidence");
  const sourceKindById = new Map(request.sources.map((source) => [source.sourceId, source.sourceKind]));
  if (request.sources.some((source) => source.sourceKind === "exact_public_acquisition_custody") &&
      [...materialEvidenceIds].some((id) =>
        sourceKindById.get(evidenceById.get(id)!.sourceId) !== "exact_public_acquisition_custody")) {
    refuseM5bProductReview("material_change_source_classification");
  }
  if (request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds.some((id) =>
    !materialEvidenceIds.has(id))) {
    refuseM5bProductReview("material_change_question");
  }

  const materialSignals = request.proposals.filter((proposal) =>
    proposal.classification === "source_fact" && proposal.lens === "signal" &&
    proposal.evidenceBindingIds.length === 1 && materialEvidenceIds.has(proposal.evidenceBindingIds[0]!));
  if (materialSignals.length === 0 || request.proposals.some((proposal) =>
    proposal.classification === "source_fact" && proposal.lens === "signal" &&
    !materialEvidenceIds.has(proposal.evidenceBindingIds[0]!))) {
    refuseM5bProductReview("material_change_signal");
  }
  const materialEvidenceBySignalId = new Map(materialSignals.map((proposal) =>
    [proposal.proposalId, proposal.evidenceBindingIds[0]!]));
  const materialAnalyses = request.proposals.filter((proposal) =>
    proposal.classification === "analysis" && proposal.lens === "map" &&
    proposal.supportingProposalIds.some((id) => {
      const materialEvidenceId = materialEvidenceBySignalId.get(id);
      return materialEvidenceId !== undefined && proposal.evidenceBindingIds.includes(materialEvidenceId);
    }));
  if (materialAnalyses.length === 0) refuseM5bProductReview("material_change_analysis");
  const materialEvidenceByAnalysisId = new Map(materialAnalyses.map((proposal) => [
    proposal.proposalId,
    new Set(proposal.supportingProposalIds
      .map((id) => materialEvidenceBySignalId.get(id))
      .filter((id): id is string => id !== undefined && proposal.evidenceBindingIds.includes(id))),
  ]));
  const qualifyingMaterialEvidenceIds = new Set(
    [...materialEvidenceByAnalysisId.values()].flatMap((ids) => [...ids]),
  );
  if (request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds.some((id) =>
    !qualifyingMaterialEvidenceIds.has(id))) {
    refuseM5bProductReview("material_change_question");
  }
  const plays = request.proposals.filter((proposal) => proposal.classification === "recommendation");
  const questionMaterialEvidenceIds = new Set(
    request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds,
  );
  if (plays.length === 0 || plays.some((proposal) =>
    !proposal.supportingProposalIds.some((id) => {
      const analysisMaterialEvidence = materialEvidenceByAnalysisId.get(id);
      return analysisMaterialEvidence !== undefined &&
        proposal.evidenceBindingIds.some((evidenceId) =>
          analysisMaterialEvidence.has(evidenceId) && questionMaterialEvidenceIds.has(evidenceId));
    }))) {
    refuseM5bProductReview("material_change_play");
  }

  for (const proposal of request.proposals) {
    if (proposal.evidenceBindingIds.length === 0 ||
        proposal.evidenceBindingIds.some((id) => !evidenceIds.has(id))) {
      refuseM5bProductReview("proposal_evidence");
    }
    if (proposal.classification === "source_fact") {
      if (proposal.supportingProposalIds.length !== 0 || proposal.caveats.length !== 0 ||
          proposal.safeTask !== null || proposal.lens === "play" || proposal.evidenceBindingIds.length !== 1) {
        refuseM5bProductReview("source_fact_classification");
      }
      const evidence = evidenceById.get(proposal.evidenceBindingIds[0]!)!;
      if (proposal.summary !== `Source states: ${evidence.exactQuote}` || proposal.title !== proposal.summary) {
        refuseM5bProductReview("source_fact_attribution");
      }
      continue;
    }
    if (Buffer.byteLength(proposal.title, "utf8") > 180 || FORGED_TRUST.test(proposal.title) ||
        FORGED_TRUST.test(proposal.summary)) {
      refuseM5bProductReview("proposal_trust_claim");
    }
    if (proposal.supportingProposalIds.length === 0 || proposal.caveats.length === 0 ||
        proposal.supportingProposalIds.includes(proposal.proposalId)) {
      refuseM5bProductReview("proposal_dependencies");
    }
    const dependencies = proposal.supportingProposalIds.map((id) => proposalsById.get(id));
    if (dependencies.some((dependency) => dependency === undefined || dependency.classification === "recommendation")) {
      refuseM5bProductReview("proposal_dependency");
    }
    const supportedEvidence = new Set<string>();
    for (const dependency of dependencies) {
      for (const evidenceId of transitiveEvidence(dependency!)) supportedEvidence.add(evidenceId);
    }
    if (proposal.evidenceBindingIds.some((id) => !supportedEvidence.has(id))) {
      refuseM5bProductReview("proposal_evidence_dependency");
    }
    if (proposal.classification === "analysis") {
      if (proposal.safeTask !== null || proposal.lens === "play" ||
          dependencies.some((dependency) => dependency?.classification !== "source_fact")) {
        refuseM5bProductReview("analysis_classification");
      }
    } else if (proposal.safeTask === null || proposal.lens !== "play" ||
        !/\bdraft\b/iu.test(proposal.title) || !/\bbrief\b/iu.test(proposal.title) ||
        !dependencies.some((dependency) => dependency?.classification === "analysis") ||
        EFFECTFUL_TASK.test(proposal.title) || EFFECTFUL_TASK.test(proposal.summary)) {
      refuseM5bProductReview("recommendation_classification");
    }
  }
}

export function validateM5bProductReviewRequest(raw: unknown): Readonly<M5bProductReviewRequest> {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "request", REQUEST_JSON_LIMITS);
  } catch {
    refuseM5bProductReview("request_plain_data");
  }
  const root = objectAt(snapshot, "request");
  exactKeys(root, ["kind", "schemaVersion", "subject", "authority", "execution", "supersession",
    "customerQuestions", "sources", "evidenceBindings", "proposals"]);
  if (root.kind !== M5B_PRODUCT_REVIEW_REQUEST_KIND || root.schemaVersion !== M5B_PRODUCT_REVIEW_REQUEST_VERSION) {
    refuseM5bProductReview("request_version");
  }
  const sourceValues = arrayAt(root.sources, "request.sources", M5B_PRODUCT_REVIEW_LIMITS.sourceCountMax);
  if (sourceValues.length < M5B_PRODUCT_REVIEW_LIMITS.sourceCountMin) refuseM5bProductReview("source_count");
  const evidenceValues = arrayAt(root.evidenceBindings, "request.evidenceBindings",
    M5B_PRODUCT_REVIEW_LIMITS.evidenceCountMax);
  const proposalValues = arrayAt(root.proposals, "request.proposals", M5B_PRODUCT_REVIEW_LIMITS.proposalCountMax);
  const request: M5bProductReviewRequest = {
    kind: M5B_PRODUCT_REVIEW_REQUEST_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_REQUEST_VERSION,
    subject: parseSubject(root.subject),
    authority: parseAuthority(root.authority),
    execution: parseExecution(root.execution),
    supersession: parseSupersession(root.supersession),
    customerQuestions: parseQuestions(root.customerQuestions),
    sources: sourceValues.map(parseSource),
    evidenceBindings: evidenceValues.map(parseEvidence),
    proposals: proposalValues.map(parseProposal),
  };
  const expectedSourceBytes = request.sources.reduce((total, source) =>
    total + source.expectedByteSize, 0);
  const expectedDecodedBytes = request.sources.reduce((total, source) =>
    total + source.decodedByteSize, 0);
  if (!Number.isSafeInteger(expectedSourceBytes) || !Number.isSafeInteger(expectedDecodedBytes) ||
      expectedSourceBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal ||
      expectedDecodedBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal) {
    refuseM5bProductReview("source_budget");
  }
  validateRequestRelationships(request);
  return deepFreezeOwnData(request);
}

export function m5bProductReviewCanonicalSha256(value: unknown): string {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(value, "hash_input", HASH_JSON_LIMITS);
  } catch {
    refuseM5bProductReview("canonical_hash_input");
  }
  return sha256CanonicalJson(snapshot);
}
