import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-full-pipeline-validation-cli-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/full-pipeline-validation.ts", ...args], {
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

function providerValidationReport(): unknown {
  return {
    ok: true,
    checks: [
      { name: "activation_gates", ok: true, codes: [] },
      { name: "credential_status", ok: true, codes: [] },
      { name: "provider_call", ok: true, codes: [] },
      { name: "response_contract", ok: true, codes: [] },
      { name: "cost_ledger_entry", ok: true, codes: [] },
    ],
    call: {
      provider: "openrouter",
      model: "owl-alpha",
      operation: "graph.propose",
      idempotency_key: "idem_full_pipeline_cli_1",
    },
    cost_ledger_entry: {
      schema_version: "atliera.model_cost_ledger_entry.v1",
      ledger_entry_id: "ledger_entry_full_pipeline_cli_1",
      approval_id: "approval_full_pipeline_cli_1",
      run_id: "run_full_pipeline_cli_1",
      provider: "openrouter",
      model: "owl-alpha",
      account_ref: "account_full_pipeline_cli",
      stage: "first_validation",
      input_tokens: 7,
      output_tokens: 5,
      estimated_cost_usd: 0,
      observed_cost_usd: 0,
      status: "succeeded",
      retry_count: 0,
      error: null,
      recorded_at: "2026-05-27T16:46:01.000Z",
    },
  };
}

describe("full-pipeline-validation CLI", () => {
  test("packages a deterministic full-pipeline validation run without live provider access", async () => {
    await withTempDir(async (dir) => {
      const outputRoot = join(dir, "out");
      await writeFile(join(dir, "provider-report.json"), JSON.stringify(providerValidationReport(), null, 2) + "\n");
      await import("node:fs/promises").then(({ mkdir }) => mkdir(outputRoot));

      const result = await runCli([
        "package",
        "fixtures/graph/valid/minimal-pass.json",
        "--provider-report",
        join(dir, "provider-report.json"),
        "--out-root",
        outputRoot,
        "--run-slug",
        "full-pipeline-cli",
        "--now",
        "2026-05-27T16:46:02.000Z",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.command, "package");
      assert.equal(payload.summary.ok, true);
      assert.equal(payload.summary.safety.live_provider_call, false);
      assert.equal(payload.summary.safety.credentials_read, false);
      assert.equal(payload.summary.provider_validation.provider, "openrouter");
      assert.equal(payload.summary.quality_gate.status, "pass");
      assert.equal(payload.summary.artifacts.manifest_path, "full-pipeline-cli/manifest.json");
      assert.equal(payload.manifest_path, "full-pipeline-cli/manifest.json");
      assert.equal(payload.graph_bundle_path, "full-pipeline-cli/graph-bundle.json");
      assert.equal(payload.quality_gate_report_path, "full-pipeline-cli/quality-gate-report.json");

      const savedManifest = JSON.parse(await readFile(join(outputRoot, payload.manifest_path), "utf8"));
      assert.equal(savedManifest.agent_run.record_path, "full-pipeline-cli/agent-run-record.json");
      assert.equal(savedManifest.artifacts.some((artifact: { path: string }) => artifact.path.startsWith(outputRoot)), false);
    });
  });

  test("requires provider report, out root, run slug, and timestamp flags", async () => {
    const result = await runCli(["package", "fixtures/graph/valid/minimal-pass.json"]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /usage:/);
  });
});
