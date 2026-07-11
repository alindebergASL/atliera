import { H2_M4_SUCCESSOR_TEMPLATE } from "./h2-m4-successor-template.ts";
import {
  H2_CAPABILITY_REGISTRY,
  H2_ECHO_CAPABILITY_ID,
} from "./h2-registry.ts";
import {
  H2EchoMediationKernel,
  type H2Clock,
} from "./h2-mediation-gate.ts";

const APPROVED_AT = "2026-07-10T12:00:00.000Z";
const VALID_FROM = "2026-07-10T12:00:01.000Z";
const STARTED_AT = "2026-07-10T12:00:02.000Z";
const COMPLETED_AT = "2026-07-10T12:00:02.007Z";
const VALID_UNTIL = "2026-07-10T12:05:00.000Z";

function deterministicProofClock(): H2Clock {
  const timestamps = [STARTED_AT, COMPLETED_AT];
  const monotonic = [1000, 1007];
  return Object.freeze({
    nowIso(): string {
      const value = timestamps.shift();
      if (value === undefined) throw new Error("H2 proof clock exhausted");
      return value;
    },
    monotonicMs(): number {
      const value = monotonic.shift();
      if (value === undefined) throw new Error("H2 proof monotonic clock exhausted");
      return value;
    },
  });
}

export async function generateH2EchoMediationProof(): Promise<Record<string, unknown>> {
  const registry = H2_CAPABILITY_REGISTRY[0];
  const kernel = new H2EchoMediationKernel({ clock: deterministicProofClock() });
  const schedule = kernel.approveSchedule({
    kind: "h2-approved-capability-schedule",
    schemaVersion: "1",
    scheduleId: "sched_h2_echo_proof_v1",
    capabilityId: H2_ECHO_CAPABILITY_ID,
    descriptorSha256: registry.descriptorSha256,
    mediationLevel: "L0",
    invocationBudget: {
      maxInputBytes: 512,
      maxOutputBytes: 512,
      maxDurationMs: 1000,
      retryBudget: 0,
      maxInvocations: 1,
    },
    retryBudget: 0,
    maxInvocations: 1,
    approvalId: "approval_h2_echo_proof_v1",
    approvedBy: "atliera-system-admin",
    approvedAt: APPROVED_AT,
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
  });
  const input = Object.freeze({ value: "H2 inert echo mediation proof" });
  const result = await kernel.invoke({
    trigger: { kind: "approved_schedule", scheduleId: schedule.scheduleId },
    input,
  });
  if (
    !result.ok ||
    result.output === null ||
    result.output.value !== input.value ||
    result.capabilityExecutions[0].outcome !== "completed"
  ) {
    throw new Error("H2 echo mediation proof did not complete");
  }

  return Object.freeze({
    kind: "h2-echo-mediation-proof",
    schemaVersion: "1",
    protocol: "mcp",
    protocolSpecVersion: registry.protocolSpecVersion,
    registryEntry: registry,
    approvedSchedule: schedule,
    echoInput: input,
    echoOutput: result.output,
    capabilityExecutions: result.capabilityExecutions,
    auditEvents: result.auditEvents,
    accountingIncrements: result.accountingIncrements,
    effects: Object.freeze({
      retries: 0,
      network: 0,
      systemSideAcquisition: 0,
      providerCalls: 0,
      privateReads: 0,
      filesystemOperations: 0,
      environmentReads: 0,
      databaseOperations: 0,
      subprocesses: 0,
      productionWrites: 0,
      deployments: 0,
    }),
    m4SuccessorSurface: H2_M4_SUCCESSOR_TEMPLATE,
  });
}
