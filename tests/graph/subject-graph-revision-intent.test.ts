import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { sha256CanonicalJson } from "../../src/authority/strict-json.ts";
import {
  applyCandidateDelta,
  createCandidateDelta,
  validatedCandidateSha256,
  type CandidateTransition,
} from "../../src/graph/candidate-delta.ts";
import {
  SUBJECT_GRAPH_REVISION_INTENT_KIND,
  SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
  SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
  SubjectGraphRevisionIntentBoundaryError,
  createSubjectGraphRevisionIntent,
  hydrateSubjectGraphRevisionIntent,
  type SubjectGraphRevisionPredecessorBasis,
  type SubjectGraphRevisionReviewHandoff,
} from "../../src/graph/subject-graph-revision-intent.ts";
import { createValidatedCandidate } from "../../src/graph/validated-candidate.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";
import {
  PUBLIC_PROPOSAL_NOW,
  makePublicProposalBase,
  makePublicProposalEnvelope,
} from "../fixtures/proposal-authority.ts";

const REVIEWED_AT = "2026-06-11T00:00:00Z";
const REVIEWER_REF = "reviewer:prewrite-boundary-test";
const RATIONALE =
  "The exact transition may proceed to a non-authorizing prewrite revision intent for later authority gates.";

function applicationOptions(envelope = makePublicProposalEnvelope()) {
  return {
    now: PUBLIC_PROPOSAL_NOW,
    expected_scope: envelope.scope,
    prior_recorded_replay_keys: [],
  };
}

function derive(base = makePublicProposalBase()) {
  const envelope = makePublicProposalEnvelope();
  const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
  const options = applicationOptions(envelope);
  const transition = applyCandidateDelta(envelope, delta, base, options);
  return { envelope, base, delta, options, transition };
}

function predecessorBasis(
  transition: CandidateTransition,
  mode: "bootstrap" | "successor" = "bootstrap",
  revision: string | null = mode === "bootstrap" ? null : "rev_1",
): SubjectGraphRevisionPredecessorBasis {
  return {
    mode,
    expected_prior_revision: revision as SubjectGraphRevisionPredecessorBasis["expected_prior_revision"],
    expected_base_snapshot_sha256: validatedCandidateSha256(
      transition.base_candidate,
    ),
  };
}

function reviewAuthority() {
  return {
    current_effective_authorization: "none" as const,
    review_handoff_only: true as const,
    integrity_digest_is_approval: false as const,
    authenticated_human_approval: false as const,
    ratification: false as const,
    ratification_performed: false as const,
    durable_replay_consumed: false as const,
    durable_replay_protection: false as const,
    anti_rollback_protection: false as const,
    origin_custody_proven: false as const,
    transformation_custody_proven: false as const,
    graph_ingestion_authorized: false as const,
    graph_ingestion_performed: false as const,
    durable_write_authorized: false as const,
    durable_write_performed: false as const,
  };
}

function makeReview(
  transition: CandidateTransition,
  basis: SubjectGraphRevisionPredecessorBasis,
): SubjectGraphRevisionReviewHandoff {
  return {
    kind: SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
    version: 1,
    disposition: SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
    graph_identity: {
      team_id: transition.scope.team_id,
      account_id: transition.scope.account_id,
      subject_id: transition.scope.subject_id,
      purpose: transition.scope.purpose,
    },
    predecessor_basis: { ...basis },
    envelope_sha256: transition.delta.envelope_sha256,
    delta_sha256: transition.delta.delta_sha256,
    transition_sha256: transition.transition_sha256,
    base_snapshot_sha256: validatedCandidateSha256(transition.base_candidate),
    proposed_snapshot_sha256: transition.candidate_sha256,
    quality_gate_policy: { ...transition.delta.quality_gate_policy },
    quality_gate_report_sha256:
      transition.delta.quality_gate_report_sha256,
    replay_key_to_record: transition.replay_key_to_record,
    reviewer_ref: REVIEWER_REF,
    reviewed_at: REVIEWED_AT,
    rationale: RATIONALE,
    authority: reviewAuthority(),
  };
}

function createIntent(
  values = derive(),
  mode: "bootstrap" | "successor" = "bootstrap",
  revision: string | null = mode === "bootstrap" ? null : "rev_1",
) {
  const basis = predecessorBasis(values.transition, mode, revision);
  const review = makeReview(values.transition, basis);
  const intent = createSubjectGraphRevisionIntent(
    values.envelope,
    values.transition,
    values.options,
    basis,
    review,
  );
  return { ...values, basis, review, intent };
}

function rehashIntent(raw: Record<string, any>): Record<string, any> {
  const intent = clone(raw) as Record<string, any>;
  delete intent.intent_sha256;
  intent.intent_sha256 = sha256CanonicalJson(intent);
  return intent;
}

function setPath(root: Record<string, any>, path: readonly string[], value: unknown): void {
  let cursor = root;
  for (const key of path.slice(0, -1)) cursor = cursor[key];
  cursor[path.at(-1)!] = value;
}

function assertRecursivelyFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) assertRecursivelyFrozen(descriptor.value, seen);
  }
}

describe("SubjectGraphRevisionIntent v1 pure prewrite boundary", () => {
  test("binds the exact transition, review, envelope/delta/base/proposed snapshots and round-trips as frozen JSON", () => {
    const values = createIntent();
    const hydrated = hydrateSubjectGraphRevisionIntent(
      values.envelope,
      values.transition,
      values.options,
      JSON.parse(JSON.stringify(values.intent)),
    );

    assert.deepEqual(hydrated, values.intent);
    assert.equal(hydrated.kind, SUBJECT_GRAPH_REVISION_INTENT_KIND);
    assert.equal(hydrated.envelope_sha256, values.envelope.envelope_sha256);
    assert.equal(hydrated.delta_sha256, values.delta.delta_sha256);
    assert.equal(
      hydrated.transition_sha256,
      values.transition.transition_sha256,
    );
    assert.equal(
      hydrated.base_snapshot_sha256,
      validatedCandidateSha256(values.base),
    );
    assert.equal(
      hydrated.proposed_snapshot_sha256,
      values.transition.candidate_sha256,
    );
    assert.deepEqual(hydrated.proposed_snapshot, values.transition.candidate);
    assert.notEqual(hydrated.proposed_snapshot, values.transition.candidate);
    assert.equal(
      hydrated.review_handoff_sha256,
      sha256CanonicalJson(hydrated.review_handoff as any),
    );
    assert.equal(hydrated.replay_key_to_record, values.transition.replay_key_to_record);
    assert.match(hydrated.intent_sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(hydrated.authority, {
      current_effective_authorization: "none",
      intent_contract_only: true,
      integrity_digest_is_authority: false,
      authenticated_human_approval: false,
      ratification: false,
      ratification_performed: false,
      durable_replay_consumed: false,
      durable_replay_protection: false,
      anti_rollback_protection: false,
      durable_current_state_checked: false,
      future_transaction_must_atomically_compare_revision_and_snapshot: true,
      origin_custody_proven: false,
      transformation_custody_proven: false,
      graph_ingestion_authorized: false,
      graph_ingestion_performed: false,
      durable_write_authorized: false,
      durable_write_performed: false,
      provider_calls_performed: 0,
      mcp_invocations_performed: 0,
      network_operations_performed: 0,
      deployment_operations_performed: 0,
      production_effects_performed: 0,
    });
    assertRecursivelyFrozen(hydrated);
  });

  test("uses the stable structured team/account/subject/purpose identity and no hash-derived graph id", () => {
    const { intent, transition } = createIntent();
    assert.deepEqual(intent.graph_identity, transition.scope);
    const integrityIdentities = [
      intent.envelope_sha256,
      intent.delta_sha256,
      intent.transition_sha256,
      intent.base_snapshot_sha256,
      intent.proposed_snapshot_sha256,
      intent.review_handoff_sha256,
      intent.intent_sha256,
    ];
    for (const value of Object.values(intent.graph_identity)) {
      assert.equal(integrityIdentities.includes(value), false);
    }
    assert.equal(Object.hasOwn(intent.graph_identity, "graphId"), false);
    assert.equal(Object.hasOwn(intent, "graphId"), false);
  });

  test("bootstrap requires null prior revision, the exact base digest, and a canonically empty base", () => {
    const values = derive();
    assert.doesNotThrow(() => createIntent(values));

    for (const revision of ["rev_1", "rev_2"]) {
      const basis = predecessorBasis(values.transition) as any;
      basis.expected_prior_revision = revision;
      const review = makeReview(values.transition, basis);
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            basis,
            review,
          ),
        /bootstrap.*expected_prior_revision null/,
      );
    }

    const wrongDigestBasis = predecessorBasis(values.transition) as any;
    wrongDigestBasis.expected_base_snapshot_sha256 = "0".repeat(64);
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          wrongDigestBasis,
          makeReview(values.transition, wrongDigestBasis),
        ),
      /stale or substituted base snapshot/,
    );

    const nonemptyBase = createValidatedCandidate(makeValidBundle(), {
      team_id: values.envelope.scope.team_id,
      account_id: values.envelope.scope.account_id,
    });
    const nonempty = derive(nonemptyBase);
    const nonemptyBasis = predecessorBasis(nonempty.transition);
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          nonempty.envelope,
          nonempty.transition,
          nonempty.options,
          nonemptyBasis,
          makeReview(nonempty.transition, nonemptyBasis),
        ),
      /canonically empty base graph bundle/,
    );
  });

  test("successor accepts only canonical positive safe-integer revision tokens and the exact base snapshot", () => {
    const values = derive();
    for (const revision of ["rev_1", "rev_42", "rev_9007199254740991"]) {
      assert.equal(createIntent(values, "successor", revision).intent.predecessor_basis.expected_prior_revision, revision);
    }

    const nonemptyBase = createValidatedCandidate(makeValidBundle(), {
      team_id: values.envelope.scope.team_id,
      account_id: values.envelope.scope.account_id,
    });
    const nonemptySuccessor = createIntent(
      derive(nonemptyBase),
      "successor",
      "rev_2",
    );
    assert.equal(
      nonemptySuccessor.intent.predecessor_basis.expected_prior_revision,
      "rev_2",
    );
    assert.deepEqual(
      nonemptySuccessor.intent.proposed_snapshot,
      nonemptySuccessor.transition.candidate,
    );

    for (const revision of [
      null,
      1,
      "rev_0",
      "rev_00",
      "rev_01",
      "rev_-1",
      "rev_1.0",
      "rev_9007199254740992",
      "rev_10000000000000000",
    ]) {
      const basis = predecessorBasis(values.transition, "successor", revision as any);
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            basis,
            makeReview(values.transition, basis),
          ),
        SubjectGraphRevisionIntentBoundaryError,
        String(revision),
      );
    }
  });

  test("requires reviewed_at within a non-degenerate transition live window and no later than application now", () => {
    const values = derive();
    const basis = predecessorBasis(values.transition);
    const laterOptions = {
      ...values.options,
      now: "2026-06-11T01:00:00Z",
    };
    const inWindowReview = clone(
      makeReview(values.transition, basis),
    ) as any;
    inWindowReview.reviewed_at = "2026-06-11T00:30:00Z";

    assert.doesNotThrow(() =>
      createSubjectGraphRevisionIntent(
        values.envelope,
        values.transition,
        laterOptions,
        basis,
        inWindowReview,
      ),
    );

    for (const reviewedAt of [
      "2026-06-10T23:59:59Z",
      "2026-06-11T01:00:01Z",
      values.transition.expires_at,
    ]) {
      const review = clone(makeReview(values.transition, basis)) as any;
      review.reviewed_at = reviewedAt;
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            laterOptions,
            basis,
            review,
          ),
        /reviewed_at must be within the exact transition live window and no later than application now/,
        reviewedAt,
      );
    }
  });

  test("refuses stale or substituted predecessor fields whenever review, intent, or transition artifacts disagree", () => {
    const values = createIntent(derive(), "successor", "rev_7");
    const changedReview = clone(values.review) as any;
    changedReview.predecessor_basis.expected_prior_revision = "rev_8";
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          values.basis,
          changedReview,
        ),
      /review handoff predecessor basis does not match/,
    );

    const changedIntent = clone(values.intent) as any;
    changedIntent.predecessor_basis.expected_prior_revision = "rev_8";
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          rehashIntent(changedIntent),
        ),
      /review handoff predecessor basis does not match/,
    );

    const wrongBaseReview = clone(values.review) as any;
    wrongBaseReview.base_snapshot_sha256 = "f".repeat(64);
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          values.basis,
          wrongBaseReview,
        ),
      /base_snapshot_sha256 does not match/,
    );

    // This pure boundary cannot know whether rev_7 is durably current. The
    // returned marker requires the future transaction to compare both durable
    // revision and canonical snapshot identity atomically.
    assert.equal(values.intent.authority.durable_current_state_checked, false);
    assert.equal(values.intent.authority.anti_rollback_protection, false);
  });

  test("refuses cross-team/account/subject/purpose review reuse", () => {
    const values = derive();
    const basis = predecessorBasis(values.transition);
    const cases = [
      ["team_id", "team_other"],
      ["account_id", "acc_other"],
      ["subject_id", "subject_other"],
      ["purpose", "other_purpose"],
    ] as const;
    for (const [field, replacement] of cases) {
      const review = clone(makeReview(values.transition, basis)) as any;
      review.graph_identity[field] = replacement;
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            basis,
            review,
          ),
        /does not exactly match the transition scope/,
        field,
      );
    }
  });

  test("table-refuses material substitutions, including outer-self-rehashed drift", () => {
    const values = createIntent();
    const substitutions: readonly [string, readonly string[], unknown][] = [
      ["envelope", ["envelope_sha256"], "0".repeat(64)],
      ["delta", ["delta_sha256"], "1".repeat(64)],
      ["transition", ["transition_sha256"], "2".repeat(64)],
      ["base", ["base_snapshot_sha256"], "3".repeat(64)],
      ["proposed", ["proposed_snapshot_sha256"], "4".repeat(64)],
      ["review disposition", ["review_handoff", "disposition"], "ratified"],
      ["rationale", ["review_handoff", "rationale"], `${RATIONALE} Changed.`],
      ["reviewer", ["review_handoff", "reviewer_ref"], "reviewer:substituted"],
      ["review time", ["review_handoff", "reviewed_at"], "2026-06-11T00:00:01Z"],
      ["replay key", ["replay_key_to_record"], "5".repeat(64)],
      ["policy identity", ["quality_gate_policy", "policy_sha256"], "6".repeat(64)],
      ["report identity", ["quality_gate_report_sha256"], "7".repeat(64)],
    ];
    for (const [label, path, replacement] of substitutions) {
      const forged = clone(values.intent) as Record<string, any>;
      setPath(forged, path, replacement);
      assert.throws(
        () =>
          hydrateSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            rehashIntent(forged),
          ),
        SubjectGraphRevisionIntentBoundaryError,
        label,
      );
    }

    const proposedSnapshotForgery = clone(values.intent) as any;
    proposedSnapshotForgery.proposed_snapshot.graph_bundle.account_objects[0].title =
      "Substituted but self-rehashed proposed content";
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          rehashIntent(proposedSnapshotForgery),
        ),
      /does not exactly match/,
    );

    const transitionForgery = clone(values.transition) as any;
    transitionForgery.delta.quality_gate_policy.policy_sha256 = "8".repeat(64);
    delete transitionForgery.transition_sha256;
    transitionForgery.transition_sha256 = sha256CanonicalJson(transitionForgery);
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          values.envelope,
          transitionForgery,
          values.options,
          values.intent,
        ),
      /candidate transition rehydration failed/,
    );
  });

  test("refuses authority inflation and versioned contract drift even after outer rehash", () => {
    const values = createIntent();

    for (const field of [
      "authenticated_human_approval",
      "ratification",
      "durable_replay_consumed",
      "durable_write_authorized",
    ]) {
      const inflatedReview = clone(values.review) as any;
      inflatedReview.authority[field] = true;
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            values.basis,
            inflatedReview,
          ),
        /must remain a non-authorizing review handoff/,
        `review authority ${field}`,
      );

      const inflatedIntent = clone(values.intent) as any;
      inflatedIntent.authority[field] = true;
      assert.throws(
        () =>
          hydrateSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            rehashIntent(inflatedIntent),
          ),
        /does not exactly match/,
        `intent authority ${field}`,
      );
    }

    for (const [target, field, replacement] of [
      ["review", "kind", "other_review_kind"],
      ["review", "version", 2],
      ["intent", "kind", "other_intent_kind"],
      ["intent", "version", 2],
    ] as const) {
      if (target === "review") {
        const drifted = clone(values.review) as any;
        drifted[field] = replacement;
        assert.throws(
          () =>
            createSubjectGraphRevisionIntent(
              values.envelope,
              values.transition,
              values.options,
              values.basis,
              drifted,
            ),
          /kind\/version is unsupported/,
          `${target}.${field}`,
        );
      } else {
        const drifted = clone(values.intent) as any;
        drifted[field] = replacement;
        assert.throws(
          () =>
            hydrateSubjectGraphRevisionIntent(
              values.envelope,
              values.transition,
              values.options,
              rehashIntent(drifted),
            ),
          /kind\/version is unsupported/,
          `${target}.${field}`,
        );
      }
    }

    const unsupportedMode = clone(values.basis) as any;
    unsupportedMode.mode = "refresh";
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          unsupportedMode,
          makeReview(values.transition, unsupportedMode),
        ),
      /mode must be bootstrap or successor/,
    );

    const extraBasisField = clone(values.basis) as any;
    extraBasisField.current_revision = "rev_1";
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          extraBasisField,
          makeReview(values.transition, values.basis),
        ),
      /fields must exactly match the versioned contract/,
    );

    for (const [field, replacement] of [
      ["name", "other_policy"],
      ["version", 2],
    ] as const) {
      const driftedPolicy = clone(values.review) as any;
      driftedPolicy.quality_gate_policy[field] = replacement;
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            values.basis,
            driftedPolicy,
          ),
        /does not match the exact transition quality-gate policy/,
        `quality_gate_policy.${field}`,
      );
    }
  });

  test("actual legacy Workshop review and ratification-plan artifacts fail the review exact-key contract", () => {
    const values = derive();
    const basis = predecessorBasis(values.transition);
    const legacyArtifacts = [
      JSON.parse(
        readFileSync(
          "fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json",
          "utf8",
        ),
      ),
      JSON.parse(
        readFileSync(
          "fixtures/workshop/workshop-public-proposal-reviewed-candidate-ratification-plan.json",
          "utf8",
        ),
      ),
    ];
    for (const artifact of legacyArtifacts) {
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            basis,
            artifact,
          ),
        /review_handoff fields must exactly match the versioned contract/,
      );
    }
  });

  test("refuses hostile root/nested Proxy, getter, symbol, sparse, cyclic, and malformed inputs without invoking code", () => {
    const values = derive();
    const basis = predecessorBasis(values.transition);
    const validReview = makeReview(values.transition, basis);

    let traps = 0;
    const proxy = new Proxy({}, {
      get() {
        traps += 1;
        throw new Error("must not run");
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error("must not run");
      },
      ownKeys() {
        traps += 1;
        throw new Error("must not run");
      },
    });
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          proxy,
        ),
      /must not be Proxy-backed/,
    );
    assert.equal(traps, 0);

    const nestedProxyReview = clone(validReview) as any;
    nestedProxyReview.graph_identity = proxy;
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          nestedProxyReview,
        ),
      /must not be Proxy-backed/,
    );
    assert.equal(traps, 0);

    let getterCalls = 0;
    const getterIdentity = clone(validReview.graph_identity) as any;
    Object.defineProperty(getterIdentity, "team_id", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return values.transition.scope.team_id;
      },
    });
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          { ...validReview, graph_identity: getterIdentity },
        ),
      /must be enumerable own-data/,
    );
    assert.equal(getterCalls, 0);

    const symbolReview = clone(validReview) as any;
    symbolReview[Symbol("hidden")] = true;
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          symbolReview,
        ),
      /must not carry symbol keys/,
    );

    const sparseReview = clone(validReview) as any;
    sparseReview.extra = new Array(2);
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          sparseReview,
        ),
      /must be dense/,
    );

    const cyclicReview = clone(validReview) as any;
    cyclicReview.extra = cyclicReview;
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          cyclicReview,
        ),
      /must not be cyclic/,
    );

    const malformedReview = clone(validReview) as any;
    malformedReview.rationale = "unpaired \ud800";
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          malformedReview,
        ),
      /Unicode scalar values only/,
    );

    for (const [field, replacement, message] of [
      ["reviewer_ref", "bad/reviewer", /reviewer_ref is malformed/],
      ["reviewed_at", "2026-13-40T25:61:61Z", /canonical UTC timestamp/],
      ["rationale", "x".repeat(8 * 1024 + 1), /rationale must be bounded/],
      ["rationale", "contains\ncontrol", /free of control characters/],
    ] as const) {
      const malformed = clone(validReview) as any;
      malformed[field] = replacement;
      assert.throws(
        () =>
          createSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            basis,
            malformed,
          ),
        message,
      );
    }

    const dangerousReview = clone(validReview) as any;
    dangerousReview.graph_identity = JSON.parse(
      `{"team_id":"${values.transition.scope.team_id}","account_id":"${values.transition.scope.account_id}","subject_id":"${values.transition.scope.subject_id}","purpose":"${values.transition.scope.purpose}","__proto__":false}`,
    );
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          basis,
          dangerousReview,
        ),
      /forbidden property key/,
    );

    const hydratedValues = createIntent(values);
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          proxy,
        ),
      /must not be Proxy-backed/,
    );
    assert.equal(traps, 0);
    assert.ok(hydratedValues.intent);
  });

  test("refuses serialization drift, unknown fields, digest corruption, self-rehashed substitutions, and wrong transitions", () => {
    const values = createIntent();

    const unknownIntent = clone(values.intent) as any;
    unknownIntent.extra = false;
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          unknownIntent,
        ),
      /fields must exactly match/,
    );

    const unknownReview = clone(values.review) as any;
    unknownReview.extra = false;
    assert.throws(
      () =>
        createSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          values.basis,
          unknownReview,
        ),
      /fields must exactly match/,
    );

    for (const digest of ["ABC", "a".repeat(63), "g".repeat(64)]) {
      const corrupted = clone(values.intent) as any;
      corrupted.intent_sha256 = digest;
      assert.throws(
        () =>
          hydrateSubjectGraphRevisionIntent(
            values.envelope,
            values.transition,
            values.options,
            corrupted,
          ),
        /canonical lowercase SHA-256 digest/,
      );
    }

    const innerDigestCorruption = clone(values.intent) as any;
    innerDigestCorruption.review_handoff_sha256 = "9".repeat(64);
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          rehashIntent(innerDigestCorruption),
        ),
      /does not exactly match/,
    );

    const selfRehashed = clone(values.intent) as any;
    selfRehashed.graph_identity.subject_id = "subject_substituted";
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          values.envelope,
          values.transition,
          values.options,
          rehashIntent(selfRehashed),
        ),
      /does not exactly match/,
    );

    const nonemptyBase = createValidatedCandidate(makeValidBundle(), {
      team_id: values.envelope.scope.team_id,
      account_id: values.envelope.scope.account_id,
    });
    const wrongTransition = derive(nonemptyBase);
    assert.throws(
      () =>
        hydrateSubjectGraphRevisionIntent(
          wrongTransition.envelope,
          wrongTransition.transition,
          wrongTransition.options,
          values.intent,
        ),
      SubjectGraphRevisionIntentBoundaryError,
    );
  });

  test("has no effect-capable imports or async/store/callback execution surface", () => {
    const source = readFileSync(
      "src/graph/subject-graph-revision-intent.ts",
      "utf8",
    );
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(imports, [
      "../authority/strict-json.ts",
      "./candidate-delta.ts",
      "./validated-candidate.ts",
    ]);
    assert.doesNotMatch(source, /\basync\b|\bPromise\s*</);
    assert.doesNotMatch(source, /\.(?:commit|load)\s*\(/);
    assert.doesNotMatch(
      source,
      /from\s+"[^"]*(?:fs|http|https|net|child_process|provider|mcp|deployment|database|runtime|store)[^"]*"/,
    );
    assert.doesNotMatch(
      source,
      /raw(?:Store|Callback|Client|Transport)|(?:store|callback|client|transport):/i,
    );
    assert.match(
      readFileSync("src/index.ts", "utf8"),
      /export \* from "\.\/graph\/subject-graph-revision-intent\.ts";/,
    );
  });
});
