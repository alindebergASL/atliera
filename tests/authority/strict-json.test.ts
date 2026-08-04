import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  snapshotStrictJson,
  type StrictJsonLimits,
} from "../../src/authority/strict-json.ts";

const STRING_LIMIT = 2 * 1024 * 1024;

function limits(
  overrides: Partial<StrictJsonLimits> = {},
): StrictJsonLimits {
  return {
    max_array_length: 1_000,
    max_depth: 8,
    max_nodes: 10_000,
    max_object_fields: 64,
    max_string_utf8_bytes: STRING_LIMIT,
    max_total_string_utf8_bytes: 8 * 1024 * 1024,
    max_expanded_json_value_occurrences: 10_000,
    ...overrides,
  };
}

describe("strict JSON expanded-representation budgets", () => {
  test("accepts a property name at the per-string UTF-8 limit and refuses its first excess byte", () => {
    const atLimit = "k".repeat(STRING_LIMIT);
    const overLimit = `${atLimit}x`;

    assert.deepEqual(
      snapshotStrictJson({ [atLimit]: null }, "root", limits()),
      { [atLimit]: null },
    );
    assert.throws(
      () => snapshotStrictJson({ [overLimit]: null }, "root", limits()),
      /property name exceeds the string-size bound/,
    );
  });

  test("charges property names and string values to one cumulative byte budget", () => {
    const compactLimits = limits({
      max_string_utf8_bytes: 8,
      max_total_string_utf8_bytes: 8,
    });

    assert.deepEqual(
      snapshotStrictJson({ "key!": "data" }, "root", compactLimits),
      { "key!": "data" },
    );
    assert.throws(
      () => snapshotStrictJson({ "key!": "datax" }, "root", compactLimits),
      /string value exceeds the cumulative string-size bound/,
    );
    assert.throws(
      () =>
        snapshotStrictJson(
          { "abcd": null, "efghi": null },
          "root",
          compactLimits,
        ),
      /property name exceeds the cumulative string-size bound/,
    );
  });

  test("requires Unicode scalar values in property names", () => {
    for (const malformed of ["\ud800", "\udfff"]) {
      assert.throws(
        () => snapshotStrictJson({ [malformed]: true }, "root", limits()),
        /property name must contain Unicode scalar values only/,
      );
    }

    assert.deepEqual(
      snapshotStrictJson({ "\ud83d\ude00": true }, "root", limits()),
      { "\ud83d\ude00": true },
    );
  });

  test("preflights every object property name before inspecting descriptors", () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, "ok", {
      enumerable: true,
      get() {
        throw new Error("must not execute");
      },
    });
    Object.defineProperty(raw, "abcde", {
      enumerable: true,
      value: null,
    });

    assert.throws(
      () =>
        snapshotStrictJson(
          raw,
          "root",
          limits({ max_string_utf8_bytes: 4 }),
        ),
      /property name exceeds the string-size bound/,
    );
  });

  test("counts every expanded JSON value occurrence, including primitives", () => {
    const exactLimits = limits({ max_expanded_json_value_occurrences: 3 });
    assert.deepEqual(snapshotStrictJson([null, true], "root", exactLimits), [null, true]);
    assert.throws(
      () => snapshotStrictJson([null, true, 0], "root", exactLimits),
      /expanded serialized-value-occurrence bound/,
    );
  });

  test("charges shared DAG aliases per expansion and still accepts a bounded shared shape", () => {
    const sharedRow = Array.from({ length: 1_000 }, () => 0);
    const amplified = Array.from({ length: 1_000 }, () => sharedRow);
    assert.throws(
      () => snapshotStrictJson(amplified, "root", limits()),
      /expanded serialized-value-occurrence bound/,
    );

    const boundedRow = [0, 1];
    const bounded = [boundedRow, boundedRow];
    const snapshot = snapshotStrictJson(bounded, "root", limits()) as unknown[][];
    assert.deepEqual(snapshot, [[0, 1], [0, 1]]);
    assert.notEqual(snapshot[0], snapshot[1]);
  });
});
