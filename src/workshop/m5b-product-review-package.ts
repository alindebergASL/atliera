import { createHash } from "node:crypto";

import { validatedCandidateSha256 } from "../graph/candidate-delta.ts";
import type { GraphBundle } from "../graph/types.ts";
import {
  createValidatedCandidate,
  type ValidatedCandidate,
} from "../graph/validated-candidate.ts";
import { assertProposalDerivedRecordsUnverified } from "../validation/proposal-materialization.ts";
import {
  M5B_PRODUCT_REVIEW_LIMITS,
  m5bProductReviewCanonicalSha256,
  refuseM5bProductReview,
  validateM5bProductReviewRequest,
  type M5bProductReviewAuthority,
  type M5bProductReviewClassification,
  type M5bProductReviewEvidenceRole,
  type M5bProductReviewLens,
  type M5bProductReviewRequest,
  type M5bProductReviewSafeTask,
  type M5bProductReviewSourceKind,
  type M5bProductReviewSubject,
} from "./m5b-product-review-contract.ts";

export const M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND = "m5b-product-review-sanitized-source-pack" as const;
export const M5B_PRODUCT_REVIEW_PACKET_KIND = "m5b-product-review-packet" as const;
export const M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION = "2" as const;
export const M5B_PRODUCT_REVIEW_PACKET_VERSION = "2" as const;
export const M5B_PRODUCT_REVIEW_TRANSFORMATION_VERSION = "2" as const;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const SAFE_PROVENANCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const SOURCE_ID = /^src_[a-z0-9][a-z0-9_-]{0,51}$/;
const PROVENANCE_KEYS = Object.freeze([
  "classification", "exactUrl", "responseByteSize", "responseSha256", "outerCustodySha256",
  "targetPolicySha256", "capabilityId", "adapterId", "adapterSha256", "authorityId", "consumptionId",
  "implementationCommit", "implementationTree", "acquisitionConsumptionSha256",
  "retainedReadAuthorityId", "retainedReadConsumptionId", "retainedReadImplementationCommit",
  "retainedReadImplementationTree", "retainedReadLedgerNamespaceSha256", "retainedReadLedgerRecordSha256",
] as const);

export const M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY = Object.freeze({
  acquisitions: 0,
  networkCalls: 0,
  providerCalls: 0,
  databaseWrites: 0,
  graphWrites: 0,
  deployments: 0,
  outboundActions: 0,
  applyOperations: 0,
});

export interface M5bProductReviewAdmittedSource {
  readonly sourceId: string;
  readonly text: string;
  readonly decodedByteSize: number;
  readonly decodedSha256: string;
  readonly provenance?: M5bProductReviewSourceProvenance;
}

export type M5bProductReviewSourceProvenance =
  | {
      readonly classification: "explicit_synthetic_fixture";
      readonly exactUrl: string;
      readonly responseByteSize: number;
      readonly responseSha256: string;
      readonly outerCustodySha256: string;
      readonly targetPolicySha256: null;
      readonly capabilityId: null;
      readonly adapterId: null;
      readonly adapterSha256: null;
      readonly authorityId: null;
      readonly consumptionId: null;
      readonly implementationCommit: null;
      readonly implementationTree: null;
      readonly acquisitionConsumptionSha256: null;
      readonly retainedReadAuthorityId: null;
      readonly retainedReadConsumptionId: null;
      readonly retainedReadImplementationCommit: null;
      readonly retainedReadImplementationTree: null;
      readonly retainedReadLedgerNamespaceSha256: null;
      readonly retainedReadLedgerRecordSha256: null;
    }
  | {
      readonly classification: "validated_exact_public_acquisition_custody";
      readonly exactUrl: string;
      readonly responseByteSize: number;
      readonly responseSha256: string;
      readonly outerCustodySha256: string;
      readonly targetPolicySha256: string;
      readonly capabilityId: string;
      readonly adapterId: string;
      readonly adapterSha256: string;
      readonly authorityId: string;
      readonly consumptionId: string;
      readonly implementationCommit: string;
      readonly implementationTree: string | null;
      readonly acquisitionConsumptionSha256: string;
      readonly retainedReadAuthorityId: string | null;
      readonly retainedReadConsumptionId: string | null;
      readonly retainedReadImplementationCommit: string | null;
      readonly retainedReadImplementationTree: string | null;
      readonly retainedReadLedgerNamespaceSha256: string | null;
      readonly retainedReadLedgerRecordSha256: string | null;
    };

export interface M5bProductReviewPackageBinding {
  readonly packageId: string;
  readonly requestRawSha256: string;
  readonly requestCanonicalSha256: string;
  readonly supersededPackageResultSha256: string;
  readonly ownerAuthorizationId: string;
  readonly executionCommit: string;
  readonly executionTree: string;
}

export interface M5bProductReviewEvidenceBinding {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly exactQuote: string;
  readonly evidenceRole: M5bProductReviewEvidenceRole;
  readonly exactQuoteSha256: string;
  readonly sourceCharStart: number;
  readonly sourceCharEnd: number;
  readonly storedCharStart: number;
  readonly storedCharEnd: number;
}

export interface M5bProductReviewSanitizedSource {
  readonly sourceId: string;
  readonly title: string;
  readonly sourceKind: M5bProductReviewSourceKind;
  readonly contentEncoding: M5bProductReviewRequest["sources"][number]["contentEncoding"];
  readonly canonicalUrl: string;
  readonly acquiredAt: string;
  readonly evidenceCurrentThrough: string | null;
  readonly publisher: string;
  readonly sourceType: string;
  readonly rawByteSize: number;
  readonly originContentSha256: string;
  readonly decodedByteSize: number;
  readonly decodedContentSha256: string;
  readonly storedContentSha256: string;
  readonly transformationManifestSha256: string;
  readonly provenance: M5bProductReviewSourceProvenance;
  readonly evidenceBindings: readonly M5bProductReviewEvidenceBinding[];
}

export interface M5bProductReviewSanitizedSourcePackContent {
  readonly kind: typeof M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND;
  readonly schemaVersion: typeof M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION;
  readonly packageBinding: M5bProductReviewPackageBinding;
  readonly subject: M5bProductReviewSubject;
  readonly authority: M5bProductReviewAuthority;
  readonly supersession: {
    readonly preservesOldBytes: true;
    readonly preservesOldProducerIdentity: true;
    readonly rewritesHistoricalPackage: false;
  };
  readonly effectBoundary: typeof M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY;
  readonly contentPolicy: {
    readonly fullSourceBytesEmbedded: false;
    readonly boundedExactExcerptsOnly: true;
  };
  readonly sources: readonly M5bProductReviewSanitizedSource[];
}

export interface M5bProductReviewSanitizedSourcePack
  extends M5bProductReviewSanitizedSourcePackContent {
  readonly sourcePackSha256: string;
}

export interface M5bProductReviewQuestionAnswer {
  readonly question: string;
  readonly answer: string;
  readonly evidenceBindingIds: readonly string[];
}

export interface M5bProductReviewPacketProposal {
  readonly proposalId: string;
  readonly status: "pending";
  readonly classification: M5bProductReviewClassification;
  readonly lens: M5bProductReviewLens;
  readonly title: string;
  readonly summary: string;
  readonly allowedLocalDispositions: readonly ["accept", "reject"];
  readonly evidenceBindings: readonly M5bProductReviewEvidenceBinding[];
  readonly supportingProposalIds: readonly string[];
  readonly caveats: readonly string[];
  readonly safeTask: (M5bProductReviewSafeTask & { readonly nonExecutable: true }) | null;
  readonly trust: {
    readonly sourceBacked: boolean;
    readonly independentlyVerified: false;
    readonly humanRatified: false;
    readonly qualityPassed: false;
    readonly proposed: true;
    readonly durable: false;
    readonly createdBy: "system";
  };
}

export interface M5bProductReviewPacketContent {
  readonly kind: typeof M5B_PRODUCT_REVIEW_PACKET_KIND;
  readonly schemaVersion: typeof M5B_PRODUCT_REVIEW_PACKET_VERSION;
  readonly packageBinding: M5bProductReviewPackageBinding;
  readonly subject: M5bProductReviewSubject;
  readonly sourcePackSha256: string;
  readonly candidateSha256: string;
  readonly authority: M5bProductReviewAuthority;
  readonly effectBoundary: typeof M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY;
  readonly reviewBoundary: {
    readonly localSelectionsOnly: true;
    readonly selectionsSaved: false;
    readonly selectionsAreRatification: false;
    readonly writeAuthority: "none";
  };
  readonly customerQuestions: readonly M5bProductReviewQuestionAnswer[];
  readonly lenses: readonly {
    readonly lens: M5bProductReviewLens;
    readonly proposalIds: readonly string[];
  }[];
  readonly sourceRegister: readonly {
    readonly sourceId: string;
    readonly title: string;
    readonly canonicalUrl: string;
    readonly contentEncoding: M5bProductReviewRequest["sources"][number]["contentEncoding"];
    readonly originContentSha256: string;
    readonly decodedByteSize: number;
    readonly decodedContentSha256: string;
    readonly storedContentSha256: string;
    readonly transformationManifestSha256: string;
    readonly provenance: M5bProductReviewSourceProvenance;
    readonly evidenceCurrentThrough: string | null;
  }[];
  readonly proposals: readonly M5bProductReviewPacketProposal[];
}

export interface M5bProductReviewPacket extends M5bProductReviewPacketContent {
  readonly reviewPacketSha256: string;
}

export interface M5bProductReviewPackageData {
  readonly packageBinding: M5bProductReviewPackageBinding;
  readonly sourcePack: M5bProductReviewSanitizedSourcePack;
  readonly candidate: ValidatedCandidate;
  readonly candidateSha256: string;
  readonly reviewPacket: M5bProductReviewPacket;
}

interface TransformedSource {
  readonly source: M5bProductReviewSanitizedSource;
  readonly storedText: string;
}

function assertPackageExactKeys(value: unknown, expected: readonly string[], code: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) refuseM5bProductReview(code);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    refuseM5bProductReview(code);
  }
}

function assertAdmittedSourcesShape(admitted: readonly M5bProductReviewAdmittedSource[]): void {
  // Canonical snapshot rejects Proxies, accessors, exotic prototypes, symbols, cycles, and oversized JSON
  // before this exported builder reads any caller-supplied field.
  m5bProductReviewCanonicalSha256(admitted);
  if (!Array.isArray(admitted) || admitted.length < M5B_PRODUCT_REVIEW_LIMITS.sourceCountMin ||
      admitted.length > M5B_PRODUCT_REVIEW_LIMITS.sourceCountMax) {
    refuseM5bProductReview("admitted_sources");
  }
  for (const source of admitted) {
    if (source === null || typeof source !== "object" || Array.isArray(source) ||
        Object.getPrototypeOf(source) !== Object.prototype) {
      refuseM5bProductReview("admitted_source_shape");
    }
    assertPackageExactKeys(source, Object.hasOwn(source, "provenance")
      ? ["sourceId", "text", "decodedByteSize", "decodedSha256", "provenance"]
      : ["sourceId", "text", "decodedByteSize", "decodedSha256"],
    "admitted_source_shape");
    if (typeof source.sourceId !== "string" || !SOURCE_ID.test(source.sourceId) ||
        typeof source.text !== "string" || Buffer.byteLength(source.text, "utf8") <= 0 ||
        Buffer.byteLength(source.text, "utf8") > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
        !Number.isSafeInteger(source.decodedByteSize) || source.decodedByteSize <= 0 ||
        source.decodedByteSize > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
        typeof source.decodedSha256 !== "string" || !SHA256.test(source.decodedSha256)) {
      refuseM5bProductReview("admitted_source_shape");
    }
    if (source.provenance !== undefined) {
      assertPackageExactKeys(source.provenance, PROVENANCE_KEYS, "source_provenance_shape");
    }
  }
}

function resolvedProvenance(
  sourceRequest: M5bProductReviewRequest["sources"][number],
  admittedSource: M5bProductReviewAdmittedSource,
): M5bProductReviewSourceProvenance {
  const provenance = admittedSource.provenance ?? (sourceRequest.sourceKind === "synthetic_fixture"
    ? Object.freeze({
        classification: "explicit_synthetic_fixture" as const,
        exactUrl: sourceRequest.canonicalUrl,
        responseByteSize: sourceRequest.decodedByteSize,
        responseSha256: sourceRequest.decodedSha256,
        outerCustodySha256: sourceRequest.rawSha256,
        targetPolicySha256: null,
        capabilityId: null,
        adapterId: null,
        adapterSha256: null,
        authorityId: null,
        consumptionId: null,
        implementationCommit: null,
        implementationTree: null,
        acquisitionConsumptionSha256: null,
        retainedReadAuthorityId: null,
        retainedReadConsumptionId: null,
        retainedReadImplementationCommit: null,
        retainedReadImplementationTree: null,
        retainedReadLedgerNamespaceSha256: null,
        retainedReadLedgerRecordSha256: null,
      })
    : refuseM5bProductReview("production_source_provenance"));
  if (provenance.exactUrl !== sourceRequest.canonicalUrl ||
      provenance.responseByteSize !== sourceRequest.decodedByteSize ||
      provenance.responseSha256 !== sourceRequest.decodedSha256 ||
      provenance.outerCustodySha256 !== sourceRequest.rawSha256 ||
      !SHA256.test(provenance.responseSha256) || !SHA256.test(provenance.outerCustodySha256)) {
    refuseM5bProductReview("source_provenance_binding");
  }
  if (sourceRequest.sourceKind === "synthetic_fixture") {
    if (provenance.classification !== "explicit_synthetic_fixture" ||
        [provenance.targetPolicySha256, provenance.capabilityId, provenance.adapterId,
          provenance.adapterSha256, provenance.authorityId, provenance.consumptionId,
          provenance.implementationCommit, provenance.implementationTree,
          provenance.acquisitionConsumptionSha256, provenance.retainedReadAuthorityId,
          provenance.retainedReadConsumptionId, provenance.retainedReadImplementationCommit,
          provenance.retainedReadImplementationTree, provenance.retainedReadLedgerNamespaceSha256,
          provenance.retainedReadLedgerRecordSha256].some((value) => value !== null)) {
      refuseM5bProductReview("source_provenance_classification");
    }
  } else if (provenance.classification !== "validated_exact_public_acquisition_custody" ||
      typeof provenance.targetPolicySha256 !== "string" || !SHA256.test(provenance.targetPolicySha256) ||
      typeof provenance.adapterSha256 !== "string" || !SHA256.test(provenance.adapterSha256) ||
      typeof provenance.acquisitionConsumptionSha256 !== "string" ||
        !SHA256.test(provenance.acquisitionConsumptionSha256) ||
      typeof provenance.implementationCommit !== "string" || !GIT_OID.test(provenance.implementationCommit) ||
      (provenance.implementationTree !== null && (typeof provenance.implementationTree !== "string" ||
        !GIT_OID.test(provenance.implementationTree))) ||
      typeof provenance.capabilityId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.capabilityId) ||
      typeof provenance.adapterId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.adapterId) ||
      typeof provenance.authorityId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.authorityId) ||
      typeof provenance.consumptionId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.consumptionId)) {
    refuseM5bProductReview("production_source_provenance");
  }
  if (sourceRequest.sourceKind !== "synthetic_fixture" &&
      provenance.classification === "validated_exact_public_acquisition_custody") {
    const retainedReadFields = [
      provenance.retainedReadAuthorityId,
      provenance.retainedReadConsumptionId,
      provenance.retainedReadImplementationCommit,
      provenance.retainedReadImplementationTree,
      provenance.retainedReadLedgerNamespaceSha256,
      provenance.retainedReadLedgerRecordSha256,
    ];
    if (sourceRequest.contentEncoding === "m4_public_http_fetch_custody_v1") {
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
        refuseM5bProductReview("production_source_provenance");
      }
    } else if (retainedReadFields.some((value) => value !== null)) {
      refuseM5bProductReview("production_source_provenance");
    }
  }
  return Object.freeze({ ...provenance }) as M5bProductReviewSourceProvenance;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function countExactOccurrences(text: string, quote: string): number {
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length - quote.length) {
    const next = text.indexOf(quote, cursor);
    if (next === -1) break;
    count += 1;
    cursor = next + 1;
  }
  return count;
}

function makePackageBinding(
  request: M5bProductReviewRequest,
  requestRawSha256: string,
): M5bProductReviewPackageBinding {
  const requestCanonicalSha256 = m5bProductReviewCanonicalSha256(request);
  const seed = {
    kind: "m5b-product-review-package-binding",
    requestRawSha256,
    requestCanonicalSha256,
    supersededPackageResultSha256: request.supersession.supersededPackageResultSha256,
    ownerAuthorizationId: request.authority.ownerAuthorizationId,
    executionCommit: request.execution.commit,
    executionTree: request.execution.tree,
  };
  return Object.freeze({
    packageId: `m5b-product-review-${m5bProductReviewCanonicalSha256(seed).slice(0, 24)}`,
    requestRawSha256,
    requestCanonicalSha256,
    supersededPackageResultSha256: request.supersession.supersededPackageResultSha256,
    ownerAuthorizationId: request.authority.ownerAuthorizationId,
    executionCommit: request.execution.commit,
    executionTree: request.execution.tree,
  });
}

function transformSources(
  request: M5bProductReviewRequest,
  admitted: readonly M5bProductReviewAdmittedSource[],
): readonly TransformedSource[] {
  const admittedById = new Map(admitted.map((source) => [source.sourceId, source]));
  if (admittedById.size !== admitted.length || admitted.length !== request.sources.length) {
    refuseM5bProductReview("admitted_sources");
  }

  const resolved = new Map<string, Omit<M5bProductReviewEvidenceBinding, "storedCharStart" | "storedCharEnd">>();
  for (const binding of request.evidenceBindings) {
    const expectedSource = admittedById.get(binding.sourceId)?.text;
    if (expectedSource === undefined) refuseM5bProductReview("evidence_source");
    let admittedOccurrences = 0;
    for (const source of admittedById.values()) {
      admittedOccurrences += countExactOccurrences(source.text, binding.exactQuote);
    }
    const sourceCharStart = expectedSource.indexOf(binding.exactQuote);
    if (admittedOccurrences !== 1 || sourceCharStart < 0) {
      refuseM5bProductReview(admittedOccurrences === 0 ? "evidence_not_found" : "evidence_ambiguous");
    }
    resolved.set(binding.evidenceId, {
      evidenceId: binding.evidenceId,
      sourceId: binding.sourceId,
      exactQuote: binding.exactQuote,
      evidenceRole: binding.evidenceRole,
      exactQuoteSha256: sha256(Buffer.from(binding.exactQuote, "utf8")),
      sourceCharStart,
      sourceCharEnd: sourceCharStart + binding.exactQuote.length,
    });
  }

  return request.sources.map((sourceRequest) => {
    const admittedSource = admittedById.get(sourceRequest.sourceId);
    if (admittedSource === undefined) refuseM5bProductReview("admitted_source_identity_mismatch");
    const admittedText = admittedSource.text;
    if (admittedSource.decodedByteSize !== sourceRequest.decodedByteSize ||
        admittedSource.decodedSha256 !== sourceRequest.decodedSha256 ||
        Buffer.byteLength(admittedText, "utf8") !== sourceRequest.decodedByteSize ||
        sha256(Buffer.from(admittedText, "utf8")) !== sourceRequest.decodedSha256) {
      refuseM5bProductReview("admitted_source_identity_mismatch");
    }
    const provenance = resolvedProvenance(sourceRequest, admittedSource);
    const sourceEvidence = request.evidenceBindings
      .filter((binding) => binding.sourceId === sourceRequest.sourceId)
      .map((binding) => resolved.get(binding.evidenceId)!);
    let storedText = "";
    const evidenceBindings: M5bProductReviewEvidenceBinding[] = [];
    for (const evidence of sourceEvidence) {
      if (storedText.length > 0) storedText += "\n\n";
      const storedCharStart = storedText.length;
      storedText += evidence.exactQuote;
      evidenceBindings.push(Object.freeze({
        ...evidence,
        storedCharStart,
        storedCharEnd: storedText.length,
      }));
    }
    const excerptOriginBytes = sourceEvidence.reduce(
      (total, evidence) => total + Buffer.byteLength(evidence.exactQuote, "utf8"),
      0,
    );
    if (excerptOriginBytes >= sourceRequest.decodedByteSize) {
      refuseM5bProductReview("full_source_embedding");
    }
    const storedContentSha256 = sha256(Buffer.from(storedText, "utf8"));
    const transformationManifestSha256 = m5bProductReviewCanonicalSha256({
      kind: "m5b-product-review-bounded-excerpt-transformation",
      schemaVersion: M5B_PRODUCT_REVIEW_TRANSFORMATION_VERSION,
      sourceId: sourceRequest.sourceId,
      originContentSha256: sourceRequest.rawSha256,
      decodedContentSha256: sourceRequest.decodedSha256,
      storedContentSha256,
      fullSourceBytesEmbedded: false,
      sourceProvenance: provenance,
      evidenceBindings: evidenceBindings.map((binding) => ({
        evidenceId: binding.evidenceId,
        evidenceRole: binding.evidenceRole,
        exactQuoteSha256: binding.exactQuoteSha256,
        sourceCharStart: binding.sourceCharStart,
        sourceCharEnd: binding.sourceCharEnd,
        storedCharStart: binding.storedCharStart,
        storedCharEnd: binding.storedCharEnd,
      })),
    });
    return Object.freeze({
      storedText,
      source: Object.freeze({
        sourceId: sourceRequest.sourceId,
        title: sourceRequest.title,
        sourceKind: sourceRequest.sourceKind,
        contentEncoding: sourceRequest.contentEncoding,
        canonicalUrl: sourceRequest.canonicalUrl,
        acquiredAt: sourceRequest.acquiredAt,
        evidenceCurrentThrough: sourceRequest.evidenceCurrentThrough,
        publisher: sourceRequest.publisher,
        sourceType: sourceRequest.sourceType,
        rawByteSize: sourceRequest.expectedByteSize,
        originContentSha256: sourceRequest.rawSha256,
        decodedByteSize: sourceRequest.decodedByteSize,
        decodedContentSha256: sourceRequest.decodedSha256,
        storedContentSha256,
        transformationManifestSha256,
        provenance,
        evidenceBindings: Object.freeze(evidenceBindings),
      }),
    });
  });
}

function buildSourcePack(
  request: M5bProductReviewRequest,
  packageBinding: M5bProductReviewPackageBinding,
  transformed: readonly TransformedSource[],
): M5bProductReviewSanitizedSourcePack {
  const content: M5bProductReviewSanitizedSourcePackContent = Object.freeze({
    kind: M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION,
    packageBinding,
    subject: request.subject,
    authority: request.authority,
    supersession: Object.freeze({ preservesOldBytes: true, preservesOldProducerIdentity: true,
      rewritesHistoricalPackage: false }),
    effectBoundary: M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
    contentPolicy: Object.freeze({ fullSourceBytesEmbedded: false, boundedExactExcerptsOnly: true }),
    sources: Object.freeze(transformed.map((item) => item.source)),
  });
  return Object.freeze({ ...content, sourcePackSha256: m5bProductReviewCanonicalSha256(content) });
}

function objectTypeForLens(lens: M5bProductReviewLens): "signal" | "account_snapshot" | "play" {
  if (lens === "signal") return "signal";
  if (lens === "map") return "account_snapshot";
  return "play";
}

function buildCandidate(
  request: M5bProductReviewRequest,
  packageBinding: M5bProductReviewPackageBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
  transformed: readonly TransformedSource[],
): ValidatedCandidate {
  const evidenceInOrder = request.evidenceBindings.map((binding, index) => ({
    request: binding,
    resolved: transformed.flatMap((item) => item.source.evidenceBindings)
      .find((candidate) => candidate.evidenceId === binding.evidenceId)!,
    graphId: `exc_m5b_product_${String(index + 1).padStart(3, "0")}`,
  }));
  const evidenceById = new Map(evidenceInOrder.map((item) => [item.request.evidenceId, item]));

  const bundle: GraphBundle = {
    sources: transformed.map((item) => {
      const sourceRequest = request.sources.find((source) => source.sourceId === item.source.sourceId)!;
      return {
        id: item.source.sourceId,
        team_id: request.subject.teamId,
        account_id: request.subject.accountId,
        url: item.source.canonicalUrl,
        canonical_url: item.source.canonicalUrl,
        title: item.source.title,
        publisher: item.source.publisher,
        source_type: item.source.sourceType,
        fetched_at: item.source.acquiredAt,
        accessed_at: item.source.acquiredAt,
        origin_content_sha256: sourceRequest.rawSha256,
        stored_content_sha256: item.source.storedContentSha256,
        transformation_manifest_sha256: item.source.transformationManifestSha256,
        raw_text: item.storedText,
        reliability: "unknown" as const,
        status: "active" as const,
      };
    }),
    excerpts: evidenceInOrder.map((item) => ({
      id: item.graphId,
      source_document_id: item.request.sourceId,
      text: item.request.exactQuote,
      kind: "literal" as const,
      char_start: item.resolved.storedCharStart,
      char_end: item.resolved.storedCharEnd,
      captured_at: request.execution.preparedAt,
      validation_status: "proposed" as const,
      rejection_reason: null,
    })),
    claims: request.proposals.map((proposal, index) => ({
      id: `clm_m5b_product_${String(index + 1).padStart(3, "0")}`,
      team_id: request.subject.teamId,
      account_id: request.subject.accountId,
      claim_type: `m5b_product_review_${proposal.classification}`,
      text: proposal.summary,
      normalized_subject: `${request.subject.accountId}:${proposal.proposalId}`,
      confidence: proposal.classification === "source_fact" ? "medium" as const : "low" as const,
      provenance_status: "unverified" as const,
      status: "active" as const,
      created_by: "system" as const,
      created_at: request.execution.preparedAt,
    })),
    claim_evidence: request.proposals.flatMap((proposal, proposalIndex) =>
      proposal.evidenceBindingIds.map((evidenceId, evidenceIndex) => ({
        id: `cev_m5b_${String(proposalIndex + 1).padStart(3, "0")}_${String(evidenceIndex + 1).padStart(2, "0")}`,
        claim_id: `clm_m5b_product_${String(proposalIndex + 1).padStart(3, "0")}`,
        evidence_excerpt_id: evidenceById.get(evidenceId)!.graphId,
        relationship: "supports" as const,
        rationale: proposal.classification === "source_fact"
          ? "The proposed source fact is directly attributed to this exact source excerpt."
          : "The exact excerpt provides context for this proposed interpretation; it is not independent verification.",
        confidence: proposal.classification === "source_fact" ? "medium" as const : "low" as const,
        created_at: request.execution.preparedAt,
      }))),
    account_objects: request.proposals.map((proposal, index) => ({
      id: `obj_m5b_product_${String(index + 1).padStart(3, "0")}`,
      team_id: request.subject.teamId,
      account_id: request.subject.accountId,
      object_type: objectTypeForLens(proposal.lens),
      title: proposal.title,
      summary: proposal.summary,
      payload_json: {
        proposal_id: proposal.proposalId,
        classification: proposal.classification,
        lens: proposal.lens,
        evidence_roles: proposal.evidenceBindingIds.map((evidenceId) => ({
          evidence_id: evidenceId,
          evidence_role: evidenceById.get(evidenceId)!.request.evidenceRole,
        })),
        supporting_proposal_ids: [...proposal.supportingProposalIds],
        caveats: [...proposal.caveats],
        safe_task: proposal.safeTask,
        review_status: "proposed_unratified_unarmed",
        source_backed: proposal.classification === "source_fact",
        independently_verified: false,
        human_ratified: false,
        quality_passed: false,
        durable: false,
        system_created: true,
        authority: request.authority,
        package_binding: packageBinding,
        source_pack_sha256: sourcePack.sourcePackSha256,
        zero_effect_boundary: M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
      },
      confidence: proposal.classification === "source_fact" ? "medium" as const : "low" as const,
      provenance_status: "unverified" as const,
      status: "active" as const,
      created_by: "system" as const,
      created_at: request.execution.preparedAt,
      updated_at: request.execution.preparedAt,
    })),
    account_object_claims: request.proposals.map((_proposal, index) => ({
      id: `oclm_m5b_product_${String(index + 1).padStart(3, "0")}`,
      account_object_id: `obj_m5b_product_${String(index + 1).padStart(3, "0")}`,
      claim_id: `clm_m5b_product_${String(index + 1).padStart(3, "0")}`,
      relationship: "primary" as const,
    })),
    research_runs: [],
    run_artifacts: [],
    audit_events: [],
  };
  assertProposalDerivedRecordsUnverified(bundle);
  return createValidatedCandidate(bundle, {
    team_id: request.subject.teamId,
    account_id: request.subject.accountId,
  });
}

export const M5B_PRODUCT_REVIEW_QUESTION_LABELS = Object.freeze([
  ["Who is this account?", "whoIsThisAccount"],
  ["What meaningfully changed?", "whatMeaningfullyChanged"],
  ["Why does it matter?", "whyDoesItMatter"],
  ["What needs attention?", "whatNeedsAttention"],
  ["What safe task can Atliera help complete next?", "safeNextTask"],
] as const);

function buildReviewPacket(
  request: M5bProductReviewRequest,
  packageBinding: M5bProductReviewPackageBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
  candidateSha256: string,
): M5bProductReviewPacket {
  const evidenceById = new Map(sourcePack.sources.flatMap((source) => source.evidenceBindings)
    .map((binding) => [binding.evidenceId, binding]));
  const proposals: M5bProductReviewPacketProposal[] = request.proposals.map((proposal) => Object.freeze({
    proposalId: proposal.proposalId,
    status: "pending" as const,
    classification: proposal.classification,
    lens: proposal.lens,
    title: proposal.title,
    summary: proposal.summary,
    allowedLocalDispositions: Object.freeze(["accept", "reject"] as const),
    evidenceBindings: Object.freeze(proposal.evidenceBindingIds.map((id) => evidenceById.get(id)!)),
    supportingProposalIds: Object.freeze([...proposal.supportingProposalIds]),
    caveats: Object.freeze([...proposal.caveats]),
    safeTask: proposal.safeTask === null ? null : Object.freeze({ ...proposal.safeTask, nonExecutable: true as const }),
    trust: Object.freeze({
      sourceBacked: proposal.classification === "source_fact",
      independentlyVerified: false as const,
      humanRatified: false as const,
      qualityPassed: false as const,
      proposed: true as const,
      durable: false as const,
      createdBy: "system" as const,
    }),
  }));
  const content: M5bProductReviewPacketContent = Object.freeze({
    kind: M5B_PRODUCT_REVIEW_PACKET_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_PACKET_VERSION,
    packageBinding,
    subject: request.subject,
    sourcePackSha256: sourcePack.sourcePackSha256,
    candidateSha256,
    authority: request.authority,
    effectBoundary: M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
    reviewBoundary: Object.freeze({ localSelectionsOnly: true, selectionsSaved: false,
      selectionsAreRatification: false, writeAuthority: "none" as const }),
    customerQuestions: Object.freeze(M5B_PRODUCT_REVIEW_QUESTION_LABELS.map(([question, key]) => Object.freeze({
      question,
      answer: request.customerQuestions[key],
      evidenceBindingIds: Object.freeze(key === "whatMeaningfullyChanged"
        ? [...request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds]
        : []),
    }))),
    lenses: Object.freeze((["signal", "map", "play"] as const).map((lens) => Object.freeze({
      lens,
      proposalIds: Object.freeze(proposals.filter((proposal) => proposal.lens === lens)
        .map((proposal) => proposal.proposalId)),
    }))),
    sourceRegister: Object.freeze(sourcePack.sources.map((source) => Object.freeze({
      sourceId: source.sourceId,
      title: source.title,
      canonicalUrl: source.canonicalUrl,
      contentEncoding: source.contentEncoding,
      originContentSha256: source.originContentSha256,
      decodedByteSize: source.decodedByteSize,
      decodedContentSha256: source.decodedContentSha256,
      storedContentSha256: source.storedContentSha256,
      transformationManifestSha256: source.transformationManifestSha256,
      provenance: source.provenance,
      evidenceCurrentThrough: source.evidenceCurrentThrough,
    }))),
    proposals: Object.freeze(proposals),
  });
  return Object.freeze({ ...content, reviewPacketSha256: m5bProductReviewCanonicalSha256(content) });
}

/** @internal Deterministic prepare stage; production custody is authenticated by prepareM5bProductReview. */
export function buildM5bProductReviewPackageData(
  request: M5bProductReviewRequest,
  requestRawSha256: string,
  admitted: readonly M5bProductReviewAdmittedSource[],
): Readonly<M5bProductReviewPackageData> {
  if (typeof requestRawSha256 !== "string" || !SHA256.test(requestRawSha256)) {
    refuseM5bProductReview("request_identity");
  }
  const validatedRequest = validateM5bProductReviewRequest(request);
  assertAdmittedSourcesShape(admitted);
  const packageBinding = makePackageBinding(validatedRequest, requestRawSha256);
  const transformed = transformSources(validatedRequest, admitted);
  const sourcePack = buildSourcePack(validatedRequest, packageBinding, transformed);
  const candidate = buildCandidate(validatedRequest, packageBinding, sourcePack, transformed);
  const candidateSha256 = validatedCandidateSha256(candidate);
  const reviewPacket = buildReviewPacket(validatedRequest, packageBinding, sourcePack, candidateSha256);
  return Object.freeze({ packageBinding, sourcePack, candidate, candidateSha256, reviewPacket });
}
