import type { LabBackupPolicyPlan } from "./lab-backup-policy-contract.ts";
import type { LabDeploymentTargetDescriptor } from "./lab-deployment-target.ts";
import type { LabDeploymentHealthcheckPlan } from "./lab-healthcheck-contract.ts";
import type { LabHostSupervisionPlan } from "./lab-supervision-contract.ts";

export interface LabDeploymentExecutionRequiredPlans {
  readonly descriptorKind: "lab-deployment-target-descriptor";
  readonly healthcheckKind: "lab-deployment-healthcheck-plan";
  readonly supervisionKind: "lab-host-supervision-plan";
  readonly backupPolicyKind: "lab-backup-policy-plan";
}

export interface LabDeploymentExecutionTargetRefs {
  readonly serviceName: string;
  readonly bindHostRef: string;
  readonly port: number;
  readonly publicBaseUrlRef: string;
  readonly healthcheckPath: "/healthz";
  readonly workshopPath: "/workshop";
}

export interface LabDeploymentExecutionPrerequisites {
  readonly explicitOperatorApprovalRequired: true;
  readonly restoreProofRequiredBeforeDeployment: true;
  readonly backupPolicyRequiredBeforeMeaningfulData: true;
  readonly healthcheckPlanRequiredBeforeRemoteProbe: true;
  readonly supervisionPlanRequiredBeforeServiceStart: true;
}

export interface LabDeploymentExecutionAuthorization {
  readonly currentEffectiveAuthorization: "none";
  readonly deploymentExecutionAllowed: false;
  readonly remoteProbeAllowed: false;
  readonly serviceStartAllowed: false;
  readonly backupExecutionAllowed: false;
  readonly restoreExecutionAllowed: false;
  readonly providerCallsAllowed: false;
  readonly graphIngestionAllowed: false;
  readonly productionWritesAllowed: false;
  readonly readinessClaimAllowed: false;
}

export interface LabDeploymentExecutionNextDecision {
  readonly requiredDecision: "separate-explicit-operator-approval";
  readonly allowedWithoutFurtherApproval: "none";
}

export interface LabDeploymentExecutionPreflight {
  readonly kind: "lab-deployment-execution-preflight";
  readonly schemaVersion: "1";
  readonly targetId: string;
  readonly environment: "lab";
  readonly runtimeMode: "fake";
  readonly requiredPlans: LabDeploymentExecutionRequiredPlans;
  readonly targetRefs: LabDeploymentExecutionTargetRefs;
  readonly prerequisites: LabDeploymentExecutionPrerequisites;
  readonly authorization: LabDeploymentExecutionAuthorization;
  readonly nextDecision: LabDeploymentExecutionNextDecision;
}

const SAFE_ID = /^[a-z][a-z0-9-]{2,62}$/;
const SAFE_SERVICE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{1,62}$/;
const CONFIG_REF = /^[A-Z][A-Z0-9_]{2,127}$/;

interface DescriptorSnapshot {
  readonly targetId: string;
  readonly environment: "lab";
  readonly runtimeMode: "fake";
  readonly serviceName: string;
  readonly bindHostRef: string;
  readonly port: number;
  readonly publicBaseUrlRef: string;
  readonly healthcheckPath: "/healthz";
  readonly workshopPath: "/workshop";
}

interface HealthcheckSnapshot {
  readonly targetId: string;
  readonly bindHostRef: string;
  readonly port: number;
  readonly publicBaseUrlRef: string;
  readonly healthcheckPath: "/healthz";
  readonly workshopPath: "/workshop";
}

interface SupervisionSnapshot {
  readonly targetId: string;
  readonly serviceName: string;
  readonly runtimeMode: "fake";
  readonly bindHostRef: string;
  readonly port: number;
  readonly publicBaseUrlRef: string;
}

interface BackupPolicySnapshot {
  readonly targetId: string;
  readonly environment: "lab";
  readonly runtimeMode: "fake";
  readonly restoreProofRequiredBeforeDeployment: true;
  readonly backupPolicyRequiredBeforeMeaningfulData: true;
}

function dataValue(input: object, key: string): { ok: true; value: unknown } | { ok: false } {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined || !("value" in descriptor)) return { ok: false };
  return { ok: true, value: descriptor.value };
}

function frozenObjectDataValue(input: object, key: string): object | undefined {
  const candidate = dataValue(input, key);
  if (!candidate.ok || typeof candidate.value !== "object" || candidate.value === null || Array.isArray(candidate.value)) return undefined;
  if (!Object.isFrozen(candidate.value)) return undefined;
  return candidate.value;
}

function stringData(input: object, key: string): string | undefined {
  const candidate = dataValue(input, key);
  return candidate.ok && typeof candidate.value === "string" ? candidate.value : undefined;
}

function numberData(input: object, key: string): number | undefined {
  const candidate = dataValue(input, key);
  return candidate.ok && typeof candidate.value === "number" && Number.isSafeInteger(candidate.value) ? candidate.value : undefined;
}

function booleanFalseData(input: object, key: string): boolean {
  const candidate = dataValue(input, key);
  return candidate.ok && candidate.value === false;
}

function booleanTrueData(input: object, key: string): boolean {
  const candidate = dataValue(input, key);
  return candidate.ok && candidate.value === true;
}

function isSafeConfigRef(value: unknown): value is string {
  return typeof value === "string" && CONFIG_REF.test(value) && !value.includes("://") && !/secret|token|password|credential|api[_-]?key/i.test(value);
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
    throw new Error("lab deployment execution preflight requires a validated frozen lab deployment target descriptor");
  }
}

function assertFrozenHealthcheckPlan(healthcheck: LabDeploymentHealthcheckPlan): void {
  if (
    !Object.isFrozen(healthcheck) ||
    frozenObjectDataValue(healthcheck, "expected") === undefined ||
    frozenObjectDataValue(healthcheck, "boundaries") === undefined
  ) {
    throw new Error("lab deployment execution preflight requires a validated frozen lab deployment healthcheck plan");
  }
}

function assertFrozenSupervisionPlan(supervision: LabHostSupervisionPlan): void {
  if (
    !Object.isFrozen(supervision) ||
    frozenObjectDataValue(supervision, "supervisor") === undefined ||
    frozenObjectDataValue(supervision, "process") === undefined ||
    frozenObjectDataValue(supervision, "healthcheck") === undefined ||
    frozenObjectDataValue(supervision, "restart") === undefined ||
    frozenObjectDataValue(supervision, "gracefulStop") === undefined ||
    frozenObjectDataValue(supervision, "boundaries") === undefined
  ) {
    throw new Error("lab deployment execution preflight requires a validated frozen lab host supervision plan");
  }
}

function assertFrozenBackupPolicyPlan(backupPolicy: LabBackupPolicyPlan): void {
  if (
    !Object.isFrozen(backupPolicy) ||
    frozenObjectDataValue(backupPolicy, "localDurableDbContract") === undefined ||
    frozenObjectDataValue(backupPolicy, "source") === undefined ||
    frozenObjectDataValue(backupPolicy, "artifact") === undefined ||
    frozenObjectDataValue(backupPolicy, "cadence") === undefined ||
    frozenObjectDataValue(backupPolicy, "retention") === undefined ||
    frozenObjectDataValue(backupPolicy, "restoreProof") === undefined ||
    frozenObjectDataValue(backupPolicy, "boundaries") === undefined
  ) {
    throw new Error("lab deployment execution preflight requires a validated frozen lab backup policy plan");
  }
}

function snapshotDescriptor(descriptor: LabDeploymentTargetDescriptor): DescriptorSnapshot {
  const schemaVersion = stringData(descriptor, "schemaVersion");
  const targetId = stringData(descriptor, "targetId");
  const environment = stringData(descriptor, "environment");
  const runtimeMode = stringData(descriptor, "runtimeMode");
  const http = frozenObjectDataValue(descriptor, "http");
  const supervision = frozenObjectDataValue(descriptor, "supervision");
  const boundary = frozenObjectDataValue(descriptor, "boundary");

  if (
    schemaVersion !== "1" ||
    typeof targetId !== "string" ||
    !SAFE_ID.test(targetId) ||
    environment !== "lab" ||
    runtimeMode !== "fake" ||
    http === undefined ||
    supervision === undefined ||
    boundary === undefined ||
    booleanFalseData(boundary, "deploymentExecuted") !== true ||
    booleanFalseData(boundary, "providerCallsAllowed") !== true ||
    booleanFalseData(boundary, "productionWritesAllowed") !== true ||
    booleanFalseData(boundary, "readinessClaim") !== true
  ) {
    throw new Error("descriptor must preserve no-deploy boundaries before lab deployment execution preflight planning");
  }

  const serviceName = stringData(supervision, "serviceName");
  const supervisionMode = stringData(supervision, "mode");
  const bindHostRef = stringData(http, "bindHostRef");
  const port = numberData(http, "port");
  const publicBaseUrlRef = stringData(http, "publicBaseUrlRef");
  const healthcheckPath = stringData(http, "healthcheckPath");
  const workshopPath = stringData(http, "workshopPath");
  if (
    supervisionMode !== "systemd-plan" ||
    typeof serviceName !== "string" ||
    !SAFE_SERVICE_NAME.test(serviceName) ||
    !isSafeConfigRef(bindHostRef) ||
    port === undefined ||
    port < 1 ||
    port > 65535 ||
    !isSafeConfigRef(publicBaseUrlRef) ||
    healthcheckPath !== "/healthz" ||
    workshopPath !== "/workshop"
  ) {
    throw new Error("descriptor must preserve validated target refs before lab deployment execution preflight planning");
  }

  return {
    targetId,
    environment: "lab",
    runtimeMode: "fake",
    serviceName,
    bindHostRef,
    port,
    publicBaseUrlRef,
    healthcheckPath: "/healthz",
    workshopPath: "/workshop",
  };
}

function snapshotHealthcheck(healthcheck: LabDeploymentHealthcheckPlan): HealthcheckSnapshot {
  const expected = frozenObjectDataValue(healthcheck, "expected");
  const boundaries = frozenObjectDataValue(healthcheck, "boundaries");
  if (expected === undefined || boundaries === undefined) {
    throw new Error("healthcheck plan must expose validated data properties before lab deployment execution preflight planning");
  }

  const targetId = stringData(healthcheck, "targetId");
  const bindHostRef = stringData(healthcheck, "bindHostRef");
  const port = numberData(healthcheck, "port");
  const publicBaseUrlRef = stringData(healthcheck, "publicBaseUrlRef");
  const healthcheckPath = stringData(healthcheck, "healthcheckPath");
  const workshopPath = stringData(healthcheck, "workshopPath");

  if (
    stringData(healthcheck, "kind") !== "lab-deployment-healthcheck-plan" ||
    stringData(healthcheck, "schemaVersion") !== "1" ||
    typeof targetId !== "string" ||
    !SAFE_ID.test(targetId) ||
    stringData(healthcheck, "environment") !== "lab" ||
    stringData(healthcheck, "runtimeMode") !== "fake" ||
    stringData(healthcheck, "method") !== "GET" ||
    !["not-configured", "bearer-required-without-token-material"].includes(stringData(healthcheck, "authMode") ?? "") ||
    !isSafeConfigRef(bindHostRef) ||
    port === undefined ||
    port < 1 ||
    port > 65535 ||
    !isSafeConfigRef(publicBaseUrlRef) ||
    healthcheckPath !== "/healthz" ||
    workshopPath !== "/workshop" ||
    numberData(expected, "statusCode") !== 200 ||
    stringData(expected, "kind") !== "fake-mode-workshop-healthcheck" ||
    booleanFalseData(expected, "graphSnapshotRead") !== true ||
    numberData(expected, "providerCallsMade") !== 0 ||
    booleanFalseData(expected, "productionWrites") !== true ||
    booleanFalseData(expected, "deploymentReadinessClaim") !== true ||
    booleanFalseData(expected, "productionReadinessClaim") !== true ||
    booleanFalseData(boundaries, "remoteProbeAllowed") !== true ||
    booleanFalseData(boundaries, "deploymentExecuted") !== true ||
    booleanFalseData(boundaries, "providerCallsAllowed") !== true ||
    booleanFalseData(boundaries, "graphIngestionAllowed") !== true ||
    booleanFalseData(boundaries, "productionWritesAllowed") !== true ||
    booleanFalseData(boundaries, "readinessClaimAllowed") !== true
  ) {
    throw new Error("healthcheck plan must preserve no-execution boundaries before lab deployment execution preflight planning");
  }

  return { targetId, bindHostRef, port, publicBaseUrlRef, healthcheckPath: "/healthz", workshopPath: "/workshop" };
}

function snapshotSupervision(supervision: LabHostSupervisionPlan): SupervisionSnapshot {
  const supervisor = frozenObjectDataValue(supervision, "supervisor");
  const process = frozenObjectDataValue(supervision, "process");
  const healthcheck = frozenObjectDataValue(supervision, "healthcheck");
  const boundaries = frozenObjectDataValue(supervision, "boundaries");
  if (supervisor === undefined || process === undefined || healthcheck === undefined || boundaries === undefined) {
    throw new Error("supervision plan must expose validated data properties before lab deployment execution preflight planning");
  }

  const targetId = stringData(supervision, "targetId");
  const serviceName = stringData(supervision, "serviceName");
  const runtimeMode = stringData(process, "runtimeMode");
  const bindHostRef = stringData(process, "bindHostRef");
  const port = numberData(process, "port");
  const publicBaseUrlRef = stringData(process, "publicBaseUrlRef");
  if (
    stringData(supervision, "kind") !== "lab-host-supervision-plan" ||
    stringData(supervision, "schemaVersion") !== "1" ||
    typeof targetId !== "string" ||
    !SAFE_ID.test(targetId) ||
    typeof serviceName !== "string" ||
    !SAFE_SERVICE_NAME.test(serviceName) ||
    stringData(supervisor, "kind") !== "portable-supervision-plan" ||
    stringData(supervisor, "installMode") !== "dry-run-only" ||
    runtimeMode !== "fake" ||
    !isSafeConfigRef(bindHostRef) ||
    port === undefined ||
    port < 1 ||
    port > 65535 ||
    !isSafeConfigRef(publicBaseUrlRef) ||
    stringData(healthcheck, "planKind") !== "lab-deployment-healthcheck-plan" ||
    stringData(healthcheck, "path") !== "/healthz" ||
    numberData(healthcheck, "expectedProviderCallsMade") !== 0 ||
    booleanFalseData(healthcheck, "expectedProductionWrites") !== true ||
    booleanFalseData(healthcheck, "readinessClaimAllowed") !== true ||
    booleanFalseData(boundaries, "installAllowed") !== true ||
    booleanFalseData(boundaries, "startAllowed") !== true ||
    booleanFalseData(boundaries, "remoteProbeAllowed") !== true ||
    booleanFalseData(boundaries, "providerCallsAllowed") !== true ||
    booleanFalseData(boundaries, "graphIngestionAllowed") !== true ||
    booleanFalseData(boundaries, "productionWritesAllowed") !== true ||
    booleanFalseData(boundaries, "readinessClaimAllowed") !== true
  ) {
    throw new Error("supervision plan must preserve no-execution boundaries before lab deployment execution preflight planning");
  }

  return { targetId, serviceName, runtimeMode: "fake", bindHostRef, port, publicBaseUrlRef };
}

function snapshotBackupPolicy(backupPolicy: LabBackupPolicyPlan): BackupPolicySnapshot {
  const restoreProof = frozenObjectDataValue(backupPolicy, "restoreProof");
  const boundaries = frozenObjectDataValue(backupPolicy, "boundaries");
  if (restoreProof === undefined) {
    throw new Error("backup policy plan restore proof must expose validated data properties before lab deployment execution preflight planning");
  }
  if (boundaries === undefined) {
    throw new Error("backup policy plan boundaries must expose validated data properties before lab deployment execution preflight planning");
  }

  const targetId = stringData(backupPolicy, "targetId");
  const requiredBeforeMeaningfulData = dataValue(restoreProof, "requiredBeforeMeaningfulData");
  const proofMode = dataValue(restoreProof, "proofMode");
  const restoreProofTargetRef = dataValue(restoreProof, "restoreProofTargetRef");
  const requiredBeforeDeployment = dataValue(restoreProof, "requiredBeforeDeployment");
  const productionDataAllowed = dataValue(restoreProof, "productionDataAllowed");
  if (
    !requiredBeforeMeaningfulData.ok ||
    !proofMode.ok ||
    !restoreProofTargetRef.ok ||
    !requiredBeforeDeployment.ok ||
    !productionDataAllowed.ok
  ) {
    throw new Error("backup policy plan restore proof must expose validated data properties before lab deployment execution preflight planning");
  }

  if (
    stringData(backupPolicy, "kind") !== "lab-backup-policy-plan" ||
    stringData(backupPolicy, "schemaVersion") !== "1" ||
    typeof targetId !== "string" ||
    !SAFE_ID.test(targetId) ||
    stringData(backupPolicy, "environment") !== "lab" ||
    stringData(backupPolicy, "runtimeMode") !== "fake" ||
    requiredBeforeMeaningfulData.value !== true ||
    proofMode.value !== "local-restore-round-trip" ||
    !isSafeConfigRef(restoreProofTargetRef.value) ||
    requiredBeforeDeployment.value !== true ||
    productionDataAllowed.value !== false
  ) {
    throw new Error("backup policy plan must preserve restore-proof prerequisites before lab deployment execution preflight planning");
  }

  if (
    booleanFalseData(boundaries, "backupExecutionAllowed") !== true ||
    booleanFalseData(boundaries, "restoreExecutionAllowed") !== true ||
    booleanFalseData(boundaries, "schedulerInstallAllowed") !== true ||
    booleanFalseData(boundaries, "remoteStorageWritesAllowed") !== true ||
    booleanFalseData(boundaries, "deploymentExecuted") !== true ||
    booleanFalseData(boundaries, "remoteProbeAllowed") !== true ||
    booleanFalseData(boundaries, "providerCallsAllowed") !== true ||
    booleanFalseData(boundaries, "graphIngestionAllowed") !== true ||
    booleanFalseData(boundaries, "productionWritesAllowed") !== true ||
    booleanFalseData(boundaries, "readinessClaimAllowed") !== true
  ) {
    throw new Error("backup policy plan must preserve no-execution boundaries before lab deployment execution preflight planning");
  }

  return {
    targetId,
    environment: "lab",
    runtimeMode: "fake",
    restoreProofRequiredBeforeDeployment: true,
    backupPolicyRequiredBeforeMeaningfulData: true,
  };
}

function assertSameTarget(
  descriptor: DescriptorSnapshot,
  healthcheck: HealthcheckSnapshot,
  supervision: SupervisionSnapshot,
  backupPolicy: BackupPolicySnapshot,
): void {
  if (descriptor.targetId !== healthcheck.targetId || descriptor.targetId !== supervision.targetId || descriptor.targetId !== backupPolicy.targetId) {
    throw new Error("lab deployment execution preflight inputs must describe the same target");
  }
}

function assertDescriptorMatchesHealthcheck(descriptor: DescriptorSnapshot, healthcheck: HealthcheckSnapshot): void {
  if (
    descriptor.bindHostRef !== healthcheck.bindHostRef ||
    descriptor.port !== healthcheck.port ||
    descriptor.publicBaseUrlRef !== healthcheck.publicBaseUrlRef ||
    descriptor.healthcheckPath !== healthcheck.healthcheckPath ||
    descriptor.workshopPath !== healthcheck.workshopPath
  ) {
    throw new Error("descriptor and healthcheck plan must preserve the same HTTP refs before lab deployment execution preflight planning");
  }
}

function assertDescriptorMatchesSupervision(descriptor: DescriptorSnapshot, supervision: SupervisionSnapshot): void {
  if (
    descriptor.serviceName !== supervision.serviceName ||
    descriptor.runtimeMode !== supervision.runtimeMode ||
    descriptor.bindHostRef !== supervision.bindHostRef ||
    descriptor.port !== supervision.port ||
    descriptor.publicBaseUrlRef !== supervision.publicBaseUrlRef
  ) {
    throw new Error("descriptor and supervision plan must preserve the same process refs before lab deployment execution preflight planning");
  }
}

function assertDescriptorMatchesBackupPolicy(descriptor: DescriptorSnapshot, backupPolicy: BackupPolicySnapshot): void {
  if (descriptor.environment !== backupPolicy.environment || descriptor.runtimeMode !== backupPolicy.runtimeMode) {
    throw new Error("descriptor and backup policy plan must preserve the same lab runtime boundary before lab deployment execution preflight planning");
  }
}

function freezePreflight(preflight: LabDeploymentExecutionPreflight): LabDeploymentExecutionPreflight {
  Object.freeze(preflight.requiredPlans);
  Object.freeze(preflight.targetRefs);
  Object.freeze(preflight.prerequisites);
  Object.freeze(preflight.authorization);
  Object.freeze(preflight.nextDecision);
  return Object.freeze(preflight);
}

export function createLabDeploymentExecutionPreflight(
  descriptor: LabDeploymentTargetDescriptor,
  healthcheck: LabDeploymentHealthcheckPlan,
  supervision: LabHostSupervisionPlan,
  backupPolicy: LabBackupPolicyPlan,
): LabDeploymentExecutionPreflight {
  assertFrozenDescriptor(descriptor);
  assertFrozenHealthcheckPlan(healthcheck);
  assertFrozenSupervisionPlan(supervision);
  assertFrozenBackupPolicyPlan(backupPolicy);

  const descriptorSnapshot = snapshotDescriptor(descriptor);
  const healthcheckSnapshot = snapshotHealthcheck(healthcheck);
  const supervisionSnapshot = snapshotSupervision(supervision);
  const backupPolicySnapshot = snapshotBackupPolicy(backupPolicy);

  assertSameTarget(descriptorSnapshot, healthcheckSnapshot, supervisionSnapshot, backupPolicySnapshot);
  assertDescriptorMatchesHealthcheck(descriptorSnapshot, healthcheckSnapshot);
  assertDescriptorMatchesSupervision(descriptorSnapshot, supervisionSnapshot);
  assertDescriptorMatchesBackupPolicy(descriptorSnapshot, backupPolicySnapshot);

  return freezePreflight({
    kind: "lab-deployment-execution-preflight",
    schemaVersion: "1",
    targetId: descriptorSnapshot.targetId,
    environment: descriptorSnapshot.environment,
    runtimeMode: descriptorSnapshot.runtimeMode,
    requiredPlans: {
      descriptorKind: "lab-deployment-target-descriptor",
      healthcheckKind: "lab-deployment-healthcheck-plan",
      supervisionKind: "lab-host-supervision-plan",
      backupPolicyKind: "lab-backup-policy-plan",
    },
    targetRefs: {
      serviceName: descriptorSnapshot.serviceName,
      bindHostRef: descriptorSnapshot.bindHostRef,
      port: descriptorSnapshot.port,
      publicBaseUrlRef: descriptorSnapshot.publicBaseUrlRef,
      healthcheckPath: descriptorSnapshot.healthcheckPath,
      workshopPath: descriptorSnapshot.workshopPath,
    },
    prerequisites: {
      explicitOperatorApprovalRequired: true,
      restoreProofRequiredBeforeDeployment: backupPolicySnapshot.restoreProofRequiredBeforeDeployment,
      backupPolicyRequiredBeforeMeaningfulData: backupPolicySnapshot.backupPolicyRequiredBeforeMeaningfulData,
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
  });
}
