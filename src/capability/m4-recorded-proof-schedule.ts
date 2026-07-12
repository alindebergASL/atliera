import { M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID, getH2CapabilityRegistryEntry, sha256Canonical } from "./h2-registry.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_REF, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";

const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);

export const M4_RECORDED_PROOF_SCHEDULE_AUTHORITY_REF =
  "src/capability/m4-recorded-proof-schedule.ts#M4_RECORDED_PROOF_SCHEDULE" as const;

export const M4_RECORDED_PROOF_SCHEDULE = Object.freeze({
  kind: "approved_recorded_capability_schedule" as const,
  schemaVersion: "1" as const,
  scheduleId: "sched_m4_recorded_fedex_proof_v1" as const,
  capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
  descriptorSha256: "5a9d1a7c79a3e5ea9039b37e4ecceac4297a9f0bf638ec7a6c591dae747b5edb" as const,
  targetPolicyRef: M4_TARGET_POLICY_REF,
  targetPolicySha256: M4_TARGET_POLICY_SHA256,
  mediationLevel: "L0" as const,
  targetRefs: Object.freeze(["fedex_company_overview" as const]),
  transport: "recorded_inert_exchange" as const,
  invocationBudget: registry.budgetDefaults,
  networkPolicy: Object.freeze({
    scheme: "https" as const,
    effectivePort: 443 as const,
    redirectLimit: 0 as const,
    retryBudget: 0 as const,
    maxTargets: 1 as const,
    maxDurationMs: 10_000 as const,
    maxBodyBytes: 1_048_576 as const,
    acceptedContentTypes: Object.freeze(["text/html" as const, "text/plain" as const]),
    trustStatus: "quoted_untrusted_public_source_content" as const,
  }),
  retryBudget: 0 as const,
  maxInvocations: 1 as const,
  approvalId: "approval_m4_recorded_proof_v1" as const,
  approvedBy: "atliera-system-admin" as const,
  approvedAt: "2026-07-11T12:00:00.000Z" as const,
  validFrom: "2026-07-11T12:00:01.000Z" as const,
  validUntil: "2026-07-11T12:05:00.000Z" as const,
  liveNetworkAuthorized: false as const,
});

export const M4_RECORDED_PROOF_SCHEDULE_SHA256 =
  "d5672d876635f2d51516b9ddeb598ab760e6015904449789891948c05094e79c" as const;

if (registry.descriptorSha256 !== M4_RECORDED_PROOF_SCHEDULE.descriptorSha256 ||
    registry.targetPolicySha256 !== M4_TARGET_POLICY_SHA256 ||
    sha256Canonical(M4_CANONICAL_TARGET_POLICY) !== M4_TARGET_POLICY_SHA256 ||
    sha256Canonical(M4_RECORDED_PROOF_SCHEDULE) !== M4_RECORDED_PROOF_SCHEDULE_SHA256) {
  throw new Error("M4 recorded proof schedule authority hash mismatch");
}
