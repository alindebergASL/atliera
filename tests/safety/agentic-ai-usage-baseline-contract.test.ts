import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const DOC_PATH = join(REPO_ROOT, "docs", "architecture", "agentic-ai-usage-baseline.md");
const SRC_ROOT = join(REPO_ROOT, "src");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

function listSourceFiles(): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (path.endsWith(".ts")) {
        files.push(path);
      }
    }
  };
  visit(SRC_ROOT);
  return files.sort();
}

function matchingSourceLines(pattern: RegExp): string[] {
  const matches: string[] = [];
  for (const file of listSourceFiles()) {
    const rel = relative(REPO_ROOT, file);
    const lines = readRepoFile(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push(`${rel}:${index + 1}:${line.trim()}`);
      }
    });
  }
  return matches;
}

function assertNoPositiveReadiness(label: string, text: string): void {
  const forbiddenPatterns = [
    /launch readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /product readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /production readiness (?:is )?(?:proven|established|approved|claimed)/i,
    /broad model quality (?:is )?(?:proven|established|approved|claimed)/i,
    /provider comparison (?:is )?(?:approved|authorized|allowed)/i,
    /runtime\/model-mode integration (?:is )?(?:approved|authorized|allowed)/i,
    /(?:authorizes|allows|approves|enables)\s+(?:web search|openrouter:web_search|`:online`|plugins?|tools?|production writes?|runtime\/model-mode integration)/i,
    /\bagent-ready\b/i,
    /agentic_platform_readiness/i,
    /Agentic platform readiness/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(text, pattern, `${label} broadened interpretation with ${pattern}`);
  }
}

test("agentic AI usage baseline records current runtime and validation boundaries", async (t) => {
  await t.test("documents the current agentic usage level without readiness or broadening claims", () => {
    const doc = readRepoFile(DOC_PATH);

    assert.match(doc, /# Agentic AI Usage Baseline/i);
    assert.match(doc, /Status: current bounded baseline/i);
    assert.match(doc, /Normal app boot and Workshop rendering use 0 default-path model\/provider calls/i);
    assert.match(doc, /Normal app boot and Workshop rendering use 0 autonomous tool actions/i);
    assert.match(doc, /No resident autonomous shell agent/i);
    assert.match(doc, /No app server or worker path currently invokes `ModelProvider\.generate`/i);
    assert.match(doc, /No source call sites currently invoke `ModelAdapter\.propose`/i);
    assert.match(doc, /The only `\.generate\(` source call site is the provider-validation harness/i);
    assert.match(doc, /`ExternalCommandModelProvider` is a sealed validation seam/i);
    assert.match(doc, /`AgentRunRecord` is orchestration evidence, not a running autonomous loop/i);
    assert.match(doc, /Recent `owl-alpha` usage was limited to explicitly approved validation runs/i);
    assert.match(doc, /runtime\/model-mode integration: none/i);
    assert.match(doc, /tools_or_plugins_requested: false/i);
    assert.match(doc, /web_search_requested: false/i);
    assert.match(doc, /launch_readiness_claim: false/i);
    assert.match(doc, /product_readiness_claim: false/i);
    assert.match(doc, /production_readiness_claim: false/i);
    assert.match(doc, /agentic_platform_maturity: foundation-layer/i);
    assert.match(doc, /runtime_agentic_ai_usage: gated-zero-default/i);
    assert.match(doc, /validation_agentic_ai_usage: bounded-approved-slices/i);
    assert.match(doc, /autonomous_agent_behavior: absent/i);
    assert.match(doc, /Any future provider call, tool\/web-search enablement, autonomous loop, production write, deployment, or runtime\/model-mode integration needs a separate reviewed change/i);
    assertNoPositiveReadiness("agentic AI usage baseline", doc);
  });

  await t.test("source scan supports the documented default-path provider-call boundary", () => {
    assert.deepEqual(matchingSourceLines(/\.propose\(/), []);
    const generateMatches = matchingSourceLines(/\.generate\(/);
    assert.equal(generateMatches.length, 1);
    const onlyGenerateMatch = generateMatches[0];
    if (onlyGenerateMatch === undefined) {
      throw new Error("expected one provider generate call site");
    }
    assert.match(
      onlyGenerateMatch,
      /^src\/model\/provider-validation\.ts:\d+:response = await input\.provider\.generate\(input\.request\);$/,
    );
    assert.deepEqual(matchingSourceLines(/new ExternalCommandModelProvider\(/), []);
  });
});
