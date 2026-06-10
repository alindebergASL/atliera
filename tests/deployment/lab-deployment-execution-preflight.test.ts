import assert from "node:assert/strict";
import test from "node:test";

import { createLabBackupPolicyPlan } from "../../src/deployment/lab-backup-policy-contract.ts";
import {
  createLabDeploymentExecutionPreflight,
  type LabDeploymentExecutionPreflight,
} from "../../src/deployment/lab-deployment-execution-preflight.ts";
import { createLabDeploymentHealthcheckPlan } from "../../src/deployment/lab-healthcheck-contract.ts";
import { createLabHostSupervisionPlan } from "../../src/deployment/lab-supervision-contract.ts";
import { validateLabDeploymentTargetDescriptor } from "../../src/deployment/lab-deployment-target.ts";

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
});

function snapshots() {
  const input = validDescriptor();
  const result = validateLabDeploymentTargetDescriptor(input);
  assert.equal(result.ok, true);
  const descriptor = result.descriptor;
  const healthcheck = createLabDeploymentHealthcheckPlan(descriptor, { authMode: "bearer-required-without-token-material" });
  const supervision = createLabHostSupervisionPlan(descriptor, healthcheck);
  const backupPolicy = createLabBackupPolicyPlan(descriptor, {
    localDbRootRef: "ATL_LOCAL_DURABLE_DB_ROOT",
    backupArtifactRef: "ATL_LAB_BACKUP_ARTIFACT",
    restoreProofTargetRef: "ATL_LAB_BACKUP_RESTORE_PROOF_TARGET",
  });
  return { input, descriptor, healthcheck, supervision, backupPolicy };
}

test("derives a frozen no-authorization deployment execution preflight from the four plan-only contracts", () => {
  const { input, descriptor, healthcheck, supervision, backupPolicy } = snapshots();
  const preflight = createLabDeploymentExecutionPreflight(descriptor, healthcheck, supervision, backupPolicy);

  assert.deepEqual(preflight, {
    kind: "lab-deployment-execution-preflight",
    schemaVersion: "1",
    targetId: "lab-fake-workshop",
    environment: "lab",
    runtimeMode: "fake",
    requiredPlans: {
      descriptorKind: "lab-deployment-target-descriptor",
      healthcheckKind: "lab-deployment-healthcheck-plan",
      supervisionKind: "lab-host-supervision-plan",
      backupPolicyKind: "lab-backup-policy-plan",
    },
    targetRefs: {
      serviceName: "atliera-workshop",
      bindHostRef: "ATL_LAB_BIND_HOST",
      port: 3000,
      publicBaseUrlRef: "ATL_LAB_BASE_URL",
      healthcheckPath: "/healthz",
      workshopPath: "/workshop",
    },
    prerequisites: {
      explicitOperatorApprovalRequired: true,
      restoreProofRequiredBeforeDeployment: true,
      backupPolicyRequiredBeforeMeaningfulData: true,
      healthcheckPlanRequiredBeforeRemoteProbe: true,
      supervisionPlanRequiredBeforeServiceStart: true,
    },
    authorization: {
      currentEffectiveAuthorization: "none",
      deploymentExecutionAllowed: false,
      remoteProbeAllowed: false,
      serviceStartAllowed: false,
      backupExecutionAllowed: false,
      restoreExecutionAllowed: false,
      providerCallsAllowed: false,
      graphIngestionAllowed: false,
      productionWritesAllowed: false,
      readinessClaimAllowed: false,
    },
    nextDecision: {
      requiredDecision: "separate-explicit-operator-approval",
      allowedWithoutFurtherApproval: "none",
    },
  } satisfies LabDeploymentExecutionPreflight);

  assert.equal(Object.isFrozen(preflight), true);
  assert.equal(Object.isFrozen(preflight.requiredPlans), true);
  assert.equal(Object.isFrozen(preflight.targetRefs), true);
  assert.equal(Object.isFrozen(preflight.prerequisites), true);
  assert.equal(Object.isFrozen(preflight.authorization), true);
  assert.equal(Object.isFrozen(preflight.nextDecision), true);

  input.http.port = 9000;
  assert.equal(preflight.targetRefs.port, 3000);
});

test("refuses mutable, mismatched, or broadened plan-only inputs", () => {
  const { descriptor, healthcheck, supervision, backupPolicy } = snapshots();

  assert.throws(
    () => createLabDeploymentExecutionPreflight(validDescriptor() as never, healthcheck, supervision, backupPolicy),
    /validated frozen lab deployment target descriptor/,
  );

  const mutableHealthcheck = { ...healthcheck };
  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, mutableHealthcheck, supervision, backupPolicy),
    /validated frozen lab deployment healthcheck plan/,
  );

  const mismatchedSupervision = { ...supervision, targetId: "other-target" } as unknown as typeof supervision;
  Object.freeze(mismatchedSupervision.supervisor);
  Object.freeze(mismatchedSupervision.process);
  Object.freeze(mismatchedSupervision.healthcheck);
  Object.freeze(mismatchedSupervision.restart);
  Object.freeze(mismatchedSupervision.gracefulStop);
  Object.freeze(mismatchedSupervision.boundaries);
  Object.freeze(mismatchedSupervision);
  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, healthcheck, mismatchedSupervision, backupPolicy),
    /must describe the same target/,
  );

  const wrongDescriptorSupervisionMode = {
    ...descriptor,
    supervision: {
      ...descriptor.supervision,
      mode: "pm2-plan",
    },
  } as unknown as typeof descriptor;
  Object.freeze(wrongDescriptorSupervisionMode.infrastructure);
  Object.freeze(wrongDescriptorSupervisionMode.http);
  Object.freeze(wrongDescriptorSupervisionMode.supervision);
  Object.freeze(wrongDescriptorSupervisionMode.backupPolicy);
  Object.freeze(wrongDescriptorSupervisionMode.boundary);
  Object.freeze(wrongDescriptorSupervisionMode);
  assert.throws(
    () => createLabDeploymentExecutionPreflight(wrongDescriptorSupervisionMode, healthcheck, supervision, backupPolicy),
    /descriptor must preserve validated target refs/,
  );

  const wrongAuthModeHealthcheck = {
    ...healthcheck,
    authMode: "bearer-token-material-present",
  } as unknown as typeof healthcheck;
  Object.freeze(wrongAuthModeHealthcheck.expected);
  Object.freeze(wrongAuthModeHealthcheck.boundaries);
  Object.freeze(wrongAuthModeHealthcheck);
  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, wrongAuthModeHealthcheck, supervision, backupPolicy),
    /healthcheck plan must preserve no-execution boundaries/,
  );

  const broadenedBackup = {
    ...backupPolicy,
    boundaries: {
      ...backupPolicy.boundaries,
      backupExecutionAllowed: true,
    },
  } as unknown as typeof backupPolicy;
  Object.freeze(broadenedBackup.localDurableDbContract);
  Object.freeze(broadenedBackup.source);
  Object.freeze(broadenedBackup.artifact);
  Object.freeze(broadenedBackup.cadence);
  Object.freeze(broadenedBackup.retention);
  Object.freeze(broadenedBackup.restoreProof);
  Object.freeze(broadenedBackup.boundaries);
  Object.freeze(broadenedBackup);
  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, healthcheck, supervision, broadenedBackup),
    /backup policy plan must preserve no-execution boundaries/,
  );
});

test("fails closed when plan refs diverge from the descriptor target", () => {
  const { descriptor, healthcheck, supervision, backupPolicy } = snapshots();

  const divergentHealthcheck = { ...healthcheck, publicBaseUrlRef: "ATL_OTHER_BASE_URL" } as unknown as typeof healthcheck;
  Object.freeze(divergentHealthcheck.expected);
  Object.freeze(divergentHealthcheck.boundaries);
  Object.freeze(divergentHealthcheck);
  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, divergentHealthcheck, supervision, backupPolicy),
    /descriptor and healthcheck plan must preserve the same HTTP refs/,
  );

  const divergentSupervision = {
    ...supervision,
    process: {
      ...supervision.process,
      bindHostRef: "ATL_OTHER_BIND_HOST",
    },
  } as unknown as typeof supervision;
  Object.freeze(divergentSupervision.supervisor);
  Object.freeze(divergentSupervision.process);
  Object.freeze(divergentSupervision.healthcheck);
  Object.freeze(divergentSupervision.restart);
  Object.freeze(divergentSupervision.gracefulStop);
  Object.freeze(divergentSupervision.boundaries);
  Object.freeze(divergentSupervision);
  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, healthcheck, divergentSupervision, backupPolicy),
    /descriptor and supervision plan must preserve the same process refs/,
  );
});

test("refuses accessor-backed forged frozen plans before deriving the execution preflight", () => {
  const { descriptor, healthcheck, supervision, backupPolicy } = snapshots();

  const accessorAuthorization = { ...supervision } as Record<string, unknown>;
  Object.defineProperty(accessorAuthorization, "boundaries", {
    enumerable: true,
    configurable: false,
    get() {
      throw new Error("leaky supervision boundary getter");
    },
  });
  Object.freeze(accessorAuthorization);
  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, healthcheck, accessorAuthorization as never, backupPolicy),
    /validated frozen lab host supervision plan/,
  );

  const accessorRestoreProof = { ...backupPolicy.restoreProof } as Record<string, unknown>;
  Object.defineProperty(accessorRestoreProof, "requiredBeforeDeployment", {
    enumerable: true,
    configurable: false,
    get() {
      return true;
    },
  });
  Object.freeze(accessorRestoreProof);
  const accessorBackup = { ...backupPolicy, restoreProof: accessorRestoreProof } as unknown as typeof backupPolicy;
  Object.freeze(accessorBackup.localDurableDbContract);
  Object.freeze(accessorBackup.source);
  Object.freeze(accessorBackup.artifact);
  Object.freeze(accessorBackup.cadence);
  Object.freeze(accessorBackup.retention);
  Object.freeze(accessorBackup.boundaries);
  Object.freeze(accessorBackup);

  assert.throws(
    () => createLabDeploymentExecutionPreflight(descriptor, healthcheck, supervision, accessorBackup),
    /backup policy plan restore proof must expose validated data properties/,
  );
});

test("does not read process.env or retain token-shaped data while deriving execution preflight", () => {
  const { descriptor, healthcheck, supervision, backupPolicy } = snapshots();
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const preflight = createLabDeploymentExecutionPreflight(descriptor, healthcheck, supervision, backupPolicy);
    assert.doesNotMatch(JSON.stringify(preflight), /token|secret|authorization: bearer|https?:\/\//i);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});
