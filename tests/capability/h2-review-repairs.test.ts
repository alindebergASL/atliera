import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  H2_APPROVED_ECHO_SCHEDULE,
  H2_APPROVED_ECHO_SCHEDULE_SHA256,
} from "../../src/capability/h2-approved-schedule.ts";
import { createH2InertEchoMcpServer } from "../../src/capability/inert-echo-mcp-server.ts";
import type {
  H2McpInProcessTransport,
  H2McpNotification,
  H2McpRequest,
  H2McpResponse,
} from "../../src/capability/h2-mcp-protocol.ts";
import {
  createH2EchoMediationKernelForTest,
  type H2Clock,
} from "../../src/capability/h2-mediation-gate.ts";
import { sha256Canonical } from "../../src/capability/h2-registry.ts";

const ROOT = join(import.meta.dirname, "..", "..");

function clock(timestamps: Array<string | Error>, monotonic: Array<number | Error>): H2Clock {
  return {
    nowIso(): string {
      const value = timestamps.shift();
      if (value instanceof Error) throw value;
      if (value === undefined) throw new Error("test clock exhausted");
      return value;
    },
    monotonicMs(): number {
      const value = monotonic.shift();
      if (value instanceof Error) throw value;
      if (value === undefined) throw new Error("test monotonic clock exhausted");
      return value;
    },
  };
}

function invokeInput(): Record<string, unknown> {
  return {
    trigger: {
      kind: "approved_schedule",
      scheduleId: H2_APPROVED_ECHO_SCHEDULE.scheduleId,
    },
    input: { value: "review repair echo" },
  };
}

function recordingTransport(base = createH2InertEchoMcpServer()): {
  transport: H2McpInProcessTransport;
  methods: string[];
} {
  const methods: string[] = [];
  return {
    methods,
    transport: {
      async sendRequest(request: H2McpRequest, options?: { readonly signal?: AbortSignal }): Promise<H2McpResponse> {
        methods.push(request.method);
        return base.sendRequest(request, options);
      },
      async sendNotification(notification: H2McpNotification): Promise<void> {
        methods.push(notification.method);
        await base.sendNotification(notification);
      },
    },
  };
}

test("MCP lifecycle is initialize then initialized then tools/list then tools/call", async () => {
  const observed = recordingTransport();
  const kernel = createH2EchoMediationKernelForTest({
    transport: observed.transport,
    clock: clock(
      ["2026-07-10T12:00:02.000Z", "2026-07-10T12:00:02.007Z"],
      [100, 107],
    ),
  });
  const result = await kernel.invoke(invokeInput());
  assert.equal(result.ok, true);
  assert.deepEqual(observed.methods, [
    "initialize",
    "notifications/initialized",
    "tools/list",
    "tools/call",
  ]);
});

test("server refuses operation before initialize and rejects protocol version mismatch", async () => {
  const server = createH2InertEchoMcpServer();
  await assert.rejects(
    server.sendRequest({ jsonrpc: "2.0", id: "early", method: "tools/list" }),
    /MCP boundary refused/,
  );
  await assert.rejects(
    server.sendRequest({
      jsonrpc: "2.0",
      id: "init_bad",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "atliera-orchestrator", version: "0.1.0" },
      },
    }),
    /MCP boundary refused/,
  );
});

test("client refuses a mismatched negotiated protocol version before tools/list or tools/call", async () => {
  const base = createH2InertEchoMcpServer();
  const methods: string[] = [];
  const transport: H2McpInProcessTransport = {
    sendNotification: (notification) => base.sendNotification(notification),
    async sendRequest(request, options) {
      methods.push(request.method);
      const response = await base.sendRequest(request, options);
      if (request.method !== "initialize") return response;
      const root = response as { jsonrpc: "2.0"; id: string; result: Record<string, unknown> };
      return {
        jsonrpc: "2.0",
        id: root.id,
        result: { ...root.result, protocolVersion: "2025-03-26" },
      };
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: clock(["2026-07-10T12:00:02.000Z"], []),
  });
  const result = await kernel.invoke(invokeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.refusalCode, "mcp_protocol_refused");
  assert.equal(result.auditEvents.length, 1);
  assert.deepEqual(methods, ["initialize"]);
});

test("conformant CallToolResult requires content and malformed result is accounted as failed", async () => {
  const base = createH2InertEchoMcpServer();
  const transport: H2McpInProcessTransport = {
    sendNotification: (notification) => base.sendNotification(notification),
    async sendRequest(request, options) {
      const response = await base.sendRequest(request, options);
      if (request.method !== "tools/call") return response;
      const root = response as { jsonrpc: "2.0"; id: string; result: Record<string, unknown> };
      const { content: _removed, ...malformed } = root.result;
      return { jsonrpc: "2.0", id: root.id, result: malformed };
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: clock(
      ["2026-07-10T12:00:02.000Z", "2026-07-10T12:00:02.003Z"],
      [1, 4],
    ),
  });
  const result = await kernel.invoke(invokeInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.output, null);
  assert.equal(result.capabilityExecutions[0].outcome, "failed");
  assert.equal(result.capabilityExecutions.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.accountingIncrements.length, 1);
});

test("repository-pinned schedule is the only authority and a shaped forgery cannot register", async () => {
  assert.equal(sha256Canonical(H2_APPROVED_ECHO_SCHEDULE), H2_APPROVED_ECHO_SCHEDULE_SHA256);
  const kernel = createH2EchoMediationKernelForTest({
    clock: clock(["2026-07-10T12:00:02.000Z"], []),
  });
  assert.equal("approveSchedule" in kernel, false);
  const forged = {
    ...invokeInput(),
    schedule: {
      ...H2_APPROVED_ECHO_SCHEDULE,
      scheduleId: "sched_forged_but_well_shaped",
    },
  };
  const result = await kernel.invoke(forged);
  assert.equal(result.ok, false);
  assert.equal(result.invoked, false);
});

test("descriptor drift emits one sanitized refusal audit and performs no tools/call", async () => {
  const base = createH2InertEchoMcpServer();
  const methods: string[] = [];
  const transport: H2McpInProcessTransport = {
    sendNotification: (notification) => base.sendNotification(notification),
    async sendRequest(request, options) {
      methods.push(request.method);
      const response = await base.sendRequest(request, options);
      if (request.method !== "tools/list") return response;
      const root = response as { jsonrpc: "2.0"; id: string; result: { tools: Array<Record<string, unknown>> } };
      return {
        jsonrpc: "2.0",
        id: root.id,
        result: {
          tools: [{ ...root.result.tools[0], description: "drifted descriptor" }],
        },
      };
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: clock(["2026-07-10T12:00:02.000Z"], []),
  });
  const result = await kernel.invoke(invokeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.refusalCode, "descriptor_hash_drift");
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.auditEvents[0].payload_json.refusal_reason, "descriptor_hash_drift");
  assert.equal(result.auditEvents[0].payload_json.network_effects, 0);
  assert.ok(!methods.includes("tools/call"));
});

test("exact validity-window end is expired before MCP access", async () => {
  const observed = recordingTransport();
  const kernel = createH2EchoMediationKernelForTest({
    transport: observed.transport,
    clock: clock([H2_APPROVED_ECHO_SCHEDULE.validUntil], []),
  });
  const result = await kernel.invoke(invokeInput());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusalCode, "schedule_expired");
  assert.deepEqual(observed.methods, []);
});

test("hanging tools/call times out with one failed record set and zero retries", async () => {
  const base = createH2InertEchoMcpServer();
  let toolCalls = 0;
  let cancellations = 0;
  const transport: H2McpInProcessTransport = {
    sendNotification(notification) {
      if (notification.method === "notifications/cancelled") cancellations += 1;
      return base.sendNotification(notification);
    },
    sendRequest(request, options) {
      if (request.method !== "tools/call") return base.sendRequest(request, options);
      toolCalls += 1;
      return new Promise<H2McpResponse>(() => undefined);
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: clock(
      ["2026-07-10T12:00:02.000Z", "2026-07-10T12:00:03.000Z"],
      [10, 1010],
    ),
  });
  const result = await kernel.invoke(invokeInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(toolCalls, 1);
  assert.equal(cancellations, 1);
  assert.equal(result.output, null);
  assert.equal(result.capabilityExecutions[0].outcome, "failed");
  assert.equal(result.capabilityExecutions[0].retryCount, 0);
  assert.equal(result.capabilityExecutions.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.accountingIncrements.length, 1);
});

test("post-call clock throw and regression both fail closed with one record set", async () => {
  for (const badClock of [
    clock(
      ["2026-07-10T12:00:02.000Z", new Error("post-call clock failure")],
      [10],
    ),
    clock(
      ["2026-07-10T12:00:02.000Z", "2026-07-10T12:00:02.001Z"],
      [10, 9],
    ),
  ]) {
    const kernel = createH2EchoMediationKernelForTest({ clock: badClock });
    const result = await kernel.invoke(invokeInput());
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.output, null);
    assert.equal(result.capabilityExecutions[0].outcome, "failed");
    assert.equal(result.capabilityExecutions.length, 1);
    assert.equal(result.auditEvents.length, 1);
    assert.equal(result.accountingIncrements.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /post-call clock failure/);
  }
});

test("general package barrel contains no capability registry or execution exports", () => {
  const rootIndex = readFileSync(join(ROOT, "src", "index.ts"), "utf8");
  assert.doesNotMatch(rootIndex, /capability\//);
  assert.doesNotMatch(rootIndex, /H2EchoMediation|H2_CAPABILITY_REGISTRY/);
});
