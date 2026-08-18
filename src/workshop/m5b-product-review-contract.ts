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
const FORGED_TRUST =
  /\b(?:(?:independently|human|quality)[ -](?:verified|ratified|passed)|durable|apply[ -]eligible)\b/iu;
const WORKFLOW_TRUST_SUBJECT =
  /\b(?:system|owner|reviewer|human|workflow|package|artifact|candidate|proposal|brief|record|execution|operation|task)\b/iu;
const WORKFLOW_TRUST_STATUS =
  /\b(?:approval|approved|authorization|authorized|verification|verified|ratification|ratified|armed|apply[ -]eligible|applied|persistence|persisted|deployment|deployed|cleared)\b/iu;
const PASSIVE_OR_BANNER_TRUST =
  /(?:^\s*(?:approved|authorized|verified|ratified|armed|applied|persisted|deployed)\b|\b(?:has|have|had|is|was|were|been)\s+(?:already\s+|now\s+)?(?:approved|authorized|verified|ratified|armed|applied|persisted|deployed)\b)/iu;
const TRUST_OUTCOME_BANNER =
  /(?:^\s*(?:approval|authorization|verification|ratification|review|(?:(?:human|owner|reviewer|system)[ -])?sign[ -]?off|quality[ -]review|owner[ -]consent)\s+(?:granted|complete|confirmed|obtained|passed|received)\b|^\s*(?:approval|authorization|ratification|review)\s+(?:is|was)\s+(?:complete|granted|passed)\b|^\s*(?:ready\s+(?:for\s+(?:apply|deployment|use)|to\s+go\s+live)|production[ -]ready|cleared\s+for\s+deployment|all\s+checks\s+green)\b)/iu;
const WORKFLOW_TRUST_CLAIM =
  /(?:\b(?:the\s+)?(?:artifact|brief|candidate|package|proposal|record)\s+(?:has|had)\s+(?:owner[ -]|reviewer[ -])?sign[ -]off\b|\b(?:the\s+)?(?:human|owner|reviewer|system)\s+(?:has\s+)?signed\s+off\b|\b(?:the\s+)?(?:artifact|brief|candidate|package|proposal|record)\s+(?:has\s+)?passed\s+(?:human\s+|owner\s+|quality\s+)?review\b|\b(?:the\s+)?package\s+is\s+good\s+to\s+go\b|\b(?:the\s+)?candidate\s+meets\s+the\s+quality\s+gate\b)/iu;
const EFFECT_ACTION = String.raw`(?:send(?:s|ing)?|sent|email(?:s|ed|ing)?|forward(?:s|ed|ing)?|share(?:s|d|ing)?|transmit(?:s|ted|ting)?|dispatch(?:es|ed|ing)?|deliver(?:s|ed|ing)?|contact(?:s|ed|ing)?|call(?:s|ed|ing)?|message(?:s|d|ing)?|notif(?:y|ies|ied|ying)|schedul(?:e|es|ed|ing)|book(?:s|ed|ing)?|invite(?:s|d|ing)?|publish(?:es|ed|ing)?|post(?:s|ed|ing)?|upload(?:s|ed|ing)?|submit(?:s|ted|ting)?|deploy(?:s|ed|ing)?|appl(?:y|ies|ied|ying)|execut(?:e|es|ed|ing)|run(?:s|ning)?|ran|trigger(?:s|ed|ing)?|persist(?:s|ed|ing)?|delet(?:e|es|ed|ing)|purchas(?:e|es|ed|ing)|order(?:s|ed|ing)?|sync(?:s|ed|ing)?|export(?:s|ed|ing)?|reach(?:es|ed|ing)?\s+out|updat(?:e|es|ed|ing)\s+(?:the\s+)?crm|writ(?:e|es|ing|ten)\s+to\s+(?:a\s+|the\s+)?(?:graph|database|crm))`;
const EFFECT_UNAMBIGUOUS_BASE_ACTION =
  String.raw`(?:notify|invite|publish|upload|submit|deploy|apply|execute|trigger|persist|delete|sync|reach\s+out|update\s+(?:the\s+)?crm|write\s+to\s+(?:a\s+|the\s+)?(?:graph|database|crm)|ratify|approve|authorize|sign\s+off)`;
const EFFECT_AMBIGUOUS_BASE_ACTION =
  String.raw`(?:send|email|forward|share|transmit|dispatch|deliver|contact|call|message|schedule|book|post|purchase|order|run|export)`;
const EFFECT_IMPERATIVE_OBJECT =
  String.raw`(?:a|an|it|this|that|the|account|artifact|brief|candidate|customer|client|file|meeting|message|package|proposal|record|asap|externally|now|tomorrow)`;
const EFFECT_IMPERATIVE =
  String.raw`(?:^|[.!?;:]\s*)(?:please\s+|now\s+)?(?:${EFFECT_UNAMBIGUOUS_BASE_ACTION}\b|${EFFECT_AMBIGUOUS_BASE_ACTION}\s+${EFFECT_IMPERATIVE_OBJECT}\b|mark\s+${EFFECT_IMPERATIVE_OBJECT}\s+approved\b)`;
const EFFECT_NAMED_CONTACT_DIRECTIVE =
  /(?:^|[.!?;:]\s*)(?:[Cc]all|[Cc]ontact|[Ee]mail|[Mm]essage)\s+\p{Lu}[\p{L}\p{N}.'’_-]{1,80}\b/u;
const EFFECT_STRUCTURED_DIRECTIVE =
  /(?:^|[.!?;:]\s*)(?:arm\s+(?:this|that|the)?\s*package\b|enable\s+deployment\b|turn\s+on\s+persistence\b|grant\s+approval\b|set\s+current\s+effective\s+authorization\s+to\b|(?:record|insert)\s+this\s+(?:in|into)\s+(?:the\s+)?graph\b|(?:save|store)\s+this\s+(?:in|to)\s+(?:the\s+)?database\b)/iu;
const EFFECT_DIRECTIVE = new RegExp(
  String.raw`(?:${EFFECT_IMPERATIVE}|\b(?:let['’]s|can\s+you|could\s+you|would\s+you|can\s+we|could\s+we|would\s+we|please(?:\s+consider)?|(?:i|we)\s+(?:recommend|advise|suggest))\s+(?:now\s+)?(?:be\s+)?${EFFECT_ACTION}\b|\byou\s+(?:can|could|may|might|must|should|will|would)\s+(?:now\s+)?(?:be\s+)?${EFFECT_ACTION}\b|\b(?:must|should|shall|need(?:s|ed)?\s+to|required\s+to|authorized\s+to|approved\s+to|ready\s+to|(?:are|is)\s+to)\s+(?:now\s+)?(?:be\s+)?${EFFECT_ACTION}\b|\b${EFFECT_ACTION}\b[\s\S]{0,80}\b(?:immediately|right\s+now|recommended|advised|required\s+(?:next\s+)?(?:step|action)|next\s+(?:step|action))\b|\b(?:recommended|advised|required\s+(?:next\s+)?(?:step|action)|next\s+(?:step|action))\b[\s\S]{0,80}\b${EFFECT_ACTION}\b|\bproceed\s+with\s+(?:apply|deployment|execution|publication|submission)\b|\bpush\b[\s\S]{0,40}\b(?:live|production)\b|\bgo\s+ahead\s+and\s+${EFFECT_ACTION}\b|\bit\s+is\s+time\s+to\s+${EFFECT_ACTION}\b|\bplease\s+arrange\s+to\s+${EFFECT_ACTION}\b|\bnext\s+move\s+is\s+(?:apply|deployment|execution|publication|submission)\b|\b(?:apply|deployment|execution|persistence|publication|submission)\s+(?:is|remains)\s+(?:the\s+)?(?:approved|authorized|required|recommended)\s+(?:next\s+)?(?:action|move|step)\b)`,
  "iu",
);
const DESCRIPTIVE_ACTION_METRIC =
  /^\s*(?:(?:send|email|message|call|book|share|post|order|export|run)\s+(?:volume|rate|value|price|count|traffic|revenue)|calls)\s+(?:declined|decreased|fell|grew|improved|increased|rose|worsened)\b[^.!?;:]*[.!]?\s*$/iu;

export function m5bProductReviewTextClaimsForbiddenTrust(value: string): boolean {
  return FORGED_TRUST.test(value) || PASSIVE_OR_BANNER_TRUST.test(value) ||
    TRUST_OUTCOME_BANNER.test(value) || WORKFLOW_TRUST_CLAIM.test(value) ||
    (WORKFLOW_TRUST_SUBJECT.test(value) && WORKFLOW_TRUST_STATUS.test(value));
}

export function m5bProductReviewTextRequestsEffect(value: string): boolean {
  return !DESCRIPTIVE_ACTION_METRIC.test(value) && (EFFECT_DIRECTIVE.test(value) ||
    EFFECT_NAMED_CONTACT_DIRECTIVE.test(value) || EFFECT_STRUCTURED_DIRECTIVE.test(value));
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
export interface M5bProductReviewMaterialChangeAssertion {
  readonly kind: "account_event";
  readonly polarity: "affirmed";
  readonly status: "completed" | "announced" | "agreement_reached";
}

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
  readonly whatMeaningfullyChangedSelection: {
    readonly signalProposalId: string;
    readonly mapProposalId: string;
    readonly playProposalId: string;
  };
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
  readonly materialChangeAssertion: M5bProductReviewMaterialChangeAssertion | null;
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
  if (!SUBJECT_ID.test(teamId) || !SUBJECT_ID.test(accountId) ||
      m5bProductReviewTextClaimsForbiddenTrust(accountName)) {
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
    "whatNeedsAttention", "safeNextTask", "whatMeaningfullyChangedEvidenceBindingIds",
    "whatMeaningfullyChangedSelection"]);
  const selection = objectAt(object.whatMeaningfullyChangedSelection,
    "request.customerQuestions.whatMeaningfullyChangedSelection");
  exactKeys(selection, ["signalProposalId", "mapProposalId", "playProposalId"]);
  const questions: M5bProductReviewQuestions = {
    whoIsThisAccount: stringAt(object.whoIsThisAccount, "customer_questions", 12, 1_200),
    whatMeaningfullyChanged: stringAt(object.whatMeaningfullyChanged, "customer_questions", 12, 1_200),
    whatMeaningfullyChangedEvidenceBindingIds: uniqueStrings(
      object.whatMeaningfullyChangedEvidenceBindingIds, "material_change_question",
      M5B_PRODUCT_REVIEW_LIMITS.evidenceCountMax, EVIDENCE_ID, false,
    ),
    whatMeaningfullyChangedSelection: {
      signalProposalId: stringAt(selection.signalProposalId, "proposal_id", 5, 56),
      mapProposalId: stringAt(selection.mapProposalId, "proposal_id", 5, 56),
      playProposalId: stringAt(selection.playProposalId, "proposal_id", 5, 56),
    },
    whyDoesItMatter: stringAt(object.whyDoesItMatter, "customer_questions", 12, 1_200),
    whatNeedsAttention: stringAt(object.whatNeedsAttention, "customer_questions", 12, 1_200),
    safeNextTask: stringAt(object.safeNextTask, "customer_questions", 12, 1_200),
  };
  for (const answer of [questions.whoIsThisAccount, questions.whyDoesItMatter,
    questions.whatNeedsAttention]) {
    if (m5bProductReviewTextClaimsForbiddenTrust(answer)) {
      refuseM5bProductReview("customer_questions_trust");
    }
    if (m5bProductReviewTextRequestsEffect(answer)) {
      refuseM5bProductReview("customer_questions_effect");
    }
  }
  if (questions.safeNextTask !== M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION) {
    refuseM5bProductReview("unsafe_next_task");
  }
  if (Object.values(questions.whatMeaningfullyChangedSelection).some((id) => !PROPOSAL_ID.test(id)) ||
      new Set(Object.values(questions.whatMeaningfullyChangedSelection)).size !== 3) {
    refuseM5bProductReview("material_change_question");
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

function parseMaterialChangeAssertion(raw: unknown): M5bProductReviewMaterialChangeAssertion {
  let object: { [key: string]: StrictJsonValue };
  try {
    const snapshot = snapshotStrictJson(raw, "material_change_assertion", REQUEST_JSON_LIMITS);
    object = strictJsonObject(snapshot, "material_change_assertion");
    assertExactKeys(object, ["kind", "polarity", "status"], "material_change_assertion");
  } catch {
    return refuseM5bProductReview("material_change_assertion");
  }
  if (object.kind !== "account_event" || object.polarity !== "affirmed" ||
      (object.status !== "completed" && object.status !== "announced" &&
        object.status !== "agreement_reached")) {
    refuseM5bProductReview("material_change_assertion");
  }
  return Object.freeze({ kind: "account_event", polarity: "affirmed", status: object.status });
}

function parseEvidence(value: StrictJsonValue, index: number): M5bProductReviewEvidenceRequest {
  const object = objectAt(value, `request.evidenceBindings[${index}]`);
  exactKeys(object, ["evidenceId", "sourceId", "exactQuote", "evidenceRole", "materialChangeAssertion"]);
  const evidenceId = stringAt(object.evidenceId, "evidence_id", 5, 56);
  const sourceId = stringAt(object.sourceId, "evidence_source", 5, 56);
  const exactQuote = stringAt(object.exactQuote, "evidence_quote", 8,
    M5B_PRODUCT_REVIEW_LIMITS.excerptBytesEach);
  let materialChangeAssertion: M5bProductReviewMaterialChangeAssertion | null = null;
  if (object.materialChangeAssertion !== null) {
    materialChangeAssertion = parseMaterialChangeAssertion(object.materialChangeAssertion);
  }
  if (!EVIDENCE_ID.test(evidenceId) || !SOURCE_ID.test(sourceId) ||
      (object.evidenceRole !== "account_identity" && object.evidenceRole !== "account_context" &&
        object.evidenceRole !== "material_change") ||
      (object.evidenceRole === "material_change") !== (materialChangeAssertion !== null)) {
    refuseM5bProductReview("evidence_binding");
  }
  return { evidenceId, sourceId, exactQuote, evidenceRole: object.evidenceRole, materialChangeAssertion };
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
  /(?:\b(?:business\s+(?:category|classification|description|type)|industry(?:\s+classification)?|sector(?:\s+classification)?)\b\s*(?::|=|[—–-]|\bis\b|\bcode\b)|\b(?:naics|sic)\b(?:\s+code)?\s*(?::|=|#)?\s*\d)/iu;
const EXPLICIT_STATIC_PROFILE_LABEL =
  /^\s*(?:(?:account|business|company|corporate|entity|organization|registrant)\s+)?(?:overview|profile)\s*(?::|=|[—–-]|\bis\b)/iu;
const IDENTITY_NAME_LABEL_WORDS = new Set([
  "account", "business", "company", "corporate", "entity", "issuer", "legal", "registrant",
]);
const SHORT_IDENTITY_LABEL_WORDS = new Set([
  "exact", "issuer", "legal", "registrant", "s", "the",
]);
const MATERIAL_CHANGE_COMPLETED_ACTION_WORDS = new Set([
  "acquired", "adopted", "appointed", "breached", "canceled", "cancelled", "changed", "closed",
  "completed", "consolidated", "cut", "decreased", "departed", "discontinued", "disrupted", "divested",
  "expanded", "increased", "introduced", "invested", "launched", "merged", "opened", "partnered",
  "pivoted", "promoted", "recalled", "reconfigured", "reduced", "reorganized", "replaced", "resigned",
  "restated", "restructured", "retired", "rose", "sold", "suspended", "terminated", "transitioned",
]);
const MATERIAL_CHANGE_BASE_ACTION_WORDS = new Set([
  "acquire", "adopt", "appoint", "breach", "cancel", "change", "close", "complete", "consolidate",
  "decrease", "depart", "discontinue", "disrupt", "divest", "expand", "increase", "introduce", "invest",
  "launch", "merge", "open", "pivot", "promote", "recall", "reconfigure", "reduce", "reorganize", "replace",
  "resign", "restate", "restructure", "retire", "sell", "suspend", "terminate", "transition",
]);
const MATERIAL_CHANGE_EVENT_NOUN_WORDS = new Set([
  "acquisition", "acquisitions", "adoption", "appointment", "appointments", "bankruptcy", "breach",
  "cancellation", "change", "changes", "closure", "closures", "completion", "consolidation", "departure",
  "disruption", "disruptions", "divestiture", "expansion", "introduction", "layoff", "layoffs", "merger",
  "opening", "outage", "outages", "partnership", "promotion", "reconfiguration", "reduction", "reorganization",
  "replacement", "resignation", "restatement", "restructuring", "retirement", "rise", "sale", "suspension",
  "termination", "transition",
]);
const MATERIAL_CHANGE_FINITE_REPORT_WORDS = new Set([
  "announced", "announces", "disclosed", "discloses", "reported", "reports",
]);
const TENDER_OFFER_PERFECT_AUXILIARIES = new Set(["had", "has"]);
const TENDER_OFFER_ACTION = /\b(?:announced|announces|commenced|disclosed|discloses|reported|reports)\b/iu;
const TENDER_OFFER_FEDEX_MARKET_METADATA = "(NYSE: FDX)";
const TENDER_OFFER_FEDEX_MARKET_SELF_ALIAS_PREFIX =
  "FedEx Corp. (NYSE: FDX) (“FedEx”) today ";
const MATERIAL_CHANGE_AGREEMENT_ACTION_WORDS = new Set([
  "entered", "executed", "reached", "signed",
]);
const STATIC_ALIAS_OR_TRADE_NAME =
  /\b(?:d\s*\/\s*b\s*\/\s*a|dba|doing\s+business\s+as|trade\s+name|trading\s+as|alias|(?:also\s+|formerly\s+)?known\s+as)\b/iu;
const MATERIAL_CHANGE_NEGATION_OR_DENIAL =
  /\b(?:no|not|never|neither|without|denied|denies|deny|didn['’]t|doesn['’]t|don['’]t|hadn['’]t|hasn['’]t|haven['’]t|isn['’]t|wasn['’]t|weren['’]t)\b/iu;
const MATERIAL_CHANGE_HARD_NON_EVENT =
  /\b(?:if|unless|may|might|could|would|should|can|will|must|shall|possibly|possible|potential|hypothetical|risk|risks|possibility|almost|unable|failure|failed|fails|declined|declines|refused|attempted|attempts|sought|seeks|hoped|hopes|poised|expected|nothing|nobody|none|zero|rumor|rumors|rumour|rumours|rumored|rumoured|speculation|unconfirmed|alleged|allegedly|reportedly|purported|purportedly|false|incorrect|inaccurate|inaccurately|simulated|disputed|assertion|assertions|claim|claims)\b|\b0\b|\bfictional\s+example\b/iu;
const MATERIAL_CHANGE_PERFECT_OR_PASSIVE_AUXILIARIES = new Set([
  "had", "has", "have", "was", "were",
]);
const MATERIAL_CHANGE_EMPHATIC_AUXILIARIES = new Set(["did", "do", "does"]);
const MATERIAL_CHANGE_ANNOUNCEMENT_NOUN_FILLERS = new Set([
  "a", "an", "its", "major", "new", "planned", "proposed", "strategic", "the", "network",
]);
const MATERIAL_CHANGE_AGREEMENT_FILLERS = new Set([
  "a", "an", "binding", "definitive", "merger", "new", "purchase", "strategic", "supply", "the",
  "transportation",
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

function stripTrailingIdentityQualifier(value: string): string {
  const match = value.match(/\s*(?:\(([^()]{1,64})\)|\[([^\[\]]{1,64})\])\s*[.!]?\s*$/u);
  if (match?.index === undefined) return value;
  const qualifierWords = normalizedQuoteWords(match[1] ?? match[2] ?? "");
  if (qualifierWords.some((word) => MATERIAL_CHANGE_COMPLETED_ACTION_WORDS.has(word) ||
      MATERIAL_CHANGE_FINITE_REPORT_WORDS.has(word) ||
      MATERIAL_CHANGE_AGREEMENT_ACTION_WORDS.has(word))) {
    return value;
  }
  return value.slice(0, match.index).trim();
}

function looksLikeStaticLegalName(value: string): boolean {
  const withoutQualifier = stripTrailingIdentityQualifier(value).replace(/[.!]\s*$/u, "").trim();
  const words = withoutQualifier.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length < 2 || words.length > 16 ||
      !LEGAL_ENTITY_SUFFIXES.has(words.at(-1)!.toLocaleLowerCase("en-US"))) return false;
  const nameConnectors = new Set(["and", "de", "in", "of", "the", "van", "von"]);
  return words.every((word) => {
    const normalized = word.toLocaleLowerCase("en-US");
    if (nameConnectors.has(normalized)) return true;
    const first = [...word][0];
    return first !== undefined && (first === first.toLocaleUpperCase("en-US") ||
      word === word.toLocaleUpperCase("en-US"));
  });
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

function stripStaticActorParentheticals(value: string): string {
  return value.replace(/\(([^()]{1,96})\)/gu, (whole, content: string) => {
    const words = normalizedQuoteWords(content);
    return words.some((word) => MATERIAL_CHANGE_COMPLETED_ACTION_WORDS.has(word) ||
      MATERIAL_CHANGE_FINITE_REPORT_WORDS.has(word) ||
      MATERIAL_CHANGE_AGREEMENT_ACTION_WORDS.has(word)) ? whole : " ";
  });
}

function nullableAccountEventPredicateFromWords(
  accountName: string,
  quoteWords: readonly string[],
): readonly string[] | null {
  const variants = [...normalizedAccountIdentityVariants(accountName, true)]
    .map(normalizedQuoteWords)
    .sort((left, right) => right.length - left.length);
  for (const actorWords of variants) {
    if (actorWords.length === 0 || actorWords.some((word, index) => quoteWords[index] !== word)) continue;
    let predicateIndex = actorWords.length;
    while (LEGAL_ENTITY_SUFFIXES.has(quoteWords[predicateIndex] ?? "")) predicateIndex += 1;
    if (predicateIndex < quoteWords.length) return quoteWords.slice(predicateIndex);
  }
  return null;
}

function accountEventPredicateFromWords(
  accountName: string,
  quoteWords: readonly string[],
): readonly string[] {
  return nullableAccountEventPredicateFromWords(accountName, quoteWords) ??
    refuseM5bProductReview("material_change_subject");
}

function accountEventPredicateWords(accountName: string, exactQuote: string): readonly string[] {
  return accountEventPredicateFromWords(accountName, normalizedQuoteWords(stripStaticActorParentheticals(
    stripTrailingIdentityQualifier(exactQuote),
  )));
}

function containsTenderOfferPhrase(words: readonly string[]): boolean {
  return words.some((word, index) =>
    word === "tender" && (words[index + 1] === "offer" || words[index + 1] === "offers"));
}

function tenderOfferPhraseEnd(words: readonly string[], start: number): number | null {
  let index = start;
  if (words[index] === "a") {
    index += 1;
    if (words[index] === "cash") index += 1;
    return words[index] === "tender" && words[index + 1] === "offer" ? index + 2 : null;
  }
  if (words[index] === "cash") index += 1;
  return words[index] === "tender" && words[index + 1] === "offers" ? index + 2 : null;
}

type TenderOfferStatus = "announced" | "completed";
type TenderOfferClassification = TenderOfferStatus | "unsafe";

function tenderOfferGrammarStatus(words: readonly string[]): TenderOfferStatus | null {
  let index = TENDER_OFFER_PERFECT_AUXILIARIES.has(words[0] ?? "") ? 1 : 0;
  if (words[index] === "commenced") {
    const phraseEnd = tenderOfferPhraseEnd(words, index + 1);
    if (phraseEnd === words.length) return "completed";
  }

  index = words[0] === "today" ? 1 : 0;
  if (words[index] !== "announced") return null;
  index += 1;
  if (words[index] !== "that") {
    const phraseEnd = tenderOfferPhraseEnd(words, index);
    return phraseEnd === words.length ? "announced" : null;
  }

  if (words[index + 1] !== "it") return null;
  index += 2;
  if (TENDER_OFFER_PERFECT_AUXILIARIES.has(words[index] ?? "")) index += 1;
  if (words[index] !== "commenced") return null;
  const phraseEnd = tenderOfferPhraseEnd(words, index + 1);
  return phraseEnd === words.length ? "announced" : null;
}

function tenderOfferPredicateBeginsDedicatedShape(words: readonly string[]): boolean {
  const reportIndex = words[0] === "today" ? 1 : 0;
  if (MATERIAL_CHANGE_FINITE_REPORT_WORDS.has(words[reportIndex] ?? "")) return true;
  const commencedIndex = ["had", "has", "have"].includes(words[0] ?? "") ? 1 : 0;
  return words[commencedIndex] === "commenced";
}

function tenderOfferPredicateIsGenericEvent(words: readonly string[]): boolean {
  return beginsCompletedAccountPredicate(words) || hasAnnouncedAccountEvent(words) ||
    hasReachedAccountAgreement(words);
}

function tenderOfferPredicateForClassification(
  accountName: string,
  exactQuote: string,
): { readonly actorMetadataSafe: boolean; readonly words: readonly string[] } | null {
  const rawWords = normalizedQuoteWords(exactQuote);
  const rawPredicate = nullableAccountEventPredicateFromWords(accountName, rawWords);
  if (rawPredicate === null || !containsTenderOfferPhrase(rawPredicate)) return null;

  const actionIndex = exactQuote.search(TENDER_OFFER_ACTION);
  const actorPrefix = actionIndex < 0 ? exactQuote : exactQuote.slice(0, actionIndex);
  const actorParentheticals = actionIndex < 0 ? [] : [...actorPrefix.matchAll(/\([^()]{1,96}\)/gu)]
    .filter((parenthetical) => parenthetical.index < actionIndex);
  const normalizedActor = normalizedAccountIdentity(accountName);
  const actorParentheticalDelimitersSafe = (actorPrefix.match(/[()]/gu)?.length ?? 0) ===
    actorParentheticals.length * 2;
  const actorMetadataSafe = actorParentheticalDelimitersSafe &&
    (actorParentheticals.length === 0 ||
      (normalizedActor === "fedex" && actorParentheticals[0]![0] === TENDER_OFFER_FEDEX_MARKET_METADATA &&
        (actorParentheticals.length === 1 ||
          (actorParentheticals.length === 2 &&
            actorPrefix === TENDER_OFFER_FEDEX_MARKET_SELF_ALIAS_PREFIX))));
  const withoutActorParentheticals = actionIndex < 0 ? exactQuote : exactQuote.replace(
    /\([^()]{1,96}\)/gu,
    (whole, offset: number) => offset < actionIndex ? " " : whole,
  );
  const words = nullableAccountEventPredicateFromWords(
    accountName,
    normalizedQuoteWords(withoutActorParentheticals),
  );
  return words === null ? { actorMetadataSafe: false, words: rawPredicate } :
    { actorMetadataSafe, words };
}

function classifyTenderOfferPredicate(
  accountName: string,
  exactQuote: string,
): TenderOfferClassification | null {
  const predicate = tenderOfferPredicateForClassification(accountName, exactQuote);
  if (predicate === null) return null;
  const status = tenderOfferGrammarStatus(predicate.words);
  if (status !== null) return predicate.actorMetadataSafe ? status : "unsafe";
  if (tenderOfferPredicateIsGenericEvent(predicate.words)) return null;
  return tenderOfferPredicateBeginsDedicatedShape(predicate.words) ? "unsafe" : null;
}

function beginsCompletedAccountPredicate(words: readonly string[]): boolean {
  const first = words[0] ?? "";
  const second = words[1] ?? "";
  return MATERIAL_CHANGE_COMPLETED_ACTION_WORDS.has(first) ||
    (MATERIAL_CHANGE_PERFECT_OR_PASSIVE_AUXILIARIES.has(first) &&
      MATERIAL_CHANGE_COMPLETED_ACTION_WORDS.has(second)) ||
    (MATERIAL_CHANGE_EMPHATIC_AUXILIARIES.has(first) &&
      MATERIAL_CHANGE_BASE_ACTION_WORDS.has(second));
}

function hasAnnouncedAccountEvent(words: readonly string[]): boolean {
  if (!MATERIAL_CHANGE_FINITE_REPORT_WORDS.has(words[0] ?? "")) return false;
  const complement = words.slice(1);
  if (complement[0] === "that") {
    return complement[1] === "it" && (beginsCompletedAccountPredicate(complement.slice(2)) ||
      hasReachedAccountAgreement(complement.slice(2)));
  }
  if (complement[0] === "plans" && complement[1] === "to") {
    return MATERIAL_CHANGE_BASE_ACTION_WORDS.has(complement[2] ?? "");
  }
  const eventNounIndex = complement.findIndex((word) => MATERIAL_CHANGE_EVENT_NOUN_WORDS.has(word));
  if (eventNounIndex < 0 || eventNounIndex > 3 ||
      !complement.slice(0, eventNounIndex).every((word) =>
        MATERIAL_CHANGE_ANNOUNCEMENT_NOUN_FILLERS.has(word))) return false;
  const tail = complement.slice(eventNounIndex + 1);
  if (tail.some((word) => word === "affecting" || word === "behalf" || word === "between" ||
      word === "by" || word === "concerning" || word === "for" || word === "from" ||
      word === "involving" || word === "suffered")) return false;
  return tail.every((word, index) =>
    (word !== "at" && word !== "in" && word !== "across") || tail[index + 1] === "its");
}

function hasReachedAccountAgreement(words: readonly string[]): boolean {
  const action = words[0] ?? "";
  if (!MATERIAL_CHANGE_AGREEMENT_ACTION_WORDS.has(action)) return false;
  const complement = action === "entered" ? words.slice(2) : words.slice(1);
  if (action === "entered" && words[1] !== "into") return false;
  const agreementIndex = complement.findIndex((word) => word === "agreement" || word === "contract");
  if (agreementIndex < 0 || agreementIndex > 4 ||
      !complement.slice(0, agreementIndex).every((word) => MATERIAL_CHANGE_AGREEMENT_FILLERS.has(word))) {
    return false;
  }
  const tail = complement.slice(agreementIndex + 1);
  return tail.length === 0 ||
    (tail[0] === "with" && tail.length > 1 && tail.length <= 9 &&
      !tail.some((word) => word === "as" || word === "for" || word === "review" ||
        word === "behalf" || word === "section" || word === "witness")) ||
    (tail[0] === "to" && MATERIAL_CHANGE_BASE_ACTION_WORDS.has(tail[1] ?? ""));
}

export function assertM5bProductReviewMaterialChangeQuote(
  accountName: string,
  exactQuote: string,
  assertion: unknown,
): void {
  if (typeof accountName !== "string" || typeof exactQuote !== "string") {
    refuseM5bProductReview("material_change_assertion");
  }
  const validatedAssertion = parseMaterialChangeAssertion(assertion);
  const quoteIdentityText = normalizedAccountIdentity(accountName) === "fedex"
    ? exactQuote.replace(TENDER_OFFER_FEDEX_MARKET_METADATA, " ")
    : exactQuote;
  const quoteIdentities = normalizedAccountIdentityVariants(quoteIdentityText, false);
  const subjectIdentities = normalizedAccountIdentityVariants(accountName, true);
  const quoteWithoutTrailingQualifier = stripTrailingIdentityQualifier(exactQuote);
  const quoteWords = normalizedQuoteWords(quoteWithoutTrailingQualifier);
  if (quoteIdentities.size === 0) refuseM5bProductReview("material_change_uninformative");
  if (EXPLICIT_STATIC_CLASSIFICATION_LABEL.test(exactQuote) ||
      EXPLICIT_STATIC_PROFILE_LABEL.test(exactQuote) || isExplicitIdentityLabel(exactQuote) ||
      looksLikeStaticLegalName(exactQuote) || STATIC_ALIAS_OR_TRADE_NAME.test(exactQuote)) {
    refuseM5bProductReview("material_change_identity_only");
  }
  if ([...quoteIdentities].some((identity) => subjectIdentities.has(identity))) {
    refuseM5bProductReview("material_change_identity_only");
  }
  if (quoteWords.length === 1) refuseM5bProductReview("material_change_uninformative");

  const tenderOfferClassification = classifyTenderOfferPredicate(accountName, exactQuote);
  if (tenderOfferClassification !== null) {
    if (MATERIAL_CHANGE_NEGATION_OR_DENIAL.test(exactQuote)) {
      refuseM5bProductReview("material_change_non_event");
    }
    if (MATERIAL_CHANGE_HARD_NON_EVENT.test(exactQuote) || /[?？]/u.test(exactQuote) ||
        tenderOfferClassification === "unsafe") {
      refuseM5bProductReview("material_change_status");
    }
    if (tenderOfferClassification !== validatedAssertion.status) {
      refuseM5bProductReview("material_change_status");
    }
    return;
  }

  const hasFiniteAction = quoteWords.some((word) => MATERIAL_CHANGE_COMPLETED_ACTION_WORDS.has(word));
  const hasReportedEvent = quoteWords.some((word, index) =>
    MATERIAL_CHANGE_FINITE_REPORT_WORDS.has(word) &&
    quoteWords.slice(index + 1).some((candidate) => MATERIAL_CHANGE_EVENT_NOUN_WORDS.has(candidate) ||
      MATERIAL_CHANGE_BASE_ACTION_WORDS.has(candidate) ||
      MATERIAL_CHANGE_COMPLETED_ACTION_WORDS.has(candidate)));
  const hasAgreementEvent = quoteWords.some((word, index) =>
    MATERIAL_CHANGE_AGREEMENT_ACTION_WORDS.has(word) &&
    quoteWords.slice(index + 1).some((candidate) => candidate === "agreement" || candidate === "contract"));
  if (!hasFiniteAction && !hasReportedEvent && !hasAgreementEvent) {
    refuseM5bProductReview("material_change_identity_only");
  }

  if (MATERIAL_CHANGE_NEGATION_OR_DENIAL.test(exactQuote)) {
    refuseM5bProductReview("material_change_non_event");
  }
  if (MATERIAL_CHANGE_HARD_NON_EVENT.test(exactQuote)) {
    refuseM5bProductReview("material_change_status");
  }
  if (/[?？]/u.test(exactQuote)) refuseM5bProductReview("material_change_status");

  const predicateWords = accountEventPredicateWords(accountName, exactQuote);
  switch (validatedAssertion.status) {
    case "completed":
      if (!beginsCompletedAccountPredicate(predicateWords)) {
        refuseM5bProductReview("material_change_status");
      }
      return;
    case "announced":
      if (!hasAnnouncedAccountEvent(predicateWords)) {
        refuseM5bProductReview("material_change_status");
      }
      return;
    case "agreement_reached":
      if (!hasReachedAccountAgreement(predicateWords)) {
        refuseM5bProductReview("material_change_status");
      }
      return;
    default:
      return refuseM5bProductReview("material_change_assertion");
  }
}

function parseSafeTask(value: StrictJsonValue | undefined): M5bProductReviewSafeTask {
  const object = objectAt(value, "request.proposal.safeTask");
  exactKeys(object, ["kind", "description"]);
  const description = stringAt(object.description, "safe_task", 12, 500);
  if (object.kind !== "draft_targeted_meeting_brief" ||
      description !== M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION ||
      m5bProductReviewTextRequestsEffect(description) ||
      m5bProductReviewTextClaimsForbiddenTrust(description) || !/\bbrief\b/iu.test(description)) {
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
  if (caveats.some((caveat) => m5bProductReviewTextClaimsForbiddenTrust(caveat))) {
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
  const preparedAtEpoch = new Date(request.execution.preparedAt).getTime();
  if (request.sources.some((source) => new Date(source.acquiredAt).getTime() > preparedAtEpoch)) {
    refuseM5bProductReview("source_after_preparation");
  }
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
      assertM5bProductReviewMaterialChangeQuote(
        request.subject.accountName,
        binding.exactQuote,
        binding.materialChangeAssertion!,
      );
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
  const selection = request.customerQuestions.whatMeaningfullyChangedSelection;
  const selectedSignal = proposalsById.get(selection.signalProposalId);
  const selectedMap = proposalsById.get(selection.mapProposalId);
  const selectedPlay = proposalsById.get(selection.playProposalId);
  const selectedEvidenceId = selectedSignal?.evidenceBindingIds[0];
  if (selectedSignal?.classification !== "source_fact" || selectedSignal.lens !== "signal" ||
      selectedSignal.evidenceBindingIds.length !== 1 || selectedEvidenceId === undefined ||
      !materialEvidenceIds.has(selectedEvidenceId) ||
      selectedMap?.classification !== "analysis" || selectedMap.lens !== "map" ||
      !selectedMap.supportingProposalIds.includes(selectedSignal.proposalId) ||
      !selectedMap.evidenceBindingIds.includes(selectedEvidenceId) ||
      selectedPlay?.classification !== "recommendation" || selectedPlay.lens !== "play" ||
      !selectedPlay.supportingProposalIds.includes(selectedMap.proposalId) ||
      !selectedPlay.evidenceBindingIds.includes(selectedEvidenceId) ||
      request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds.length !== 1 ||
      request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds[0] !== selectedEvidenceId ||
      request.customerQuestions.whatMeaningfullyChanged !== selectedSignal.summary) {
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
    if (Buffer.byteLength(proposal.title, "utf8") > 180 ||
        m5bProductReviewTextClaimsForbiddenTrust(proposal.title) ||
        m5bProductReviewTextClaimsForbiddenTrust(proposal.summary) ||
        proposal.caveats.some(m5bProductReviewTextClaimsForbiddenTrust)) {
      refuseM5bProductReview("proposal_trust_claim");
    }
    if (m5bProductReviewTextRequestsEffect(proposal.title) ||
        m5bProductReviewTextRequestsEffect(proposal.summary) ||
        proposal.caveats.some(m5bProductReviewTextRequestsEffect)) {
      refuseM5bProductReview("proposal_effect_claim");
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
        !dependencies.some((dependency) => dependency?.classification === "analysis")) {
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
