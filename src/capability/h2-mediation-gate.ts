import { types as utilTypes } from "node:util";

import type { AuditEvent } from "../graph/types.ts";
import {
  H2_APPROVED_ECHO_SCHEDULE,
  H2_APPROVED_ECHO_SCHEDULE_AUTHORITY_REF,
  H2_APPROVED_ECHO_SCHEDULE_SHA256,
} from "./h2-approved-schedule.ts";
import type { H2ApprovedSchedule } from "./h2-approved-schedule.ts";
import {
  H2_ECHO_CAPABILITY_ID,
  canonicalJson,
  getH2CapabilityRegistryEntry,
  sha256Canonical,
} from "./h2-registry.ts";
import { createH2InertEchoMcpServer, snapshotH2EchoValue } from "./inert-echo-mcp-server.ts";
import type { H2EchoValue, H2McpInProcessTransport } from "./h2-mcp-protocol.ts";
import { H2OrchestratorMcpClient } from "./orchestrator-mcp-client.ts";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type H2MediationRefusalCode =
  | "invalid_invocation_request"
  | "schedule_not_approved"
  | "schedule_not_yet_valid"
  | "schedule_expired"
  | "schedule_in_progress"
  | "schedule_consumed"
  | "capability_not_registered"
  | "capability_mismatch"
  | "descriptor_hash_drift"
  | "mcp_protocol_refused"
  | "mediation_level_refused"
  | "retry_budget_refused"
  | "invocation_budget_refused"
  | "input_refused";

export interface H2CapabilityExecution {
  readonly kind: "CapabilityExecution";
  readonly executionId: string;
  readonly capabilityId: typeof H2_ECHO_CAPABILITY_ID;
  readonly descriptorSha256: string;
  readonly authorityKind: "approved_schedule";
  readonly authorityRef: string;
  readonly mediationLevel: "L0";
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly retryCount: 0;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outcome: "completed" | "failed";
}

export interface H2AccountingIncrement {
  readonly kind: "capability-accounting-increment";
  readonly incrementId: string;
  readonly executionId: string;
  readonly capabilityInvocations: 1;
  readonly capabilityExecutionRecords: 1;
  readonly auditEventsEmitted: 1;
  readonly networkEgressPerformed: 0;
  readonly providerCallsExecuted: 0;
  readonly systemSideAcquisitionsPerformed: 0;
  readonly privateReadsPerformed: 0;
  readonly filesystemOperationsPerformed: 0;
  readonly environmentReadsPerformed: 0;
  readonly databaseOperationsPerformed: 0;
  readonly subprocessesExecuted: 0;
  readonly productionWritesPerformed: 0;
  readonly deploymentsPerformed: 0;
}

export type H2MediationResult =
  | {
      readonly ok: false;
      readonly invoked: false;
      readonly refusalCode: H2MediationRefusalCode;
      readonly auditEvents: readonly [] | readonly [AuditEvent];
    }
  | {
      readonly ok: true;
      readonly invoked: true;
      readonly output: H2EchoValue | null;
      readonly capabilityExecutions: readonly [H2CapabilityExecution];
      readonly auditEvents: readonly [AuditEvent];
      readonly accountingIncrements: readonly [H2AccountingIncrement];
    };

export interface H2Clock {
  nowIso(): string;
  monotonicMs(): number;
}

export interface H2EchoMediationKernelOptions {
  readonly transport?: H2McpInProcessTransport;
  readonly clock?: H2Clock;
}

export interface H2MediationKernel {
  invoke(value: unknown): Promise<H2MediationResult>;
}

function strictIso(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function safeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value) && !value.includes("..") && !value.includes("://");
}

function snapshotInvocation(value: unknown): { readonly scheduleId: string; readonly input: H2EchoValue } {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new Error("invalid invocation request");
  }
  const rootDescriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Object.getOwnPropertySymbols(value).length !== 0 ||
    Object.keys(rootDescriptors).length !== 2 ||
    rootDescriptors.trigger === undefined ||
    !("value" in rootDescriptors.trigger) ||
    rootDescriptors.trigger.enumerable !== true ||
    rootDescriptors.input === undefined ||
    !("value" in rootDescriptors.input) ||
    rootDescriptors.input.enumerable !== true
  ) {
    throw new Error("invalid invocation request");
  }
  const trigger = rootDescriptors.trigger.value;
  if (
    typeof trigger !== "object" ||
    trigger === null ||
    Array.isArray(trigger) ||
    utilTypes.isProxy(trigger) ||
    (Object.getPrototypeOf(trigger) !== Object.prototype && Object.getPrototypeOf(trigger) !== null)
  ) {
    throw new Error("invalid invocation request");
  }
  const triggerDescriptors = Object.getOwnPropertyDescriptors(trigger);
  if (
    Object.getOwnPropertySymbols(trigger).length !== 0 ||
    Object.keys(triggerDescriptors).length !== 2 ||
    triggerDescriptors.kind === undefined ||
    !("value" in triggerDescriptors.kind) ||
    triggerDescriptors.kind.enumerable !== true ||
    triggerDescriptors.kind.value !== "approved_schedule" ||
    triggerDescriptors.scheduleId === undefined ||
    !("value" in triggerDescriptors.scheduleId) ||
    triggerDescriptors.scheduleId.enumerable !== true ||
    !safeId(triggerDescriptors.scheduleId.value)
  ) {
    throw new Error("invalid invocation request");
  }
  return {
    scheduleId: triggerDescriptors.scheduleId.value,
    input: snapshotH2EchoValue(rootDescriptors.input.value),
  };
}

function defaultClock(): H2Clock {
  return Object.freeze({
    nowIso: () => new Date().toISOString(),
    monotonicMs: () => Date.now(),
  });
}

function refusal(code: H2MediationRefusalCode): H2MediationResult {
  return Object.freeze({
    ok: false,
    invoked: false,
    refusalCode: code,
    auditEvents: Object.freeze([]) as readonly [],
  });
}

function deterministicId(prefix: string, values: readonly string[]): string {
  return `${prefix}_${sha256Canonical(values).slice(0, 24)}`;
}

function descriptorRefusalAudit(
  schedule: H2ApprovedSchedule,
  startedAt: string,
  pinnedHash: string,
  liveHash: string,
  reason: "descriptor_hash_drift" | "mcp_protocol_refused",
): AuditEvent {
  return Object.freeze({
    id: deterministicId("audit_refusal", [schedule.scheduleId, reason, startedAt]),
    team_id: "system",
    actor_type: "system",
    actor_id: schedule.approvedBy,
    event_type: "capability.invocation.refused",
    target_type: "Capability",
    target_id: schedule.capabilityId,
    payload_json: Object.freeze({
      capability_id: schedule.capabilityId,
      authority_kind: "approved_schedule",
      authority_ref: schedule.scheduleId,
      authority_artifact_ref: H2_APPROVED_ECHO_SCHEDULE_AUTHORITY_REF,
      approval_id: schedule.approvalId,
      descriptor_sha256_pinned: pinnedHash,
      descriptor_sha256_live: liveHash,
      refusal_reason: reason,
      retry_count: 0,
      network_effects: 0,
      provider_calls: 0,
      system_side_acquisitions: 0,
      private_reads: 0,
      production_writes: 0,
      deployments: 0,
    }),
    created_at: startedAt,
  });
}

function auditedDescriptorRefusal(
  schedule: H2ApprovedSchedule,
  startedAt: string,
  pinnedHash: string,
  liveHash: string,
  reason: "descriptor_hash_drift" | "mcp_protocol_refused",
): H2MediationResult {
  return Object.freeze({
    ok: false,
    invoked: false,
    refusalCode: reason,
    auditEvents: Object.freeze([
      descriptorRefusalAudit(schedule, startedAt, pinnedHash, liveHash, reason),
    ]) as readonly [AuditEvent],
  });
}

function accountingIncrement(executionId: string): H2AccountingIncrement {
  return Object.freeze({
    kind: "capability-accounting-increment",
    incrementId: deterministicId("acct", [executionId]),
    executionId,
    capabilityInvocations: 1,
    capabilityExecutionRecords: 1,
    auditEventsEmitted: 1,
    networkEgressPerformed: 0,
    providerCallsExecuted: 0,
    systemSideAcquisitionsPerformed: 0,
    privateReadsPerformed: 0,
    filesystemOperationsPerformed: 0,
    environmentReadsPerformed: 0,
    databaseOperationsPerformed: 0,
    subprocessesExecuted: 0,
    productionWritesPerformed: 0,
    deploymentsPerformed: 0,
  });
}

class H2EchoMediationKernel implements H2MediationKernel {
  readonly #registryEntry = getH2CapabilityRegistryEntry(H2_ECHO_CAPABILITY_ID);
  readonly #client: H2OrchestratorMcpClient;
  readonly #clock: H2Clock;
  #authorityState: "available" | "in_progress" | "consumed" = "available";

  constructor(options: H2EchoMediationKernelOptions = {}) {
    if (sha256Canonical(H2_APPROVED_ECHO_SCHEDULE) !== H2_APPROVED_ECHO_SCHEDULE_SHA256) {
      throw new Error("H2 approved schedule authority hash mismatch");
    }
    this.#client = new H2OrchestratorMcpClient(options.transport ?? createH2InertEchoMcpServer());
    this.#clock = options.clock ?? defaultClock();
  }

  async invoke(value: unknown): Promise<H2MediationResult> {
    let request: { readonly scheduleId: string; readonly input: H2EchoValue };
    try {
      request = snapshotInvocation(value);
    } catch {
      return refusal("invalid_invocation_request");
    }

    const schedule = H2_APPROVED_ECHO_SCHEDULE;
    if (request.scheduleId !== schedule.scheduleId) return refusal("schedule_not_approved");
    if (this.#authorityState === "in_progress") return refusal("schedule_in_progress");
    if (this.#authorityState === "consumed") return refusal("schedule_consumed");
    const registry = this.#registryEntry;
    if (registry === undefined) return refusal("capability_not_registered");
    if (schedule.capabilityId !== registry.capabilityId) return refusal("capability_mismatch");
    if (schedule.mediationLevel !== "L0") return refusal("mediation_level_refused");
    if (schedule.retryBudget !== 0 || schedule.invocationBudget.retryBudget !== 0) {
      return refusal("retry_budget_refused");
    }
    if (
      schedule.maxInvocations !== 1 ||
      schedule.invocationBudget.maxInvocations !== 1 ||
      schedule.invocationBudget.maxInputBytes !== registry.budgetDefaults.maxInputBytes ||
      schedule.invocationBudget.maxOutputBytes !== registry.budgetDefaults.maxOutputBytes ||
      schedule.invocationBudget.maxDurationMs !== registry.budgetDefaults.maxDurationMs
    ) {
      return refusal("invocation_budget_refused");
    }

    let admittedAt: string;
    try {
      admittedAt = this.#clock.nowIso();
    } catch {
      return refusal("invalid_invocation_request");
    }
    if (!strictIso(admittedAt)) return refusal("invalid_invocation_request");
    if (admittedAt < schedule.validFrom) return refusal("schedule_not_yet_valid");
    if (admittedAt >= schedule.validUntil) return refusal("schedule_expired");

    // Process-local one-shot reservation. Pre-effect refusals restore availability;
    // every tools/call attempt transitions permanently to consumed.
    this.#authorityState = "in_progress";

    let liveDescriptor: unknown;
    try {
      liveDescriptor = await this.#client.getLiveDescriptorSnapshot(
        schedule.invocationBudget.maxDurationMs,
      );
    } catch {
      this.#authorityState = "available";
      return auditedDescriptorRefusal(
        schedule,
        admittedAt,
        registry.descriptorSha256,
        "unavailable",
        "mcp_protocol_refused",
      );
    }

    let liveDescriptorHash: string;
    try {
      liveDescriptorHash = sha256Canonical(liveDescriptor);
    } catch {
      this.#authorityState = "available";
      return auditedDescriptorRefusal(
        schedule,
        admittedAt,
        registry.descriptorSha256,
        "unavailable",
        "descriptor_hash_drift",
      );
    }
    if (
      liveDescriptorHash !== registry.descriptorSha256 ||
      liveDescriptorHash !== schedule.descriptorSha256
    ) {
      this.#authorityState = "available";
      return auditedDescriptorRefusal(
        schedule,
        admittedAt,
        registry.descriptorSha256,
        liveDescriptorHash,
        "descriptor_hash_drift",
      );
    }

    let inputBytes: number;
    try {
      inputBytes = Buffer.byteLength(canonicalJson(request.input), "utf8");
    } catch {
      this.#authorityState = "available";
      return refusal("input_refused");
    }
    if (inputBytes > schedule.invocationBudget.maxInputBytes) {
      this.#authorityState = "available";
      return refusal("input_refused");
    }

    // Authority is rechecked at the effect boundary after asynchronous MCP preflight.
    let startedAt: string;
    try {
      startedAt = this.#clock.nowIso();
    } catch {
      this.#authorityState = "available";
      return refusal("invalid_invocation_request");
    }
    if (!strictIso(startedAt)) {
      this.#authorityState = "available";
      return refusal("invalid_invocation_request");
    }
    if (startedAt < schedule.validFrom) {
      this.#authorityState = "available";
      return refusal("schedule_not_yet_valid");
    }
    if (startedAt >= schedule.validUntil) {
      this.#authorityState = "available";
      return refusal("schedule_expired");
    }

    let startedMonotonic: number;
    try {
      startedMonotonic = this.#clock.monotonicMs();
      if (!Number.isSafeInteger(startedMonotonic) || startedMonotonic < 0) {
        this.#authorityState = "available";
        return refusal("invalid_invocation_request");
      }
    } catch {
      this.#authorityState = "available";
      return refusal("invalid_invocation_request");
    }

    this.#authorityState = "consumed";
    const executionId = deterministicId("capexec", [schedule.scheduleId, liveDescriptorHash, startedAt]);
    const requestId = deterministicId("mcpcall", [executionId]);
    let output: H2EchoValue | null = null;
    let outputBytes = 0;
    let outcome: "completed" | "failed" = "failed";

    try {
      const candidate = await this.#client.invokeInertEcho(
        requestId,
        request.input,
        schedule.invocationBudget.maxDurationMs,
      );
      const candidateOutputBytes = Buffer.byteLength(canonicalJson(candidate), "utf8");
      if (
        candidateOutputBytes <= schedule.invocationBudget.maxOutputBytes &&
        canonicalJson(candidate) === canonicalJson(request.input)
      ) {
        output = candidate;
        outputBytes = candidateOutputBytes;
        outcome = "completed";
      }
    } catch {
      outcome = "failed";
    }

    let completedAt = startedAt;
    let durationMs: number = schedule.invocationBudget.maxDurationMs;
    try {
      const candidateCompletedAt = this.#clock.nowIso();
      const completedMonotonic = this.#clock.monotonicMs();
      const rawDuration = completedMonotonic - startedMonotonic;
      if (
        strictIso(candidateCompletedAt) &&
        candidateCompletedAt >= startedAt &&
        Number.isSafeInteger(rawDuration) &&
        rawDuration >= 0
      ) {
        completedAt = candidateCompletedAt;
        durationMs = rawDuration;
      } else {
        outcome = "failed";
      }
    } catch {
      outcome = "failed";
    }
    if (durationMs > schedule.invocationBudget.maxDurationMs || outcome === "failed") {
      outcome = "failed";
      output = null;
      outputBytes = 0;
    }

    const execution: H2CapabilityExecution = Object.freeze({
      kind: "CapabilityExecution",
      executionId,
      capabilityId: registry.capabilityId,
      descriptorSha256: liveDescriptorHash,
      authorityKind: "approved_schedule",
      authorityRef: schedule.scheduleId,
      mediationLevel: "L0",
      inputBytes,
      outputBytes,
      retryCount: 0,
      startedAt,
      completedAt,
      durationMs,
      outcome,
    });
    const auditEvent: AuditEvent = Object.freeze({
      id: deterministicId("audit", [executionId]),
      team_id: "system",
      actor_type: "system",
      actor_id: schedule.approvedBy,
      event_type: `capability.execution.${outcome}`,
      target_type: "CapabilityExecution",
      target_id: executionId,
      payload_json: Object.freeze({
        capability_id: registry.capabilityId,
        descriptor_sha256: liveDescriptorHash,
        authority_kind: "approved_schedule",
        authority_ref: schedule.scheduleId,
        authority_artifact_ref: H2_APPROVED_ECHO_SCHEDULE_AUTHORITY_REF,
        authority_artifact_sha256: H2_APPROVED_ECHO_SCHEDULE_SHA256,
        approval_id: schedule.approvalId,
        mediation_level: "L0",
        input_bytes: inputBytes,
        output_bytes: outputBytes,
        retry_count: 0,
        duration_ms: durationMs,
        outcome,
      }),
      created_at: completedAt,
    });

    return Object.freeze({
      ok: true,
      invoked: true,
      output,
      capabilityExecutions: Object.freeze([execution]) as readonly [H2CapabilityExecution],
      auditEvents: Object.freeze([auditEvent]) as readonly [AuditEvent],
      accountingIncrements: Object.freeze([
        accountingIncrement(executionId),
      ]) as readonly [H2AccountingIncrement],
    });
  }
}

const systemKernel = new H2EchoMediationKernel();

export function getH2EchoMediationKernel(): H2MediationKernel {
  return systemKernel;
}

export function createH2EchoMediationKernelForTest(
  options: H2EchoMediationKernelOptions = {},
): H2MediationKernel {
  return new H2EchoMediationKernel(options);
}
