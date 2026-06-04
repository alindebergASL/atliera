export interface RuntimeSmokeV2Output {
  readonly excerpts: readonly unknown[];
  readonly claims: readonly unknown[];
  readonly account_objects: readonly Record<string, unknown>[];
}

const TOP_LEVEL_KEYS = ["account_objects", "claims", "excerpts"] as const;
const CANONICAL_ACCOUNT_OBJECT_TYPES = Object.freeze([
  "account_snapshot",
  "signal",
  "risk",
  "play",
  "map",
  "relationship",
  "milestone",
  "recommendation",
  "stakeholder",
  "initiative",
  "open_question",
] as const);

const RECOVERABLE_TYPE_MAP: ReadonlyMap<string, (typeof CANONICAL_ACCOUNT_OBJECT_TYPES)[number]> = new Map([
  ["product_preview_runtime_smoke_summary", "account_snapshot"],
]);

export function buildRuntimeSmokeRetryPromptAmendment(): string {
  return [
    "Allowed account_object.type values: account_snapshot, signal, risk, play, map, relationship, milestone, recommendation, stakeholder, initiative, open_question.",
    "product_preview_runtime_smoke_summary is not a valid output type; if you need a whole-account summary, use account_snapshot.",
    "Return strict JSON only, keep account_ref canonical, and do not add provider-specific or prompt-specific type labels.",
    "This amendment is a no-spend prompt contract remediation only; it does not approve a provider call or retry.",
  ].join("\n");
}

export function normalizeRuntimeSmokeV2AccountObjectTypes(input: unknown): RuntimeSmokeV2Output {
  const record = snapshotRecord(input, "runtime smoke v2 output");
  assertExactKeys(record, "runtime smoke v2 output", TOP_LEVEL_KEYS);
  const excerpts = snapshotArray(readOwn(record, "excerpts", "runtime smoke v2 output"), "excerpts");
  const claims = snapshotArray(readOwn(record, "claims", "runtime smoke v2 output"), "claims");
  const accountObjects = snapshotArray(readOwn(record, "account_objects", "runtime smoke v2 output"), "account_objects").map(
    normalizeAccountObject,
  );
  return Object.freeze({
    excerpts,
    claims,
    account_objects: Object.freeze(accountObjects),
  });
}

function normalizeAccountObject(input: unknown): Record<string, unknown> {
  const record = snapshotRecord(input, "runtime smoke account_object");
  const rawType = readOwn(record, "type", "runtime smoke account_object");
  if (typeof rawType !== "string") throw new Error("runtime smoke account_object type must be a string");
  const normalizedType = normalizeType(rawType);
  return Object.freeze({ ...record, type: normalizedType });
}

function normalizeType(value: string): string {
  const lowered = value.toLowerCase();
  if ((CANONICAL_ACCOUNT_OBJECT_TYPES as readonly string[]).includes(lowered)) return lowered;
  const mapped = RECOVERABLE_TYPE_MAP.get(lowered);
  if (mapped) return mapped;
  throw new Error("runtime smoke account_object type is not allowed");
}

function snapshotRecord(input: unknown, label: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be a plain record`);
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) throw new Error(`${label} must be a plain record`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable || !("value" in descriptor)) throw new Error(`${label} fields must be enumerable data properties`);
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

function snapshotArray(input: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(input)) throw new Error(`${label} must be an array`);
  let length: number;
  try {
    length = input.length;
  } catch {
    throw new Error(`${label} rejected`);
  }
  if (!Number.isInteger(length) || length < 0 || length > 100) throw new Error(`${label} length rejected`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const out: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new Error(`${label} elements must be data properties`);
    out.push(descriptor.value);
  }
  return Object.freeze(out);
}

function readOwn(record: Record<string, unknown>, key: string, label: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) throw new Error(`${label}.${key} is required`);
  return record[key];
}

function assertExactKeys(record: Record<string, unknown>, label: string, keys: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unexpected keys`);
  }
}
