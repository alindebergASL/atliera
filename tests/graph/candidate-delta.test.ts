import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  CANDIDATE_COMPOSITION_MAX_SOURCE_RAW_TEXT_UTF8_BYTES,
  CANDIDATE_COMPOSITION_MAX_TOTAL_SOURCE_RAW_TEXT_UTF8_BYTES,
  CANDIDATE_QUALITY_GATE_POLICY_NAME,
  CANDIDATE_QUALITY_GATE_POLICY_VERSION,
  CandidateDeltaBoundaryError,
  applyCandidateDelta,
  createCandidateDelta,
  hydrateCandidateDelta,
  hydrateCandidateTransition,
  validatedCandidateSha256,
} from "../../src/graph/candidate-delta.ts";
import { sha256CanonicalJson } from "../../src/authority/strict-json.ts";
import { DEFAULT_QUALITY_GATE_THRESHOLDS } from "../../src/gate/quality-gate.ts";
import {
  createValidatedCandidate,
  hydrateValidatedCandidate,
} from "../../src/graph/validated-candidate.ts";
import {
  PROPOSAL_ENVELOPE_MAX_ACCOUNT_OBJECT_CLAIM_FAN_OUT,
  PROPOSAL_ENVELOPE_MAX_CLAIM_EVIDENCE_FAN_OUT,
  createProposalEnvelope,
  hydrateProposalEnvelope,
} from "../../src/validation/proposal-envelope.ts";
import { buildWorkshopPublicCuratedProposalPreview } from "../../src/workshop/proposal-preview.ts";
import { clone, makeValidBundle, sha256Utf8 } from "../fixtures/valid-graph.ts";
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

function rehashDelta(raw: unknown): any {
  const delta = clone(raw) as Record<string, any>;
  delete delta.delta_sha256;
  delta.delta_sha256 = sha256CanonicalJson(delta);
  return delta;
}

function setSourceText(source: Record<string, any>, rawText: string): void {
  source.raw_text = rawText;
  source.origin_content_sha256 = sha256Utf8(rawText);
  source.stored_content_sha256 = sha256Utf8(rawText);
  source.transformation_manifest_sha256 = null;
}

function materializableClaimEvidenceFanOutEnvelope(edgeCount: number) {
  const core = envelopeCore();
  const source = core.proposal_content.sources[0];
  const excerptTexts = Array.from(
    { length: Math.min(50, edgeCount) },
    (_, index) => `evidence phrase ${index}`,
  );
  setSourceText(source, excerptTexts.join(" | "));
  core.proposal_content.excerpts = excerptTexts.map((text, index) => ({
    id: `e${index}`,
    source_id: source.id,
    text,
  }));
  core.proposal_content.claims = [];
  let remaining = edgeCount;
  for (let index = 0; remaining > 0; index += 1) {
    const count = Math.min(50, remaining);
    core.proposal_content.claims.push({
      id: `c${index}`,
      type: "signal",
      text: `claim ${index}`,
      subject: `subject:${index}`,
      confidence: "medium",
      excerpt_ids: core.proposal_content.excerpts
        .slice(0, count)
        .map((excerpt: any) => excerpt.id),
    });
    remaining -= count;
  }
  core.proposal_content.account_objects = [{
    id: "o0",
    type: "signal",
    title: "Claim evidence boundary",
    summary: "Claim evidence boundary",
    claim_ids: ["c0"],
  }];
  return createProposalEnvelope(core);
}

function materializableAccountObjectClaimFanOutEnvelope(edgeCount: number) {
  const core = envelopeCore();
  const source = core.proposal_content.sources[0];
  setSourceText(source, "shared evidence phrase");
  core.proposal_content.excerpts = [{
    id: "e0",
    source_id: source.id,
    text: source.raw_text,
  }];
  const claimCount = Math.min(50, edgeCount);
  core.proposal_content.claims = Array.from(
    { length: claimCount },
    (_, index) => ({
      id: `c${index}`,
      type: "signal",
      text: `claim ${index}`,
      subject: `subject:${index}`,
      confidence: "medium",
      excerpt_ids: ["e0"],
    }),
  );
  core.proposal_content.account_objects = [];
  let remaining = edgeCount;
  for (let index = 0; remaining > 0; index += 1) {
    const count = Math.min(50, remaining);
    core.proposal_content.account_objects.push({
      id: `o${index}`,
      type: "signal",
      title: `object ${index}`,
      summary: `object ${index}`,
      claim_ids: core.proposal_content.claims
        .slice(0, count)
        .map((claim: any) => claim.id),
    });
    remaining -= count;
  }
  return createProposalEnvelope(core);
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
    assert.equal(delta.quality_gate_policy.name, CANDIDATE_QUALITY_GATE_POLICY_NAME);
    assert.equal(delta.quality_gate_policy.version, CANDIDATE_QUALITY_GATE_POLICY_VERSION);
    assert.match(delta.quality_gate_policy.policy_sha256, /^[a-f0-9]{64}$/);
    assert.match(delta.quality_gate_report_sha256, /^[a-f0-9]{64}$/);
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
    assert.equal(
      transition.delta.quality_gate_report_sha256,
      sha256CanonicalJson(transition.quality_gate as any),
    );
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

  test("ambient default mutation cannot change candidate policy and transition creation freezes no caller threshold object", () => {
    const callerThresholds = {
      min_accepted_excerpt_rate: 0.25,
      min_verified_claim_evidence_coverage: 0.75,
      max_invented_id_failures: 0,
    };
    assert.equal(Object.isFrozen(callerThresholds), false);
    assert.equal(
      Reflect.set(
        DEFAULT_QUALITY_GATE_THRESHOLDS as unknown as Record<string, number>,
        "min_accepted_excerpt_rate",
        0,
      ),
      false,
    );
    assert.equal(
      Reflect.set(
        DEFAULT_QUALITY_GATE_THRESHOLDS as unknown as Record<string, number>,
        "min_verified_claim_evidence_coverage",
        0,
      ),
      false,
    );

    const values = derive();
    const transition = apply(values);
    assert.equal(values.delta.quality_gate_status, "borderline");
    assert.equal(transition.quality_gate.thresholds.min_accepted_excerpt_rate, 0.5);
    assert.equal(Object.isFrozen(callerThresholds), false);

    const failing = clone(makeValidBundle());
    failing.sources[0]!.status = "stale";
    const failingBase = createValidatedCandidate(failing, values.base.subject);
    assert.throws(
      () =>
        createCandidateDelta(
          values.envelope,
          failingBase,
          PUBLIC_PROPOSAL_NOW,
        ),
      /fully merged candidate failed the deterministic quality gate/,
    );
  });

  test("rejects self-rehashed policy and full-report drift even when status is preserved", () => {
    const values = derive();

    const policyDrift = clone(values.delta) as any;
    policyDrift.quality_gate_policy.policy_sha256 = "b".repeat(64);
    assert.throws(
      () =>
        applyCandidateDelta(
          values.envelope,
          rehashDelta(policyDrift),
          values.base,
          applicationOptions(values.envelope),
        ),
      /quality-gate policy identity drift/,
    );

    const transition = clone(apply(values)) as any;
    transition.quality_gate.thresholds.min_accepted_excerpt_rate = 0.75;
    transition.quality_gate.reasons[0].threshold = 0.75;
    assert.equal(transition.quality_gate.status, "borderline");
    transition.delta.quality_gate_report_sha256 = sha256CanonicalJson(
      transition.quality_gate,
    );
    transition.delta = rehashDelta(transition.delta);
    const selfRehashed = rehashTransition(transition);
    assert.throws(
      () =>
        hydrateCandidateTransition(
          values.envelope,
          selfRehashed,
          applicationOptions(values.envelope),
        ),
      /exact quality-gate report identity drift/,
    );
  });

  test("materializes the exact ClaimEvidence fan-out boundary into a representable delta", () => {
    const envelope = materializableClaimEvidenceFanOutEnvelope(
      PROPOSAL_ENVELOPE_MAX_CLAIM_EVIDENCE_FAN_OUT,
    );
    const delta = createCandidateDelta(
      envelope,
      makePublicProposalBase(),
      PUBLIC_PROPOSAL_NOW,
    );
    assert.equal(delta.records.claim_evidence.length, 1_000);
    assert.deepEqual(hydrateCandidateDelta(delta), delta);
  });

  test("completes create, derive, apply, hydrate, and preview at the exact AccountObjectClaim/preview fan-out boundary", () => {
    const envelope = materializableAccountObjectClaimFanOutEnvelope(
      PROPOSAL_ENVELOPE_MAX_ACCOUNT_OBJECT_CLAIM_FAN_OUT,
    );
    const base = makePublicProposalBase();
    const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
    assert.equal(delta.records.account_object_claims.length, 1_000);

    const options = applicationOptions(envelope);
    const transition = applyCandidateDelta(envelope, delta, base, options);
    const hydrated = hydrateCandidateTransition(envelope, transition, options);
    const preview = buildWorkshopPublicCuratedProposalPreview(
      envelope,
      hydrated,
      options,
    );

    assert.equal(preview.report.review_decorated_item_count, 20);
    assert.equal(
      preview.view_model.lenses.signals.reduce(
        (sum, item) => sum + item.evidence_packets.length,
        0,
      ),
      1_000,
    );
  });

  test("includes base sources in the exact merged-candidate compositional source budget", () => {
    assert.equal(CANDIDATE_COMPOSITION_MAX_SOURCE_RAW_TEXT_UTF8_BYTES, 2_097_152);
    assert.equal(CANDIDATE_COMPOSITION_MAX_TOTAL_SOURCE_RAW_TEXT_UTF8_BYTES, 4_194_304);
    const envelope = makePublicProposalEnvelope();
    const proposalSourceBytes = Buffer.byteLength(
      envelope.proposal_content.sources[0]!.raw_text,
      "utf8",
    );
    const baseBundle = emptyGraphBundle();
    const first = clone(envelope.proposal_content.sources[0]!) as Record<string, any>;
    first.id = "src_compositional_base_one";
    setSourceText(
      first,
      "a".repeat(CANDIDATE_COMPOSITION_MAX_SOURCE_RAW_TEXT_UTF8_BYTES),
    );
    const second = clone(first);
    second.id = "src_compositional_base_two";
    setSourceText(
      second,
      "b".repeat(
        CANDIDATE_COMPOSITION_MAX_TOTAL_SOURCE_RAW_TEXT_UTF8_BYTES -
          CANDIDATE_COMPOSITION_MAX_SOURCE_RAW_TEXT_UTF8_BYTES -
          proposalSourceBytes,
      ),
    );
    baseBundle.sources.push(first as any, second as any);
    const subject = {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    };
    const baseAtBoundary = createValidatedCandidate(baseBundle, subject);
    const delta = createCandidateDelta(envelope, baseAtBoundary, PUBLIC_PROPOSAL_NOW);
    const transition = applyCandidateDelta(
      envelope,
      delta,
      baseAtBoundary,
      applicationOptions(envelope),
    );
    assert.deepEqual(
      hydrateCandidateTransition(
        envelope,
        transition,
        applicationOptions(envelope),
      ),
      transition,
    );

    const overBudgetBundle = clone(baseBundle);
    setSourceText(
      overBudgetBundle.sources[1] as unknown as Record<string, any>,
      `${overBudgetBundle.sources[1]!.raw_text}b`,
    );
    const baseOverBoundary = createValidatedCandidate(
      overBudgetBundle,
      subject,
    );
    assert.throws(
      () => createCandidateDelta(envelope, baseOverBoundary, PUBLIC_PROPOSAL_NOW),
      /merged-candidate compositional cumulative source-content UTF-8 budget/,
    );
  });

  test("accepts the exact merged per-kind array boundary and rejects its first excess record", () => {
    const envelope = makePublicProposalEnvelope();
    const subject = {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    };
    const baseWithClaims = (count: number) => {
      const bundle = emptyGraphBundle();
      bundle.claims = Array.from({ length: count }, (_, index) => ({
        id: `clm_composition_${index}`,
        team_id: subject.team_id,
        account_id: subject.account_id,
        claim_type: "note",
        text: `composition claim ${index}`,
        normalized_subject: `composition:${index}`,
        confidence: "low" as const,
        provenance_status: "unverified" as const,
        status: "active" as const,
        created_by: "system" as const,
        created_at: PUBLIC_PROPOSAL_NOW,
      }));
      return createValidatedCandidate(bundle, subject);
    };

    const baseAtBoundary = baseWithClaims(998);
    const accepted = createCandidateDelta(
      envelope,
      baseAtBoundary,
      PUBLIC_PROPOSAL_NOW,
    );
    const transition = applyCandidateDelta(
      envelope,
      accepted,
      baseAtBoundary,
      applicationOptions(envelope),
    );
    assert.equal(transition.candidate.graph_bundle.claims.length, 1_000);

    assert.throws(
      () =>
        createCandidateDelta(
          envelope,
          baseWithClaims(999),
          PUBLIC_PROPOSAL_NOW,
        ),
      /merged-candidate compositional array budget for claims.*1,000/,
    );
  });

  test("rejects at delta creation when the exact prospective transition is not representable", () => {
    const envelope = makePublicProposalEnvelope();
    const baseBundle = emptyGraphBundle();
    for (let index = 0; index < 4; index += 1) {
      baseBundle.claims.push({
        id: `clm_large_${index}`,
        team_id: envelope.scope.team_id,
        account_id: envelope.scope.account_id,
        claim_type: "note",
        text: "x".repeat(1_600_000),
        normalized_subject: `large:${index}`,
        confidence: "low",
        provenance_status: "unverified",
        status: "active",
        created_by: "system",
        created_at: PUBLIC_PROPOSAL_NOW,
      });
    }
    const base = createValidatedCandidate(baseBundle, {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    });
    assert.throws(
      () => createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW),
      /prospective transition representability budget failed.*cumulative string-size bound/,
    );
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
