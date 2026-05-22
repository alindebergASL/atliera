import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  parseAtlieraRuntimeConfig,
  type AtlieraRuntimeConfig,
} from "../../src/config/runtime.ts";

describe("parseAtlieraRuntimeConfig", () => {
  it("uses explicit env input and does not invent infrastructure defaults", () => {
    const config = parseAtlieraRuntimeConfig({ ATL_ENV: "lab" });

    assert.deepEqual(config, {
      environment: "lab",
      publicBaseUrl: undefined,
      bindHost: undefined,
      port: undefined,
      databaseUrl: undefined,
      artifactStore: undefined,
      queueBackend: undefined,
      modelProvider: undefined,
    } satisfies AtlieraRuntimeConfig);
  });

  it("parses configured runtime infrastructure values from env", () => {
    const config = parseAtlieraRuntimeConfig({
      ATL_ENV: "production",
      APP_BASE_URL: "https://app.example.invalid",
      HOST: "::",
      PORT: "3000",
      DATABASE_URL: "postgres://atliera:secret@db.example.invalid/atliera",
      ARTIFACT_STORE: "s3://atliera-artifacts-prod",
      QUEUE_BACKEND: "redis",
      MODEL_PROVIDER: "anthropic",
    });

    assert.deepEqual(config, {
      environment: "production",
      publicBaseUrl: "https://app.example.invalid",
      bindHost: "::",
      port: 3000,
      databaseUrl: "postgres://atliera:secret@db.example.invalid/atliera",
      artifactStore: "s3://atliera-artifacts-prod",
      queueBackend: "redis",
      modelProvider: "anthropic",
    } satisfies AtlieraRuntimeConfig);
  });

  it("rejects invalid environment names and unsafe public base URL schemes", () => {
    assert.throws(
      () => parseAtlieraRuntimeConfig({ ATL_ENV: "prod" }),
      /ATL_ENV must be one of/,
    );

    assert.throws(
      () => parseAtlieraRuntimeConfig({ APP_BASE_URL: "javascript:alert(1)" }),
      /APP_BASE_URL must be an http or https URL/,
    );
  });

  it("rejects malformed ports instead of falling back to hidden defaults", () => {
    for (const PORT of ["", "0", "65536", "12.5", "abc"]) {
      assert.throws(
        () => parseAtlieraRuntimeConfig({ PORT }),
        /PORT must be an integer from 1 to 65535/,
      );
    }
  });
});
