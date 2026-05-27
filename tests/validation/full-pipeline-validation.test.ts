import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import type { ModelProviderValidationReport } from "../../src/model/provider-validation.ts";
import { runFullPipelineValidationPackage } from "../../src/validation/full-pipeline.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-full-pipeline-validation-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

function providerValidationReport(
  overrides: Partial<ModelProviderValidationReport> = {},
): ModelProviderValidationReport {
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
      idempotency_key: "idem_full_pipeline_validation_1",
    },
    cost_ledger_entry: {
      schema_version: "atliera.model_cost_ledger_entry.v1",
      ledger_entry_id: "ledger_entry_full_pipeline_validation_1",
      approval_id: "approval_full_pipeline_validation_1",
      run_id: "run_full_pipeline_validation_1",
      provider: "openrouter",
      model: "owl-alpha",
      account_ref: "account_full_pipeline_validation",
      stage: "first_validation",
      input_tokens: 7,
      output_tokens: 5,
      estimated_cost_usd: 0,
      observed_cost_usd: 0,
      status: "succeeded",
      retry_count: 0,
      error: null,
      recorded_at: "2026-05-27T16:45:01.000Z",
    },
    ...overrides,
  };
}

describe("runFullPipelineValidationPackage", () => {
  test("packages sanitized provider evidence through AgentRun, graph validation, quality gate, and manifest artifacts", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runFullPipelineValidationPackage({
        bundle: makeValidBundle(),
        modelProviderValidationReport: providerValidationReport(),
        outputRoot,
        runSlug: "full-pipeline-run",
        inputPath: "fixtures/graph/valid/minimal-pass.json",
        now: "2026-05-27T16:45:02.000Z",
      });

      assert.equal(result.summary.schema_version, "atliera.full_pipeline_validation.v1");
      assert.equal(result.summary.ok, true);
      assert.equal(result.summary.provider_validation.ok, true);
      assert.deepEqual(result.summary.provider_validation, {
        ok: true,
        provider: "openrouter",
        model: "owl-alpha",
        operation: "graph.propose",
        idempotency_key: "idem_full_pipeline_validation_1",
        cost_ledger_status: "succeeded",
        observed_cost_usd: 0,
        check_failures: [],
      });
      assert.deepEqual(result.summary.agent_run, {
        id: "agn_full-pipeline-run",
        status: "succeeded",
        record_path: "full-pipeline-run/agent-run-record.json",
      });
      assert.deepEqual(result.summary.graph_validation, {
        ok: true,
        hard_failures: 0,
      });
      assert.deepEqual(result.summary.quality_gate, {
        ok: true,
        status: "pass",
        reason_codes: [],
      });
      assert.equal(result.summary.artifacts.manifest_path, "full-pipeline-run/manifest.json");
      assert.equal(result.summary.artifacts.graph_bundle_path, "full-pipeline-run/graph-bundle.json");
      assert.equal(result.summary.artifacts.quality_gate_report_path, "full-pipeline-run/quality-gate-report.json");
      assert.equal(
        result.summary.artifacts.model_provider_validation_report_path,
        "full-pipeline-run/model-provider-validation-report.json",
      );
      assert.equal(result.summary.artifacts.agent_run_record_path, "full-pipeline-run/agent-run-record.json");
      assert.equal(result.summary.safety.live_provider_call, false);
      assert.equal(result.summary.safety.network, false);
      assert.equal(result.summary.safety.credentials_read, false);

      assert.equal(result.manifest.quality_gate.status, "pass");
      assert.equal(result.manifest.created_at, "2026-05-27T16:45:02.000Z");
      assert.deepEqual(
        result.manifest.artifacts.map((artifact) => artifact.created_at),
        [
          "2026-05-27T16:45:02.000Z",
          "2026-05-27T16:45:02.000Z",
          "2026-05-27T16:45:02.000Z",
          "2026-05-27T16:45:02.000Z",
        ],
      );
      assert.equal(result.manifest.model_run.provider, "openrouter");
      assert.equal(result.manifest.agent_run?.record_path, "full-pipeline-run/agent-run-record.json");
      assert.equal(result.manifest.artifacts.some((artifact) => artifact.path.startsWith(outputRoot)), false);

      const savedManifest = await readJson(result.artifacts.manifest_path);
      const savedAgentRun = await readJson(result.artifacts.agent_run_record_path);
      const savedProviderReport = await readJson(result.artifacts.model_provider_validation_report_path);
      assert.deepEqual(savedManifest, result.manifest);
      assert.deepEqual(savedAgentRun, result.agentRunRecord);
      assert.deepEqual(savedProviderReport, providerValidationReport());
    });
  });

  test("fails closed when provider evidence did not produce a successful cost ledger entry", async () => {
    await withTempDir(async (outputRoot) => {
      await assert.rejects(
        () => runFullPipelineValidationPackage({
          bundle: makeValidBundle(),
          modelProviderValidationReport: providerValidationReport({
            ok: true,
            cost_ledger_entry: {
              ...providerValidationReport().cost_ledger_entry!,
              status: "estimated",
              observed_cost_usd: 0,
            },
          }),
          outputRoot,
          runSlug: "estimated-provider-evidence",
          inputPath: "fixtures/graph/valid/minimal-pass.json",
          now: "2026-05-27T16:45:02.000Z",
        }),
        /full pipeline provider evidence must have succeeded cost ledger status/,
      );
    });
  });

  test("rejects incomplete, inconsistent, or unsanitized provider evidence before writing artifacts", async () => {
    await withTempDir(async (outputRoot) => {
      await assert.rejects(
        () => runFullPipelineValidationPackage({
          bundle: makeValidBundle(),
          modelProviderValidationReport: providerValidationReport({ checks: [] }),
          outputRoot,
          runSlug: "missing-provider-checks",
          inputPath: "fixtures/graph/valid/minimal-pass.json",
          now: "2026-05-27T16:45:02.000Z",
        }),
        /full pipeline provider evidence must include passed validation checks/,
      );

      await assert.rejects(
        () => runFullPipelineValidationPackage({
          bundle: makeValidBundle(),
          modelProviderValidationReport: providerValidationReport({
            cost_ledger_entry: {
              ...providerValidationReport().cost_ledger_entry!,
              provider: "different-provider",
            },
          }),
          outputRoot,
          runSlug: "mismatched-ledger",
          inputPath: "fixtures/graph/valid/minimal-pass.json",
          now: "2026-05-27T16:45:02.000Z",
        }),
        /full pipeline provider evidence call and ledger fields must match/,
      );

      await assert.rejects(
        () => runFullPipelineValidationPackage({
          bundle: makeValidBundle(),
          modelProviderValidationReport: providerValidationReport({
            cost_ledger_entry: {
              ...providerValidationReport().cost_ledger_entry!,
              error: "raw provider body with secret token",
            },
          }),
          outputRoot,
          runSlug: "unsanitized-ledger-error",
          inputPath: "fixtures/graph/valid/minimal-pass.json",
          now: "2026-05-27T16:45:02.000Z",
        }),
        /full pipeline succeeded provider evidence must not carry an error string/,
      );

      await assert.rejects(() => readFile(join(outputRoot, "missing-provider-checks", "manifest.json"), "utf8"), /ENOENT/);
      await assert.rejects(() => readFile(join(outputRoot, "mismatched-ledger", "manifest.json"), "utf8"), /ENOENT/);
      await assert.rejects(() => readFile(join(outputRoot, "unsanitized-ledger-error", "manifest.json"), "utf8"), /ENOENT/);
    });
  });
});
