import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

export const H2_MCP_SPEC_VERSION = "2025-11-25" as const;
export const H2_ECHO_CAPABILITY_ID = "system.inert_echo_v1" as const;
export const H2_ECHO_SERVER_ID = "atliera.h2.in_process_echo" as const;

export interface H2CapabilityBudgetDefaults {
  readonly maxInputBytes: 512;
  readonly maxOutputBytes: 512;
  readonly maxDurationMs: 1000;
  readonly retryBudget: 0;
  readonly maxInvocations: 1;
}

export interface H2CapabilityDescriptor {
  readonly name: typeof H2_ECHO_CAPABILITY_ID;
  readonly title: "Inert echo";
  readonly description: "Returns one bounded plain-data string without side effects";
  readonly inputSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["value"];
    readonly properties: {
      readonly value: {
        readonly type: "string";
        readonly maxLength: 256;
      };
    };
  };
  readonly outputSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["value"];
    readonly properties: {
      readonly value: {
        readonly type: "string";
        readonly maxLength: 256;
      };
    };
  };
}

export interface H2CapabilityRegistryEntry {
  readonly capabilityId: typeof H2_ECHO_CAPABILITY_ID;
  readonly serverIdentity: typeof H2_ECHO_SERVER_ID;
  readonly protocol: "mcp";
  readonly protocolSpecVersion: typeof H2_MCP_SPEC_VERSION;
  readonly descriptorSnapshot: H2CapabilityDescriptor;
  readonly descriptorSha256: string;
  readonly allowedMediationLevels: readonly ["L0"];
  readonly budgetDefaults: H2CapabilityBudgetDefaults;
  readonly sandboxProfile: {
    readonly profileId: "h2-inert-no-effects";
    readonly transport: "in-process";
    readonly orchestratorSoleClient: true;
    readonly networkAllowed: false;
    readonly filesystemAllowed: false;
    readonly environmentAllowed: false;
    readonly providerCallsAllowed: false;
    readonly databaseAllowed: false;
    readonly subprocessAllowed: false;
    readonly deploymentAllowed: false;
  };
}

const SAFE_JSON_OBJECT_PROTOTYPES = new Set<unknown>([Object.prototype, null]);

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    if (utilTypes.isProxy(value) || !SAFE_JSON_OBJECT_PROTOTYPES.has(Object.getPrototypeOf(value))) {
      throw new Error("canonical JSON requires plain data");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length !== 0) throw new Error("canonical JSON requires plain data");
    const keys = Object.keys(descriptors).sort();
    return `{${keys
      .map((key) => {
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new Error("canonical JSON requires enumerable data properties");
        }
        return `${JSON.stringify(key)}:${canonicalJson(descriptor.value)}`;
      })
      .join(",")}}`;
  }
  throw new Error("canonical JSON contains a non-JSON value");
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

const descriptorSnapshot = deepFreeze<H2CapabilityDescriptor>({
  name: H2_ECHO_CAPABILITY_ID,
  title: "Inert echo",
  description: "Returns one bounded plain-data string without side effects",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["value"],
    properties: { value: { type: "string", maxLength: 256 } },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["value"],
    properties: { value: { type: "string", maxLength: 256 } },
  },
});

const registryEntry = deepFreeze<H2CapabilityRegistryEntry>({
  capabilityId: H2_ECHO_CAPABILITY_ID,
  serverIdentity: H2_ECHO_SERVER_ID,
  protocol: "mcp",
  protocolSpecVersion: H2_MCP_SPEC_VERSION,
  descriptorSnapshot,
  descriptorSha256: sha256Canonical(descriptorSnapshot),
  allowedMediationLevels: ["L0"],
  budgetDefaults: {
    maxInputBytes: 512,
    maxOutputBytes: 512,
    maxDurationMs: 1000,
    retryBudget: 0,
    maxInvocations: 1,
  },
  sandboxProfile: {
    profileId: "h2-inert-no-effects",
    transport: "in-process",
    orchestratorSoleClient: true,
    networkAllowed: false,
    filesystemAllowed: false,
    environmentAllowed: false,
    providerCallsAllowed: false,
    databaseAllowed: false,
    subprocessAllowed: false,
    deploymentAllowed: false,
  },
});

export const H2_CAPABILITY_REGISTRY: readonly [H2CapabilityRegistryEntry] = Object.freeze([
  registryEntry,
]) as readonly [H2CapabilityRegistryEntry];

export function getH2CapabilityRegistryEntry(capabilityId: string): H2CapabilityRegistryEntry | undefined {
  return capabilityId === H2_ECHO_CAPABILITY_ID ? registryEntry : undefined;
}
