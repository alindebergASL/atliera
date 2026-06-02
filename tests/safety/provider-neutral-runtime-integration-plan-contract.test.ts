import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const PLAN_PATH = join(REPO_ROOT, "docs", "plans", "2026-06-02-provider-neutral-runtime-integration.md");
const USEFULNESS_PATH = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-usefulness-assessment.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]+/i,
    /["']?api[_-]?key["']?\s*[:=]/i,
    /["']?raw[_ -]?(?:provider[_ -]?)?(?:request|response|body|transcript)["']?\s*[:=]/i,
    /["']?source_text["']?\s*[:=]/i,
    /["']?account_ref["']?\s*[:=]/i,
    /\/home\/ubuntu\/atliera-private-provider-evidence/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeBroadening(label: string, text: string): void {
  for (const pattern of [
    /authori[sz]es?\s+(?:another\s+)?provider\s+call/i,
    /authori[sz]es?\s+(?:runtime|model[- ]mode)\s+integration/i,
    /(?:selects|selected)\s+GPT-5\.5\s+as\s+(?:the\s+)?(?:default|production)/i,
    /(?:^|[^\w])(?:deprecates?|retires?|removes?)\s+`?owl-alpha`?\s+as\s+(?:a\s+)?(?:validation|provider|model|route)/i,
    /launch\s+readiness\s+(?:is\s+)?(?:proved|approved|established|claimed)/i,
    /product\s+readiness\s+(?:is\s+)?(?:proved|approved|established|claimed)/i,
    /production\s+readiness\s+(?:is\s+)?(?:proved|approved|established|claimed)/i,
    /provider lock-?in (?:is )?(?:approved|selected|required|established)/i,
    /OpenRouter lock-?in (?:is )?(?:approved|selected|required|established)/i,
    /Codex auth (?:is|becomes) (?:the )?product credential path/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: provider-neutral runtime integration plan", async (t) => {
  await t.test("records provider-neutral replaceable-model strategy without executing integration", () => {
    const plan = read(PLAN_PATH);
    assertNoPrivateLeakage("runtime integration plan", plan);
    assertNoScopeBroadening("runtime integration plan", plan);

    assert.match(plan, /Status: no-spend planning contract/i);
    assert.match(plan, /provider-neutral runtime integration/i);
    assert.match(plan, /ModelProvider boundary/i);
    assert.match(plan, /ExternalCommandModelProvider/i);
    assert.match(plan, /runtime_model_mode_integration: false/i);
    assert.match(plan, /provider_calls_executed: 0/i);
    assert.match(plan, /provider_spend: false/i);
    assert.match(plan, /approves_provider_call: false/i);
    assert.match(plan, /default_model_selection_claim: false/i);
    assert.match(plan, /provider_lock_in: false/i);
    assert.match(plan, /no provider SDK imports in `src\/`/i);
    assert.match(plan, /no env credential reads/i);
    assert.match(plan, /no tool, shell, file, web search, plugin, retrieval, or MCP surface/i);
  });

  await t.test("treats model choices as replaceable and supports future model arrivals", () => {
    const plan = read(PLAN_PATH);
    assert.match(plan, /models get better/i);
    assert.match(plan, /replaceable/i);
    assert.match(plan, /Opus 4\.8/i);
    assert.match(plan, /GPT-5\.6/i);
    assert.match(plan, /validated route catalog/i);
    assert.match(plan, /time-boxed validation/i);
    assert.match(plan, /recency review/i);
    assert.match(plan, /switching among validated routes must not require product-logic rewrites/i);
  });

  await t.test("defines concrete TDD runtime-integration slices without granting execution", () => {
    const plan = read(PLAN_PATH);
    for (const marker of [
      /Task 1: validated route catalog/i,
      /Task 2: provider selection policy/i,
      /Task 3: runtime composition binding/i,
      /Task 4: activation and cost gate reuse/i,
      /Task 5: route recency and replacement review/i,
      /Task 6: sanitized runtime observability/i,
    ]) {
      assert.match(plan, marker);
    }
    assert.match(plan, /RED — write failing tests first/i);
    assert.match(plan, /GREEN — minimal implementation/i);
    assert.match(plan, /Full verification/i);
    assert.match(plan, /separate approval packet/i);
  });

  await t.test("links the planning contract from the usefulness handoff", () => {
    const usefulness = read(USEFULNESS_PATH);
    assertNoPrivateLeakage("usefulness handoff", usefulness);
    assertNoScopeBroadening("usefulness handoff", usefulness);
    assert.match(usefulness, /2026-06-02-provider-neutral-runtime-integration\.md/i);
    assert.match(usefulness, /provider-neutral runtime integration planning/i);
    assert.match(usefulness, /model choices are replaceable/i);
  });
});
