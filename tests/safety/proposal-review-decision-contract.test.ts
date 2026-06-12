import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs", "runbooks", "workshop-public-proposal-human-review-decision-status.md");
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const MODULE = join(ROOT, "src", "workshop", "proposal-review-decision.ts");
const FIXTURE = join(
  ROOT,
  "fixtures",
  "workshop",
  "workshop-public-proposal-human-review-decision-artifact.json",
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

test("human-review decision status runbook records closed provider/private/durable/ingestion boundaries", () => {
  const status = read(STATUS);

  assert.match(status, /# Workshop Public Proposal Human Review Decision Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /disposable human-review decision artifact/i);

  for (const marker of [
    /current_effective_authorization:\s*none/i,
    /authorizes_provider_call:\s*false/i,
    /authorizes_private_evidence_read:\s*false/i,
    /authorizes_graph_ingestion:\s*false/i,
    /graph_ingestion_performed:\s*false/i,
    /authorizes_reviewed_candidate_durable_write:\s*false/i,
    /reviewed_candidate_durable_write_performed:\s*false/i,
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

  assertNoPrivateLiterals("human-review decision status", status);
  assertNoBroadening("human-review decision status", status);
});

test("runbook index classifies the human-review decision status once without broadening authority", () => {
  const index = read(INDEX);

  const rowCount = index.split("| `workshop-public-proposal-human-review-decision-status.md` |").length - 1;
  assert.equal(rowCount, 1, "human-review decision runbook must have exactly one authority row");
  const row = index
    .split("\n")
    .find((line) => line.includes("| `workshop-public-proposal-human-review-decision-status.md` |"));
  assert.ok(row, "human-review decision row must exist");
  assert.match(row, /active/i);
  assert.match(row, /authorizes no provider calls, private evidence reads, graph ingestion, durable writes, production writes, deployment, or readiness claim/i);
});

test("the human-review decision module stays pure and keeps no-call no-write markers", () => {
  const moduleText = read(MODULE);

  assert.match(moduleText, /workshop-public-proposal-human-review-decision/);
  assert.match(moduleText, /accept_for_graph_candidate/);
  assert.match(moduleText, /needs_more_evidence/);
  assert.match(moduleText, /current_effective_authorization:\s*"none"/);
  assert.match(moduleText, /authorizes_provider_call:\s*false/);
  assert.match(moduleText, /authorizes_private_evidence_read:\s*false/);
  assert.match(moduleText, /authorizes_graph_ingestion:\s*false/);
  assert.match(moduleText, /graph_ingestion_performed:\s*false/);
  assert.match(moduleText, /durable_writes_performed:\s*false/);
  assert.match(moduleText, /production_writes:\s*false/);
  assert.match(moduleText, /ratification_performed:\s*false/);

  for (const forbidden of ["node:fs", "node:child_process", "process.env", "fetch(", "require("]) {
    assert.ok(
      !moduleText.includes(forbidden),
      `human-review decision module must not contain ${JSON.stringify(forbidden)}`,
    );
  }
});

test("the committed human-review artifact fixture is sanitized and non-authorizing", () => {
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
    decisions: Array<{ decision: string; graph_candidate_ref: unknown; promotion_performed: boolean }>;
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
  assert.ok(fixture.decisions.length > 0);
  for (const decision of fixture.decisions) {
    assert.equal(decision.promotion_performed, false);
    if (decision.decision !== "accept_for_graph_candidate") {
      assert.equal(decision.graph_candidate_ref, null);
    }
  }
  for (const fragment of ["/home/", "private-provider-evidence", "api_key", "bearer ", "sk-"]) {
    assert.ok(
      !fixtureText.toLowerCase().includes(fragment),
      `fixture must not contain private-evidence-shaped fragment ${JSON.stringify(fragment)}`,
    );
  }
  assertNoPrivateLiterals(
    "human-review decision fixture",
    fixtureText.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/g, "ISO_TIMESTAMP"),
  );
});
