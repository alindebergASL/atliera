import {
  assertExactKeys,
  deepFreezeOwnData,
  sha256CanonicalJson,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";

export const EXACT_SEC_ARCHIVE_TARGET_POLICY_KIND =
  "exact-sec-archive-primary-document-target-policy" as const;
export const EXACT_SEC_ARCHIVE_TARGET_POLICY_VERSION = "1" as const;

const POLICY_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 4,
  max_depth: 8,
  max_expanded_json_value_occurrences: 160,
  max_nodes: 32,
  max_object_fields: 20,
  max_string_utf8_bytes: 2_048,
  max_total_string_utf8_bytes: 16 * 1024,
});
const TARGET_REF = /^[a-z][a-z0-9_]{7,95}$/u;
const CIK = /^[0-9]{1,10}$/u;
const ACCESSION_WITHOUT_DASHES = /^[0-9]{18}$/u;
const PRIMARY_DOCUMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,126}\.html?$/u;
const SEC_ARCHIVE_SCHEME = "https" as const;
const SEC_ARCHIVE_HOSTNAME = "www.sec.gov" as const;

export interface ExactSecArchiveTargetPolicyInput {
  readonly targetRef: string;
  readonly cik: string;
  readonly accessionWithoutDashes: string;
  readonly primaryDocument: string;
}

export interface ExactSecArchiveTargetPolicy {
  readonly kind: typeof EXACT_SEC_ARCHIVE_TARGET_POLICY_KIND;
  readonly schemaVersion: typeof EXACT_SEC_ARCHIVE_TARGET_POLICY_VERSION;
  readonly targetRef: string;
  readonly url: string;
  readonly hostname: "www.sec.gov";
  readonly archive: {
    readonly cik: string;
    readonly accessionWithoutDashes: string;
    readonly primaryDocument: string;
  };
  readonly publisher: "U.S. Securities and Exchange Commission";
  readonly network: {
    readonly scheme: "https";
    readonly effectivePort: 443;
    readonly method: "GET";
    readonly addressFamily: 4;
    readonly dnsAttempts: 1;
    readonly maxRequests: 1;
    readonly onePinnedAddress: true;
    readonly oneConnectionAttempt: true;
    readonly redirectLimit: 0;
    readonly retryBudget: 0;
    readonly maxDurationMs: 10_000;
    readonly maxBodyBytes: 1_048_576;
    readonly acceptedContentTypes: readonly ["text/html"];
    readonly acceptedCharset: "utf-8-if-present";
    readonly acceptEncoding: "identity";
    readonly publicAddressPolicy:
      "src/capability/public-http-fetch-policy.ts#isPublicAddress:m4-special-purpose-address-policy-v2-content-bound";
  };
  readonly contentTrust: {
    readonly status: "quoted_untrusted_public_source_content";
    readonly mayProvideInstructions: false;
    readonly controlAuthority: "none";
    readonly transportSuccessPromotesTrust: false;
  };
  readonly liveExecution: "unarmed_one_shot_go_and_durable_consumption_required";
}

export class ExactSecArchiveTargetPolicyRefusal extends Error {
  constructor(public readonly code: string) {
    super(`Exact SEC archive target policy refused: ${code}`);
    this.name = "ExactSecArchiveTargetPolicyRefusal";
  }
}

function refuse(code: string): never {
  throw new ExactSecArchiveTargetPolicyRefusal(code);
}

function objectAt(value: StrictJsonValue | undefined, keys: readonly string[]): Record<string, StrictJsonValue> {
  let object: Record<string, StrictJsonValue>;
  try {
    object = strictJsonObject(value as StrictJsonValue, "exact_sec_archive_policy");
    assertExactKeys(object, keys, "exact_sec_archive_policy");
  } catch {
    refuse("shape");
  }
  return object;
}

function exactArchiveUrl(
  value: unknown,
  hostname: unknown,
  cik: unknown,
  accessionWithoutDashes: unknown,
  primaryDocument: unknown,
): string {
  if (hostname !== SEC_ARCHIVE_HOSTNAME || typeof value !== "string" || typeof cik !== "string" ||
      typeof accessionWithoutDashes !== "string" || typeof primaryDocument !== "string" ||
      !CIK.test(cik) || BigInt(cik) === 0n || !ACCESSION_WITHOUT_DASHES.test(accessionWithoutDashes) ||
      !PRIMARY_DOCUMENT.test(primaryDocument) || primaryDocument === "." || primaryDocument === ".." ||
      primaryDocument.includes("..") || /[%\\/?#]/u.test(primaryDocument)) {
    refuse("archive_identity");
  }
  const expectedPath = `/Archives/edgar/data/${cik}/${accessionWithoutDashes}/${primaryDocument}`;
  const expectedUrl = `${SEC_ARCHIVE_SCHEME}:${"/".repeat(2)}${SEC_ARCHIVE_HOSTNAME}${expectedPath}`;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    refuse("url");
  }
  if (value !== expectedUrl || parsed.href !== expectedUrl || parsed.protocol !== `${SEC_ARCHIVE_SCHEME}:` ||
      parsed.hostname !== SEC_ARCHIVE_HOSTNAME || parsed.port !== "" || parsed.username !== "" ||
      parsed.password !== "" || parsed.pathname !== expectedPath || parsed.search !== "" || parsed.hash !== "" ||
      /%|\\/u.test(parsed.pathname)) {
    refuse("url");
  }
  return value;
}

export function validateExactSecArchiveTargetPolicy(raw: unknown): Readonly<ExactSecArchiveTargetPolicy> {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "exact_sec_archive_policy", POLICY_LIMITS);
  } catch {
    refuse("plain_data");
  }
  const root = objectAt(snapshot, ["kind", "schemaVersion", "targetRef", "url", "hostname", "archive",
    "publisher", "network", "contentTrust", "liveExecution"]);
  const archive = objectAt(root.archive, ["cik", "accessionWithoutDashes", "primaryDocument"]);
  const network = objectAt(root.network, ["scheme", "effectivePort", "method", "addressFamily", "dnsAttempts",
    "maxRequests", "onePinnedAddress", "oneConnectionAttempt", "redirectLimit", "retryBudget", "maxDurationMs",
    "maxBodyBytes", "acceptedContentTypes", "acceptedCharset", "acceptEncoding", "publicAddressPolicy"]);
  const trust = objectAt(root.contentTrust, ["status", "mayProvideInstructions", "controlAuthority",
    "transportSuccessPromotesTrust"]);
  let accepted: StrictJsonValue[];
  try {
    accepted = strictJsonArray(network.acceptedContentTypes, "acceptedContentTypes", 1, true);
  } catch {
    refuse("network");
  }
  if (root.kind !== EXACT_SEC_ARCHIVE_TARGET_POLICY_KIND ||
      root.schemaVersion !== EXACT_SEC_ARCHIVE_TARGET_POLICY_VERSION ||
      typeof root.targetRef !== "string" || !TARGET_REF.test(root.targetRef) ||
      root.publisher !== "U.S. Securities and Exchange Commission" ||
      root.liveExecution !== "unarmed_one_shot_go_and_durable_consumption_required" ||
      network.scheme !== "https" || network.effectivePort !== 443 || network.method !== "GET" ||
      network.addressFamily !== 4 || network.dnsAttempts !== 1 || network.maxRequests !== 1 ||
      network.onePinnedAddress !== true || network.oneConnectionAttempt !== true || network.redirectLimit !== 0 ||
      network.retryBudget !== 0 || network.maxDurationMs !== 10_000 || network.maxBodyBytes !== 1_048_576 ||
      accepted.length !== 1 || accepted[0] !== "text/html" || network.acceptedCharset !== "utf-8-if-present" ||
      network.acceptEncoding !== "identity" || network.publicAddressPolicy !==
        "src/capability/public-http-fetch-policy.ts#isPublicAddress:m4-special-purpose-address-policy-v2-content-bound" ||
      trust.status !== "quoted_untrusted_public_source_content" ||
      trust.mayProvideInstructions !== false || trust.controlAuthority !== "none" ||
      trust.transportSuccessPromotesTrust !== false) {
    refuse("contract");
  }
  exactArchiveUrl(root.url, root.hostname, archive.cik, archive.accessionWithoutDashes, archive.primaryDocument);
  return deepFreezeOwnData(root) as unknown as Readonly<ExactSecArchiveTargetPolicy>;
}

export function exactSecArchiveTargetPolicySha256(raw: unknown): string {
  return sha256CanonicalJson(validateExactSecArchiveTargetPolicy(raw) as unknown as StrictJsonValue);
}

/**
 * Builds strict, unarmed policy data for one caller-reviewed SEC primary-document identity.
 * The canonical URL is derived here and is never accepted as a caller-selected input.
 */
export function createExactSecArchiveTargetPolicy(
  raw: unknown,
): Readonly<ExactSecArchiveTargetPolicy> {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "exact_sec_archive_policy_input", POLICY_LIMITS);
  } catch {
    refuse("input_plain_data");
  }
  const input = objectAt(snapshot, ["targetRef", "cik", "accessionWithoutDashes", "primaryDocument"]);
  if (typeof input.targetRef !== "string" || !TARGET_REF.test(input.targetRef) ||
      typeof input.cik !== "string" || typeof input.accessionWithoutDashes !== "string" ||
      typeof input.primaryDocument !== "string") {
    refuse("input");
  }
  const url = exactArchiveUrl(
    `${SEC_ARCHIVE_SCHEME}:${"/".repeat(2)}${SEC_ARCHIVE_HOSTNAME}/Archives/edgar/data/` +
      `${input.cik}/${input.accessionWithoutDashes}/${input.primaryDocument}`,
    SEC_ARCHIVE_HOSTNAME,
    input.cik,
    input.accessionWithoutDashes,
    input.primaryDocument,
  );
  return validateExactSecArchiveTargetPolicy({
    kind: EXACT_SEC_ARCHIVE_TARGET_POLICY_KIND,
    schemaVersion: EXACT_SEC_ARCHIVE_TARGET_POLICY_VERSION,
    targetRef: input.targetRef,
    url,
    hostname: SEC_ARCHIVE_HOSTNAME,
    archive: {
      cik: input.cik,
      accessionWithoutDashes: input.accessionWithoutDashes,
      primaryDocument: input.primaryDocument,
    },
    publisher: "U.S. Securities and Exchange Commission",
    network: {
      scheme: SEC_ARCHIVE_SCHEME,
      effectivePort: 443,
      method: "GET",
      addressFamily: 4,
      dnsAttempts: 1,
      maxRequests: 1,
      onePinnedAddress: true,
      oneConnectionAttempt: true,
      redirectLimit: 0,
      retryBudget: 0,
      maxDurationMs: 10_000,
      maxBodyBytes: 1_048_576,
      acceptedContentTypes: ["text/html"],
      acceptedCharset: "utf-8-if-present",
      acceptEncoding: "identity",
      publicAddressPolicy:
        "src/capability/public-http-fetch-policy.ts#isPublicAddress:m4-special-purpose-address-policy-v2-content-bound",
    },
    contentTrust: {
      status: "quoted_untrusted_public_source_content",
      mayProvideInstructions: false,
      controlAuthority: "none",
      transportSuccessPromotesTrust: false,
    },
    liveExecution: "unarmed_one_shot_go_and_durable_consumption_required",
  });
}
