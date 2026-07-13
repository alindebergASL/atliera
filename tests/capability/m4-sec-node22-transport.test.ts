import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import https, { type RequestOptions } from "node:https";
import { join } from "node:path";
import test from "node:test";

import {
  acquireM4SecLive,
  type M4LiveDependencies,
  type M4ResponseLike,
} from "../../src/capability/m4-sec-live-adapter.ts";

const VALID_UA = `AtlieraTest monitored-public-contact${String.fromCharCode(64)}example.invalid`;
// Self-signed loopback-only test fixtures. Production code never imports or trusts this key pair.
const LOOPBACK_KEY = readFileSync(join(import.meta.dirname, "..", "fixtures", "m4-loopback-key.pem"));
const LOOPBACK_CERT = readFileSync(join(import.meta.dirname, "..", "fixtures", "m4-loopback-cert.pem"));

type M4Node22RequestOptions = RequestOptions & Readonly<{ family?: number; autoSelectFamily?: boolean }>;

type LoopbackServer = Readonly<{
  port: number;
  acceptedConnections: () => number;
  requests: () => number;
  close: () => Promise<void>;
}>;

async function startLoopbackTlsServer(): Promise<LoopbackServer> {
  let connections = 0;
  let requests = 0;
  const server = https.createServer({ key: LOOPBACK_KEY, cert: LOOPBACK_CERT }, (_request, response) => {
    requests += 1;
    response.writeHead(200, { "content-type": "application/json" });
    response.end('{"loopback":true}');
  });
  server.on("connection", () => { connections += 1; });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) throw new Error("loopback server address unavailable");
  return Object.freeze({
    port: address.port,
    acceptedConnections: () => connections,
    requests: () => requests,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  });
}

async function issueLoopbackRequest(port: number, overrides: M4Node22RequestOptions = {}) {
  const lookupInvocations: Array<Record<string, unknown>> = [];
  let statusCode: number | null = null;
  let responseBytes = 0;
  let errorCode: string | null = null;
  await new Promise<void>((resolve) => {
    const request = https.request({
      hostname: "loopback.test",
      port,
      path: "/",
      method: "GET",
      agent: false,
      rejectUnauthorized: false,
      lookup: ((hostname: string, options: Record<string, unknown>, callback: (...args: unknown[]) => void) => {
        lookupInvocations.push({ hostname, family: options.family ?? null, hints: options.hints ?? null,
          all: options.all ?? null });
        callback(null, "127.0.0.1", 4);
      }) as RequestOptions["lookup"],
      ...overrides,
    }, (response) => {
      statusCode = response.statusCode ?? null;
      response.on("data", (chunk: Buffer) => { responseBytes += chunk.byteLength; });
      response.on("end", resolve);
    });
    request.once("error", (error: NodeJS.ErrnoException) => {
      errorCode = error.code ?? "UNKNOWN";
      resolve();
    });
    request.end();
  });
  return Object.freeze({ lookupInvocations, statusCode, responseBytes, errorCode });
}

test("loopback certificate is a non-CA test-only leaf restricted to loopback identities", () => {
  const certificate = new X509Certificate(LOOPBACK_CERT);
  assert.equal(certificate.ca, false);
  assert.match(certificate.subject, /O=Atliera Test Fixtures/);
  assert.match(certificate.subject, /OU=Loopback Only/);
  const subjectAltName = certificate.subjectAltName ?? "";
  assert.match(subjectAltName, /DNS:loopback\.test/);
  assert.match(subjectAltName, /IP Address:127\.0\.0\.1/);
  assert.doesNotMatch(subjectAltName, /data\.sec\.gov|8\.8\.8\.8/);
});

test("Node 22 automatic-family lookup requests all addresses and rejects a legacy scalar callback", async () => {
  assert.equal(Number(process.versions.node.split(".")[0]), 22);
  const server = await startLoopbackTlsServer();
  try {
    const automaticFamily = await issueLoopbackRequest(server.port);
    const pinnedIpv4 = await issueLoopbackRequest(server.port, { family: 4, autoSelectFamily: false });
    assert.deepEqual(automaticFamily.lookupInvocations, [
      { hostname: "loopback.test", family: null, hints: 32, all: true },
    ]);
    assert.equal(automaticFamily.statusCode, null);
    assert.equal(automaticFamily.errorCode, "ERR_INVALID_IP_ADDRESS");
    assert.deepEqual(pinnedIpv4.lookupInvocations, [
      { hostname: "loopback.test", family: 4, hints: 0, all: null },
    ]);
    assert.equal(pinnedIpv4.errorCode, null);
    assert.equal(pinnedIpv4.statusCode, 200);
    assert.equal(pinnedIpv4.responseBytes, 17);
    assert.equal(server.acceptedConnections(), 1);
    assert.equal(server.requests(), 1);
  } finally {
    await server.close();
  }
});

test("actual adapter request options pin one IPv4 and complete through local TLS without fallback", async () => {
  const server = await startLoopbackTlsServer();
  let requestCalls = 0;
  let resolverCalls = 0;
  let capturedOptions: Readonly<M4Node22RequestOptions> | undefined;
  let originalLookupCallbacks = 0;
  const dependencies: M4LiveDependencies = {
    createResolver: () => ({
      resolve4: async (hostname) => {
        resolverCalls += 1;
        assert.equal(hostname, "data.sec.gov");
        return ["8.8.8.8"];
      },
      cancel: () => {},
    }),
    request: (options, onResponse) => {
      requestCalls += 1;
      capturedOptions = options as M4Node22RequestOptions;
      const originalLookup = options.lookup as (
        hostname: string,
        options: Record<string, unknown>,
        callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ) => void;
      const translatedLookup = ((hostname: string, lookupOptions: Record<string, unknown>,
        callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        assert.deepEqual(Reflect.ownKeys(lookupOptions), ["family", "hints"]);
        originalLookup(hostname, lookupOptions, (error, address, family) => {
          originalLookupCallbacks += 1;
          assert.equal(error, null);
          assert.equal(address, "8.8.8.8");
          assert.equal(family, 4);
          callback(null, "127.0.0.1", 4);
        });
      }) as RequestOptions["lookup"];
      return https.request({ ...options, port: server.port, servername: "loopback.test",
        rejectUnauthorized: false, lookup: translatedLookup }, (incoming) => {
        let responseLike: M4ResponseLike;
        responseLike = {
          statusCode: incoming.statusCode,
          headers: incoming.headers,
          socket: {
            remoteAddress: "8.8.8.8",
            destroy: (error?: Error) => incoming.socket.destroy(error),
          },
          on(event, listener) { incoming.on(event, listener); return responseLike; },
          destroy(error?: Error) { incoming.destroy(error); },
        };
        onResponse(responseLike);
      });
    },
    setDeadline: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearDeadline: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
  try {
    const result = await acquireM4SecLive(VALID_UA, dependencies);
    assert.equal(result.ok, true);
    assert.equal(capturedOptions?.family, 4);
    assert.equal(capturedOptions?.autoSelectFamily, false);
    assert.equal(capturedOptions?.agent, false);
    assert.equal(resolverCalls, 1);
    assert.equal(requestCalls, 1);
    assert.equal(originalLookupCallbacks, 1);
    assert.equal(result.telemetry.selectedAddress, "8.8.8.8");
    assert.equal(result.telemetry.lookupCallbacks, 1);
    assert.equal(result.telemetry.connectionAttempts, 1);
    assert.equal(result.telemetry.retryCount, 0);
    assert.equal((result.telemetry as unknown as { failurePhase: unknown }).failurePhase, null);
    assert.equal(server.acceptedConnections(), 1);
    assert.equal(server.requests(), 1);
  } finally {
    await server.close();
  }
});

type FailureMode = "lookup" | "construction" | "tcp" | "tls" | "headers" | "status" | "body" | "deadline";

class PhaseSocket extends EventEmitter {
  readonly remoteAddress = "8.8.8.8";
  destroy(): void {}
}

class PhaseResponse extends EventEmitter implements M4ResponseLike {
  readonly socket = new PhaseSocket();
  constructor(readonly statusCode: number = 200,
    readonly headers: Record<string, string | readonly string[] | undefined> = { "content-type": "application/json" }) {
    super();
  }
  override on(event: "data" | "end" | "error", listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }
  destroy(): void {}
}

class PhaseRequest extends EventEmitter {
  constructor(readonly run: () => void) { super(); }
  end(): void { queueMicrotask(this.run); }
  destroy(): void {}
}

function failurePhaseHarness(mode: FailureMode) {
  let deadline = () => {};
  let lookupCallbackInvoked = false;
  let currentRequest: PhaseRequest | undefined;
  const response = new PhaseResponse(mode === "status" ? 503 : 200);
  const socket = response.socket;
  const dependencies: M4LiveDependencies = {
    createResolver: () => ({ resolve4: async () => ["8.8.8.8"], cancel: () => {} }),
    request: ((options: M4Node22RequestOptions, onResponse: (value: M4ResponseLike) => void) => {
      if (mode === "construction") throw new Error("must be sanitized");
      const lookup = options.lookup as (hostname: string, options: Record<string, unknown>,
        callback: (error: Error | null, address: string, family: number) => void) => void;
      lookup("data.sec.gov", mode === "lookup" ? { family: 4, hints: 0, all: true } : { family: 4, hints: 0 },
        () => { lookupCallbackInvoked = true; });
      const request = new PhaseRequest(() => {
        request.emit("socket", socket);
        if (mode === "lookup" || mode === "tcp") { request.emit("error", new Error("must be sanitized")); return; }
        socket.emit("connect");
        if (mode === "tls") { request.emit("error", new Error("must be sanitized")); return; }
        socket.emit("secureConnect");
        if (mode === "headers") { request.emit("error", new Error("must be sanitized")); return; }
        if (mode === "deadline") { deadline(); return; }
        onResponse(response);
        if (mode === "body") queueMicrotask(() => response.emit("error", new Error("must be sanitized")));
      });
      currentRequest = request;
      return request;
    }) as M4LiveDependencies["request"],
    setDeadline: (callback) => { deadline = callback; return 1; },
    clearDeadline: () => {},
  };
  return { dependencies, lookupCallbackInvoked: () => lookupCallbackInvoked,
    requestConstructed: () => currentRequest !== undefined };
}

test("transport failures expose only stable allowlisted phases with truthful one-attempt accounting", async () => {
  const cases = [
    ["lookup", "lookup_contract", "transport_refused"],
    ["construction", "request_construction", "transport_refused"],
    ["tcp", "tcp_connection", "transport_refused"],
    ["tls", "tls_handshake", "transport_refused"],
    ["headers", "response_headers", "transport_refused"],
    ["status", "response_headers", "http_status_refused"],
    ["body", "response_body_or_deadline", "transport_refused"],
    ["deadline", "response_body_or_deadline", "timeout_or_cancelled"],
  ] as const;
  for (const [mode, expectedPhase, expectedRefusal] of cases) {
    const harness = failurePhaseHarness(mode);
    const result = await acquireM4SecLive(VALID_UA, harness.dependencies);
    assert.equal(result.ok, false, mode);
    if (result.ok) continue;
    assert.equal(result.refusalCode, expectedRefusal, mode);
    assert.equal((result.telemetry as unknown as { failurePhase: unknown }).failurePhase, expectedPhase, mode);
    assert.ok(result.telemetry.requestAttempts <= 1, mode);
    assert.ok(result.telemetry.connectionAttempts <= 1, mode);
    assert.equal(result.telemetry.retryCount, 0, mode);
    if (mode === "lookup") {
      assert.equal(harness.requestConstructed(), true);
      assert.equal(harness.lookupCallbackInvoked(), false);
      assert.equal(result.telemetry.connectionAttempts, 0);
      assert.equal(result.telemetry.liveNetworkEgress, 0);
    }
  }
});
