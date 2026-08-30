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
import {
  ACCOUNT_RESEARCH_TAXONOMY,
  type AccountEntityBoundary,
  type AccountEntityKind,
  type AccountSourceClass,
  type AdmittedResearchPolicy,
  type AdmittedResearchPolicyReceipt,
  type RetainedSourceCustody,
  type TaxonomyAdmissionAuthority,
  type TrustedOfficialHost,
} from "./contracts.ts";

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 300,
  max_depth: 9,
  max_expanded_json_value_occurrences: 50_000,
  max_nodes: 10_000,
  max_object_fields: 20,
  max_string_utf8_bytes: 4_096,
  max_total_string_utf8_bytes: 2_000_000,
});
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ENTITY_KINDS: readonly AccountEntityKind[] = ["account", "subsidiary", "business_unit", "governing_body",
  "government", "foundation", "hospital", "research_unit", "other_related_entity"];
const SOURCE_CLASSES: readonly AccountSourceClass[] = ["official_primary", "reputable_secondary"];

function object(value: StrictJsonValue | undefined, path: string): Record<string, StrictJsonValue> {
  return strictJsonObject(value as StrictJsonValue, path);
}
function array(value: StrictJsonValue | undefined, path: string, max: number, nonEmpty = false): StrictJsonValue[] {
  return strictJsonArray(value, path, max, nonEmpty);
}
function text(value: StrictJsonValue | undefined, path: string, max = 500): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > max) {
    throw new Error(`${path} must be bounded non-empty text`);
  }
  return value;
}
function safeId(value: StrictJsonValue | undefined, path: string): string {
  const valueText = text(value, path, 128);
  if (!SAFE_ID.test(valueText)) throw new Error(`${path} must be a safe id`);
  return valueText;
}
function hash(value: StrictJsonValue | undefined, path: string): string {
  const valueText = text(value, path, 64);
  if (!SHA256.test(valueText)) throw new Error(`${path} must be SHA-256`);
  return valueText;
}
function strictIso(value: StrictJsonValue | undefined, path: string): string {
  const valueText = text(value, path, 30);
  if (!STRICT_ISO.test(valueText) || new Date(valueText).toISOString() !== valueText) {
    throw new Error(`${path} must be strict ISO`);
  }
  return valueText;
}
function httpsUrl(value: StrictJsonValue | undefined, path: string): string {
  const valueText = text(value, path, 2_048);
  let url: URL;
  try { url = new URL(valueText); } catch { throw new Error(`${path} must be canonical HTTPS URL`); }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.href !== valueText || !DOMAIN.test(url.hostname)) {
    throw new Error(`${path} must be canonical HTTPS URL`);
  }
  return valueText;
}
function enumValue<T extends string>(value: StrictJsonValue | undefined, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${path} refused`);
  return value as T;
}
function entity(value: StrictJsonValue | undefined, path: string): AccountEntityBoundary {
  const root = object(value, path);
  assertExactKeys(root, ["entityId", "name", "kind", "relationshipToAccount"], path);
  return {
    entityId: safeId(root.entityId, `${path}.entityId`),
    name: text(root.name, `${path}.name`, 240),
    kind: enumValue(root.kind, ENTITY_KINDS, `${path}.kind`),
    relationshipToAccount: text(root.relationshipToAccount, `${path}.relationshipToAccount`, 500),
  };
}
function canonicalEntity(value: AccountEntityBoundary): string {
  return JSON.stringify([value.entityId, value.name, value.kind, value.relationshipToAccount]);
}
function hashSnapshot(value: unknown, path: string): string {
  return sha256CanonicalJson(snapshotStrictJson(value, path, LIMITS));
}

export interface SnapshottedResearchPolicy {
  readonly policy: Readonly<AdmittedResearchPolicy>;
  readonly receipt: Readonly<AdmittedResearchPolicyReceipt>;
}

export function snapshotAdmittedResearchPolicy(value: unknown): SnapshottedResearchPolicy {
  const snapshot = snapshotStrictJson(value, "researchPolicy", LIMITS);
  const root = object(snapshot, "researchPolicy");
  assertExactKeys(root, ["kind", "schemaVersion", "policyId", "accountId", "primaryAccountEntity", "admittedEntities",
    "trustedOfficialHosts", "sourceCustody", "taxonomyAuthorities", "authorizedAt", "scope",
    "authorizesPersistence", "authorizesPrivateSources"], "researchPolicy");
  if (root.kind !== "atliera.admitted-account-research-policy" || root.schemaVersion !== "2" ||
      root.scope !== "local_test_only" || root.authorizesPersistence !== false || root.authorizesPrivateSources !== false) {
    throw new Error("research policy boundary refused");
  }
  const policyId = safeId(root.policyId, "researchPolicy.policyId");
  const accountId = safeId(root.accountId, "researchPolicy.accountId");
  const primaryAccountEntity = entity(root.primaryAccountEntity, "researchPolicy.primaryAccountEntity");
  if (primaryAccountEntity.kind !== "account") {
    throw new Error("research policy primary entity must be an account-kind catalog entry");
  }
  const admittedEntities = array(root.admittedEntities, "researchPolicy.admittedEntities", 100, true)
    .map((item, index) => entity(item, `researchPolicy.admittedEntities[${String(index)}]`));
  if (new Set(admittedEntities.map((item) => item.entityId)).size !== admittedEntities.length) {
    throw new Error("research policy admitted entity ids must be unique");
  }
  const catalogPrimary = admittedEntities.find((item) => item.entityId === primaryAccountEntity.entityId);
  if (catalogPrimary === undefined || canonicalEntity(catalogPrimary) !== canonicalEntity(primaryAccountEntity)) {
    throw new Error("research policy primary entity must exactly match its catalog entry");
  }
  const entityIds = new Set(admittedEntities.map((item) => item.entityId));
  const trustedOfficialHosts: TrustedOfficialHost[] = array(root.trustedOfficialHosts,
    "researchPolicy.trustedOfficialHosts", 40).map((item, index) => {
    const path = `researchPolicy.trustedOfficialHosts[${String(index)}]`;
    const rule = object(item, path);
    assertExactKeys(rule, ["hostname", "allowSubdomains", "entityIds"], path);
    const hostname = text(rule.hostname, `${path}.hostname`, 253).toLowerCase();
    if (!DOMAIN.test(hostname)) throw new Error(`${path}.hostname refused`);
    if (typeof rule.allowSubdomains !== "boolean") throw new Error(`${path}.allowSubdomains must be boolean`);
    const ids = array(rule.entityIds, `${path}.entityIds`, 100, true)
      .map((itemId, itemIndex) => safeId(itemId, `${path}.entityIds[${String(itemIndex)}]`));
    if (new Set(ids).size !== ids.length || ids.some((id) => !entityIds.has(id))) {
      throw new Error(`${path}.entityIds must be unique cataloged entities`);
    }
    return { hostname, allowSubdomains: rule.allowSubdomains, entityIds: ids };
  });
  if (new Set(trustedOfficialHosts.map((rule) => rule.hostname)).size !== trustedOfficialHosts.length) {
    throw new Error("research policy trusted hosts must be unique");
  }
  const sourceCustody: RetainedSourceCustody[] = array(root.sourceCustody, "researchPolicy.sourceCustody", 100, true)
    .map((item, index) => {
      const path = `researchPolicy.sourceCustody[${String(index)}]`;
      const row = object(item, path);
      assertExactKeys(row, ["custodyId", "accountId", "retainedCorpusId", "canonicalUrl", "retrievedContentSha256",
        "sourceClass", "title", "publisher", "primaryEntityId", "retrievedAt", "authorizedBy", "authorizedAt",
        "scope", "authorizesPersistence"], path);
      if (row.scope !== "local_test_only" || row.authorizesPersistence !== false) throw new Error(`${path} boundary refused`);
      const custody: RetainedSourceCustody = {
        custodyId: safeId(row.custodyId, `${path}.custodyId`),
        accountId: safeId(row.accountId, `${path}.accountId`),
        retainedCorpusId: safeId(row.retainedCorpusId, `${path}.retainedCorpusId`),
        canonicalUrl: httpsUrl(row.canonicalUrl, `${path}.canonicalUrl`),
        retrievedContentSha256: hash(row.retrievedContentSha256, `${path}.retrievedContentSha256`),
        sourceClass: enumValue(row.sourceClass, SOURCE_CLASSES, `${path}.sourceClass`),
        title: text(row.title, `${path}.title`, 500),
        publisher: text(row.publisher, `${path}.publisher`, 300),
        primaryEntityId: safeId(row.primaryEntityId, `${path}.primaryEntityId`),
        retrievedAt: strictIso(row.retrievedAt, `${path}.retrievedAt`),
        authorizedBy: safeId(row.authorizedBy, `${path}.authorizedBy`),
        authorizedAt: strictIso(row.authorizedAt, `${path}.authorizedAt`),
        scope: "local_test_only",
        authorizesPersistence: false,
      };
      if (custody.accountId !== accountId || !entityIds.has(custody.primaryEntityId)) {
        throw new Error(`${path} must bind this account and a cataloged primary entity`);
      }
      return custody;
    });
  if (new Set(sourceCustody.map((item) => item.custodyId)).size !== sourceCustody.length ||
      new Set(sourceCustody.map((item) => item.canonicalUrl)).size !== sourceCustody.length) {
    throw new Error("research policy source custody ids and URLs must be unique");
  }
  const custodyById = new Map(sourceCustody.map((item) => [item.custodyId, item]));
  const taxonomyAuthorities: TaxonomyAdmissionAuthority[] = array(root.taxonomyAuthorities,
    "researchPolicy.taxonomyAuthorities", 300, true).map((item, index) => {
    const path = `researchPolicy.taxonomyAuthorities[${String(index)}]`;
    const row = object(item, path);
    assertExactKeys(row, ["authorizationId", "accountId", "custodyId", "canonicalUrl", "retrievedContentSha256",
      "exactExcerptSha256", "taxonomy", "authorizedBy", "authorizedAt", "scope", "authorizesPersistence"], path);
    if (row.scope !== "local_test_only" || row.authorizesPersistence !== false) throw new Error(`${path} boundary refused`);
    const authority: TaxonomyAdmissionAuthority = {
      authorizationId: safeId(row.authorizationId, `${path}.authorizationId`),
      accountId: safeId(row.accountId, `${path}.accountId`),
      custodyId: safeId(row.custodyId, `${path}.custodyId`),
      canonicalUrl: httpsUrl(row.canonicalUrl, `${path}.canonicalUrl`),
      retrievedContentSha256: hash(row.retrievedContentSha256, `${path}.retrievedContentSha256`),
      exactExcerptSha256: hash(row.exactExcerptSha256, `${path}.exactExcerptSha256`),
      taxonomy: enumValue(row.taxonomy, ACCOUNT_RESEARCH_TAXONOMY, `${path}.taxonomy`),
      authorizedBy: safeId(row.authorizedBy, `${path}.authorizedBy`),
      authorizedAt: strictIso(row.authorizedAt, `${path}.authorizedAt`),
      scope: "local_test_only",
      authorizesPersistence: false,
    };
    const custody = custodyById.get(authority.custodyId);
    if (authority.accountId !== accountId || custody === undefined || authority.canonicalUrl !== custody.canonicalUrl ||
        authority.retrievedContentSha256 !== custody.retrievedContentSha256) {
      throw new Error(`${path} must exactly bind this account and source custody`);
    }
    return authority;
  });
  if (new Set(taxonomyAuthorities.map((item) => item.authorizationId)).size !== taxonomyAuthorities.length ||
      new Set(taxonomyAuthorities.map((item) => `${item.custodyId}\n${item.exactExcerptSha256}\n${item.taxonomy}`)).size !== taxonomyAuthorities.length) {
    throw new Error("research policy taxonomy authorizations must be unique");
  }
  const authorizedAt = strictIso(root.authorizedAt, "researchPolicy.authorizedAt");
  const policy: AdmittedResearchPolicy = {
    kind: "atliera.admitted-account-research-policy",
    schemaVersion: "2",
    policyId,
    accountId,
    primaryAccountEntity,
    admittedEntities,
    trustedOfficialHosts,
    sourceCustody,
    taxonomyAuthorities,
    authorizedAt,
    scope: "local_test_only",
    authorizesPersistence: false,
    authorizesPrivateSources: false,
  };
  const receipt: AdmittedResearchPolicyReceipt = {
    policyId,
    accountId,
    policySha256: sha256CanonicalJson(snapshot),
    entityCatalogSha256: hashSnapshot(admittedEntities, "entityCatalogReceipt"),
    sourceCustodySha256: hashSnapshot(sourceCustody, "sourceCustodyReceipt"),
    taxonomyAuthoritiesSha256: hashSnapshot(taxonomyAuthorities, "taxonomyAuthoritiesReceipt"),
    authorizedAt,
    scope: "local_test_only",
    authorizesPersistence: false,
    authorizesPrivateSources: false,
  };
  return deepFreezeOwnData({ policy, receipt });
}
