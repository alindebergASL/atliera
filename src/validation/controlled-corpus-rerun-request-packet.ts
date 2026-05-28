import {
  CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION,
  type ControlledCorpusGraphProposeBlockedAction,
  type ControlledCorpusGraphProposePromptContract,
  type ControlledCorpusGraphProposePromptSchemaVersion,
  type ControlledCorpusGraphProposeRole,
  buildControlledCorpusGraphProposePromptContract,
} from "../agent/controlled-corpus-graph-propose-contract.ts";
import type { ModelProviderOperation } from "../model/provider.ts";

export const CONTROLLED_CORPUS_RERUN_REQUEST_PACKET_SCHEMA_VERSION = "controlled_corpus_rerun_request_packet.v1" as const;

export type ControlledCorpusRerunRequestPacketSchemaVersion = typeof CONTROLLED_CORPUS_RERUN_REQUEST_PACKET_SCHEMA_VERSION;
export type ControlledCorpusRerunRequestPacketMode = "no-spend-request-packet";

export interface ControlledCorpusRerunRoleRequestInput {
  readonly role: ControlledCorpusGraphProposeRole;
  readonly accountRef: string;
  readonly inputGraphRef: string;
}

export interface BuildControlledCorpusRerunRequestPacketInput {
  readonly packetId: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly corpusRef: string;
  readonly maxAccounts: number;
  readonly maxOutputTokensPerAccount: number;
  readonly temperature: number;
  readonly roleRequests: readonly ControlledCorpusRerunRoleRequestInput[];
}

export interface ControlledCorpusRerunRequestPreview {
  readonly operation: ModelProviderOperation;
  readonly mode: "model";
  readonly model: "pending-live-run-approval";
  readonly prompt: string;
  readonly inputGraphRef: string;
  readonly idempotencyKey: string;
  readonly maxOutputTokens: number;
  readonly temperature: number;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ControlledCorpusRerunRoleRequest {
  readonly role: ControlledCorpusGraphProposeRole;
  readonly account_ref: string;
  readonly input_graph_ref: string;
  readonly operation: ModelProviderOperation;
  readonly prompt_contract: ControlledCorpusGraphProposePromptContract;
  readonly request_preview: ControlledCorpusRerunRequestPreview;
}

export interface ControlledCorpusRerunRequestPacket {
  readonly schema_version: ControlledCorpusRerunRequestPacketSchemaVersion;
  readonly prompt_schema_version: ControlledCorpusGraphProposePromptSchemaVersion;
  readonly mode: ControlledCorpusRerunRequestPacketMode;
  readonly operation: ModelProviderOperation;
  readonly packet_id: string;
  readonly requested_by: string;
  readonly requested_at: string;
  readonly corpus_ref: string;
  readonly max_accounts: number;
  readonly max_output_tokens_per_account: number;
  readonly temperature: number;
  readonly roles: readonly ControlledCorpusRerunRoleRequest[];
  readonly approves_live_provider_call: false;
  readonly approves_provider_spend: false;
  readonly approves_expansion_or_comparison: false;
  readonly launch_readiness_claim: false;
  readonly requires_separate_live_run_approval: true;
  readonly blocked_next_actions: readonly ControlledCorpusGraphProposeBlockedAction[];
}

const REQUIRED_ROLES: readonly ControlledCorpusGraphProposeRole[] = ["representative", "edge-case", "calibration"];
const BLOCKED_NEXT_ACTIONS: readonly ControlledCorpusGraphProposeBlockedAction[] = [
  "live_provider_rerun",
  "provider_comparison",
  "corpus_expansion",
  "launch_readiness_claim",
  "product_readiness_claim",
];
const SAFE_LOGICAL_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;
const SAFE_CORPUS_REF = /^external-corpus\/[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const TOP_LEVEL_KEYS = new Set([
  "packetId",
  "requestedBy",
  "requestedAt",
  "corpusRef",
  "maxAccounts",
  "maxOutputTokensPerAccount",
  "temperature",
  "roleRequests",
]);
const ROLE_REQUEST_KEYS = new Set(["role", "accountRef", "inputGraphRef"]);
const FORBIDDEN_INHERITED_KEY_PATTERN = /(?:provider|apiKey|apikey|api_key|credential|secret|token|endpoint|baseUrl|base_url|client|transport)/i;

function inheritedKeyIsForbidden(key: PropertyKey): boolean {
  if (typeof key === "string") return FORBIDDEN_INHERITED_KEY_PATTERN.test(key);
  if (typeof key === "symbol") return FORBIDDEN_INHERITED_KEY_PATTERN.test(key.description ?? "");
  return FORBIDDEN_INHERITED_KEY_PATTERN.test(String(key));
}

function assertNoForbiddenInheritedKeys(value: object): void {
  try {
    let prototype = Object.getPrototypeOf(value);
    while (prototype !== null) {
      for (const key of Reflect.ownKeys(prototype)) {
        if (inheritedKeyIsForbidden(key)) rejectPacket();
      }
      prototype = Object.getPrototypeOf(prototype);
    }
  } catch {
    rejectPacket();
  }
}

function rejectPacket(): never {
  throw new Error("controlled corpus rerun request packet rejected");
}

function readRecord(value: unknown): Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) rejectPacket();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) rejectPacket();
    assertNoForbiddenInheritedKeys(value);
    return value as Record<string, unknown>;
  } catch {
    rejectPacket();
  }
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  try {
    for (const key of Reflect.ownKeys(record)) {
      if (typeof key !== "string" || !allowed.has(key)) rejectPacket();
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) rejectPacket();
    }
  } catch {
    rejectPacket();
  }
}

function readProperty(record: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) rejectPacket();
    return descriptor.value;
  } catch {
    rejectPacket();
  }
}

function readArrayElement(value: unknown[], index: number): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) rejectPacket();
    return descriptor.value;
  } catch {
    rejectPacket();
  }
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = readProperty(record, key);
  if (typeof value !== "string" || value.trim() === "") rejectPacket();
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = readProperty(record, key);
  if (typeof value !== "number" || !Number.isFinite(value)) rejectPacket();
  return value;
}

function readRole(value: unknown): ControlledCorpusGraphProposeRole {
  if (!REQUIRED_ROLES.includes(value as ControlledCorpusGraphProposeRole)) rejectPacket();
  return value as ControlledCorpusGraphProposeRole;
}

function assertArrayShape(value: unknown[], length: number): void {
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || descriptor.enumerable || !("value" in descriptor)) rejectPacket();
        continue;
      }
      if (typeof key !== "string" || !/^(?:0|[1-9]\d*)$/.test(key)) rejectPacket();
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= length) rejectPacket();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) rejectPacket();
    }
  } catch {
    rejectPacket();
  }
}

function snapshotRoleRequests(value: unknown): ControlledCorpusRerunRoleRequestInput[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) rejectPacket();
    assertNoForbiddenInheritedKeys(value);
  } catch {
    rejectPacket();
  }

  let length: number;
  try {
    length = value.length;
  } catch {
    rejectPacket();
  }
  if (length !== REQUIRED_ROLES.length) rejectPacket();
  assertArrayShape(value, length);

  const snapshots: ControlledCorpusRerunRoleRequestInput[] = [];
  const seenRoles = new Set<ControlledCorpusGraphProposeRole>();
  const seenAccountRefs = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    let item: unknown;
    try {
      item = readArrayElement(value, index);
    } catch {
      rejectPacket();
    }
    const record = readRecord(item);
    assertOnlyKeys(record, ROLE_REQUEST_KEYS);
    const role = readRole(readProperty(record, "role"));
    if (role !== REQUIRED_ROLES[index]) rejectPacket();
    const accountRef = readString(record, "accountRef");
    const inputGraphRef = readString(record, "inputGraphRef");
    assertSafeLogicalRef(accountRef);
    assertSafeRelativeRef(inputGraphRef);
    if (seenRoles.has(role) || seenAccountRefs.has(accountRef)) rejectPacket();
    seenRoles.add(role);
    seenAccountRefs.add(accountRef);
    snapshots.push({ role, accountRef, inputGraphRef });
  }
  return snapshots;
}

function snapshotInput(input: BuildControlledCorpusRerunRequestPacketInput): BuildControlledCorpusRerunRequestPacketInput {
  const record = readRecord(input);
  assertOnlyKeys(record, TOP_LEVEL_KEYS);
  const packetId = readString(record, "packetId");
  const requestedBy = readString(record, "requestedBy");
  const requestedAt = readString(record, "requestedAt");
  const corpusRef = readString(record, "corpusRef");
  const maxAccounts = readNumber(record, "maxAccounts");
  const maxOutputTokensPerAccount = readNumber(record, "maxOutputTokensPerAccount");
  const temperature = readNumber(record, "temperature");
  const roleRequests = snapshotRoleRequests(readProperty(record, "roleRequests"));

  assertSafeLogicalRef(packetId);
  assertSafeLogicalRef(requestedBy);
  assertStrictIsoTimestamp(requestedAt);
  assertSafeCorpusRef(corpusRef);
  if (!Number.isInteger(maxAccounts) || maxAccounts !== roleRequests.length) rejectPacket();
  if (!Number.isInteger(maxOutputTokensPerAccount) || maxOutputTokensPerAccount < 64 || maxOutputTokensPerAccount > 1024) {
    rejectPacket();
  }
  if (temperature !== 0) rejectPacket();

  return {
    packetId,
    requestedBy,
    requestedAt,
    corpusRef,
    maxAccounts,
    maxOutputTokensPerAccount,
    temperature,
    roleRequests,
  };
}

function assertStrictIsoTimestamp(value: string): void {
  if (!ISO_TIMESTAMP_PATTERN.test(value) || Number.isNaN(Date.parse(value))) rejectPacket();
}

function assertSafeLogicalRef(value: string): void {
  if (
    !SAFE_LOGICAL_REF.test(value) ||
    value.includes(".") ||
    value.includes("://") ||
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) ||
    value === "localhost"
  ) {
    rejectPacket();
  }
}

function isPrivateLikeSegment(normalizedSegment: string): boolean {
  return (
    normalizedSegment === "localhost" ||
    normalizedSegment === "home" ||
    normalizedSegment === "users" ||
    normalizedSegment === "tmp" ||
    normalizedSegment.startsWith("private") ||
    normalizedSegment.includes("secret") ||
    normalizedSegment.includes("credential") ||
    normalizedSegment.includes("token")
  );
}

function isIpLikeSegment(segment: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(segment);
}

function isDomainLikeSegment(segment: string): boolean {
  return segment.includes(".");
}

function isUnsafeRelativeSegment(segment: string): boolean {
  const normalizedSegment = segment.toLowerCase();
  const basename = normalizedSegment.endsWith(".json") ? normalizedSegment.slice(0, -".json".length) : normalizedSegment;
  return isPrivateLikeSegment(basename) || isIpLikeSegment(basename) || isDomainLikeSegment(basename);
}

function assertSafeRelativeRef(value: string): void {
  const segments = value.split("/");
  if (
    !SAFE_RELATIVE_REF.test(value) ||
    value.startsWith("/") ||
    value.includes("..") ||
    value.includes("://") ||
    segments.some(isUnsafeRelativeSegment) ||
    /(?:^|\/)(?:\d{1,3}\.){3}\d{1,3}(?:\/|$)/.test(value)
  ) {
    rejectPacket();
  }
}

function assertSafeCorpusRef(value: string): void {
  const segments = value.split("/");
  if (
    !SAFE_CORPUS_REF.test(value) ||
    value.includes("..") ||
    value.includes("://") ||
    segments.some((segment) => isUnsafeRelativeSegment(segment))
  ) {
    rejectPacket();
  }
}

function freezeRequestPreview(preview: ControlledCorpusRerunRequestPreview): ControlledCorpusRerunRequestPreview {
  return Object.freeze({
    ...preview,
    metadata: Object.freeze({ ...preview.metadata }),
  });
}

function freezeRoleRequest(roleRequest: ControlledCorpusRerunRoleRequest): ControlledCorpusRerunRoleRequest {
  return Object.freeze({
    ...roleRequest,
    request_preview: freezeRequestPreview(roleRequest.request_preview),
  });
}

function freezePacket(packet: ControlledCorpusRerunRequestPacket): ControlledCorpusRerunRequestPacket {
  return Object.freeze({
    ...packet,
    roles: Object.freeze(packet.roles.map(freezeRoleRequest)),
    blocked_next_actions: Object.freeze([...packet.blocked_next_actions]),
  });
}

function buildRoleRequest(
  packet: Pick<
    BuildControlledCorpusRerunRequestPacketInput,
    "packetId" | "requestedAt" | "corpusRef" | "maxOutputTokensPerAccount" | "temperature"
  >,
  input: ControlledCorpusRerunRoleRequestInput,
): ControlledCorpusRerunRoleRequest {
  const promptContract = buildControlledCorpusGraphProposePromptContract({ role: input.role });
  const idempotencyKey = `${packet.packetId}.${input.role}.${input.accountRef}`;
  return {
    role: input.role,
    account_ref: input.accountRef,
    input_graph_ref: input.inputGraphRef,
    operation: "graph.propose",
    prompt_contract: promptContract,
    request_preview: {
      operation: "graph.propose",
      mode: "model",
      model: "pending-live-run-approval",
      prompt: promptContract.prompt_template,
      inputGraphRef: input.inputGraphRef,
      idempotencyKey,
      maxOutputTokens: packet.maxOutputTokensPerAccount,
      temperature: packet.temperature,
      metadata: {
        packet_schema_version: CONTROLLED_CORPUS_RERUN_REQUEST_PACKET_SCHEMA_VERSION,
        prompt_schema_version: CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION,
        packet_id: packet.packetId,
        corpus_ref: packet.corpusRef,
        role: input.role,
        account_ref: input.accountRef,
        requested_at: packet.requestedAt,
      },
    },
  };
}

export function buildControlledCorpusRerunRequestPacket(
  input: BuildControlledCorpusRerunRequestPacketInput,
): ControlledCorpusRerunRequestPacket {
  const snapshot = snapshotInput(input);
  return freezePacket({
    schema_version: CONTROLLED_CORPUS_RERUN_REQUEST_PACKET_SCHEMA_VERSION,
    prompt_schema_version: CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION,
    mode: "no-spend-request-packet",
    operation: "graph.propose",
    packet_id: snapshot.packetId,
    requested_by: snapshot.requestedBy,
    requested_at: snapshot.requestedAt,
    corpus_ref: snapshot.corpusRef,
    max_accounts: snapshot.maxAccounts,
    max_output_tokens_per_account: snapshot.maxOutputTokensPerAccount,
    temperature: snapshot.temperature,
    roles: snapshot.roleRequests.map((roleRequest) => buildRoleRequest(snapshot, roleRequest)),
    approves_live_provider_call: false,
    approves_provider_spend: false,
    approves_expansion_or_comparison: false,
    launch_readiness_claim: false,
    requires_separate_live_run_approval: true,
    blocked_next_actions: BLOCKED_NEXT_ACTIONS,
  });
}
