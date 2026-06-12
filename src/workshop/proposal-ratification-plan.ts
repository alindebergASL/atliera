import {
  WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME,
  WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
  type WorkshopProposalHumanReviewDecisionArtifact,
} from "./proposal-review-decision.ts";
import type { WorkshopLens } from "./view-model.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME =
  "workshop-public-proposal-reviewed-candidate-ratification-plan" as const;

export const WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_SCHEMA_VERSION =
  "atliera.workshop_public_proposal_reviewed_candidate_ratification_plan.v1" as const;

export type WorkshopProposalRatificationStatus = "awaiting_separate_ratification";

export interface WorkshopProposalRatificationPlanBoundaries {
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
  readonly authorizes_reviewed_candidate_durable_write: false;
  readonly reviewed_candidate_durable_write_performed: false;
  readonly ratification_performed: false;
  readonly plan_only: true;
  readonly requires_separate_ratification_approval: true;
}

export interface WorkshopProposalRatificationCandidatePlan {
  readonly item_id: string;
  readonly lens: WorkshopLens;
  readonly source_decision: "accept_for_graph_candidate";
  readonly reviewer_id: string;
  readonly reviewed_at: string;
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
  readonly ratification_status: WorkshopProposalRatificationStatus;
  readonly planned_write_operation: "none";
  readonly candidate_only: true;
  readonly requires_separate_ratification_approval: true;
  readonly authorizes_graph_ingestion: false;
  readonly graph_ingestion_performed: false;
  readonly authorizes_durable_write: false;
  readonly durable_write_performed: false;
}

export interface WorkshopProposalRatificationPlanCounts {
  readonly accepted_candidate_count: number;
  readonly planned_candidate_count: number;
  readonly ratified_candidate_count: 0;
  readonly durable_write_count: 0;
}

export interface WorkshopProposalRatificationPlanArtifact {
  readonly kind: typeof WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME;
  readonly schema_version: typeof WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_SCHEMA_VERSION;
  readonly disposable: true;
  readonly generated_from: typeof WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME;
  readonly current_effective_authorization: "none";
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly reviewed_at: string;
  readonly planned_at: string;
  readonly source_decision_artifact_name: typeof WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME;
  readonly next_required_contract: "reviewed-candidate-durable-graph-write";
  readonly boundaries: WorkshopProposalRatificationPlanBoundaries;
  readonly candidates: readonly WorkshopProposalRatificationCandidatePlan[];
  readonly counts: WorkshopProposalRatificationPlanCounts;
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const SAFE_REVIEWER_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_DECISIONS = 100;
const MAX_REF_IDS = 100;
const LENSES = ["signals", "maps", "plays"] as const;

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

function snapshotStringArray(value: unknown): readonly string[] | null {
  const snapshot = snapshotUntrustedArray(value, MAX_REF_IDS);
  if (snapshot === null || snapshot.length === 0) return null;
  const out: string[] = [];
  for (const item of snapshot) {
    if (typeof item !== "string" || !SAFE_ID.test(item)) return null;
    out.push(item);
  }
  return Object.freeze(out);
}

function stringValue(input: object, key: string): string | undefined {
  const value = ownDataValue(input, key);
  return typeof value === "string" ? value : undefined;
}

function booleanFalseValue(input: object, key: string): boolean {
  return ownDataValue(input, key) === false;
}

function zeroValue(input: object, key: string): boolean {
  return ownDataValue(input, key) === 0;
}

function isValidIsoTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value;
}

function assertClosedSourceBoundaries(artifact: Record<string, unknown>, boundaries: Record<string, unknown>): void {
  if (
    stringValue(artifact, "current_effective_authorization") !== "none" ||
    !zeroValue(artifact, "provider_calls_made") ||
    !booleanFalseValue(artifact, "private_evidence_read") ||
    !booleanFalseValue(artifact, "graph_ingestion_performed") ||
    !booleanFalseValue(artifact, "durable_writes_performed") ||
    !booleanFalseValue(artifact, "production_writes") ||
    !booleanFalseValue(artifact, "readiness_claim") ||
    stringValue(boundaries, "current_effective_authorization") !== "none" ||
    !booleanFalseValue(boundaries, "authorizes_provider_call") ||
    !booleanFalseValue(boundaries, "authorizes_private_evidence_read") ||
    !booleanFalseValue(boundaries, "authorizes_graph_ingestion") ||
    !booleanFalseValue(boundaries, "graph_ingestion_performed") ||
    !zeroValue(boundaries, "provider_calls_executed") ||
    !booleanFalseValue(boundaries, "private_evidence_read") ||
    !booleanFalseValue(boundaries, "durable_writes_performed") ||
    !booleanFalseValue(boundaries, "production_writes") ||
    !booleanFalseValue(boundaries, "readiness_claim") ||
    !booleanFalseValue(boundaries, "authorizes_reviewed_candidate_durable_write") ||
    !booleanFalseValue(boundaries, "reviewed_candidate_durable_write_performed") ||
    !booleanFalseValue(boundaries, "ratification_performed")
  ) {
    throw new Error("ratification plan requires a closed, non-authorizing human-review artifact");
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

interface AcceptedDecisionSnapshot {
  readonly item_id: string;
  readonly lens: WorkshopLens;
  readonly reviewer_id: string;
  readonly reviewed_at: string;
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
  readonly excerpt_ids: readonly string[];
  readonly source_ids: readonly string[];
}

function parseAcceptedDecision(rawDecision: unknown): AcceptedDecisionSnapshot | null {
  const decision = snapshotPlainRecord(rawDecision);
  if (decision === null) {
    throw new Error("ratification plan decision records must be plain own-data objects");
  }
  const itemId = stringValue(decision, "item_id");
  const lens = stringValue(decision, "lens");
  const decisionKind = stringValue(decision, "decision");
  const reviewerId = stringValue(decision, "reviewer_id");
  const reviewedAt = stringValue(decision, "reviewed_at");
  const sourceTrust = snapshotPlainRecord(ownDataValue(decision, "source_trust"));
  if (itemId === undefined || !SAFE_ID.test(itemId)) {
    throw new Error("ratification plan decision record must carry a safe item_id");
  }
  if (lens === undefined || !(LENSES as readonly string[]).includes(lens)) {
    throw new Error("ratification plan decision record must carry a safe lens");
  }
  if (reviewerId === undefined || !SAFE_REVIEWER_ID.test(reviewerId)) {
    throw new Error("ratification plan decision record must carry a safe reviewer_id");
  }
  if (reviewedAt === undefined || !isValidIsoTimestamp(reviewedAt)) {
    throw new Error("ratification plan decision record must carry a valid reviewed_at timestamp");
  }
  if (
    sourceTrust === null ||
    stringValue(sourceTrust, "provenance_status") !== "unverified" ||
    stringValue(sourceTrust, "label") !== "Unverified" ||
    ownDataValue(sourceTrust, "accepted_excerpt_count") !== 0
  ) {
    throw new Error("ratification plan only accepts unverified human-review decisions");
  }
  if (ownDataValue(decision, "promotion_performed") !== false) {
    throw new Error("ratification plan refuses already-promoted human-review decisions");
  }
  const candidateRef = ownDataValue(decision, "graph_candidate_ref");
  if (decisionKind !== "accept_for_graph_candidate") {
    if (candidateRef !== null) {
      throw new Error("ratification plan refuses non-accept decisions with candidate refs");
    }
    return null;
  }
  const candidate = snapshotPlainRecord(candidateRef);
  if (candidate === null) {
    throw new Error("ratification plan accepted decisions must carry a graph candidate ref");
  }
  const accountObjectId = stringValue(candidate, "account_object_id");
  const claimIds = snapshotStringArray(ownDataValue(candidate, "claim_ids"));
  const excerptIds = snapshotStringArray(ownDataValue(candidate, "excerpt_ids"));
  const sourceIds = snapshotStringArray(ownDataValue(candidate, "source_ids"));
  if (
    accountObjectId === undefined ||
    accountObjectId !== itemId ||
    claimIds === null ||
    excerptIds === null ||
    sourceIds === null ||
    ownDataValue(candidate, "candidate_only") !== true ||
    ownDataValue(candidate, "graph_ingestion_performed") !== false ||
    ownDataValue(candidate, "durable_graph_write_performed") !== false
  ) {
    throw new Error("ratification plan accepted candidate refs must remain candidate-only and unwritten");
  }
  return Object.freeze({
    item_id: itemId,
    lens: lens as WorkshopLens,
    reviewer_id: reviewerId,
    reviewed_at: reviewedAt,
    account_object_id: accountObjectId,
    claim_ids: claimIds,
    excerpt_ids: excerptIds,
    source_ids: sourceIds,
  });
}

export function buildWorkshopPublicProposalRatificationPlanArtifact(
  decisionArtifact: WorkshopProposalHumanReviewDecisionArtifact,
  plannedAt: string,
): WorkshopProposalRatificationPlanArtifact {
  if (!isValidIsoTimestamp(plannedAt)) {
    throw new Error("ratification plan artifact requires a deterministic ISO planned_at timestamp");
  }
  const artifact = snapshotPlainRecord(decisionArtifact);
  if (artifact === null) {
    throw new Error("ratification plan requires a plain human-review artifact");
  }
  if (
    stringValue(artifact, "kind") !== WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME ||
    stringValue(artifact, "schema_version") !== WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_SCHEMA_VERSION ||
    ownDataValue(artifact, "disposable") !== true ||
    stringValue(artifact, "generated_from") !== "workshop-public-curated-proposal-preview"
  ) {
    throw new Error("ratification plan requires the public proposal human-review decision artifact");
  }
  const proposalSetId = stringValue(artifact, "proposal_set_id");
  const accountId = stringValue(artifact, "account_id");
  const reviewedAt = stringValue(artifact, "reviewed_at");
  if (
    proposalSetId === undefined ||
    !SAFE_ID.test(proposalSetId) ||
    accountId === undefined ||
    !SAFE_ID.test(accountId) ||
    reviewedAt === undefined ||
    !isValidIsoTimestamp(reviewedAt)
  ) {
    throw new Error("ratification plan requires safe source artifact identifiers and timestamps");
  }
  if (new Date(plannedAt).getTime() < new Date(reviewedAt).getTime()) {
    throw new Error("ratification plan planned_at must not precede the source reviewed_at timestamp");
  }
  const boundaries = snapshotPlainRecord(ownDataValue(artifact, "boundaries"));
  const counts = snapshotPlainRecord(ownDataValue(artifact, "counts"));
  const rawDecisions = snapshotUntrustedArray(ownDataValue(artifact, "decisions"), MAX_DECISIONS);
  if (boundaries === null || counts === null || rawDecisions === null) {
    throw new Error("ratification plan requires bounded source boundaries, counts, and decisions");
  }
  assertClosedSourceBoundaries(artifact, boundaries);
  const acceptedCandidates: AcceptedDecisionSnapshot[] = [];
  const seen = new Set<string>();
  for (const rawDecision of rawDecisions) {
    const accepted = parseAcceptedDecision(rawDecision);
    if (accepted === null) continue;
    if (accepted.reviewed_at !== reviewedAt) {
      throw new Error("ratification plan accepted decisions must match the source reviewed_at timestamp");
    }
    if (seen.has(accepted.item_id)) {
      throw new Error("ratification plan refuses duplicate accepted candidate refs");
    }
    seen.add(accepted.item_id);
    acceptedCandidates.push(accepted);
  }
  if (acceptedCandidates.length === 0) {
    throw new Error("ratification plan requires at least one accepted graph candidate ref");
  }
  if (ownDataValue(counts, "accepted_for_graph_candidate") !== acceptedCandidates.length) {
    throw new Error("ratification plan source accepted count must match accepted candidate refs");
  }
  const candidates = acceptedCandidates.map((candidate) =>
    Object.freeze({
      item_id: candidate.item_id,
      lens: candidate.lens,
      source_decision: "accept_for_graph_candidate" as const,
      reviewer_id: candidate.reviewer_id,
      reviewed_at: candidate.reviewed_at,
      account_object_id: candidate.account_object_id,
      claim_ids: Object.freeze([...candidate.claim_ids]),
      excerpt_ids: Object.freeze([...candidate.excerpt_ids]),
      source_ids: Object.freeze([...candidate.source_ids]),
      ratification_status: "awaiting_separate_ratification" as const,
      planned_write_operation: "none" as const,
      candidate_only: true as const,
      requires_separate_ratification_approval: true as const,
      authorizes_graph_ingestion: false as const,
      graph_ingestion_performed: false as const,
      authorizes_durable_write: false as const,
      durable_write_performed: false as const,
    }),
  );
  return deepFreeze({
    kind: WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_NAME,
    schema_version: WORKSHOP_PUBLIC_PROPOSAL_RATIFICATION_PLAN_SCHEMA_VERSION,
    disposable: true,
    generated_from: WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME,
    current_effective_authorization: "none",
    proposal_set_id: proposalSetId,
    account_id: accountId,
    reviewed_at: reviewedAt,
    planned_at: plannedAt,
    source_decision_artifact_name: WORKSHOP_PUBLIC_PROPOSAL_HUMAN_REVIEW_DECISION_NAME,
    next_required_contract: "reviewed-candidate-durable-graph-write",
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
      plan_only: true,
      requires_separate_ratification_approval: true,
    },
    candidates,
    counts: {
      accepted_candidate_count: acceptedCandidates.length,
      planned_candidate_count: candidates.length,
      ratified_candidate_count: 0,
      durable_write_count: 0,
    },
    provider_calls_made: 0,
    private_evidence_read: false,
    graph_ingestion_performed: false,
    durable_writes_performed: false,
    production_writes: false,
    readiness_claim: false,
  });
}
