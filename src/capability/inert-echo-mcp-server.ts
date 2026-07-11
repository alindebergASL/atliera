import { types as utilTypes } from "node:util";

import {
  H2_ECHO_CAPABILITY_ID,
  getH2CapabilityRegistryEntry,
} from "./h2-registry.ts";
import type {
  H2EchoValue,
  H2McpCallRequest,
  H2McpCallResponse,
  H2McpInProcessTransport,
} from "./h2-mcp-protocol.ts";

export class H2InertEchoBoundaryError extends Error {
  constructor() {
    super("inert echo boundary refused request");
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

function snapshotCallRequest(request: unknown): {
  readonly id: string;
  readonly name: string;
  readonly arguments: H2EchoValue;
} {
  try {
    const root = exactPlainDataObject(request, ["jsonrpc", "id", "method", "params"]);
    const params = exactPlainDataObject(root.params, ["name", "arguments"]);
    if (
      root.jsonrpc !== "2.0" ||
      typeof root.id !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(root.id) ||
      root.method !== "tools/call" ||
      params.name !== H2_ECHO_CAPABILITY_ID
    ) {
      throw new H2InertEchoBoundaryError();
    }
    return {
      id: root.id,
      name: params.name,
      arguments: snapshotH2EchoValue(params.arguments),
    };
  } catch (error) {
    if (error instanceof H2InertEchoBoundaryError) throw error;
    throw new H2InertEchoBoundaryError();
  }
}

export function createH2InertEchoMcpServer(): H2McpInProcessTransport {
  const registryEntry = getH2CapabilityRegistryEntry(H2_ECHO_CAPABILITY_ID);
  if (registryEntry === undefined) throw new Error("H2 inert echo registry entry missing");

  return Object.freeze({
    getDescriptorSnapshot(): unknown {
      return registryEntry.descriptorSnapshot;
    },
    async call(request: H2McpCallRequest): Promise<H2McpCallResponse> {
      const snapshotted = snapshotCallRequest(request);
      const echoed = Object.freeze({ value: snapshotted.arguments.value });
      return Object.freeze({
        jsonrpc: "2.0" as const,
        id: snapshotted.id,
        result: Object.freeze({
          structuredContent: echoed,
          isError: false as const,
        }),
      });
    },
  });
}
