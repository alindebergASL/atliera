import assert from "node:assert/strict";
import test from "node:test";

import { CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION } from "../../src/db/local-durable-db.ts";
import {
  createLabBackupPolicyPlan,
  type LabBackupPolicyPlan,
} from "../../src/deployment/lab-backup-policy-contract.ts";
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

function descriptorSnapshot() {
  const input = validDescriptor();
  const result = validateLabDeploymentTargetDescriptor(input);
  assert.equal(result.ok, true);
  return { input, descriptor: result.descriptor };
}

const planOptions = () => ({
  localDbRootRef: "ATL_LOCAL_DURABLE_DB_ROOT",
  backupArtifactRef: "ATL_LAB_BACKUP_ARTIFACT",
  restoreProofTargetRef: "ATL_LAB_BACKUP_RESTORE_PROOF_TARGET",
});

test("derives a frozen plan-only lab backup policy from descriptor and local backup/restore contract refs", () => {
  const { input, descriptor } = descriptorSnapshot();
  const plan = createLabBackupPolicyPlan(descriptor, planOptions());

  assert.deepEqual(plan, {
    kind: "lab-backup-policy-plan",
    schemaVersion: "1",
    targetId: "lab-fake-workshop",
    environment: "lab",
    runtimeMode: "fake",
    localDurableDbContract: {
      sourceSchemaVersion: CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION,
      backupReportKind: "local-durable-db-backup-report",
      restoreReportKind: "local-durable-db-restore-report",
      backupStatusRequired: "created",
      restoreStatusRequired: "restored",
      checksumValidationRequired: true,
      overwriteRequiresExplicitOperatorAction: true,
    },
    source: {
      localDbRootRef: "ATL_LOCAL_DURABLE_DB_ROOT",
    },
    artifact: {
      backupArtifactRef: "ATL_LAB_BACKUP_ARTIFACT",
      format: "versioned-json",
      writeMode: "plan-only-no-write",
    },
    cadence: {
      mode: "local-scheduled",
      scheduleRef: "ATL_LAB_BACKUP_SCHEDULE",
      schedulerInstallAllowed: false,
      timerCreationAllowed: false,
    },
    retention: {
      retentionDays: 7,
      minimumRetentionDays: 1,
      maximumRetentionDays: 365,
    },
    restoreProof: {
      requiredBeforeMeaningfulData: true,
      proofMode: "local-restore-round-trip",
      restoreProofTargetRef: "ATL_LAB_BACKUP_RESTORE_PROOF_TARGET",
      requiredBeforeDeployment: true,
      productionDataAllowed: false,
    },
    boundaries: {
      backupExecutionAllowed: false,
      restoreExecutionAllowed: false,
      schedulerInstallAllowed: false,
      remoteStorageWritesAllowed: false,
      deploymentExecuted: false,
      remoteProbeAllowed: false,
      providerCallsAllowed: false,
      graphIngestionAllowed: false,
      productionWritesAllowed: false,
      readinessClaimAllowed: false,
    },
  } satisfies LabBackupPolicyPlan);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.localDurableDbContract), true);
  assert.equal(Object.isFrozen(plan.source), true);
  assert.equal(Object.isFrozen(plan.artifact), true);
  assert.equal(Object.isFrozen(plan.cadence), true);
  assert.equal(Object.isFrozen(plan.retention), true);
  assert.equal(Object.isFrozen(plan.restoreProof), true);
  assert.equal(Object.isFrozen(plan.boundaries), true);

  input.backupPolicy.retentionDays = 30;
  assert.equal(plan.retention.retentionDays, 7);
});

test("refuses mutable or broadened deployment descriptor inputs", () => {
  const { descriptor } = descriptorSnapshot();
  assert.throws(
    () => createLabBackupPolicyPlan(validDescriptor() as never, planOptions()),
    /validated frozen lab deployment target descriptor/,
  );

  const broadened = {
    ...descriptor,
    boundary: {
      ...descriptor.boundary,
      productionWritesAllowed: true,
    },
  } as unknown as typeof descriptor;
  Object.freeze(broadened.infrastructure);
  Object.freeze(broadened.http);
  Object.freeze(broadened.supervision);
  Object.freeze(broadened.backupPolicy);
  Object.freeze(broadened.boundary);
  Object.freeze(broadened);

  assert.throws(
    () => createLabBackupPolicyPlan(broadened, planOptions()),
    /descriptor must preserve no-deploy boundaries/,
  );
});

test("fails closed when descriptor backup policy semantics are broadened or unsafe", () => {
  const { descriptor } = descriptorSnapshot();
  const invalidRetention = {
    ...descriptor,
    backupPolicy: {
      ...descriptor.backupPolicy,
      retentionDays: 366,
    },
  } as unknown as typeof descriptor;
  Object.freeze(invalidRetention.infrastructure);
  Object.freeze(invalidRetention.http);
  Object.freeze(invalidRetention.supervision);
  Object.freeze(invalidRetention.backupPolicy);
  Object.freeze(invalidRetention.boundary);
  Object.freeze(invalidRetention);

  assert.throws(
    () => createLabBackupPolicyPlan(invalidRetention, planOptions()),
    /backup policy must preserve local scheduled restore-proof semantics/,
  );

  const remoteScheduled = {
    ...descriptor,
    backupPolicy: {
      ...descriptor.backupPolicy,
      mode: "remote-scheduled",
    },
  } as unknown as typeof descriptor;
  Object.freeze(remoteScheduled.infrastructure);
  Object.freeze(remoteScheduled.http);
  Object.freeze(remoteScheduled.supervision);
  Object.freeze(remoteScheduled.backupPolicy);
  Object.freeze(remoteScheduled.boundary);
  Object.freeze(remoteScheduled);

  assert.throws(
    () => createLabBackupPolicyPlan(remoteScheduled, planOptions()),
    /backup policy must preserve local scheduled restore-proof semantics/,
  );
});

test("refuses forged frozen descriptors with unsafe target IDs or accessor-backed backup policy values", () => {
  const { descriptor } = descriptorSnapshot();
  const accessorInfrastructure = { ...descriptor } as Record<string, unknown>;
  Object.defineProperty(accessorInfrastructure, "infrastructure", {
    enumerable: true,
    configurable: false,
    get() {
      throw new Error("leaky infrastructure getter");
    },
  });
  Object.freeze(accessorInfrastructure);
  assert.throws(
    () => createLabBackupPolicyPlan(accessorInfrastructure as never, planOptions()),
    /validated frozen lab deployment target descriptor/,
  );

  const unsafeTarget = { ...descriptor, targetId: "https://lab.example.invalid" } as unknown as typeof descriptor;
  Object.freeze(unsafeTarget.infrastructure);
  Object.freeze(unsafeTarget.http);
  Object.freeze(unsafeTarget.supervision);
  Object.freeze(unsafeTarget.backupPolicy);
  Object.freeze(unsafeTarget.boundary);
  Object.freeze(unsafeTarget);
  assert.throws(
    () => createLabBackupPolicyPlan(unsafeTarget, planOptions()),
    /descriptor target id must preserve the validated safe logical id shape/,
  );

  let retentionReads = 0;
  const accessorBackupPolicy = {
    mode: "local-scheduled",
    scheduleRef: "ATL_LAB_BACKUP_SCHEDULE",
    restoreProofRequiredBeforeMeaningfulData: true,
  } as Record<string, unknown>;
  Object.defineProperty(accessorBackupPolicy, "retentionDays", {
    enumerable: true,
    configurable: false,
    get() {
      retentionReads += 1;
      return retentionReads === 1 ? 7 : 30;
    },
  });
  Object.freeze(accessorBackupPolicy);
  const accessorDescriptor = { ...descriptor, backupPolicy: accessorBackupPolicy } as unknown as typeof descriptor;
  Object.freeze(accessorDescriptor.infrastructure);
  Object.freeze(accessorDescriptor.http);
  Object.freeze(accessorDescriptor.supervision);
  Object.freeze(accessorDescriptor.boundary);
  Object.freeze(accessorDescriptor);

  assert.throws(
    () => createLabBackupPolicyPlan(accessorDescriptor, planOptions()),
    /descriptor backup policy must expose validated data properties/,
  );

  const accessorBoundary = {
    deploymentExecuted: false,
    providerCallsAllowed: false,
    readinessClaim: false,
  } as Record<string, unknown>;
  Object.defineProperty(accessorBoundary, "productionWritesAllowed", {
    enumerable: true,
    configurable: false,
    get() {
      return false;
    },
  });
  Object.freeze(accessorBoundary);
  const boundaryDescriptor = { ...descriptor, boundary: accessorBoundary } as unknown as typeof descriptor;
  Object.freeze(boundaryDescriptor.infrastructure);
  Object.freeze(boundaryDescriptor.http);
  Object.freeze(boundaryDescriptor.supervision);
  Object.freeze(boundaryDescriptor.backupPolicy);
  Object.freeze(boundaryDescriptor);

  assert.throws(
    () => createLabBackupPolicyPlan(boundaryDescriptor, planOptions()),
    /descriptor boundaries must expose validated data properties/,
  );
});

test("refuses endpoint-shaped or credential-shaped backup policy references", () => {
  const { descriptor } = descriptorSnapshot();
  assert.throws(
    () =>
      createLabBackupPolicyPlan(descriptor, {
        ...planOptions(),
        localDbRootRef: "https://storage.example.invalid/db-root",
      }),
    /backup policy refs must be non-secret config reference names/,
  );
  assert.throws(
    () =>
      createLabBackupPolicyPlan(descriptor, {
        ...planOptions(),
        backupArtifactRef: "https://storage.example.invalid/backups",
      }),
    /backup policy refs must be non-secret config reference names/,
  );
  assert.throws(
    () =>
      createLabBackupPolicyPlan(descriptor, {
        ...planOptions(),
        restoreProofTargetRef: "ATL_LAB_SECRET_TOKEN",
      }),
    /backup policy refs must be non-secret config reference names/,
  );
});

test("does not read process.env or retain token-shaped data while deriving backup policy plan", () => {
  const { descriptor } = descriptorSnapshot();
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const plan = createLabBackupPolicyPlan(descriptor, planOptions());
    assert.doesNotMatch(JSON.stringify(plan), /token|secret|authorization|bearer|https?:\/\//i);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});
