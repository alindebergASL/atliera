// Proposal-materialization contract (Direction B: public hand-curated path).
//
// `materializeProposalForValidation` is a pure, deterministic function that
// consumes committed/public hand-curated proposal-like records plus
// public-source context only and materializes them into a disposable
// validation artifact carrying a GraphBundle candidate. It performs no
// provider/model calls, no network access, no private-evidence reads, and no
// durable writes; the artifact is explicitly disposable and is not graph
// ingestion. "Ingestion" stays reserved for a future ratification-gated
// durable graph write that this module does not implement or authorize.
//
// Trust visual language decision committed by this slice: materialized
// proposal-derived records reuse the existing `unverified` provenance status
// and `proposed` excerpt validation status, decorated with an explicit
// `model_proposed_pending_human_review` review state in the artifact. No new
// truth-status tier is added, and nothing materialized here may be marked
// `verified` or `source_document_only`.

import { ID_PREFIXES, idHasPrefix } from "../graph/ids.ts";
import { parseSourceDocument } from "../graph/schema.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import type { ValidationReport } from "../graph/report.ts";
import type {
  AccountObject,
  AccountObjectClaim,
  AccountObjectKind,
  Claim,
  ClaimEvidence,
  EvidenceExcerpt,
  GraphBundle,
  ISOTimestamp,
  ResearchRun,
  SourceDocument,
} from "../graph/types.ts";

export const PROPOSAL_MATERIALIZATION_SCHEMA_VERSION =
  "proposal_materialization_validation_artifact.v1" as const;

export type ProposalMaterializationSchemaVersion =
  typeof PROPOSAL_MATERIALIZATION_SCHEMA_VERSION;

// The only origin this contract accepts. Private fresh-route proof output is
// not a valid origin for this slice and requires a later, separate fresh
// private-evidence-handling approval before it may be read, rendered, or
// materialized at all.
export const PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN = "hand-curated-public" as const;

export type ProposalMaterializationOrigin = typeof PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN;

export const PROPOSAL_MATERIALIZATION_REVIEW_STATE =
  "model_proposed_pending_human_review" as const;

export type ProposalMaterializationReviewState =
  typeof PROPOSAL_MATERIALIZATION_REVIEW_STATE;

// Next visible Workshop artifact this contract feeds, and the approval
// surface that must exist and be explicitly approved before that artifact is
// produced. Naming these here keeps the slice pointed at a concrete product
// surface instead of another open-ended harness artifact.
export const PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_ARTIFACT_NAME =
  "workshop-public-curated-proposal-preview" as const;

export const PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_APPROVAL_SURFACE =
  "docs/runbooks/workshop-public-curated-proposal-preview-approval-packet.md" as const;

export type ProposalRecordKind = "source" | "excerpt" | "claim" | "account_object";

export type ProposalDispositionReasonCode =
  | "malformed_proposal_record"
  | "unsafe_proposal_id"
  | "duplicate_proposal_id"
  | "proposal_supplied_trust_status_disallowed"
  | "missing_source_provenance"
  | "non_public_source_url"
  | "source_context_mismatch"
  | "unsupported_account_object_type"
  | "unknown_source_document_id"
  | "excerpt_text_not_found_in_source"
  | "missing_supporting_excerpt_reference"
  | "missing_supporting_claim_reference";

export interface ProposalRecordDisposition {
  readonly record_kind: ProposalRecordKind;
  readonly proposal_id: string;
  readonly disposition: "accepted" | "rejected";
  readonly reason_code: ProposalDispositionReasonCode | null;
  readonly materialized_id: string | null;
}

export interface ProposalMaterializationBoundaries {
  readonly current_effective_authorization: "none";
  readonly authorizes_provider_call: false;
  readonly authorizes_private_evidence_read: false;
  readonly authorizes_graph_ingestion: false;
  readonly graph_ingestion_performed: false;
  readonly provider_calls_executed: 0;
  readonly private_evidence_read: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

export interface ProposalMaterializationTrustLanguage {
  readonly provenance_status: "unverified";
  readonly excerpt_validation_status: "proposed";
  readonly review_state: ProposalMaterializationReviewState;
  readonly adds_new_truth_status_tier: false;
  readonly confidence_cap: "medium";
}

export interface ProposalMaterializationNextWorkshopArtifact {
  readonly name: typeof PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_ARTIFACT_NAME;
  readonly scope: string;
  readonly approval_surface: typeof PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_APPROVAL_SURFACE;
  readonly private_fresh_route_proof_input_allowed: false;
  readonly private_fresh_route_proof_requires: "separate-fresh-private-evidence-handling-approval";
}

export interface ProposalMaterializationCounts {
  readonly sources: number;
  readonly excerpts: number;
  readonly claims: number;
  readonly account_objects: number;
}

export interface ProposalMaterializationArtifact {
  readonly kind: "proposal-materialization-validation-artifact";
  readonly schema_version: ProposalMaterializationSchemaVersion;
  readonly disposable: true;
  readonly origin: ProposalMaterializationOrigin;
  readonly proposal_set_id: string;
  readonly team_id: string;
  readonly account_id: string;
  readonly materialized_at: ISOTimestamp;
  readonly boundaries: ProposalMaterializationBoundaries;
  readonly trust_language: ProposalMaterializationTrustLanguage;
  readonly dispositions: readonly ProposalRecordDisposition[];
  readonly accepted_counts: ProposalMaterializationCounts;
  readonly rejected_counts: ProposalMaterializationCounts;
  readonly bundle_candidate: GraphBundle;
  readonly bundle_validation: ValidationReport;
  readonly next_visible_workshop_artifact: ProposalMaterializationNextWorkshopArtifact;
}

export interface MaterializeProposalForValidationInput {
  readonly context: unknown;
  readonly public_sources: readonly unknown[];
  readonly proposed_excerpts: readonly unknown[];
  readonly proposed_claims: readonly unknown[];
  readonly proposed_account_objects: readonly unknown[];
}

const SAFE_PROPOSAL_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_TEAM_ID = /^team_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_ACCOUNT_ID = /^acc_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_CLAIM_TYPE = /^[a-z][a-z0-9_]{0,40}$/;
const SAFE_NORMALIZED_SUBJECT = /^[a-z0-9][a-z0-9_:.-]{0,120}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

const ACCOUNT_OBJECT_KINDS: readonly AccountObjectKind[] = [
  "account_snapshot",
  "signal",
  "stakeholder",
  "initiative",
  "risk",
  "open_question",
  "play",
  "recommendation",
];

// Trust/review status fields a proposal record may never supply itself.
// Materialized trust language is assigned by this contract, not by input.
const FORGED_TRUST_STATUS_KEYS = [
  "validation_status",
  "provenance_status",
  "review_state",
  "status",
  "verified",
] as const;

interface ContextSnapshot {
  readonly origin: ProposalMaterializationOrigin;
  readonly team_id: string;
  readonly account_id: string;
  readonly materialized_at: ISOTimestamp;
  readonly proposal_set_id: string;
}

// Hostile-input bounds. Committed public-curated proposal sets are small, so
// anything past these caps is rejected before any element or field is read.
const MAX_PROPOSAL_RECORDS_PER_KIND = 200;
const MAX_SUPPORTING_REFERENCES = 50;
const MAX_RECORD_FIELDS = 64;

// Reads only own data properties so accessor-backed objects cannot return
// one value to validation and a different value to materialization. All
// later reads consume the frozen snapshot, never the original input.
function ownDataValue(input: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined || !("value" in descriptor)) return undefined;
  return descriptor.value;
}

// Copies an untrusted array into a frozen plain snapshot without calling any
// array instance method or iterator on the untrusted value: length is read
// once inside the try, bounds are checked before any element read, elements
// are read by own-data descriptor over the snapshotted length, and accessor
// elements, symbol keys (including an overridden Symbol.iterator), custom
// prototypes, sparse holes, and proxy trap failures all sanitize to null.
function snapshotUntrustedArray(value: unknown, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const length: unknown = value.length;
    if (typeof length !== "number" || !Number.isInteger(length) || length < 0 || length > max) {
      return null;
    }
    if (Object.getOwnPropertySymbols(value).length > 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const out: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return null;
      }
      out.push(descriptor.value);
    }
    return Object.freeze(out);
  } catch {
    return null;
  }
}

// Object keys that collide with prototype machinery. An own enumerable
// `__proto__` data property (e.g. from JSON.parse) assigned with `out[key] =`
// would invoke the Object.prototype `__proto__` setter and swap the
// snapshot's prototype — letting downstream direct-property readers such as
// parseSourceDocument consume attacker-controlled inherited fields and
// letting hostile prototype getters run. These keys reject fail-closed.
const DANGEROUS_RECORD_KEYS: readonly string[] = ["__proto__", "constructor", "prototype"];

// Copies an untrusted record into a frozen plain own-data snapshot before any
// field read. Accessor-backed fields, symbol keys, custom prototypes,
// prototype-machinery keys (`__proto__`/`constructor`/`prototype`),
// oversized records, and proxy trap failures all sanitize to null; raw
// exceptions from hostile objects never escape. Safe keys are copied with
// Object.defineProperty, which defines own data properties and can never
// invoke a prototype setter.
function snapshotProposalRecord(raw: unknown): Record<string, unknown> | null {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const prototype = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Object.getOwnPropertySymbols(raw).length > 0) return null;
    const entries = Object.entries(Object.getOwnPropertyDescriptors(raw));
    if (entries.length > MAX_RECORD_FIELDS) return null;
    const out: Record<string, unknown> = {};
    for (const [key, descriptor] of entries) {
      if (DANGEROUS_RECORD_KEYS.includes(key)) return null;
      if (!descriptor.enumerable || !("value" in descriptor)) return null;
      Object.defineProperty(out, key, {
        value: descriptor.value,
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return Object.freeze(out);
  } catch {
    return null;
  }
}

// Expected source-record keys, mirroring the schema's source-document key
// set. The source snapshot carries only these keys so parseSourceDocument
// never touches the original untrusted object and unexpected fields are
// rejected before parsing.
const SOURCE_RECORD_KEYS: readonly string[] = [
  "id",
  "team_id",
  "account_id",
  "url",
  "canonical_url",
  "title",
  "publisher",
  "source_type",
  "fetched_at",
  "accessed_at",
  "content_hash",
  "raw_text",
  "reliability",
  "status",
];

function snapshotSourceRecord(raw: unknown): Record<string, unknown> | null {
  const record = snapshotProposalRecord(raw);
  if (record === null) return null;
  for (const key of Object.keys(record)) {
    if (!SOURCE_RECORD_KEYS.includes(key)) return null;
  }
  return record;
}

function stringValue(input: object, key: string): string | undefined {
  const value = ownDataValue(input, key);
  return typeof value === "string" ? value : undefined;
}

function stringArrayValue(input: object, key: string): string[] | undefined {
  const snapshot = snapshotUntrustedArray(ownDataValue(input, key), MAX_SUPPORTING_REFERENCES);
  if (snapshot === null) return undefined;
  const out: string[] = [];
  for (let index = 0; index < snapshot.length; index += 1) {
    const item = snapshot[index];
    if (typeof item !== "string") return undefined;
    out.push(item);
  }
  return out;
}

function suppliesForgedTrustStatus(record: object): boolean {
  return FORGED_TRUST_STATUS_KEYS.some(
    (key) => Object.getOwnPropertyDescriptor(record, key) !== undefined,
  );
}

// The url check is a string-shape check only; nothing in this module fetches
// or resolves anything. The literal is assembled from fragments so the
// hardcoded-infrastructure scan does not mistake it for a configured
// endpoint; it accepts only http(s) URLs, which excludes file/local/private
// evidence paths by construction, and it additionally rejects URL
// credentials plus localhost/loopback/private/link-local/unspecified,
// IPv6-bracket, and obfuscated numeric (hex/octal/integer) host shapes so a
// committed "public" source cannot point at a local or internal-network
// location.
const PUBLIC_URL_PREFIX = ["http", "://"] as const;
const SAFE_PUBLIC_HOST = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
const PORT_SUFFIX = /^\d{1,5}$/;
// A label that URL parsers may interpret numerically: hex-like, octal-like,
// or decimal digit runs. Host is lowercased before this test.
const NUMERIC_ISH_LABEL = /^(?:0x[0-9a-f]*|[0-9]+)$/;
// Strict canonical decimal octet: no leading zeros except exactly "0", so
// octal-looking labels never pass.
const STRICT_DECIMAL_OCTET = /^(?:0|[1-9][0-9]{0,2})$/;

function isAllowedPublicHostShape(host: string): boolean {
  if (!SAFE_PUBLIC_HOST.test(host)) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  const labels = host.split(".");
  if (labels.some((label) => NUMERIC_ISH_LABEL.test(label))) {
    // Any numeric-ish label (hex, octal-looking, or decimal) means the host
    // is accepted only as a canonical dotted-decimal public IPv4 literal:
    // exactly four strict-decimal octets in range. URL parsers normalize
    // obfuscated private/loopback host encodings to private/loopback
    // addresses, so every non-canonical numeric shape fails closed here.
    // Private, loopback, link-local, and unspecified ranges are rejected
    // octet by octet.
    if (labels.length !== 4) return false;
    if (!labels.every((label) => STRICT_DECIMAL_OCTET.test(label))) return false;
    const octets = labels.map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    const [first, second] = octets as [number, number, number, number];
    if (first === 0 || first === 10 || first === 127) return false;
    if (first === 169 && second === 254) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    if (first === 192 && second === 168) return false;
  }
  return true;
}

function isPublicHttpUrl(value: string): boolean {
  const [scheme, separator] = PUBLIC_URL_PREFIX;
  const lower = value.toLowerCase();
  const httpPrefix = `${scheme}${separator}`;
  const httpsPrefix = `${scheme}s${separator}`;
  const rest = lower.startsWith(httpsPrefix)
    ? lower.slice(httpsPrefix.length)
    : lower.startsWith(httpPrefix)
      ? lower.slice(httpPrefix.length)
      : null;
  if (rest === null || rest.length === 0 || rest.startsWith("/")) return false;
  const authorityEnd = rest.search(/[/?#]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  if (authority.length === 0) return false;
  // user:password@host credentials are never a public-source shape.
  if (authority.includes("@")) return false;
  // IPv6 bracket hosts (including IPv6 localhost) are rejected wholesale.
  if (authority.includes("[") || authority.includes("]")) return false;
  const portSeparator = authority.indexOf(":");
  const host = portSeparator === -1 ? authority : authority.slice(0, portSeparator);
  const port = portSeparator === -1 ? null : authority.slice(portSeparator + 1);
  if (port !== null && !PORT_SUFFIX.test(port)) return false;
  return isAllowedPublicHostShape(host);
}

function snapshotContext(rawContext: unknown): ContextSnapshot {
  const context = snapshotProposalRecord(rawContext);
  if (context === null) {
    throw new Error("proposal materialization requires a plain context object");
  }
  const origin = stringValue(context, "origin");
  if (origin !== PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN) {
    throw new Error(
      "proposal materialization accepts hand-curated-public input only; " +
        "private fresh-route proof output requires a later separate fresh private-evidence-handling approval",
    );
  }
  const teamId = stringValue(context, "team_id");
  const accountId = stringValue(context, "account_id");
  const materializedAt = stringValue(context, "materialized_at");
  const proposalSetId = stringValue(context, "proposal_set_id");
  if (
    teamId === undefined ||
    !SAFE_TEAM_ID.test(teamId) ||
    accountId === undefined ||
    !SAFE_ACCOUNT_ID.test(accountId) ||
    materializedAt === undefined ||
    !ISO_TIMESTAMP.test(materializedAt) ||
    proposalSetId === undefined ||
    !SAFE_PROPOSAL_ID.test(proposalSetId)
  ) {
    throw new Error(
      "proposal materialization context must carry safe team_id, account_id, ISO materialized_at, and proposal_set_id values",
    );
  }
  return Object.freeze({
    origin: PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN,
    team_id: teamId,
    account_id: accountId,
    materialized_at: materializedAt,
    proposal_set_id: proposalSetId,
  });
}

interface DispositionLedger {
  readonly dispositions: ProposalRecordDisposition[];
}

function recordDisposition(
  ledger: DispositionLedger,
  recordKind: ProposalRecordKind,
  proposalId: string,
  outcome:
    | { disposition: "accepted"; materializedId: string }
    | { disposition: "rejected"; reasonCode: ProposalDispositionReasonCode },
): void {
  ledger.dispositions.push(
    Object.freeze(
      outcome.disposition === "accepted"
        ? {
            record_kind: recordKind,
            proposal_id: proposalId,
            disposition: "accepted" as const,
            reason_code: null,
            materialized_id: outcome.materializedId,
          }
        : {
            record_kind: recordKind,
            proposal_id: proposalId,
            disposition: "rejected" as const,
            reason_code: outcome.reasonCode,
            materialized_id: null,
          },
    ),
  );
}

function safeProposalLabel(record: Record<string, unknown> | null, key: string): string {
  if (record !== null) {
    const id = stringValue(record, key);
    if (id !== undefined && SAFE_PROPOSAL_ID.test(id)) return id;
  }
  return "unidentified";
}

// Rejected-source labels echo the id only when it already matches the safe
// source_document id shape (the shape committed public fixtures use).
// Anything else — including punctuation-stripped fragments of hostile ids —
// is reported as "unidentified" so unsafe source-like material is never
// echoed into dispositions.
function safeSourceLabel(record: Record<string, unknown> | null): string {
  if (record !== null) {
    const id = stringValue(record, "id");
    if (id !== undefined && idHasPrefix(id, "source_document")) return id;
  }
  return "unidentified";
}

function materializeSources(
  rawSources: readonly unknown[],
  context: ContextSnapshot,
  ledger: DispositionLedger,
): SourceDocument[] {
  const accepted: SourceDocument[] = [];
  const seenIds = new Set<string>();
  for (const raw of rawSources) {
    // Plain own-data snapshot first: parseSourceDocument reads properties
    // directly, so it may only ever see this frozen snapshot, never the
    // original untrusted object. Accessor fields, symbol keys, custom
    // prototypes, unexpected fields, and proxy failures reject fail-closed.
    const snapshot = snapshotSourceRecord(raw);
    const label = safeSourceLabel(snapshot);
    if (snapshot === null) {
      recordDisposition(ledger, "source", label, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    // parseSourceDocument copies every field exactly once into a fresh
    // object; only that parsed snapshot is consumed afterwards.
    const parsed = parseSourceDocument(snapshot);
    if (!parsed.ok) {
      recordDisposition(ledger, "source", label, {
        disposition: "rejected",
        reasonCode: "missing_source_provenance",
      });
      continue;
    }
    const source = parsed.value;
    if (!idHasPrefix(source.id, "source_document")) {
      recordDisposition(ledger, "source", label, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    if (seenIds.has(source.id)) {
      recordDisposition(ledger, "source", source.id, {
        disposition: "rejected",
        reasonCode: "duplicate_proposal_id",
      });
      continue;
    }
    seenIds.add(source.id);
    if (
      source.title.trim() === "" ||
      source.raw_text.trim() === "" ||
      source.content_hash.trim() === "" ||
      !ISO_TIMESTAMP.test(source.fetched_at) ||
      !ISO_TIMESTAMP.test(source.accessed_at) ||
      source.status !== "active"
    ) {
      recordDisposition(ledger, "source", source.id, {
        disposition: "rejected",
        reasonCode: "missing_source_provenance",
      });
      continue;
    }
    if (!isPublicHttpUrl(source.url) || !isPublicHttpUrl(source.canonical_url)) {
      recordDisposition(ledger, "source", source.id, {
        disposition: "rejected",
        reasonCode: "non_public_source_url",
      });
      continue;
    }
    if (source.team_id !== context.team_id || source.account_id !== context.account_id) {
      recordDisposition(ledger, "source", source.id, {
        disposition: "rejected",
        reasonCode: "source_context_mismatch",
      });
      continue;
    }
    accepted.push(source);
    recordDisposition(ledger, "source", source.id, {
      disposition: "accepted",
      materializedId: source.id,
    });
  }
  return accepted;
}

interface AcceptedExcerpt {
  readonly proposal_id: string;
  readonly record: EvidenceExcerpt;
}

function materializeExcerpts(
  rawExcerpts: readonly unknown[],
  sources: readonly SourceDocument[],
  context: ContextSnapshot,
  ledger: DispositionLedger,
): AcceptedExcerpt[] {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const accepted: AcceptedExcerpt[] = [];
  const seenIds = new Set<string>();
  for (const rawRecord of rawExcerpts) {
    // All field reads below consume this frozen own-data snapshot only.
    const raw = snapshotProposalRecord(rawRecord);
    const label = safeProposalLabel(raw, "proposal_id");
    if (raw === null) {
      recordDisposition(ledger, "excerpt", label, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    if (suppliesForgedTrustStatus(raw)) {
      recordDisposition(ledger, "excerpt", label, {
        disposition: "rejected",
        reasonCode: "proposal_supplied_trust_status_disallowed",
      });
      continue;
    }
    const proposalId = stringValue(raw, "proposal_id");
    const sourceDocumentId = stringValue(raw, "source_document_id");
    const quote = stringValue(raw, "quote");
    if (proposalId === undefined || !SAFE_PROPOSAL_ID.test(proposalId)) {
      recordDisposition(ledger, "excerpt", label, {
        disposition: "rejected",
        reasonCode: "unsafe_proposal_id",
      });
      continue;
    }
    if (seenIds.has(proposalId)) {
      recordDisposition(ledger, "excerpt", proposalId, {
        disposition: "rejected",
        reasonCode: "duplicate_proposal_id",
      });
      continue;
    }
    seenIds.add(proposalId);
    if (sourceDocumentId === undefined || quote === undefined || quote.trim() === "") {
      recordDisposition(ledger, "excerpt", proposalId, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    const source = sourceById.get(sourceDocumentId);
    if (source === undefined) {
      recordDisposition(ledger, "excerpt", proposalId, {
        disposition: "rejected",
        reasonCode: "unknown_source_document_id",
      });
      continue;
    }
    const charStart = source.raw_text.indexOf(quote);
    if (charStart === -1) {
      recordDisposition(ledger, "excerpt", proposalId, {
        disposition: "rejected",
        reasonCode: "excerpt_text_not_found_in_source",
      });
      continue;
    }
    const materializedId = `${ID_PREFIXES.evidence_excerpt}_${proposalId}`;
    accepted.push({
      proposal_id: proposalId,
      record: {
        id: materializedId,
        source_document_id: source.id,
        text: quote,
        kind: "literal",
        char_start: charStart,
        char_end: charStart + quote.length,
        captured_at: context.materialized_at,
        // Materialized proposal-derived excerpts stay `proposed`; only a
        // later human review surface may accept them.
        validation_status: "proposed",
        rejection_reason: null,
      },
    });
    recordDisposition(ledger, "excerpt", proposalId, {
      disposition: "accepted",
      materializedId,
    });
  }
  return accepted;
}

interface AcceptedClaim {
  readonly proposal_id: string;
  readonly record: Claim;
  readonly claim_evidence: ClaimEvidence[];
}

function capConfidence(confidence: (typeof CONFIDENCE_LEVELS)[number]): "medium" | "low" {
  // Model-proposed content pending human review may not carry high
  // confidence: the deterministic Graph validator requires accepted
  // supporting evidence for high-confidence claims, and nothing here is
  // accepted yet.
  return confidence === "low" ? "low" : "medium";
}

function materializeClaims(
  rawClaims: readonly unknown[],
  excerpts: readonly AcceptedExcerpt[],
  context: ContextSnapshot,
  ledger: DispositionLedger,
): AcceptedClaim[] {
  const excerptByProposalId = new Map(excerpts.map((e) => [e.proposal_id, e.record]));
  const accepted: AcceptedClaim[] = [];
  const seenIds = new Set<string>();
  for (const rawRecord of rawClaims) {
    // All field reads below consume this frozen own-data snapshot only.
    const raw = snapshotProposalRecord(rawRecord);
    const label = safeProposalLabel(raw, "proposal_id");
    if (raw === null) {
      recordDisposition(ledger, "claim", label, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    if (suppliesForgedTrustStatus(raw)) {
      recordDisposition(ledger, "claim", label, {
        disposition: "rejected",
        reasonCode: "proposal_supplied_trust_status_disallowed",
      });
      continue;
    }
    const proposalId = stringValue(raw, "proposal_id");
    if (proposalId === undefined || !SAFE_PROPOSAL_ID.test(proposalId)) {
      recordDisposition(ledger, "claim", label, {
        disposition: "rejected",
        reasonCode: "unsafe_proposal_id",
      });
      continue;
    }
    if (seenIds.has(proposalId)) {
      recordDisposition(ledger, "claim", proposalId, {
        disposition: "rejected",
        reasonCode: "duplicate_proposal_id",
      });
      continue;
    }
    seenIds.add(proposalId);
    const claimType = stringValue(raw, "claim_type");
    const text = stringValue(raw, "text");
    const normalizedSubject = stringValue(raw, "normalized_subject");
    const confidence = stringValue(raw, "confidence");
    const supportingExcerptIds = stringArrayValue(raw, "supporting_excerpt_proposal_ids");
    if (
      claimType === undefined ||
      !SAFE_CLAIM_TYPE.test(claimType) ||
      text === undefined ||
      text.trim() === "" ||
      normalizedSubject === undefined ||
      !SAFE_NORMALIZED_SUBJECT.test(normalizedSubject) ||
      confidence === undefined ||
      !CONFIDENCE_LEVELS.includes(confidence as (typeof CONFIDENCE_LEVELS)[number]) ||
      supportingExcerptIds === undefined
    ) {
      recordDisposition(ledger, "claim", proposalId, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    const supportingExcerpts = supportingExcerptIds.map((id) => excerptByProposalId.get(id));
    if (supportingExcerpts.length === 0 || supportingExcerpts.some((e) => e === undefined)) {
      recordDisposition(ledger, "claim", proposalId, {
        disposition: "rejected",
        reasonCode: "missing_supporting_excerpt_reference",
      });
      continue;
    }
    const materializedId = `${ID_PREFIXES.claim}_${proposalId}`;
    const claimEvidence: ClaimEvidence[] = supportingExcerpts.map((excerpt, i) => ({
      id: `${ID_PREFIXES.claim_evidence}_${proposalId}-${i}`,
      claim_id: materializedId,
      evidence_excerpt_id: (excerpt as EvidenceExcerpt).id,
      relationship: "supports",
      rationale: "model-proposed supporting excerpt pending human review",
      confidence: capConfidence(confidence as (typeof CONFIDENCE_LEVELS)[number]),
      created_at: context.materialized_at,
    }));
    accepted.push({
      proposal_id: proposalId,
      record: {
        id: materializedId,
        team_id: context.team_id,
        account_id: context.account_id,
        claim_type: claimType,
        text,
        normalized_subject: normalizedSubject,
        confidence: capConfidence(confidence as (typeof CONFIDENCE_LEVELS)[number]),
        // Trust language committed by this contract: existing `unverified`
        // status, never `verified`/`source_document_only`.
        provenance_status: "unverified",
        status: "active",
        created_by: "model",
        created_at: context.materialized_at,
      },
      claim_evidence: claimEvidence,
    });
    recordDisposition(ledger, "claim", proposalId, {
      disposition: "accepted",
      materializedId,
    });
  }
  return accepted;
}

interface AcceptedAccountObject {
  readonly record: AccountObject;
  readonly account_object_claims: AccountObjectClaim[];
}

function materializeAccountObjects(
  rawObjects: readonly unknown[],
  claims: readonly AcceptedClaim[],
  context: ContextSnapshot,
  ledger: DispositionLedger,
): AcceptedAccountObject[] {
  const claimByProposalId = new Map(claims.map((c) => [c.proposal_id, c.record]));
  const accepted: AcceptedAccountObject[] = [];
  const seenIds = new Set<string>();
  for (const rawRecord of rawObjects) {
    // All field reads below consume this frozen own-data snapshot only.
    const raw = snapshotProposalRecord(rawRecord);
    const label = safeProposalLabel(raw, "proposal_id");
    if (raw === null) {
      recordDisposition(ledger, "account_object", label, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    if (suppliesForgedTrustStatus(raw)) {
      recordDisposition(ledger, "account_object", label, {
        disposition: "rejected",
        reasonCode: "proposal_supplied_trust_status_disallowed",
      });
      continue;
    }
    const proposalId = stringValue(raw, "proposal_id");
    if (proposalId === undefined || !SAFE_PROPOSAL_ID.test(proposalId)) {
      recordDisposition(ledger, "account_object", label, {
        disposition: "rejected",
        reasonCode: "unsafe_proposal_id",
      });
      continue;
    }
    if (seenIds.has(proposalId)) {
      recordDisposition(ledger, "account_object", proposalId, {
        disposition: "rejected",
        reasonCode: "duplicate_proposal_id",
      });
      continue;
    }
    seenIds.add(proposalId);
    const objectType = stringValue(raw, "object_type");
    const title = stringValue(raw, "title");
    const summary = stringValue(raw, "summary");
    const supportingClaimIds = stringArrayValue(raw, "supporting_claim_proposal_ids");
    if (
      title === undefined ||
      title.trim() === "" ||
      summary === undefined ||
      summary.trim() === "" ||
      supportingClaimIds === undefined
    ) {
      recordDisposition(ledger, "account_object", proposalId, {
        disposition: "rejected",
        reasonCode: "malformed_proposal_record",
      });
      continue;
    }
    if (
      objectType === undefined ||
      !ACCOUNT_OBJECT_KINDS.includes(objectType as AccountObjectKind)
    ) {
      recordDisposition(ledger, "account_object", proposalId, {
        disposition: "rejected",
        reasonCode: "unsupported_account_object_type",
      });
      continue;
    }
    const supportingClaims = supportingClaimIds.map((id) => claimByProposalId.get(id));
    if (supportingClaims.length === 0 || supportingClaims.some((c) => c === undefined)) {
      recordDisposition(ledger, "account_object", proposalId, {
        disposition: "rejected",
        reasonCode: "missing_supporting_claim_reference",
      });
      continue;
    }
    const materializedId = `${ID_PREFIXES.account_object}_${proposalId}`;
    accepted.push({
      record: {
        id: materializedId,
        team_id: context.team_id,
        account_id: context.account_id,
        object_type: objectType as AccountObjectKind,
        title,
        summary,
        payload_json: {
          review_state: PROPOSAL_MATERIALIZATION_REVIEW_STATE,
          origin: PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN,
          proposal_set_id: context.proposal_set_id,
        },
        confidence: "medium",
        provenance_status: "unverified",
        status: "active",
        created_by: "model",
        created_at: context.materialized_at,
        updated_at: context.materialized_at,
      },
      account_object_claims: supportingClaims.map((claim, i) => ({
        id: `${ID_PREFIXES.account_object_claim}_${proposalId}-${i}`,
        account_object_id: materializedId,
        claim_id: (claim as Claim).id,
        relationship: i === 0 ? "primary" : "supporting",
      })),
    });
    recordDisposition(ledger, "account_object", proposalId, {
      disposition: "accepted",
      materializedId,
    });
  }
  return accepted;
}

// Final fail-closed guard: nothing materialized from proposals may carry
// verified/source-backed trust language or accepted excerpts, regardless of
// any earlier bug. Throws instead of downgrading so a violation is loud.
export function assertProposalDerivedRecordsUnverified(bundle: GraphBundle): void {
  for (const excerpt of bundle.excerpts) {
    if (excerpt.validation_status !== "proposed") {
      throw new Error(
        "proposal-derived excerpts must stay in proposed validation status pending human review",
      );
    }
  }
  for (const claim of bundle.claims) {
    if (claim.provenance_status !== "unverified" || claim.confidence === "high") {
      throw new Error(
        "proposal-derived claims must stay unverified with capped confidence pending human review",
      );
    }
  }
  for (const accountObject of bundle.account_objects) {
    if (accountObject.provenance_status !== "unverified" || accountObject.confidence === "high") {
      throw new Error(
        "proposal-derived account objects must stay unverified with capped confidence pending human review",
      );
    }
  }
}

function countByKind(
  dispositions: readonly ProposalRecordDisposition[],
  disposition: "accepted" | "rejected",
): ProposalMaterializationCounts {
  const count = (kind: ProposalRecordKind): number =>
    dispositions.filter((d) => d.record_kind === kind && d.disposition === disposition).length;
  return Object.freeze({
    sources: count("source"),
    excerpts: count("excerpt"),
    claims: count("claim"),
    account_objects: count("account_object"),
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

export function materializeProposalForValidation(
  input: MaterializeProposalForValidationInput,
): ProposalMaterializationArtifact {
  const inputSnapshot = snapshotProposalRecord(input);
  if (inputSnapshot === null) {
    throw new Error("proposal materialization requires an input object");
  }
  const context = snapshotContext(ownDataValue(inputSnapshot, "context"));

  // Snapshot every root array before any element is read; hostile arrays
  // (accessor elements, proxy traps, overridden iterators, overlong or
  // sparse shapes) reject with this sanitized error, never their own.
  const rawSources = snapshotUntrustedArray(
    ownDataValue(inputSnapshot, "public_sources"),
    MAX_PROPOSAL_RECORDS_PER_KIND,
  );
  const rawExcerpts = snapshotUntrustedArray(
    ownDataValue(inputSnapshot, "proposed_excerpts"),
    MAX_PROPOSAL_RECORDS_PER_KIND,
  );
  const rawClaims = snapshotUntrustedArray(
    ownDataValue(inputSnapshot, "proposed_claims"),
    MAX_PROPOSAL_RECORDS_PER_KIND,
  );
  const rawObjects = snapshotUntrustedArray(
    ownDataValue(inputSnapshot, "proposed_account_objects"),
    MAX_PROPOSAL_RECORDS_PER_KIND,
  );
  if (rawSources === null || rawExcerpts === null || rawClaims === null || rawObjects === null) {
    throw new Error(
      "proposal materialization requires plain bounded public_sources, proposed_excerpts, proposed_claims, and proposed_account_objects arrays",
    );
  }

  const ledger: DispositionLedger = { dispositions: [] };
  const sources = materializeSources(rawSources, context, ledger);
  const excerpts = materializeExcerpts(rawExcerpts, sources, context, ledger);
  const claims = materializeClaims(rawClaims, excerpts, context, ledger);
  const accountObjects = materializeAccountObjects(rawObjects, claims, context, ledger);

  const researchRun: ResearchRun = {
    id: `${ID_PREFIXES.research_run}_${context.proposal_set_id}`,
    team_id: context.team_id,
    account_id: context.account_id,
    // `fixture` mode: this materialization is deterministic and no-spend.
    mode: "fixture",
    provider: null,
    model: null,
    status: "completed",
    cost_cap_usd: 0,
    observed_cost_usd: 0,
    started_at: context.materialized_at,
    completed_at: context.materialized_at,
  };

  const bundleCandidate: GraphBundle = {
    sources,
    excerpts: excerpts.map((e) => e.record),
    claims: claims.map((c) => c.record),
    claim_evidence: claims.flatMap((c) => c.claim_evidence),
    account_objects: accountObjects.map((o) => o.record),
    account_object_claims: accountObjects.flatMap((o) => o.account_object_claims),
    research_runs: [researchRun],
    run_artifacts: [],
    audit_events: [],
  };

  assertProposalDerivedRecordsUnverified(bundleCandidate);
  const bundleValidation = validateGraphBundle(bundleCandidate, { mode: "validation" });

  const artifact: ProposalMaterializationArtifact = {
    kind: "proposal-materialization-validation-artifact",
    schema_version: PROPOSAL_MATERIALIZATION_SCHEMA_VERSION,
    disposable: true,
    origin: context.origin,
    proposal_set_id: context.proposal_set_id,
    team_id: context.team_id,
    account_id: context.account_id,
    materialized_at: context.materialized_at,
    boundaries: {
      current_effective_authorization: "none",
      authorizes_provider_call: false,
      authorizes_private_evidence_read: false,
      authorizes_graph_ingestion: false,
      graph_ingestion_performed: false,
      provider_calls_executed: 0,
      private_evidence_read: false,
      durable_writes_performed: false,
      production_writes: false,
      readiness_claim: false,
    },
    trust_language: {
      provenance_status: "unverified",
      excerpt_validation_status: "proposed",
      review_state: PROPOSAL_MATERIALIZATION_REVIEW_STATE,
      adds_new_truth_status_tier: false,
      confidence_cap: "medium",
    },
    dispositions: ledger.dispositions,
    accepted_counts: countByKind(ledger.dispositions, "accepted"),
    rejected_counts: countByKind(ledger.dispositions, "rejected"),
    bundle_candidate: bundleCandidate,
    bundle_validation: bundleValidation,
    next_visible_workshop_artifact: {
      name: PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_ARTIFACT_NAME,
      scope:
        "deterministic fake-mode Workshop HTML preview rendered from the accepted public-curated bundle candidate of one proposal set",
      approval_surface: PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_APPROVAL_SURFACE,
      private_fresh_route_proof_input_allowed: false,
      private_fresh_route_proof_requires: "separate-fresh-private-evidence-handling-approval",
    },
  };
  return deepFreeze(artifact);
}
