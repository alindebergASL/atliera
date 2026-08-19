import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  attemptCalmAccountHomeFromTrustedM5bPackage,
  buildCalmAccountHomeFromTrustedM5bPackage,
  deriveCalmTrustLabels,
} from "../../src/workshop/calm-account-home.ts";
import { prepareM5bProductReview } from "../../src/workshop/m5b-product-review-prepare.ts";
import {
  cloneSynthetic,
  sha256Fixture,
  writeSyntheticRequest,
} from "../fixtures/m5b-product-review-synthetic.ts";
import {
  createC1SyntheticScenario,
  prepareC1SyntheticScenario,
} from "../fixtures/c1-calm-account-home.ts";

const FORBIDDEN_C1_TEXT = [
  "Workshop",
  "Prepare for…",
  "Who is this for?",
  "What outcome do you want?",
  "More options",
  "Create internal draft",
  "Background intelligence complete",
  "since your last view",
  "Package Inspector",
  "Accept",
  "Reject",
  "Approve",
  "Share",
  "Send",
  "Refresh",
  "Monitor",
] as const;

async function withRoot(fn: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "atliera-c1-account-home-test-"));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function defaultVisibleHtml(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/gu, "")
    .replace(/<script>[\s\S]*?<\/script>/gu, "")
    .replace(/<dialog[\s\S]*?<\/dialog>/gu, "")
    .replace(/<details[\s\S]*?<\/details>/gu, "");
}

function refusalCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
}

async function prepareVariant(
  root: string,
  mutate: (request: any) => void,
): Promise<ReturnType<typeof prepareC1SyntheticScenario> extends Promise<infer T> ? T : never> {
  const scenario = await createC1SyntheticScenario(root, { withMeetingPlan: false });
  const request: any = cloneSynthetic(scenario.request);
  mutate(request);
  const written = await writeSyntheticRequest(root, "c1-variant-request.json", request);
  const outputDir = join(root, "c1-variant-package");
  const trustedPrepareResult = await prepareM5bProductReview({
    requestPath: written.path,
    expectedRequestSha256: sha256Fixture(written.bytes),
    expectedRequestByteSize: written.bytes.byteLength,
    sourceFiles: scenario.sourceFiles,
    outputDir,
  });
  const artifactSet = {
    sourcePack: JSON.parse(await readFile(join(outputDir, "sanitized-source-pack.json"), "utf8")),
    candidate: JSON.parse(await readFile(join(outputDir, "candidate.json"), "utf8")),
    reviewPacket: JSON.parse(await readFile(join(outputDir, "review-packet.json"), "utf8")),
  };
  return {
    scenario: Object.freeze({ ...scenario, request, requestPath: written.path, requestBytes: written.bytes, outputDir }),
    artifact: buildCalmAccountHomeFromTrustedM5bPackage(artifactSet, trustedPrepareResult),
    trustedPrepareResult,
    artifactSet,
  } as any;
}

describe("C1 Calm read-only Account Home", () => {
  test("produces byte-identical HTML from identical admitted input", async () => {
    const outputs: string[] = [];
    await withRoot(async (root) => {
      outputs.push((await prepareC1SyntheticScenario(root, { withMeetingPlan: false })).artifact.html);
    });
    await withRoot(async (root) => {
      outputs.push((await prepareC1SyntheticScenario(root, { withMeetingPlan: false })).artifact.html);
    });
    assert.equal(outputs.length, 2);
    assert.equal(outputs[0], outputs[1]);
  });

  test("renders one authored story in the exact density and decision order", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
      const view = artifact.viewModel;
      assert.equal(view.secondaryItems.length, 3);
      assert.deepEqual(view.orientation.map((item) => item.label), ["Established", "Open", "Next"]);
      assert.equal(view.primaryAction.label, "View evidence");
      assert.equal(view.meetingPlan, null);
      assert.ok(view.thesis.length > 0);
      assert.ok(view.change.length > 0);
      assert.ok(view.implication.length > 0);
      assert.ok(view.nextMove.length > 0);
      assert.match(view.trustLine, /^Draft · Attributed synthetic sources · Not reviewed · Freshness not established$/u);

      const html = artifact.html;
      const order = [
        html.indexOf('id="account-title"'),
        html.indexOf("What changed"),
        html.indexOf("Why it may matter"),
        html.indexOf("Recommended next move"),
        html.indexOf('class="trust-line"'),
      ];
      assert.ok(order.every((value) => value >= 0));
      assert.ok(order[0]! < order[1]! && order[1]! < order[2]! && order[2]! < order[3]! && order[3]! < order[4]!);
      assert.ok(html.includes("Established → Open → Next"));
      assert.ok(html.includes("Evidence horizon"));
      assert.equal((html.match(/class="secondary-rank"/gu) ?? []).length, 3);
      assert.match(html, /<details class="explore">/u);
      assert.doesNotMatch(defaultVisibleHtml(html), /Exact support 1|Source date|Publisher/iu);
    });
  });

  test("uses truthful plan and no-plan primary actions without milestone leakage", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
      assert.equal(artifact.viewModel.primaryAction.kind, "view_evidence");
      assert.match(artifact.html, />View evidence<\/button>/u);
      assert.doesNotMatch(artifact.html, /existing-meeting-plan/u);
      for (const forbidden of FORBIDDEN_C1_TEXT) assert.ok(!artifact.html.includes(forbidden), forbidden);
    });
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: true });
      assert.equal(artifact.viewModel.primaryAction.kind, "view_existing_meeting_plan");
      assert.match(artifact.html, />View existing meeting plan<\/button>/u);
      assert.match(artifact.html, /id="existing-meeting-plan"/u);
      assert.equal((artifact.html.match(/class="question-number"/gu) ?? []).length, 3);
      assert.match(artifact.html, /This plan already existed in the admitted input/u);
      for (const forbidden of FORBIDDEN_C1_TEXT) assert.ok(!artifact.html.includes(forbidden), forbidden);
    });
  });

  test("rejects unadmitted or tampered input before rendering", async () => {
    await withRoot(async (root) => {
      const prepared = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
      const clonedResult = JSON.parse(JSON.stringify(prepared.trustedPrepareResult));
      assert.throws(
        () => buildCalmAccountHomeFromTrustedM5bPackage(prepared.artifactSet, clonedResult),
        (error) => refusalCode(error) === "trusted_prepare_result_capability",
      );
      const tampered: any = cloneSynthetic(prepared.artifactSet);
      tampered.reviewPacket.subject.accountName = "Tampered account";
      assert.throws(
        () => buildCalmAccountHomeFromTrustedM5bPackage(tampered, prepared.trustedPrepareResult),
        (error) => refusalCode(error) === "trusted_prepare_result_artifact_binding",
      );
      const blocked = attemptCalmAccountHomeFromTrustedM5bPackage(tampered, prepared.trustedPrepareResult);
      assert.equal(blocked.status, "blocked");
      if (blocked.status !== "blocked") return;
      assert.equal(blocked.proof.reason, "input_not_admitted_or_insufficient");
      assert.match(blocked.proof.html, /Account Home unavailable/u);
      assert.match(blocked.proof.html, /No unsupported content was invented/u);
      assert.doesNotMatch(blocked.proof.html, /Tampered account|Citrine Works|<script>/u);
      assert.equal(blocked.proof.boundary.databaseWrites, 0);
      assert.equal(blocked.proof.boundary.graphWrites, 0);
    });
  });

  test("keeps evidence within one disclosure interaction and exposes human-useful boundaries only", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
      assert.equal(artifact.viewModel.evidence.length, 3);
      for (const evidence of artifact.viewModel.evidence) {
        assert.ok(evidence.sources.length > 0);
        assert.ok(evidence.supports.length > 0);
        assert.ok(evidence.doesNotEstablish.length > 0);
        assert.equal(evidence.reviewDisposition, "Not reviewed");
      }
      assert.equal((artifact.html.match(/class="evidence-dialog"/gu) ?? []).length, 3);
      assert.equal((artifact.html.match(/data-dialog="evidence-/gu) ?? []).length, 4);
      assert.match(artifact.html, /What this supports/u);
      assert.match(artifact.html, /What this does not establish/u);
      assert.doesNotMatch(artifact.html, /https:\/\/citrine\.example\.invalid/iu);
      assert.doesNotMatch(artifact.html, /src_[a-z0-9_-]+|prp_[a-z0-9_-]+|evd_[a-z0-9_-]+|[a-f0-9]{64}/iu);
      assert.doesNotMatch(artifact.html, /packageId|reviewPacket|sourcePack|effectBoundary|byte span|binding/iu);
    });
  });

  test("derives Source-backed and Reviewed only from their independent proofs", () => {
    assert.deepEqual(deriveCalmTrustLabels({
      sourceCustodyAuthenticated: false,
      exactSupportAccepted: true,
      humanReviewRecorded: false,
    }), { sourceSupport: "Attributed", review: "Not reviewed" });
    assert.deepEqual(deriveCalmTrustLabels({
      sourceCustodyAuthenticated: true,
      exactSupportAccepted: true,
      humanReviewRecorded: false,
    }), { sourceSupport: "Source-backed", review: "Not reviewed" });
    assert.deepEqual(deriveCalmTrustLabels({
      sourceCustodyAuthenticated: true,
      exactSupportAccepted: true,
      humanReviewRecorded: true,
    }), { sourceSupport: "Source-backed", review: "Reviewed" });
    assert.deepEqual(deriveCalmTrustLabels({
      sourceCustodyAuthenticated: true,
      exactSupportAccepted: false,
      humanReviewRecorded: true,
    }), { sourceSupport: "Attributed", review: "Reviewed" });
  });

  test("escapes hostile content and refuses unsafe source URLs", async () => {
    await withRoot(async (root) => {
      const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
      const { artifact } = await prepareVariant(root, (request) => {
        request.customerQuestions.whoIsThisAccount = `Prepared context ${hostile}`;
        request.customerQuestions.whyDoesItMatter = `Draft interpretation ${hostile}`;
        request.sources[1].title = `Source ${hostile}`;
        request.proposals.find((proposal: any) => proposal.classification === "recommendation").summary =
          `Draft next move ${hostile}`;
      });
      assert.ok(artifact.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
      assert.ok(artifact.html.includes("&lt;script&gt;alert(2)&lt;/script&gt;"));
      assert.doesNotMatch(artifact.html, /<img src=x|<script>alert\(2\)<\/script>/u);
      assert.doesNotMatch(artifact.html, /javascript:|data:text\/html/iu);
    });
    await withRoot(async (root) => {
      const scenario = await createC1SyntheticScenario(root, { withMeetingPlan: false });
      const request: any = cloneSynthetic(scenario.request);
      request.sources[0].canonicalUrl = "javascript:alert(1)";
      const written = await writeSyntheticRequest(root, "c1-unsafe-url-request.json", request);
      await assert.rejects(() => prepareM5bProductReview({
        requestPath: written.path,
        expectedRequestSha256: sha256Fixture(written.bytes),
        expectedRequestByteSize: written.bytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir: join(root, "unsafe-url-output"),
      }));
    });
  });

  test("handles stale, conflict, partial, and missing-optional states without inventing filler", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareVariant(root, (request) => {
        for (const source of request.sources) source.evidenceCurrentThrough = "2020-01-01";
        request.customerQuestions.whatNeedsAttention =
          "Sources disagree about current operating significance; the conflict remains open for human judgment.";
      });
      assert.match(artifact.html, /Freshness not established/u);
      assert.doesNotMatch(artifact.html, /Current through|Up to date|Fresh evidence/iu);
      assert.equal(artifact.viewModel.secondaryItems.filter((item) => item.label === "Open").length, 1);
      assert.match(artifact.html, /Sources disagree about current operating significance/u);
      assert.doesNotMatch(artifact.html, />Accept<|>Reject<|review queue/iu);
    });
    await withRoot(async (root) => {
      const scenario = await createC1SyntheticScenario(root, { withMeetingPlan: false });
      const request: any = cloneSynthetic(scenario.request);
      request.evidenceBindings = request.evidenceBindings.filter((item: any) => item.evidenceRole !== "material_change");
      const written = await writeSyntheticRequest(root, "c1-partial-request.json", request);
      await assert.rejects(() => prepareM5bProductReview({
        requestPath: written.path,
        expectedRequestSha256: sha256Fixture(written.bytes),
        expectedRequestByteSize: written.bytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir: join(root, "partial-output"),
      }));
    });
  });

  test("contains semantic, responsive, focus, reduced-motion, and no-side-effect structure", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
      const html = artifact.html;
      assert.match(html, /<header class="masthead">/u);
      assert.match(html, /<main id="main-content">/u);
      assert.match(html, /<h1 class="account-name"/u);
      assert.match(html, /<dialog class="evidence-dialog"/u);
      assert.match(html, /aria-labelledby=/u);
      assert.match(html, /min-height:\s*44px/u);
      assert.match(html, /@media\s*\(max-width:\s*900px\)/u);
      assert.match(html, /@media\s*\(max-width:\s*520px\)/u);
      assert.doesNotMatch(html, /\.story-section:first-child \.evidence-trigger\s*\{\s*display:\s*none/u);
      assert.match(html, /\.story-section:not\(\.next-plane\) \.evidence-trigger\s*\{\s*position:\s*absolute/u);
      assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
      assert.match(html, /:focus-visible/u);
      assert.match(html, /target\.focus\(\)/u);
      assert.match(html, /if\s*\(event\.target\s*===\s*dialog\)\s*dialog\.close\(\)/u);
      assert.doesNotMatch(html, /unsafe-inline/u);
      assert.match(html, /style-src &#39;sha256-[A-Za-z0-9+/=]+&#39;/u);
      assert.match(html, /script-src &#39;sha256-[A-Za-z0-9+/=]+&#39;/u);
      assert.doesNotMatch(html, /<a\s+href=/iu);
      const script = /<script>([\s\S]*?)<\/script>/u.exec(html)?.[1] ?? "";
      assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|sendBeacon/iu);
      assert.deepEqual(artifact.boundary, {
        mode: "local_test_only",
        readOnly: true,
        providerCalls: 0,
        networkCalls: 0,
        clientNetworkCalls: 0,
        externalNavigation: false,
        sourceAcquisitions: 0,
        privateReads: 0,
        databaseReads: 0,
        databaseWrites: 0,
        graphReads: 0,
        graphWrites: 0,
        persistenceWrites: 0,
        customerRoutes: 0,
        deployments: 0,
        outboundActions: 0,
      });
    });
  });

  test("does not link, embed, route to, or import the internal inspector/runtime surface", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
      assert.doesNotMatch(artifact.html, /Package Inspector|workshop-pre-ratification|\/workshop|iframe|embed/iu);
      const source = await readFile(join(process.cwd(), "src/workshop/calm-account-home.ts"), "utf8");
      assert.doesNotMatch(source, /src\/runtime|fake-mode-workshop-server|handleFakeMode|prepareRuntimeWorkshop/iu);
    });
  });

  test("keeps the checked golden Account Home in deterministic sync", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: false });
      const golden = await readFile(join(process.cwd(), "fixtures/workshop/c1-calm-account-home.html"), "utf8");
      assert.equal(golden, artifact.html);
    });
  });

  test("keeps the admitted-plan golden Account Home in deterministic sync", async () => {
    await withRoot(async (root) => {
      const { artifact } = await prepareC1SyntheticScenario(root, { withMeetingPlan: true });
      const golden = await readFile(join(process.cwd(), "fixtures/workshop/c1-calm-account-home-plan.html"), "utf8");
      assert.equal(golden, artifact.html);
      assert.match(golden, /data-dialog="evidence-change"/u);
      assert.match(golden, /data-dialog="existing-meeting-plan"/u);
    });
  });
});
