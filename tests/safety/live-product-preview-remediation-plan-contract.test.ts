import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const REMEDIATION_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-remediation.md");
const ASSESSMENT_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-assessment.md");
const GATE_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-gate.md");
const FRAMING_DOC = join(REPO_ROOT, "docs", "runbooks", "owl-alpha-validation-framing.md");
const STRATEGY_DOC = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const INDEX = join(REPO_ROOT, "src", "index.ts");
const PLAN_FIXTURE = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-20260528a-remediation-plan.json");
const OPUS_PACKET = join(REPO_ROOT, "docs", "reviews", "opus-live-product-preview-remediation-review-packet.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function assertNoPrivateLeakage(label: string, text: string): void {
  for (const pattern of [
    /\/home\//i,
    /private[-_/][a-z0-9._-]*provider[-_/][a-z0-9._-]*evidence/i,
    /credential\s*(?:value|contents?)\s*[:=]/i,
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._-]+/i,
    /raw[_ -]?(?:provider[_ -]?)?response\s*[:=]/i,
    /raw[_ -]?body\s*[:=]/i,
    /prompt\s*[:=]\s*["'`]/i,
    /wrapper\s*log\s*[:=]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/i,
    /lab\d*\.[a-z0-9-]+\.[a-z]{2,}/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} leaked private marker ${pattern}`);
  }
}

function assertNoScopeBroadening(label: string, text: string): void {
  for (const pattern of [
    /(?:authorizes|approves|allows)\s+(?:a\s+)?(?:live provider call|provider spend|provider comparison|model comparison|corpus expansion|product-preview expansion|production write|production deployment|runtime\/model-mode integration|web search|tools?\/plugins?)/i,
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /live provider rerun (?:is )?(?:approved|authorized|allowed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /product-preview expansion (?:is )?(?:approved|authorized|allowed)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: live product preview usefulness remediation plan", async (t) => {
  await t.test("documents a no-spend remediation plan for weak-but-valid first preview", () => {
    const docs = readRepoFile(REMEDIATION_DOC);

    assert.match(docs, /Live Product Preview Usefulness Remediation/i);
    assert.match(docs, /Status: accepted no-spend remediation plan/i);
    assert.match(docs, /live-product-preview-20260528a/i);
    assert.match(docs, /weak-but-valid/i);
    assert.match(docs, /insufficient_useful_lenses/i);
    assert.match(docs, /only the Signals lens/i);
    assert.match(docs, /prompt_contract/i);
    assert.match(docs, /proposal_schema/i);
    assert.match(docs, /workshop_lens_mapping/i);
    assert.match(docs, /product_surface_expectations/i);
    assert.match(docs, /fixture_coverage/i);
    assert.match(docs, /no_spend_prompt_contract_revision/i);
    assert.match(docs, /proposal_schema_revision/i);
    assert.match(docs, /workshop_lens_mapping_review/i);
    assert.match(docs, /product_surface_clarification/i);
    assert.match(docs, /deterministic_fixture_update/i);
    assert.match(docs, /live_provider_call: false/i);
    assert.match(docs, /provider_spend: false/i);
    assert.match(docs, /production_writes: false/i);
    assert.match(docs, /runtime_model_mode_integration: false/i);
    assert.match(docs, /provider_or_model_comparison: false/i);
    assert.match(docs, /corpus_expansion: false/i);
    assert.match(docs, /product_preview_expansion: false/i);
    assert.match(docs, /web_search_or_tools: false/i);
    assert.match(docs, /launch_readiness_claim: false/i);
    assert.match(docs, /product_readiness_claim: false/i);
    assert.match(docs, /production_readiness_claim: false/i);
    assert.match(docs, /approves_expansion_or_comparison: false/i);
    assert.match(docs, /no live rerun/i);
    assert.match(docs, /no provider comparison/i);
    assert.match(docs, /separate approval packet/i);
    assertNoPrivateLeakage("remediation doc", docs);
    assertNoScopeBroadening("remediation doc", docs);
  });

  await t.test("keeps the checked plan fixture bounded and sanitized", () => {
    const fixture = readRepoFile(PLAN_FIXTURE);
    assert.match(fixture, /"status": "needs-remediation"/i);
    assert.match(fixture, /"source_classification": "weak-but-valid"/i);
    assert.match(fixture, /"insufficient_useful_lenses"/i);
    assert.match(fixture, /"approves_expansion_or_comparison": false/i);
    assert.match(fixture, /"live_provider_call": false/i);
    assert.match(fixture, /"provider_spend": false/i);
    assertNoPrivateLeakage("remediation fixture", fixture);
    assertNoScopeBroadening("remediation fixture", fixture);
  });

  await t.test("links the remediation from durable live-preview docs independently", () => {
    for (const [label, path] of [
      ["assessment", ASSESSMENT_DOC],
      ["gate", GATE_DOC],
      ["owl-alpha framing", FRAMING_DOC],
      ["strategy", STRATEGY_DOC],
    ] as const) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-usefulness-remediation\.md/i, `${label} must link remediation`);
      assert.match(text, /weak-but-valid|no-spend remediation|remediation/i, `${label} must preserve remediation context`);
      assert.match(text, /launch_readiness_claim: false|does not imply launch readiness|no-readiness/i, `${label} must preserve no-readiness boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
    }
  });

  await t.test("exports the remediation helper from the public package entrypoint", () => {
    const index = readRepoFile(INDEX);
    assert.match(index, /validation\/live-product-preview-remediation-plan\.ts/i);
  });

  await t.test("includes a sanitized Opus review packet without delegating authority", () => {
    const packet = readRepoFile(OPUS_PACKET);
    assert.match(packet, /Opus Review Packet/i);
    assert.match(packet, /consultative/i);
    assert.match(packet, /non-authoritative/i);
    assert.match(packet, /PR #116/i);
    assert.match(packet, /weak-but-valid/i);
    assert.match(packet, /insufficient_useful_lenses/i);
    assert.match(packet, /no provider call/i);
    assert.match(packet, /no provider spend/i);
    assert.match(packet, /no readiness claim/i);
    assertNoPrivateLeakage("Opus packet", packet);
    assertNoScopeBroadening("Opus packet", packet);
  });
});
