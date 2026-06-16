// M3 step 3b — runbook + index contract.
//
// Locks the doc-as-doctrine convention: the status runbook records the
// load-bearing properties of the slice in greppable form, the runbook
// index classifies it exactly once as active, and the reader/render
// module imports stay bounded.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/workshop-public-proposal-durable-state-render-status.md");
const INDEX = join(ROOT, "docs/runbooks/INDEX.md");
const READER_MODULE = join(ROOT, "src/workshop/durable-graph-snapshots-reader.ts");
const RENDER_MODULE = join(ROOT, "src/workshop/durable-state-render.ts");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("3b status runbook records the read-only, visible-distinction, and trust-tier discipline", () => {
  const status = read(STATUS);
  assert.match(status, /# Workshop Public Proposal Durable State Render Status/);
  assert.match(status, /Status: active/);
  assert.match(status, /closes M3/);
  assert.match(status, /static HTML/);
  assert.match(status, /two visibly distinct sections/);
  assert.match(status, /model-proposed-human-ratified-evidence-pending/);
  assert.match(status, /source_document_only/);
  assert.match(status, /reserved for M4 \/ M5b/);
  assert.match(status, /util\.types\.isProxy/);
  assert.match(status, /BEFORE any descriptor reflection/);
  assert.match(status, /Not in graph/);
  // The reader's enumerated refusal codes are all present in the doc.
  for (const code of [
    "durable_db_unreachable",
    "row_proxy_backed",
    "row_not_plain_own_data",
    "row_symbol_keyed",
    "row_unsafe_key",
    "row_kind_invalid",
    "row_schema_version_invalid",
    "row_field_missing_or_malformed",
    "row_mediation_gate_level_invalid",
    "row_trust_label_invalid",
    "row_bundle_invalid",
    "row_bundle_marks_record_verified",
  ]) {
    assert.ok(status.includes(code), `status must enumerate refusal_code ${code}`);
  }
  // The honesty fix: target_store is documented as NOT enforced at the row
  // level, and the doc must not list it as a reachable refusal code.
  assert.match(status, /does not enforce a row-level `target_store`/);
  assert.ok(
    !status.includes("- row_target_store_invalid"),
    "status must not list row_target_store_invalid as a reachable refusal code",
  );
  // The render-side decision-artifact validator is documented.
  assert.match(status, /render-side decision-artifact validator/);
  assert.match(status, /broadened top-level or boundaries closed marker/);
});

test("runbook index classifies the 3b status once and frames it as the M3-closing read-only slice", () => {
  const index = read(INDEX);
  const rowCount = index.split("| `workshop-public-proposal-durable-state-render-status.md` |").length - 1;
  assert.equal(rowCount, 1);
  const row = index
    .split("\n")
    .find((l) => l.includes("| `workshop-public-proposal-durable-state-render-status.md` |"));
  assert.ok(row);
  assert.match(row, /active/);
  assert.match(row, /closes M3/);
  assert.match(row, /read-only/);
  assert.match(row, /no readiness claim/);
});

test("reader module imports are bounded and the refusal-code enumeration matches the runbook", () => {
  const moduleText = read(READER_MODULE);
  for (const forbidden of ["node:child_process", "process.env", "fetch(", "require(", "openai", "anthropic"]) {
    assert.ok(!moduleText.toLowerCase().includes(forbidden.toLowerCase()), `reader module must not contain ${JSON.stringify(forbidden)}`);
  }
  for (const allowed of ['from "node:fs/promises"', 'from "node:path"', 'from "node:util"']) {
    assert.ok(moduleText.includes(allowed), `reader module expected import ${allowed}`);
  }
  const codes = [
    "durable_db_unreachable",
    "row_proxy_backed",
    "row_not_plain_own_data",
    "row_symbol_keyed",
    "row_unsafe_key",
    "row_kind_invalid",
    "row_schema_version_invalid",
    "row_field_missing_or_malformed",
    "row_mediation_gate_level_invalid",
    "row_trust_label_invalid",
    "row_bundle_invalid",
    "row_bundle_marks_record_verified",
  ];
  for (const code of codes) {
    assert.ok(moduleText.includes(`"${code}"`), `reader module must define refusal_code ${code}`);
  }
  // Honesty fix: the unreachable refusal code is gone from the type union.
  assert.ok(
    !moduleText.includes('"row_target_store_invalid"'),
    "reader module must not declare the unreachable row_target_store_invalid refusal code",
  );
});

test("render module performs no I/O and imports no provider/network/env reads", () => {
  const moduleText = read(RENDER_MODULE);
  for (const forbidden of [
    "node:fs",
    "node:http",
    "node:https",
    "node:net",
    "node:child_process",
    "process.env",
    "fetch(",
    "require(",
    "openai",
    "anthropic",
  ]) {
    assert.ok(
      !moduleText.toLowerCase().includes(forbidden.toLowerCase()),
      `render module must not contain ${JSON.stringify(forbidden)}`,
    );
  }
});
