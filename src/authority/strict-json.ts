import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

export type StrictJsonValue =
  | null
  | boolean
  | number
  | string
  | StrictJsonValue[]
  | { [key: string]: StrictJsonValue };

export interface StrictJsonLimits {
  readonly max_array_length: number;
  readonly max_depth: number;
  readonly max_expanded_json_value_occurrences: number;
  readonly max_nodes: number;
  readonly max_object_fields: number;
  readonly max_string_utf8_bytes: number;
  readonly max_total_string_utf8_bytes: number;
}

export class StrictJsonBoundaryError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "StrictJsonBoundaryError";
  }
}

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function hasUnpairedUtf16Surrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function childPath(path: string, key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)
    ? `${path}.${key}`
    : `${path}.[property]`;
}

interface SnapshotBudget {
  expandedJsonValueOccurrences: number;
  nodes: number;
  stringBytes: number;
}

type SnapshotStringKind = "property name" | "string value";

function snapshotString(
  value: string,
  path: string,
  limits: StrictJsonLimits,
  budget: SnapshotBudget,
  kind: SnapshotStringKind,
): string {
  if (hasUnpairedUtf16Surrogate(value)) {
    throw new StrictJsonBoundaryError(
      `${path} ${kind} must contain Unicode scalar values only`,
    );
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > limits.max_string_utf8_bytes) {
    throw new StrictJsonBoundaryError(
      `${path} ${kind} exceeds the string-size bound`,
    );
  }
  if (bytes > limits.max_total_string_utf8_bytes - budget.stringBytes) {
    throw new StrictJsonBoundaryError(
      `${path} ${kind} exceeds the cumulative string-size bound`,
    );
  }
  budget.stringBytes += bytes;
  return value;
}

function snapshotValue(
  value: unknown,
  path: string,
  limits: StrictJsonLimits,
  budget: SnapshotBudget,
  depth: number,
  ancestors: WeakSet<object>,
): StrictJsonValue {
  if (
    budget.expandedJsonValueOccurrences >=
    limits.max_expanded_json_value_occurrences
  ) {
    throw new StrictJsonBoundaryError(
      `${path} exceeds the expanded serialized-value-occurrence bound`,
    );
  }
  budget.expandedJsonValueOccurrences += 1;
  if (depth > limits.max_depth) {
    throw new StrictJsonBoundaryError(`${path} exceeds the nesting-depth bound`);
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return snapshotString(value, path, limits, budget, "string value");
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new StrictJsonBoundaryError(`${path} must be a stable finite JSON number`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new StrictJsonBoundaryError(`${path} must contain JSON data only`);
  }
  if (nodeUtilTypes.isProxy(value)) {
    throw new StrictJsonBoundaryError(`${path} must not be Proxy-backed`);
  }
  let prototype: object | null;
  let isArray: boolean;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    isArray = Array.isArray(value);
  } catch {
    throw new StrictJsonBoundaryError(`${path} own-data descriptors are unavailable`);
  }
  if (budget.nodes >= limits.max_nodes) {
    throw new StrictJsonBoundaryError(`${path} exceeds the node-count bound`);
  }
  budget.nodes += 1;
  if (ancestors.has(value)) {
    throw new StrictJsonBoundaryError(`${path} must not be cyclic`);
  }
  ancestors.add(value);

  try {
    if (isArray) {
      if (prototype !== Array.prototype) {
        throw new StrictJsonBoundaryError(`${path} must use Array.prototype`);
      }
      let lengthDescriptor: PropertyDescriptor | undefined;
      try {
        lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      } catch {
        throw new StrictJsonBoundaryError(`${path} own-data descriptors are unavailable`);
      }
      const length =
        lengthDescriptor !== undefined && "value" in lengthDescriptor
          ? lengthDescriptor.value
          : undefined;
      if (
        typeof length !== "number" ||
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > limits.max_array_length
      ) {
        throw new StrictJsonBoundaryError(`${path} exceeds the dense-array bound`);
      }
      let propertyNames: string[];
      let symbols: symbol[];
      try {
        propertyNames = Object.getOwnPropertyNames(value);
        symbols = Object.getOwnPropertySymbols(value);
      } catch {
        throw new StrictJsonBoundaryError(`${path} own-data descriptors are unavailable`);
      }
      if (symbols.length !== 0) {
        throw new StrictJsonBoundaryError(`${path} must not carry symbol keys`);
      }
      if (propertyNames.length !== length + 1) {
        throw new StrictJsonBoundaryError(
          `${path} must be dense and carry indexed elements only`,
        );
      }
      for (const key of propertyNames) {
        if (key === "length") continue;
        const index = Number(key);
        if (
          !Number.isSafeInteger(index) ||
          index < 0 ||
          index >= length ||
          String(index) !== key
        ) {
          throw new StrictJsonBoundaryError(
            `${path} must be dense and carry indexed elements only`,
          );
        }
      }
      const out: StrictJsonValue[] = [];
      for (let index = 0; index < length; index += 1) {
        let descriptor: PropertyDescriptor | undefined;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        } catch {
          throw new StrictJsonBoundaryError(`${path} own-data descriptors are unavailable`);
        }
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new StrictJsonBoundaryError(`${path}[${index}] must be enumerable own-data`);
        }
        out.push(
          snapshotValue(
            descriptor.value,
            `${path}[${index}]`,
            limits,
            budget,
            depth + 1,
            ancestors,
          ),
        );
      }
      return out;
    }

    if (prototype !== Object.prototype) {
      throw new StrictJsonBoundaryError(`${path} must use Object.prototype`);
    }
    let propertyNames: string[];
    let symbols: symbol[];
    try {
      propertyNames = Object.getOwnPropertyNames(value);
      symbols = Object.getOwnPropertySymbols(value);
    } catch {
      throw new StrictJsonBoundaryError(`${path} own-data descriptors are unavailable`);
    }
    if (symbols.length !== 0) {
      throw new StrictJsonBoundaryError(`${path} must not carry symbol keys`);
    }
    if (propertyNames.length > limits.max_object_fields) {
      throw new StrictJsonBoundaryError(`${path} exceeds the object-field bound`);
    }
    for (const key of propertyNames) {
      if (DANGEROUS_KEYS.has(key)) {
        throw new StrictJsonBoundaryError(`${path} carries a forbidden property key`);
      }
    }
    for (const key of propertyNames) {
      snapshotString(key, path, limits, budget, "property name");
    }
    const out: { [key: string]: StrictJsonValue } = {};
    for (const key of propertyNames) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        throw new StrictJsonBoundaryError(`${path} own-data descriptors are unavailable`);
      }
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new StrictJsonBoundaryError(
          `${childPath(path, key)} must be enumerable own-data`,
        );
      }
      Object.defineProperty(out, key, {
        value: snapshotValue(
          descriptor.value,
          childPath(path, key),
          limits,
          budget,
          depth + 1,
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

export function snapshotStrictJson(
  value: unknown,
  path: string,
  limits: StrictJsonLimits,
): StrictJsonValue {
  return snapshotValue(
    value,
    path,
    limits,
    { expandedJsonValueOccurrences: 0, nodes: 0, stringBytes: 0 },
    0,
    new WeakSet<object>(),
  );
}

export function strictJsonObject(
  value: StrictJsonValue,
  path: string,
): { [key: string]: StrictJsonValue } {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new StrictJsonBoundaryError(`${path} must be a plain object`);
  }
  return value;
}

export function strictJsonArray(
  value: StrictJsonValue | undefined,
  path: string,
  max: number,
  requireNonEmpty = false,
): StrictJsonValue[] {
  if (!Array.isArray(value) || value.length > max || (requireNonEmpty && value.length === 0)) {
    throw new StrictJsonBoundaryError(`${path} must be a bounded${requireNonEmpty ? " non-empty" : ""} array`);
  }
  return value;
}

export function assertExactKeys(
  value: { [key: string]: StrictJsonValue },
  expected: readonly string[],
  path: string,
): void {
  const keys = Object.keys(value);
  if (
    keys.length !== expected.length ||
    expected.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new StrictJsonBoundaryError(`${path} fields must exactly match the versioned contract`);
  }
}

export function canonicalJson(value: StrictJsonValue): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`)
    .join(",")}}`;
}

export function sha256CanonicalJson(value: StrictJsonValue): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function deepFreezeOwnData<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) deepFreezeOwnData(descriptor.value);
  }
  return Object.freeze(value);
}
