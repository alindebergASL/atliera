import { types as utilTypes } from "node:util";

import type { AuditEvent } from "../graph/types.ts";
import { canonicalJson, getH2CapabilityRegistryEntry, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
  sha256Canonical } from "./h2-registry.ts";
import type { H2Clock } from "./h2-mediation-gate.ts";
import { M4OrchestratorMcpClient } from "./m4-orchestrator-mcp-client.ts";
import type { M4AccountingIncrement, M4CapabilityExecution, M4MediationResult,
  M4MediationRefusalCode, M4PublicHttpFetchInvocationSurface } from "./m4-public-http-fetch-mediation.ts";
import { createM4SecGateBLiveMcpServer } from "./public-http-fetch-mcp-server.ts";
import type { M4GateBActivation } from "./m4-sec-gate-b-activation.ts";
import type { M4LiveDependencies } from "./m4-sec-live-adapter.ts";
import { M4_TARGET_POLICY_REF, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import { M4_MAX_DURATION_MS, M4_TARGET_REF, M4_TARGET_URL, M4_ZERO_EFFECT_TELEMETRY,
  isStrictIsoTimestamp, validateM4SecUserAgent, type M4EffectTelemetry, type M4FetchRefusalCode,
  type M4PublicEvidence } from "./public-http-fetch-policy.ts";

function deterministicId(prefix: string, values: readonly string[]): string {
  return `${prefix}_${sha256Canonical(values).slice(0, 24)}`;
}
// The adapter's single DNS-to-body budget remains exactly 10s. This outer MCP envelope must not race it
// and erase the adapter's final effect telemetry; any completion beyond 10s is still classified as timed out below.
const M4_GATE_B_MCP_CALL_ENVELOPE_MS = M4_MAX_DURATION_MS + 1_000;
function refused(refusalCode: M4MediationRefusalCode): M4MediationResult {
  return Object.freeze({ ok: false, invoked: false, refusalCode, auditEvents: Object.freeze([]) as readonly [] });
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length) {
    throw new Error("invalid Gate B invocation");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new Error("invalid Gate B invocation");
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("invalid Gate B invocation");
    output[key] = descriptor.value;
  }
  return output;
}

function snapshotInvocation(value: unknown, activation: Readonly<M4GateBActivation>): typeof M4_TARGET_REF {
  const root = exact(value, ["trigger", "input"]);
  const trigger = exact(root.trigger, ["kind", "authorizationId", "oneShotConsumptionId"]);
  const input = exact(root.input, ["targetRef", "targetPolicySha256"]);
  if (trigger.kind !== "external_gate_b_one_shot_go" || trigger.authorizationId !== activation.authorizationId ||
      trigger.oneShotConsumptionId !== activation.oneShotConsumptionId || input.targetRef !== M4_TARGET_REF ||
      input.targetPolicySha256 !== M4_TARGET_POLICY_SHA256) throw new Error("invalid Gate B invocation");
  return M4_TARGET_REF;
}

function readWall(clock: H2Clock): string | undefined {
  try { const value = clock.nowIso(); return isStrictIsoTimestamp(value) ? value : undefined; } catch { return undefined; }
}
function readMono(clock: H2Clock): number | undefined {
  try { const value = clock.monotonicMs(); return Number.isSafeInteger(value) && value >= 0 ? value : undefined; }
  catch { return undefined; }
}

class M4SecGateBMediationKernel implements M4PublicHttpFetchInvocationSurface {
  readonly #activation: Readonly<M4GateBActivation>;
  readonly #clock: H2Clock;
  readonly #client: M4OrchestratorMcpClient;
  #state: "available" | "in_progress" | "consumed" = "available";

  constructor(options: { activation: Readonly<M4GateBActivation>; userAgent: string; clock: H2Clock;
    dependencies?: M4LiveDependencies }) {
    this.#activation = options.activation;
    this.#clock = options.clock;
    this.#client = new M4OrchestratorMcpClient(createM4SecGateBLiveMcpServer({ activation: options.activation,
      userAgent: options.userAgent, nowIso: () => options.clock.nowIso(), dependencies: options.dependencies }));
  }

  async invoke(value: unknown): Promise<M4MediationResult> {
    if (this.#state === "in_progress") return refused("schedule_in_progress");
    if (this.#state === "consumed") return refused("schedule_consumed");
    this.#state = "in_progress";
    let targetRef: typeof M4_TARGET_REF;
    try { targetRef = snapshotInvocation(value, this.#activation); }
    catch { this.#state = "consumed"; return refused("invalid_invocation_request"); }
    const admittedAt = readWall(this.#clock);
    if (admittedAt === undefined || admittedAt < this.#activation.validFrom || admittedAt >= this.#activation.validUntil) {
      this.#state = "consumed";
      return refused("schedule_not_approved");
    }
    const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
    let descriptorHash: string;
    try { descriptorHash = sha256Canonical(await this.#client.getLiveDescriptorSnapshot(M4_MAX_DURATION_MS)); }
    catch { this.#state = "consumed"; return refused("mcp_protocol_refused"); }
    if (descriptorHash !== registry.descriptorSha256) {
      this.#state = "consumed";
      return refused("descriptor_hash_drift");
    }
    const startedAt = readWall(this.#clock); const startedMono = readMono(this.#clock);
    if (startedAt === undefined || startedMono === undefined || startedAt < this.#activation.validFrom ||
        startedAt >= this.#activation.validUntil) {
      this.#state = "consumed";
      return refused("schedule_not_approved");
    }
    this.#state = "consumed";
    const executionId = deterministicId("capexec", [this.#activation.authorizationId,
      this.#activation.oneShotConsumptionId, descriptorHash, startedAt]);
    let output: M4PublicEvidence | null = null;
    let refusalCode: M4FetchRefusalCode | null = null;
    let effects: M4EffectTelemetry = M4_ZERO_EFFECT_TELEMETRY;
    try {
      const called = await this.#client.invoke(deterministicId("mcpcall", [executionId]), targetRef,
        M4_GATE_B_MCP_CALL_ENVELOPE_MS);
      output = called.acquisition; refusalCode = called.refusalCode; effects = called.effectTelemetry;
    } catch { refusalCode = "transport_refused"; }
    let completedAt = readWall(this.#clock); const completedMono = readMono(this.#clock);
    let durationMs = M4_MAX_DURATION_MS;
    if (completedAt === undefined || completedAt < startedAt || completedMono === undefined || completedMono < startedMono ||
        completedMono - startedMono > M4_MAX_DURATION_MS) {
      completedAt = startedAt; output = null; refusalCode = "timeout_or_cancelled";
    } else durationMs = completedMono - startedMono;
    const outcome = output === null ? "failed" : "completed";
    const inputBytes = Buffer.byteLength(canonicalJson({ targetRef, targetPolicySha256: M4_TARGET_POLICY_SHA256 }), "utf8");
    const execution: M4CapabilityExecution = Object.freeze({ kind: "CapabilityExecution", executionId,
      capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID, descriptorSha256: descriptorHash,
      targetPolicySha256: M4_TARGET_POLICY_SHA256, authorityKind: "external_gate_b_one_shot_go",
      authorityRef: this.#activation.authorizationId, mediationLevel: "L0", targetRef, inputBytes,
      outputBytes: output?.byteCount ?? 0, retryCount: 0, startedAt, completedAt, durationMs, outcome,
      refusalCode, effectTelemetry: effects });
    const audit: AuditEvent = Object.freeze({ id: deterministicId("audit", [executionId]), team_id: "system",
      actor_type: "system", actor_id: "external-gate-b-authority", event_type: `capability.execution.${outcome}`,
      target_type: "CapabilityExecution", target_id: executionId, payload_json: Object.freeze({
        capability_id: execution.capabilityId, descriptor_sha256: descriptorHash,
        target_policy_ref: M4_TARGET_POLICY_REF, target_policy_sha256: M4_TARGET_POLICY_SHA256,
        authority_kind: execution.authorityKind, authority_ref: this.#activation.authorizationId,
        one_shot_consumption_id: this.#activation.oneShotConsumptionId,
        authority_artifact_sha256: this.#activation.consumptionSha256, mediation_level: "L0", target_ref: targetRef,
        requested_url: M4_TARGET_URL, output_bytes: execution.outputBytes,
        response_sha256: output?.responseSha256 ?? effects.responseSha256,
        refusal_code: refusalCode, dns_attempts: effects.dnsAttempts, request_attempts: effects.requestAttempts,
        connection_attempts: effects.connectionAttempts, live_network_egress: effects.liveNetworkEgress,
        lookup_callbacks: effects.lookupCallbacks, selected_address: effects.selectedAddress,
        bytes_received: effects.bytesReceived, retry_count: 0,
        user_agent_audit: effects.userAgentAudit, provider_calls: 0, private_reads: 0, graph_writes: 0,
        production_writes: 0, deployments: 0,
      }), created_at: completedAt });
    const accounting: M4AccountingIncrement = Object.freeze({ kind: "capability-accounting-increment",
      incrementId: deterministicId("acct", [executionId]), executionId, capabilityInvocations: 1,
      capabilityExecutionRecords: 1, auditEventsEmitted: 1, liveNetworkEgressPerformed: effects.liveNetworkEgress,
      dnsAttemptsPerformed: effects.dnsAttempts, requestAttemptsPerformed: effects.requestAttempts,
      connectionAttemptsPerformed: effects.connectionAttempts, lookupCallbacksPerformed: effects.lookupCallbacks,
      bytesReceived: effects.bytesReceived, selectedAddress: effects.selectedAddress,
      systemSideAcquisitionProofsPerformed: output === null ? 0 : 1, retriesPerformed: 0,
      providerCallsExecuted: 0, privateReadsPerformed: 0, graphWritesPerformed: 0,
      productionWritesPerformed: 0, deploymentsPerformed: 0 });
    return Object.freeze({ ok: true, invoked: true, output,
      capabilityExecutions: Object.freeze([execution]) as readonly [M4CapabilityExecution],
      auditEvents: Object.freeze([audit]) as readonly [AuditEvent],
      accountingIncrements: Object.freeze([accounting]) as readonly [M4AccountingIncrement] });
  }
}

export interface M4SecGateBKernelOptions {
  readonly activation: Readonly<M4GateBActivation>;
  readonly userAgent: unknown;
  readonly clock: H2Clock;
  readonly dependencies?: M4LiveDependencies;
}

/** Gate B only. Validation occurs before the optional live dependency is read by the server. */
export function createM4SecGateBKernel(options: M4SecGateBKernelOptions): M4PublicHttpFetchInvocationSurface {
  if (validateM4SecUserAgent(options.userAgent) === null) throw new Error("Gate B User-Agent refused");
  return new M4SecGateBMediationKernel({ activation: options.activation, userAgent: options.userAgent as string,
    clock: options.clock, dependencies: options.dependencies });
}
