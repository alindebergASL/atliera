import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { prepareM5bProductReview } from "../../src/workshop/m5b-product-review-prepare.ts";
import {
  cloneSynthetic,
  createSyntheticM5bProductReviewScenario,
  sha256Fixture,
  writeSyntheticRequest,
} from "../fixtures/m5b-product-review-synthetic.ts";

async function withScenario<T>(fn: (root: string, scenario: Awaited<ReturnType<
  typeof createSyntheticM5bProductReviewScenario>>) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "atliera-product-page-"));
  try {
    return await fn(root, await createSyntheticM5bProductReviewScenario(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("M5b product-review Workshop and meeting brief", () => {
  test("puts customer meaning and a useful Signal before custody, with truthful local-only controls", async () => {
    await withScenario(async (_root, scenario) => {
      await prepareM5bProductReview({
        requestPath: scenario.requestPath,
        expectedRequestSha256: sha256Fixture(scenario.requestBytes),
        expectedRequestByteSize: scenario.requestBytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir: scenario.outputDir,
      });
      const html = await readFile(join(scenario.outputDir, "workshop-pre-ratification.html"), "utf8");
      const body = html.slice(html.indexOf("<body>"));
      const primaryAt = body.indexOf("Review the draft meeting brief");
      const signalAt = body.indexOf("Source states: Citrine Works introduced Relay Planner");
      const questionsAt = body.indexOf("Five questions for this account");
      const proposalsAt = body.indexOf("Individual review");
      const custodyAt = body.indexOf("Evidence currency, source custody, and package hashes");
      assert.ok(primaryAt > 0 && primaryAt < signalAt);
      assert.ok(signalAt < questionsAt && questionsAt < proposalsAt && proposalsAt < custodyAt);
      assert.ok(signalAt < 2_500, "meaningful Signal should occur early in the mobile body");

      for (const question of [
        "Who is this account?",
        "What meaningfully changed?",
        "Why does it matter?",
        "What needs attention?",
        "What safe task can Atliera help complete next?",
      ]) assert.match(html, new RegExp(question.replace(/[?]/g, "\\?")));

      assert.match(html, /Source fact/);
      assert.match(html, /Analysis/);
      assert.match(html, /Recommendation/);
      assert.match(html, /Source-backed · not independently verified/);
      assert.match(html, /Not human-ratified · not quality-passed/);
      assert.match(html, /system-created · proposed · not durable/);
      assert.match(html, /Evidence current through:<\/strong> Not supplied/);
      assert.match(html, /DRAFT · NOT SENT · NOT RATIFIED/);
      assert.match(html, /Draft only · non-executable · no outbound action/);

      assert.equal((html.match(/type="radio"/g) ?? []).length, scenario.request.proposals.length * 2);
      assert.equal((html.match(/>Accept<\/label>/g) ?? []).length, scenario.request.proposals.length);
      assert.equal((html.match(/>Reject<\/label>/g) ?? []).length, scenario.request.proposals.length);
      assert.equal((html.match(/Local draft only · not saved · not ratified · no write authority/g) ?? []).length,
        scenario.request.proposals.length + 1);
      assert.doesNotMatch(html, /<form\b|<button\b|<script\b|localStorage|sessionStorage|fetch\(|XMLHttpRequest|type="submit"|checked=/i);
      assert.doesNotMatch(html, /submit proposal|apply proposal|persist selection/i);
      assert.match(html, /<link rel="icon" href="data:," \/>/);

      assert.match(html, /html,body\{max-width:100%;overflow-x:hidden\}/);
      assert.match(html, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
      assert.match(html, /min-width:0/);
      assert.match(html, /overflow-wrap:anywhere/);
      assert.match(html, /min-height:44px/);
      assert.match(html, /min-height:48px/);
      assert.match(html, /@media\(max-width:720px\)/);
      assert.match(html, /@media\(max-width:420px\)/);
      assert.match(html, /focus-visible/);
      assert.match(html, /3 admitted sources/);
      assert.match(html, /1 evidence binding/);
      assert.match(html, /2 evidence bindings/);
      assert.doesNotMatch(html, /1 evidence bindings/);

      const anchorHrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]!);
      assert.deepEqual(anchorHrefs, ["#draft-meeting-brief"]);
      assert.doesNotMatch(html, /<a\b[^>]*href="https:\/\//i);
      assert.equal((html.match(/Canonical HTTPS source:/g) ?? []).length, scenario.request.sources.length);

      for (const binding of scenario.request.evidenceBindings) {
        const source = scenario.request.sources.find((item) => item.sourceId === binding.sourceId)!;
        const evidenceStart = html.indexOf(`<strong>${binding.evidenceId}</strong>`);
        const evidenceEnd = html.indexOf("</li>", evidenceStart);
        const firstDisclosure = html.slice(evidenceStart, evidenceEnd);
        assert.ok(evidenceStart > 0 && evidenceEnd > evidenceStart,
          `evidence disclosure must exist for ${binding.evidenceId}`);
        assert.ok(firstDisclosure.includes(source.title));
        assert.ok(firstDisclosure.includes(source.publisher));
        assert.ok(firstDisclosure.includes(source.acquiredAt));
        assert.ok(firstDisclosure.includes(source.evidenceCurrentThrough ?? "Not supplied"));
      }

      const destinationStart = html.indexOf('<section id="draft-meeting-brief"');
      const destinationEnd = html.indexOf('<details class="source-details">', destinationStart);
      const destination = html.slice(destinationStart, destinationEnd);
      assert.ok(destinationStart > 0 && destinationEnd > destinationStart);
      assert.match(destination, /Draft meeting brief — Citrine Works \(fictional\)/);
      assert.match(destination, /acc_citrine_works/);
      for (const answer of Object.values(scenario.request.customerQuestions)) {
        assert.ok(destination.includes(answer), `CTA destination must include account answer: ${answer}`);
      }
      for (const proposal of scenario.request.proposals.filter((item) =>
        item.lens === "signal" || item.classification === "analysis" || item.classification === "recommendation")) {
        assert.ok(destination.includes(proposal.title));
        assert.ok(destination.includes(proposal.summary));
      }
      assert.match(destination, />Signal<.*>Source fact</s);
      assert.match(destination, />Map<.*>Analysis</s);
      assert.match(destination, />Play<.*>Recommendation</s);
      assert.match(destination, /not independently verified · not human-ratified · not durable/);
      assert.match(destination, /no send, submit, save, ratify, or apply action exists here/);
      assert.ok(destination.length > scenario.request.customerQuestions.safeNextTask.length * 10,
        "generic safe-task copy alone is not a readable account brief");
    });
  });

  test("meeting brief is deterministic, source-bound, caveated, and explicitly unsent", async () => {
    await withScenario(async (_root, scenario) => {
      const result = await prepareM5bProductReview({
        requestPath: scenario.requestPath,
        expectedRequestSha256: sha256Fixture(scenario.requestBytes),
        expectedRequestByteSize: scenario.requestBytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir: scenario.outputDir,
      });
      const brief = await readFile(join(scenario.outputDir, "meeting-brief.md"), "utf8");
      assert.match(brief, /^# DRAFT targeted meeting brief — NOT SENT \/ NOT RATIFIED$/m);
      assert.match(brief, /has not been sent, independently verified, quality-passed, human-ratified, armed, or made durable/);
      assert.match(brief, /no write authority and no apply eligibility/);
      assert.match(brief, /## Five customer questions/);
      assert.match(brief, /## Proposed Signals, Maps, and Plays/);
      assert.match(brief, /## Exact evidence register/);
      assert.match(brief, /Evidence current through: Not supplied/);
      assert.match(brief, /The pilot is small and the notes do not establish demand/);
      assert.match(brief, /reviewer should confirm the audience, evidence currency/);
      for (const source of scenario.request.sources) {
        assert.match(brief, new RegExp(source.sourceId));
        assert.match(brief, new RegExp(source.rawSha256));
      }
      for (const evidence of scenario.request.evidenceBindings) assert.match(brief, new RegExp(evidence.evidenceId));
      assert.match(brief, new RegExp(result.packageBinding.supersededPackageResultSha256));
      assert.match(brief, new RegExp(result.sourcePackSha256));
      assert.match(brief, new RegExp(result.candidateSha256));
      assert.match(brief, new RegExp(result.reviewPacketSha256));
      assert.match(brief, /Network calls 0 · provider calls 0 · acquisitions 0 · database writes 0 · graph writes 0/);
      assert.doesNotMatch(brief, /independently verified\.|quality passed\.|ready to send|was sent/i);
    });
  });

  test("escapes hostile manifest text and never turns it into markup or executable links", async () => {
    await withScenario(async (root, scenario) => {
      const request: any = cloneSynthetic(scenario.request);
      request.subject.accountName = "<img src=x onerror=alert(1)> Fictional account";
      request.sources[0].title = "</h3><script>alert('source')</script> synthetic title";
      request.customerQuestions.whoIsThisAccount =
        "A fictional account with <strong>untrusted</strong> manifest text & no markup authority.";
      request.proposals[3].title = "<svg onload=alert(2)> Exception analysis remains a draft";
      const written = await writeSyntheticRequest(root, "hostile-display-request.json", request);
      const outputDir = join(root, "hostile-display-output");
      await prepareM5bProductReview({
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir,
      });
      const html = await readFile(join(outputDir, "workshop-pre-ratification.html"), "utf8");
      assert.doesNotMatch(html, /<script>alert\('source'\)<\/script>|<img src=x onerror=alert\(1\)>|<svg onload=alert\(2\)>/);
      assert.match(html, /&lt;script&gt;alert\(&#39;source&#39;\)&lt;\/script&gt;/);
      assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
      assert.match(html, /&lt;strong&gt;untrusted&lt;\/strong&gt; manifest text &amp;/);
      assert.doesNotMatch(html, /javascript:|data:text\/html/i);

      const brief = await readFile(join(outputDir, "meeting-brief.md"), "utf8");
      assert.doesNotMatch(brief, /^<img|^<svg|^<script/gm);
      assert.ok(brief.includes("\\<img src=x onerror=alert(1)\\>"));
    });
  });
});
