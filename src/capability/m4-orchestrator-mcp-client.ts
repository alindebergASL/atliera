import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { types as utilTypes } from "node:util";

import { H2_MCP_SPEC_VERSION, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID } from "./h2-registry.ts";
import type {
  H2McpInProcessTransport,
  H2McpNotification,
  H2McpRequest,
  H2McpRequestId,
  H2McpResponse,
} from "./h2-mcp-protocol.ts";
import {
  M4_ALLOWLIST_REF,
  M4_MAX_BODY_BYTES,
  M4_PUBLISHER,
  M4_SOURCE_HOST,
  M4_TARGET_REF,
  M4_TARGET_URL,
  isPublicAddress,
  isStrictIsoTimestamp,
  type M4FetchRefusalCode,
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
]);

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
    "requestedTargetRef", "requestedUrl", "finalUrl", "sourceHost", "publisher", "fetchedAt",
    "httpStatus", "contentType", "byteCount", "responseSha256", "bodyBase64", "quotedBodyText",
    "trust", "provenance", "custody",
  ]);
  const trust = ownData(root.trust, ["status", "mayProvideInstructions", "controlAuthority"]);
  const provenance = ownData(root.provenance, [
    "acquisitionCapability", "transport", "targetAllowlistRef", "resolvedAddresses", "connectedAddress",
  ]);
  const custody = ownData(root.custody, [
    "exactBytesPreserved", "exactBytesEncoding", "hashAlgorithm", "classification",
  ]);
  const addresses = snapshotResolvedAddresses(provenance.resolvedAddresses);
  const bytes = canonicalBase64Bytes(root.bodyBase64);
  if (root.requestedTargetRef !== M4_TARGET_REF || root.requestedUrl !== M4_TARGET_URL ||
      root.finalUrl !== M4_TARGET_URL || root.sourceHost !== M4_SOURCE_HOST || root.publisher !== M4_PUBLISHER ||
      !isStrictIsoTimestamp(root.fetchedAt) || !Number.isSafeInteger(root.httpStatus) ||
      (root.httpStatus as number) < 200 || (root.httpStatus as number) > 299 ||
      (root.contentType !== "text/html" && root.contentType !== "text/plain") ||
      !Number.isSafeInteger(root.byteCount) || root.byteCount !== bytes.byteLength ||
      typeof root.responseSha256 !== "string" || !/^[a-f0-9]{64}$/.test(root.responseSha256) ||
      createHash("sha256").update(bytes).digest("hex") !== root.responseSha256 ||
      typeof root.quotedBodyText !== "string" || root.quotedBodyText !== bytes.toString("utf8") ||
      trust.status !== "quoted_untrusted_public_source_content" || trust.mayProvideInstructions !== false ||
      trust.controlAuthority !== "none" || provenance.acquisitionCapability !== M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID ||
      provenance.transport !== "recorded_injected" || provenance.targetAllowlistRef !== M4_ALLOWLIST_REF ||
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
    }),
    provenance: Object.freeze({
      acquisitionCapability: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      transport: "recorded_injected",
      targetAllowlistRef: M4_ALLOWLIST_REF,
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
  | { readonly acquisition: M4PublicEvidence; readonly refusalCode: null }
  | { readonly acquisition: null; readonly refusalCode: M4FetchRefusalCode };

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
    const structured = ownData(exact.structuredContent, ["acquisition", "refusalCode"]);
    if (textContent.type !== "text" || typeof textContent.text !== "string" ||
        Buffer.byteLength(textContent.text, "utf8") > 8_000_000 || typeof exact.isError !== "boolean") {
      throw new M4OrchestratorBoundaryError();
    }
    let snapshot: M4ClientCallResult;
    if (exact.isError === false && structured.refusalCode === null) {
      snapshot = Object.freeze({ acquisition: snapshotEvidence(structured.acquisition), refusalCode: null });
    } else if (exact.isError === true && structured.acquisition === null &&
               typeof structured.refusalCode === "string" && REFUSAL_CODES.has(structured.refusalCode as M4FetchRefusalCode)) {
      snapshot = Object.freeze({ acquisition: null, refusalCode: structured.refusalCode as M4FetchRefusalCode });
    } else {
      throw new M4OrchestratorBoundaryError();
    }
    if (textContent.text !== JSON.stringify(snapshot)) throw new M4OrchestratorBoundaryError();
    return snapshot;
  }
}
