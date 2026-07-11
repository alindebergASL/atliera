import { types as utilTypes } from "node:util";

import { H2_ECHO_CAPABILITY_ID } from "./h2-registry.ts";
import type {
  H2EchoValue,
  H2McpInProcessTransport,
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

function snapshotResponse(response: unknown, requestId: string): H2EchoValue {
  try {
    const root = ownData(response, ["jsonrpc", "id", "result"]);
    const result = ownData(root.result, ["structuredContent", "isError"]);
    const content = ownData(result.structuredContent, ["value"]);
    if (
      root.jsonrpc !== "2.0" ||
      root.id !== requestId ||
      result.isError !== false ||
      typeof content.value !== "string" ||
      content.value.length > 256
    ) {
      throw new H2OrchestratorClientBoundaryError();
    }
    return Object.freeze({ value: content.value });
  } catch (error) {
    if (error instanceof H2OrchestratorClientBoundaryError) throw error;
    throw new H2OrchestratorClientBoundaryError();
  }
}

export class H2OrchestratorMcpClient {
  readonly #transport: H2McpInProcessTransport;

  constructor(transport: H2McpInProcessTransport) {
    this.#transport = transport;
  }

  getLiveDescriptorSnapshot(): unknown {
    return this.#transport.getDescriptorSnapshot();
  }

  async invokeInertEcho(requestId: string, input: H2EchoValue): Promise<H2EchoValue> {
    const response = await this.#transport.call({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: {
        name: H2_ECHO_CAPABILITY_ID,
        arguments: input,
      },
    });
    return snapshotResponse(response, requestId);
  }
}
