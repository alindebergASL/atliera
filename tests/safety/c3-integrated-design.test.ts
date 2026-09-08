import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("recorded runbook describes current enhanced revision without the old double-submit detour", () => {
  const text = readFileSync("docs/runbooks/c3-local-working-journey.md", "utf8");
  assert.ok(text.includes("`/api/revise` then `/api/generate` paths behind one user action"));
  assert.ok(text.includes("non-JavaScript forms retain their safe fallback"));
  assert.doesNotMatch(text, /still uses the real.*returns to Prepare before the revision can be replayed/);
});

test("integrated design guide preserves mode and delivery boundaries", () => {
  const text = readFileSync("docs/guides/c3-integrated-design.md", "utf8");
  for (const required of [
    "issues/327", "Account → Prepare → Brief → Refine", "serve-recorded",
    "acc_university_of_utah", "acc_university_of_missouri",
    "exact recorded requests", "three main questions", "session-only",
    "not human approval", "not customer acceptance", "external-and-nonbinding",
    "authorizes_live_product_generation: false", "authorizes_retrieval: false",
    "authorizes_durable_product_writes: false", "authorizes_deployment: false",
    "authorizes_sharing_or_approval: false", "customer_acceptance: not_established",
    "text-CAS", "not monotonic", "320", "390", "1280", "1440",
  ]) assert.ok(text.includes(required), required);
  assert.doesNotMatch(text, /authorizes_[a-z_]+:\s*true|customer_acceptance:\s*(?:passed|approved)/);
  assert.doesNotMatch(text, /\/home\/[a-z]+\/|BEGIN [A-Z ]*PRIVATE KEY/);
});
