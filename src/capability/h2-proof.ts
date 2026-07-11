import { H2_M4_SUCCESSOR_TEMPLATE } from "./h2-m4-successor-template.ts";
import {
  H2_APPROVED_ECHO_SCHEDULE,
  H2_APPROVED_ECHO_SCHEDULE_AUTHORITY_REF,
  H2_APPROVED_ECHO_SCHEDULE_SHA256,
} from "./h2-approved-schedule.ts";
import {
  H2_CAPABILITY_REGISTRY,
} from "./h2-registry.ts";
import {
  createH2EchoMediationKernelForTest,
  type H2Clock,
} from "./h2-mediation-gate.ts";

const STARTED_AT = "2026-07-10T12:00:02.000Z";
const COMPLETED_AT = "2026-07-10T12:00:02.007Z";

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
  const schedule = H2_APPROVED_ECHO_SCHEDULE;
  const kernel = createH2EchoMediationKernelForTest({ clock: deterministicProofClock() });
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
    approvedScheduleAuthority: Object.freeze({
      artifactRef: H2_APPROVED_ECHO_SCHEDULE_AUTHORITY_REF,
      artifactSha256: H2_APPROVED_ECHO_SCHEDULE_SHA256,
    }),
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
