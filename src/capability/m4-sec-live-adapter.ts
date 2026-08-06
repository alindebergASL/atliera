import { Resolver } from "node:dns";
import { request as httpsRequest, type RequestOptions } from "node:https";
import type { IncomingMessage, ClientRequest } from "node:http";
import { isIP } from "node:net";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";

import {
  assertM5bProductEffectConsumptionIntact,
  claimM5bProductEffectAttempt,
  type M5bProductEffectAttempt,
  type M5bProductEffectConsumption,
} from "../authority/m5b-product-effect-authority.ts";
import {
  exactSecArchiveTargetPolicySha256,
  validateExactSecArchiveTargetPolicy,
  type ExactSecArchiveTargetPolicy,
} from "./exact-sec-archive-target-policy.ts";
import { M4_CANONICAL_TARGET_POLICY, M4_TARGET_POLICY_SHA256 } from "./m4-target-policy.ts";
import { isPublicAddress, isStrictIsoTimestamp, parseM4ContentType, validateM4SecUserAgent, type M4EffectTelemetry,
  type M4FailurePhase, type M4FetchRefusalCode } from "./public-http-fetch-policy.ts";

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
export type M4NodeRequestOptions = RequestOptions & Readonly<{ family: 4; autoSelectFamily: false }>;
export interface M4LiveDependencies {
  createResolver(): M4ResolverLike;
  request(options: Readonly<M4NodeRequestOptions>, onResponse: (response: M4ResponseLike) => void): M4RequestLike;
  setDeadline(callback: () => void, milliseconds: number): unknown;
  clearDeadline(handle: unknown): void;
}

export type M4LiveTelemetry = M4EffectTelemetry;
export type M4LiveResult =
  | { readonly ok: true; readonly bodyBase64: string; readonly responseSha256: string; readonly contentType: "application/json";
      readonly status: number; readonly telemetry: M4LiveTelemetry }
  | { readonly ok: false; readonly refusalCode: M4FetchRefusalCode; readonly telemetry: M4LiveTelemetry };
type SecLiveContentType = "application/json" | "text/html";
type SecLiveCoreResult =
  | { readonly ok: true; readonly bodyBase64: string; readonly responseSha256: string; readonly contentType: SecLiveContentType;
      readonly status: number }
  | { readonly ok: false; readonly refusalCode: M4FetchRefusalCode };
type SecLiveResult = (SecLiveCoreResult & { readonly telemetry: M4LiveTelemetry });

interface SecLiveTarget {
  readonly url: string;
  readonly hostname: string;
  readonly maxDurationMs: number;
  readonly maxBodyBytes: number;
  readonly addressFamily: 4;
  readonly contentType: SecLiveContentType;
  readonly requiredStatus: 200 | null;
}

const M4_SEC_LIVE_TARGET: SecLiveTarget = Object.freeze({
  url: M4_CANONICAL_TARGET_POLICY.url,
  hostname: M4_CANONICAL_TARGET_POLICY.hostname,
  maxDurationMs: M4_CANONICAL_TARGET_POLICY.network.maxDurationMs,
  maxBodyBytes: M4_CANONICAL_TARGET_POLICY.network.maxBodyBytes,
  addressFamily: 4,
  contentType: "application/json",
  requiredStatus: null,
});

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

function validLookupInvocation(expectedHostname: string, hostname: unknown, value: unknown): boolean {
  if (hostname !== expectedHostname || typeof value !== "object" || value === null ||
      Array.isArray(value) || utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== 2 || !("family" in descriptors) || !("hints" in descriptors)) return false;
  const family = descriptors.family;
  const hints = descriptors.hints;
  return "value" in family && family.enumerable === true && family.value === 4 &&
    "value" in hints && hints.enumerable === true && hints.value === 0;
}

type M4PhaseSocket = {
  on(event: "connect" | "secureConnect" | "error", listener: (...args: unknown[]) => void): unknown;
};
type M4PhaseRequest = M4RequestLike & {
  on(event: "socket", listener: (socket: M4PhaseSocket) => void): unknown;
};

function parseSecContentType(value: string, expected: SecLiveContentType): SecLiveContentType | undefined {
  if (expected === "application/json") return parseM4ContentType(value);
  const parts = value.split(";");
  if (parts.length < 1 || parts.length > 2 || parts[0]?.trim().toLowerCase() !== "text/html") return undefined;
  if (parts.length === 2 && !/^\s*charset\s*=\s*utf-8\s*$/iu.test(parts[1] ?? "")) return undefined;
  return "text/html";
}

async function acquireSecLive(
  target: Readonly<SecLiveTarget>,
  userAgent: unknown,
  injected?: M4LiveDependencies,
): Promise<SecLiveResult> {
  const audit = validateM4SecUserAgent(userAgent);
  const mutable = { dnsAttempts: 0 as 0 | 1, requestAttempts: 0 as 0 | 1, connectionAttempts: 0 as 0 | 1,
    liveNetworkEgress: 0 as 0 | 1, bytesReceived: 0, selectedAddress: null as string | null,
    lookupCallbacks: 0 as 0 | 1, retryCount: 0 as const, responseSha256: null as string | null,
    failurePhase: null as M4FailurePhase | null, userAgentAudit: audit };
  const telemetry = (): M4LiveTelemetry => Object.freeze({ ...mutable });
  if (!audit) return Object.freeze({ ok: false, refusalCode: "user_agent_refused", telemetry: telemetry() });
  const configuredUserAgent = userAgent as string;

  const dependencies = injected ?? createNodeM4LiveDependencies();
  const resolver = dependencies.createResolver();
  let request: M4RequestLike | undefined; let response: M4ResponseLike | undefined; let settled = false;
  let finish!: (result: SecLiveResult) => void;
  const result = new Promise<SecLiveResult>((resolve) => { finish = resolve; });
  const dispose = (error?: Error) => {
    try { resolver.cancel(); } catch { /* deterministic best effort */ }
    try { response?.destroy(error); } catch { /* deterministic best effort */ }
    try { response?.socket.destroy(error); } catch { /* deterministic best effort */ }
    try { request?.destroy(error); } catch { /* deterministic best effort */ }
  };
  let deadline: unknown;
  const settle = (value: SecLiveCoreResult) => {
    if (settled) return; settled = true; dependencies.clearDeadline(deadline); dispose();
    finish(Object.freeze({ ...value, telemetry: telemetry() }) as SecLiveResult);
  };
  const refuse = (refusalCode: M4FetchRefusalCode, failurePhase: M4FailurePhase) => {
    if (!settled) mutable.failurePhase = failurePhase;
    settle({ ok: false, refusalCode });
  };
  deadline = dependencies.setDeadline(() => refuse("timeout_or_cancelled", "response_body_or_deadline"),
    target.maxDurationMs);
  if (settled) return result;

  mutable.dnsAttempts = 1;
  void resolver.resolve4(target.hostname).then((rawAddresses) => {
    if (settled) return;
    const addresses = snapshotDnsAddresses(rawAddresses);
    if (addresses === null || addresses.some((address) => isIP(address) !== target.addressFamily)) {
      refuse("dns_refused", "lookup_contract"); return;
    }
    if (addresses.some((address) => !isPublicAddress(address))) {
      refuse("non_public_address_refused", "lookup_contract"); return;
    }
    const selected = [...new Set(addresses)].sort(compareIpv4)[0];
    if (!selected) { refuse("dns_refused", "lookup_contract"); return; }
    mutable.selectedAddress = selected; mutable.requestAttempts = 1;
    let lookupUsed = false;
    let currentPhase: M4FailurePhase = "request_construction";
    const parsedTarget = new URL(target.url);
    const options: M4NodeRequestOptions = Object.freeze({
      protocol: "https:", hostname: target.hostname, port: 443,
      path: `${parsedTarget.pathname}${parsedTarget.search}`, method: "GET", servername: target.hostname,
      family: 4, autoSelectFamily: false, agent: false,
      headers: Object.freeze({ "User-Agent": configuredUserAgent, Accept: target.contentType, "Accept-Encoding": "identity" }),
      lookup: ((lookupHostname: string, lookupOptions: unknown,
        callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        if (lookupUsed) { refuse("transport_refused", "lookup_contract"); return; }
        lookupUsed = true; mutable.lookupCallbacks = 1;
        if (!validLookupInvocation(target.hostname, lookupHostname, lookupOptions)) {
          refuse("transport_refused", "lookup_contract"); return;
        }
        callback(null, selected, 4);
      }) as RequestOptions["lookup"],
    });
    try {
      request = dependencies.request(options, (incoming) => {
        if (settled) { incoming.destroy(); return; }
        currentPhase = "response_headers";
        response = incoming;
        if (incoming.socket.remoteAddress !== selected) { refuse("connected_address_mismatch", currentPhase); return; }
        const status = incoming.statusCode;
        const location = incoming.headers.location;
        if (location !== undefined || status === undefined || (status >= 300 && status < 400)) {
          refuse("redirect_refused", currentPhase); return;
        }
        if (status < 200 || status > 299) { refuse("http_status_refused", currentPhase); return; }
        if (target.requiredStatus !== null && status !== target.requiredStatus) {
          refuse("http_status_refused", currentPhase); return;
        }
        const rawContentType = incoming.headers["content-type"];
        if (typeof rawContentType !== "string" || !parseSecContentType(rawContentType, target.contentType)) {
          refuse("mime_refused", currentPhase); return;
        }
        const contentEncoding = incoming.headers["content-encoding"];
        if (contentEncoding !== undefined && (typeof contentEncoding !== "string" || contentEncoding.toLowerCase() !== "identity")) {
          refuse("transport_refused", currentPhase); return;
        }
        currentPhase = "response_body_or_deadline";
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk) => {
          if (settled) return;
          if (!(typeof chunk === "string" || ArrayBuffer.isView(chunk))) { refuse("transport_refused", currentPhase); return; }
          const bytes = Buffer.from(chunk as string | Uint8Array);
          mutable.bytesReceived += bytes.byteLength;
          if (mutable.bytesReceived > target.maxBodyBytes) {
            refuse("body_limit_refused", currentPhase); return;
          }
          chunks.push(bytes);
        });
        incoming.on("error", () => refuse("transport_refused", currentPhase));
        incoming.on("end", () => {
          if (settled) return; const body = Buffer.concat(chunks);
          mutable.responseSha256 = createHash("sha256").update(body).digest("hex");
          settle({ ok: true, bodyBase64: body.toString("base64"), responseSha256: mutable.responseSha256,
            contentType: target.contentType, status });
        });
      });
      if (settled) { request.destroy(); return; }
      currentPhase = "tcp_connection";
      const phaseRequest = request as M4PhaseRequest;
      phaseRequest.on("socket", (socket) => {
        if (settled) return;
        currentPhase = "tcp_connection";
        socket.on("connect", () => { if (!settled) currentPhase = "tls_handshake"; });
        socket.on("secureConnect", () => { if (!settled) currentPhase = "response_headers"; });
        socket.on("error", () => refuse("transport_refused", currentPhase));
      });
      request.on("error", () => refuse("transport_refused", currentPhase));
      mutable.connectionAttempts = 1; mutable.liveNetworkEgress = 1;
      request.end();
    } catch { refuse("transport_refused", currentPhase); }
  }).catch(() => refuse("dns_refused", "lookup_contract"));
  return result;
}

/** One fixed historical M4 SEC identity; behavior and caller surface remain unchanged. */
export async function acquireM4SecLive(userAgent: unknown, injected?: M4LiveDependencies): Promise<M4LiveResult> {
  return acquireSecLive(M4_SEC_LIVE_TARGET, userAgent, injected) as Promise<M4LiveResult>;
}

export const M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID = "exact_sec_archive_acquisition_v1" as const;
export const M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID =
  "repository_native_m4_sec_live_adapter_exact_target_core_v1" as const;
export const M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256 = createHash("sha256")
  .update(M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID, "utf8").digest("hex");
export const M5B_EXACT_SEC_ARCHIVE_SOURCE_ID = "src_sec_archive_primary_document" as const;

export interface M5bExactSecArchiveCustody {
  readonly kind: "m5b-exact-sec-archive-custody";
  readonly schemaVersion: "1";
  readonly targetPolicy: Readonly<ExactSecArchiveTargetPolicy>;
  readonly targetPolicySha256: string;
  readonly adapter: {
    readonly capabilityId: typeof M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID;
    readonly adapterId: typeof M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID;
    readonly adapterSha256: string;
  };
  readonly activation: {
    readonly operation: "exact_sec_archive_acquisition";
    readonly authorityId: string;
    readonly consumptionId: string;
    readonly ledgerRootSha256: string;
    readonly implementationCommit: string;
    readonly implementationTree: string;
    readonly targetPolicySha256: string;
    readonly sourceIdentities: M5bProductEffectConsumption["sourceIdentities"];
    readonly authorizedAt: string;
    readonly validFrom: string;
    readonly validUntil: string;
    readonly consumedAt: string;
    readonly ledgerNamespaceSha256: string;
    readonly ledgerRecordSha256: string;
    readonly goCanonicalSha256: string;
  };
  readonly acquiredAt: string;
  readonly acquisition: {
    readonly requestedTargetRef: string;
    readonly requestedUrl: string;
    readonly finalUrl: string;
    readonly sourceHost: "www.sec.gov";
    readonly publisher: "U.S. Securities and Exchange Commission";
    readonly method: "GET";
    readonly httpStatus: number;
    readonly contentType: "text/html";
    readonly contentEncoding: "identity";
    readonly byteCount: number;
    readonly responseSha256: string;
    readonly bodyBase64: string;
    readonly quotedBodyText: string;
    readonly custody: {
      readonly exactBytesPreserved: true;
      readonly exactBytesEncoding: "base64";
      readonly hashAlgorithm: "sha256";
      readonly classification: "untrusted_public_source";
    };
  };
  readonly trust: ExactSecArchiveTargetPolicy["contentTrust"];
  readonly effectAccounting: {
    readonly dnsAttempts: 1;
    readonly requestAttempts: 1;
    readonly connectionAttempts: 1;
    readonly lookupCallbacks: 1;
    readonly redirects: 0;
    readonly retries: 0;
    readonly networkRequests: 1;
    readonly bytesReceived: number;
    readonly responseSha256: string;
    readonly selectedAddress: string;
    readonly connectedAddress: string;
    readonly publicAddressValidated: true;
    readonly pinnedConnectionMatched: true;
  };
}

export type M5bExactSecArchiveAcquisitionResult =
  | {
      readonly ok: true;
      readonly custody: Readonly<M5bExactSecArchiveCustody>;
      readonly custodyBytesBase64: string;
      readonly outerCustodySha256: string;
      readonly responseBytes: number;
      readonly responseSha256: string;
      readonly telemetry: M4LiveTelemetry;
    }
  | { readonly ok: false; readonly refusalCode: M4FetchRefusalCode; readonly telemetry: M4LiveTelemetry };

function exactSecArchiveLiveTarget(policy: Readonly<ExactSecArchiveTargetPolicy>): SecLiveTarget {
  return Object.freeze({
    url: policy.url,
    hostname: policy.hostname,
    maxDurationMs: policy.network.maxDurationMs,
    maxBodyBytes: policy.network.maxBodyBytes,
    addressFamily: 4,
    contentType: "text/html",
    requiredStatus: 200,
  });
}

function assertExactArchiveConsumption(
  value: Readonly<M5bProductEffectConsumption>,
  policy: Readonly<ExactSecArchiveTargetPolicy>,
  targetPolicySha256: string,
): Readonly<M5bProductEffectConsumption> {
  const expectedIdentity = value.sourceIdentities[0];
  if (value.targetPolicySha256 !== targetPolicySha256 ||
      value.sourceIdentities.length !== 1 || expectedIdentity?.sourceId !== M5B_EXACT_SEC_ARCHIVE_SOURCE_ID ||
      expectedIdentity.canonicalUrl !== policy.url ||
      expectedIdentity.targetPolicySha256 !== targetPolicySha256 ||
      expectedIdentity.outerSha256 !== null || expectedIdentity.outerByteSize !== null ||
      expectedIdentity.decodedSha256 !== null || expectedIdentity.decodedByteSize !== null) {
    throw new Error("Exact SEC archive acquisition authority binding refused");
  }
  return value;
}

function strictUtf8(value: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return null;
  }
}

/**
 * The only generic exact-archive live entrypoint. It consumes and re-checks an opaque one-shot authority
 * before an injected or Node DNS/HTTPS dependency can be constructed.
 */
export async function acquireM5bExactSecArchive(
  attempt: Readonly<M5bProductEffectAttempt>,
  rawTargetPolicy: unknown,
  userAgent: unknown,
  nowIso: () => unknown,
  injected?: M4LiveDependencies,
): Promise<M5bExactSecArchiveAcquisitionResult> {
  const targetPolicy = validateExactSecArchiveTargetPolicy(rawTargetPolicy);
  const targetPolicySha256 = exactSecArchiveTargetPolicySha256(targetPolicy);
  const consumption = assertExactArchiveConsumption(claimM5bProductEffectAttempt(
    attempt, "exact_sec_archive_acquisition"), targetPolicy, targetPolicySha256);
  assertM5bProductEffectConsumptionIntact(consumption, "exact_sec_archive_acquisition");
  const result = await acquireSecLive(exactSecArchiveLiveTarget(targetPolicy), userAgent, injected);
  if (!result.ok) return result;
  const response = Buffer.from(result.bodyBase64, "base64");
  const quotedBodyText = strictUtf8(response);
  let acquiredAt: unknown;
  try {
    acquiredAt = nowIso();
  } catch {
    acquiredAt = null;
  }
  if (quotedBodyText === null || !isStrictIsoTimestamp(acquiredAt) || result.status !== 200 ||
      result.telemetry.dnsAttempts !== 1 || result.telemetry.requestAttempts !== 1 ||
      result.telemetry.connectionAttempts !== 1 || result.telemetry.lookupCallbacks !== 1 ||
      result.telemetry.liveNetworkEgress !== 1 || result.telemetry.retryCount !== 0 ||
      result.telemetry.failurePhase !== null || result.telemetry.responseSha256 !== result.responseSha256 ||
      response.toString("base64") !== result.bodyBase64 ||
      response.byteLength !== result.telemetry.bytesReceived ||
      createHash("sha256").update(response).digest("hex") !== result.responseSha256) {
    return Object.freeze({ ok: false, refusalCode: "transport_refused" as const, telemetry: result.telemetry });
  }
  const custody: M5bExactSecArchiveCustody = Object.freeze({
    kind: "m5b-exact-sec-archive-custody",
    schemaVersion: "1",
    targetPolicy,
    targetPolicySha256,
    adapter: Object.freeze({ capabilityId: M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID,
      adapterId: M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID,
      adapterSha256: M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256 }),
    activation: Object.freeze({
      operation: "exact_sec_archive_acquisition",
      authorityId: consumption.authorityId,
      consumptionId: consumption.consumptionId,
      ledgerRootSha256: consumption.ledgerRootSha256,
      implementationCommit: consumption.implementationCommit,
      implementationTree: consumption.implementationTree,
      targetPolicySha256: consumption.targetPolicySha256,
      sourceIdentities: consumption.sourceIdentities,
      authorizedAt: consumption.authorizedAt,
      validFrom: consumption.validFrom,
      validUntil: consumption.validUntil,
      consumedAt: consumption.consumedAt,
      ledgerNamespaceSha256: consumption.ledgerNamespaceSha256,
      ledgerRecordSha256: consumption.ledgerRecordSha256,
      goCanonicalSha256: consumption.goCanonicalSha256,
    }),
    acquiredAt,
    acquisition: Object.freeze({
      requestedTargetRef: targetPolicy.targetRef,
      requestedUrl: targetPolicy.url,
      finalUrl: targetPolicy.url,
      sourceHost: targetPolicy.hostname,
      publisher: targetPolicy.publisher,
      method: "GET",
      httpStatus: result.status,
      contentType: "text/html",
      contentEncoding: "identity",
      byteCount: response.byteLength,
      responseSha256: result.responseSha256,
      bodyBase64: result.bodyBase64,
      quotedBodyText,
      custody: Object.freeze({ exactBytesPreserved: true, exactBytesEncoding: "base64", hashAlgorithm: "sha256",
        classification: "untrusted_public_source" }),
    }),
    trust: targetPolicy.contentTrust,
    effectAccounting: Object.freeze({
      dnsAttempts: 1,
      requestAttempts: 1,
      connectionAttempts: 1,
      lookupCallbacks: 1,
      redirects: 0,
      retries: 0,
      networkRequests: 1,
      bytesReceived: response.byteLength,
      responseSha256: result.responseSha256,
      selectedAddress: result.telemetry.selectedAddress!,
      connectedAddress: result.telemetry.selectedAddress!,
      publicAddressValidated: true,
      pinnedConnectionMatched: true,
    }),
  });
  const custodyBytes = Buffer.from(`${JSON.stringify(custody, null, 2)}\n`, "utf8");
  return Object.freeze({
    ok: true,
    custody,
    custodyBytesBase64: custodyBytes.toString("base64"),
    outerCustodySha256: createHash("sha256").update(custodyBytes).digest("hex"),
    responseBytes: response.byteLength,
    responseSha256: result.responseSha256,
    telemetry: result.telemetry,
  });
}

export const M4_LIVE_ADAPTER_POLICY_SHA256 = M4_TARGET_POLICY_SHA256;
