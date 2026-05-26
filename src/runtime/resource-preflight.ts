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

    let result: ResourcePreflightCheckResult;
    try {
      result = await check.run();
    } catch {
      failures.push({
        target: check.target,
        code: "resource_check_threw",
        message: `${check.target} resource check threw`,
      });
      continue;
    }

    try {
      const sanitizedResult = sanitizeResourceCheckResult(result);
      const report: ResourcePreflightCheckReport = {
        target: check.target,
        name: check.name,
        status: sanitizedResult.status,
        code: sanitizedResult.code,
        message: sanitizedResult.message,
        ...(sanitizedResult.metadata === undefined ? {} : { metadata: sanitizedResult.metadata }),
      };

      checkReports.push(report);
      if (sanitizedResult.status === "fail") {
        failures.push({
          target: check.target,
          code: sanitizedResult.code,
          message: sanitizedResult.message,
        });
      } else if (sanitizedResult.status === "warn") {
        warnings.push({
          target: check.target,
          code: sanitizedResult.code,
          message: sanitizedResult.message,
        });
      }
    } catch (error) {
      if (error instanceof UnsafeResourceCheckMetadataError) {
        failures.push({
          target: check.target,
          code: "unsafe_resource_check_metadata",
          message: `${check.target} resource check returned unsafe metadata`,
        });
      } else {
        failures.push({
          target: check.target,
          code: "malformed_resource_check_result",
          message: `${check.target} resource check returned a malformed result`,
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

function sanitizeResourceCheckResult(result: unknown): ResourcePreflightCheckResult {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new MalformedResourceCheckResultError();
  }

  const status = getRequiredDataProperty(result, "status");
  const code = getRequiredDataProperty(result, "code");
  const message = getRequiredDataProperty(result, "message");
  const metadata = getOptionalDataProperty(result, "metadata");
  if (typeof status !== "string" || typeof code !== "string" || typeof message !== "string") {
    throw new MalformedResourceCheckResultError();
  }
  assertSafeStatus(status);
  assertSafeCode(code);
  assertSafeHumanName(message, "resource check message");

  const sanitizedMetadata = sanitizeMetadata(metadata);
  return {
    status,
    code,
    message,
    ...(sanitizedMetadata === undefined ? {} : { metadata: sanitizedMetadata }),
  };
}

function getRequiredDataProperty(source: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new MalformedResourceCheckResultError();
  }
  return descriptor.value;
}

function getOptionalDataProperty(source: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined) {
    return undefined;
  }
  if (!descriptor.enumerable || !("value" in descriptor)) {
    throw new MalformedResourceCheckResultError();
  }
  return descriptor.value;
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
  metadata: unknown,
): ResourcePreflightMetadata | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    throw new MalformedResourceCheckResultError();
  }

  const sanitized: ResourcePreflightMetadata = {};
  for (const key of Reflect.ownKeys(metadata)) {
    if (typeof key === "symbol") {
      throw new MalformedResourceCheckResultError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(metadata, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new MalformedResourceCheckResultError();
    }
    if (SECRET_LIKE_METADATA_KEY.test(key)) {
      throw new UnsafeResourceCheckMetadataError();
    }
    const value = descriptor.value;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new MalformedResourceCheckResultError();
    }
    if (typeof value === "string") {
      assertSafeHumanName(value, "resource check metadata value");
    }
    Object.defineProperty(sanitized, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
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
