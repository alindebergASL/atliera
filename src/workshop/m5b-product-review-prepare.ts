import { constants as fsConstants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, parse, relative, resolve, sep } from "node:path";

import {
  assertExactKeys,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import {
  assertM5bProductEffectConsumptionIntact,
  assertM5bProductEffectLedgerReceipt,
  claimM5bProductEffectAttempt,
  type M5bProductEffectAttempt,
  type M5bProductEffectConsumption,
  type M5bProductEffectLedger,
  type M5bProductEffectSourceIdentity,
} from "../authority/m5b-product-effect-authority.ts";
import {
  exactSecArchiveTargetPolicySha256,
  validateExactSecArchiveTargetPolicy,
} from "../capability/exact-sec-archive-target-policy.ts";
import { getH2CapabilityRegistryEntry, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID } from "../capability/h2-registry.ts";
import {
  M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID,
  M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256,
  M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID,
} from "../capability/m4-sec-live-adapter.ts";
import {
  admitM4CustodyEnvelopeBytes,
  type M4CustodyEnvelopePins,
} from "../capability/m4-custody-envelope-admission.ts";
import {
  M4_CANONICAL_TARGET_POLICY,
  M4_TARGET_POLICY_REF,
  M4_TARGET_POLICY_SHA256,
} from "../capability/m4-target-policy.ts";
import { isPublicAddress } from "../capability/public-http-fetch-policy.ts";
import {
  M5B_PRODUCT_REVIEW_LIMITS,
  m5bProductReviewCanonicalSha256,
  refuseM5bProductReview,
  validateM5bProductReviewRequest,
  type M5bProductReviewRequest,
} from "./m5b-product-review-contract.ts";
import {
  M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
  buildM5bProductReviewPackageData,
  type M5bProductReviewAdmittedSource,
  type M5bProductReviewPackageBinding,
  type M5bProductReviewSourceProvenance,
} from "./m5b-product-review-package.ts";
import {
  renderM5bProductReviewMeetingBrief,
  renderM5bProductReviewWorkshopHtml,
} from "./m5b-product-review-render.ts";

export const M5B_PRODUCT_REVIEW_PREPARE_RESULT_KIND = "m5b-product-review-prepare-result" as const;

const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_ID = /^src_[a-z0-9][a-z0-9_-]{0,51}$/;
const OPTIONS_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 4,
  max_depth: 4,
  max_expanded_json_value_occurrences: 64,
  max_nodes: 16,
  max_object_fields: 5,
  max_string_utf8_bytes: 2_048,
  max_total_string_utf8_bytes: 16 * 1024,
});
const CUSTODY_JSON_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 10_000,
  max_depth: 32,
  max_expanded_json_value_occurrences: 80_000,
  max_nodes: 40_000,
  max_object_fields: 256,
  max_string_utf8_bytes: 512 * 1024,
  max_total_string_utf8_bytes: 2 * 1024 * 1024,
});

export type M5bProductReviewArtifactName =
  | "sanitized-source-pack.json"
  | "candidate.json"
  | "review-packet.json"
  | "workshop-pre-ratification.html"
  | "meeting-brief.md";

export interface M5bProductReviewSourceFileBinding {
  readonly sourceId: string;
  readonly path: string;
}

export interface M5bProductReviewPrepareOptions {
  readonly requestPath: string;
  readonly expectedRequestSha256: string;
  readonly expectedRequestByteSize: number;
  readonly sourceFiles: readonly M5bProductReviewSourceFileBinding[];
  readonly outputDir: string;
}

export interface M5bProductReviewPreparedArtifactIdentity {
  readonly name: M5bProductReviewArtifactName;
  readonly sha256: string;
  readonly byteSize: number;
}

export interface M5bProductReviewPrepareResultContent {
  readonly kind: typeof M5B_PRODUCT_REVIEW_PREPARE_RESULT_KIND;
  readonly schemaVersion: "1";
  readonly packageBinding: M5bProductReviewPackageBinding;
  readonly sourcePackSha256: string;
  readonly candidateSha256: string;
  readonly reviewPacketSha256: string;
  readonly authority: M5bProductReviewRequest["authority"];
  readonly supersession: {
    readonly preservesOldBytes: true;
    readonly preservesOldProducerIdentity: true;
    readonly rewritesHistoricalPackage: false;
  };
  readonly artifacts: readonly M5bProductReviewPreparedArtifactIdentity[];
  readonly accounting: {
    readonly requestManifestReads: 1;
    readonly evidenceSourceReads: number;
    readonly syntheticSourceReads: number;
    readonly retainedCustodyReads: number;
    readonly retainedCustodyReadAuthorityConsumptions: 0 | 1;
    readonly outputFilesWritten: 6;
    readonly acquisitions: 0;
    readonly networkCalls: 0;
    readonly providerCalls: 0;
    readonly databaseWrites: 0;
    readonly graphWrites: 0;
    readonly deployments: 0;
    readonly outboundActions: 0;
    readonly applyOperations: 0;
    readonly retries: 0;
  };
}

export interface M5bProductReviewPrepareResult extends M5bProductReviewPrepareResultContent {
  readonly resultSha256: string;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function strictObject(value: StrictJsonValue | undefined): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(value as StrictJsonValue, "prepare_options");
  } catch {
    refuseM5bProductReview("prepare_options_shape");
  }
}

function pathValue(value: StrictJsonValue | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048 ||
      /[\u0000-\u001f\u007f]/u.test(value) ||
      !isAbsolute(value) || normalize(value) !== value) {
    refuseM5bProductReview("explicit_absolute_paths_required");
  }
  return value;
}

function validatePrepareOptions(raw: unknown): M5bProductReviewPrepareOptions {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "prepare_options", OPTIONS_LIMITS);
  } catch {
    refuseM5bProductReview("prepare_options_plain_data");
  }
  const root = strictObject(snapshot);
  try {
    assertExactKeys(root, ["requestPath", "expectedRequestSha256", "expectedRequestByteSize", "sourceFiles",
      "outputDir"], "prepare_options");
  } catch {
    refuseM5bProductReview("prepare_options_shape");
  }
  if (typeof root.expectedRequestSha256 !== "string" || !SHA256.test(root.expectedRequestSha256) ||
      typeof root.expectedRequestByteSize !== "number" || !Number.isSafeInteger(root.expectedRequestByteSize) ||
      root.expectedRequestByteSize <= 0 || root.expectedRequestByteSize > M5B_PRODUCT_REVIEW_LIMITS.requestBytes) {
    refuseM5bProductReview("request_identity");
  }
  let values: StrictJsonValue[];
  try {
    values = strictJsonArray(root.sourceFiles, "prepare_options.sourceFiles",
      M5B_PRODUCT_REVIEW_LIMITS.sourceCountMax, true);
  } catch {
    refuseM5bProductReview("source_bindings");
  }
  if (values.length < M5B_PRODUCT_REVIEW_LIMITS.sourceCountMin) refuseM5bProductReview("source_bindings");
  const sourceFiles = values.map((value) => {
    const binding = strictObject(value);
    try {
      assertExactKeys(binding, ["sourceId", "path"], "prepare_options.sourceFiles[]");
    } catch {
      refuseM5bProductReview("source_bindings");
    }
    if (typeof binding.sourceId !== "string" || !SOURCE_ID.test(binding.sourceId)) {
      refuseM5bProductReview("source_bindings");
    }
    return Object.freeze({ sourceId: binding.sourceId, path: pathValue(binding.path) });
  });
  if (new Set(sourceFiles.map((binding) => binding.sourceId)).size !== sourceFiles.length ||
      new Set(sourceFiles.map((binding) => binding.path)).size !== sourceFiles.length) {
    refuseM5bProductReview("duplicate_source_binding");
  }
  return Object.freeze({
    requestPath: pathValue(root.requestPath),
    expectedRequestSha256: root.expectedRequestSha256,
    expectedRequestByteSize: root.expectedRequestByteSize,
    sourceFiles: Object.freeze(sourceFiles),
    outputDir: pathValue(root.outputDir),
  });
}

async function canonicalPathWithoutSymlinks(input: string): Promise<string> {
  const absolute = resolve(input);
  const root = parse(absolute).root;
  const segments = absolute.slice(root.length).split(sep).filter((segment) => segment.length > 0);
  let cursor = root;
  for (let index = 0; index < segments.length; index += 1) {
    const next = join(cursor, segments[index]!);
    let metadata;
    try {
      metadata = await lstat(next);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const canonicalParent = await realpath(cursor).catch(() => refuseM5bProductReview("path_parent"));
        return resolve(canonicalParent, ...segments.slice(index));
      }
      refuseM5bProductReview("path_component");
    }
    if (metadata.isSymbolicLink()) refuseM5bProductReview("symlink_path");
    if (index < segments.length - 1 && !metadata.isDirectory()) refuseM5bProductReview("path_component");
    cursor = next;
  }
  return realpath(absolute).catch(() => refuseM5bProductReview("path_component"));
}

async function requireExistingFile(path: string, code: string): Promise<string> {
  const canonical = await canonicalPathWithoutSymlinks(path);
  const metadata = await lstat(path).catch(() => refuseM5bProductReview(code));
  if (!metadata.isFile() || metadata.isSymbolicLink()) refuseM5bProductReview(code);
  return canonical;
}

async function assertDestinationAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  refuseM5bProductReview("output_exists");
}

async function requireNewOutputDirectory(path: string): Promise<string> {
  const canonical = await canonicalPathWithoutSymlinks(path);
  await assertDestinationAbsent(path);
  const parent = await lstat(dirname(path)).catch(() => refuseM5bProductReview("output_parent_missing"));
  if (!parent.isDirectory() || parent.isSymbolicLink()) refuseM5bProductReview("output_parent_missing");
  return canonical;
}

function containsPath(parent: string, child: string): boolean {
  const relationship = relative(parent, child);
  return relationship === "" || (!isAbsolute(relationship) && relationship !== ".." &&
    !relationship.startsWith(`..${sep}`));
}

function pathsOverlap(left: string, right: string): boolean {
  return containsPath(left, right) || containsPath(right, left);
}

async function readPinnedFileOnce(
  path: string,
  expectedByteSize: number,
  expectedSha256: string,
  sizeCode: string,
  identityCode: string,
): Promise<Buffer> {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.size !== expectedByteSize) refuseM5bProductReview(sizeCode);
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.byteLength !== expectedByteSize || after.size !== expectedByteSize ||
        sha256(bytes) !== expectedSha256) {
      refuseM5bProductReview(identityCode);
    }
    return bytes;
  } catch (error) {
    if (error instanceof Error && error.name === "M5bProductReviewRefusal") throw error;
    return refuseM5bProductReview(identityCode);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function decodeUtf8(bytes: Uint8Array, code: string): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    refuseM5bProductReview(code);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    refuseM5bProductReview(code);
  }
}

function assertNoDuplicateJsonObjectKeys(text: string): void {
  let cursor = 0;
  const whitespace = (): void => {
    while (cursor < text.length && /[\u0009\u000a\u000d\u0020]/u.test(text[cursor]!)) cursor += 1;
  };
  const scanString = (): string => {
    const start = cursor;
    cursor += 1;
    while (cursor < text.length) {
      const character = text[cursor]!;
      if (character === "\"") {
        cursor += 1;
        return JSON.parse(text.slice(start, cursor)) as string;
      }
      if (character === "\\") {
        cursor += text[cursor + 1] === "u" ? 6 : 2;
      } else {
        cursor += 1;
      }
    }
    throw new Error("unterminated JSON string");
  };
  const scanValue = (): void => {
    whitespace();
    const character = text[cursor];
    if (character === "{") {
      cursor += 1;
      whitespace();
      const keys = new Set<string>();
      if (text[cursor] === "}") {
        cursor += 1;
        return;
      }
      while (cursor < text.length) {
        if (text[cursor] !== "\"") throw new Error("object key expected");
        const key = scanString();
        if (keys.has(key)) refuseM5bProductReview("request_duplicate_key");
        keys.add(key);
        whitespace();
        if (text[cursor] !== ":") throw new Error("object colon expected");
        cursor += 1;
        scanValue();
        whitespace();
        if (text[cursor] === "}") {
          cursor += 1;
          return;
        }
        if (text[cursor] !== ",") throw new Error("object delimiter expected");
        cursor += 1;
        whitespace();
      }
      throw new Error("unterminated object");
    }
    if (character === "[") {
      cursor += 1;
      whitespace();
      if (text[cursor] === "]") {
        cursor += 1;
        return;
      }
      while (cursor < text.length) {
        scanValue();
        whitespace();
        if (text[cursor] === "]") {
          cursor += 1;
          return;
        }
        if (text[cursor] !== ",") throw new Error("array delimiter expected");
        cursor += 1;
      }
      throw new Error("unterminated array");
    }
    if (character === "\"") {
      scanString();
      return;
    }
    const start = cursor;
    while (cursor < text.length && !/[,\]}\u0009\u000a\u000d\u0020]/u.test(text[cursor]!)) cursor += 1;
    if (cursor === start) throw new Error("JSON value expected");
  };
  scanValue();
  whitespace();
  if (cursor !== text.length) throw new Error("trailing JSON content");
}

function parseRequestBytes(bytes: Uint8Array): M5bProductReviewRequest {
  const text = decodeUtf8(bytes, "request_utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    assertNoDuplicateJsonObjectKeys(text);
  } catch (error) {
    if (error instanceof Error && error.name === "M5bProductReviewRefusal") throw error;
    refuseM5bProductReview("request_json");
  }
  return validateM5bProductReviewRequest(parsed);
}

function decodeM4CustodyEnvelope(
  outerBytes: Uint8Array,
  source: M5bProductReviewRequest["sources"][number],
  readConsumption: Readonly<M5bProductEffectConsumption> | null,
): { readonly bytes: Buffer; readonly provenance: M5bProductReviewSourceProvenance } {
  if (source.sourceKind === "exact_public_acquisition_custody") {
    if (readConsumption === null) refuseM5bProductReview("retained_custody_read_authority");
    const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
    const pins: M4CustodyEnvelopePins = {
      custodyArtifactSha256: source.rawSha256,
      decodedResponseBytes: source.decodedByteSize,
      responseSha256: source.decodedSha256,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      capabilityDescriptorSha256: registry.descriptorSha256,
      capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      adapterId: "m4_sec_gate_b_live_one_shot_v1",
      sourceUrl: source.canonicalUrl,
      sourceHost: M4_CANONICAL_TARGET_POLICY.hostname,
      publisher: M4_CANONICAL_TARGET_POLICY.publisher,
      targetRef: M4_CANONICAL_TARGET_POLICY.targetRef,
      targetPolicyRef: M4_TARGET_POLICY_REF,
      acquiredAt: source.acquiredAt,
    };
    let admitted;
    try {
      admitted = admitM4CustodyEnvelopeBytes(outerBytes, pins);
    } catch {
      return refuseM5bProductReview("custody_shape");
    }
    const receipt = admitted.receiptIdentity;
    return Object.freeze({
      bytes: Buffer.from(admitted.decodedBytes),
      provenance: productionProvenance(source, readConsumption, {
        targetPolicySha256: receipt.acquisition.targetPolicySha256,
        capabilityId: receipt.provenance.capabilityId,
        adapterId: receipt.provenance.adapterId,
        adapterSha256: receipt.provenance.adapterSha256,
        authorityId: receipt.activation.authorityId,
        consumptionId: receipt.activation.consumptionId,
        implementationCommit: receipt.activation.implementationCommit,
        implementationTree: receipt.activation.implementationTree,
        acquisitionConsumptionSha256: receipt.activation.acquisitionConsumptionSha256,
      }),
    });
  }
  const text = decodeUtf8(outerBytes, "custody_utf8");
  let parsed: unknown;
  try {
    assertNoDuplicateJsonObjectKeys(text);
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.name === "M5bProductReviewRefusal") throw error;
    refuseM5bProductReview("custody_json");
  }
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(parsed, "custody", CUSTODY_JSON_LIMITS);
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  let root: { [key: string]: StrictJsonValue };
  let acquisition: { [key: string]: StrictJsonValue };
  try {
    root = strictJsonObject(snapshot, "custody");
    acquisition = strictJsonObject(root.acquisition as StrictJsonValue, "custody.acquisition");
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  try {
    assertExactKeys(root, ["kind", "acquiredAt", "acquisition"], "custody");
    assertExactKeys(acquisition, ["requestedUrl", "finalUrl", "fetchedAt", "httpStatus", "byteCount",
      "responseSha256", "bodyBase64", "quotedBodyText"], "custody.acquisition");
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  if (root.kind !== "m4-sec-gate-b-custody" || root.acquiredAt !== source.acquiredAt ||
      acquisition.requestedUrl !== source.canonicalUrl || acquisition.finalUrl !== source.canonicalUrl ||
      acquisition.fetchedAt !== source.acquiredAt || acquisition.httpStatus !== 200 ||
      acquisition.byteCount !== source.decodedByteSize || acquisition.responseSha256 !== source.decodedSha256 ||
      typeof acquisition.bodyBase64 !== "string" || typeof acquisition.quotedBodyText !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(acquisition.bodyBase64)) {
    refuseM5bProductReview("custody_binding");
  }
  const decoded = Buffer.from(acquisition.bodyBase64, "base64");
  if (decoded.toString("base64") !== acquisition.bodyBase64 ||
      decoded.byteLength !== source.decodedByteSize || sha256(decoded) !== source.decodedSha256) {
    refuseM5bProductReview("custody_decoded_identity");
  }
  const decodedText = decodeUtf8(decoded, "custody_decoded_utf8");
  if (acquisition.quotedBodyText !== decodedText) refuseM5bProductReview("custody_quoted_text");
  return Object.freeze({ bytes: decoded, provenance: syntheticProvenance(source) });
}

function strictIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function syntheticProvenance(
  source: M5bProductReviewRequest["sources"][number],
): M5bProductReviewSourceProvenance {
  return Object.freeze({
    classification: "explicit_synthetic_fixture",
    exactUrl: source.canonicalUrl,
    responseByteSize: source.decodedByteSize,
    responseSha256: source.decodedSha256,
    outerCustodySha256: source.rawSha256,
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
  });
}

function productionProvenance(
  source: M5bProductReviewRequest["sources"][number],
  readConsumption: Readonly<M5bProductEffectConsumption> | null,
  acquisition: Omit<Extract<M5bProductReviewSourceProvenance,
    { classification: "validated_exact_public_acquisition_custody" }>,
    "classification" | "exactUrl" | "responseByteSize" | "responseSha256" | "outerCustodySha256" |
    "retainedReadAuthorityId" | "retainedReadConsumptionId" | "retainedReadImplementationCommit" |
    "retainedReadImplementationTree" | "retainedReadLedgerNamespaceSha256" |
    "retainedReadLedgerRecordSha256">,
): M5bProductReviewSourceProvenance {
  return Object.freeze({
    classification: "validated_exact_public_acquisition_custody",
    exactUrl: source.canonicalUrl,
    responseByteSize: source.decodedByteSize,
    responseSha256: source.decodedSha256,
    outerCustodySha256: source.rawSha256,
    ...acquisition,
    retainedReadAuthorityId: readConsumption?.authorityId ?? null,
    retainedReadConsumptionId: readConsumption?.consumptionId ?? null,
    retainedReadImplementationCommit: readConsumption?.implementationCommit ?? null,
    retainedReadImplementationTree: readConsumption?.implementationTree ?? null,
    retainedReadLedgerNamespaceSha256: readConsumption?.ledgerNamespaceSha256 ?? null,
    retainedReadLedgerRecordSha256: readConsumption?.ledgerRecordSha256 ?? null,
  });
}

function decodeExactSecArchiveCustodyEnvelope(
  outerBytes: Uint8Array,
  source: M5bProductReviewRequest["sources"][number],
  acquisitionLedger: Readonly<M5bProductEffectLedger> | undefined,
): { readonly bytes: Buffer; readonly provenance: M5bProductReviewSourceProvenance } {
  if (source.sourceKind !== "exact_public_acquisition_custody") refuseM5bProductReview("custody_binding");
  const text = decodeUtf8(outerBytes, "custody_utf8");
  let snapshot: StrictJsonValue;
  try {
    assertNoDuplicateJsonObjectKeys(text);
    snapshot = snapshotStrictJson(JSON.parse(text), "custody", CUSTODY_JSON_LIMITS);
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  let root: Record<string, StrictJsonValue>;
  let adapter: Record<string, StrictJsonValue>;
  let activation: Record<string, StrictJsonValue>;
  let acquisition: Record<string, StrictJsonValue>;
  let exactCustody: Record<string, StrictJsonValue>;
  let trust: Record<string, StrictJsonValue>;
  let accounting: Record<string, StrictJsonValue>;
  try {
    root = strictJsonObject(snapshot, "custody");
    assertExactKeys(root, ["kind", "schemaVersion", "targetPolicy", "targetPolicySha256", "adapter", "activation",
      "acquiredAt", "acquisition", "trust", "effectAccounting"], "custody");
    adapter = strictJsonObject(root.adapter as StrictJsonValue, "custody.adapter");
    assertExactKeys(adapter, ["capabilityId", "adapterId", "adapterSha256"], "custody.adapter");
    activation = strictJsonObject(root.activation as StrictJsonValue, "custody.activation");
    assertExactKeys(activation, ["operation", "authorityId", "consumptionId", "ledgerRootSha256", "implementationCommit",
      "implementationTree", "targetPolicySha256", "sourceIdentities", "authorizedAt", "validFrom", "validUntil",
      "consumedAt", "ledgerNamespaceSha256", "ledgerRecordSha256", "goCanonicalSha256"], "custody.activation");
    acquisition = strictJsonObject(root.acquisition as StrictJsonValue, "custody.acquisition");
    assertExactKeys(acquisition, ["requestedTargetRef", "requestedUrl", "finalUrl", "sourceHost", "publisher", "method",
      "httpStatus", "contentType", "contentEncoding", "byteCount", "responseSha256", "bodyBase64", "quotedBodyText",
      "custody"], "custody.acquisition");
    exactCustody = strictJsonObject(acquisition.custody as StrictJsonValue, "custody.acquisition.custody");
    assertExactKeys(exactCustody, ["exactBytesPreserved", "exactBytesEncoding", "hashAlgorithm", "classification"],
      "custody.acquisition.custody");
    trust = strictJsonObject(root.trust as StrictJsonValue, "custody.trust");
    assertExactKeys(trust, ["status", "mayProvideInstructions", "controlAuthority", "transportSuccessPromotesTrust"],
      "custody.trust");
    accounting = strictJsonObject(root.effectAccounting as StrictJsonValue, "custody.effectAccounting");
    assertExactKeys(accounting, ["dnsAttempts", "requestAttempts", "connectionAttempts", "lookupCallbacks", "redirects",
      "retries", "networkRequests", "bytesReceived", "responseSha256", "selectedAddress", "connectedAddress",
      "publicAddressValidated", "pinnedConnectionMatched"], "custody.effectAccounting");
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  let targetPolicy;
  try {
    targetPolicy = validateExactSecArchiveTargetPolicy(root.targetPolicy);
  } catch {
    refuseM5bProductReview("custody_target_policy");
  }
  const targetPolicySha256 = exactSecArchiveTargetPolicySha256(targetPolicy);
  let activationSourceIdentities: StrictJsonValue[];
  try {
    activationSourceIdentities = strictJsonArray(activation.sourceIdentities, "custody.activation.sourceIdentities", 1, true);
  } catch {
    refuseM5bProductReview("custody_activation");
  }
  const activationSource = activationSourceIdentities.length === 1
    ? strictJsonObject(activationSourceIdentities[0]!, "custody.activation.sourceIdentities[0]")
    : refuseM5bProductReview("custody_activation");
  try {
    assertExactKeys(activationSource, ["sourceId", "canonicalUrl", "targetPolicySha256", "outerSha256",
      "outerByteSize", "decodedSha256", "decodedByteSize"], "custody.activation.sourceIdentity");
  } catch {
    refuseM5bProductReview("custody_activation");
  }
  const namespaceBinding = {
    kind: "m5b-product-effect-consumption",
    schemaVersion: "1",
    operation: activation.operation,
    authorityId: activation.authorityId,
    consumptionId: activation.consumptionId,
    ledgerRootSha256: activation.ledgerRootSha256,
    implementationCommit: activation.implementationCommit,
    implementationTree: activation.implementationTree,
    targetPolicySha256: activation.targetPolicySha256,
    sourceIdentities: activationSourceIdentities,
  };
  const derivedNamespaceSha256 = m5bProductReviewCanonicalSha256(namespaceBinding);
  const ledgerRecord = {
    ...namespaceBinding,
    authorizedAt: activation.authorizedAt,
    validFrom: activation.validFrom,
    validUntil: activation.validUntil,
    consumedAt: activation.consumedAt,
    ledgerNamespaceSha256: derivedNamespaceSha256,
    goCanonicalSha256: activation.goCanonicalSha256,
  };
  const derivedLedgerRecordSha256 = sha256(Buffer.from(`${JSON.stringify(ledgerRecord, null, 2)}\n`, "utf8"));
  if (root.kind !== "m5b-exact-sec-archive-custody" || root.schemaVersion !== "1" ||
      root.targetPolicySha256 !== targetPolicySha256 || source.canonicalUrl !== targetPolicy.url ||
      root.acquiredAt !== source.acquiredAt || !strictIsoTimestamp(root.acquiredAt) ||
      adapter.capabilityId !== M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID ||
      adapter.adapterId !== M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID ||
      adapter.adapterSha256 !== M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256 ||
      activation.operation !== "exact_sec_archive_acquisition" ||
      typeof activation.authorityId !== "string" || typeof activation.consumptionId !== "string" ||
      typeof activation.ledgerRootSha256 !== "string" || !SHA256.test(activation.ledgerRootSha256) ||
      typeof activation.implementationCommit !== "string" || !/^[a-f0-9]{40}$/u.test(activation.implementationCommit) ||
      typeof activation.implementationTree !== "string" || !/^[a-f0-9]{40}$/u.test(activation.implementationTree) ||
      activation.targetPolicySha256 !== targetPolicySha256 ||
      activationSource.sourceId !== "src_sec_archive_primary_document" ||
      activationSource.canonicalUrl !== targetPolicy.url ||
      activationSource.targetPolicySha256 !== targetPolicySha256 ||
      activationSource.outerSha256 !== null || activationSource.outerByteSize !== null ||
      activationSource.decodedSha256 !== null || activationSource.decodedByteSize !== null ||
      !strictIsoTimestamp(activation.authorizedAt) || !strictIsoTimestamp(activation.validFrom) ||
      !strictIsoTimestamp(activation.validUntil) || !strictIsoTimestamp(activation.consumedAt) ||
      activation.authorizedAt > activation.validFrom || activation.validFrom >= activation.validUntil ||
      activation.consumedAt < activation.validFrom || activation.consumedAt >= activation.validUntil ||
      activation.consumedAt > source.acquiredAt || activation.ledgerNamespaceSha256 !== derivedNamespaceSha256 ||
      activation.ledgerRecordSha256 !== derivedLedgerRecordSha256 ||
      ![activation.ledgerNamespaceSha256, activation.ledgerRecordSha256, activation.goCanonicalSha256]
        .every((value) => typeof value === "string" && SHA256.test(value)) ||
      acquisition.requestedTargetRef !== targetPolicy.targetRef || acquisition.requestedUrl !== targetPolicy.url ||
      acquisition.finalUrl !== targetPolicy.url || acquisition.sourceHost !== targetPolicy.hostname ||
      acquisition.publisher !== targetPolicy.publisher || acquisition.method !== "GET" || acquisition.httpStatus !== 200 ||
      acquisition.contentType !== "text/html" || acquisition.contentEncoding !== "identity" ||
      acquisition.byteCount !== source.decodedByteSize || acquisition.responseSha256 !== source.decodedSha256 ||
      typeof acquisition.bodyBase64 !== "string" || typeof acquisition.quotedBodyText !== "string" ||
      exactCustody.exactBytesPreserved !== true || exactCustody.exactBytesEncoding !== "base64" ||
      exactCustody.hashAlgorithm !== "sha256" || exactCustody.classification !== "untrusted_public_source" ||
      trust.status !== "quoted_untrusted_public_source_content" || trust.mayProvideInstructions !== false ||
      trust.controlAuthority !== "none" || trust.transportSuccessPromotesTrust !== false ||
      accounting.dnsAttempts !== 1 || accounting.requestAttempts !== 1 || accounting.connectionAttempts !== 1 ||
      accounting.lookupCallbacks !== 1 || accounting.redirects !== 0 || accounting.retries !== 0 ||
      accounting.networkRequests !== 1 || accounting.bytesReceived !== source.decodedByteSize ||
      accounting.responseSha256 !== source.decodedSha256 || typeof accounting.selectedAddress !== "string" ||
      accounting.connectedAddress !== accounting.selectedAddress || !isPublicAddress(accounting.selectedAddress) ||
      accounting.publicAddressValidated !== true || accounting.pinnedConnectionMatched !== true) {
    refuseM5bProductReview("custody_binding");
  }
  const bodyBase64 = acquisition.bodyBase64 as string;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(bodyBase64)) {
    refuseM5bProductReview("custody_binding");
  }
  const decoded = Buffer.from(bodyBase64, "base64");
  if (decoded.toString("base64") !== bodyBase64 || decoded.byteLength !== source.decodedByteSize ||
      sha256(decoded) !== source.decodedSha256) {
    refuseM5bProductReview("custody_decoded_identity");
  }
  if (decodeUtf8(decoded, "custody_decoded_utf8") !== acquisition.quotedBodyText) {
    refuseM5bProductReview("custody_quoted_text");
  }
  try {
    assertM5bProductEffectLedgerReceipt(acquisitionLedger, activation, "exact_sec_archive_acquisition");
  } catch {
    refuseM5bProductReview("custody_acquisition_ledger");
  }
  return Object.freeze({
    bytes: decoded,
    provenance: productionProvenance(source, null, {
      targetPolicySha256,
      capabilityId: M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID,
      adapterId: M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID,
      adapterSha256: M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256,
      authorityId: activation.authorityId as string,
      consumptionId: activation.consumptionId as string,
      implementationCommit: activation.implementationCommit as string,
      implementationTree: activation.implementationTree as string,
      acquisitionConsumptionSha256: activation.ledgerRecordSha256 as string,
    }),
  });
}

function decodeAdmittedSource(
  outerBytes: Uint8Array,
  source: M5bProductReviewRequest["sources"][number],
  readConsumption: Readonly<M5bProductEffectConsumption> | null,
  acquisitionLedger: Readonly<M5bProductEffectLedger> | undefined,
): M5bProductReviewAdmittedSource {
  const decodedResult = source.contentEncoding === "raw_utf8"
    ? Object.freeze({ bytes: Buffer.from(outerBytes), provenance: syntheticProvenance(source) })
    : source.contentEncoding === "m4_public_http_fetch_custody_v1"
      ? decodeM4CustodyEnvelope(outerBytes, source, readConsumption)
      : decodeExactSecArchiveCustodyEnvelope(outerBytes, source, acquisitionLedger);
  const decoded = decodedResult.bytes;
  if (decoded.byteLength !== source.decodedByteSize || sha256(decoded) !== source.decodedSha256) {
    refuseM5bProductReview("source_decoded_identity_mismatch");
  }
  return Object.freeze({
    sourceId: source.sourceId,
    text: decodeUtf8(decoded, "source_utf8"),
    decodedByteSize: decoded.byteLength,
    decodedSha256: sha256(decoded),
    provenance: decodedResult.provenance,
  });
}

function artifactIdentity(name: M5bProductReviewArtifactName, bytes: Uint8Array): M5bProductReviewPreparedArtifactIdentity {
  return Object.freeze({ name, sha256: sha256(bytes), byteSize: bytes.byteLength });
}

async function publishDirectory(
  outputDir: string,
  files: Readonly<Record<string, Uint8Array>>,
): Promise<void> {
  await assertDestinationAbsent(outputDir);
  const staging = join(dirname(outputDir), `.${basename(outputDir)}.${process.pid}.${randomUUID()}.tmp`);
  await mkdir(staging, { recursive: false, mode: 0o700 });
  try {
    for (const [name, bytes] of Object.entries(files)) {
      await writeFile(join(staging, name), bytes, { flag: "wx", mode: 0o600 });
    }
    await assertDestinationAbsent(outputDir);
    await rename(staging, outputDir);
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function targetPolicySha256ForRetainedM4Source(
  source: M5bProductReviewRequest["sources"][number],
): string {
  if (source.contentEncoding === "m4_public_http_fetch_custody_v1" &&
      source.canonicalUrl === M4_CANONICAL_TARGET_POLICY.url) return M4_TARGET_POLICY_SHA256;
  return refuseM5bProductReview("production_target_policy");
}

function retainedM4SourceIdentities(
  request: M5bProductReviewRequest,
): readonly M5bProductEffectSourceIdentity[] {
  return Object.freeze(request.sources
    .filter((source) => source.sourceKind === "exact_public_acquisition_custody" &&
      source.contentEncoding === "m4_public_http_fetch_custody_v1")
    .map((source) => Object.freeze({
      sourceId: source.sourceId,
      canonicalUrl: source.canonicalUrl,
      targetPolicySha256: targetPolicySha256ForRetainedM4Source(source),
      outerSha256: source.rawSha256,
      outerByteSize: source.expectedByteSize,
      decodedSha256: source.decodedSha256,
      decodedByteSize: source.decodedByteSize,
    })));
}

function consumeRetainedCustodyReadAuthority(
  request: M5bProductReviewRequest,
  attempt: Readonly<M5bProductEffectAttempt> | undefined,
): Readonly<M5bProductEffectConsumption> | null {
  const identities = retainedM4SourceIdentities(request);
  if (identities.length === 0) {
    if (attempt !== undefined) refuseM5bProductReview("unused_retained_custody_read_authority");
    return null;
  }
  if (attempt === undefined) refuseM5bProductReview("retained_custody_read_authority");
  const policies = new Set(identities.map((identity) => identity.targetPolicySha256));
  if (policies.size !== 1) refuseM5bProductReview("production_policy_set");
  let consumption: Readonly<M5bProductEffectConsumption>;
  try {
    consumption = claimM5bProductEffectAttempt(attempt, "retained_custody_read");
    assertM5bProductEffectConsumptionIntact(consumption, "retained_custody_read");
  } catch {
    refuseM5bProductReview("retained_custody_read_authority");
  }
  if (consumption.implementationCommit !== request.execution.commit ||
      consumption.implementationTree !== request.execution.tree ||
      consumption.targetPolicySha256 !== [...policies][0] ||
      m5bProductReviewCanonicalSha256(consumption.sourceIdentities) !==
        m5bProductReviewCanonicalSha256(identities)) {
    refuseM5bProductReview("retained_custody_read_binding");
  }
  return consumption;
}

export async function prepareM5bProductReview(
  rawOptions: unknown,
  retainedCustodyAttempt?: Readonly<M5bProductEffectAttempt>,
  exactArchiveAcquisitionLedger?: Readonly<M5bProductEffectLedger>,
): Promise<Readonly<M5bProductReviewPrepareResult>> {
  const options = validatePrepareOptions(rawOptions);
  const requestPath = await requireExistingFile(options.requestPath, "request_path");
  const outputDir = await requireNewOutputDirectory(options.outputDir);
  if (pathsOverlap(requestPath, outputDir)) refuseM5bProductReview("path_overlap");

  const requestMetadata = await stat(requestPath);
  if (!requestMetadata.isFile() || requestMetadata.size !== options.expectedRequestByteSize ||
      requestMetadata.size > M5B_PRODUCT_REVIEW_LIMITS.requestBytes) {
    refuseM5bProductReview("request_size");
  }
  if (requestMetadata.nlink !== 1) refuseM5bProductReview("hardlink_path");
  const requestBytes = await readPinnedFileOnce(requestPath, options.expectedRequestByteSize,
    options.expectedRequestSha256, "request_size", "request_identity_mismatch");
  const request = parseRequestBytes(requestBytes);

  if (request.sources.length !== options.sourceFiles.length) refuseM5bProductReview("source_bindings");
  const explicitById = new Map(options.sourceFiles.map((binding) => [binding.sourceId, binding.path]));
  for (const source of request.sources) {
    if (explicitById.get(source.sourceId) !== source.localPath) refuseM5bProductReview("source_binding_mismatch");
  }
  const expectedSourceBytes = request.sources.reduce((total, source) => total + source.expectedByteSize, 0);
  const expectedDecodedBytes = request.sources.reduce((total, source) => total + source.decodedByteSize, 0);
  if (!Number.isSafeInteger(expectedSourceBytes) || !Number.isSafeInteger(expectedDecodedBytes) ||
      expectedSourceBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal ||
      expectedDecodedBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal) {
    refuseM5bProductReview("source_budget");
  }

  const sourcePaths = new Map<string, string>();
  const fileIdentities = new Set([`${requestMetadata.dev}:${requestMetadata.ino}`]);
  for (const source of request.sources) {
    const canonical = await requireExistingFile(source.localPath, "source_path");
    const metadata = await stat(canonical);
    if (!metadata.isFile() || metadata.size !== source.expectedByteSize ||
        metadata.size > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach) {
      refuseM5bProductReview("source_size");
    }
    if (metadata.nlink !== 1) refuseM5bProductReview("hardlink_path");
    const fileIdentity = `${metadata.dev}:${metadata.ino}`;
    if (fileIdentities.has(fileIdentity)) refuseM5bProductReview("path_overlap");
    fileIdentities.add(fileIdentity);
    if (pathsOverlap(canonical, requestPath) || pathsOverlap(canonical, outputDir) ||
        [...sourcePaths.values()].some((other) => pathsOverlap(canonical, other))) {
      refuseM5bProductReview("path_overlap");
    }
    sourcePaths.set(source.sourceId, canonical);
  }

  // The durable namespace is consumed only after pure/path preflight, and before the first evidence byte is read.
  const retainedReadConsumption = consumeRetainedCustodyReadAuthority(request, retainedCustodyAttempt);
  const exactArchiveSourceCount = request.sources.filter((source) =>
    source.sourceKind === "exact_public_acquisition_custody" &&
    source.contentEncoding === "exact_sec_archive_custody_v1").length;
  if (exactArchiveSourceCount === 0 && exactArchiveAcquisitionLedger !== undefined) {
    refuseM5bProductReview("unused_exact_archive_acquisition_ledger");
  }

  const admitted: M5bProductReviewAdmittedSource[] = [];
  for (const source of request.sources) {
    const bytes = await readPinnedFileOnce(sourcePaths.get(source.sourceId)!, source.expectedByteSize,
      source.rawSha256, "source_size", "source_identity_mismatch");
    admitted.push(decodeAdmittedSource(bytes, source, retainedReadConsumption, exactArchiveAcquisitionLedger));
  }

  const packageData = buildM5bProductReviewPackageData(request, options.expectedRequestSha256, admitted);
  const sourcePackBytes = jsonBytes(packageData.sourcePack);
  const candidateBytes = jsonBytes(packageData.candidate);
  const reviewPacketBytes = jsonBytes(packageData.reviewPacket);
  const meetingBriefBytes = Buffer.from(renderM5bProductReviewMeetingBrief(
    packageData.sourcePack, packageData.reviewPacket), "utf8");
  const workshopBytes = Buffer.from(renderM5bProductReviewWorkshopHtml(
    packageData.sourcePack, packageData.reviewPacket), "utf8");
  const artifacts = Object.freeze([
    artifactIdentity("sanitized-source-pack.json", sourcePackBytes),
    artifactIdentity("candidate.json", candidateBytes),
    artifactIdentity("review-packet.json", reviewPacketBytes),
    artifactIdentity("workshop-pre-ratification.html", workshopBytes),
    artifactIdentity("meeting-brief.md", meetingBriefBytes),
  ]);
  const content: M5bProductReviewPrepareResultContent = Object.freeze({
    kind: M5B_PRODUCT_REVIEW_PREPARE_RESULT_KIND,
    schemaVersion: "1",
    packageBinding: packageData.packageBinding,
    sourcePackSha256: packageData.sourcePack.sourcePackSha256,
    candidateSha256: packageData.candidateSha256,
    reviewPacketSha256: packageData.reviewPacket.reviewPacketSha256,
    authority: request.authority,
    supersession: Object.freeze({ preservesOldBytes: true, preservesOldProducerIdentity: true,
      rewritesHistoricalPackage: false }),
    artifacts,
    accounting: Object.freeze({
      requestManifestReads: 1 as const,
      evidenceSourceReads: request.sources.length,
      syntheticSourceReads: request.sources.filter((source) => source.sourceKind === "synthetic_fixture").length,
      retainedCustodyReads: request.sources.filter((source) =>
        source.sourceKind === "exact_public_acquisition_custody" &&
        source.contentEncoding === "m4_public_http_fetch_custody_v1").length,
      retainedCustodyReadAuthorityConsumptions: retainedReadConsumption === null ? 0 as const : 1 as const,
      outputFilesWritten: 6 as const,
      ...M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
      retries: 0 as const,
    }),
  });
  const result: M5bProductReviewPrepareResult = Object.freeze({
    ...content,
    resultSha256: m5bProductReviewCanonicalSha256(content),
  });
  await publishDirectory(outputDir, {
    "sanitized-source-pack.json": sourcePackBytes,
    "candidate.json": candidateBytes,
    "review-packet.json": reviewPacketBytes,
    "workshop-pre-ratification.html": workshopBytes,
    "meeting-brief.md": meetingBriefBytes,
    "prepare-result.json": jsonBytes(result),
  });
  return result;
}
