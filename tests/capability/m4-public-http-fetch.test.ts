import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { H2Clock } from "../../src/capability/h2-mediation-gate.ts";
import type { H2McpInProcessTransport, H2McpResponse } from "../../src/capability/h2-mcp-protocol.ts";
import { M4_RECORDED_PROOF_SCHEDULE } from "../../src/capability/m4-recorded-proof-schedule.ts";
import { M4PublicHttpFetchMediationKernel, createM4RecordedMediationKernel } from "../../src/capability/m4-public-http-fetch-mediation.ts";
import { createM4PublicHttpFetchMcpServer, type M4RecordedDependencies } from "../../src/capability/public-http-fetch-mcp-server.ts";
import { M4_MAX_BODY_BYTES, M4_TARGET_URL, acquireM4PublicEvidence, isPublicAddress, validateM4PublicTargetUrl, type M4HttpResponse } from "../../src/capability/public-http-fetch-policy.ts";

async function* chunks(...values: Uint8Array[]): AsyncIterable<Uint8Array> { for (const value of values) yield value; }
function dependencies(response?: Partial<M4HttpResponse>): M4RecordedDependencies {
  return {
    transportKind: "recorded_injected", fetchedAt: "2026-07-11T11:59:59.000Z",
    dns: { async resolve() { return [{ address: "104.16.1.1", family: 4 }]; } },
    http: { async request() { return { status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", location: undefined },
      connectedAddress: "104.16.1.1", finalUrl: M4_TARGET_URL, body: chunks(Buffer.from("recorded")), ...response }; } },
  };
}
function invocation(): Record<string, unknown> { return { trigger: { kind: "approved_recorded_schedule", scheduleId: M4_RECORDED_PROOF_SCHEDULE.scheduleId }, input: { targetRef: "fedex_company_overview" } }; }
function clock(): H2Clock { let mono = 0; return { nowIso: () => "2026-07-11T12:00:02.000Z", monotonicMs: () => mono++ }; }

test("raw or unapproved URLs cannot invoke acquisition", async () => {
  let requests = 0;
  const deps = dependencies();
  const kernel = createM4RecordedMediationKernel({ ...deps, http: { async request(request) { requests++; return deps.http.request(request); } } }, clock());
  const result = await kernel.invoke({ trigger: { kind: "approved_recorded_schedule", scheduleId: M4_RECORDED_PROOF_SCHEDULE.scheduleId }, input: { url: M4_TARGET_URL } });
  assert.equal(result.ok, false);
  assert.equal(result.invoked, false);
  assert.equal(requests, 0);
  const direct = await acquireM4PublicEvidence("https://example.com", deps, new AbortController().signal);
  assert.deepEqual(direct, { ok: false, refusalCode: "target_ref_refused" });
});

test("scheme, effective port, and hostname policy is exact", () => {
  assert.equal(validateM4PublicTargetUrl(M4_TARGET_URL, "investors.fedex.com"), null);
  assert.equal(validateM4PublicTargetUrl(M4_TARGET_URL.replace("https:", "http:"), "investors.fedex.com"), "url_policy_refused");
  assert.equal(validateM4PublicTargetUrl("https://investors.fedex.com:444/path", "investors.fedex.com"), "url_policy_refused");
  assert.equal(validateM4PublicTargetUrl("https://investors.fedex.com:443/path", "investors.fedex.com"), null);
  assert.equal(validateM4PublicTargetUrl("https://localhost/path", "investors.fedex.com"), "hostname_refused");
});

test("private, metadata, loopback, documentation, benchmark, multicast and reserved addresses are refused", () => {
  for (const address of ["0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::", "::1", "fc00::1", "fe80::1", "2001:db8::1", "ff02::1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("104.16.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("every DNS answer is validated and the connected address must remain pinned", async () => {
  const privateDns = { ...dependencies(), dns: { async resolve() { return [{ address: "169.254.169.254", family: 4 as const }]; } } };
  assert.deepEqual(await acquireM4PublicEvidence("fedex_company_overview", privateDns, new AbortController().signal), { ok: false, refusalCode: "non_public_address_refused" });
  const mismatch = dependencies({ connectedAddress: "104.16.1.2" });
  assert.deepEqual(await acquireM4PublicEvidence("fedex_company_overview", mismatch, new AbortController().signal), { ok: false, refusalCode: "connected_address_mismatch" });
});

test("redirects including Location, unsupported MIME, cancellation, and streaming overflow refuse without retry", async () => {
  const redirect = await acquireM4PublicEvidence("fedex_company_overview", dependencies({ status: 302, headers: { "content-type": "text/html", location: "https://example.com" } }), new AbortController().signal);
  assert.deepEqual(redirect, { ok: false, refusalCode: "redirect_refused" });
  const mime = await acquireM4PublicEvidence("fedex_company_overview", dependencies({ headers: { "content-type": "application/json", location: undefined } }), new AbortController().signal);
  assert.deepEqual(mime, { ok: false, refusalCode: "mime_refused" });
  const unsupportedCharset = await acquireM4PublicEvidence("fedex_company_overview",
    dependencies({ headers: { "content-type": "text/html; charset=iso-8859-1", location: undefined } }),
    new AbortController().signal);
  assert.deepEqual(unsupportedCharset, { ok: false, refusalCode: "mime_refused" });
  const oversized = await acquireM4PublicEvidence("fedex_company_overview", dependencies({ body: chunks(Buffer.alloc(M4_MAX_BODY_BYTES), Buffer.from("x")) }), new AbortController().signal);
  assert.deepEqual(oversized, { ok: false, refusalCode: "body_limit_refused" });
  let calls = 0;
  let dnsCalls = 0;
  const cancelled = dependencies();
  const controller = new AbortController(); controller.abort();
  const cancelledResult = await acquireM4PublicEvidence("fedex_company_overview", {
    ...cancelled,
    dns: { async resolve() { dnsCalls++; return []; } },
    http: { async request() { calls++; throw new Error("cancelled secret"); } },
  }, controller.signal);
  assert.deepEqual(cancelledResult, { ok: false, refusalCode: "timeout_or_cancelled" });
  assert.equal(calls, 0);
  assert.equal(dnsCalls, 0);
});

test("only 2xx responses succeed and exact non-UTF-8 bytes survive as canonical base64", async () => {
  for (const status of [199, 404, 500]) {
    const result = await acquireM4PublicEvidence("fedex_company_overview", dependencies({ status }), new AbortController().signal);
    assert.deepEqual(result, { ok: false, refusalCode: "http_status_refused" });
  }
  const exact = Buffer.from([0xff, 0xfe, 0x41, 0x00]);
  const result = await acquireM4PublicEvidence("fedex_company_overview", dependencies({ body: chunks(exact) }), new AbortController().signal);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.evidence.bodyBase64, "//5BAA==");
  assert.equal(result.evidence.byteCount, exact.byteLength);
  assert.equal(result.evidence.responseSha256, createHash("sha256").update(exact).digest("hex"));
  assert.equal(result.evidence.quotedBodyText, exact.toString("utf8"));
});

test("DNS answers and HTTP headers are descriptor-snapshotted without invoking accessors", async () => {
  let dnsGetterCalls = 0;
  const dnsAnswer = Object.defineProperty({ family: 4 }, "address", {
    enumerable: true,
    get() { dnsGetterCalls++; return "104.16.1.1"; },
  });
  const hostileDns = { ...dependencies(), dns: { async resolve() { return [dnsAnswer] as never; } } };
  assert.deepEqual(await acquireM4PublicEvidence("fedex_company_overview", hostileDns, new AbortController().signal),
    { ok: false, refusalCode: "dns_refused" });
  assert.equal(dnsGetterCalls, 0);

  let headerGetterCalls = 0;
  const headers = Object.defineProperty({ location: undefined }, "content-type", {
    enumerable: true,
    get() { headerGetterCalls++; return "text/plain"; },
  });
  const hostileHeaders = dependencies();
  const result = await acquireM4PublicEvidence("fedex_company_overview", {
    ...hostileHeaders,
    http: { async request() { return { status: 200, headers, connectedAddress: "104.16.1.1",
      finalUrl: M4_TARGET_URL, body: chunks(Buffer.from("hidden")) } as never; } },
  }, new AbortController().signal);
  assert.deepEqual(result, { ok: false, refusalCode: "transport_refused" });
  assert.equal(headerGetterCalls, 0);
});

test("invocation snapshot rejects proxies, accessors, symbols, custom prototypes and hidden extras without getters", async () => {
  const cases: unknown[] = [
    new Proxy(invocation(), {}),
    Object.assign(Object.create({ inherited: true }), invocation()),
    { ...invocation(), extra: true },
    Object.defineProperty(invocation(), "hidden", { value: true, enumerable: false }),
    { ...invocation(), [Symbol("hidden")]: true },
  ];
  let getterCalls = 0;
  cases.push(Object.defineProperty({ input: { targetRef: "fedex_company_overview" } }, "trigger", {
    enumerable: true,
    get() { getterCalls++; return invocation().trigger; },
  }));
  for (const candidate of cases) {
    const result = await createM4RecordedMediationKernel(dependencies(), clock()).invoke(candidate);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.refusalCode, "invalid_invocation_request");
  }
  assert.equal(getterCalls, 0);
});

test("clock exceptions, non-ISO timestamps, and unsafe monotonic values become sanitized refusals", async () => {
  for (const badClock of [
    { nowIso(): string { throw new Error("clock secret"); }, monotonicMs: () => 0 },
    { nowIso: () => "not-iso", monotonicMs: () => 0 },
  ] satisfies H2Clock[]) {
    const result = await createM4RecordedMediationKernel(dependencies(), badClock).invoke(invocation());
    assert.deepEqual(result, { ok: false, invoked: false, refusalCode: "invalid_invocation_request", auditEvents: [] });
    assert.doesNotMatch(JSON.stringify(result), /secret/);
  }
  const timestamps = ["2026-07-11T12:00:02.000Z", "2026-07-11T12:00:02.000Z"];
  const unsafeMonotonic: H2Clock = { nowIso: () => timestamps.shift()!, monotonicMs: () => Number.MAX_SAFE_INTEGER + 1 };
  const result = await createM4RecordedMediationKernel(dependencies(), unsafeMonotonic).invoke(invocation());
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.refusalCode, "invalid_invocation_request");
});

test("descriptor drift refuses before acquisition", async () => {
  const base = createM4PublicHttpFetchMcpServer(dependencies());
  let calls = 0;
  const transport: H2McpInProcessTransport = { sendNotification: (notice) => base.sendNotification(notice), async sendRequest(request, options) {
    const response = await base.sendRequest(request, options);
    if (request.method === "tools/call") calls++;
    if (request.method !== "tools/list") return response;
    const root = response as { jsonrpc: "2.0"; id: string | number; result: { tools: Array<Record<string, unknown>> } };
    return { jsonrpc: "2.0", id: root.id, result: { tools: [{ ...root.result.tools[0], title: "drift" }] } };
  } };
  const result = await new M4PublicHttpFetchMediationKernel({ transport, clock: clock() }).invoke(invocation());
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.refusalCode, "descriptor_hash_drift");
  assert.equal(calls, 0);
});

test("hostile MCP evidence extras, accessors, proxies, and semantic alteration are refused", async () => {
  async function run(acquisitionFactory: (valid: Record<string, unknown>) => unknown): Promise<void> {
    const base = createM4PublicHttpFetchMcpServer(dependencies());
    const transport: H2McpInProcessTransport = {
      sendNotification: (notice) => base.sendNotification(notice),
      async sendRequest(request, options) {
        const response = await base.sendRequest(request, options);
        if (request.method !== "tools/call") return response;
        const root = response as { jsonrpc: "2.0"; id: string | number; result: {
          structuredContent: { acquisition: Record<string, unknown> };
        } };
        const acquisition = acquisitionFactory(root.result.structuredContent.acquisition);
        const structuredContent = { acquisition, refusalCode: null };
        return { jsonrpc: "2.0", id: root.id, result: {
          content: [{ type: "text", text: "hostile response" }],
          structuredContent,
          isError: false,
        } };
      },
    };
    const result = await new M4PublicHttpFetchMediationKernel({ transport, clock: clock() }).invoke(invocation());
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.output, null);
    assert.equal(result.capabilityExecutions[0].outcome, "failed");
    assert.equal(result.capabilityExecutions[0].refusalCode, "transport_refused");
  }

  await run((valid) => ({ ...valid, extra: true }));
  await run((valid) => ({ ...valid, publisher: "attacker" }));
  await run((valid) => ({ ...valid, bodyBase64: "cmVjb3JkZWQ" }));
  await run((valid) => ({ ...valid, byteCount: 999 }));
  await run((valid) => ({ ...valid, responseSha256: "0".repeat(64) }));
  await run((valid) => ({ ...valid, provenance: { ...(valid.provenance as object), connectedAddress: "104.16.1.2" } }));
  await run((valid) => new Proxy(valid, {}));
  let getterCalls = 0;
  await run((valid) => Object.defineProperty({ ...valid }, "publisher", {
    enumerable: true,
    get() { getterCalls++; return "attacker"; },
  }));
  assert.equal(getterCalls, 0);
});

test("simultaneous and replayed execution consume exactly one recorded authority", async () => {
  const base = createM4PublicHttpFetchMcpServer(dependencies());
  let release!: () => void; let entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
  const releasePromise = new Promise<void>((resolve) => { release = resolve; });
  const transport: H2McpInProcessTransport = { sendNotification: (notice) => base.sendNotification(notice), async sendRequest(request, options) {
    const response = await base.sendRequest(request, options);
    if (request.method === "tools/list") { entered(); await releasePromise; }
    return response;
  } };
  const kernel = new M4PublicHttpFetchMediationKernel({ transport, clock: clock() });
  const firstPromise = kernel.invoke(invocation()); await enteredPromise;
  const second = await kernel.invoke(invocation()); release(); const first = await firstPromise;
  assert.equal(first.ok, true); assert.equal(second.ok, false); if (!second.ok) assert.equal(second.refusalCode, "schedule_in_progress");
  const replay = await kernel.invoke(invocation()); assert.equal(replay.ok, false); if (!replay.ok) assert.equal(replay.refusalCode, "schedule_consumed");
});

test("post-request failure has one sanitized execution, audit, accounting increment and zero retries", async () => {
  let calls = 0;
  const deps = dependencies();
  const kernel = createM4RecordedMediationKernel({ ...deps, http: { async request() { calls++; throw new Error("TOP_SECRET body credential"); } } }, clock());
  const result = await kernel.invoke(invocation());
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(calls, 1); assert.equal(result.output, null);
  assert.equal(result.capabilityExecutions.length, 1); assert.equal(result.auditEvents.length, 1); assert.equal(result.accountingIncrements.length, 1);
  assert.equal(result.capabilityExecutions[0].outcome, "failed"); assert.equal(result.capabilityExecutions[0].retryCount, 0);
  assert.equal(result.accountingIncrements[0].retriesPerformed, 0); assert.equal(result.accountingIncrements[0].liveNetworkEgressPerformed, 0);
  assert.doesNotMatch(JSON.stringify(result), /TOP_SECRET|credential/);
});

test("cancellation after request issuance records one truthful failed set without retry", async () => {
  let requests = 0;
  let issued!: () => void;
  const issuedPromise = new Promise<void>((resolve) => { issued = resolve; });
  const deps = dependencies();
  const base = createM4PublicHttpFetchMcpServer({ ...deps, http: { request(specification) {
    requests++;
    issued();
    return new Promise((_resolve, reject) => {
      if (specification.signal.aborted) reject(new Error("cancelled hidden detail"));
      else specification.signal.addEventListener("abort", () => reject(new Error("cancelled hidden detail")), { once: true });
    });
  } } });
  const transport: H2McpInProcessTransport = {
    sendNotification: (notice) => base.sendNotification(notice),
    sendRequest(request, options) {
      if (request.method !== "tools/call") return base.sendRequest(request, options);
      const controller = new AbortController();
      const pending = base.sendRequest(request, { signal: controller.signal });
      void issuedPromise.then(() => controller.abort());
      return pending;
    },
  };
  const result = await new M4PublicHttpFetchMediationKernel({ transport, clock: clock() }).invoke(invocation());
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(requests, 1);
  assert.equal(result.output, null);
  assert.equal(result.capabilityExecutions[0].refusalCode, "timeout_or_cancelled");
  assert.equal(result.capabilityExecutions.length, 1);
  assert.equal(result.auditEvents.length, 1);
  assert.equal(result.accountingIncrements.length, 1);
  assert.equal(result.accountingIncrements[0].retriesPerformed, 0);
  assert.doesNotMatch(JSON.stringify(result), /hidden detail/);
});

test("dormant Node dependency factory is pinned and absent from current runtime imports", () => {
  const repoRoot = join(import.meta.dirname, "..", "..");
  const root = join(repoRoot, "src");
  const factory = readFileSync(join(repoRoot, "scripts", "m4-node-public-http-dependencies.ts"), "utf8");
  assert.match(factory, /const pinnedLookup: LookupFunction/);
  assert.match(factory, /signal: specification\.signal/);
  assert.match(factory, /byteCount > specification\.maxBodyBytes/);
  assert.doesNotMatch(factory, /\bfetch\s*\(/);
  for (const path of [join(root, "index.ts"), join(root, "runtime", "composition.ts")]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /m4-node-public-http-dependencies/);
  }
});
