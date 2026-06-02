import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const APPROVAL_DOC = join(REPO_ROOT, "docs", "runbooks", "live-product-preview-gpt55-comparison-approval.md");
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

function assertNoForbiddenBroadening(label: string, text: string): void {
  for (const pattern of [
    /(?:is|as|becomes|remains) a standing approval/i,
    /launch readiness (?:is )?(?:proven|established|claimed|implied)/i,
    /product readiness (?:is )?(?:proven|established|claimed|implied)/i,
    /production readiness (?:is )?(?:proven|established|claimed|implied)/i,
    /multi-account readiness (?:is )?(?:proven|established|claimed|implied)/i,
    /broad (?:provider|model) quality (?:is )?(?:proven|established|claimed|implied)/i,
    /default production-model selection (?:is )?(?:approved|authorized|allowed|enabled|made)/i,
    /production writes? (?:is|are )?(?:approved|authorized|allowed|enabled)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /web search (?:is )?(?:approved|authorized|allowed|enabled)/i,
    /tools? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
    /plugins? (?:are|is )?(?:approved|authorized|allowed|enabled)/i,
  ]) {
    assert.doesNotMatch(text, pattern, `${label} broadened scope with ${pattern}`);
  }
}

test("safety: live product preview GPT-5.5 comparison approval", async (t) => {
  await t.test("is a separate pre-run docs-only comparison approval packet", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    assert.match(docs, /Live Product Preview GPT-5\.5 Comparison Approval/i);
    assert.match(docs, /Status: pre-run docs-only approval packet/i);
    assert.match(docs, /This PR does not execute provider calls, does not spend/i);
    assert.match(docs, /useful six-slot `owl-alpha` product-preview assessment/i);
    assert.match(docs, /live-product-preview-six-slot-next-validation-options\.md/i);
    assert.match(docs, /recommended a GPT-5\.5 comparison packet/i);
    assert.match(docs, /not a standing approval/i);
    assert.match(docs, /does not authorize any provider call, retry set, corpus growth, model route, spend, or comparison beyond the exact comparison scope/i);
    assertNoPrivateLeakage("gpt55 approval doc", docs);
    assertNoForbiddenBroadening("gpt55 approval doc", docs);
  });

  await t.test("pins route, baseline, scope, budget, and private evidence boundaries", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /comparison name: `live-product-preview-gpt55-comparison-20260602a`/i,
      /baseline reference: `live-product-preview-six-slot-20260601a`/i,
      /baseline route: OpenRouter `owl-alpha`, already executed and already sanitized/i,
      /candidate route: GPT-5\.5 through Codex authentication when feasible/i,
      /provider boundary: Atliera `ModelProvider` \/ external-command seam/i,
      /operation: `graph\.propose`/i,
      /activation approval schema: `atliera\.model_activation_approval\.v1`/i,
      /corpus reference prefix: `external-corpus\/live-product-preview-six-slot\/`/i,
      /same six screened slot roles as the baseline/i,
      /candidate provider calls: at most six/i,
      /baseline provider calls: zero new baseline calls/i,
      /comparison calls: at most six candidate calls total/i,
      /max comparison cost[^\n]*\$30\.00/i,
      /cumulative comparison cap[^\n]*\$30\.00/i,
      /no paid fallback route/i,
      /private evidence outside the repository/i,
      /sanitized status follow-up/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("gpt55 approval doc", docs);
    assertNoForbiddenBroadening("gpt55 approval doc", docs);
  });

  await t.test("keeps Codex-auth credential-neutral and tool-free", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /Codex authentication is preferred only to avoid introducing a separate credential path when feasible/i,
      /must not leak Codex credential material/i,
      /credential-neutral adapter/i,
      /contains no secrets, no user\/session tokens/i,
      /expose only the Atliera `ModelProvider` request and response contract/i,
      /must not grant tools, shell access, web search, file access, or plugin access/i,
      /preserve the exact `graph\.propose` prompt contract/i,
      /reject markdown JSON fences/i,
      /raw request\/response material only in private evidence storage outside the repository/i,
      /If Codex authentication cannot be used safely, execution stops/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("gpt55 approval doc", docs);
    assertNoForbiddenBroadening("gpt55 approval doc", docs);
  });

  await t.test("preserves source screening, no-search boundaries, and explicit non-approved scope", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /representative-a, representative-b, edge-case-a, edge-case-b, calibration, or sparse-control/i,
      /at least two of Signals, Maps, and Plays/i,
      /only sanitized category-presence markers and role labels/i,
      /not raw source text, private account details, or account identifiers/i,
      /If fewer than four slots pass the pre-call screen, or if no representative slot passes/i,
      /no new `owl-alpha` baseline rerun/i,
      /no `owl-alpha` reasoning rerun/i,
      /no OpenRouter reasoning-parameter experiment/i,
      /no Opus route/i,
      /no additional GPT model route beyond GPT-5\.5/i,
      /no production writes/i,
      /no runtime\/model-mode integration/i,
      /no launch, product, or production readiness claim/i,
      /no broad provider quality claim/i,
      /no default production-model selection/i,
      /no online model variant/i,
      /no web plugin/i,
      /no server-side web-search tool/i,
      /no tools or plugins of any kind/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("gpt55 approval doc", docs);
    assertNoForbiddenBroadening("gpt55 approval doc", docs);
  });

  await t.test("locks success criteria, failure interpretation, sanitized follow-up, and portability", () => {
    const docs = readRepoFile(APPROVAL_DOC);

    for (const required of [
      /At least four screened candidate slots execute through the GPT-5\.5 provider path/i,
      /At least one representative slot executes through the candidate provider path/i,
      /Each candidate cost ledger entry is succeeded/i,
      /Graph validation and quality gate pass for each produced candidate graph output/i,
      /Bootstrap evidence verification passes/i,
      /Candidate outputs are compared only against the already-approved six-slot `owl-alpha` baseline facts/i,
      /No post-output substitution is used/i,
      /next step is not launch/i,
      /separate no-spend comparison usefulness assessment/i,
      /cost-benefit analysis, not a production-model decision/i,
      /Codex-auth blocker/i,
      /historical facts from one approved comparison slice/i,
      /Raw provider request\/response material, credentials, wrapper logs, source account content/i,
      /Codex authentication details/i,
      /comparison interpretation against already-sanitized baseline facts only/i,
      /not OpenRouter lock-in/i,
      /not OpenAI lock-in/i,
      /not a GPT-5\.5 quality conclusion/i,
      /same `ModelProvider` boundary/i,
      /direct Anthropic API, direct OpenAI API, and gateway implementations/i,
      /does not prove provider quality/i,
      /does not prove launch readiness/i,
      /does not prove product readiness/i,
      /does not prove production readiness/i,
      /does not prove multi-account readiness/i,
    ]) {
      assert.match(docs, required);
    }
    assertNoPrivateLeakage("gpt55 approval doc", docs);
    assertNoForbiddenBroadening("gpt55 approval doc", docs);
  });

  await t.test("is linked from durable handoff docs without back-authorizing the options analysis", () => {
    for (const [label, path] of [
      ["six-slot assessment", SIX_SLOT_ASSESSMENT_DOC],
      ["owl alpha framing", OWL_ALPHA_FRAMING_DOC],
    ] as const) {
      const text = readRepoFile(path);
      assert.match(text, /live-product-preview-gpt55-comparison-approval\.md/i, `${label} must link comparison approval`);
      assert.match(text, /GPT-5\.5 provider-quality comparison/i, `${label} must preserve comparison context`);
      assert.match(text, /Codex authentication when feasible/i, `${label} must preserve Codex-auth preference`);
      assert.match(text, /no readiness|readiness/i, `${label} must preserve no-readiness context`);
      assertNoPrivateLeakage(label, text);
      assertNoForbiddenBroadening(label, text);
    }

    const options = readRepoFile(OPTIONS_DOC);
    assert.match(options, /approves_live_provider_call: false/i);
    assert.match(options, /approves_provider_spend: false/i);
    assert.match(options, /approves_provider_or_model_comparison: false/i);
    assert.match(options, /must not inherit approval from this options document/i);
    assertNoPrivateLeakage("options doc", options);
  });
});
