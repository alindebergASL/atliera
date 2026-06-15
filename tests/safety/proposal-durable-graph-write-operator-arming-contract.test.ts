import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/workshop-public-proposal-durable-graph-write-operator-arming-status.md");
const INDEX = join(ROOT, "docs/runbooks/INDEX.md");
const MODULE = join(ROOT, "src/workshop/proposal-durable-graph-write-operator-arming.ts");

function read(path: string): string { return readFileSync(path, "utf8"); }

function assertNoPrivateLiterals(label: string, text: string): void {
  for (const pattern of [
    /https?:\/\/[^\s)]+/i, /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /\b[A-Za-z0-9.-]+\.(?:com|net|org|io|dev|app|ai|cloud|us)\b/,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\b/,
    /(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*[^\s`]+/i,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains private literal ${pattern}`);
  }
}

test("operator arming status runbook records the marker-flip boundary and operator-identity discipline", () => {
  const status = read(STATUS);
  assert.match(status, /# Workshop Public Proposal Durable Graph-Write Operator Arming Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /exactly one attributable ratifier|single attributable ratifier/i);
  assert.match(status, /No roles, no sessions/i);
  for (const marker of [
    /current_effective_authorization:\s*single-armed-durable-write-attempt/i,
    /authorizes_durable_write_execution:\s*true/i,
    /operator_armed:\s*true/i,
    /arming_is_one_shot:\s*true/i,
    /arming_is_revocable_before_consumption:\s*true/i,
    /durable_write_execution_performed:\s*false/i,
    /durable_writes_performed:\s*false/i,
    /graph_ingestion_performed:\s*false/i,
    /ratification_performed_against_durable_state:\s*false/i,
    /l0_effect_observed:\s*false/i,
    /provider_calls_executed_by_this_slice:\s*0/i,
    /production_writes:\s*false/i,
    /product_readiness_claim:\s*false/i,
  ]) assert.match(status, marker, `missing marker ${marker}`);
  assertNoPrivateLiterals("operator-arming status", status);
});

test("runbook index classifies the operator arming status once", () => {
  const index = read(INDEX);
  const rowCount = index.split("| `workshop-public-proposal-durable-graph-write-operator-arming-status.md` |").length - 1;
  assert.equal(rowCount, 1);
  const row = index.split("\n").find((l) => l.includes("| `workshop-public-proposal-durable-graph-write-operator-arming-status.md` |"));
  assert.ok(row);
  assert.match(row, /active/i);
  assert.match(row, /authorizes a single one-shot durable-write attempt/i);
});

test("operator arming module is pure and keeps the single-flip discipline", () => {
  const moduleText = read(MODULE);
  assert.match(moduleText, /workshop-public-proposal-durable-graph-write-operator-arming/);
  assert.match(moduleText, /No roles, no sessions/i);
  assert.match(moduleText, /authorizes_durable_write_execution:\s*true/);
  assert.match(moduleText, /durable_write_execution_performed:\s*false/);
  assert.match(moduleText, /durable_writes_performed:\s*false/);
  assert.match(moduleText, /graph_ingestion_performed:\s*false/);
  assert.match(moduleText, /arming_is_one_shot:\s*true/);
  for (const forbidden of ["node:fs", "node:child_process", "process.env", "fetch(", "require("]) {
    assert.ok(!moduleText.includes(forbidden), `module must not contain ${JSON.stringify(forbidden)}`);
  }
});
