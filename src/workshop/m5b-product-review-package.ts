import type { ValidatedCandidate } from "../graph/validated-candidate.ts";
import type {
  M5bProductReviewAuthority,
  M5bProductReviewClassification,
  M5bProductReviewEvidenceRole,
  M5bProductReviewLens,
  M5bProductReviewMaterialChangeAssertion,
  M5bProductReviewRequest,
  M5bProductReviewSafeTask,
  M5bProductReviewSourceKind,
  M5bProductReviewSubject,
} from "./m5b-product-review-contract.ts";

export const M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND = "m5b-product-review-sanitized-source-pack" as const;
export const M5B_PRODUCT_REVIEW_PACKET_KIND = "m5b-product-review-packet" as const;
export const M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION = "2" as const;
export const M5B_PRODUCT_REVIEW_PACKET_VERSION = "2" as const;
export const M5B_PRODUCT_REVIEW_TRANSFORMATION_VERSION = "2" as const;

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
  readonly preparedAt: string;
}

export interface M5bProductReviewEvidenceBinding {
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly exactQuote: string;
  readonly evidenceRole: M5bProductReviewEvidenceRole;
  readonly materialChangeAssertion: M5bProductReviewMaterialChangeAssertion | null;
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
  readonly proposalBindingIds: readonly string[];
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

export const M5B_PRODUCT_REVIEW_QUESTION_LABELS = Object.freeze([
  ["Who is this account?", "whoIsThisAccount"],
  ["What meaningfully changed?", "whatMeaningfullyChanged"],
  ["Why does it matter?", "whyDoesItMatter"],
  ["What needs attention?", "whatNeedsAttention"],
  ["What safe task can Atliera help complete next?", "safeNextTask"],
] as const);
