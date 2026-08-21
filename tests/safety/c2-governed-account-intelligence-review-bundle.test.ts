import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const REPO = process.cwd();
const ROOT = join(REPO, "docs/ux/c2-governed-account-intelligence-refresh");
const readJson = async (path: string): Promise<any> => JSON.parse(await readFile(path, "utf8"));
const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

const requiredScreenshots = new Map<string, [number, number]>([
  ["utah-1440x1100.png", [1440, 1100]],
  ["utah-1280x900.png", [1280, 900]],
  ["utah-768x900.png", [768, 900]],
  ["utah-390x844.png", [390, 844]],
  ["utah-evidence-open.png", [1440, 1100]],
  ["utah-partial-coverage.png", [1440, 1100]],
  ["fedex-1440x1100.png", [1440, 1100]],
  ["fedex-390x844.png", [390, 844]],
]);

function pngDimensions(buffer: Buffer): [number, number] {
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("C2-01 manifest and SHA256SUMS verify every review artifact", async () => {
  const manifest = await readJson(join(ROOT, "artifact-manifest.json"));
  assert.equal(manifest.kind, "atliera.c2-01-artifact-manifest");
  assert.equal(manifest.artifacts.length, 26);
  const sums = await readFile(join(ROOT, "SHA256SUMS"), "utf8");
  for (const item of manifest.artifacts) {
    const bytes = await readFile(join(REPO, item.path));
    assert.equal(bytes.byteLength, item.bytes, item.path);
    assert.equal(sha256(bytes), item.sha256, item.path);
    assert.match(sums, new RegExp(`${item.sha256}  ${item.path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));
  }
  for (const [name, expected] of requiredScreenshots) {
    const bytes = await readFile(join(ROOT, "screenshots", name));
    assert.deepEqual(pngDimensions(bytes), expected, name);
  }
});

test("browser proof locks editorial geometry and zero-effect evidence disclosure", async () => {
  const proof = await readJson(join(ROOT, "browser-interaction-proof.json"));
  assert.ok(proof["utah-1280x900.png"].headroom >= 22);
  for (const key of ["utah-1440x1100.png", "utah-1280x900.png", "utah-768x900.png", "utah-390x844.png", "fedex-1440x1100.png", "fedex-390x844.png"]) {
    assert.equal(proof[key].horizontalOverflow, 0, key);
    assert.equal(proof[key].darkDecisionPlanes, 1, key);
    assert.deepEqual(proof[key].primaryActions, ["Review the support"], key);
    assert.equal(proof[key].accountBeforeResearch, true, key);
  }
  assert.equal(proof["utah-390x844.png"].headings.next.top <= 1089, true);
  assert.equal(proof.interaction.evidenceTriggerClicks, 1);
  assert.equal(proof.interaction.dialogOpenAfterTrigger, true);
  assert.equal(proof.interaction.dialogContainsExactSupport, true);
  assert.equal(proof.interaction.dialogContainsSourceBoundary, true);
  assert.equal(proof.interaction.dialogClosedAfterClose, true);
  assert.equal(proof.interaction.researchDisclosureOpen, true);
  assert.deepEqual(proof.interaction.interactionNetworkRequests, []);
  assert.deepEqual(proof.interaction.storageBefore, { local: 0, session: 0 });
  assert.deepEqual(proof.interaction.storageAfter, { local: 0, session: 0 });
});

test("real Utah and FedEx proposals are distinct, validated, non-durable, and safe", async () => {
  const utah = await readJson(join(ROOT, "data/university-of-utah-validated-proposal.json"));
  const fedex = await readJson(join(ROOT, "data/fedex-validated-proposal.json"));
  const utahText = JSON.stringify(utah);
  const fedexText = JSON.stringify(fedex);
  assert.equal(utah.reviewStatus, "needs_review");
  assert.equal(fedex.reviewStatus, "needs_review");
  assert.match(utahText, /funding_status_ambiguity/u);
  assert.match(utahText, /4\.94 million|4,939,43[56]/u);
  assert.doesNotMatch(utahText, /available purchasing budget|sales opportunity|deal value|funded execution|commercial urgency/iu);
  assert.match(fedexText, /FedEx/u);
  assert.match(fedexText, /Network 2\.0|spin-off|post-spin/iu);
  assert.doesNotMatch(fedexText, /University|Utah|education-sector|4\.94|\$5M/iu);
  assert.notEqual(utah.accountThesis.text, fedex.accountThesis.text);
  assert.notEqual(utah.recommendedNextMove.text, fedex.recommendedNextMove.text);
  const ledger = await readJson(join(ROOT, "execution-ledger.json"));
  assert.equal(ledger.counts.searchQueries, 30);
  assert.equal(ledger.counts.urlRetrievalAttempts, 30);
  assert.equal(ledger.counts.uniqueUrlsRetrieved, 24);
  assert.equal(ledger.providerExecution.calls, 8);
  assert.deepEqual(ledger.providerExecution.cumulative, {
    inputTokens: 37726,
    outputTokens: 32792,
    reasoningTokens: 696,
    totalTokens: 70518,
    estimatedCostUsd: 0,
  });
  assert.equal(ledger.providerExecution.historicalAuthorization.overrun, 3255);
  assert.equal(ledger.providerExecution.revisedAuthorization.cumulativeOutputTokenCeiling, 34255);
  assert.equal(ledger.providerExecution.finalCeilingState.withinRevisedCeiling, true);
  assert.deepEqual(Object.values(ledger.forbiddenEffects), Array(10).fill(0));
});

test("rendered pages inherit Editorial Evidence Synthesis without dashboard regressions", async () => {
  for (const file of ["university-of-utah.html", "fedex.html"]) {
    const html = await readFile(join(ROOT, file), "utf8");
    for (const required of ["Established", "Meaningfully changed", "Still open", "Recommended next move", "Answers first", "Evidence", "Research coverage and boundaries"]) {
      assert.match(html, new RegExp(required, "u"), `${file}: ${required}`);
    }
    assert.equal((html.match(/class="decision-plane"/gu) ?? []).length, 1);
    assert.equal((html.match(/class="primary-action"/gu) ?? []).length, 1);
    assert.doesNotMatch(html, /Package Inspector|confidence gauge|activity feed|AI status|source count|customer-facing source ID/iu);
    assert.match(html, /connect-src (?:'|&#39;)none(?:'|&#39;)/u);
  }
});
