import { types as utilTypes } from "node:util";

import {
  H2_ECHO_CAPABILITY_ID,
  H2_MCP_SPEC_VERSION,
  getH2CapabilityRegistryEntry,
} from "./h2-registry.ts";
import type {
  H2EchoValue,
  H2McpCallRequest,
  H2McpInProcessTransport,
  H2McpNotification,
  H2McpRequest,
  H2McpRequestId,
  H2McpRequestOptions,
  H2McpResponse,
} from "./h2-mcp-protocol.ts";

export class H2InertEchoBoundaryError extends Error {
  constructor() {
    super("inert echo MCP boundary refused request");
    this.name = "H2InertEchoBoundaryError";
  }
}

function exactPlainDataObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    throw new H2InertEchoBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new H2InertEchoBoundaryError();
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new H2InertEchoBoundaryError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new H2InertEchoBoundaryError();
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new H2InertEchoBoundaryError();
    }
    output[key] = descriptor.value;
  }
  return output;
}

function requestMethod(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    throw new H2InertEchoBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new H2InertEchoBoundaryError();
  const descriptor = Object.getOwnPropertyDescriptor(value, "method");
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true ||
    typeof descriptor.value !== "string"
  ) {
    throw new H2InertEchoBoundaryError();
  }
  return descriptor.value;
}

function validRequestId(value: unknown): value is H2McpRequestId {
  return (
    (typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

export function snapshotH2EchoValue(value: unknown): H2EchoValue {
  try {
    const input = exactPlainDataObject(value, ["value"]);
    if (typeof input.value !== "string" || input.value.length > 256) {
      throw new H2InertEchoBoundaryError();
    }
    return Object.freeze({ value: input.value });
  } catch (error) {
    if (error instanceof H2InertEchoBoundaryError) throw error;
    throw new H2InertEchoBoundaryError();
  }
}

function snapshotInitializeRequest(request: unknown): { readonly id: H2McpRequestId } {
  const root = exactPlainDataObject(request, ["jsonrpc", "id", "method", "params"]);
  const params = exactPlainDataObject(root.params, ["protocolVersion", "capabilities", "clientInfo"]);
  const capabilities = exactPlainDataObject(params.capabilities, []);
  const clientInfo = exactPlainDataObject(params.clientInfo, ["name", "version"]);
  if (
    root.jsonrpc !== "2.0" ||
    !validRequestId(root.id) ||
    root.method !== "initialize" ||
    params.protocolVersion !== H2_MCP_SPEC_VERSION ||
    Object.keys(capabilities).length !== 0 ||
    clientInfo.name !== "atliera-orchestrator" ||
    clientInfo.version !== "0.1.0"
  ) {
    throw new H2InertEchoBoundaryError();
  }
  return { id: root.id };
}

function snapshotListToolsRequest(request: unknown): { readonly id: H2McpRequestId } {
  const root = exactPlainDataObject(request, ["jsonrpc", "id", "method"]);
  if (root.jsonrpc !== "2.0" || !validRequestId(root.id) || root.method !== "tools/list") {
    throw new H2InertEchoBoundaryError();
  }
  return { id: root.id };
}

function snapshotCallRequest(request: unknown): {
  readonly id: H2McpRequestId;
  readonly arguments: H2EchoValue;
} {
  const root = exactPlainDataObject(request, ["jsonrpc", "id", "method", "params"]);
  const params = exactPlainDataObject(root.params, ["name", "arguments"]);
  if (
    root.jsonrpc !== "2.0" ||
    !validRequestId(root.id) ||
    root.method !== "tools/call" ||
    params.name !== H2_ECHO_CAPABILITY_ID
  ) {
    throw new H2InertEchoBoundaryError();
  }
  return { id: root.id, arguments: snapshotH2EchoValue(params.arguments) };
}

function assertNotAborted(options?: H2McpRequestOptions): void {
  if (options?.signal?.aborted === true) throw new H2InertEchoBoundaryError();
}

export function createH2InertEchoMcpServer(): H2McpInProcessTransport {
  const registryEntry = getH2CapabilityRegistryEntry(H2_ECHO_CAPABILITY_ID);
  if (registryEntry === undefined) throw new Error("H2 inert echo registry entry missing");
  let state: "new" | "initialize_responded" | "ready" = "new";

  return Object.freeze({
    async sendRequest(
      request: H2McpRequest,
      options?: H2McpRequestOptions,
    ): Promise<H2McpResponse> {
      try {
        assertNotAborted(options);
        const method = requestMethod(request);
        if (state === "new") {
          if (method !== "initialize") throw new H2InertEchoBoundaryError();
          const initialized = snapshotInitializeRequest(request);
          state = "initialize_responded";
          return Object.freeze({
            jsonrpc: "2.0" as const,
            id: initialized.id,
            result: Object.freeze({
              protocolVersion: H2_MCP_SPEC_VERSION,
              capabilities: Object.freeze({
                tools: Object.freeze({ listChanged: false as const }),
              }),
              serverInfo: Object.freeze({
                name: "atliera-h2-inert-echo",
                version: "0.1.0",
              }),
            }),
          });
        }
        if (state !== "ready") throw new H2InertEchoBoundaryError();
        if (method === "tools/list") {
          const listed = snapshotListToolsRequest(request);
          return Object.freeze({
            jsonrpc: "2.0" as const,
            id: listed.id,
            result: Object.freeze({ tools: Object.freeze([registryEntry.descriptorSnapshot]) }),
          });
        }
        if (method === "tools/call") {
          const called = snapshotCallRequest(request as H2McpCallRequest);
          assertNotAborted(options);
          const echoed = Object.freeze({ value: called.arguments.value });
          return Object.freeze({
            jsonrpc: "2.0" as const,
            id: called.id,
            result: Object.freeze({
              content: Object.freeze([
                Object.freeze({ type: "text" as const, text: JSON.stringify(echoed) }),
              ]),
              structuredContent: echoed,
              isError: false as const,
            }),
          });
        }
        throw new H2InertEchoBoundaryError();
      } catch (error) {
        if (error instanceof H2InertEchoBoundaryError) throw error;
        throw new H2InertEchoBoundaryError();
      }
    },

    async sendNotification(notification: H2McpNotification): Promise<void> {
      try {
        const method = requestMethod(notification);
        if (method === "notifications/initialized") {
          const root = exactPlainDataObject(notification, ["jsonrpc", "method"]);
          if (root.jsonrpc !== "2.0" || state !== "initialize_responded") {
            throw new H2InertEchoBoundaryError();
          }
          state = "ready";
          return;
        }
        if (method === "notifications/cancelled") {
          const root = exactPlainDataObject(notification, ["jsonrpc", "method", "params"]);
          const params = exactPlainDataObject(root.params, ["requestId", "reason"]);
          if (
            root.jsonrpc !== "2.0" ||
            !validRequestId(params.requestId) ||
            params.reason !== "request deadline exceeded"
          ) {
            throw new H2InertEchoBoundaryError();
          }
          return;
        }
        throw new H2InertEchoBoundaryError();
      } catch (error) {
        if (error instanceof H2InertEchoBoundaryError) throw error;
        throw new H2InertEchoBoundaryError();
      }
    },
  });
}
