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
  snapshotM4ProofRecordedExchange,
  type M4AcquisitionResult,
  type M4ProofRecordedExchange,
} from "./public-http-fetch-policy.ts";

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

/** Proof/test-only server over immutable recorded exchange data. No callable dependency is accepted. */
export function createM4RecordedProofMcpServer(
  recordedExchange: unknown,
): H2McpInProcessTransport {
  const exchange: Readonly<M4ProofRecordedExchange> = snapshotM4ProofRecordedExchange(recordedExchange);
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
          const acquisition: M4AcquisitionResult = signal.aborted
            ? Object.freeze({ ok: false, refusalCode: "timeout_or_cancelled" as const })
            : acquireM4ProofRecordedEvidence(args.targetRef, exchange);
          const structured = Object.freeze({ acquisition: acquisition.ok ? acquisition.evidence : null,
            refusalCode: acquisition.ok ? null : acquisition.refusalCode });
          return Object.freeze({ jsonrpc: "2.0", id: root.id, result: Object.freeze({
            content: Object.freeze([Object.freeze({ type: "text", text: JSON.stringify(structured) })]),
            structuredContent: structured,
            isError: !acquisition.ok,
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
