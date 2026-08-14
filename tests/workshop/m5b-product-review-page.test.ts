import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { validatedCandidateSha256 } from "../../src/graph/candidate-delta.ts";
import {
  M5bProductReviewRefusal,
  m5bProductReviewCanonicalSha256,
} from "../../src/workshop/m5b-product-review-contract.ts";
import { prepareM5bProductReview } from "../../src/workshop/m5b-product-review-prepare.ts";
import { admitM5bProductReviewPackageArtifacts } from
  "../../src/workshop/m5b-product-review-package-admission.ts";
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

function refusalCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof M5bProductReviewRefusal);
    return error.code;
  }
  assert.fail("expected M5bProductReviewRefusal");
}

function rehashSourcePack(sourcePack: any): void {
  const { sourcePackSha256: _oldHash, ...content } = sourcePack;
  sourcePack.sourcePackSha256 = m5bProductReviewCanonicalSha256(content);
}

function rehashSourceTransformation(source: any): void {
  source.transformationManifestSha256 = m5bProductReviewCanonicalSha256({
    kind: "m5b-product-review-bounded-excerpt-transformation",
    schemaVersion: "2",
    sourceId: source.sourceId,
    originContentSha256: source.originContentSha256,
    decodedContentSha256: source.decodedContentSha256,
    storedContentSha256: source.storedContentSha256,
    fullSourceBytesEmbedded: false,
    sourceProvenance: source.provenance,
    evidenceBindings: source.evidenceBindings.map((binding: any) => ({
      evidenceId: binding.evidenceId,
      evidenceRole: binding.evidenceRole,
      exactQuoteSha256: binding.exactQuoteSha256,
      sourceCharStart: binding.sourceCharStart,
      sourceCharEnd: binding.sourceCharEnd,
      storedCharStart: binding.storedCharStart,
      storedCharEnd: binding.storedCharEnd,
    })),
  });
}

function sourceRegisterFor(sourcePack: any): any[] {
  return sourcePack.sources.map((source: any) => ({
    sourceId: source.sourceId,
    title: source.title,
    canonicalUrl: source.canonicalUrl,
    contentEncoding: source.contentEncoding,
    originContentSha256: source.originContentSha256,
    decodedByteSize: source.decodedByteSize,
    decodedContentSha256: source.decodedContentSha256,
    storedContentSha256: source.storedContentSha256,
    transformationManifestSha256: source.transformationManifestSha256,
    provenance: source.provenance,
    evidenceCurrentThrough: source.evidenceCurrentThrough,
  }));
}

function rehashPacket(packet: any): void {
  const { reviewPacketSha256: _oldHash, ...content } = packet;
  packet.reviewPacketSha256 = m5bProductReviewCanonicalSha256(content);
}

function bindPacketToRehashedSourcePack(packet: any, sourcePack: any): void {
  packet.sourcePackSha256 = sourcePack.sourcePackSha256;
  rehashPacket(packet);
}

function bindPacketToRehashedCandidate(packet: any, candidate: any): void {
  packet.candidateSha256 = validatedCandidateSha256(candidate);
  rehashPacket(packet);
}

function artifactSet(sourcePack: any, candidate: any, reviewPacket: any): any {
  return { sourcePack, candidate, reviewPacket };
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
      assert.match(html, /Package-attributed · not independently verified/);
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
      assert.match(html, /3 evidence bindings/);
      assert.doesNotMatch(html, /1 evidence bindings/);
      assert.match(html, /Material change/);
      assert.match(html, /Account context/);
      assert.match(html, /Prepare-command effect boundary/);
      assert.match(html, /generated package files must remain unchanged/);

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
        assert.ok(firstDisclosure.includes(binding.evidenceRole === "material_change"
          ? "Material change"
          : binding.evidenceRole === "account_identity" ? "Account identity" : "Account context"));
      }

      const destinationStart = html.indexOf('<section id="draft-meeting-brief"');
      const destinationEnd = html.indexOf('<details class="source-details">', destinationStart);
      const destination = html.slice(destinationStart, destinationEnd);
      assert.ok(destinationStart > 0 && destinationEnd > destinationStart);
      assert.match(destination, /Draft meeting brief — Citrine Works \(fictional\)/);
      assert.match(destination, /acc_citrine_works/);
      for (const answer of Object.values(scenario.request.customerQuestions)
        .filter((value): value is string => typeof value === "string")) {
        assert.ok(destination.includes(answer), `CTA destination must include account answer: ${answer}`);
      }
      assert.match(destination, /Material-change evidence:<\/strong> <code>evd_citrine_launch<\/code>/);
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

  test("features one connected material-change Signal to Map to Play chain", async () => {
    await withScenario(async (root, scenario) => {
      const request: any = cloneSynthetic(scenario.request);
      request.evidenceBindings[1].evidenceRole = "material_change";
      request.proposals[1].lens = "signal";
      request.proposals.splice(3, 0, {
        proposalId: "prp_citrine_disconnected_material_map",
        classification: "analysis",
        lens: "map",
        title: "Pilot completion alone is a separate material interpretation",
        summary: "The pilot completion excerpt can support a separate bounded interpretation for review.",
        evidenceBindingIds: ["evd_citrine_pilot"],
        supportingProposalIds: ["prp_citrine_pilot_fact"],
        caveats: ["This interpretation does not depend on the material-change Signal selected for the Play."],
        safeTask: null,
      });
      const written = await writeSyntheticRequest(root, "disconnected-material-map-request.json", request);
      const outputDir = join(root, "disconnected-material-map-output");
      await prepareM5bProductReview({
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir,
      });
      const html = await readFile(join(outputDir, "workshop-pre-ratification.html"), "utf8");
      const destinationStart = html.indexOf('<section id="draft-meeting-brief"');
      const destinationEnd = html.indexOf('<details class="source-details">', destinationStart);
      const destination = html.slice(destinationStart, destinationEnd);
      assert.match(destination, /Exception handling is a plausible discovery focus/);
      assert.doesNotMatch(destination, /Pilot completion alone is a separate material interpretation/);
      assert.match(destination, /Source states: Citrine Works introduced Relay Planner/);
      assert.match(destination, /Draft a targeted exception-workflow meeting brief/);
    });
  });

  test("meeting brief is deterministic, package-bound, caveated, and explicitly unsent", async () => {
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
      assert.match(brief, /## Package evidence register/);
      assert.match(brief, /Material-change evidence: `evd_citrine_launch`/);
      assert.match(brief, /Evidence role: \*\*Material change\*\*/);
      assert.match(brief, /Evidence role: \*\*Account context\*\*/);
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
      assert.match(brief, /These counts cover this prepare command only/);
      assert.match(brief, /must not be added by editing these generated artifacts/);
      assert.doesNotMatch(brief, /independently verified\.|quality passed\.|ready to send|was sent/i);
    });
  });

  test("package admission refuses historical versions and broken current-package hashes", async () => {
    await withScenario(async (_root, scenario) => {
      await prepareM5bProductReview({
        requestPath: scenario.requestPath,
        expectedRequestSha256: sha256Fixture(scenario.requestBytes),
        expectedRequestByteSize: scenario.requestBytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir: scenario.outputDir,
      });
      const sourcePack = JSON.parse(await readFile(
        join(scenario.outputDir, "sanitized-source-pack.json"), "utf8"));
      const packet = JSON.parse(await readFile(join(scenario.outputDir, "review-packet.json"), "utf8"));
      const candidate = JSON.parse(await readFile(join(scenario.outputDir, "candidate.json"), "utf8"));
      assert.doesNotThrow(() =>
        admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, packet)));

      const legacyPacket = cloneSynthetic(packet);
      legacyPacket.schemaVersion = "1";
      const { reviewPacketSha256: _oldPacketHash, ...legacyPacketContent } = legacyPacket;
      legacyPacket.reviewPacketSha256 = m5bProductReviewCanonicalSha256(legacyPacketContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, legacyPacket))),
        "render_package_version");

      const legacyPack = cloneSynthetic(sourcePack);
      legacyPack.schemaVersion = "1";
      const { sourcePackSha256: _oldPackHash, ...legacyPackContent } = legacyPack;
      legacyPack.sourcePackSha256 = m5bProductReviewCanonicalSha256(legacyPackContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(legacyPack, candidate, packet))),
        "render_package_version");

      const brokenPacket = cloneSynthetic(packet);
      brokenPacket.customerQuestions[1].answer += " tampered";
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, brokenPacket))),
        "render_package_binding");

      const crossSubject = cloneSynthetic(packet);
      crossSubject.subject.accountId = "acc_other_account";
      crossSubject.subject.accountName = "Other account";
      const { reviewPacketSha256: _crossSubjectHash, ...crossSubjectContent } = crossSubject;
      crossSubject.reviewPacketSha256 = m5bProductReviewCanonicalSha256(crossSubjectContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, crossSubject))),
        "render_package_binding");

      const executableMarkup = cloneSynthetic(packet);
      executableMarkup.candidateSha256 = "</p><script>globalThis.pwned=true</script><p>";
      const { reviewPacketSha256: _markupHash, ...markupContent } = executableMarkup;
      executableMarkup.reviewPacketSha256 = m5bProductReviewCanonicalSha256(markupContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, executableMarkup))),
        "render_package_binding");

      const fullyRehashedFakeCandidate = cloneSynthetic(packet);
      fullyRehashedFakeCandidate.candidateSha256 = "c".repeat(64);
      rehashPacket(fullyRehashedFakeCandidate);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(
        artifactSet(sourcePack, candidate, fullyRehashedFakeCandidate))), "render_candidate_binding");

      const fullyRehashedFakeOriginPack = cloneSynthetic(sourcePack);
      fullyRehashedFakeOriginPack.sources[0].originContentSha256 = "2".repeat(64);
      fullyRehashedFakeOriginPack.sources[0].provenance.outerCustodySha256 = "2".repeat(64);
      rehashSourceTransformation(fullyRehashedFakeOriginPack.sources[0]);
      rehashSourcePack(fullyRehashedFakeOriginPack);
      const fullyRehashedFakeOriginPacket = cloneSynthetic(packet);
      fullyRehashedFakeOriginPacket.sourceRegister = sourceRegisterFor(fullyRehashedFakeOriginPack);
      bindPacketToRehashedSourcePack(fullyRehashedFakeOriginPacket, fullyRehashedFakeOriginPack);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(
        artifactSet(fullyRehashedFakeOriginPack, candidate, fullyRehashedFakeOriginPacket))),
      "render_candidate_binding");

      const candidateSemanticTamper: readonly [string, (value: any) => void][] = [
        ["user-created account object", (value) => {
          value.graph_bundle.account_objects[0].created_by = "user";
        }],
        ["high-confidence account object", (value) => {
          value.graph_bundle.account_objects[0].confidence = "high";
        }],
        ["unsupported account object", (value) => {
          value.graph_bundle.account_objects[0].provenance_status = "unsupported";
        }],
        ["rejected claim", (value) => {
          value.graph_bundle.claims[0].status = "rejected";
        }],
        ["contradicting claim evidence", (value) => {
          value.graph_bundle.claim_evidence[0].relationship = "contradicts";
        }],
        ["supporting account-object claim", (value) => {
          value.graph_bundle.account_object_claims[0].relationship = "supporting";
        }],
      ];
      for (const [label, mutate] of candidateSemanticTamper) {
        const changedCandidate = cloneSynthetic(candidate);
        const changedCandidatePacket = cloneSynthetic(packet);
        mutate(changedCandidate);
        bindPacketToRehashedCandidate(changedCandidatePacket, changedCandidate);
        assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(
          artifactSet(sourcePack, changedCandidate, changedCandidatePacket))),
        "render_candidate_binding", label);
      }

      const contextQuestion = cloneSynthetic(packet);
      contextQuestion.customerQuestions[1].evidenceBindingIds = ["evd_citrine_pilot"];
      const { reviewPacketSha256: _contextHash, ...contextContent } = contextQuestion;
      contextQuestion.reviewPacketSha256 = m5bProductReviewCanonicalSha256(contextContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, contextQuestion))),
        "render_question_binding");

      const noSignalChain = cloneSynthetic(packet);
      noSignalChain.proposals[0].lens = "map";
      noSignalChain.lenses = ["signal", "map", "play"].map((lens) => ({
        lens,
        proposalIds: noSignalChain.proposals.filter((proposal: any) => proposal.lens === lens)
          .map((proposal: any) => proposal.proposalId),
      }));
      const { reviewPacketSha256: _noSignalHash, ...noSignalContent } = noSignalChain;
      noSignalChain.reviewPacketSha256 = m5bProductReviewCanonicalSha256(noSignalContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, noSignalChain))),
        "render_question_binding");

      const unrelatedPlay = cloneSynthetic(packet);
      const forgedPlay = cloneSynthetic(unrelatedPlay.proposals.at(-1));
      forgedPlay.proposalId = "prp_citrine_unrelated_play";
      forgedPlay.title = "Draft a context-only meeting brief";
      forgedPlay.summary = "Use only the pilot context for this unrelated draft brief.";
      forgedPlay.evidenceBindings = cloneSynthetic(unrelatedPlay.proposals[1].evidenceBindings);
      unrelatedPlay.proposals.push(forgedPlay);
      unrelatedPlay.lenses.find((item: any) => item.lens === "play").proposalIds.push(forgedPlay.proposalId);
      const { reviewPacketSha256: _unrelatedPlayHash, ...unrelatedPlayContent } = unrelatedPlay;
      unrelatedPlay.reviewPacketSha256 = m5bProductReviewCanonicalSha256(unrelatedPlayContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, unrelatedPlay))),
        "render_material_change_chain");

      const fabricatedPack = cloneSynthetic(sourcePack);
      const fabricatedBinding = fabricatedPack.sources[0].evidenceBindings[0];
      fabricatedBinding.exactQuote = "X".repeat(fabricatedBinding.exactQuote.length);
      fabricatedBinding.exactQuoteSha256 = "0".repeat(64);
      const { sourcePackSha256: _fabricatedPackHash, ...fabricatedPackContent } = fabricatedPack;
      fabricatedPack.sourcePackSha256 = m5bProductReviewCanonicalSha256(fabricatedPackContent);
      const fabricatedPacket = cloneSynthetic(packet);
      fabricatedPacket.sourcePackSha256 = fabricatedPack.sourcePackSha256;
      for (const proposal of fabricatedPacket.proposals) {
        proposal.evidenceBindings = proposal.evidenceBindings.map((binding: any) =>
          binding.evidenceId === fabricatedBinding.evidenceId ? cloneSynthetic(fabricatedBinding) : binding);
      }
      const { reviewPacketSha256: _fabricatedPacketHash, ...fabricatedPacketContent } = fabricatedPacket;
      fabricatedPacket.reviewPacketSha256 = m5bProductReviewCanonicalSha256(fabricatedPacketContent);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(fabricatedPack, candidate, fabricatedPacket))), "render_package_shape");

      const malformedEvidence = cloneSynthetic(packet);
      malformedEvidence.proposals[0].evidenceBindings = [null];
      rehashPacket(malformedEvidence);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, malformedEvidence))),
        "render_package_shape");

      const forgedFact = cloneSynthetic(packet);
      forgedFact.proposals[1].title = "Source states: an invented account claim";
      forgedFact.proposals[1].summary = forgedFact.proposals[1].title;
      rehashPacket(forgedFact);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, forgedFact))),
        "render_proposal_topology");

      const outboundTask = cloneSynthetic(packet);
      outboundTask.proposals.at(-1).safeTask.description = "Send the brief to the account immediately.";
      rehashPacket(outboundTask);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, outboundTask))),
        "render_proposal_topology");

      const outboundAnswer = cloneSynthetic(packet);
      outboundAnswer.customerQuestions[4].answer = "Send the brief to the account immediately.";
      rehashPacket(outboundAnswer);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(sourcePack, candidate, outboundAnswer))),
        "render_question_binding");

      const wrongPackageIdPack = cloneSynthetic(sourcePack);
      wrongPackageIdPack.packageBinding.packageId = "m5b-product-review-000000000000000000000000";
      rehashSourcePack(wrongPackageIdPack);
      const wrongPackageIdPacket = cloneSynthetic(packet);
      wrongPackageIdPacket.packageBinding.packageId = wrongPackageIdPack.packageBinding.packageId;
      bindPacketToRehashedSourcePack(wrongPackageIdPacket, wrongPackageIdPack);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(wrongPackageIdPack, candidate, wrongPackageIdPacket))), "render_package_binding");

      const embeddedFullSourcePack = cloneSynthetic(sourcePack);
      embeddedFullSourcePack.contentPolicy.fullSourceBytesEmbedded = true;
      rehashSourcePack(embeddedFullSourcePack);
      const embeddedFullSourcePacket = cloneSynthetic(packet);
      bindPacketToRehashedSourcePack(embeddedFullSourcePacket, embeddedFullSourcePack);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(embeddedFullSourcePack, candidate, embeddedFullSourcePacket))), "render_package_binding");

      const invalidUrlPack = cloneSynthetic(sourcePack);
      invalidUrlPack.sources[0].canonicalUrl = "file:///private/source";
      rehashSourcePack(invalidUrlPack);
      const invalidUrlPacket = cloneSynthetic(packet);
      bindPacketToRehashedSourcePack(invalidUrlPacket, invalidUrlPack);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(invalidUrlPack, candidate, invalidUrlPacket))), "render_package_shape");

      const invalidTimePack = cloneSynthetic(sourcePack);
      invalidTimePack.sources[0].acquiredAt = "July 15";
      rehashSourcePack(invalidTimePack);
      const invalidTimePacket = cloneSynthetic(packet);
      bindPacketToRehashedSourcePack(invalidTimePacket, invalidTimePack);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(invalidTimePack, candidate, invalidTimePacket))), "render_package_shape");

      const identityOnlyPack = cloneSynthetic(sourcePack);
      identityOnlyPack.subject.accountName = identityOnlyPack.sources[0].evidenceBindings[0].exactQuote;
      rehashSourcePack(identityOnlyPack);
      const identityOnlyPacket = cloneSynthetic(packet);
      identityOnlyPacket.subject.accountName = identityOnlyPack.subject.accountName;
      bindPacketToRehashedSourcePack(identityOnlyPacket, identityOnlyPack);
      assert.equal(refusalCode(() => admitM5bProductReviewPackageArtifacts(artifactSet(identityOnlyPack, candidate, identityOnlyPacket))), "material_change_identity_only");
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
