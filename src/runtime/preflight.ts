import type { AtlieraRuntimeConfig } from "../config/runtime.ts";

export type RuntimePreflightFailureCode =
  | "missing_public_base_url"
  | "missing_database_url"
  | "missing_artifact_store"
  | "missing_queue_backend"
  | "missing_model_provider"
  | "production_artifact_store_must_be_durable"
  | "production_queue_backend_must_be_durable"
  | "production_model_provider_must_be_real";

export interface RuntimePreflightIssue {
  code: RuntimePreflightFailureCode;
  message: string;
}

export interface RuntimePreflightReport {
  ok: boolean;
  environment: AtlieraRuntimeConfig["environment"];
  failures: RuntimePreflightIssue[];
  warnings: RuntimePreflightIssue[];
}

const PRODUCTION_LIKE_ENVIRONMENTS = new Set(["production", "staging"]);

export function runRuntimePreflight(
  config: AtlieraRuntimeConfig,
): RuntimePreflightReport {
  const failures: RuntimePreflightIssue[] = [];

  if (PRODUCTION_LIKE_ENVIRONMENTS.has(config.environment)) {
    if (config.publicBaseUrl === undefined) {
      failures.push({
        code: "missing_public_base_url",
        message: "production-like runtime requires APP_BASE_URL",
      });
    }
    if (config.databaseUrl === undefined) {
      failures.push({
        code: "missing_database_url",
        message: "production-like runtime requires DATABASE_URL",
      });
    }
    if (config.artifactStore === undefined) {
      failures.push({
        code: "missing_artifact_store",
        message: "production-like runtime requires ARTIFACT_STORE",
      });
    }
    if (config.queueBackend === undefined) {
      failures.push({
        code: "missing_queue_backend",
        message: "production-like runtime requires QUEUE_BACKEND",
      });
    }
    if (config.modelProvider === undefined) {
      failures.push({
        code: "missing_model_provider",
        message: "production-like runtime requires MODEL_PROVIDER",
      });
    }
    if (config.artifactStore === "memory") {
      failures.push({
        code: "production_artifact_store_must_be_durable",
        message: "production-like runtime requires a durable artifact store",
      });
    }
    if (config.queueBackend === "memory") {
      failures.push({
        code: "production_queue_backend_must_be_durable",
        message: "production-like runtime requires a durable queue backend",
      });
    }
    if (config.modelProvider === "fake") {
      failures.push({
        code: "production_model_provider_must_be_real",
        message: "production-like runtime requires a real model provider",
      });
    }
  }

  return {
    ok: failures.length === 0,
    environment: config.environment,
    failures,
    warnings: [],
  };
}

export function assertRuntimePreflightPasses(
  config: AtlieraRuntimeConfig,
): void {
  const report = runRuntimePreflight(config);
  if (!report.ok) {
    throw new Error(
      `runtime preflight failed: ${report.failures
        .map((failure) => failure.code)
        .join(", ")}`,
    );
  }
}
