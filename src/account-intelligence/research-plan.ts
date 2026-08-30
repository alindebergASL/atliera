import {
  assertExactKeys,
  canonicalJson,
  deepFreezeOwnData,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import {
  ACCOUNT_INTELLIGENCE_REQUEST_KIND,
  ACCOUNT_INTELLIGENCE_REQUEST_VERSION,
  ACCOUNT_RESEARCH_TAXONOMY,
  type AccountResearchPlan,
  type AccountResearchQuery,
  type AccountResearchRequest,
  type AccountResearchTaxonomy,
} from "./contracts.ts";
import { createHash } from "node:crypto";

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 30,
  max_depth: 7,
  max_expanded_json_value_occurrences: 500,
  max_nodes: 200,
  max_object_fields: 12,
  max_string_utf8_bytes: 2_048,
  max_total_string_utf8_bytes: 16_384,
});
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/u;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function object(value: StrictJsonValue | undefined, path: string): Record<string, StrictJsonValue> {
  return strictJsonObject(value as StrictJsonValue, path);
}
function array(value: StrictJsonValue | undefined, path: string, max: number): StrictJsonValue[] {
  return strictJsonArray(value, path, max);
}
function string(value: StrictJsonValue | undefined, path: string, max = 500): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > max) {
    throw new Error(`${path} must be a bounded non-empty string`);
  }
  return value;
}
function nullableString(value: StrictJsonValue | undefined, path: string): string | null {
  return value === null ? null : string(value, path, 200);
}
function uniqueStrings(value: StrictJsonValue | undefined, path: string, max: number): string[] {
  const items = array(value, path, max).map((item, index) => string(item, `${path}[${String(index)}]`, 253));
  if (new Set(items.map((item) => item.toLowerCase())).size !== items.length) {
    throw new Error(`${path} must be unique`);
  }
  return items;
}
function strictIso(value: StrictJsonValue | undefined, path: string): string {
  const text = string(value, path, 30);
  if (!STRICT_ISO.test(text) || new Date(text).toISOString() !== text) throw new Error(`${path} must be strict ISO`);
  return text;
}

export function snapshotAccountResearchRequest(value: unknown): Readonly<AccountResearchRequest> {
  const root = object(snapshotStrictJson(value, "accountResearchRequest", LIMITS), "accountResearchRequest");
  assertExactKeys(root, ["kind", "schemaVersion", "accountId", "accountName", "canonicalPublicDomains",
    "knownAliases", "admittedContext", "requestedAt"], "accountResearchRequest");
  if (root.kind !== ACCOUNT_INTELLIGENCE_REQUEST_KIND || root.schemaVersion !== ACCOUNT_INTELLIGENCE_REQUEST_VERSION) {
    throw new Error("account research request version refused");
  }
  const accountId = string(root.accountId, "accountResearchRequest.accountId", 128);
  if (!SAFE_ID.test(accountId)) throw new Error("accountResearchRequest.accountId must be safe");
  const accountName = string(root.accountName, "accountResearchRequest.accountName", 160);
  const domains = uniqueStrings(root.canonicalPublicDomains, "accountResearchRequest.canonicalPublicDomains", 8)
    .map((domain) => domain.toLowerCase());
  if (domains.length === 0 || domains.some((domain) => !DOMAIN.test(domain))) {
    throw new Error("accountResearchRequest.canonicalPublicDomains refused");
  }
  const aliases = uniqueStrings(root.knownAliases, "accountResearchRequest.knownAliases", 10);
  const context = object(root.admittedContext, "accountResearchRequest.admittedContext");
  assertExactKeys(context, ["sector", "geography", "notes"], "accountResearchRequest.admittedContext");
  const request: AccountResearchRequest = {
    kind: ACCOUNT_INTELLIGENCE_REQUEST_KIND,
    schemaVersion: ACCOUNT_INTELLIGENCE_REQUEST_VERSION,
    accountId,
    accountName,
    canonicalPublicDomains: domains,
    knownAliases: aliases,
    admittedContext: {
      sector: nullableString(context.sector, "accountResearchRequest.admittedContext.sector"),
      geography: nullableString(context.geography, "accountResearchRequest.admittedContext.geography"),
      notes: uniqueStrings(context.notes, "accountResearchRequest.admittedContext.notes", 10),
    },
    requestedAt: strictIso(root.requestedAt, "accountResearchRequest.requestedAt"),
  };
  return deepFreezeOwnData(request);
}

const TAXONOMY_TERMS: Readonly<Record<AccountResearchTaxonomy, string>> = Object.freeze({
  identity_structure: "mission organizational structure material subsidiaries",
  strategic_direction: "strategic priorities operating direction plan",
  financial_context: "budget financial report grants funding appropriations",
  digital_modernization: "AI data digital infrastructure modernization",
  leadership_governance: "leadership governance board decision authority",
  procurement: "procurement solicitations contracts purchasing portal",
  partnerships_technology: "partnerships technology vendors established presence",
  constraints: "regulatory policy security operating constraints",
  recent_changes: "recent material changes announcements annual report",
  gaps_contradictions: "official records amendments contradictions status",
});

function quoted(value: string): string {
  return `"${value.replace(/["\\]/gu, " ").replace(/\s+/gu, " ").trim()}"`;
}

export function createAccountResearchPlan(input: unknown): Readonly<AccountResearchPlan> {
  const request = snapshotAccountResearchRequest(input);
  const domainScope = request.canonicalPublicDomains.map((domain) => `site:${domain}`).join(" OR ");
  const contextTerms = [request.admittedContext.sector, request.admittedContext.geography]
    .filter((item): item is string => item !== null)
    .join(" ");
  const queries: AccountResearchQuery[] = ACCOUNT_RESEARCH_TAXONOMY.map((taxonomy, index) => ({
    queryId: `query-${String(index + 1).padStart(2, "0")}`,
    taxonomy,
    query: `${quoted(request.accountName)} (${domainScope}) ${TAXONOMY_TERMS[taxonomy]} ${contextTerms}`.trim(),
    preferredSourceClasses: ["official_primary", "reputable_secondary_if_needed"],
  }));
  const requestJson = snapshotStrictJson(request, "requestSnapshot", LIMITS);
  const plan: AccountResearchPlan = {
    kind: "atliera.account-research-plan",
    schemaVersion: "1",
    accountId: request.accountId,
    generatedFromRequestSha256: createHash("sha256").update(canonicalJson(requestJson), "utf8").digest("hex"),
    queries,
    queryLimit: 30,
    admittedSourceLimit: 15,
    priorities: ACCOUNT_RESEARCH_TAXONOMY,
  };
  return deepFreezeOwnData(plan);
}
