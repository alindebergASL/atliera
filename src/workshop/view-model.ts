import type {
  AccountObject,
  Claim,
  EvidenceExcerpt,
  GraphBundle,
  ProvenanceStatus,
  SourceDocument,
} from "../graph/types.ts";

export type WorkshopLens = "signals" | "maps" | "plays";

// Visible review-state decoration for model-proposed content awaiting human
// review. This decorates the existing `unverified` provenance status; it is
// not a new truth-status tier and never upgrades trust.
export const WORKSHOP_REVIEW_STATE_MODEL_PROPOSED =
  "model_proposed_pending_human_review" as const;

export type WorkshopReviewState = typeof WORKSHOP_REVIEW_STATE_MODEL_PROPOSED;

export interface WorkshopEvidenceSummary {
  accepted_excerpt_count: number;
  source_document_count: number;
  claim_count: number;
}

export interface WorkshopTrustSummary {
  provenance_status: ProvenanceStatus;
  confidence: AccountObject["confidence"];
  evidence: WorkshopEvidenceSummary;
  label: "Verified" | "Source-backed" | "Unverified" | "Unsupported" | "Stale";
}

export interface WorkshopEvidencePacket {
  claim: Pick<Claim, "id" | "text" | "claim_type" | "confidence" | "provenance_status">;
  excerpt: Pick<EvidenceExcerpt, "id" | "text" | "validation_status" | "kind">;
  source: Pick<SourceDocument, "id" | "title" | "url" | "publisher" | "source_type" | "reliability">;
}

export interface WorkshopLensItemViewModel {
  id: string;
  lens: WorkshopLens;
  title: string;
  summary: string;
  object_type: AccountObject["object_type"];
  status: AccountObject["status"];
  trust: WorkshopTrustSummary;
  /**
   * Optional review-state decoration. Set only when the underlying account
   * object carries the model-proposed/pending-human-review payload marker AND
   * its provenance status is `unverified`; verified/source-backed objects
   * never receive this decoration, and the decoration never upgrades trust.
   */
  review_state?: WorkshopReviewState | null;
  claim_ids: string[];
  source_ids: string[];
  excerpt_ids: string[];
  evidence_packets: WorkshopEvidencePacket[];
}

export interface WorkshopRejectedProposalViewModel {
  item_id: string;
  lens: WorkshopLens;
  decision: "reject";
  rationale: string;
  reviewer_id: string;
  reviewed_at: string;
  graph_state: "not_written_to_durable_graph";
}

export interface WorkshopViewModel {
  product_name: "Atliera";
  surface: "Workshop";
  account_id: string | null;
  generated_from: "graph_bundle";
  lenses: Record<WorkshopLens, WorkshopLensItemViewModel[]>;
  /**
   * Optional review/audit context. These are explicitly not graph state and
   * are rendered separately from durable graph rows.
   */
  rejected_proposals?: readonly WorkshopRejectedProposalViewModel[];
  totals: {
    sources: number;
    excerpts: number;
    accepted_excerpts: number;
    claims: number;
    account_objects: number;
    verified_objects: number;
  };
  empty_state: boolean;
}

const LENS_BY_OBJECT_TYPE: Record<AccountObject["object_type"], WorkshopLens> = {
  account_snapshot: "maps",
  signal: "signals",
  stakeholder: "maps",
  initiative: "maps",
  risk: "signals",
  open_question: "signals",
  play: "plays",
  recommendation: "plays",
};

function trustLabel(status: ProvenanceStatus): WorkshopTrustSummary["label"] {
  switch (status) {
    case "verified":
      return "Verified";
    case "source_document_only":
      return "Source-backed";
    case "unverified":
      return "Unverified";
    case "unsupported":
      return "Unsupported";
    case "stale":
      return "Stale";
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function buildWorkshopViewModel(bundle: GraphBundle): WorkshopViewModel {
  const claimById = new Map(bundle.claims.map((claim) => [claim.id, claim]));
  const excerptById = new Map(bundle.excerpts.map((excerpt) => [excerpt.id, excerpt]));
  const sourceById = new Map(bundle.sources.map((source) => [source.id, source]));
  const claimEvidenceByClaim = new Map<string, typeof bundle.claim_evidence>();
  for (const ce of bundle.claim_evidence) {
    const existing = claimEvidenceByClaim.get(ce.claim_id) ?? [];
    existing.push(ce);
    claimEvidenceByClaim.set(ce.claim_id, existing);
  }
  const objectClaimsByObject = new Map<string, typeof bundle.account_object_claims>();
  for (const oc of bundle.account_object_claims) {
    const existing = objectClaimsByObject.get(oc.account_object_id) ?? [];
    existing.push(oc);
    objectClaimsByObject.set(oc.account_object_id, existing);
  }

  const lenses: WorkshopViewModel["lenses"] = {
    signals: [],
    maps: [],
    plays: [],
  };

  for (const obj of bundle.account_objects) {
    const objectClaims = objectClaimsByObject.get(obj.id) ?? [];
    const claimIds = uniqueSorted(objectClaims.map((oc) => oc.claim_id).filter((id) => claimById.has(id)));
    const supportingClaimEvidence = claimIds.flatMap((claimId) =>
      (claimEvidenceByClaim.get(claimId) ?? []).filter((ce) => ce.relationship === "supports"),
    );
    const excerptIds = uniqueSorted(
      supportingClaimEvidence.map((ce) => ce.evidence_excerpt_id).filter((excerptId) => excerptById.has(excerptId)),
    );
    const sourceIds = uniqueSorted(
      excerptIds
        .map((excerptId) => excerptById.get(excerptId)!)
        .map((excerpt) => excerpt.source_document_id)
        .filter((sourceId) => sourceById.has(sourceId)),
    );
    const acceptedExcerptCount = excerptIds.filter(
      (excerptId) => excerptById.get(excerptId)?.validation_status === "accepted",
    ).length;
    const lens = LENS_BY_OBJECT_TYPE[obj.object_type];
    // Review-state decoration is read from the materializer-assigned payload
    // marker and applied only on top of `unverified` provenance, so a bundle
    // can never combine a Verified label with a pending-review badge.
    const reviewState =
      obj.provenance_status === "unverified" &&
      obj.payload_json["review_state"] === WORKSHOP_REVIEW_STATE_MODEL_PROPOSED
        ? WORKSHOP_REVIEW_STATE_MODEL_PROPOSED
        : null;
    const evidencePackets: WorkshopEvidencePacket[] = obj.provenance_status === "unsupported"
      ? []
      : supportingClaimEvidence.flatMap((ce) => {
          const claim = claimById.get(ce.claim_id);
          const excerpt = excerptById.get(ce.evidence_excerpt_id);
          const source = excerpt ? sourceById.get(excerpt.source_document_id) : undefined;
          const excerptVisibleForReview =
            excerpt?.validation_status === "accepted" ||
            (reviewState === WORKSHOP_REVIEW_STATE_MODEL_PROPOSED && excerpt?.validation_status === "proposed");
          if (!claim || !excerpt || !source || !excerptVisibleForReview || claim.provenance_status === "unsupported") {
            return [];
          }
          return [
            {
              claim: {
                id: claim.id,
                text: claim.text,
                claim_type: claim.claim_type,
                confidence: claim.confidence,
                provenance_status: claim.provenance_status,
              },
              excerpt: {
                id: excerpt.id,
                text: excerpt.text,
                validation_status: excerpt.validation_status,
                kind: excerpt.kind,
              },
              source: {
                id: source.id,
                title: source.title,
                url: source.url,
                publisher: source.publisher,
                source_type: source.source_type,
                reliability: source.reliability,
              },
            },
          ];
        });

    lenses[lens].push({
      id: obj.id,
      lens,
      title: obj.title,
      summary: obj.summary,
      object_type: obj.object_type,
      status: obj.status,
      trust: {
        provenance_status: obj.provenance_status,
        confidence: obj.confidence,
        evidence: {
          accepted_excerpt_count: acceptedExcerptCount,
          source_document_count: sourceIds.length,
          claim_count: claimIds.length,
        },
        label: trustLabel(obj.provenance_status),
      },
      review_state: reviewState,
      claim_ids: claimIds,
      source_ids: sourceIds,
      excerpt_ids: excerptIds,
      evidence_packets: evidencePackets,
    });
  }

  return {
    product_name: "Atliera",
    surface: "Workshop",
    account_id: bundle.sources[0]?.account_id ?? bundle.claims[0]?.account_id ?? bundle.account_objects[0]?.account_id ?? null,
    generated_from: "graph_bundle",
    lenses,
    totals: {
      sources: bundle.sources.length,
      excerpts: bundle.excerpts.length,
      accepted_excerpts: bundle.excerpts.filter((excerpt) => excerpt.validation_status === "accepted").length,
      claims: bundle.claims.length,
      account_objects: bundle.account_objects.length,
      verified_objects: bundle.account_objects.filter((obj) => obj.provenance_status === "verified").length,
    },
    empty_state: bundle.account_objects.length === 0,
  };
}
