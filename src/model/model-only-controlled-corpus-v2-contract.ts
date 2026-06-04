export interface ControlledCorpusV2Excerpt {
  id: string;
  account_ref: string;
  text?: string;
}

export interface ControlledCorpusV2Claim {
  id: string;
  account_ref: string;
  claim?: string;
  supporting_excerpt_ids: readonly string[];
}

export interface ControlledCorpusV2AccountObject {
  id: string;
  account_ref: string;
  type?: string;
  summary?: string;
  supporting_excerpt_ids: readonly string[];
}

export interface ControlledCorpusV2Output {
  excerpts: readonly ControlledCorpusV2Excerpt[];
  claims: readonly ControlledCorpusV2Claim[];
  account_objects: readonly ControlledCorpusV2AccountObject[];
}

export interface ControlledCorpusV2ValidationResult {
  output: ControlledCorpusV2Output;
  counts: {
    excerpts: number;
    claims: number;
    account_objects: number;
  };
  account_refs: readonly string[];
  provenance_complete: true;
}

const TOP_LEVEL_KEYS = ["account_objects", "claims", "excerpts"] as const;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_ACCOUNT_REF = /^acct-[A-Za-z0-9][A-Za-z0-9._-]{0,123}$/;

function ownDataValue(object: unknown, key: string): unknown {
  if (object === null || typeof object !== "object" || Array.isArray(object)) {
    throw new Error("controlled-corpus v2 output item must be an object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !("value" in descriptor)) {
    throw new Error(`controlled-corpus v2 ${key} is required`);
  }
  return descriptor.value;
}

function optionalOwnDataValue(object: unknown, key: string): unknown {
  if (object === null || typeof object !== "object" || Array.isArray(object)) {
    throw new Error("controlled-corpus v2 output item must be an object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) {
    throw new Error(`controlled-corpus v2 ${key} rejected`);
  }
  return descriptor.value;
}

function assertSafeId(field: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || !SAFE_ID.test(value) || value.includes("..") || value.includes("://") || value.includes("/")) {
    throw new Error(`controlled-corpus v2 ${field} must be a safe id`);
  }
}

function assertAccountRef(value: unknown): asserts value is string {
  if (typeof value !== "string" || !SAFE_ACCOUNT_REF.test(value) || value.includes("..") || value.includes("://") || value.includes("/")) {
    throw new Error("controlled-corpus v2 account_ref must be a canonical safe account_ref");
  }
}

function snapshotStringArray(field: string, value: unknown, requireNonempty: boolean): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`controlled-corpus v2 ${field} must be an array`);
  }
  let length: number;
  try {
    length = value.length;
  } catch {
    throw new Error("controlled-corpus v2 output rejected");
  }
  if (!Number.isInteger(length) || length < 0 || length > 100) {
    throw new Error(`controlled-corpus v2 ${field} length rejected`);
  }
  if (requireNonempty && length === 0) {
    throw new Error(`${field} must be nonempty`);
  }
  const snapshot: string[] = [];
  for (let index = 0; index < length; index += 1) {
    let entry: unknown;
    try {
      entry = value[index];
    } catch {
      throw new Error("controlled-corpus v2 output rejected");
    }
    assertSafeId(`${field}[${index}]`, entry);
    snapshot.push(entry);
  }
  return Object.freeze(snapshot);
}

function assertArray(field: string, value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`controlled-corpus v2 ${field} must be an array`);
  }
  let length: number;
  try {
    length = value.length;
  } catch {
    throw new Error("controlled-corpus v2 output rejected");
  }
  if (!Number.isInteger(length) || length < 0 || length > 100) {
    throw new Error(`controlled-corpus v2 ${field} length rejected`);
  }
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    try {
      snapshot.push(value[index]);
    } catch {
      throw new Error("controlled-corpus v2 output rejected");
    }
  }
  return Object.freeze(snapshot);
}

function rejectDisplayNameOnlyAccount(object: unknown): void {
  const displayAccount = optionalOwnDataValue(object, "account");
  if (displayAccount !== undefined) {
    throw new Error("controlled-corpus v2 account_ref is required; display-name-only account labels are rejected");
  }
}

function snapshotExcerpt(value: unknown): ControlledCorpusV2Excerpt {
  rejectDisplayNameOnlyAccount(value);
  const id = ownDataValue(value, "id");
  const accountRef = ownDataValue(value, "account_ref");
  assertSafeId("excerpt.id", id);
  assertAccountRef(accountRef);
  const text = optionalOwnDataValue(value, "text");
  if (text !== undefined && typeof text !== "string") {
    throw new Error("controlled-corpus v2 excerpt text must be a string when present");
  }
  return Object.freeze({ id, account_ref: accountRef, ...(text === undefined ? {} : { text }) });
}

function snapshotClaim(value: unknown): ControlledCorpusV2Claim {
  rejectDisplayNameOnlyAccount(value);
  const id = ownDataValue(value, "id");
  const accountRef = ownDataValue(value, "account_ref");
  assertSafeId("claim.id", id);
  assertAccountRef(accountRef);
  const claim = optionalOwnDataValue(value, "claim");
  if (claim !== undefined && typeof claim !== "string") {
    throw new Error("controlled-corpus v2 claim text must be a string when present");
  }
  const supportingIds = snapshotStringArray("claim supporting_excerpt_ids", ownDataValue(value, "supporting_excerpt_ids"), true);
  return Object.freeze({
    id,
    account_ref: accountRef,
    ...(claim === undefined ? {} : { claim }),
    supporting_excerpt_ids: supportingIds,
  });
}

function snapshotAccountObject(value: unknown): ControlledCorpusV2AccountObject {
  rejectDisplayNameOnlyAccount(value);
  const id = ownDataValue(value, "id");
  const accountRef = ownDataValue(value, "account_ref");
  assertSafeId("account_object.id", id);
  assertAccountRef(accountRef);
  const type = optionalOwnDataValue(value, "type");
  if (type !== undefined && typeof type !== "string") {
    throw new Error("controlled-corpus v2 account_object type must be a string when present");
  }
  const summary = optionalOwnDataValue(value, "summary");
  if (summary !== undefined && typeof summary !== "string") {
    throw new Error("controlled-corpus v2 account_object summary must be a string when present");
  }
  const supportingIds = snapshotStringArray(
    "account_object supporting_excerpt_ids",
    ownDataValue(value, "supporting_excerpt_ids"),
    true,
  );
  return Object.freeze({
    id,
    account_ref: accountRef,
    ...(type === undefined ? {} : { type }),
    ...(summary === undefined ? {} : { summary }),
    supporting_excerpt_ids: supportingIds,
  });
}

function validateSupport(
  owner: { account_ref: string; supporting_excerpt_ids: readonly string[] },
  excerptById: ReadonlyMap<string, ControlledCorpusV2Excerpt>,
): void {
  for (const excerptId of owner.supporting_excerpt_ids) {
    const excerpt = excerptById.get(excerptId);
    if (!excerpt) {
      throw new Error("controlled-corpus v2 supporting_excerpt_ids must resolve to known excerpt ids");
    }
    if (excerpt.account_ref !== owner.account_ref) {
      throw new Error("controlled-corpus v2 account_ref must match supporting excerpt account_ref");
    }
  }
}

function validateTopLevel(value: unknown): { excerpts: readonly unknown[]; claims: readonly unknown[]; account_objects: readonly unknown[] } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("controlled-corpus v2 output must be an object");
  }
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(TOP_LEVEL_KEYS)) {
    throw new Error("controlled-corpus v2 output must have exact top-level keys");
  }
  return {
    excerpts: assertArray("excerpts", ownDataValue(value, "excerpts")),
    claims: assertArray("claims", ownDataValue(value, "claims")),
    account_objects: assertArray("account_objects", ownDataValue(value, "account_objects")),
  };
}

export function validateControlledCorpusV2ModelOnlyOutput(input: unknown): ControlledCorpusV2ValidationResult {
  try {
    const topLevel = validateTopLevel(input);
    const excerpts = Object.freeze(topLevel.excerpts.map(snapshotExcerpt));
    const claims = Object.freeze(topLevel.claims.map(snapshotClaim));
    const accountObjects = Object.freeze(topLevel.account_objects.map(snapshotAccountObject));

    const excerptById = new Map<string, ControlledCorpusV2Excerpt>();
    for (const excerpt of excerpts) {
      if (excerptById.has(excerpt.id)) {
        throw new Error("controlled-corpus v2 excerpt ids must be unique");
      }
      excerptById.set(excerpt.id, excerpt);
    }
    for (const claim of claims) validateSupport(claim, excerptById);
    for (const accountObject of accountObjects) validateSupport(accountObject, excerptById);

    const output = Object.freeze({ excerpts, claims, account_objects: accountObjects });
    const accountRefs = Object.freeze([...new Set([...excerpts, ...claims, ...accountObjects].map((item) => item.account_ref))].sort());
    return Object.freeze({
      output,
      counts: Object.freeze({ excerpts: excerpts.length, claims: claims.length, account_objects: accountObjects.length }),
      account_refs: accountRefs,
      provenance_complete: true,
    });
  } catch (error) {
    if (error instanceof Error && /^controlled-corpus v2 /.test(error.message)) {
      throw error;
    }
    if (error instanceof Error && /must be nonempty/.test(error.message)) {
      throw error;
    }
    throw new Error("controlled-corpus v2 output rejected");
  }
}

export function parseControlledCorpusV2ModelOnlyOutput(outputText: string): ControlledCorpusV2ValidationResult {
  if (typeof outputText !== "string" || outputText.trim() !== outputText || outputText.startsWith("```")) {
    throw new Error("controlled-corpus v2 output must be strict JSON text");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("controlled-corpus v2 output must be strict JSON text");
  }
  return validateControlledCorpusV2ModelOnlyOutput(parsed);
}
