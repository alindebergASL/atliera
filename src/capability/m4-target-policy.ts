import { createHash } from "node:crypto";

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  throw new Error("target policy must be canonical plain JSON");
}

export const M4_TARGET_POLICY_REF =
  "src/capability/m4-target-policy.ts#M4_CANONICAL_TARGET_POLICY" as const;

export const M4_CANONICAL_TARGET_POLICY = Object.freeze({
  schemaVersion: "2" as const,
  targetRef: "sec_fedex_submissions" as const,
  url: "https://data.sec.gov/submissions/CIK0001048911.json" as const,
  hostname: "data.sec.gov" as const,
  publisher: "U.S. Securities and Exchange Commission" as const,
  sourceFamily: "SEC EDGAR submissions-by-company API" as const,
  expectedIdentity: Object.freeze({
    cik: "0001048911" as const,
    name: "FEDEX CORP" as const,
    sic: "4513" as const,
    sicDescription: "AIR COURIER SERVICES" as const,
    ticker: "FDX" as const,
    exchange: "NYSE" as const,
  }),
  permissionAndAccess: Object.freeze({
    cikVerification: "https://www.sec.gov/cgi-bin/browse-edgar?CIK=FDX&action=getcompany" as const,
    apiDocumentation: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces" as const,
    fairAccess: Object.freeze([
      "https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data" as const,
      "https://www.sec.gov/about/developer-resources" as const,
    ]),
    authentication: "none" as const,
    maximumRequestsPerSecond: 10 as const,
    milestoneRequestCount: 1 as const,
  }),
  userAgent: Object.freeze({
    configInput: "ATLIERA_M4_SEC_USER_AGENT" as const,
    contract: "OrganizationOrApplication <MONITORED_PUBLIC_CONTACT_EMAIL>" as const,
    printableAsciiOnly: true as const,
    minimumLength: 8 as const,
    maximumLength: 256 as const,
    preserveExactConfiguredBytes: true as const,
    committedContactValue: false as const,
  }),
  extraction: Object.freeze({
    format: "strict_json_utf8" as const,
    validateFields: Object.freeze(["/cik", "/name", "/sic", "/sicDescription", "/tickers", "/exchanges"] as const),
    literalExcerptPointer: "/sicDescription" as const,
    cikNormalization: "exact_official_numeric_identity_zero_padded_to_10_digits" as const,
    sicDescriptionNormalization: "ascii_uppercase_for_identity_comparison_preserve_literal_source" as const,
    rejectSecurityKeys: Object.freeze(["__proto__", "prototype", "constructor"] as const),
  }),
  network: Object.freeze({
    scheme: "https" as const,
    effectivePort: 443 as const,
    method: "GET" as const,
    redirectLimit: 0 as const,
    retryBudget: 0 as const,
    maxTargets: 1 as const,
    maxDurationMs: 10_000 as const,
    maxBodyBytes: 1_048_576 as const,
    acceptedContentTypes: Object.freeze(["application/json" as const]),
    acceptedCharset: "utf-8" as const,
    addressFamily: 4 as const,
    onePinnedAddress: true as const,
    oneConnectionAttempt: true as const,
    acceptEncoding: "identity" as const,
    credentialsAllowed: false as const,
    cookiesAllowed: false as const,
  }),
  contentTrust: Object.freeze({
    status: "quoted_untrusted_public_source_content" as const,
    mayProvideInstructions: false as const,
    controlAuthority: "none" as const,
    transportSuccessPromotesTrust: false as const,
  }),
  addressPolicy: Object.freeze({
    ref: "src/capability/public-http-fetch-policy.ts#isPublicAddress" as const,
    version: "m4-special-purpose-address-policy-v2-content-bound" as const,
    snapshotDate: "2025-10-09" as const,
    ipv4Registry: "https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml" as const,
    ipv6Registry: "https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml" as const,
    allowedCidrs: Object.freeze({ ipv4: Object.freeze(["0.0.0.0/0"] as const), ipv6: Object.freeze(["2000::/3"] as const) }),
    deniedCidrs: Object.freeze({
      ipv4: Object.freeze([
        "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
        "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.31.196.0/24", "192.52.193.0/24",
        "192.88.99.0/24", "192.168.0.0/16", "192.175.48.0/24", "198.18.0.0/15", "198.51.100.0/24",
        "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
      ] as const),
      ipv6: Object.freeze([
        "::/128", "::1/128", "::ffff:0:0/96", "64:ff9b:1::/48", "100::/64", "2001::/23",
        "2001:db8::/32", "2002::/16", "3fff::/20", "fc00::/7", "fe80::/10", "ff00::/8",
      ] as const),
    }),
    classificationRule: Object.freeze({
      invalidIp: "deny" as const,
      decision: "accept_iff_family_allow_cidr_matches_and_no_family_deny_cidr_matches" as const,
      normalizeBeforeClassification: "lowercase" as const,
    }),
  }),
  liveExecution: "gate_a_unarmed_external_gate_b_one_shot_go_required" as const,
});

// Independently pinned. Update only when every dependent registry/schedule/proof pin is reviewed and rotated.
export const M4_TARGET_POLICY_SHA256 = "a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a" as const;

const derivedTargetPolicySha256 = createHash("sha256").update(canonical(M4_CANONICAL_TARGET_POLICY), "utf8").digest("hex");
if (derivedTargetPolicySha256 !== M4_TARGET_POLICY_SHA256) throw new Error(`M4 canonical target policy hash mismatch: ${derivedTargetPolicySha256}`);
