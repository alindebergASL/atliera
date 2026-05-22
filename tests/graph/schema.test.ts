// Schema parser tests.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseGraphBundle } from "../../src/graph/schema.ts";
import { validateGraphBundleRaw } from "../../src/graph/validate.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";

describe("parseGraphBundle", () => {
  it("round-trips the valid bundle", () => {
    const raw = JSON.parse(JSON.stringify(makeValidBundle()));
    const parsed = parseGraphBundle(raw);
    assert.equal(parsed.ok, true);
  });

  it("reports a structural error for a missing top-level array", () => {
    const raw = { ...JSON.parse(JSON.stringify(makeValidBundle())) };
    delete (raw as Record<string, unknown>).sources;
    const parsed = parseGraphBundle(raw);
    assert.equal(parsed.ok, false);
  });

  it("reports an enum failure for an invalid provenance_status", () => {
    const raw = JSON.parse(JSON.stringify(makeValidBundle()));
    raw.claims[0].provenance_status = "totally_legit";
    const parsed = parseGraphBundle(raw);
    assert.equal(parsed.ok, false);
  });

  it("validateGraphBundleRaw surfaces schema parse failures as hard failures", () => {
    const raw = JSON.parse(JSON.stringify(makeValidBundle()));
    raw.excerpts[0].char_start = "zero";
    const report = validateGraphBundleRaw(raw, { mode: "fixture" });
    assert.equal(report.ok, false);
    assert.ok(report.hard_failures.some((f) => f.code === "schema_parse_failure"));
  });
});
