import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const RUNBOOK_DIR = join(ROOT, "docs", "runbooks");
const RUNBOOK_INDEX = join(RUNBOOK_DIR, "INDEX.md");
const README = join(ROOT, "README.md");
const BLOCKERS = join(ROOT, "docs", "BLOCKERS.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function runbookFiles(): string[] {
  return readdirSync(RUNBOOK_DIR)
    .filter((name) => name.endsWith(".md") && name !== "INDEX.md")
    .sort();
}

function assertNoBroadening(label: string, text: string): void {
  for (const pattern of [
    /current_effective_authorization:\s*(?!none\b)\S+/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_revalidation_run:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /authorizes_production_use:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /standing approval/i,
    /production ready/i,
    /launch ready/i,
    /default model selected/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains forbidden broadening ${pattern}`);
  }
}

test("runbook authority index covers every runbook and preserves the active boundary", () => {
  const index = read(RUNBOOK_INDEX);
  const files = runbookFiles();

  assert.match(index, /# Runbook Authority Index/i);
  assert.match(index, /current_effective_authorization: none/i);
  assert.match(index, /No runbook entry in this index authorizes provider calls, retries, revalidation, comparison, graph ingestion, production use, default model selection, or readiness claims\./i);
  assert.match(index, /`runtime-route-guarded-lab-proof-approval-packet\.md`\s*\|\s*inert-approval/i);
  assert.match(index, /`runtime-route-fresh-lab-proof-usefulness-assessment\.md`\s*\|\s*active/i);
  assert.match(index, /`fake-mode-workshop-serve-slice-status\.md`\s*\|\s*active/i);
  assert.match(index, /`local-durable-db-boot-status\.md`\s*\|\s*active/i);
  assert.match(index, /`local-durable-db-backup-restore-status\.md`\s*\|\s*active/i);
  assert.match(index, /`local-bearer-auth-seam-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-deployment-target-descriptor-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-deployment-healthcheck-contract-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-host-supervision-contract-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-backup-policy-contract-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-deployment-execution-preflight-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-bounded-deployment-execution-approval-packet\.md`\s*\|\s*inert-approval/i);
  assert.match(index, /`lab-bounded-deployment-slice-a-execution-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-bounded-deployment-slice-b-backup-restore-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-gate3-status-reconciliation\.md`\s*\|\s*active/i);
  assert.match(index, /`runtime-model-only-tiny-live-runtime-proof-remediated-status\.md`\s*\|\s*consumed/i);

  const authorityRows = index
    .split("\n")
    .filter((line) => /^\| `[^`]+\.md` \| (active|consumed|superseded|inert-approval) \|/.test(line));
  assert.equal(authorityRows.length, files.length, "index must not contain orphan or duplicate authority rows");

  for (const file of files) {
    const rowPrefix = `| \`${file}\` |`;
    const rowCount = index.split(rowPrefix).length - 1;
    assert.equal(rowCount, 1, `${file} must have exactly one authority row`);
    const row = index.split("\n").find((line) => line.startsWith(rowPrefix));
    assert.match(row ?? "", /^\| `[^`]+` \| (active|consumed|superseded|inert-approval) \|/);
  }
  assertNoBroadening("runbook authority index", index);
});

test("README describes the current codebase rather than stale Phase 1 absence claims", () => {
  const readme = read(README);

  assert.doesNotMatch(readme, /Phase 1 intentionally does not include UI, database persistence, live source fetching, provider\/model integration, deployment, or legacy data migration\./);
  assert.match(readme, /Workshop HTML rendering/i);
  assert.match(readme, /runtime composition/i);
  assert.match(readme, /database-backed queue and graph store seams/i);
  assert.match(readme, /model route catalog, activation gates, and no-call\/guarded proof harnesses/i);
  assert.match(readme, /does not claim launch readiness/i);
  assertNoBroadening("README", readme);
});

test("BLOCKERS exposes per-gate status and the Gate 3/Gate 4 imbalance", () => {
  const blockers = read(BLOCKERS);

  assert.match(blockers, /## Current gate status/i);
  assert.match(blockers, /Gate 0\s*\|\s*complete/i);
  assert.match(blockers, /Gate 1\s*\|\s*complete/i);
  assert.match(blockers, /Gate 2\s*\|\s*validated-boundary/i);
  assert.match(blockers, /Gate 3\s*\|\s*underbuilt/i);
  assert.match(blockers, /Gate 4\s*\|\s*fixture-only/i);
  assert.match(blockers, /no launch-ready claim/i);
  assert.match(blockers, /PR #289 remains an unarmed M5b Gate A pre-effect repair; it authorizes no next step/i);
  assert.match(
    blockers,
    /The next possible M5b private-read gate is blocked and requires all of: PR #289 approval on its then-current exact head; merge; successful post-merge CI; binding to the resulting merge commit SHA and tree; exact custody artifact identity plus a separately supplied private path; and execution before `2026-08-13T18:41:11\.277Z` unless a separately ratified bounded retention decision already exists/i,
  );
  assertNoBroadening("BLOCKERS", blockers);
});
