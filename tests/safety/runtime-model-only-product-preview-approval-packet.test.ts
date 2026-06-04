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
  "runtime-model-only-product-preview-approval-packet.md",
);

test("runtime model-only product-preview approval packet is bounded and docs-only", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: pre-run docs-only approval packet/i,
    /This PR does not execute a provider call/i,
    /Derived facts: `runtime-model-only-controlled-corpus-v2-derived-usefulness-facts\.md`/i,
    /Approval consumes exactly one future product-preview model-only attempt/i,
    /max_attempts: 1/i,
    /max_provider_calls: 1/i,
    /approved_max_cost_usd: 1/i,
    /route_ref: gpt-5\.5-openai-codex-20260602a/i,
    /provider_ref: openai-codex/i,
    /model_label: gpt-5\.5/i,
    /transport_kind: model-only-codex-auth/i,
    /runtime_surface: app-owned-model-only-harness/i,
    /corpus_ref: product-preview\/single-screened-account-v1/i,
    /prompt_contract_ref: prompts\/product-preview-model-only-v1/i,
    /output_contract_ref: src\/model\/model-only-controlled-corpus-v2-contract\.ts/i,
    /screened_account_slots: 1/i,
    /tools: false/i,
    /web_search: false/i,
    /plugins: false/i,
    /mcp: false/i,
    /shell: false/i,
    /file_access: false/i,
    /retrieval: false/i,
    /production_writes: false/i,
    /graph_ingestion: false/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_call: true/i,
    /authorizes_retry: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /status_followup_required: true/i,
    /raw_or_model_output_must_remain_private: true/i,
    /No execution may occur in this approval PR/i,
  ]) {
    assert.match(doc, required, `approval doc must contain ${required}`);
  }

  for (const forbidden of [
    /max_attempts: [2-9]/i,
    /max_provider_calls: [2-9]/i,
    /approved_max_cost_usd: [2-9]/i,
    /authorizes_retry: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /tools: true/i,
    /web_search: true/i,
    /plugins: true/i,
    /mcp: true/i,
    /shell: true/i,
    /file_access: true/i,
    /retrieval: true/i,
    /production_writes: true/i,
    /graph_ingestion: true/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    /private-provider-evidence/i,
    /raw_provider_output_text/i,
    /raw_harness_transport_request/i,
    /raw_provider_metadata/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `approval doc must not contain ${forbidden}`);
  }
});
