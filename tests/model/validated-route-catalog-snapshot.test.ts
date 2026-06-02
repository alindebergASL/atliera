import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const FIXTURE = join(import.meta.dirname, "..", "..", "fixtures", "model", "validated-route-catalog-snapshot-20260603.json");

test("validated route catalog snapshot stays sanitized and non-authorizing", () => {
  const snapshot = JSON.parse(readFileSync(FIXTURE, "utf8"));
  assert.equal(snapshot.schema_version, "atliera.validated_model_route_catalog.snapshot.v1");
  assert.equal(snapshot.provider_calls_executed, 0);
  assert.equal(snapshot.provider_spend, false);
  assert.equal(snapshot.runtime_model_mode_integration, false);
  assert.equal(snapshot.default_model_selection_claim, false);
  assert.equal(snapshot.provider_lock_in, false);
  assert.deepEqual(snapshot.candidate_label_examples_not_validated, ["opus-4.8", "gpt-5.6"]);
  assert.equal(snapshot.validated_routes.length, 2);
  assert.deepEqual(snapshot.validated_routes.map((route: { route_ref: string }) => route.route_ref), [
    "gpt-5.5-openai-codex-20260602a",
    "owl-alpha-openrouter-validation-20260601a",
  ]);

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [/api[_-]?key/i, /raw[_-]?(prompt|output|request|response)/i, /source[_-]?text/i, /account[_-]?ref/i, /private[_-]?evidence/i, /default production model/i]) {
    assert.doesNotMatch(serialized, forbidden);
  }
});
