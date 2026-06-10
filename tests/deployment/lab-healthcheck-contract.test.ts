import assert from "node:assert/strict";
import test from "node:test";

import { parseLocalBearerAuthConfig } from "../../src/auth/bearer-token-auth.ts";
import {
  createLabDeploymentHealthcheckPlan,
  evaluateLabDeploymentHealthcheckResponse,
  type LabDeploymentHealthcheckHttpResponse,
} from "../../src/deployment/lab-healthcheck-contract.ts";
import { validateLabDeploymentTargetDescriptor } from "../../src/deployment/lab-deployment-target.ts";
import { createInMemoryAtlieraRuntime } from "../../src/runtime/composition.ts";
import { handleFakeModeWorkshopRequest } from "../../src/runtime/fake-mode-workshop-server.ts";

const validDescriptor = () => ({
  schemaVersion: "1",
  targetId: "lab-fake-workshop",
  environment: "lab",
  runtimeMode: "fake",
  infrastructure: {
    provider: "configurable-vm",
    regionRef: "ATL_LAB_REGION",
    hostRef: "ATL_LAB_HOST",
  },
  http: {
    bindHostRef: "ATL_LAB_BIND_HOST",
    port: 3000,
    publicBaseUrlRef: "ATL_LAB_BASE_URL",
    healthcheckPath: "/healthz",
    workshopPath: "/workshop",
  },
  supervision: {
    mode: "systemd-plan",
    serviceName: "atliera-workshop",
  },
  backupPolicy: {
    mode: "local-scheduled",
    retentionDays: 7,
    scheduleRef: "ATL_LAB_BACKUP_SCHEDULE",
    restoreProofRequiredBeforeMeaningfulData: true,
  },
  boundary: {
    deploymentExecuted: false,
    providerCallsAllowed: false,
    productionWritesAllowed: false,
    readinessClaim: false,
  },
  capabilities: ["serve"],
  notes: "Plan-only descriptor with placeholder config refs; no deployment is authorized.",
});

function validDescriptorSnapshot() {
  const input = validDescriptor();
  const result = validateLabDeploymentTargetDescriptor(input);
  assert.equal(result.ok, true);
  return { input, descriptor: result.descriptor };
}

test("derives a frozen plan-only healthcheck contract from a validated lab descriptor snapshot", () => {
  const { input, descriptor } = validDescriptorSnapshot();
  const plan = createLabDeploymentHealthcheckPlan(descriptor, { authMode: "bearer-required-without-token-material" });

  assert.deepEqual(plan, {
    kind: "lab-deployment-healthcheck-plan",
    schemaVersion: "1",
    targetId: "lab-fake-workshop",
    environment: "lab",
    runtimeMode: "fake",
    method: "GET",
    bindHostRef: "ATL_LAB_BIND_HOST",
    port: 3000,
    publicBaseUrlRef: "ATL_LAB_BASE_URL",
    healthcheckPath: "/healthz",
    workshopPath: "/workshop",
    authMode: "bearer-required-without-token-material",
    expected: {
      statusCode: 200,
      kind: "fake-mode-workshop-healthcheck",
      graphSnapshotRead: false,
      providerCallsMade: 0,
      productionWrites: false,
      deploymentReadinessClaim: false,
      productionReadinessClaim: false,
    },
    boundaries: {
      remoteProbeAllowed: false,
      deploymentExecuted: false,
      providerCallsAllowed: false,
      graphIngestionAllowed: false,
      productionWritesAllowed: false,
      readinessClaimAllowed: false,
    },
  });
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.expected), true);
  assert.equal(Object.isFrozen(plan.boundaries), true);

  input.http.healthcheckPath = "/mutated";
  input.boundary.readinessClaim = true;
  assert.equal(plan.healthcheckPath, "/healthz");
  assert.equal(plan.boundaries.readinessClaimAllowed, false);
});

test("rejects unvalidated mutable descriptors before deriving a healthcheck plan", () => {
  assert.throws(
    () => createLabDeploymentHealthcheckPlan(validDescriptor() as never, { authMode: "not-configured" }),
    /validated frozen lab deployment target descriptor/,
  );
});

test("derives healthcheck plans without reading process.env or token material", () => {
  const { descriptor } = validDescriptorSnapshot();
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const plan = createLabDeploymentHealthcheckPlan(descriptor, { authMode: "not-configured" });
    assert.equal(plan.authMode, "not-configured");
    assert.doesNotMatch(JSON.stringify(plan), /secret|token|authorization|bearer-value/i);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});

test("evaluates an in-process fake-mode healthcheck response without claiming deployment readiness", async () => {
  const { descriptor } = validDescriptorSnapshot();
  const plan = createLabDeploymentHealthcheckPlan(descriptor, { authMode: "bearer-required-without-token-material" });
  const auth = parseLocalBearerAuthConfig({ ATLIERA_LOCAL_BEARER_TOKEN: "fixture-healthcheck-token" });
  assert.equal(auth.mode, "required");

  const response = await handleFakeModeWorkshopRequest(
    createInMemoryAtlieraRuntime({
      NODE_ENV: "lab",
      MODEL_PROVIDER: "fake",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
    }),
    {
      method: plan.method,
      path: plan.healthcheckPath,
      headers: { authorization: "Bearer fixture-healthcheck-token" },
    },
    { auth },
  );

  const report = evaluateLabDeploymentHealthcheckResponse(plan, response);
  assert.equal(report.ok, true);
  assert.equal(report.status, "pass");
  assert.equal(report.remoteProbePerformed, false);
  assert.equal(report.deploymentReadinessClaim, false);
  assert.equal(report.productionReadinessClaim, false);
  assert.equal(report.providerCallsMade, 0);
  assert.equal(report.graphSnapshotRead, false);
  assert.equal(report.productionWrites, false);
  assert.deepEqual(report.failureCodes, []);
  assert.doesNotMatch(JSON.stringify(report), /fixture-healthcheck-token/);
});

test("fails closed for malformed or overclaiming healthcheck responses", () => {
  const { descriptor } = validDescriptorSnapshot();
  const plan = createLabDeploymentHealthcheckPlan(descriptor, { authMode: "not-configured" });

  const response: LabDeploymentHealthcheckHttpResponse = {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ok: true,
      kind: "fake-mode-workshop-healthcheck",
      graphSnapshotRead: true,
      providerCallsMade: 1,
      productionWrites: true,
      deploymentReadinessClaim: true,
      productionReadinessClaim: true,
      unexpectedTokenEcho: "fixture-healthcheck-token",
    }),
  };

  const report = evaluateLabDeploymentHealthcheckResponse(plan, response);
  assert.equal(report.ok, false);
  assert.equal(report.status, "fail");
  assert.deepEqual([...report.failureCodes].sort(), [
    "deployment_readiness_claim_present",
    "graph_snapshot_was_read",
    "production_readiness_claim_present",
    "production_writes_present",
    "provider_calls_made",
  ]);
  assert.doesNotMatch(JSON.stringify(report), /fixture-healthcheck-token/);
});
