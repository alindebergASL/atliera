import { types as utilTypes } from "node:util";

import type { AuditEvent } from "../graph/types.ts";
import {
  canonicalJson,
  M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
  getH2CapabilityRegistryEntry,
  sha256Canonical,
} from "./h2-registry.ts";
import type { H2Clock } from "./h2-mediation-gate.ts";
import type { H2McpInProcessTransport } from "./h2-mcp-protocol.ts";
import { M4OrchestratorMcpClient } from "./m4-orchestrator-mcp-client.ts";
import {
  M4_RECORDED_PROOF_SCHEDULE,
  M4_RECORDED_PROOF_SCHEDULE_AUTHORITY_REF,
  M4_RECORDED_PROOF_SCHEDULE_SHA256,
} from "./m4-recorded-proof-schedule.ts";
import {
  createM4RecordedProofMcpServer,
} from "./public-http-fetch-mcp-server.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_REF, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import {
  M4_MAX_BODY_BYTES,
  M4_MAX_DURATION_MS,
  M4_TARGET_REF,
  M4_TARGET_URL,
  isStrictIsoTimestamp,
  type M4FetchRefusalCode,
  type M4EffectTelemetry,
  type M4PublicEvidence,
  M4_ZERO_EFFECT_TELEMETRY,
} from "./public-http-fetch-policy.ts";

export type M4MediationRefusalCode =
  | "invalid_invocation_request"
  | "schedule_not_approved"
  | "schedule_in_progress"
  | "schedule_consumed"
  | "descriptor_hash_drift"
  | "mcp_protocol_refused";

export interface M4CapabilityExecution {
  readonly kind: "CapabilityExecution";
  readonly executionId: string;
  readonly capabilityId: "public_http_fetch_v1";
  readonly descriptorSha256: string;
  readonly targetPolicySha256: typeof M4_TARGET_POLICY_SHA256;
  readonly authorityKind: "approved_recorded_schedule" | "external_gate_b_one_shot_go";
  readonly authorityRef: string;
  readonly mediationLevel: "L0";
  readonly targetRef: typeof M4_TARGET_REF;
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly retryCount: 0;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly outcome: "completed" | "failed";
  readonly refusalCode: M4FetchRefusalCode | null;
  readonly effectTelemetry: M4EffectTelemetry;
}

export interface M4AccountingIncrement {
  readonly kind: "capability-accounting-increment";
  readonly incrementId: string;
  readonly executionId: string;
  readonly capabilityInvocations: 1;
  readonly capabilityExecutionRecords: 1;
  readonly auditEventsEmitted: 1;
  readonly liveNetworkEgressPerformed: 0 | 1;
  readonly dnsAttemptsPerformed: 0 | 1;
  readonly requestAttemptsPerformed: 0 | 1;
  readonly connectionAttemptsPerformed: 0 | 1;
  readonly lookupCallbacksPerformed: 0 | 1;
  readonly bytesReceived: number;
  readonly selectedAddress: string | null;
  readonly systemSideAcquisitionProofsPerformed: 0 | 1;
  readonly retriesPerformed: 0;
  readonly providerCallsExecuted: 0;
  readonly privateReadsPerformed: 0;
  readonly graphWritesPerformed: 0;
  readonly productionWritesPerformed: 0;
  readonly deploymentsPerformed: 0;
}

export type M4MediationResult =
  | {
      readonly ok: false;
      readonly invoked: false;
      readonly refusalCode: M4MediationRefusalCode;
      readonly auditEvents: readonly [] | readonly [AuditEvent];
    }
  | {
      readonly ok: true;
      readonly invoked: true;
      readonly output: M4PublicEvidence | null;
      readonly capabilityExecutions: readonly [M4CapabilityExecution];
      readonly auditEvents: readonly [AuditEvent];
      readonly accountingIncrements: readonly [M4AccountingIncrement];
    };

function deterministicId(prefix: string, values: readonly string[]): string {
  return `${prefix}_${sha256Canonical(values).slice(0, 24)}`;
}

function refusal(code: M4MediationRefusalCode): M4MediationResult {
  return Object.freeze({
    ok: false,
    invoked: false,
    refusalCode: code,
    auditEvents: Object.freeze([]) as readonly [],
  });
}

function exactData(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) {
    throw new Error("invalid invocation");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("invalid invocation");
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new Error("invalid invocation");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new Error("invalid invocation");
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new Error("invalid invocation");
    }
    output[key] = descriptor.value;
  }
  return output;
}

function snapshotInvocation(value: unknown): {
  readonly scheduleId: string;
  readonly targetRef: typeof M4_TARGET_REF;
  readonly targetPolicySha256: typeof M4_TARGET_POLICY_SHA256;
} {
  const root = exactData(value, ["trigger", "input"]);
  const trigger = exactData(root.trigger, ["kind", "scheduleId"]);
  const input = exactData(root.input, ["targetRef", "targetPolicySha256"]);
  if (trigger.kind !== "approved_recorded_schedule" ||
      typeof trigger.scheduleId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(trigger.scheduleId) ||
      input.targetRef !== M4_TARGET_REF || input.targetPolicySha256 !== M4_TARGET_POLICY_SHA256) {
    throw new Error("invalid invocation");
  }
  return Object.freeze({ scheduleId: trigger.scheduleId, targetRef: M4_TARGET_REF, targetPolicySha256: M4_TARGET_POLICY_SHA256 });
}

function exactSchedulePinsValid(): boolean {
  try {
    const schedule = M4_RECORDED_PROOF_SCHEDULE;
    const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
    const budget = schedule.invocationBudget;
    const registryBudget = registry.budgetDefaults;
    const policy = schedule.networkPolicy;
    return sha256Canonical(schedule) === M4_RECORDED_PROOF_SCHEDULE_SHA256 &&
      sha256Canonical(registry.descriptorSnapshot) === registry.descriptorSha256 &&
      schedule.kind === "approved_recorded_capability_schedule" && schedule.schemaVersion === "1" &&
      schedule.scheduleId === "sched_m4_recorded_sec_fedex_proof_v2" &&
      schedule.capabilityId === M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID &&
      schedule.targetPolicyRef === M4_TARGET_POLICY_REF &&
      schedule.targetPolicySha256 === M4_TARGET_POLICY_SHA256 &&
      registry.targetPolicySha256 === M4_TARGET_POLICY_SHA256 &&
      sha256Canonical(M4_CANONICAL_TARGET_POLICY) === M4_TARGET_POLICY_SHA256 &&
      schedule.descriptorSha256 === registry.descriptorSha256 && schedule.mediationLevel === "L0" &&
      schedule.targetRefs.length === 1 && schedule.targetRefs[0] === M4_TARGET_REF &&
      schedule.transport === "recorded_inert_exchange" && schedule.retryBudget === 0 &&
      schedule.maxInvocations === 1 && schedule.liveNetworkAuthorized === false &&
      policy.scheme === "https" && policy.effectivePort === 443 && policy.redirectLimit === 0 &&
      policy.retryBudget === 0 && policy.maxTargets === 1 && policy.maxDurationMs === M4_MAX_DURATION_MS &&
      policy.maxBodyBytes === M4_MAX_BODY_BYTES && policy.acceptedContentTypes.length === 1 &&
      policy.acceptedContentTypes[0] === "application/json" &&
      policy.trustStatus === "quoted_untrusted_public_source_content" &&
      budget.maxTargets === 1 && budget.maxInputBytes === 128 && budget.maxOutputBytes === 8_000_000 &&
      budget.maxDurationMs === M4_MAX_DURATION_MS && budget.maxBodyBytes === M4_MAX_BODY_BYTES &&
      budget.retryBudget === 0 && budget.maxInvocations === 1 && budget.redirectLimit === 0 &&
      registryBudget.maxTargets === budget.maxTargets && registryBudget.maxInputBytes === budget.maxInputBytes &&
      registryBudget.maxOutputBytes === budget.maxOutputBytes &&
      registryBudget.maxDurationMs === budget.maxDurationMs &&
      registryBudget.maxBodyBytes === budget.maxBodyBytes && registryBudget.retryBudget === budget.retryBudget &&
      registryBudget.maxInvocations === budget.maxInvocations && registryBudget.redirectLimit === budget.redirectLimit &&
      registry.allowedMediationLevels.length === 1 && registry.allowedMediationLevels[0] === "L0" &&
      registry.sandboxProfile.orchestratorSoleClient === true && registry.sandboxProfile.publicHttpsOnly === true &&
      registry.sandboxProfile.networkAllowed === true &&
      registry.sandboxProfile.credentialsAllowed === false && registry.sandboxProfile.cookiesAllowed === false &&
      registry.sandboxProfile.privateDataAllowed === false && registry.sandboxProfile.providerCallsAllowed === false &&
      registry.sandboxProfile.deploymentAllowed === false &&
      isStrictIsoTimestamp(schedule.approvedAt) && isStrictIsoTimestamp(schedule.validFrom) &&
      isStrictIsoTimestamp(schedule.validUntil) && schedule.approvedAt < schedule.validFrom &&
      schedule.validFrom < schedule.validUntil;
  } catch {
    return false;
  }
}

function readWallClock(clock: H2Clock): string | undefined {
  try {
    const value = clock.nowIso();
    return isStrictIsoTimestamp(value) ? value : undefined;
  } catch { return undefined; }
}

function readMonotonic(clock: H2Clock): number | undefined {
  try {
    const value = clock.monotonicMs();
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  } catch { return undefined; }
}

class M4PublicHttpFetchMediationKernel {
  readonly #client: M4OrchestratorMcpClient;
  readonly #clock: H2Clock;
  #state: "available" | "in_progress" | "consumed" = "available";

  constructor(options: { readonly transport: H2McpInProcessTransport; readonly clock: H2Clock }) {
    this.#client = new M4OrchestratorMcpClient(options.transport);
    this.#clock = options.clock;
  }

  async invoke(value: unknown): Promise<M4MediationResult> {
    let request: { readonly scheduleId: string; readonly targetRef: typeof M4_TARGET_REF;
      readonly targetPolicySha256: typeof M4_TARGET_POLICY_SHA256 };
    try { request = snapshotInvocation(value); }
    catch { return refusal("invalid_invocation_request"); }

    const schedule = M4_RECORDED_PROOF_SCHEDULE;
    if (request.scheduleId !== schedule.scheduleId || !exactSchedulePinsValid()) {
      return refusal("schedule_not_approved");
    }
    if (this.#state === "in_progress") return refusal("schedule_in_progress");
    if (this.#state === "consumed") return refusal("schedule_consumed");

    const admittedAt = readWallClock(this.#clock);
    if (admittedAt === undefined) return refusal("invalid_invocation_request");
    if (admittedAt < schedule.validFrom || admittedAt >= schedule.validUntil) {
      return refusal("schedule_not_approved");
    }
    this.#state = "in_progress";

    const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
    let descriptor: unknown;
    try { descriptor = await this.#client.getLiveDescriptorSnapshot(M4_MAX_DURATION_MS); }
    catch {
      this.#state = "available";
      return refusal("mcp_protocol_refused");
    }
    let descriptorHash: string;
    try { descriptorHash = sha256Canonical(descriptor); }
    catch {
      this.#state = "available";
      return refusal("descriptor_hash_drift");
    }
    if (descriptorHash !== registry.descriptorSha256 || descriptorHash !== schedule.descriptorSha256) {
      this.#state = "available";
      const audit: AuditEvent = Object.freeze({
        id: deterministicId("audit_refusal", [schedule.scheduleId, admittedAt]),
        team_id: "system",
        actor_type: "system",
        actor_id: schedule.approvedBy,
        event_type: "capability.invocation.refused",
        target_type: "Capability",
        target_id: schedule.capabilityId,
        payload_json: Object.freeze({
          refusal_reason: "descriptor_hash_drift",
          capability_id: schedule.capabilityId,
          retry_count: 0,
          live_network_egress: 0,
        }),
        created_at: admittedAt,
      });
      return Object.freeze({
        ok: false,
        invoked: false,
        refusalCode: "descriptor_hash_drift",
        auditEvents: Object.freeze([audit]) as readonly [AuditEvent],
      });
    }

    const startedAt = readWallClock(this.#clock);
    const startedMonotonic = readMonotonic(this.#clock);
    if (startedAt === undefined || startedMonotonic === undefined) {
      this.#state = "available";
      return refusal("invalid_invocation_request");
    }
    if (startedAt < schedule.validFrom || startedAt >= schedule.validUntil || !exactSchedulePinsValid()) {
      this.#state = "available";
      return refusal("schedule_not_approved");
    }

    this.#state = "consumed";
    const executionId = deterministicId("capexec", [schedule.scheduleId, descriptorHash, startedAt]);
    let output: M4PublicEvidence | null = null;
    let refusalCode: M4FetchRefusalCode | null = null;
    let outcome: "completed" | "failed" = "failed";
    try {
      const called = await this.#client.invoke(
        deterministicId("mcpcall", [executionId]),
        request.targetRef,
        M4_MAX_DURATION_MS,
      );
      if (called.acquisition !== null &&
          Buffer.byteLength(canonicalJson(called.acquisition), "utf8") <= schedule.invocationBudget.maxOutputBytes) {
        output = called.acquisition;
        outcome = "completed";
      } else {
        refusalCode = called.refusalCode;
      }
    } catch {
      refusalCode = "transport_refused";
    }

    let completedAt = startedAt;
    let durationMs: number = M4_MAX_DURATION_MS;
    const candidateCompletedAt = readWallClock(this.#clock);
    const completedMonotonic = readMonotonic(this.#clock);
    if (candidateCompletedAt !== undefined && candidateCompletedAt >= startedAt &&
        completedMonotonic !== undefined) {
      const candidateDuration = completedMonotonic - startedMonotonic;
      if (Number.isSafeInteger(candidateDuration) && candidateDuration >= 0 && candidateDuration <= M4_MAX_DURATION_MS) {
        completedAt = candidateCompletedAt;
        durationMs = candidateDuration;
      } else {
        outcome = "failed";
        output = null;
        refusalCode = "timeout_or_cancelled";
      }
    } else {
      outcome = "failed";
      output = null;
      refusalCode = "transport_refused";
    }

    const inputBytes = Buffer.byteLength(canonicalJson({ targetRef: request.targetRef,
      targetPolicySha256: request.targetPolicySha256 }), "utf8");
    const outputBytes = output === null ? 0 : output.byteCount;
    const execution: M4CapabilityExecution = Object.freeze({
      kind: "CapabilityExecution",
      executionId,
      capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      descriptorSha256: descriptorHash,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      authorityKind: "approved_recorded_schedule",
      authorityRef: schedule.scheduleId,
      mediationLevel: "L0",
      targetRef: request.targetRef,
      inputBytes,
      outputBytes,
      retryCount: 0,
      startedAt,
      completedAt,
      durationMs,
      outcome,
      refusalCode,
      effectTelemetry: M4_ZERO_EFFECT_TELEMETRY,
    });
    const audit: AuditEvent = Object.freeze({
      id: deterministicId("audit", [executionId]),
      team_id: "system",
      actor_type: "system",
      actor_id: schedule.approvedBy,
      event_type: `capability.execution.${outcome}`,
      target_type: "CapabilityExecution",
      target_id: executionId,
      payload_json: Object.freeze({
        capability_id: execution.capabilityId,
        descriptor_sha256: descriptorHash,
        target_policy_ref: M4_TARGET_POLICY_REF,
        target_policy_sha256: M4_TARGET_POLICY_SHA256,
        authority_ref: schedule.scheduleId,
        authority_artifact_ref: M4_RECORDED_PROOF_SCHEDULE_AUTHORITY_REF,
        authority_artifact_sha256: M4_RECORDED_PROOF_SCHEDULE_SHA256,
        mediation_level: "L0",
        target_ref: request.targetRef,
        requested_url: M4_TARGET_URL,
        output_bytes: outputBytes,
        response_sha256: output === null ? null : output.responseSha256,
        provenance: output === null ? null : output.provenance,
        custody: output === null ? null : output.custody,
        trust_status: output === null ? null : output.trust.status,
        refusal_code: refusalCode,
        retry_count: 0,
        live_network_egress: 0,
        dns_attempts: 0,
        request_attempts: 0,
        connection_attempts: 0,
        lookup_callbacks: 0,
        selected_address: null,
        bytes_received: 0,
        provider_calls: 0,
        private_reads: 0,
        graph_writes: 0,
        production_writes: 0,
        deployments: 0,
      }),
      created_at: completedAt,
    });
    const accounting: M4AccountingIncrement = Object.freeze({
      kind: "capability-accounting-increment",
      incrementId: deterministicId("acct", [executionId]),
      executionId,
      capabilityInvocations: 1,
      capabilityExecutionRecords: 1,
      auditEventsEmitted: 1,
      liveNetworkEgressPerformed: 0,
      dnsAttemptsPerformed: 0,
      requestAttemptsPerformed: 0,
      connectionAttemptsPerformed: 0,
      lookupCallbacksPerformed: 0,
      bytesReceived: 0,
      selectedAddress: null,
      systemSideAcquisitionProofsPerformed: outcome === "completed" ? 1 : 0,
      retriesPerformed: 0,
      providerCallsExecuted: 0,
      privateReadsPerformed: 0,
      graphWritesPerformed: 0,
      productionWritesPerformed: 0,
      deploymentsPerformed: 0,
    });
    return Object.freeze({
      ok: true,
      invoked: true,
      output,
      capabilityExecutions: Object.freeze([execution]) as readonly [M4CapabilityExecution],
      auditEvents: Object.freeze([audit]) as readonly [AuditEvent],
      accountingIncrements: Object.freeze([accounting]) as readonly [M4AccountingIncrement],
    });
  }
}

export interface M4PublicHttpFetchInvocationSurface {
  invoke(value: unknown): Promise<M4MediationResult>;
}

function proofClock(value: unknown): H2Clock {
  const root = exactData(value, ["wallClockIso", "monotonicMs"]);
  const snapshotArray = (candidate: unknown, length: number): unknown[] => {
    if (!Array.isArray(candidate) || utilTypes.isProxy(candidate) || Object.getPrototypeOf(candidate) !== Array.prototype ||
        Object.getOwnPropertySymbols(candidate).length !== 0 || Object.getOwnPropertyNames(candidate).length !== length + 1 ||
        candidate.length !== length) throw new Error("invalid proof clock transcript");
    const output: unknown[] = [];
    for (let index = 0; index < length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, String(index));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("invalid proof clock transcript");
      output.push(descriptor.value);
    }
    return output;
  };
  const wall = snapshotArray(root.wallClockIso, 3);
  const mono = snapshotArray(root.monotonicMs, 2);
  if (wall.length !== 3 || !wall.every(isStrictIsoTimestamp) || mono.length !== 2 ||
      !mono.every((item) => Number.isSafeInteger(item) && (item as number) >= 0)) throw new Error("invalid proof clock transcript");
  return Object.freeze({ nowIso: () => wall.shift() as string, monotonicMs: () => mono.shift() as number });
}

/** Proof/test-only construction. Inputs are snapshotted plain data; executable dependencies are rejected. */
export function createM4RecordedProofKernel(recordedExchange: unknown, clockTranscript: unknown): M4PublicHttpFetchInvocationSurface {
  return new M4PublicHttpFetchMediationKernel({
    transport: createM4RecordedProofMcpServer(recordedExchange),
    clock: proofClock(clockTranscript),
  });
}

const productionKernel: M4PublicHttpFetchInvocationSurface = Object.freeze({
  async invoke(value: unknown): Promise<M4MediationResult> {
    try { snapshotInvocation(value); } catch { return refusal("invalid_invocation_request"); }
    // This is deliberately a Date-based real-clock read. There is no production transport or recorded material.
    if (!isStrictIsoTimestamp(new Date().toISOString())) return refusal("invalid_invocation_request");
    return refusal("schedule_not_approved");
  },
});

/** Sole production surface. It remains unarmed; the external Gate B factory is separate and one-shot. */
export function getM4PublicHttpFetchKernel(): M4PublicHttpFetchInvocationSurface { return productionKernel; }
