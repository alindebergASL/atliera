import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { createAgentRunRecord, type AgentRunRecord, type AgentRunRecordInput } from "../../src/agent/run-record.ts";
import type { ModelProviderValidationReport } from "../../src/model/provider-validation.ts";
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

function modelProviderValidationReport(overrides: Partial<ModelProviderValidationReport> = {}): ModelProviderValidationReport {
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
      provider: "anthropic",
      model: "claude-validation-model",
      operation: "graph.propose",
      idempotency_key: "idem_manifest_validation_1",
    },
    cost_ledger_entry: {
      schema_version: "atliera.model_cost_ledger_entry.v1",
      ledger_entry_id: "ledger_entry_manifest_validation_1",
      approval_id: "approval_manifest_validation_1",
      run_id: "run_manifest_validation_1",
      provider: "anthropic",
      model: "claude-validation-model",
      account_ref: "account_manifest_validation",
      stage: "first_validation",
      input_tokens: 120,
      output_tokens: 34,
      estimated_cost_usd: 0.02,
      observed_cost_usd: 0.011,
      status: "succeeded",
      retry_count: 0,
      error: null,
      recorded_at: "2026-05-23T00:00:01.000Z",
    },
    ...overrides,
  };
}

function agentRunRecord(overrides: Partial<AgentRunRecordInput> = {}): AgentRunRecord {
  return createAgentRunRecord({
    id: "agn_model_validation_1",
    researchRunId: "run_manifest_validation_1",
    operation: "graph.propose",
    mode: "model",
    status: "succeeded",
    inputGraphRef: "fixtures/graph/valid/minimal-pass.json",
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:01.000Z",
    artifacts: [
      {
        role: "input_graph",
        runArtifactId: "art_model_validation_input",
        ref: "model-validation-run/graph-bundle.json",
      },
      {
        role: "quality_gate_report",
        runArtifactId: "art_model_validation_quality_gate",
        ref: "model-validation-run/quality-gate-report.json",
      },
      {
        role: "run_manifest",
        runArtifactId: "art_model_validation_manifest",
        ref: "model-validation-run/manifest.json",
      },
    ],
    metadata: { phase: "provider-validation-pipeline" },
    ...overrides,
  });
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

  test("writes model-provider validation evidence and summarizes cost ledger fields", async () => {
    await withTempDir(async (outputRoot) => {
      const report = modelProviderValidationReport();
      const result = await writeRunArtifactManifest({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "model-validation-run",
        mode: "model",
        modelProviderValidationReport: report,
      });

      assert.ok(result.model_provider_validation_report_path?.endsWith("model-validation-run/model-provider-validation-report.json"));
      assert.equal(result.manifest.artifacts.length, 3);
      assert.deepEqual(
        result.manifest.artifacts.map((artifact) => artifact.artifact_type).sort(),
        ["graph_bundle", "model_provider_validation_report", "quality_gate_report"],
      );
      const providerArtifact = result.manifest.artifacts.find(
        (artifact) => artifact.artifact_type === "model_provider_validation_report",
      );
      assert.equal(providerArtifact?.path, "model-validation-run/model-provider-validation-report.json");
      assert.deepEqual(result.manifest.model_run, {
        provider: "anthropic",
        model: "claude-validation-model",
        started_at: null,
        completed_at: "2026-05-23T00:00:01.000Z",
        operation: "graph.propose",
        idempotency_key: "idem_manifest_validation_1",
        status: "succeeded",
      });
      assert.deepEqual(result.manifest.cost_ledger, {
        currency: "USD",
        total_cost: 0.011,
        estimated_cost: 0.02,
        input_tokens: 120,
        output_tokens: 34,
        status: "succeeded",
        error: null,
      });
      assert.deepEqual(result.manifest.adapter_records, [
        {
          adapter: "model_provider",
          provider: "anthropic",
          model: "claude-validation-model",
          request_id: "idem_manifest_validation_1",
          status: "success",
          started_at: null,
          completed_at: "2026-05-23T00:00:01.000Z",
        },
      ]);

      const savedProviderReport = await readJson(result.model_provider_validation_report_path!);
      const savedManifest = await readJson(result.manifest_path) as RunArtifactManifest;
      assert.deepEqual(savedProviderReport, report);
      assert.deepEqual(savedManifest, result.manifest);
      assert.equal(savedManifest.artifacts.some((artifact) => artifact.path.startsWith(outputRoot)), false);
    });
  });

  test("persists AgentRun linkage with provider validation, graph validation, quality gate, and artifacts", async () => {
    await withTempDir(async (outputRoot) => {
      const report = modelProviderValidationReport();
      const agentRun = agentRunRecord();
      const result = await writeRunArtifactManifest({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "model-validation-run",
        mode: "model",
        modelProviderValidationReport: report,
        agentRunRecord: agentRun,
      });

      assert.ok(result.agent_run_record_path?.endsWith("model-validation-run/agent-run-record.json"));
      assert.equal(result.manifest.quality_gate.status, "pass");
      assert.equal(result.manifest.quality_gate.ok, true);
      assert.equal(result.manifest.quality_gate.metrics.hard_failures, 0);
      assert.deepEqual(
        result.manifest.artifacts.map((artifact) => artifact.artifact_type).sort(),
        ["agent_run_record", "graph_bundle", "model_provider_validation_report", "quality_gate_report"],
      );
      assert.deepEqual(result.manifest.agent_run, {
        id: "agn_model_validation_1",
        status: "succeeded",
        operation: "graph.propose",
        input_graph_ref: "fixtures/graph/valid/minimal-pass.json",
        record_path: "model-validation-run/agent-run-record.json",
      });

      const savedAgentRun = await readJson(result.agent_run_record_path!);
      const savedManifest = await readJson(result.manifest_path) as RunArtifactManifest;
      assert.deepEqual(savedAgentRun, agentRun);
      assert.deepEqual(savedManifest.agent_run, result.manifest.agent_run);
      assert.equal(savedManifest.artifacts.some((artifact) => artifact.path.startsWith(outputRoot)), false);
    });
  });

  test("does not advertise optional validation artifacts when untyped callers pass null", async () => {
    await withTempDir(async (outputRoot) => {
      const unsafeWriter = writeRunArtifactManifest as unknown as (options: Record<string, unknown>) => ReturnType<typeof writeRunArtifactManifest>;
      const result = await unsafeWriter({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "null-optionals",
        mode: "model",
        modelProviderValidationReport: null,
        agentRunRecord: null,
      });

      assert.equal(result.model_provider_validation_report_path, undefined);
      assert.equal(result.agent_run_record_path, undefined);
      assert.deepEqual(
        result.manifest.artifacts.map((artifact) => artifact.artifact_type).sort(),
        ["graph_bundle", "quality_gate_report"],
      );
      assert.equal(result.manifest.agent_run, null);
      await assert.rejects(() => readFile(join(outputRoot, "null-optionals", "model-provider-validation-report.json"), "utf8"), /ENOENT/);
      await assert.rejects(() => readFile(join(outputRoot, "null-optionals", "agent-run-record.json"), "utf8"), /ENOENT/);
    });
  });

  test("rejects malformed non-null optional validation artifacts from untyped callers", async () => {
    await withTempDir(async (outputRoot) => {
      const unsafeWriter = writeRunArtifactManifest as unknown as (options: Record<string, unknown>) => ReturnType<typeof writeRunArtifactManifest>;
      await assert.rejects(
        () => unsafeWriter({
          bundle: makeValidBundle(),
          outputRoot,
          runSlug: "malformed-provider-report",
          mode: "model",
          modelProviderValidationReport: false,
        }),
        /model provider validation report rejected/,
      );
      await assert.rejects(
        () => unsafeWriter({
          bundle: makeValidBundle(),
          outputRoot,
          runSlug: "malformed-agent-run",
          mode: "model",
          agentRunRecord: 0,
        }),
        /agent run record rejected/,
      );
      await assert.rejects(() => readFile(join(outputRoot, "malformed-provider-report", "manifest.json"), "utf8"), /ENOENT/);
      await assert.rejects(() => readFile(join(outputRoot, "malformed-agent-run", "manifest.json"), "utf8"), /ENOENT/);
    });
  });

  test("records refused model validation evidence without pretending a provider call succeeded", async () => {
    await withTempDir(async (outputRoot) => {
      const refusedReport = modelProviderValidationReport({
        ok: false,
        checks: [
          { name: "activation_gates", ok: false, codes: ["cumulative_budget_exceeded"] },
          { name: "cost_ledger_entry", ok: true, codes: [] },
        ],
        cost_ledger_entry: {
          ...modelProviderValidationReport().cost_ledger_entry!,
          input_tokens: 0,
          output_tokens: 0,
          estimated_cost_usd: 0,
          observed_cost_usd: 0,
          status: "refused",
          error: "activation_refused",
        },
      });

      const result = await writeRunArtifactManifest({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "model-validation-refused",
        mode: "model",
        modelProviderValidationReport: refusedReport,
      });

      assert.equal(result.manifest.model_run.status, "refused");
      assert.equal(result.manifest.cost_ledger.status, "refused");
      assert.equal(result.manifest.cost_ledger.total_cost, 0);
      assert.equal(result.manifest.cost_ledger.error, "activation_refused");
      assert.deepEqual(result.manifest.adapter_records, [
        {
          adapter: "model_provider",
          provider: "anthropic",
          model: "claude-validation-model",
          request_id: "idem_manifest_validation_1",
          status: "error",
          started_at: null,
          completed_at: "2026-05-23T00:00:01.000Z",
        },
      ]);
    });
  });

  test("treats estimated or inconsistent validation ledger status as non-success in manifest summaries", async () => {
    await withTempDir(async (outputRoot) => {
      const estimatedReport = modelProviderValidationReport({
        ok: true,
        cost_ledger_entry: {
          ...modelProviderValidationReport().cost_ledger_entry!,
          status: "estimated",
          observed_cost_usd: 0,
          error: null,
        },
      });

      const result = await writeRunArtifactManifest({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "model-validation-estimated",
        mode: "model",
        modelProviderValidationReport: estimatedReport,
      });

      assert.equal(result.manifest.model_run.status, "failed");
      assert.equal(result.manifest.cost_ledger.status, "estimated");
      assert.equal(result.manifest.adapter_records[0]?.status, "error");
    });
  });

  test("snapshots provider validation reports before manifest summaries and persisted evidence", async () => {
    await withTempDir(async (outputRoot) => {
      const safeReport = modelProviderValidationReport();
      const unsafeReport = modelProviderValidationReport({
        call: {
          provider: "anthropic",
          model: "claude-validation-model",
          operation: "graph.propose",
          idempotency_key: "idem_secret_after_validation",
        },
        cost_ledger_entry: {
          ...modelProviderValidationReport().cost_ledger_entry!,
          input_tokens: 999999,
          output_tokens: 999999,
          observed_cost_usd: 999999,
          status: "failed",
          error: "leaked-after-validation",
        },
      });
      let callReads = 0;
      let ledgerReads = 0;
      const report = {
        ok: true,
        checks: safeReport.checks,
        get call() {
          callReads += 1;
          return callReads === 1 ? safeReport.call : unsafeReport.call;
        },
        get cost_ledger_entry() {
          ledgerReads += 1;
          return ledgerReads === 1 ? safeReport.cost_ledger_entry : unsafeReport.cost_ledger_entry;
        },
      } as unknown as ModelProviderValidationReport;

      const result = await writeRunArtifactManifest({
        bundle: makeValidBundle(),
        outputRoot,
        runSlug: "model-validation-snapshot",
        mode: "model",
        modelProviderValidationReport: report,
      });

      assert.deepEqual(result.manifest.model_run, {
        provider: "anthropic",
        model: "claude-validation-model",
        started_at: null,
        completed_at: "2026-05-23T00:00:01.000Z",
        operation: "graph.propose",
        idempotency_key: "idem_manifest_validation_1",
        status: "succeeded",
      });
      assert.deepEqual(result.manifest.cost_ledger, {
        currency: "USD",
        total_cost: 0.011,
        estimated_cost: 0.02,
        input_tokens: 120,
        output_tokens: 34,
        status: "succeeded",
        error: null,
      });
      assert.equal(result.manifest.adapter_records[0]?.request_id, "idem_manifest_validation_1");
      assert.equal(result.manifest.adapter_records[0]?.status, "success");
      assert.equal(callReads, 1);
      assert.equal(ledgerReads, 1);

      const savedProviderReport = await readJson(result.model_provider_validation_report_path!);
      assert.deepEqual(savedProviderReport, safeReport);
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
