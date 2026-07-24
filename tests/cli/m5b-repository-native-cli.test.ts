import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";
import {
  M5B_REPOSITORY_NATIVE_RATIFICATION_KIND,
  verifyM5bRepositoryNativeRatificationArtifactHash,
  type M5bRepositoryNativePrepareResult,
  type M5bRepositoryNativeRatificationContent,
} from "../../src/workshop/m5b-repository-native.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const SOURCE = join(ROOT, "fixtures/validation/m5b-fedex-system-acquired-demo-source.json");
const RATIFICATION_FIXTURE = join(ROOT, "fixtures/validation/m5b-repository-native-synthetic-ratification.json");
const OWNER = "owner_fixture_m5b_cli_001";
const COMMIT = "a".repeat(40);
const TREE = "b".repeat(40);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function runCli(args: readonly string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", join(ROOT, "src/cli/m5b-repository-native.ts"), ...args],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  return { code: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

async function prepareArgs(root: string): Promise<string[]> {
  const source = await readFile(SOURCE);
  return [
    "prepare",
    "--source", SOURCE,
    "--output", join(root, "prepared"),
    "--source-kind", "committed-synthetic-fixture",
    "--expected-source-sha256", sha256(source),
    "--expected-source-size", String(source.byteLength),
    "--owner-authorization-id", OWNER,
    "--execution-commit", COMMIT,
    "--execution-tree", TREE,
  ];
}

async function createRatification(root: string, prepare: M5bRepositoryNativePrepareResult) {
  const fixture = JSON.parse(await readFile(RATIFICATION_FIXTURE, "utf8")) as {
    ratifierId: string;
    ratifiedAt: string;
    retentionDisposition: "accept" | "reject";
    decisions: M5bRepositoryNativeRatificationContent["decisions"];
  };
  const content: M5bRepositoryNativeRatificationContent = {
    kind: M5B_REPOSITORY_NATIVE_RATIFICATION_KIND,
    schemaVersion: "1",
    prepareResultSha256: prepare.resultSha256,
    sourceSha256: prepare.sourceIdentity.sha256,
    sourceSize: prepare.sourceIdentity.size,
    sourcePackSha256: prepare.sourcePackSha256,
    candidateContentSha256: prepare.candidateContentSha256,
    reviewPacketSha256: prepare.reviewPacketSha256,
    ownerAuthorizationId: prepare.ownerAuthorizationId,
    executionCommit: prepare.executionCommit,
    executionTree: prepare.executionTree,
    ratifierId: fixture.ratifierId,
    ratifiedAt: fixture.ratifiedAt,
    retentionDisposition: fixture.retentionDisposition,
    decisions: fixture.decisions,
    currentEffectiveAuthorization: "one-shot-local-durable-graph-write",
    authorizesDurableLocalWrite: true,
    maximumDurableLocalWrites: 1,
    authorizesProviderCall: false,
    authorizesAcquisition: false,
    authorizesNetwork: false,
    authorizesDeployment: false,
    retries: 0,
  };
  const ratification = {
    ...content,
    ratificationArtifactSha256: verifyM5bRepositoryNativeRatificationArtifactHash(content),
  };
  const bytes = Buffer.from(`${JSON.stringify(ratification, null, 2)}\n`, "utf8");
  const path = join(root, "ratification.json");
  await writeFile(path, bytes, { flag: "wx" });
  return { path, rawSha256: sha256(bytes) };
}

function applyArgs(
  root: string,
  ratification: { path: string; rawSha256: string },
  outputName = "applied",
): string[] {
  return [
    "apply",
    "--prepared", join(root, "prepared"),
    "--ratification", ratification.path,
    "--graph-store", join(root, "graph-store"),
    "--output", join(root, outputName),
    "--expected-ratification-sha256", ratification.rawSha256,
    "--expected-owner-authorization-id", OWNER,
    "--expected-execution-commit", COMMIT,
    "--expected-execution-tree", TREE,
  ];
}

async function withScenario<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "atliera-m5b-cli-"));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("m5b repository-native CLI", () => {
  test("rejects missing, duplicate, and unknown arguments", async () => {
    for (const args of [
      ["prepare"],
      ["apply"],
      ["prepare", "--source", "one", "--source", "two"],
      ["prepare", "--unknown", "value"],
    ]) {
      const result = await runCli(args);
      assert.equal(result.code, 1);
      const error = JSON.parse(result.stderr);
      assert.equal(error.ok, false);
      assert.equal(error.code, "invalid_request");
    }
  });

  test("rejects malformed source hashes and sizes through the CLI contract", async () => {
    await withScenario(async (root) => {
      const args = await prepareArgs(root);
      const hashIndex = args.indexOf("--expected-source-sha256") + 1;
      const sizeIndex = args.indexOf("--expected-source-size") + 1;

      const badHash = [...args];
      badHash[hashIndex] = "bad";
      const hashResult = await runCli(badHash);
      assert.equal(hashResult.code, 1);
      assert.equal(JSON.parse(hashResult.stderr).code, "source_identity");

      const badSize = [...args];
      badSize[sizeIndex] = "0";
      const sizeResult = await runCli(badSize);
      assert.equal(sizeResult.code, 1);
      assert.equal(JSON.parse(sizeResult.stderr).code, "invalid_request");

      const unsafeSize = [...args];
      unsafeSize[sizeIndex] = "999999999999999999999999999999";
      const unsafeSizeResult = await runCli(unsafeSize);
      assert.equal(unsafeSizeResult.code, 1);
      assert.equal(JSON.parse(unsafeSizeResult.stderr).code, "source_identity");
    });
  });

  test("executes the prepare happy path", async () => {
    await withScenario(async (root) => {
      const result = await runCli(await prepareArgs(root));
      assert.equal(result.code, 0, result.stderr);
      const prepare = JSON.parse(result.stdout) as M5bRepositoryNativePrepareResult;
      assert.equal(prepare.sourceIdentity.kind, "committed-synthetic-fixture");
      assert.equal(prepare.ownerAuthorizationId, OWNER);
      assert.equal(prepare.accounting.explicitSourceReads, 1);
    });
  });

  test("executes apply with all external pins and rejects each wrong pin", async () => {
    await withScenario(async (root) => {
      const prepared = await runCli(await prepareArgs(root));
      assert.equal(prepared.code, 0, prepared.stderr);
      const prepare = JSON.parse(prepared.stdout) as M5bRepositoryNativePrepareResult;
      const ratification = await createRatification(root, prepare);
      const base = applyArgs(root, ratification);
      const cases = [
        ["--expected-ratification-sha256", "f".repeat(64), "ratification_raw_sha256"],
        ["--expected-owner-authorization-id", "wrong_owner", "expected_owner_authorization"],
        ["--expected-execution-commit", "c".repeat(40), "expected_execution_commit"],
        ["--expected-execution-tree", "d".repeat(40), "expected_execution_tree"],
      ] as const;
      for (const [flag, value, code] of cases) {
        const args = [...base];
        args[args.indexOf(flag) + 1] = value;
        const result = await runCli(args);
        assert.equal(result.code, 1);
        assert.equal(JSON.parse(result.stderr).code, code);
      }

      const malformed = [...base];
      malformed[malformed.indexOf("--expected-ratification-sha256") + 1] = "bad";
      const malformedResult = await runCli(malformed);
      assert.equal(malformedResult.code, 1);
      assert.equal(JSON.parse(malformedResult.stderr).code, "expected_ratification_sha256");

      const applied = await runCli(base);
      assert.equal(applied.code, 0, applied.stderr);
      const result = JSON.parse(applied.stdout);
      assert.equal(result.graphCommitDisposition, "newly-created");
      assert.equal(result.ratificationRawSha256, ratification.rawSha256);
      assert.equal(result.ownerAuthorizationId, OWNER);
      assert.equal(result.executionCommit, COMMIT);
      assert.equal(result.executionTree, TREE);
    });
  });
});
