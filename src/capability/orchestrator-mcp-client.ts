import { types as utilTypes } from "node:util";

import {
  H2_ECHO_CAPABILITY_ID,
  H2_MCP_SPEC_VERSION,
} from "./h2-registry.ts";
import type {
  H2EchoValue,
  H2McpInProcessTransport,
  H2McpNotification,
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

function denseArraySnapshot(value: unknown, maxLength: number): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    Object.getOwnPropertySymbols(value).length !== 0 ||
    !Number.isSafeInteger(value.length) ||
    value.length > maxLength
  ) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const propertyNames = Object.getOwnPropertyNames(value);
  if (propertyNames.length !== value.length + 1) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== value.length ||
    lengthDescriptor.enumerable !== false
  ) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const output: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new H2OrchestratorClientBoundaryError();
    }
    output.push(descriptor.value);
  }
  return Object.freeze(output);
}

function boundedString(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new H2OrchestratorClientBoundaryError();
  }
  return value;
}

function snapshotRequired(value: unknown): readonly string[] {
  return Object.freeze(
    denseArraySnapshot(value, 16).map((item) => boundedString(item, 128)),
  );
}

function snapshotValueSchema(value: unknown): Readonly<Record<string, unknown>> {
  const schema = ownData(value, ["type", "maxLength"]);
  if (
    schema.type !== "string" ||
    !Number.isSafeInteger(schema.maxLength) ||
    (schema.maxLength as number) < 0
  ) {
    throw new H2OrchestratorClientBoundaryError();
  }
  return Object.freeze({ type: schema.type, maxLength: schema.maxLength });
}

function snapshotObjectSchema(value: unknown): Readonly<Record<string, unknown>> {
  const schema = ownData(value, ["type", "additionalProperties", "required", "properties"]);
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    throw new H2OrchestratorClientBoundaryError();
  }
  const properties = ownData(schema.properties, ["value"]);
  return Object.freeze({
    type: "object",
    additionalProperties: false,
    required: snapshotRequired(schema.required),
    properties: Object.freeze({ value: snapshotValueSchema(properties.value) }),
  });
}

function snapshotToolDescriptor(value: unknown): Readonly<Record<string, unknown>> {
  const descriptor = ownData(value, [
    "name",
    "title",
    "description",
    "inputSchema",
    "outputSchema",
  ]);
  return Object.freeze({
    name: boundedString(descriptor.name, 128),
    title: boundedString(descriptor.title, 256),
    description: boundedString(descriptor.description, 1024),
    inputSchema: snapshotObjectSchema(descriptor.inputSchema),
    outputSchema: snapshotObjectSchema(descriptor.outputSchema),
  });
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
  const tools = denseArraySnapshot(result.tools, 1);
  if (tools.length !== 1) throw new H2OrchestratorClientBoundaryError();
  return snapshotToolDescriptor(tools[0]);
}

function snapshotCallResponse(response: unknown, requestId: H2McpRequestId): H2EchoValue {
  try {
    const root = responseRoot(response, requestId);
    const result = ownData(root.result, ["content", "structuredContent", "isError"]);
    const content = denseArraySnapshot(result.content, 1);
    if (content.length !== 1) throw new H2OrchestratorClientBoundaryError();
    const textContent = ownData(content[0], ["type", "text"]);
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
  #initialized = false;

  constructor(transport: H2McpInProcessTransport) {
    this.#transport = transport;
  }

  async #requestWithDeadline(
    request: H2McpRequest,
    maxDurationMs: number,
    cancellable: boolean,
  ): Promise<H2McpResponse> {
    if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs <= 0) {
      throw new H2OrchestratorClientBoundaryError();
    }
    const controller = cancellable ? new AbortController() : undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        if (cancellable && controller !== undefined) {
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
        }
        reject(new H2OrchestratorClientBoundaryError());
      }, maxDurationMs);
    });
    try {
      const requestPromise =
        controller === undefined
          ? this.#transport.sendRequest(request)
          : this.#transport.sendRequest(request, { signal: controller.signal });
      return await Promise.race([requestPromise, timeout]);
    } catch {
      throw new H2OrchestratorClientBoundaryError();
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  async #notificationWithDeadline(
    notification: H2McpNotification,
    maxDurationMs: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs <= 0) {
      throw new H2OrchestratorClientBoundaryError();
    }
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new H2OrchestratorClientBoundaryError()),
        maxDurationMs,
      );
    });
    try {
      await Promise.race([this.#transport.sendNotification(notification), timeout]);
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
        false,
      );
      snapshotInitializeResponse(response, requestId);
      await this.#notificationWithDeadline(
        { jsonrpc: "2.0", method: "notifications/initialized" },
        maxDurationMs,
      );
      this.#initialized = true;
    })();
    return this.#initializePromise;
  }

  async getLiveDescriptorSnapshot(maxDurationMs: number): Promise<unknown> {
    await this.#ensureInitialized(maxDurationMs);
    const requestId = "h2_tools_list";
    const response = await this.#requestWithDeadline(
      { jsonrpc: "2.0", id: requestId, method: "tools/list" },
      maxDurationMs,
      true,
    );
    return snapshotListToolsResponse(response, requestId);
  }

  async invokeInertEcho(
    requestId: string,
    input: H2EchoValue,
    maxDurationMs: number,
  ): Promise<H2EchoValue> {
    // Descriptor preflight establishes initialization. Re-awaiting the settled
    // promise here would create a microtask gap after the gate's expiry check.
    if (!this.#initialized) throw new H2OrchestratorClientBoundaryError();
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
      true,
    );
    return snapshotCallResponse(response, requestId);
  }
}
