import { types as utilTypes } from "node:util";

import type { AuditEvent } from "../graph/types.ts";
import {
  H2_ECHO_CAPABILITY_ID,
  canonicalJson,
  getH2CapabilityRegistryEntry,
  sha256Canonical,
} from "./h2-registry.ts";
import type { H2CapabilityBudgetDefaults } from "./h2-registry.ts";
import { createH2InertEchoMcpServer, snapshotH2EchoValue } from "./inert-echo-mcp-server.ts";
import type { H2EchoValue, H2McpInProcessTransport } from "./h2-mcp-protocol.ts";
import { H2OrchestratorMcpClient } from "./orchestrator-mcp-client.ts";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type H2MediationRefusalCode =
  | "invalid_invocation_request"
  | "schedule_not_approved"
  | "schedule_not_yet_valid"
  | "schedule_expired"
  | "schedule_consumed"
  | "capability_not_registered"
  | "capability_mismatch"
  | "descriptor_hash_drift"
  | "mediation_level_refused"
  | "retry_budget_refused"
  | "invocation_budget_refused"
  | "input_refused";

export interface H2InvocationBudget extends H2CapabilityBudgetDefaults {}

export interface H2ApprovedSchedule {
  readonly kind: "h2-approved-capability-schedule";
  readonly schemaVersion: "1";
  readonly scheduleId: string;
  readonly capabilityId: typeof H2_ECHO_CAPABILITY_ID;
  readonly descriptorSha256: string;
  readonly mediationLevel: "L0";
  readonly invocationBudget: H2InvocationBudget;
  readonly retryBudget: 0;
  readonly maxInvocations: 1;
  readonly approvalId: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
}

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

interface StoredSchedule {
  readonly schedule: H2ApprovedSchedule;
  consumed: boolean;
}

class H2ScheduleBoundaryError extends Error {
  constructor() {
    super("approved schedule boundary refused input");
    this.name = "H2ScheduleBoundaryError";
  }
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    throw new H2ScheduleBoundaryError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new H2ScheduleBoundaryError();
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new H2ScheduleBoundaryError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new H2ScheduleBoundaryError();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new H2ScheduleBoundaryError();
    }
    out[key] = descriptor.value;
  }
  return out;
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

function snapshotApprovedSchedule(value: unknown): H2ApprovedSchedule {
  try {
    const root = exactObject(value, [
      "kind",
      "schemaVersion",
      "scheduleId",
      "capabilityId",
      "descriptorSha256",
      "mediationLevel",
      "invocationBudget",
      "retryBudget",
      "maxInvocations",
      "approvalId",
      "approvedBy",
      "approvedAt",
      "validFrom",
      "validUntil",
    ]);
    const budget = exactObject(root.invocationBudget, [
      "maxInputBytes",
      "maxOutputBytes",
      "maxDurationMs",
      "retryBudget",
      "maxInvocations",
    ]);
    const registry = getH2CapabilityRegistryEntry(H2_ECHO_CAPABILITY_ID);
    if (
      registry === undefined ||
      root.kind !== "h2-approved-capability-schedule" ||
      root.schemaVersion !== "1" ||
      !safeId(root.scheduleId) ||
      root.capabilityId !== H2_ECHO_CAPABILITY_ID ||
      typeof root.descriptorSha256 !== "string" ||
      !SHA256.test(root.descriptorSha256) ||
      root.descriptorSha256 !== registry.descriptorSha256 ||
      root.mediationLevel !== "L0" ||
      root.retryBudget !== 0 ||
      root.maxInvocations !== 1 ||
      budget.maxInputBytes !== registry.budgetDefaults.maxInputBytes ||
      budget.maxOutputBytes !== registry.budgetDefaults.maxOutputBytes ||
      budget.maxDurationMs !== registry.budgetDefaults.maxDurationMs ||
      budget.retryBudget !== 0 ||
      budget.maxInvocations !== 1 ||
      !safeId(root.approvalId) ||
      !safeId(root.approvedBy) ||
      !strictIso(root.approvedAt) ||
      !strictIso(root.validFrom) ||
      !strictIso(root.validUntil) ||
      root.approvedAt > root.validFrom ||
      root.validFrom >= root.validUntil
    ) {
      throw new H2ScheduleBoundaryError();
    }
    return Object.freeze({
      kind: "h2-approved-capability-schedule",
      schemaVersion: "1",
      scheduleId: root.scheduleId,
      capabilityId: H2_ECHO_CAPABILITY_ID,
      descriptorSha256: root.descriptorSha256,
      mediationLevel: "L0",
      invocationBudget: Object.freeze({
        maxInputBytes: 512,
        maxOutputBytes: 512,
        maxDurationMs: 1000,
        retryBudget: 0,
        maxInvocations: 1,
      }),
      retryBudget: 0,
      maxInvocations: 1,
      approvalId: root.approvalId,
      approvedBy: root.approvedBy,
      approvedAt: root.approvedAt,
      validFrom: root.validFrom,
      validUntil: root.validUntil,
    });
  } catch (error) {
    if (error instanceof H2ScheduleBoundaryError) throw error;
    throw new H2ScheduleBoundaryError();
  }
}

function defaultClock(): H2Clock {
  return Object.freeze({
    nowIso: () => new Date().toISOString(),
    monotonicMs: () => Date.now(),
  });
}

function refusal(code: H2MediationRefusalCode): H2MediationResult {
  return Object.freeze({ ok: false, invoked: false, refusalCode: code });
}

function deterministicId(prefix: string, values: readonly string[]): string {
  return `${prefix}_${sha256Canonical(values).slice(0, 24)}`;
}

export class H2EchoMediationKernel {
  readonly #registryEntry = getH2CapabilityRegistryEntry(H2_ECHO_CAPABILITY_ID);
  readonly #client: H2OrchestratorMcpClient;
  readonly #clock: H2Clock;
  readonly #schedules = new Map<string, StoredSchedule>();

  constructor(options: H2EchoMediationKernelOptions = {}) {
    this.#client = new H2OrchestratorMcpClient(options.transport ?? createH2InertEchoMcpServer());
    this.#clock = options.clock ?? defaultClock();
  }

  approveSchedule(value: unknown): H2ApprovedSchedule {
    const schedule = snapshotApprovedSchedule(value);
    if (this.#schedules.has(schedule.scheduleId)) throw new H2ScheduleBoundaryError();
    this.#schedules.set(schedule.scheduleId, { schedule, consumed: false });
    return schedule;
  }

  async invoke(value: unknown): Promise<H2MediationResult> {
    let trigger: Record<string, unknown>;
    let input: H2EchoValue;
    try {
      const root = exactObject(value, ["trigger", "input"]);
      trigger = exactObject(root.trigger, ["kind", "scheduleId"]);
      if (trigger.kind !== "approved_schedule" || !safeId(trigger.scheduleId)) {
        return refusal("invalid_invocation_request");
      }
      input = snapshotH2EchoValue(root.input);
    } catch {
      return refusal("invalid_invocation_request");
    }

    const stored = this.#schedules.get(trigger.scheduleId as string);
    if (stored === undefined) return refusal("schedule_not_approved");
    if (stored.consumed) return refusal("schedule_consumed");
    const schedule = stored.schedule;
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

    const startedAt = this.#clock.nowIso();
    if (!strictIso(startedAt)) return refusal("invalid_invocation_request");
    if (startedAt < schedule.validFrom) return refusal("schedule_not_yet_valid");
    if (startedAt > schedule.validUntil) return refusal("schedule_expired");

    let liveDescriptorHash: string;
    try {
      liveDescriptorHash = sha256Canonical(this.#client.getLiveDescriptorSnapshot());
    } catch {
      return refusal("descriptor_hash_drift");
    }
    if (
      liveDescriptorHash !== registry.descriptorSha256 ||
      liveDescriptorHash !== schedule.descriptorSha256
    ) {
      return refusal("descriptor_hash_drift");
    }

    const inputBytes = Buffer.byteLength(canonicalJson(input), "utf8");
    if (inputBytes > schedule.invocationBudget.maxInputBytes) return refusal("input_refused");

    stored.consumed = true;
    const startedMonotonic = this.#clock.monotonicMs();
    const executionId = deterministicId("capexec", [schedule.scheduleId, liveDescriptorHash, startedAt]);
    const requestId = deterministicId("mcpcall", [executionId]);
    let output: H2EchoValue | null = null;
    let outputBytes = 0;
    let outcome: "completed" | "failed" = "failed";

    try {
      const candidate = await this.#client.invokeInertEcho(requestId, input);
      outputBytes = Buffer.byteLength(canonicalJson(candidate), "utf8");
      if (
        outputBytes <= schedule.invocationBudget.maxOutputBytes &&
        canonicalJson(candidate) === canonicalJson(input)
      ) {
        output = candidate;
        outcome = "completed";
      }
    } catch {
      outcome = "failed";
    }

    const completedAt = this.#clock.nowIso();
    const completedMonotonic = this.#clock.monotonicMs();
    const rawDuration = completedMonotonic - startedMonotonic;
    const durationMs = Number.isSafeInteger(rawDuration) && rawDuration >= 0 ? rawDuration : 0;
    if (
      !strictIso(completedAt) ||
      completedAt < startedAt ||
      durationMs > schedule.invocationBudget.maxDurationMs
    ) {
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
      completedAt: strictIso(completedAt) ? completedAt : startedAt,
      durationMs,
      outcome,
    });
    const auditId = deterministicId("audit", [executionId]);
    const auditEvent: AuditEvent = Object.freeze({
      id: auditId,
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
        approval_id: schedule.approvalId,
        mediation_level: "L0",
        input_bytes: inputBytes,
        output_bytes: outputBytes,
        retry_count: 0,
        duration_ms: durationMs,
        outcome,
      }),
      created_at: execution.completedAt,
    });
    const accountingIncrement: H2AccountingIncrement = Object.freeze({
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

    return Object.freeze({
      ok: true,
      invoked: true,
      output,
      capabilityExecutions: Object.freeze([execution]) as readonly [H2CapabilityExecution],
      auditEvents: Object.freeze([auditEvent]) as readonly [AuditEvent],
      accountingIncrements: Object.freeze([accountingIncrement]) as readonly [H2AccountingIncrement],
    });
  }
}

export function createH2EchoMediationKernel(): H2EchoMediationKernel {
  return new H2EchoMediationKernel();
}
