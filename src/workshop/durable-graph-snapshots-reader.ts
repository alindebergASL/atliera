// Workshop public proposal — durable graph-snapshots reader (read-only).
//
// M3 step 3b. Reads rows from local-durable-db's graph_snapshots.jsonl
// and yields them as frozen, fully-validated DurableGraphSnapshotRow
// values for downstream rendering.
//
// Doctrine alignment (M3 step 3a retro, §3): every field used for a
// control-flow or trust decision is re-snapshotted at the trust
// boundary. The reader treats each row with the same suspicion the
// executor treats arming artifacts. A row could in principle be
// malformed, accessor-backed, or Proxy-backed — the reader refuses
// such rows before any field read. This is the second call site for
// the descriptor-snapshot + util.types.isProxy discipline; the
// consolidated H3 primitive will absorb both this and the executor
// when the H-track freeze lifts.
//
// The reader is strictly read-only. It performs no provider call, no
// graph-state mutation, no production write, and never decrements the
// arming consumption counters. It exists to satisfy 3b's done-
// criterion ("Workshop renders from durable state") with the same
// snapshot-and-revalidate-at-entry discipline 3a introduced.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { types as nodeUtilTypes } from "node:util";

import {
  ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
  ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION,
  type DurableGraphSnapshotRow,
} from "./proposal-durable-graph-write-execution.ts";
import { parseGraphBundle } from "../graph/schema.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import { PINNED_MEDIATION_GATE_LEVEL } from "./proposal-durable-graph-write-contract.ts";

export const WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_SNAPSHOTS_READER_NAME =
  "workshop-public-proposal-durable-graph-snapshots-reader" as const;

const GRAPH_SNAPSHOTS_RELATIVE_PATH = "tables/graph_snapshots.jsonl";

export type WorkshopProposalDurableSnapshotsReaderRefusalCode =
  | "durable_db_unreachable"
  | "row_proxy_backed"
  | "row_not_plain_own_data"
  | "row_symbol_keyed"
  | "row_unsafe_key"
  | "row_kind_invalid"
  | "row_schema_version_invalid"
  | "row_field_missing_or_malformed"
  | "row_mediation_gate_level_invalid"
  | "row_trust_label_invalid"
  | "row_bundle_invalid"
  | "row_bundle_marks_record_verified";

export interface WorkshopProposalDurableSnapshotsReaderRefusal {
  readonly refusal_code: WorkshopProposalDurableSnapshotsReaderRefusalCode;
  readonly refusal_detail: string;
  readonly row_index: number | null;
}

export interface WorkshopProposalDurableSnapshotsReaderResult {
  readonly source_path: string;
  readonly checked_at: string;
  readonly rows: readonly DurableGraphSnapshotRow[];
  readonly refusals: readonly WorkshopProposalDurableSnapshotsReaderRefusal[];
  // Doctrine markers — this reader writes nothing, ingests nothing.
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

const TRUST_LABEL = "model-proposed-human-ratified-evidence-pending" as const;

class RowRefusal extends Error {
  constructor(
    public readonly code: WorkshopProposalDurableSnapshotsReaderRefusalCode,
    public readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

function snapshotPlainRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  // Refuse Proxy-backed inputs before reflection. The retro made this
  // mandatory at every trust boundary.
  if (nodeUtilTypes.isProxy(value)) {
    throw new RowRefusal("row_proxy_backed", `${label} is Proxy-backed`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RowRefusal("row_not_plain_own_data", `${label} must be a plain own-data object`);
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new RowRefusal("row_not_plain_own_data", `${label} descriptors unavailable`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new RowRefusal("row_symbol_keyed", `${label} must not carry symbol keys`);
  }
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new RowRefusal("row_unsafe_key", `${label} contains unsafe key ${key}`);
    }
    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new RowRefusal("row_not_plain_own_data", `${label} must be a plain own-data object`);
    }
    out[key] = descriptor.value;
  }
  return Object.freeze(out);
}

// deepFreeze: recursively freeze a plain validated value so the snapshot
// the reader vouched for cannot be mutated after it crosses the read
// boundary. Operates only on the already-parsed, already-validated
// GraphBundle (plain objects and arrays); it does not invoke getters.
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

function requireString(record: Readonly<Record<string, unknown>>, key: string, label: string): string {
  const v = record[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new RowRefusal("row_field_missing_or_malformed", `${label}.${key} must be a non-empty string`);
  }
  return v;
}

function validateRow(value: unknown, index: number): DurableGraphSnapshotRow {
  const snap = snapshotPlainRecord(value, `row[${index}]`);

  // Kind + schema must be exact; refuse rows from any other writer.
  if (snap.kind !== ATLIERA_GRAPH_SNAPSHOT_ROW_KIND) {
    throw new RowRefusal("row_kind_invalid", `row[${index}].kind not ${ATLIERA_GRAPH_SNAPSHOT_ROW_KIND}`);
  }
  if (snap.schema_version !== ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION) {
    throw new RowRefusal("row_schema_version_invalid", `row[${index}].schema_version unexpected`);
  }

  // Required attribution fields.
  const durableRecordId = requireString(snap, "durable_record_id", `row[${index}]`);
  const idempotencyKey = requireString(snap, "idempotency_key", `row[${index}]`);
  const approvalId = requireString(snap, "approval_id", `row[${index}]`);
  const contractArtifactId = requireString(snap, "contract_artifact_id", `row[${index}]`);
  const accountId = requireString(snap, "account_id", `row[${index}]`);
  const candidateItemId = requireString(snap, "candidate_item_id", `row[${index}]`);
  const operatorIdentity = requireString(snap, "operator_identity", `row[${index}]`);
  const writtenAt = requireString(snap, "written_at", `row[${index}]`);

  // Doctrine pins.
  if (snap.mediation_gate_level !== PINNED_MEDIATION_GATE_LEVEL) {
    throw new RowRefusal("row_mediation_gate_level_invalid", `row[${index}].mediation_gate_level not L0`);
  }
  // NOTE on target_store: the current 3a write does not stamp
  // target_store on the row itself (it lives on the executor outcome,
  // pinned to local-durable-db). The row `kind` is the sufficient
  // discriminator here, so the reader does not enforce a row-level
  // target_store and carries no `row_target_store_invalid` refusal
  // code. If a future row-shape slice stamps target_store on the row,
  // that enforcement (and its refusal code) lands there, not here.

  if (snap.trust_label !== TRUST_LABEL) {
    throw new RowRefusal("row_trust_label_invalid", `row[${index}].trust_label not the M3 admission label`);
  }

  // Bundle: parse first so we can read provenance fields, then check
  // trust-tier discipline BEFORE running the full graph validator. The
  // trust-tier check is a row-level invariant orthogonal to graph
  // validity, and it must fire even if the validator would also reject
  // the bundle for a related reason — otherwise a "verified" record
  // could be hidden behind a graph-validity failure code in the audit
  // trail. The row-level invariant gets its own surfaced code.
  const parsed = parseGraphBundle(snap.bundle);
  if (!parsed.ok) {
    throw new RowRefusal("row_bundle_invalid", `row[${index}].bundle does not parse: ${parsed.errors[0]?.message ?? "unknown"}`);
  }

  // Trust-tier discipline (retro §1): per-record `provenance_status`
  // must NOT be `verified` on any record in a durable row. M3 admission
  // is human-ratified-evidence-pending; verification is M4 / M5b. The
  // reader refuses any row that contradicts this, so the render layer
  // never sees a Verified-marked record in a pending row. Checked
  // before the full graph validator so the row-level invariant gets
  // its own surfaced refusal code.
  for (const claim of parsed.value.claims) {
    if (claim.provenance_status === "verified") {
      throw new RowRefusal("row_bundle_marks_record_verified", `row[${index}].bundle.claims contains a verified claim under an M3 trust label`);
    }
  }
  for (const obj of parsed.value.account_objects) {
    if (obj.provenance_status === "verified") {
      throw new RowRefusal("row_bundle_marks_record_verified", `row[${index}].bundle.account_objects contains a verified object under an M3 trust label`);
    }
  }

  const report = validateGraphBundle(parsed.value, { mode: "fixture" });
  if (!report.ok) {
    throw new RowRefusal("row_bundle_invalid", `row[${index}].bundle does not validate: ${report.hard_failures[0]?.code ?? "unknown"}`);
  }

  // Deep-freeze the validated bundle before returning. A top-level
  // Object.freeze on the row is shallow: it leaves the nested bundle,
  // its arrays, and its records mutable, so a caller could flip a
  // per-record provenance_status to "verified" AFTER the read boundary
  // validated it — defeating the trust-tier guarantee at exactly the
  // point the render layer reads it. Deep-freezing seals the validated
  // value so the snapshot the reader vouched for is the snapshot the
  // renderer sees.
  const frozenBundle = deepFreeze(parsed.value);

  return Object.freeze({
    kind: ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
    schema_version: ATLIERA_GRAPH_SNAPSHOT_ROW_SCHEMA_VERSION,
    durable_record_id: durableRecordId,
    idempotency_key: idempotencyKey,
    approval_id: approvalId,
    contract_artifact_id: contractArtifactId,
    account_id: accountId,
    candidate_item_id: candidateItemId,
    operator_identity: operatorIdentity,
    mediation_gate_level: PINNED_MEDIATION_GATE_LEVEL,
    trust_label: TRUST_LABEL,
    written_at: writtenAt,
    bundle: frozenBundle,
  });
}

export interface ReadDurableSnapshotsOptions {
  readonly dbRootDir: string;
  readonly now: string;
}

export async function readWorkshopPublicProposalDurableGraphSnapshots(
  options: ReadDurableSnapshotsOptions,
): Promise<WorkshopProposalDurableSnapshotsReaderResult> {
  const sourcePath = join(options.dbRootDir, GRAPH_SNAPSHOTS_RELATIVE_PATH);

  let text: string;
  try {
    text = await readFile(sourcePath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return Object.freeze({
        source_path: sourcePath,
        checked_at: options.now,
        rows: Object.freeze([]) as readonly DurableGraphSnapshotRow[],
        refusals: Object.freeze([
          {
            refusal_code: "durable_db_unreachable" as const,
            refusal_detail: `graph_snapshots.jsonl not found at ${sourcePath}`,
            row_index: null,
          },
        ]),
        provider_calls_made: 0 as const,
        private_evidence_read: false as const,
        graph_ingestion_performed: false as const,
        durable_writes_performed: false as const,
        production_writes: false as const,
        readiness_claim: false as const,
      });
    }
    throw e;
  }

  const rows: DurableGraphSnapshotRow[] = [];
  const refusals: WorkshopProposalDurableSnapshotsReaderRefusal[] = [];
  const lines = text.split("\n");
  let rowIndex = 0;
  for (const line of lines) {
    if (line.trim() === "") continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch (e) {
      refusals.push({
        refusal_code: "row_field_missing_or_malformed",
        refusal_detail: `row ${rowIndex} is not parseable JSON: ${(e as Error).message}`,
        row_index: rowIndex,
      });
      rowIndex += 1;
      continue;
    }
    try {
      rows.push(validateRow(raw, rowIndex));
    } catch (e) {
      if (e instanceof RowRefusal) {
        refusals.push({ refusal_code: e.code, refusal_detail: e.detail, row_index: rowIndex });
      } else {
        throw e;
      }
    }
    rowIndex += 1;
  }

  return Object.freeze({
    source_path: sourcePath,
    checked_at: options.now,
    rows: Object.freeze(rows) as readonly DurableGraphSnapshotRow[],
    refusals: Object.freeze(refusals) as readonly WorkshopProposalDurableSnapshotsReaderRefusal[],
    provider_calls_made: 0 as const,
    private_evidence_read: false as const,
    graph_ingestion_performed: false as const,
    durable_writes_performed: false as const,
    production_writes: false as const,
    readiness_claim: false as const,
  });
}
