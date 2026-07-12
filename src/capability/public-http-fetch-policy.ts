import { createHash } from "node:crypto";
import { BlockList, isIP } from "node:net";
import { types as utilTypes } from "node:util";

import {
  M4_CANONICAL_TARGET_POLICY,
  M4_TARGET_POLICY_REF,
  M4_TARGET_POLICY_SHA256,
} from "./m4-target-policy.ts";

export const M4_TARGET_REF = M4_CANONICAL_TARGET_POLICY.targetRef;
export const M4_TARGET_URL = M4_CANONICAL_TARGET_POLICY.url;
export const M4_SOURCE_HOST = M4_CANONICAL_TARGET_POLICY.hostname;
export const M4_PUBLISHER = M4_CANONICAL_TARGET_POLICY.publisher;
export const M4_ALLOWLIST_REF = M4_TARGET_POLICY_REF;
export const M4_MAX_BODY_BYTES = M4_CANONICAL_TARGET_POLICY.network.maxBodyBytes;
export const M4_MAX_DURATION_MS = M4_CANONICAL_TARGET_POLICY.network.maxDurationMs;

export type M4FetchRefusalCode = "target_ref_refused" | "url_policy_refused" | "hostname_refused" |
  "dns_refused" | "non_public_address_refused" | "connected_address_mismatch" | "redirect_refused" |
  "http_status_refused" | "mime_refused" | "body_limit_refused" | "timeout_or_cancelled" | "transport_refused";

export interface M4PublicEvidence {
  readonly requestedTargetRef: typeof M4_TARGET_REF;
  readonly requestedUrl: typeof M4_TARGET_URL;
  readonly finalUrl: typeof M4_TARGET_URL;
  readonly sourceHost: typeof M4_SOURCE_HOST;
  readonly publisher: typeof M4_PUBLISHER;
  readonly targetPolicySha256: typeof M4_TARGET_POLICY_SHA256;
  readonly fetchedAt: string;
  readonly httpStatus: number;
  readonly contentType: "text/html" | "text/plain";
  readonly byteCount: number;
  readonly responseSha256: string;
  readonly bodyBase64: string;
  readonly quotedBodyText: string;
  readonly trust: typeof M4_CANONICAL_TARGET_POLICY.contentTrust;
  readonly provenance: {
    readonly acquisitionCapability: "public_http_fetch_v1";
    readonly transport: "recorded_inert_exchange";
    readonly targetPolicyRef: typeof M4_TARGET_POLICY_REF;
    readonly targetPolicySha256: typeof M4_TARGET_POLICY_SHA256;
    readonly resolvedAddresses: readonly string[];
    readonly connectedAddress: string;
  };
  readonly custody: { readonly exactBytesPreserved: true; readonly exactBytesEncoding: "base64";
    readonly hashAlgorithm: "sha256"; readonly classification: "public_evidence" };
}

export type M4AcquisitionResult = { readonly ok: true; readonly evidence: M4PublicEvidence } |
  { readonly ok: false; readonly refusalCode: M4FetchRefusalCode };

export const M4_RATIFIED_TARGET_ALLOWLIST = Object.freeze({
  [M4_TARGET_REF]: Object.freeze({ url: M4_TARGET_URL, hostname: M4_SOURCE_HOST, publisher: M4_PUBLISHER,
    targetPolicySha256: M4_TARGET_POLICY_SHA256 }),
});

function blockListFromCidrs(cidrs: readonly string[], family: "ipv4" | "ipv6"): BlockList {
  const blockList = new BlockList();
  for (const cidr of cidrs) {
    const separator = cidr.lastIndexOf("/");
    const network = cidr.slice(0, separator);
    const prefix = Number(cidr.slice(separator + 1));
    if (separator <= 0 || !Number.isSafeInteger(prefix)) throw new Error("invalid canonical address policy CIDR");
    blockList.addSubnet(network, prefix, family);
  }
  return blockList;
}

const allowedV4 = blockListFromCidrs(M4_CANONICAL_TARGET_POLICY.addressPolicy.allowedCidrs.ipv4, "ipv4");
const allowedV6 = blockListFromCidrs(M4_CANONICAL_TARGET_POLICY.addressPolicy.allowedCidrs.ipv6, "ipv6");
const deniedV4 = blockListFromCidrs(M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv4, "ipv4");
const deniedV6 = blockListFromCidrs(M4_CANONICAL_TARGET_POLICY.addressPolicy.deniedCidrs.ipv6, "ipv6");

export function isPublicAddress(value: string): boolean {
  const rule = M4_CANONICAL_TARGET_POLICY.addressPolicy.classificationRule;
  const normalized = rule.normalizeBeforeClassification === "lowercase" ? value.toLowerCase() : value;
  const family = isIP(normalized);
  if (rule.decision === "accept_iff_family_allow_cidr_matches_and_no_family_deny_cidr_matches") {
    if (family === 4) return allowedV4.check(normalized, "ipv4") && !deniedV4.check(normalized, "ipv4");
    if (family === 6) return allowedV6.check(normalized, "ipv6") && !deniedV6.check(normalized, "ipv6");
  }
  if (rule.invalidIp === "deny") return false;
  throw new Error("unsupported canonical address classification rule");
}

export function isStrictIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || utilTypes.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length) {
    throw new Error("unsafe recorded exchange");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.keys(descriptors).length !== keys.length) throw new Error("unsafe recorded exchange");
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("unsafe recorded exchange");
    out[key] = descriptor.value;
  }
  return out;
}

function denseSingleAddress(value: unknown): readonly string[] {
  if (!Array.isArray(value) || utilTypes.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      Object.getOwnPropertyNames(value).length !== value.length + 1 || value.length !== 1) {
    throw new Error("unsafe recorded exchange");
  }
  const out: string[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" || !descriptor.enumerable) {
      throw new Error("unsafe recorded exchange");
    }
    out.push(descriptor.value.toLowerCase());
  }
  return Object.freeze(out);
}

export interface M4ProofRecordedExchange {
  readonly fetchedAt: string;
  readonly resolvedAddresses: readonly string[];
  readonly status: number;
  readonly contentType: string;
  readonly location: string | null;
  readonly connectedAddress: string;
  readonly finalUrl: string;
  readonly bodyBase64: string;
  readonly cancelAt: "none" | "before_dns" | "after_dns" | "during_body";
}

export function snapshotM4ProofRecordedExchange(value: unknown): Readonly<M4ProofRecordedExchange> {
  const root = exact(value, ["fetchedAt", "resolvedAddresses", "status", "contentType", "location",
    "connectedAddress", "finalUrl", "bodyBase64", "cancelAt"]);
  const addresses = denseSingleAddress(root.resolvedAddresses);
  if (!isStrictIsoTimestamp(root.fetchedAt) || !Number.isSafeInteger(root.status) || typeof root.contentType !== "string" ||
      (typeof root.location !== "string" && root.location !== null) || typeof root.connectedAddress !== "string" ||
      typeof root.finalUrl !== "string" || typeof root.bodyBase64 !== "string" ||
      !["none", "before_dns", "after_dns", "during_body"].includes(root.cancelAt as string)) {
    throw new Error("unsafe recorded exchange");
  }
  return Object.freeze({ fetchedAt: root.fetchedAt, resolvedAddresses: addresses, status: root.status as number,
    contentType: root.contentType, location: root.location as string | null,
    connectedAddress: root.connectedAddress.toLowerCase(), finalUrl: root.finalUrl, bodyBase64: root.bodyBase64,
    cancelAt: root.cancelAt as M4ProofRecordedExchange["cancelAt"] });
}

function refusal(refusalCode: M4FetchRefusalCode): M4AcquisitionResult { return Object.freeze({ ok: false, refusalCode }); }
function contentType(value: string): "text/html" | "text/plain" | undefined {
  const match = /^(text\/html|text\/plain)(?:\s*;\s*charset\s*=\s*(?:"(utf-8|utf8|us-ascii)"|(utf-8|utf8|us-ascii)))?\s*$/i.exec(value);
  return match?.[1]?.toLowerCase() as "text/html" | "text/plain" | undefined;
}

/** Proof/test-only: consumes already snapshotted inert bytes and performs no DNS, HTTP, or other effect. */
export function acquireM4ProofRecordedEvidence(targetRef: unknown, value: unknown): M4AcquisitionResult {
  const exchange = snapshotM4ProofRecordedExchange(value);
  if (targetRef !== M4_TARGET_REF) return refusal("target_ref_refused");
  if (exchange.cancelAt === "before_dns" || exchange.cancelAt === "after_dns") return refusal("timeout_or_cancelled");
  if (exchange.resolvedAddresses.some((address) => isIP(address) === 0)) return refusal("dns_refused");
  if (exchange.resolvedAddresses.some((address) => !isPublicAddress(address))) return refusal("non_public_address_refused");
  if (!isPublicAddress(exchange.connectedAddress) || !exchange.resolvedAddresses.includes(exchange.connectedAddress)) {
    return refusal("connected_address_mismatch");
  }
  if (exchange.finalUrl !== M4_TARGET_URL || exchange.location !== null || (exchange.status >= 300 && exchange.status < 400)) {
    return refusal("redirect_refused");
  }
  if (exchange.status < 200 || exchange.status > 299) return refusal("http_status_refused");
  const mime = contentType(exchange.contentType); if (!mime) return refusal("mime_refused");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(exchange.bodyBase64)) return refusal("transport_refused");
  const bytes = Buffer.from(exchange.bodyBase64, "base64");
  if (bytes.toString("base64") !== exchange.bodyBase64) return refusal("transport_refused");
  if (exchange.cancelAt === "during_body") return refusal("timeout_or_cancelled");
  if (bytes.byteLength > M4_MAX_BODY_BYTES) return refusal("body_limit_refused");
  const evidence: M4PublicEvidence = Object.freeze({
    requestedTargetRef: M4_TARGET_REF, requestedUrl: M4_TARGET_URL, finalUrl: M4_TARGET_URL,
    sourceHost: M4_SOURCE_HOST, publisher: M4_PUBLISHER, targetPolicySha256: M4_TARGET_POLICY_SHA256,
    fetchedAt: exchange.fetchedAt, httpStatus: exchange.status, contentType: mime, byteCount: bytes.byteLength,
    responseSha256: createHash("sha256").update(bytes).digest("hex"), bodyBase64: exchange.bodyBase64,
    quotedBodyText: bytes.toString("utf8"), trust: M4_CANONICAL_TARGET_POLICY.contentTrust,
    provenance: Object.freeze({ acquisitionCapability: "public_http_fetch_v1", transport: "recorded_inert_exchange",
      targetPolicyRef: M4_TARGET_POLICY_REF, targetPolicySha256: M4_TARGET_POLICY_SHA256,
      resolvedAddresses: exchange.resolvedAddresses, connectedAddress: exchange.connectedAddress }),
    custody: Object.freeze({ exactBytesPreserved: true, exactBytesEncoding: "base64", hashAlgorithm: "sha256",
      classification: "public_evidence" }),
  });
  return Object.freeze({ ok: true, evidence });
}

export function validateM4PublicTargetUrl(url: string, expectedHostname: string): M4FetchRefusalCode | null {
  let parsed: URL; try { parsed = new URL(url); } catch { return "url_policy_refused"; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) return "url_policy_refused";
  if (parsed.hostname !== expectedHostname || isIP(parsed.hostname) !== 0 || parsed.hostname.length > 253 ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(parsed.hostname)) {
    return "hostname_refused";
  }
  return null;
}
