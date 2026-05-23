import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import {
  assertRuntimePreflightPasses,
  runRuntimePreflight,
} from "../../src/runtime/preflight.ts";

describe("runtime preflight seam", () => {
  it("passes incomplete config for non-production environments without inventing infrastructure", () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "test" });

    const report = runRuntimePreflight(config);

    assert.equal(report.ok, true);
    assert.equal(report.environment, "test");
    assert.deepEqual(report.failures, []);
    assert.deepEqual(report.warnings, []);
  });

  it("requires explicit production infrastructure choices before runtime launch", () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "production" });

    const report = runRuntimePreflight(config);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.failures.map((failure) => failure.code),
      [
        "missing_public_base_url",
        "missing_database_url",
        "missing_artifact_store",
        "missing_queue_backend",
        "missing_model_provider",
      ],
    );
  });

  it("requires explicit staging infrastructure choices before runtime launch", () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "staging" });

    const report = runRuntimePreflight(config);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.failures.map((failure) => failure.code),
      [
        "missing_public_base_url",
        "missing_database_url",
        "missing_artifact_store",
        "missing_queue_backend",
        "missing_model_provider",
      ],
    );
  });

  it("passes production preflight only when required infrastructure config is supplied", () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "production",
      APP_BASE_URL: "https://app.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });

    const report = runRuntimePreflight(config);

    assert.equal(report.ok, true);
    assert.deepEqual(report.failures, []);
  });

  it("rejects test-only adapters in production-like environments", () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "production",
      APP_BASE_URL: "https://app.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
      MODEL_PROVIDER: "fake",
    });

    const report = runRuntimePreflight(config);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.failures.map((failure) => failure.code),
      [
        "production_artifact_store_must_be_durable",
        "production_queue_backend_must_be_durable",
        "production_model_provider_must_be_real",
      ],
    );
  });

  it("allows test-only adapters outside production-like environments", () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "lab",
      ARTIFACT_STORE: "memory",
      QUEUE_BACKEND: "memory",
      MODEL_PROVIDER: "fake",
    });

    const report = runRuntimePreflight(config);

    assert.equal(report.ok, true);
    assert.deepEqual(report.failures, []);
  });

  it("throws with preflight failure details when assertions fail", () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "production" });

    assert.throws(
      () => assertRuntimePreflightPasses(config),
      /runtime preflight failed: missing_public_base_url, missing_database_url, missing_artifact_store, missing_queue_backend, missing_model_provider/,
    );
  });
});
