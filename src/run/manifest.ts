// Local run artifact manifest writer.
//
// Phase 1.5 packages a local GraphBundle, its per-bundle quality-gate
// report, and a small manifest into one explicit output-root directory.
// This remains a deterministic local file utility: no provider calls, no
// network, no database, and no app/runtime persistence.

import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { createAgentRunRecord, type AgentRunRecord } from "../agent/run-record.ts";
import { runQualityGate, type QualityGateReport } from "../gate/quality-gate.ts";
import { saveGraphBundleFile } from "../graph/file-store.ts";
import type { GraphBundle } from "../graph/types.ts";
import { guardOutputPath, type GuardedOutputPath } from "../io/path-guard.ts";
import type { ModelCostLedgerStatus } from "../model/activation-gates.ts";
import type { ModelProviderValidationReport } from "../model/provider-validation.ts";
import { assertProductionWriteAllowed, type RuntimeMode } from "../modes/index.ts";

export const RUN_ARTIFACT_MANIFEST_SCHEMA_VERSION = "atliera.run_manifest.v1" as const;

export type RunArtifactManifestArtifactType =
  | "graph_bundle"
  | "quality_gate_report"
  | "model_provider_validation_report"
  | "agent_run_record";

export interface RunArtifactManifestArtifact {
  artifact_type: RunArtifactManifestArtifactType;
  path: string;
  content_type: "application/json";
  created_at: string;
}

export interface RunArtifactManifestQualityGateSummary {
  ok: boolean;
  status: QualityGateReport["status"];
  reason_codes: string[];
  metrics: QualityGateReport["metrics"];
}

export interface RunArtifactManifestModelRunPlaceholder {
  provider: string | null;
  model: string | null;
  started_at: string | null;
  completed_at: string | null;
  operation?: string;
  idempotency_key?: string;
  status?: "succeeded" | "failed" | "refused";
}

export interface RunArtifactManifestCostLedgerPlaceholder {
  currency: string | null;
  total_cost: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost?: number;
  status?: "estimated" | "succeeded" | "failed" | "refused";
  error?: string | null;
}

export interface RunArtifactManifestAdapterRecord {
  adapter: string;
  provider: string | null;
  model: string | null;
  request_id: string | null;
  status: "pending" | "success" | "error";
  started_at: string | null;
  completed_at: string | null;
}

export interface RunArtifactManifestAgentRunSummary {
  id: string;
  status: AgentRunRecord["status"];
  operation: AgentRunRecord["operation"];
  input_graph_ref: string;
  record_path: string;
}

export interface RunArtifactManifest {
  schema_version: typeof RUN_ARTIFACT_MANIFEST_SCHEMA_VERSION;
  run_slug: string;
  mode: RuntimeMode;
  input_path: string | null;
  created_at: string;
  artifacts: RunArtifactManifestArtifact[];
  quality_gate: RunArtifactManifestQualityGateSummary;
  model_run: RunArtifactManifestModelRunPlaceholder;
  cost_ledger: RunArtifactManifestCostLedgerPlaceholder;
  adapter_records: RunArtifactManifestAdapterRecord[];
  agent_run: RunArtifactManifestAgentRunSummary | null;
}

export interface WriteRunArtifactManifestOptions {
  bundle: GraphBundle;
  outputRoot: string;
  runSlug: string;
  mode: RuntimeMode;
  inputPath?: string | null;
  allowOverwrite?: boolean;
  createdAt?: string;
  modelProviderValidationReport?: ModelProviderValidationReport;
  agentRunRecord?: AgentRunRecord;
}

export interface WriteRunArtifactManifestResult {
  manifest: RunArtifactManifest;
  qualityGateReport: QualityGateReport;
  manifest_path: string;
  graph_bundle_path: string;
  quality_gate_report_path: string;
  model_provider_validation_report_path?: string;
  agent_run_record_path?: string;
}

const SAFE_RUN_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

function assertSafeRunSlug(runSlug: string): void {
  if (!SAFE_RUN_SLUG.test(runSlug) || runSlug.includes("..")) {
    throw new Error(
      "run slug must be 1-128 characters of letters, numbers, dot, underscore, or dash, must not contain '..', and must start with a letter or number",
    );
  }
}

function relativeArtifactPath(outputRoot: string, path: string): string {
  return relative(resolve(outputRoot), path).split("\\").join("/");
}

async function writeGuardedJsonFile(options: {
  outputRoot: string;
  targetPath: string;
  value: unknown;
  allowOverwrite?: boolean;
}): Promise<void> {
  const guarded = await guardOutputPath({
    outputRoot: options.outputRoot,
    targetPath: options.targetPath,
    allowOverwrite: options.allowOverwrite,
    repoRoot: process.cwd(),
  });
  const content = JSON.stringify(options.value, null, 2) + "\n";

  if (!options.allowOverwrite) {
    await writeFile(guarded.targetPath, content, {
      encoding: "utf8",
      flag: "wx",
    });
    return;
  }

  const tempPath = `${guarded.targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, content, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(tempPath, guarded.targetPath);
  } catch (e) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw e;
  }
}

async function preflightGuardedOutputs(options: {
  outputRoot: string;
  runSlug: string;
  allowOverwrite?: boolean;
  includeModelProviderValidationReport?: boolean;
  includeAgentRunRecord?: boolean;
}): Promise<{
  graphBundle: GuardedOutputPath;
  qualityGateReport: GuardedOutputPath;
  manifest: GuardedOutputPath;
  modelProviderValidationReport?: GuardedOutputPath;
  agentRunRecord?: GuardedOutputPath;
}> {
  const runDir = resolve(options.outputRoot, options.runSlug);
  const common = {
    outputRoot: options.outputRoot,
    allowOverwrite: options.allowOverwrite,
    repoRoot: process.cwd(),
  };

  const graphBundle = await guardOutputPath({
    ...common,
    targetPath: resolve(runDir, "graph-bundle.json"),
  });
  const qualityGateReport = await guardOutputPath({
    ...common,
    targetPath: resolve(runDir, "quality-gate-report.json"),
  });
  const manifest = await guardOutputPath({
    ...common,
    targetPath: resolve(runDir, "manifest.json"),
  });
  let modelProviderValidationReport: GuardedOutputPath | undefined;
  if (options.includeModelProviderValidationReport) {
    modelProviderValidationReport = await guardOutputPath({
      ...common,
      targetPath: resolve(runDir, "model-provider-validation-report.json"),
    });
  }
  let agentRunRecord: GuardedOutputPath | undefined;
  if (options.includeAgentRunRecord) {
    agentRunRecord = await guardOutputPath({
      ...common,
      targetPath: resolve(runDir, "agent-run-record.json"),
    });
  }

  return { graphBundle, qualityGateReport, manifest, modelProviderValidationReport, agentRunRecord };
}

function buildManifest(options: {
  outputRoot: string;
  runSlug: string;
  mode: RuntimeMode;
  inputPath?: string | null;
  createdAt: string;
  graphBundlePath: string;
  qualityGateReportPath: string;
  modelProviderValidationReportPath?: string;
  agentRunRecordPath?: string;
  qualityGateReport: QualityGateReport;
  modelProviderValidationReport?: ModelProviderValidationReport;
  agentRunRecord?: AgentRunRecord;
}): RunArtifactManifest {
  const artifacts: RunArtifactManifestArtifact[] = [
    {
      artifact_type: "graph_bundle",
      path: relativeArtifactPath(options.outputRoot, options.graphBundlePath),
      content_type: "application/json",
      created_at: options.createdAt,
    },
    {
      artifact_type: "quality_gate_report",
      path: relativeArtifactPath(options.outputRoot, options.qualityGateReportPath),
      content_type: "application/json",
      created_at: options.createdAt,
    },
  ];
  if (options.modelProviderValidationReportPath) {
    artifacts.push({
      artifact_type: "model_provider_validation_report",
      path: relativeArtifactPath(options.outputRoot, options.modelProviderValidationReportPath),
      content_type: "application/json",
      created_at: options.createdAt,
    });
  }
  const agentRunRecordPath = options.agentRunRecordPath === undefined
    ? undefined
    : relativeArtifactPath(options.outputRoot, options.agentRunRecordPath);
  if (agentRunRecordPath) {
    artifacts.push({
      artifact_type: "agent_run_record",
      path: agentRunRecordPath,
      content_type: "application/json",
      created_at: options.createdAt,
    });
  }
  return {
    schema_version: RUN_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    run_slug: options.runSlug,
    mode: options.mode,
    input_path: options.inputPath ?? null,
    created_at: options.createdAt,
    artifacts,
    quality_gate: {
      ok: options.qualityGateReport.ok,
      status: options.qualityGateReport.status,
      reason_codes: options.qualityGateReport.reasons.map((reason) => reason.code),
      metrics: options.qualityGateReport.metrics,
    },
    model_run: modelRunSummary(options.modelProviderValidationReport),
    cost_ledger: costLedgerSummary(options.modelProviderValidationReport),
    adapter_records: adapterRecords(options.modelProviderValidationReport),
    agent_run: agentRunSummary(options.agentRunRecord, agentRunRecordPath),
  };
}

function snapshotModelProviderValidationReport(
  report: ModelProviderValidationReport | undefined,
): ModelProviderValidationReport | undefined {
  if (report == null) return undefined;
  try {
    const checks = report.checks;
    const call = report.call;
    const ledger = report.cost_ledger_entry;
    return {
      ok: report.ok,
      checks: checks.map((check) => ({
        name: check.name,
        ok: check.ok,
        codes: [...check.codes],
      })),
      call: {
        provider: call.provider,
        model: call.model,
        operation: call.operation,
        idempotency_key: call.idempotency_key,
      },
      cost_ledger_entry: ledger === null
        ? null
        : {
            schema_version: ledger.schema_version,
            ledger_entry_id: ledger.ledger_entry_id,
            approval_id: ledger.approval_id,
            run_id: ledger.run_id,
            provider: ledger.provider,
            model: ledger.model,
            account_ref: ledger.account_ref,
            stage: ledger.stage,
            input_tokens: ledger.input_tokens,
            output_tokens: ledger.output_tokens,
            estimated_cost_usd: ledger.estimated_cost_usd,
            observed_cost_usd: ledger.observed_cost_usd,
            status: ledger.status,
            retry_count: ledger.retry_count,
            error: ledger.error,
            recorded_at: ledger.recorded_at,
          },
    };
  } catch {
    throw new Error("model provider validation report rejected");
  }
}

function snapshotAgentRunRecord(record: AgentRunRecord | undefined): AgentRunRecord | undefined {
  if (record == null) return undefined;
  try {
    const artifacts = record.artifacts;
    const metadata = record.metadata;
    return createAgentRunRecord({
      id: record.id,
      researchRunId: record.research_run_id,
      operation: record.operation,
      mode: record.mode,
      status: record.status,
      inputGraphRef: record.input_graph_ref,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      queueJobId: record.queue_job_id,
      artifacts: artifacts.map((artifact) => ({
        role: artifact.role,
        runArtifactId: artifact.run_artifact_id,
        ref: artifact.ref,
      })),
      metadata: { ...metadata },
    });
  } catch {
    throw new Error("agent run record rejected");
  }
}

function modelRunSummary(report: ModelProviderValidationReport | undefined): RunArtifactManifestModelRunPlaceholder {
  if (!report) {
    return {
      provider: null,
      model: null,
      started_at: null,
      completed_at: null,
    };
  }
  const ledger = report.cost_ledger_entry;
  return {
    provider: report.call.provider,
    model: report.call.model,
    started_at: null,
    completed_at: ledger?.recorded_at ?? null,
    operation: report.call.operation,
    idempotency_key: report.call.idempotency_key,
    status: ledgerStatusToModelRunStatus(ledger?.status),
  };
}

function costLedgerSummary(report: ModelProviderValidationReport | undefined): RunArtifactManifestCostLedgerPlaceholder {
  const ledger = report?.cost_ledger_entry;
  if (!ledger) {
    return {
      currency: null,
      total_cost: null,
      input_tokens: null,
      output_tokens: null,
    };
  }
  return {
    currency: "USD",
    total_cost: ledger.observed_cost_usd,
    estimated_cost: ledger.estimated_cost_usd,
    input_tokens: ledger.input_tokens,
    output_tokens: ledger.output_tokens,
    status: ledger.status,
    error: ledger.error,
  };
}

function adapterRecords(report: ModelProviderValidationReport | undefined): RunArtifactManifestAdapterRecord[] {
  if (!report) return [];
  const ledger = report.cost_ledger_entry;
  const modelRunStatus = ledgerStatusToModelRunStatus(ledger?.status);
  return [
    {
      adapter: "model_provider",
      provider: report.call.provider,
      model: report.call.model,
      request_id: report.call.idempotency_key,
      status: modelRunStatus === "succeeded" ? "success" : "error",
      started_at: null,
      completed_at: ledger?.recorded_at ?? null,
    },
  ];
}

function agentRunSummary(
  record: AgentRunRecord | undefined,
  recordPath: string | undefined,
): RunArtifactManifestAgentRunSummary | null {
  if (!record || !recordPath) return null;
  return {
    id: record.id,
    status: record.status,
    operation: record.operation,
    input_graph_ref: record.input_graph_ref,
    record_path: recordPath,
  };
}

function ledgerStatusToModelRunStatus(status: ModelCostLedgerStatus | undefined): "succeeded" | "failed" | "refused" {
  if (status === "refused") return "refused";
  if (status === "succeeded") return "succeeded";
  return "failed";
}

export async function writeRunArtifactManifest(
  options: WriteRunArtifactManifestOptions,
): Promise<WriteRunArtifactManifestResult> {
  assertProductionWriteAllowed(options.mode, "run-artifact-manifest");
  assertSafeRunSlug(options.runSlug);

  const modelProviderValidationReport = snapshotModelProviderValidationReport(
    options.modelProviderValidationReport,
  );
  const agentRunRecord = snapshotAgentRunRecord(options.agentRunRecord);
  const guarded = await preflightGuardedOutputs({
    outputRoot: options.outputRoot,
    runSlug: options.runSlug,
    allowOverwrite: options.allowOverwrite,
    includeModelProviderValidationReport: modelProviderValidationReport !== undefined,
    includeAgentRunRecord: agentRunRecord !== undefined,
  });

  const qualityGateReport = runQualityGate(options.bundle);
  const createdAt = options.createdAt ?? new Date().toISOString();
  const manifest = buildManifest({
    outputRoot: options.outputRoot,
    runSlug: options.runSlug,
    mode: options.mode,
    inputPath: options.inputPath,
    createdAt,
    graphBundlePath: guarded.graphBundle.targetPath,
    qualityGateReportPath: guarded.qualityGateReport.targetPath,
    modelProviderValidationReportPath: guarded.modelProviderValidationReport?.targetPath,
    agentRunRecordPath: guarded.agentRunRecord?.targetPath,
    qualityGateReport,
    modelProviderValidationReport,
    agentRunRecord,
  });

  const writtenPaths: string[] = [];
  try {
    await mkdir(guarded.graphBundle.targetDirectory, { recursive: true });
    await saveGraphBundleFile(guarded.graphBundle.targetPath, options.bundle, {
      mode: options.mode,
      outputRoot: options.outputRoot,
      allowOverwrite: options.allowOverwrite,
    });
    writtenPaths.push(guarded.graphBundle.targetPath);

    await writeGuardedJsonFile({
      outputRoot: options.outputRoot,
      targetPath: guarded.qualityGateReport.targetPath,
      value: qualityGateReport,
      allowOverwrite: options.allowOverwrite,
    });
    writtenPaths.push(guarded.qualityGateReport.targetPath);

    if (guarded.modelProviderValidationReport && modelProviderValidationReport) {
      await writeGuardedJsonFile({
        outputRoot: options.outputRoot,
        targetPath: guarded.modelProviderValidationReport.targetPath,
        value: modelProviderValidationReport,
        allowOverwrite: options.allowOverwrite,
      });
      writtenPaths.push(guarded.modelProviderValidationReport.targetPath);
    }

    if (guarded.agentRunRecord && agentRunRecord) {
      await writeGuardedJsonFile({
        outputRoot: options.outputRoot,
        targetPath: guarded.agentRunRecord.targetPath,
        value: agentRunRecord,
        allowOverwrite: options.allowOverwrite,
      });
      writtenPaths.push(guarded.agentRunRecord.targetPath);
    }

    await writeGuardedJsonFile({
      outputRoot: options.outputRoot,
      targetPath: guarded.manifest.targetPath,
      value: manifest,
      allowOverwrite: options.allowOverwrite,
    });
    writtenPaths.push(guarded.manifest.targetPath);
  } catch (e) {
    if (!options.allowOverwrite) {
      await Promise.all(writtenPaths.map((path) => rm(path, { force: true }).catch(() => undefined)));
    }
    throw e;
  }

  return {
    manifest,
    qualityGateReport,
    manifest_path: guarded.manifest.targetPath,
    graph_bundle_path: guarded.graphBundle.targetPath,
    quality_gate_report_path: guarded.qualityGateReport.targetPath,
    ...(guarded.modelProviderValidationReport
      ? { model_provider_validation_report_path: guarded.modelProviderValidationReport.targetPath }
      : {}),
    ...(guarded.agentRunRecord
      ? { agent_run_record_path: guarded.agentRunRecord.targetPath }
      : {}),
  };
}
