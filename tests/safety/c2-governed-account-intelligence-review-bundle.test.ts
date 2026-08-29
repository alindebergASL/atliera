import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { ACCOUNT_INTELLIGENCE_PROPOSAL_VERSION } from "../../src/account-intelligence/contracts.ts";
import { snapshotAccountIntelligenceProposal } from "../../src/account-intelligence/proposal.ts";
import { snapshotAccountResearchRequest } from "../../src/account-intelligence/research-plan.ts";

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
  ["utah-needs-review.png", [1440, 1138]],
  ["utah-partial-coverage.png", [1440, 1100]],
  ["browser-interaction-proof.png", [1440, 1100]],
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
  assert.equal(manifest.artifacts.length, 33);
  assert.equal(manifest.status, "superseded_historical_artifacts_plus_current_foundation_inputs_and_execution_authorization");
  assert.equal(manifest.historicalProposalAndRenderArtifactsAreCurrentFoundationProof, false);
  assert.equal(manifest.historicalArtifactsMayBeGrandfathered, false);
  const sums = await readFile(join(ROOT, "SHA256SUMS"), "utf8");
  for (const item of manifest.artifacts) {
    const bytes = await readFile(join(REPO, item.path));
    assert.equal(bytes.byteLength, item.bytes, item.path);
    assert.equal(sha256(bytes), item.sha256, item.path);
    assert.match(sums, new RegExp(`${item.sha256}  ${item.path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));
  }
  // The current execution-authorization artifacts must be hash-bound by both
  // the manifest and SHA256SUMS with exact byte counts and hashes.
  for (const relPath of ["fresh-execution-authorization.json", "FRESH_EXECUTION_AUTHORIZATION.md"]) {
    const path = `docs/ux/c2-governed-account-intelligence-refresh/${relPath}`;
    const entry = manifest.artifacts.find((item: any) => item.path === path);
    assert.ok(entry, `manifest must include ${relPath}`);
    const bytes = await readFile(join(ROOT, relPath));
    assert.equal(entry.bytes, bytes.byteLength, `${relPath} byte count`);
    assert.equal(entry.sha256, sha256(bytes), `${relPath} sha256`);
    assert.match(sums, new RegExp(`${sha256(bytes)}  ${path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`), `SHA256SUMS must bind ${relPath}`);
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
    assert.ok(proof[key].minEvidenceTargetWidth >= 44 && proof[key].minEvidenceTargetHeight >= 44, key);
  }
  assert.equal(proof["utah-390x844.png"].headings.next.top <= 1089, true);
  assert.equal(proof.interaction.evidenceTriggerClicks, 1);
  assert.equal(proof.interaction.dialogOpenAfterTrigger, true);
  assert.equal(proof.interaction.dialogContainsExactSupport, true);
  assert.equal(proof.interaction.dialogContainsSourceBoundary, true);
  assert.equal(proof.interaction.dialogClosedAfterClose, true);
  assert.equal(proof.interaction.focusReturnedToTrigger, true);
  assert.equal(proof.interaction.formsSubmitted, 0);
  assert.ok(proof.interaction.inactiveWorkshopContrastRatio >= 4.5);
  assert.ok(proof.interaction.darkPlaneFocusContrastRatio >= 3);
  assert.equal(proof.interaction.researchDisclosureOpen, true);
  assert.deepEqual(proof.interaction.interactionNetworkRequests, []);
  assert.deepEqual(proof.interaction.storageBefore, { local: 0, session: 0 });
  assert.deepEqual(proof.interaction.storageAfter, { local: 0, session: 0 });
});

test("historical Utah and FedEx proposal bytes are distinct, superseded, and refused by current validation", async () => {
  const utah = await readJson(join(ROOT, "data/university-of-utah-validated-proposal.json"));
  const fedex = await readJson(join(ROOT, "data/fedex-validated-proposal.json"));
  const status = await readJson(join(ROOT, "FOUNDATION_STATUS.json"));
  const retained = await readJson(join(REPO, "fixtures/account-intelligence/c2-01/retained-research-input.json"));
  const historicalSources = [
    await readJson(join(ROOT, "data/university-of-utah-admitted-sources.json")),
    await readJson(join(ROOT, "data/fedex-admitted-sources.json")),
  ];
  assert.equal(status.historicalArtifactsAreCurrentFoundationProof, false);
  assert.equal(status.historicalArtifactsMayBeGrandfathered, false);
  assert.equal(status.currentProposalSchemaVersion, ACCOUNT_INTELLIGENCE_PROPOSAL_VERSION);
  for (const [index, proposal] of [utah, fedex].entries()) {
    assert.notEqual(proposal.schemaVersion, ACCOUNT_INTELLIGENCE_PROPOSAL_VERSION);
    const request = snapshotAccountResearchRequest(retained.accounts[index].request);
    assert.throws(() => snapshotAccountIntelligenceProposal(proposal, request, historicalSources[index]),
      /proposal identity refused|version refused|corrected foundation authority/u);
  }
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

test("historical model artifact lineage remains hash-verifiable without becoming current foundation proof", async () => {
  const lineage: any = JSON.parse(await readFile(join(ROOT, "model-artifact-lineage.json"), "utf8"));
  const ledger: any = JSON.parse(await readFile(join(ROOT, "execution-ledger.json"), "utf8"));
  assert.equal(lineage.entries.length, 2);
  const slugs: Record<string, string> = { acc_university_of_utah: "university-of-utah", acc_fedex_corp: "fedex" };
  const verifies = (entry: any, receipt: any, proposalSha: string) =>
    /^[a-f0-9]{64}$/u.test(entry.promptSha256) && entry.promptSha256 === entry.promptFileSha256 &&
    entry.rawResponseSha256 === receipt.artifactLineage.rawResponseSha256 &&
    entry.usageReceiptSha256 === receipt.artifactLineage.usageReceiptSha256 &&
    entry.validatedProposalSha256 === proposalSha && entry.validatedProposalSha256 === receipt.artifactLineage.validatedProposalSha256 &&
    entry.runId === receipt.artifactLineage.runId && entry.selectedAttemptId === receipt.artifactLineage.selectedAttemptId;
  for (const entry of lineage.entries) {
    const slug = slugs[entry.accountId]!;
    const receipt: any = JSON.parse(await readFile(join(ROOT, `data/${slug}-effect-receipt.json`), "utf8"));
    const proposalSha = sha256(await readFile(join(ROOT, `data/${slug}-validated-proposal.json`)));
    assert.equal(verifies(entry, receipt, proposalSha), true);
    assert.equal(entry.privatePromptCommitted, false);
    assert.equal(entry.privateRawResponseCommitted, false);
    assert.equal(entry.privateArtifactHashesVerified, true);
    assert.deepEqual(ledger.modelArtifactLineage.find((item: any) => item.accountId === entry.accountId), entry);
    assert.equal(verifies({ ...entry, promptSha256: "0".repeat(64) }, receipt, proposalSha), false);
    assert.equal(verifies({ ...entry, selectedAttemptId: `${entry.selectedAttemptId}-tampered` }, receipt, proposalSha), false);
  }
});

test("superseded rendered pages preserve their historical bytes without becoming current foundation proof", async () => {
  const visualManifest = await readJson(join(ROOT, "visual-artifact-manifest.json"));
  assert.equal(visualManifest.status, "superseded_non_current_review_evidence");
  assert.equal(visualManifest.currentFoundationProof, false);
  assert.equal(visualManifest.visualsRegeneratedForFoundationCorrection, false);
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

// --- Fresh retained two-account execution authorization packet (PR #315) ---
//
// A separate, docs-only approval packet that authorizes ONLY the exact
// pending execution slice. The foundation correction alone did not
// authorize execution; this packet does, within hard caps, and this
// checkpoint precedes any execution. Secret-leak and overclaim patterns
// target affirmative dangerous values, so the marker-style negations in
// the artifacts (e.g. `rawResponseCommitted: false`) do not trip them.

const AUTH_JSON = join(ROOT, "fresh-execution-authorization.json");
const AUTH_PACKET = join(ROOT, "FRESH_EXECUTION_AUTHORIZATION.md");
const AUTH_SLUG = "c2-fresh-retained-two-account-20260829";

const SECRET_LEAK_PATTERNS = [
  /\/home\/[a-z]/iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\bsk-[A-Za-z0-9]{16,}\b/u,
  /api[_ -]?key\s*[:=]\s*["']?[A-Za-z0-9]/iu,
  /authorization:\s*bearer\s+\S/iu,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/u,
  /"(?:requestId|sessionId|responseId)"\s*:\s*"[^"]+"/u,
  /atliera-private-provider-evidence/u,
];

const OVERCLAIM_PATTERNS = [
  /no fresh (?:model )?execution is authorized/iu,
  /billing (?:is )?enforced/iu,
  /billing enforcement (?:is )?(?:guaranteed|established|proven)/iu,
  /provider-side output[- ]token enforcement (?:is )?(?:established|proven|guaranteed)/iu,
  /output tokens? (?:are )?enforced by the provider/iu,
  /merge (?:is )?authorized by this packet/iu,
  /production[- ]ready\b/iu,
  /launch[- ]ready\b/iu,
  /"authorizedByThisPacket"\s*:\s*true/u,
  /"executedInThisCheckpoint"\s*:\s*true/u,
  /"provider_calls_executed"\s*:\s*[1-9]/u,
];

test("fresh-execution authorization artifact locks the exact pending slice bounds", async () => {
  const auth = await readJson(AUTH_JSON);
  assert.equal(auth.kind, "atliera.c2-fresh-execution-authorization");
  assert.equal(auth.authorizationSlug, AUTH_SLUG);
  assert.equal(auth.checkpointPrecedesExecution, true);
  assert.equal(auth.executedInThisCheckpoint, false);
  assert.equal(auth.foundationCorrectionAloneAuthorizedExecution, false);
  assert.equal(auth.authorizesOnlyExactPendingSlice, true);
  assert.equal(auth.pr, 315);

  assert.deepEqual(auth.accounts, ["acc_university_of_utah", "acc_fedex_corp"]);
  assert.equal(auth.fixtureCorpus, "fixtures/account-intelligence/c2-01/broad-account-research-input.json");
  assert.equal(auth.publicUrlRetrievalInInitialRun, false);
  assert.equal(auth.provider, "openai-codex");
  assert.equal(auth.model, "gpt-5.5");
  assert.equal(auth.operation, "graph.propose");

  assert.equal(auth.calls.maxCumulative, 4);
  assert.equal(auth.calls.maxPerAccount, 2);
  assert.equal(auth.calls.initialPerAccount, 1);
  assert.equal(auth.calls.correctiveCallRequires.boundary, "createAccountIntelligenceCorrectionBoundary");
  assert.equal(auth.calls.correctiveCallRequires.afterTypedRefusal, "AccountIntelligenceProposalValidationRefusal");
  assert.equal(auth.calls.correctiveCallRequires.rejectedProposalShaCustodyCheck, true);
  assert.equal(auth.calls.consumedAttemptsNeverReset, true);
  assert.equal(auth.calls.stopBeforeCaps, true);

  assert.equal(auth.perCallLimits.maxOutputTokens, 4096);
  assert.equal(auth.perCallLimits.maxCostUsd, 0.1);
  assert.equal(auth.perCallLimits.temperature, 0);
  assert.equal(auth.perCallLimits.store, false);

  assert.equal(auth.cost.cumulativeApprovedMaxUsd, 0.4);
  assert.equal(auth.cost.expectedObservedSubscriptionCostUsd, 0);
  assert.equal(auth.cost.billingEnforcementClaimed, false);

  assert.equal(auth.tokens.localStreamCaptureMaxBytesUtf8, 512000);
  assert.equal(auth.tokens.transmittedProviderOutputTokenCeiling, null);
  assert.equal(auth.tokens.providerSideOutputTokenEnforcement, "unestablished_explicitly_accepted");
  assert.equal(auth.tokens.combinedInputTokenCeiling, 120000);
  assert.equal(auth.tokens.actualPreflightInputTokens, null);
  assert.equal(auth.tokens.preflightRecordedBeforeExecution, false);
  assert.equal(auth.tokens.failClosedIfInputCeilingExceeded, true);

  for (const value of Object.values(auth.providerCapabilities)) assert.equal(value, false);
  for (const value of Object.values(auth.effects)) assert.equal(value, false);
  assert.equal(auth.providerBehaviorStorageToolNetworkEffects, "unestablished_unless_separately_receipted");

  assert.equal(auth.evidenceSanitization.privateEvidenceOutsideRepo, true);
  assert.equal(auth.evidenceSanitization.rawPromptCommitted, false);
  assert.equal(auth.evidenceSanitization.rawResponseCommitted, false);
  assert.equal(auth.evidenceSanitization.rawPayloadCommitted, false);
  assert.equal(auth.evidenceSanitization.requestIdsCommitted, false);
  assert.equal(auth.evidenceSanitization.sessionIdsCommitted, false);
  assert.equal(auth.evidenceSanitization.credentialsCommitted, false);
  assert.equal(auth.evidenceSanitization.privatePathsCommitted, false);

  assert.equal(auth.downstream.proposalRenderRegenerationAuthorizedAfterValidatedOutputs, true);
  assert.equal(auth.downstream.productUxBrowserReviewAuthorizedAfterValidatedOutputs, true);
  assert.equal(auth.downstream.freshPublicResearchActivated, false);
  assert.equal(auth.downstream.freshPublicResearchRequiresAddendumIfCorpusInsufficient, true);

  assert.equal(auth.mergeGating.authorizedByThisPacket, false);
  assert.equal(auth.mergeGating.requiresExactFinalPrSha, true);
  assert.equal(auth.mergeGating.requiresExactHeadCi, true);
  assert.equal(auth.mergeGating.requiresExactHeadIndependentReviews, true);
  assert.equal(auth.mergeGating.requiresOwnerConfirmation, true);
  assert.equal(auth.mergeGating.generalAuthorizationIsNotUnknownFutureShaMergeWaiver, true);

  assert.deepEqual([...auth.stopConditions].sort(), ["authority mismatch", "budget mismatch", "identity mismatch", "schema mismatch"]);
});

test("fresh-execution approval packet is docs-only, decision-tree bounded, and leak-free", async () => {
  const doc = await readFile(AUTH_PACKET, "utf8");
  for (const required of [
    /Status:\s*\*{0,2}docs-only fresh retained two-account execution authorization/iu,
    new RegExp(`authorization slug\\s*:\\s*\`${AUTH_SLUG}\``, "iu"),
    /This checkpoint precedes execution/iu,
    /does not execute the live slice/iu,
    /foundation correction alone did not authorize/iu,
    /acc_university_of_utah/u,
    /acc_fedex_corp/u,
    /openai-codex/u,
    /gpt-5\.5/u,
    /graph\.propose/u,
    /at most 4 (?:provider )?calls/iu,
    /at most 2 (?:calls )?per account/iu,
    /createAccountIntelligenceCorrectionBoundary/u,
    /AccountIntelligenceProposalValidationRefusal/u,
    /maxOutputTokens[^\n]*4096/iu,
    /maxCostUsd[^\n]*0\.10/iu,
    /cumulative[^\n]*\$0\.40/iu,
    /512000/u,
    /combined input-token ceiling[^\n]*120000/iu,
    /fail closed/iu,
    /provider-side (?:output[- ]token\s+)?enforcement\s+(?:remains|is)\s+unestablished/iu,
    /Decision tree/iu,
    /Cumulative effect accounting/iu,
    /consumed attempts are\s+never reset/iu,
    /Stop on any authority\/identity\/budget\/schema mismatch/iu,
    /private (?:prompts|evidence)[\s\S]{0,140}?outside the repository/iu,
    /merge[\s\S]{0,80}?exact final\s+PR SHA/iu,
  ]) {
    assert.match(doc, required, `packet must contain: ${required}`);
  }
  for (const pattern of [...SECRET_LEAK_PATTERNS, ...OVERCLAIM_PATTERNS]) {
    assert.doesNotMatch(doc, pattern, `packet must not contain: ${pattern}`);
  }
  const authRaw = await readFile(AUTH_JSON, "utf8");
  for (const pattern of [...SECRET_LEAK_PATTERNS, ...OVERCLAIM_PATTERNS]) {
    assert.doesNotMatch(authRaw, pattern, `authorization JSON must not contain: ${pattern}`);
  }
});

test("status files now record fresh-execution authorization while preserving superseded history", async () => {
  const status = await readJson(join(ROOT, "FOUNDATION_STATUS.json"));
  // Preserved invariants.
  assert.equal(status.historicalArtifactsAreCurrentFoundationProof, false);
  assert.equal(status.historicalArtifactsMayBeGrandfathered, false);
  assert.equal(status.currentProposalSchemaVersion, ACCOUNT_INTELLIGENCE_PROPOSAL_VERSION);
  // New authorization block.
  assert.equal(status.freshExecutionAuthorization.authorized, true);
  assert.equal(status.freshExecutionAuthorization.authorizationSlug, AUTH_SLUG);
  assert.equal(status.freshExecutionAuthorization.executedInThisCheckpoint, false);
  assert.equal(status.freshExecutionAuthorization.foundationCorrectionAloneAuthorizedExecution, false);
  assert.equal(status.freshExecutionAuthorization.mergeAuthorizedByThisPacket, false);
  assert.equal(status.freshExecutionAuthorization.authorizationArtifact, "fresh-execution-authorization.json");

  const readme = await readFile(join(ROOT, "README.md"), "utf8");
  assert.match(readme, /Fresh retained two-account execution/iu);
  assert.match(readme, new RegExp(AUTH_SLUG, "u"));
  assert.match(readme, /authorizes only the exact pending slice/iu);
  assert.match(readme, /superseded/iu);
  // The README must no longer flatly deny that fresh execution is authorized.
  assert.doesNotMatch(readme, /No fresh model proposal has been generated/u);
  for (const pattern of OVERCLAIM_PATTERNS) assert.doesNotMatch(readme, pattern, `README must not contain: ${pattern}`);
});
