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
  "runtime-model-only-controlled-corpus-approval-packet.md",
);

test("controlled-corpus approval packet authorizes exactly one bounded model-only harness run", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: pre-run docs-only approval packet/i,
    /does not execute a provider call/i,
    /exactly one future controlled-corpus model-only validation run/i,
    /Atliera-owned harness boundary merged in PR #187/i,
    /PR #184 recorded a completed tiny synthetic output-contract proof/i,
    /PR #185 defined the promotion boundary/i,
    /PR #186 defined the app-owned model-only harness design/i,
    /PR #187 implemented the deterministic fake-mode harness proof/i,
    /approval_ref: docs\/runbooks\/runtime-model-only-controlled-corpus-approval-packet\.md/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /harness: Atliera model-only harness/i,
    /corpus_ref: controlled-corpus\/model-only-harness-smoke-v1/i,
    /corpus_size: 3 synthetic controlled accounts/i,
    /corpus_roles: representative, edge-case, calibration/i,
    /prompt_contract_ref: prompts\/controlled-corpus-model-only-v1/i,
    /max_provider_calls: 1/i,
    /max_attempts: 1/i,
    /approved_max_cost_usd: 1/i,
    /exact JSON object with `excerpts`, `claims`, and `account_objects` arrays/i,
    /private evidence directory outside repository/i,
    /no tools/i,
    /no shell/i,
    /no file access/i,
    /no web search/i,
    /no plugins/i,
    /no MCP/i,
    /no retrieval/i,
    /no session carryover/i,
    /no production writes/i,
    /no graph ingestion into production state/i,
    /no provider comparison/i,
    /no default model selection/i,
    /no background orchestrator bypass/i,
    /stop after exactly one provider request/i,
    /failed or completed run consumes this approval/i,
    /Any further provider call requires another fresh approval packet/i,
    /raw prompts/i,
    /raw controlled account text/i,
    /raw provider requests/i,
    /raw provider responses/i,
    /model output text/i,
    /private evidence paths/i,
    /Commit only sanitized status in a later status PR/i,
    /status: completed, exception, blocked, or rejected/i,
    /status: pre_run_approval/i,
    /provider_call_executed_in_this_pr: false/i,
    /authorizes_provider_call: true/i,
    /authorizes_provider_call_count: 1/i,
    /authorizes_controlled_corpus_run: true/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /default_model_selection_claim: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
    /retry_requires_new_approval: true/i,
  ]) {
    assert.match(doc, required, `approval packet must contain ${required}`);
  }

  for (const forbidden of [
    /provider_call_executed_in_this_pr: true/i,
    /authorizes_provider_call_count: [2-9]/i,
    /max_provider_calls: [2-9]/i,
    /max_attempts: [2-9]/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /provider_lock_in: true/i,
    /production_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /launch_readiness_claim: true/i,
    /default production model/i,
    /production ready/i,
    /launch ready/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `approval packet must not contain ${forbidden}`);
  }
});
