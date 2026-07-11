import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs", "runbooks", "lab-bounded-deployment-slice-b-backup-restore-status.md");
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const BLOCKERS = join(ROOT, "docs", "BLOCKERS.md");
const PLAN = join(ROOT, "docs", "deployment", "lab-deployment-plan.md");
const APPROVAL_PACKET = join(ROOT, "docs", "runbooks", "lab-bounded-deployment-execution-approval-packet.md");

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

function assertSliceBBoundaryMarkers(label: string, text: string): void {
  for (const pattern of [
    /current_effective_authorization:\s*none/i,
    /slice_b_backup_restore_approval_consumed:\s*true/i,
    /approved_commit:\s*3c6d331e4ec2271adc1e8c5dba4f8334dc926420/i,
    /runtime_mode:\s*fake/i,
    /target_ref:\s*LAB_TARGET_HOST_REF/i,
    /backup_policy_plan_ref:\s*LAB_BACKUP_POLICY_PLAN_REF/i,
    /backup_artifact_root_ref:\s*LAB_BACKUP_ARTIFACT_ROOT_REF/i,
    /restore_proof_artifact_ref:\s*LAB_RESTORE_PROOF_ARTIFACT_REF/i,
    /lab_local_backup_artifact_created:\s*true/i,
    /backup_execution_executed_by_this_slice:\s*true/i,
    /restore_execution_executed_by_this_slice:\s*true/i,
    /restore_scratch_removed_after_proof:\s*true/i,
    /scheduler_install_executed_by_this_slice:\s*false/i,
    /remote_backup_backend_write_executed_by_this_slice:\s*false/i,
    /nginx_tls_dns_change_executed_by_this_slice:\s*false/i,
    /process_manager_install_executed_by_this_slice:\s*false/i,
    /cloud_provisioning_executed_by_this_slice:\s*false/i,
    /provider_calls_executed_by_this_slice:\s*0/i,
    /provider_spend_by_this_slice:\s*false/i,
    /graph_ingestion_executed_by_this_slice:\s*false/i,
    /production_writes_executed_by_this_slice:\s*false/i,
    /deployment_readiness_claim:\s*false/i,
    /production_readiness_claim:\s*false/i,
    /product_readiness_claim:\s*false/i,
    /launch_readiness_claim:\s*false/i,
  ]) {
    assert.match(text, pattern, `${label} missing boundary marker ${pattern}`);
  }
}

test("slice B status records approved disposable backup/restore proof without private target values", () => {
  const status = read(STATUS);

  assert.match(status, /# Lab Bounded Deployment Slice B Backup\/Restore Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /explicit operator approval for slice B/i);
  assert.match(status, /single-use and is consumed by this record/i);
  assertSliceBBoundaryMarkers("slice B status", status);

  for (const evidence of [
    /Local pre-slice CI\s*\|\s*pass/i,
    /Exact commit package\s*\|\s*pass/i,
    /Single lab target transfer\s*\|\s*pass/i,
    /Disposable local durable DB init\s*\|\s*pass/i,
    /Disposable backup\s*\|\s*pass/i,
    /`local-durable-db-backup-report`; status was `created`/i,
    /Restore proof\s*\|\s*pass/i,
    /`local-durable-db-restore-report`; status was `restored`/i,
    /Restored DB inspect\s*\|\s*pass/i,
    /Round-trip integrity\s*\|\s*pass/i,
    /Backup artifact integrity\s*\|\s*pass/i,
    /Restore scratch teardown\s*\|\s*pass/i,
  ]) {
    assert.match(status, evidence);
  }

  assert.match(status, /No scheduled backup exists/i);
  assert.match(status, /No remote backup backend, object store, retention, encryption, lifecycle, IAM, or disaster-recovery policy is configured or validated by this slice/i);
  assert.match(status, /Current effective authorization is none/i);
  assert.match(status, /next recommended work is an explicit operator decision for the next scoped Gate 3 slice/i);
  assertNoPrivateLiterals("slice B status", status);
});

test("authority docs advance to Gate 3 reconciliation without standing authorization", () => {
  const index = read(INDEX);
  const blockers = read(BLOCKERS);
  const plan = read(PLAN);
  const packet = read(APPROVAL_PACKET);

  assert.match(index, /`lab-bounded-deployment-slice-b-backup-restore-status\.md`\s*\|\s*active/i);
  assert.match(index, /current_effective_authorization:\s*none/i);
  assert.match(index, /ratified next bounded implementation: none/i);
  assert.match(index, /M4 implementation remains unauthorized/i);
  assert.match(blockers, /bounded lab slice B backup\/restore proof status/i);
  assert.match(blockers, /no-side-effect Gate 3 status reconciliation/i);
  assert.match(plan, /bounded lab deployment slice B backup\/restore status/i);
  assert.match(plan, /Gate 3 reconciliation completed without side effects/i);
  assert.match(plan, /no further lab expansion is approved/i);
  assert.match(packet, /Slice B backup\/restore proof is recorded in `lab-bounded-deployment-slice-b-backup-restore-status\.md`/i);
  assert.match(packet, /Current effective authorization remains none/i);

  assertNoPrivateLiterals("runbook index", index);
  assertNoPrivateLiterals("deployment plan", plan);
  assertNoPrivateLiterals("approval packet", packet);
});
