import { types as utilTypes } from "node:util";

import {
  H2_ECHO_CAPABILITY_ID,
  H2_MCP_SPEC_VERSION,
} from "./h2-registry.ts";
import type {
  H2EchoValue,
  H2McpInProcessTransport,
  H2McpRequest,
  H2McpRequestId,
  H2McpResponse,
} from "./h2-mcp-protocol.ts";

class H2OrchestratorClientBoundaryError extends Error {
  constructor() {
    super("orchestrator MCP client refused response");
    this.name = "H2OrchestratorClientBoundaryError";
  }
}

function ownData(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new H2OrchestratorClientBoundaryError();
  }
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new H2OrchestratorClientBoundaryError();
    }
    out[key] = descriptor.value;
  }
  return out;
}

function responseRoot(response: unknown, requestId: H2McpRequestId): Record<string, unknown> {
  const root = ownData(response, ["jsonrpc", "id", "result"]);
  if (root.jsonrpc !== "2.0" || root.id !== requestId) {
    throw new H2OrchestratorClientBoundaryError();
  }
  return root;
}

function snapshotInitializeResponse(response: unknown, requestId: H2McpRequestId): void {
  const root = responseRoot(response, requestId);
  const result = ownData(root.result, ["protocolVersion", "capabilities", "serverInfo"]);
  const capabilities = ownData(result.capabilities, ["tools"]);
  const tools = ownData(capabilities.tools, ["listChanged"]);
  const serverInfo = ownData(result.serverInfo, ["name", "version"]);
  if (
    result.protocolVersion !== H2_MCP_SPEC_VERSION ||
    tools.listChanged !== false ||
    serverInfo.name !== "atliera-h2-inert-echo" ||
    serverInfo.version !== "0.1.0"
  ) {
    throw new H2OrchestratorClientBoundaryError();
  }
}

function snapshotListToolsResponse(response: unknown, requestId: H2McpRequestId): unknown {
  const root = responseRoot(response, requestId);
  const result = ownData(root.result, ["tools"]);
  if (!Array.isArray(result.tools) || utilTypes.isProxy(result.tools) || result.tools.length !== 1) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const descriptor = result.tools[0];
  ownData(descriptor, ["name", "title", "description", "inputSchema", "outputSchema"]);
  return descriptor;
}

function snapshotCallResponse(response: unknown, requestId: H2McpRequestId): H2EchoValue {
  try {
    const root = responseRoot(response, requestId);
    const result = ownData(root.result, ["content", "structuredContent", "isError"]);
    if (!Array.isArray(result.content) || utilTypes.isProxy(result.content) || result.content.length !== 1) {
      throw new H2OrchestratorClientBoundaryError();
    }
    const textContent = ownData(result.content[0], ["type", "text"]);
    const structured = ownData(result.structuredContent, ["value"]);
    if (
      textContent.type !== "text" ||
      typeof textContent.text !== "string" ||
      result.isError !== false ||
      typeof structured.value !== "string" ||
      structured.value.length > 256 ||
      textContent.text !== JSON.stringify({ value: structured.value })
    ) {
      throw new H2OrchestratorClientBoundaryError();
    }
    return Object.freeze({ value: structured.value });
  } catch (error) {
    if (error instanceof H2OrchestratorClientBoundaryError) throw error;
    throw new H2OrchestratorClientBoundaryError();
  }
}

export class H2OrchestratorMcpClient {
  readonly #transport: H2McpInProcessTransport;
  #initializePromise: Promise<void> | undefined;

  constructor(transport: H2McpInProcessTransport) {
    this.#transport = transport;
  }

  async #requestWithDeadline(
    request: H2McpRequest,
    maxDurationMs: number,
  ): Promise<H2McpResponse> {
    if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs <= 0) {
      throw new H2OrchestratorClientBoundaryError();
    }
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        void this.#transport
          .sendNotification({
            jsonrpc: "2.0",
            method: "notifications/cancelled",
            params: {
              requestId: request.id,
              reason: "request deadline exceeded",
            },
          })
          .catch(() => undefined);
        reject(new H2OrchestratorClientBoundaryError());
      }, maxDurationMs);
    });
    try {
      return await Promise.race([
        this.#transport.sendRequest(request, { signal: controller.signal }),
        timeout,
      ]);
    } catch {
      throw new H2OrchestratorClientBoundaryError();
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  async #ensureInitialized(maxDurationMs: number): Promise<void> {
    if (this.#initializePromise !== undefined) return this.#initializePromise;
    this.#initializePromise = (async () => {
      const requestId = "h2_initialize";
      const response = await this.#requestWithDeadline(
        {
          jsonrpc: "2.0",
          id: requestId,
          method: "initialize",
          params: {
            protocolVersion: H2_MCP_SPEC_VERSION,
            capabilities: {},
            clientInfo: {
              name: "atliera-orchestrator",
              version: "0.1.0",
            },
          },
        },
        maxDurationMs,
      );
      snapshotInitializeResponse(response, requestId);
      await this.#transport.sendNotification({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
    })();
    return this.#initializePromise;
  }

  async getLiveDescriptorSnapshot(maxDurationMs: number): Promise<unknown> {
    await this.#ensureInitialized(maxDurationMs);
    const requestId = "h2_tools_list";
    const response = await this.#requestWithDeadline(
      { jsonrpc: "2.0", id: requestId, method: "tools/list" },
      maxDurationMs,
    );
    return snapshotListToolsResponse(response, requestId);
  }

  async invokeInertEcho(
    requestId: string,
    input: H2EchoValue,
    maxDurationMs: number,
  ): Promise<H2EchoValue> {
    await this.#ensureInitialized(maxDurationMs);
    const response = await this.#requestWithDeadline(
      {
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/call",
        params: {
          name: H2_ECHO_CAPABILITY_ID,
          arguments: input,
        },
      },
      maxDurationMs,
    );
    return snapshotCallResponse(response, requestId);
  }
}
