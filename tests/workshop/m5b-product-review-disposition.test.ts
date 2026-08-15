import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  M5bProductReviewRefusal,
  m5bProductReviewCanonicalSha256,
} from "../../src/workshop/m5b-product-review-contract.ts";
import {
  M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY,
  M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_VERSION,
  createM5bProductReviewOwnerDispositionTemplate,
  validateM5bProductReviewOwnerDisposition,
} from "../../src/workshop/m5b-product-review-disposition.ts";
import type { M5bProductReviewPacket } from "../../src/workshop/m5b-product-review-package.ts";
import { prepareM5bProductReview } from "../../src/workshop/m5b-product-review-prepare.ts";
import {
  createSyntheticM5bProductReviewScenario,
  sha256Fixture,
} from "../fixtures/m5b-product-review-synthetic.ts";

interface TestPackageArtifacts {
  readonly sourcePack: any;
  readonly candidate: any;
  readonly reviewPacket: M5bProductReviewPacket;
}

async function withArtifacts<T>(fn: (artifacts: TestPackageArtifacts) => Promise<T> | T): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "atliera-product-disposition-"));
  try {
    const scenario = await createSyntheticM5bProductReviewScenario(root);
    await prepareM5bProductReview({
      requestPath: scenario.requestPath,
      expectedRequestSha256: sha256Fixture(scenario.requestBytes),
      expectedRequestByteSize: scenario.requestBytes.byteLength,
      sourceFiles: scenario.sourceFiles,
      outputDir: scenario.outputDir,
    });
    const sourcePack = JSON.parse(await readFile(
      join(scenario.outputDir, "sanitized-source-pack.json"), "utf8"));
    const candidate = JSON.parse(await readFile(join(scenario.outputDir, "candidate.json"), "utf8"));
    const reviewPacket = JSON.parse(await readFile(join(scenario.outputDir, "review-packet.json"), "utf8"));
    return await fn({ sourcePack, candidate, reviewPacket });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function clone<T>(value: T): any {
  return JSON.parse(JSON.stringify(value));
}

function rehashPacket(packet: any): void {
  const { reviewPacketSha256: _oldHash, ...content } = packet;
  packet.reviewPacketSha256 = m5bProductReviewCanonicalSha256(content);
}

function refusalCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof M5bProductReviewRefusal);
    return error.code;
  }
  assert.fail("expected product-review refusal");
}

describe("M5b product-review non-executable owner disposition", () => {
  test("binds one accept/reject per proposal to the exact package without ratification or apply authority", async () => {
    await withArtifacts((artifacts) => {
      const packet = artifacts.reviewPacket;
      const artifact = createM5bProductReviewOwnerDispositionTemplate(artifacts,
        packet.proposals.map((proposal, index) => ({ proposalId: proposal.proposalId,
          disposition: index % 2 === 0 ? "accept" as const : "reject" as const })));
      assert.equal(artifact.packageBinding.packageId, packet.packageBinding.packageId);
      assert.equal(artifact.schemaVersion, M5B_PRODUCT_REVIEW_OWNER_DISPOSITION_VERSION);
      assert.equal(artifact.schemaVersion, "2");
      assert.equal(artifact.packageBinding.sourcePackSha256, packet.sourcePackSha256);
      assert.equal(artifact.packageBinding.candidateSha256, packet.candidateSha256);
      assert.equal(artifact.packageBinding.reviewPacketSha256, packet.reviewPacketSha256);
      assert.deepEqual(artifact.authorityBoundary, M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY);
      assert.equal(artifact.decisions.length, packet.proposals.length);
      assert.doesNotMatch(JSON.stringify(artifact), /ratifierIdentity|ratifiedAt/);
      assert.equal(artifact.authorityBoundary.applyInputEligible, false);
      assert.equal(artifact.authorityBoundary.packageProvenanceAuthenticated, false);
      assert.equal(artifact.authorityBoundary.authorizesRatification, false);
      assert.equal(artifact.authorityBoundary.authorizesGraphWrite, false);
      assert.equal(artifact.authorityBoundary.authorizesDeployment, false);
      assert.equal(validateM5bProductReviewOwnerDisposition(clone(artifact), artifacts).dispositionSha256,
        artifact.dispositionSha256);
    });
  });

  test("rejects missing, duplicate, reordered, forged package/hash, boundary, and self-hash data", async () => {
    await withArtifacts((artifacts) => {
      const packet = artifacts.reviewPacket;
      const baseline = createM5bProductReviewOwnerDispositionTemplate(artifacts,
        packet.proposals.map((proposal) => ({ proposalId: proposal.proposalId, disposition: "reject" as const })));
      const cases: Array<[any, string]> = [];
      const missing = clone(baseline); missing.decisions.pop(); cases.push([missing, "owner_disposition_decisions"]);
      const duplicate = clone(baseline); duplicate.decisions[1].proposalId = duplicate.decisions[0].proposalId;
      cases.push([duplicate, "owner_disposition_decisions"]);
      const reordered = clone(baseline); reordered.decisions.reverse(); cases.push([reordered, "owner_disposition_decisions"]);
      const packageId = clone(baseline); packageId.packageBinding.packageId += "x";
      cases.push([packageId, "owner_disposition_binding"]);
      const candidate = clone(baseline); candidate.packageBinding.candidateSha256 = "0".repeat(64);
      cases.push([candidate, "owner_disposition_binding"]);
      const review = clone(baseline); review.packageBinding.reviewPacketSha256 = "0".repeat(64);
      cases.push([review, "owner_disposition_binding"]);
      const boundary = clone(baseline); boundary.authorityBoundary.authorizesApply = true;
      cases.push([boundary, "owner_disposition_binding"]);
      const hash = clone(baseline); hash.dispositionSha256 = "0".repeat(64);
      cases.push([hash, "owner_disposition_hash"]);
      const extra = clone(baseline); extra.ratifierIdentity = "forged";
      cases.push([extra, "owner_disposition_shape"]);
      const historicalV1 = clone(baseline); historicalV1.schemaVersion = "1";
      cases.push([historicalV1, "owner_disposition_binding"]);
      for (const [raw, expected] of cases) {
        assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(raw, artifacts)), expected);
      }
    });
  });

  test("rejects self-rehashed executable proposal semantics at both disposition entry points", async () => {
    await withArtifacts((artifacts) => {
      const malformed = clone(artifacts);
      const proposal = malformed.reviewPacket.proposals[0];
      proposal.status = "accepted";
      proposal.classification = "recommendation";
      proposal.lens = "play";
      proposal.allowedLocalDispositions = ["execute", "apply"];
      proposal.trust.humanRatified = true;
      proposal.trust.durable = true;
      proposal.safeTask = {
        kind: "execute_shell",
        description: "Apply this change now",
        nonExecutable: false,
      };
      rehashPacket(malformed.reviewPacket);
      const decisions = malformed.reviewPacket.proposals.map((item: any) => ({
        proposalId: item.proposalId,
        disposition: "accept" as const,
      }));

      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(
        malformed, decisions)), "owner_disposition_packet");
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(
        {}, malformed)), "owner_disposition_packet");
    });
  });

  test("rejects a from-scratch self-rehashed packet with fabricated identities and executable boundaries", async () => {
    await withArtifacts((artifacts) => {
      const content = {
        kind: "m5b-product-review-packet",
        schemaVersion: "2",
        packageBinding: {
          packageId: "m5b-product-review-aaaaaaaaaaaaaaaaaaaaaaaa",
          requestRawSha256: "1".repeat(64),
          requestCanonicalSha256: "2".repeat(64),
          supersededPackageResultSha256: "3".repeat(64),
          ownerAuthorizationId: "forged.owner",
          executionCommit: "4".repeat(40),
          executionTree: "5".repeat(40),
        },
        subject: null,
        sourcePackSha256: "6".repeat(64),
        candidateSha256: "7".repeat(64),
        authority: {
          currentEffectiveAuthorization: "apply",
          ratificationStatus: "ratified",
          armingStatus: "armed",
          applyEligibility: true,
        },
        effectBoundary: { authorizesApply: true, authorizesGraphWrite: true },
        reviewBoundary: {
          localSelectionsOnly: false,
          selectionsSaved: true,
          selectionsAreRatification: true,
          writeAuthority: "graph_and_database",
        },
        customerQuestions: null,
        lenses: null,
        sourceRegister: null,
        proposals: [{
          proposalId: "prp_fabricated",
          status: null,
          classification: null,
          lens: null,
          title: null,
          summary: null,
          allowedLocalDispositions: ["execute", "apply"],
          evidenceBindings: null,
          supportingProposalIds: null,
          caveats: null,
          safeTask: { kind: "execute_shell", description: "Apply this change now" },
          trust: { humanRatified: true, durable: true },
        }],
      };
      const forgedArtifacts = {
        sourcePack: artifacts.sourcePack,
        candidate: artifacts.candidate,
        reviewPacket: {
          ...content,
          reviewPacketSha256: m5bProductReviewCanonicalSha256(content),
        },
      };
      const decisions = [{ proposalId: "prp_fabricated", disposition: "accept" as const }];

      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(
        forgedArtifacts, decisions)), "owner_disposition_packet");
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(
        {}, forgedArtifacts)), "owner_disposition_packet");
    });
  });

  test("rejects Proxy/accessor inputs without invoking traps and remains absent from every apply implementation", async () => {
    await withArtifacts(async (artifacts) => {
      const proxy = new Proxy({}, { ownKeys() { throw new Error("proxy trap must not run"); } });
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(proxy, artifacts)),
        "owner_disposition_plain_data");
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(artifacts, proxy as never)),
        "owner_disposition_plain_data");
      let accesses = 0;
      const getter = Object.defineProperty({}, "kind", {
        enumerable: true,
        get() { accesses += 1; throw new Error("getter must not run"); },
      });
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(getter, artifacts)),
        "owner_disposition_plain_data");
      assert.equal(accesses, 0);
      const applySource = await readFile(join(import.meta.dirname, "..", "..", "src", "workshop",
        "m5b-repository-native.ts"), "utf8");
      const applyCli = await readFile(join(import.meta.dirname, "..", "..", "src", "cli",
        "m5b-repository-native.ts"), "utf8");
      assert.doesNotMatch(applySource, /m5b-product-review-owner-disposition|m5b-product-review-disposition/);
      assert.doesNotMatch(applyCli, /m5b-product-review-owner-disposition|m5b-product-review-disposition/);
    });
  });

  test("turns null, malformed, and hostile complete-package inputs into typed refusals", async () => {
    await withArtifacts((artifacts) => {
      const packet = artifacts.reviewPacket;
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition({}, null as any)),
        "owner_disposition_packet");
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(
        null as any, [])), "owner_disposition_packet");

      let artifactTrapCalls = 0;
      const hostileArtifactSet = new Proxy({}, {
        ownKeys() {
          artifactTrapCalls += 1;
          throw new Error("artifact-set proxy trap must not run");
        },
      });
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(
        hostileArtifactSet as any, [])), "owner_disposition_packet");
      assert.equal(artifactTrapCalls, 0);

      const malformedBinding = clone(artifacts);
      malformedBinding.reviewPacket.packageBinding = null;
      rehashPacket(malformedBinding.reviewPacket);
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(malformedBinding,
        packet.proposals.map((proposal) => ({ proposalId: proposal.proposalId,
          disposition: "reject" as const })))), "owner_disposition_packet");

      const malformedProposal = clone(artifacts);
      malformedProposal.reviewPacket.proposals[0] = null;
      rehashPacket(malformedProposal.reviewPacket);
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition({}, malformedProposal)),
        "owner_disposition_packet");

      let proxyTrapCalls = 0;
      const hostilePacket = new Proxy({}, {
        ownKeys() {
          proxyTrapCalls += 1;
          throw new Error("packet proxy trap must not run");
        },
      });
      const hostileArtifacts = { ...artifacts, reviewPacket: hostilePacket };
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(
        {}, hostileArtifacts as any)), "owner_disposition_packet");
      assert.equal(proxyTrapCalls, 0);
    });
  });

  test("rejects a self-consistent historical schema-v1 packet at the current disposition boundary", async () => {
    await withArtifacts((artifacts) => {
      const legacy = clone(artifacts);
      legacy.reviewPacket.schemaVersion = "1";
      rehashPacket(legacy.reviewPacket);
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(legacy,
        legacy.reviewPacket.proposals.map((proposal: any) => ({ proposalId: proposal.proposalId,
          disposition: "reject" as const })))), "owner_disposition_packet");
    });
  });
});
