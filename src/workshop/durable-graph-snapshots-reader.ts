import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { types as nodeUtilTypes } from "node:util";

import { parseGraphBundle } from "../graph/schema.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import type { GraphBundle } from "../graph/types.ts";
import {
  ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
  ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION,
  type DurableGraphSnapshotRow,
} from "./proposal-durable-graph-write-execution.ts";

export const GRAPH_SNAPSHOTS_RELATIVE_PATH = "tables/graph_snapshots.jsonl" as const;

const SAFE_ROW_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,160}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_JSON_SNAPSHOT_DEPTH = 24;
const MAX_JSON_ARRAY_LENGTH = 10_000;

const ROW_KEYS = Object.freeze([
  "kind",
  "schema_version",
  "durable_record_id",
  "idempotency_key",
  "approval_id",
  "contract_artifact_id",
  "account_id",
  "candidate_item_id",
  "operator_identity",
  "mediation_gate_level",
  "trust_label",
  "written_at",
  "bundle",
] as const);

type RowKey = (typeof ROW_KEYS)[number];
type SnapshotRecord = Readonly<Record<string, unknown>>;

export interface ReadDurableGraphSnapshotRowsOptions {
  readonly dbRootDir: string;
}

function isValidIsoTimestamp(value: string): boolean {
  if (!ISO_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const canonical = parsed.toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value;
}

function snapshotOwnDataRecord(value: unknown, label: string): SnapshotRecord {
  // H3 provenance from PR #271 / M3 3a retro: refuse Proxy-backed rows before
  // descriptor reflection, because descriptor reflection itself can execute
  // Proxy traps.
  if (nodeUtilTypes.isProxy(value)) {
    throw new Error(`${label} must not be a Proxy`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain own-data object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain own-data object`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`${label} must not carry symbol keys`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`${label} contains unsafe key`);
    }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new Error(`${label} must be a plain own-data object`);
    }
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

export function snapshotPlainJsonValue(
  value: unknown,
  label: string,
  depth = 0,
): unknown {
  if (depth > MAX_JSON_SNAPSHOT_DEPTH) {
    throw new Error(`${label} exceeds maximum snapshot depth`);
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`${label} must be JSON-serializable`);
    }
    return value;
  }
  if (nodeUtilTypes.isProxy(value)) {
    throw new Error(`${label} must not be a Proxy`);
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new Error(`${label} must be a plain own-data array`);
    }
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_JSON_ARRAY_LENGTH) {
      throw new Error(`${label} array length invalid`);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new Error(`${label} must not carry symbol keys`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const out: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new Error(`${label} must contain only enumerable own-data array items`);
      }
      out.push(snapshotPlainJsonValue(descriptor.value, `${label}[${index}]`, depth + 1));
    }
    return Object.freeze(out);
  }
  if (typeof value !== "object") {
    throw new Error(`${label} must be JSON-serializable`);
  }
  const record = snapshotOwnDataRecord(value, label);
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    out[key] = snapshotPlainJsonValue(item, `${label}.${key}`, depth + 1);
  }
  return Object.freeze(out);
}

function assertExactRowKeys(record: SnapshotRecord, label: string): void {
  const expected = new Set<string>(ROW_KEYS);
  const actual = Object.keys(record);
  if (actual.length !== ROW_KEYS.length) {
    throw new Error(`${label} must carry exactly the durable graph snapshot row keys`);
  }
  for (const key of actual) {
    if (!expected.has(key)) {
      throw new Error(`${label} contains an unexpected durable graph snapshot row key`);
    }
  }
}

function requireSafeString(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_ROW_ID.test(value)) {
    throw new Error(`${label} must be a safe string`);
  }
  return value;
}

function requireIsoString(value: unknown, label: string): string {
  if (typeof value !== "string" || !isValidIsoTimestamp(value)) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return value;
}

function validatedBundle(value: unknown, label: string): GraphBundle {
  const bundleSnapshot = snapshotPlainJsonValue(value, label);
  const parsed = parseGraphBundle(bundleSnapshot);
  if (!parsed.ok) {
    throw new Error(`${label} failed graph bundle parsing`);
  }
  const report = validateGraphBundle(parsed.value, { mode: "fixture" });
  if (!report.ok) {
    throw new Error(`${label} failed graph bundle validation`);
  }
  return parsed.value;
}

function assertPendingRowDoesNotCarryVerifiedRecords(row: DurableGraphSnapshotRow, label: string): void {
  if (row.trust_label !== "model-proposed-human-ratified-evidence-pending") return;
  if (
    row.bundle.claims.some((claim) => claim.provenance_status === "verified") ||
    row.bundle.account_objects.some((accountObject) => accountObject.provenance_status === "verified")
  ) {
    throw new Error(`${label} pending-review durable row must not carry verified records`);
  }
}

export function snapshotDurableGraphSnapshotRow(
  value: unknown,
  label = "durable graph snapshot row",
): DurableGraphSnapshotRow {
  const row = snapshotOwnDataRecord(value, label);
  assertExactRowKeys(row, label);

  if (row.kind !== ATLIERA_GRAPH_SNAPSHOT_ROW_KIND) {
    throw new Error(`${label}.kind is not a graph snapshot row`);
  }
  if (row.schema_version !== ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION) {
    throw new Error(`${label}.schema_version is unsupported`);
  }
  if (row.mediation_gate_level !== "L0") {
    throw new Error(`${label}.mediation_gate_level must remain L0`);
  }

  const snapshot = Object.freeze({
    kind: ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
    schema_version: ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION,
    durable_record_id: requireSafeString(row.durable_record_id, `${label}.durable_record_id`),
    idempotency_key: requireSafeString(row.idempotency_key, `${label}.idempotency_key`),
    approval_id: requireSafeString(row.approval_id, `${label}.approval_id`),
    contract_artifact_id: requireSafeString(row.contract_artifact_id, `${label}.contract_artifact_id`),
    account_id: requireSafeString(row.account_id, `${label}.account_id`),
    candidate_item_id: requireSafeString(row.candidate_item_id, `${label}.candidate_item_id`),
    operator_identity: requireSafeString(row.operator_identity, `${label}.operator_identity`),
    mediation_gate_level: "L0" as const,
    trust_label: requireSafeString(row.trust_label, `${label}.trust_label`),
    written_at: requireIsoString(row.written_at, `${label}.written_at`),
    bundle: validatedBundle(row.bundle, `${label}.bundle`),
  });
  assertPendingRowDoesNotCarryVerifiedRecords(snapshot, label);
  return snapshot;
}

export async function readDurableGraphSnapshotRows(
  options: ReadDurableGraphSnapshotRowsOptions,
): Promise<readonly DurableGraphSnapshotRow[]> {
  const path = join(options.dbRootDir, GRAPH_SNAPSHOTS_RELATIVE_PATH);
  const text = await readFile(path, "utf8");
  const rows: DurableGraphSnapshotRow[] = [];
  let lineNumber = 0;
  for (const line of text.split("\n")) {
    lineNumber += 1;
    if (line.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`graph_snapshots.jsonl line ${lineNumber} is not valid JSON`);
    }
    rows.push(snapshotDurableGraphSnapshotRow(parsed, `graph_snapshots.jsonl line ${lineNumber}`));
  }
  return Object.freeze(rows);
}
