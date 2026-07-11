import assert from "node:assert/strict";
import test from "node:test";

import { parseAuditEvent } from "../../src/graph/schema.ts";
import {
  H2_APPROVED_ECHO_SCHEDULE,
  H2_APPROVED_ECHO_SCHEDULE_SHA256,
} from "../../src/capability/h2-approved-schedule.ts";
import {
  H2_CAPABILITY_REGISTRY,
  H2_ECHO_CAPABILITY_ID,
  canonicalJson,
  sha256Canonical,
} from "../../src/capability/h2-registry.ts";
import { createH2InertEchoMcpServer } from "../../src/capability/inert-echo-mcp-server.ts";
import type {
  H2McpInProcessTransport,
  H2McpNotification,
  H2McpRequest,
  H2McpRequestOptions,
  H2McpResponse,
} from "../../src/capability/h2-mcp-protocol.ts";
import {
  createH2EchoMediationKernelForTest,
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

function invocation(
  scheduleId: string = H2_APPROVED_ECHO_SCHEDULE.scheduleId,
  value = "bounded echo",
): Record<string, unknown> {
  return {
    trigger: { kind: "approved_schedule", scheduleId },
    input: { value },
  };
}

function countingTransport(options: {
  descriptor?: unknown;
  throwOnCall?: boolean;
} = {}): { transport: H2McpInProcessTransport; toolCalls: () => number } {
  const base = createH2InertEchoMcpServer();
  let toolCalls = 0;
  return {
    transport: {
      sendNotification(notification: H2McpNotification): Promise<void> {
        return base.sendNotification(notification);
      },
      async sendRequest(
        request: H2McpRequest,
        requestOptions?: H2McpRequestOptions,
      ): Promise<H2McpResponse> {
        const response = await base.sendRequest(request, requestOptions);
        if (request.method === "tools/list" && options.descriptor !== undefined) {
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: { tools: [options.descriptor] },
          };
        }
        if (request.method === "tools/call") {
          toolCalls += 1;
          if (options.throwOnCall) throw new Error("sensitive-detail-must-not-escape");
        }
        return response;
      },
    },
    toolCalls: () => toolCalls,
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

test("repository-pinned schedule authority is immutable and exact", () => {
  assert.equal(
    sha256Canonical(H2_APPROVED_ECHO_SCHEDULE),
    H2_APPROVED_ECHO_SCHEDULE_SHA256,
  );
  assert.equal(H2_APPROVED_ECHO_SCHEDULE.capabilityId, H2_ECHO_CAPABILITY_ID);
  assert.equal(H2_APPROVED_ECHO_SCHEDULE.descriptorSha256, registry.descriptorSha256);
  assert.equal(H2_APPROVED_ECHO_SCHEDULE.mediationLevel, "L0");
  assert.equal(H2_APPROVED_ECHO_SCHEDULE.retryBudget, 0);
  assert.equal(H2_APPROVED_ECHO_SCHEDULE.maxInvocations, 1);
  assert.deepEqual(H2_APPROVED_ECHO_SCHEDULE.invocationBudget, registry.budgetDefaults);
  assert.ok(Object.isFrozen(H2_APPROVED_ECHO_SCHEDULE));
  assert.ok(Object.isFrozen(H2_APPROVED_ECHO_SCHEDULE.invocationBudget));
});

test("test_capability_invocation_requires_consumed_approval_or_schedule", async () => {
  const observed = countingTransport();
  const kernel = createH2EchoMediationKernelForTest({
    transport: observed.transport,
    clock: clock(["2026-07-10T12:00:02.000Z"]),
  });

  assert.deepEqual(await kernel.invoke(invocation("missing_schedule")), {
    ok: false,
    invoked: false,
    refusalCode: "schedule_not_approved",
    auditEvents: [],
  });
  assert.deepEqual(await kernel.invoke({ input: { value: "raw model text" } }), {
    ok: false,
    invoked: false,
    refusalCode: "invalid_invocation_request",
    auditEvents: [],
  });
  assert.equal(observed.toolCalls(), 0);
  assert.equal("approveSchedule" in kernel, false);
});

test("invocation-time input is bounded before one-shot consumption", async () => {
  const kernel = createH2EchoMediationKernelForTest({
    clock: clock(
      [
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.004Z",
      ],
      [10, 14],
    ),
  });
  const malformed = await kernel.invoke({
    trigger: {
      kind: "approved_schedule",
      scheduleId: H2_APPROVED_ECHO_SCHEDULE.scheduleId,
    },
    input: { value: "x", extra: true },
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.invoked, false);

  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, true);
  assert.equal(result.invoked, true);
});

test("schedule validity window refuses not-yet-valid and exact-or-later expiry without MCP access", async () => {
  for (const [at, code] of [
    ["2026-07-10T12:00:00.999Z", "schedule_not_yet_valid"],
    [H2_APPROVED_ECHO_SCHEDULE.validUntil, "schedule_expired"],
    ["2026-07-10T12:05:00.001Z", "schedule_expired"],
  ] as const) {
    const observed = countingTransport();
    const kernel = createH2EchoMediationKernelForTest({
      transport: observed.transport,
      clock: clock([at]),
    });
    const result = await kernel.invoke(invocation());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.refusalCode, code);
    assert.equal(observed.toolCalls(), 0);
  }
});

test("test_descriptor_hash_match_at_invocation emits refusal audit without tools/call", async () => {
  const driftedDescriptor = {
    ...registry.descriptorSnapshot,
    description: "changed after schedule approval",
  };
  const observed = countingTransport({ descriptor: driftedDescriptor });
  const kernel = createH2EchoMediationKernelForTest({
    transport: observed.transport,
    clock: clock(["2026-07-10T12:00:02.000Z"]),
  });
  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.refusalCode, "descriptor_hash_drift");
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.auditEvents[0].payload_json.refusal_reason, "descriptor_hash_drift");
  assert.equal(result.auditEvents[0].payload_json.network_effects, 0);
  assert.equal(observed.toolCalls(), 0);
});

test("test_retry_budget_enforced", async () => {
  const observed = countingTransport();
  const kernel = createH2EchoMediationKernelForTest({
    transport: observed.transport,
    clock: clock(
      [
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.003Z",
      ],
      [20, 23],
    ),
  });
  const first = await kernel.invoke(invocation());
  assert.equal(first.ok, true);
  if (first.ok) assert.equal(first.capabilityExecutions[0].retryCount, 0);
  assert.deepEqual(await kernel.invoke(invocation()), {
    ok: false,
    invoked: false,
    refusalCode: "schedule_consumed",
    auditEvents: [],
  });
  assert.equal(observed.toolCalls(), 1);
});

test("test_capability_invocation_emits_audit_and_accounting", async () => {
  const observed = countingTransport();
  const kernel = createH2EchoMediationKernelForTest({
    transport: observed.transport,
    clock: clock(
      [
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.007Z",
      ],
      [100, 107],
    ),
  });
  const result = await kernel.invoke(invocation(undefined, "same bounded value"));
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(observed.toolCalls(), 1);
  assert.deepEqual(result.output, { value: "same bounded value" });
  assert.equal(result.capabilityExecutions.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.accountingIncrements.length, 1);

  const execution = result.capabilityExecutions[0];
  assert.equal(execution.kind, "CapabilityExecution");
  assert.equal(execution.capabilityId, H2_ECHO_CAPABILITY_ID);
  assert.equal(execution.descriptorSha256, registry.descriptorSha256);
  assert.equal(execution.authorityRef, H2_APPROVED_ECHO_SCHEDULE.scheduleId);
  assert.equal(execution.mediationLevel, "L0");
  assert.ok(execution.inputBytes > 0);
  assert.equal(execution.inputBytes, execution.outputBytes);
  assert.equal(execution.retryCount, 0);
  assert.equal(execution.durationMs, 7);
  assert.equal(execution.outcome, "completed");

  assert.equal(parseAuditEvent(result.auditEvents[0]).ok, true);
  assert.equal(result.auditEvents[0].target_id, execution.executionId);
  assert.equal(result.auditEvents[0].payload_json.descriptor_sha256, registry.descriptorSha256);
  assert.equal(
    result.auditEvents[0].payload_json.authority_ref,
    H2_APPROVED_ECHO_SCHEDULE.scheduleId,
  );
  assert.doesNotMatch(JSON.stringify(result.auditEvents[0]), /same bounded value/);
  assert.equal(result.accountingIncrements[0].capabilityInvocations, 1);
  assert.equal(result.accountingIncrements[0].auditEventsEmitted, 1);
  assert.equal(result.accountingIncrements[0].networkEgressPerformed, 0);
  assert.equal(result.accountingIncrements[0].providerCallsExecuted, 0);
  assert.equal(result.accountingIncrements[0].databaseOperationsPerformed, 0);
  assert.equal(result.accountingIncrements[0].deploymentsPerformed, 0);
});

test("transport failures remain sanitized while preserving one execution, audit, and accounting record", async () => {
  const observed = countingTransport({ throwOnCall: true });
  const kernel = createH2EchoMediationKernelForTest({
    transport: observed.transport,
    clock: clock(
      [
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.002Z",
      ],
      [1, 3],
    ),
  });
  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.output, null);
  assert.equal(result.capabilityExecutions[0].outcome, "failed");
  assert.equal(result.capabilityExecutions.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.accountingIncrements.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /sensitive-detail-must-not-escape/);
  assert.equal(observed.toolCalls(), 1);
});
