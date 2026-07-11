import assert from "node:assert/strict";
import test from "node:test";

import { H2_APPROVED_ECHO_SCHEDULE } from "../../src/capability/h2-approved-schedule.ts";
import { H2_MCP_SPEC_VERSION } from "../../src/capability/h2-registry.ts";
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

function invocation(value = "second review echo"): Record<string, unknown> {
  return {
    trigger: {
      kind: "approved_schedule",
      scheduleId: H2_APPROVED_ECHO_SCHEDULE.scheduleId,
    },
    input: { value },
  };
}

function sequenceClock(timestamps: string[], monotonic: number[] = []): H2Clock {
  return {
    nowIso(): string {
      const value = timestamps.shift();
      if (value === undefined) throw new Error("test timestamp clock exhausted");
      return value;
    },
    monotonicMs(): number {
      const value = monotonic.shift();
      if (value === undefined) throw new Error("test monotonic clock exhausted");
      return value;
    },
  };
}

function constantClock(): H2Clock {
  let monotonic = 0;
  return {
    nowIso: () => "2026-07-10T12:00:02.000Z",
    monotonicMs: () => monotonic++,
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("simultaneous invocations reserve one-shot authority before asynchronous preflight", async () => {
  const base = createH2InertEchoMcpServer();
  const listEntered = deferred();
  const releaseList = deferred();
  let toolCalls = 0;
  const transport: H2McpInProcessTransport = {
    sendNotification: (notification) => base.sendNotification(notification),
    async sendRequest(request, options) {
      const response = await base.sendRequest(request, options);
      if (request.method === "tools/list") {
        listEntered.resolve();
        await releaseList.promise;
      }
      if (request.method === "tools/call") toolCalls += 1;
      return response;
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: constantClock(),
  });

  const firstPromise = kernel.invoke(invocation("first"));
  await listEntered.promise;
  const secondPromise = kernel.invoke(invocation("second"));
  releaseList.resolve();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.equal(toolCalls, 1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.refusalCode, "schedule_in_progress");
  const recordSets = [first, second].filter((result) => result.ok);
  assert.equal(recordSets.length, 1);
  if (first.ok) {
    assert.equal(first.capabilityExecutions.length, 1);
    assert.equal(first.auditEvents.length, 1);
    assert.equal(first.accountingIncrements.length, 1);
  }
});

test("pre-effect descriptor refusal releases the process-local reservation", async () => {
  const base = createH2InertEchoMcpServer();
  let firstList = true;
  let toolCalls = 0;
  const transport: H2McpInProcessTransport = {
    sendNotification: (notification) => base.sendNotification(notification),
    async sendRequest(request, options) {
      const response = await base.sendRequest(request, options);
      if (request.method === "tools/call") toolCalls += 1;
      if (request.method !== "tools/list" || !firstList) return response;
      firstList = false;
      const root = response as {
        jsonrpc: "2.0";
        id: string | number;
        result: { tools: Array<Record<string, unknown>> };
      };
      return {
        jsonrpc: "2.0",
        id: root.id,
        result: {
          tools: [{ ...root.result.tools[0], description: "first-preflight-drift" }],
        },
      };
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: sequenceClock(
      [
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.000Z",
        "2026-07-10T12:00:02.001Z",
      ],
      [1, 2],
    ),
  });
  const refused = await kernel.invoke(invocation("first-refused"));
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.refusalCode, "descriptor_hash_drift");

  const accepted = await kernel.invoke(invocation("second-accepted"));
  assert.equal(accepted.ok, true);
  assert.equal(toolCalls, 1);
});

test("schedule expiry crossing during descriptor preflight refuses before tools/call", async () => {
  const base = createH2InertEchoMcpServer();
  let toolCalls = 0;
  const transport: H2McpInProcessTransport = {
    sendNotification: (notification) => base.sendNotification(notification),
    async sendRequest(request, options) {
      const response = await base.sendRequest(request, options);
      if (request.method === "tools/call") toolCalls += 1;
      return response;
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: sequenceClock(
      [
        "2026-07-10T12:04:59.999Z",
        H2_APPROVED_ECHO_SCHEDULE.validUntil,
        "2026-07-10T12:05:00.001Z",
      ],
      [1, 2],
    ),
  });
  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusalCode, "schedule_expired");
  assert.equal(toolCalls, 0);
});

test("final validity recheck has no asynchronous yield before tools/call issuance", async () => {
  const base = createH2InertEchoMcpServer();
  let wallClock = "2026-07-10T12:00:02.000Z";
  let monotonic = 0;
  let callObservedExpiredClock = false;
  const transport: H2McpInProcessTransport = {
    sendNotification: (notification) => base.sendNotification(notification),
    sendRequest(request, options) {
      if (request.method === "tools/call") {
        callObservedExpiredClock = wallClock >= H2_APPROVED_ECHO_SCHEDULE.validUntil;
      }
      return base.sendRequest(request, options);
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: {
      nowIso: () => wallClock,
      monotonicMs() {
        monotonic += 1;
        if (monotonic === 1) {
          queueMicrotask(() => {
            wallClock = H2_APPROVED_ECHO_SCHEDULE.validUntil;
          });
        }
        return monotonic;
      },
    },
  });

  const result = await kernel.invoke(invocation("effect-boundary"));
  assert.equal(result.ok, true);
  assert.equal(callObservedExpiredClock, false);
});

test("timed-out initialize stops waiting without forbidden cancellation notification", async () => {
  let cancellations = 0;
  let requests = 0;
  const transport: H2McpInProcessTransport = {
    async sendNotification(notification) {
      if (notification.method === "notifications/cancelled") cancellations += 1;
    },
    async sendRequest(request) {
      requests += 1;
      assert.equal(request.method, "initialize");
      return new Promise<H2McpResponse>(() => undefined);
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: sequenceClock(["2026-07-10T12:00:02.000Z"]),
  });
  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusalCode, "mcp_protocol_refused");
  assert.equal(requests, 1);
  assert.equal(cancellations, 0);
});

test("server negotiates by returning its supported version for an unsupported request", async () => {
  const server = createH2InertEchoMcpServer();
  const response = await server.sendRequest({
    jsonrpc: "2.0",
    id: "unsupported_version",
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "atliera-orchestrator", version: "0.1.0" },
    },
  });
  const result = response.result as { protocolVersion?: unknown };
  assert.equal(result.protocolVersion, H2_MCP_SPEC_VERSION);
});

test("never-settling initialized notification is bounded without cancellation", async () => {
  const base = createH2InertEchoMcpServer();
  let cancellations = 0;
  let listOrCallRequests = 0;
  const transport: H2McpInProcessTransport = {
    sendNotification(notification) {
      if (notification.method === "notifications/cancelled") cancellations += 1;
      if (notification.method === "notifications/initialized") {
        return new Promise<void>(() => undefined);
      }
      return base.sendNotification(notification);
    },
    sendRequest(request, options) {
      if (request.method === "tools/list" || request.method === "tools/call") {
        listOrCallRequests += 1;
      }
      return base.sendRequest(request, options);
    },
  };
  const kernel = createH2EchoMediationKernelForTest({
    transport,
    clock: sequenceClock(["2026-07-10T12:00:02.000Z"]),
  });
  let outerTimer: ReturnType<typeof setTimeout> | undefined;
  const outerTimeout = new Promise<"outer_timeout">((resolve) => {
    outerTimer = setTimeout(() => resolve("outer_timeout"), 1500);
  });
  const result = await Promise.race([kernel.invoke(invocation()), outerTimeout]);
  if (outerTimer !== undefined) clearTimeout(outerTimer);

  assert.notEqual(result, "outer_timeout");
  if (result === "outer_timeout") return;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.refusalCode, "mcp_protocol_refused");
  assert.equal(cancellations, 0);
  assert.equal(listOrCallRequests, 0);
});

type DescriptorMutator = (descriptor: Record<string, unknown>, probe: { count: number }) => unknown;

function hostileDescriptorTransport(
  mutate: DescriptorMutator,
  probe: { count: number },
): { transport: H2McpInProcessTransport; toolCalls: () => number } {
  const base = createH2InertEchoMcpServer();
  let toolCalls = 0;
  return {
    toolCalls: () => toolCalls,
    transport: {
      sendNotification: (notification: H2McpNotification) => base.sendNotification(notification),
      async sendRequest(
        request: H2McpRequest,
        options?: H2McpRequestOptions,
      ): Promise<H2McpResponse> {
        const response = await base.sendRequest(request, options);
        if (request.method === "tools/call") toolCalls += 1;
        if (request.method !== "tools/list") return response;
        const root = response as {
          jsonrpc: "2.0";
          id: string | number;
          result: { tools: Array<Record<string, unknown>> };
        };
        const descriptor = root.result.tools[0];
        assert.ok(descriptor);
        return {
          jsonrpc: "2.0",
          id: root.id,
          result: { tools: [mutate(descriptor, probe)] },
        };
      },
    },
  };
}

function replaceValueSchema(
  descriptor: Record<string, unknown>,
  valueSchema: object,
): Record<string, unknown> {
  const inputSchema = descriptor.inputSchema as Record<string, unknown>;
  const properties = inputSchema.properties as Record<string, unknown>;
  return {
    ...descriptor,
    inputSchema: {
      ...inputSchema,
      properties: { ...properties, value: valueSchema },
    },
  };
}

test("live descriptor is deeply snapshotted before hashing hostile nested data", async (t) => {
  const cases: Array<{ name: string; mutate: DescriptorMutator }> = [
    {
      name: "nested array Proxy",
      mutate(descriptor, probe) {
        const inputSchema = descriptor.inputSchema as Record<string, unknown>;
        const required = new Proxy(["value"], {
          get(target, property, receiver) {
            probe.count += 1;
            return Reflect.get(target, property, receiver);
          },
        });
        return { ...descriptor, inputSchema: { ...inputSchema, required } };
      },
    },
    {
      name: "nested sparse array",
      mutate(descriptor) {
        const inputSchema = descriptor.inputSchema as Record<string, unknown>;
        return {
          ...descriptor,
          inputSchema: { ...inputSchema, required: new Array<string>(1) },
        };
      },
    },
    {
      name: "nested extra-key array",
      mutate(descriptor) {
        const inputSchema = descriptor.inputSchema as Record<string, unknown>;
        const required = ["value"] as string[] & { extra?: boolean };
        required.extra = true;
        return { ...descriptor, inputSchema: { ...inputSchema, required } };
      },
    },
    {
      name: "nested accessor",
      mutate(descriptor, probe) {
        const original = ((descriptor.inputSchema as Record<string, unknown>).properties as Record<string, unknown>)
          .value as Record<string, unknown>;
        const valueSchema: Record<string, unknown> = { type: original.type };
        Object.defineProperty(valueSchema, "maxLength", {
          enumerable: true,
          get() {
            probe.count += 1;
            return 256;
          },
        });
        return replaceValueSchema(descriptor, valueSchema);
      },
    },
    {
      name: "nested symbol",
      mutate(descriptor) {
        const original = ((descriptor.inputSchema as Record<string, unknown>).properties as Record<string, unknown>)
          .value as Record<string, unknown>;
        const valueSchema = { ...original };
        Object.defineProperty(valueSchema, Symbol("hostile"), {
          enumerable: true,
          value: true,
        });
        return replaceValueSchema(descriptor, valueSchema);
      },
    },
    {
      name: "nested custom prototype",
      mutate(descriptor) {
        const original = ((descriptor.inputSchema as Record<string, unknown>).properties as Record<string, unknown>)
          .value as Record<string, unknown>;
        const valueSchema = { ...original };
        Object.setPrototypeOf(valueSchema, { hostile: true });
        return replaceValueSchema(descriptor, valueSchema);
      },
    },
  ];

  for (const hostile of cases) {
    await t.test(hostile.name, async () => {
      const probe = { count: 0 };
      const observed = hostileDescriptorTransport(hostile.mutate, probe);
      const kernel = createH2EchoMediationKernelForTest({
        transport: observed.transport,
        clock: sequenceClock(["2026-07-10T12:00:02.000Z"]),
      });
      const result = await kernel.invoke(invocation());
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.refusalCode, "mcp_protocol_refused");
      assert.equal(observed.toolCalls(), 0);
      assert.equal(probe.count, 0);
    });
  }
});
