import { types as nodeUtilTypes } from "node:util";

import { emptyMetrics, type ValidationReport } from "./report.ts";
import { parseGraphBundle, type SchemaError } from "./schema.ts";
import type { SubjectScope } from "./subject.ts";
import type { GraphBundle } from "./types.ts";
import { validateGraphBundle } from "./validate.ts";

export const VALIDATED_CANDIDATE_KIND =
  "atliera_validated_candidate" as const;
export const VALIDATED_CANDIDATE_VERSION = 1 as const;

/**
 * Serializable authority boundary for graph-backed presentation.
 *
 * The envelope deliberately carries no store revision, integrity hash, or
 * durable-source metadata. Those belong to later persistence boundaries.
 */
export interface ValidatedCandidate {
  readonly kind: typeof VALIDATED_CANDIDATE_KIND;
  readonly version: typeof VALIDATED_CANDIDATE_VERSION;
  readonly subject: Readonly<SubjectScope>;
  readonly graph_bundle: GraphBundle;
}

export class ValidatedCandidateBoundaryError extends Error {
  constructor(detail: string) {
    super(`Validated candidate refused: ${detail}`);
    this.name = "ValidatedCandidateBoundaryError";
  }
}

/** Kept under the established name so CLI report handling remains useful. */
export class WorkshopGraphValidationError extends Error {
  readonly report: ValidationReport;

  constructor(report: ValidationReport) {
    super(
      `Workshop graph validation failed with ${report.hard_failures.length} hard failure${report.hard_failures.length === 1 ? "" : "s"}`,
    );
    this.name = "WorkshopGraphValidationError";
    this.report = report;
  }
}

type JsonSnapshot =
  | null
  | boolean
  | number
  | string
  | JsonSnapshot[]
  | { [key: string]: JsonSnapshot };

function refuse(detail: string): never {
  throw new ValidatedCandidateBoundaryError(detail);
}

function childPath(path: string, key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)
    ? `${path}.${key}`
    : `${path}.[property]`;
}

/**
 * Copies only recursively plain JSON own-data. Proxy detection precedes every
 * reflective operation, and accessors are inspected as descriptors rather
 * than read, so rejected inputs cannot execute getters or Proxy traps.
 */
function snapshotJsonOwnData(
  value: unknown,
  path: string,
  ancestors = new WeakSet<object>(),
): JsonSnapshot {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      refuse(`${path} must contain a stable finite JSON number`);
    }
    return value;
  }
  if (typeof value !== "object") {
    refuse(`${path} must contain JSON data only`);
  }
  if (nodeUtilTypes.isProxy(value)) {
    refuse(`${path} must not be Proxy-backed`);
  }

  let prototype: object | null;
  let symbols: symbol[];
  let descriptors: Record<string, PropertyDescriptor>;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    symbols = Object.getOwnPropertySymbols(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      string,
      PropertyDescriptor
    >;
  } catch {
    refuse(`${path} own-data descriptors are unavailable`);
  }
  if (symbols.length !== 0) {
    refuse(`${path} must not carry symbol keys`);
  }
  if (ancestors.has(value)) {
    refuse(`${path} must not be cyclic`);
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) {
        refuse(`${path} must use the ordinary Array prototype`);
      }
      const lengthDescriptor = descriptors.length;
      const length =
        lengthDescriptor !== undefined && "value" in lengthDescriptor
          ? lengthDescriptor.value
          : undefined;
      if (
        typeof length !== "number" ||
        !Number.isSafeInteger(length) ||
        length < 0
      ) {
        refuse(`${path}.length must be a non-negative safe integer`);
      }

      const descriptorKeys = Object.keys(descriptors);
      if (descriptorKeys.length !== length + 1) {
        refuse(`${path} must be dense and carry no extra properties`);
      }
      for (const key of descriptorKeys) {
        if (key === "length") continue;
        const index = Number(key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= length ||
          String(index) !== key
        ) {
          refuse(`${path} must carry indexed array elements only`);
        }
      }

      const out: JsonSnapshot[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          !descriptor.enumerable
        ) {
          refuse(`${path}[${index}] must be enumerable own-data`);
        }
        out.push(
          snapshotJsonOwnData(
            descriptor.value,
            `${path}[${index}]`,
            ancestors,
          ),
        );
      }
      return out;
    }

    if (prototype !== Object.prototype) {
      refuse(`${path} must use the ordinary Object prototype`);
    }
    const out: { [key: string]: JsonSnapshot } = {};
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor) || !descriptor.enumerable) {
        refuse(`${childPath(path, key)} must be enumerable own-data`);
      }
      Object.defineProperty(out, key, {
        value: snapshotJsonOwnData(
          descriptor.value,
          childPath(path, key),
          ancestors,
        ),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return out;
  } finally {
    ancestors.delete(value);
  }
}

function graphSchemaReport(errors: readonly SchemaError[]): ValidationReport {
  return {
    ok: false,
    hard_failures: errors.map((error) => ({
      code: error.kind === "unknown_field" ? "unknown_field" : "schema_parse_failure",
      message: `${error.path}: ${error.message}`,
    })),
    metrics: emptyMetrics(),
  };
}

function exactRecordKeys(
  value: JsonSnapshot,
  expected: readonly string[],
  label: string,
): asserts value is { [key: string]: JsonSnapshot } {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    refuse(`${label} must be an exact plain object`);
  }
  const keys = Object.keys(value);
  if (
    keys.length !== expected.length ||
    expected.some((key) => !Object.hasOwn(value, key))
  ) {
    refuse(`${label} fields must exactly match the versioned envelope`);
  }
}

function parseSubject(value: JsonSnapshot): SubjectScope {
  exactRecordKeys(value, ["team_id", "account_id"], "candidate.subject");
  if (
    typeof value.team_id !== "string" ||
    typeof value.account_id !== "string"
  ) {
    refuse("candidate.subject fields must be strings");
  }
  return {
    team_id: value.team_id,
    account_id: value.account_id,
  };
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) deepFreeze(descriptor.value);
  }
  return Object.freeze(value);
}

function acceptSnapshot(snapshot: JsonSnapshot): ValidatedCandidate {
  exactRecordKeys(
    snapshot,
    ["kind", "version", "subject", "graph_bundle"],
    "candidate",
  );
  if (snapshot.kind !== VALIDATED_CANDIDATE_KIND) {
    refuse("candidate.kind is unsupported");
  }
  if (snapshot.version !== VALIDATED_CANDIDATE_VERSION) {
    refuse("candidate.version is unsupported");
  }

  const subject = parseSubject(snapshot.subject!);
  const parsed = parseGraphBundle(snapshot.graph_bundle!);
  if (!parsed.ok) {
    throw new WorkshopGraphValidationError(graphSchemaReport(parsed.errors));
  }
  const report = validateGraphBundle(parsed.value, {
    mode: "validation",
    subject,
  });
  if (!report.ok) {
    throw new WorkshopGraphValidationError(report);
  }

  return deepFreeze({
    kind: VALIDATED_CANDIDATE_KIND,
    version: VALIDATED_CANDIDATE_VERSION,
    subject,
    graph_bundle: parsed.value,
  }) as ValidatedCandidate;
}

/** Construct a candidate from a raw graph and caller-authoritative subject. */
export function createValidatedCandidate(
  graphBundle: unknown,
  subject: unknown,
): ValidatedCandidate {
  const graphSnapshot = snapshotJsonOwnData(graphBundle, "graph_bundle");
  const subjectSnapshot = snapshotJsonOwnData(subject, "subject");
  return acceptSnapshot({
    kind: VALIDATED_CANDIDATE_KIND,
    version: VALIDATED_CANDIDATE_VERSION,
    subject: subjectSnapshot,
    graph_bundle: graphSnapshot,
  });
}

/** Rehydrate and fully revalidate a candidate received through JSON or `unknown`. */
export function hydrateValidatedCandidate(raw: unknown): ValidatedCandidate {
  return acceptSnapshot(snapshotJsonOwnData(raw, "candidate"));
}
