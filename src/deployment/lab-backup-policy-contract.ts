import { CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION } from "../db/local-durable-db.ts";
import type { LabDeploymentTargetDescriptor } from "./lab-deployment-target.ts";

export interface LabBackupPolicyPlanOptions {
  readonly localDbRootRef: string;
  readonly backupArtifactRef: string;
  readonly restoreProofTargetRef: string;
}

export interface LabBackupPolicyLocalDurableDbContract {
  readonly sourceSchemaVersion: typeof CURRENT_LOCAL_DURABLE_DB_SCHEMA_VERSION;
  readonly backupReportKind: "local-durable-db-backup-report";
  readonly restoreReportKind: "local-durable-db-restore-report";
  readonly backupStatusRequired: "created";
  readonly restoreStatusRequired: "restored";
  readonly checksumValidationRequired: true;
  readonly overwriteRequiresExplicitOperatorAction: true;
}

export interface LabBackupPolicySourcePlan {
  readonly localDbRootRef: string;
}

export interface LabBackupPolicyArtifactPlan {
  readonly backupArtifactRef: string;
  readonly format: "versioned-json";
  readonly writeMode: "plan-only-no-write";
}

export interface LabBackupPolicyCadencePlan {
  readonly mode: "local-scheduled";
  readonly scheduleRef: string;
  readonly schedulerInstallAllowed: false;
  readonly timerCreationAllowed: false;
}

export interface LabBackupPolicyRetentionPlan {
  readonly retentionDays: number;
  readonly minimumRetentionDays: 1;
  readonly maximumRetentionDays: 365;
}

export interface LabBackupPolicyRestoreProofPlan {
  readonly requiredBeforeMeaningfulData: true;
  readonly proofMode: "local-restore-round-trip";
  readonly restoreProofTargetRef: string;
  readonly requiredBeforeDeployment: true;
  readonly productionDataAllowed: false;
}

export interface LabBackupPolicyBoundaries {
  readonly backupExecutionAllowed: false;
  readonly restoreExecutionAllowed: false;
  readonly schedulerInstallAllowed: false;
  readonly remoteStorageWritesAllowed: false;
  readonly deploymentExecuted: false;
  readonly remoteProbeAllowed: false;
  readonly providerCallsAllowed: false;
  readonly graphIngestionAllowed: false;
  readonly productionWritesAllowed: false;
  readonly readinessClaimAllowed: false;
}

export interface LabBackupPolicyPlan {
  readonly kind: "lab-backup-policy-plan";
  readonly schemaVersion: "1";
  readonly targetId: string;
  readonly environment: "lab";
  readonly runtimeMode: "fake";
  readonly localDurableDbContract: LabBackupPolicyLocalDurableDbContract;
  readonly source: LabBackupPolicySourcePlan;
  readonly artifact: LabBackupPolicyArtifactPlan;
  readonly cadence: LabBackupPolicyCadencePlan;
  readonly retention: LabBackupPolicyRetentionPlan;
  readonly restoreProof: LabBackupPolicyRestoreProofPlan;
  readonly boundaries: LabBackupPolicyBoundaries;
}

const CONFIG_REF = /^[A-Z][A-Z0-9_]{2,127}$/;
const SAFE_ID = /^[a-z][a-z0-9-]{2,62}$/;

interface LabBackupPolicyDescriptorSnapshot {
  readonly targetId: string;
  readonly environment: "lab";
  readonly runtimeMode: "fake";
  readonly scheduleRef: string;
  readonly retentionDays: number;
  readonly restoreProofRequiredBeforeMeaningfulData: true;
}

function frozenObjectDataValue(input: object, key: string): object | undefined {
  const candidate = dataValue(input, key);
  if (!candidate.ok || typeof candidate.value !== "object" || candidate.value === null || Array.isArray(candidate.value)) return undefined;
  if (!Object.isFrozen(candidate.value)) return undefined;
  return candidate.value;
}

function assertFrozenDescriptor(descriptor: LabDeploymentTargetDescriptor): void {
  if (
    !Object.isFrozen(descriptor) ||
    frozenObjectDataValue(descriptor, "infrastructure") === undefined ||
    frozenObjectDataValue(descriptor, "http") === undefined ||
    frozenObjectDataValue(descriptor, "supervision") === undefined ||
    frozenObjectDataValue(descriptor, "backupPolicy") === undefined ||
    frozenObjectDataValue(descriptor, "boundary") === undefined
  ) {
    throw new Error("lab backup policy planning requires a validated frozen lab deployment target descriptor");
  }
}

function dataValue(input: object, key: string): { ok: true; value: unknown } | { ok: false } {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined || !("value" in descriptor)) return { ok: false };
  return { ok: true, value: descriptor.value };
}

function snapshotDescriptorForBackupPolicy(descriptor: LabDeploymentTargetDescriptor): LabBackupPolicyDescriptorSnapshot {
  const targetId = dataValue(descriptor, "targetId");
  if (!targetId.ok || typeof targetId.value !== "string" || !SAFE_ID.test(targetId.value)) {
    throw new Error("descriptor target id must preserve the validated safe logical id shape before lab backup policy planning");
  }

  const environment = dataValue(descriptor, "environment");
  const runtimeMode = dataValue(descriptor, "runtimeMode");
  if (environment.ok !== true || environment.value !== "lab" || runtimeMode.ok !== true || runtimeMode.value !== "fake") {
    throw new Error("descriptor must preserve no-deploy boundaries before lab backup policy planning");
  }

  const backupPolicy = dataValue(descriptor, "backupPolicy");
  if (!backupPolicy.ok || typeof backupPolicy.value !== "object" || backupPolicy.value === null || Array.isArray(backupPolicy.value)) {
    throw new Error("descriptor backup policy must expose validated data properties before lab backup policy planning");
  }

  const mode = dataValue(backupPolicy.value, "mode");
  const retentionDays = dataValue(backupPolicy.value, "retentionDays");
  const scheduleRef = dataValue(backupPolicy.value, "scheduleRef");
  const restoreProofRequiredBeforeMeaningfulData = dataValue(backupPolicy.value, "restoreProofRequiredBeforeMeaningfulData");
  if (!mode.ok || !retentionDays.ok || !scheduleRef.ok || !restoreProofRequiredBeforeMeaningfulData.ok) {
    throw new Error("descriptor backup policy must expose validated data properties before lab backup policy planning");
  }

  if (
    mode.value !== "local-scheduled" ||
    !Number.isSafeInteger(retentionDays.value) ||
    typeof retentionDays.value !== "number" ||
    retentionDays.value < 1 ||
    retentionDays.value > 365 ||
    !isSafeConfigRef(scheduleRef.value) ||
    restoreProofRequiredBeforeMeaningfulData.value !== true
  ) {
    throw new Error("backup policy must preserve local scheduled restore-proof semantics before lab backup policy planning");
  }

  return {
    targetId: targetId.value,
    environment: environment.value,
    runtimeMode: runtimeMode.value,
    scheduleRef: scheduleRef.value,
    retentionDays: retentionDays.value,
    restoreProofRequiredBeforeMeaningfulData: true,
  };
}

function assertDescriptorPreservesBoundaries(descriptor: LabDeploymentTargetDescriptor): void {
  const schemaVersion = dataValue(descriptor, "schemaVersion");
  const boundary = dataValue(descriptor, "boundary");
  if (!boundary.ok || typeof boundary.value !== "object" || boundary.value === null || Array.isArray(boundary.value)) {
    throw new Error("descriptor boundaries must expose validated data properties before lab backup policy planning");
  }

  const deploymentExecuted = dataValue(boundary.value, "deploymentExecuted");
  const providerCallsAllowed = dataValue(boundary.value, "providerCallsAllowed");
  const productionWritesAllowed = dataValue(boundary.value, "productionWritesAllowed");
  const readinessClaim = dataValue(boundary.value, "readinessClaim");
  if (!deploymentExecuted.ok || !providerCallsAllowed.ok || !productionWritesAllowed.ok || !readinessClaim.ok) {
    throw new Error("descriptor boundaries must expose validated data properties before lab backup policy planning");
  }

  if (
    schemaVersion.ok !== true ||
    schemaVersion.value !== "1" ||
    deploymentExecuted.value !== false ||
    providerCallsAllowed.value !== false ||
    productionWritesAllowed.value !== false ||
    readinessClaim.value !== false
  ) {
    throw new Error("descriptor must preserve no-deploy boundaries before lab backup policy planning");
  }
}

function isSafeConfigRef(value: unknown): value is string {
  return typeof value === "string" && CONFIG_REF.test(value) && !value.includes("://") && !/secret|token|password|credential|api[_-]?key/i.test(value);
}

function assertSafeOptions(options: LabBackupPolicyPlanOptions): void {
  if (
    !isSafeConfigRef(options.localDbRootRef) ||
    !isSafeConfigRef(options.backupArtifactRef) ||
    !isSafeConfigRef(options.restoreProofTargetRef)
  ) {
    throw new Error("backup policy refs must be non-secret config reference names, not literal endpoints or credential refs");
  }
}

function freezePlan(plan: LabBackupPolicyPlan): LabBackupPolicyPlan {
  Object.freeze(plan.localDurableDbContract);
  Object.freeze(plan.source);
  Object.freeze(plan.artifact);
  Object.freeze(plan.cadence);
  Object.freeze(plan.retention);
  Object.freeze(plan.restoreProof);
  Object.freeze(plan.boundaries);
  return Object.freeze(plan);
}

export function createLabBackupPolicyPlan(
  descriptor: LabDeploymentTargetDescriptor,
  options: LabBackupPolicyPlanOptions,
): LabBackupPolicyPlan {
  assertFrozenDescriptor(descriptor);
  assertDescriptorPreservesBoundaries(descriptor);
  const snapshot = snapshotDescriptorForBackupPolicy(descriptor);
  assertSafeOptions(options);

  return freezePlan({
    kind: "lab-backup-policy-plan",
    schemaVersion: "1",
    targetId: snapshot.targetId,
    environment: snapshot.environment,
    runtimeMode: snapshot.runtimeMode,
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
      localDbRootRef: options.localDbRootRef,
    },
    artifact: {
      backupArtifactRef: options.backupArtifactRef,
      format: "versioned-json",
      writeMode: "plan-only-no-write",
    },
    cadence: {
      mode: "local-scheduled",
      scheduleRef: snapshot.scheduleRef,
      schedulerInstallAllowed: false,
      timerCreationAllowed: false,
    },
    retention: {
      retentionDays: snapshot.retentionDays,
      minimumRetentionDays: 1,
      maximumRetentionDays: 365,
    },
    restoreProof: {
      requiredBeforeMeaningfulData: snapshot.restoreProofRequiredBeforeMeaningfulData,
      proofMode: "local-restore-round-trip",
      restoreProofTargetRef: options.restoreProofTargetRef,
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
  });
}
