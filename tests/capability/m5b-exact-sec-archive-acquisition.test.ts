import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync,
  statSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assertM5bProductEffectConsumptionIntact,
  claimM5bProductEffectAttempt,
  createM5bProductEffectAttempt,
  createM5bProductEffectLedger,
  type M5bProductEffectExpectedAuthority,
} from "../../src/authority/m5b-product-effect-authority.ts";
import {
  createExactSecArchiveTargetPolicy,
  exactSecArchiveTargetPolicySha256,
  validateExactSecArchiveTargetPolicy,
} from "../../src/capability/exact-sec-archive-target-policy.ts";
import {
  acquireM5bExactSecArchive,
  M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256,
  M5B_EXACT_SEC_ARCHIVE_SOURCE_ID,
  type M4LiveDependencies,
  type M4NodeRequestOptions,
  type M4RequestLike,
  type M4ResponseLike,
} from "../../src/capability/m4-sec-live-adapter.ts";

const VALID_UA = `AtlieraTest monitored-public-contact${String.fromCharCode(64)}example.invalid`;
const SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY = createExactSecArchiveTargetPolicy({
  targetRef: "synthetic_sec_archive_primary_document",
  cik: "1048911",
  accessionWithoutDashes: "000110465926082672",
  primaryDocument: "tm2620197d1_8k.htm",
});
const SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY_SHA256 =
  exactSecArchiveTargetPolicySha256(SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY);

class FakeResponse extends EventEmitter implements M4ResponseLike {
  destroyed = 0;
  socketDestroyed = 0;
  readonly socket: { readonly remoteAddress?: string; destroy(): void };
  constructor(
    readonly statusCode = 200,
    readonly headers: Record<string, string | readonly string[] | undefined> = { "content-type": "text/html" },
    remoteAddress = "8.8.8.8",
  ) {
    super();
    this.socket = { remoteAddress, destroy: () => { this.socketDestroyed += 1; } };
  }
  override on(event: "data" | "end" | "error", listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
  destroy(): void { this.destroyed += 1; }
}

class FakeRequest extends EventEmitter implements M4RequestLike {
  destroyed = 0;
  ended = 0;
  override on(event: "error", listener: (error: Error) => void): this { return super.on(event, listener); }
  end(): void { this.ended += 1; }
  destroy(): void { this.destroyed += 1; }
}

function harness(config: {
  readonly addresses?: readonly string[];
  readonly response?: FakeResponse;
  readonly dnsPending?: boolean;
  readonly requestError?: boolean;
  readonly lookupHostname?: string;
  readonly lookupOptions?: object;
} = {}) {
  let deadline = () => {};
  let resolverCalls = 0;
  let requestCalls = 0;
  let options: M4NodeRequestOptions | undefined;
  const request = new FakeRequest();
  const response = config.response ?? new FakeResponse();
  const dependencies: M4LiveDependencies = {
    createResolver: () => ({
      resolve4: async (hostname) => {
        resolverCalls += 1;
        assert.equal(hostname, "www.sec.gov");
        if (config.dnsPending) return new Promise<readonly string[]>(() => {});
        return config.addresses ?? ["8.8.8.8"];
      },
      cancel: () => {},
    }),
    request: (value, callback) => {
      requestCalls += 1;
      options = value;
      const lookup = value.lookup as (hostname: string, lookupOptions: object,
        callback: (error: Error | null, address: string, family: number) => void) => void;
      lookup(config.lookupHostname ?? "www.sec.gov", config.lookupOptions ?? { family: 4, hints: 0 },
        (error, address, family) => {
          assert.equal(error, null);
          assert.equal(address, "8.8.8.8");
          assert.equal(family, 4);
        });
      queueMicrotask(() => config.requestError ? request.emit("error", new Error("synthetic tls")) : callback(response));
      return request;
    },
    setDeadline: (callback, milliseconds) => {
      assert.equal(milliseconds, 10_000);
      deadline = callback;
      return 1;
    },
    clearDeadline: () => {},
  };
  return {
    dependencies,
    request,
    response,
    deadline: () => deadline(),
    state: () => ({ resolverCalls, requestCalls, options }),
  };
}

function expected(root: string, suffix: string, operation: "exact_sec_archive_acquisition" | "retained_custody_read" =
  "exact_sec_archive_acquisition"): M5bProductEffectExpectedAuthority {
  const acquisition = operation === "exact_sec_archive_acquisition";
  const ledgerRootSha256 = createM5bProductEffectLedger(root).ledgerRootSha256;
  return {
    operation,
    authorityId: `auth_exact_archive_${suffix}`,
    consumptionId: `consume_exact_archive_${suffix}`,
    ledgerRootSha256,
    implementationCommit: "a".repeat(40),
    implementationTree: "b".repeat(40),
    targetPolicySha256: SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY_SHA256,
    sourceIdentities: [{
      sourceId: M5B_EXACT_SEC_ARCHIVE_SOURCE_ID,
      canonicalUrl: SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY.url,
      targetPolicySha256: SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY_SHA256,
      outerSha256: acquisition ? null : "c".repeat(64),
      outerByteSize: acquisition ? null : 321,
      decodedSha256: acquisition ? null : "d".repeat(64),
      decodedByteSize: acquisition ? null : 123,
    }],
  };
}

const FIXED_EFFECT_WINDOW = Object.freeze({
  authorizedAt: "2026-08-06T00:00:00.000Z",
  validFrom: "2026-08-06T00:00:00.000Z",
  validUntil: "2026-08-07T00:00:00.000Z",
});

function activeEffectWindow(now: Date) {
  return {
    authorizedAt: new Date(now.getTime() - 60_000).toISOString(),
    validFrom: new Date(now.getTime() - 60_000).toISOString(),
    validUntil: new Date(now.getTime() + 300_000).toISOString(),
  };
}

function goFor(
  binding: M5bProductEffectExpectedAuthority,
  window: Readonly<{ authorizedAt: string; validFrom: string; validUntil: string }> = FIXED_EFFECT_WINDOW,
) {
  const acquisition = binding.operation === "exact_sec_archive_acquisition";
  return {
    kind: "m5b-product-effect-one-shot-go",
    schemaVersion: "1",
    operation: binding.operation,
    authorityId: binding.authorityId,
    consumptionId: binding.consumptionId,
    ledgerRootSha256: binding.ledgerRootSha256,
    implementation: { commit: binding.implementationCommit, tree: binding.implementationTree },
    targetPolicySha256: binding.targetPolicySha256,
    sourceIdentities: binding.sourceIdentities,
    authorizedAt: window.authorizedAt,
    validFrom: window.validFrom,
    validUntil: window.validUntil,
    armingStatus: "armed",
    authorizesEffect: true,
    effectBudget: acquisition
      ? { retainedCustodyReads: 0, dnsAttempts: 1, networkRequests: 1, redirects: 0, retries: 0 }
      : { retainedCustodyReads: 1, dnsAttempts: 0, networkRequests: 0, redirects: 0, retries: 0 },
  };
}

function attemptAt(root: string, suffix: string) {
  const binding = expected(root, suffix);
  const now = new Date();
  return createM5bProductEffectAttempt(goFor(binding, activeEffectWindow(now)),
    createM5bProductEffectLedger(root), binding, now);
}

test("reviewed exact archive policy rejects every URL/archive escape and hostile own-data input", () => {
  assert.equal(validateExactSecArchiveTargetPolicy(SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY).url,
    SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY.url);
  const invalidUrls = [
    "http://www.sec.gov/Archives/edgar/data/1048911/000110465926082672/tm2620197d1_8k.htm",
    "https://sec.gov/Archives/edgar/data/1048911/000110465926082672/tm2620197d1_8k.htm",
    "https://www.sec.gov:443/Archives/edgar/data/1048911/000110465926082672/tm2620197d1_8k.htm",
    "https://user:secret@www.sec.gov/Archives/edgar/data/1048911/000110465926082672/tm2620197d1_8k.htm",
    "https://www.sec.gov/Archives/edgar/data/1048911/000110465926082672/tm2620197d1_8k.htm?x=1",
    "https://www.sec.gov/Archives/edgar/data/1048911/000110465926082672/tm2620197d1_8k.htm#x",
    "https://www.sec.gov/Archives/edgar/data/1048911/000110465926082672/%2e%2e%2fsecret.htm",
    "https://www.sec.gov/Archives/edgar/data/1048911/000110465926082672/tm2620197d1%2f_8k.htm",
    "https://www.sec.gov/Archives/edgar/data/not-numeric/000110465926082672/tm2620197d1_8k.htm",
    "https://www.sec.gov/Archives/edgar/data/1048911/0001104659-26-082672/tm2620197d1_8k.htm",
  ];
  for (const url of invalidUrls) {
    const policy = structuredClone(SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY) as any;
    policy.url = url;
    assert.throws(() => validateExactSecArchiveTargetPolicy(policy), /refused/);
  }
  const badBasename = structuredClone(SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY) as any;
  badBasename.archive.primaryDocument = "../secret.htm";
  assert.throws(() => validateExactSecArchiveTargetPolicy(badBasename), /refused/);
  const proxy = new Proxy({}, { ownKeys() { throw new Error("proxy trap must not run"); } });
  assert.throws(() => validateExactSecArchiveTargetPolicy(proxy), /plain data|plain_data/);
  let accesses = 0;
  const getter = Object.defineProperty({}, "kind", { enumerable: true, get() { accesses += 1; return "x"; } });
  assert.throws(() => validateExactSecArchiveTargetPolicy(getter), /plain data|plain_data/);
  assert.equal(accesses, 0);
  assert.throws(() => createExactSecArchiveTargetPolicy({
    targetRef: "synthetic_sec_archive_primary_document",
    cik: "1048911",
    accessionWithoutDashes: "000110465926082672",
    primaryDocument: "tm2620197d1_8k.htm",
    url: SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY.url,
  }), /refused/);
});

test("consumed exact authority produces one exact HTML custody receipt through injected transport", async () => {
  const root = mkdtempSync(join(tmpdir(), "atliera-exact-sec-success-"));
  try {
    const h = harness({ addresses: ["9.9.9.9", "8.8.8.8", "9.9.9.9"],
      response: new FakeResponse(200, { "content-type": "text/html; charset=UTF-8" }) });
    const pending = acquireM5bExactSecArchive(attemptAt(root, "success_001"),
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", h.dependencies);
    await new Promise((resolve) => setImmediate(resolve));
    const body = Buffer.from("<!doctype html><title>Synthetic filing</title><p>fixture only</p>", "utf8");
    h.response.emit("data", body.subarray(0, 20));
    h.response.emit("data", body.subarray(20));
    h.response.emit("end");
    const result = await pending;
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.responseBytes, body.byteLength);
    assert.equal(result.responseSha256, createHash("sha256").update(body).digest("hex"));
    assert.equal(result.outerCustodySha256,
      createHash("sha256").update(Buffer.from(result.custodyBytesBase64, "base64")).digest("hex"));
    assert.equal(result.custody.adapter.adapterSha256, M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256);
    assert.equal(result.custody.activation.ledgerRootSha256,
      createM5bProductEffectLedger(root).ledgerRootSha256);
    assert.equal(result.custody.trust.controlAuthority, "none");
    assert.equal(result.custody.trust.transportSuccessPromotesTrust, false);
    assert.equal(result.custody.effectAccounting.retries, 0);
    assert.equal(result.telemetry.selectedAddress, "8.8.8.8");
    assert.deepEqual({
      protocol: h.state().options?.protocol,
      hostname: h.state().options?.hostname,
      port: h.state().options?.port,
      path: h.state().options?.path,
      method: h.state().options?.method,
      family: h.state().options?.family,
      autoSelectFamily: h.state().options?.autoSelectFamily,
      agent: h.state().options?.agent,
      headers: h.state().options?.headers,
    }, {
      protocol: "https:", hostname: "www.sec.gov", port: 443,
      path: "/Archives/edgar/data/1048911/000110465926082672/tm2620197d1_8k.htm",
      method: "GET", family: 4, autoSelectFamily: false, agent: false,
      headers: { "User-Agent": VALID_UA, Accept: "text/html", "Accept-Encoding": "identity" },
    });
    assert.deepEqual({ resolverCalls: h.state().resolverCalls, requestCalls: h.state().requestCalls },
      { resolverCalls: 1, requestCalls: 1 });
    const [ledgerRecord] = readdirSync(root);
    assert.equal(statSync(join(root, ledgerRecord!)).mode & 0o777, 0o600);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("archive adapter refuses private DNS, redirect, MIME, encoding, overflow, and deadline with no retry", async () => {
  const cases: Array<{ config: Parameters<typeof harness>[0]; expected: string }> = [
    { config: { addresses: ["127.0.0.1"] }, expected: "non_public_address_refused" },
    { config: { addresses: ["8.8.8.8", "10.0.0.1"] }, expected: "non_public_address_refused" },
    { config: { response: new FakeResponse(302, { location: "/other", "content-type": "text/html" }) },
      expected: "redirect_refused" },
    { config: { response: new FakeResponse(200, { "content-type": "application/json" }) }, expected: "mime_refused" },
    { config: { response: new FakeResponse(200, { "content-type": "text/html; charset=iso-8859-1" }) },
      expected: "mime_refused" },
    { config: { response: new FakeResponse(200, { "content-type": "text/html", "content-encoding": "gzip" }) },
      expected: "transport_refused" },
  ];
  let index = 0;
  for (const item of cases) {
    const root = mkdtempSync(join(tmpdir(), "atliera-exact-sec-refusal-"));
    try {
      const h = harness(item.config);
      const result = await acquireM5bExactSecArchive(attemptAt(root, `refusal_${index++}`),
        SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
        () => "2026-08-06T01:00:01.000Z", h.dependencies);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.refusalCode, item.expected);
      assert.equal(result.telemetry.retryCount, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const overflowRoot = mkdtempSync(join(tmpdir(), "atliera-exact-sec-overflow-"));
  try {
    const h = harness();
    const pending = acquireM5bExactSecArchive(attemptAt(overflowRoot, "overflow_001"),
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", h.dependencies);
    await new Promise((resolve) => setImmediate(resolve));
    h.response.emit("data", Buffer.alloc(1_048_577));
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.refusalCode, "body_limit_refused");
  } finally {
    rmSync(overflowRoot, { recursive: true, force: true });
  }

  const utf8Root = mkdtempSync(join(tmpdir(), "atliera-exact-sec-utf8-"));
  try {
    const h = harness();
    const pending = acquireM5bExactSecArchive(attemptAt(utf8Root, "utf8_001"),
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", h.dependencies);
    await new Promise((resolve) => setImmediate(resolve));
    h.response.emit("data", Buffer.from([0xc3, 0x28]));
    h.response.emit("end");
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.refusalCode, "transport_refused");
  } finally {
    rmSync(utf8Root, { recursive: true, force: true });
  }

  const timeoutRoot = mkdtempSync(join(tmpdir(), "atliera-exact-sec-timeout-"));
  try {
    const h = harness({ dnsPending: true });
    const pending = acquireM5bExactSecArchive(attemptAt(timeoutRoot, "timeout_001"),
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", h.dependencies);
    h.deadline();
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.refusalCode, "timeout_or_cancelled");
  } finally {
    rmSync(timeoutRoot, { recursive: true, force: true });
  }
});

test("invalid SEC identification consumes the attempt before touching transport dependencies", async () => {
  const root = mkdtempSync(join(tmpdir(), "atliera-exact-sec-user-agent-"));
  try {
    let dependencyAccesses = 0;
    const untouched = Object.defineProperty({}, "createResolver", {
      get() { dependencyAccesses += 1; throw new Error("dependency touched"); },
    }) as M4LiveDependencies;
    const result = await acquireM5bExactSecArchive(attemptAt(root, "user_agent_001"),
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, "invalid",
      () => "2026-08-06T01:00:01.000Z", untouched);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.refusalCode, "user_agent_refused");
    assert.equal(dependencyAccesses, 0);
    await assert.rejects(() => acquireM5bExactSecArchive(attemptAt(root, "user_agent_001"),
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", untouched), /refused/);
    assert.equal(dependencyAccesses, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an injected policy substitution is durably refused before acquisition dependency access", async () => {
  const root = mkdtempSync(join(tmpdir(), "atliera-exact-sec-policy-binding-"));
  try {
    const alternatePolicy = createExactSecArchiveTargetPolicy({
      targetRef: "synthetic_alternate_sec_archive_document",
      cik: "1",
      accessionWithoutDashes: "000000000000000001",
      primaryDocument: "synthetic-alternate.htm",
    });
    let dependencyAccesses = 0;
    const untouched = Object.defineProperty({}, "createResolver", {
      get() { dependencyAccesses += 1; throw new Error("dependency touched"); },
    }) as M4LiveDependencies;
    await assert.rejects(() => acquireM5bExactSecArchive(attemptAt(root, "policy_binding_001"), alternatePolicy,
      VALID_UA, () => "2026-08-06T01:00:01.000Z", untouched), /authority binding refused/);
    assert.equal(dependencyAccesses, 0);
    await assert.rejects(() => acquireM5bExactSecArchive(attemptAt(root, "policy_binding_001"),
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", untouched), /refused/);
    assert.equal(dependencyAccesses, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unarmed, wrong-bound, replayed, copied, and restarted attempts touch no acquisition dependency", async () => {
  const root = mkdtempSync(join(tmpdir(), "atliera-exact-sec-replay-"));
  try {
    const binding = expected(root, "replay_001");
    const template = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "fixtures", "validation",
      "m5b-product-effect-authority-template.json"), "utf8"));
    assert.equal(template.currentEffectiveAuthorization, "none");
    assert.equal(template.ledgerRootSha256, null);
    assert.ok(template.operations.every((operation: any) => operation.ledgerRootSha256 === null));
    assert.equal(template.operations.find((operation: any) =>
      operation.operation === "exact_sec_archive_acquisition").targetPolicySha256, null);
    assert.deepEqual(template.operations.map((operation: any) => [operation.operation, operation.armingStatus,
      operation.authorizesEffect]), [
      ["retained_custody_read", "unarmed", false],
      ["exact_sec_archive_acquisition", "unarmed", false],
    ]);
    assert.throws(() => createM5bProductEffectAttempt(template, createM5bProductEffectLedger(root), binding,
      new Date("2026-08-06T01:00:00.000Z")), /refused/);
    const hostileGo = new Proxy({}, { ownKeys() { throw new Error("GO proxy trap must not run"); } });
    assert.throws(() => createM5bProductEffectAttempt(hostileGo, createM5bProductEffectLedger(root), binding,
      new Date("2026-08-06T01:00:00.000Z")), /refused/);
    let goGetterAccesses = 0;
    const getterGo = Object.defineProperty({}, "kind", {
      enumerable: true,
      get() { goGetterAccesses += 1; throw new Error("GO getter must not run"); },
    });
    assert.throws(() => createM5bProductEffectAttempt(getterGo, createM5bProductEffectLedger(root), binding,
      new Date("2026-08-06T01:00:00.000Z")), /refused/);
    assert.equal(goGetterAccesses, 0);
    const unarmed = { ...goFor(binding), armingStatus: "unarmed", authorizesEffect: false };
    assert.throws(() => createM5bProductEffectAttempt(unarmed, createM5bProductEffectLedger(root), binding,
      new Date("2026-08-06T01:00:00.000Z")), /refused/);
    for (const key of ["implementationCommit", "implementationTree", "targetPolicySha256"] as const) {
      const wrong = { ...binding, [key]: key === "targetPolicySha256" ? "f".repeat(64) : "f".repeat(40) };
      assert.throws(() => createM5bProductEffectAttempt(goFor(binding), createM5bProductEffectLedger(root), wrong,
        new Date("2026-08-06T01:00:00.000Z")), /refused/);
    }
    for (const timestamps of [
      { authorizedAt: "not-a-time" },
      { validFrom: "2026-08-07T00:00:00.000Z", validUntil: "2026-08-06T00:00:00.000Z" },
      { validUntil: "2026-08-06T00:30:00.000Z" },
    ]) {
      assert.throws(() => createM5bProductEffectAttempt({ ...goFor(binding), ...timestamps },
        createM5bProductEffectLedger(root), binding, new Date("2026-08-06T01:00:00.000Z")), /refused/);
    }
    const replayNow = new Date();
    const replayGo = goFor(binding, activeEffectWindow(replayNow));
    const first = createM5bProductEffectAttempt(replayGo, createM5bProductEffectLedger(root), binding, replayNow);
    const privateDns = harness({ addresses: ["127.0.0.1"] });
    const firstResult = await acquireM5bExactSecArchive(first, SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", privateDns.dependencies);
    assert.equal(firstResult.ok, false);

    let dependencyAccesses = 0;
    const untouched = Object.defineProperty({}, "createResolver", {
      get() { dependencyAccesses += 1; throw new Error("dependency touched"); },
    }) as M4LiveDependencies;
    await assert.rejects(() => acquireM5bExactSecArchive(first, SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", untouched), /refused/);
    assert.equal(dependencyAccesses, 0);

    const copiedGo = JSON.parse(JSON.stringify(replayGo));
    const restartedLedger = createM5bProductEffectLedger(root);
    const restartedAttempt = createM5bProductEffectAttempt(copiedGo, restartedLedger, binding, replayNow);
    await assert.rejects(() => acquireM5bExactSecArchive(restartedAttempt,
      SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY, VALID_UA,
      () => "2026-08-06T01:00:01.000Z", untouched), /refused/);
    assert.equal(dependencyAccesses, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the same GO and expected authority cannot be replayed or root-hash-substituted across ledger roots", () => {
  const firstRoot = mkdtempSync(join(tmpdir(), "atliera-effect-root-binding-a-"));
  const secondRoot = mkdtempSync(join(tmpdir(), "atliera-effect-root-binding-b-"));
  try {
    const firstBinding = expected(firstRoot, "cross_root_001");
    const copiedGo = JSON.parse(JSON.stringify(goFor(firstBinding)));
    const firstAttempt = createM5bProductEffectAttempt(copiedGo, createM5bProductEffectLedger(firstRoot),
      firstBinding, new Date("2026-08-06T01:00:00.000Z"));
    claimM5bProductEffectAttempt(firstAttempt, "exact_sec_archive_acquisition",
      new Date("2026-08-06T01:00:01.000Z"));
    const secondLedger = createM5bProductEffectLedger(secondRoot);
    assert.notEqual(firstBinding.ledgerRootSha256, secondLedger.ledgerRootSha256);
    assert.throws(() => createM5bProductEffectAttempt(copiedGo, secondLedger, firstBinding,
      new Date("2026-08-06T01:00:00.000Z")), /ledger_root_binding/);

    const substitutedExpected = { ...firstBinding, ledgerRootSha256: secondLedger.ledgerRootSha256 };
    assert.throws(() => createM5bProductEffectAttempt(copiedGo, secondLedger, substitutedExpected,
      new Date("2026-08-06T01:00:00.000Z")), /go_binding/);
    assert.equal(readdirSync(firstRoot).length, 1);
    assert.deepEqual(readdirSync(secondRoot), []);
  } finally {
    rmSync(firstRoot, { recursive: true, force: true });
    rmSync(secondRoot, { recursive: true, force: true });
  }
});

test("durable consumption detects hardlink, partial-record, symlink collision, and root substitution", () => {
  const makeClaim = (root: string, suffix: string) => {
    const binding = expected(root, suffix, "retained_custody_read");
    const attempt = createM5bProductEffectAttempt(goFor(binding), createM5bProductEffectLedger(root), binding,
      new Date("2026-08-06T01:00:00.000Z"));
    return claimM5bProductEffectAttempt(attempt, "retained_custody_read", new Date("2026-08-06T01:00:01.000Z"));
  };

  const hardlinkRoot = mkdtempSync(join(tmpdir(), "atliera-effect-hardlink-"));
  try {
    const consumption = makeClaim(hardlinkRoot, "alias_001");
    const [record] = readdirSync(hardlinkRoot);
    linkSync(join(hardlinkRoot, record!), join(hardlinkRoot, "alias.json"));
    assert.throws(() => assertM5bProductEffectConsumptionIntact(consumption, "retained_custody_read"), /refused/);
  } finally { rmSync(hardlinkRoot, { recursive: true, force: true }); }

  const partialRoot = mkdtempSync(join(tmpdir(), "atliera-effect-partial-"));
  try {
    const consumption = makeClaim(partialRoot, "partial_001");
    const [record] = readdirSync(partialRoot);
    truncateSync(join(partialRoot, record!), 7);
    assert.throws(() => assertM5bProductEffectConsumptionIntact(consumption, "retained_custody_read"), /refused/);
    const binding = expected(partialRoot, "partial_001", "retained_custody_read");
    const replay = createM5bProductEffectAttempt(goFor(binding), createM5bProductEffectLedger(partialRoot), binding,
      new Date("2026-08-06T01:00:00.000Z"));
    assert.throws(() => claimM5bProductEffectAttempt(replay, "retained_custody_read",
      new Date("2026-08-06T01:00:01.000Z")), /refused/);
  } finally { rmSync(partialRoot, { recursive: true, force: true }); }

  const symlinkRoot = mkdtempSync(join(tmpdir(), "atliera-effect-symlink-"));
  try {
    makeClaim(symlinkRoot, "symlink_001");
    const [record] = readdirSync(symlinkRoot);
    const occupied = join(symlinkRoot, record!);
    rmSync(occupied);
    symlinkSync(join(symlinkRoot, "missing-target"), occupied);
    const binding = expected(symlinkRoot, "symlink_001", "retained_custody_read");
    const replay = createM5bProductEffectAttempt(goFor(binding), createM5bProductEffectLedger(symlinkRoot), binding,
      new Date("2026-08-06T01:00:00.000Z"));
    assert.throws(() => claimM5bProductEffectAttempt(replay, "retained_custody_read",
      new Date("2026-08-06T01:00:01.000Z")), /refused/);
  } finally { rmSync(symlinkRoot, { recursive: true, force: true }); }

  const root = mkdtempSync(join(tmpdir(), "atliera-effect-root-substitution-"));
  const moved = `${root}-moved`;
  try {
    const consumption = makeClaim(root, "root_001");
    renameSync(root, moved);
    mkdirSync(root, { mode: 0o700 });
    assert.throws(() => assertM5bProductEffectConsumptionIntact(consumption, "retained_custody_read"), /refused/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(moved, { recursive: true, force: true });
  }
});
