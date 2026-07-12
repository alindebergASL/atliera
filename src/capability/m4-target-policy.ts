import { createHash } from "node:crypto";

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  throw new Error("target policy must be canonical plain JSON");
}

export const M4_TARGET_POLICY_REF =
  "src/capability/m4-target-policy.ts#M4_CANONICAL_TARGET_POLICY" as const;

export const M4_CANONICAL_TARGET_POLICY = Object.freeze({
  schemaVersion: "1" as const,
  targetRef: "fedex_company_overview" as const,
  url: "https://investors.fedex.com/company-overview/overview-of-company/default.aspx" as const,
  hostname: "investors.fedex.com" as const,
  publisher: "FedEx Corporation" as const,
  network: Object.freeze({
    scheme: "https" as const,
    effectivePort: 443 as const,
    redirectLimit: 0 as const,
    retryBudget: 0 as const,
    maxTargets: 1 as const,
    maxDurationMs: 10_000 as const,
    maxBodyBytes: 1_048_576 as const,
    acceptedContentTypes: Object.freeze(["text/html" as const, "text/plain" as const]),
    onePinnedAddress: true as const,
    oneConnectionAttempt: true as const,
  }),
  contentTrust: Object.freeze({
    status: "quoted_untrusted_public_source_content" as const,
    mayProvideInstructions: false as const,
    controlAuthority: "none" as const,
  }),
  addressPolicy: Object.freeze({
    ref: "src/capability/public-http-fetch-policy.ts#isPublicAddress" as const,
    version: "m4-special-purpose-address-policy-v2-content-bound" as const,
    snapshotDate: "2025-10-09" as const,
    ipv4Registry: "https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml" as const,
    ipv6Registry: "https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml" as const,
    allowedCidrs: Object.freeze({
      ipv4: Object.freeze(["0.0.0.0/0"] as const),
      ipv6: Object.freeze(["2000::/3"] as const),
    }),
    deniedCidrs: Object.freeze({
      ipv4: Object.freeze([
        "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
        "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
        "192.31.196.0/24", "192.52.193.0/24", "192.88.99.0/24", "192.168.0.0/16",
        "192.175.48.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24",
        "224.0.0.0/4", "240.0.0.0/4",
      ] as const),
      ipv6: Object.freeze([
        "::/128", "::1/128", "::ffff:0:0/96", "64:ff9b:1::/48", "100::/64",
        "2001::/23", "2001:db8::/32", "2002::/16", "3fff::/20", "fc00::/7",
        "fe80::/10", "ff00::/8",
      ] as const),
    }),
    classificationRule: Object.freeze({
      invalidIp: "deny" as const,
      decision: "accept_iff_family_allow_cidr_matches_and_no_family_deny_cidr_matches" as const,
      normalizeBeforeClassification: "lowercase" as const,
    }),
  }),
  liveExecution: "blocked_pending_operator_legal_decision_or_written_permission_and_separately_reviewed_adapter" as const,
});

export const M4_TARGET_POLICY_SHA256 =
  "34c0ebd3e8492ae7d9dcfae0a98798479bd8ea7664c89618f841ffb4e214b12c" as const;

const derivedTargetPolicySha256 = createHash("sha256")
  .update(canonical(M4_CANONICAL_TARGET_POLICY), "utf8")
  .digest("hex");

if (derivedTargetPolicySha256 !== M4_TARGET_POLICY_SHA256) {
  throw new Error("M4 canonical target policy hash mismatch");
}
