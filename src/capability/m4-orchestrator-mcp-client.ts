import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { types as utilTypes } from "node:util";

import { H2_MCP_SPEC_VERSION, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID } from "./h2-registry.ts";
import { M4_TARGET_POLICY_REF, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import type {
  H2McpInProcessTransport,
  H2McpNotification,
  H2McpRequest,
  H2McpRequestId,
  H2McpResponse,
} from "./h2-mcp-protocol.ts";
import {
  M4_MAX_BODY_BYTES,
  M4_PUBLISHER,
  M4_SOURCE_HOST,
  M4_TARGET_REF,
  M4_TARGET_URL,
  isPublicAddress,
  isStrictIsoTimestamp,
  type M4FailurePhase,
  type M4FetchRefusalCode,
  type M4EffectTelemetry,
  type M4PublicEvidence,
} from "./public-http-fetch-policy.ts";

class M4OrchestratorBoundaryError extends Error {
  constructor() { super("orchestrator MCP client refused response"); }
}

function ownData(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) {
    throw new M4OrchestratorBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new M4OrchestratorBoundaryError();
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new M4OrchestratorBoundaryError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new M4OrchestratorBoundaryError();
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new M4OrchestratorBoundaryError();
    }
    output[key] = descriptor.value;
  }
  return output;
}

function denseArray(value: unknown, maxLength: number): readonly unknown[] {
  if (!Array.isArray(value) || utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) throw new M4OrchestratorBoundaryError();
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maxLength || lengthDescriptor.enumerable !== false) {
    throw new M4OrchestratorBoundaryError();
  }
  const length = lengthDescriptor.value as number;
  if (Object.getOwnPropertyNames(value).length !== length + 1) throw new M4OrchestratorBoundaryError();
  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new M4OrchestratorBoundaryError();
    }
    output.push(descriptor.value);
  }
  return Object.freeze(output);
}

function snapshotJson(value: unknown, depth = 0): unknown {
  if (depth > 16) throw new M4OrchestratorBoundaryError();
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return value;
  if (Array.isArray(value)) {
    const items = denseArray(value, 64);
    const output: unknown[] = [];
    for (const item of items) output.push(snapshotJson(item, depth + 1));
    return Object.freeze(output);
  }
  if (typeof value !== "object" || utilTypes.isProxy(value)) throw new M4OrchestratorBoundaryError();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null || Object.getOwnPropertySymbols(value).length !== 0) {
    throw new M4OrchestratorBoundaryError();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length > 64) throw new M4OrchestratorBoundaryError();
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new M4OrchestratorBoundaryError();
    }
    output[key] = snapshotJson(descriptor.value, depth + 1);
  }
  return Object.freeze(output);
}

function anyOwnData(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) {
    throw new M4OrchestratorBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null || Object.getOwnPropertySymbols(value).length !== 0) {
    throw new M4OrchestratorBoundaryError();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return ownData(value, Object.keys(descriptors));
}

function responseResult(response: unknown, id: H2McpRequestId): Record<string, unknown> {
  const root = ownData(response, ["jsonrpc", "id", "result"]);
  if (root.jsonrpc !== "2.0" || root.id !== id) throw new M4OrchestratorBoundaryError();
  return anyOwnData(root.result);
}

const REFUSAL_CODES = new Set<M4FetchRefusalCode>([
  "target_ref_refused", "url_policy_refused", "hostname_refused", "dns_refused",
  "non_public_address_refused", "connected_address_mismatch", "redirect_refused",
  "http_status_refused", "mime_refused", "body_limit_refused", "timeout_or_cancelled",
  "transport_refused",
  "user_agent_refused", "authorization_refused", "authorization_replay_refused", "extraction_refused",
]);
const FAILURE_PHASES = new Set<M4FailurePhase>(["lookup_contract", "request_construction", "tcp_connection",
  "tls_handshake", "response_headers", "response_body_or_deadline", "custody_finalization", "mediation_protocol"]);

function snapshotResolvedAddresses(value: unknown): readonly string[] {
  const values = denseArray(value, 16);
  if (values.length === 0) throw new M4OrchestratorBoundaryError();
  const output: string[] = [];
  for (const candidate of values) {
    if (typeof candidate !== "string" || candidate !== candidate.toLowerCase() ||
        isIP(candidate) === 0 || !isPublicAddress(candidate)) throw new M4OrchestratorBoundaryError();
    output.push(candidate);
  }
  return Object.freeze(output);
}

function canonicalBase64Bytes(value: unknown): Buffer {
  if (typeof value !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new M4OrchestratorBoundaryError();
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || bytes.byteLength > M4_MAX_BODY_BYTES) {
    throw new M4OrchestratorBoundaryError();
  }
  return bytes;
}

function snapshotEvidence(value: unknown): M4PublicEvidence {
  const root = ownData(value, [
    "requestedTargetRef", "requestedUrl", "finalUrl", "sourceHost", "publisher", "targetPolicySha256", "fetchedAt",
    "httpStatus", "contentType", "byteCount", "responseSha256", "bodyBase64", "quotedBodyText",
    "trust", "provenance", "custody",
  ]);
  const trust = ownData(root.trust, ["status", "mayProvideInstructions", "controlAuthority", "transportSuccessPromotesTrust"]);
  const provenance = ownData(root.provenance, [
    "acquisitionCapability", "transport", "targetPolicyRef", "targetPolicySha256", "resolvedAddresses", "connectedAddress",
  ]);
  const custody = ownData(root.custody, [
    "exactBytesPreserved", "exactBytesEncoding", "hashAlgorithm", "classification",
  ]);
  const addresses = snapshotResolvedAddresses(provenance.resolvedAddresses);
  const bytes = canonicalBase64Bytes(root.bodyBase64);
  if (root.requestedTargetRef !== M4_TARGET_REF || root.requestedUrl !== M4_TARGET_URL ||
      root.finalUrl !== M4_TARGET_URL || root.sourceHost !== M4_SOURCE_HOST || root.publisher !== M4_PUBLISHER ||
      root.targetPolicySha256 !== M4_TARGET_POLICY_SHA256 || !isStrictIsoTimestamp(root.fetchedAt) || !Number.isSafeInteger(root.httpStatus) ||
      (root.httpStatus as number) < 200 || (root.httpStatus as number) > 299 ||
      root.contentType !== "application/json" ||
      !Number.isSafeInteger(root.byteCount) || root.byteCount !== bytes.byteLength ||
      typeof root.responseSha256 !== "string" || !/^[a-f0-9]{64}$/.test(root.responseSha256) ||
      createHash("sha256").update(bytes).digest("hex") !== root.responseSha256 ||
      typeof root.quotedBodyText !== "string" || root.quotedBodyText !== bytes.toString("utf8") ||
      trust.status !== "quoted_untrusted_public_source_content" || trust.mayProvideInstructions !== false ||
      trust.controlAuthority !== "none" || trust.transportSuccessPromotesTrust !== false ||
      provenance.acquisitionCapability !== M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID ||
      (provenance.transport !== "recorded_inert_exchange" && provenance.transport !== "live_sec_one_shot") ||
      provenance.targetPolicyRef !== M4_TARGET_POLICY_REF ||
      provenance.targetPolicySha256 !== M4_TARGET_POLICY_SHA256 ||
      typeof provenance.connectedAddress !== "string" || provenance.connectedAddress !== provenance.connectedAddress.toLowerCase() ||
      !isPublicAddress(provenance.connectedAddress) || !addresses.includes(provenance.connectedAddress) ||
      custody.exactBytesPreserved !== true || custody.exactBytesEncoding !== "base64" ||
      custody.hashAlgorithm !== "sha256" || custody.classification !== "public_evidence") {
    throw new M4OrchestratorBoundaryError();
  }
  return Object.freeze({
    requestedTargetRef: M4_TARGET_REF,
    requestedUrl: M4_TARGET_URL,
    finalUrl: M4_TARGET_URL,
    sourceHost: M4_SOURCE_HOST,
    publisher: M4_PUBLISHER,
    targetPolicySha256: M4_TARGET_POLICY_SHA256,
    fetchedAt: root.fetchedAt,
    httpStatus: root.httpStatus as number,
    contentType: root.contentType,
    byteCount: root.byteCount as number,
    responseSha256: root.responseSha256,
    bodyBase64: root.bodyBase64 as string,
    quotedBodyText: root.quotedBodyText,
    trust: Object.freeze({
      status: "quoted_untrusted_public_source_content",
      mayProvideInstructions: false,
      controlAuthority: "none",
      transportSuccessPromotesTrust: false,
    }),
    provenance: Object.freeze({
      acquisitionCapability: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      transport: provenance.transport as "recorded_inert_exchange" | "live_sec_one_shot",
      targetPolicyRef: M4_TARGET_POLICY_REF,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      resolvedAddresses: addresses,
      connectedAddress: provenance.connectedAddress,
    }),
    custody: Object.freeze({
      exactBytesPreserved: true,
      exactBytesEncoding: "base64",
      hashAlgorithm: "sha256",
      classification: "public_evidence",
    }),
  });
}

export type M4ClientCallResult =
  | { readonly acquisition: M4PublicEvidence; readonly refusalCode: null; readonly effectTelemetry: M4EffectTelemetry }
  | { readonly acquisition: null; readonly refusalCode: M4FetchRefusalCode; readonly effectTelemetry: M4EffectTelemetry };

function snapshotEffectTelemetry(value: unknown): M4EffectTelemetry {
  const root = ownData(value, ["dnsAttempts", "requestAttempts", "connectionAttempts", "liveNetworkEgress",
    "bytesReceived", "selectedAddress", "lookupCallbacks", "retryCount", "responseSha256", "failurePhase",
    "userAgentAudit"]);
  for (const key of ["dnsAttempts", "requestAttempts", "connectionAttempts", "liveNetworkEgress", "lookupCallbacks"] as const) {
    if (root[key] !== 0 && root[key] !== 1) throw new M4OrchestratorBoundaryError();
  }
  if (root.retryCount !== 0 || !Number.isSafeInteger(root.bytesReceived) || (root.bytesReceived as number) < 0) {
    throw new M4OrchestratorBoundaryError();
  }
  const selectedAddress = root.selectedAddress;
  if (selectedAddress !== null && (typeof selectedAddress !== "string" || selectedAddress !== selectedAddress.toLowerCase() ||
      isIP(selectedAddress) === 0 || !isPublicAddress(selectedAddress))) throw new M4OrchestratorBoundaryError();
  if ((root.requestAttempts === 1 || root.connectionAttempts === 1 || root.liveNetworkEgress === 1 || root.lookupCallbacks === 1) &&
      selectedAddress === null) throw new M4OrchestratorBoundaryError();
  if (root.responseSha256 !== null && (typeof root.responseSha256 !== "string" || !/^[a-f0-9]{64}$/.test(root.responseSha256))) {
    throw new M4OrchestratorBoundaryError();
  }
  const failurePhase = root.failurePhase;
  if (failurePhase !== null && (typeof failurePhase !== "string" ||
      !FAILURE_PHASES.has(failurePhase as M4FailurePhase))) throw new M4OrchestratorBoundaryError();
  let userAgentAudit: M4EffectTelemetry["userAgentAudit"] = null;
  if (root.userAgentAudit !== null) {
    const audit = ownData(root.userAgentAudit, ["configured", "byteLength", "sha256", "formatValid", "contactRedacted"]);
    if (audit.configured !== true || audit.formatValid !== true || audit.contactRedacted !== true ||
        !Number.isSafeInteger(audit.byteLength) || (audit.byteLength as number) < 8 || (audit.byteLength as number) > 256 ||
        typeof audit.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(audit.sha256)) throw new M4OrchestratorBoundaryError();
    userAgentAudit = Object.freeze({ configured: true, byteLength: audit.byteLength as number,
      sha256: audit.sha256, formatValid: true, contactRedacted: true });
  }
  if ((root.requestAttempts as number) > (root.dnsAttempts as number) ||
      (root.connectionAttempts as number) > (root.requestAttempts as number) ||
      (root.liveNetworkEgress as number) > (root.connectionAttempts as number) ||
      (root.lookupCallbacks as number) > (root.requestAttempts as number) ||
      ((root.dnsAttempts !== 0 || root.requestAttempts !== 0 || root.connectionAttempts !== 0 ||
        root.liveNetworkEgress !== 0 || root.bytesReceived !== 0 || selectedAddress !== null ||
        root.lookupCallbacks !== 0 || root.responseSha256 !== null) && userAgentAudit === null)) {
    throw new M4OrchestratorBoundaryError();
  }
  return Object.freeze({ dnsAttempts: root.dnsAttempts as 0 | 1, requestAttempts: root.requestAttempts as 0 | 1,
    connectionAttempts: root.connectionAttempts as 0 | 1, liveNetworkEgress: root.liveNetworkEgress as 0 | 1,
    bytesReceived: root.bytesReceived as number, selectedAddress: selectedAddress as string | null,
    lookupCallbacks: root.lookupCallbacks as 0 | 1, retryCount: 0, responseSha256: root.responseSha256 as string | null,
    failurePhase: failurePhase as M4FailurePhase | null, userAgentAudit });
}

export class M4OrchestratorMcpClient {
  readonly #transport: H2McpInProcessTransport;
  #initialized = false;
  #sequence = 0;
  constructor(transport: H2McpInProcessTransport) { this.#transport = transport; }

  async #request(request: H2McpRequest, duration: number, cancellable: boolean): Promise<H2McpResponse> {
    if (!Number.isSafeInteger(duration) || duration <= 0) throw new M4OrchestratorBoundaryError();
    const controller = cancellable ? new AbortController() : undefined;
    let handle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      handle = setTimeout(() => {
        controller?.abort();
        reject(new M4OrchestratorBoundaryError());
        if (controller !== undefined) {
          try {
            void Promise.resolve(this.#transport.sendNotification({
              jsonrpc: "2.0", method: "notifications/cancelled",
              params: { requestId: request.id, reason: "request deadline exceeded" },
            })).catch(() => undefined);
          } catch { /* best-effort cancellation after deadline */ }
        }
      }, duration);
    });
    try {
      return await Promise.race([
        this.#transport.sendRequest(request, controller === undefined ? undefined : { signal: controller.signal }),
        timeout,
      ]);
    } catch { throw new M4OrchestratorBoundaryError(); }
    finally { if (handle !== undefined) clearTimeout(handle); }
  }

  async #initialize(duration: number): Promise<void> {
    if (this.#initialized) return;
    const id = `m4_initialize_${++this.#sequence}`;
    const result = responseResult(await this.#request({
      jsonrpc: "2.0", id, method: "initialize", params: {
        protocolVersion: H2_MCP_SPEC_VERSION, capabilities: {},
        clientInfo: { name: "atliera-orchestrator", version: "0.1.0" },
      },
    }, duration, false), id);
    const exact = ownData(result, ["protocolVersion", "capabilities", "serverInfo"]);
    const capabilities = ownData(exact.capabilities, ["tools"]);
    const tools = ownData(capabilities.tools, ["listChanged"]);
    const serverInfo = ownData(exact.serverInfo, ["name", "version"]);
    if (exact.protocolVersion !== H2_MCP_SPEC_VERSION || tools.listChanged !== false ||
        serverInfo.name !== "atliera-m4-public-http-fetch" || serverInfo.version !== "0.1.0") {
      throw new M4OrchestratorBoundaryError();
    }
    const notification: H2McpNotification = { jsonrpc: "2.0", method: "notifications/initialized" };
    let handle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      handle = setTimeout(() => reject(new M4OrchestratorBoundaryError()), duration);
    });
    try { await Promise.race([this.#transport.sendNotification(notification), timeout]); }
    catch { throw new M4OrchestratorBoundaryError(); }
    finally { if (handle !== undefined) clearTimeout(handle); }
    this.#initialized = true;
  }

  async getLiveDescriptorSnapshot(duration: number): Promise<unknown> {
    await this.#initialize(duration);
    const id = `m4_tools_list_${++this.#sequence}`;
    const result = responseResult(await this.#request({ jsonrpc: "2.0", id, method: "tools/list" }, duration, true), id);
    const exact = ownData(result, ["tools"]);
    const tools = denseArray(exact.tools, 1);
    if (tools.length !== 1) throw new M4OrchestratorBoundaryError();
    return snapshotJson(tools[0]);
  }

  async invoke(requestId: string, targetRef: string, duration: number): Promise<M4ClientCallResult> {
    if (!this.#initialized) throw new M4OrchestratorBoundaryError();
    const result = responseResult(await this.#request({
      jsonrpc: "2.0", id: requestId, method: "tools/call",
      params: { name: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID, arguments: { targetRef } },
    }, duration, true), requestId);
    const exact = ownData(result, ["content", "structuredContent", "isError"]);
    const content = denseArray(exact.content, 1);
    if (content.length !== 1) throw new M4OrchestratorBoundaryError();
    const textContent = ownData(content[0], ["type", "text"]);
    const structured = ownData(exact.structuredContent, ["acquisition", "refusalCode", "effectTelemetry"]);
    if (textContent.type !== "text" || typeof textContent.text !== "string" ||
        Buffer.byteLength(textContent.text, "utf8") > 8_000_000 || typeof exact.isError !== "boolean") {
      throw new M4OrchestratorBoundaryError();
    }
    let snapshot: M4ClientCallResult;
    const effectTelemetry = snapshotEffectTelemetry(structured.effectTelemetry);
    if (exact.isError === false && structured.refusalCode === null) {
      const acquisition = snapshotEvidence(structured.acquisition);
      if (effectTelemetry.responseSha256 !== null && effectTelemetry.responseSha256 !== acquisition.responseSha256) {
        throw new M4OrchestratorBoundaryError();
      }
      if (acquisition.provenance.transport === "recorded_inert_exchange") {
        if (effectTelemetry.dnsAttempts !== 0 || effectTelemetry.requestAttempts !== 0 ||
            effectTelemetry.connectionAttempts !== 0 || effectTelemetry.liveNetworkEgress !== 0 ||
            effectTelemetry.bytesReceived !== 0 || effectTelemetry.selectedAddress !== null ||
            effectTelemetry.lookupCallbacks !== 0 || effectTelemetry.responseSha256 !== null ||
            effectTelemetry.failurePhase !== null || effectTelemetry.userAgentAudit !== null) {
          throw new M4OrchestratorBoundaryError();
        }
      } else if (effectTelemetry.dnsAttempts !== 1 || effectTelemetry.requestAttempts !== 1 ||
          effectTelemetry.connectionAttempts !== 1 || effectTelemetry.liveNetworkEgress !== 1 ||
          effectTelemetry.lookupCallbacks !== 1 || effectTelemetry.bytesReceived !== acquisition.byteCount ||
          effectTelemetry.selectedAddress !== acquisition.provenance.connectedAddress ||
          effectTelemetry.responseSha256 !== acquisition.responseSha256 || effectTelemetry.failurePhase !== null ||
          effectTelemetry.userAgentAudit === null) {
        throw new M4OrchestratorBoundaryError();
      }
      snapshot = Object.freeze({ acquisition, refusalCode: null, effectTelemetry });
    } else if (exact.isError === true && structured.acquisition === null &&
               typeof structured.refusalCode === "string" && REFUSAL_CODES.has(structured.refusalCode as M4FetchRefusalCode)) {
      snapshot = Object.freeze({ acquisition: null, refusalCode: structured.refusalCode as M4FetchRefusalCode, effectTelemetry });
    } else {
      throw new M4OrchestratorBoundaryError();
    }
    if (textContent.text !== JSON.stringify(snapshot)) throw new M4OrchestratorBoundaryError();
    return snapshot;
  }
}
