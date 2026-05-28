import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DIAGNOSTIC_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-lens-diagnostic.md");
const REMEDIATION_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-usefulness-remediation.md");
const STRATEGY_DOC = join(REPO_ROOT, "docs", "strategy", "substrate-to-validation-transition.md");
const INPUT_FIXTURE = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-20260528a-lens-diagnostic-input.json");
const REPORT_FIXTURE = join(REPO_ROOT, "fixtures", "validation", "live-product-preview-20260528a-lens-diagnostic-report.json");
const INDEX = join(REPO_ROOT, "src", "index.ts");

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

test("safety: live product preview lens diagnostic", async (t) => {
  await t.test("documents terminal diagnostic decisions before remediation drift", () => {
    const doc = readRepoFile(DIAGNOSTIC_DOC);

    assert.match(doc, /Live Product Preview Lens Diagnostic/i);
    assert.match(doc, /structure-present-mapping-gap/i);
    assert.match(doc, /structure-absent-account-limitation/i);
    assert.match(doc, /insufficient-sanitized-evidence/i);
    assert.match(doc, /contract-failure/i);
    assert.match(doc, /terminal_next_action/i);
    assert.match(doc, /stop_current_account_remediation/i);
    assert.match(doc, /fix_workshop_lens_mapping_against_existing_outputs/i);
    assert.match(doc, /stop_until_sanitized_graph_lens_counts_exist/i);
    assert.match(doc, /stop_until_contract_failure_is_fixed/i);
    assert.match(doc, /two materially useful Workshop lenses/i);
    assert.match(doc, /fixture mode/i);
    assert.match(doc, /source account supports them/i);
    assert.match(doc, /must not pressure the provider or prompt to invent Maps or Plays content/i);
    assertNoPrivateLeakage("lens diagnostic doc", doc);
    assertNoScopeBroadening("lens diagnostic doc", doc);
  });

  await t.test("keeps checked diagnostic fixtures bounded and sanitized", () => {
    for (const [label, path] of [["input", INPUT_FIXTURE], ["report", REPORT_FIXTURE]] as const) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-20260528a/i);
      assert.match(text, /"live_provider_call": false/i);
      assert.match(text, /"provider_spend": false/i);
      assert.match(text, /"provider_or_model_comparison": false/i);
      assert.match(text, /"corpus_expansion": false/i);
      assert.match(text, /"product_preview_expansion": false/i);
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
    }
  });

  await t.test("links diagnostic from remediation and strategy docs independently", () => {
    for (const [label, path] of [["remediation", REMEDIATION_DOC], ["strategy", STRATEGY_DOC]] as const) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-lens-diagnostic\.md/i, `${label} must link diagnostic`);
      assert.match(text, /structure-present-mapping-gap|structure-absent-account-limitation|lens diagnostic/i, `${label} must preserve diagnostic context`);
      assert.match(text, /no-spend|no provider call|no-readiness/i, `${label} must preserve no-spend/no-readiness boundary`);
      assertNoPrivateLeakage(label, text);
      assertNoScopeBroadening(label, text);
    }
  });

  await t.test("exports the diagnostic helper from the public package entrypoint", () => {
    const index = readRepoFile(INDEX);
    assert.match(index, /validation\/live-product-preview-lens-diagnostic\.ts/i);
  });
});
