import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRuntimeSmokeRetryPromptAmendment,
  normalizeRuntimeSmokeV2AccountObjectTypes,
} from "../../src/product-preview/runtime-smoke-v2-remediation.ts";

const observedExceptionShape = Object.freeze({
  excerpts: Object.freeze([
    Object.freeze({ id: "ex-runtime-1", account_ref: "acct-runtime-smoke-calibration", text: "public-safe excerpt summary" }),
    Object.freeze({ id: "ex-runtime-2", account_ref: "acct-runtime-smoke-calibration", text: "public-safe excerpt summary" }),
    Object.freeze({ id: "ex-runtime-3", account_ref: "acct-runtime-smoke-calibration", text: "public-safe excerpt summary" }),
  ]),
  claims: Object.freeze([
    Object.freeze({ id: "claim-runtime-1", account_ref: "acct-runtime-smoke-calibration", claim: "public-safe claim summary", supporting_excerpt_ids: Object.freeze(["ex-runtime-1"]) }),
    Object.freeze({ id: "claim-runtime-2", account_ref: "acct-runtime-smoke-calibration", claim: "public-safe claim summary", supporting_excerpt_ids: Object.freeze(["ex-runtime-2"]) }),
  ]),
  account_objects: Object.freeze([
    Object.freeze({
      id: "obj-runtime-1",
      account_ref: "acct-runtime-smoke-calibration",
      type: "product_preview_runtime_smoke_summary",
      summary: "public-safe object summary",
      supporting_excerpt_ids: Object.freeze(["ex-runtime-3"]),
    }),
  ]),
});
const [observedAccountObject] = observedExceptionShape.account_objects;
assert.ok(observedAccountObject);

test("normalizes the observed runtime-smoke summary account-object type into a canonical v2 type", () => {
  const normalized = normalizeRuntimeSmokeV2AccountObjectTypes(observedExceptionShape);

  const [accountObject] = normalized.account_objects;
  assert.ok(accountObject);
  assert.equal(accountObject.type, "account_snapshot");
  assert.deepEqual(normalized.excerpts, observedExceptionShape.excerpts);
  assert.deepEqual(normalized.claims, observedExceptionShape.claims);
  assert.notEqual(accountObject, observedAccountObject);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.account_objects), true);
});

test("rejects unknown account-object type labels without reading process.env", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    assert.throws(
      () => normalizeRuntimeSmokeV2AccountObjectTypes({
        ...observedExceptionShape,
        account_objects: [{ ...observedAccountObject, type: "provider_specific_summary" }],
      }),
      /runtime smoke account_object type is not allowed/i,
    );
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});

test("prompt amendment lists only canonical allowed types and the explicit observed synonym", () => {
  const amendment = buildRuntimeSmokeRetryPromptAmendment();

  for (const expected of [
    "Allowed account_object.type values",
    "account_snapshot",
    "signal",
    "risk",
    "play",
    "map",
    "relationship",
    "milestone",
    "recommendation",
    "stakeholder",
    "initiative",
    "open_question",
    "product_preview_runtime_smoke_summary is not a valid output type",
  ]) assert.match(amendment, new RegExp(expected, "i"));

  assert.doesNotMatch(amendment, /authorizes provider call/i);
  assert.doesNotMatch(amendment, /retry allowed/i);
});
