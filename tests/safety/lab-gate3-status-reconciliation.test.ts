import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs", "runbooks", "lab-gate3-status-reconciliation.md");
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const BLOCKERS = join(ROOT, "docs", "BLOCKERS.md");
const PLAN = join(ROOT, "docs", "deployment", "lab-deployment-plan.md");
const SLICE_A = join(ROOT, "docs", "runbooks", "lab-bounded-deployment-slice-a-execution-status.md");
const SLICE_B = join(ROOT, "docs", "runbooks", "lab-bounded-deployment-slice-b-backup-restore-status.md");
const PREFLIGHT = join(ROOT, "docs", "runbooks", "lab-deployment-execution-preflight-status.md");
const BACKUP_POLICY = join(ROOT, "docs", "runbooks", "lab-backup-policy-contract-status.md");

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

function assertReconciliationBoundaryMarkers(label: string, text: string): void {
  for (const pattern of [
    /current_effective_authorization:\s*none/i,
    /reconciliation_kind:\s*no-side-effect-docs-tests-only/i,
    /gate3_status_reconciliation_executed:\s*true/i,
    /deployment_executed_by_this_reconciliation:\s*false/i,
    /remote_probe_executed_by_this_reconciliation:\s*false/i,
    /service_start_executed_by_this_reconciliation:\s*false/i,
    /backup_restore_executed_by_this_reconciliation:\s*false/i,
    /scheduler_install_executed_by_this_reconciliation:\s*false/i,
    /remote_backup_backend_write_executed_by_this_reconciliation:\s*false/i,
    /nginx_tls_dns_change_executed_by_this_reconciliation:\s*false/i,
    /process_manager_install_executed_by_this_reconciliation:\s*false/i,
    /cloud_provisioning_executed_by_this_reconciliation:\s*false/i,
    /provider_calls_executed_by_this_reconciliation:\s*0/i,
    /provider_spend_by_this_reconciliation:\s*false/i,
    /graph_ingestion_executed_by_this_reconciliation:\s*false/i,
    /production_writes_executed_by_this_reconciliation:\s*false/i,
    /deployment_readiness_claim:\s*false/i,
    /production_readiness_claim:\s*false/i,
    /product_readiness_claim:\s*false/i,
    /launch_readiness_claim:\s*false/i,
  ]) {
    assert.match(text, pattern, `${label} missing boundary marker ${pattern}`);
  }
}

test("Gate 3 status reconciliation records a no-side-effect boundary", () => {
  const status = read(STATUS);

  assert.match(status, /# Lab Gate 3 Status Reconciliation/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /no-side-effect documentation and test reconciliation only/i);
  assert.match(status, /does not authorize additional lab deployment, probing, service start, backup\/restore execution/i);
  assertReconciliationBoundaryMarkers("Gate 3 reconciliation", status);

  for (const artifact of [
    /fake-mode-workshop-serve-slice-status\.md/i,
    /local-durable-db-boot-status\.md/i,
    /local-durable-db-backup-restore-status\.md/i,
    /local-bearer-auth-seam-status\.md/i,
    /lab-deployment-target-descriptor-status\.md/i,
    /lab-deployment-healthcheck-contract-status\.md/i,
    /lab-host-supervision-contract-status\.md/i,
    /lab-backup-policy-contract-status\.md/i,
    /lab-deployment-execution-preflight-status\.md/i,
    /lab-bounded-deployment-execution-approval-packet\.md/i,
    /lab-bounded-deployment-slice-a-execution-status\.md/i,
    /lab-bounded-deployment-slice-b-backup-restore-status\.md/i,
  ]) {
    assert.match(status, artifact);
  }

  assert.match(status, /Gate 3 remains underbuilt/i);
  assert.match(status, /The status reconciliation requested after slice B is now complete/i);
  assert.match(status, /The next recommended work is an explicit operator decision for the next scoped Gate 3 slice/i);
  assert.match(status, /does not choose, approve, or execute that slice/i);
  assertNoPrivateLiterals("Gate 3 reconciliation", status);
});

test("authority docs advance past reconciliation without authorizing a next slice", () => {
  const index = read(INDEX);
  const blockers = read(BLOCKERS);
  const plan = read(PLAN);
  const sliceA = read(SLICE_A);
  const sliceB = read(SLICE_B);
  const preflight = read(PREFLIGHT);
  const backupPolicy = read(BACKUP_POLICY);

  assert.match(index, /`lab-gate3-status-reconciliation\.md`\s*\|\s*active/i);
  assert.match(index, /current_effective_authorization:\s*none/i);
  assert.match(index, /ratified next bounded implementation: none/i);
  assert.match(index, /M4 implementation remains unauthorized/i);

  assert.match(blockers, /no-side-effect Gate 3 status reconciliation/i);
  assert.match(blockers, /next recommended work: explicit operator decision for the next scoped Gate 3 slice/i);
  assert.match(blockers, /fresh explicit operator decision before further lab expansion/i);

  assert.match(plan, /Gate 3 reconciliation completed without side effects/i);
  assert.match(plan, /No further lab expansion is approved/i);
  assert.match(plan, /current status: unapproved/i);

  assert.match(sliceA, /after slice B and Gate 3 status reconciliation/i);
  assert.match(sliceB, /Gate 3 status reconciliation is recorded in `lab-gate3-status-reconciliation\.md`/i);
  assert.match(preflight, /no-side-effect Gate 3 reconciliation/i);
  assert.match(backupPolicy, /no-side-effect Gate 3 reconciliation/i);

  for (const [label, text] of [
    ["runbook index", index],
    ["BLOCKERS", blockers],
    ["deployment plan", plan],
    ["slice A status", sliceA],
    ["slice B status", sliceB],
    ["preflight status", preflight],
    ["backup-policy status", backupPolicy],
  ] as const) {
    assertNoPrivateLiterals(label, text);
    assert.doesNotMatch(text, /current_effective_authorization:\s*(?!none\b)\S+/i);
    assert.doesNotMatch(text, /readiness_claim:\s*true/i);
    assert.doesNotMatch(text, /(?:creates|grants|provides) standing approval/i);
  }
});
