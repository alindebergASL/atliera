import {
  H2_ECHO_CAPABILITY_ID,
  getH2CapabilityRegistryEntry,
  sha256Canonical,
} from "./h2-registry.ts";
import type { H2CapabilityBudgetDefaults } from "./h2-registry.ts";

export interface H2ApprovedSchedule {
  readonly kind: "h2-approved-capability-schedule";
  readonly schemaVersion: "1";
  readonly scheduleId: "sched_h2_echo_proof_v1";
  readonly capabilityId: typeof H2_ECHO_CAPABILITY_ID;
  readonly descriptorSha256: string;
  readonly mediationLevel: "L0";
  readonly invocationBudget: H2CapabilityBudgetDefaults;
  readonly retryBudget: 0;
  readonly maxInvocations: 1;
  readonly approvalId: "approval_h2_echo_proof_v1";
  readonly approvedBy: "atliera-system-admin";
  readonly approvedAt: "2026-07-10T12:00:00.000Z";
  readonly validFrom: "2026-07-10T12:00:01.000Z";
  readonly validUntil: "2026-07-10T12:05:00.000Z";
}

export const H2_APPROVED_ECHO_SCHEDULE_AUTHORITY_REF =
  "src/capability/h2-approved-schedule.ts#H2_APPROVED_ECHO_SCHEDULE" as const;

const registry = getH2CapabilityRegistryEntry(H2_ECHO_CAPABILITY_ID);
if (registry === undefined) throw new Error("H2 inert echo registry entry missing");

export const H2_APPROVED_ECHO_SCHEDULE: H2ApprovedSchedule = Object.freeze({
  kind: "h2-approved-capability-schedule",
  schemaVersion: "1",
  scheduleId: "sched_h2_echo_proof_v1",
  capabilityId: H2_ECHO_CAPABILITY_ID,
  descriptorSha256: registry.descriptorSha256,
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
  approvalId: "approval_h2_echo_proof_v1",
  approvedBy: "atliera-system-admin",
  approvedAt: "2026-07-10T12:00:00.000Z",
  validFrom: "2026-07-10T12:00:01.000Z",
  validUntil: "2026-07-10T12:05:00.000Z",
});

export const H2_APPROVED_ECHO_SCHEDULE_SHA256 =
  "dd55d62c6b87a8cb395c6cfd88c7707cf88dec418d843debdd2a9ec4d5bdead4" as const;

if (sha256Canonical(H2_APPROVED_ECHO_SCHEDULE) !== H2_APPROVED_ECHO_SCHEDULE_SHA256) {
  throw new Error("H2 approved echo schedule authority hash mismatch");
}
