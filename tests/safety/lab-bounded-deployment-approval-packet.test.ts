import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const APPROVAL_PACKET = join(ROOT, "docs", "runbooks", "lab-bounded-deployment-execution-approval-packet.md");
const RUNBOOK_INDEX = join(ROOT, "docs", "runbooks", "INDEX.md");
const BLOCKERS = join(ROOT, "docs", "BLOCKERS.md");
const DEPLOYMENT_PLAN = join(ROOT, "docs", "deployment", "lab-deployment-plan.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertBoundaryMarkers(label: string, text: string): void {
  for (const pattern of [
    /current_effective_authorization:\s*none/i,
    /authorizes_deployment_by_this_pr:\s*false/i,
    /authorizes_remote_lab_probe_by_this_pr:\s*false/i,
    /authorizes_service_start_by_this_pr:\s*false/i,
    /authorizes_backup_execution_by_this_pr:\s*false/i,
    /authorizes_restore_execution_by_this_pr:\s*false/i,
    /authorizes_scheduler_install_by_this_pr:\s*false/i,
    /authorizes_provider_call:\s*false/i,
    /authorizes_graph_ingestion:\s*false/i,
    /authorizes_production_write:\s*false/i,
    /authorizes_cloud_provisioning_by_this_pr:\s*false/i,
    /authorizes_dns_or_tls_change_by_this_pr:\s*false/i,
    /authorizes_nginx_or_process_manager_install_by_this_pr:\s*false/i,
    /deployment_readiness_claim:\s*false/i,
    /production_readiness_claim:\s*false/i,
    /product_readiness_claim:\s*false/i,
    /launch_readiness_claim:\s*false/i,
  ]) {
    assert.match(text, pattern, `${label} missing required boundary marker ${pattern}`);
  }
}

function assertNoSecretOrEndpointLiterals(label: string, text: string): void {
  for (const pattern of [
    /https?:\/\/[^\s)]+/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    /\b[A-Za-z0-9.-]+\.(?:com|net|org|io|dev|app)\b/,
    /(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*[^\s`]+/i,
    /s3:\/\//i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} contains endpoint/credential-shaped literal ${pattern}`);
  }
}

test("bounded lab deployment approval packet is inert and concrete enough for a later operator decision", () => {
  const packet = read(APPROVAL_PACKET);

  assert.match(packet, /# Bounded Lab Deployment Execution Approval Packet/i);
  assert.match(packet, /Status: inert-approval/i);
  assert.match(packet, /This packet does not approve or execute the bounded lab deployment\/probe slice/i);
  assertBoundaryMarkers("approval packet", packet);

  for (const required of [
    "LAB_DEPLOYMENT_TARGET_DESCRIPTOR_REF",
    "LAB_DEPLOYMENT_HEALTHCHECK_PLAN_REF",
    "LAB_HOST_SUPERVISION_PLAN_REF",
    "LAB_BACKUP_POLICY_PLAN_REF",
    "LAB_DEPLOYMENT_EXECUTION_PREFLIGHT_REF",
    "LAB_TARGET_HOST_REF",
    "LAB_PUBLIC_BASE_URL_REF",
    "LAB_BIND_HOST_REF",
    "LAB_SERVICE_NAME_REF",
    "LAB_BACKUP_ARTIFACT_ROOT_REF",
    "LAB_RESTORE_PROOF_ARTIFACT_REF",
    "LAB_RUNTIME_MODE=fake",
    "APPROVED_COMMIT_SHA",
  ]) {
    assert.match(packet, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${required} must be named as a config ref or placeholder`);
  }

  assert.match(packet, /single lab target/i);
  assert.match(packet, /exact approved commit/i);
  assert.match(packet, /supervised service start/i);
  assert.match(packet, /\/healthz probe/i);
  assert.match(packet, /optional \/workshop shallow smoke/i);
  assert.match(packet, /backup\/restore proof requires its own explicit approval choice/i);
  assert.match(packet, /stop conditions/i);
  assert.match(packet, /rollback\/teardown/i);
  assert.match(packet, /sanitized evidence/i);
  assert.match(packet, /separate explicit operator approval/i);
  assertNoSecretOrEndpointLiterals("approval packet", packet);
});

test("authority docs point to the approval packet without turning it into effective authorization", () => {
  const index = read(RUNBOOK_INDEX);
  const blockers = read(BLOCKERS);
  const deploymentPlan = read(DEPLOYMENT_PLAN);

  assert.match(index, /`lab-bounded-deployment-execution-approval-packet\.md`\s*\|\s*inert-approval/i);
  assert.match(index, /current_effective_authorization: none/i);
  assert.match(index, /ratified next bounded implementation: none/i);
  assert.match(index, /M4 is shipped upon closeout merge.*implementation authority has returned to none/i);
  assert.match(blockers, /bounded lab deployment execution approval packet/i);
  assert.match(blockers, /bounded lab slice B backup\/restore proof status/i);
  assert.match(blockers, /no-side-effect Gate 3 status reconciliation/i);
  assert.match(deploymentPlan, /bounded lab deployment execution approval packet/i);
  assert.match(deploymentPlan, /bounded lab deployment slice B backup\/restore status/i);
  assert.match(deploymentPlan, /Gate 3 reconciliation completed without side effects/i);

  assertBoundaryMarkers("approval packet", read(APPROVAL_PACKET));
});
