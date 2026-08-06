import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { invokeM5bProductReviewCli } from "../../src/cli/m5b-product-review.ts";
import {
  createSyntheticM5bProductReviewScenario,
  sha256Fixture,
} from "../fixtures/m5b-product-review-synthetic.ts";

async function runCli(args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const result = await invokeM5bProductReviewCli(args);
  return { code: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

async function withScenario<T>(fn: (scenario: Awaited<ReturnType<
  typeof createSyntheticM5bProductReviewScenario>>) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "atliera-product-cli-"));
  try {
    return await fn(await createSyntheticM5bProductReviewScenario(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function argsFor(scenario: Awaited<ReturnType<typeof createSyntheticM5bProductReviewScenario>>): string[] {
  return [
    "prepare",
    "--request", scenario.requestPath,
    "--expected-request-sha256", sha256Fixture(scenario.requestBytes),
    "--expected-request-size", String(scenario.requestBytes.byteLength),
    ...scenario.sourceFiles.flatMap((source) => ["--source", `${source.sourceId}=${source.path}`]),
    "--output", scenario.outputDir,
  ];
}

describe("M5b product-review CLI", () => {
  test("executes the additive strict prepare-only command", async () => {
    await withScenario(async (scenario) => {
      const result = await runCli(argsFor(scenario));
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, "");
      const prepared = JSON.parse(result.stdout);
      assert.equal(prepared.kind, "m5b-product-review-prepare-result");
      assert.equal(prepared.accounting.requestManifestReads, 1);
      assert.equal(prepared.accounting.evidenceSourceReads, 3);
      assert.equal(prepared.accounting.graphWrites, 0);
      assert.equal(prepared.authority.currentEffectiveAuthorization, "none");
      assert.equal(prepared.authority.applyEligibility, false);
    });
  });

  test("rejects missing, odd, duplicate, unknown, malformed source, and apply arguments", async () => {
    for (const args of [
      [],
      ["prepare"],
      ["prepare", "--request"],
      ["prepare", "--request", "/tmp/a", "--request", "/tmp/b"],
      ["prepare", "--unknown", "value"],
      ["prepare", "--source", "not-an-id-path"],
      ["apply", "--prepared", "/tmp/unused"],
    ]) {
      const result = await runCli(args);
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      assert.equal(JSON.parse(result.stderr).code, "invalid_request");
    }
  });

  test("requires all explicit source bindings and exact request pins", async () => {
    await withScenario(async (scenario) => {
      const missingSource = argsFor(scenario);
      const firstSourceFlag = missingSource.indexOf("--source");
      missingSource.splice(firstSourceFlag, 2);
      const missing = await runCli(missingSource);
      assert.equal(missing.code, 1);
      assert.equal(JSON.parse(missing.stderr).code, "source_bindings");

      const badHash = argsFor(scenario);
      badHash[badHash.indexOf("--expected-request-sha256") + 1] = "d".repeat(64);
      const tampered = await runCli(badHash);
      assert.equal(tampered.code, 1);
      assert.equal(JSON.parse(tampered.stderr).code, "request_identity_mismatch");

      const badSize = argsFor(scenario);
      badSize[badSize.indexOf("--expected-request-size") + 1] = "0";
      const size = await runCli(badSize);
      assert.equal(size.code, 1);
      assert.equal(JSON.parse(size.stderr).code, "invalid_request");
    });
  });
});
