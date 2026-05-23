import type { AtlieraRuntimeConfig } from "../config/runtime.ts";
import { runRuntimePreflight } from "./preflight.ts";

export type ResourcePreflightTarget =
  | "database"
  | "artifact_store"
  | "queue_backend"
  | "model_provider";

export type ResourcePreflightStatus = "pass" | "fail" | "warn";

export type ResourcePreflightMetadata = Record<string, string | number | boolean>;

export interface ResourcePreflightCheckResult {
  readonly status: ResourcePreflightStatus;
  readonly code: string;
  readonly message: string;
  readonly metadata?: ResourcePreflightMetadata;
}

export interface ResourcePreflightCheckDefinition {
  readonly target: ResourcePreflightTarget;
  readonly name: string;
  readonly run: () =>
    | ResourcePreflightCheckResult
    | Promise<ResourcePreflightCheckResult>;
}

export interface ResourcePreflightCheckReport extends ResourcePreflightCheckResult {
  readonly target: ResourcePreflightTarget;
  readonly name: string;
  readonly metadata?: ResourcePreflightMetadata;
}

export interface ResourcePreflightIssue {
  readonly target?: ResourcePreflightTarget;
  readonly code: string;
  readonly message: string;
}

export interface ResourcePreflightReport {
  readonly ok: boolean;
  readonly environment: AtlieraRuntimeConfig["environment"];
  readonly failures: ResourcePreflightIssue[];
  readonly warnings: ResourcePreflightIssue[];
  readonly checks: ResourcePreflightCheckReport[];
}

const PRODUCTION_LIKE_ENVIRONMENTS = new Set(["production", "staging"]);
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9 _./:-]{0,127}$/;
const SAFE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SECRET_LIKE_METADATA_KEY =
  /(api[_-]?key|secret|token|password|credential|authorization|cookie|signed[_-]?url)/i;
const REQUIRED_PRODUCTION_TARGETS: readonly ResourcePreflightTarget[] = [
  "database",
  "artifact_store",
  "queue_backend",
  "model_provider",
];

export function defineResourcePreflightCheck(
  definition: ResourcePreflightCheckDefinition,
): ResourcePreflightCheckDefinition {
  assertSafeTarget(definition.target);
  assertSafeHumanName(definition.name, "resource check name");
  return {
    target: definition.target,
    name: definition.name,
    run: definition.run,
  };
}

export async function runResourcePreflight(
  config: AtlieraRuntimeConfig,
  checks: readonly ResourcePreflightCheckDefinition[],
): Promise<ResourcePreflightReport> {
  const configReport = runRuntimePreflight(config);
  if (!configReport.ok) {
    return {
      ok: false,
      environment: config.environment,
      failures: [
        {
          code: "config_preflight_failed",
          message:
            "resource preflight requires config preflight to pass before live checks run",
        },
      ],
      warnings: [],
      checks: [],
    };
  }

  const failures: ResourcePreflightIssue[] = [];
  const warnings: ResourcePreflightIssue[] = [];
  const checkReports: ResourcePreflightCheckReport[] = [];

  if (PRODUCTION_LIKE_ENVIRONMENTS.has(config.environment)) {
    const registeredTargets = new Set(checks.map((check) => check.target));
    for (const target of REQUIRED_PRODUCTION_TARGETS) {
      if (!registeredTargets.has(target)) {
        failures.push({
          target,
          code: missingCheckCodeFor(target),
          message: `${target} resource check is required for production-like environments`,
        });
      }
    }
  }

  for (const check of checks) {
    assertSafeTarget(check.target);
    assertSafeHumanName(check.name, "resource check name");

    try {
      const result = await check.run();
      assertSafeStatus(result.status);
      assertSafeCode(result.code);
      assertSafeHumanName(result.message, "resource check message");
      const metadata = sanitizeMetadata(result.metadata);
      const report: ResourcePreflightCheckReport = {
        target: check.target,
        name: check.name,
        status: result.status,
        code: result.code,
        message: result.message,
        ...(metadata === undefined ? {} : { metadata }),
      };

      checkReports.push(report);
      if (result.status === "fail") {
        failures.push({
          target: check.target,
          code: result.code,
          message: result.message,
        });
      } else if (result.status === "warn") {
        warnings.push({
          target: check.target,
          code: result.code,
          message: result.message,
        });
      }
    } catch (error) {
      if (error instanceof UnsafeResourceCheckMetadataError) {
        failures.push({
          target: check.target,
          code: "unsafe_resource_check_metadata",
          message: `${check.target} resource check returned unsafe metadata`,
        });
      } else if (error instanceof MalformedResourceCheckResultError) {
        failures.push({
          target: check.target,
          code: "malformed_resource_check_result",
          message: `${check.target} resource check returned a malformed result`,
        });
      } else {
        failures.push({
          target: check.target,
          code: "resource_check_threw",
          message: `${check.target} resource check threw`,
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    environment: config.environment,
    failures,
    warnings,
    checks: checkReports,
  };
}

function assertSafeTarget(target: string): asserts target is ResourcePreflightTarget {
  if (
    target !== "database" &&
    target !== "artifact_store" &&
    target !== "queue_backend" &&
    target !== "model_provider"
  ) {
    throw new Error("resource preflight target is not supported");
  }
}

function assertSafeStatus(status: string): asserts status is ResourcePreflightStatus {
  if (status !== "pass" && status !== "fail" && status !== "warn") {
    throw new MalformedResourceCheckResultError();
  }
}

function assertSafeCode(code: string): void {
  if (!SAFE_CODE_PATTERN.test(code)) {
    throw new MalformedResourceCheckResultError();
  }
}

function assertSafeHumanName(value: string, field: string): void {
  if (!SAFE_NAME_PATTERN.test(value)) {
    throw new MalformedResourceCheckResultError(`${field} must be a short sanitized string`);
  }
}

function sanitizeMetadata(
  metadata: ResourcePreflightMetadata | undefined,
): ResourcePreflightMetadata | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  const sanitized: ResourcePreflightMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_LIKE_METADATA_KEY.test(key)) {
      throw new UnsafeResourceCheckMetadataError();
    }
    if (typeof value === "string") {
      assertSafeHumanName(value, "resource check metadata value");
    }
    sanitized[key] = value;
  }

  return sanitized;
}

function missingCheckCodeFor(target: ResourcePreflightTarget): string {
  switch (target) {
    case "database":
      return "missing_database_resource_check";
    case "artifact_store":
      return "missing_artifact_store_resource_check";
    case "queue_backend":
      return "missing_queue_backend_resource_check";
    case "model_provider":
      return "missing_model_provider_resource_check";
  }
}

class UnsafeResourceCheckMetadataError extends Error {}
class MalformedResourceCheckResultError extends Error {}
