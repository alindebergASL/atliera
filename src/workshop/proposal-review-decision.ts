import type { ProposalMaterializationBoundaries } from "../validation/proposal-materialization.ts";
import {
  WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME,
  type WorkshopPublicCuratedProposalPreview,
} from "./proposal-preview.ts";
import {
  WORKSHOP_REVIEW_STATE_MODEL_PROPOSED,
  type WorkshopLens,
  type WorkshopLensItemViewModel,
} from "./view-model.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME =
  "workshop-public-proposal-human-review-decision" as const;

export const WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION =
  "atliera.workshop_public_proposal_human_review_decision.v1" as const;

export type WorkshopProposalHumanReviewDecisionKind =
  | "accept_for_graph_candidate"
  | "reject"
  | "needs_more_evidence"
  | "defer";

export interface WorkshopProposalHumanReviewDecisionInput {
  readonly item_id: string;
  readonly decision: WorkshopProposalHumanReviewDecisionKind;
  readonly rationale: string;
  readonly reviewer_id: string;
}

export interface WorkshopProposalHumanReviewDecisionBoundaries
  extends ProposalMaterializationBoundaries {
  readonly authorizes_reviewed_candidate_durable_write: false;
  readonly reviewed_candidate_durable_write_performed: false;
  readonly ratification_performed: false;
}

export interface WorkshopProposalHumanReviewGraphCandidateRef {
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
  readonly candidate_only: true;
  readonly graph_ingestion_performed: false;
  readonly durable_graph_write_performed: false;
}

export interface WorkshopProposalHumanReviewDecisionRecord {
  readonly item_id: string;
  readonly lens: WorkshopLens;
  readonly decision: WorkshopProposalHumanReviewDecisionKind;
  readonly rationale: string;
  readonly reviewer_id: string;
  readonly reviewed_at: string;
  readonly visible_review_state: typeof WORKSHOP_REVIEW_STATE_MODEL_PROPOSED;
  readonly source_trust: {
    readonly provenance_status: "unverified";
    readonly label: "Unverified";
    readonly accepted_excerpt_count: 0;
  };
  readonly graph_candidate_ref: WorkshopProposalHumanReviewGraphCandidateRef | null;
  readonly promotion_performed: false;
}

export interface WorkshopProposalHumanReviewDecisionCounts {
  readonly accepted_for_graph_candidate: number;
  readonly rejected: number;
  readonly needs_more_evidence: number;
  readonly deferred: number;
}

export interface WorkshopProposalHumanReviewDecisionArtifact {
  readonly kind: typeof WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION;
  readonly disposable: true;
  readonly generated_from: typeof WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME;
  readonly current_effective_authorization: "none";
  readonly preview_artifact_name: typeof WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME;
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly reviewed_at: string;
  readonly boundaries: WorkshopProposalHumanReviewDecisionBoundaries;
  readonly decisions: readonly WorkshopProposalHumanReviewDecisionRecord[];
  readonly counts: WorkshopProposalHumanReviewDecisionCounts;
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

const SAFE_ITEM_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const SAFE_REVIEWER_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const DECISIONS: readonly WorkshopProposalHumanReviewDecisionKind[] = [
  "accept_for_graph_candidate",
  "reject",
  "needs_more_evidence",
  "defer",
];
const MAX_DECISION_RECORDS = 100;
const MAX_RATIONALE_LENGTH = 500;

function ownDataValue(input: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined || !("value" in descriptor)) return undefined;
  return descriptor.value;
}

function snapshotPlainRecord(raw: unknown): Record<string, unknown> | null {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const prototype = Object.getPrototypeOf(raw);
    if (prototype !== Object.prototype && prototype !== null) return null;
    if (Object.getOwnPropertySymbols(raw).length > 0) return null;
    const entries = Object.entries(Object.getOwnPropertyDescriptors(raw));
    const out: Record<string, unknown> = {};
    for (const [key, descriptor] of entries) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") return null;
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

function snapshotUntrustedArray(value: unknown, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const length = value.length;
    if (!Number.isInteger(length) || length < 0 || length > max) return null;
    if (Object.getOwnPropertySymbols(value).length > 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const out: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return null;
      out.push(descriptor.value);
    }
    return Object.freeze(out);
  } catch {
    return null;
  }
}

function snapshotStringArray(value: unknown, max: number): readonly string[] | null {
  const snapshot = snapshotUntrustedArray(value, max);
  if (snapshot === null) return null;
  const out: string[] = [];
  for (const item of snapshot) {
    if (typeof item !== "string" || !SAFE_ITEM_ID.test(item)) return null;
    out.push(item);
  }
  return Object.freeze(out);
}

function stringValue(input: object, key: string): string | undefined {
  const value = ownDataValue(input, key);
  return typeof value === "string" ? value : undefined;
}

function isValidIsoTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value;
}

function parseDecision(raw: unknown): WorkshopProposalHumanReviewDecisionInput {
  const record = snapshotPlainRecord(raw);
  if (record === null) {
    throw new Error("human review decision records must be plain own-data objects");
  }
  const itemId = stringValue(record, "item_id");
  const decision = stringValue(record, "decision");
  const rationale = stringValue(record, "rationale");
  const reviewerId = stringValue(record, "reviewer_id");
  if (itemId === undefined || !SAFE_ITEM_ID.test(itemId)) {
    throw new Error("human review decision record must carry a safe item_id");
  }
  if (
    decision === undefined ||
    !DECISIONS.includes(decision as WorkshopProposalHumanReviewDecisionKind)
  ) {
    throw new Error("human review decision must be accept_for_graph_candidate, reject, needs_more_evidence, or defer");
  }
  if (
    rationale === undefined ||
    rationale.trim() === "" ||
    rationale.length > MAX_RATIONALE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(rationale)
  ) {
    throw new Error("human review decision requires a bounded non-empty rationale");
  }
  if (reviewerId === undefined || !SAFE_REVIEWER_ID.test(reviewerId)) {
    throw new Error("human review decision requires a safe reviewer_id");
  }
  return Object.freeze({
    item_id: itemId,
    decision: decision as WorkshopProposalHumanReviewDecisionKind,
    rationale,
    reviewer_id: reviewerId,
  });
}

interface ReviewablePreviewItemSnapshot {
  readonly id: string;
  readonly lens: WorkshopLens;
  readonly review_state: unknown;
  readonly trust: {
    readonly provenance_status: unknown;
    readonly label: unknown;
    readonly accepted_excerpt_count: unknown;
  };
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
}

function snapshotPreviewItem(
  rawItem: WorkshopLensItemViewModel,
  lensBucket: WorkshopLens,
): ReviewablePreviewItemSnapshot {
  const item = snapshotPlainRecord(rawItem);
  if (item === null) {
    throw new Error("human review preview items must be plain own-data objects");
  }
  const id = stringValue(item, "id");
  const lens = stringValue(item, "lens");
  const trust = snapshotPlainRecord(ownDataValue(item, "trust"));
  const evidence = trust === null ? null : snapshotPlainRecord(ownDataValue(trust, "evidence"));
  const claimIds = snapshotStringArray(ownDataValue(item, "claim_ids"), 100);
  const excerptIds = snapshotStringArray(ownDataValue(item, "excerpt_ids"), 100);
  const sourceIds = snapshotStringArray(ownDataValue(item, "source_ids"), 100);
  if (
    id === undefined ||
    !SAFE_ITEM_ID.test(id) ||
    lens !== lensBucket ||
    trust === null ||
    evidence === null ||
    claimIds === null ||
    excerptIds === null ||
    sourceIds === null
  ) {
    throw new Error("human review preview items must carry safe visible ids, lens, trust, and reference arrays");
  }
  return Object.freeze({
    id,
    lens: lensBucket,
    review_state: ownDataValue(item, "review_state"),
    trust: Object.freeze({
      provenance_status: ownDataValue(trust, "provenance_status"),
      label: ownDataValue(trust, "label"),
      accepted_excerpt_count: ownDataValue(evidence, "accepted_excerpt_count"),
    }),
    claim_ids: claimIds,
    excerpt_ids: excerptIds,
    source_ids: sourceIds,
  });
}

function flattenPreviewItems(preview: WorkshopPublicCuratedProposalPreview): Map<string, ReviewablePreviewItemSnapshot> {
  const items = new Map<string, ReviewablePreviewItemSnapshot>();
  for (const lens of ["signals", "maps", "plays"] as const) {
    for (const rawItem of preview.view_model.lenses[lens]) {
      const item = snapshotPreviewItem(rawItem, lens);
      if (items.has(item.id)) {
        throw new Error("human review preview contains duplicate visible item ids");
      }
      items.set(item.id, item);
    }
  }
  return items;
}

function assertClosedPreviewBoundary(preview: WorkshopPublicCuratedProposalPreview): void {
  if (preview.kind !== WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME) {
    throw new Error("human review decision requires the public curated proposal preview artifact");
  }
  if (preview.report.artifact_name !== WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME) {
    throw new Error("human review decision preview report has the wrong artifact name");
  }
  if (
    preview.report.current_effective_authorization !== "none" ||
    preview.report.provider_calls_made !== 0 ||
    preview.report.private_evidence_read !== false ||
    preview.report.graph_ingestion_performed !== false ||
    preview.report.durable_writes_performed !== false ||
    preview.report.production_writes !== false ||
    preview.report.readiness_claim !== false ||
    preview.report.boundaries.current_effective_authorization !== "none" ||
    preview.report.boundaries.authorizes_provider_call !== false ||
    preview.report.boundaries.authorizes_private_evidence_read !== false ||
    preview.report.boundaries.authorizes_graph_ingestion !== false ||
    preview.report.boundaries.graph_ingestion_performed !== false ||
    preview.report.boundaries.provider_calls_executed !== 0 ||
    preview.report.boundaries.private_evidence_read !== false ||
    preview.report.boundaries.durable_writes_performed !== false ||
    preview.report.boundaries.production_writes !== false ||
    preview.report.boundaries.readiness_claim !== false
  ) {
    throw new Error("human review decision cannot run over a preview with broadened boundaries");
  }
  if (preview.report.verified_object_count !== 0 || preview.view_model.totals.verified_objects !== 0) {
    throw new Error("human review decision cannot accept a preview that already marks proposal content verified");
  }
}

function assertAcceptablePendingReviewItem(item: ReviewablePreviewItemSnapshot): void {
  if (
    item.review_state !== WORKSHOP_REVIEW_STATE_MODEL_PROPOSED ||
    item.trust.provenance_status !== "unverified" ||
    item.trust.label !== "Unverified" ||
    item.trust.accepted_excerpt_count !== 0
  ) {
    throw new Error(
      "human review can only accept visible unverified model-proposed items with proposed evidence",
    );
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

export function buildWorkshopPublicProposalHumanReviewDecisionArtifact(
  preview: WorkshopPublicCuratedProposalPreview,
  decisionsInput: readonly unknown[],
  reviewedAt: string,
): WorkshopProposalHumanReviewDecisionArtifact {
  if (!isValidIsoTimestamp(reviewedAt)) {
    throw new Error("human review decision artifact requires a deterministic ISO reviewed_at timestamp");
  }
  assertClosedPreviewBoundary(preview);
  const rawDecisions = snapshotUntrustedArray(decisionsInput, MAX_DECISION_RECORDS);
  if (rawDecisions === null) {
    throw new Error("human review decision artifact requires a bounded plain decisions array");
  }
  const items = flattenPreviewItems(preview);
  const seen = new Set<string>();
  const records: WorkshopProposalHumanReviewDecisionRecord[] = [];
  for (const rawDecision of rawDecisions) {
    const decision = parseDecision(rawDecision);
    if (seen.has(decision.item_id)) {
      throw new Error("human review decision artifact cannot contain duplicate item decisions");
    }
    seen.add(decision.item_id);
    const item = items.get(decision.item_id);
    if (item === undefined) {
      throw new Error("human review decision cannot target an item absent from the preview");
    }
    assertAcceptablePendingReviewItem(item);
    const graphCandidateRef: WorkshopProposalHumanReviewGraphCandidateRef | null =
      decision.decision === "accept_for_graph_candidate"
        ? Object.freeze({
            account_object_id: item.id,
            claim_ids: Object.freeze([...item.claim_ids]),
            excerpt_ids: Object.freeze([...item.excerpt_ids]),
            source_ids: Object.freeze([...item.source_ids]),
            candidate_only: true,
            graph_ingestion_performed: false,
            durable_graph_write_performed: false,
          })
        : null;
    records.push(
      Object.freeze({
        item_id: item.id,
        lens: item.lens,
        decision: decision.decision,
        rationale: decision.rationale,
        reviewer_id: decision.reviewer_id,
        reviewed_at: reviewedAt,
        visible_review_state: WORKSHOP_REVIEW_STATE_MODEL_PROPOSED,
        source_trust: Object.freeze({
          provenance_status: "unverified" as const,
          label: "Unverified" as const,
          accepted_excerpt_count: 0 as const,
        }),
        graph_candidate_ref: graphCandidateRef,
        promotion_performed: false as const,
      }),
    );
  }
  const count = (decision: WorkshopProposalHumanReviewDecisionKind): number =>
    records.filter((record) => record.decision === decision).length;
  return deepFreeze({
    kind: WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME,
    schema_version: WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
    disposable: true,
    generated_from: WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME,
    current_effective_authorization: "none",
    preview_artifact_name: WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME,
    proposal_set_id: preview.report.proposal_set_id,
    account_id: preview.report.account_id,
    reviewed_at: reviewedAt,
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
      authorizes_reviewed_candidate_durable_write: false,
      reviewed_candidate_durable_write_performed: false,
      ratification_performed: false,
    },
    decisions: records,
    counts: {
      accepted_for_graph_candidate: count("accept_for_graph_candidate"),
      rejected: count("reject"),
      needs_more_evidence: count("needs_more_evidence"),
      deferred: count("defer"),
    },
    provider_calls_made: 0,
    private_evidence_read: false,
    graph_ingestion_performed: false,
    durable_writes_performed: false,
    production_writes: false,
    readiness_claim: false,
  });
}
