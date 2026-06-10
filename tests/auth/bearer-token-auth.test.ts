import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeBearerTokenRequest,
  parseLocalBearerAuthConfig,
} from "../../src/auth/bearer-token-auth.ts";

test("bearer token auth denies missing and invalid tokens without leaking expected or supplied token", () => {
  const config = parseLocalBearerAuthConfig({ ATLIERA_LOCAL_BEARER_TOKEN: "fixture-secret-token" });

  const missing = authorizeBearerTokenRequest({}, config);
  assert.equal(missing.ok, false);
  assert.equal(missing.status, "missing");
  assert.equal(JSON.stringify(missing), JSON.stringify(JSON.parse(JSON.stringify(missing))));
  assert.doesNotMatch(JSON.stringify(missing), /fixture-secret-token|wrong-token/i);

  const invalid = authorizeBearerTokenRequest({ authorization: "Bearer wrong-token" }, config);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, "invalid");
  assert.doesNotMatch(JSON.stringify(invalid), /fixture-secret-token|wrong-token/i);

  const shortToken = authorizeBearerTokenRequest({ authorization: "Bearer x" }, config);
  assert.equal(shortToken.ok, false);
  assert.equal(shortToken.status, "invalid");

  const longToken = authorizeBearerTokenRequest({ authorization: "Bearer fixture-secret-token-extra" }, config);
  assert.equal(longToken.ok, false);
  assert.equal(longToken.status, "invalid");
});

test("bearer token auth accepts exact bearer token case-insensitively for the scheme only", () => {
  const config = parseLocalBearerAuthConfig({ ATLIERA_LOCAL_BEARER_TOKEN: "fixture-secret-token" });

  assert.equal(authorizeBearerTokenRequest({ Authorization: "Bearer fixture-secret-token" }, config).ok, true);
  assert.equal(authorizeBearerTokenRequest({ Authorization: "bearer fixture-secret-token" }, config).ok, true);
  assert.equal(authorizeBearerTokenRequest({ Authorization: "Bearer FIXTURE-SECRET-TOKEN" }, config).ok, false);
});

test("bearer token auth requires explicit local-dev disable and rejects blank token config", () => {
  assert.throws(
    () => parseLocalBearerAuthConfig({}),
    /ATLIERA_LOCAL_BEARER_TOKEN is required unless auth is explicitly disabled/,
  );
  assert.throws(
    () => parseLocalBearerAuthConfig({ ATLIERA_LOCAL_BEARER_TOKEN: "   " }),
    /ATLIERA_LOCAL_BEARER_TOKEN must be non-empty/,
  );

  const disabled = parseLocalBearerAuthConfig({ ATLIERA_LOCAL_AUTH_MODE: "disabled-local-dev" });
  const result = authorizeBearerTokenRequest({}, disabled);
  assert.equal(result.ok, true);
  assert.equal(result.status, "disabled-local-dev");
});

test("bearer token auth parser is pure and does not read process.env", () => {
  const original = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read by bearer auth parser");
    },
  });
  try {
    const config = parseLocalBearerAuthConfig({ ATLIERA_LOCAL_BEARER_TOKEN: "fixture-secret-token" });
    assert.equal(authorizeBearerTokenRequest({ authorization: "Bearer fixture-secret-token" }, config).ok, true);
  } finally {
    if (original) Object.defineProperty(process, "env", original);
  }
});
