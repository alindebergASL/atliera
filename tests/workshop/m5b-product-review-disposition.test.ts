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
  createM5bProductReviewOwnerDispositionTemplate,
  validateM5bProductReviewOwnerDisposition,
} from "../../src/workshop/m5b-product-review-disposition.ts";
import type { M5bProductReviewPacket } from "../../src/workshop/m5b-product-review-package.ts";
import { prepareM5bProductReview } from "../../src/workshop/m5b-product-review-prepare.ts";
import {
  createSyntheticM5bProductReviewScenario,
  sha256Fixture,
} from "../fixtures/m5b-product-review-synthetic.ts";

async function withPacket<T>(fn: (packet: M5bProductReviewPacket) => Promise<T> | T): Promise<T> {
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
    const packet = JSON.parse(await readFile(join(scenario.outputDir, "review-packet.json"), "utf8"));
    return await fn(packet);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function clone<T>(value: T): any {
  return JSON.parse(JSON.stringify(value));
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
    await withPacket((packet) => {
      const artifact = createM5bProductReviewOwnerDispositionTemplate(packet,
        packet.proposals.map((proposal, index) => ({ proposalId: proposal.proposalId,
          disposition: index % 2 === 0 ? "accept" as const : "reject" as const })));
      assert.equal(artifact.packageBinding.packageId, packet.packageBinding.packageId);
      assert.equal(artifact.packageBinding.sourcePackSha256, packet.sourcePackSha256);
      assert.equal(artifact.packageBinding.candidateSha256, packet.candidateSha256);
      assert.equal(artifact.packageBinding.reviewPacketSha256, packet.reviewPacketSha256);
      assert.deepEqual(artifact.authorityBoundary, M5B_PRODUCT_REVIEW_NON_EXECUTABLE_BOUNDARY);
      assert.equal(artifact.decisions.length, packet.proposals.length);
      assert.doesNotMatch(JSON.stringify(artifact), /ratifierIdentity|ratifiedAt/);
      assert.equal(artifact.authorityBoundary.applyInputEligible, false);
      assert.equal(artifact.authorityBoundary.authorizesRatification, false);
      assert.equal(artifact.authorityBoundary.authorizesGraphWrite, false);
      assert.equal(artifact.authorityBoundary.authorizesDeployment, false);
      assert.equal(validateM5bProductReviewOwnerDisposition(clone(artifact), packet).dispositionSha256,
        artifact.dispositionSha256);
    });
  });

  test("rejects missing, duplicate, reordered, forged package/hash, boundary, and self-hash data", async () => {
    await withPacket((packet) => {
      const baseline = createM5bProductReviewOwnerDispositionTemplate(packet,
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
      for (const [raw, expected] of cases) {
        assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(raw, packet)), expected);
      }
    });
  });

  test("rejects Proxy/accessor inputs without invoking traps and remains absent from every apply implementation", async () => {
    await withPacket(async (packet) => {
      const proxy = new Proxy({}, { ownKeys() { throw new Error("proxy trap must not run"); } });
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(proxy, packet)),
        "owner_disposition_plain_data");
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(packet, proxy as never)),
        "owner_disposition_plain_data");
      let accesses = 0;
      const getter = Object.defineProperty({}, "kind", {
        enumerable: true,
        get() { accesses += 1; throw new Error("getter must not run"); },
      });
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(getter, packet)),
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

  test("turns null, malformed, and hostile packet inputs into typed refusals", async () => {
    await withPacket((packet) => {
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition({}, null as any)),
        "owner_disposition_packet");
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(
        null as any, [])), "owner_disposition_packet");

      const malformedBinding = clone(packet);
      malformedBinding.packageBinding = null;
      const { reviewPacketSha256: _bindingHash, ...malformedBindingContent } = malformedBinding;
      malformedBinding.reviewPacketSha256 = m5bProductReviewCanonicalSha256(malformedBindingContent);
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(malformedBinding,
        packet.proposals.map((proposal) => ({ proposalId: proposal.proposalId,
          disposition: "reject" as const })))), "owner_disposition_packet");

      const malformedProposal = clone(packet);
      malformedProposal.proposals[0] = null;
      const { reviewPacketSha256: _proposalHash, ...malformedProposalContent } = malformedProposal;
      malformedProposal.reviewPacketSha256 = m5bProductReviewCanonicalSha256(malformedProposalContent);
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition({}, malformedProposal)),
        "owner_disposition_packet");

      let proxyTrapCalls = 0;
      const hostilePacket = new Proxy({}, {
        ownKeys() {
          proxyTrapCalls += 1;
          throw new Error("packet proxy trap must not run");
        },
      });
      assert.equal(refusalCode(() => validateM5bProductReviewOwnerDisposition(
        {}, hostilePacket as any)), "owner_disposition_packet");
      assert.equal(proxyTrapCalls, 0);
    });
  });

  test("rejects a self-consistent historical schema-v1 packet at the current disposition boundary", async () => {
    await withPacket((packet) => {
      const legacy = clone(packet);
      legacy.schemaVersion = "1";
      const { reviewPacketSha256: _oldHash, ...legacyContent } = legacy;
      legacy.reviewPacketSha256 = m5bProductReviewCanonicalSha256(legacyContent);
      assert.equal(refusalCode(() => createM5bProductReviewOwnerDispositionTemplate(legacy,
        legacy.proposals.map((proposal: any) => ({ proposalId: proposal.proposalId,
          disposition: "reject" as const })))), "owner_disposition_packet");
    });
  });
});
