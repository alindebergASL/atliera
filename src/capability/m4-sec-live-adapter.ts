import { Resolver } from "node:dns";
import { request as httpsRequest, type RequestOptions } from "node:https";
import type { IncomingMessage, ClientRequest } from "node:http";
import { isIP } from "node:net";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import { isPublicAddress, parseM4ContentType, validateM4SecUserAgent, type M4EffectTelemetry,
  type M4FetchRefusalCode } from "./public-http-fetch-policy.ts";

export interface M4ResolverLike { resolve4(hostname: string): Promise<readonly string[]>; cancel(): void }
export interface M4ResponseLike {
  readonly statusCode?: number;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly socket: { readonly remoteAddress?: string; destroy(error?: Error): void };
  on(event: "data", listener: (chunk: unknown) => void): this;
  on(event: "end", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  destroy(error?: Error): void;
}
export interface M4RequestLike {
  on(event: "error", listener: (error: Error) => void): this;
  end(): void;
  destroy(error?: Error): void;
}
export interface M4LiveDependencies {
  createResolver(): M4ResolverLike;
  request(options: Readonly<RequestOptions>, onResponse: (response: M4ResponseLike) => void): M4RequestLike;
  setDeadline(callback: () => void, milliseconds: number): unknown;
  clearDeadline(handle: unknown): void;
}

export type M4LiveTelemetry = M4EffectTelemetry;
const M4_SEC_TARGET_URL = new URL(M4_CANONICAL_TARGET_POLICY.url);
export type M4LiveResult =
  | { readonly ok: true; readonly bodyBase64: string; readonly responseSha256: string; readonly contentType: "application/json";
      readonly status: number; readonly telemetry: M4LiveTelemetry }
  | { readonly ok: false; readonly refusalCode: M4FetchRefusalCode; readonly telemetry: M4LiveTelemetry };
type M4LiveCoreResult =
  | { readonly ok: true; readonly bodyBase64: string; readonly responseSha256: string; readonly contentType: "application/json"; readonly status: number }
  | { readonly ok: false; readonly refusalCode: M4FetchRefusalCode };

export function createNodeM4LiveDependencies(): M4LiveDependencies {
  return {
    createResolver() {
      const resolver = new Resolver();
      return {
        resolve4(hostname) {
          return new Promise((resolve, reject) => resolver.resolve4(hostname, (error, addresses) => error ? reject(error) : resolve(addresses)));
        },
        cancel() { resolver.cancel(); },
      };
    },
    request(options, onResponse) { return httpsRequest(options, onResponse as (response: IncomingMessage) => void) as ClientRequest; },
    setDeadline(callback, milliseconds) { return setTimeout(callback, milliseconds); },
    clearDeadline(handle) { clearTimeout(handle as ReturnType<typeof setTimeout>); },
  };
}

function compareIpv4(left: string, right: string): number {
  const a = left.split(".").map(Number); const b = right.split(".").map(Number);
  for (let index = 0; index < 4; index++) { const delta = (a[index] ?? 0) - (b[index] ?? 0); if (delta) return delta; }
  return 0;
}

function snapshotDnsAddresses(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length === 0 || value.length > 64 || Object.getOwnPropertyNames(value).length !== value.length + 1) return null;
  const output: string[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "string") return null;
    output.push(descriptor.value);
  }
  return Object.freeze(output);
}

/** One fixed SEC identity. Callers cannot supply URL, host, path, method, address family, or budgets. */
export async function acquireM4SecLive(userAgent: unknown, injected?: M4LiveDependencies): Promise<M4LiveResult> {
  const audit = validateM4SecUserAgent(userAgent);
  const mutable = { dnsAttempts: 0 as 0 | 1, requestAttempts: 0 as 0 | 1, connectionAttempts: 0 as 0 | 1,
    liveNetworkEgress: 0 as 0 | 1, bytesReceived: 0, selectedAddress: null as string | null,
    lookupCallbacks: 0 as 0 | 1, retryCount: 0 as const, responseSha256: null as string | null,
    userAgentAudit: audit };
  const telemetry = (): M4LiveTelemetry => Object.freeze({ ...mutable });
  if (!audit) return Object.freeze({ ok: false, refusalCode: "user_agent_refused", telemetry: telemetry() });
  const configuredUserAgent = userAgent as string;

  const dependencies = injected ?? createNodeM4LiveDependencies();
  const resolver = dependencies.createResolver();
  let request: M4RequestLike | undefined; let response: M4ResponseLike | undefined; let settled = false;
  let finish!: (result: M4LiveResult) => void;
  const result = new Promise<M4LiveResult>((resolve) => { finish = resolve; });
  const dispose = (error?: Error) => {
    try { resolver.cancel(); } catch { /* deterministic best effort */ }
    try { response?.destroy(error); } catch { /* deterministic best effort */ }
    try { response?.socket.destroy(error); } catch { /* deterministic best effort */ }
    try { request?.destroy(error); } catch { /* deterministic best effort */ }
  };
  let deadline: unknown;
  const settle = (value: M4LiveCoreResult) => {
    if (settled) return; settled = true; dependencies.clearDeadline(deadline); dispose();
    finish(Object.freeze({ ...value, telemetry: telemetry() }) as M4LiveResult);
  };
  deadline = dependencies.setDeadline(() => settle({ ok: false, refusalCode: "timeout_or_cancelled" }),
    M4_CANONICAL_TARGET_POLICY.network.maxDurationMs);

  mutable.dnsAttempts = 1;
  void resolver.resolve4(M4_CANONICAL_TARGET_POLICY.hostname).then((rawAddresses) => {
    if (settled) return;
    const addresses = snapshotDnsAddresses(rawAddresses);
    if (addresses === null || addresses.some((address) => isIP(address) !== M4_CANONICAL_TARGET_POLICY.network.addressFamily)) {
      settle({ ok: false, refusalCode: "dns_refused" }); return;
    }
    if (addresses.some((address) => !isPublicAddress(address))) {
      settle({ ok: false, refusalCode: "non_public_address_refused" }); return;
    }
    const selected = [...new Set(addresses)].sort(compareIpv4)[0];
    if (!selected) { settle({ ok: false, refusalCode: "dns_refused" }); return; }
    mutable.selectedAddress = selected; mutable.requestAttempts = 1;
    let lookupUsed = false;
    const options: RequestOptions = Object.freeze({
      protocol: "https:", hostname: M4_CANONICAL_TARGET_POLICY.hostname, port: 443,
      path: `${M4_SEC_TARGET_URL.pathname}${M4_SEC_TARGET_URL.search}`, method: "GET", servername: M4_CANONICAL_TARGET_POLICY.hostname,
      agent: false, headers: Object.freeze({ "User-Agent": configuredUserAgent, Accept: "application/json", "Accept-Encoding": "identity" }),
      lookup: ((_hostname: string, _options: unknown,
        callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        if (lookupUsed) { settle({ ok: false, refusalCode: "transport_refused" }); return; }
        lookupUsed = true; mutable.lookupCallbacks = 1; callback(null, selected, 4);
      }) as RequestOptions["lookup"],
    });
    try {
      request = dependencies.request(options, (incoming) => {
        if (settled) { incoming.destroy(); return; }
        response = incoming;
        if (incoming.socket.remoteAddress !== selected) { settle({ ok: false, refusalCode: "connected_address_mismatch" }); return; }
        const status = incoming.statusCode;
        const location = incoming.headers.location;
        if (location !== undefined || status === undefined || (status >= 300 && status < 400)) {
          settle({ ok: false, refusalCode: "redirect_refused" }); return;
        }
        if (status < 200 || status > 299) { settle({ ok: false, refusalCode: "http_status_refused" }); return; }
        const rawContentType = incoming.headers["content-type"];
        if (typeof rawContentType !== "string" || !parseM4ContentType(rawContentType)) {
          settle({ ok: false, refusalCode: "mime_refused" }); return;
        }
        const contentEncoding = incoming.headers["content-encoding"];
        if (contentEncoding !== undefined && (typeof contentEncoding !== "string" || contentEncoding.toLowerCase() !== "identity")) {
          settle({ ok: false, refusalCode: "transport_refused" }); return;
        }
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk) => {
          if (settled) return;
          if (!(typeof chunk === "string" || ArrayBuffer.isView(chunk))) { settle({ ok: false, refusalCode: "transport_refused" }); return; }
          const bytes = Buffer.from(chunk as string | Uint8Array);
          mutable.bytesReceived += bytes.byteLength;
          if (mutable.bytesReceived > M4_CANONICAL_TARGET_POLICY.network.maxBodyBytes) {
            settle({ ok: false, refusalCode: "body_limit_refused" }); return;
          }
          chunks.push(bytes);
        });
        incoming.on("error", () => settle({ ok: false, refusalCode: "transport_refused" }));
        incoming.on("end", () => {
          if (settled) return; const body = Buffer.concat(chunks);
          mutable.responseSha256 = createHash("sha256").update(body).digest("hex");
          settle({ ok: true, bodyBase64: body.toString("base64"), responseSha256: mutable.responseSha256,
            contentType: "application/json", status });
        });
      });
      request.on("error", () => settle({ ok: false, refusalCode: "transport_refused" }));
      mutable.connectionAttempts = 1; mutable.liveNetworkEgress = 1;
      request.end();
    } catch { settle({ ok: false, refusalCode: "transport_refused" }); }
  }).catch(() => settle({ ok: false, refusalCode: "dns_refused" }));
  return result;
}

export const M4_LIVE_ADAPTER_POLICY_SHA256 = M4_TARGET_POLICY_SHA256;
