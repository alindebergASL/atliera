import { createHash } from "node:crypto";

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
  m5bProductReviewTextClaimsForbiddenTrust,
  m5bProductReviewTextRequestsEffect,
  m5bProductReviewCanonicalSha256,
  refuseM5bProductReview,
} from "./m5b-product-review-contract.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/&/gu, "&amp;")
    .replace(/([\\`*_[\]{}<>#|])/gu, "\\$1")
    .replace(/\s+/gu, " ")
    .trim();
}

function displayCurrency(value: string | null): string {
  return value === null ? "Not supplied" : value;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function lensLabel(value: "signal" | "map" | "play"): string {
  return value === "signal" ? "Signal" : value === "map" ? "Map" : "Play";
}

function classificationLabel(value: "source_fact" | "analysis" | "recommendation"): string {
  return value === "source_fact" ? "Source fact" : value === "analysis" ? "Analysis" : "Recommendation";
}

function evidenceRoleLabel(value: "account_identity" | "account_context" | "material_change"): string {
  switch (value) {
    case "account_identity": return "Account identity";
    case "account_context": return "Account context";
    case "material_change": return "Material change";
    default: return refuseM5bProductReview("render_evidence_role");
  }
}

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

function assertCurrentRenderablePackage(
  sourcePack: M5bProductReviewSanitizedSourcePack,
  packet: M5bProductReviewPacket,
): void {
  // Snapshot validation runs before any property access, rejecting accessors, Proxies, exotic objects,
  // symbols, excessive structures, and other non-JSON runtime inputs.
  m5bProductReviewCanonicalSha256(sourcePack);
  m5bProductReviewCanonicalSha256(packet);
  assertRenderExactKeys(sourcePack, ["kind", "schemaVersion", "packageBinding", "subject", "authority",
    "supersession", "effectBoundary", "contentPolicy", "sources", "sourcePackSha256"]);
  assertRenderExactKeys(packet, ["kind", "schemaVersion", "packageBinding", "subject", "sourcePackSha256",
    "candidateSha256", "authority", "effectBoundary", "reviewBoundary", "customerQuestions", "lenses",
    "sourceRegister", "proposals", "reviewPacketSha256"]);
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
    "executionCommit", "executionTree"]);
  const binding = sourcePack.packageBinding;
  if (typeof binding.packageId !== "string" || !SAFE_PACKAGE_ID.test(binding.packageId) ||
      typeof binding.requestRawSha256 !== "string" || !SHA256.test(binding.requestRawSha256) ||
      typeof binding.requestCanonicalSha256 !== "string" || !SHA256.test(binding.requestCanonicalSha256) ||
      typeof binding.supersededPackageResultSha256 !== "string" ||
        !SHA256.test(binding.supersededPackageResultSha256) ||
      typeof binding.ownerAuthorizationId !== "string" ||
        !SAFE_AUTHORITY_ID.test(binding.ownerAuthorizationId) ||
      typeof binding.executionCommit !== "string" || !GIT_OID.test(binding.executionCommit) ||
      typeof binding.executionTree !== "string" || !GIT_OID.test(binding.executionTree)) {
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
        assertM5bProductReviewMaterialChangeQuote(sourcePack.subject.accountName, evidence.exactQuote);
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
        proposal.caveats.some(m5bProductReviewTextClaimsForbiddenTrust)) {
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
        !dependencies.some((dependency) => dependency.classification === "analysis") ||
        m5bProductReviewTextRequestsEffect(proposal.title) ||
        m5bProductReviewTextRequestsEffect(proposal.summary)) {
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
    assertRenderExactKeys(item, ["question", "answer", "evidenceBindingIds"]);
    if (item.question !== M5B_PRODUCT_REVIEW_QUESTION_LABELS[index]![0] ||
        !isBoundedSingleLine(item.answer, 12, 1_200) || !isStringArray(item.evidenceBindingIds) ||
        new Set(item.evidenceBindingIds).size !== item.evidenceBindingIds.length ||
        m5bProductReviewTextClaimsForbiddenTrust(item.answer) ||
        (index === 4 && item.answer !== M5B_PRODUCT_REVIEW_SAFE_TASK_DESCRIPTION) ||
        (index === 1 ? item.evidenceBindingIds.length === 0 || item.evidenceBindingIds.some((id) =>
          evidenceById.get(id)?.evidenceRole !== "material_change") : item.evidenceBindingIds.length !== 0)) {
      refuseM5bProductReview("render_question_binding");
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

function featuredMaterialChangeChain(packet: M5bProductReviewPacket): {
  readonly signal: M5bProductReviewPacketProposal;
  readonly map: M5bProductReviewPacketProposal;
  readonly play: M5bProductReviewPacketProposal;
} {
  const proposalsById = new Map(packet.proposals.map((proposal) => [proposal.proposalId, proposal]));
  const questionEvidenceIds = new Set(packet.customerQuestions[1]!.evidenceBindingIds);
  const chainForPlay = (play: M5bProductReviewPacketProposal) => {
    const playEvidenceIds = new Set(play.evidenceBindings.map((binding) => binding.evidenceId));
    for (const mapId of play.supportingProposalIds) {
      const map = proposalsById.get(mapId);
      if (map?.classification !== "analysis" || map.lens !== "map") continue;
      const mapEvidenceIds = new Set(map.evidenceBindings.map((binding) => binding.evidenceId));
      for (const signalId of map.supportingProposalIds) {
        const signal = proposalsById.get(signalId);
        if (signal?.classification !== "source_fact" || signal.lens !== "signal") continue;
        const materialBinding = signal.evidenceBindings.find((binding) =>
          binding.evidenceRole === "material_change" && mapEvidenceIds.has(binding.evidenceId) &&
          playEvidenceIds.has(binding.evidenceId) && questionEvidenceIds.has(binding.evidenceId));
        if (materialBinding !== undefined) return { signal, map, play };
      }
    }
    return null;
  };
  let featured: ReturnType<typeof chainForPlay> = null;
  const plays = packet.proposals.filter((proposal) => proposal.classification === "recommendation");
  if (plays.length === 0) refuseM5bProductReview("render_material_change_chain");
  for (const play of plays) {
    if (play.lens !== "play") refuseM5bProductReview("render_material_change_chain");
    const chain = chainForPlay(play);
    if (chain === null) refuseM5bProductReview("render_material_change_chain");
    featured ??= chain;
  }
  return featured!;
}

function evidenceMarkdown(
  binding: M5bProductReviewEvidenceBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const source = sourcePack.sources.find((candidate) => candidate.sourceId === binding.sourceId)!;
  return [
    `- **Evidence** \`${binding.evidenceId}\` — source \`${source.sourceId}\``,
    `  - Evidence role: **${evidenceRoleLabel(binding.evidenceRole)}**`,
    `  - Source raw SHA-256: \`${source.originContentSha256}\``,
    `  - Exact excerpt SHA-256: \`${binding.exactQuoteSha256}\``,
    `  - Original source character span: \`[${binding.sourceCharStart}, ${binding.sourceCharEnd})\``,
    `  - Evidence current through: ${escapeMarkdown(displayCurrency(source.evidenceCurrentThrough))}`,
    `  - Exact source text: “${escapeMarkdown(binding.exactQuote)}”`,
  ].join("\n");
}

/** @internal Deterministic formatter for packages authenticated by prepareM5bProductReview. */
export function renderM5bProductReviewMeetingBrief(
  sourcePack: M5bProductReviewSanitizedSourcePack,
  packet: M5bProductReviewPacket,
): string {
  assertCurrentRenderablePackage(sourcePack, packet);
  featuredMaterialChangeChain(packet);
  const evidence = sourcePack.sources.flatMap((source) => source.evidenceBindings);
  const proposalLines = packet.proposals.map((proposal) => {
    const support = proposal.supportingProposalIds.length === 0
      ? "Directly attributed to exact source text; no analytical dependency."
      : `Supporting proposals: ${proposal.supportingProposalIds.map((id) => `\`${id}\``).join(", ")}.`;
    const caveats = proposal.caveats.length === 0
      ? "No analytical caveat: this source fact only attributes what the source states."
      : `Caveats: ${proposal.caveats.map(escapeMarkdown).join("; ")}`;
    const task = proposal.safeTask === null
      ? ""
      : `\n  - Safe draft task: ${escapeMarkdown(proposal.safeTask.description)} \(non\-executable\).`;
    return [
      `- **${classificationLabel(proposal.classification)} · ${lensLabel(proposal.lens)} · ${escapeMarkdown(proposal.title)}** (\`${proposal.proposalId}\`)`,
      `  - ${escapeMarkdown(proposal.summary)}`,
      `  - Evidence: ${proposal.evidenceBindings.map((binding) =>
        `\`${binding.evidenceId}\` (${evidenceRoleLabel(binding.evidenceRole)})`).join(", ")}.`,
      `  - ${support}`,
      `  - ${caveats}${task}`,
    ].join("\n");
  });

  return [
    "# DRAFT targeted meeting brief — NOT SENT / NOT RATIFIED",
    "",
    `Account: **${escapeMarkdown(packet.subject.accountName)}** (\`${escapeMarkdown(packet.subject.accountId)}\`)`,
    "",
    "> Preparation artifact only. This brief has not been sent, independently verified, quality-passed, human-ratified, armed, or made durable. It carries no write authority and no apply eligibility.",
    "",
    "## Five customer questions",
    "",
    ...packet.customerQuestions.flatMap((item, index) => [
      `### ${index + 1}. ${item.question}`,
      "",
      escapeMarkdown(item.answer),
      ...(item.evidenceBindingIds.length === 0 ? [] : [
        "",
        `Material-change evidence: ${item.evidenceBindingIds.map((id) => `\`${id}\``).join(", ")}.`,
      ]),
      "",
    ]),
    "## Proposed Signals, Maps, and Plays",
    "",
    ...proposalLines,
    "",
    "## Exact evidence register",
    "",
    ...evidence.flatMap((binding) => [evidenceMarkdown(binding, sourcePack), ""]),
    "## Package bindings",
    "",
    `- Package ID: \`${packet.packageBinding.packageId}\``,
    `- Request raw SHA-256: \`${packet.packageBinding.requestRawSha256}\``,
    `- Request canonical SHA-256: \`${packet.packageBinding.requestCanonicalSha256}\``,
    `- Sanitized source-pack SHA-256: \`${packet.sourcePackSha256}\``,
    `- Validated candidate SHA-256: \`${packet.candidateSha256}\``,
    `- Review-packet SHA-256: \`${packet.reviewPacketSha256}\``,
    `- Superseded package result SHA-256: \`${packet.packageBinding.supersededPackageResultSha256}\``,
    `- Execution commit/tree: \`${packet.packageBinding.executionCommit}\` / \`${packet.packageBinding.executionTree}\``,
    `- Owner authorization ID: \`${packet.packageBinding.ownerAuthorizationId}\``,
    "",
    "Supersession creates a new package. It preserves the old package bytes and producer identity; it does not rewrite historical provenance.",
    "",
    "## Prepare-command effect boundary",
    "",
    "Network calls 0 · provider calls 0 · acquisitions 0 · database writes 0 · graph writes 0 · deployments 0 · outbound actions 0 · apply operations 0.",
    "",
    "These counts cover this prepare command only. Separately authorized source acquisition or retained-custody reads belong in an immutable external execution receipt; they must not be added by editing these generated artifacts.",
    "",
    "Local Accept/Reject review choices, if made in the Workshop page, are local draft state only. They are not saved and are not ratification.",
    "",
  ].join("\n");
}

function evidenceHtml(
  binding: M5bProductReviewEvidenceBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const source = sourcePack.sources.find((candidate) => candidate.sourceId === binding.sourceId)!;
  return `<li class="evidence-item"><blockquote>${escapeHtml(binding.exactQuote)}</blockquote><p><strong>${escapeHtml(binding.evidenceId)}</strong> · <strong>${evidenceRoleLabel(binding.evidenceRole)}</strong> · ${escapeHtml(source.title)} · ${escapeHtml(source.publisher)}</p><p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(source.evidenceCurrentThrough))} · <strong>Acquired at:</strong> ${escapeHtml(source.acquiredAt)}</p><p>Source <code>${escapeHtml(source.sourceId)}</code> · original span <code>[${binding.sourceCharStart}, ${binding.sourceCharEnd})</code></p><p class="hash">Exact excerpt SHA-256 ${escapeHtml(binding.exactQuoteSha256)} · source raw SHA-256 ${escapeHtml(source.originContentSha256)}</p></li>`;
}

function proposalHtml(
  proposal: M5bProductReviewPacketProposal,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const dependency = proposal.supportingProposalIds.length === 0
    ? "Direct exact-source attribution; no analytical dependency."
    : `${countLabel(proposal.supportingProposalIds.length, "supporting proposal")}: ${proposal.supportingProposalIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}`;
  const caveats = proposal.caveats.length === 0
    ? "This source fact only attributes exact source text; it does not claim independent verification."
    : `<ul>${proposal.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("")}</ul>`;
  const sourceTrust = proposal.classification === "source_fact"
    ? "Source-backed · not independently verified"
    : "Evidence-informed interpretation · not independently verified";
  const safeTask = proposal.safeTask === null ? "" :
    `<div class="safe-task"><strong>Safe preparation task</strong><p>${escapeHtml(proposal.safeTask.description)}</p><span>Draft only · non-executable · no outbound action</span></div>`;
  const controlId = escapeHtml(proposal.proposalId);
  return `<article class="proposal-card ${proposal.classification}" id="proposal-${controlId}">
    <div class="card-labels"><span class="classification">${classificationLabel(proposal.classification)}</span><span class="lens">${lensLabel(proposal.lens)}</span><span class="pending">Pending</span></div>
    <h3>${escapeHtml(proposal.title)}</h3>
    <p>${escapeHtml(proposal.summary)}</p>
    <p class="trust-line">${sourceTrust} · system-created · proposed · not durable</p>
    <p class="trust-line">Not human-ratified · not quality-passed · current effective authorization: ${escapeHtml("none")}</p>
    <div class="support"><strong>Dependencies</strong><p>${dependency}</p></div>
    <div class="caveats"><strong>${proposal.caveats.length === 1 ? "Caveat" : "Caveats"}</strong>${caveats}</div>
    ${safeTask}
    <details class="evidence"><summary>${countLabel(proposal.evidenceBindings.length, "evidence binding")}</summary><ul>${proposal.evidenceBindings.map((binding) => evidenceHtml(binding, sourcePack)).join("")}</ul></details>
    <fieldset class="local-controls" aria-describedby="local-copy-${controlId}"><legend>Local draft disposition</legend><div class="choice-row"><label class="choice"><input type="radio" name="local-${controlId}" value="accept" />Accept</label><label class="choice"><input type="radio" name="local-${controlId}" value="reject" />Reject</label></div><p id="local-copy-${controlId}">Local draft only · not saved · not ratified · no write authority. This page has no submit, apply, or persist action.</p></fieldset>
  </article>`;
}

/** @internal Deterministic formatter for packages authenticated by prepareM5bProductReview. */
export function renderM5bProductReviewWorkshopHtml(
  sourcePack: M5bProductReviewSanitizedSourcePack,
  packet: M5bProductReviewPacket,
): string {
  assertCurrentRenderablePackage(sourcePack, packet);
  const { signal, map, play } = featuredMaterialChangeChain(packet);
  const questionEvidence = (item: M5bProductReviewPacket["customerQuestions"][number]) =>
    item.evidenceBindingIds.length === 0 ? "" :
      `<p class="trust-line"><strong>Material-change evidence:</strong> ${item.evidenceBindingIds
        .map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}</p>`;
  const meetingAnswers = packet.customerQuestions.map((item) => `<article class="brief-answer"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>${questionEvidence(item)}</article>`).join("");
  const meetingLens = (label: "Signal" | "Map" | "Play", proposal: M5bProductReviewPacketProposal) => {
    const caveats = proposal.caveats.length === 0 ? "" :
      `<p><strong>Needs attention:</strong> ${proposal.caveats.map(escapeHtml).join(" ")}</p>`;
    const safeTask = proposal.safeTask === null ? "" :
      `<p><strong>Safe next task:</strong> ${escapeHtml(proposal.safeTask.description)}</p>`;
    return `<article class="brief-lens"><div class="card-labels"><span class="lens">${label}</span><span class="classification">${classificationLabel(proposal.classification)}</span></div><h3>${escapeHtml(proposal.title)}</h3><p>${escapeHtml(proposal.summary)}</p>${caveats}${safeTask}<p class="trust-line">Proposed · not independently verified · not human-ratified · not durable</p></article>`;
  };
  const custody = sourcePack.sources.map((source) => `<article class="source-card">
    <h3>${escapeHtml(source.title)}</h3>
    <p><code>${escapeHtml(source.sourceId)}</code> · ${escapeHtml(source.publisher)} · ${escapeHtml(source.sourceType)}</p>
    <p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(source.evidenceCurrentThrough))}</p>
    <p><strong>Acquired at:</strong> ${escapeHtml(source.acquiredAt)} · <strong>Source kind:</strong> ${escapeHtml(source.sourceKind)} · <strong>Encoding:</strong> ${escapeHtml(source.contentEncoding)}</p>
    <p><strong>Canonical HTTPS source:</strong> <span class="source-url">${escapeHtml(source.canonicalUrl)}</span></p>
    <p class="hash">Outer/origin ${escapeHtml(source.originContentSha256)}<br />Decoded ${escapeHtml(source.decodedContentSha256)} (${source.decodedByteSize} bytes)<br />Stored excerpts ${escapeHtml(source.storedContentSha256)}<br />Transformation ${escapeHtml(source.transformationManifestSha256)}</p>
  </article>`).join("");
  const questions = packet.customerQuestions.map((item) => `<article class="question-card"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>${questionEvidence(item)}</article>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><link rel="icon" href="data:," />
<title>Atliera draft product review — ${escapeHtml(packet.subject.accountName)}</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18201c;background:#f4f3ed;line-height:1.5}
html,body{max-width:100%;overflow-x:hidden}*,:before,:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#dbe9dd 0,transparent 32rem),#f4f3ed;color:#18201c}
a{color:#174d37;text-underline-offset:3px}a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #d37232;outline-offset:3px}
main{width:min(100%,1120px);min-width:0;margin:0 auto;padding:24px;overflow-wrap:anywhere}.boundary{min-width:0;border:1px solid #b56832;background:#fff4e6;border-radius:14px;padding:12px 16px;font-weight:700}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;color:#35634e;margin:22px 0 4px}h1{font-size:clamp(2rem,5vw,4.5rem);line-height:1.02;margin:.1em 0;max-width:15ch}h2{font-size:clamp(1.45rem,3vw,2.2rem);line-height:1.15}h3{line-height:1.25}.lede{font-size:1.12rem;max-width:68ch}.primary-action{display:inline-flex;align-items:center;justify-content:center;min-height:48px;max-width:100%;padding:11px 18px;border-radius:999px;background:#174d37;color:white;font-weight:800;text-decoration:none;margin:8px 0 18px}.signal-spotlight{min-width:0;border-left:8px solid #d37232;border-radius:16px;padding:17px 20px;background:#203f31;color:#f8fff9;box-shadow:0 12px 28px #18372628}.signal-spotlight p{font-size:1.08rem}.signal-spotlight .tag{color:#ffd9ad;text-transform:uppercase;letter-spacing:.1em;font-weight:800;font-size:.76rem}
section{min-width:0;margin:32px 0}.question-grid,.proposal-grid,.source-grid,.brief-answer-grid,.brief-lens-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.question-grid>*,.proposal-grid>*,.source-grid>*,.brief-answer-grid>*,.brief-lens-grid>*{min-width:0}.question-card,.proposal-card,.source-card,.brief-answer,.brief-lens,.trust-key{min-width:0;background:#fff;border:1px solid #cdd4ca;border-radius:16px;padding:18px}.question-card h3,.brief-answer h3{font-size:1rem;color:#35634e}.proposal-card{display:flex;flex-direction:column;gap:8px;border-top:6px solid #7a8f7e}.proposal-card.source_fact{border-top-color:#39795b}.proposal-card.analysis{border-top-color:#6671a8}.proposal-card.recommendation{border-top-color:#d37232}.card-labels{display:flex;flex-wrap:wrap;gap:7px}.card-labels span{border-radius:999px;padding:4px 9px;font-size:.76rem;font-weight:800}.classification{background:#e6efe7}.lens{background:#e9e7f5}.pending{background:#fff0dd}.trust-line{color:#46554d;font-size:.9rem}.support,.caveats,.safe-task{min-width:0;background:#f5f6f1;border-radius:10px;padding:12px}.safe-task{border:1px solid #d37232;background:#fff8ee}.safe-task span{font-size:.88rem;font-weight:700}.evidence{min-width:0}.support strong,.caveats strong,.safe-task strong{display:block;margin-bottom:8px}.evidence summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:800}.evidence ul{padding-left:20px}.evidence-item{min-width:0}.evidence-item blockquote{margin:10px 0;padding-left:12px;border-left:3px solid #9aa99d}.hash,.source-url,code{overflow-wrap:anywhere;word-break:break-word}.hash,.source-url{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.76rem;color:#536059}.local-controls{min-width:0;border:1px solid #829186;border-radius:12px;padding:12px;margin-top:auto}.local-controls legend{font-weight:800}.choice-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.choice{min-width:0;min-height:44px;display:flex;align-items:center;gap:10px;border:1px solid #8b978f;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}.choice input{width:22px;height:22px;flex:0 0 auto}.local-controls p{font-size:.84rem;margin-bottom:0}.trust-key ul{padding-left:20px}#draft-meeting-brief{border:2px solid #39795b;border-radius:18px;background:#edf5ed;padding:20px}.brief-account{font-size:1.08rem}.brief-answer-grid{margin:16px 0}.brief-answer:last-child{grid-column:1/-1}.brief-lens-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.brief-lens{border-top:6px solid #39795b}.brief-lens:nth-child(2){border-top-color:#6671a8}.brief-lens:nth-child(3){border-top-color:#d37232}.source-details{border-top:1px solid #b8c0b7;padding-top:24px}.source-details>summary{min-height:44px;cursor:pointer;font-weight:800;font-size:1.25rem}.zero-effect{background:#182c23;color:#edf9f0;border-radius:14px;padding:16px}.package-binding{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;overflow-wrap:anywhere}.footer-note{font-weight:800;color:#824919}
@media(max-width:720px){main{padding:14px 12px}.question-grid,.proposal-grid,.source-grid,.brief-answer-grid,.brief-lens-grid{grid-template-columns:minmax(0,1fr)}.brief-answer:last-child{grid-column:auto}section{margin:24px 0}.boundary{font-size:.88rem}h1{font-size:2.35rem}.signal-spotlight{padding:14px 15px}.proposal-card,.question-card,.source-card,.brief-answer,.brief-lens{padding:15px}#draft-meeting-brief{padding:15px}}
@media(max-width:420px){.choice-row{grid-template-columns:minmax(0,1fr)}.primary-action{width:100%}}
</style></head><body><main>
<div class="boundary">DRAFT · NOT SENT · NOT RATIFIED · UNARMED · no apply eligibility · current effective authorization: ${escapeHtml(packet.authority.currentEffectiveAuthorization)}</div>
<p class="eyebrow">Product-first account preparation</p><h1>${escapeHtml(packet.subject.accountName)}</h1>
<p class="lede">A source-bound draft for human review. Customer meaning comes first; custody detail follows after the proposed work.</p>
<a class="primary-action" href="#draft-meeting-brief">Review the draft meeting brief</a>
<section class="signal-spotlight" aria-labelledby="early-signal"><span class="tag">Signal · ${classificationLabel(signal.classification)}</span><h2 id="early-signal">${escapeHtml(signal.title)}</h2><p>${escapeHtml(signal.summary)}</p><small>Proposed · source-bound · not independently verified</small></section>
<section aria-labelledby="customer-questions"><p class="eyebrow">Customer meaning</p><h2 id="customer-questions">Five questions for this account</h2><div class="question-grid">${questions}</div></section>
<section class="trust-key" aria-labelledby="trust-key"><h2 id="trust-key">Read the trust labels literally</h2><ul><li><strong>Source-backed</strong> means exact text was found in one pinned source; it does not mean independently verified.</li><li><strong>Human-ratified</strong> and <strong>quality-passed</strong> are different checks; neither has happened.</li><li><strong>Proposed</strong> is not <strong>durable</strong>; this package performs zero graph or database writes.</li><li>Source facts, analysis, and recommendations remain visibly separate below.</li></ul></section>
<section aria-labelledby="proposal-review"><p class="eyebrow">Individual review</p><h2 id="proposal-review">${countLabel(packet.proposals.length, "pending proposal")}</h2><p>Accept or Reject is a truthful local-only draft control for each item. Nothing is submitted, saved, applied, persisted, or ratified.</p><div class="proposal-grid">${packet.proposals.map((proposal) => proposalHtml(proposal, sourcePack)).join("")}</div></section>
<section id="draft-meeting-brief" aria-labelledby="meeting-heading"><p class="eyebrow">Account-specific brief · readable here</p><h2 id="meeting-heading">Draft meeting brief — ${escapeHtml(packet.subject.accountName)}</h2><p class="brief-account"><strong>Account:</strong> ${escapeHtml(packet.subject.accountName)} · <code>${escapeHtml(packet.subject.accountId)}</code></p><p>DRAFT · NOT SENT · NOT RATIFIED. This inline preparation artifact is editable only by changing and revalidating the source package; it is non-executable, not independently verified, not applied, and not durable. Current effective authorization: ${escapeHtml(packet.authority.currentEffectiveAuthorization)}; apply eligibility: ${String(packet.authority.applyEligibility)}.</p><div class="brief-answer-grid">${meetingAnswers}</div><h3>Meeting prompts from proposed Signal, Map, and Play</h3><div class="brief-lens-grid">${meetingLens("Signal", signal)}${meetingLens("Map", map)}${meetingLens("Play", play)}</div><p class="footer-note">Review internally before use · no send, submit, save, ratify, or apply action exists here.</p></section>
<details class="source-details"><summary>Evidence currency, source custody, and package hashes</summary><section aria-labelledby="source-register"><h2 id="source-register">${countLabel(sourcePack.sources.length, "admitted source")}</h2><p>Only bounded exact excerpts are in this package. Full source bytes are not embedded.</p><div class="source-grid">${custody}</div></section><section><h2>Cross-package bindings</h2><p class="package-binding">Package ${escapeHtml(packet.packageBinding.packageId)}<br />Request raw ${escapeHtml(packet.packageBinding.requestRawSha256)}<br />Request canonical ${escapeHtml(packet.packageBinding.requestCanonicalSha256)}<br />Source pack ${escapeHtml(packet.sourcePackSha256)}<br />Candidate ${escapeHtml(packet.candidateSha256)}<br />Review packet ${escapeHtml(packet.reviewPacketSha256)}<br />Superseded result ${escapeHtml(packet.packageBinding.supersededPackageResultSha256)}<br />Execution ${escapeHtml(packet.packageBinding.executionCommit)} / ${escapeHtml(packet.packageBinding.executionTree)}<br />Owner authorization ${escapeHtml(packet.packageBinding.ownerAuthorizationId)}</p><p>Supersession preserves the old bytes and producer identity. It does not rewrite the historical package.</p></section></details>
<section class="zero-effect"><strong>Prepare-command effect boundary</strong><br />Acquisitions 0 · network calls 0 · provider calls 0 · database writes 0 · graph writes 0 · deployments 0 · outbound actions 0 · apply operations 0.<p>These counts cover this prepare command only. Separately authorized source acquisition or retained-custody reads belong in an immutable external execution receipt; generated package files must remain unchanged.</p></section>
<p class="footer-note">Local draft only · not saved · not ratified · no write authority.</p>
</main></body></html>\n`;
}
