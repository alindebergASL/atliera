import { createHash } from "node:crypto";

import {
  deepFreezeOwnData,
  snapshotStrictJson,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import { validatedCandidateSha256 } from "../graph/candidate-delta.ts";
import {
  hydrateValidatedCandidate,
  type ValidatedCandidate,
} from "../graph/validated-candidate.ts";
import { assertProposalDerivedRecordsUnverified } from "../validation/proposal-materialization.ts";
import {
  M5B_PRODUCT_REVIEW_PACKET_KIND,
  M5B_PRODUCT_REVIEW_PACKET_VERSION,
  M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
  M5B_PRODUCT_REVIEW_QUESTION_LABELS,
  M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND,
  M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION,
  M5B_PRODUCT_REVIEW_TRANSFORMATION_VERSION,
} from "./m5b-product-review-package.ts";
import type {
  M5bProductReviewEvidenceBinding,
  M5bProductReviewPacket,
  M5bProductReviewPacketProposal,
  M5bProductReviewSanitizedSourcePack,
} from "./m5b-product-review-package.ts";
import {
  M5B_PRODUCT_REVIEW_LIMITS,
  M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION,
  assertM5bProductReviewMaterialChangeQuote,
  isM5bProductReviewCanonicalHttpsUrl,
  isM5bProductReviewIsoTimestamp,
  m5bProductReviewCanonicalSha256,
  m5bProductReviewTextClaimsForbiddenTrust,
  m5bProductReviewTextRequestsEffect,
  refuseM5bProductReview,
  validateM5bProductReviewMeetingPlan,
} from "./m5b-product-review-contract.ts";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const SAFE_PACKAGE_ID = /^m5b-product-review-[a-f0-9]{24}$/;
const SAFE_SOURCE_ID = /^src_[a-z0-9][a-z0-9_-]{0,51}$/;
const SAFE_EVIDENCE_ID = /^evd_[a-z0-9][a-z0-9_-]{0,51}$/;
const SAFE_PROPOSAL_ID = /^prp_[a-z0-9][a-z0-9_-]{0,51}$/;
const SAFE_AUTHORITY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_SUBJECT_ID = /^[a-z][a-z0-9_-]{1,63}$/;
const SAFE_PROVENANCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const SINGLE_LINE_CONTROL = /[\u0000-\u001f\u007f]/u;
const PACKAGE_ARTIFACT_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 1_024,
  max_depth: 16,
  max_expanded_json_value_occurrences: 32_000,
  max_nodes: 8_000,
  max_object_fields: 64,
  max_string_utf8_bytes: 512 * 1024,
  max_total_string_utf8_bytes: 4 * 1024 * 1024,
});

export interface M5bProductReviewPackageArtifactSet {
  readonly sourcePack: unknown;
  readonly candidate: unknown;
  readonly reviewPacket: unknown;
}

export interface M5bProductReviewFeaturedMaterialChangeChain {
  readonly signal: M5bProductReviewPacketProposal;
  readonly map: M5bProductReviewPacketProposal;
  readonly play: M5bProductReviewPacketProposal;
}

export interface M5bProductReviewAdmittedPackageArtifacts {
  readonly sourcePack: M5bProductReviewSanitizedSourcePack;
  readonly candidate: ValidatedCandidate;
  readonly reviewPacket: M5bProductReviewPacket;
  readonly featuredMaterialChangeChain: M5bProductReviewFeaturedMaterialChangeChain;
  readonly admissionAssurance: "self_consistency_only_not_provenance_authentication";
}

export type M5bProductReviewTrustedAdmittedPackageArtifacts = Omit<
  M5bProductReviewAdmittedPackageArtifacts,
  "admissionAssurance"
> & {
  readonly admissionAssurance: "trusted_prepare_result_capability_authenticated";
};

function assertRenderExactKeys(value: unknown, expected: readonly string[]): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    refuseM5bProductReview("render_package_shape");
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    refuseM5bProductReview("render_package_shape");
  }
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return m5bProductReviewCanonicalSha256(left) === m5bProductReviewCanonicalSha256(right);
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) &&
    value.every((item) => typeof item === "string");
}

function isBoundedSingleLine(value: unknown, minBytes: number, maxBytes: number): value is string {
  if (typeof value !== "string") return false;
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes >= minBytes && bytes <= maxBytes && value.trim() === value &&
    !SINGLE_LINE_CONTROL.test(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function objectTypeForLens(lens: M5bProductReviewPacketProposal["lens"]): "signal" | "account_snapshot" | "play" {
  return lens === "signal" ? "signal" : lens === "map" ? "account_snapshot" : "play";
}

function assertCurrentRenderablePackage(
  sourcePack: M5bProductReviewSanitizedSourcePack,
  packet: M5bProductReviewPacket,
): void {
  // Snapshot validation runs before any property access, rejecting accessors, Proxies, exotic objects,
  // symbols, excessive structures, and other non-JSON runtime inputs.
  m5bProductReviewCanonicalSha256(sourcePack);
  m5bProductReviewCanonicalSha256(packet);
  const optionalSourcePackKeys = Object.hasOwn(sourcePack, "meetingPlanSha256") ? ["meetingPlanSha256"] : [];
  assertRenderExactKeys(sourcePack, ["kind", "schemaVersion", "packageBinding", "subject", "authority",
    "supersession", "effectBoundary", "contentPolicy", ...optionalSourcePackKeys, "sources", "sourcePackSha256"]);
  const optionalPacketKeys = Object.hasOwn(packet, "meetingPlan") ? ["meetingPlan"] : [];
  assertRenderExactKeys(packet, ["kind", "schemaVersion", "packageBinding", "subject", "sourcePackSha256",
    "candidateSha256", "authority", "effectBoundary", "reviewBoundary", "customerQuestions", "lenses",
    ...optionalPacketKeys, "sourceRegister", "proposals", "reviewPacketSha256"]);
  if (sourcePack.kind !== M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND ||
      sourcePack.schemaVersion !== M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION ||
      packet.kind !== M5B_PRODUCT_REVIEW_PACKET_KIND ||
      packet.schemaVersion !== M5B_PRODUCT_REVIEW_PACKET_VERSION) {
    refuseM5bProductReview("render_package_version");
  }
  const { sourcePackSha256, ...sourcePackContent } = sourcePack;
  const { reviewPacketSha256, ...packetContent } = packet;
  if (typeof sourcePackSha256 !== "string" || typeof reviewPacketSha256 !== "string" ||
      typeof packet.candidateSha256 !== "string" || !SHA256.test(sourcePackSha256) ||
      !SHA256.test(reviewPacketSha256) || !SHA256.test(packet.candidateSha256) ||
      sourcePackSha256 !== m5bProductReviewCanonicalSha256(sourcePackContent) ||
      reviewPacketSha256 !== m5bProductReviewCanonicalSha256(packetContent) ||
      packet.sourcePackSha256 !== sourcePackSha256 ||
      !canonicalEqual(packet.packageBinding, sourcePack.packageBinding)) {
    refuseM5bProductReview("render_package_binding");
  }

  assertRenderExactKeys(sourcePack.packageBinding, ["packageId", "requestRawSha256",
    "requestCanonicalSha256", "supersededPackageResultSha256", "ownerAuthorizationId",
    "executionCommit", "executionTree", "preparedAt"]);
  const binding = sourcePack.packageBinding;
  if (typeof binding.packageId !== "string" || !SAFE_PACKAGE_ID.test(binding.packageId) ||
      typeof binding.requestRawSha256 !== "string" || !SHA256.test(binding.requestRawSha256) ||
      typeof binding.requestCanonicalSha256 !== "string" || !SHA256.test(binding.requestCanonicalSha256) ||
      typeof binding.supersededPackageResultSha256 !== "string" ||
        !SHA256.test(binding.supersededPackageResultSha256) ||
      typeof binding.ownerAuthorizationId !== "string" ||
        !SAFE_AUTHORITY_ID.test(binding.ownerAuthorizationId) ||
      typeof binding.executionCommit !== "string" || !GIT_OID.test(binding.executionCommit) ||
      typeof binding.executionTree !== "string" || !GIT_OID.test(binding.executionTree) ||
      typeof binding.preparedAt !== "string" || !isM5bProductReviewIsoTimestamp(binding.preparedAt)) {
    refuseM5bProductReview("render_package_shape");
  }
  const expectedPackageId = `m5b-product-review-${m5bProductReviewCanonicalSha256({
    kind: "m5b-product-review-package-binding",
    requestRawSha256: binding.requestRawSha256,
    requestCanonicalSha256: binding.requestCanonicalSha256,
    supersededPackageResultSha256: binding.supersededPackageResultSha256,
    ownerAuthorizationId: binding.ownerAuthorizationId,
    executionCommit: binding.executionCommit,
    executionTree: binding.executionTree,
    preparedAt: binding.preparedAt,
  }).slice(0, 24)}`;
  if (binding.packageId !== expectedPackageId) refuseM5bProductReview("render_package_binding");
  assertRenderExactKeys(sourcePack.subject, ["teamId", "accountId", "accountName"]);
  assertRenderExactKeys(sourcePack.authority, ["ownerAuthorizationId", "currentEffectiveAuthorization",
    "ratificationStatus", "armingStatus", "applyEligibility"]);
  if (typeof sourcePack.subject.teamId !== "string" || !SAFE_SUBJECT_ID.test(sourcePack.subject.teamId) ||
      typeof sourcePack.subject.accountId !== "string" || !SAFE_SUBJECT_ID.test(sourcePack.subject.accountId) ||
      !isBoundedSingleLine(sourcePack.subject.accountName, 2, 160) ||
      m5bProductReviewTextClaimsForbiddenTrust(sourcePack.subject.accountName) ||
      sourcePack.authority.ownerAuthorizationId !== binding.ownerAuthorizationId ||
      sourcePack.authority.currentEffectiveAuthorization !== "none" ||
      sourcePack.authority.ratificationStatus !== "unratified" ||
      sourcePack.authority.armingStatus !== "unarmed" || sourcePack.authority.applyEligibility !== false ||
      !canonicalEqual(packet.subject, sourcePack.subject) ||
      !canonicalEqual(packet.authority, sourcePack.authority) ||
      !canonicalEqual(sourcePack.effectBoundary, M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY) ||
      !canonicalEqual(packet.effectBoundary, M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY) ||
      !canonicalEqual(sourcePack.supersession, { preservesOldBytes: true,
        preservesOldProducerIdentity: true, rewritesHistoricalPackage: false }) ||
      !canonicalEqual(sourcePack.contentPolicy,
        { fullSourceBytesEmbedded: false, boundedExactExcerptsOnly: true }) ||
      !canonicalEqual(packet.reviewBoundary, { localSelectionsOnly: true, selectionsSaved: false,
        selectionsAreRatification: false, writeAuthority: "none" })) {
    refuseM5bProductReview("render_package_binding");
  }

  if (!Array.isArray(sourcePack.sources) || sourcePack.sources.length < 2 ||
      sourcePack.sources.length > 4 || !Array.isArray(packet.proposals) ||
      packet.proposals.length === 0 || packet.proposals.length > 12 ||
      !Array.isArray(packet.customerQuestions) || !Array.isArray(packet.lenses) ||
      !Array.isArray(packet.sourceRegister)) {
    refuseM5bProductReview("render_package_shape");
  }
  let totalRawBytes = 0;
  let totalDecodedBytes = 0;
  let totalExcerptBytes = 0;
  for (const source of sourcePack.sources) {
    assertRenderExactKeys(source, ["sourceId", "title", "sourceKind", "contentEncoding", "canonicalUrl",
      "acquiredAt", "evidenceCurrentThrough", "publisher", "sourceType", "rawByteSize",
      "originContentSha256", "decodedByteSize", "decodedContentSha256", "storedContentSha256",
      "transformationManifestSha256", "provenance", "evidenceBindings"]);
    if (typeof source.sourceId !== "string" || !SAFE_SOURCE_ID.test(source.sourceId) ||
        !isBoundedSingleLine(source.title, 2, 240) || typeof source.canonicalUrl !== "string" ||
        !isM5bProductReviewCanonicalHttpsUrl(source.canonicalUrl) ||
        typeof source.acquiredAt !== "string" || !isM5bProductReviewIsoTimestamp(source.acquiredAt) ||
        new Date(source.acquiredAt).getTime() > new Date(binding.preparedAt).getTime() ||
        !isBoundedSingleLine(source.publisher, 1, 160) ||
        !isBoundedSingleLine(source.sourceType, 1, 96) ||
        (source.sourceKind !== "synthetic_fixture" &&
          source.sourceKind !== "exact_public_acquisition_custody") ||
        (source.contentEncoding !== "raw_utf8" &&
          source.contentEncoding !== "m4_public_http_fetch_custody_v1" &&
          source.contentEncoding !== "exact_sec_archive_custody_v1") ||
        (source.evidenceCurrentThrough !== null &&
          !isBoundedSingleLine(source.evidenceCurrentThrough, 1, 160)) ||
        !isPositiveSafeInteger(source.rawByteSize) ||
        !isPositiveSafeInteger(source.decodedByteSize) ||
        typeof source.originContentSha256 !== "string" || !SHA256.test(source.originContentSha256) ||
        typeof source.decodedContentSha256 !== "string" || !SHA256.test(source.decodedContentSha256) ||
        typeof source.storedContentSha256 !== "string" || !SHA256.test(source.storedContentSha256) ||
        typeof source.transformationManifestSha256 !== "string" ||
          !SHA256.test(source.transformationManifestSha256) ||
        source.rawByteSize > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
        source.decodedByteSize > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
        (source.contentEncoding === "raw_utf8" &&
          (source.rawByteSize !== source.decodedByteSize ||
            source.originContentSha256 !== source.decodedContentSha256)) ||
        !Array.isArray(source.evidenceBindings) || source.evidenceBindings.length === 0) {
      refuseM5bProductReview("render_package_shape");
    }
    totalRawBytes += source.rawByteSize;
    totalDecodedBytes += source.decodedByteSize;
    assertRenderExactKeys(source.provenance, ["classification", "exactUrl", "responseByteSize",
      "responseSha256", "outerCustodySha256", "targetPolicySha256", "capabilityId", "adapterId",
      "adapterSha256", "authorityId", "consumptionId", "implementationCommit", "implementationTree",
      "acquisitionConsumptionSha256", "retainedReadAuthorityId", "retainedReadConsumptionId",
      "retainedReadImplementationCommit", "retainedReadImplementationTree",
      "retainedReadLedgerNamespaceSha256", "retainedReadLedgerRecordSha256"]);
    const provenance = source.provenance;
    const classificationEncodingValid = source.sourceKind === "exact_public_acquisition_custody"
      ? source.contentEncoding !== "raw_utf8"
      : source.contentEncoding === "raw_utf8" || source.contentEncoding === "m4_public_http_fetch_custody_v1";
    if (provenance.exactUrl !== source.canonicalUrl || provenance.responseByteSize !== source.decodedByteSize ||
        provenance.responseSha256 !== source.decodedContentSha256 ||
        provenance.outerCustodySha256 !== source.originContentSha256 ||
        !classificationEncodingValid) {
      refuseM5bProductReview("render_package_binding");
    }
    if (source.sourceKind === "synthetic_fixture") {
      if (provenance.classification !== "explicit_synthetic_fixture" ||
          [provenance.targetPolicySha256, provenance.capabilityId, provenance.adapterId,
            provenance.adapterSha256, provenance.authorityId, provenance.consumptionId,
            provenance.implementationCommit, provenance.implementationTree,
            provenance.acquisitionConsumptionSha256, provenance.retainedReadAuthorityId,
            provenance.retainedReadConsumptionId, provenance.retainedReadImplementationCommit,
            provenance.retainedReadImplementationTree, provenance.retainedReadLedgerNamespaceSha256,
            provenance.retainedReadLedgerRecordSha256].some((value) => value !== null)) {
        refuseM5bProductReview("render_package_binding");
      }
    } else if (provenance.classification !== "validated_exact_public_acquisition_custody" ||
        typeof provenance.targetPolicySha256 !== "string" || !SHA256.test(provenance.targetPolicySha256) ||
        typeof provenance.adapterSha256 !== "string" || !SHA256.test(provenance.adapterSha256) ||
        typeof provenance.acquisitionConsumptionSha256 !== "string" ||
          !SHA256.test(provenance.acquisitionConsumptionSha256) ||
        typeof provenance.capabilityId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.capabilityId) ||
        typeof provenance.adapterId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.adapterId) ||
        typeof provenance.authorityId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.authorityId) ||
        typeof provenance.consumptionId !== "string" ||
          !SAFE_PROVENANCE_ID.test(provenance.consumptionId) ||
        typeof provenance.implementationCommit !== "string" ||
          !GIT_OID.test(provenance.implementationCommit) ||
        (provenance.implementationTree !== null && (typeof provenance.implementationTree !== "string" ||
          !GIT_OID.test(provenance.implementationTree)))) {
      refuseM5bProductReview("render_package_shape");
    }
    if (source.sourceKind === "exact_public_acquisition_custody" &&
        provenance.classification === "validated_exact_public_acquisition_custody") {
      const retainedReadFields = [provenance.retainedReadAuthorityId,
        provenance.retainedReadConsumptionId, provenance.retainedReadImplementationCommit,
        provenance.retainedReadImplementationTree, provenance.retainedReadLedgerNamespaceSha256,
        provenance.retainedReadLedgerRecordSha256];
      if (source.contentEncoding === "m4_public_http_fetch_custody_v1") {
        if (typeof provenance.retainedReadAuthorityId !== "string" ||
            !SAFE_PROVENANCE_ID.test(provenance.retainedReadAuthorityId) ||
            typeof provenance.retainedReadConsumptionId !== "string" ||
            !SAFE_PROVENANCE_ID.test(provenance.retainedReadConsumptionId) ||
            typeof provenance.retainedReadImplementationCommit !== "string" ||
            !GIT_OID.test(provenance.retainedReadImplementationCommit) ||
            typeof provenance.retainedReadImplementationTree !== "string" ||
            !GIT_OID.test(provenance.retainedReadImplementationTree) ||
            typeof provenance.retainedReadLedgerNamespaceSha256 !== "string" ||
            !SHA256.test(provenance.retainedReadLedgerNamespaceSha256) ||
            typeof provenance.retainedReadLedgerRecordSha256 !== "string" ||
            !SHA256.test(provenance.retainedReadLedgerRecordSha256)) {
          refuseM5bProductReview("render_package_shape");
        }
      } else if (retainedReadFields.some((value) => value !== null)) {
        refuseM5bProductReview("render_package_shape");
      }
    }
    let storedText = "";
    let sourceExcerptBytes = 0;
    for (const evidence of source.evidenceBindings) {
      assertRenderExactKeys(evidence, ["evidenceId", "sourceId", "exactQuote", "evidenceRole",
        "materialChangeAssertion",
        "exactQuoteSha256", "sourceCharStart", "sourceCharEnd", "storedCharStart", "storedCharEnd"]);
      const sourceCharStart = evidence.sourceCharStart;
      const sourceCharEnd = evidence.sourceCharEnd;
      const storedCharStart = evidence.storedCharStart;
      const storedCharEnd = evidence.storedCharEnd;
      const expectedStoredCharStart = storedText.length + (storedText.length === 0 ? 0 : 2);
      const quoteBytes = typeof evidence.exactQuote === "string"
        ? Buffer.byteLength(evidence.exactQuote, "utf8") : Number.POSITIVE_INFINITY;
      if (typeof evidence.evidenceId !== "string" || !SAFE_EVIDENCE_ID.test(evidence.evidenceId) ||
          evidence.sourceId !== source.sourceId || typeof evidence.exactQuote !== "string" ||
          (evidence.evidenceRole !== "account_identity" && evidence.evidenceRole !== "account_context" &&
            evidence.evidenceRole !== "material_change") || typeof evidence.exactQuoteSha256 !== "string" ||
          !SHA256.test(evidence.exactQuoteSha256) ||
          !isNonNegativeSafeInteger(sourceCharStart) || !isNonNegativeSafeInteger(sourceCharEnd) ||
          !isNonNegativeSafeInteger(storedCharStart) || !isNonNegativeSafeInteger(storedCharEnd) ||
          sourceCharStart >= sourceCharEnd || storedCharStart >= storedCharEnd ||
          sourceCharEnd - sourceCharStart !== evidence.exactQuote.length ||
          sourceCharEnd > source.decodedByteSize ||
          quoteBytes < 8 || quoteBytes > M5B_PRODUCT_REVIEW_LIMITS.excerptBytesEach ||
          evidence.exactQuote.trim() !== evidence.exactQuote || SINGLE_LINE_CONTROL.test(evidence.exactQuote) ||
          evidence.exactQuoteSha256 !== sha256Utf8(evidence.exactQuote) ||
          storedCharStart !== expectedStoredCharStart) {
        refuseM5bProductReview("render_package_shape");
      }
      if (evidence.evidenceRole === "material_change") {
        assertRenderExactKeys(evidence.materialChangeAssertion, ["kind", "polarity", "status"]);
        if (evidence.materialChangeAssertion.kind !== "account_event" ||
            evidence.materialChangeAssertion.polarity !== "affirmed" ||
            (evidence.materialChangeAssertion.status !== "completed" &&
              evidence.materialChangeAssertion.status !== "announced" &&
              evidence.materialChangeAssertion.status !== "agreement_reached")) {
          refuseM5bProductReview("render_package_shape");
        }
        assertM5bProductReviewMaterialChangeQuote(
          sourcePack.subject.accountName,
          evidence.exactQuote,
          evidence.materialChangeAssertion,
        );
      } else if (evidence.materialChangeAssertion !== null) {
        refuseM5bProductReview("render_package_shape");
      }
      if (storedText.length > 0) {
        storedText += "\n\n";
        if (storedCharStart !== storedText.length) refuseM5bProductReview("render_package_binding");
      }
      storedText += evidence.exactQuote;
      sourceExcerptBytes += quoteBytes;
      totalExcerptBytes += quoteBytes;
      if (storedCharEnd !== storedText.length) refuseM5bProductReview("render_package_binding");
    }
    const storedContentSha256 = sha256Utf8(storedText);
    const transformationManifestSha256 = m5bProductReviewCanonicalSha256({
      kind: "m5b-product-review-bounded-excerpt-transformation",
      schemaVersion: M5B_PRODUCT_REVIEW_TRANSFORMATION_VERSION,
      sourceId: source.sourceId,
      originContentSha256: source.originContentSha256,
      decodedContentSha256: source.decodedContentSha256,
      storedContentSha256,
      fullSourceBytesEmbedded: false,
      sourceProvenance: source.provenance,
      evidenceBindings: source.evidenceBindings.map((evidence) => ({
        evidenceId: evidence.evidenceId,
        evidenceRole: evidence.evidenceRole,
        materialChangeAssertion: evidence.materialChangeAssertion,
        exactQuoteSha256: evidence.exactQuoteSha256,
        sourceCharStart: evidence.sourceCharStart,
        sourceCharEnd: evidence.sourceCharEnd,
        storedCharStart: evidence.storedCharStart,
        storedCharEnd: evidence.storedCharEnd,
      })),
    });
    if (source.storedContentSha256 !== storedContentSha256 ||
        source.transformationManifestSha256 !== transformationManifestSha256 ||
        sourceExcerptBytes >= source.decodedByteSize) {
      refuseM5bProductReview("render_package_binding");
    }
  }
  if (!Number.isSafeInteger(totalRawBytes) || !Number.isSafeInteger(totalDecodedBytes) ||
      totalRawBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal ||
      totalDecodedBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal ||
      totalExcerptBytes > M5B_PRODUCT_REVIEW_LIMITS.excerptBytesTotal) {
    refuseM5bProductReview("render_package_shape");
  }
  const sourceEvidence = sourcePack.sources.flatMap((source) => source.evidenceBindings);
  const evidenceById = new Map(sourceEvidence.map((binding) => [binding.evidenceId, binding]));
  const sourceIds = new Set(sourcePack.sources.map((source) => source.sourceId));
  if (sourceIds.size !== sourcePack.sources.length || evidenceById.size !== sourceEvidence.length) {
    refuseM5bProductReview("render_package_binding");
  }
  if (sourceEvidence.length > M5B_PRODUCT_REVIEW_LIMITS.evidenceCountMax) {
    refuseM5bProductReview("render_package_shape");
  }
  if (sourcePack.sources.some((source) => source.sourceKind === "exact_public_acquisition_custody") &&
      sourceEvidence.some((evidence) => evidence.evidenceRole === "material_change" &&
        sourcePack.sources.find((source) => source.sourceId === evidence.sourceId)?.sourceKind !==
          "exact_public_acquisition_custody")) {
    refuseM5bProductReview("render_package_binding");
  }
  for (const proposal of packet.proposals) {
    assertRenderExactKeys(proposal, ["proposalId", "status", "classification", "lens", "title", "summary",
      "allowedLocalDispositions", "evidenceBindings", "supportingProposalIds", "caveats", "safeTask", "trust"]);
    assertRenderExactKeys(proposal.trust, ["sourceBacked", "independentlyVerified", "humanRatified",
      "qualityPassed", "proposed", "durable", "createdBy"]);
    if (typeof proposal.proposalId !== "string" || !SAFE_PROPOSAL_ID.test(proposal.proposalId) ||
        proposal.status !== "pending" ||
        (proposal.classification !== "source_fact" && proposal.classification !== "analysis" &&
          proposal.classification !== "recommendation") ||
        (proposal.lens !== "signal" && proposal.lens !== "map" && proposal.lens !== "play") ||
        !isBoundedSingleLine(proposal.title, 8, 1_200) ||
        !isBoundedSingleLine(proposal.summary, 20, 1_200) ||
        !canonicalEqual(proposal.allowedLocalDispositions, ["accept", "reject"]) ||
        !Array.isArray(proposal.evidenceBindings) || proposal.evidenceBindings.length === 0 ||
        !isStringArray(proposal.supportingProposalIds) ||
        proposal.supportingProposalIds.length > packet.proposals.length ||
        new Set(proposal.supportingProposalIds).size !== proposal.supportingProposalIds.length ||
        !isStringArray(proposal.caveats) || proposal.caveats.length > 4 ||
        proposal.caveats.some((caveat) => !isBoundedSingleLine(caveat, 8, 500)) ||
        proposal.trust.sourceBacked !== (proposal.classification === "source_fact") ||
        proposal.trust.independentlyVerified !== false || proposal.trust.humanRatified !== false ||
        proposal.trust.qualityPassed !== false || proposal.trust.proposed !== true ||
        proposal.trust.durable !== false || proposal.trust.createdBy !== "system") {
      refuseM5bProductReview("render_package_shape");
    }
    if (proposal.safeTask !== null) {
      assertRenderExactKeys(proposal.safeTask, ["kind", "description", "nonExecutable"]);
      if (proposal.safeTask.kind !== "draft_targeted_meeting_brief" ||
          !isBoundedSingleLine(proposal.safeTask.description, 12, 500) ||
          proposal.safeTask.nonExecutable !== true) {
        refuseM5bProductReview("render_package_shape");
      }
    }
    for (const evidence of proposal.evidenceBindings) {
      assertRenderExactKeys(evidence, ["evidenceId", "sourceId", "exactQuote", "evidenceRole",
        "materialChangeAssertion",
        "exactQuoteSha256", "sourceCharStart", "sourceCharEnd", "storedCharStart", "storedCharEnd"]);
      const sourceBinding = evidenceById.get(evidence.evidenceId);
      if (sourceBinding === undefined || !canonicalEqual(sourceBinding, evidence)) {
        refuseM5bProductReview("render_package_binding");
      }
    }
  }
  const proposalsById = new Map(packet.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const proposalSummaries = packet.proposals.map((proposal) => proposal.summary);
  const usedEvidenceIds = new Set((packet.proposals as readonly M5bProductReviewPacketProposal[])
    .flatMap((proposal) =>
    proposal.evidenceBindings.map((binding) => binding.evidenceId)));
  if (proposalsById.size !== packet.proposals.length ||
      new Set(proposalSummaries).size !== proposalSummaries.length ||
      sourceEvidence.some((binding) => !usedEvidenceIds.has(binding.evidenceId)) ||
      packet.proposals.some((proposal) =>
    (proposal.supportingProposalIds as readonly string[]).some((id) => !proposalsById.has(id)))) {
    refuseM5bProductReview("render_package_binding");
  }
  const transitiveEvidence = (
    proposal: M5bProductReviewPacketProposal,
    visiting = new Set<string>(),
  ): Set<string> => {
    if (visiting.has(proposal.proposalId)) refuseM5bProductReview("render_proposal_topology");
    const next = new Set(visiting).add(proposal.proposalId);
    const evidence = new Set(proposal.evidenceBindings.map((binding) => binding.evidenceId));
    for (const dependencyId of proposal.supportingProposalIds) {
      const dependency = proposalsById.get(dependencyId);
      if (dependency === undefined) refuseM5bProductReview("render_proposal_topology");
      for (const evidenceId of transitiveEvidence(dependency, next)) evidence.add(evidenceId);
    }
    return evidence;
  };
  for (const proposal of packet.proposals as readonly M5bProductReviewPacketProposal[]) {
    const evidenceIds = proposal.evidenceBindings.map((binding) => binding.evidenceId);
    if (new Set(evidenceIds).size !== evidenceIds.length) {
      refuseM5bProductReview("render_proposal_topology");
    }
    if (proposal.classification === "source_fact") {
      const evidence = proposal.evidenceBindings[0];
      if (proposal.supportingProposalIds.length !== 0 || proposal.caveats.length !== 0 ||
          proposal.safeTask !== null || proposal.lens === "play" || evidenceIds.length !== 1 ||
          proposal.title !== proposal.summary || proposal.summary !== `Source states: ${evidence?.exactQuote}` ||
          (proposal.lens === "signal" && evidence?.evidenceRole !== "material_change")) {
        refuseM5bProductReview("render_proposal_topology");
      }
      continue;
    }
    if (m5bProductReviewTextClaimsForbiddenTrust(proposal.title) ||
        m5bProductReviewTextClaimsForbiddenTrust(proposal.summary) ||
        proposal.caveats.some(m5bProductReviewTextClaimsForbiddenTrust) ||
        m5bProductReviewTextRequestsEffect(proposal.title) ||
        m5bProductReviewTextRequestsEffect(proposal.summary) ||
        proposal.caveats.some(m5bProductReviewTextRequestsEffect)) {
      refuseM5bProductReview("render_proposal_topology");
    }
    const dependencies = proposal.supportingProposalIds.map((id) => proposalsById.get(id)!);
    if (dependencies.length === 0 || proposal.caveats.length === 0 ||
        proposal.supportingProposalIds.includes(proposal.proposalId) ||
        dependencies.some((dependency) => dependency.classification === "recommendation") ||
        Buffer.byteLength(proposal.title, "utf8") > 180) {
      refuseM5bProductReview("render_proposal_topology");
    }
    const supportedEvidence = new Set<string>();
    for (const dependency of dependencies) {
      for (const evidenceId of transitiveEvidence(dependency)) supportedEvidence.add(evidenceId);
    }
    if (evidenceIds.some((id) => !supportedEvidence.has(id))) {
      refuseM5bProductReview("render_proposal_topology");
    }
    if (proposal.classification === "analysis") {
      if (proposal.safeTask !== null || proposal.lens === "play" ||
          dependencies.some((dependency) => dependency.classification !== "source_fact")) {
        refuseM5bProductReview("render_proposal_topology");
      }
    } else if (proposal.safeTask === null || proposal.lens !== "play" ||
        proposal.safeTask.kind !== "draft_targeted_meeting_brief" ||
        proposal.safeTask.description !== M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION ||
        proposal.safeTask.nonExecutable !== true || !/\bdraft\b/iu.test(proposal.title) ||
        !/\bbrief\b/iu.test(proposal.title) ||
        !dependencies.some((dependency) => dependency.classification === "analysis")) {
      refuseM5bProductReview("render_proposal_topology");
    }
  }

  const expectedSourceRegister = sourcePack.sources.map((source) => ({
    sourceId: source.sourceId, title: source.title, canonicalUrl: source.canonicalUrl,
    contentEncoding: source.contentEncoding, originContentSha256: source.originContentSha256,
    decodedByteSize: source.decodedByteSize, decodedContentSha256: source.decodedContentSha256,
    storedContentSha256: source.storedContentSha256,
    transformationManifestSha256: source.transformationManifestSha256,
    provenance: source.provenance, evidenceCurrentThrough: source.evidenceCurrentThrough,
  }));
  const expectedLenses = (["signal", "map", "play"] as const).map((lens) => ({ lens,
    proposalIds: packet.proposals.filter((proposal) => proposal.lens === lens)
      .map((proposal) => proposal.proposalId) }));
  if (!canonicalEqual(packet.sourceRegister, expectedSourceRegister) ||
      !canonicalEqual(packet.lenses, expectedLenses)) {
    refuseM5bProductReview("render_package_binding");
  }
  if (packet.customerQuestions.length !== M5B_PRODUCT_REVIEW_QUESTION_LABELS.length) {
    refuseM5bProductReview("render_question_binding");
  }
  for (const [index, item] of packet.customerQuestions.entries()) {
    assertRenderExactKeys(item, ["question", "answer", "evidenceBindingIds", "proposalBindingIds"]);
    if (item.question !== M5B_PRODUCT_REVIEW_QUESTION_LABELS[index]![0] ||
        !isBoundedSingleLine(item.answer, 12, 1_200) || !isStringArray(item.evidenceBindingIds) ||
        !isStringArray(item.proposalBindingIds) ||
        new Set(item.evidenceBindingIds).size !== item.evidenceBindingIds.length ||
        new Set(item.proposalBindingIds).size !== item.proposalBindingIds.length ||
        (index !== 1 && (m5bProductReviewTextClaimsForbiddenTrust(item.answer) ||
          (index !== 4 && m5bProductReviewTextRequestsEffect(item.answer)))) ||
        (index === 4 && item.answer !== M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION) ||
        (index === 1 ? item.evidenceBindingIds.length === 0 || item.evidenceBindingIds.some((id) =>
          evidenceById.get(id)?.evidenceRole !== "material_change") || item.proposalBindingIds.length !== 3 :
          (index === 0 || index === 2)
            ? (item.evidenceBindingIds.length === 0) !== (item.proposalBindingIds.length === 0)
            : item.evidenceBindingIds.length !== 0 || item.proposalBindingIds.length !== 0)) {
      refuseM5bProductReview("render_question_binding");
    }
  }
  for (const item of [packet.customerQuestions[0]!, packet.customerQuestions[2]!]) {
    const supportEvidenceIds = item.evidenceBindingIds as readonly string[];
    const supportProposalIds = item.proposalBindingIds as readonly string[];
    if (supportEvidenceIds.length === 0) continue;
    const boundProposals = supportProposalIds.map((id: string) => proposalsById.get(id));
    if (supportEvidenceIds.some((id: string) => !evidenceById.has(id)) ||
        boundProposals.some((proposal: M5bProductReviewPacketProposal | undefined) => proposal === undefined)) {
      refuseM5bProductReview("render_question_binding");
    }
    const supportedEvidence = new Set<string>();
    for (const proposal of boundProposals) {
      for (const evidenceId of transitiveEvidence(proposal!)) supportedEvidence.add(evidenceId);
    }
    if (supportEvidenceIds.some((id: string) => !supportedEvidence.has(id))) {
      refuseM5bProductReview("render_question_binding");
    }
  }
  if ((packet.meetingPlan === undefined) !== (sourcePack.meetingPlanSha256 === undefined)) {
    refuseM5bProductReview("render_meeting_plan_binding");
  }
  if (packet.meetingPlan !== undefined) {
    validateM5bProductReviewMeetingPlan(packet.meetingPlan);
    if (sourcePack.meetingPlanSha256 !== m5bProductReviewCanonicalSha256(packet.meetingPlan)) {
      refuseM5bProductReview("render_meeting_plan_binding");
    }
  }
  const questionMaterialEvidenceIds = packet.customerQuestions[1]!.evidenceBindingIds as readonly string[];
  if (questionMaterialEvidenceIds.some((evidenceId) => !packet.proposals.some((analysis) =>
    analysis.classification === "analysis" && analysis.lens === "map" &&
    analysis.evidenceBindings.some((binding) => binding.evidenceId === evidenceId) &&
    analysis.supportingProposalIds.some((signalId) => {
      const signal = proposalsById.get(signalId);
      return signal?.classification === "source_fact" && signal.lens === "signal" &&
        signal.evidenceBindings.length === 1 && signal.evidenceBindings[0]!.evidenceId === evidenceId &&
        signal.evidenceBindings[0]!.evidenceRole === "material_change";
    })))) {
    refuseM5bProductReview("render_question_binding");
  }
}

function assertCandidateBinding(
  sourcePack: M5bProductReviewSanitizedSourcePack,
  candidate: ValidatedCandidate,
  packet: M5bProductReviewPacket,
): void {
  if (validatedCandidateSha256(candidate) !== packet.candidateSha256 ||
      candidate.subject.team_id !== sourcePack.subject.teamId ||
      candidate.subject.account_id !== sourcePack.subject.accountId) {
    refuseM5bProductReview("render_candidate_binding");
  }

  const graph = candidate.graph_bundle;
  try {
    assertProposalDerivedRecordsUnverified(graph);
  } catch {
    refuseM5bProductReview("render_candidate_binding");
  }
  if (graph.research_runs.length !== 0 || graph.run_artifacts.length !== 0 ||
      graph.audit_events.length !== 0) {
    refuseM5bProductReview("render_candidate_binding");
  }

  const expectedSources = sourcePack.sources.map((source) => ({
    id: source.sourceId,
    team_id: sourcePack.subject.teamId,
    account_id: sourcePack.subject.accountId,
    url: source.canonicalUrl,
    canonical_url: source.canonicalUrl,
    title: source.title,
    publisher: source.publisher,
    source_type: source.sourceType,
    fetched_at: source.acquiredAt,
    accessed_at: source.acquiredAt,
    origin_content_sha256: source.originContentSha256,
    stored_content_sha256: source.storedContentSha256,
    transformation_manifest_sha256: source.transformationManifestSha256,
    raw_text: source.evidenceBindings.map((binding) => binding.exactQuote).join("\n\n"),
    reliability: "unknown",
    status: "active",
  }));
  if (!canonicalEqual(graph.sources, expectedSources)) {
    refuseM5bProductReview("render_candidate_binding");
  }

  const expectedExcerpts = sourcePack.sources.flatMap((source) => source.evidenceBindings.map((binding) => ({
    evidenceId: binding.evidenceId,
    sourceId: source.sourceId,
    text: binding.exactQuote,
    charStart: binding.storedCharStart,
    charEnd: binding.storedCharEnd,
  })));
  const excerptKey = (sourceId: string, text: string, charStart: number, charEnd: number): string =>
    m5bProductReviewCanonicalSha256({ sourceId, text, charStart, charEnd });
  const expectedExcerptByKey = new Map(expectedExcerpts.map((expected) => [
    excerptKey(expected.sourceId, expected.text, expected.charStart, expected.charEnd),
    expected,
  ]));
  const candidatePreparedAt = sourcePack.packageBinding.preparedAt;
  const evidenceExcerptIdByEvidenceId = new Map<string, string>();
  if (expectedExcerptByKey.size !== expectedExcerpts.length ||
      graph.excerpts.length !== expectedExcerpts.length) {
    refuseM5bProductReview("render_candidate_binding");
  }
  for (const [index, excerpt] of graph.excerpts.entries()) {
    const expected = expectedExcerptByKey.get(excerptKey(
      excerpt.source_document_id,
      excerpt.text,
      excerpt.char_start,
      excerpt.char_end,
    ));
    const expectedId = `exc_m5b_product_${String(index + 1).padStart(3, "0")}`;
    if (expected === undefined || evidenceExcerptIdByEvidenceId.has(expected.evidenceId) ||
        excerpt.id !== expectedId || excerpt.kind !== "literal" ||
        excerpt.captured_at !== candidatePreparedAt || excerpt.validation_status !== "proposed" ||
        excerpt.rejection_reason !== null) {
      refuseM5bProductReview("render_candidate_binding");
    }
    evidenceExcerptIdByEvidenceId.set(expected.evidenceId, excerpt.id);
  }

  if (graph.account_objects.length !== packet.proposals.length ||
      graph.claims.length !== packet.proposals.length ||
      evidenceExcerptIdByEvidenceId.size !== expectedExcerpts.length) {
    refuseM5bProductReview("render_candidate_binding");
  }

  const expectedClaims = packet.proposals.map((proposal, index) => ({
    id: `clm_m5b_product_${String(index + 1).padStart(3, "0")}`,
    team_id: sourcePack.subject.teamId,
    account_id: sourcePack.subject.accountId,
    claim_type: `m5b_product_review_${proposal.classification}`,
    text: proposal.summary,
    normalized_subject: `${sourcePack.subject.accountId}:${proposal.proposalId}`,
    confidence: proposal.classification === "source_fact" ? "medium" : "low",
    provenance_status: "unverified",
    status: "active",
    created_by: "system",
    created_at: candidatePreparedAt,
  }));
  if (!canonicalEqual(graph.claims, expectedClaims)) {
    refuseM5bProductReview("render_candidate_binding");
  }

  const expectedObjects = packet.proposals.map((proposal, index) => {
    const expectedSafeTask = proposal.safeTask === null ? null : {
      kind: proposal.safeTask.kind,
      description: proposal.safeTask.description,
    };
    const expectedEvidenceRoles = proposal.evidenceBindings.map((binding) => ({
      evidence_id: binding.evidenceId,
      evidence_role: binding.evidenceRole,
      material_change_assertion: binding.materialChangeAssertion,
    }));
    return {
      id: `obj_m5b_product_${String(index + 1).padStart(3, "0")}`,
      team_id: sourcePack.subject.teamId,
      account_id: sourcePack.subject.accountId,
      object_type: objectTypeForLens(proposal.lens),
      title: proposal.title,
      summary: proposal.summary,
      payload_json: {
        proposal_id: proposal.proposalId,
        classification: proposal.classification,
        lens: proposal.lens,
        evidence_roles: expectedEvidenceRoles,
        supporting_proposal_ids: proposal.supportingProposalIds,
        caveats: proposal.caveats,
        safe_task: expectedSafeTask,
        review_status: "proposed_unratified_unarmed",
        source_backed: proposal.classification === "source_fact",
        independently_verified: false,
        human_ratified: false,
        quality_passed: false,
        durable: false,
        system_created: true,
        authority: sourcePack.authority,
        package_binding: sourcePack.packageBinding,
        source_pack_sha256: sourcePack.sourcePackSha256,
        zero_effect_boundary: M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
      },
      confidence: proposal.classification === "source_fact" ? "medium" : "low",
      provenance_status: "unverified",
      status: "active",
      created_by: "system",
      created_at: candidatePreparedAt,
      updated_at: candidatePreparedAt,
    };
  });
  if (!canonicalEqual(graph.account_objects, expectedObjects)) {
    refuseM5bProductReview("render_candidate_binding");
  }

  const expectedClaimEvidence = packet.proposals.flatMap((proposal, proposalIndex) =>
    proposal.evidenceBindings.map((binding, evidenceIndex) => ({
      id: `cev_m5b_${String(proposalIndex + 1).padStart(3, "0")}_${String(evidenceIndex + 1).padStart(2, "0")}`,
      claim_id: `clm_m5b_product_${String(proposalIndex + 1).padStart(3, "0")}`,
      evidence_excerpt_id: evidenceExcerptIdByEvidenceId.get(binding.evidenceId),
      relationship: proposal.classification === "source_fact" ? "supports" : "context",
      rationale: proposal.classification === "source_fact"
        ? "The proposed source fact is directly attributed to this exact source excerpt."
        : "The exact excerpt provides context for this proposed interpretation; it is not independent verification.",
      confidence: proposal.classification === "source_fact" ? "medium" : "low",
      created_at: candidatePreparedAt,
    })));
  if (expectedClaimEvidence.some((item) => item.evidence_excerpt_id === undefined) ||
      !canonicalEqual(graph.claim_evidence, expectedClaimEvidence)) {
    refuseM5bProductReview("render_candidate_binding");
  }

  const expectedObjectClaims = packet.proposals.map((_proposal, index) => ({
    id: `oclm_m5b_product_${String(index + 1).padStart(3, "0")}`,
    account_object_id: `obj_m5b_product_${String(index + 1).padStart(3, "0")}`,
    claim_id: `clm_m5b_product_${String(index + 1).padStart(3, "0")}`,
    relationship: "primary",
  }));
  if (!canonicalEqual(graph.account_object_claims, expectedObjectClaims)) {
    refuseM5bProductReview("render_candidate_binding");
  }
}

function featuredMaterialChangeChain(packet: M5bProductReviewPacket): M5bProductReviewFeaturedMaterialChangeChain {
  const proposalsById = new Map(packet.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const question = packet.customerQuestions[1]!;
  const [signalId, mapId, playId] = question.proposalBindingIds;
  const signal = proposalsById.get(signalId!);
  const map = proposalsById.get(mapId!);
  const play = proposalsById.get(playId!);
  const materialBinding = signal?.evidenceBindings[0];
  if (signal?.classification !== "source_fact" || signal.lens !== "signal" ||
      signal.evidenceBindings.length !== 1 || materialBinding?.evidenceRole !== "material_change" ||
      map?.classification !== "analysis" || map.lens !== "map" ||
      !map.supportingProposalIds.includes(signal.proposalId) ||
      !map.evidenceBindings.some((binding) => binding.evidenceId === materialBinding.evidenceId) ||
      play?.classification !== "recommendation" || play.lens !== "play" ||
      !play.supportingProposalIds.includes(map.proposalId) ||
      !play.evidenceBindings.some((binding) => binding.evidenceId === materialBinding.evidenceId) ||
      question.evidenceBindingIds.length !== 1 ||
      question.evidenceBindingIds[0] !== materialBinding.evidenceId ||
      question.answer !== signal.summary) {
    refuseM5bProductReview("render_material_change_chain");
  }
  return deepFreezeOwnData({ signal, map, play });
}

/**
 * Validates detached artifact-set self-consistency only. This boundary deliberately does not
 * authenticate production provenance: callers can recompute every serialized hash. Product
 * rendering must additionally require the prepare-path object-identity pin held by that runtime.
 */
export function validateM5bProductReviewPackageArtifactSelfConsistency(
  raw: unknown,
): Readonly<M5bProductReviewAdmittedPackageArtifacts> {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "product_review_package_artifacts", PACKAGE_ARTIFACT_LIMITS);
  } catch {
    return refuseM5bProductReview("render_package_shape");
  }
  assertRenderExactKeys(snapshot, ["sourcePack", "candidate", "reviewPacket"]);
  deepFreezeOwnData(snapshot);
  const sourcePack = snapshot.sourcePack as unknown as M5bProductReviewSanitizedSourcePack;
  const packet = snapshot.reviewPacket as unknown as M5bProductReviewPacket;
  assertCurrentRenderablePackage(sourcePack, packet);
  const materialChangeChain = featuredMaterialChangeChain(packet);
  let candidate: ValidatedCandidate;
  try {
    candidate = hydrateValidatedCandidate(snapshot.candidate);
  } catch {
    return refuseM5bProductReview("render_candidate_shape");
  }
  assertCandidateBinding(sourcePack, candidate, packet);
  return deepFreezeOwnData({
    sourcePack,
    candidate,
    reviewPacket: packet,
    featuredMaterialChangeChain: materialChangeChain,
    admissionAssurance: "self_consistency_only_not_provenance_authentication" as const,
  });
}
