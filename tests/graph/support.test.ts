import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createSupportEvaluator,
  isCurrentClaimEligible,
} from "../../src/graph/support.ts";
import type {
  ClaimStatus,
  ProvenanceStatus,
} from "../../src/graph/types.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

describe("current graph support eligibility", () => {
  for (
    const provenanceStatus of [
      "verified",
      "source_document_only",
      "unverified",
    ] satisfies ProvenanceStatus[]
  ) {
    test(`keeps an active ${provenanceStatus} claim current-eligible`, () => {
      const bundle = clone(makeValidBundle());
      bundle.claims[0]!.provenance_status = provenanceStatus;
      const support = createSupportEvaluator(bundle);

      assert.equal(isCurrentClaimEligible(bundle.claims[0]!), true);
      assert.equal(support.getCurrentSupportingEvidence(bundle.claims[0]!.id).length, 1);
    });
  }

  for (
    const provenanceStatus of [
      "stale",
      "unsupported",
    ] satisfies ProvenanceStatus[]
  ) {
    test(`keeps active ${provenanceStatus} claim support structural but not current`, () => {
      const bundle = clone(makeValidBundle());
      bundle.claims[0]!.provenance_status = provenanceStatus;
      const support = createSupportEvaluator(bundle);

      assert.equal(isCurrentClaimEligible(bundle.claims[0]!), false);
      assert.equal(support.getStructuralSupportingEvidence(bundle.claims[0]!.id).length, 1);
      assert.equal(support.getCurrentSupportingEvidence(bundle.claims[0]!.id).length, 0);
    });
  }

  for (
    const claimStatus of [
      "contradicted",
      "stale",
      "rejected",
      "superseded",
    ] satisfies ClaimStatus[]
  ) {
    test(`keeps ${claimStatus} claim support structural but not current`, () => {
      const bundle = clone(makeValidBundle());
      bundle.claims[0]!.status = claimStatus;
      const support = createSupportEvaluator(bundle);

      assert.equal(isCurrentClaimEligible(bundle.claims[0]!), false);
      assert.equal(support.getStructuralSupportingEvidence(bundle.claims[0]!.id).length, 1);
      assert.equal(support.getCurrentSupportingEvidence(bundle.claims[0]!.id).length, 0);
    });
  }

  test("excludes context-only object/claim edges from ordinary and supporting current links", () => {
    const bundle = clone(makeValidBundle());
    bundle.account_object_claims[0]!.relationship = "context";
    const support = createSupportEvaluator(bundle);

    assert.equal(bundle.account_object_claims[0]!.relationship, "context");
    assert.deepEqual(support.getCurrentClaimLinks(bundle.account_objects[0]!.id), []);
    assert.deepEqual(
      support.getCurrentSupportingClaimLinks(bundle.account_objects[0]!.id),
      [],
    );
    assert.equal(support.hasCurrentSupportingClaim(bundle.account_objects[0]!.id), false);
  });
});
