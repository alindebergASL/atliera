import type { SubjectGraphRevisionToken } from "./subject-graph-revision-intent.ts";
import type { ValidatedCandidate } from "./validated-candidate.ts";

export const DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_KIND =
  "atliera_disposable_sqlite_subject_graph_revision_lab_permit" as const;
export const DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_VERSION =
  1 as const;

/**
 * Exact effect admission for the disposable SQLite fixture/test slice only.
 * It deliberately carries no human approval, ratification, or production
 * authority.
 */
export interface DisposableSqliteSubjectGraphRevisionLabPermit {
  readonly kind: typeof DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_KIND;
  readonly version: typeof DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_VERSION;
  readonly fixture_test_only: true;
  readonly effect_admission_only: true;
  readonly disposable_isolated_sqlite_only: true;
  readonly authenticated_human_approval: false;
  readonly ratification: false;
  readonly production_authority: false;
  readonly real_account_effects_allowed: false;
  readonly provider_calls_allowed: false;
  readonly network_operations_allowed: false;
  readonly mcp_invocations_allowed: false;
  readonly deployment_operations_allowed: false;
  readonly m5a_m5b_flows_allowed: false;
}

export function createDisposableSqliteSubjectGraphRevisionLabPermit(): DisposableSqliteSubjectGraphRevisionLabPermit {
  return Object.freeze({
    kind: DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_KIND,
    version: DISPOSABLE_SQLITE_SUBJECT_GRAPH_REVISION_LAB_PERMIT_VERSION,
    fixture_test_only: true,
    effect_admission_only: true,
    disposable_isolated_sqlite_only: true,
    authenticated_human_approval: false,
    ratification: false,
    production_authority: false,
    real_account_effects_allowed: false,
    provider_calls_allowed: false,
    network_operations_allowed: false,
    mcp_invocations_allowed: false,
    deployment_operations_allowed: false,
    m5a_m5b_flows_allowed: false,
  });
}

export interface TransactionGraphIdentity {
  readonly team_id: string;
  readonly account_id: string;
  readonly subject_id: string;
  readonly purpose: "candidate_validation";
}

export interface TransactionPredecessorBasis {
  readonly mode: "bootstrap" | "successor";
  readonly expected_prior_revision: SubjectGraphRevisionToken | null;
  readonly expected_base_snapshot_sha256: string;
}

export interface SubjectGraphRevisionSuccessReceiptAuthority {
  readonly effect_admission: "fixture_test_only_disposable_sqlite";
  readonly intent_is_write_authority: false;
  readonly integrity_digest_is_authority: false;
  readonly authenticated_human_approval: false;
  readonly ratification: false;
  readonly production_authority: false;
  readonly provider_calls_performed: 0;
  readonly network_operations_performed: 0;
  readonly mcp_invocations_performed: 0;
  readonly deployment_operations_performed: 0;
}

export interface SubjectGraphRevisionSuccessReceiptCore {
  readonly kind: "atliera_subject_graph_revision_success_receipt";
  readonly version: 1;
  readonly outcome: "committed";
  readonly graph_identity: TransactionGraphIdentity;
  readonly predecessor_basis: TransactionPredecessorBasis;
  readonly committed_revision: SubjectGraphRevisionToken;
  readonly proposed_snapshot_sha256: string;
  readonly intent_sha256: string;
  readonly review_handoff_sha256: string;
  readonly replay_key: string;
  /** SQLite-generated operational commit metadata, not trusted review time. */
  readonly operational_committed_at: string;
  readonly authority: SubjectGraphRevisionSuccessReceiptAuthority;
}

export interface SubjectGraphRevisionSuccessReceipt
  extends SubjectGraphRevisionSuccessReceiptCore {
  /** Canonical SHA-256 of every receipt field except this field. */
  readonly receipt_sha256: string;
}

export interface SubjectGraphRevisionCommittedState {
  readonly graph_identity: TransactionGraphIdentity;
  readonly revision: SubjectGraphRevisionToken;
  readonly snapshot_sha256: string;
  readonly snapshot: ValidatedCandidate;
  readonly intent_sha256: string;
  readonly last_receipt_sha256: string;
  readonly operational_committed_at: string;
}

export interface SubjectGraphRevisionRecoveryIdentity {
  readonly graph_identity: TransactionGraphIdentity;
  readonly intent_sha256: string;
  readonly replay_key: string;
  readonly proposed_snapshot_sha256: string;
}

export interface SubjectGraphRevisionConflictDimensions {
  readonly revision: SubjectGraphRevisionToken | null;
  readonly snapshot_sha256: string | null;
}

export type SubjectGraphRevisionConflictKind =
  | "missing_graph"
  | "revision_mismatch"
  | "snapshot_mismatch"
  | "revision_and_snapshot_mismatch";

export interface SubjectGraphRevisionConflictReceiptCore {
  readonly kind: "atliera_subject_graph_revision_conflict_receipt";
  readonly version: 1;
  readonly outcome: "conflicted";
  readonly conflict_kind: SubjectGraphRevisionConflictKind;
  readonly graph_identity: TransactionGraphIdentity;
  readonly intent_sha256: string;
  readonly replay_key: string;
  readonly expected: SubjectGraphRevisionConflictDimensions;
  readonly actual: SubjectGraphRevisionConflictDimensions;
  readonly persisted: false;
}

export interface SubjectGraphRevisionConflictReceipt
  extends SubjectGraphRevisionConflictReceiptCore {
  readonly receipt_sha256: string;
}

export type SubjectGraphRevisionRefusalReason =
  | "invalid_lab_permit"
  | "unsafe_database_path"
  | "malformed_intent"
  | "snapshot_storage_limit_exceeded"
  | "receipt_storage_limit_exceeded"
  | "replay_key_collision";

export interface SubjectGraphRevisionRefusalReceiptCore {
  readonly kind: "atliera_subject_graph_revision_refusal_receipt";
  readonly version: 1;
  readonly outcome: "refused";
  readonly reason: SubjectGraphRevisionRefusalReason;
  readonly intent_sha256: string | null;
  readonly replay_key: string | null;
  readonly persisted: false;
}

export interface SubjectGraphRevisionRefusalReceipt
  extends SubjectGraphRevisionRefusalReceiptCore {
  readonly receipt_sha256: string;
}

export type SubjectGraphRevisionDependencyFailureCode =
  | "database_unavailable_or_busy"
  | "transaction_failed"
  | "durable_state_invalid";

export type SubjectGraphRevisionReadRefusalReason =
  | "invalid_lab_permit"
  | "unsafe_database_path"
  | "malformed_graph_identity";

/**
 * Read-only restart boundary for the later Workshop projection. A successful
 * read returns the current graph and the exact success receipt that installed
 * it; it does not admit another write or elevate the fixture permit.
 */
export type SubjectGraphRevisionReadResult =
  | {
      readonly outcome: "found";
      readonly found: true;
      readonly receipt: SubjectGraphRevisionSuccessReceipt;
      readonly state: SubjectGraphRevisionCommittedState;
    }
  | {
      readonly outcome: "not_found";
      readonly found: false;
      readonly graph_identity: TransactionGraphIdentity;
    }
  | {
      readonly outcome: "refused";
      readonly found: false;
      readonly reason: SubjectGraphRevisionReadRefusalReason;
    }
  | {
      readonly outcome: "dependency_failed";
      readonly found: "indeterminate";
      readonly failure_code: SubjectGraphRevisionDependencyFailureCode;
      readonly message: "Disposable SQLite revision read dependency failed";
    };

export type SubjectGraphRevisionTransactionResult =
  | {
      readonly outcome: "committed";
      readonly committed: true;
      readonly commit_acknowledgement:
        | "direct"
        | "recovered_after_commit_boundary_failure";
      readonly receipt: SubjectGraphRevisionSuccessReceipt;
      readonly state: SubjectGraphRevisionCommittedState;
    }
  | {
      readonly outcome: "already_committed";
      readonly committed: true;
      readonly applied: false;
      readonly receipt: SubjectGraphRevisionSuccessReceipt;
    }
  | {
      readonly outcome: "conflicted";
      readonly committed: false;
      readonly applied: false;
      readonly conflict_kind: SubjectGraphRevisionConflictKind;
      readonly expected: SubjectGraphRevisionConflictDimensions;
      readonly actual: SubjectGraphRevisionConflictDimensions;
      readonly receipt: SubjectGraphRevisionConflictReceipt;
    }
  | {
      readonly outcome: "refused";
      readonly committed: false;
      readonly applied: false;
      readonly reason: SubjectGraphRevisionRefusalReason;
      readonly receipt: SubjectGraphRevisionRefusalReceipt;
    }
  | {
      readonly outcome: "dependency_failed";
      readonly committed: false;
      readonly transaction_state: "not_started" | "rolled_back";
      readonly failure_code: SubjectGraphRevisionDependencyFailureCode;
      readonly message: "Disposable SQLite revision transaction dependency failed";
    }
  | {
      readonly outcome: "committed_readback_failed";
      readonly committed: true;
      readonly failure_code: "post_commit_verification_failed";
      readonly message: "Commit succeeded but durable read-back verification failed";
      readonly recovery: SubjectGraphRevisionRecoveryIdentity;
    }
  | {
      readonly outcome: "indeterminate";
      readonly committed: "indeterminate";
      readonly failure_code: "commit_outcome_unresolved";
      readonly message: "Commit outcome could not be established by durable recovery";
      readonly recovery: SubjectGraphRevisionRecoveryIdentity;
    };

/** Separate consumer seam; it is intentionally absent from the public barrel. */
export interface SubjectGraphRevisionTransaction {
  consume(
    intent: unknown,
    permit: unknown,
  ): SubjectGraphRevisionTransactionResult;

  readCurrent(
    graphIdentity: unknown,
    permit: unknown,
  ): SubjectGraphRevisionReadResult;
}
