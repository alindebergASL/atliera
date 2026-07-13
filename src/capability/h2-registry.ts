import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";

export const H2_MCP_SPEC_VERSION = "2025-11-25" as const;
export const H2_ECHO_CAPABILITY_ID = "system.inert_echo_v1" as const;
export const H2_ECHO_SERVER_ID = "atliera.h2.in_process_echo" as const;
export const M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID = "public_http_fetch_v1" as const;
export const M4_PUBLIC_HTTP_FETCH_SERVER_ID = "atliera.m4.first_party_public_http_fetch" as const;

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

export interface H2EchoCapabilityRegistryEntry {
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

export interface M4PublicHttpFetchDescriptor {
  readonly name: typeof M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID;
  readonly title: "Public HTTP fetch v1";
  readonly description: "Fetches one ratified public HTTPS target as quoted untrusted evidence";
  readonly inputSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["targetRef"];
    readonly properties: {
      readonly targetRef: { readonly type: "string"; readonly enum: readonly ["sec_fedex_submissions"] };
    };
  };
  readonly outputSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["acquisition", "refusalCode", "effectTelemetry"];
    readonly properties: {
      readonly acquisition: { readonly type: readonly ["object", "null"] };
      readonly refusalCode: { readonly type: readonly ["string", "null"] };
      readonly effectTelemetry: {
        readonly type: "object";
        readonly additionalProperties: false;
        readonly required: readonly ["dnsAttempts", "requestAttempts", "connectionAttempts", "liveNetworkEgress",
          "bytesReceived", "selectedAddress", "lookupCallbacks", "retryCount", "responseSha256", "userAgentAudit"];
        readonly properties: Readonly<Record<string, unknown>>;
      };
    };
  };
}

export interface M4PublicHttpFetchRegistryEntry {
  readonly capabilityId: typeof M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID;
  readonly serverIdentity: typeof M4_PUBLIC_HTTP_FETCH_SERVER_ID;
  readonly protocol: "mcp";
  readonly protocolSpecVersion: typeof H2_MCP_SPEC_VERSION;
  readonly descriptorSnapshot: M4PublicHttpFetchDescriptor;
  readonly descriptorSha256: string;
  readonly targetPolicySha256: typeof M4_TARGET_POLICY_SHA256;
  readonly allowedMediationLevels: readonly ["L0"];
  readonly budgetDefaults: {
    readonly maxTargets: 1;
    readonly maxInputBytes: 128;
    readonly maxOutputBytes: 8000000;
    readonly maxDurationMs: 10000;
    readonly maxBodyBytes: 1048576;
    readonly retryBudget: 0;
    readonly maxInvocations: 1;
    readonly redirectLimit: 0;
  };
  readonly sandboxProfile: {
    readonly profileId: "m4-exact-target-gate-b-public-https";
    readonly transport: "in-process";
    readonly orchestratorSoleClient: true;
    readonly networkAllowed: true;
    readonly publicHttpsOnly: true;
    readonly credentialsAllowed: false;
    readonly cookiesAllowed: false;
    readonly privateDataAllowed: false;
    readonly filesystemAllowed: false;
    readonly environmentAllowed: false;
    readonly providerCallsAllowed: false;
    readonly databaseAllowed: false;
    readonly subprocessAllowed: false;
    readonly deploymentAllowed: false;
  };
}

export type H2CapabilityRegistryEntry =
  | H2EchoCapabilityRegistryEntry
  | M4PublicHttpFetchRegistryEntry;

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

const registryEntry = deepFreeze<H2EchoCapabilityRegistryEntry>({
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

const m4DescriptorSnapshot = deepFreeze<M4PublicHttpFetchDescriptor>({
  name: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
  title: "Public HTTP fetch v1",
  description: "Fetches one ratified public HTTPS target as quoted untrusted evidence",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["targetRef"],
    properties: { targetRef: { type: "string", enum: ["sec_fedex_submissions"] } },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["acquisition", "refusalCode", "effectTelemetry"],
    properties: { acquisition: { type: ["object", "null"] }, refusalCode: { type: ["string", "null"] },
      effectTelemetry: { type: "object", additionalProperties: false,
        required: ["dnsAttempts", "requestAttempts", "connectionAttempts", "liveNetworkEgress", "bytesReceived",
          "selectedAddress", "lookupCallbacks", "retryCount", "responseSha256", "userAgentAudit"],
        properties: {
          dnsAttempts: { type: "integer", enum: [0, 1] }, requestAttempts: { type: "integer", enum: [0, 1] },
          connectionAttempts: { type: "integer", enum: [0, 1] }, liveNetworkEgress: { type: "integer", enum: [0, 1] },
          bytesReceived: { type: "integer", minimum: 0, maximum: 1048576 },
          selectedAddress: { type: ["string", "null"] }, lookupCallbacks: { type: "integer", enum: [0, 1] },
          retryCount: { type: "integer", enum: [0] }, responseSha256: { type: ["string", "null"] },
          userAgentAudit: { type: ["object", "null"] },
        } } },
  },
});

const m4RegistryEntry = deepFreeze<M4PublicHttpFetchRegistryEntry>({
  capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
  serverIdentity: M4_PUBLIC_HTTP_FETCH_SERVER_ID,
  protocol: "mcp",
  protocolSpecVersion: H2_MCP_SPEC_VERSION,
  descriptorSnapshot: m4DescriptorSnapshot,
  descriptorSha256: sha256Canonical(m4DescriptorSnapshot),
  targetPolicySha256: M4_TARGET_POLICY_SHA256,
  allowedMediationLevels: ["L0"],
  budgetDefaults: {
    maxTargets: 1,
    maxInputBytes: 128,
    maxOutputBytes: 8000000,
    maxDurationMs: 10000,
    maxBodyBytes: 1048576,
    retryBudget: 0,
    maxInvocations: 1,
    redirectLimit: 0,
  },
  sandboxProfile: {
    profileId: "m4-exact-target-gate-b-public-https",
    transport: "in-process",
    orchestratorSoleClient: true,
    networkAllowed: true,
    publicHttpsOnly: true,
    credentialsAllowed: false,
    cookiesAllowed: false,
    privateDataAllowed: false,
    filesystemAllowed: false,
    environmentAllowed: false,
    providerCallsAllowed: false,
    databaseAllowed: false,
    subprocessAllowed: false,
    deploymentAllowed: false,
  },
});

if (sha256Canonical(M4_CANONICAL_TARGET_POLICY) !== M4_TARGET_POLICY_SHA256 ||
    m4RegistryEntry.targetPolicySha256 !== M4_TARGET_POLICY_SHA256) {
  throw new Error("M4 registry target policy hash mismatch");
}

export const H2_CAPABILITY_REGISTRY: readonly [H2EchoCapabilityRegistryEntry, M4PublicHttpFetchRegistryEntry] = Object.freeze([
  registryEntry,
  m4RegistryEntry,
]) as readonly [H2EchoCapabilityRegistryEntry, M4PublicHttpFetchRegistryEntry];

export function getH2CapabilityRegistryEntry(capabilityId: typeof H2_ECHO_CAPABILITY_ID): H2EchoCapabilityRegistryEntry;
export function getH2CapabilityRegistryEntry(capabilityId: typeof M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID): M4PublicHttpFetchRegistryEntry;
export function getH2CapabilityRegistryEntry(capabilityId: string): H2CapabilityRegistryEntry | undefined;
export function getH2CapabilityRegistryEntry(capabilityId: string): H2CapabilityRegistryEntry | undefined {
  if (capabilityId === H2_ECHO_CAPABILITY_ID) return registryEntry;
  if (capabilityId === M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID) return m4RegistryEntry;
  return undefined;
}
