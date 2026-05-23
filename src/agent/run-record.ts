import { idHasPrefix, isWellFormedId } from "../graph/ids.ts";
import type { RuntimeMode } from "../modes/index.ts";
import type { ModelProviderOperation } from "../model/provider.ts";

export const AGENT_RUN_RECORD_SCHEMA_VERSION = "atliera.agent_run.v1" as const;

export type AgentRunStatus =
  | "planned"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentRunArtifactRole =
  | "input_graph"
  | "quality_gate_report"
  | "model_request"
  | "model_response"
  | "run_manifest";

export interface AgentRunArtifactRefInput {
  readonly role: AgentRunArtifactRole;
  readonly runArtifactId: string;
  readonly ref: string;
}

export interface AgentRunArtifactRef {
  readonly role: AgentRunArtifactRole;
  readonly run_artifact_id: string;
  readonly ref: string;
}

export interface AgentRunRecordInput {
  readonly id: string;
  readonly researchRunId: string;
  readonly operation: ModelProviderOperation;
  readonly mode: RuntimeMode;
  readonly status: AgentRunStatus;
  readonly inputGraphRef: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly queueJobId?: string | null;
  readonly artifacts: readonly AgentRunArtifactRefInput[];
  readonly metadata?: Record<string, string>;
}

export interface AgentRunRecord {
  readonly schema_version: typeof AGENT_RUN_RECORD_SCHEMA_VERSION;
  readonly id: string;
  readonly research_run_id: string;
  readonly operation: ModelProviderOperation;
  readonly mode: RuntimeMode;
  readonly status: AgentRunStatus;
  readonly input_graph_ref: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly queue_job_id: string | null;
  readonly artifacts: readonly AgentRunArtifactRef[];
  readonly metadata: Readonly<Record<string, string>>;
}

const SAFE_RELATIVE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SAFE_JOB_ID = /^job_[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const AGENT_RUN_ID_PREFIX = "agn_";
const AGENT_RUN_ID_PATTERN = /^agn_[a-z0-9][a-z0-9_-]{0,63}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const RUNTIME_MODES: readonly RuntimeMode[] = ["validation", "fixture", "fake", "model"];
const AGENT_RUN_STATUSES: readonly AgentRunStatus[] = [
  "planned",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
];
const AGENT_RUN_ARTIFACT_ROLES: readonly AgentRunArtifactRole[] = [
  "input_graph",
  "quality_gate_report",
  "model_request",
  "model_response",
  "run_manifest",
];
const TERMINAL_STATUSES: ReadonlySet<AgentRunStatus> = new Set<AgentRunStatus>([
  "succeeded",
  "failed",
  "cancelled",
]);
const ALLOWED_TRANSITIONS: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = Object.freeze({
  planned: ["queued", "running", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
});

export function createAgentRunRecord(input: AgentRunRecordInput): AgentRunRecord {
  assertSafeAgentRunId(input.id);
  assertResearchRunId(input.researchRunId);
  assertSupportedOperation(input.operation);
  assertRuntimeMode(input.mode);
  assertAgentRunStatus(input.status);
  assertSafeRelativeRef("input graph ref", input.inputGraphRef);
  const createdAtMs = parseStrictIsoTimestamp("createdAt", input.createdAt);
  const updatedAtMs = parseStrictIsoTimestamp("updatedAt", input.updatedAt);
  if (updatedAtMs < createdAtMs) {
    throw new Error("updatedAt must not be before createdAt");
  }

  if (input.queueJobId !== undefined && input.queueJobId !== null) {
    assertSafeQueueJobId(input.queueJobId);
  }

  const artifacts = input.artifacts.map(copyAndValidateArtifactRef);
  const metadata = copyAndValidateMetadata(input.metadata ?? {});

  return Object.freeze({
    schema_version: AGENT_RUN_RECORD_SCHEMA_VERSION,
    id: input.id,
    research_run_id: input.researchRunId,
    operation: input.operation,
    mode: input.mode,
    status: input.status,
    input_graph_ref: input.inputGraphRef,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    queue_job_id: input.queueJobId ?? null,
    artifacts: Object.freeze(artifacts),
    metadata: Object.freeze(metadata),
  });
}

export function transitionAgentRunRecord(
  record: AgentRunRecord,
  status: AgentRunStatus,
  updatedAt: string,
): AgentRunRecord {
  assertAgentRunSchemaVersion(record.schema_version);
  assertAgentRunStatus(record.status);
  assertRuntimeMode(record.mode);
  assertAgentRunStatus(status);
  const previousUpdatedAtMs = parseStrictIsoTimestamp("record.updated_at", record.updated_at);
  const nextUpdatedAtMs = parseStrictIsoTimestamp("updatedAt", updatedAt);
  if (nextUpdatedAtMs < previousUpdatedAtMs) {
    throw new Error("updatedAt must not go backwards");
  }

  if (TERMINAL_STATUSES.has(record.status)) {
    throw new Error("cannot transition terminal agent run record");
  }

  if (!ALLOWED_TRANSITIONS[record.status].includes(status)) {
    throw new Error(`invalid status transition from ${record.status} to ${status}`);
  }

  return createAgentRunRecord({
    id: record.id,
    researchRunId: record.research_run_id,
    operation: record.operation,
    mode: record.mode,
    status,
    inputGraphRef: record.input_graph_ref,
    createdAt: record.created_at,
    updatedAt,
    queueJobId: record.queue_job_id,
    artifacts: record.artifacts.map((artifact) => ({
      role: artifact.role,
      runArtifactId: artifact.run_artifact_id,
      ref: artifact.ref,
    })),
    metadata: record.metadata,
  });
}

function assertSafeAgentRunId(id: string): void {
  if (!AGENT_RUN_ID_PATTERN.test(id) || !id.startsWith(AGENT_RUN_ID_PREFIX)) {
    throw new Error("agent run id must be a safe agn_ identifier");
  }
}

function assertAgentRunSchemaVersion(schemaVersion: string): void {
  if (schemaVersion !== AGENT_RUN_RECORD_SCHEMA_VERSION) {
    throw new Error("agent run schema version is not supported");
  }
}

function assertResearchRunId(id: string): void {
  if (!idHasPrefix(id, "research_run")) {
    throw new Error("research run id must be a well-formed run_ identifier");
  }
}

function assertRunArtifactId(id: string): void {
  if (!idHasPrefix(id, "run_artifact")) {
    throw new Error("run artifact id must be a well-formed art_ identifier");
  }
}

function assertSupportedOperation(operation: ModelProviderOperation): void {
  if (operation !== "graph.propose") {
    throw new Error("agent run operation must be graph.propose");
  }
}

function assertRuntimeMode(mode: RuntimeMode): void {
  if (!RUNTIME_MODES.includes(mode)) {
    throw new Error("runtime mode is not supported");
  }
}

function assertAgentRunStatus(status: AgentRunStatus): void {
  if (!AGENT_RUN_STATUSES.includes(status)) {
    throw new Error("agent run status is not supported");
  }
}

function assertArtifactRole(role: AgentRunArtifactRole): void {
  if (!AGENT_RUN_ARTIFACT_ROLES.includes(role)) {
    throw new Error("agent run artifact role is not supported");
  }
}

function assertSafeQueueJobId(id: string): void {
  if (!SAFE_JOB_ID.test(id) || id.includes("..") || id.includes("://") || id.includes("/") || id.includes("\\")) {
    throw new Error("queue job id must be a safe logical job_ identifier");
  }
}

function assertSafeRelativeRef(field: string, ref: string): void {
  if (
    ref.trim() !== ref ||
    !SAFE_RELATIVE_REF.test(ref) ||
    ref.includes("..") ||
    ref.startsWith("/") ||
    ref.includes("://") ||
    ref.includes("\\") ||
    ref.split("/").some((segment) => segment.length === 0 || segment === "." || segment.startsWith("."))
  ) {
    throw new Error(`${field} must be a safe relative reference`);
  }
}

function parseStrictIsoTimestamp(field: string, value: string): number {
  if (!ISO_TIMESTAMP_PATTERN.test(value)) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (Number.isNaN(time) || parsed.toISOString() !== value) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
  return time;
}

function copyAndValidateArtifactRef(input: AgentRunArtifactRefInput): AgentRunArtifactRef {
  assertArtifactRole(input.role);
  assertRunArtifactId(input.runArtifactId);
  assertSafeRelativeRef("artifact ref", input.ref);

  return Object.freeze({
    role: input.role,
    run_artifact_id: input.runArtifactId,
    ref: input.ref,
  });
}

function copyAndValidateMetadata(metadata: Record<string, string>): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!isWellFormedMetadataKey(key)) {
      throw new Error("metadata keys must be safe logical identifiers");
    }
    if (typeof value !== "string") {
      throw new Error("metadata values must be strings");
    }
    copy[key] = value;
  }
  return copy;
}

function isWellFormedMetadataKey(key: string): boolean {
  return isWellFormedId(`aud_${key}`) || /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(key);
}
