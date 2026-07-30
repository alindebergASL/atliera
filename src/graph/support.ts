import type {
  AccountObject,
  AccountObjectClaim,
  Claim,
  ClaimEvidence,
  EvidenceExcerpt,
  GraphBundle,
  SourceDocument,
} from "./types.ts";

/**
 * Current eligibility is deliberately narrower than structural validity.
 * Historical records remain in Graph, but only these lifecycle states may
 * participate in current support or trusted presentation.
 */
export function isCurrentSourceEligible(source: SourceDocument): boolean {
  return source.status === "active";
}

function isAcceptedLiteralExcerpt(excerpt: EvidenceExcerpt): boolean {
  return (
    excerpt.validation_status === "accepted" && excerpt.kind === "literal"
  );
}

export function isCurrentClaimEligible(claim: Claim): boolean {
  return claim.status === "active";
}

export function isCurrentAccountObjectEligible(
  object: AccountObject,
): boolean {
  return object.status === "active";
}

export interface EvidenceSupport {
  readonly edge: ClaimEvidence;
  readonly claim: Claim;
  readonly excerpt: EvidenceExcerpt;
  readonly source: SourceDocument;
}

export interface ObjectClaimLink {
  readonly edge: AccountObjectClaim;
  readonly object: AccountObject;
  readonly claim: Claim;
}

export interface SupportEvaluator {
  isStructurallyAcceptedExcerpt(excerpt: EvidenceExcerpt): boolean;
  isCurrentSourceEligible(source: SourceDocument): boolean;
  isCurrentExcerptEligible(excerpt: EvidenceExcerpt): boolean;
  isCurrentClaimEligible(claim: Claim): boolean;
  isCurrentAccountObjectEligible(object: AccountObject): boolean;
  getStructuralSupportingEvidence(
    claimId: string,
  ): readonly EvidenceSupport[];
  hasStructuralSupportingEvidence(claimId: string): boolean;
  getCurrentSupportingEvidence(claimId: string): readonly EvidenceSupport[];
  hasCurrentSupportingEvidence(claimId: string): boolean;
  getStructuralSupportingClaimLinks(
    objectId: string,
  ): readonly ObjectClaimLink[];
  hasStructuralSupportingClaim(objectId: string): boolean;
  getCurrentClaimLinks(objectId: string): readonly ObjectClaimLink[];
  getCurrentSupportingClaimLinks(
    objectId: string,
  ): readonly ObjectClaimLink[];
  hasCurrentSupportingClaim(objectId: string): boolean;
}

function sameSubject(
  left: Pick<Claim, "team_id" | "account_id">,
  right: Pick<SourceDocument, "team_id" | "account_id">,
): boolean {
  return (
    left.team_id === right.team_id && left.account_id === right.account_id
  );
}

export function createSupportEvaluator(
  bundle: GraphBundle,
): SupportEvaluator {
  const sourceById = new Map(
    bundle.sources.map((source) => [source.id, source]),
  );
  const excerptById = new Map(
    bundle.excerpts.map((excerpt) => [excerpt.id, excerpt]),
  );
  const claimById = new Map(bundle.claims.map((claim) => [claim.id, claim]));
  const objectById = new Map(
    bundle.account_objects.map((object) => [object.id, object]),
  );
  const evidenceByClaim = new Map<string, ClaimEvidence[]>();
  const claimsByObject = new Map<string, AccountObjectClaim[]>();

  for (const edge of bundle.claim_evidence) {
    const edges = evidenceByClaim.get(edge.claim_id) ?? [];
    edges.push(edge);
    evidenceByClaim.set(edge.claim_id, edges);
  }
  for (const edge of bundle.account_object_claims) {
    const edges = claimsByObject.get(edge.account_object_id) ?? [];
    edges.push(edge);
    claimsByObject.set(edge.account_object_id, edges);
  }

  const isStructurallyAcceptedExcerpt = (
    excerpt: EvidenceExcerpt,
  ): boolean =>
    isAcceptedLiteralExcerpt(excerpt) &&
    sourceById.has(excerpt.source_document_id);

  const isCurrentExcerptEligible = (excerpt: EvidenceExcerpt): boolean => {
    if (!isStructurallyAcceptedExcerpt(excerpt)) return false;
    const source = sourceById.get(excerpt.source_document_id);
    return source !== undefined && isCurrentSourceEligible(source);
  };

  const getStructuralSupportingEvidence = (
    claimId: string,
  ): EvidenceSupport[] => {
    const claim = claimById.get(claimId);
    if (!claim) return [];

    const support: EvidenceSupport[] = [];
    for (const edge of evidenceByClaim.get(claimId) ?? []) {
      if (edge.relationship !== "supports") continue;
      const excerpt = excerptById.get(edge.evidence_excerpt_id);
      if (!excerpt || !isStructurallyAcceptedExcerpt(excerpt)) continue;
      const source = sourceById.get(excerpt.source_document_id);
      if (!source || !sameSubject(claim, source)) continue;
      support.push({ edge, claim, excerpt, source });
    }
    return support;
  };

  const getCurrentSupportingEvidence = (
    claimId: string,
  ): EvidenceSupport[] => {
    const claim = claimById.get(claimId);
    if (!claim || !isCurrentClaimEligible(claim)) return [];

    return getStructuralSupportingEvidence(claimId).filter(({ source }) =>
      isCurrentSourceEligible(source),
    );
  };

  const getStructuralSupportingClaimLinks = (
    objectId: string,
  ): ObjectClaimLink[] => {
    const object = objectById.get(objectId);
    if (!object) return [];

    const links: ObjectClaimLink[] = [];
    for (const edge of claimsByObject.get(objectId) ?? []) {
      const claim = claimById.get(edge.claim_id);
      if (
        edge.relationship === "context" ||
        !claim ||
        !sameSubject(object, claim) ||
        getStructuralSupportingEvidence(claim.id).length === 0
      ) {
        continue;
      }
      links.push({ edge, object, claim });
    }
    return links;
  };

  const getCurrentClaimLinks = (
    objectId: string,
  ): ObjectClaimLink[] => {
    const object = objectById.get(objectId);
    if (!object || !isCurrentAccountObjectEligible(object)) return [];

    const links: ObjectClaimLink[] = [];
    for (const edge of claimsByObject.get(objectId) ?? []) {
      const claim = claimById.get(edge.claim_id);
      if (
        !claim ||
        !isCurrentClaimEligible(claim) ||
        !sameSubject(object, claim)
      ) {
        continue;
      }
      links.push({ edge, object, claim });
    }
    return links;
  };

  const getCurrentSupportingClaimLinks = (
    objectId: string,
  ): ObjectClaimLink[] =>
    getCurrentClaimLinks(objectId).filter(
      (link) =>
        link.edge.relationship !== "context" &&
        getCurrentSupportingEvidence(link.claim.id).length > 0,
    );

  return {
    isStructurallyAcceptedExcerpt,
    isCurrentSourceEligible,
    isCurrentExcerptEligible,
    isCurrentClaimEligible,
    isCurrentAccountObjectEligible,
    getStructuralSupportingEvidence,
    hasStructuralSupportingEvidence: (claimId) =>
      getStructuralSupportingEvidence(claimId).length > 0,
    getCurrentSupportingEvidence,
    hasCurrentSupportingEvidence: (claimId) =>
      getCurrentSupportingEvidence(claimId).length > 0,
    getStructuralSupportingClaimLinks,
    hasStructuralSupportingClaim: (objectId) =>
      getStructuralSupportingClaimLinks(objectId).length > 0,
    getCurrentClaimLinks,
    getCurrentSupportingClaimLinks,
    hasCurrentSupportingClaim: (objectId) =>
      getCurrentSupportingClaimLinks(objectId).length > 0,
  };
}
