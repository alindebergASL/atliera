import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/workshop-public-proposal-durable-graph-write-execution-status.md");
const INDEX = join(ROOT, "docs/runbooks/INDEX.md");
const MODULE = join(ROOT, "src/workshop/proposal-durable-graph-write-execution.ts");

function read(path: string): string { return readFileSync(path, "utf8"); }

test("executor status runbook records the L0-only-on-real-effects discipline and the refusal enumeration", () => {
  const status = read(STATUS);
  assert.match(status, /# Workshop Public Proposal Durable Graph-Write Execution Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /the slice where `graph_ingestion_performed` and `durable_writes_performed` first flip/i);
  assert.match(status, /A `completed` outcome stamps `mediation_gate_level: "L0"`/i);
  assert.match(status, /A `refused` outcome carries no `mediation_gate_level` field at all/i);
  assert.match(status, /single-transaction-or-noop/i);
  assert.match(status, /Arming\/contract\/approval-packet artifacts are own-data-snapshotted and Proxy-refused before field reads/i);
  assert.match(status, /canonical `accountId:candidateItemId:ratified-durable-write-v1` shape/i);
  assert.match(status, /single attributable ratifier id is recorded on the bundle's AuditEvent/i);
  assert.match(status, /Ratified graph records are not marked `verified`/i);
  assert.match(status, /model-proposed-human-ratified-evidence-pending/i);
  assert.match(status, /No roles, no sessions/i);
  // The DOD reject-path enumeration must be present in the doc.
  for (const code of [
    "arming_kind_invalid", "arming_lifecycle_not_armed", "arming_authorization_marker_missing",
    "arming_approval_id_mismatch_against_packet", "arming_contract_artifact_id_mismatch_against_contract",
    "arming_expired_at_call_time", "arming_authorizes_wrong_candidate",
    "arming_already_consumed_against_durable_state", "contract_kind_invalid", "contract_boundary_broadened",
    "materialization_input_missing_record", "graph_bundle_validation_failed", "durable_db_unreachable",
    "transaction_aborted_mid_write",
  ]) {
    assert.ok(status.includes(code), `status must enumerate refusal_code ${code}`);
  }
});

test("runbook index classifies the executor status once and frames it as the marker-flip slice", () => {
  const index = read(INDEX);
  const rowCount = index.split("| `workshop-public-proposal-durable-graph-write-execution-status.md` |").length - 1;
  assert.equal(rowCount, 1);
  const row = index.split("\n").find((l) => l.includes("| `workshop-public-proposal-durable-graph-write-execution-status.md` |"));
  assert.ok(row);
  assert.match(row, /active/i);
  assert.match(row, /the slice where graph_ingestion_performed and durable_writes_performed first flip/i);
});

test("executor module imports are bounded and the refusal-code enumeration matches the runbook", () => {
  const moduleText = read(MODULE);
  // Module restricts its surface to node:fs/promises + node:path +
  // node:util Proxy detection + Atliera types.
  // It must NOT pull in providers, env, or fetch.
  for (const forbidden of ["node:child_process", "process.env", "fetch(", "require("]) {
    assert.ok(!moduleText.includes(forbidden), `executor module must not contain ${JSON.stringify(forbidden)}`);
  }
  // Allowed node imports.
  for (const allowed of ['from "node:fs/promises"', 'from "node:path"', 'from "node:util"']) {
    assert.ok(moduleText.includes(allowed), `executor module expected import ${allowed}`);
  }
  // The refusal-code enumeration in the source matches what the doc enumerates.
  const codes = [
    "arming_kind_invalid", "arming_lifecycle_not_armed", "arming_authorization_marker_missing",
    "arming_approval_id_mismatch_against_packet", "arming_contract_artifact_id_mismatch_against_contract",
    "arming_expired_at_call_time", "arming_authorizes_wrong_candidate",
    "arming_already_consumed_against_durable_state", "contract_kind_invalid", "contract_boundary_broadened",
    "materialization_input_missing_record", "graph_bundle_validation_failed", "durable_db_unreachable",
    "transaction_aborted_mid_write",
  ];
  for (const code of codes) {
    assert.ok(moduleText.includes(`"${code}"`), `executor module must define refusal_code ${code}`);
  }
});
