import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(
  ROOT,
  "docs",
  "runbooks",
  "workshop-public-proposal-durable-graph-write-contract-status.md",
);
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const MODULE = join(
  ROOT,
  "src",
  "workshop",
  "proposal-durable-graph-write-contract.ts",
);
const FIXTURE = join(
  ROOT,
  "fixtures",
  "workshop",
  "workshop-public-proposal-durable-graph-write-contract.json",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLiterals(label: string, text: string): void {
  for (const pattern of [
    /https?:\/\/[^\s)]+/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /\b[A-Za-z0-9.-]+\.(?:com|net|org|io|dev|app|ai|cloud|us)\b/,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\b/,
    /\b[A-Za-z0-9.-]+:\d{2,5}\b/,
    /(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*[^\s`]+/i,
    /s3:\/\//i,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains private or endpoint-shaped literal ${pattern}`);
  }
}

function assertNoBroadening(label: string, text: string): void {
  for (const pattern of [
    /current_effective_authorization:\s*(?!none\b)\S+/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_private_evidence_read:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /authorizes_durable_write_execution:\s*true/i,
    /durable_write_execution_performed:\s*true/i,
    /authorizes_durable_write:\s*true/i,
    /durable_write_performed:\s*true/i,
    /durable_writes_performed:\s*true/i,
    /ratification_performed:\s*true/i,
    /production_writes:\s*true/i,
    /readiness_claim:\s*true/i,
    /standing approval/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden broadening ${pattern}`);
  }
}

test("durable-write contract status runbook records contract-only no-call no-write boundaries", () => {
  const status = read(STATUS);

  assert.match(status, /# Workshop Public Proposal Durable Graph-Write Contract Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /no-call.*durable.*graph-write contract/i);
  assert.match(status, /defines.*the (?:typed )?shape of the eventual durable graph-write operation/i);
  assert.match(status, /defines.*the (?:typed )?shape of the future approval packet/i);

  for (const marker of [
    /current_effective_authorization:\s*none/i,
    /authorizes_provider_call:\s*false/i,
    /authorizes_private_evidence_read:\s*false/i,
    /authorizes_graph_ingestion:\s*false/i,
    /graph_ingestion_performed:\s*false/i,
    /defines_durable_write_contract:\s*true/i,
    /authorizes_durable_write_execution:\s*false/i,
    /durable_write_execution_performed:\s*false/i,
    /requires_separate_durable_write_approval_packet:\s*true/i,
    /ratification_performed:\s*false/i,
    /plan_only:\s*true/i,
    /provider_calls_executed_by_this_slice:\s*0/i,
    /provider_spend_by_this_slice:\s*false/i,
    /private_evidence_read_by_this_slice:\s*false/i,
    /durable_writes_by_this_slice:\s*false/i,
    /deployment_executed_by_this_slice:\s*false/i,
    /product_readiness_claim:\s*false/i,
    /production_readiness_claim:\s*false/i,
    /launch_readiness_claim:\s*false/i,
  ]) {
    assert.match(status, marker, `status runbook missing boundary marker ${marker}`);
  }

  assertNoPrivateLiterals("durable-write contract status", status);
  assertNoBroadening("durable-write contract status", status);
});

test("runbook index classifies the durable-write contract status once without broadening authority", () => {
  const index = read(INDEX);

  const rowCount = index.split("| `workshop-public-proposal-durable-graph-write-contract-status.md` |").length - 1;
  assert.equal(rowCount, 1, "durable-write contract runbook must have exactly one authority row");
  const row = index
    .split("\n")
    .find((line) => line.includes("| `workshop-public-proposal-durable-graph-write-contract-status.md` |"));
  assert.ok(row, "durable-write contract row must exist");
  assert.match(row, /active/i);
  assert.match(row, /authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim/i);
});

test("the durable-write contract module stays pure and keeps no-call no-write markers", () => {
  const moduleText = read(MODULE);

  assert.match(moduleText, /workshop-public-proposal-durable-graph-write-contract/);
  assert.match(moduleText, /reviewed-candidate-durable-graph-write-approval-packet/);
  assert.match(moduleText, /current_effective_authorization:\s*"none"/);
  assert.match(moduleText, /authorizes_provider_call:\s*false/);
  assert.match(moduleText, /authorizes_private_evidence_read:\s*false/);
  assert.match(moduleText, /authorizes_graph_ingestion:\s*false/);
  assert.match(moduleText, /graph_ingestion_performed:\s*false/);
  assert.match(moduleText, /authorizes_durable_write_execution:\s*false/);
  assert.match(moduleText, /durable_write_execution_performed:\s*false/);
  assert.match(moduleText, /requires_separate_durable_write_approval_packet:\s*true/);
  assert.match(moduleText, /durable_writes_performed:\s*false/);
  assert.match(moduleText, /production_writes:\s*false/);
  assert.match(moduleText, /defines_durable_write_contract:\s*true/);

  for (const forbidden of ["node:fs", "node:child_process", "process.env", "fetch(", "require("]) {
    assert.ok(
      !moduleText.includes(forbidden),
      `durable-write contract module must not contain ${JSON.stringify(forbidden)}`,
    );
  }
});

test("the committed durable-write contract fixture is sanitized and non-authorizing", () => {
  const fixtureText = read(FIXTURE);
  const fixture = JSON.parse(fixtureText) as {
    current_effective_authorization: string;
    provider_calls_made: number;
    private_evidence_read: boolean;
    graph_ingestion_performed: boolean;
    durable_writes_performed: boolean;
    production_writes: boolean;
    readiness_claim: boolean;
    boundaries: Record<string, unknown>;
    write_operations: Array<{
      target_store: string;
      mediation_gate_level: string;
      trust_label_on_durable_write: string;
      retry_budget: number;
      rollback_semantics: string;
      authorizes_durable_write: boolean;
      durable_write_performed: boolean;
    }>;
    approval_packet_shape: Record<string, unknown>;
    counts: Record<string, unknown>;
  };

  assert.equal(fixture.current_effective_authorization, "none");
  assert.equal(fixture.provider_calls_made, 0);
  assert.equal(fixture.private_evidence_read, false);
  assert.equal(fixture.graph_ingestion_performed, false);
  assert.equal(fixture.durable_writes_performed, false);
  assert.equal(fixture.production_writes, false);
  assert.equal(fixture.readiness_claim, false);
  assert.equal(fixture.boundaries.authorizes_provider_call, false);
  assert.equal(fixture.boundaries.authorizes_private_evidence_read, false);
  assert.equal(fixture.boundaries.authorizes_graph_ingestion, false);
  assert.equal(fixture.boundaries.defines_durable_write_contract, true);
  assert.equal(fixture.boundaries.authorizes_durable_write_execution, false);
  assert.equal(fixture.boundaries.durable_write_execution_performed, false);
  assert.equal(fixture.boundaries.requires_separate_durable_write_approval_packet, true);
  assert.equal(fixture.boundaries.plan_only, true);
  assert.equal(fixture.counts.ratified_candidate_count, 0);
  assert.equal(fixture.counts.durable_write_count, 0);
  assert.ok(fixture.write_operations.length > 0);
  for (const op of fixture.write_operations) {
    assert.equal(op.target_store, "local-durable-db");
    assert.equal(op.mediation_gate_level, "L0");
    assert.equal(op.trust_label_on_durable_write, "model-proposed-human-ratified-evidence-pending");
    assert.equal(op.retry_budget, 0);
    assert.equal(op.rollback_semantics, "single-transaction-or-noop");
    assert.equal(op.authorizes_durable_write, false);
    assert.equal(op.durable_write_performed, false);
  }
  assert.equal(fixture.approval_packet_shape.max_durable_writes, 1);
  assert.equal(fixture.approval_packet_shape.max_attempts, 1);
  assert.equal(fixture.approval_packet_shape.retry_budget, 0);
  assert.equal(fixture.approval_packet_shape.retry_requires_new_approval, true);
  assert.equal(fixture.approval_packet_shape.expiry_required, true);
  assert.equal(fixture.approval_packet_shape.operator_arming_required, true);
  assert.equal(fixture.approval_packet_shape.mediation_gate_level, "L0");
  assert.equal(fixture.approval_packet_shape.target_store, "local-durable-db");
  for (const fragment of ["/home/", "private-provider-evidence", "api_key", "bearer ", "sk-"]) {
    assert.ok(
      !fixtureText.toLowerCase().includes(fragment),
      `fixture must not contain private-evidence-shaped fragment ${JSON.stringify(fragment)}`,
    );
  }
  assertNoPrivateLiterals(
    "durable-write contract fixture",
    fixtureText.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/g, "ISO_TIMESTAMP"),
  );
});
