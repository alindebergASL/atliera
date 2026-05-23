import { assertSafeArtifactKey } from "./store.ts";
import { S3ArtifactStore, type S3ArtifactStoreClient } from "./s3-store.ts";

export type S3CompatibilityValidationCheckName =
  | "round_trip_text"
  | "missing_object_returns_undefined"
  | "overwrite_last_write_wins"
  | "prefix_isolation"
  | "max_payload_guard";

export type S3CompatibilityValidationStatus = "pass" | "fail";

export type S3CompatibilityValidationCode =
  | "s3_compatibility_pass"
  | "s3_compatibility_roundtrip_mismatch"
  | "s3_compatibility_missing_object_failed"
  | "s3_compatibility_overwrite_failed"
  | "s3_compatibility_prefix_isolation_failed"
  | "s3_compatibility_max_payload_guard_failed"
  | "s3_compatibility_dependency_failure";

export interface S3CompatibilityValidationCheckResult {
  readonly name: S3CompatibilityValidationCheckName;
  readonly status: S3CompatibilityValidationStatus;
  readonly code: S3CompatibilityValidationCode;
  readonly message: string;
}

export interface S3CompatibilityValidationReport {
  readonly ok: boolean;
  readonly backend: {
    readonly adapter: "s3_compatible";
    readonly client: "injected";
  };
  readonly probeNamespace: string;
  readonly checks: readonly S3CompatibilityValidationCheckResult[];
}

export interface S3CompatibilityValidationOptions {
  readonly client: S3ArtifactStoreClient;
  readonly bucket: string;
  readonly prefix?: string;
  readonly probeId: string;
  readonly maxPayloadBytes?: number;
}

const SAFE_PROBE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const VALIDATION_CONTENT = "atliera s3 compatibility validation";
const OVERWRITE_V1 = "atliera s3 compatibility overwrite v1";
const OVERWRITE_V2 = "atliera s3 compatibility overwrite v2";

export async function validateS3ArtifactStoreCompatibility(
  options: S3CompatibilityValidationOptions,
): Promise<S3CompatibilityValidationReport> {
  assertSafeProbeId(options.probeId);

  const probeNamespace = `s3-compatibility/${options.probeId}/`;
  assertSafeArtifactKey(`${probeNamespace}round-trip.txt`);

  const checks: S3CompatibilityValidationCheckResult[] = [];
  const store = new S3ArtifactStore({
    bucket: options.bucket,
    prefix: options.prefix,
    maxPayloadBytes: options.maxPayloadBytes,
    client: options.client,
  });

  checks.push(await checkRoundTrip(store, `${probeNamespace}round-trip.txt`));
  checks.push(await checkMissingObject(store, `${probeNamespace}missing.txt`));
  checks.push(await checkOverwrite(store, `${probeNamespace}overwrite.txt`));
  checks.push(await checkPrefixIsolation(options, `${probeNamespace}prefix-isolation.txt`));
  checks.push(await checkMaxPayloadGuard(options, `${probeNamespace}max-payload.txt`));

  return Object.freeze({
    ok: checks.every((check) => check.status === "pass"),
    backend: Object.freeze({ adapter: "s3_compatible", client: "injected" }),
    probeNamespace,
    checks: Object.freeze(checks.map((check) => Object.freeze({ ...check }))),
  });
}

async function checkRoundTrip(
  store: S3ArtifactStore,
  key: string,
): Promise<S3CompatibilityValidationCheckResult> {
  try {
    await store.putText(key, VALIDATION_CONTENT, {
      contentType: "text/plain",
      metadata: { validation: "s3-compatibility", check: "round-trip" },
    });
    const readBack = await store.getText(key);
    if (
      readBack?.content !== VALIDATION_CONTENT ||
      readBack.contentType !== "text/plain" ||
      readBack.metadata.validation !== "s3-compatibility" ||
      readBack.metadata.check !== "round-trip"
    ) {
      return fail("round_trip_text", "s3_compatibility_roundtrip_mismatch", "round-trip readback did not match written text artifact");
    }
    return pass("round_trip_text", "round-trip text artifact matched written content, content type, and metadata");
  } catch {
    return dependencyFailure("round_trip_text");
  }
}

async function checkMissingObject(
  store: S3ArtifactStore,
  key: string,
): Promise<S3CompatibilityValidationCheckResult> {
  try {
    const readBack = await store.getText(key);
    if (readBack !== undefined) {
      return fail("missing_object_returns_undefined", "s3_compatibility_missing_object_failed", "missing object did not return the not-found shape");
    }
    return pass("missing_object_returns_undefined", "missing object returned the not-found shape");
  } catch {
    return dependencyFailure("missing_object_returns_undefined");
  }
}

async function checkOverwrite(
  store: S3ArtifactStore,
  key: string,
): Promise<S3CompatibilityValidationCheckResult> {
  try {
    await store.putText(key, OVERWRITE_V1, { contentType: "text/plain" });
    await store.putText(key, OVERWRITE_V2, { contentType: "text/plain" });
    const readBack = await store.getText(key);
    if (readBack?.content !== OVERWRITE_V2) {
      return fail("overwrite_last_write_wins", "s3_compatibility_overwrite_failed", "overwrite did not return the latest written artifact body");
    }
    return pass("overwrite_last_write_wins", "overwrite returned the latest written artifact body");
  } catch {
    return dependencyFailure("overwrite_last_write_wins");
  }
}

async function checkPrefixIsolation(
  options: S3CompatibilityValidationOptions,
  logicalKey: string,
): Promise<S3CompatibilityValidationCheckResult> {
  try {
    const store = new S3ArtifactStore({
      bucket: options.bucket,
      prefix: options.prefix,
      client: options.client,
    });
    await store.putText(logicalKey, VALIDATION_CONTENT, { contentType: "text/plain" });

    if (options.prefix === undefined || options.prefix === "") {
      return pass("prefix_isolation", "no prefix configured; direct backend key matches the logical key by contract");
    }

    const unprefixed = await options.client.getObject({ bucket: options.bucket, key: logicalKey });
    if (unprefixed !== undefined) {
      return fail("prefix_isolation", "s3_compatibility_prefix_isolation_failed", "prefixed adapter write was visible at the unprefixed backend key");
    }
    return pass("prefix_isolation", "prefixed adapter write was isolated from the unprefixed backend key");
  } catch {
    return dependencyFailure("prefix_isolation");
  }
}

async function checkMaxPayloadGuard(
  options: S3CompatibilityValidationOptions,
  key: string,
): Promise<S3CompatibilityValidationCheckResult> {
  try {
    const store = new S3ArtifactStore({
      bucket: options.bucket,
      prefix: options.prefix,
      maxPayloadBytes: 4,
      client: options.client,
    });
    await store.putText(key, "12345", { contentType: "text/plain" });
    return fail("max_payload_guard", "s3_compatibility_max_payload_guard_failed", "oversized payload was accepted before backend write");
  } catch (error) {
    if (error instanceof Error && /maxPayloadBytes/.test(error.message)) {
      return pass("max_payload_guard", "oversized payload was refused before backend write");
    }
    return dependencyFailure("max_payload_guard");
  }
}

function pass(
  name: S3CompatibilityValidationCheckName,
  message: string,
): S3CompatibilityValidationCheckResult {
  return { name, status: "pass", code: "s3_compatibility_pass", message };
}

function fail(
  name: S3CompatibilityValidationCheckName,
  code: Exclude<S3CompatibilityValidationCode, "s3_compatibility_pass" | "s3_compatibility_dependency_failure">,
  message: string,
): S3CompatibilityValidationCheckResult {
  return { name, status: "fail", code, message };
}

function dependencyFailure(name: S3CompatibilityValidationCheckName): S3CompatibilityValidationCheckResult {
  return {
    name,
    status: "fail",
    code: "s3_compatibility_dependency_failure",
    message: "S3-compatible validation dependency failed; backend details were sanitized",
  };
}

function assertSafeProbeId(probeId: string): void {
  if (typeof probeId !== "string" || probeId.trim() !== probeId || !SAFE_PROBE_ID.test(probeId)) {
    throw new Error("probeId must be a safe logical identifier");
  }
}
