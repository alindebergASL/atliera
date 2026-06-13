import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(
  ROOT,
  "docs",
  "runbooks",
  "workshop-public-proposal-durable-graph-write-approval-packet-status.md",
);
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const MODULE = join(
  ROOT,
  "src",
  "workshop",
  "proposal-durable-graph-write-approval-packet.ts",
);
const FIXTURE = join(
  ROOT,
  "fixtures",
  "workshop",
  "workshop-public-proposal-durable-graph-write-approval-packet.json",
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
    /operator_armed:\s*true/i,
    /authorizes_durable_write_execution:\s*true/i,
    /durable_write_execution_performed:\s*true/i,
    /arming_performed_by_this_artifact:\s*true/i,
    /durable_writes_performed:\s*true/i,
    /ratification_performed:\s*true/i,
    /production_writes:\s*true/i,
    /readiness_claim:\s*true/i,
    /standing approval/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden broadening ${pattern}`);
  }
}

test("approval packet status runbook records drafted, unarmed, no-call no-write boundaries", () => {
  const status = read(STATUS);

  assert.match(status, /# Workshop Public Proposal Durable Graph-Write Approval Packet Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /no-call public proposal durable graph-write approval packet/i);
  assert.match(status, /lifecycle_state: drafted/i);
  assert.match(status, /arming is a separate operator action/i);

  for (const marker of [
    /current_effective_authorization:\s*none/i,
    /authorizes_provider_call:\s*false/i,
    /authorizes_private_evidence_read:\s*false/i,
    /authorizes_graph_ingestion:\s*false/i,
    /graph_ingestion_performed:\s*false/i,
    /defines_arming_surface:\s*true/i,
    /operator_armed:\s*false/i,
    /requires_operator_arming:\s*true/i,
    /authorizes_durable_write_execution:\s*false/i,
    /durable_write_execution_performed:\s*false/i,
    /arming_performed_by_this_artifact:\s*false/i,
    /ratification_performed:\s*false/i,
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

  assertNoPrivateLiterals("approval packet status", status);
  assertNoBroadening("approval packet status", status);
});

test("runbook index classifies the approval packet status once without broadening authority", () => {
  const index = read(INDEX);

  const rowCount = index.split("| `workshop-public-proposal-durable-graph-write-approval-packet-status.md` |").length - 1;
  assert.equal(rowCount, 1, "approval packet runbook must have exactly one authority row");
  const row = index
    .split("\n")
    .find((line) => line.includes("| `workshop-public-proposal-durable-graph-write-approval-packet-status.md` |"));
  assert.ok(row, "approval packet row must exist");
  assert.match(row, /active/i);
  assert.match(row, /drafted/i);
  assert.match(row, /authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim/i);
});

test("the approval packet module stays pure and keeps drafted no-call no-write markers", () => {
  const moduleText = read(MODULE);

  assert.match(moduleText, /workshop-public-proposal-durable-graph-write-approval-packet/);
  assert.match(moduleText, /reviewed-candidate-durable-graph-write-execution/);
  assert.match(moduleText, /current_effective_authorization:\s*"none"/);
  assert.match(moduleText, /operator_armed:\s*false/);
  assert.match(moduleText, /requires_operator_arming:\s*true/);
  assert.match(moduleText, /authorizes_durable_write_execution:\s*false/);
  assert.match(moduleText, /durable_write_execution_performed:\s*false/);
  assert.match(moduleText, /arming_performed_by_this_artifact:\s*false/);
  assert.match(moduleText, /durable_writes_performed:\s*false/);
  assert.match(moduleText, /production_writes:\s*false/);
  assert.match(moduleText, /defines_arming_surface:\s*true/);

  for (const forbidden of ["node:fs", "node:child_process", "process.env", "fetch(", "require("]) {
    assert.ok(
      !moduleText.includes(forbidden),
      `approval packet module must not contain ${JSON.stringify(forbidden)}`,
    );
  }
});

test("the committed approval packet fixture is sanitized, drafted, unarmed, and non-authorizing", () => {
  const fixtureText = read(FIXTURE);
  const fixture = JSON.parse(fixtureText) as {
    current_effective_authorization: string;
    lifecycle_state: string;
    armed_at: unknown;
    provider_calls_made: number;
    private_evidence_read: boolean;
    graph_ingestion_performed: boolean;
    durable_writes_performed: boolean;
    production_writes: boolean;
    readiness_claim: boolean;
    boundaries: Record<string, unknown>;
    write_scopes: Array<{ target_store: string; mediation_gate_level: string }>;
    arming_surface: Record<string, unknown>;
    counts: Record<string, unknown>;
  };

  assert.equal(fixture.current_effective_authorization, "none");
  assert.equal(fixture.lifecycle_state, "drafted");
  assert.equal(fixture.armed_at, null);
  assert.equal(fixture.provider_calls_made, 0);
  assert.equal(fixture.private_evidence_read, false);
  assert.equal(fixture.graph_ingestion_performed, false);
  assert.equal(fixture.durable_writes_performed, false);
  assert.equal(fixture.production_writes, false);
  assert.equal(fixture.readiness_claim, false);
  assert.equal(fixture.boundaries.operator_armed, false);
  assert.equal(fixture.boundaries.requires_operator_arming, true);
  assert.equal(fixture.boundaries.authorizes_durable_write_execution, false);
  assert.equal(fixture.boundaries.durable_write_execution_performed, false);
  assert.equal(fixture.boundaries.arming_performed_by_this_artifact, false);
  assert.equal(fixture.boundaries.defines_arming_surface, true);
  assert.equal(fixture.counts.armed_count, 0);
  assert.equal(fixture.counts.durable_write_count, 0);
  assert.ok(fixture.write_scopes.length > 0);
  for (const scope of fixture.write_scopes) {
    assert.equal(scope.target_store, "local-durable-db");
    assert.equal(scope.mediation_gate_level, "L0");
  }
  assert.equal(fixture.arming_surface.transitions_lifecycle_to, "operator-armed");
  assert.equal(fixture.arming_surface.still_requires_separate_write_execution_slice, true);
  assert.equal(fixture.arming_surface.arming_grants_provider_call, false);
  assert.equal(fixture.arming_surface.arming_grants_production_write, false);
  for (const fragment of ["/home/", "private-provider-evidence", "api_key", "bearer ", "sk-"]) {
    assert.ok(
      !fixtureText.toLowerCase().includes(fragment),
      `fixture must not contain private-evidence-shaped fragment ${JSON.stringify(fragment)}`,
    );
  }
  assertNoPrivateLiterals(
    "approval packet fixture",
    fixtureText.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/g, "ISO_TIMESTAMP"),
  );
});
