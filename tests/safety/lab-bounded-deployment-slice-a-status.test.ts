import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs", "runbooks", "lab-bounded-deployment-slice-a-execution-status.md");
const INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const BLOCKERS = join(ROOT, "docs", "BLOCKERS.md");
const PLAN = join(ROOT, "docs", "deployment", "lab-deployment-plan.md");

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

function assertFalseBoundaryMarkers(label: string, text: string): void {
  for (const pattern of [
    /current_effective_authorization:\s*none/i,
    /slice_b_backup_restore_approved:\s*false/i,
    /backup_execution_executed_by_this_slice:\s*false/i,
    /restore_execution_executed_by_this_slice:\s*false/i,
    /scheduler_install_executed_by_this_slice:\s*false/i,
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

test("slice A execution status records approved bounded execution without leaking target values", () => {
  const status = read(STATUS);

  assert.match(status, /# Lab Bounded Deployment Slice A Execution Status/i);
  assert.match(status, /Status: active/i);
  assert.match(status, /user approved decision items 1 and 2 only/i);
  assert.match(status, /approved_commit:\s*d144035905f12eeabc32c8da3f4a3dbb4b5a1f4d/i);
  assert.match(status, /runtime_mode:\s*fake/i);
  assert.match(status, /target_ref:\s*LAB_TARGET_HOST_REF/i);
  assert.match(status, /bind_host_ref:\s*LAB_BIND_HOST_REF/i);
  assert.match(status, /public_base_url_ref:\s*LAB_PUBLIC_BASE_URL_REF/i);
  assert.match(status, /service_name_ref:\s*LAB_SERVICE_NAME_REF/i);
  assert.match(status, /slice_a_deployment_executed:\s*true/i);
  assert.match(status, /slice_a_service_start_executed:\s*true/i);
  assert.match(status, /slice_a_healthz_probe_executed:\s*true/i);
  assert.match(status, /slice_a_workshop_shallow_smoke_executed:\s*true/i);
  assertFalseBoundaryMarkers("slice A status", status);

  for (const evidence of [
    /Local pre-deploy CI\s*\|\s*pass/i,
    /1092 tests passed and gate fixture valid passed/i,
    /Single lab target access\s*\|\s*pass/i,
    /Lab typecheck\s*\|\s*pass/i,
    /Fake-mode service start\s*\|\s*pass/i,
    /`\/healthz` probe\s*\|\s*pass/i,
    /Optional `\/workshop` shallow smoke\s*\|\s*pass/i,
    /Teardown\s*\|\s*pass/i,
    /service was stopped after the approved probes/i,
  ]) {
    assert.match(status, evidence);
  }

  assert.match(status, /does not prove persistent deployment, nginx\/TLS\/domain readiness, scheduler readiness, backup\/restore execution, provider\/model operation, graph ingestion, production safety, or launch readiness/i);
  assertNoPrivateLiterals("slice A status", status);
});

test("authority docs preserve no-standing-authorization after slice B and reconciliation", () => {
  const index = read(INDEX);
  const blockers = read(BLOCKERS);
  const plan = read(PLAN);

  assert.match(index, /`lab-bounded-deployment-slice-a-execution-status\.md`\s*\|\s*active/i);
  assert.match(index, /`lab-gate3-status-reconciliation\.md`\s*\|\s*active/i);
  assert.match(index, /current_effective_authorization:\s*none/i);
  assert.match(index, /next recommended work: this index creates no authority; it records the already-ratified conditional successor below, and every other later slice requires a new explicit operator decision/i);
  assert.match(blockers, /bounded lab deployment slice A executed/i);
  assert.match(blockers, /bounded lab slice B backup\/restore proof status/i);
  assert.match(blockers, /no-side-effect Gate 3 status reconciliation/i);
  assert.match(plan, /bounded lab deployment slice A execution status/i);
  assert.match(plan, /bounded lab deployment slice B backup\/restore status/i);
  assert.match(plan, /Gate 3 reconciliation completed without side effects/i);
  assert.match(plan, /No further lab expansion is approved/i);

  assertNoPrivateLiterals("approval packet", read(join(ROOT, "docs", "runbooks", "lab-bounded-deployment-execution-approval-packet.md")));
  assertNoPrivateLiterals("deployment plan", plan);
});
