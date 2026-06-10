import type { LabDeploymentTargetDescriptor } from "./lab-deployment-target.ts";
import type { LabDeploymentHealthcheckPlan } from "./lab-healthcheck-contract.ts";

export interface LabHostSupervisionSupervisorPlan {
  readonly kind: "portable-supervision-plan";
  readonly installMode: "dry-run-only";
}

export interface LabHostSupervisionProcessPlan {
  readonly runtimeMode: "fake";
  readonly bindHostRef: string;
  readonly port: number;
  readonly publicBaseUrlRef: string;
}

export interface LabHostSupervisionHealthcheckPlan {
  readonly planKind: "lab-deployment-healthcheck-plan";
  readonly method: "GET";
  readonly path: "/healthz";
  readonly intervalSeconds: 30;
  readonly timeoutSeconds: 5;
  readonly failureThreshold: 3;
  readonly expectedProviderCallsMade: 0;
  readonly expectedProductionWrites: false;
  readonly readinessClaimAllowed: false;
}

export interface LabHostSupervisionRestartPlan {
  readonly policy: "on-failure";
  readonly initialBackoffSeconds: 5;
  readonly maxBackoffSeconds: 60;
  readonly maxRestartsPerHour: 6;
}

export interface LabHostSupervisionGracefulStopPlan {
  readonly signal: "SIGTERM";
  readonly timeoutSeconds: 30;
}

export interface LabHostSupervisionBoundaries {
  readonly installAllowed: false;
  readonly startAllowed: false;
  readonly remoteProbeAllowed: false;
  readonly providerCallsAllowed: false;
  readonly graphIngestionAllowed: false;
  readonly productionWritesAllowed: false;
  readonly readinessClaimAllowed: false;
}

export interface LabHostSupervisionPlan {
  readonly kind: "lab-host-supervision-plan";
  readonly schemaVersion: "1";
  readonly targetId: string;
  readonly serviceName: string;
  readonly supervisor: LabHostSupervisionSupervisorPlan;
  readonly process: LabHostSupervisionProcessPlan;
  readonly healthcheck: LabHostSupervisionHealthcheckPlan;
  readonly restart: LabHostSupervisionRestartPlan;
  readonly gracefulStop: LabHostSupervisionGracefulStopPlan;
  readonly boundaries: LabHostSupervisionBoundaries;
}

function assertFrozenDescriptor(descriptor: LabDeploymentTargetDescriptor): void {
  if (
    !Object.isFrozen(descriptor) ||
    !Object.isFrozen(descriptor.infrastructure) ||
    !Object.isFrozen(descriptor.http) ||
    !Object.isFrozen(descriptor.supervision) ||
    !Object.isFrozen(descriptor.backupPolicy) ||
    !Object.isFrozen(descriptor.boundary)
  ) {
    throw new Error("lab host supervision planning requires a validated frozen lab deployment target descriptor");
  }
}

function assertFrozenHealthcheckPlan(healthcheck: LabDeploymentHealthcheckPlan): void {
  if (!Object.isFrozen(healthcheck) || !Object.isFrozen(healthcheck.expected) || !Object.isFrozen(healthcheck.boundaries)) {
    throw new Error("lab host supervision planning requires a validated frozen lab deployment healthcheck plan");
  }
}

function assertHealthcheckPreservesBoundaries(healthcheck: LabDeploymentHealthcheckPlan): void {
  if (
    healthcheck.kind !== "lab-deployment-healthcheck-plan" ||
    healthcheck.schemaVersion !== "1" ||
    healthcheck.environment !== "lab" ||
    healthcheck.runtimeMode !== "fake" ||
    healthcheck.method !== "GET" ||
    healthcheck.healthcheckPath !== "/healthz" ||
    healthcheck.expected.statusCode !== 200 ||
    healthcheck.expected.graphSnapshotRead !== false ||
    healthcheck.expected.providerCallsMade !== 0 ||
    healthcheck.expected.productionWrites !== false ||
    healthcheck.expected.deploymentReadinessClaim !== false ||
    healthcheck.expected.productionReadinessClaim !== false ||
    healthcheck.boundaries.remoteProbeAllowed !== false ||
    healthcheck.boundaries.deploymentExecuted !== false ||
    healthcheck.boundaries.providerCallsAllowed !== false ||
    healthcheck.boundaries.graphIngestionAllowed !== false ||
    healthcheck.boundaries.productionWritesAllowed !== false ||
    healthcheck.boundaries.readinessClaimAllowed !== false
  ) {
    throw new Error("healthcheck plan must preserve no-deploy boundaries before lab host supervision planning");
  }
}

function assertDescriptorPreservesBoundaries(descriptor: LabDeploymentTargetDescriptor): void {
  if (
    descriptor.schemaVersion !== "1" ||
    descriptor.environment !== "lab" ||
    descriptor.runtimeMode !== "fake" ||
    descriptor.http.healthcheckPath !== "/healthz" ||
    descriptor.http.workshopPath !== "/workshop" ||
    descriptor.supervision.mode !== "systemd-plan" ||
    descriptor.boundary.deploymentExecuted !== false ||
    descriptor.boundary.providerCallsAllowed !== false ||
    descriptor.boundary.productionWritesAllowed !== false ||
    descriptor.boundary.readinessClaim !== false
  ) {
    throw new Error("descriptor must preserve no-deploy boundaries before lab host supervision planning");
  }
}

function assertDescriptorMatchesHealthcheck(
  descriptor: LabDeploymentTargetDescriptor,
  healthcheck: LabDeploymentHealthcheckPlan,
): void {
  if (descriptor.targetId !== healthcheck.targetId) {
    throw new Error("lab host supervision descriptor and healthcheck plan must describe the same target");
  }

  if (
    descriptor.http.bindHostRef !== healthcheck.bindHostRef ||
    descriptor.http.port !== healthcheck.port ||
    descriptor.http.publicBaseUrlRef !== healthcheck.publicBaseUrlRef ||
    descriptor.http.healthcheckPath !== healthcheck.healthcheckPath ||
    descriptor.http.workshopPath !== healthcheck.workshopPath
  ) {
    throw new Error("lab host supervision descriptor and healthcheck plan must preserve the same HTTP refs");
  }
}

function freezePlan(plan: LabHostSupervisionPlan): LabHostSupervisionPlan {
  Object.freeze(plan.supervisor);
  Object.freeze(plan.process);
  Object.freeze(plan.healthcheck);
  Object.freeze(plan.restart);
  Object.freeze(plan.gracefulStop);
  Object.freeze(plan.boundaries);
  return Object.freeze(plan);
}

export function createLabHostSupervisionPlan(
  descriptor: LabDeploymentTargetDescriptor,
  healthcheck: LabDeploymentHealthcheckPlan,
): LabHostSupervisionPlan {
  assertFrozenDescriptor(descriptor);
  assertFrozenHealthcheckPlan(healthcheck);
  assertDescriptorPreservesBoundaries(descriptor);
  assertHealthcheckPreservesBoundaries(healthcheck);
  assertDescriptorMatchesHealthcheck(descriptor, healthcheck);

  return freezePlan({
    kind: "lab-host-supervision-plan",
    schemaVersion: "1",
    targetId: descriptor.targetId,
    serviceName: descriptor.supervision.serviceName,
    supervisor: {
      kind: "portable-supervision-plan",
      installMode: "dry-run-only",
    },
    process: {
      runtimeMode: descriptor.runtimeMode,
      bindHostRef: descriptor.http.bindHostRef,
      port: descriptor.http.port,
      publicBaseUrlRef: descriptor.http.publicBaseUrlRef,
    },
    healthcheck: {
      planKind: healthcheck.kind,
      method: healthcheck.method,
      path: healthcheck.healthcheckPath,
      intervalSeconds: 30,
      timeoutSeconds: 5,
      failureThreshold: 3,
      expectedProviderCallsMade: healthcheck.expected.providerCallsMade,
      expectedProductionWrites: healthcheck.expected.productionWrites,
      readinessClaimAllowed: healthcheck.boundaries.readinessClaimAllowed,
    },
    restart: {
      policy: "on-failure",
      initialBackoffSeconds: 5,
      maxBackoffSeconds: 60,
      maxRestartsPerHour: 6,
    },
    gracefulStop: {
      signal: "SIGTERM",
      timeoutSeconds: 30,
    },
    boundaries: {
      installAllowed: false,
      startAllowed: false,
      remoteProbeAllowed: false,
      providerCallsAllowed: false,
      graphIngestionAllowed: false,
      productionWritesAllowed: false,
      readinessClaimAllowed: false,
    },
  });
}
