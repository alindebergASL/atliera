import assert from "node:assert/strict";
import test from "node:test";

import { createLabDeploymentHealthcheckPlan } from "../../src/deployment/lab-healthcheck-contract.ts";
import {
  createLabHostSupervisionPlan,
  type LabHostSupervisionPlan,
} from "../../src/deployment/lab-supervision-contract.ts";
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
  const healthcheck = createLabDeploymentHealthcheckPlan(result.descriptor, { authMode: "bearer-required-without-token-material" });
  return { input, descriptor: result.descriptor, healthcheck };
}

test("derives a frozen portable lab host supervision plan from descriptor and healthcheck snapshots", () => {
  const { input, descriptor, healthcheck } = snapshots();
  const plan = createLabHostSupervisionPlan(descriptor, healthcheck);

  assert.deepEqual(plan, {
    kind: "lab-host-supervision-plan",
    schemaVersion: "1",
    targetId: "lab-fake-workshop",
    serviceName: "atliera-workshop",
    supervisor: {
      kind: "portable-supervision-plan",
      installMode: "dry-run-only",
    },
    process: {
      runtimeMode: "fake",
      bindHostRef: "ATL_LAB_BIND_HOST",
      port: 3000,
      publicBaseUrlRef: "ATL_LAB_BASE_URL",
    },
    healthcheck: {
      planKind: "lab-deployment-healthcheck-plan",
      method: "GET",
      path: "/healthz",
      intervalSeconds: 30,
      timeoutSeconds: 5,
      failureThreshold: 3,
      expectedProviderCallsMade: 0,
      expectedProductionWrites: false,
      readinessClaimAllowed: false,
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
  } satisfies LabHostSupervisionPlan);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.supervisor), true);
  assert.equal(Object.isFrozen(plan.process), true);
  assert.equal(Object.isFrozen(plan.healthcheck), true);
  assert.equal(Object.isFrozen(plan.restart), true);
  assert.equal(Object.isFrozen(plan.gracefulStop), true);
  assert.equal(Object.isFrozen(plan.boundaries), true);

  input.supervision.serviceName = "mutated-service";
  assert.equal(plan.serviceName, "atliera-workshop");
});

test("refuses mutable or mismatched supervision inputs", () => {
  const { descriptor, healthcheck } = snapshots();
  assert.throws(
    () => createLabHostSupervisionPlan(validDescriptor() as never, healthcheck),
    /validated frozen lab deployment target descriptor/,
  );

  const mutableHealthcheck = { ...healthcheck };
  assert.throws(
    () => createLabHostSupervisionPlan(descriptor, mutableHealthcheck),
    /validated frozen lab deployment healthcheck plan/,
  );

  const mismatched = { ...healthcheck, targetId: "other-target" };
  Object.freeze(mismatched.expected);
  Object.freeze(mismatched.boundaries);
  Object.freeze(mismatched);
  assert.throws(
    () => createLabHostSupervisionPlan(descriptor, mismatched),
    /must describe the same target/,
  );
});

test("fails closed when descriptor or healthcheck snapshots disagree with the plan-only target", () => {
  const { descriptor, healthcheck } = snapshots();
  const broadenedDescriptor = {
    ...descriptor,
    boundary: {
      ...descriptor.boundary,
      readinessClaim: true,
    },
  } as unknown as typeof descriptor;
  Object.freeze(broadenedDescriptor.infrastructure);
  Object.freeze(broadenedDescriptor.http);
  Object.freeze(broadenedDescriptor.supervision);
  Object.freeze(broadenedDescriptor.backupPolicy);
  Object.freeze(broadenedDescriptor.boundary);
  Object.freeze(broadenedDescriptor);
  assert.throws(
    () => createLabHostSupervisionPlan(broadenedDescriptor, healthcheck),
    /descriptor must preserve no-deploy boundaries/,
  );

  const divergentHealthcheck = { ...healthcheck, port: 3001 } as unknown as typeof healthcheck;
  Object.freeze(divergentHealthcheck.expected);
  Object.freeze(divergentHealthcheck.boundaries);
  Object.freeze(divergentHealthcheck);
  assert.throws(
    () => createLabHostSupervisionPlan(descriptor, divergentHealthcheck),
    /descriptor and healthcheck plan must preserve the same HTTP refs/,
  );
});

test("does not read process.env or retain token-shaped data while deriving supervision plan", () => {
  const { descriptor, healthcheck } = snapshots();
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const plan = createLabHostSupervisionPlan(descriptor, healthcheck);
    assert.doesNotMatch(JSON.stringify(plan), /token|secret|authorization|bearer/i);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});

test("fails closed when healthcheck plan boundaries are broadened", () => {
  const { descriptor, healthcheck } = snapshots();
  const broadened = {
    ...healthcheck,
    boundaries: {
      ...healthcheck.boundaries,
      remoteProbeAllowed: true,
    },
  } as unknown as typeof healthcheck;
  Object.freeze(broadened.expected);
  Object.freeze(broadened.boundaries);
  Object.freeze(broadened);

  assert.throws(
    () => createLabHostSupervisionPlan(descriptor, broadened),
    /healthcheck plan must preserve no-deploy boundaries/,
  );
});
