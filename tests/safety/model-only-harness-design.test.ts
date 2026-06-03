import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "model-only-harness-design.md");

test("model-only harness design defines app-owned boundary without authorizing live work or orchestrator bypass", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-call harness design/i,
    /application-owned model-only harness/i,
    /Hermes-like orchestration may operate around this harness, but must not bypass it/i,
    /at most one injected model transport call/i,
    /job_id: safe logical ID/i,
    /idempotency_key: safe logical ID/i,
    /approval_ref: durable approval packet reference/i,
    /route_ref: approved route reference/i,
    /corpus_ref: approved controlled corpus reference/i,
    /max_attempts: exactly 1/i,
    /approved_max_cost_usd/i,
    /exact JSON object with `excerpts`, `claims`, and `account_objects` arrays/i,
    /no tools, no shell, no file access, no web search, no plugins, no MCP, no retrieval, no session carryover/i,
    /pending/i,
    /approved/i,
    /running/i,
    /completed, exception, blocked, or rejected/i,
    /No terminal status may be overwritten/i,
    /No implicit retry/i,
    /validate before transport access/i,
    /exact top-level request keys/i,
    /approval route\/provider\/model\/transport match/i,
    /corpus and prompt contract scope/i,
    /all no-tools\/no-shell\/no-file\/no-web\/no-plugin\/no-MCP\/no-retrieval\/no-session flags are closed/i,
    /owns no provider SDK import/i,
    /no credential read/i,
    /no network implementation in source/i,
    /injected by caller/i,
    /validated frozen request snapshot/i,
    /cannot be invoked more than once per job/i,
    /Raw evidence remains outside the repository/i,
    /raw provider requests/i,
    /raw provider responses/i,
    /model output text/i,
    /private evidence paths/i,
    /stable public error code/i,
    /prepare approval packets/i,
    /trigger predefined harness jobs after explicit approval/i,
    /directly call providers for product runtime work/i,
    /directly mutate production graph state/i,
    /retry without fresh approval/i,
    /choose a default model/i,
    /Fake-mode proof required before live controlled-corpus execution/i,
    /exact request validation/i,
    /one injected transport invocation at most/i,
    /no process\.env read/i,
    /provider_call_executed_in_this_pr: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_controlled_corpus_run: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]) {
    assert.match(doc, required, `harness design must contain ${required}`);
  }

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_controlled_corpus_run: true/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /provider_lock_in: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /default production model/i,
    /production ready/i,
    /launch ready/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `harness design must not contain ${forbidden}`);
  }
});
