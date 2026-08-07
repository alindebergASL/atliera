import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  assertExactKeys,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_OID = /^[a-f0-9]{40}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAXIMUM_BYTES = 1_048_576;
const JSON_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 10_000,
  max_depth: 32,
  max_expanded_json_value_occurrences: 80_000,
  max_nodes: 40_000,
  max_object_fields: 256,
  max_string_utf8_bytes: 262_144,
  max_total_string_utf8_bytes: 2_097_152,
});

const {
  byteLength: TYPED_ARRAY_BYTE_LENGTH_GETTER,
  byteOffset: TYPED_ARRAY_BYTE_OFFSET_GETTER,
  buffer: TYPED_ARRAY_BUFFER_GETTER,
} = (() => {
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
  const getter = (name: "byteLength" | "byteOffset" | "buffer"): (() => unknown) => {
    const candidate = Object.getOwnPropertyDescriptor(typedArrayPrototype, name)?.get;
    if (typeof candidate !== "function") throw new Error(`TypedArray ${name} intrinsic unavailable`);
    return candidate;
  };
  return Object.freeze({ byteLength: getter("byteLength"), byteOffset: getter("byteOffset"),
    buffer: getter("buffer") });
})();

export interface M4CustodyEnvelopePins {
  readonly custodyArtifactSha256: string;
  readonly decodedResponseBytes: number;
  readonly responseSha256: string;
  readonly targetPolicySha256: string;
  readonly capabilityDescriptorSha256: string;
  readonly capabilityId: string;
  readonly adapterId: string;
  readonly sourceUrl: string;
  readonly sourceHost: string;
  readonly publisher: string;
  readonly targetRef: string;
  readonly targetPolicyRef: string;
  readonly acquiredAt: string;
}

export interface M4CustodyEnvelopeReceiptIdentity {
  readonly acquisition: {
    readonly targetPolicySha256: string;
    readonly responseSha256: string;
    readonly responseByteSize: number;
    readonly sourceUrl: string;
    readonly acquiredAt: string;
  };
  readonly activation: {
    readonly authorityId: string;
    readonly consumptionId: string;
    readonly implementationCommit: string;
    readonly implementationTree: null;
    readonly acquisitionConsumptionSha256: string;
  };
  readonly provenance: {
    readonly capabilityId: string;
    readonly adapterId: string;
    readonly adapterSha256: string;
    readonly targetPolicyRef: string;
    readonly transport: "live_sec_one_shot";
  };
}

export interface AdmittedM4CustodyEnvelope {
  readonly decodedBytes: Buffer;
  readonly receiptIdentity: M4CustodyEnvelopeReceiptIdentity;
}

export class M4CustodyEnvelopeRefusal extends Error {
  constructor(public readonly code: string) {
    super(`M4 custody envelope refused: ${code}`);
    this.name = "M4CustodyEnvelopeRefusal";
  }
}

function refuse(code: string): never {
  throw new M4CustodyEnvelopeRefusal(code);
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function intrinsicByteLength(value: unknown, label: string): number {
  if (typeof value !== "object" || value === null || utilTypes.isProxy(value) || !utilTypes.isUint8Array(value)) {
    refuse(`${label}_bytes`);
  }
  const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as unknown;
  if (!Number.isSafeInteger(byteLength) || (byteLength as number) < 0) refuse(`${label}_bytes`);
  return byteLength as number;
}

function intrinsicView(value: Uint8Array, byteLength: number, label: string): Uint8Array {
  try {
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []) as ArrayBufferLike;
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []) as unknown;
    if (!Number.isSafeInteger(byteOffset) || (byteOffset as number) < 0) refuse(`${label}_bytes`);
    return new Uint8Array(buffer, byteOffset as number, byteLength);
  } catch (error) {
    if (error instanceof M4CustodyEnvelopeRefusal) throw error;
    return refuse(`${label}_bytes`);
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
      if (character === "\\") cursor += text[cursor + 1] === "u" ? 6 : 2;
      else cursor += 1;
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
        if (keys.has(key)) refuse("custody_duplicate_key");
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

function strictJsonBytes(bytes: Uint8Array, label: string): {
  readonly bytes: Buffer;
  readonly text: string;
  readonly value: StrictJsonValue;
} {
  if (bytes.length === 0 || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) refuse(`${label}_utf8`);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    refuse(`${label}_utf8`);
  }
  if (!Buffer.from(text, "utf8").equals(bytes)) refuse(`${label}_utf8`);
  let parsed: unknown;
  try {
    assertNoDuplicateJsonObjectKeys(text);
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof M4CustodyEnvelopeRefusal) throw error;
    refuse(`${label}_json`);
  }
  try {
    return Object.freeze({ bytes: Buffer.from(bytes), text, value: snapshotStrictJson(parsed, label, JSON_LIMITS) });
  } catch {
    return refuse(`${label}_shape`);
  }
}

function object(value: StrictJsonValue | undefined, label: string): Record<string, StrictJsonValue> {
  try {
    return strictJsonObject(value as StrictJsonValue, label);
  } catch {
    return refuse(`${label}_object`);
  }
}

function array(value: StrictJsonValue | undefined, label: string): StrictJsonValue[] {
  try {
    return strictJsonArray(value as StrictJsonValue, label, 10_000, true);
  } catch {
    return refuse(`${label}_array`);
  }
}

function exactKeys(value: Record<string, StrictJsonValue>, expected: readonly string[], label: string): void {
  try {
    assertExactKeys(value, expected, label);
  } catch {
    refuse(`${label}_envelope`);
  }
}

function exactString(value: StrictJsonValue | undefined, expected: string, label: string): void {
  if (value !== expected) refuse(`${label}_drift`);
}

function exactNumber(value: StrictJsonValue | undefined, expected: number, label: string): void {
  if (value !== expected) refuse(`${label}_drift`);
}

function requiredString(value: StrictJsonValue | undefined, label: string): string {
  if (typeof value !== "string" || value.length === 0) refuse(`${label}_string`);
  return value;
}

function strictIso(value: StrictJsonValue | undefined, label: string): string {
  if (typeof value !== "string" || !STRICT_ISO.test(value) || new Date(value).toISOString() !== value) {
    refuse(`${label}_timestamp`);
  }
  return value;
}

function snapshotPins(pinsInput: M4CustodyEnvelopePins): M4CustodyEnvelopePins {
  let root: Record<string, StrictJsonValue>;
  try {
    root = strictJsonObject(snapshotStrictJson(pinsInput, "pins", Object.freeze({
      ...JSON_LIMITS,
      max_array_length: 0,
      max_depth: 2,
      max_expanded_json_value_occurrences: 32,
      max_nodes: 4,
      max_object_fields: 16,
      max_string_utf8_bytes: 2_048,
      max_total_string_utf8_bytes: 8_192,
    })), "pins");
    assertExactKeys(root, ["custodyArtifactSha256", "decodedResponseBytes", "responseSha256",
      "targetPolicySha256", "capabilityDescriptorSha256", "capabilityId", "adapterId", "sourceUrl",
      "sourceHost", "publisher", "targetRef", "targetPolicyRef", "acquiredAt"], "pins");
  } catch {
    return refuse("pins_shape");
  }
  for (const key of ["custodyArtifactSha256", "responseSha256", "targetPolicySha256",
    "capabilityDescriptorSha256"] as const) {
    if (typeof root[key] !== "string" || !SHA256.test(root[key] as string)) refuse(`pins_${key}`);
  }
  if (!Number.isSafeInteger(root.decodedResponseBytes) || typeof root.decodedResponseBytes !== "number" ||
      root.decodedResponseBytes <= 0 || root.decodedResponseBytes > MAXIMUM_BYTES) refuse("pins_decodedResponseBytes");
  for (const key of ["capabilityId", "adapterId"] as const) {
    if (typeof root[key] !== "string" || !SAFE_ID.test(root[key] as string)) refuse(`pins_${key}`);
  }
  for (const key of ["sourceUrl", "sourceHost", "publisher", "targetRef", "targetPolicyRef"] as const) {
    if (typeof root[key] !== "string" || root[key].length === 0) refuse(`pins_${key}`);
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(root.sourceUrl as string);
  } catch {
    return refuse("pins_sourceUrl");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== root.sourceHost || parsedUrl.href !== root.sourceUrl) {
    refuse("pins_sourceUrl");
  }
  strictIso(root.acquiredAt, "pins_acquired");
  return Object.freeze({ ...root }) as unknown as M4CustodyEnvelopePins;
}

function validateEnvelope(snapshot: StrictJsonValue, pins: M4CustodyEnvelopePins): {
  readonly acquisition: Record<string, StrictJsonValue>;
  readonly activation: Record<string, StrictJsonValue>;
  readonly provenance: Record<string, StrictJsonValue>;
} {
  const root = object(snapshot, "custody");
  exactKeys(root, ["kind", "activation", "targetPolicySha256", "acquiredAt", "acquisition", "extraction",
    "capabilityExecutions", "auditEvents", "accountingIncrements"], "custody");
  exactString(root.kind, "m4-sec-gate-b-custody", "custody_kind");
  exactString(root.targetPolicySha256, pins.targetPolicySha256, "custody_target_policy");
  exactString(root.acquiredAt, pins.acquiredAt, "custody_acquired_at");

  const activation = object(root.activation, "custody.activation");
  exactKeys(activation, ["authorizationId", "oneShotConsumptionId", "reviewedAdapterCommit", "authorizedAt", "validFrom",
    "validUntil", "consumedAt", "consumptionSha256", "userAgentSha256", "userAgentByteLength"], "custody_activation");
  const authorityId = requiredString(activation.authorizationId, "activation.authorizationId");
  const consumptionId = requiredString(activation.oneShotConsumptionId, "activation.oneShotConsumptionId");
  const implementationCommit = requiredString(activation.reviewedAdapterCommit, "activation.reviewedAdapterCommit");
  if (!SAFE_ID.test(authorityId) || !SAFE_ID.test(consumptionId) || !GIT_OID.test(implementationCommit)) {
    refuse("activation_identity");
  }
  for (const key of ["authorizedAt", "validFrom", "validUntil", "consumedAt"] as const) {
    strictIso(activation[key], `activation.${key}`);
  }
  for (const key of ["consumptionSha256", "userAgentSha256"] as const) {
    if (typeof activation[key] !== "string" || !SHA256.test(activation[key] as string)) refuse(`activation_${key}`);
  }
  if (!Number.isSafeInteger(activation.userAgentByteLength) || typeof activation.userAgentByteLength !== "number" ||
      activation.userAgentByteLength <= 0) refuse("activation_user_agent_length");

  const acquisition = object(root.acquisition, "custody.acquisition");
  exactKeys(acquisition, ["requestedTargetRef", "requestedUrl", "finalUrl", "sourceHost", "publisher",
    "targetPolicySha256", "fetchedAt", "httpStatus", "contentType", "byteCount", "responseSha256", "bodyBase64",
    "quotedBodyText", "trust", "provenance", "custody"], "custody_acquisition");
  exactString(acquisition.requestedTargetRef, pins.targetRef, "acquisition_target");
  exactString(acquisition.requestedUrl, pins.sourceUrl, "acquisition_requested_url");
  exactString(acquisition.finalUrl, pins.sourceUrl, "acquisition_final_url");
  exactString(acquisition.sourceHost, pins.sourceHost, "acquisition_host");
  exactString(acquisition.publisher, pins.publisher, "acquisition_publisher");
  exactString(acquisition.targetPolicySha256, pins.targetPolicySha256, "acquisition_target_policy");
  exactString(acquisition.fetchedAt, pins.acquiredAt, "acquisition_timestamp");
  exactNumber(acquisition.httpStatus, 200, "acquisition_status");
  exactString(acquisition.contentType, "application/json", "acquisition_content_type");
  exactNumber(acquisition.byteCount, pins.decodedResponseBytes, "acquisition_byte_count");
  exactString(acquisition.responseSha256, pins.responseSha256, "acquisition_response_hash");

  const trust = object(acquisition.trust, "acquisition.trust");
  exactKeys(trust, ["status", "mayProvideInstructions", "controlAuthority", "transportSuccessPromotesTrust"],
    "acquisition_trust");
  exactString(trust.status, "quoted_untrusted_public_source_content", "acquisition_trust_status");
  if (trust.mayProvideInstructions !== false || trust.controlAuthority !== "none" ||
      trust.transportSuccessPromotesTrust !== false) refuse("acquisition_trust_drift");

  const provenance = object(acquisition.provenance, "acquisition.provenance");
  exactKeys(provenance, ["acquisitionCapability", "transport", "targetPolicyRef", "targetPolicySha256",
    "resolvedAddresses", "connectedAddress"], "acquisition_provenance");
  exactString(provenance.acquisitionCapability, pins.capabilityId, "acquisition_capability");
  exactString(provenance.transport, "live_sec_one_shot", "acquisition_transport");
  exactString(provenance.targetPolicyRef, pins.targetPolicyRef, "provenance_target_ref");
  exactString(provenance.targetPolicySha256, pins.targetPolicySha256, "provenance_target_policy");

  const acquisitionCustody = object(acquisition.custody, "acquisition.custody");
  exactKeys(acquisitionCustody, ["exactBytesPreserved", "exactBytesEncoding", "hashAlgorithm", "classification"],
    "acquisition_custody");
  if (acquisitionCustody.exactBytesPreserved !== true || acquisitionCustody.exactBytesEncoding !== "base64" ||
      acquisitionCustody.hashAlgorithm !== "sha256" || acquisitionCustody.classification !== "public_evidence") {
    refuse("acquisition_custody_drift");
  }

  const executions = array(root.capabilityExecutions, "custody.capabilityExecutions");
  if (executions.length !== 1) refuse("execution_count");
  const execution = object(executions[0], "custody.capabilityExecutions[0]");
  exactKeys(execution, ["kind", "executionId", "capabilityId", "descriptorSha256", "targetPolicySha256", "authorityKind",
    "authorityRef", "mediationLevel", "targetRef", "inputBytes", "outputBytes", "retryCount", "startedAt", "completedAt",
    "durationMs", "outcome", "refusalCode", "effectTelemetry"], "execution");
  exactString(execution.kind, "CapabilityExecution", "execution_kind");
  exactString(execution.capabilityId, pins.capabilityId, "execution_capability");
  exactString(execution.descriptorSha256, pins.capabilityDescriptorSha256, "execution_descriptor");
  exactString(execution.targetPolicySha256, pins.targetPolicySha256, "execution_target_policy");
  exactString(execution.authorityKind, "external_gate_b_one_shot_go", "execution_authority");
  exactString(execution.mediationLevel, "L0", "execution_mediation");
  exactString(execution.targetRef, pins.targetRef, "execution_target");
  exactString(execution.authorityRef, authorityId, "execution_authority_ref");
  exactNumber(execution.outputBytes, pins.decodedResponseBytes, "execution_output_bytes");
  exactNumber(execution.retryCount, 0, "execution_retry");
  exactString(execution.outcome, "completed", "execution_outcome");
  if (execution.refusalCode !== null) refuse("execution_refusal");
  const effectTelemetry = object(execution.effectTelemetry, "execution.effectTelemetry");
  exactKeys(effectTelemetry, ["dnsAttempts", "requestAttempts", "connectionAttempts", "liveNetworkEgress",
    "bytesReceived", "selectedAddress", "lookupCallbacks", "retryCount", "responseSha256", "failurePhase",
    "userAgentAudit"], "effect_telemetry");
  exactNumber(effectTelemetry.bytesReceived, pins.decodedResponseBytes, "effect_bytes");
  exactNumber(effectTelemetry.retryCount, 0, "effect_retry");
  exactString(effectTelemetry.responseSha256, pins.responseSha256, "effect_response_hash");
  if (effectTelemetry.failurePhase !== null) refuse("effect_failure");

  if (array(root.auditEvents, "custody.auditEvents").length !== 1 ||
      array(root.accountingIncrements, "custody.accountingIncrements").length !== 1) refuse("custody_record_count");
  const accounting = object(array(root.accountingIncrements, "custody.accountingIncrements")[0], "accounting");
  exactKeys(accounting, ["kind", "incrementId", "executionId", "capabilityInvocations", "capabilityExecutionRecords",
    "auditEventsEmitted", "liveNetworkEgressPerformed", "dnsAttemptsPerformed", "requestAttemptsPerformed",
    "connectionAttemptsPerformed", "lookupCallbacksPerformed", "bytesReceived", "selectedAddress", "failurePhase",
    "systemSideAcquisitionProofsPerformed", "retriesPerformed", "providerCallsExecuted", "privateReadsPerformed",
    "graphWritesPerformed", "productionWritesPerformed", "deploymentsPerformed"], "accounting");
  for (const key of ["retriesPerformed", "providerCallsExecuted", "privateReadsPerformed", "graphWritesPerformed",
    "productionWritesPerformed", "deploymentsPerformed"] as const) exactNumber(accounting[key], 0, `accounting_${key}`);
  exactNumber(accounting.bytesReceived, pins.decodedResponseBytes, "accounting_bytes");

  const extraction = object(root.extraction, "custody.extraction");
  exactKeys(extraction, ["kind", "value", "jsonPointer", "field", "context", "sourceUrl", "responseSha256",
    "provenance", "trustLabel", "verificationStatus"], "custody_extraction");
  exactString(extraction.sourceUrl, pins.sourceUrl, "extraction_url");
  exactString(extraction.responseSha256, pins.responseSha256, "extraction_response_hash");
  exactString(extraction.jsonPointer, "/sicDescription", "extraction_pointer");
  return Object.freeze({ acquisition, activation, provenance });
}

/**
 * Provider-neutral, byte-only admission for a retained M4 custody envelope.
 * Every provider/source identity is supplied as an exact pin. No account
 * projection or product-specific interpretation is returned.
 */
export function admitM4CustodyEnvelopeBytes(
  custodyBytes: Uint8Array,
  pinsInput: M4CustodyEnvelopePins,
): Readonly<AdmittedM4CustodyEnvelope> {
  const pins = snapshotPins(pinsInput);
  const custodyByteLength = intrinsicByteLength(custodyBytes, "custody");
  if (custodyByteLength > MAXIMUM_BYTES) refuse("custody_input_bytes");
  const copied = Buffer.from(intrinsicView(custodyBytes, custodyByteLength, "custody"));
  // Outer identity is checked before UTF-8 decode, JSON parse, envelope access,
  // base64 decode, or decoded-response hashing.
  if (sha256(copied) !== pins.custodyArtifactSha256) refuse("custody_sha256");
  const custody = strictJsonBytes(copied, "custody");
  const { acquisition, activation, provenance } = validateEnvelope(custody.value, pins);
  const bodyBase64 = requiredString(acquisition.bodyBase64, "acquisition.bodyBase64");
  const maximumBase64Bytes = 4 * Math.ceil(pins.decodedResponseBytes / 3);
  if (Buffer.byteLength(bodyBase64, "utf8") > maximumBase64Bytes) refuse("response_base64_bounds");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(bodyBase64)) {
    refuse("response_base64");
  }
  const responseBytes = Buffer.from(bodyBase64, "base64");
  if (responseBytes.toString("base64") !== bodyBase64 || responseBytes.byteLength !== pins.decodedResponseBytes ||
      sha256(responseBytes) !== pins.responseSha256) refuse("response_custody");
  const decodedResponse = strictJsonBytes(responseBytes, "response");
  if (acquisition.quotedBodyText !== decodedResponse.text) refuse("response_custody");
  return Object.freeze({
    decodedBytes: Buffer.from(decodedResponse.bytes),
    receiptIdentity: Object.freeze({
      acquisition: Object.freeze({
        targetPolicySha256: pins.targetPolicySha256,
        responseSha256: pins.responseSha256,
        responseByteSize: pins.decodedResponseBytes,
        sourceUrl: pins.sourceUrl,
        acquiredAt: pins.acquiredAt,
      }),
      activation: Object.freeze({
        authorityId: activation.authorizationId as string,
        consumptionId: activation.oneShotConsumptionId as string,
        implementationCommit: activation.reviewedAdapterCommit as string,
        implementationTree: null,
        acquisitionConsumptionSha256: activation.consumptionSha256 as string,
      }),
      provenance: Object.freeze({
        capabilityId: provenance.acquisitionCapability as string,
        adapterId: pins.adapterId,
        adapterSha256: pins.capabilityDescriptorSha256,
        targetPolicyRef: provenance.targetPolicyRef as string,
        transport: "live_sec_one_shot" as const,
      }),
    }),
  });
}
