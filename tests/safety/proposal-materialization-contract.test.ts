import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs", "runbooks", "proposal-materialization-contract-status.md");
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const MODULE = join(ROOT, "src", "validation", "proposal-materialization.ts");
const FIXTURE = join(
  ROOT,
  "fixtures",
  "validation",
  "proposal-materialization-public-curated-20260611a-input.json",
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
    /production_writes:\s*true/i,
    /private_evidence_read_by_this_slice:\s*true/i,
    /durable_writes_by_this_slice:\s*true/i,
    /readiness_claim:\s*true/i,
    /standing approval/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden broadening ${pattern}`);
  }
}

test("proposal materialization status runbook records the no-call no-private-read no-durable-write boundary", () => {
  const status = read(STATUS);

  assert.match(status, /# Proposal Materialization Contract Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /no-call, no-private-evidence-read, no-durable-write proposal-materialization contract/i);

  for (const marker of [
    /current_effective_authorization:\s*none/i,
    /authorizes_provider_call:\s*false/i,
    /authorizes_private_evidence_read:\s*false/i,
    /authorizes_graph_ingestion:\s*false/i,
    /graph_ingestion_performed:\s*false/i,
    /production_writes:\s*false/i,
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

  assertNoPrivateLiterals("proposal materialization status", status);
  assertNoBroadening("proposal materialization status", status);
});

test("status runbook targets the public hand-curated path first and names the next Workshop artifact", () => {
  const status = read(STATUS);

  assert.match(status, /Direction B/i);
  assert.match(status, /public\/hand-curated Workshop artifact path/i);
  assert.match(status, /hand-curated, public-shaped input fixture/i);
  assert.match(status, /not private proof output and not a sanitized metric summary/i);

  assert.match(status, /`workshop-public-curated-proposal-preview`/);
  assert.match(status, /deterministic fake-mode Workshop HTML preview/i);
  assert.match(status, /`docs\/runbooks\/workshop-public-curated-proposal-preview-approval-packet\.md`/);
  assert.match(status, /does not create or approve that packet/i);

  assert.match(status, /separate explicit fresh private-evidence-handling approval is required/i);
  assert.match(status, /before any private fresh-route proof output is read, rendered, or materialized/i);

  assert.match(status, /"Ingestion" stays reserved for a future ratification-gated durable graph write/i);
});

test("status runbook commits the trust visual-language decision without a new truth-status tier", () => {
  const status = read(STATUS);

  assert.match(status, /## Trust visual-language decision/i);
  assert.match(status, /claims and account objects stay `unverified`; excerpts stay `proposed`/i);
  assert.match(status, /No sixth truth-status tier is added/i);
  assert.match(status, /model_proposed_pending_human_review/);
  assert.match(status, /cannot be marked `verified` or `source_document_only`/i);
});

test("runbook index classifies the proposal materialization status runbook without broadening authority", () => {
  const index = read(INDEX);

  const rowCount = index.split("| `proposal-materialization-contract-status.md` |").length - 1;
  assert.equal(rowCount, 1, "proposal materialization runbook must have exactly one authority row");
  const row = index
    .split("\n")
    .find((line) => line.includes("| `proposal-materialization-contract-status.md` |"));
  assert.ok(row, "proposal materialization row must exist");
  assert.match(row, /active/i);
  assert.match(row, /authorizes nothing/i);
});

test("the materializer module keeps its no-call, no-private-read, no-durable-write shape", () => {
  const moduleText = read(MODULE);

  assert.match(moduleText, /hand-curated-public/);
  assert.match(moduleText, /model_proposed_pending_human_review/);
  assert.match(moduleText, /workshop-public-curated-proposal-preview/);
  assert.match(moduleText, /current_effective_authorization:\s*"none"/);
  assert.match(moduleText, /authorizes_provider_call:\s*false/);
  assert.match(moduleText, /authorizes_private_evidence_read:\s*false/);
  assert.match(moduleText, /authorizes_graph_ingestion:\s*false/);
  assert.match(moduleText, /graph_ingestion_performed:\s*false/);
  assert.match(moduleText, /durable_writes_performed:\s*false/);
  assert.match(moduleText, /production_writes:\s*false/);

  // Pure module: no filesystem, environment, network, or process access.
  for (const forbidden of ["node:fs", "node:child_process", "process.env", "fetch(", "require("]) {
    assert.ok(
      !moduleText.includes(forbidden),
      `proposal materialization module must not contain ${JSON.stringify(forbidden)}`,
    );
  }
});

test("the committed fixture is public-shaped hand-curated input, not private proof output", () => {
  const fixtureText = read(FIXTURE);
  const fixture = JSON.parse(fixtureText) as {
    context: Record<string, unknown>;
    public_sources: Record<string, unknown>[];
  };

  assert.equal(fixture.context.origin, "hand-curated-public");
  assert.ok(fixture.public_sources.length > 0);
  for (const source of fixture.public_sources) {
    assert.match(String(source.url), /^https:\/\/example\.invalid\//);
    assert.match(String(source.canonical_url), /^https:\/\/example\.invalid\//);
  }
  for (const fragment of ["/home/", "private-provider-evidence", "api_key", "bearer ", "sk-"]) {
    assert.ok(
      !fixtureText.toLowerCase().includes(fragment),
      `fixture must not contain private-evidence-shaped fragment ${JSON.stringify(fragment)}`,
    );
  }
});
