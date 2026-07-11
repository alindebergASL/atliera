import { createHash } from "node:crypto";
import { BlockList, isIP } from "node:net";
import { types as utilTypes } from "node:util";

export const M4_TARGET_REF = "fedex_company_overview" as const;
export const M4_TARGET_URL =
  "https://investors.fedex.com/company-overview/overview-of-company/default.aspx" as const;
export const M4_SOURCE_HOST = "investors.fedex.com" as const;
export const M4_PUBLISHER = "FedEx Corporation" as const;
export const M4_ALLOWLIST_REF =
  "src/capability/public-http-fetch-policy.ts#M4_RATIFIED_TARGET_ALLOWLIST" as const;
export const M4_MAX_BODY_BYTES = 1_048_576 as const;
export const M4_MAX_DURATION_MS = 10_000 as const;

export interface M4ResolvedAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

export interface M4DnsResolver {
  resolve(hostname: string, signal: AbortSignal): Promise<readonly M4ResolvedAddress[]>;
}

export interface M4HttpRequest {
  readonly url: string;
  readonly hostname: string;
  readonly validatedAddresses: readonly M4ResolvedAddress[];
  readonly signal: AbortSignal;
  readonly headers: Readonly<{
    "user-agent": "Atliera-public-http-fetch-v1/1.0";
    accept: "text/html, text/plain";
  }>;
  readonly redirectLimit: 0;
  readonly retryBudget: 0;
  readonly maxBodyBytes: typeof M4_MAX_BODY_BYTES;
}

export interface M4HttpResponse {
  readonly status: number;
  readonly headers: Readonly<{
    readonly "content-type": string | undefined;
    readonly location: string | undefined;
  }>;
  readonly connectedAddress: string;
  readonly finalUrl: string;
  readonly body: AsyncIterable<Uint8Array>;
}

export interface M4HttpTransport {
  request(request: M4HttpRequest): Promise<M4HttpResponse>;
}

export type M4FetchRefusalCode =
  | "target_ref_refused"
  | "url_policy_refused"
  | "hostname_refused"
  | "dns_refused"
  | "non_public_address_refused"
  | "connected_address_mismatch"
  | "redirect_refused"
  | "http_status_refused"
  | "mime_refused"
  | "body_limit_refused"
  | "timeout_or_cancelled"
  | "transport_refused";

export interface M4PublicEvidence {
  readonly requestedTargetRef: typeof M4_TARGET_REF;
  readonly requestedUrl: typeof M4_TARGET_URL;
  readonly finalUrl: typeof M4_TARGET_URL;
  readonly sourceHost: typeof M4_SOURCE_HOST;
  readonly publisher: typeof M4_PUBLISHER;
  readonly fetchedAt: string;
  readonly httpStatus: number;
  readonly contentType: "text/html" | "text/plain";
  readonly byteCount: number;
  readonly responseSha256: string;
  /** Canonical base64 of the exact fetched bytes. */
  readonly bodyBase64: string;
  /** Best-effort UTF-8 display only; always quoted untrusted source content. */
  readonly quotedBodyText: string;
  readonly trust: {
    readonly status: "quoted_untrusted_public_source_content";
    readonly mayProvideInstructions: false;
    readonly controlAuthority: "none";
  };
  readonly provenance: {
    readonly acquisitionCapability: "public_http_fetch_v1";
    readonly transport: "recorded_injected";
    readonly targetAllowlistRef: typeof M4_ALLOWLIST_REF;
    readonly resolvedAddresses: readonly string[];
    readonly connectedAddress: string;
  };
  readonly custody: {
    readonly exactBytesPreserved: true;
    readonly exactBytesEncoding: "base64";
    readonly hashAlgorithm: "sha256";
    readonly classification: "public_evidence";
  };
}

export type M4AcquisitionResult =
  | { readonly ok: true; readonly evidence: M4PublicEvidence }
  | { readonly ok: false; readonly refusalCode: M4FetchRefusalCode };

export const M4_RATIFIED_TARGET_ALLOWLIST = Object.freeze({
  [M4_TARGET_REF]: Object.freeze({
    url: M4_TARGET_URL,
    hostname: M4_SOURCE_HOST,
    publisher: M4_PUBLISHER,
  }),
});

const deniedV4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.31.196.0", 24], ["192.52.193.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["192.175.48.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) deniedV4.addSubnet(network, prefix, "ipv4");
const deniedV6 = new BlockList();
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10],
  ["ff00::", 8],
] as const) deniedV6.addSubnet(network, prefix, "ipv6");

export function isPublicAddress(value: string): boolean {
  const family = isIP(value);
  if (family === 4) return !deniedV4.check(value, "ipv4");
  if (family === 6) return /^[23]/.test(value.toLowerCase()) && !deniedV6.check(value, "ipv6");
  return false;
}

export function isStrictIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

function refusal(refusalCode: M4FetchRefusalCode): M4AcquisitionResult {
  return Object.freeze({ ok: false, refusalCode });
}

function exactData(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value)) {
    throw new Error("unsafe seam data");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("unsafe seam data");
  if (Object.getOwnPropertySymbols(value).length !== 0) throw new Error("unsafe seam data");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new Error("unsafe seam data");
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new Error("unsafe seam data");
    }
    output[key] = descriptor.value;
  }
  return output;
}

function denseArray(value: unknown, maxLength: number): readonly unknown[] {
  if (!Array.isArray(value) || utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0) throw new Error("unsafe seam array");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maxLength || lengthDescriptor.enumerable !== false) throw new Error("unsafe seam array");
  const length = lengthDescriptor.value as number;
  if (Object.getOwnPropertyNames(value).length !== length + 1) throw new Error("unsafe seam array");
  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new Error("unsafe seam array");
    }
    output.push(descriptor.value);
  }
  return Object.freeze(output);
}

class NonPublicAddressError extends Error {}

function snapshotDnsAnswers(value: unknown): readonly M4ResolvedAddress[] {
  const items = denseArray(value, 16);
  if (items.length === 0) throw new Error("empty DNS answer");
  const output: M4ResolvedAddress[] = [];
  for (const item of items) {
    const answer = exactData(item, ["address", "family"]);
    if (typeof answer.address !== "string" || (answer.family !== 4 && answer.family !== 6)) {
      throw new Error("malformed DNS answer");
    }
    const address = answer.address.toLowerCase();
    if (isIP(address) !== answer.family) throw new Error("malformed DNS answer");
    if (!isPublicAddress(address)) throw new NonPublicAddressError("non-public DNS answer");
    output.push(Object.freeze({ address, family: answer.family }));
  }
  return Object.freeze(output);
}

function snapshotHttpResponse(value: unknown): M4HttpResponse {
  const root = exactData(value, ["status", "headers", "connectedAddress", "finalUrl", "body"]);
  const headers = exactData(root.headers, ["content-type", "location"]);
  if (!Number.isSafeInteger(root.status) || (typeof headers["content-type"] !== "string" && headers["content-type"] !== undefined) ||
      (typeof headers.location !== "string" && headers.location !== undefined) ||
      typeof root.connectedAddress !== "string" || typeof root.finalUrl !== "string" ||
      (typeof root.body !== "object" && typeof root.body !== "function") || root.body === null ||
      utilTypes.isProxy(root.body)) {
    throw new Error("malformed HTTP response");
  }
  return Object.freeze({
    status: root.status as number,
    headers: Object.freeze({
      "content-type": headers["content-type"] as string | undefined,
      location: headers.location as string | undefined,
    }),
    connectedAddress: root.connectedAddress,
    finalUrl: root.finalUrl,
    body: root.body as AsyncIterable<Uint8Array>,
  });
}

function strictContentType(value: string | undefined): "text/html" | "text/plain" | undefined {
  if (value === undefined) return undefined;
  const match = /^(text\/html|text\/plain)(?:\s*;\s*charset\s*=\s*(?:"(utf-8|utf8|us-ascii)"|(utf-8|utf8|us-ascii)))?\s*$/i.exec(value);
  if (match === null) return undefined;
  return match[1]!.toLowerCase() as "text/html" | "text/plain";
}

export function validateM4PublicTargetUrl(url: string, expectedHostname: string): M4FetchRefusalCode | null {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "url_policy_refused"; }
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" ||
      (parsed.port !== "" && parsed.port !== "443")) return "url_policy_refused";
  if (parsed.hostname !== expectedHostname || isIP(parsed.hostname) !== 0 || parsed.hostname.length > 253 ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(parsed.hostname)) {
    return "hostname_refused";
  }
  return null;
}

export async function acquireM4PublicEvidence(
  targetRef: unknown,
  dependencies: Readonly<{
    dns: M4DnsResolver;
    http: M4HttpTransport;
    fetchedAt: string;
    transportKind: "recorded_injected";
  }>,
  signal: AbortSignal,
): Promise<M4AcquisitionResult> {
  if (targetRef !== M4_TARGET_REF) return refusal("target_ref_refused");
  if (!isStrictIsoTimestamp(dependencies.fetchedAt)) return refusal("transport_refused");
  const urlRefusal = validateM4PublicTargetUrl(M4_TARGET_URL, M4_SOURCE_HOST);
  if (urlRefusal !== null) return refusal(urlRefusal);
  if (signal.aborted) return refusal("timeout_or_cancelled");

  let addresses: readonly M4ResolvedAddress[];
  try {
    const candidate = await dependencies.dns.resolve(M4_SOURCE_HOST, signal);
    if (signal.aborted) return refusal("timeout_or_cancelled");
    addresses = snapshotDnsAnswers(candidate);
  } catch (error) {
    if (error instanceof NonPublicAddressError) return refusal("non_public_address_refused");
    return refusal(signal.aborted ? "timeout_or_cancelled" : "dns_refused");
  }
  if (signal.aborted) return refusal("timeout_or_cancelled");

  let response: M4HttpResponse;
  try {
    const candidate = await dependencies.http.request(Object.freeze({
      url: M4_TARGET_URL,
      hostname: M4_SOURCE_HOST,
      validatedAddresses: addresses,
      signal,
      headers: Object.freeze({
        "user-agent": "Atliera-public-http-fetch-v1/1.0",
        accept: "text/html, text/plain",
      }),
      redirectLimit: 0,
      retryBudget: 0,
      maxBodyBytes: M4_MAX_BODY_BYTES,
    }));
    if (signal.aborted) return refusal("timeout_or_cancelled");
    response = snapshotHttpResponse(candidate);
  } catch {
    return refusal(signal.aborted ? "timeout_or_cancelled" : "transport_refused");
  }

  const connectedAddress = response.connectedAddress.toLowerCase();
  if (!isPublicAddress(connectedAddress) || !addresses.some((entry) => entry.address === connectedAddress)) {
    return refusal("connected_address_mismatch");
  }
  if (response.finalUrl !== M4_TARGET_URL || response.headers.location !== undefined ||
      (response.status >= 300 && response.status < 400)) return refusal("redirect_refused");
  if (response.status < 200 || response.status > 299) return refusal("http_status_refused");
  const contentType = strictContentType(response.headers["content-type"]);
  if (contentType === undefined) return refusal("mime_refused");

  const chunks: Buffer[] = [];
  let byteCount = 0;
  try {
    if (signal.aborted) return refusal("timeout_or_cancelled");
    for await (const chunk of response.body) {
      if (signal.aborted) return refusal("timeout_or_cancelled");
      if (!(chunk instanceof Uint8Array)) return refusal("transport_refused");
      const nextByteCount = byteCount + chunk.byteLength;
      if (!Number.isSafeInteger(nextByteCount) || nextByteCount > M4_MAX_BODY_BYTES) {
        return refusal("body_limit_refused");
      }
      byteCount = nextByteCount;
      chunks.push(Buffer.from(chunk));
    }
  } catch {
    return refusal(signal.aborted ? "timeout_or_cancelled" : "transport_refused");
  }
  const exactBytes = Buffer.concat(chunks, byteCount);
  const evidence: M4PublicEvidence = Object.freeze({
    requestedTargetRef: M4_TARGET_REF,
    requestedUrl: M4_TARGET_URL,
    finalUrl: M4_TARGET_URL,
    sourceHost: M4_SOURCE_HOST,
    publisher: M4_PUBLISHER,
    fetchedAt: dependencies.fetchedAt,
    httpStatus: response.status,
    contentType,
    byteCount,
    responseSha256: createHash("sha256").update(exactBytes).digest("hex"),
    bodyBase64: exactBytes.toString("base64"),
    quotedBodyText: exactBytes.toString("utf8"),
    trust: Object.freeze({
      status: "quoted_untrusted_public_source_content",
      mayProvideInstructions: false,
      controlAuthority: "none",
    }),
    provenance: Object.freeze({
      acquisitionCapability: "public_http_fetch_v1",
      transport: dependencies.transportKind,
      targetAllowlistRef: M4_ALLOWLIST_REF,
      resolvedAddresses: Object.freeze(addresses.map((entry) => entry.address)),
      connectedAddress,
    }),
    custody: Object.freeze({
      exactBytesPreserved: true,
      exactBytesEncoding: "base64",
      hashAlgorithm: "sha256",
      classification: "public_evidence",
    }),
  });
  return Object.freeze({ ok: true, evidence });
}
