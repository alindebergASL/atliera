import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs/runbooks/live-provider-broader-batch-workshop-preview-status.md");

function assertNoLeakageOrBroadening(label: string, doc: string): void {
  const forbidden = [
    /raw prompt/i,
    /raw provider output/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider body/i,
    /provider metadata/i,
    /auth header/i,
    /credential value/i,
    /secret material/i,
    /request id/i,
    /private evidence path/i,
    /\/tmp\//i,
    /\/home\//i,
    /raw_prompt_committed:\s*true/i,
    /raw_provider_output_committed:\s*true/i,
    /provider_payload_committed:\s*true/i,
    /model_output_committed:\s*true/i,
    /private_evidence_committed:\s*true/i,
    /credential_material_committed:\s*true/i,
    /request_identifier_committed:\s*true/i,
    /private_paths_committed:\s*true/i,
    /preview_html_committed:\s*true/i,
    /preview_screenshot_committed:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes_performed:\s*true/i,
    /workshop_preview_provider_calls:\s*[1-9]/i,
    /workshop_preview_production_writes:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_future_provider_call:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_graph_ingestion:\s*true/i,
    /authorizes_production_use:\s*true/i,
    /authorizes_deployment:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /provider_call_requires_new_approval:\s*false/i,
    /retry_requires_new_approval:\s*false/i,
    /product_preview_expansion_requires_new_approval:\s*false/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
    /provider quality proof/i,
    /provider comparison approved/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(doc, pattern, `${label} contains ${pattern}`);
}

test("live broader batch and Workshop preview status is bounded and sanitized", () => {
  const status = readFileSync(STATUS_DOC, "utf8");

  assert.match(status, /status_id: live-provider-broader-batch-workshop-preview-20260605a/i);
  assert.match(status, /^- provider_api_requests_attempted: 2$/im);
  assert.match(status, /^- provider_calls_executed: 2$/im);
  assert.match(status, /^- rejected_generations: 1$/im);
  assert.match(status, /^- successful_validated_generations: 1$/im);
  assert.match(status, /^- observed_cost_usd: 0$/im);
  assert.match(status, /^- successful_generation_total_tokens: 13483$/im);
  assert.match(status, /^- all_attempts_total_tokens: 27115$/im);
  assert.match(status, /^- account_count: 5$/im);
  assert.match(status, /^- excerpt_count: 10$/im);
  assert.match(status, /^- claim_count: 10$/im);
  assert.match(status, /^- account_object_count: 15$/im);
  assert.match(status, /^- signals_count: 5$/im);
  assert.match(status, /^- maps_count: 5$/im);
  assert.match(status, /^- plays_count: 5$/im);
  assert.match(status, /^- strict_json_ok: true$/im);
  assert.match(status, /^- citation_links_ok: true$/im);
  assert.match(status, /^- per_account_lens_coverage_ok: true$/im);
  assert.match(status, /^- graph_validation_ok: true$/im);
  assert.match(status, /^- graph_validation_hard_failures: 0$/im);
  assert.match(status, /^- workshop_preview_rendered: true$/im);
  assert.match(status, /^- workshop_preview_signals: 5$/im);
  assert.match(status, /^- workshop_preview_maps: 5$/im);
  assert.match(status, /^- workshop_preview_plays: 5$/im);
  assert.match(status, /^- workshop_preview_verified_objects: 15$/im);
  assert.match(status, /^- workshop_preview_provider_calls: 0$/im);
  assert.match(status, /^- workshop_preview_production_writes: false$/im);
  assert.match(status, /^- workshop_preview_non_production_only: true$/im);
  assert.match(status, /^- workshop_preview_html_bytes: 32973$/im);
  assert.match(status, /^- provider_call_requires_new_approval: true$/im);
  assert.match(status, /^- retry_requires_new_approval: true$/im);
  assert.match(status, /^- product_preview_expansion_requires_new_approval: true$/im);

  assertNoLeakageOrBroadening("live broader batch Workshop preview status", status);
});
