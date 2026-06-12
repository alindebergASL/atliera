import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs", "runbooks", "workshop-public-proposal-ratification-plan-status.md");
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const MODULE = join(ROOT, "src", "workshop", "proposal-ratification-plan.ts");
const FIXTURE = join(
  ROOT,
  "fixtures",
  "workshop",
  "workshop-public-proposal-reviewed-candidate-ratification-plan.json",
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
    /authorizes_reviewed_candidate_durable_write:\s*true/i,
    /reviewed_candidate_durable_write_performed:\s*true/i,
    /authorizes_durable_write:\s*true/i,
    /durable_write_performed:\s*true/i,
    /ratification_performed:\s*true/i,
    /production_writes:\s*true/i,
    /private_evidence_read_by_this_slice:\s*true/i,
    /durable_writes_by_this_slice:\s*true/i,
    /readiness_claim:\s*true/i,
    /standing approval/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden broadening ${pattern}`);
  }
}

test("ratification plan status runbook records plan-only no-call no-write boundaries", () => {
  const status = read(STATUS);

  assert.match(status, /# Workshop Public Proposal Reviewed-Candidate Ratification Plan Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /no-call public proposal reviewed-candidate ratification plan contract/i);
  assert.match(status, /plan-only/i);

  for (const marker of [
    /current_effective_authorization:\s*none/i,
    /authorizes_provider_call:\s*false/i,
    /authorizes_private_evidence_read:\s*false/i,
    /authorizes_graph_ingestion:\s*false/i,
    /graph_ingestion_performed:\s*false/i,
    /authorizes_reviewed_candidate_durable_write:\s*false/i,
    /reviewed_candidate_durable_write_performed:\s*false/i,
    /ratification_performed:\s*false/i,
    /plan_only:\s*true/i,
    /requires_separate_ratification_approval:\s*true/i,
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

  assertNoPrivateLiterals("ratification plan status", status);
  assertNoBroadening("ratification plan status", status);
});

test("runbook index classifies the ratification plan status once without broadening authority", () => {
  const index = read(INDEX);

  const rowCount = index.split("| `workshop-public-proposal-ratification-plan-status.md` |").length - 1;
  assert.equal(rowCount, 1, "ratification plan runbook must have exactly one authority row");
  const row = index
    .split("\n")
    .find((line) => line.includes("| `workshop-public-proposal-ratification-plan-status.md` |"));
  assert.ok(row, "ratification plan row must exist");
  assert.match(row, /active/i);
  assert.match(row, /plan-only/i);
  assert.match(row, /authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim/i);
});

test("the ratification plan module stays pure and keeps plan-only no-call no-write markers", () => {
  const moduleText = read(MODULE);

  assert.match(moduleText, /workshop-public-proposal-reviewed-candidate-ratification-plan/);
  assert.match(moduleText, /awaiting_separate_ratification/);
  assert.match(moduleText, /reviewed-candidate-durable-graph-write/);
  assert.match(moduleText, /current_effective_authorization:\s*"none"/);
  assert.match(moduleText, /authorizes_provider_call:\s*false/);
  assert.match(moduleText, /authorizes_private_evidence_read:\s*false/);
  assert.match(moduleText, /authorizes_graph_ingestion:\s*false/);
  assert.match(moduleText, /graph_ingestion_performed:\s*false/);
  assert.match(moduleText, /durable_writes_performed:\s*false/);
  assert.match(moduleText, /production_writes:\s*false/);
  assert.match(moduleText, /ratification_performed:\s*false/);
  assert.match(moduleText, /plan_only:\s*true/);
  assert.match(moduleText, /requires_separate_ratification_approval:\s*true/);

  for (const forbidden of ["node:fs", "node:child_process", "process.env", "fetch(", "require("]) {
    assert.ok(
      !moduleText.includes(forbidden),
      `ratification plan module must not contain ${JSON.stringify(forbidden)}`,
    );
  }
});

test("the committed ratification plan fixture is sanitized and non-authorizing", () => {
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
    candidates: Array<{
      ratification_status: string;
      planned_write_operation: string;
      candidate_only: boolean;
      requires_separate_ratification_approval: boolean;
      authorizes_graph_ingestion: boolean;
      graph_ingestion_performed: boolean;
      authorizes_durable_write: boolean;
      durable_write_performed: boolean;
    }>;
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
  assert.equal(fixture.boundaries.authorizes_reviewed_candidate_durable_write, false);
  assert.equal(fixture.boundaries.reviewed_candidate_durable_write_performed, false);
  assert.equal(fixture.boundaries.ratification_performed, false);
  assert.equal(fixture.boundaries.plan_only, true);
  assert.equal(fixture.boundaries.requires_separate_ratification_approval, true);
  assert.equal(fixture.counts.ratified_candidate_count, 0);
  assert.equal(fixture.counts.durable_write_count, 0);
  assert.ok(fixture.candidates.length > 0);
  for (const candidate of fixture.candidates) {
    assert.equal(candidate.ratification_status, "awaiting_separate_ratification");
    assert.equal(candidate.planned_write_operation, "none");
    assert.equal(candidate.candidate_only, true);
    assert.equal(candidate.requires_separate_ratification_approval, true);
    assert.equal(candidate.authorizes_graph_ingestion, false);
    assert.equal(candidate.graph_ingestion_performed, false);
    assert.equal(candidate.authorizes_durable_write, false);
    assert.equal(candidate.durable_write_performed, false);
  }
  for (const fragment of ["/home/", "private-provider-evidence", "api_key", "bearer ", "sk-"]) {
    assert.ok(
      !fixtureText.toLowerCase().includes(fragment),
      `fixture must not contain private-evidence-shaped fragment ${JSON.stringify(fragment)}`,
    );
  }
  assertNoPrivateLiterals(
    "ratification plan fixture",
    fixtureText.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/g, "ISO_TIMESTAMP"),
  );
});
