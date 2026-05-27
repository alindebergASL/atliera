// Local verifier for completed lab EC2 bootstrap validation evidence.
//
// This helper consumes already-created local evidence files. It does not SSH,
// call providers, access the network, read credentials, deploy, or inspect
// Hermes Agent runtime/configuration state.

import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";

export const BOOTSTRAP_VALIDATION_EVIDENCE_SCHEMA_VERSION = "atliera.bootstrap_validation_evidence.v1" as const;

export interface VerifyBootstrapValidationEvidenceOptions {
  summary: unknown;
  rerunSummary: unknown;
  manifestText: string;
  checkoutCommit: string;
  expectedManifestHash: string;
  npmCi: string;
  npmRunCi: string;
}

export interface BootstrapValidationEvidenceSummary {
  schema_version: typeof BOOTSTRAP_VALIDATION_EVIDENCE_SCHEMA_VERSION;
  ok: true;
  checkout_commit: string;
  ci: {
    npm_ci: "passed";
    npm_run_ci: "passed";
  };
  full_pipeline: {
    summary_ok: true;
    rerun_ok: true;
    run_slug: string;
    manifest_hash: string;
    expected_manifest_hash: string;
    deterministic: true;
    safety: {
      live_provider_call: false;
      network: false;
      credentials_read: false;
    };
    quality_gate_status: "pass";
    provider_ledger_status: "succeeded";
  };
  readiness_claim: false;
}

const SAFE_COMMIT = /^[0-9a-f]{7,40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const PRIVATE_MARKERS: readonly RegExp[] = [
  /\/home\//i,
  new RegExp("atliera-private-" + "provider-evidence", "i"),
  /run-evidence\.json/i,
  /raw provider response\s*[:=]/i,
  /raw[_ -]?provider[_ -]?response/i,
  /raw[_ -]?response/i,
  /provider[_ -]?response/i,
  /raw[_ -]?body/i,
  /raw prompt\s*[:=]/i,
  /api[_ -]?key\s*[:=]/i,
  /authorization\s*[:=]/i,
  /bearer\s+[A-Za-z0-9._-]+/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  new RegExp("lab" + "\\d*" + "\\.atliera" + "\\.com", "i"),
];

interface ParsedFullPipelineSummary {
  raw: Record<string, unknown>;
  summary: Record<string, unknown>;
  artifacts: Record<string, unknown>;
  runSlug: string;
  safety: {
    live_provider_call: false;
    network: false;
    credentials_read: false;
  };
}

const MANIFEST_ARTIFACT_FIELDS = {
  graph_bundle: "graph_bundle_path",
  quality_gate_report: "quality_gate_report_path",
  model_provider_validation_report: "model_provider_validation_report_path",
  agent_run_record: "agent_run_record_path",
} as const;

export function verifyBootstrapValidationEvidence(
  options: VerifyBootstrapValidationEvidenceOptions,
): BootstrapValidationEvidenceSummary {
  assertNoPrivateMarkers("summary", JSON.stringify(options.summary));
  assertNoPrivateMarkers("rerun summary", JSON.stringify(options.rerunSummary));
  assertNoPrivateMarkers("manifest", options.manifestText);

  assertSafeCommit(options.checkoutCommit);
  assertPassedCi(options.npmCi, options.npmRunCi);
  assertExpectedHash(options.expectedManifestHash);

  const first = parseFullPipelineSummary("summary", options.summary);
  const rerun = parseFullPipelineSummary("rerun summary", options.rerunSummary);
  assertMatchingRerun(first, rerun);

  const manifestHash = sha256(options.manifestText);
  if (manifestHash !== options.expectedManifestHash) {
    throw new Error("manifest hash must match expected hash");
  }

  const manifest = parseManifest(options.manifestText);
  assertManifestMatchesSummary(manifest, first);

  const result: BootstrapValidationEvidenceSummary = {
    schema_version: BOOTSTRAP_VALIDATION_EVIDENCE_SCHEMA_VERSION,
    ok: true,
    checkout_commit: options.checkoutCommit,
    ci: {
      npm_ci: "passed",
      npm_run_ci: "passed",
    },
    full_pipeline: {
      summary_ok: true,
      rerun_ok: true,
      run_slug: first.runSlug,
      manifest_hash: manifestHash,
      expected_manifest_hash: options.expectedManifestHash,
      deterministic: true,
      safety: first.safety,
      quality_gate_status: "pass",
      provider_ledger_status: "succeeded",
    },
    readiness_claim: false,
  };

  assertNoPrivateMarkers("bootstrap evidence summary", JSON.stringify(result));
  return result;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function assertSafeCommit(commit: string): void {
  if (!SAFE_COMMIT.test(commit)) {
    throw new Error("checkout commit must be a short or full lowercase git SHA");
  }
}

function assertPassedCi(npmCi: string, npmRunCi: string): void {
  if (npmCi !== "passed" || npmRunCi !== "passed") {
    throw new Error("bootstrap command statuses must be passed");
  }
}

function assertExpectedHash(hash: string): void {
  if (!SHA256_HEX.test(hash)) {
    throw new Error("expected manifest hash must be a SHA-256 hex digest");
  }
}

function assertNoPrivateMarkers(label: string, text: string): void {
  for (const pattern of PRIVATE_MARKERS) {
    if (pattern.test(text)) {
      throw new Error(`${label} must not contain private evidence markers`);
    }
  }
}

function parseFullPipelineSummary(label: string, value: unknown): ParsedFullPipelineSummary {
  const raw = asRecord(value, `${label} must be an object`);
  if (raw.ok !== true) {
    throw new Error(`${label} must be ok`);
  }
  if (raw.command !== "package") {
    throw new Error(`${label} must be a full-pipeline package summary`);
  }

  const summary = asRecord(raw.summary, `${label} nested summary must be an object`);
  if (summary.schema_version !== "atliera.full_pipeline_validation.v1" || summary.ok !== true) {
    throw new Error(`${label} nested summary must be ok`);
  }

  const runSlug = reqString(summary, "run_slug", `${label} run slug must be a string`);
  const safety = parseSafety(summary, label);
  assertQualityGate(summary, label);
  assertProviderValidation(summary, label);

  const artifacts = asRecord(summary.artifacts, `${label} artifacts must be an object`);
  assertRelativeArtifactPaths(`${label} top-level artifact`, raw, [
    "manifest_path",
    "graph_bundle_path",
    "quality_gate_report_path",
    "model_provider_validation_report_path",
    "agent_run_record_path",
  ]);
  assertRelativeArtifactPaths(`${label} summary artifact`, artifacts, [
    "manifest_path",
    "graph_bundle_path",
    "quality_gate_report_path",
    "model_provider_validation_report_path",
    "agent_run_record_path",
  ]);

  return { raw, summary, artifacts, runSlug, safety };
}

function parseSafety(summary: Record<string, unknown>, label: string): ParsedFullPipelineSummary["safety"] {
  const safety = asRecord(summary.safety, `${label} safety must be an object`);
  if (safety.live_provider_call !== false || safety.network !== false || safety.credentials_read !== false) {
    throw new Error("safety flags must prove no live provider call, network, or credential read");
  }
  return {
    live_provider_call: false,
    network: false,
    credentials_read: false,
  };
}

function assertQualityGate(summary: Record<string, unknown>, label: string): void {
  const gate = asRecord(summary.quality_gate, `${label} quality gate must be an object`);
  if (gate.ok !== true || gate.status !== "pass") {
    throw new Error(`${label} quality gate must pass`);
  }
}

function assertProviderValidation(summary: Record<string, unknown>, label: string): void {
  const provider = asRecord(summary.provider_validation, `${label} provider validation must be an object`);
  if (provider.ok !== true || provider.cost_ledger_status !== "succeeded") {
    throw new Error(`${label} provider validation must have succeeded ledger status`);
  }
  if (!Array.isArray(provider.check_failures) || provider.check_failures.length !== 0) {
    throw new Error(`${label} provider validation must have no check failures`);
  }
}

function assertRelativeArtifactPaths(label: string, record: Record<string, unknown>, fields: readonly string[]): void {
  for (const field of fields) {
    const value = reqString(record, field, `${label} ${field} must be a string`);
    if (!isSafeRelativeArtifactPath(value)) {
      throw new Error("artifact paths must be relative");
    }
  }
}

function isSafeRelativeArtifactPath(value: string): boolean {
  return value.length > 0 &&
    !isAbsolute(value) &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.includes("\\") &&
    !value.includes("://") &&
    !value.split("/").includes("..") &&
    !value.startsWith("/");
}

function assertMatchingRerun(first: ParsedFullPipelineSummary, rerun: ParsedFullPipelineSummary): void {
  if (rerun.raw.ok !== true || rerun.summary.ok !== true) {
    throw new Error("rerun summary must be ok");
  }
  if (stableStringify(first.summary) !== stableStringify(rerun.summary)) {
    throw new Error("rerun summary must match original validation summary");
  }
  if (stableStringify(projectTopLevelArtifactPaths(first.raw)) !== stableStringify(projectTopLevelArtifactPaths(rerun.raw))) {
    throw new Error("rerun summary must match original artifact paths");
  }
}

function projectTopLevelArtifactPaths(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    manifest_path: raw.manifest_path,
    graph_bundle_path: raw.graph_bundle_path,
    quality_gate_report_path: raw.quality_gate_report_path,
    model_provider_validation_report_path: raw.model_provider_validation_report_path,
    agent_run_record_path: raw.agent_run_record_path,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseManifest(manifestText: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    throw new Error("manifest must be valid JSON");
  }
  return asRecord(parsed, "manifest must be an object");
}

function assertManifestMatchesSummary(manifest: Record<string, unknown>, summary: ParsedFullPipelineSummary): void {
  if (manifest.schema_version !== "atliera.run_manifest.v1") {
    throw new Error("manifest schema version must be atliera.run_manifest.v1");
  }
  if (manifest.run_slug !== summary.runSlug) {
    throw new Error("manifest run slug must match summary run slug");
  }

  const artifacts = manifest.artifacts;
  if (!Array.isArray(artifacts) || artifacts.length !== Object.keys(MANIFEST_ARTIFACT_FIELDS).length) {
    throw new Error("manifest must include four package artifacts");
  }
  const seenArtifactTypes = new Set<string>();
  for (const artifact of artifacts) {
    const record = asRecord(artifact, "manifest artifact must be an object");
    const artifactType = reqString(record, "artifact_type", "manifest artifact type must be a string");
    const summaryField = MANIFEST_ARTIFACT_FIELDS[artifactType as keyof typeof MANIFEST_ARTIFACT_FIELDS];
    if (!summaryField || seenArtifactTypes.has(artifactType)) {
      throw new Error("manifest artifact types must match the expected package artifacts");
    }
    seenArtifactTypes.add(artifactType);

    const path = reqString(record, "path", "manifest artifact path must be a string");
    if (!isSafeRelativeArtifactPath(path)) {
      throw new Error("artifact paths must be relative");
    }
    if (path !== summary.artifacts[summaryField]) {
      throw new Error("manifest artifact paths must match summary artifacts");
    }
  }

  if (reqString(summary.raw, "manifest_path", "summary manifest path must be a string") !== `${summary.runSlug}/manifest.json`) {
    throw new Error("summary manifest path must match run slug");
  }

  const modelRun = asRecord(manifest.model_run, "manifest model run must be an object");
  const provider = asRecord(summary.summary.provider_validation, "summary provider validation must be an object");
  for (const field of ["provider", "model", "operation", "idempotency_key"] as const) {
    if (modelRun[field] !== provider[field]) {
      throw new Error("manifest model run must match summary provider validation");
    }
  }
  if (modelRun.status !== "succeeded") {
    throw new Error("manifest model run must have succeeded status");
  }

  const gate = asRecord(manifest.quality_gate, "manifest quality gate must be an object");
  if (gate.ok !== true || gate.status !== "pass") {
    throw new Error("manifest quality gate must pass");
  }
  const ledger = asRecord(manifest.cost_ledger, "manifest cost ledger must be an object");
  if (ledger.status !== "succeeded") {
    throw new Error("manifest cost ledger must have succeeded status");
  }
  const agentRun = asRecord(manifest.agent_run, "manifest agent run must be an object");
  if (agentRun.status !== "succeeded") {
    throw new Error("manifest agent run must have succeeded status");
  }
  const agentRunRecordPath = reqString(agentRun, "record_path", "manifest agent run record path must be a string");
  if (!isSafeRelativeArtifactPath(agentRunRecordPath)) {
    throw new Error("artifact paths must be relative");
  }
  if (agentRunRecordPath !== summary.artifacts.agent_run_record_path) {
    throw new Error("manifest agent run record path must match summary artifacts");
  }
}

function reqString(record: Record<string, unknown>, key: string, message: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(message);
  }
  return value;
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}
