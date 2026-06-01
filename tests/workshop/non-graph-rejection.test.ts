import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  GraphFileParseError,
  GraphFileSchemaError,
  loadGraphBundleFile,
} from "../../src/graph/file-store.ts";

// A real validation metrics fixture — sanitized provider-run summary, NOT a
// GraphBundle. It carries fields like preview_ref, output_counts, and
// workshop_surface, and lacks the GraphBundle arrays (sources, excerpts,
// claims, ...). If this file ever sneaks into the render path, the
// summary-vs-source gap reopens.
const METRICS_FIXTURE =
  "fixtures/validation/live-product-preview-20260528a-usefulness-input.json";

// Sanity guard: the rejection regression must not pass for an unrelated
// reason like file-not-found. We hit a missing path first and assert we
// get a *different* error class.
const MISSING_FIXTURE =
  "fixtures/validation/this-path-deliberately-does-not-exist.json";

describe("Workshop render input — non-GraphBundle rejection (regression)", () => {
  test("refuses a validation metrics fixture by GraphBundle shape, not by path", async () => {
    let caught: unknown = null;
    try {
      await loadGraphBundleFile(METRICS_FIXTURE);
    } catch (e) {
      caught = e;
    }

    assert.ok(caught, "load should have thrown for a non-GraphBundle file");

    // Must be the schema/validation error class — not a parse error and not
    // a generic Error. This is the "failure for the right reason" assertion.
    assert.ok(
      caught instanceof GraphFileSchemaError,
      `expected GraphFileSchemaError, got ${(caught as Error)?.name}: ${(caught as Error)?.message}`,
    );
    assert.equal(
      (caught as GraphFileSchemaError).name,
      "GraphFileSchemaError",
    );

    const report = (caught as GraphFileSchemaError).report;
    assert.equal(report.ok, false);
    assert.ok(
      report.hard_failures.length > 0,
      "validation report must include hard failures",
    );

    // The metrics-surface fields must show up as unknown_field hard
    // failures: this proves the rejection is shape-based, not heuristic.
    const codes = new Set(report.hard_failures.map((f) => f.code));
    assert.ok(
      codes.has("unknown_field"),
      `expected an unknown_field failure for metrics fields; got codes: ${[
        ...codes,
      ].join(", ")}`,
    );

    const unknownFieldMessages = report.hard_failures
      .filter((f) => f.code === "unknown_field")
      .map((f) => f.message);
    for (const needle of ["preview_ref", "output_counts", "workshop_surface"]) {
      assert.ok(
        unknownFieldMessages.some((m) => m.includes(needle)),
        `expected an unknown_field failure mentioning ${needle}; saw:\n${unknownFieldMessages.join("\n")}`,
      );
    }

    // Every required GraphBundle array must be flagged as missing —
    // schema_parse_failure with the array name. This is the structural
    // half of the shape rejection.
    assert.ok(
      codes.has("schema_parse_failure"),
      `expected schema_parse_failure for missing GraphBundle arrays; got codes: ${[
        ...codes,
      ].join(", ")}`,
    );
    const parseFailureMessages = report.hard_failures
      .filter((f) => f.code === "schema_parse_failure")
      .map((f) => f.message);
    for (const arrayField of [
      "sources",
      "excerpts",
      "claims",
      "claim_evidence",
      "account_objects",
      "account_object_claims",
      "research_runs",
      "run_artifacts",
      "audit_events",
    ]) {
      assert.ok(
        parseFailureMessages.some((m) =>
          m.includes(`$.${arrayField}`),
        ),
        `expected a schema_parse_failure for missing $.${arrayField}; saw:\n${parseFailureMessages.join("\n")}`,
      );
    }
  });

  test("rejection regression is not satisfied by an unrelated file-not-found error", async () => {
    let caught: unknown = null;
    try {
      await loadGraphBundleFile(MISSING_FIXTURE);
    } catch (e) {
      caught = e;
    }

    // The missing path raises an fs ENOENT-style error — explicitly NOT
    // GraphFileSchemaError. This proves the rejection regression above is
    // pinning shape-based behavior, not opportunistically passing on any
    // failure.
    assert.ok(caught, "missing file should have thrown");
    assert.ok(
      !(caught instanceof GraphFileSchemaError),
      "file-not-found must not be a GraphFileSchemaError",
    );
    assert.ok(
      !(caught instanceof GraphFileParseError),
      "file-not-found must not be a GraphFileParseError",
    );
  });
});
