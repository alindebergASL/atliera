import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const STATUS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-status.md");
const APPROVAL_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-approval.md");
const DIRECTION_DOC = join(REPO_ROOT, "docs", "runbooks", "hermes-gpt55-model-only-transport-direction.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

test("safety: live product preview GPT-5.5 comparison status is sanitized and bounded", () => {
  const status = readRepoFile(STATUS_DOC);
  const approval = readRepoFile(APPROVAL_DOC);
  const direction = readRepoFile(DIRECTION_DOC);

  for (const required of [
    /Status: sanitized successful bounded comparison status/i,
    /live-product-preview-gpt55-comparison-20260602a/i,
    /approval packet: `docs\/runbooks\/live-product-preview-gpt55-comparison-approval\.md`/i,
    /validated_commit: `1c6f8d8eccc4f1809bd7ac5b3834fedde3619255`/i,
    /candidate route: `openai-codex`/i,
    /candidate model: `gpt-5\.5`/i,
    /baseline reference: `live-product-preview-six-slot-20260601a`/i,
    /baseline route: `owl-alpha`/i,
    /provider_calls_approved: 6/i,
    /provider_calls_executed: 6/i,
    /ok_slot_count: 6/i,
    /activation_gates: pass/i,
    /credential_status: pass/i,
    /provider_call: pass/i,
    /response_contract: pass/i,
    /cost_ledger_entry: pass/i,
    /packaging_ok: pass/i,
    /bootstrap_ok: pass/i,
    /workshop_preview_ok: pass/i,
    /full_pipeline_quality_gate_status: pass/i,
    /output_counts: excerpts=18, claims=18, account_objects=18/i,
    /graph_supported_lens_item_counts: signals=6, maps=6, plays=6/i,
    /lens_evidence_packet_counts: signals=6, maps=6, plays=6/i,
    /tokens: input=5929, output=4630/i,
    /observed_cost_usd: 0/i,
    /estimated_cost_usd: 0\.06/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /raw_evidence_committed: false/i,
    /private_wrapper_committed: false/i,
    /private_runner_committed: false/i,
    /credentials_committed: false/i,
    /private_source_text_committed: false/i,
    /production_writes: false/i,
    /runtime_model_mode_integration: false/i,
    /web_search_requested: false/i,
    /tools_or_plugins_requested: false/i,
    /paid_fallback_used: false/i,
    /launch_readiness_claim: false/i,
    /product_readiness_claim: false/i,
    /production_readiness_claim: false/i,
    /default_production_model_selection: false/i,
    /broad_model_quality_claim: false/i,
    /provider_lock_in: false/i,
    /no_post_output_substitution_used: true/i,
    /corpus_expansion_beyond_approved_slots: false/i,
  ]) {
    assert.match(status, required);
  }

  assert.match(status, /bounded comparison signal/i);
  assert.match(status, /not a launch-readiness, product-readiness, production-readiness, broad model-quality, or default-model-selection claim/i);
  assert.match(status, /next step: separate no-spend comparison usefulness assessment/i);
  assert.match(approval, /comparison name: `live-product-preview-gpt55-comparison-20260602a`/i);
  assert.match(direction, /live-product-preview-gpt55-comparison-status\.md/i);

  for (const forbidden of [
    /\/home\//i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /(?:^|\s)token\s*[:=]/i,
    /raw[_ -]?request\s*[:=]/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?transcript\s*[:=]/i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /source_text\s*[:=]/i,
    /account_ref\s*[:=]/i,
    /provider_call:\s*fail/i,
    /response_contract:\s*fail/i,
    /launch_readiness_claim: true/i,
    /product_readiness_claim: true/i,
    /production_readiness_claim: true/i,
    /default_production_model_selection: true/i,
    /broad_model_quality_claim: true/i,
  ]) {
    assert.doesNotMatch(status, forbidden);
  }
});
