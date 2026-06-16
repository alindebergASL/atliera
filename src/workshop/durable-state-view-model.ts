import type { GraphBundle } from "../graph/types.ts";
import {
  WORKSHOP_REVIEW_STATE_MODEL_PROPOSED,
  type WorkshopRejectedProposalViewModel,
  type WorkshopViewModel,
} from "./view-model.ts";
import {
  type DurableGraphSnapshotRow,
} from "./proposal-durable-graph-write-execution.ts";
import {
  WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME,
  WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
  type WorkshopProposalHumanReviewDecisionArtifact,
  type WorkshopProposalHumanReviewDecisionRecord,
} from "./proposal-review-decision.ts";
import { snapshotDurableGraphSnapshotRow, snapshotPlainJsonValue } from "./durable-graph-snapshots-reader.ts";
import { buildWorkshopViewModel } from "./view-model.ts";

export const WORKSHOP_DURABLE_PENDING_REVIEW_TRUST_LABEL =
  "model-proposed-human-ratified-evidence-pending" as const;

export interface BuildWorkshopViewModelFromDurableStateOptions {
  readonly reviewDecisionArtifact?: WorkshopProposalHumanReviewDecisionArtifact | null;
}

function cloneBundleForWorkshopProjection(row: DurableGraphSnapshotRow): GraphBundle {
  const pendingReviewRow = row.trust_label === WORKSHOP_DURABLE_PENDING_REVIEW_TRUST_LABEL;
  return {
    sources: row.bundle.sources.map((source) => ({ ...source })),
    excerpts: row.bundle.excerpts.map((excerpt) => ({ ...excerpt })),
    claims: row.bundle.claims.map((claim) => ({
      ...claim,
      provenance_status: pendingReviewRow && claim.provenance_status === "source_document_only"
        ? "unverified"
        : claim.provenance_status,
    })),
    claim_evidence: row.bundle.claim_evidence.map((claimEvidence) => ({ ...claimEvidence })),
    account_objects: row.bundle.account_objects.map((accountObject) => ({
      ...accountObject,
      payload_json: pendingReviewRow && accountObject.provenance_status === "source_document_only"
        ? {
            ...accountObject.payload_json,
            review_state: WORKSHOP_REVIEW_STATE_MODEL_PROPOSED,
            durable_source_provenance_status: accountObject.provenance_status,
          }
        : { ...accountObject.payload_json },
      provenance_status: pendingReviewRow && accountObject.provenance_status === "source_document_only"
        ? "unverified"
        : accountObject.provenance_status,
    })),
    account_object_claims: row.bundle.account_object_claims.map((accountObjectClaim) => ({ ...accountObjectClaim })),
    research_runs: row.bundle.research_runs.map((researchRun) => ({ ...researchRun })),
    run_artifacts: row.bundle.run_artifacts.map((runArtifact) => ({
      ...runArtifact,
      payload_json: { ...runArtifact.payload_json },
    })),
    audit_events: row.bundle.audit_events.map((auditEvent) => ({
      ...auditEvent,
      payload_json: { ...auditEvent.payload_json },
    })),
  };
}

function mergeBundles(rows: readonly DurableGraphSnapshotRow[]): GraphBundle {
  const bundles = rows.map(cloneBundleForWorkshopProjection);
  return {
    sources: bundles.flatMap((bundle) => bundle.sources),
    excerpts: bundles.flatMap((bundle) => bundle.excerpts),
    claims: bundles.flatMap((bundle) => bundle.claims),
    claim_evidence: bundles.flatMap((bundle) => bundle.claim_evidence),
    account_objects: bundles.flatMap((bundle) => bundle.account_objects),
    account_object_claims: bundles.flatMap((bundle) => bundle.account_object_claims),
    research_runs: bundles.flatMap((bundle) => bundle.research_runs),
    run_artifacts: bundles.flatMap((bundle) => bundle.run_artifacts),
    audit_events: bundles.flatMap((bundle) => bundle.audit_events),
  };
}

function safeRejectionRecord(
  record: WorkshopProposalHumanReviewDecisionRecord,
): WorkshopRejectedProposalViewModel | null {
  if (record.decision !== "reject") return null;
  if (
    record.graph_candidate_ref !== null ||
    record.promotion_performed !== false ||
    record.visible_review_state !== WORKSHOP_REVIEW_STATE_MODEL_PROPOSED ||
    record.source_trust.provenance_status !== "unverified" ||
    record.source_trust.label !== "Unverified" ||
    record.source_trust.accepted_excerpt_count !== 0
  ) {
    throw new Error("rejected proposal audit record must remain non-graph pending-review context");
  }
  return Object.freeze({
    item_id: record.item_id,
    lens: record.lens,
    decision: "reject" as const,
    rationale: record.rationale,
    reviewer_id: record.reviewer_id,
    reviewed_at: record.reviewed_at,
    graph_state: "not_written_to_durable_graph" as const,
  });
}

function snapshotHumanReviewDecisionArtifact(
  value: WorkshopProposalHumanReviewDecisionArtifact,
): WorkshopProposalHumanReviewDecisionArtifact {
  return snapshotPlainJsonValue(
    value,
    "human review decision artifact",
  ) as WorkshopProposalHumanReviewDecisionArtifact;
}

function rejectedProposalPanel(
  artifactInput: WorkshopProposalHumanReviewDecisionArtifact | null | undefined,
): readonly WorkshopRejectedProposalViewModel[] {
  if (artifactInput === null || artifactInput === undefined) return Object.freeze([]);
  const artifact = snapshotHumanReviewDecisionArtifact(artifactInput);
  if (
    artifact.kind !== WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME ||
    artifact.schema_version !== WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION ||
    artifact.current_effective_authorization !== "none" ||
    artifact.boundaries.current_effective_authorization !== "none" ||
    artifact.boundaries.authorizes_provider_call !== false ||
    artifact.boundaries.authorizes_private_evidence_read !== false ||
    artifact.boundaries.authorizes_graph_ingestion !== false ||
    artifact.boundaries.provider_calls_executed !== 0 ||
    artifact.boundaries.private_evidence_read !== false ||
    artifact.boundaries.graph_ingestion_performed !== false ||
    artifact.boundaries.durable_writes_performed !== false ||
    artifact.boundaries.reviewed_candidate_durable_write_performed !== false ||
    artifact.boundaries.ratification_performed !== false ||
    artifact.provider_calls_made !== 0 ||
    artifact.private_evidence_read !== false ||
    artifact.graph_ingestion_performed !== false ||
    artifact.durable_writes_performed !== false ||
    artifact.production_writes !== false ||
    artifact.readiness_claim !== false
  ) {
    throw new Error("rejected proposal audit panel requires a closed human-review decision artifact");
  }
  const rejectedRecords = artifact.decisions.filter((record) => record.decision === "reject");
  if (artifact.counts.rejected !== rejectedRecords.length) {
    throw new Error("rejected proposal audit panel requires decision counts to match rejected records");
  }
  return Object.freeze(
    artifact.decisions.flatMap((record) => {
      const rejected = safeRejectionRecord(record);
      return rejected === null ? [] : [rejected];
    }),
  );
}

export function buildWorkshopViewModelFromDurableState(
  rowsInput: readonly unknown[],
  options: BuildWorkshopViewModelFromDurableStateOptions = {},
): WorkshopViewModel {
  const rowValues = snapshotPlainJsonValue(rowsInput, "durable state rows");
  if (!Array.isArray(rowValues)) {
    throw new Error("durable state rows must be a plain own-data array");
  }
  const rows = Object.freeze(rowValues.map((row, index) => snapshotDurableGraphSnapshotRow(row, `durable state row ${index}`)));
  const vm = buildWorkshopViewModel(mergeBundles(rows));
  return Object.freeze({
    ...vm,
    rejected_proposals: rejectedProposalPanel(options.reviewDecisionArtifact),
  });
}
