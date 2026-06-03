import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "runbooks",
  "runtime-model-only-live-proof-output-contract-compatibility.md",
);

test("output-contract compatibility runbook is no-call and non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-call output-contract design and guardrail/i,
    /do not execute a provider call and do not authorize a provider call/i,
    /Sanitized category: stream_output_collection_contract/i,
    /collect `response\.output_text\.delta` text as the canonical streamed output/i,
    /`response\.output_item\.done` text as a fallback only when no delta text was observed/i,
    /never concatenate delta text and completed item text/i,
    /parse exactly one strict JSON object/i,
    /exactly these top-level keys: `excerpts`, `claims`, `account_objects`/i,
    /reject duplicate concatenated JSON objects/i,
    /reject markdown fences/i,
    /reject prose before or after JSON/i,
    /reject extra top-level keys/i,
    /reject non-array top-level values/i,
    /provider_call_executed_in_this_pr: false/i,
    /adds_runtime_provider_call_source: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_candidate_calls: false/i,
    /authorizes_comparison_run: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no session carryover/i,
    /raw evidence private\/out of repo/i,
    /separate docs\/tests approval packet/i,
    /separate later status PR/i,
  ]) {
    assert.match(doc, required, `runbook must contain: ${required}`);
  }

  for (const forbidden of [
    /provider_call_executed_in_this_pr: true/i,
    /adds_runtime_provider_call_source: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_candidate_calls: true/i,
    /authorizes_comparison_run: true/i,
    /default model selected/i,
    /provider_lock_in: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /status: completed/i,
    /accepted_output_received: true/i,
    /raw prompt/i,
    /raw request body/i,
    /raw response body/i,
    /private evidence path/i,
    /credential value/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `runbook must not contain: ${forbidden}`);
  }
});
