import type {
  AccountObject,
  Claim,
  EvidenceExcerpt,
  ProvenanceStatus,
  SourceDocument,
} from "../graph/types.ts";
import { createSupportEvaluator } from "../graph/support.ts";
import {
  hydrateValidatedCandidate,
  type ValidatedCandidate,
} from "../graph/validated-candidate.ts";

export { WorkshopGraphValidationError } from "../graph/validated-candidate.ts";

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
  label:
    | "Reviewed · source-backed"
    | "Source-backed"
    | "Unverified"
    | "Unsupported"
    | "Stale";
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

export interface WorkshopViewModel {
  product_name: "Atliera";
  surface: "Workshop";
  account_id: string;
  generated_from: "validated_candidate";
  lenses: Record<WorkshopLens, WorkshopLensItemViewModel[]>;
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
      return "Reviewed · source-backed";
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

function requiresCurrentSupport(object: AccountObject): boolean {
  return (
    object.provenance_status === "verified" ||
    object.provenance_status === "source_document_only"
  );
}

export function buildWorkshopViewModel(
  input: ValidatedCandidate,
): WorkshopViewModel {
  // Rehydrate at use time so projection authority is serializable and never
  // depends on caller identity or an earlier validate-then-mutate reference.
  const candidate = hydrateValidatedCandidate(input);
  const bundle = candidate.graph_bundle;
  const subject = candidate.subject;

  const support = createSupportEvaluator(bundle);
  const excerptById = new Map(bundle.excerpts.map((excerpt) => [excerpt.id, excerpt]));
  const sourceById = new Map(bundle.sources.map((source) => [source.id, source]));
  const claimEvidenceByClaim = new Map<string, typeof bundle.claim_evidence>();
  for (const ce of bundle.claim_evidence) {
    const existing = claimEvidenceByClaim.get(ce.claim_id) ?? [];
    existing.push(ce);
    claimEvidenceByClaim.set(ce.claim_id, existing);
  }
  const lenses: WorkshopViewModel["lenses"] = {
    signals: [],
    maps: [],
    plays: [],
  };

  const currentObjects = bundle.account_objects.filter(
    (object) =>
      support.isCurrentAccountObjectEligible(object) &&
      (!requiresCurrentSupport(object) ||
        support.hasCurrentSupportingClaim(object.id)),
  );

  for (const obj of currentObjects) {
    const currentClaimLinks = support.getCurrentClaimLinks(obj.id);
    const claimIds = uniqueSorted(
      currentClaimLinks.map((link) => link.claim.id),
    );
    const currentEvidenceSupport = claimIds.flatMap((claimId) =>
      support.getCurrentSupportingEvidence(claimId),
    );
    const lens = LENS_BY_OBJECT_TYPE[obj.object_type];
    // Review-state decoration is read from the materializer-assigned payload
    // marker and applied only on top of `unverified` provenance, so a bundle
    // can never combine a Verified label with a pending-review badge.
    const reviewState =
      obj.provenance_status === "unverified" &&
      obj.payload_json["review_state"] === WORKSHOP_REVIEW_STATE_MODEL_PROPOSED
        ? WORKSHOP_REVIEW_STATE_MODEL_PROPOSED
        : null;

    // Proposed excerpts remain visible only on the existing explicit
    // pending-review surface. They are not counted as current support.
    const reviewEvidenceSupport =
      reviewState === WORKSHOP_REVIEW_STATE_MODEL_PROPOSED
        ? currentClaimLinks.flatMap((link) =>
            (claimEvidenceByClaim.get(link.claim.id) ?? []).flatMap((edge) => {
              if (edge.relationship !== "supports") return [];
              const excerpt = excerptById.get(edge.evidence_excerpt_id);
              const source = excerpt
                ? sourceById.get(excerpt.source_document_id)
                : undefined;
              if (
                !excerpt ||
                excerpt.validation_status !== "proposed" ||
                !source ||
                !support.isCurrentSourceEligible(source) ||
                link.claim.team_id !== source.team_id ||
                link.claim.account_id !== source.account_id
              ) {
                return [];
              }
              return [{ claim: link.claim, excerpt, source }];
            }),
          )
        : [];

    const visibleEvidence = [
      ...currentEvidenceSupport.map((support) => ({
        claim: support.claim,
        excerpt: support.excerpt,
        source: support.source,
      })),
      ...reviewEvidenceSupport,
    ];
    const excerptIds = uniqueSorted(
      visibleEvidence.map((support) => support.excerpt.id),
    );
    const sourceIds = uniqueSorted(
      visibleEvidence.map((support) => support.source.id),
    );
    const acceptedExcerptCount = uniqueSorted(
      currentEvidenceSupport.map((support) => support.excerpt.id),
    ).length;
    const evidencePackets: WorkshopEvidencePacket[] =
      obj.provenance_status === "unsupported"
        ? []
        : visibleEvidence.flatMap(({ claim, excerpt, source }) => {
            if (claim.provenance_status === "unsupported") return [];
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
    account_id: subject.account_id,
    generated_from: "validated_candidate",
    lenses,
    totals: {
      sources: bundle.sources.length,
      excerpts: bundle.excerpts.length,
      accepted_excerpts: bundle.excerpts.filter((excerpt) =>
        support.isCurrentExcerptEligible(excerpt),
      ).length,
      claims: bundle.claims.length,
      account_objects: currentObjects.length,
      verified_objects: currentObjects.filter(
        (obj) => obj.provenance_status === "verified",
      ).length,
    },
    empty_state: currentObjects.length === 0,
  };
}
