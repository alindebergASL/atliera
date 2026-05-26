import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import { parseAtlieraRuntimeConfig } from "../../src/config/runtime.ts";
import {
  defineResourcePreflightCheck,
  runResourcePreflight,
} from "../../src/runtime/resource-preflight.ts";

describe("resource preflight shape", () => {
  it("does not run live checks when pure config preflight has already failed", async () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "production" });
    let ran = false;

    const report = await runResourcePreflight(config, [
      defineResourcePreflightCheck({
        target: "database",
        name: "db reachable",
        run: () => {
          ran = true;
          return { status: "pass", code: "reachable", message: "ok" };
        },
      }),
    ]);

    assert.equal(ran, false);
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.failures.map((failure) => failure.code),
      ["config_preflight_failed"],
    );
    assert.equal(report.checks.length, 0);
  });

  it("requires explicit production-like resource checks for every configured live dependency", async () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "production",
      APP_BASE_URL: "https://app.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });

    const report = await runResourcePreflight(config, [
      defineResourcePreflightCheck({
        target: "database",
        name: "db reachable",
        run: () => ({ status: "pass", code: "reachable", message: "ok" }),
      }),
    ]);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.failures.map((failure) => failure.code),
      [
        "missing_artifact_store_resource_check",
        "missing_queue_backend_resource_check",
        "missing_model_provider_resource_check",
      ],
    );
  });

  it("aggregates passing live dependency checks without constructing clients itself", async () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "staging",
      APP_BASE_URL: "https://staging.example.invalid",
      DATABASE_URL: "postgres://db.example.invalid/atliera",
      ARTIFACT_STORE: "object-store",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });
    const executed: string[] = [];

    const report = await runResourcePreflight(config, [
      defineResourcePreflightCheck({
        target: "database",
        name: "database ping",
        run: () => {
          executed.push("database");
          return {
            status: "pass",
            code: "reachable",
            message: "database reachable",
            metadata: { adapter: "postgres", latencyMs: 12 },
          };
        },
      }),
      defineResourcePreflightCheck({
        target: "artifact_store",
        name: "artifact write probe",
        run: async () => {
          executed.push("artifact_store");
          return { status: "pass", code: "writable", message: "artifact store writable" };
        },
      }),
      defineResourcePreflightCheck({
        target: "queue_backend",
        name: "queue enqueue probe",
        run: () => {
          executed.push("queue_backend");
          return { status: "pass", code: "enqueueable", message: "queue enqueueable" };
        },
      }),
      defineResourcePreflightCheck({
        target: "model_provider",
        name: "model credential probe",
        run: () => {
          executed.push("model_provider");
          return { status: "pass", code: "credentials_present", message: "provider credentials present" };
        },
      }),
    ]);

    assert.deepEqual(executed, [
      "database",
      "artifact_store",
      "queue_backend",
      "model_provider",
    ]);
    assert.equal(report.ok, true);
    assert.equal(report.environment, "staging");
    assert.deepEqual(report.failures, []);
    assert.equal(report.checks.length, 4);
    assert.ok(report.checks[0]);
    assert.deepEqual(report.checks[0].metadata, { adapter: "postgres", latencyMs: 12 });
  });

  it("turns failed checks and thrown checks into sanitized failures", async () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "lab" });

    const report = await runResourcePreflight(config, [
      defineResourcePreflightCheck({
        target: "artifact_store",
        name: "artifact read probe",
        run: () => ({
          status: "fail",
          code: "permission_denied",
          message: "artifact store permission denied",
        }),
      }),
      defineResourcePreflightCheck({
        target: "queue_backend",
        name: "queue probe",
        run: () => {
          throw new Error("redis://user:super-secret@example.invalid/0");
        },
      }),
    ]);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.failures.map((failure) => failure.code),
      ["permission_denied", "resource_check_threw"],
    );
    assert.ok(report.failures[1]);
    assert.equal(report.failures[1].message, "queue_backend resource check threw");
    assert.match(JSON.stringify(report), /permission denied/);
    assert.doesNotMatch(JSON.stringify(report), /super-secret/);
  });

  it("rejects unsafe check metadata before it can enter reports", async () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "lab" });

    const report = await runResourcePreflight(config, [
      defineResourcePreflightCheck({
        target: "model_provider",
        name: "unsafe metadata",
        run: () => ({
          status: "pass",
          code: "credentials_present",
          message: "ok",
          metadata: { apiKey: "should-not-appear" },
        }),
      }),
    ]);

    assert.equal(report.ok, false);
    assert.deepEqual(
      report.failures.map((failure) => failure.code),
      ["unsafe_resource_check_metadata"],
    );
    assert.doesNotMatch(JSON.stringify(report), /should-not-appear/);
  });

  it("rejects malformed check results instead of treating untyped adapter output as passing", async () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "lab" });

    const malformedResults = [
      { status: "ok", code: "reachable", message: "ok" },
      null,
      undefined,
      "pass",
      Object.defineProperties({}, {
        status: {
          enumerable: true,
          get() {
            throw new Error("postgres://resource.internal/atliera?password=secret");
          },
        },
        code: { enumerable: true, value: "reachable" },
        message: { enumerable: true, value: "ok" },
      }),
      {
        status: "pass",
        code: "reachable",
        message: "ok",
        metadata: Object.defineProperty({}, "detail", {
          enumerable: true,
          get() {
            throw new Error("postgres://metadata.internal/atliera?token=secret");
          },
        }),
      },
    ];

    for (const malformedResult of malformedResults) {
      const report = await runResourcePreflight(config, [
        defineResourcePreflightCheck({
          target: "database",
          name: "malformed probe",
          run: () => malformedResult as never,
        }),
      ]);

      assert.equal(report.ok, false);
      assert.deepEqual(
        report.failures.map((failure) => failure.code),
        ["malformed_resource_check_result"],
      );
      assert.equal(report.checks.length, 0);
      assert.doesNotMatch(JSON.stringify(report), /postgres|password|token|secret|resource\.internal|metadata\.internal/i);
    }
  });

  it("snapshots validated check results and metadata without rereading untrusted adapters", async () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "lab" });
    let readCount = 0;
    const result = new Proxy(
      {
        status: "pass",
        code: "reachable",
        message: "ok",
        metadata: { detail: "safe" },
      },
      {
        get(target, property, receiver) {
          if (property === "then") {
            return undefined;
          }
          readCount += 1;
          if (property === "message" || property === "metadata") {
            return property === "message"
              ? "postgres://resource.internal/atliera?password=secret"
              : { password: "secret" };
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );

    const report = await runResourcePreflight(config, [
      defineResourcePreflightCheck({
        target: "database",
        name: "snapshot probe",
        run: () => result as never,
      }),
    ]);

    assert.equal(report.ok, true);
    assert.deepEqual(report.checks, [
      {
        target: "database",
        name: "snapshot probe",
        status: "pass",
        code: "reachable",
        message: "ok",
        metadata: { detail: "safe" },
      },
    ]);
    assert.equal(readCount, 0);
    assert.doesNotMatch(JSON.stringify(report), /postgres|password|secret|resource\.internal/i);
  });

  it("does not read process.env while defining or running the resource preflight shape", async () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "test" });
    const originalEnv = process.env;
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env should not be read by resource preflight");
      },
    });

    try {
      const report = await runResourcePreflight(config, [
        defineResourcePreflightCheck({
          target: "database",
          name: "db probe",
          run: () => ({ status: "pass", code: "reachable", message: "ok" }),
        }),
      ]);
      assert.equal(report.ok, true);
    } finally {
      Object.defineProperty(process, "env", {
        configurable: true,
        writable: true,
        value: originalEnv,
      });
    }
  });
});
