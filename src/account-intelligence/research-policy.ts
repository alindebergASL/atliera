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
import type {
  AccountEntityBoundary,
  AccountEntityKind,
  AdmittedResearchPolicy,
  AdmittedResearchPolicyReceipt,
  TrustedOfficialHost,
} from "./contracts.ts";

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 30,
  max_depth: 7,
  max_expanded_json_value_occurrences: 500,
  max_nodes: 200,
  max_object_fields: 16,
  max_string_utf8_bytes: 2_048,
  max_total_string_utf8_bytes: 32_768,
});
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;
const STRICT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ENTITY_KINDS: readonly AccountEntityKind[] = ["account", "subsidiary", "business_unit", "governing_body",
  "government", "foundation", "hospital", "research_unit", "other_related_entity"];

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
function entity(value: StrictJsonValue | undefined, path: string): AccountEntityBoundary {
  const root = object(value, path);
  assertExactKeys(root, ["entityId", "name", "kind", "relationshipToAccount"], path);
  const kind = text(root.kind, `${path}.kind`, 40) as AccountEntityKind;
  if (!ENTITY_KINDS.includes(kind)) throw new Error(`${path}.kind refused`);
  return {
    entityId: safeId(root.entityId, `${path}.entityId`),
    name: text(root.name, `${path}.name`, 240),
    kind,
    relationshipToAccount: text(root.relationshipToAccount, `${path}.relationshipToAccount`, 500),
  };
}

export interface SnapshottedResearchPolicy {
  readonly policy: Readonly<AdmittedResearchPolicy>;
  readonly receipt: Readonly<AdmittedResearchPolicyReceipt>;
}

export function snapshotAdmittedResearchPolicy(value: unknown): SnapshottedResearchPolicy {
  const snapshot = snapshotStrictJson(value, "researchPolicy", LIMITS);
  const root = object(snapshot, "researchPolicy");
  assertExactKeys(root, ["kind", "schemaVersion", "policyId", "accountId", "primaryAccountEntity",
    "trustedOfficialHosts", "authorizedAt", "scope", "authorizesPersistence", "authorizesPrivateSources"], "researchPolicy");
  if (root.kind !== "atliera.admitted-account-research-policy" || root.schemaVersion !== "1" ||
      root.scope !== "local_test_only" || root.authorizesPersistence !== false || root.authorizesPrivateSources !== false) {
    throw new Error("research policy boundary refused");
  }
  const primaryAccountEntity = entity(root.primaryAccountEntity, "researchPolicy.primaryAccountEntity");
  if (primaryAccountEntity.kind !== "account") throw new Error("research policy primary entity must be account");
  const trustedOfficialHosts: TrustedOfficialHost[] = array(root.trustedOfficialHosts,
    "researchPolicy.trustedOfficialHosts", 20, true).map((item, index) => {
    const path = `researchPolicy.trustedOfficialHosts[${String(index)}]`;
    const rule = object(item, path);
    assertExactKeys(rule, ["hostname", "allowSubdomains", "entityIds"], path);
    const hostname = text(rule.hostname, `${path}.hostname`, 253).toLowerCase();
    if (!DOMAIN.test(hostname)) throw new Error(`${path}.hostname refused`);
    if (typeof rule.allowSubdomains !== "boolean") throw new Error(`${path}.allowSubdomains must be boolean`);
    const entityIds = array(rule.entityIds, `${path}.entityIds`, 20, true)
      .map((itemId, itemIndex) => safeId(itemId, `${path}.entityIds[${String(itemIndex)}]`));
    if (new Set(entityIds).size !== entityIds.length) throw new Error(`${path}.entityIds must be unique`);
    return { hostname, allowSubdomains: rule.allowSubdomains, entityIds };
  });
  if (new Set(trustedOfficialHosts.map((rule) => rule.hostname)).size !== trustedOfficialHosts.length) {
    throw new Error("research policy trusted hosts must be unique");
  }
  const authorizedAt = text(root.authorizedAt, "researchPolicy.authorizedAt", 30);
  if (!STRICT_ISO.test(authorizedAt) || new Date(authorizedAt).toISOString() !== authorizedAt) {
    throw new Error("researchPolicy.authorizedAt must be strict ISO");
  }
  const policy: AdmittedResearchPolicy = {
    kind: "atliera.admitted-account-research-policy",
    schemaVersion: "1",
    policyId: safeId(root.policyId, "researchPolicy.policyId"),
    accountId: safeId(root.accountId, "researchPolicy.accountId"),
    primaryAccountEntity,
    trustedOfficialHosts,
    authorizedAt,
    scope: "local_test_only",
    authorizesPersistence: false,
    authorizesPrivateSources: false,
  };
  const receipt: AdmittedResearchPolicyReceipt = {
    policyId: policy.policyId,
    accountId: policy.accountId,
    policySha256: sha256CanonicalJson(snapshot),
    authorizedAt,
    scope: "local_test_only",
    authorizesPersistence: false,
    authorizesPrivateSources: false,
  };
  return deepFreezeOwnData({ policy, receipt });
}
