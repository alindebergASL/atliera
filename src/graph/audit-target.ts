import { idHasPrefix, isWellFormedId, type RecordKind } from "./ids.ts";
import type { HardFailure } from "./report.ts";
import type { AuditEvent, GraphBundle } from "./types.ts";

const LOCAL_AUDIT_TARGET_COLLECTIONS = {
  source_document: "sources",
  evidence_excerpt: "excerpts",
  claim: "claims",
  claim_evidence: "claim_evidence",
  account_object: "account_objects",
  account_object_claim: "account_object_claims",
  research_run: "research_runs",
  run_artifact: "run_artifacts",
  audit_event: "audit_events",
} as const satisfies Record<RecordKind, keyof GraphBundle>;

const HASH = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const SAFE_PROPOSAL_SET_ID = /^[a-z0-9][a-z0-9_-]{0,59}$/;
const STRICT_ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const M5B_RETENTION_DRAFT_ID =
  "m5b-fedex-source-retention-beyond-original-deadline";

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && /[^\p{White_Space}\uFEFF]/u.test(value);
}

function isStrictIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !STRICT_ISO_TIMESTAMP.test(value)) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function isLocalTargetType(value: string): value is RecordKind {
  return Object.prototype.hasOwnProperty.call(
    LOCAL_AUDIT_TARGET_COLLECTIONS,
    value,
  );
}

function localTargetResolves(
  bundle: GraphBundle,
  targetType: RecordKind,
  targetId: string,
): boolean {
  const collection = bundle[LOCAL_AUDIT_TARGET_COLLECTIONS[targetType]] as readonly {
    id: string;
  }[];
  return collection.some((record) => record.id === targetId);
}

function proposalSetBindingIsValid(
  bundle: GraphBundle,
  audit: AuditEvent,
): boolean {
  if (
    audit.event_type !== "proposal_set.ratified" ||
    !SAFE_PROPOSAL_SET_ID.test(audit.target_id)
  ) {
    return false;
  }

  const accountBinding = audit.payload_json.account_id;
  return bundle.run_artifacts.some((artifact) => {
    if (
      artifact.artifact_type !== "m5a_curated_proposal_set_ratification" ||
      artifact.payload_json.proposal_set_id !== audit.target_id
    ) {
      return false;
    }
    const run = bundle.research_runs.find(
      (candidate) => candidate.id === artifact.research_run_id,
    );
    return run !== undefined &&
      run.team_id === audit.team_id &&
      accountBinding === run.account_id;
  });
}

function rejectedCandidateBindingIsValid(
  bundle: GraphBundle,
  audit: AuditEvent,
): boolean {
  const payload = audit.payload_json;
  return audit.event_type === "claim.rejected" &&
    isWellFormedId(audit.target_id) &&
    idHasPrefix(audit.target_id, "account_object") &&
    !bundle.account_objects.some((record) => record.id === audit.target_id) &&
    payload.disposition === "reject" &&
    isNonBlank(payload.reason_code) &&
    isNonBlank(payload.owner_authorization_id) &&
    typeof payload.ratification_raw_sha256 === "string" &&
    HASH.test(payload.ratification_raw_sha256) &&
    typeof payload.ratification_artifact_sha256 === "string" &&
    HASH.test(payload.ratification_artifact_sha256) &&
    typeof payload.review_packet_sha256 === "string" &&
    HASH.test(payload.review_packet_sha256) &&
    typeof payload.candidate_content_sha256 === "string" &&
    HASH.test(payload.candidate_content_sha256) &&
    typeof payload.execution_commit === "string" &&
    GIT_OID.test(payload.execution_commit) &&
    typeof payload.execution_tree === "string" &&
    GIT_OID.test(payload.execution_tree) &&
    payload.ratification_mode === "repository-native-one-shot-local-write";
}

function retentionDraftBindingIsValid(audit: AuditEvent): boolean {
  const payload = audit.payload_json;
  const disposition = payload.disposition;
  const accepted = disposition === "accept";
  const rejected = disposition === "reject";
  const expectedOutcome = accepted
    ? "beyond-deadline-retention-approved"
    : "beyond-deadline-retention-not-authorized-external-custody-cleanup-required";

  return audit.event_type === "source.retention_decided" &&
    audit.target_id === M5B_RETENTION_DRAFT_ID &&
    payload.retention_draft_id === M5B_RETENTION_DRAFT_ID &&
    payload.ratifier_id === audit.actor_id &&
    typeof payload.ratification_raw_sha256 === "string" &&
    HASH.test(payload.ratification_raw_sha256) &&
    typeof payload.ratification_artifact_sha256 === "string" &&
    HASH.test(payload.ratification_artifact_sha256) &&
    typeof payload.review_packet_sha256 === "string" &&
    HASH.test(payload.review_packet_sha256) &&
    isStrictIsoTimestamp(payload.deadline) &&
    (accepted || rejected) &&
    payload.outcome === expectedOutcome &&
    payload.original_custody_deleted === false &&
    payload.external_custody_cleanup_required === rejected;
}

function externalTargetBindingIsValid(
  bundle: GraphBundle,
  audit: AuditEvent,
): boolean | null {
  switch (audit.target_type) {
    case "proposal_set":
      return proposalSetBindingIsValid(bundle, audit);
    case "account_object_candidate":
      return rejectedCandidateBindingIsValid(bundle, audit);
    case "source_custody_retention_draft":
      return retentionDraftBindingIsValid(audit);
    default:
      return null;
  }
}

export function validateAuditTargetReference(
  bundle: GraphBundle,
  audit: AuditEvent,
): HardFailure | null {
  if (isLocalTargetType(audit.target_type)) {
    if (localTargetResolves(bundle, audit.target_type, audit.target_id)) {
      return null;
    }
    return {
      code: "unresolved_local_audit_target",
      message:
        `audit_event ${audit.id} target ${audit.target_type}/${audit.target_id} ` +
        `does not resolve in bundle.${LOCAL_AUDIT_TARGET_COLLECTIONS[audit.target_type]}`,
      record_kind: "audit_event",
      record_id: audit.id,
      field: "target_id",
    };
  }

  const externalBindingIsValid = externalTargetBindingIsValid(bundle, audit);
  if (externalBindingIsValid === null) {
    return {
      code: "unsupported_audit_target_type",
      message: `audit_event ${audit.id} has unsupported target_type ${audit.target_type}`,
      record_kind: "audit_event",
      record_id: audit.id,
      field: "target_type",
    };
  }

  if (externalBindingIsValid) return null;
  const requirement = audit.target_type === "proposal_set"
    ? "requires proposal_set.ratified and the exact M5a same-team run_artifact proposal_set/account binding"
    : audit.target_type === "account_object_candidate"
      ? "requires claim.rejected, a non-local account_object id, reject reason, and legacy M5b ratification bindings"
      : "requires source.retention_decided and the exact legacy M5b target, actor, hash, deadline, and disposition bindings";
  return {
    code: "invalid_external_audit_target_binding",
    message:
      `audit_event ${audit.id} has invalid ${audit.target_type} binding for target ${audit.target_id}: ${requirement}`,
    record_kind: "audit_event",
    record_id: audit.id,
    field: "target_id",
  };
}
