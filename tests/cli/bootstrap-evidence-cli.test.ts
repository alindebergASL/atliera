import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-bootstrap-evidence-cli-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runNpmScript(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "--silent", "validation:bootstrap-evidence", "--", ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function summaryText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ok: true,
    command: "package",
    manifest_path: "run/manifest.json",
    graph_bundle_path: "run/graph-bundle.json",
    quality_gate_report_path: "run/quality-gate-report.json",
    model_provider_validation_report_path: "run/model-provider-validation-report.json",
    agent_run_record_path: "run/agent-run-record.json",
    summary: {
      schema_version: "atliera.full_pipeline_validation.v1",
      ok: true,
      run_slug: "run",
      provider_validation: {
        ok: true,
        provider: "openrouter",
        model: "owl-alpha",
        operation: "graph.propose",
        idempotency_key: "run_owl_alpha_current_1779903845560_1",
        cost_ledger_status: "succeeded",
        check_failures: [],
      },
      quality_gate: { ok: true, status: "pass", reason_codes: [] },
      artifacts: {
        manifest_path: "run/manifest.json",
        graph_bundle_path: "run/graph-bundle.json",
        quality_gate_report_path: "run/quality-gate-report.json",
        model_provider_validation_report_path: "run/model-provider-validation-report.json",
        agent_run_record_path: "run/agent-run-record.json",
      },
      safety: { live_provider_call: false, network: false, credentials_read: false },
    },
    ...overrides,
  }, null, 2) + "\n";
}

function manifestText(): string {
  return JSON.stringify({
    schema_version: "atliera.run_manifest.v1",
    run_slug: "run",
    created_at: "2026-05-27T17:45:05.559Z",
    artifacts: [
      { artifact_type: "graph_bundle", path: "run/graph-bundle.json" },
      { artifact_type: "quality_gate_report", path: "run/quality-gate-report.json" },
      { artifact_type: "model_provider_validation_report", path: "run/model-provider-validation-report.json" },
      { artifact_type: "agent_run_record", path: "run/agent-run-record.json" },
    ],
    quality_gate: { ok: true, status: "pass", reason_codes: [] },
    model_run: {
      provider: "openrouter",
      model: "owl-alpha",
      operation: "graph.propose",
      idempotency_key: "run_owl_alpha_current_1779903845560_1",
      status: "succeeded",
    },
    cost_ledger: { status: "succeeded", total_cost: 0, estimated_cost: 0, input_tokens: 1, output_tokens: 1 },
    agent_run: { id: "agn_run", status: "succeeded", record_path: "run/agent-run-record.json" },
  }, null, 2) + "\n";
}

describe("bootstrap evidence CLI", () => {
  test("verifies a completed clean-host bootstrap package through the npm script", async () => {
    await withTempDir(async (dir) => {
      const summaryPath = join(dir, "summary.json");
      const rerunSummaryPath = join(dir, "summary-rerun.json");
      const manifestPath = join(dir, "manifest.json");
      const manifest = manifestText();
      await writeFile(summaryPath, summaryText());
      await writeFile(rerunSummaryPath, summaryText());
      await writeFile(manifestPath, manifest);

      const result = await runNpmScript([
        "verify",
        "--summary",
        summaryPath,
        "--rerun-summary",
        rerunSummaryPath,
        "--manifest",
        manifestPath,
        "--checkout-commit",
        "f862bbf",
        "--expected-hash",
        sha256(manifest),
        "--npm-ci",
        "passed",
        "--npm-run-ci",
        "passed",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "verify");
      assert.equal(payload.evidence.schema_version, "atliera.bootstrap_validation_evidence.v1");
      assert.equal(payload.evidence.full_pipeline.deterministic, true);
      assert.equal(payload.evidence.readiness_claim, false);
      assert.doesNotMatch(result.stdout, /\/home\//i);
      assert.doesNotMatch(result.stdout, /\b(?:\d{1,3}\.){3}\d{1,3}\b/i);
      assert.doesNotMatch(result.stdout, /lab\d*\.atliera\.com/i);
    });
  });

  test("requires explicit evidence and refuses failed bootstrap commands", async () => {
    const missing = await runNpmScript(["verify"]);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /usage:/);

    await withTempDir(async (dir) => {
      const summaryPath = join(dir, "summary.json");
      const rerunSummaryPath = join(dir, "summary-rerun.json");
      const manifestPath = join(dir, "manifest.json");
      const manifest = manifestText();
      await writeFile(summaryPath, summaryText());
      await writeFile(rerunSummaryPath, summaryText());
      await writeFile(manifestPath, manifest);

      const failedCi = await runNpmScript([
        "verify",
        "--summary",
        summaryPath,
        "--rerun-summary",
        rerunSummaryPath,
        "--manifest",
        manifestPath,
        "--checkout-commit",
        "f862bbf",
        "--expected-hash",
        sha256(manifest),
        "--npm-ci",
        "failed",
        "--npm-run-ci",
        "passed",
      ]);

      assert.equal(failedCi.code, 2);
      assert.match(failedCi.stderr, /bootstrap command statuses must be passed/);
      await assert.rejects(() => readFile(join(dir, "unused-output.json"), "utf8"), /ENOENT/);
    });
  });
});
