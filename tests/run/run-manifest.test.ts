import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { writeRunArtifactManifest, type RunArtifactManifest } from "../../src/run/manifest.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-run-manifest-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("writeRunArtifactManifest", () => {
  test("writes graph bundle, quality gate report, and manifest under one explicit output root", async () => {
    await withTempDir(async (outputRoot) => {
      const bundle = makeValidBundle();
      const result = await writeRunArtifactManifest({
        bundle,
        outputRoot,
        runSlug: "fixture-valid-run",
        mode: "model",
        inputPath: "fixtures/graph/valid/minimal-pass.json",
      });

      assert.equal(result.manifest.schema_version, "atliera.run_manifest.v1");
      assert.equal(result.manifest.mode, "model");
      assert.equal(result.manifest.run_slug, "fixture-valid-run");
      assert.equal(result.manifest.input_path, "fixtures/graph/valid/minimal-pass.json");
      assert.equal(result.manifest.quality_gate.status, "pass");
      assert.deepEqual(result.manifest.model_run, {
        provider: null,
        model: null,
        started_at: null,
        completed_at: null,
      });
      assert.deepEqual(result.manifest.cost_ledger, {
        currency: null,
        total_cost: null,
        input_tokens: null,
        output_tokens: null,
      });
      assert.deepEqual(result.manifest.adapter_records, []);
      assert.equal(result.manifest.artifacts.length, 2);
      assert.deepEqual(
        result.manifest.artifacts.map((a) => a.artifact_type).sort(),
        ["graph_bundle", "quality_gate_report"],
      );
      assert.ok(result.manifest_path.endsWith("fixture-valid-run/manifest.json"));
      assert.ok(result.graph_bundle_path.endsWith("fixture-valid-run/graph-bundle.json"));
      assert.ok(result.quality_gate_report_path.endsWith("fixture-valid-run/quality-gate-report.json"));

      const savedBundle = await readJson(result.graph_bundle_path);
      const savedGate = await readJson(result.quality_gate_report_path);
      const savedManifest = await readJson(result.manifest_path) as RunArtifactManifest;

      assert.deepEqual(savedBundle, bundle);
      assert.deepEqual(savedGate, result.qualityGateReport);
      assert.deepEqual(savedManifest, result.manifest);
      assert.equal(savedManifest.artifacts[0]!.path.startsWith(outputRoot), false);
      assert.match(savedManifest.artifacts[0]!.path, /^fixture-valid-run\//);
    });
  });

  test("refuses to write when output root does not exist", async () => {
    await withTempDir(async (dir) => {
      await assert.rejects(
        () => writeRunArtifactManifest({
          bundle: makeValidBundle(),
          outputRoot: join(dir, "missing"),
          runSlug: "missing-root",
          mode: "model",
        }),
        /output root must exist/,
      );
    });
  });

  test("refuses unsafe run slugs before constructing artifact paths", async () => {
    await withTempDir(async (outputRoot) => {
      await assert.rejects(
        () => writeRunArtifactManifest({
          bundle: makeValidBundle(),
          outputRoot,
          runSlug: "../escape",
          mode: "model",
        }),
        /run slug/,
      );
    });
  });

  test("refuses to overwrite existing manifest artifacts unless explicitly allowed", async () => {
    await withTempDir(async (outputRoot) => {
      await writeRunArtifactManifest({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "same-run",
        mode: "model",
      });

      await assert.rejects(
        () => writeRunArtifactManifest({
          bundle: makeValidBundle(),
          outputRoot,
          runSlug: "same-run",
          mode: "model",
        }),
        /already exists/,
      );

      const result = await writeRunArtifactManifest({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "same-run",
        mode: "model",
        allowOverwrite: true,
      });
      assert.equal(result.manifest.run_slug, "same-run");
    });
  });

  test("refuses writes in safe modes", async () => {
    await withTempDir(async (outputRoot) => {
      await assert.rejects(
        () => writeRunArtifactManifest({
          bundle: makeValidBundle(),
          outputRoot,
          runSlug: "fixture-mode",
          mode: "fixture",
        }),
        /production writes are forbidden/,
      );
    });
  });

  test("records failing quality gate status in the manifest while still writing artifacts", async () => {
    await withTempDir(async (outputRoot) => {
      const bundle = {
        sources: [],
        excerpts: [],
        claims: [],
        claim_evidence: [],
        account_objects: [],
        account_object_claims: [],
        research_runs: [],
        run_artifacts: [],
        audit_events: [],
      };

      const result = await writeRunArtifactManifest({
        bundle,
        outputRoot,
        runSlug: "zero-output",
        mode: "model",
      });

      assert.equal(result.qualityGateReport.status, "fail");
      assert.equal(result.manifest.quality_gate.status, "fail");
      assert.equal(result.manifest.quality_gate.ok, false);
      assert.deepEqual(
        result.manifest.quality_gate.reason_codes,
        ["zero_output_incident"],
      );
    });
  });

  test("does not leave partial manifest package when a later artifact path is already blocked", async () => {
    await withTempDir(async (outputRoot) => {
      const runDir = join(outputRoot, "blocked-run");
      await mkdir(runDir);
      await writeFile(join(runDir, "quality-gate-report.json"), "existing\n");

      await assert.rejects(
        () => writeRunArtifactManifest({
          bundle: makeValidBundle(),
          outputRoot,
          runSlug: "blocked-run",
          mode: "model",
        }),
        /already exists/,
      );

      await assert.rejects(() => readFile(join(runDir, "graph-bundle.json"), "utf8"), /ENOENT/);
      await assert.rejects(() => readFile(join(runDir, "manifest.json"), "utf8"), /ENOENT/);
    });
  });
});
