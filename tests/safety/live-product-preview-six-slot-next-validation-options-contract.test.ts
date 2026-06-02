import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const OPTIONS_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-six-slot-next-validation-options.md");
const SIX_SLOT_ASSESSMENT_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-six-slot-usefulness-assessment.md");
const OWL_ALPHA_FRAMING_DOC = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?|name)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /raw[_ -]?prompt\s*[:=]/i,
    /wrapper\s*log\s*[:=]/i,
    /source_text\s*[:=]/i,
    /account_ref\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
    /lab\d*\.[a-z0-9-]+\.[a-z]{2,}/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeAuthorization(label: string, text: string): void {
  for (const pattern of [
    /(?:authorizes|approves|allows|enables)\s+(?:a\s+)?(?:live provider call|provider spend|provider comparison|model comparison|corpus expansion|product-preview expansion|production write|production deployment|runtime\/model-mode integration|web search|tools?\/plugins?)/i,
    /provider calls? (?:is|are )?(?:approved|authorized|allowed|enabled)/i,
    /provider spend (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /provider\/model comparison (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /launch readiness (?:is )?(?:proven|established|approved|claimed|implied)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed|implied)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed|implied)/i,
    /broad (?:provider|model) quality (?:is )?(?:proven|established|approved|claimed|implied)/i,
    /multi-account readiness (?:is )?(?:proven|established|approved|claimed|implied)/i,
    /readiness_claim"?\s*:\s*true/i,
    /approves_[a-z_]*"?\s*:\s*true/i,
    /web_search_requested"?\s*:\s*true/i,
    /tools_or_plugins_requested"?\s*:\s*true/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: six-slot next validation options", async (t) => {
  await t.test("records a no-spend option analysis and recommends GPT-5.5 approval packet", () => {
    const docs = readRepoFile(OPTIONS_DOC);

    assert.match(docs, /Six-Slot Product Preview Next Validation Options/i);
    assert.match(docs, /Status: no-spend option analysis/i);
    assert.match(docs, /live-product-preview-six-slot-status\.md/i);
    assert.match(docs, /live-product-preview-six-slot-usefulness-assessment\.md/i);
    assert.match(docs, /preview_ref: `live-product-preview-six-slot-20260601a`/i);
    assert.match(docs, /provider route already exercised: OpenRouter `owl-alpha`/i);
    assert.match(docs, /account_count: 6/i);
    assert.match(docs, /provider_calls_executed: 6/i);
    assert.match(docs, /preview_usefulness_classification: `useful`/i);
    assert.match(docs, /Option A — Stop and harden the current Owl Alpha path/i);
    assert.match(docs, /Option B — Bounded GPT-5\.5 provider-quality comparison approval packet/i);
    assert.match(docs, /Classification: `recommended-next-approval-packet`/i);
    assert.match(docs, /model route: GPT-5\.5 through Codex authentication when feasible/i);
    assert.match(docs, /provider boundary: the same provider-neutral Atliera `ModelProvider` \/ external-command seam/i);
    assert.match(docs, /using Codex authentication avoids introducing a separate credential path when feasible/i);
    assert.match(docs, /Decision: recommended next step, but only as a future separate docs-only approval PR/i);
    assert.match(docs, /Option C — Bounded Opus provider-quality comparison approval packet/i);
    assert.match(docs, /Option D — Expand the Owl Alpha corpus/i);
    assert.match(docs, /Classification: `premature-expansion`/i);
    assert.match(docs, /Option E — Move toward runtime\/product integration/i);
    assert.match(docs, /Classification: `premature-integration`/i);
    assert.match(docs, /Recommended next action: create a separate docs-only approval packet for a bounded GPT-5\.5 provider-quality comparison slice using Codex authentication when feasible/i);
    assertNoPrivateLeakage("six-slot options doc", docs);
    assertNoScopeAuthorization("six-slot options doc", docs);
  });

  await t.test("preserves explicit false safety markers", () => {
    const docs = readRepoFile(OPTIONS_DOC);
    for (const required of [
      /approves_live_provider_call: false/i,
      /approves_provider_spend: false/i,
      /approves_provider_or_model_comparison: false/i,
      /approves_corpus_expansion: false/i,
      /approves_product_preview_expansion: false/i,
      /approves_runtime_model_mode_integration: false/i,
      /approves_production_writes: false/i,
      /web_search_or_tools: false/i,
      /launch_readiness_claim: false/i,
      /product_readiness_claim: false/i,
      /production_readiness_claim: false/i,
      /broad_provider_quality_claim: false/i,
      /openrouter_lock_in: false/i,
      /codex_auth_secret_material_committed: false/i,
      /must not inherit approval from this options document/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("six-slot options doc", docs);
    assertNoScopeAuthorization("six-slot options doc", docs);
  });

  await t.test("links the option analysis from durable handoff docs", () => {
    for (const [label, path] of [
      ["six-slot assessment", SIX_SLOT_ASSESSMENT_DOC],
      ["owl alpha framing", OWL_ALPHA_FRAMING_DOC],
    ] as const) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-six-slot-next-validation-options\.md/i, `${label} must link options doc`);
      assert.match(text, /GPT-5\.5 provider-quality comparison/i, `${label} must preserve recommended comparison context`);
      assert.match(text, /Codex authentication when feasible/i, `${label} must preserve Codex-auth preference`);
      assert.match(text, /does not authorize provider calls|without authorizing provider calls/i, `${label} must preserve no-execution boundary`);
      assert.match(text, /no readiness|readiness/i, `${label} must preserve no-readiness context`);
      assertNoPrivateLeakage(label, text);
      assertNoScopeAuthorization(label, text);
    }
  });
});
