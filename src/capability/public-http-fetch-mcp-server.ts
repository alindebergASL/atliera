import { types as utilTypes } from "node:util";

import {
  H2_MCP_SPEC_VERSION,
  M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
  getH2CapabilityRegistryEntry,
} from "./h2-registry.ts";
import type {
  H2McpInProcessTransport,
  H2McpNotification,
  H2McpRequest,
  H2McpRequestId,
  H2McpRequestOptions,
  H2McpResponse,
} from "./h2-mcp-protocol.ts";
import {
  acquireM4ProofRecordedEvidence,
  isStrictIsoTimestamp,
  M4_PUBLISHER,
  M4_SOURCE_HOST,
  M4_TARGET_REF,
  M4_TARGET_URL,
  M4_ZERO_EFFECT_TELEMETRY,
  snapshotM4ProofRecordedExchange,
  validateM4SecUserAgent,
  withM4FailurePhase,
  type M4EffectTelemetry,
  type M4ProofRecordedExchange,
  type M4PublicEvidence,
} from "./public-http-fetch-policy.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_REF, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import { acquireM4SecLive, type M4LiveDependencies } from "./m4-sec-live-adapter.ts";
import { assertM4GateBActivationConsumed, assertM4GateBUserAgentMatchesActivation,
  claimM4GateBActivationExecution, type M4GateBActivation } from "./m4-sec-gate-b-activation.ts";
import { extractM4SecEvidence } from "./m4-sec-extraction.ts";

export class M4PublicHttpBoundaryError extends Error {
  constructor() {
    super("public HTTP fetch MCP boundary refused request");
    this.name = "M4PublicHttpBoundaryError";
  }
}

function data(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) {
    throw new M4PublicHttpBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new M4PublicHttpBoundaryError();
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new M4PublicHttpBoundaryError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new M4PublicHttpBoundaryError();
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new M4PublicHttpBoundaryError();
    }
    output[key] = descriptor.value;
  }
  return output;
}

function requestId(value: unknown): value is H2McpRequestId {
  return (typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value));
}

function methodOf(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) {
    throw new M4PublicHttpBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null || Object.getOwnPropertySymbols(value).length !== 0) {
    throw new M4PublicHttpBoundaryError();
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, "method");
  if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "string") {
    throw new M4PublicHttpBoundaryError();
  }
  return descriptor.value;
}

type ServerCallResult = Readonly<{
  acquisition: M4PublicEvidence | null;
  refusalCode: import("./public-http-fetch-policy.ts").M4FetchRefusalCode | null;
  effectTelemetry: M4EffectTelemetry;
}>;

function createM4McpServer(call: (targetRef: unknown, signal: AbortSignal) => Promise<ServerCallResult>): H2McpInProcessTransport {
  const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
  let state: "new" | "initialize_responded" | "ready" = "new";
  return Object.freeze({
    async sendRequest(request: H2McpRequest, options?: H2McpRequestOptions): Promise<H2McpResponse> {
      try {
        if (options?.signal?.aborted === true) throw new M4PublicHttpBoundaryError();
        const method = methodOf(request);
        if (state === "new") {
          const root = data(request, ["jsonrpc", "id", "method", "params"]);
          const params = data(root.params, ["protocolVersion", "capabilities", "clientInfo"]);
          const client = data(params.clientInfo, ["name", "version"]);
          data(params.capabilities, []);
          if (root.jsonrpc !== "2.0" || root.method !== "initialize" || !requestId(root.id) ||
              client.name !== "atliera-orchestrator" || client.version !== "0.1.0") {
            throw new M4PublicHttpBoundaryError();
          }
          state = "initialize_responded";
          return Object.freeze({ jsonrpc: "2.0", id: root.id, result: Object.freeze({
            protocolVersion: H2_MCP_SPEC_VERSION,
            capabilities: Object.freeze({ tools: Object.freeze({ listChanged: false }) }),
            serverInfo: Object.freeze({ name: "atliera-m4-public-http-fetch", version: "0.1.0" }),
          }) });
        }
        if (state !== "ready") throw new M4PublicHttpBoundaryError();
        if (method === "tools/list") {
          const root = data(request, ["jsonrpc", "id", "method"]);
          if (root.jsonrpc !== "2.0" || !requestId(root.id)) throw new M4PublicHttpBoundaryError();
          return Object.freeze({ jsonrpc: "2.0", id: root.id, result: Object.freeze({
            tools: Object.freeze([registry.descriptorSnapshot]),
          }) });
        }
        if (method === "tools/call") {
          const root = data(request, ["jsonrpc", "id", "method", "params"]);
          const params = data(root.params, ["name", "arguments"]);
          const args = data(params.arguments, ["targetRef"]);
          if (root.jsonrpc !== "2.0" || !requestId(root.id) || params.name !== M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID ||
              typeof args.targetRef !== "string") throw new M4PublicHttpBoundaryError();
          const signal = options?.signal ?? new AbortController().signal;
          const structured = signal.aborted
            ? Object.freeze({ acquisition: null, refusalCode: "timeout_or_cancelled" as const,
                effectTelemetry: withM4FailurePhase(M4_ZERO_EFFECT_TELEMETRY, "response_body_or_deadline") })
            : await call(args.targetRef, signal);
          return Object.freeze({ jsonrpc: "2.0", id: root.id, result: Object.freeze({
            content: Object.freeze([Object.freeze({ type: "text", text: JSON.stringify(structured) })]),
            structuredContent: structured,
            isError: structured.acquisition === null,
          }) });
        }
        throw new M4PublicHttpBoundaryError();
      } catch (error) {
        if (error instanceof M4PublicHttpBoundaryError) throw error;
        throw new M4PublicHttpBoundaryError();
      }
    },
    async sendNotification(notification: H2McpNotification): Promise<void> {
      const method = methodOf(notification);
      if (method === "notifications/initialized") {
        const root = data(notification, ["jsonrpc", "method"]);
        if (root.jsonrpc !== "2.0" || state !== "initialize_responded") throw new M4PublicHttpBoundaryError();
        state = "ready";
        return;
      }
      if (method === "notifications/cancelled") {
        const root = data(notification, ["jsonrpc", "method", "params"]);
        const params = data(root.params, ["requestId", "reason"]);
        if (root.jsonrpc !== "2.0" || !requestId(params.requestId) ||
            params.reason !== "request deadline exceeded") throw new M4PublicHttpBoundaryError();
        return;
      }
      throw new M4PublicHttpBoundaryError();
    },
  });
}

/** Proof/test-only server over immutable recorded exchange data. No callable dependency is accepted. */
export function createM4RecordedProofMcpServer(recordedExchange: unknown): H2McpInProcessTransport {
  const exchange: Readonly<M4ProofRecordedExchange> = snapshotM4ProofRecordedExchange(recordedExchange);
  return createM4McpServer(async (targetRef) => {
    const acquisition = acquireM4ProofRecordedEvidence(targetRef, exchange);
    return Object.freeze({ acquisition: acquisition.ok ? acquisition.evidence : null,
      refusalCode: acquisition.ok ? null : acquisition.refusalCode, effectTelemetry: M4_ZERO_EFFECT_TELEMETRY });
  });
}

export interface M4LiveMcpServerOptions {
  readonly activation: Readonly<M4GateBActivation>;
  readonly userAgent: unknown;
  readonly nowIso: () => string;
  readonly dependencies?: M4LiveDependencies;
}

/** Exact-target Gate B server. Its MCP caller can provide only the ratified targetRef. */
export function createM4SecGateBLiveMcpServer(options: M4LiveMcpServerOptions): H2McpInProcessTransport {
  const candidateUserAgent = options.userAgent;
  const admittedAt = options.nowIso();
  const activation = assertM4GateBActivationConsumed(options.activation, admittedAt);
  let userAgent: string;
  try { userAgent = assertM4GateBUserAgentMatchesActivation(candidateUserAgent, activation); }
  catch { throw new M4PublicHttpBoundaryError(); }
  const audit = validateM4SecUserAgent(userAgent);
  if (audit === null) throw new M4PublicHttpBoundaryError();
  try { claimM4GateBActivationExecution(activation, admittedAt); }
  catch { throw new M4PublicHttpBoundaryError(); }
  let called = false;
  return createM4McpServer(async (targetRef) => {
    if (called) return Object.freeze({ acquisition: null, refusalCode: "authorization_replay_refused" as const,
      effectTelemetry: Object.freeze({ ...M4_ZERO_EFFECT_TELEMETRY, userAgentAudit: audit }) });
    called = true;
    if (targetRef !== M4_TARGET_REF) return Object.freeze({ acquisition: null, refusalCode: "target_ref_refused" as const,
      effectTelemetry: Object.freeze({ ...M4_ZERO_EFFECT_TELEMETRY, userAgentAudit: audit }) });
    const acquired = await acquireM4SecLive(userAgent, options.dependencies);
    if (!acquired.ok) return Object.freeze({ acquisition: null, refusalCode: acquired.refusalCode,
      effectTelemetry: acquired.telemetry });
    let fetchedAt: string;
    try { fetchedAt = options.nowIso(); } catch {
      return Object.freeze({ acquisition: null, refusalCode: "transport_refused" as const,
        effectTelemetry: withM4FailurePhase(acquired.telemetry, "custody_finalization") });
    }
    if (!isStrictIsoTimestamp(fetchedAt)) return Object.freeze({ acquisition: null,
      refusalCode: "transport_refused" as const,
      effectTelemetry: withM4FailurePhase(acquired.telemetry, "custody_finalization") });
    const bytes = Buffer.from(acquired.bodyBase64, "base64");
    let quotedBodyText: string;
    try { quotedBodyText = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { return Object.freeze({ acquisition: null, refusalCode: "extraction_refused" as const,
      effectTelemetry: withM4FailurePhase(acquired.telemetry, "custody_finalization") }); }
    const evidence: M4PublicEvidence = Object.freeze({
      requestedTargetRef: M4_TARGET_REF, requestedUrl: M4_TARGET_URL, finalUrl: M4_TARGET_URL,
      sourceHost: M4_SOURCE_HOST, publisher: M4_PUBLISHER, targetPolicySha256: M4_TARGET_POLICY_SHA256,
      fetchedAt, httpStatus: acquired.status, contentType: acquired.contentType, byteCount: bytes.byteLength,
      responseSha256: acquired.responseSha256, bodyBase64: acquired.bodyBase64, quotedBodyText,
      trust: M4_CANONICAL_TARGET_POLICY.contentTrust,
      provenance: Object.freeze({ acquisitionCapability: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
        transport: "live_sec_one_shot", targetPolicyRef: M4_TARGET_POLICY_REF,
        targetPolicySha256: M4_TARGET_POLICY_SHA256, resolvedAddresses: Object.freeze([acquired.telemetry.selectedAddress!]),
        connectedAddress: acquired.telemetry.selectedAddress! }),
      custody: Object.freeze({ exactBytesPreserved: true, exactBytesEncoding: "base64", hashAlgorithm: "sha256",
        classification: "public_evidence" }),
    });
    try { extractM4SecEvidence(evidence); }
    catch { return Object.freeze({ acquisition: null, refusalCode: "extraction_refused" as const,
      effectTelemetry: withM4FailurePhase(acquired.telemetry, "custody_finalization") }); }
    return Object.freeze({ acquisition: evidence, refusalCode: null, effectTelemetry: acquired.telemetry });
  });
}
