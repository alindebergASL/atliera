// Local run artifact manifest writer.
//
// Phase 1.5 packages a local GraphBundle, its per-bundle quality-gate
// report, and a small manifest into one explicit output-root directory.
// This remains a deterministic local file utility: no provider calls, no
// network, no database, and no app/runtime persistence.

import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { runQualityGate, type QualityGateReport } from "../gate/quality-gate.ts";
import { saveGraphBundleFile } from "../graph/file-store.ts";
import type { GraphBundle } from "../graph/types.ts";
import { guardOutputPath, type GuardedOutputPath } from "../io/path-guard.ts";
import { assertProductionWriteAllowed, type RuntimeMode } from "../modes/index.ts";

export const RUN_ARTIFACT_MANIFEST_SCHEMA_VERSION = "atliera.run_manifest.v1" as const;

export type RunArtifactManifestArtifactType = "graph_bundle" | "quality_gate_report";

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

export interface RunArtifactManifest {
  schema_version: typeof RUN_ARTIFACT_MANIFEST_SCHEMA_VERSION;
  run_slug: string;
  mode: RuntimeMode;
  input_path: string | null;
  created_at: string;
  artifacts: RunArtifactManifestArtifact[];
  quality_gate: RunArtifactManifestQualityGateSummary;
}

export interface WriteRunArtifactManifestOptions {
  bundle: GraphBundle;
  outputRoot: string;
  runSlug: string;
  mode: RuntimeMode;
  inputPath?: string | null;
  allowOverwrite?: boolean;
}

export interface WriteRunArtifactManifestResult {
  manifest: RunArtifactManifest;
  qualityGateReport: QualityGateReport;
  manifest_path: string;
  graph_bundle_path: string;
  quality_gate_report_path: string;
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
}): Promise<{
  graphBundle: GuardedOutputPath;
  qualityGateReport: GuardedOutputPath;
  manifest: GuardedOutputPath;
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

  return { graphBundle, qualityGateReport, manifest };
}

function buildManifest(options: {
  outputRoot: string;
  runSlug: string;
  mode: RuntimeMode;
  inputPath?: string | null;
  createdAt: string;
  graphBundlePath: string;
  qualityGateReportPath: string;
  qualityGateReport: QualityGateReport;
}): RunArtifactManifest {
  return {
    schema_version: RUN_ARTIFACT_MANIFEST_SCHEMA_VERSION,
    run_slug: options.runSlug,
    mode: options.mode,
    input_path: options.inputPath ?? null,
    created_at: options.createdAt,
    artifacts: [
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
    ],
    quality_gate: {
      ok: options.qualityGateReport.ok,
      status: options.qualityGateReport.status,
      reason_codes: options.qualityGateReport.reasons.map((reason) => reason.code),
      metrics: options.qualityGateReport.metrics,
    },
  };
}

export async function writeRunArtifactManifest(
  options: WriteRunArtifactManifestOptions,
): Promise<WriteRunArtifactManifestResult> {
  assertProductionWriteAllowed(options.mode);
  assertSafeRunSlug(options.runSlug);

  const guarded = await preflightGuardedOutputs({
    outputRoot: options.outputRoot,
    runSlug: options.runSlug,
    allowOverwrite: options.allowOverwrite,
  });

  const qualityGateReport = runQualityGate(options.bundle);
  const createdAt = new Date().toISOString();
  const manifest = buildManifest({
    outputRoot: options.outputRoot,
    runSlug: options.runSlug,
    mode: options.mode,
    inputPath: options.inputPath,
    createdAt,
    graphBundlePath: guarded.graphBundle.targetPath,
    qualityGateReportPath: guarded.qualityGateReport.targetPath,
    qualityGateReport,
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
  };
}
