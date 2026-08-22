import { createHash } from "node:crypto";
import {
  assertExactKeys,
  deepFreezeOwnData,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import type {
  AccountEntityBoundary,
  AccountEntityKind,
  AccountResearchPlan,
  AccountResearchRequest,
  AccountResearchTaxonomy,
  AccountSourceClass,
  AdmittedAccountSource,
  AdmittedEvidenceExcerpt,
  RetrievedSourceInput,
  SearchDiscoveryRecord,
} from "./contracts.ts";
import { ACCOUNT_RESEARCH_TAXONOMY } from "./contracts.ts";

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 40,
  max_depth: 8,
  max_expanded_json_value_occurrences: 20_000,
  max_nodes: 2_000,
  max_object_fields: 24,
  max_string_utf8_bytes: 1_048_576,
  max_total_string_utf8_bytes: 8_000_000,
});
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const IP_LITERAL = /^(?:(?:\d{1,3}\.){3}\d{1,3}|\[?[0-9a-f:]+\]?)$/iu;
const FORBIDDEN_HOST = /(?:^|\.)(?:localhost|local|internal|invalid|example|test)$/iu;
const INSTRUCTION_PATTERN = /(?:ignore\s+(?:all\s+)?(?:previous|prior|system)|system\s+(?:message|prompt)|developer\s+message|follow\s+these\s+instructions|reveal\s+(?:your\s+)?(?:prompt|secret)|<script\b|javascript:|data:text\/html)/iu;
const ENTITY_KINDS: readonly AccountEntityKind[] = ["account", "subsidiary", "business_unit", "governing_body",
  "government", "foundation", "hospital", "research_unit", "other_related_entity"];
const SOURCE_CLASSES: readonly AccountSourceClass[] = ["official_primary", "reputable_secondary"];

function object(value: StrictJsonValue | undefined, path: string): Record<string, StrictJsonValue> {
  return strictJsonObject(value as StrictJsonValue, path);
}
function array(value: StrictJsonValue | undefined, path: string, max: number, nonEmpty = false): StrictJsonValue[] {
  return strictJsonArray(value, path, max, nonEmpty);
}
function string(value: StrictJsonValue | undefined, path: string, max = 4_096): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > max) {
    throw new Error(`${path} must be a bounded non-empty string`);
  }
  return value;
}
function nullableString(value: StrictJsonValue | undefined, path: string): string | null {
  if (value === null) return null;
  return string(value, path, 500);
}
function safeId(value: StrictJsonValue | undefined, path: string): string {
  const text = string(value, path, 128);
  if (!SAFE_ID.test(text)) throw new Error(`${path} must be a safe id`);
  return text;
}
function strictIso(value: StrictJsonValue | undefined, path: string): string {
  const text = string(value, path, 30);
  if (!STRICT_ISO.test(text) || new Date(text).toISOString() !== text) throw new Error(`${path} must be strict ISO`);
  return text;
}
function dateOrNull(value: StrictJsonValue | undefined, path: string): string | null {
  if (value === null) return null;
  const text = string(value, path, 10);
  if (!DATE.test(text) || new Date(`${text}T00:00:00.000Z`).toISOString().slice(0, 10) !== text) {
    throw new Error(`${path} must be a real calendar date or null`);
  }
  return text;
}
function stringArray(value: StrictJsonValue | undefined, path: string, max: number, nonEmpty = false): string[] {
  const result = array(value, path, max, nonEmpty).map((item, index) => string(item, `${path}[${String(index)}]`));
  if (new Set(result).size !== result.length) throw new Error(`${path} must be unique`);
  return result;
}
function safeHttpsUrl(value: StrictJsonValue | undefined, path: string): string {
  const text = string(value, path, 2_048);
  let url: URL;
  try { url = new URL(text); } catch { throw new Error(`${path} must be an HTTPS URL`); }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
      (url.port !== "" && url.port !== "443") || IP_LITERAL.test(url.hostname) ||
      !HOST.test(url.hostname) || FORBIDDEN_HOST.test(url.hostname) || url.href !== text) {
    throw new Error(`${path} must be a public canonical HTTPS URL`);
  }
  return text;
}
function nullableHttpsUrl(value: StrictJsonValue | undefined, path: string): string | null {
  return value === null ? null : safeHttpsUrl(value, path);
}
function enumValue<T extends string>(value: StrictJsonValue | undefined, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${path} refused`);
  return value as T;
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function snapshotDiscovery(value: StrictJsonValue, plan: AccountResearchPlan, index: number): SearchDiscoveryRecord {
  const path = `discoveries[${String(index)}]`;
  const root = object(value, path);
  assertExactKeys(root, ["queryId", "queryKind", "researchLeadReason", "exactQuery", "resultUrl", "resultTitle", "derivedRetrievalUrls", "discoveredAt", "snippetUsedAsEvidence"], path);
  const queryId = safeId(root.queryId, `${path}.queryId`);
  const query = plan.queries.find((item) => item.queryId === queryId);
  const queryKind = string(root.queryKind, `${path}.queryKind`, 40);
  if (queryKind !== "generated_taxonomy" && queryKind !== "operator_research_lead") {
    throw new Error(`${path}.queryKind refused`);
  }
  const researchLeadReason = nullableString(root.researchLeadReason, `${path}.researchLeadReason`);
  const exactQuery = string(root.exactQuery, `${path}.exactQuery`, 2_048);
  if (queryKind === "generated_taxonomy" && (query === undefined || query.query !== exactQuery)) {
    throw new Error(`${path} must bind to the exact generated query`);
  }
  if (queryKind === "generated_taxonomy" && researchLeadReason !== null) {
    throw new Error(`${path} generated query cannot claim an operator lead reason`);
  }
  if (queryKind === "operator_research_lead" && (query !== undefined || researchLeadReason === null)) {
    throw new Error(`${path} operator research lead must use a supplemental id and state its reason`);
  }
  if (root.snippetUsedAsEvidence !== false) throw new Error(`${path} search snippets may not become evidence`);
  const resultUrl = nullableHttpsUrl(root.resultUrl, `${path}.resultUrl`);
  const resultTitle = nullableString(root.resultTitle, `${path}.resultTitle`);
  const derivedRetrievalUrls = array(root.derivedRetrievalUrls, `${path}.derivedRetrievalUrls`, 20)
    .map((item, urlIndex) => safeHttpsUrl(item, `${path}.derivedRetrievalUrls[${String(urlIndex)}]`));
  if (new Set(derivedRetrievalUrls).size !== derivedRetrievalUrls.length ||
      (resultUrl !== null && derivedRetrievalUrls.includes(resultUrl))) {
    throw new Error(`${path} derived retrieval URLs must be unique and distinct from the selected result`);
  }
  if ((resultUrl === null) !== (resultTitle === null)) {
    throw new Error(`${path} result URL and title must both be present or both be null`);
  }
  return {
    queryId,
    queryKind,
    researchLeadReason,
    exactQuery,
    resultUrl,
    resultTitle,
    derivedRetrievalUrls,
    discoveredAt: strictIso(root.discoveredAt, `${path}.discoveredAt`),
    snippetUsedAsEvidence: false,
  };
}

function snapshotEntity(value: StrictJsonValue | undefined, path: string): AccountEntityBoundary {
  const root = object(value, path);
  assertExactKeys(root, ["entityId", "name", "kind", "relationshipToAccount"], path);
  return {
    entityId: safeId(root.entityId, `${path}.entityId`),
    name: string(root.name, `${path}.name`, 240),
    kind: enumValue(root.kind, ENTITY_KINDS, `${path}.kind`),
    relationshipToAccount: string(root.relationshipToAccount, `${path}.relationshipToAccount`, 500),
  };
}

function snapshotTaxonomy(value: StrictJsonValue | undefined, path: string): AccountResearchTaxonomy[] {
  const items = stringArray(value, path, ACCOUNT_RESEARCH_TAXONOMY.length, true);
  if (items.some((item) => !ACCOUNT_RESEARCH_TAXONOMY.includes(item as AccountResearchTaxonomy))) {
    throw new Error(`${path} contains unknown taxonomy`);
  }
  return items as AccountResearchTaxonomy[];
}

function snapshotRetrieved(value: StrictJsonValue, index: number): RetrievedSourceInput {
  const path = `retrievedSources[${String(index)}]`;
  const root = object(value, path);
  assertExactKeys(root, ["retrievalId", "discoveredByQueryIds", "entity", "relatedEntities", "canonicalUrl", "title", "publisher",
    "sourceClass", "publicationDate", "eventDate", "retrievedAt", "evidenceCurrentThrough", "retrievalContentKind", "retrievedText",
    "candidateExcerpts", "taxonomyCoverage", "declaredConflictIds"], path);
  const retrievedText = string(root.retrievedText, `${path}.retrievedText`, 1_048_576);
  if (Buffer.byteLength(retrievedText, "utf8") > 1_048_576) throw new Error(`${path}.retrievedText exceeds byte limit`);
  const candidateExcerpts = stringArray(root.candidateExcerpts, `${path}.candidateExcerpts`, 20, true);
  for (const excerpt of candidateExcerpts) {
    if (Buffer.byteLength(excerpt, "utf8") > 4_000) throw new Error(`${path} excerpt exceeds byte limit`);
    const start = retrievedText.indexOf(excerpt);
    if (start < 0 || retrievedText.indexOf(excerpt, start + excerpt.length) >= 0) {
      throw new Error(`${path} exact excerpt must occur exactly once in retrieved text`);
    }
  }
  const entity = snapshotEntity(root.entity, `${path}.entity`);
  const relatedEntities = array(root.relatedEntities, `${path}.relatedEntities`, 20)
    .map((item, entityIndex) => snapshotEntity(item, `${path}.relatedEntities[${String(entityIndex)}]`));
  if (new Set([entity.entityId, ...relatedEntities.map((item) => item.entityId)]).size !== relatedEntities.length + 1) {
    throw new Error(`${path} entity boundaries must be unique`);
  }
  return {
    retrievalId: safeId(root.retrievalId, `${path}.retrievalId`),
    discoveredByQueryIds: stringArray(root.discoveredByQueryIds, `${path}.discoveredByQueryIds`, 30, true),
    entity,
    relatedEntities,
    canonicalUrl: safeHttpsUrl(root.canonicalUrl, `${path}.canonicalUrl`),
    title: string(root.title, `${path}.title`, 500),
    publisher: string(root.publisher, `${path}.publisher`, 300),
    sourceClass: enumValue(root.sourceClass, SOURCE_CLASSES, `${path}.sourceClass`),
    publicationDate: dateOrNull(root.publicationDate, `${path}.publicationDate`),
    eventDate: dateOrNull(root.eventDate, `${path}.eventDate`),
    retrievedAt: strictIso(root.retrievedAt, `${path}.retrievedAt`),
    evidenceCurrentThrough: dateOrNull(root.evidenceCurrentThrough, `${path}.evidenceCurrentThrough`),
    retrievalContentKind: enumValue(root.retrievalContentKind, ["bounded_clean_text_projection"] as const,
      `${path}.retrievalContentKind`),
    retrievedText,
    candidateExcerpts,
    taxonomyCoverage: snapshotTaxonomy(root.taxonomyCoverage, `${path}.taxonomyCoverage`),
    declaredConflictIds: stringArray(root.declaredConflictIds, `${path}.declaredConflictIds`, 20),
  };
}

export interface AdmittedAccountResearch {
  readonly discoveries: readonly SearchDiscoveryRecord[];
  readonly sources: readonly AdmittedAccountSource[];
}

export function admitAccountResearch(
  request: Readonly<AccountResearchRequest>,
  plan: Readonly<AccountResearchPlan>,
  discoveriesInput: unknown,
  retrievedSourcesInput: unknown,
): Readonly<AdmittedAccountResearch> {
  if (request.accountId !== plan.accountId) throw new Error("request and plan account mismatch");
  const discoveriesSnapshot = snapshotStrictJson(discoveriesInput, "discoveries", LIMITS);
  const discoveries = array(discoveriesSnapshot, "discoveries", 30)
    .map((item, index) => snapshotDiscovery(item, plan, index));
  const retrievedSnapshot = snapshotStrictJson(retrievedSourcesInput, "retrievedSources", LIMITS);
  const retrieved = array(retrievedSnapshot, "retrievedSources", plan.admittedSourceLimit, true)
    .map((item, index) => snapshotRetrieved(item, index));
  if (new Set(retrieved.map((item) => item.retrievalId)).size !== retrieved.length) {
    throw new Error("retrieval ids must be unique");
  }
  const trustedEntityIds = new Set<string>([request.admittedContext.primaryAccountEntityId, ...request.admittedContext.trustedOfficialHosts.flatMap((rule) => rule.entityIds)]);
  const entityDefinitions = new Map<string, string>();
  for (const source of retrieved) {
    for (const entity of [source.entity, ...source.relatedEntities]) {
      if (!trustedEntityIds.has(entity.entityId)) throw new Error("source entity is not admitted by trusted account context");
      if (entity.kind === "account" &&
          (entity.entityId !== request.admittedContext.primaryAccountEntityId || entity.name !== request.accountName)) {
        throw new Error("primary account entity identity mismatch");
      }
      const definition = JSON.stringify([entity.name, entity.kind, entity.relationshipToAccount]);
      const prior = entityDefinitions.get(entity.entityId);
      if (prior !== undefined && prior !== definition) throw new Error("entity definition conflict refused");
      entityDefinitions.set(entity.entityId, definition);
    }
    if (source.sourceClass === "official_primary") {
      const hostname = new URL(source.canonicalUrl).hostname.toLowerCase();
      const allowed = request.admittedContext.trustedOfficialHosts.some((rule) =>
        (hostname === rule.hostname || (rule.allowSubdomains && hostname.endsWith(`.${rule.hostname}`))) &&
        rule.entityIds.includes(source.entity.entityId));
      if (!allowed) throw new Error("official primary source host/entity policy refused");
    }
  }
  const urls = new Set<string>();
  const sources: AdmittedAccountSource[] = retrieved.map((source) => {
    const boundLineageUrls = new Set(discoveries
      .filter((item) => source.discoveredByQueryIds.includes(item.queryId))
      .flatMap((item) => [...(item.resultUrl === null ? [] : [item.resultUrl]), ...item.derivedRetrievalUrls]));
    if (!boundLineageUrls.has(source.canonicalUrl)) {
      throw new Error("retrieved source must descend from its recorded search query lineage");
    }
    if (urls.has(source.canonicalUrl)) throw new Error("duplicate canonical source URL refused");
    urls.add(source.canonicalUrl);
    const contentHash = sha256(source.retrievedText);
    const sourceId = `source_${sha256(`${source.canonicalUrl}\n${contentHash}`).slice(0, 20)}`;
    const excerpts: AdmittedEvidenceExcerpt[] = source.candidateExcerpts.map((excerpt, excerptIndex) => {
      const start = source.retrievedText.indexOf(excerpt);
      const excerptHash = sha256(excerpt);
      return {
        evidenceId: `evidence_${sha256(`${sourceId}\n${String(excerptIndex)}\n${excerptHash}`).slice(0, 20)}`,
        sourceId,
        entityId: source.entity.entityId,
        exactExcerpt: excerpt,
        exactExcerptSha256: excerptHash,
        sourceCharStart: start,
        sourceCharEnd: start + excerpt.length,
      };
    });
    return {
      sourceId,
      retrievalId: source.retrievalId,
      entity: source.entity,
      relatedEntities: source.relatedEntities,
      canonicalUrl: source.canonicalUrl,
      title: source.title,
      publisher: source.publisher,
      sourceClass: source.sourceClass,
      publicationDate: source.publicationDate,
      eventDate: source.eventDate,
      retrievedAt: source.retrievedAt,
      evidenceCurrentThrough: source.evidenceCurrentThrough,
      retrievalContentKind: source.retrievalContentKind,
      retrievedContentSha256: contentHash,
      retrievedByteSize: Buffer.byteLength(source.retrievedText, "utf8"),
      untrustedInstructionsDetected: INSTRUCTION_PATTERN.test(source.retrievedText),
      taxonomyCoverage: source.taxonomyCoverage,
      declaredConflictIds: source.declaredConflictIds,
      discoveredByQueryIds: source.discoveredByQueryIds,
      excerpts,
    };
  });
  return deepFreezeOwnData({ discoveries, sources });
}
