import assert from "node:assert/strict";
import test from "node:test";

import {
  collectRuntimeModelOnlyStreamText,
  parseRuntimeModelOnlyProofOutput,
} from "../../src/model/runtime-model-only-live-proof-output-contract.js";

test("collectRuntimeModelOnlyStreamText prefers streaming deltas over duplicate completed item text", () => {
  const result = collectRuntimeModelOnlyStreamText([
    { type: "response.created" },
    { type: "response.output_text.delta", delta: "{\"excerpts\":[]," },
    { type: "response.output_text.delta", delta: "\"claims\":[],\"account_objects\":[]}" },
    {
      type: "response.output_item.done",
      item: {
        content: [
          {
            type: "output_text",
            text: "{\"excerpts\":[],\"claims\":[],\"account_objects\":[]}",
          },
        ],
      },
    },
    { type: "response.completed" },
  ]);

  assert.equal(result.source, "delta");
  assert.equal(result.text, '{"excerpts":[],"claims":[],"account_objects":[]}');
  assert.deepEqual(parseRuntimeModelOnlyProofOutput(result.text), {
    excerpts: [],
    claims: [],
    account_objects: [],
  });
});

test("collectRuntimeModelOnlyStreamText falls back to item_done only when deltas are absent", () => {
  const result = collectRuntimeModelOnlyStreamText([
    {
      type: "response.output_item.done",
      item: {
        content: [
          {
            type: "output_text",
            text: "{\"excerpts\":[],\"claims\":[],\"account_objects\":[]}",
          },
        ],
      },
    },
  ]);

  assert.equal(result.source, "item_done");
  assert.equal(result.text, '{"excerpts":[],"claims":[],"account_objects":[]}');
});

test("parseRuntimeModelOnlyProofOutput rejects duplicate concatenated JSON objects and prose wrappers", () => {
  assert.throws(
    () =>
      parseRuntimeModelOnlyProofOutput(
        '{"excerpts":[],"claims":[],"account_objects":[]}{"excerpts":[],"claims":[],"account_objects":[]}',
      ),
    /runtime_model_only_output_not_strict_json/,
  );

  assert.throws(
    () => parseRuntimeModelOnlyProofOutput('Here is JSON: {"excerpts":[],"claims":[],"account_objects":[]}'),
    /runtime_model_only_output_not_strict_json/,
  );

  assert.throws(
    () => parseRuntimeModelOnlyProofOutput('```json\n{"excerpts":[],"claims":[],"account_objects":[]}\n```'),
    /runtime_model_only_output_not_strict_json/,
  );
});

test("parseRuntimeModelOnlyProofOutput enforces exact top-level keys and array values", () => {
  assert.throws(
    () => parseRuntimeModelOnlyProofOutput('{"excerpts":[],"claims":[],"account_objects":[],"extra":[]}'),
    /runtime_model_only_output_top_level_key_mismatch/,
  );
  assert.throws(
    () => parseRuntimeModelOnlyProofOutput('{"excerpts":{},"claims":[],"account_objects":[]}'),
    /runtime_model_only_output_value_not_array/,
  );
  assert.throws(
    () => parseRuntimeModelOnlyProofOutput('[{"excerpts":[],"claims":[],"account_objects":[]}]'),
    /runtime_model_only_output_not_plain_object/,
  );
});
