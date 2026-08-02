import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  CandidateDeltaBoundaryError,
  applyCandidateDelta,
  createCandidateDelta,
  hydrateCandidateDelta,
  hydrateCandidateTransition,
  validatedCandidateSha256,
} from "../../src/graph/candidate-delta.ts";
import { sha256CanonicalJson } from "../../src/authority/strict-json.ts";
import {
  createValidatedCandidate,
  hydrateValidatedCandidate,
} from "../../src/graph/validated-candidate.ts";
import {
  createProposalEnvelope,
  hydrateProposalEnvelope,
} from "../../src/validation/proposal-envelope.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";
import {
  PUBLIC_PROPOSAL_NOW,
  emptyGraphBundle,
  makePublicProposalBase,
  makePublicProposalEnvelope,
  makePublicProposalTransition,
} from "../fixtures/proposal-authority.ts";

function envelopeCore(): any {
  const envelope = clone(makePublicProposalEnvelope()) as Record<string, any>;
  delete envelope.envelope_sha256;
  return envelope;
}

function envelopeForProducer(kind: "fixture" | "imported" | "model_generated") {
  const core = envelopeCore();
  core.producer = { kind, trace_id: `${kind}:proposal-001` };
  core.fixture_binding = kind === "fixture" ? core.fixture_binding : null;
  return createProposalEnvelope(core);
}

function derive() {
  const envelope = makePublicProposalEnvelope();
  const base = makePublicProposalBase();
  const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
  return { envelope, base, delta };
}

function apply(
  values = derive(),
  overrides: Record<string, unknown> = {},
) {
  return applyCandidateDelta(values.envelope, values.delta, values.base, {
    now: PUBLIC_PROPOSAL_NOW,
    expected_scope: values.envelope.scope,
    prior_recorded_replay_keys: [],
    ...overrides,
  });
}

function applicationOptions(envelope = makePublicProposalEnvelope()) {
  return {
    now: PUBLIC_PROPOSAL_NOW,
    expected_scope: envelope.scope,
    prior_recorded_replay_keys: [],
  };
}

function rehashTransition(raw: unknown): any {
  const transition = clone(raw) as Record<string, any>;
  delete transition.transition_sha256;
  transition.transition_sha256 = sha256CanonicalJson(transition);
  return transition;
}

describe("CandidateDelta v1 and pure candidate application", () => {
  test("derives an immutable serializable delta bound to exact envelope/base identities", () => {
    const { envelope, base, delta } = derive();
    const hydrated = hydrateCandidateDelta(JSON.parse(JSON.stringify(delta)));

    assert.deepEqual(hydrated, delta);
    assert.equal(delta.envelope_sha256, envelope.envelope_sha256);
    assert.equal(delta.base_candidate_sha256, validatedCandidateSha256(base));
    assert.match(delta.delta_sha256, /^[a-f0-9]{64}$/);
    assert.match(delta.replay_key, /^[a-f0-9]{64}$/);
    assert.equal(delta.quality_gate_status, "borderline");
    assert.equal(Object.isFrozen(delta), true);
    assert.equal(Object.isFrozen(delta.records.account_objects[0]), true);
    assert.equal(delta.authority.proposal_only, true);
    assert.equal(delta.authority.candidate_state_only, true);
    assert.equal(delta.authority.trusted_presentation_authority, false);
    assert.equal(delta.authority.graph_ingestion_authority, false);
    assert.equal(delta.authority.authenticated_human_approval, false);
    assert.equal(delta.authority.ratification, false);
    assert.equal(delta.authority.durable_write_authority, false);
    assert.equal(delta.authority.integrity_digest_is_approval, false);
    assert.equal(delta.authority.candidate_hash_is_approval, false);
  });

  test("applies against the full base and returns a revalidated candidate plus exact quality report", () => {
    const transition = apply();
    const envelope = makePublicProposalEnvelope();
    const hydrated = hydrateCandidateTransition(
      envelope,
      JSON.parse(JSON.stringify(transition)),
      applicationOptions(envelope),
    );

    assert.deepEqual(hydrated, transition);
    assert.deepEqual(hydrateValidatedCandidate(transition.candidate), transition.candidate);
    assert.equal(transition.quality_gate.status, "borderline");
    assert.equal(transition.delta.quality_gate_status, "borderline");
    assert.equal(transition.quality_gate.ok, false);
    assert.deepEqual(
      transition.quality_gate.reasons.map((reason) => reason.code),
      ["accepted_excerpt_rate_below_threshold"],
    );
    assert.equal(transition.replay_key_to_record, transition.delta.replay_key);
    assert.deepEqual(transition.replay_protection, {
      caller_snapshot_required: true,
      caller_must_record_key: true,
      cross_process_durable_protection: false,
    });
    assert.equal(transition.authority.trusted_presentation_authority, false);
    assert.equal(transition.authority.graph_ingestion_authority, false);
    assert.equal(transition.authority.durable_write_authority, false);
    assert.equal(transition.authority.provider_calls_performed, 0);
    assert.equal(transition.authority.network_operations_performed, 0);
  });

  test("requires a caller-supplied exact replay snapshot and refuses reuse", () => {
    const values = derive();
    assert.throws(
      () =>
        applyCandidateDelta(values.envelope, values.delta, values.base, {
          now: PUBLIC_PROPOSAL_NOW,
          expected_scope: values.envelope.scope,
        }),
      /fields must exactly match/,
    );
    assert.throws(
      () => apply(values, { prior_recorded_replay_keys: [values.delta.replay_key] }),
      /already present in the prior snapshot/,
    );
    assert.throws(
      () => apply(values, { prior_recorded_replay_keys: ["not-a-replay-key"] }),
      /exact replay keys/,
    );
    assert.throws(
      () =>
        apply(values, {
          prior_recorded_replay_keys: Array.from(
            { length: 1_001 },
            (_, index) => index.toString(16).padStart(64, "0"),
          ),
        }),
      /array bound/,
    );
  });

  test("rejects team, account, subject, and purpose mismatch/cross-scope reuse", () => {
    const values = derive();
    for (const expectedScope of [
      { ...values.envelope.scope, team_id: "team_other" },
      { ...values.envelope.scope, account_id: "acc_other" },
      { ...values.envelope.scope, subject_id: "subject_other" },
      { ...values.envelope.scope, purpose: "trusted_presentation" },
    ]) {
      assert.throws(
        () => apply(values, { expected_scope: expectedScope }),
        /scope mismatch|unsupported/,
      );
    }
  });

  test("rejects expired/stale envelope derivation and expired/stale delta application", () => {
    const { envelope, base, delta } = derive();
    assert.throws(
      () => createCandidateDelta(envelope, base, "2026-06-11T00:00:00.000Z"),
      /must be canonical UTC/,
    );
    assert.throws(
      () => createCandidateDelta(envelope, base, "2026-06-12T00:00:00Z"),
      /proposal envelope is expired or stale/,
    );
    assert.throws(
      () =>
        applyCandidateDelta(envelope, delta, base, {
          now: "2026-06-12T00:00:00Z",
          expected_scope: envelope.scope,
          prior_recorded_replay_keys: [],
        }),
      /candidate delta is expired or stale/,
    );
  });

  test("rejects post-serialization envelope, delta, and transition mutation/hash mismatch", () => {
    const values = derive();
    const envelope = clone(values.envelope) as any;
    envelope.proposal_content.claims[0]!.text = "Mutated envelope claim";
    assert.throws(() => hydrateProposalEnvelope(envelope), /integrity digest mismatch/);

    const delta = clone(values.delta);
    delta.records.claims[0]!.text = "Mutated delta claim";
    assert.throws(() => hydrateCandidateDelta(delta), /integrity digest mismatch/);

    const transition = clone(apply(values));
    transition.candidate.graph_bundle.claims[0]!.text = "Mutated transition candidate";
    assert.throws(
      () =>
        hydrateCandidateTransition(
          values.envelope,
          transition,
          applicationOptions(values.envelope),
        ),
      /does not exactly match deterministic envelope\/base application/,
    );
  });

  test("envelope-bound hydration rejects self-rehashed replay, quality, base, candidate, and transition metadata substitutions", () => {
    const values = derive();
    const valid = apply(values);
    const substitutions: Array<(transition: any) => void> = [
      (transition) => {
        transition.replay_key_to_record = "b".repeat(64);
        transition.replay_protection.caller_must_record_key = false;
      },
      (transition) => {
        transition.quality_gate.status = "pass";
        transition.quality_gate.ok = true;
        transition.quality_gate.reasons = [];
      },
      (transition) => {
        transition.base_candidate = createValidatedCandidate(
          makeValidBundle(),
          values.base.subject,
        );
      },
      (transition) => {
        transition.candidate = values.base;
        transition.candidate_sha256 = validatedCandidateSha256(values.base);
      },
      (transition) => {
        transition.producer.trace_id = "substituted-transition-trace";
      },
    ];

    for (const substitute of substitutions) {
      const tampered = clone(valid) as any;
      substitute(tampered);
      const selfRehashed = rehashTransition(tampered);
      assert.throws(
        () =>
          hydrateCandidateTransition(
            values.envelope,
            selfRehashed,
            applicationOptions(values.envelope),
          ),
        CandidateDeltaBoundaryError,
      );
    }
  });

  test("envelope-bound hydration preserves an exact pass quality report", () => {
    const envelope = makePublicProposalEnvelope();
    const baseBundle = makeValidBundle();
    const secondExcerptText =
      "The platform integrates with existing warehouse management systems";
    const secondExcerptStart = baseBundle.sources[0]!.raw_text.indexOf(
      secondExcerptText,
    );
    baseBundle.excerpts.push({
      ...clone(baseBundle.excerpts[0]!),
      id: "exc_acme_launch_002",
      text: secondExcerptText,
      char_start: secondExcerptStart,
      char_end: secondExcerptStart + secondExcerptText.length,
    });
    const base = createValidatedCandidate(baseBundle, {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    });
    const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
    const transition = applyCandidateDelta(envelope, delta, base, {
      now: PUBLIC_PROPOSAL_NOW,
      expected_scope: envelope.scope,
      prior_recorded_replay_keys: [],
    });

    assert.equal(delta.quality_gate_status, "pass");
    assert.equal(transition.quality_gate.status, "pass");
    assert.deepEqual(
      hydrateCandidateTransition(
        envelope,
        transition,
        applicationOptions(envelope),
      ),
      transition,
    );
  });

  test("normalizes validated-candidate and strict replay-array failures to the candidate-delta boundary", () => {
    assert.throws(
      () => validatedCandidateSha256({}),
      CandidateDeltaBoundaryError,
    );

    const values = derive();
    assert.throws(
      () => createCandidateDelta(values.envelope, {}, PUBLIC_PROPOSAL_NOW),
      CandidateDeltaBoundaryError,
    );
    const sparse: string[] = [];
    sparse.length = 1;
    assert.throws(
      () =>
        apply(values, {
          prior_recorded_replay_keys: sparse,
        }),
      CandidateDeltaBoundaryError,
    );
  });

  test("rejects wrong or mutated base-candidate audit identity", () => {
    const values = derive();
    const changedBundle = emptyGraphBundle();
    changedBundle.research_runs.push({
      id: "run_changed_base",
      team_id: values.envelope.scope.team_id,
      account_id: values.envelope.scope.account_id,
      mode: "fixture",
      provider: null,
      model: null,
      status: "completed",
      cost_cap_usd: 0,
      observed_cost_usd: 0,
      started_at: PUBLIC_PROPOSAL_NOW,
      completed_at: PUBLIC_PROPOSAL_NOW,
    });
    const changedBase = createValidatedCandidate(changedBundle, {
      team_id: values.envelope.scope.team_id,
      account_id: values.envelope.scope.account_id,
    });

    assert.notEqual(validatedCandidateSha256(changedBase), values.delta.base_candidate_sha256);
    assert.throws(
      () =>
        applyCandidateDelta(values.envelope, values.delta, changedBase, {
          now: PUBLIC_PROPOSAL_NOW,
          expected_scope: values.envelope.scope,
          prior_recorded_replay_keys: [],
        }),
      /base candidate digest is stale, wrong, or mutated/,
    );
  });

  test("rejects a proposal delta that is valid alone but invalid when merged with the base", () => {
    const envelope = makePublicProposalEnvelope();
    const baseBundle = emptyGraphBundle();
    baseBundle.sources.push(clone(envelope.proposal_content.sources[0]!));
    const collisionBase = createValidatedCandidate(baseBundle, {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    });

    // The same proposal records derive successfully against an empty base.
    const standalone = createCandidateDelta(
      envelope,
      makePublicProposalBase(),
      PUBLIC_PROPOSAL_NOW,
    );
    assert.equal(hydrateCandidateDelta(standalone).records.sources.length, 1);

    assert.throws(
      () => createCandidateDelta(envelope, collisionBase, PUBLIC_PROPOSAL_NOW),
      /Workshop graph validation failed/,
    );
  });

  test("propagates borderline exactly and refuses a fully merged quality-gate fail", () => {
    const envelope = makePublicProposalEnvelope();
    const failing = clone(makeValidBundle());
    failing.sources[0]!.status = "stale";
    const failingBase = createValidatedCandidate(failing, {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    });

    assert.equal(createCandidateDelta(envelope, makePublicProposalBase(), PUBLIC_PROPOSAL_NOW).quality_gate_status, "borderline");
    assert.throws(
      () => createCandidateDelta(envelope, failingBase, PUBLIC_PROPOSAL_NOW),
      /fully merged candidate failed the deterministic quality gate/,
    );
  });

  test("preserves producer/scope traceability without calling imported/model proposals hand-curated", () => {
    for (const kind of ["imported", "model_generated"] as const) {
      const envelope = envelopeForProducer(kind);
      const base = makePublicProposalBase();
      const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
      const object = delta.records.account_objects[0]!;
      const trace = object.payload_json.proposal_trace as Record<string, unknown>;

      assert.equal(trace.producer_kind, kind);
      assert.equal(trace.producer_trace_id, envelope.producer.trace_id);
      assert.equal(trace.subject_id, envelope.scope.subject_id);
      assert.equal(trace.purpose, "candidate_validation");
      assert.equal(object.payload_json.origin, "canonical_proposal_envelope");
      assert.notEqual(object.payload_json.origin, "hand-curated-public");
      if (kind === "imported") {
        assert.equal(
          object.payload_json.review_state,
          "imported_proposal_pending_human_review",
        );
        assert.notEqual(
          object.payload_json.review_state,
          "model_proposed_pending_human_review",
        );
      }
      assert.equal(
        delta.records.claims[0]!.created_by,
        kind === "imported" ? "import" : "model",
      );
    }
  });

  test("fixture binding, source identities, and proposal/delta hashes never become approval claims", () => {
    const { envelope, delta } = derive();
    const trace = delta.records.account_objects[0]!.payload_json
      .proposal_trace as Record<string, unknown>;

    assert.equal(envelope.fixture_binding?.authenticated_human_approval, false);
    assert.equal(delta.fixture_binding?.authenticated_human_approval, false);
    assert.equal(trace.fixture_binding_is_authenticated_human_approval, false);
    assert.equal(trace.origin_content_sha256_proves_origin_custody, false);
    assert.equal(
      trace.transformation_manifest_sha256_resolves_transformation_record,
      false,
    );
    assert.equal(delta.authority.integrity_digest_is_approval, false);
    assert.equal(delta.authority.candidate_hash_is_approval, false);
  });

  test("rejects legacy/unbound delta shapes and proposal trust-state injection", () => {
    const { delta } = derive();
    const legacy = clone(delta) as unknown as Record<string, unknown>;
    delete legacy.envelope_sha256;
    assert.throws(() => hydrateCandidateDelta(legacy), CandidateDeltaBoundaryError);

    const extra = { ...clone(delta), approved: true };
    assert.throws(() => hydrateCandidateDelta(extra), CandidateDeltaBoundaryError);

    const injected = clone(delta);
    injected.records.claims[0]!.provenance_status = "verified";
    assert.throws(
      () => hydrateCandidateDelta(injected),
      /Workshop graph validation failed|proposal-derived claims must stay unverified|integrity digest mismatch/,
    );
  });

  test("transition contract remains provider/network/durable-effect free", () => {
    const transition = makePublicProposalTransition();

    assert.deepEqual(transition.authority, {
      proposal_only: true,
      integrity_digest_is_approval: false,
      current_effective_authorization: "none",
      trusted_presentation_authority: false,
      graph_ingestion_authority: false,
      authenticated_human_approval: false,
      ratification: false,
      durable_write_authority: false,
      durable_effect_performed: false,
      candidate_state_only: true,
      candidate_hash_is_approval: false,
      provider_calls_performed: 0,
      network_operations_performed: 0,
    });

    for (const path of [
      "src/validation/proposal-envelope.ts",
      "src/graph/candidate-delta.ts",
      "src/workshop/proposal-preview.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(
        source,
        /node:(?:fs|child_process|http|https|net)|\.\.\/(?:model|runtime|db|jobs|artifacts)\//,
        path,
      );
      assert.doesNotMatch(
        source,
        /\b(?:fetch|writeFile|appendFile|mkdir|rename|unlink|spawn|execFile|execSync)\s*\(/,
        path,
      );
    }
  });
});
