import assert from "node:assert/strict";
import test from "node:test";

import { parseAuditEvent } from "../../src/graph/schema.ts";
import {
  H2_CAPABILITY_REGISTRY,
  H2_ECHO_CAPABILITY_ID,
  canonicalJson,
  sha256Canonical,
} from "../../src/capability/h2-registry.ts";
import { createH2InertEchoMcpServer } from "../../src/capability/inert-echo-mcp-server.ts";
import type {
  H2McpCallRequest,
  H2McpCallResponse,
  H2McpInProcessTransport,
} from "../../src/capability/h2-mcp-protocol.ts";
import {
  H2EchoMediationKernel,
  type H2Clock,
} from "../../src/capability/h2-mediation-gate.ts";

const registry = H2_CAPABILITY_REGISTRY[0];

function clock(timestamps: string[], monotonic: number[] = []): H2Clock {
  return {
    nowIso(): string {
      const value = timestamps.shift();
      if (value === undefined) throw new Error("test clock exhausted");
      return value;
    },
    monotonicMs(): number {
      const value = monotonic.shift();
      if (value === undefined) throw new Error("test monotonic clock exhausted");
      return value;
    },
  };
}

function scheduleDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "h2-approved-capability-schedule",
    schemaVersion: "1",
    scheduleId: "sched_h2_echo_test",
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
    approvalId: "approval_h2_echo_test",
    approvedBy: "system-admin-test",
    approvedAt: "2026-07-10T11:59:00.000Z",
    validFrom: "2026-07-10T12:00:00.000Z",
    validUntil: "2026-07-10T12:05:00.000Z",
    ...overrides,
  };
}

function invocation(scheduleId = "sched_h2_echo_test", value = "bounded echo"): Record<string, unknown> {
  return {
    trigger: { kind: "approved_schedule", scheduleId },
    input: { value },
  };
}

function countingTransport(options: {
  descriptor?: unknown;
  throwOnCall?: boolean;
} = {}): { transport: H2McpInProcessTransport; calls: () => number } {
  const base = createH2InertEchoMcpServer();
  let calls = 0;
  return {
    transport: {
      getDescriptorSnapshot(): unknown {
        return options.descriptor ?? base.getDescriptorSnapshot();
      },
      async call(request: H2McpCallRequest): Promise<H2McpCallResponse> {
        calls += 1;
        if (options.throwOnCall) throw new Error("sensitive-detail-must-not-escape");
        return base.call(request);
      },
    },
    calls: () => calls,
  };
}

test("H2 registry contains one immutable inert echo entry and no M4 implementation", () => {
  assert.equal(H2_CAPABILITY_REGISTRY.length, 1);
  assert.equal(registry.capabilityId, H2_ECHO_CAPABILITY_ID);
  assert.equal(registry.protocol, "mcp");
  assert.equal(registry.protocolSpecVersion, "2025-11-25");
  assert.deepEqual(registry.allowedMediationLevels, ["L0"]);
  assert.equal(registry.budgetDefaults.retryBudget, 0);
  assert.equal(registry.budgetDefaults.maxInvocations, 1);
  assert.equal(registry.sandboxProfile.orchestratorSoleClient, true);
  for (const field of [
    "networkAllowed",
    "filesystemAllowed",
    "environmentAllowed",
    "providerCallsAllowed",
    "databaseAllowed",
    "subprocessAllowed",
    "deploymentAllowed",
  ] as const) {
    assert.equal(registry.sandboxProfile[field], false);
  }
  assert.equal(registry.descriptorSha256, sha256Canonical(registry.descriptorSnapshot));
  assert.ok(Object.isFrozen(H2_CAPABILITY_REGISTRY));
  assert.ok(Object.isFrozen(registry));
  assert.ok(Object.isFrozen(registry.descriptorSnapshot.inputSchema));
  assert.doesNotMatch(canonicalJson(H2_CAPABILITY_REGISTRY), /public_http_fetch_v1/);
});

test("test_capability_invocation_requires_consumed_approval_or_schedule", async () => {
  const observed = countingTransport();
  const kernel = new H2EchoMediationKernel({
    transport: observed.transport,
    clock: clock(["2026-07-10T12:00:01.000Z"]),
  });

  assert.deepEqual(await kernel.invoke(invocation("missing_schedule")), {
    ok: false,
    invoked: false,
    refusalCode: "schedule_not_approved",
  });
  assert.deepEqual(await kernel.invoke({ input: { value: "raw model text" } }), {
    ok: false,
    invoked: false,
    refusalCode: "invalid_invocation_request",
  });
  assert.equal(observed.calls(), 0);
});

test("approved schedule boundaries reject counterfeit authority and broadened budgets", () => {
  const cases: Record<string, unknown>[] = [
    scheduleDraft({ capabilityId: "system.other" }),
    scheduleDraft({ descriptorSha256: "0".repeat(64) }),
    scheduleDraft({ mediationLevel: "L1" }),
    scheduleDraft({ retryBudget: 1 }),
    scheduleDraft({ maxInvocations: 2 }),
    scheduleDraft({ invocationBudget: { ...registry.budgetDefaults, maxInputBytes: 513 } }),
    scheduleDraft({ invocationBudget: { ...registry.budgetDefaults, retryBudget: 1 } }),
    scheduleDraft({ invocationBudget: { ...registry.budgetDefaults, maxInvocations: 2 } }),
    scheduleDraft({ unexpected: true }),
  ];
  for (const candidate of cases) {
    assert.throws(
      () => new H2EchoMediationKernel().approveSchedule(candidate),
      /approved schedule boundary refused input/,
    );
  }

  let getterReads = 0;
  const forged = scheduleDraft();
  Object.defineProperty(forged, "approvedBy", {
    enumerable: true,
    get() {
      getterReads += 1;
      return "forged-admin";
    },
  });
  assert.throws(
    () => new H2EchoMediationKernel().approveSchedule(forged),
    /approved schedule boundary refused input/,
  );
  assert.equal(getterReads, 0);
});

test("approved schedule is snapshotted and invocation-time input is bounded before consumption", async () => {
  const draft = scheduleDraft();
  const kernel = new H2EchoMediationKernel({
    clock: clock(
      ["2026-07-10T12:00:01.000Z", "2026-07-10T12:00:01.004Z"],
      [10, 14],
    ),
  });
  const approved = kernel.approveSchedule(draft);
  (draft.invocationBudget as Record<string, unknown>).retryBudget = 9;
  draft.capabilityId = "system.other";
  assert.equal(approved.retryBudget, 0);
  assert.equal(approved.capabilityId, H2_ECHO_CAPABILITY_ID);
  assert.ok(Object.isFrozen(approved));
  assert.ok(Object.isFrozen(approved.invocationBudget));

  const malformed = await kernel.invoke({
    trigger: { kind: "approved_schedule", scheduleId: approved.scheduleId },
    input: { value: "x", extra: true },
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.invoked, false);

  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, true);
  assert.equal(result.invoked, true);
});

test("schedule validity window refuses not-yet-valid and expired invocations without transport access", async () => {
  for (const [at, code] of [
    ["2026-07-10T11:59:59.999Z", "schedule_not_yet_valid"],
    ["2026-07-10T12:05:00.001Z", "schedule_expired"],
  ] as const) {
    const observed = countingTransport();
    const kernel = new H2EchoMediationKernel({ transport: observed.transport, clock: clock([at]) });
    kernel.approveSchedule(scheduleDraft());
    const result = await kernel.invoke(invocation());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.refusalCode, code);
    assert.equal(observed.calls(), 0);
  }
});

test("test_descriptor_hash_match_at_invocation", async () => {
  const driftedDescriptor = {
    ...registry.descriptorSnapshot,
    description: "changed after schedule approval",
  };
  const observed = countingTransport({ descriptor: driftedDescriptor });
  const kernel = new H2EchoMediationKernel({
    transport: observed.transport,
    clock: clock(["2026-07-10T12:00:01.000Z"]),
  });
  kernel.approveSchedule(scheduleDraft());
  assert.deepEqual(await kernel.invoke(invocation()), {
    ok: false,
    invoked: false,
    refusalCode: "descriptor_hash_drift",
  });
  assert.equal(observed.calls(), 0);
});

test("test_retry_budget_enforced", async () => {
  const observed = countingTransport();
  const kernel = new H2EchoMediationKernel({
    transport: observed.transport,
    clock: clock(
      ["2026-07-10T12:00:01.000Z", "2026-07-10T12:00:01.003Z"],
      [20, 23],
    ),
  });
  kernel.approveSchedule(scheduleDraft());
  const first = await kernel.invoke(invocation());
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.capabilityExecutions[0].retryCount, 0);
  assert.deepEqual(await kernel.invoke(invocation()), {
    ok: false,
    invoked: false,
    refusalCode: "schedule_consumed",
  });
  assert.equal(observed.calls(), 1);
});

test("test_capability_invocation_emits_audit_and_accounting", async () => {
  const observed = countingTransport();
  const kernel = new H2EchoMediationKernel({
    transport: observed.transport,
    clock: clock(
      ["2026-07-10T12:00:01.000Z", "2026-07-10T12:00:01.007Z"],
      [100, 107],
    ),
  });
  const schedule = kernel.approveSchedule(scheduleDraft());
  const result = await kernel.invoke(invocation(schedule.scheduleId, "same bounded value"));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(observed.calls(), 1);
  assert.deepEqual(result.output, { value: "same bounded value" });
  assert.equal(result.capabilityExecutions.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.accountingIncrements.length, 1);

  const execution = result.capabilityExecutions[0];
  assert.equal(execution.kind, "CapabilityExecution");
  assert.equal(execution.capabilityId, H2_ECHO_CAPABILITY_ID);
  assert.equal(execution.descriptorSha256, registry.descriptorSha256);
  assert.equal(execution.authorityRef, schedule.scheduleId);
  assert.equal(execution.mediationLevel, "L0");
  assert.ok(execution.inputBytes > 0);
  assert.equal(execution.inputBytes, execution.outputBytes);
  assert.equal(execution.retryCount, 0);
  assert.equal(execution.durationMs, 7);
  assert.equal(execution.outcome, "completed");

  const parsedAudit = parseAuditEvent(result.auditEvents[0]);
  assert.equal(parsedAudit.ok, true);
  assert.equal(result.auditEvents[0].target_id, execution.executionId);
  assert.equal(result.auditEvents[0].payload_json.descriptor_sha256, registry.descriptorSha256);
  assert.equal(result.auditEvents[0].payload_json.authority_ref, schedule.scheduleId);
  assert.doesNotMatch(JSON.stringify(result.auditEvents[0]), /same bounded value/);

  assert.deepEqual(result.accountingIncrements[0], {
    kind: "capability-accounting-increment",
    incrementId: result.accountingIncrements[0].incrementId,
    executionId: execution.executionId,
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
});

test("transport failures remain sanitized while preserving one execution, audit, and accounting record", async () => {
  const observed = countingTransport({ throwOnCall: true });
  const kernel = new H2EchoMediationKernel({
    transport: observed.transport,
    clock: clock(
      ["2026-07-10T12:00:01.000Z", "2026-07-10T12:00:01.002Z"],
      [1, 3],
    ),
  });
  kernel.approveSchedule(scheduleDraft());
  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.output, null);
  assert.equal(result.capabilityExecutions[0].outcome, "failed");
  assert.equal(result.capabilityExecutions.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.accountingIncrements.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /sensitive-detail-must-not-escape/);
  assert.equal(observed.calls(), 1);
});
