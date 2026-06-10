import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseLabDeploymentTargetDescriptor,
  validateLabDeploymentTargetDescriptor,
} from "../../src/deployment/lab-deployment-target.ts";

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
  notes: "Plan-only descriptor with placeholder config refs; no deployment is authorized.",
});

test("validates a plan-only lab deployment target descriptor and returns a frozen snapshot", () => {
  const input = validDescriptor();
  const result = validateLabDeploymentTargetDescriptor(input);

  assert.equal(result.ok, true);

  assert.deepEqual(result.descriptor, input);
  assert.notEqual(result.descriptor, input);
  assert.notEqual(result.descriptor.infrastructure, input.infrastructure);
  assert.notEqual(result.descriptor.http, input.http);
  assert.notEqual(result.descriptor.backupPolicy, input.backupPolicy);

  assert.equal(Object.isFrozen(result.descriptor), true);
  assert.equal(Object.isFrozen(result.descriptor.infrastructure), true);
  assert.equal(Object.isFrozen(result.descriptor.http), true);
  assert.equal(Object.isFrozen(result.descriptor.supervision), true);
  assert.equal(Object.isFrozen(result.descriptor.backupPolicy), true);
  assert.equal(Object.isFrozen(result.descriptor.boundary), true);

  input.http.healthcheckPath = "/mutated";
  assert.equal(result.descriptor.http.healthcheckPath, "/healthz");
});

test("checked-in lab descriptor fixture parses through the same contract", async () => {
  const json = await readFile("fixtures/deployment/lab-target.example.json", "utf8");
  const descriptor = parseLabDeploymentTargetDescriptor(json);

  assert.equal(descriptor.schemaVersion, "1");
  assert.equal(descriptor.environment, "lab");
  assert.equal(descriptor.runtimeMode, "fake");
  assert.equal(descriptor.http.healthcheckPath, "/healthz");
  assert.equal(descriptor.boundary.deploymentExecuted, false);
  assert.equal(descriptor.boundary.readinessClaim, false);
});

test("parses descriptor JSON from disk-like text without reading process.env", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const parsed = parseLabDeploymentTargetDescriptor(JSON.stringify(validDescriptor()));
    assert.equal(parsed.targetId, "lab-fake-workshop");
    assert.equal(parsed.boundary.deploymentExecuted, false);
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});

test("rejects broadening, unsafe healthcheck paths, invalid backup retention, and secret-shaped config values", () => {
  const input = validDescriptor() as Record<string, unknown>;
  input.environment = "production";
  input.runtimeMode = "model";
  input.http = {
    ...(input.http as Record<string, unknown>),
    healthcheckPath: "https://lab.example.invalid/healthz",
  };
  input.backupPolicy = {
    ...(input.backupPolicy as Record<string, unknown>),
    retentionDays: 0,
  };
  input.infrastructure = {
    ...(input.infrastructure as Record<string, unknown>),
    hostRef: "https://lab.example.invalid",
  };
  input.boundary = {
    ...(input.boundary as Record<string, unknown>),
    readinessClaim: true,
  };

  const result = validateLabDeploymentTargetDescriptor(input);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail("expected descriptor to be rejected");

  const fields = result.violations.map((violation) => violation.field).sort();
  assert.deepEqual(fields, [
    "backupPolicy.retentionDays",
    "boundary.readinessClaim",
    "environment",
    "http.healthcheckPath",
    "infrastructure.hostRef",
    "runtimeMode",
  ]);
  assert.doesNotMatch(JSON.stringify(result.violations), /https:\/\/lab\.example\.invalid/);
});

test("rejects unknown keys, accessors, duplicate capabilities, and prototype-pollution-shaped descriptors", () => {
  const withUnknown = { ...validDescriptor(), unexpected: true };
  const unknown = validateLabDeploymentTargetDescriptor(withUnknown);
  assert.equal(unknown.ok, false);
  if (unknown.ok) assert.fail("expected unknown key rejection");
  assert.deepEqual(unknown.violations.map((violation) => violation.field), ["unexpected"]);

  const withAccessor = validDescriptor();
  Object.defineProperty(withAccessor, "targetId", {
    enumerable: true,
    get() {
      throw new Error("leaky target id getter");
    },
  });
  const accessor = validateLabDeploymentTargetDescriptor(withAccessor);
  assert.equal(accessor.ok, false);
  if (accessor.ok) assert.fail("expected accessor rejection");
  assert.equal(accessor.violations[0]?.field, "targetId");
  assert.doesNotMatch(JSON.stringify(accessor.violations), /leaky target id getter/);

  const withDuplicateCapability = { ...validDescriptor(), capabilities: ["serve", "serve"] };
  const duplicate = validateLabDeploymentTargetDescriptor(withDuplicateCapability);
  assert.equal(duplicate.ok, false);
  if (duplicate.ok) assert.fail("expected duplicate capability rejection");
  assert.equal(duplicate.violations[0]?.field, "capabilities");

  const polluted = JSON.parse(`{"schemaVersion":"1","targetId":"lab-fake-workshop","environment":"lab","runtimeMode":"fake","__proto__":{"polluted":true}}`);
  const proto = validateLabDeploymentTargetDescriptor(polluted);
  assert.equal(proto.ok, false);
  if (proto.ok) assert.fail("expected prototype-pollution-shaped descriptor rejection");
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("rejects nested accessors, nested prototype-pollution keys, non-object JSON roots, and broadened boundary markers", () => {
  const nestedAccessor = validDescriptor();
  Object.defineProperty(nestedAccessor.infrastructure, "hostRef", {
    enumerable: true,
    get() {
      throw new Error("leaky nested host getter");
    },
  });
  const accessor = validateLabDeploymentTargetDescriptor(nestedAccessor);
  assert.equal(accessor.ok, false);
  if (accessor.ok) assert.fail("expected nested accessor rejection");
  assert.equal(accessor.violations[0]?.field, "infrastructure.hostRef");
  assert.doesNotMatch(JSON.stringify(accessor.violations), /leaky nested host getter/);

  const nestedProto = validDescriptor() as Record<string, unknown>;
  nestedProto.backupPolicy = JSON.parse(`{"mode":"local-scheduled","retentionDays":7,"scheduleRef":"ATL_LAB_BACKUP_SCHEDULE","restoreProofRequiredBeforeMeaningfulData":true,"__proto__":{"polluted":true}}`);
  const proto = validateLabDeploymentTargetDescriptor(nestedProto);
  assert.equal(proto.ok, false);
  if (proto.ok) assert.fail("expected nested prototype-pollution-shaped key rejection");
  assert.equal(proto.violations.some((entry) => entry.field === "backupPolicy.__proto__"), true);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);

  const broadened = validDescriptor();
  broadened.boundary.deploymentExecuted = true;
  broadened.boundary.providerCallsAllowed = true;
  broadened.boundary.productionWritesAllowed = true;
  broadened.boundary.readinessClaim = true;
  const boundary = validateLabDeploymentTargetDescriptor(broadened);
  assert.equal(boundary.ok, false);
  if (boundary.ok) assert.fail("expected boundary broadening rejection");
  assert.deepEqual(
    boundary.violations.map((entry) => entry.field).sort(),
    ["boundary.deploymentExecuted", "boundary.productionWritesAllowed", "boundary.providerCallsAllowed", "boundary.readinessClaim"],
  );

  for (const raw of ["null", "[]", "42", "true", '"descriptor"']) {
    assert.throws(() => parseLabDeploymentTargetDescriptor(raw), /deployment target descriptor rejected/);
  }
});

test("reports all required-field violations without echoing unsafe values", () => {
  const input = {
    schemaVersion: "2",
    targetId: "bad id with spaces",
    infrastructure: {
      provider: "",
      regionRef: "SECRET_TOKEN=abc123",
    },
    http: {
      port: 70000,
      healthcheckPath: "../healthz",
    },
    backupPolicy: {
      retentionDays: 366,
    },
  };

  const result = validateLabDeploymentTargetDescriptor(input);
  assert.equal(result.ok, false);
  if (result.ok) assert.fail("expected invalid descriptor");

  const fields = new Set(result.violations.map((violation) => violation.field));
  for (const field of [
    "schemaVersion",
    "targetId",
    "environment",
    "runtimeMode",
    "infrastructure.provider",
    "infrastructure.regionRef",
    "infrastructure.hostRef",
    "http.port",
    "http.healthcheckPath",
    "http.bindHostRef",
    "http.publicBaseUrlRef",
    "http.workshopPath",
    "supervision",
    "backupPolicy.mode",
    "backupPolicy.retentionDays",
    "backupPolicy.scheduleRef",
    "backupPolicy.restoreProofRequiredBeforeMeaningfulData",
    "boundary",
  ]) {
    assert.equal(fields.has(field), true, `missing violation for ${field}`);
  }
  assert.doesNotMatch(JSON.stringify(result.violations), /SECRET_TOKEN|abc123|bad id with spaces|\.\.\/healthz/);
});
