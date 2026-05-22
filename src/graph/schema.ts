// Hand-rolled structural schema parsers for the graph primitives.
//
// We avoid pulling in a runtime validation library so the dependency
// surface stays tiny and the parser's failure modes stay obvious. Each
// parser returns either the typed record or a list of structural errors
// keyed to the field path.

import type {
  AccountObject,
  AccountObjectClaim,
  AccountObjectClaimRelationship,
  AccountObjectKind,
  AuditEvent,
  ActorType,
  Claim,
  ClaimEvidence,
  ClaimEvidenceRelationship,
  ClaimStatus,
  EvidenceExcerpt,
  ExcerptKind,
  ExcerptValidationStatus,
  GraphBundle,
  ProvenanceStatus,
  ResearchRun,
  ResearchRunMode,
  RunArtifact,
  SourceDocument,
} from "./types.ts";

export type SchemaErrorKind = "unknown_field" | "shape";

export interface SchemaError {
  path: string;
  message: string;
  kind: SchemaErrorKind;
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: SchemaError[] };

function err(path: string, message: string, kind: SchemaErrorKind = "shape"): SchemaError {
  return { path, message, kind };
}

// Strict envelope policy: every record envelope and the bundle itself
// rejects unknown fields. Hallucinated fields are a common failure mode
// for model proposals, and silently accepting them lets payloads grow
// past what the validator can reason about.
function rejectUnknownFields(
  obj: Record<string, unknown>,
  knownKeys: readonly string[],
  path: string,
  errors: SchemaError[],
): void {
  const allowed = new Set(knownKeys);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      errors.push(
        err(
          `${path}.${key}`,
          `unknown field '${key}' is not permitted on ${path}`,
          "unknown_field",
        ),
      );
    }
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: SchemaError[],
): string {
  const v = obj[key];
  if (typeof v !== "string") {
    errors.push(err(`${path}.${key}`, "expected string"));
    return "";
  }
  return v;
}

function reqNumber(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: SchemaError[],
): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    errors.push(err(`${path}.${key}`, "expected finite number"));
    return 0;
  }
  return v;
}

function reqEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
  errors: SchemaError[],
): T {
  const v = obj[key];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    errors.push(
      err(
        `${path}.${key}`,
        `expected one of ${allowed.join("|")}, got ${JSON.stringify(v)}`,
      ),
    );
    return allowed[0] as T;
  }
  return v as T;
}

function nullableString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: SchemaError[],
): string | null {
  const v = obj[key];
  if (v === null) return null;
  if (typeof v === "string") return v;
  errors.push(err(`${path}.${key}`, "expected string or null"));
  return null;
}

function nullableNumber(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: SchemaError[],
): number | null {
  const v = obj[key];
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  errors.push(err(`${path}.${key}`, "expected number or null"));
  return null;
}

function reqJsonObject(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  errors: SchemaError[],
): Record<string, unknown> {
  const v = obj[key];
  if (!isObj(v)) {
    errors.push(err(`${path}.${key}`, "expected JSON object"));
    return {};
  }
  return v;
}

const PROVENANCE_STATUSES: readonly ProvenanceStatus[] = [
  "verified",
  "source_document_only",
  "unverified",
  "unsupported",
  "stale",
];

const CLAIM_STATUSES: readonly ClaimStatus[] = [
  "active",
  "stale",
  "contradicted",
  "rejected",
  "superseded",
];

const EXCERPT_STATUSES: readonly ExcerptValidationStatus[] = [
  "accepted",
  "rejected",
  "proposed",
];

const EXCERPT_KINDS: readonly ExcerptKind[] = ["literal", "paraphrase"];

const CLAIM_EVIDENCE_RELATIONSHIPS: readonly ClaimEvidenceRelationship[] = [
  "supports",
  "contradicts",
  "context",
];

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

const OBJECT_CLAIM_RELATIONSHIPS: readonly AccountObjectClaimRelationship[] = [
  "primary",
  "supporting",
  "context",
];

const ACTOR_TYPES: readonly ActorType[] = [
  "model",
  "user",
  "system",
  "import",
];

const RESEARCH_RUN_MODES: readonly ResearchRunMode[] = [
  "fixture",
  "fake",
  "model",
];

// Permitted top-level keys per record envelope. Anything outside these
// sets fails with HardFailureCode `unknown_field`.
const SOURCE_DOCUMENT_KEYS = [
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
] as const;

const EVIDENCE_EXCERPT_KEYS = [
  "id",
  "source_document_id",
  "text",
  "kind",
  "char_start",
  "char_end",
  "captured_at",
  "validation_status",
  "rejection_reason",
] as const;

const CLAIM_KEYS = [
  "id",
  "team_id",
  "account_id",
  "claim_type",
  "text",
  "normalized_subject",
  "confidence",
  "provenance_status",
  "status",
  "created_by",
  "created_at",
] as const;

const CLAIM_EVIDENCE_KEYS = [
  "id",
  "claim_id",
  "evidence_excerpt_id",
  "relationship",
  "rationale",
  "confidence",
  "created_at",
] as const;

const ACCOUNT_OBJECT_KEYS = [
  "id",
  "team_id",
  "account_id",
  "object_type",
  "title",
  "summary",
  "payload_json",
  "confidence",
  "provenance_status",
  "status",
  "created_by",
  "created_at",
  "updated_at",
] as const;

const ACCOUNT_OBJECT_CLAIM_KEYS = [
  "id",
  "account_object_id",
  "claim_id",
  "relationship",
] as const;

const RESEARCH_RUN_KEYS = [
  "id",
  "team_id",
  "account_id",
  "mode",
  "provider",
  "model",
  "status",
  "cost_cap_usd",
  "observed_cost_usd",
  "started_at",
  "completed_at",
] as const;

const RUN_ARTIFACT_KEYS = [
  "id",
  "research_run_id",
  "artifact_type",
  "payload_json",
  "created_at",
] as const;

const AUDIT_EVENT_KEYS = [
  "id",
  "team_id",
  "actor_type",
  "actor_id",
  "event_type",
  "target_type",
  "target_id",
  "payload_json",
  "created_at",
] as const;

const GRAPH_BUNDLE_KEYS = [
  "sources",
  "excerpts",
  "claims",
  "claim_evidence",
  "account_objects",
  "account_object_claims",
  "research_runs",
  "run_artifacts",
  "audit_events",
] as const;

export function parseSourceDocument(
  raw: unknown,
  path = "$",
): ParseResult<SourceDocument> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, SOURCE_DOCUMENT_KEYS, path, errors);
  const value: SourceDocument = {
    id: reqString(raw, "id", path, errors),
    team_id: reqString(raw, "team_id", path, errors),
    account_id: reqString(raw, "account_id", path, errors),
    url: reqString(raw, "url", path, errors),
    canonical_url: reqString(raw, "canonical_url", path, errors),
    title: reqString(raw, "title", path, errors),
    publisher: nullableString(raw, "publisher", path, errors),
    source_type: reqString(raw, "source_type", path, errors),
    fetched_at: reqString(raw, "fetched_at", path, errors),
    accessed_at: reqString(raw, "accessed_at", path, errors),
    content_hash: reqString(raw, "content_hash", path, errors),
    raw_text: reqString(raw, "raw_text", path, errors),
    reliability: reqEnum(
      raw,
      "reliability",
      ["high", "medium", "low", "unknown"] as const,
      path,
      errors,
    ),
    status: reqEnum(
      raw,
      "status",
      ["active", "stale", "unavailable", "rejected"] as const,
      path,
      errors,
    ),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseEvidenceExcerpt(
  raw: unknown,
  path = "$",
): ParseResult<EvidenceExcerpt> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, EVIDENCE_EXCERPT_KEYS, path, errors);
  const value: EvidenceExcerpt = {
    id: reqString(raw, "id", path, errors),
    source_document_id: reqString(raw, "source_document_id", path, errors),
    text: reqString(raw, "text", path, errors),
    kind: reqEnum(raw, "kind", EXCERPT_KINDS, path, errors),
    char_start: reqNumber(raw, "char_start", path, errors),
    char_end: reqNumber(raw, "char_end", path, errors),
    captured_at: reqString(raw, "captured_at", path, errors),
    validation_status: reqEnum(
      raw,
      "validation_status",
      EXCERPT_STATUSES,
      path,
      errors,
    ),
    rejection_reason: nullableString(raw, "rejection_reason", path, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseClaim(raw: unknown, path = "$"): ParseResult<Claim> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, CLAIM_KEYS, path, errors);
  const value: Claim = {
    id: reqString(raw, "id", path, errors),
    team_id: reqString(raw, "team_id", path, errors),
    account_id: reqString(raw, "account_id", path, errors),
    claim_type: reqString(raw, "claim_type", path, errors),
    text: reqString(raw, "text", path, errors),
    normalized_subject: reqString(raw, "normalized_subject", path, errors),
    confidence: reqEnum(
      raw,
      "confidence",
      ["high", "medium", "low"] as const,
      path,
      errors,
    ),
    provenance_status: reqEnum(
      raw,
      "provenance_status",
      PROVENANCE_STATUSES,
      path,
      errors,
    ),
    status: reqEnum(raw, "status", CLAIM_STATUSES, path, errors),
    created_by: reqEnum(raw, "created_by", ACTOR_TYPES, path, errors),
    created_at: reqString(raw, "created_at", path, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseClaimEvidence(
  raw: unknown,
  path = "$",
): ParseResult<ClaimEvidence> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, CLAIM_EVIDENCE_KEYS, path, errors);
  const value: ClaimEvidence = {
    id: reqString(raw, "id", path, errors),
    claim_id: reqString(raw, "claim_id", path, errors),
    evidence_excerpt_id: reqString(raw, "evidence_excerpt_id", path, errors),
    relationship: reqEnum(
      raw,
      "relationship",
      CLAIM_EVIDENCE_RELATIONSHIPS,
      path,
      errors,
    ),
    rationale: reqString(raw, "rationale", path, errors),
    confidence: reqEnum(
      raw,
      "confidence",
      ["high", "medium", "low"] as const,
      path,
      errors,
    ),
    created_at: reqString(raw, "created_at", path, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseAccountObject(
  raw: unknown,
  path = "$",
): ParseResult<AccountObject> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, ACCOUNT_OBJECT_KEYS, path, errors);
  const value: AccountObject = {
    id: reqString(raw, "id", path, errors),
    team_id: reqString(raw, "team_id", path, errors),
    account_id: reqString(raw, "account_id", path, errors),
    object_type: reqEnum(
      raw,
      "object_type",
      ACCOUNT_OBJECT_KINDS,
      path,
      errors,
    ),
    title: reqString(raw, "title", path, errors),
    summary: reqString(raw, "summary", path, errors),
    payload_json: reqJsonObject(raw, "payload_json", path, errors),
    confidence: reqEnum(
      raw,
      "confidence",
      ["high", "medium", "low"] as const,
      path,
      errors,
    ),
    provenance_status: reqEnum(
      raw,
      "provenance_status",
      PROVENANCE_STATUSES,
      path,
      errors,
    ),
    status: reqEnum(
      raw,
      "status",
      ["active", "stale", "rejected", "superseded"] as const,
      path,
      errors,
    ),
    created_by: reqEnum(raw, "created_by", ACTOR_TYPES, path, errors),
    created_at: reqString(raw, "created_at", path, errors),
    updated_at: reqString(raw, "updated_at", path, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseAccountObjectClaim(
  raw: unknown,
  path = "$",
): ParseResult<AccountObjectClaim> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, ACCOUNT_OBJECT_CLAIM_KEYS, path, errors);
  const value: AccountObjectClaim = {
    id: reqString(raw, "id", path, errors),
    account_object_id: reqString(raw, "account_object_id", path, errors),
    claim_id: reqString(raw, "claim_id", path, errors),
    relationship: reqEnum(
      raw,
      "relationship",
      OBJECT_CLAIM_RELATIONSHIPS,
      path,
      errors,
    ),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseResearchRun(
  raw: unknown,
  path = "$",
): ParseResult<ResearchRun> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, RESEARCH_RUN_KEYS, path, errors);
  const startedAt = nullableString(raw, "started_at", path, errors);
  const completedAt = nullableString(raw, "completed_at", path, errors);
  const observedCost = nullableNumber(raw, "observed_cost_usd", path, errors);
  const value: ResearchRun = {
    id: reqString(raw, "id", path, errors),
    team_id: reqString(raw, "team_id", path, errors),
    account_id: reqString(raw, "account_id", path, errors),
    mode: reqEnum(raw, "mode", RESEARCH_RUN_MODES, path, errors),
    provider: nullableString(raw, "provider", path, errors),
    model: nullableString(raw, "model", path, errors),
    status: reqEnum(
      raw,
      "status",
      ["pending", "running", "completed", "failed", "cancelled"] as const,
      path,
      errors,
    ),
    cost_cap_usd: reqNumber(raw, "cost_cap_usd", path, errors),
    observed_cost_usd: observedCost ?? 0,
    started_at: startedAt,
    completed_at: completedAt,
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseRunArtifact(
  raw: unknown,
  path = "$",
): ParseResult<RunArtifact> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, RUN_ARTIFACT_KEYS, path, errors);
  const value: RunArtifact = {
    id: reqString(raw, "id", path, errors),
    research_run_id: reqString(raw, "research_run_id", path, errors),
    artifact_type: reqString(raw, "artifact_type", path, errors),
    payload_json: reqJsonObject(raw, "payload_json", path, errors),
    created_at: reqString(raw, "created_at", path, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseAuditEvent(
  raw: unknown,
  path = "$",
): ParseResult<AuditEvent> {
  if (!isObj(raw)) return { ok: false, errors: [err(path, "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, AUDIT_EVENT_KEYS, path, errors);
  const value: AuditEvent = {
    id: reqString(raw, "id", path, errors),
    team_id: reqString(raw, "team_id", path, errors),
    actor_type: reqEnum(raw, "actor_type", ACTOR_TYPES, path, errors),
    actor_id: reqString(raw, "actor_id", path, errors),
    event_type: reqString(raw, "event_type", path, errors),
    target_type: reqString(raw, "target_type", path, errors),
    target_id: reqString(raw, "target_id", path, errors),
    payload_json: reqJsonObject(raw, "payload_json", path, errors),
    created_at: reqString(raw, "created_at", path, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function parseArray<T>(
  raw: unknown,
  path: string,
  parser: (item: unknown, itemPath: string) => ParseResult<T>,
): ParseResult<T[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, errors: [err(path, "expected array")] };
  }
  const errors: SchemaError[] = [];
  const out: T[] = [];
  raw.forEach((item, i) => {
    const r = parser(item, `${path}[${i}]`);
    if (r.ok) {
      out.push(r.value);
    } else {
      errors.push(...r.errors);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

export function parseGraphBundle(raw: unknown): ParseResult<GraphBundle> {
  if (!isObj(raw)) return { ok: false, errors: [err("$", "expected object")] };
  const errors: SchemaError[] = [];
  rejectUnknownFields(raw, GRAPH_BUNDLE_KEYS, "$", errors);
  const sources = parseArray(raw["sources"], "$.sources", parseSourceDocument);
  const excerpts = parseArray(
    raw["excerpts"],
    "$.excerpts",
    parseEvidenceExcerpt,
  );
  const claims = parseArray(raw["claims"], "$.claims", parseClaim);
  const claimEvidence = parseArray(
    raw["claim_evidence"],
    "$.claim_evidence",
    parseClaimEvidence,
  );
  const accountObjects = parseArray(
    raw["account_objects"],
    "$.account_objects",
    parseAccountObject,
  );
  const accountObjectClaims = parseArray(
    raw["account_object_claims"],
    "$.account_object_claims",
    parseAccountObjectClaim,
  );
  const researchRuns = parseArray(
    raw["research_runs"],
    "$.research_runs",
    parseResearchRun,
  );
  const runArtifacts = parseArray(
    raw["run_artifacts"],
    "$.run_artifacts",
    parseRunArtifact,
  );
  const auditEvents = parseArray(
    raw["audit_events"],
    "$.audit_events",
    parseAuditEvent,
  );
  for (const r of [
    sources,
    excerpts,
    claims,
    claimEvidence,
    accountObjects,
    accountObjectClaims,
    researchRuns,
    runArtifacts,
    auditEvents,
  ]) {
    if (!r.ok) errors.push(...r.errors);
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      sources: (sources as { ok: true; value: SourceDocument[] }).value,
      excerpts: (excerpts as { ok: true; value: EvidenceExcerpt[] }).value,
      claims: (claims as { ok: true; value: Claim[] }).value,
      claim_evidence: (claimEvidence as { ok: true; value: ClaimEvidence[] })
        .value,
      account_objects: (
        accountObjects as { ok: true; value: AccountObject[] }
      ).value,
      account_object_claims: (
        accountObjectClaims as { ok: true; value: AccountObjectClaim[] }
      ).value,
      research_runs: (researchRuns as { ok: true; value: ResearchRun[] }).value,
      run_artifacts: (runArtifacts as { ok: true; value: RunArtifact[] }).value,
      audit_events: (auditEvents as { ok: true; value: AuditEvent[] }).value,
    },
  };
}
