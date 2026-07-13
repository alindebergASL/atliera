import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { acquireM4SecLive, type M4LiveDependencies, type M4NodeRequestOptions, type M4RequestLike,
  type M4ResponseLike } from "../../src/capability/m4-sec-live-adapter.ts";
import { consumeM4GateBGo, M4_GATE_B_EXPECTED_ATTEMPT_OUTPUT, M4_GATE_B_EXPECTED_CUSTODY_OUTPUT, M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT,
  M4_GATE_B_FAILURE_BEHAVIOR, M4_GATE_B_ROLLBACK_BEHAVIOR, M4_GATE_B_TAKEDOWN_POSTURE } from "../../src/capability/m4-sec-gate-b-activation.ts";
import { reserveM4GateBArtifactOutputs } from "../../src/capability/m4-sec-gate-b-artifacts.ts";
import { createM4SecGateBKernel } from "../../src/capability/m4-sec-gate-b-mediation.ts";
import { extractM4SecEvidence } from "../../src/capability/m4-sec-extraction.ts";
import { M4_RECORDED_SEC_SUBMISSIONS_BODY } from "../../src/capability/m4-public-http-fetch-proof.ts";
import { getM4PublicHttpFetchKernel } from "../../src/capability/m4-public-http-fetch-mediation.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_REF, M4_TARGET_POLICY_SHA256 } from "../../src/capability/m4-target-policy.ts";
import { acquireM4ProofRecordedEvidence, M4_TARGET_URL, validateM4SecUserAgent } from "../../src/capability/public-http-fetch-policy.ts";

const VALID_UA = `AtlieraTest monitored-public-contact${String.fromCharCode(64)}example.invalid`;

class FakeResponse extends EventEmitter implements M4ResponseLike {
  destroyed = 0; socketDestroyed = 0;
  constructor(readonly statusCode = 200, readonly headers: Record<string, string | readonly string[] | undefined> = { "content-type": "application/json" },
    remoteAddress = "8.8.8.8") { super(); this.socket = { remoteAddress, destroy: () => { this.socketDestroyed++; } }; }
  readonly socket: { readonly remoteAddress?: string; destroy(): void };
  override on(event: "data" | "end" | "error", listener: (...args: any[]) => void): this { return super.on(event, listener); }
  destroy(): void { this.destroyed++; }
}
class FakeRequest extends EventEmitter implements M4RequestLike {
  destroyed = 0; ended = 0;
  override on(event: "error", listener: (error: Error) => void): this { return super.on(event, listener); }
  end(): void { this.ended++; }
  destroy(): void { this.destroyed++; }
}

function harness(config: { addresses?: readonly string[]; response?: FakeResponse; dnsPending?: boolean;
  requestError?: boolean; lookupHostname?: string; lookupOptions?: object } = {}) {
  let deadline = () => {}; let deadlineCalls = 0; let deadlineMilliseconds = 0;
  let resolveDns: ((addresses: readonly string[]) => void) | undefined;
  const request = new FakeRequest(); const response = config.response ?? new FakeResponse();
  let resolverCancelled = 0; let requestCalls = 0; let options: M4NodeRequestOptions | undefined;
  const dependencies: M4LiveDependencies = {
    createResolver: () => ({
      resolve4: () => config.dnsPending ? new Promise((resolve) => { resolveDns = resolve; }) : Promise.resolve(config.addresses ?? ["8.8.8.8"]),
      cancel: () => { resolverCancelled++; },
    }),
    request: (value, callback) => {
      requestCalls++; options = value;
      const lookup = value.lookup as (hostname: string, options: object, callback: (error: Error | null, address: string, family: number) => void) => void;
      lookup(config.lookupHostname ?? "data.sec.gov", config.lookupOptions ?? { family: 4, hints: 0 },
        (error, address, family) => {
        assert.equal(error, null); assert.equal(address, "8.8.8.8"); assert.equal(family, 4);
      });
      queueMicrotask(() => config.requestError ? request.emit("error", new Error("tls")) : callback(response));
      return request;
    },
    setDeadline: (callback, milliseconds) => { deadlineCalls++; deadlineMilliseconds = milliseconds; deadline = callback; return 1; }, clearDeadline: () => {},
  };
  return { dependencies, request, response, deadline: () => deadline(), resolveDns: (value: readonly string[]) => resolveDns?.(value),
    state: () => ({ resolverCancelled, requestCalls, options, deadlineCalls, deadlineMilliseconds }) };
}

function consumedActivation(now = new Date("2026-07-12T00:00:02.000Z")) {
  const directory = mkdtempSync(join(tmpdir(), "atliera-m4-go-")); const path = join(directory, "go.json");
  const oneShotConsumptionPath = join(directory, ".atliera-m4-sec-consumed-consume_test_001.json");
  const go = { kind: "m4-sec-gate-b-one-shot-go", schemaVersion: "1", authorizationId: "auth_test_001",
    oneShotConsumptionId: "consume_test_001", oneShotConsumptionPath, reviewedAdapterCommit: "a".repeat(40), targetRef: M4_CANONICAL_TARGET_POLICY.targetRef,
    targetUrl: M4_CANONICAL_TARGET_POLICY.url, targetPolicySha256: M4_TARGET_POLICY_SHA256, cik: "0001048911",
    authorizedAt: "2026-07-12T00:00:00.000Z", validFrom: "2026-07-12T00:00:01.000Z", validUntil: "2026-07-12T00:05:00.000Z",
    userAgentConfigInput: "ATLIERA_M4_SEC_USER_AGENT",
    userAgentSha256: createHash("sha256").update(VALID_UA, "ascii").digest("hex"),
    userAgentByteLength: Buffer.byteLength(VALID_UA, "ascii"),
    networkBudget: { scheme: "https", effectivePort: 443, method: "GET", addressFamily: 4, maxTargets: 1,
      maxRequests: 1, onePinnedAddress: true, oneConnectionAttempt: true, redirectLimit: 0, retryBudget: 0,
      totalDeadlineMs: 10_000, maxBodyBytes: 1_048_576, acceptedContentTypes: ["application/json"] },
    retentionDays: 30, takedownPosture: M4_GATE_B_TAKEDOWN_POSTURE,
    expectedAttemptOutput: M4_GATE_B_EXPECTED_ATTEMPT_OUTPUT,
    expectedCustodyOutput: M4_GATE_B_EXPECTED_CUSTODY_OUTPUT,
    expectedWorkshopOutput: M4_GATE_B_EXPECTED_WORKSHOP_OUTPUT,
    failureBehavior: M4_GATE_B_FAILURE_BEHAVIOR, rollbackBehavior: M4_GATE_B_ROLLBACK_BEHAVIOR,
    authorizesLiveAcquisition: true };
  writeFileSync(path, JSON.stringify(go));
  return { path, activation: consumeM4GateBGo(path, "a".repeat(40), VALID_UA, now) };
}

function gateBInvocation(activation: ReturnType<typeof consumeM4GateBGo>) {
  return { trigger: { kind: "external_gate_b_one_shot_go", authorizationId: activation.authorizationId,
    oneShotConsumptionId: activation.oneShotConsumptionId }, input: { targetRef: "sec_fedex_submissions",
    targetPolicySha256: M4_TARGET_POLICY_SHA256 } };
}

test("SEC User-Agent fails closed before dependency access and preserves exact accepted bytes", async () => {
  for (const invalid of [undefined, "", "Atliera", "Atliera x", "Atliera a@example",
    `Atliera a${String.fromCharCode(64)}example.invalid\r\nX: y`, ` Atliera a${String.fromCharCode(64)}example.invalid`]) {
    let accessed = 0;
    const deps = Object.defineProperty({}, "createResolver", { get() { accessed++; throw new Error("accessed"); } }) as M4LiveDependencies;
    const result = await acquireM4SecLive(invalid, deps);
    assert.equal(result.ok, false); assert.equal(accessed, 0);
  }
  assert.equal(validateM4SecUserAgent(VALID_UA)?.contactRedacted, true);
  const h = harness(); const pending = acquireM4SecLive(VALID_UA, h.dependencies);
  await new Promise((resolve) => setImmediate(resolve));
  h.response.emit("data", Buffer.from("{}")); h.response.emit("end");
  const result = await pending; assert.equal(result.ok, true);
  assert.equal((h.state().options?.headers as Record<string, string>)["User-Agent"], VALID_UA);
  assert.equal(JSON.stringify(result.telemetry).includes(VALID_UA), false);
});

test("adapter pins deterministic one IPv4 address, one lookup/request, exact request identity and tears down", async () => {
  const h = harness({ addresses: ["9.9.9.9", "8.8.8.8", "9.9.9.9"] });
  const pending = acquireM4SecLive(VALID_UA, h.dependencies); await new Promise((resolve) => setImmediate(resolve));
  h.response.emit("data", Buffer.from("{}")); h.response.emit("end"); const result = await pending;
  assert.equal(result.ok, true); assert.equal(result.telemetry.selectedAddress, "8.8.8.8");
  assert.deepEqual({ hostname: h.state().options?.hostname, port: h.state().options?.port, path: h.state().options?.path,
    method: h.state().options?.method, family: h.state().options?.family,
    autoSelectFamily: h.state().options?.autoSelectFamily, agent: h.state().options?.agent },
  { hostname: "data.sec.gov", port: 443, path: "/submissions/CIK0001048911.json", method: "GET", family: 4,
    autoSelectFamily: false, agent: false });
  assert.equal(h.state().requestCalls, 1); assert.equal(result.telemetry.lookupCallbacks, 1); assert.equal(result.telemetry.retryCount, 0);
  assert.equal(h.state().deadlineCalls, 1); assert.equal(h.state().deadlineMilliseconds, 10_000);
  assert.ok(h.request.destroyed > 0 && h.response.destroyed > 0 && h.response.socketDestroyed > 0);
});

test("adapter fails closed on every non-exact Node 22 lookup invocation contract", async () => {
  const symbolOptions = { family: 4, hints: 0 } as Record<PropertyKey, unknown>;
  symbolOptions[Symbol("unexpected")] = true;
  const accessorOptions = Object.defineProperty({ family: 4 }, "hints", {
    enumerable: true, get() { throw new Error("lookup options getter must not run"); },
  });
  const proxyOptions = new Proxy({ family: 4, hints: 0 }, {
    ownKeys() { throw new Error("lookup options proxy trap must not run"); },
  });
  const nonEnumerableExtra = Object.defineProperty({ family: 4, hints: 0 }, "all", {
    enumerable: false, value: false,
  });
  const variants = [
    { lookupHostname: "other.example.invalid", lookupOptions: { family: 4, hints: 0 } },
    { lookupOptions: { family: 4 } },
    { lookupOptions: { family: 4, hints: 1 } },
    { lookupOptions: { family: 4, hints: 0, all: false } },
    { lookupOptions: { family: 4, hints: 0, extra: true } },
    { lookupOptions: symbolOptions },
    { lookupOptions: accessorOptions },
    { lookupOptions: proxyOptions },
    { lookupOptions: nonEnumerableExtra },
  ];
  for (const config of variants) {
    const h = harness(config); const result = await acquireM4SecLive(VALID_UA, h.dependencies);
    assert.equal(result.ok, false); assert.equal(result.refusalCode, "transport_refused");
    assert.equal(result.telemetry.failurePhase, "lookup_contract");
    assert.deepEqual({ dns: result.telemetry.dnsAttempts, request: result.telemetry.requestAttempts,
      lookup: result.telemetry.lookupCallbacks, connection: result.telemetry.connectionAttempts,
      egress: result.telemetry.liveNetworkEgress, retries: result.telemetry.retryCount },
    { dns: 1, request: 1, lookup: 1, connection: 0, egress: 0, retries: 0 });
    assert.equal(h.request.ended, 0);
  }
});

test("adapter refuses DNS, timeout, connected address, TLS, redirect, status, MIME and overflow with no retry", async () => {
  for (const addresses of [["127.0.0.1"], ["not-an-ip"], ["8.8.8.8", "10.0.0.1"]]) {
    const h = harness({ addresses }); const result = await acquireM4SecLive(VALID_UA, h.dependencies);
    assert.equal(result.ok, false); assert.equal(result.telemetry.requestAttempts, 0); assert.ok(h.state().resolverCancelled > 0);
  }
  const dns = harness({ dnsPending: true }); const dnsPending = acquireM4SecLive(VALID_UA, dns.dependencies); dns.deadline();
  const dnsResult = await dnsPending; assert.equal(dnsResult.ok, false); assert.equal(dnsResult.refusalCode, "timeout_or_cancelled");
  for (const [response, expected] of [
    [new FakeResponse(200, { "content-type": "application/json" }, "9.9.9.9"), "connected_address_mismatch"],
    [new FakeResponse(302, { location: "/other", "content-type": "application/json" }), "redirect_refused"],
    [new FakeResponse(503), "http_status_refused"],
    [new FakeResponse(200, { "content-type": "application/json; charset=utf-8; charset=utf-8" }), "mime_refused"],
    [new FakeResponse(200, { "content-type": "text/plain" }), "mime_refused"],
    [new FakeResponse(200, { "content-type": ["application/json"] }), "mime_refused"],
    [new FakeResponse(200, { "content-type": "application/json", "content-encoding": "gzip" }), "transport_refused"],
    [new FakeResponse(200, { "content-type": "application/json", "content-encoding": ["identity"] }), "transport_refused"],
  ] as const) {
    const h = harness({ response }); const result = await acquireM4SecLive(VALID_UA, h.dependencies);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.refusalCode, expected); assert.equal(result.telemetry.retryCount, 0);
  }
  const tls = harness({ requestError: true }); const tlsResult = await acquireM4SecLive(VALID_UA, tls.dependencies);
  assert.equal(tlsResult.ok, false); assert.equal(tlsResult.telemetry.requestAttempts, 1);
  const overflow = harness(); const overflowPending = acquireM4SecLive(VALID_UA, overflow.dependencies);
  await new Promise((resolve) => setImmediate(resolve)); overflow.response.emit("data", Buffer.alloc(1_048_577));
  const overflowResult = await overflowPending; assert.equal(overflowResult.ok, false);
  if (!overflowResult.ok) assert.equal(overflowResult.refusalCode, "body_limit_refused");
  assert.equal(overflowResult.telemetry.bytesReceived, 1_048_577);
});

test("body exact limit succeeds and body deadline settles once", async () => {
  const exact = harness(); const exactPending = acquireM4SecLive(VALID_UA, exact.dependencies); await new Promise((resolve) => setImmediate(resolve));
  exact.response.emit("data", Buffer.alloc(1_048_576)); exact.response.emit("end"); assert.equal((await exactPending).ok, true);
  const timed = harness(); const timedPending = acquireM4SecLive(VALID_UA, timed.dependencies); await new Promise((resolve) => setImmediate(resolve));
  timed.response.emit("data", Buffer.from("partial")); timed.deadline(); timed.response.emit("end");
  const result = await timedPending; assert.equal(result.ok, false); if (!result.ok) assert.equal(result.refusalCode, "timeout_or_cancelled");
});

test("strict extraction rejects identity, malformed JSON, invalid UTF-8 and security-key smuggling", () => {
  const recorded = (body: Buffer) => acquireM4ProofRecordedEvidence("sec_fedex_submissions", {
    fetchedAt: "2026-07-12T00:00:00.000Z", resolvedAddresses: ["8.8.8.8"], status: 200, contentType: "application/json",
    location: null, connectedAddress: "8.8.8.8", finalUrl: M4_TARGET_URL, bodyBase64: body.toString("base64"), cancelAt: "none",
  });
  const good = recorded(Buffer.from(M4_RECORDED_SEC_SUBMISSIONS_BODY)); assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(extractM4SecEvidence(good.evidence).value, "AIR COURIER SERVICES");
    for (const forged of [
      { ...good.evidence, responseSha256: "0".repeat(64) },
      { ...good.evidence, byteCount: good.evidence.byteCount + 1 },
      { ...good.evidence, bodyBase64: `${good.evidence.bodyBase64}\n` },
      { ...good.evidence, quotedBodyText: `${good.evidence.quotedBodyText} ` },
    ]) assert.throws(() => extractM4SecEvidence(forged as typeof good.evidence), /refused/);
  }
  const wire = recorded(Buffer.from(M4_RECORDED_SEC_SUBMISSIONS_BODY
    .replace('"cik":"0001048911"', '"cik":1048911')
    .replace("AIR COURIER SERVICES", "Air Courier Services")));
  assert.equal(wire.ok, true); if (wire.ok) assert.equal(extractM4SecEvidence(wire.evidence).value, "Air Courier Services");
  for (const body of [Buffer.from("{"), Buffer.from(M4_RECORDED_SEC_SUBMISSIONS_BODY.replace("FEDEX CORP", "OTHER")),
    Buffer.from('{"cik":"0001048911","name":"FEDEX CORP","sic":"4513","sicDescription":"AIR COURIER SERVICES","tickers":["FDX"],"exchanges":["NYSE"],"__proto__":{"x":1}}'),
    Buffer.from([0xc3, 0x28])]) {
    const value = recorded(body); assert.equal(value.ok, true); if (value.ok) assert.throws(() => extractM4SecEvidence(value.evidence), /refused/);
  }
});

test("private Gate B GO is exact, time-bound, commit/policy-bound and consumed before replay", () => {
  assert.throws(() => consumedActivation(new Date("2026-07-12T00:05:00.000Z")), /GO refused/);
  const { path, activation } = consumedActivation();
  const consumptionText = readFileSync(activation.consumptionPath, "utf8");
  const consumption = JSON.parse(consumptionText);
  assert.equal(consumption.oneShotConsumptionId, "consume_test_001");
  assert.equal(consumption.userAgentSha256, createHash("sha256").update(VALID_UA, "utf8").digest("hex"));
  assert.equal(consumption.userAgentByteLength, Buffer.byteLength(VALID_UA, "utf8"));
  assert.equal(consumptionText.includes(VALID_UA), false);
  assert.throws(() => consumeM4GateBGo(path, "b".repeat(40), VALID_UA, new Date("2026-07-12T00:00:03.000Z")), /GO refused/);
  assert.throws(() => consumeM4GateBGo(path, "a".repeat(40), `${VALID_UA}x`, new Date("2026-07-12T00:00:03.000Z")), /User-Agent refused/);
  assert.throws(() => consumeM4GateBGo(path, "a".repeat(40), VALID_UA, new Date("2026-07-12T00:00:03.000Z")), /replay/);
  const copiedPath = join(mkdtempSync(join(tmpdir(), "atliera-m4-go-copy-")), "copied-go.json");
  writeFileSync(copiedPath, readFileSync(path));
  assert.throws(() => consumeM4GateBGo(copiedPath, "a".repeat(40), VALID_UA, new Date("2026-07-12T00:00:03.000Z")), /replay/);
  assert.equal(M4_TARGET_POLICY_REF.includes("m4-target-policy"), true);
});

test("Gate B private activation permits exactly one mediation attempt, including refused first use", async () => {
  const { activation } = consumedActivation(); const h = harness();
  const kernel = createM4SecGateBKernel({ activation, userAgent: VALID_UA,
    clock: { nowIso: () => "2026-07-12T00:00:03.000Z", monotonicMs: () => 1000 }, dependencies: h.dependencies });
  const refused = await kernel.invoke({ trigger: {}, input: {} });
  assert.equal(refused.ok, false); if (!refused.ok) assert.equal(refused.refusalCode, "invalid_invocation_request");
  const replay = await kernel.invoke(gateBInvocation(activation));
  assert.equal(replay.ok, false); if (!replay.ok) assert.equal(replay.refusalCode, "schedule_consumed");
  assert.equal(h.state().requestCalls, 0);
});

test("lookup-contract refusal preserves pre-connection telemetry through MCP, audit, and accounting", async () => {
  const { activation } = consumedActivation();
  const h = harness({ lookupOptions: { family: 4, hints: 0, all: true } });
  const monotonic = [1000, 1001];
  const kernel = createM4SecGateBKernel({ activation, userAgent: VALID_UA,
    clock: { nowIso: () => "2026-07-12T00:00:03.000Z", monotonicMs: () => monotonic.shift()! },
    dependencies: h.dependencies });
  const result = await kernel.invoke(gateBInvocation(activation));
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.output, null);
  const telemetry = result.capabilityExecutions[0].effectTelemetry;
  assert.equal(result.capabilityExecutions[0].refusalCode, "transport_refused");
  assert.equal(telemetry.failurePhase, "lookup_contract");
  assert.deepEqual({ dns: telemetry.dnsAttempts, request: telemetry.requestAttempts,
    lookup: telemetry.lookupCallbacks, connection: telemetry.connectionAttempts,
    egress: telemetry.liveNetworkEgress, retries: telemetry.retryCount },
  { dns: 1, request: 1, lookup: 1, connection: 0, egress: 0, retries: 0 });
  assert.equal(result.auditEvents[0].payload_json.failure_phase, "lookup_contract");
  assert.equal(result.auditEvents[0].payload_json.lookup_callbacks, 1);
  assert.equal(result.auditEvents[0].payload_json.connection_attempts, 0);
  assert.equal(result.accountingIncrements[0].failurePhase, "lookup_contract");
  assert.equal(result.accountingIncrements[0].lookupCallbacksPerformed, 1);
  assert.equal(result.accountingIncrements[0].connectionAttemptsPerformed, 0);
});

test("one consumed activation can construct only one kernel across independent factory calls", async () => {
  const { activation } = consumedActivation(); const firstHarness = harness(); const secondHarness = harness();
  const clock = { nowIso: () => "2026-07-12T00:00:03.000Z", monotonicMs: () => 1000 };
  const first = createM4SecGateBKernel({ activation, userAgent: VALID_UA, clock, dependencies: firstHarness.dependencies });
  assert.throws(() => createM4SecGateBKernel({ activation, userAgent: VALID_UA, clock,
    dependencies: secondHarness.dependencies }));
  const pending = first.invoke(gateBInvocation(activation)); await new Promise((resolve) => setImmediate(resolve));
  firstHarness.response.emit("data", Buffer.from(M4_RECORDED_SEC_SUBMISSIONS_BODY)); firstHarness.response.emit("end");
  const result = await pending; assert.equal(result.ok, true);
  assert.equal(firstHarness.state().requestCalls, 1); assert.equal(secondHarness.state().requestCalls, 0);
});

test("Gate B success traverses MCP mediation once and durably persists truthful redacted live records", async () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "atliera-m4-success-artifacts-"));
  const reservation = reserveM4GateBArtifactOutputs(outputDirectory);
  const { activation } = consumedActivation(); const h = harness();
  const kernel = createM4SecGateBKernel({ activation, userAgent: VALID_UA,
    clock: { nowIso: () => "2026-07-12T00:00:03.000Z", monotonicMs: (() => { const values = [1000, 1009]; return () => values.shift()!; })() },
    dependencies: h.dependencies });
  const pending = kernel.invoke(gateBInvocation(activation)); await new Promise((resolve) => setImmediate(resolve));
  h.response.emit("data", Buffer.from(M4_RECORDED_SEC_SUBMISSIONS_BODY)); h.response.emit("end");
  const result = await pending; assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.output?.provenance.transport, "live_sec_one_shot");
  assert.equal(result.capabilityExecutions[0].authorityKind, "external_gate_b_one_shot_go");
  assert.deepEqual(result.auditEvents[0].payload_json.user_agent_audit,
    result.capabilityExecutions[0].effectTelemetry.userAgentAudit);
  assert.equal(result.auditEvents[0].payload_json.selected_address, "8.8.8.8");
  assert.equal(result.auditEvents[0].payload_json.failure_phase, null);
  assert.equal(result.accountingIncrements[0].dnsAttemptsPerformed, 1);
  assert.equal(result.accountingIncrements[0].requestAttemptsPerformed, 1);
  assert.equal(result.accountingIncrements[0].connectionAttemptsPerformed, 1);
  assert.equal(result.accountingIncrements[0].lookupCallbacksPerformed, 1);
  assert.equal(result.accountingIncrements[0].liveNetworkEgressPerformed, 1);
  assert.equal(result.accountingIncrements[0].selectedAddress, "8.8.8.8");
  assert.equal(result.accountingIncrements[0].failurePhase, null);
  assert.equal(result.accountingIncrements[0].bytesReceived, Buffer.byteLength(M4_RECORDED_SEC_SUBMISSIONS_BODY));
  assert.equal(JSON.stringify(result).includes(VALID_UA), false); assert.equal(h.state().requestCalls, 1);
  reservation.persistInvokedResult(activation, result);
  const attemptText = readFileSync(reservation.paths.attempt, "utf8");
  assert.equal(JSON.parse(attemptText).status, "completed_evidence_persisted");
  assert.doesNotMatch(attemptText, /bodyBase64|quotedBodyText|AIR COURIER SERVICES/);
  assert.match(readFileSync(reservation.paths.custody, "utf8"), /AIR COURIER SERVICES/);
  assert.match(readFileSync(reservation.paths.workshop, "utf8"), /Quoted\/untrusted public-source content — Unverified/);
  const replay = await kernel.invoke(gateBInvocation(activation)); assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.refusalCode, "schedule_consumed"); assert.equal(h.state().requestCalls, 1);
});

test("Gate B post-network extraction refusal still emits one truthful failed record", async () => {
  const { activation } = consumedActivation(); const h = harness();
  const kernel = createM4SecGateBKernel({ activation, userAgent: VALID_UA,
    clock: { nowIso: () => "2026-07-12T00:00:03.000Z", monotonicMs: (() => { const values = [2000, 2004]; return () => values.shift()!; })() },
    dependencies: h.dependencies });
  const pending = kernel.invoke(gateBInvocation(activation)); await new Promise((resolve) => setImmediate(resolve));
  h.response.emit("end"); const result = await pending; assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.output, null); assert.equal(result.capabilityExecutions[0].outcome, "failed");
  assert.equal(result.capabilityExecutions[0].refusalCode, "extraction_refused");
  assert.equal(result.capabilityExecutions[0].effectTelemetry.liveNetworkEgress, 1);
  assert.equal(result.capabilityExecutions[0].effectTelemetry.failurePhase, "custody_finalization");
  assert.equal(result.auditEvents[0].payload_json.failure_phase, "custody_finalization");
  assert.equal(result.accountingIncrements[0].failurePhase, "custody_finalization");
  assert.equal(result.auditEvents[0].payload_json.response_sha256, createHash("sha256").update(Buffer.alloc(0)).digest("hex"));
  assert.equal(result.accountingIncrements[0].liveNetworkEgressPerformed, 1);
  assert.equal(result.accountingIncrements[0].bytesReceived, 0);
});

test("failed overflow durably persists sanitized execution, audit, and accounting after atomic reservation", async () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "atliera-m4-artifacts-"));
  const reservation = reserveM4GateBArtifactOutputs(outputDirectory);
  assert.equal(existsSync(reservation.paths.attempt), true);
  assert.equal(existsSync(reservation.paths.custody), true);
  assert.equal(existsSync(reservation.paths.workshop), true);
  const { activation } = consumedActivation(); const h = harness();
  const kernel = createM4SecGateBKernel({ activation, userAgent: VALID_UA,
    clock: { nowIso: () => "2026-07-12T00:00:03.000Z", monotonicMs: (() => { const values = [3000, 3004]; return () => values.shift()!; })() },
    dependencies: h.dependencies });
  const pending = kernel.invoke(gateBInvocation(activation)); await new Promise((resolve) => setImmediate(resolve));
  h.response.emit("data", Buffer.alloc(1_048_577));
  const result = await pending; assert.equal(result.ok, true); if (!result.ok) return;
  reservation.persistInvokedResult(activation, result);
  const receiptText = readFileSync(reservation.paths.attempt, "utf8");
  const receipt = JSON.parse(receiptText);
  assert.equal(receipt.status, "failed_no_evidence");
  assert.equal(receipt.capabilityExecutions[0].refusalCode, "body_limit_refused");
  assert.equal(receipt.capabilityExecutions[0].effectTelemetry.bytesReceived, 1_048_577);
  assert.equal(receipt.failurePhase, "response_body_or_deadline");
  assert.equal(receipt.capabilityExecutions[0].effectTelemetry.failurePhase, "response_body_or_deadline");
  assert.equal(receipt.auditEvents[0].payload_json.failure_phase, "response_body_or_deadline");
  assert.equal(receipt.accountingIncrements[0].failurePhase, "response_body_or_deadline");
  assert.equal(receipt.auditEvents[0].payload_json.bytes_received, 1_048_577);
  assert.equal(receipt.accountingIncrements[0].bytesReceived, 1_048_577);
  assert.doesNotMatch(receiptText, /bodyBase64|quotedBodyText|AIR COURIER SERVICES/);
  assert.equal(readFileSync(reservation.paths.custody).byteLength, 0);
  assert.equal(readFileSync(reservation.paths.workshop).byteLength, 0);
});

test("custody finalization failures emit a stable sanitized phase and preserve tombstones", async () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "atliera-m4-finalization-artifacts-"));
  const reservation = reserveM4GateBArtifactOutputs(outputDirectory);
  const { activation } = consumedActivation();
  const h = harness();
  const kernel = createM4SecGateBKernel({ activation, userAgent: VALID_UA,
    clock: { nowIso: () => "2026-07-12T00:00:03.000Z",
      monotonicMs: (() => { const values = [4000, 4004]; return () => values.shift()!; })() },
    dependencies: h.dependencies });
  const pending = kernel.invoke(gateBInvocation(activation));
  await new Promise((resolve) => setImmediate(resolve));
  h.response.emit("data", Buffer.from(M4_RECORDED_SEC_SUBMISSIONS_BODY));
  h.response.emit("end");
  const result = await pending;
  assert.equal(result.ok, true);
  if (!result.ok || result.output === null) return;
  const forged = Object.freeze({ ...result, output: Object.freeze({ ...result.output,
    responseSha256: "0".repeat(64) }) }) as typeof result;
  assert.throws(() => reservation.persistInvokedResult(activation, forged), /refused/);
  const receiptText = readFileSync(reservation.paths.attempt, "utf8");
  const receipt = JSON.parse(receiptText);
  assert.equal(receipt.status, "effect_completed_artifact_persistence_failed");
  assert.equal(receipt.failurePhase, "custody_finalization");
  assert.doesNotMatch(receiptText, /bodyBase64|quotedBodyText|AIR COURIER SERVICES/);
  assert.equal(readFileSync(reservation.paths.custody).byteLength, 0);
  assert.equal(readFileSync(reservation.paths.workshop).byteLength, 0);
});

test("artifact reservation refuses collisions without deleting pre-existing paths and leaves empty fail-closed tombstones", () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "atliera-m4-artifact-race-"));
  const workshopPath = join(outputDirectory, "sec-fedex-submissions-workshop.html");
  writeFileSync(workshopPath, "occupied");
  assert.throws(() => reserveM4GateBArtifactOutputs(outputDirectory), /reservation refused/);
  assert.equal(readFileSync(workshopPath, "utf8"), "occupied");
  assert.equal(readFileSync(join(outputDirectory, "sec-fedex-submissions-attempt.json")).byteLength, 0);
  assert.equal(readFileSync(join(outputDirectory, "sec-fedex-submissions-custody.json")).byteLength, 0);
});

test("reservation identity check never deletes a concurrently substituted canonical path", () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "atliera-m4-artifact-substitute-"));
  const reservation = reserveM4GateBArtifactOutputs(outputDirectory);
  const movedCustody = `${reservation.paths.custody}.moved`;
  renameSync(reservation.paths.custody, movedCustody);
  writeFileSync(reservation.paths.custody, "replacement-must-survive");
  assert.throws(() => reservation.assertIntact(), /identity refused/);
  reservation.releaseWithoutInvocation();
  assert.equal(readFileSync(reservation.paths.custody, "utf8"), "replacement-must-survive");
  assert.equal(readFileSync(movedCustody).byteLength, 0);
  assert.equal(readFileSync(reservation.paths.attempt).byteLength, 0);
  assert.equal(readFileSync(reservation.paths.workshop).byteLength, 0);
});

test("Gate B preflight and production singleton remain fail-closed without live dependency access", async () => {
  const { activation } = consumedActivation(); let accesses = 0;
  const options = Object.defineProperty({ activation, userAgent: `${VALID_UA}x`, clock: {} }, "dependencies",
    { enumerable: true, get() { accesses++; throw new Error("dependency touched"); } });
  assert.throws(() => createM4SecGateBKernel(options as never), /User-Agent refused/); assert.equal(accesses, 0);
  const result = await getM4PublicHttpFetchKernel().invoke({ trigger: { kind: "approved_recorded_schedule", scheduleId: "x" },
    input: { targetRef: "sec_fedex_submissions", targetPolicySha256: M4_TARGET_POLICY_SHA256 } });
  assert.equal(result.ok, false); assert.equal(accesses, 0);
  const script = readFileSync(join(import.meta.dirname, "..", "..", "scripts", "m4-sec-gate-b-one-shot.mts"), "utf8");
  assert.doesNotMatch(script, /acquireM4SecLive/);
  assert.match(script, /git", \["rev-parse", "HEAD"\]/);
  assert.match(script, /git", \["status", "--porcelain"\]/);
  assert.ok(script.indexOf("validateM4SecUserAgent") < script.indexOf("consumeM4GateBGo(resolve"));
  assert.ok(script.indexOf("reserveM4GateBArtifactOutputs") < script.indexOf("consumeM4GateBGo(resolve"));
  assert.ok(script.indexOf("persistInvokedResult") < script.indexOf("result.output === null"));
});
