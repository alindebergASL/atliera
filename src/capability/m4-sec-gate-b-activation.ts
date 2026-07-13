import { createHash } from "node:crypto";
import { openSync, closeSync, fsyncSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, normalize } from "node:path";
import { types as utilTypes } from "node:util";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";

export const M4_GATE_B_EXPECTED_CUSTODY_OUTPUT =
  "artifacts/m4-sec-gate-b/sec-fedex-submissions-custody.json" as const;
export const M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT =
  "artifacts/m4-sec-gate-b/sec-fedex-submissions-workshop.html" as const;
export const M4_GATE_B_TAKEDOWN_POSTURE =
  "quarantine_and_stop_downstream_use; retain_minimum_audit_hash_unless_deletion_required" as const;
export const M4_GATE_B_FAILURE_BEHAVIOR =
  "consume_once; zero_retry; destroy_resources; write_no_evidence_output" as const;
export const M4_GATE_B_ROLLBACK_BEHAVIOR =
  "remain_unarmed; require_new_explicit_go_for_any_later_attempt" as const;

export interface M4GateBActivation {
  readonly authorizationId: string;
  readonly oneShotConsumptionId: string;
  readonly reviewedAdapterCommit: string;
  readonly authorizedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly consumedAt: string;
  readonly consumptionPath: string;
  readonly consumptionSha256: string;
  readonly goSha256: string;
  readonly retentionDays: 30;
  readonly takedownPosture: typeof M4_GATE_B_TAKEDOWN_POSTURE;
  readonly expectedCustodyOutput: typeof M4_GATE_B_EXPECTED_CUSTODY_OUTPUT;
  readonly expectedWorkshopOutput: typeof M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT;
  readonly failureBehavior: typeof M4_GATE_B_FAILURE_BEHAVIOR;
  readonly rollbackBehavior: typeof M4_GATE_B_ROLLBACK_BEHAVIOR;
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length) throw new Error("Gate B GO refused");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new Error("Gate B GO refused");
  const output: Record<string, unknown> = {};
  for (const key of keys) { const descriptor = descriptors[key]; if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("Gate B GO refused"); output[key] = descriptor.value; }
  return output;
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

/** Exclusively consumes a private external GO before any DNS/network dependency may be constructed. */
export function consumeM4GateBGo(
  goPath: string,
  expectedReviewedAdapterCommit: string,
  now = new Date(),
): Readonly<M4GateBActivation> {
  let parsed: unknown; let goBytes: string;
  try { goBytes = readFileSync(goPath, "utf8"); parsed = JSON.parse(goBytes); } catch { throw new Error("Gate B GO refused"); }
  const root = exactObject(parsed, ["kind", "schemaVersion", "authorizationId", "oneShotConsumptionId", "oneShotConsumptionPath", "reviewedAdapterCommit",
    "targetRef", "targetUrl", "targetPolicySha256", "cik", "authorizedAt", "validFrom", "validUntil",
    "userAgentConfigInput", "networkBudget", "retentionDays", "takedownPosture", "expectedCustodyOutput",
    "expectedWorkshopOutput", "failureBehavior", "rollbackBehavior", "authorizesLiveAcquisition"]);
  const networkBudget = exactObject(root.networkBudget, ["scheme", "effectivePort", "method", "addressFamily",
    "maxTargets", "maxRequests", "onePinnedAddress", "oneConnectionAttempt", "redirectLimit", "retryBudget",
    "totalDeadlineMs", "maxBodyBytes", "acceptedContentTypes"]);
  const acceptedContentTypes = networkBudget.acceptedContentTypes;
  const exactMime = Array.isArray(acceptedContentTypes) && Object.getPrototypeOf(acceptedContentTypes) === Array.prototype &&
    Object.getOwnPropertySymbols(acceptedContentTypes).length === 0 &&
    Object.getOwnPropertyNames(acceptedContentTypes).length === 2 && acceptedContentTypes.length === 1 &&
    Object.getOwnPropertyDescriptor(acceptedContentTypes, "0")?.value === "application/json";
  if (root.kind !== "m4-sec-gate-b-one-shot-go" || root.schemaVersion !== "1" ||
      typeof root.authorizationId !== "string" || !/^[A-Za-z0-9._-]{8,128}$/.test(root.authorizationId) ||
      typeof root.oneShotConsumptionId !== "string" || !/^[A-Za-z0-9._-]{8,128}$/.test(root.oneShotConsumptionId) ||
      typeof root.oneShotConsumptionPath !== "string" || !isAbsolute(root.oneShotConsumptionPath) ||
      normalize(root.oneShotConsumptionPath) !== root.oneShotConsumptionPath ||
      basename(root.oneShotConsumptionPath) !== `.atliera-m4-sec-consumed-${root.oneShotConsumptionId}.json` ||
      typeof root.reviewedAdapterCommit !== "string" || !/^[a-f0-9]{40}$/.test(root.reviewedAdapterCommit) ||
      !/^[a-f0-9]{40}$/.test(expectedReviewedAdapterCommit) ||
      root.reviewedAdapterCommit !== expectedReviewedAdapterCommit ||
      root.targetRef !== M4_CANONICAL_TARGET_POLICY.targetRef || root.targetUrl !== M4_CANONICAL_TARGET_POLICY.url ||
      root.targetPolicySha256 !== M4_TARGET_POLICY_SHA256 || root.cik !== M4_CANONICAL_TARGET_POLICY.expectedIdentity.cik ||
      root.userAgentConfigInput !== M4_CANONICAL_TARGET_POLICY.userAgent.configInput || root.authorizesLiveAcquisition !== true ||
      networkBudget.scheme !== "https" || networkBudget.effectivePort !== 443 || networkBudget.method !== "GET" ||
      networkBudget.addressFamily !== 4 || networkBudget.maxTargets !== 1 || networkBudget.maxRequests !== 1 ||
      networkBudget.onePinnedAddress !== true || networkBudget.oneConnectionAttempt !== true ||
      networkBudget.redirectLimit !== 0 || networkBudget.retryBudget !== 0 || networkBudget.totalDeadlineMs !== 10_000 ||
      networkBudget.maxBodyBytes !== 1_048_576 || !exactMime || root.retentionDays !== 30 ||
      root.takedownPosture !== M4_GATE_B_TAKEDOWN_POSTURE ||
      root.expectedCustodyOutput !== M4_GATE_B_EXPECTED_CUSTODY_OUTPUT ||
      root.expectedWorkshopOutput !== M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT ||
      root.failureBehavior !== M4_GATE_B_FAILURE_BEHAVIOR || root.rollbackBehavior !== M4_GATE_B_ROLLBACK_BEHAVIOR ||
      !timestamp(root.authorizedAt) || !timestamp(root.validFrom) || !timestamp(root.validUntil) ||
      Date.parse(root.validFrom) > now.getTime() || now.getTime() >= Date.parse(root.validUntil) ||
      Date.parse(root.authorizedAt) > Date.parse(root.validFrom) || Date.parse(root.validFrom) >= Date.parse(root.validUntil)) {
    throw new Error("Gate B GO refused");
  }
  const goSha256 = createHash("sha256").update(goBytes, "utf8").digest("hex");
  const consumptionPath = root.oneShotConsumptionPath as string;
  let descriptor: number;
  try { descriptor = openSync(consumptionPath, "wx", 0o600); } catch { throw new Error("Gate B GO replay refused"); }
  const consumedAt = now.toISOString();
  const consumptionBytes = `${JSON.stringify({ kind: "m4-sec-gate-b-consumption", authorizationId: root.authorizationId,
    oneShotConsumptionId: root.oneShotConsumptionId, reviewedAdapterCommit: root.reviewedAdapterCommit,
    authorizedAt: root.authorizedAt, validFrom: root.validFrom, validUntil: root.validUntil, consumedAt, goSha256,
    targetPolicySha256: M4_TARGET_POLICY_SHA256 })}\n`;
  try {
    writeFileSync(descriptor, consumptionBytes, "utf8");
    fsyncSync(descriptor);
  } finally { closeSync(descriptor); }
  let directoryDescriptor: number;
  try {
    directoryDescriptor = openSync(dirname(consumptionPath), "r");
    try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
  } catch { throw new Error("Gate B GO consumption durability refused"); }
  return Object.freeze({ authorizationId: root.authorizationId, oneShotConsumptionId: root.oneShotConsumptionId,
    reviewedAdapterCommit: root.reviewedAdapterCommit, authorizedAt: root.authorizedAt, validFrom: root.validFrom,
    validUntil: root.validUntil, consumedAt, consumptionPath,
    consumptionSha256: createHash("sha256").update(consumptionBytes, "utf8").digest("hex"), goSha256,
    retentionDays: 30, takedownPosture: M4_GATE_B_TAKEDOWN_POSTURE,
    expectedCustodyOutput: M4_GATE_B_EXPECTED_CUSTODY_OUTPUT,
    expectedWorkshopOutput: M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT,
    failureBehavior: M4_GATE_B_FAILURE_BEHAVIOR, rollbackBehavior: M4_GATE_B_ROLLBACK_BEHAVIOR });
}

/** Revalidates the opaque result of consumeM4GateBGo before a live transport can be built. */
export function assertM4GateBActivationConsumed(value: unknown, nowIso: string): Readonly<M4GateBActivation> {
  const root = exactObject(value, ["authorizationId", "oneShotConsumptionId", "reviewedAdapterCommit", "authorizedAt",
    "validFrom", "validUntil", "consumedAt", "consumptionPath", "consumptionSha256", "goSha256",
    "retentionDays", "takedownPosture", "expectedCustodyOutput", "expectedWorkshopOutput", "failureBehavior",
    "rollbackBehavior"]);
  if (typeof root.authorizationId !== "string" || !/^[A-Za-z0-9._-]{8,128}$/.test(root.authorizationId) ||
      typeof root.oneShotConsumptionId !== "string" || !/^[A-Za-z0-9._-]{8,128}$/.test(root.oneShotConsumptionId) ||
      typeof root.reviewedAdapterCommit !== "string" || !/^[a-f0-9]{40}$/.test(root.reviewedAdapterCommit) ||
      !timestamp(root.authorizedAt) || !timestamp(root.validFrom) || !timestamp(root.validUntil) || !timestamp(root.consumedAt) ||
      !timestamp(nowIso) || nowIso < root.validFrom || nowIso >= root.validUntil || root.consumedAt < root.validFrom ||
      root.consumedAt >= root.validUntil || typeof root.consumptionPath !== "string" ||
      typeof root.consumptionSha256 !== "string" || !/^[a-f0-9]{64}$/.test(root.consumptionSha256) ||
      typeof root.goSha256 !== "string" || !/^[a-f0-9]{64}$/.test(root.goSha256) || root.retentionDays !== 30 ||
      root.takedownPosture !== M4_GATE_B_TAKEDOWN_POSTURE ||
      root.expectedCustodyOutput !== M4_GATE_B_EXPECTED_CUSTODY_OUTPUT ||
      root.expectedWorkshopOutput !== M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT ||
      root.failureBehavior !== M4_GATE_B_FAILURE_BEHAVIOR || root.rollbackBehavior !== M4_GATE_B_ROLLBACK_BEHAVIOR) {
    throw new Error("Gate B activation refused");
  }
  let bytes: string; try { bytes = readFileSync(root.consumptionPath, "utf8"); } catch { throw new Error("Gate B activation refused"); }
  if (createHash("sha256").update(bytes, "utf8").digest("hex") !== root.consumptionSha256) throw new Error("Gate B activation refused");
  let parsed: unknown; try { parsed = JSON.parse(bytes); } catch { throw new Error("Gate B activation refused"); }
  const record = exactObject(parsed, ["kind", "authorizationId", "oneShotConsumptionId", "reviewedAdapterCommit",
    "authorizedAt", "validFrom", "validUntil", "consumedAt", "goSha256", "targetPolicySha256"]);
  if (record.kind !== "m4-sec-gate-b-consumption" || record.authorizationId !== root.authorizationId ||
      record.oneShotConsumptionId !== root.oneShotConsumptionId || record.consumedAt !== root.consumedAt ||
      record.reviewedAdapterCommit !== root.reviewedAdapterCommit || record.authorizedAt !== root.authorizedAt ||
      record.validFrom !== root.validFrom || record.validUntil !== root.validUntil || record.goSha256 !== root.goSha256 ||
      record.targetPolicySha256 !== M4_TARGET_POLICY_SHA256) throw new Error("Gate B activation refused");
  return Object.freeze(root as unknown as M4GateBActivation);
}
