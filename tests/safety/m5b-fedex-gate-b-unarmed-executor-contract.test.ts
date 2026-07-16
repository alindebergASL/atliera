import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");
const SOURCE = read("src/workshop/m5b-fedex-gate-b-unarmed-executor.ts");
const STATUS = read("docs/runbooks/m5b-fedex-gate-b-unarmed-executor-status.md");

test("Gate B remains unarmed: no public/package execution route, executable GO, signing, or PKI", () => {
  const template = JSON.parse(read("fixtures/validation/m5b-fedex-gate-b-authorization-template.json"));
  const packageJson = JSON.parse(read("package.json"));
  const barrel = read("src/index.ts");
  assert.equal(template.templateOnly, true);
  assert.equal(template.kind, "m5b-fedex-gate-b-private-one-shot-authorization-template-not-executable");
  assert.match(template.custodyPath, /^<.*>$/);
  assert.equal("consumptionStateDirectory" in template, false);
  assert.match(template.reviewedExecutorCommit, /^<.*>$/);
  assert.match(template.reviewedExecutorTree, /^<.*>$/);
  assert.doesNotMatch(barrel, /m5b-fedex-gate-b-unarmed-executor/);
  assert.equal(packageJson.scripts["workshop:m5b-fedex-gate-b-one-shot"], undefined);
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /executeM5bFedExGateBOneShot/);
  assert.equal(packageJson.scripts["workshop:m5b-fedex-gate-b-synthetic"],
    "node --import tsx scripts/generate-m5b-fedex-gate-b-synthetic-prewrite.mts");
  assert.doesNotMatch(SOURCE, /createSign|createVerify|privateKey|publicKey|certificate|node:tls|node:https/);
  const authorizationArtifacts = readdirSync(join(ROOT, "fixtures/validation"))
    .filter((name) => name.includes("m5b-fedex-gate-b-authorization"));
  assert.deepEqual(authorizationArtifacts, ["m5b-fedex-gate-b-authorization-template.json"]);
});

test("later arming must supply literal GO, executor/seal, owner, and fixed replay-root pins", () => {
  for (const binding of [
    "expectedAuthorizationSha256",
    "trustedReplayRoot",
    "reviewedExecutorCommit",
    "reviewedExecutorTree",
    "reviewedExecutableSha256",
    "expectedAuthorizationOwner",
    "expectedCustodyOwner",
    "expectedReplayRootOwner",
  ]) assert.ok(SOURCE.includes(binding), binding);
  assert.doesNotMatch(SOURCE, /readonly repositoryRoot:/);
  assert.match(SOURCE, /expectedAuthorizationSha256[^\n]*|state\.authorizationSha256/);
  assert.match(SOURCE, /state\.authorizationSha256 !== trustedPins\.expectedAuthorizationSha256/);
  assert.match(STATUS, /later reviewed arming wrapper/i);
});

test("repository and implementation identity use one immutable HEAD snapshot plus clean sealed revalidation", () => {
  for (const literal of [
    "81661693bd0c858a4e0c9400ff68c28cb0b277f3",
    "e40ff4b3d1a0c394145b9b63ddb5efeaab785a5e",
    "--show-toplevel",
    '"cat-file", "commit", commit',
    'header.startsWith("tree ")',
    'header.startsWith("parent ")',
    "parents.length === 1",
    "gitIsClean",
    "inspectExecutable",
    "revalidateImplementation",
  ]) assert.ok(SOURCE.includes(literal), literal);
  assert.match(SOURCE, /const commit = gitValue\(canonicalRoot, \["rev-parse", "HEAD"\]\)/);
  assert.match(SOURCE, /gitValue\(canonicalRoot, \["cat-file", "commit", commit\]\)/);
  const ancestryEnd = SOURCE.indexOf("clean: gitIsClean");
  const ancestryBlock = SOURCE.slice(SOURCE.lastIndexOf("baseIsAncestor:", ancestryEnd), ancestryEnd);
  assert.match(ancestryBlock,
    /parents\.length === 1[\s\S]*parents\[0\] === M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT/);
  assert.doesNotMatch(ancestryBlock, /"HEAD"/);
  assert.doesNotMatch(SOURCE, /`\$\{M5B_FEDEX_GATE_B_IMPLEMENTATION_BASE_COMMIT\}\^\{(?:commit|tree)\}`/);
  assert.doesNotMatch(SOURCE, /"show"|"merge-base"|"--is-ancestor"/);
});

test("Linux filesystem binding is bigint, owner/link/descriptor-bound, exclusive, and directory-relative", () => {
  for (const literal of [
    "device: bigint",
    "inode: bigint",
    "uid: bigint",
    "gid: bigint",
    "nlink: bigint",
    "identity.nlink !== 1n",
    "O_RDONLY | fsConstants.O_NOFOLLOW",
    "fstatSync(descriptor, { bigint: true })",
    "O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL",
    "/proc/self/fd/${directoryDescriptor}/${markerName}",
    "writeFileSync(markerDescriptor, content, \"utf8\")",
    "fsyncSync(markerDescriptor)",
    "fsyncSync(directoryDescriptor)",
  ]) assert.ok(SOURCE.includes(literal), literal);
  assert.doesNotMatch(SOURCE, /Number\(metadata\.(?:dev|ino)\)/);
  const keyBody = SOURCE.slice(SOURCE.indexOf("function consumptionMarkerName"),
    SOURCE.indexOf("function consumptionContent"));
  assert.match(keyBody, /approvedGoSha256/);
  assert.match(keyBody, /reviewedExecutableSha256/);
  assert.match(keyBody, /custodyArtifactSha256/);
  assert.doesNotMatch(keyBody, /authorizationId|oneShotConsumptionId|custodyPath|trustedReplayRoot/);
});

test("receipt exposes four truthful consumption states and enforces ten-minute freshness at every boundary", () => {
  const fixtureReceipt = JSON.parse(read(
    "fixtures/validation/m5b-fedex-gate-b-synthetic-execution-receipt.json"));
  assert.equal(fixtureReceipt.oneShotConsumptionState, "not_created");
  assert.equal("oneShotConsumptionCommitted" in fixtureReceipt, false);
  for (const state of ["not_created", "preexisting_replay", "created_fail_closed", "durably_committed"]) {
    assert.ok(SOURCE.includes(`"${state}"`), state);
  }
  assert.match(SOURCE, /M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS = 600_000/);
  assert.match(SOURCE,
    /validUntilMs - authorizedAtMs > M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS/);
  assert.match(SOURCE,
    /now < authorizedAt \|\| now - authorizedAt >= M5B_FEDEX_GATE_B_MAX_GO_LIFETIME_MS/);
  assert.equal((SOURCE.match(/sampleTrustedTime\(dependencies/g) ?? []).length, 3);
  assert.match(SOURCE, /trusted_time_regression/);
  assert.ok(SOURCE.indexOf("dependencies.commitConsumption") < SOURCE.indexOf("dependencies.readCustodyOnce"));
});

test("production core returns in-memory outputs and imports no provider/network/graph/deployment route", () => {
  for (const forbidden of [
    "node:http", "node:https", "node:net", "node:dns", "fetch(", "model-adapter", "provider.ts",
    "database-versioned-store", "local-durable-db", "aws-sdk", "@aws-sdk",
  ]) assert.equal(SOURCE.includes(forbidden), false, forbidden);
  assert.match(SOURCE, /ok: true[;,\s]+outputs:/);
  assert.doesNotMatch(SOURCE, /output(?:File|Path|Directory)/);
  assert.match(STATUS, /no provider\/model call[^\n]*or output-file write/i);
});

test("synthetic receipt and all five outputs preserve zero effects and honest trust", () => {
  const receipt = JSON.parse(read("fixtures/validation/m5b-fedex-gate-b-synthetic-execution-receipt.json"));
  const workshopHtml = read("fixtures/workshop/m5b-fedex-gate-b-synthetic-prewrite-review.html");
  assert.equal(receipt.executionMode, "committed-synthetic-fixture");
  assert.equal(receipt.reviewedExecutorCommit, null);
  assert.equal(receipt.reviewedExecutorTree, null);
  assert.equal(receipt.oneShotConsumptionState, "not_created");
  assert.deepEqual({
    authorizationReads: receipt.accounting.authorizationArtifactReads,
    custodyReads: receipt.accounting.custodyReadAttempts,
    retries: receipt.accounting.retries,
    providers: receipt.accounting.providerCalls,
    acquisitions: receipt.accounting.acquisitions,
    graphReads: receipt.accounting.graphOrDbReads,
    graphWrites: receipt.accounting.graphOrDbWrites,
    deployments: receipt.accounting.deployments,
    effects: receipt.accounting.externalProductEffects,
    outputs: receipt.accounting.localSyntheticOutputsWritten,
  }, {
    authorizationReads: 0,
    custodyReads: 0,
    retries: 0,
    providers: 0,
    acquisitions: 0,
    graphReads: 0,
    graphWrites: 0,
    deployments: 0,
    effects: 0,
    outputs: 5,
  });
  assert.equal(receipt.trust.sourceTrustStatus, "source-backed-not-independently-verified");
  assert.equal(receipt.trust.independentlyVerifiedObjects, 0);
  assert.equal(receipt.trust.reviewRatificationState, "unratified-draft");
  assert.equal(receipt.trust.humanRatificationSatisfied, false);
  assert.equal(Object.values(receipt.sanitization).every((value) => value === true), true);
  assert.match(workshopHtml, /Private reads 0/);
  assert.match(workshopHtml, /graph\/durable reads 0/);
  assert.match(workshopHtml, /external\/product effects 0/);
  assert.match(workshopHtml, /synthetic outputs written by the Gate B generator: exactly 5/);
  assert.doesNotMatch(workshopHtml, /fixture outputs written by the generator: 3/);
});

test("roadmap and runbooks keep Gate B unarmed with five active outputs and three only historical Gate A", () => {
  const roadmap = read("docs/strategy/roadmap.md");
  const index = read("docs/runbooks/INDEX.md");
  const blockers = read("docs/BLOCKERS.md");
  const gateA = read("docs/runbooks/m5b-fedex-system-acquired-pre-effect-gate-a-status.md");
  const row = roadmap.split("\n").find((line) => line.startsWith("| **M5b —"));
  assert.equal(row?.split("|")[2]?.trim(), "🔶 in progress — Gate B implementation unarmed, not shipped");
  for (const document of [STATUS, index, blockers, gateA]) {
    assert.match(document, /PR #289[^\n]*(approved and merged|Gate A is merged|Gate A: merged)/i);
    assert.match(document, /(current_effective_authorization|current effective authorization)[^\n]*none/i);
    assert.match(document, /fresh explicit/i);
    assert.match(document, /ten minutes|600000/);
  }
  for (const document of [STATUS, index, roadmap, blockers]) {
    assert.match(document, /(?:exactly |writes |generator: `?)5/i);
  }
  assert.match(gateA, /historical[^\n]*3|3[^\n]*historical/i);
});
