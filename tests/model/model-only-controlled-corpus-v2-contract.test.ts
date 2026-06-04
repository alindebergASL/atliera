import assert from "node:assert/strict";
import test from "node:test";

import {
  parseControlledCorpusV2ModelOnlyOutput,
  validateControlledCorpusV2ModelOnlyOutput,
} from "../../src/model/model-only-controlled-corpus-v2-contract.ts";

const validOutput = {
  excerpts: [
    { id: "ex-rep-1", account_ref: "acct-representative", text: "public-safe excerpt summary" },
    { id: "ex-edge-1", account_ref: "acct-edge-case", text: "public-safe excerpt summary" },
    { id: "ex-cal-1", account_ref: "acct-calibration", text: "public-safe excerpt summary" },
  ],
  claims: [
    {
      id: "claim-rep-1",
      account_ref: "acct-representative",
      claim: "public-safe claim summary",
      supporting_excerpt_ids: ["ex-rep-1"],
    },
    {
      id: "claim-edge-1",
      account_ref: "acct-edge-case",
      claim: "public-safe claim summary",
      supporting_excerpt_ids: ["ex-edge-1"],
    },
    {
      id: "claim-cal-1",
      account_ref: "acct-calibration",
      claim: "public-safe claim summary",
      supporting_excerpt_ids: ["ex-cal-1"],
    },
  ],
  account_objects: [
    {
      id: "obj-rep-1",
      account_ref: "acct-representative",
      type: "Signal",
      summary: "public-safe object summary",
      supporting_excerpt_ids: ["ex-rep-1"],
    },
    {
      id: "obj-edge-1",
      account_ref: "acct-edge-case",
      type: "Play",
      summary: "public-safe object summary",
      supporting_excerpt_ids: ["ex-edge-1"],
    },
    {
      id: "obj-cal-1",
      account_ref: "acct-calibration",
      type: "Map",
      summary: "public-safe object summary",
      supporting_excerpt_ids: ["ex-cal-1"],
    },
  ],
} as const;

test("controlled-corpus v2 contract accepts canonical account_ref and provenance on all objects", () => {
  const parsed = parseControlledCorpusV2ModelOnlyOutput(JSON.stringify(validOutput));

  assert.deepEqual(parsed.counts, { excerpts: 3, claims: 3, account_objects: 3 });
  assert.deepEqual(parsed.account_refs, ["acct-calibration", "acct-edge-case", "acct-representative"]);
  assert.equal(parsed.provenance_complete, true);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.output), true);
});

test("controlled-corpus v2 contract rejects account_objects without nonempty support", () => {
  const unsupported = {
    ...validOutput,
    account_objects: [{ ...validOutput.account_objects[0], supporting_excerpt_ids: [] }],
  };

  assert.throws(
    () => validateControlledCorpusV2ModelOnlyOutput(unsupported),
    /account_object supporting_excerpt_ids must be nonempty/i,
  );
});

test("controlled-corpus v2 contract rejects support ids that do not resolve to known excerpts", () => {
  const unknownSupport = {
    ...validOutput,
    claims: [{ ...validOutput.claims[0], supporting_excerpt_ids: ["ex-missing"] }],
  };

  assert.throws(
    () => validateControlledCorpusV2ModelOnlyOutput(unknownSupport),
    /supporting_excerpt_ids must resolve to known excerpt ids/i,
  );
});

test("controlled-corpus v2 contract rejects display-name-only account labels and account_ref mismatches", () => {
  const displayNameOnly = {
    ...validOutput,
    account_objects: [{ id: "obj-display", account: "Display Name", type: "Signal", supporting_excerpt_ids: ["ex-rep-1"] }],
  };
  assert.throws(
    () => validateControlledCorpusV2ModelOnlyOutput(displayNameOnly),
    /account_ref is required/i,
  );

  const mismatch = {
    ...validOutput,
    account_objects: [{ ...validOutput.account_objects[0], account_ref: "acct-edge-case" }],
  };
  assert.throws(
    () => validateControlledCorpusV2ModelOnlyOutput(mismatch),
    /account_ref must match supporting excerpt account_ref/i,
  );
});

test("controlled-corpus v2 contract sanitizes hostile accessors and does not read process.env", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const hostile = {
      ...validOutput,
      account_objects: [
        {
          ...validOutput.account_objects[0],
          get supporting_excerpt_ids() {
            throw new Error("raw getter detail must not leak");
          },
        },
      ],
    };
    assert.throws(
      () => validateControlledCorpusV2ModelOnlyOutput(hostile),
      /controlled-corpus v2 (output rejected|supporting_excerpt_ids is required)/i,
    );
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});
