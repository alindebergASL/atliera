import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  M5B_FEDEX_GATE_B_AUTHORIZATION_KIND,
  M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES,
  M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
  M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
  M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS,
  M5B_FEDEX_GATE_B_POST_MERGE_CI_RUN,
  createM5bFedExGateBNodeDependencies,
  executeM5bFedExGateBOneShot,
  finalizeM5bFedExGateBWorkshopBoundary,
  generateM5bFedExGateBSyntheticArtifacts,
  type M5bFedExGateBAuthorization,
  type M5bFedExGateBDependencies,
  type M5bFedExGateBFileIdentity,
  type M5bFedExGateBImplementationInspection,
  type M5bFedExGateBNodeTestHooks,
  type M5bFedExGateBTrustPins,
} from "../../src/workshop/m5b-fedex-gate-b-unarmed-executor.ts";
import {
  M5B_FEDEX_PRODUCTION_PINS,
  M5B_FEDEX_TRUST_STATUS,
  canonicalM5bFedExJson,
} from "../../src/workshop/m5b-fedex-system-acquired-source.ts";
import { renderM5bFedExPrewriteWorkshopHtml } from
  "../../src/workshop/m5b-fedex-prewrite-workshop.ts";

const REPOSITORY_ROOT = realpathSync(process.cwd());
const MODULE_PATH = realpathSync(join(REPOSITORY_ROOT,
  "src/workshop/m5b-fedex-gate-b-unarmed-executor.ts"));
const AUTHORIZATION_PATH = "/tmp/atliera-m5b-gate-b-test/authorization.json";
const CUSTODY_PATH = "/tmp/atliera-m5b-gate-b-test/custody.json";
const TRUSTED_REPLAY_ROOT = "/tmp/atliera-m5b-gate-b-test/trusted-replay";
const NOW = "2026-07-15T00:01:00.000Z";
const REVIEWED_EXECUTOR_COMMIT = "a".repeat(40);
const REVIEWED_EXECUTOR_TREE = "b".repeat(40);
const REVIEWED_EXECUTABLE_SHA256 = "c".repeat(64);
const TEST_OWNER = Object.freeze({ uid: 1000n, gid: 1000n });
const FIXTURE = readFileSync(join(REPOSITORY_ROOT,
  "fixtures/validation/m5b-fedex-system-acquired-demo-source.json"));

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function authorization(overrides: Partial<M5bFedExGateBAuthorization> = {}): M5bFedExGateBAuthorization {
  return {
    kind: M5B_FEDEX_GATE_B_AUTHORIZATION_KIND,
    schemaVersion: "1",
    authorizationId: "authorization_test_001",
    oneShotConsumptionId: "consumption_test_001",
    custodyPath: CUSTODY_PATH,
    implementationBaseCommit: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
    implementationBaseTree: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
    reviewedExecutorCommit: REVIEWED_EXECUTOR_COMMIT,
    reviewedExecutorTree: REVIEWED_EXECUTOR_TREE,
    postMergeCiRun: M5B_FEDEX_GATE_B_POST_MERGE_CI_RUN,
    postMergeCiConclusion: "success",
    productionPins: M5B_FEDEX_PRODUCTION_PINS,
    authorizedAt: "2026-07-15T00:00:00.000Z",
    validFrom: "2026-07-15T00:00:01.000Z",
    validUntil: "2026-07-15T00:05:00.000Z",
    currentEffectiveAuthorization: "one-shot-private-custody-read",
    authorizesPrivateCustodyRead: true,
    authorizesProviderCall: false,
    authorizesAcquisition: false,
    authorizesGraphOrDbRead: false,
    authorizesGraphOrDbWrite: false,
    authorizesDeployment: false,
    maximumCustodyReads: 1,
    retryBudget: 0,
    outputContract: "sanitized-unratified-unverified-prewrite-only",
    ...overrides,
  };
}

function identity(
  path: string,
  size: bigint,
  overrides: Partial<M5bFedExGateBFileIdentity> = {},
): M5bFedExGateBFileIdentity {
  return {
    realPath: path,
    regularFile: true,
    mode: 0o600,
    device: 10n,
    inode: path === AUTHORIZATION_PATH ? 11n : 12n,
    uid: TEST_OWNER.uid,
    gid: TEST_OWNER.gid,
    nlink: 1n,
    size,
    ...overrides,
  };
}

function executableIdentity(overrides: Partial<M5bFedExGateBFileIdentity> = {}): M5bFedExGateBFileIdentity {
  return identity(MODULE_PATH, 1234n, { mode: 0o644, inode: 13n, ...overrides });
}

function implementation(
  overrides: Partial<M5bFedExGateBImplementationInspection> = {},
): M5bFedExGateBImplementationInspection {
  return {
    canonicalRoot: REPOSITORY_ROOT,
    commit: REVIEWED_EXECUTOR_COMMIT,
    tree: REVIEWED_EXECUTOR_TREE,
    baseCommit: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
    baseTree: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
    baseIsAncestor: true,
    clean: true,
    executableSha256: REVIEWED_EXECUTABLE_SHA256,
    executableIdentity: executableIdentity(),
    ...overrides,
  };
}

function trustPins(
  authorizationBytes: Uint8Array,
  overrides: Partial<M5bFedExGateBTrustPins> = {},
): M5bFedExGateBTrustPins {
  return {
    expectedAuthorizationSha256: sha256(authorizationBytes),
    trustedReplayRoot: TRUSTED_REPLAY_ROOT,
    reviewedExecutorCommit: REVIEWED_EXECUTOR_COMMIT,
    reviewedExecutorTree: REVIEWED_EXECUTOR_TREE,
    reviewedExecutableSha256: REVIEWED_EXECUTABLE_SHA256,
    expectedAuthorizationOwner: TEST_OWNER,
    expectedCustodyOwner: TEST_OWNER,
    expectedReplayRootOwner: TEST_OWNER,
    ...overrides,
  };
}

type ConsumptionBehavior = "success" | "preexisting" | "fail_before_create" | "fail_after_create";

interface HarnessOptions {
  readonly authorization?: M5bFedExGateBAuthorization | Readonly<Record<string, unknown>>;
  readonly authorizationBytes?: Uint8Array;
  readonly authorizationPath?: string;
  readonly trust?: Partial<M5bFedExGateBTrustPins>;
  readonly authorizationIdentity?: Partial<M5bFedExGateBFileIdentity>;
  readonly custodyIdentity?: Partial<M5bFedExGateBFileIdentity>;
  readonly implementation?: Partial<M5bFedExGateBImplementationInspection>;
  readonly revalidations?: readonly boolean[];
  readonly times?: readonly string[];
  readonly consumption?: ConsumptionBehavior;
  readonly custodyFailure?: boolean;
  readonly custodyBytes?: Uint8Array;
}

function harness(options: HarnessOptions = {}) {
  const authPath = options.authorizationPath ?? AUTHORIZATION_PATH;
  const auth = options.authorization ?? authorization();
  const authBytes = options.authorizationBytes ?? Buffer.from(JSON.stringify(auth), "utf8");
  const custodyBytes = options.custodyBytes ?? Buffer.alloc(M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES, 0x20);
  const times = options.times ?? [NOW, NOW, NOW];
  let timeIndex = 0;
  let revalidationIndex = 0;
  const calls = {
    inspect: [] as string[],
    authorizationReads: 0,
    implementationInspections: 0,
    implementationRevalidations: 0,
    consumptions: 0,
    custodyReads: 0,
    markerName: null as string | null,
    markerContent: null as string | null,
    consumptionBeforeCustodyRead: false,
  };
  const dependencies: M5bFedExGateBDependencies = {
    trustPins: trustPins(authBytes, options.trust),
    nowIso: () => times[Math.min(timeIndex++, times.length - 1)]!,
    inspectImplementation: () => {
      calls.implementationInspections++;
      return implementation(options.implementation);
    },
    revalidateImplementation: () => {
      calls.implementationRevalidations++;
      const values = options.revalidations ?? [true, true];
      return values[Math.min(revalidationIndex++, values.length - 1)]!;
    },
    inspectExternalFile: (path) => {
      calls.inspect.push(path);
      return path === authPath
        ? identity(path, BigInt(authBytes.byteLength), options.authorizationIdentity)
        : identity(path, BigInt(custodyBytes.byteLength), options.custodyIdentity);
    },
    readAuthorizationOnce: () => {
      calls.authorizationReads++;
      return authBytes;
    },
    commitConsumption: (markerName, prepareMarkerContent, reportTerminalState) => {
      const content = prepareMarkerContent();
      calls.consumptions++;
      calls.markerName = markerName;
      calls.markerContent = content;
      if (options.consumption === "fail_before_create") throw new Error("before exclusive create");
      if (options.consumption === "preexisting") {
        reportTerminalState("preexisting_replay");
        throw new Error("existing marker");
      }
      reportTerminalState("created_fail_closed");
      if (options.consumption === "fail_after_create") throw new Error("after exclusive create");
    },
    readCustodyOnce: () => {
      calls.custodyReads++;
      calls.consumptionBeforeCustodyRead = calls.consumptions === 1;
      if (options.custodyFailure) throw new Error("synthetic custody failure");
      return custodyBytes;
    },
  };
  return { authBytes, authPath, calls, dependencies,
    run: () => executeM5bFedExGateBOneShot(authPath, dependencies) };
}

function assertNoEffects(result: ReturnType<typeof executeM5bFedExGateBOneShot>): void {
  assert.deepEqual({
    retries: result.receipt.accounting.retries,
    providerCalls: result.receipt.accounting.providerCalls,
    acquisitions: result.receipt.accounting.acquisitions,
    graphOrDbReads: result.receipt.accounting.graphOrDbReads,
    graphOrDbWrites: result.receipt.accounting.graphOrDbWrites,
    deployments: result.receipt.accounting.deployments,
    externalProductEffects: result.receipt.accounting.externalProductEffects,
  }, {
    retries: 0,
    providerCalls: 0,
    acquisitions: 0,
    graphOrDbReads: 0,
    graphOrDbWrites: 0,
    deployments: 0,
    externalProductEffects: 0,
  });
}

interface NodeScenario {
  readonly directory: string;
  readonly authorizationPath: string;
  readonly copiedAuthorizationPath: string;
  readonly custodyPath: string;
  readonly replayRoot: string;
  readonly movedReplayRoot: string;
  readonly authorizationBytes: Buffer;
  readonly pins: M5bFedExGateBTrustPins;
  readonly dependencies: (
    hooks?: Readonly<M5bFedExGateBNodeTestHooks>,
    times?: readonly string[],
  ) => M5bFedExGateBDependencies;
  readonly cleanup: () => void;
}

function nodeScenario(
  authorizationOverrides: Partial<M5bFedExGateBAuthorization> = {},
): NodeScenario {
  const directory = mkdtempSync(join(tmpdir(), "atliera-m5b-gate-b-node-"));
  const authorizationPath = join(directory, "authorization.json");
  const copiedAuthorizationPath = join(directory, "authorization.copy.json");
  const custodyPath = join(directory, "custody.json");
  const replayRoot = join(directory, "trusted-replay");
  const movedReplayRoot = join(directory, "trusted-replay-moved");
  mkdirSync(replayRoot, { mode: 0o700 });
  writeFileSync(custodyPath, Buffer.alloc(M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES, 0x20), { mode: 0o600 });
  const auth = authorization({ custodyPath, ...authorizationOverrides });
  const authorizationBytes = Buffer.from(JSON.stringify(auth), "utf8");
  writeFileSync(authorizationPath, authorizationBytes, { mode: 0o600 });
  const authStat = statSync(authorizationPath);
  const custodyStat = statSync(custodyPath);
  const replayStat = statSync(replayRoot);
  const pins: M5bFedExGateBTrustPins = {
    expectedAuthorizationSha256: sha256(authorizationBytes),
    trustedReplayRoot: replayRoot,
    reviewedExecutorCommit: REVIEWED_EXECUTOR_COMMIT,
    reviewedExecutorTree: REVIEWED_EXECUTOR_TREE,
    reviewedExecutableSha256: REVIEWED_EXECUTABLE_SHA256,
    expectedAuthorizationOwner: { uid: BigInt(authStat.uid), gid: BigInt(authStat.gid) },
    expectedCustodyOwner: { uid: BigInt(custodyStat.uid), gid: BigInt(custodyStat.gid) },
    expectedReplayRootOwner: { uid: BigInt(replayStat.uid), gid: BigInt(replayStat.gid) },
  };
  return {
    directory,
    authorizationPath,
    copiedAuthorizationPath,
    custodyPath,
    replayRoot,
    movedReplayRoot,
    authorizationBytes,
    pins,
    dependencies: (hooks = {}, times = [NOW, NOW, NOW]) => {
      let timeIndex = 0;
      const nodeDependencies = createM5bFedExGateBNodeDependencies(
        pins,
        () => times[Math.min(timeIndex++, times.length - 1)]!,
        hooks,
      );
      const actualExecutableIdentity = nodeDependencies.inspectExternalFile(MODULE_PATH);
      const fakeImplementation = implementation({ executableIdentity: actualExecutableIdentity });
      return {
        ...nodeDependencies,
        inspectImplementation: () => fakeImplementation,
        revalidateImplementation: () => true,
      };
    },
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("Gate B is internal-only, has no caller-selected replay root, and its template is non-executable", () => {
  const template = JSON.parse(readFileSync(join(REPOSITORY_ROOT,
    "fixtures/validation/m5b-fedex-gate-b-authorization-template.json"), "utf8"));
  const barrel = readFileSync(join(REPOSITORY_ROOT, "src/index.ts"), "utf8");
  const packageJson = JSON.parse(readFileSync(join(REPOSITORY_ROOT, "package.json"), "utf8"));
  assert.equal(template.templateOnly, true);
  assert.notEqual(template.kind, M5B_FEDEX_GATE_B_AUTHORIZATION_KIND);
  assert.equal("consumptionStateDirectory" in template, false);
  assert.equal(barrel.includes("m5b-fedex-gate-b-unarmed-executor"), false);
  assert.equal(packageJson.scripts["workshop:m5b-fedex-gate-b-one-shot"], undefined);
  assert.equal(JSON.stringify(packageJson).includes("executeM5bFedExGateBOneShot"), false);
  assert.equal(createM5bFedExGateBNodeDependencies.length, 1);
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.equal(source.includes("readonly repositoryRoot:"), false);
  assert.match(source, /expectedAuthorizationSha256/);
  assert.match(source, /trustedReplayRoot/);
  assert.match(source, /reviewedExecutableSha256/);
});

test("authorization bytes are pinned exactly; fresh IDs, reformatting, wrong pins, and GO-selected replay roots refuse", () => {
  const approved = authorization();
  const approvedBytes = Buffer.from(JSON.stringify(approved), "utf8");
  for (const authorizationBytes of [
    Buffer.from(JSON.stringify({ ...approved, authorizationId: "authorization_fresh_002" }), "utf8"),
    Buffer.from(JSON.stringify(approved, null, 2), "utf8"),
  ]) {
    const h = harness({ authorizationBytes, trust: { expectedAuthorizationSha256: sha256(approvedBytes) } });
    const result = h.run();
    assert.equal(result.ok, false);
    assert.equal(result.receipt.refusalCode, "authorization_digest");
    assert.equal(result.receipt.oneShotConsumptionState, "not_created");
    assert.equal(h.calls.consumptions, 0);
    assert.equal(h.calls.custodyReads, 0);
  }
  const wrongPin = harness({ authorizationBytes: approvedBytes,
    trust: { expectedAuthorizationSha256: "0".repeat(64) } });
  assert.equal(wrongPin.run().receipt.refusalCode, "authorization_digest");

  const callerSelectedReplay = { ...approved, consumptionStateDirectory: "/tmp/attacker-replay" };
  const replayBytes = Buffer.from(JSON.stringify(callerSelectedReplay), "utf8");
  const replay = harness({ authorization: callerSelectedReplay, authorizationBytes: replayBytes });
  assert.equal(replay.run().receipt.refusalCode, "authorization_envelope");
  assert.equal(replay.calls.consumptions, 0);
});

test("an exact-byte copied or relocated GO maps to the same authority tombstone", () => {
  const scenario = nodeScenario();
  try {
    writeFileSync(scenario.copiedAuthorizationPath, scenario.authorizationBytes, { mode: 0o600 });
    const first = executeM5bFedExGateBOneShot(scenario.authorizationPath, scenario.dependencies());
    assert.equal(first.ok, false);
    assert.equal(first.receipt.refusalCode, "production_custody_admission");
    assert.equal(first.receipt.oneShotConsumptionState, "durably_committed");
    const second = executeM5bFedExGateBOneShot(scenario.copiedAuthorizationPath, scenario.dependencies());
    assert.equal(second.ok, false);
    assert.equal(second.receipt.refusalCode, "consumption_replay_or_durability");
    assert.equal(second.receipt.oneShotConsumptionState, "preexisting_replay");
    assert.equal(second.receipt.accounting.custodyReadAttempts, 0);
    const markers = readdirSync(scenario.replayRoot).filter((name) => name.endsWith(".consumed"));
    assert.equal(markers.length, 1);
    const content = readFileSync(join(scenario.replayRoot, markers[0]!), "utf8");
    for (const forbidden of [scenario.authorizationPath, scenario.copiedAuthorizationPath, scenario.custodyPath,
      scenario.replayRoot, "authorization_test_001", "consumption_test_001"]) {
      assert.equal(content.includes(forbidden), false, forbidden);
    }
  } finally {
    scenario.cleanup();
  }
});

test("canonical repository identity is module/Git-derived and implementation snapshots bind clean sealed bytes", () => {
  const dummy = Buffer.from("synthetic");
  const originalWorkingDirectory = process.cwd();
  try {
    process.chdir(join(REPOSITORY_ROOT, "src", "workshop"));
    const nodeDependencies = createM5bFedExGateBNodeDependencies(trustPins(dummy));
    const actual = nodeDependencies.inspectImplementation();
    assert.equal(actual.canonicalRoot, REPOSITORY_ROOT);
    assert.equal(actual.baseCommit, M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT);
    assert.equal(actual.baseTree, M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE);
    assert.equal(typeof actual.baseIsAncestor, "boolean");
    const commitHeaders = execFileSync("git", ["cat-file", "commit", actual.commit], {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
    });
    const parents = commitHeaders.split("\n")
      .filter((header) => header.startsWith("parent "))
      .map((header) => header.slice("parent ".length));
    assert.equal(
      actual.baseIsAncestor,
      parents.length === 1 && parents[0] === M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
      "baseIsAncestor must mean exactly one direct parent equal to the pinned implementation base",
    );
  } finally {
    process.chdir(originalWorkingDirectory);
  }
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.match(source, /"cat-file", "commit", commit/);
  assert.match(source, /header\.startsWith\("tree "\)/);
  assert.match(source, /header\.startsWith\("parent "\)/);
  assert.match(source, /parents\.length === 1/);
  assert.match(source, /parents\[0\] === M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT/);
  assert.doesNotMatch(source, /`\$\{M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT\}\^\{(?:commit|tree)\}`/);
  assert.doesNotMatch(source, /"show"|"merge-base"|"--is-ancestor"/);
  assert.match(source, /gitIsClean/);

  for (const implementationDrift of [
    { baseIsAncestor: false },
    { clean: false },
    { executableSha256: "d".repeat(64) },
  ]) {
    const h = harness({ implementation: implementationDrift });
    const result = h.run();
    assert.equal(result.receipt.refusalCode, "implementation_identity");
    assert.equal(h.calls.consumptions, 0);
  }

  const beforeConsumption = harness({ revalidations: [false] });
  const movedBefore = beforeConsumption.run();
  assert.equal(movedBefore.receipt.phase, "durable_consumption");
  assert.equal(movedBefore.receipt.oneShotConsumptionState, "not_created");
  assert.equal(beforeConsumption.calls.consumptions, 0);

  const beforeCustody = harness({ revalidations: [true, false] });
  const movedAfter = beforeCustody.run();
  assert.equal(movedAfter.receipt.phase, "custody_read");
  assert.equal(movedAfter.receipt.oneShotConsumptionState, "durably_committed");
  assert.equal(beforeCustody.calls.custodyReads, 0);
});

test("authorization/custody owner, link, mode, containment, and bigint identities fail closed without narrowing", () => {
  for (const authorizationIdentity of [
    { mode: 0o644 },
    { regularFile: false },
    { nlink: 2n },
    { uid: 2000n },
    { realPath: "/tmp/atliera-m5b-gate-b-test/authorization-target.json" },
  ]) {
    const h = harness({ authorizationIdentity });
    assert.equal(h.run().receipt.refusalCode, "authorization_file");
    assert.equal(h.calls.authorizationReads, 0);
    assert.equal(h.calls.custodyReads, 0);
  }
  for (const custodyIdentity of [
    { mode: 0o640 },
    { regularFile: false },
    { nlink: 2n },
    { gid: 2000n },
    { realPath: "/tmp/atliera-m5b-gate-b-test/custody-target.json" },
  ]) {
    const h = harness({ custodyIdentity });
    assert.equal(h.run().receipt.refusalCode, "custody_file");
    assert.equal(h.calls.consumptions, 0);
  }
  const inside = harness({ authorization: authorization({ custodyPath: join(REPOSITORY_ROOT, "private.json") }) });
  assert.equal(inside.run().receipt.refusalCode, "custody_path");

  const aboveSafeInteger = 2n ** 53n + 123n;
  const highIdentity = harness({
    authorizationIdentity: { device: aboveSafeInteger, inode: aboveSafeInteger + 1n },
    custodyIdentity: { device: aboveSafeInteger + 2n, inode: aboveSafeInteger + 3n },
  });
  const highResult = highIdentity.run();
  assert.equal(highResult.receipt.oneShotConsumptionState, "durably_committed");
  assert.equal(highIdentity.calls.custodyReads, 1);
});

test("real authorization and custody hardlinks are rejected before consumption", () => {
  const scenario = nodeScenario();
  const authLink = join(scenario.directory, "authorization.hardlink.json");
  const custodyLink = join(scenario.directory, "custody.hardlink.json");
  try {
    linkSync(scenario.authorizationPath, authLink);
    const authResult = executeM5bFedExGateBOneShot(scenario.authorizationPath, scenario.dependencies());
    assert.equal(authResult.receipt.refusalCode, "authorization_file");
    rmSync(authLink);
    linkSync(scenario.custodyPath, custodyLink);
    const custodyResult = executeM5bFedExGateBOneShot(scenario.authorizationPath, scenario.dependencies());
    assert.equal(custodyResult.receipt.refusalCode, "custody_file");
    assert.deepEqual(readdirSync(scenario.replayRoot), []);
  } finally {
    scenario.cleanup();
  }
});

test("authorization and custody path replacement are caught by descriptor identity revalidation", () => {
  const authorizationScenario = nodeScenario();
  try {
    const dependencies = authorizationScenario.dependencies();
    const stalePath = join(authorizationScenario.directory, "authorization.stale.json");
    const replaced = executeM5bFedExGateBOneShot(authorizationScenario.authorizationPath, {
      ...dependencies,
      readAuthorizationOnce: (path, fileIdentity) => {
        renameSync(path, stalePath);
        writeFileSync(path, authorizationScenario.authorizationBytes, { mode: 0o600 });
        return dependencies.readAuthorizationOnce(path, fileIdentity);
      },
    });
    assert.equal(replaced.receipt.refusalCode, "file_identity_drift");
    assert.equal(replaced.receipt.oneShotConsumptionState, "not_created");
    assert.deepEqual(readdirSync(authorizationScenario.replayRoot), []);
  } finally {
    authorizationScenario.cleanup();
  }

  const custodyScenario = nodeScenario();
  try {
    const dependencies = custodyScenario.dependencies();
    const stalePath = join(custodyScenario.directory, "custody.stale.json");
    const replaced = executeM5bFedExGateBOneShot(custodyScenario.authorizationPath, {
      ...dependencies,
      readCustodyOnce: (path, fileIdentity) => {
        renameSync(path, stalePath);
        writeFileSync(path, Buffer.alloc(M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES, 0x20), { mode: 0o600 });
        return dependencies.readCustodyOnce(path, fileIdentity);
      },
    });
    assert.equal(replaced.receipt.refusalCode, "custody_read");
    assert.equal(replaced.receipt.oneShotConsumptionState, "durably_committed");
  } finally {
    custodyScenario.cleanup();
  }
});

test("descriptor-relative marker creation survives deterministic replay-directory rename/replacement", () => {
  const scenario = nodeScenario();
  try {
    const result = executeM5bFedExGateBOneShot(scenario.authorizationPath, scenario.dependencies({
      afterReplayDirectoryValidation: () => {
        renameSync(scenario.replayRoot, scenario.movedReplayRoot);
        mkdirSync(scenario.replayRoot, { mode: 0o700 });
      },
    }));
    assert.equal(result.receipt.oneShotConsumptionState, "durably_committed");
    assert.equal(readdirSync(scenario.movedReplayRoot).filter((name) => name.endsWith(".consumed")).length, 1);
    assert.deepEqual(readdirSync(scenario.replayRoot), []);
  } finally {
    scenario.cleanup();
  }
});

const CONCURRENT_WORKER = String.raw`
import { realpathSync } from "node:fs";
import { join } from "node:path";
import {
  createM5bFedExGateBNodeDependencies,
  executeM5bFedExGateBOneShot,
  M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
  M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
} from "./src/workshop/m5b-fedex-gate-b-unarmed-executor.ts";
const owner = { uid: BigInt(process.env.OWNER_UID), gid: BigInt(process.env.OWNER_GID) };
const pins = {
  expectedAuthorizationSha256: process.env.AUTH_SHA,
  trustedReplayRoot: process.env.REPLAY_ROOT,
  reviewedExecutorCommit: "a".repeat(40),
  reviewedExecutorTree: "b".repeat(40),
  reviewedExecutableSha256: "c".repeat(64),
  expectedAuthorizationOwner: owner,
  expectedCustodyOwner: owner,
  expectedReplayRootOwner: owner,
};
const base = createM5bFedExGateBNodeDependencies(pins, () => "2026-07-15T00:01:00.000Z");
const modulePath = realpathSync(join(process.cwd(), "src/workshop/m5b-fedex-gate-b-unarmed-executor.ts"));
const inspected = {
  canonicalRoot: realpathSync(process.cwd()),
  commit: "a".repeat(40),
  tree: "b".repeat(40),
  baseCommit: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT,
  baseTree: M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_TREE,
  baseIsAncestor: true,
  clean: true,
  executableSha256: "c".repeat(64),
  executableIdentity: base.inspectExternalFile(modulePath),
};
const result = executeM5bFedExGateBOneShot(process.env.AUTH_PATH, {
  ...base,
  inspectImplementation: () => inspected,
  revalidateImplementation: () => true,
});
if (process.send) process.send(result.receipt);
`;

function startConcurrentWorker(scenario: NodeScenario) {
  const owner = scenario.pins.expectedAuthorizationOwner;
  return spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", CONCURRENT_WORKER], {
    cwd: REPOSITORY_ROOT,
    env: {
      ...process.env,
      AUTH_PATH: scenario.authorizationPath,
      AUTH_SHA: scenario.pins.expectedAuthorizationSha256,
      REPLAY_ROOT: scenario.replayRoot,
      OWNER_UID: owner.uid.toString(),
      OWNER_GID: owner.gid.toString(),
    },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
}

async function collectWorker(child: ReturnType<typeof startConcurrentWorker>) {
  let stderr = "";
  child.stderr!.on("data", (chunk) => { stderr += String(chunk); });
  const message = once(child, "message");
  const close = once(child, "close");
  const [[receipt], [code]] = await Promise.all([message, close]);
  assert.equal(code, 0, stderr);
  return receipt as { oneShotConsumptionState: string; refusalCode: string; accounting: {
    custodyReadAttempts: number } };
}

test("two real processes concurrently consume at most once", async () => {
  const scenario = nodeScenario();
  try {
    const first = collectWorker(startConcurrentWorker(scenario));
    const second = collectWorker(startConcurrentWorker(scenario));
    const receipts = await Promise.all([first, second]);
    assert.deepEqual(receipts.map((item) => item.oneShotConsumptionState).sort(),
      ["durably_committed", "preexisting_replay"]);
    assert.equal(receipts.reduce((sum, item) => sum + item.accounting.custodyReadAttempts, 0), 1);
    assert.equal(readdirSync(scenario.replayRoot).filter((name) => name.endsWith(".consumed")).length, 1);
  } finally {
    scenario.cleanup();
  }
});

test("exclusive-create success is terminal across write, fsync, and close failures", () => {
  const failures: readonly (keyof M5bFedExGateBNodeTestHooks)[] = [
    "beforeMarkerWrite",
    "beforeMarkerFsync",
    "beforeMarkerClose",
    "beforeDirectoryFsync",
    "beforeDirectoryClose",
  ];
  for (const phase of failures) {
    const scenario = nodeScenario();
    try {
      const result = executeM5bFedExGateBOneShot(scenario.authorizationPath, scenario.dependencies({
        [phase]: () => { throw new Error(`synthetic ${phase} failure`); },
      }));
      assert.equal(result.receipt.refusalCode, "consumption_replay_or_durability", phase);
      assert.equal(result.receipt.oneShotConsumptionState, "created_fail_closed", phase);
      assert.equal(result.receipt.outcome, "failed", phase);
      assert.equal(result.receipt.accounting.custodyReadAttempts, 0, phase);
      assert.equal(readdirSync(scenario.replayRoot).filter((name) => name.endsWith(".consumed")).length, 1, phase);
      const replay = executeM5bFedExGateBOneShot(scenario.authorizationPath, scenario.dependencies());
      assert.equal(replay.receipt.oneShotConsumptionState, "preexisting_replay", phase);
      assert.equal(replay.receipt.accounting.custodyReadAttempts, 0, phase);
    } finally {
      scenario.cleanup();
    }
  }
});

test("pre-create failure, preexisting replay, and post-create failure report distinct truthful states", () => {
  for (const [behavior, expected, outcome] of [
    ["fail_before_create", "not_created", "refused"],
    ["preexisting", "preexisting_replay", "refused"],
    ["fail_after_create", "created_fail_closed", "failed"],
  ] as const) {
    const h = harness({ consumption: behavior });
    const result = h.run();
    assert.equal(result.receipt.oneShotConsumptionState, expected);
    assert.equal(result.receipt.outcome, outcome);
    assert.equal(h.calls.custodyReads, 0);
  }
});

test("A: ancient but currently-in-window GO refuses before marker creation", () => {
  assert.equal(M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS, 600_000);
  const ancient = harness({
    authorization: authorization({
      authorizedAt: "2020-01-01T00:00:00.000Z",
      validFrom: "2026-07-15T00:00:00.000Z",
      validUntil: "2026-07-15T00:05:00.000Z",
    }),
  });
  const result = ancient.run();
  assert.equal(result.receipt.refusalCode, "authorization_freshness");
  assert.equal(result.receipt.oneShotConsumptionState, "not_created");
  assert.equal(ancient.calls.consumptions, 0);
  assert.equal(ancient.calls.custodyReads, 0);
});

test("B: initially fresh GO aging to ten minutes refuses before marker creation", () => {
  const aging = harness({
    authorization: authorization({ validUntil: "2026-07-15T00:10:00.000Z" }),
    times: [NOW, "2026-07-15T00:10:00.000Z"],
  });
  const result = aging.run();
  assert.equal(result.receipt.refusalCode, "authorization_freshness");
  assert.equal(result.receipt.oneShotConsumptionState, "not_created");
  assert.equal(aging.calls.consumptions, 0);
  assert.equal(aging.calls.custodyReads, 0);
});

test("C: GO aging to ten minutes after durable consumption refuses before custody and replay stays terminal", () => {
  const scenario = nodeScenario({ validUntil: "2026-07-15T00:10:00.000Z" });
  try {
    const expired = executeM5bFedExGateBOneShot(
      scenario.authorizationPath,
      scenario.dependencies({}, [NOW, "2026-07-15T00:02:00.000Z", "2026-07-15T00:10:00.000Z"]),
    );
    assert.equal(expired.receipt.refusalCode, "authorization_freshness");
    assert.equal(expired.receipt.oneShotConsumptionState, "durably_committed");
    assert.equal(expired.receipt.accounting.custodyReadAttempts, 0);

    const replay = executeM5bFedExGateBOneShot(scenario.authorizationPath, scenario.dependencies());
    assert.equal(replay.receipt.refusalCode, "consumption_replay_or_durability");
    assert.equal(replay.receipt.oneShotConsumptionState, "preexisting_replay");
    assert.equal(replay.receipt.accounting.custodyReadAttempts, 0);
  } finally {
    scenario.cleanup();
  }
});

test("trusted time is sampled at all three boundaries and refuses expiry or regression truthfully", () => {
  const beforeConsumption = harness({ times: [NOW, "2026-07-15T00:05:00.000Z"] });
  const expiredBefore = beforeConsumption.run();
  assert.equal(expiredBefore.receipt.refusalCode, "authorization_window");
  assert.equal(expiredBefore.receipt.oneShotConsumptionState, "not_created");
  assert.equal(beforeConsumption.calls.consumptions, 0);
  assert.equal(beforeConsumption.calls.custodyReads, 0);

  const afterConsumption = harness({ times: [NOW, "2026-07-15T00:02:00.000Z",
    "2026-07-15T00:05:00.000Z"] });
  const expiredAfter = afterConsumption.run();
  assert.equal(expiredAfter.receipt.refusalCode, "authorization_window");
  assert.equal(expiredAfter.receipt.oneShotConsumptionState, "durably_committed");
  assert.equal(afterConsumption.calls.custodyReads, 0);

  const regression = harness({ times: [NOW, "2026-07-15T00:00:59.000Z"] });
  const regressed = regression.run();
  assert.equal(regressed.receipt.refusalCode, "trusted_time_regression");
  assert.equal(regressed.receipt.oneShotConsumptionState, "not_created");
  assert.equal(regression.calls.consumptions, 0);
});

test("durable consumption precedes the sole custody read and failures remain sanitized", () => {
  const sensitiveCustody = Buffer.alloc(M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES, 0x20);
  const sensitivePrefix = "User-Agent: private-agent contact@example.invalid Bearer synthetic-secret 192.0.2.1";
  sensitiveCustody.write(sensitivePrefix);
  const h = harness({ custodyBytes: sensitiveCustody });
  const result = h.run();
  assert.equal(h.calls.consumptionBeforeCustodyRead, true);
  assert.equal(h.calls.custodyReads, 1);
  assert.equal(result.receipt.oneShotConsumptionState, "durably_committed");
  assert.equal(result.receipt.refusalCode, "production_custody_admission");
  assert.deepEqual({
    attempts: result.receipt.accounting.custodyReadAttempts,
    completed: result.receipt.accounting.custodyReadsCompleted,
    bytes: result.receipt.accounting.custodyBytesRead,
  }, { attempts: 1, completed: 1, bytes: M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES });
  assertNoEffects(result);
  const serialized = canonicalM5bFedExJson(result);
  for (const secret of [AUTHORIZATION_PATH, CUSTODY_PATH, TRUSTED_REPLAY_ROOT, "User-Agent", "private-agent",
    "contact@example.invalid", "Bearer synthetic-secret", "192.0.2.1",
    Buffer.from(sensitivePrefix).toString("base64")]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("thrown and short custody reads are attempted once with zero retry and truthful accounting", () => {
  const thrown = harness({ custodyFailure: true });
  const thrownResult = thrown.run();
  assert.equal(thrownResult.receipt.refusalCode, "custody_read");
  assert.equal(thrownResult.receipt.oneShotConsumptionState, "durably_committed");
  assert.deepEqual({
    attempts: thrownResult.receipt.accounting.custodyReadAttempts,
    completed: thrownResult.receipt.accounting.custodyReadsCompleted,
    bytes: thrownResult.receipt.accounting.custodyBytesRead,
    retries: thrownResult.receipt.accounting.retries,
  }, { attempts: 1, completed: 0, bytes: 0, retries: 0 });

  const short = harness({ custodyBytes: Buffer.from("synthetic-short"),
    custodyIdentity: { size: BigInt(M5B_FEDEX_GATE_B_CUSTODY_ARTIFACT_BYTES) } });
  const shortResult = short.run();
  assert.equal(shortResult.receipt.refusalCode, "custody_read");
  assert.deepEqual({
    attempts: shortResult.receipt.accounting.custodyReadAttempts,
    completed: shortResult.receipt.accounting.custodyReadsCompleted,
    bytes: shortResult.receipt.accounting.custodyBytesRead,
  }, { attempts: 1, completed: 1, bytes: 15 });
});

test("all five committed synthetic artifacts equal regeneration byte-for-byte", () => {
  const first = generateM5bFedExGateBSyntheticArtifacts(FIXTURE.toString("utf8"));
  const second = generateM5bFedExGateBSyntheticArtifacts(FIXTURE.toString("utf8"));
  const generated = [first.sourcePackJson, first.candidateJson, first.reviewPacketJson,
    first.workshopHtml, first.executionReceiptJson];
  assert.deepEqual(generated, [second.sourcePackJson, second.candidateJson, second.reviewPacketJson,
    second.workshopHtml, second.executionReceiptJson]);
  const paths = [
    "fixtures/validation/m5b-fedex-gate-b-synthetic-source-pack.json",
    "fixtures/validation/m5b-fedex-gate-b-synthetic-candidate.json",
    "fixtures/validation/m5b-fedex-gate-b-synthetic-review-packet.json",
    "fixtures/workshop/m5b-fedex-gate-b-synthetic-prewrite-review.html",
    "fixtures/validation/m5b-fedex-gate-b-synthetic-execution-receipt.json",
  ];
  const committed = paths.map((path) => readFileSync(join(REPOSITORY_ROOT, path), "utf8"));
  assert.deepEqual(generated, committed);
  for (let index = 0; index < committed.length; index++) {
    const altered = [...committed];
    altered[index] = `${altered[index]}hostile-byte`;
    assert.notDeepEqual(generated, altered, paths[index]);
  }
  assert.equal(first.sourcePack.trustStatus, M5B_FEDEX_TRUST_STATUS);
  assert.equal(first.candidate.boundaries.verifiedObjects, 0);
  assert.equal(first.reviewPacket.ratificationState, "unratified-draft");
  assert.equal(first.reviewPacket.satisfiesFutureArming, false);
  const receipt = JSON.parse(first.executionReceiptJson);
  assert.equal(receipt.oneShotConsumptionState, "not_created");
  assert.equal("oneShotConsumptionCommitted" in receipt, false);
  assert.equal(receipt.accounting.localSyntheticOutputsWritten, 5);
  assert.match(first.workshopHtml, /synthetic outputs written by the Gate B generator: exactly 5/);
  assert.equal(first.workshopHtml.includes("fixture outputs written by the generator: 3"), false);
  assertNoEffects({ ok: false, outputs: null, receipt });
});

test("Workshop boundary reconciliation rejects contradictions only inside the scoped boundary section", () => {
  const artifacts = generateM5bFedExGateBSyntheticArtifacts(FIXTURE.toString("utf8"));
  const sharedHtml = renderM5bFedExPrewriteWorkshopHtml(
    artifacts.sourcePack,
    artifacts.reviewPacket,
    artifacts.candidate,
  );
  const historicalOutsideSection = sharedHtml.replace("<body>",
    "<body><aside>Historical Gate A generator wrote 3 fixture outputs.</aside>");
  assert.match(finalizeM5bFedExGateBWorkshopBoundary(historicalOutsideSection, "committed-synthetic-fixture"),
    /exactly 5/);
  const contradictoryBoundary = sharedHtml.replace(
    '<p class="mono">Candidate content SHA-256:',
    '<p>Local deterministic Gate B outputs: 3.</p><p class="mono">Candidate content SHA-256:',
  );
  assert.throws(() => finalizeM5bFedExGateBWorkshopBoundary(
    contradictoryBoundary,
    "committed-synthetic-fixture",
  ), { name: "M5bFedExGateBRefusal", message: "M5b FedEx Gate B refused: shared_workshop_boundary" });
  assert.throws(() => finalizeM5bFedExGateBWorkshopBoundary(sharedHtml + sharedHtml,
    "future-private-one-shot"),
  { name: "M5bFedExGateBRefusal", message: "M5b FedEx Gate B refused: shared_workshop_boundary" });
});
