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
import {
  M5B_PRODUCT_REVIEW_PACKET_KIND,
  M5B_PRODUCT_REVIEW_PACKET_VERSION,
} from "./m5b-product-review-package.ts";
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
const PACKET_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 64,
  max_depth: 12,
  max_expanded_json_value_occurrences: 8_192,
  max_nodes: 2_048,
  max_object_fields: 64,
  max_string_utf8_bytes: 8 * 1024,
  max_total_string_utf8_bytes: 256 * 1024,
});
const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_OID = /^[a-f0-9]{40}$/u;
const PACKAGE_ID = /^m5b-product-review-[a-f0-9]{24}$/u;
const PROPOSAL_ID = /^prp_[a-z0-9][a-z0-9_-]{0,51}$/u;
const AUTHORITY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function objectAt(value: StrictJsonValue | undefined, keys: readonly string[]): Record<string, StrictJsonValue> {
  try {
    const object = strictJsonObject(value as StrictJsonValue, "owner_disposition");
    assertExactKeys(object, keys, "owner_disposition");
    return object;
  } catch {
    return refuseM5bProductReview("owner_disposition_shape");
  }
}

function packetObjectAt(
  value: StrictJsonValue | undefined,
  keys: readonly string[],
): Record<string, StrictJsonValue> {
  try {
    const object = strictJsonObject(value as StrictJsonValue, "product_review_packet");
    assertExactKeys(object, keys, "product_review_packet");
    return object;
  } catch {
    return refuseM5bProductReview("owner_disposition_packet");
  }
}

function assertPacketIdentity(raw: unknown): Readonly<M5bProductReviewPacket> {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "product_review_packet", PACKET_LIMITS);
  } catch {
    return refuseM5bProductReview("owner_disposition_packet");
  }
  const packet = packetObjectAt(snapshot, ["kind", "schemaVersion", "packageBinding", "subject",
    "sourcePackSha256", "candidateSha256", "authority", "effectBoundary", "reviewBoundary",
    "customerQuestions", "lenses", "sourceRegister", "proposals", "reviewPacketSha256"]);
  const binding = packetObjectAt(packet.packageBinding, ["packageId", "requestRawSha256",
    "requestCanonicalSha256", "supersededPackageResultSha256", "ownerAuthorizationId",
    "executionCommit", "executionTree"]);
  let proposals: StrictJsonValue[];
  try {
    proposals = strictJsonArray(packet.proposals, "product_review_packet.proposals", 12, true);
  } catch {
    return refuseM5bProductReview("owner_disposition_packet");
  }
  const proposalIds = proposals.map((value) => {
    const proposal = packetObjectAt(value, ["proposalId", "status", "classification", "lens", "title",
      "summary", "allowedLocalDispositions", "evidenceBindings", "supportingProposalIds", "caveats",
      "safeTask", "trust"]);
    if (typeof proposal.proposalId !== "string" || !PROPOSAL_ID.test(proposal.proposalId)) {
      refuseM5bProductReview("owner_disposition_packet");
    }
    return proposal.proposalId;
  });
  const { reviewPacketSha256, ...content } = packet;
  if (packet.kind !== M5B_PRODUCT_REVIEW_PACKET_KIND ||
      packet.schemaVersion !== M5B_PRODUCT_REVIEW_PACKET_VERSION ||
      typeof reviewPacketSha256 !== "string" || !SHA256.test(reviewPacketSha256) ||
      m5bProductReviewCanonicalSha256(content) !== reviewPacketSha256 ||
      typeof packet.sourcePackSha256 !== "string" || !SHA256.test(packet.sourcePackSha256) ||
      typeof packet.candidateSha256 !== "string" || !SHA256.test(packet.candidateSha256) ||
      typeof binding.packageId !== "string" || !PACKAGE_ID.test(binding.packageId) ||
      typeof binding.requestRawSha256 !== "string" || !SHA256.test(binding.requestRawSha256) ||
      typeof binding.requestCanonicalSha256 !== "string" || !SHA256.test(binding.requestCanonicalSha256) ||
      typeof binding.supersededPackageResultSha256 !== "string" ||
        !SHA256.test(binding.supersededPackageResultSha256) ||
      typeof binding.ownerAuthorizationId !== "string" || !AUTHORITY_ID.test(binding.ownerAuthorizationId) ||
      typeof binding.executionCommit !== "string" || !GIT_OID.test(binding.executionCommit) ||
      typeof binding.executionTree !== "string" || !GIT_OID.test(binding.executionTree) ||
      new Set(proposalIds).size !== proposalIds.length) {
    refuseM5bProductReview("owner_disposition_packet");
  }
  return deepFreezeOwnData(packet) as unknown as Readonly<M5bProductReviewPacket>;
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
  const currentPacket = assertPacketIdentity(packet);
  const decisions = snapshotDecisionInput(decisionsInput);
  const content = contentFor(currentPacket, decisions);
  return validateM5bProductReviewOwnerDisposition({
    ...content,
    dispositionSha256: m5bProductReviewCanonicalSha256(content),
  }, currentPacket);
}

export function validateM5bProductReviewOwnerDisposition(
  raw: unknown,
  packet: M5bProductReviewPacket,
): Readonly<M5bProductReviewOwnerDisposition> {
  const currentPacket = assertPacketIdentity(packet);
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
  const proposalIds = currentPacket.proposals.map((proposal) => proposal.proposalId);
  if (decisions.length !== proposalIds.length || new Set(decisions.map((item) => item.proposalId)).size !== decisions.length ||
      decisions.some((decision, index) => decision.proposalId !== proposalIds[index])) {
    refuseM5bProductReview("owner_disposition_decisions");
  }
  const expectedBinding = contentFor(currentPacket, decisions).packageBinding;
  if (m5bProductReviewCanonicalSha256(binding) !== m5bProductReviewCanonicalSha256(expectedBinding) ||
      m5bProductReviewCanonicalSha256(boundary) !==
        m5bProductReviewCanonicalSha256(M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY) ||
      root.kind !== M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_KIND ||
      root.schemaVersion !== M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_VERSION ||
      root.status !== "draft_non_executable_owner_disposition" ||
      typeof root.dispositionSha256 !== "string" || !SHA256.test(root.dispositionSha256)) {
    refuseM5bProductReview("owner_disposition_binding");
  }
  const content = contentFor(currentPacket, decisions);
  if (root.dispositionSha256 !== m5bProductReviewCanonicalSha256(content)) {
    refuseM5bProductReview("owner_disposition_hash");
  }
  return deepFreezeOwnData({ ...content, dispositionSha256: root.dispositionSha256 }) as
    Readonly<M5bProductReviewOwnerDisposition>;
}
