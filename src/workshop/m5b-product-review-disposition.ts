import {
  assertExactKeys,
  deepFreezeOwnData,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import { m5bProductReviewCanonicalSha256, refuseM5bProductReview } from "./m5b-product-review-contract.ts";
import type { M5bProductReviewPacket } from "./m5b-product-review-package.ts";

export const M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_KIND =
  "m5b-product-review-owner-disposition" as const;
export const M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_VERSION = "1" as const;

export const M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY = Object.freeze({
  nonExecutable: true as const,
  localOwnerDispositionOnly: true as const,
  selectionsSavedByWorkshop: false as const,
  ratificationStatus: "unratified" as const,
  armingStatus: "unarmed" as const,
  currentEffectiveAuthorization: "none" as const,
  applyInputEligible: false as const,
  authorizesRatification: false as const,
  authorizesApply: false as const,
  authorizesGraphWrite: false as const,
  authorizesDatabaseWrite: false as const,
  authorizesProviderCall: false as const,
  authorizesNetworkCall: false as const,
  authorizesDeployment: false as const,
});

export interface M5bProductReviewOwnerDispositionDecision {
  readonly proposalId: string;
  readonly disposition: "accept" | "reject";
}

export interface M5bProductReviewOwnerDisposition {
  readonly kind: typeof M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_KIND;
  readonly schemaVersion: typeof M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_VERSION;
  readonly status: "draft_non_executable_owner_disposition";
  readonly packageBinding: {
    readonly packageId: string;
    readonly requestRawSha256: string;
    readonly requestCanonicalSha256: string;
    readonly sourcePackSha256: string;
    readonly candidateSha256: string;
    readonly reviewPacketSha256: string;
    readonly ownerAuthorizationId: string;
  };
  readonly decisions: readonly M5bProductReviewOwnerDispositionDecision[];
  readonly authorityBoundary: typeof M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY;
  readonly dispositionSha256: string;
}

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 16,
  max_depth: 6,
  max_expanded_json_value_occurrences: 256,
  max_nodes: 64,
  max_object_fields: 24,
  max_string_utf8_bytes: 2_048,
  max_total_string_utf8_bytes: 24 * 1024,
});
const SHA256 = /^[a-f0-9]{64}$/u;

function objectAt(value: StrictJsonValue | undefined, keys: readonly string[]): Record<string, StrictJsonValue> {
  try {
    const object = strictJsonObject(value as StrictJsonValue, "owner_disposition");
    assertExactKeys(object, keys, "owner_disposition");
    return object;
  } catch {
    return refuseM5bProductReview("owner_disposition_shape");
  }
}

function assertPacketIdentity(packet: M5bProductReviewPacket): void {
  const { reviewPacketSha256, ...content } = packet;
  if (!SHA256.test(reviewPacketSha256) || m5bProductReviewCanonicalSha256(content) !== reviewPacketSha256 ||
      !SHA256.test(packet.sourcePackSha256) || !SHA256.test(packet.candidateSha256)) {
    refuseM5bProductReview("owner_disposition_packet");
  }
}

function contentFor(
  packet: M5bProductReviewPacket,
  decisions: readonly M5bProductReviewOwnerDispositionDecision[],
) {
  return {
    kind: M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_VERSION,
    status: "draft_non_executable_owner_disposition" as const,
    packageBinding: {
      packageId: packet.packageBinding.packageId,
      requestRawSha256: packet.packageBinding.requestRawSha256,
      requestCanonicalSha256: packet.packageBinding.requestCanonicalSha256,
      sourcePackSha256: packet.sourcePackSha256,
      candidateSha256: packet.candidateSha256,
      reviewPacketSha256: packet.reviewPacketSha256,
      ownerAuthorizationId: packet.packageBinding.ownerAuthorizationId,
    },
    decisions,
    authorityBoundary: M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY,
  };
}

function snapshotDecisionInput(raw: unknown): readonly M5bProductReviewOwnerDispositionDecision[] {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "owner_disposition_decisions", LIMITS);
  } catch {
    refuseM5bProductReview("owner_disposition_plain_data");
  }
  let values: StrictJsonValue[];
  try {
    values = strictJsonArray(snapshot, "owner_disposition.decisions", 16, true);
  } catch {
    refuseM5bProductReview("owner_disposition_decisions");
  }
  return Object.freeze(values.map((value) => {
    const decision = objectAt(value, ["proposalId", "disposition"]);
    if (typeof decision.proposalId !== "string" ||
        (decision.disposition !== "accept" && decision.disposition !== "reject")) {
      refuseM5bProductReview("owner_disposition_decisions");
    }
    return Object.freeze({ proposalId: decision.proposalId, disposition: decision.disposition });
  }));
}

/** Builds a complete typed local draft. It is deliberately neither ratification nor an apply input. */
export function createM5bProductReviewOwnerDispositionTemplate(
  packet: M5bProductReviewPacket,
  decisionsInput: readonly M5bProductReviewOwnerDispositionDecision[],
): Readonly<M5bProductReviewOwnerDisposition> {
  assertPacketIdentity(packet);
  const decisions = snapshotDecisionInput(decisionsInput);
  const content = contentFor(packet, decisions);
  return validateM5bProductReviewOwnerDisposition({
    ...content,
    dispositionSha256: m5bProductReviewCanonicalSha256(content),
  }, packet);
}

export function validateM5bProductReviewOwnerDisposition(
  raw: unknown,
  packet: M5bProductReviewPacket,
): Readonly<M5bProductReviewOwnerDisposition> {
  assertPacketIdentity(packet);
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "owner_disposition", LIMITS);
  } catch {
    refuseM5bProductReview("owner_disposition_plain_data");
  }
  const root = objectAt(snapshot, ["kind", "schemaVersion", "status", "packageBinding", "decisions",
    "authorityBoundary", "dispositionSha256"]);
  const binding = objectAt(root.packageBinding, ["packageId", "requestRawSha256", "requestCanonicalSha256",
    "sourcePackSha256", "candidateSha256", "reviewPacketSha256", "ownerAuthorizationId"]);
  const boundary = objectAt(root.authorityBoundary, Object.keys(M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY));
  let decisionValues: StrictJsonValue[];
  try {
    decisionValues = strictJsonArray(root.decisions, "owner_disposition.decisions", 16, true);
  } catch {
    refuseM5bProductReview("owner_disposition_decisions");
  }
  const decisions = decisionValues.map((value) => {
    const decision = objectAt(value, ["proposalId", "disposition"]);
    if (typeof decision.proposalId !== "string" ||
        (decision.disposition !== "accept" && decision.disposition !== "reject")) {
      refuseM5bProductReview("owner_disposition_decisions");
    }
    return Object.freeze({ proposalId: decision.proposalId, disposition: decision.disposition });
  });
  const proposalIds = packet.proposals.map((proposal) => proposal.proposalId);
  if (decisions.length !== proposalIds.length || new Set(decisions.map((item) => item.proposalId)).size !== decisions.length ||
      decisions.some((decision, index) => decision.proposalId !== proposalIds[index])) {
    refuseM5bProductReview("owner_disposition_decisions");
  }
  const expectedBinding = contentFor(packet, decisions).packageBinding;
  if (m5bProductReviewCanonicalSha256(binding) !== m5bProductReviewCanonicalSha256(expectedBinding) ||
      m5bProductReviewCanonicalSha256(boundary) !==
        m5bProductReviewCanonicalSha256(M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY) ||
      root.kind !== M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_KIND ||
      root.schemaVersion !== M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_VERSION ||
      root.status !== "draft_non_executable_owner_disposition" ||
      typeof root.dispositionSha256 !== "string" || !SHA256.test(root.dispositionSha256)) {
    refuseM5bProductReview("owner_disposition_binding");
  }
  const content = contentFor(packet, decisions);
  if (root.dispositionSha256 !== m5bProductReviewCanonicalSha256(content)) {
    refuseM5bProductReview("owner_disposition_hash");
  }
  return deepFreezeOwnData({ ...content, dispositionSha256: root.dispositionSha256 }) as
    Readonly<M5bProductReviewOwnerDisposition>;
}
