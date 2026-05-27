// Deterministic full-pipeline validation packaging helper.
//
// This bridges an already-sanitized model-provider validation report through
// AgentRun evidence, graph validation, quality gates, and local manifest
// artifact persistence. It deliberately performs no provider calls, network
// access, credential reads, deployment, database writes, or Hermes runtime
// changes.

import { relative, resolve } from "node:path";

import { createAgentRunRecord, type AgentRunRecord } from "../agent/run-record.ts";
import type { QualityGateReport } from "../gate/quality-gate.ts";
import type { GraphBundle } from "../graph/types.ts";
import type { ModelCostLedgerEntry } from "../model/activation-gates.ts";
import type { ModelProviderValidationCheckName, ModelProviderValidationReport } from "../model/provider-validation.ts";
import {
  writeRunArtifactManifest,
  type RunArtifactManifest,
  type WriteRunArtifactManifestResult,
} from "../run/manifest.ts";

export const FULL_PIPELINE_VALIDATION_SCHEMA_VERSION = "atliera.full_pipeline_validation.v1" as const;

export interface FullPipelineValidationArtifacts {
  manifest_path: string;
  graph_bundle_path: string;
  quality_gate_report_path: string;
  model_provider_validation_report_path: string;
  agent_run_record_path: string;
}

export interface FullPipelineProviderValidationSummary {
  ok: boolean;
  provider: string;
  model: string;
  operation: string;
  idempotency_key: string;
  cost_ledger_status: ModelCostLedgerEntry["status"];
  observed_cost_usd: number;
  check_failures: string[];
}

export interface FullPipelineValidationSummary {
  schema_version: typeof FULL_PIPELINE_VALIDATION_SCHEMA_VERSION;
  ok: boolean;
  run_slug: string;
  provider_validation: FullPipelineProviderValidationSummary;
  agent_run: {
    id: string;
    status: AgentRunRecord["status"];
    record_path: string;
  };
  graph_validation: {
    ok: boolean;
    hard_failures: number;
  };
  quality_gate: {
    ok: boolean;
    status: QualityGateReport["status"];
    reason_codes: string[];
  };
  artifacts: FullPipelineValidationArtifacts;
  safety: {
    live_provider_call: false;
    network: false;
    credentials_read: false;
  };
}

export interface RunFullPipelineValidationPackageOptions {
  bundle: GraphBundle;
  modelProviderValidationReport: ModelProviderValidationReport;
  outputRoot: string;
  runSlug: string;
  inputPath: string;
  now: string;
  allowOverwrite?: boolean;
}

export interface RunFullPipelineValidationPackageResult {
  summary: FullPipelineValidationSummary;
  manifest: RunArtifactManifest;
  qualityGateReport: QualityGateReport;
  agentRunRecord: AgentRunRecord;
  artifacts: {
    manifest_path: string;
    graph_bundle_path: string;
    quality_gate_report_path: string;
    model_provider_validation_report_path: string;
    agent_run_record_path: string;
  };
}

const REQUIRED_SUCCESS_CHECKS: readonly ModelProviderValidationCheckName[] = [
  "activation_gates",
  "credential_status",
  "provider_call",
  "response_contract",
  "cost_ledger_entry",
];
const ALLOWED_SUCCESS_CHECKS = new Set<ModelProviderValidationCheckName>([
  ...REQUIRED_SUCCESS_CHECKS,
  "prompt_contract_output",
]);
const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function relativeArtifactPath(outputRoot: string, path: string): string {
  return relative(resolve(outputRoot), path).split("\\").join("/");
}

function safeIdTokenFromRunSlug(runSlug: string): string {
  const token = runSlug
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 56);
  return token.length > 0 ? token : "validation";
}

function artifactId(runSlug: string, suffix: string): string {
  return `art_${safeIdTokenFromRunSlug(runSlug)}_${suffix}`.slice(0, 68);
}

function snapshotProviderValidationReport(report: ModelProviderValidationReport): ModelProviderValidationReport {
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
    throw new Error("full pipeline provider validation report rejected");
  }
}

function assertSuccessfulProviderEvidence(report: ModelProviderValidationReport): ModelCostLedgerEntry {
  const ledger = report.cost_ledger_entry;
  if (!ledger || ledger.status !== "succeeded") {
    throw new Error("full pipeline provider evidence must have succeeded cost ledger status");
  }
  assertProviderValidationChecks(report);
  assertProviderValidationCallAndLedger(report, ledger);
  return ledger;
}

function assertProviderValidationChecks(report: ModelProviderValidationReport): void {
  if (report.ok !== true) {
    throw new Error("full pipeline provider evidence must include passed validation checks");
  }
  const names = new Set<ModelProviderValidationCheckName>();
  for (const check of report.checks) {
    if (!ALLOWED_SUCCESS_CHECKS.has(check.name) || names.has(check.name) || check.ok !== true || check.codes.length !== 0) {
      throw new Error("full pipeline provider evidence must include passed validation checks");
    }
    names.add(check.name);
  }
  for (const required of REQUIRED_SUCCESS_CHECKS) {
    if (!names.has(required)) {
      throw new Error("full pipeline provider evidence must include passed validation checks");
    }
  }
}

function assertSafeLogicalId(field: string, value: string): void {
  if (!SAFE_LOGICAL_ID.test(value) || value.includes("..") || value.includes("://") || value.includes("\\")) {
    throw new Error(`${field} must be a safe logical identifier`);
  }
}

function assertSafeNumber(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative finite number`);
  }
}

function assertSafeInteger(field: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }
}

function assertStrictIsoTimestamp(field: string, value: string): void {
  if (!ISO_TIMESTAMP_PATTERN.test(value) || new Date(value).toISOString() !== value) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
}

function assertProviderValidationCallAndLedger(
  report: ModelProviderValidationReport,
  ledger: ModelCostLedgerEntry,
): void {
  assertSafeLogicalId("provider", report.call.provider);
  assertSafeLogicalId("model", report.call.model);
  assertSafeLogicalId("idempotency key", report.call.idempotency_key);
  if (report.call.operation !== "graph.propose") {
    throw new Error("full pipeline provider evidence must use graph.propose operation");
  }
  if (ledger.schema_version !== "atliera.model_cost_ledger_entry.v1") {
    throw new Error("full pipeline provider evidence has unsupported ledger schema version");
  }
  if (ledger.provider !== report.call.provider || ledger.model !== report.call.model) {
    throw new Error("full pipeline provider evidence call and ledger fields must match");
  }
  assertSafeLogicalId("ledger entry id", ledger.ledger_entry_id);
  assertSafeLogicalId("approval id", ledger.approval_id);
  assertSafeLogicalId("run id", ledger.run_id);
  assertSafeLogicalId("account ref", ledger.account_ref);
  assertSafeLogicalId("stage", ledger.stage);
  assertSafeInteger("input tokens", ledger.input_tokens);
  assertSafeInteger("output tokens", ledger.output_tokens);
  assertSafeNumber("estimated cost", ledger.estimated_cost_usd);
  assertSafeNumber("observed cost", ledger.observed_cost_usd);
  assertSafeInteger("retry count", ledger.retry_count);
  assertStrictIsoTimestamp("recorded at", ledger.recorded_at);
  if (ledger.error !== null) {
    throw new Error("full pipeline succeeded provider evidence must not carry an error string");
  }
}

function checkFailures(report: ModelProviderValidationReport): string[] {
  return report.checks.flatMap((check) => check.ok ? [] : check.codes.map((code) => `${check.name}:${code}`));
}

function createFullPipelineAgentRunRecord(options: {
  runSlug: string;
  inputPath: string;
  providerReport: ModelProviderValidationReport;
  ledger: ModelCostLedgerEntry;
  now: string;
}): AgentRunRecord {
  if (options.providerReport.call.operation !== "graph.propose") {
    throw new Error("full pipeline provider evidence must use graph.propose operation");
  }
  const token = safeIdTokenFromRunSlug(options.runSlug);
  return createAgentRunRecord({
    id: `agn_${token}`,
    researchRunId: options.ledger.run_id,
    operation: "graph.propose",
    mode: "model",
    status: "succeeded",
    inputGraphRef: options.inputPath,
    createdAt: options.ledger.recorded_at,
    updatedAt: options.now,
    artifacts: [
      {
        role: "input_graph",
        runArtifactId: artifactId(options.runSlug, "graph"),
        ref: `${options.runSlug}/graph-bundle.json`,
      },
      {
        role: "quality_gate_report",
        runArtifactId: artifactId(options.runSlug, "quality"),
        ref: `${options.runSlug}/quality-gate-report.json`,
      },
      {
        role: "model_response",
        runArtifactId: artifactId(options.runSlug, "provider"),
        ref: `${options.runSlug}/model-provider-validation-report.json`,
      },
      {
        role: "run_manifest",
        runArtifactId: artifactId(options.runSlug, "manifest"),
        ref: `${options.runSlug}/manifest.json`,
      },
    ],
    metadata: {
      validation_phase: "full_pipeline_package",
      provider_validation_report: "sanitized",
    },
  });
}

function summarize(options: {
  outputRoot: string;
  runSlug: string;
  providerReport: ModelProviderValidationReport;
  ledger: ModelCostLedgerEntry;
  agentRunRecord: AgentRunRecord;
  manifestResult: WriteRunArtifactManifestResult;
}): FullPipelineValidationSummary {
  const validationReport = options.manifestResult.qualityGateReport.validation_report;
  const qualityGate = options.manifestResult.qualityGateReport;
  const artifacts = {
    manifest_path: relativeArtifactPath(options.outputRoot, options.manifestResult.manifest_path),
    graph_bundle_path: relativeArtifactPath(options.outputRoot, options.manifestResult.graph_bundle_path),
    quality_gate_report_path: relativeArtifactPath(options.outputRoot, options.manifestResult.quality_gate_report_path),
    model_provider_validation_report_path: relativeArtifactPath(
      options.outputRoot,
      options.manifestResult.model_provider_validation_report_path!,
    ),
    agent_run_record_path: relativeArtifactPath(options.outputRoot, options.manifestResult.agent_run_record_path!),
  };
  const providerValidation = {
    ok: options.providerReport.ok,
    provider: options.providerReport.call.provider,
    model: options.providerReport.call.model,
    operation: options.providerReport.call.operation,
    idempotency_key: options.providerReport.call.idempotency_key,
    cost_ledger_status: options.ledger.status,
    observed_cost_usd: options.ledger.observed_cost_usd,
    check_failures: checkFailures(options.providerReport),
  };
  const graphValidation = {
    ok: validationReport.ok,
    hard_failures: validationReport.hard_failures.length,
  };
  const qualityGateSummary = {
    ok: qualityGate.ok,
    status: qualityGate.status,
    reason_codes: qualityGate.reasons.map((reason) => reason.code),
  };

  return {
    schema_version: FULL_PIPELINE_VALIDATION_SCHEMA_VERSION,
    ok: providerValidation.ok && graphValidation.ok && qualityGateSummary.ok && options.agentRunRecord.status === "succeeded",
    run_slug: options.runSlug,
    provider_validation: providerValidation,
    agent_run: {
      id: options.agentRunRecord.id,
      status: options.agentRunRecord.status,
      record_path: artifacts.agent_run_record_path,
    },
    graph_validation: graphValidation,
    quality_gate: qualityGateSummary,
    artifacts,
    safety: {
      live_provider_call: false,
      network: false,
      credentials_read: false,
    },
  };
}

export async function runFullPipelineValidationPackage(
  options: RunFullPipelineValidationPackageOptions,
): Promise<RunFullPipelineValidationPackageResult> {
  const providerReport = snapshotProviderValidationReport(options.modelProviderValidationReport);
  const ledger = assertSuccessfulProviderEvidence(providerReport);
  const agentRunRecord = createFullPipelineAgentRunRecord({
    runSlug: options.runSlug,
    inputPath: options.inputPath,
    providerReport,
    ledger,
    now: options.now,
  });

  const manifestResult = await writeRunArtifactManifest({
    bundle: options.bundle,
    outputRoot: options.outputRoot,
    runSlug: options.runSlug,
    mode: "model",
    inputPath: options.inputPath,
    allowOverwrite: options.allowOverwrite,
    createdAt: options.now,
    modelProviderValidationReport: providerReport,
    agentRunRecord,
  });

  return {
    summary: summarize({
      outputRoot: options.outputRoot,
      runSlug: options.runSlug,
      providerReport,
      ledger,
      agentRunRecord,
      manifestResult,
    }),
    manifest: manifestResult.manifest,
    qualityGateReport: manifestResult.qualityGateReport,
    agentRunRecord,
    artifacts: {
      manifest_path: manifestResult.manifest_path,
      graph_bundle_path: manifestResult.graph_bundle_path,
      quality_gate_report_path: manifestResult.quality_gate_report_path,
      model_provider_validation_report_path: manifestResult.model_provider_validation_report_path!,
      agent_run_record_path: manifestResult.agent_run_record_path!,
    },
  };
}
