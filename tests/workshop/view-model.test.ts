import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  makeValidBundle,
  clone,
  VALID_GRAPH_SUBJECT,
} from "../fixtures/valid-graph.ts";
import {
  buildWorkshopViewModel,
  WorkshopGraphValidationError,
} from "../../src/workshop/view-model.ts";
import {
  createValidatedCandidate,
  ValidatedCandidateBoundaryError,
} from "../../src/graph/validated-candidate.ts";
import { validateGraphBundle } from "../../src/graph/validate.ts";
import type { GraphBundle } from "../../src/graph/types.ts";

const EXPECTED_ORIGINAL = VALID_GRAPH_SUBJECT;

function makeEmptyBundle(): GraphBundle {
  return {
    sources: [],
    excerpts: [],
    claims: [],
    claim_evidence: [],
    account_objects: [],
    account_object_claims: [],
    research_runs: [],
    run_artifacts: [],
    audit_events: [],
  };
}

function build(bundle: GraphBundle) {
  return buildWorkshopViewModel(
    createValidatedCandidate(bundle, VALID_GRAPH_SUBJECT),
  );
}

describe("buildWorkshopViewModel", () => {
  test("renders the baseline fixture as a Signals item from the shared graph", () => {
    const vm = build(makeValidBundle());

    assert.equal(vm.product_name, "Atliera");
    assert.equal(vm.surface, "Workshop");
    assert.equal(vm.generated_from, "validated_candidate");
    assert.equal(vm.empty_state, false);
    assert.equal(vm.lenses.signals.length, 1);
    assert.equal(vm.lenses.maps.length, 0);
    assert.equal(vm.lenses.plays.length, 0);

    const item = vm.lenses.signals[0]!;
    assert.equal(item.id, "obj_acme_signal_launch");
    assert.equal(item.lens, "signals");
    assert.equal(item.title, "New logistics platform launch");
    assert.deepEqual(item.claim_ids, ["clm_acme_launch"]);
    assert.deepEqual(item.excerpt_ids, ["exc_acme_launch_001"]);
    assert.deepEqual(item.source_ids, ["src_acme_press_001"]);
    assert.equal(item.evidence_packets.length, 1);
    assert.equal(item.evidence_packets[0]?.claim.text, "Acme Robotics launched a logistics platform on March 1, 2026.");
    assert.equal(item.evidence_packets[0]?.excerpt.text, "Acme Robotics announced a new logistics platform on March 1, 2026.");
    assert.equal(item.evidence_packets[0]?.source.title, "Acme Robotics launches logistics platform");
    assert.equal(item.trust.label, "Reviewed · source-backed");
  });

  test("routes account-object kinds into Signals, Maps, and Plays without separate data paths", () => {
    const bundle = clone(makeValidBundle());
    const base = bundle.account_objects[0]!;

    bundle.account_objects.push(
      { ...base, id: "obj_acme_stakeholder", object_type: "stakeholder", title: "VP Operations" },
      { ...base, id: "obj_acme_play", object_type: "play", title: "Lead with integration proof" },
    );
    bundle.account_object_claims.push(
      { id: "oclm_map", account_object_id: "obj_acme_stakeholder", claim_id: "clm_acme_launch", relationship: "primary" },
      { id: "oclm_play", account_object_id: "obj_acme_play", claim_id: "clm_acme_launch", relationship: "primary" },
    );

    const vm = build(bundle);

    assert.deepEqual(vm.lenses.signals.map((item) => item.id), ["obj_acme_signal_launch"]);
    assert.deepEqual(vm.lenses.maps.map((item) => item.id), ["obj_acme_stakeholder"]);
    assert.deepEqual(vm.lenses.plays.map((item) => item.id), ["obj_acme_play"]);
    for (const lens of ["signals", "maps", "plays"] as const) {
      assert.equal(vm.lenses[lens][0]!.trust.evidence.accepted_excerpt_count, 1);
    }
  });

  test("renders an explicit empty state for an empty graph bundle", () => {
    const vm = build(makeEmptyBundle());

    assert.equal(vm.empty_state, true);
    assert.equal(vm.account_id, VALID_GRAPH_SUBJECT.account_id);
    assert.deepEqual(vm.lenses, { signals: [], maps: [], plays: [] });
    assert.deepEqual(vm.totals, {
      sources: 0,
      excerpts: 0,
      accepted_excerpts: 0,
      claims: 0,
      account_objects: 0,
      verified_objects: 0,
    });
  });

  test("labels unsupported and source-document-only material visibly", () => {
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.provenance_status = "unsupported";
    let vm = build(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.label, "Unsupported");

    bundle.account_objects[0]!.provenance_status = "source_document_only";
    vm = build(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.label, "Source-backed");
  });

  test("does not count contextual or contradicting excerpts as accepted supporting evidence", () => {
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.provenance_status = "unverified";
    bundle.claims[0]!.provenance_status = "unverified";
    bundle.claims[0]!.confidence = "medium";
    bundle.claim_evidence[0]!.relationship = "context";
    let vm = build(bundle);
    assert.equal(vm.lenses.signals[0]!.evidence_packets.length, 0);
    assert.equal(vm.lenses.signals[0]!.trust.evidence.accepted_excerpt_count, 0);

    bundle.claim_evidence[0]!.relationship = "contradicts";
    vm = build(bundle);
    assert.equal(vm.lenses.signals[0]!.evidence_packets.length, 0);
    assert.equal(vm.lenses.signals[0]!.trust.evidence.accepted_excerpt_count, 0);
  });

  test("does not expose a context-only object/claim edge as an ordinary current link", () => {
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.provenance_status = "unverified";
    bundle.account_object_claims[0]!.relationship = "context";

    const item = build(bundle).lenses.signals[0]!;

    assert.deepEqual(item.claim_ids, []);
    assert.deepEqual(item.source_ids, []);
    assert.deepEqual(item.excerpt_ids, []);
    assert.deepEqual(item.evidence_packets, []);
    assert.deepEqual(item.trust.evidence, {
      accepted_excerpt_count: 0,
      source_document_count: 0,
      claim_count: 0,
    });
  });

  test("does not emit evidence packets for unsupported claims or objects", () => {
    const unsupportedObject = clone(makeValidBundle());
    unsupportedObject.account_objects[0]!.provenance_status = "unsupported";
    let vm = build(unsupportedObject);
    assert.equal(vm.lenses.signals[0]!.evidence_packets.length, 0);
    assert.equal(vm.lenses.signals[0]!.trust.evidence.accepted_excerpt_count, 1);

    const unsupportedClaim = clone(makeValidBundle());
    unsupportedClaim.claims[0]!.provenance_status = "unsupported";
    unsupportedClaim.account_objects[0]!.provenance_status = "unverified";
    vm = build(unsupportedClaim);
    assert.equal(vm.lenses.signals[0]!.evidence_packets.length, 0);
    assert.deepEqual(vm.lenses.signals[0]!.claim_ids, []);
    assert.deepEqual(vm.lenses.signals[0]!.source_ids, []);
    assert.deepEqual(vm.lenses.signals[0]!.excerpt_ids, []);
    assert.equal(vm.lenses.signals[0]!.trust.evidence.accepted_excerpt_count, 0);
  });

  test("refuses an ambiguous multi-account bundle with its validation report", () => {
    const bundle = clone(makeValidBundle());
    bundle.research_runs.push({
      ...bundle.research_runs[0]!,
      id: "run_other_account",
      account_id: "acc_other",
    });

    assert.throws(() => build(bundle), (error) => {
      assert.ok(error instanceof WorkshopGraphValidationError);
      assert.equal(error.report.ok, false);
      assert.ok(
        error.report.hard_failures.some(
          (failure) => failure.code === "subject_scope_mismatch",
        ),
      );
      return true;
    });
  });

  test("refuses structurally invalid bundles before Workshop projection", () => {
    const bundle = clone(makeValidBundle());
    bundle.sources.push({ ...bundle.sources[0]! });

    assert.throws(() => build(bundle), (error) => {
      assert.ok(error instanceof WorkshopGraphValidationError);
      assert.ok(
        error.report.hard_failures.some(
          (failure) => failure.code === "duplicate_id",
        ),
      );
      return true;
    });
  });

  test("rejects a coherent account relabel against the authoritative Workshop subject", () => {
    const bundle = clone(makeValidBundle());
    for (const source of bundle.sources) source.account_id = "acc_other";
    for (const claim of bundle.claims) claim.account_id = "acc_other";
    for (const object of bundle.account_objects) object.account_id = "acc_other";
    for (const run of bundle.research_runs) run.account_id = "acc_other";

    const validation = validateGraphBundle(bundle, {
      mode: "fixture",
      subject: EXPECTED_ORIGINAL,
    });
    assert.equal(validation.ok, false);
    assert.ok(
      validation.hard_failures.some(
        (failure) => failure.code === "subject_scope_mismatch",
      ),
    );
    assert.throws(
      () => createValidatedCandidate(bundle, EXPECTED_ORIGINAL),
      WorkshopGraphValidationError,
    );
  });

  test("refuses a raw GraphBundle at runtime", () => {
    assert.throws(
      () => buildWorkshopViewModel(makeValidBundle() as never),
      ValidatedCandidateBoundaryError,
    );
  });

  test("renders only the candidate snapshot and survives JSON round trip", () => {
    const subject: { team_id: string; account_id: string } = {
      ...VALID_GRAPH_SUBJECT,
    };
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.payload_json.nested = { value: "original" };
    const candidate = createValidatedCandidate(bundle, subject);
    const expected = buildWorkshopViewModel(candidate);

    subject.account_id = "acc_mutated";
    bundle.account_objects[0]!.title = "Mutated hostile title";
    bundle.account_objects[0]!.summary = "Mutated hostile summary";
    (bundle.account_objects[0]!.payload_json.nested as { value: string }).value =
      "mutated";

    assert.deepEqual(buildWorkshopViewModel(candidate), expected);
    assert.deepEqual(
      buildWorkshopViewModel(JSON.parse(JSON.stringify(candidate))),
      expected,
    );
  });

  for (const status of ["rejected", "superseded", "stale"] as const) {
    test(`excludes ${status} objects from current Workshop output`, () => {
      const bundle = clone(makeValidBundle());
      bundle.account_objects[0]!.status = status;

      const vm = build(bundle);

      assert.equal(vm.lenses.signals.length, 0);
      assert.equal(vm.totals.account_objects, 0);
      assert.equal(vm.empty_state, true);
    });
  }

  for (const sourceStatus of ["stale", "unavailable", "rejected"] as const) {
    for (
      const provenanceStatus of ["verified", "source_document_only"] as const
    ) {
      test(`does not render a ${provenanceStatus} item on any lens when its source is ${sourceStatus}`, () => {
        const bundle = clone(makeValidBundle());
        bundle.sources[0]!.status = sourceStatus;
        bundle.account_objects[0]!.provenance_status = provenanceStatus;

        const vm = build(bundle);
        const items = Object.values(vm.lenses).flat();

        assert.equal(items.length, 0);
        assert.equal(
          items.some((item) =>
            item.trust.label === "Reviewed · source-backed" ||
            item.trust.label === "Source-backed"
          ),
          false,
        );
      });
    }
  }

  test("does not expose an inactive source or proposed excerpt on a model-proposed review item", () => {
    const bundle = clone(makeValidBundle());
    bundle.sources[0]!.status = "stale";
    bundle.excerpts[0]!.validation_status = "proposed";
    bundle.claims[0]!.confidence = "medium";
    bundle.claims[0]!.provenance_status = "unverified";
    bundle.account_objects[0]!.confidence = "medium";
    bundle.account_objects[0]!.provenance_status = "unverified";
    bundle.account_objects[0]!.payload_json.review_state =
      "model_proposed_pending_human_review";

    const vm = build(bundle);
    const item = vm.lenses.signals[0]!;

    assert.equal(item.review_state, "model_proposed_pending_human_review");
    assert.deepEqual(item.source_ids, []);
    assert.deepEqual(item.excerpt_ids, []);
    assert.deepEqual(item.evidence_packets, []);
  });

  test("does not expose a context-only proposed claim as model-proposed support", () => {
    const bundle = clone(makeValidBundle());
    bundle.excerpts[0]!.validation_status = "proposed";
    bundle.claims[0]!.confidence = "medium";
    bundle.claims[0]!.provenance_status = "unverified";
    bundle.account_objects[0]!.confidence = "medium";
    bundle.account_objects[0]!.provenance_status = "unverified";
    bundle.account_objects[0]!.payload_json.review_state =
      "model_proposed_pending_human_review";
    bundle.account_object_claims[0]!.relationship = "context";

    const item = build(bundle).lenses.signals[0]!;

    assert.equal(item.review_state, "model_proposed_pending_human_review");
    assert.deepEqual(item.claim_ids, []);
    assert.deepEqual(item.source_ids, []);
    assert.deepEqual(item.excerpt_ids, []);
    assert.deepEqual(item.evidence_packets, []);
    assert.deepEqual(item.trust.evidence, {
      accepted_excerpt_count: 0,
      source_document_count: 0,
      claim_count: 0,
    });
  });

  for (
    const claimStatus of [
      "contradicted",
      "stale",
      "rejected",
      "superseded",
    ] as const
  ) {
    for (
      const provenanceStatus of ["verified", "source_document_only"] as const
    ) {
      test(`does not render a ${provenanceStatus} item on any lens when its claim is ${claimStatus}`, () => {
        const bundle = clone(makeValidBundle());
        bundle.claims[0]!.status = claimStatus;
        bundle.account_objects[0]!.provenance_status = provenanceStatus;

        const vm = build(bundle);
        const items = Object.values(vm.lenses).flat();

        assert.equal(items.length, 0);
        assert.equal(
          items.some((item) =>
            item.trust.label === "Reviewed · source-backed" ||
            item.trust.label === "Source-backed"
          ),
          false,
        );
      });
    }
  }

  for (const claimProvenance of ["stale", "unsupported"] as const) {
    for (
      const objectProvenance of ["verified", "source_document_only"] as const
    ) {
      test(`does not render a ${objectProvenance} item on any lens when its active claim provenance is ${claimProvenance}`, () => {
        const bundle = clone(makeValidBundle());
        bundle.claims[0]!.provenance_status = claimProvenance;
        bundle.account_objects[0]!.provenance_status = objectProvenance;

        const vm = build(bundle);
        const items = Object.values(vm.lenses).flat();

        assert.equal(items.length, 0);
        assert.equal(vm.totals.verified_objects, 0);
      });
    }
  }
});
