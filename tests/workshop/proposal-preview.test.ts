import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkshopPublicCuratedProposalPreview,
  WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME,
} from "../../src/workshop/proposal-preview.ts";
import {
  applyCandidateDelta,
  createCandidateDelta,
  hydrateCandidateDelta,
  validatedCandidateSha256,
} from "../../src/graph/candidate-delta.ts";
import { createValidatedCandidate } from "../../src/graph/validated-candidate.ts";
import { sha256CanonicalJson } from "../../src/authority/strict-json.ts";
import { runQualityGate } from "../../src/gate/quality-gate.ts";
import { createProposalEnvelope, type ProposalEnvelope } from "../../src/validation/proposal-envelope.ts";
import { WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT } from "../../src/workshop/render-html.ts";
import { WORKSHOP_REVIEW_STATE_MODEL_PROPOSED } from "../../src/workshop/view-model.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";
import {
  loadPublicProposalInput,
  makePublicProposalBase,
  makePublicProposalEnvelope,
  makePublicProposalTransition,
  PUBLIC_PROPOSAL_NOW,
} from "../fixtures/proposal-authority.ts";

const HTML_FIXTURE = "fixtures/workshop/workshop-public-curated-proposal-preview.html";
const REPORT_FIXTURE = "fixtures/workshop/workshop-public-curated-proposal-preview-report.json";

function applicationOptions(envelope: ProposalEnvelope) {
  return {
    now: PUBLIC_PROPOSAL_NOW,
    expected_scope: envelope.scope,
    prior_recorded_replay_keys: [],
  };
}

function buildPreview() {
  const envelope = makePublicProposalEnvelope();
  return buildWorkshopPublicCuratedProposalPreview(
    envelope,
    makePublicProposalTransition(),
    applicationOptions(envelope),
  );
}

function forgeEnvelopeLessTransition(): any {
  const forged = clone(makePublicProposalTransition()) as any;
  const fakeEnvelopeDigest = "a".repeat(64);
  const localUrl = "http://127.0.0.1:8080/internal-admin";
  const absentExcerpt = "FORGED EXCERPT ABSENT FROM THE SOURCE TEXT";

  forged.delta.envelope_sha256 = fakeEnvelopeDigest;
  forged.delta.records.sources[0].url = localUrl;
  forged.delta.records.sources[0].canonical_url = localUrl;
  forged.delta.records.excerpts[0].text = absentExcerpt;
  forged.delta.records.account_objects[0].payload_json.proposal_trace.envelope_sha256 =
    fakeEnvelopeDigest;
  forged.delta.replay_key = sha256CanonicalJson([
    "atliera_candidate_delta_replay",
    1,
    fakeEnvelopeDigest,
    forged.delta.base_candidate_sha256,
  ]);
  delete forged.delta.delta_sha256;
  forged.delta.delta_sha256 = sha256CanonicalJson(forged.delta);

  forged.candidate.graph_bundle = clone(forged.delta.records);
  forged.candidate_sha256 = validatedCandidateSha256(forged.candidate);
  forged.quality_gate = runQualityGate(forged.candidate.graph_bundle);
  forged.replay_key_to_record = forged.delta.replay_key;
  delete forged.transition_sha256;
  forged.transition_sha256 = sha256CanonicalJson(forged);
  return forged;
}

describe("public curated proposal Workshop preview", () => {
  test("renders the visible model-proposed pending-review treatment without promoting trust", () => {
    const preview = buildPreview();

    assert.equal(preview.kind, WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME);
    assert.equal(preview.report.artifact_name, WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME);
    assert.equal(preview.report.html_rendered, true);
    assert.equal(preview.report.preview_mode, "validation");
    assert.equal(preview.report.lens_item_counts.signals, 1);
    assert.equal(preview.report.lens_item_counts.maps, 0);
    assert.equal(preview.report.lens_item_counts.plays, 0);
    assert.equal(preview.report.review_decorated_item_count, 1);
    assert.equal(preview.report.verified_object_count, 0);

    assert.match(preview.html, /Validation preview \(non-production\)/);
    assert.match(preview.html, new RegExp(WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT));
    assert.match(
      preview.html,
      new RegExp(`data-review-state="${WORKSHOP_REVIEW_STATE_MODEL_PROPOSED}"`),
    );
    assert.match(preview.html, /<span class="trust-pill trust-unverified">Unverified<\/span>/);
    assert.match(preview.html, /Proposed excerpt \(pending human review\)/);
    assert.match(preview.html, /data-excerpt-validation-status="proposed"/);
    assert.equal(preview.view_model.lenses.signals[0]?.evidence_packets.length, 2);
    assert.doesNotMatch(preview.html, /<span class="trust-pill trust-verified">Verified<\/span>/);
    assert.doesNotMatch(preview.html, /<span class="trust-pill trust-source_document_only">Source-backed<\/span>/);
  });

  test("keeps provider, private-evidence, durable-write, ingestion, production, and readiness boundaries closed", () => {
    const { report } = buildPreview();

    assert.equal(report.current_effective_authorization, "none");
    assert.equal(
      report.validated_input_contract,
      "canonical_proposal_envelope_and_candidate_transition",
    );
    assert.equal(report.declared_producer_kind, "fixture");
    assert.equal(Object.hasOwn(report, "generated_from"), false);
    assert.equal(Object.hasOwn(report, "input_origin"), false);
    assert.deepEqual(report.boundaries, {
      current_effective_authorization: "none",
      authorizes_provider_call: false,
      authorizes_private_evidence_read: false,
      authorizes_graph_ingestion: false,
      graph_ingestion_performed: false,
      provider_calls_executed: 0,
      private_evidence_read: false,
      durable_writes_performed: false,
      production_writes: false,
      readiness_claim: false,
    });
    assert.equal(report.provider_calls_made, 0);
    assert.equal(report.private_evidence_read, false);
    assert.equal(report.graph_ingestion_performed, false);
    assert.equal(report.durable_writes_performed, false);
    assert.equal(report.production_writes, false);
    assert.equal(report.readiness_claim, false);
    assert.deepEqual(report.trust_language, {
      provenance_status: "unverified",
      excerpt_validation_status: "proposed",
      review_state: "model_proposed_pending_human_review",
      adds_new_truth_status_tier: false,
      confidence_cap: "medium",
    });
  });

  test("committed HTML and report artifacts regenerate exactly from the public fixture", () => {
    const preview = buildPreview();
    const committedHtml = readFileSync(HTML_FIXTURE, "utf8");
    const committedReport = readFileSync(REPORT_FIXTURE, "utf8");

    assert.equal(committedHtml, preview.html);
    assert.equal(committedReport, `${JSON.stringify(preview.report, null, 2)}\n`);
    assert.equal(JSON.parse(committedReport).html_length, committedHtml.length);
  });

  test("raw legacy materialization input cannot call the active preview boundary", () => {
    const envelope = makePublicProposalEnvelope();
    assert.throws(
      () =>
        buildWorkshopPublicCuratedProposalPreview(
          envelope,
          loadPublicProposalInput(),
          applicationOptions(envelope),
        ),
      /Candidate delta refused/,
    );
  });

  test("refuses a self-consistent envelope-less forged transition before producing render or review input", () => {
    const envelope = makePublicProposalEnvelope();
    const forged = forgeEnvelopeLessTransition();

    // This proves the regression exercises the old bypass rather than only a
    // malformed shape: its delta and all public unkeyed integrity identities
    // are self-consistent without any matching ProposalEnvelope.
    assert.deepEqual(hydrateCandidateDelta(forged.delta), forged.delta);
    assert.equal(
      forged.candidate.graph_bundle.sources[0].url,
      "http://127.0.0.1:8080/internal-admin",
    );
    assert.equal(
      forged.candidate.graph_bundle.excerpts[0].text,
      "FORGED EXCERPT ABSENT FROM THE SOURCE TEXT",
    );
    assert.equal(
      forged.candidate.graph_bundle.sources[0].raw_text.includes(
        forged.candidate.graph_bundle.excerpts[0].text,
      ),
      false,
    );
    assert.throws(
      () =>
        buildWorkshopPublicCuratedProposalPreview(
          envelope,
          forged,
          applicationOptions(envelope),
        ),
      /bound to a different envelope/,
    );
  });

  test("refuses substitution of the supplied envelope against an otherwise valid transition", () => {
    const realEnvelope = makePublicProposalEnvelope();
    const substitutedCore = clone(realEnvelope) as any;
    delete substitutedCore.envelope_sha256;
    substitutedCore.proposal_content.account_objects[0].title =
      "Substituted envelope title";
    const substitutedEnvelope = createProposalEnvelope(substitutedCore);

    assert.throws(
      () =>
        buildWorkshopPublicCuratedProposalPreview(
          substitutedEnvelope,
          makePublicProposalTransition(),
          applicationOptions(substitutedEnvelope),
        ),
      /bound to a different envelope/,
    );
  });

  test("does not turn an arbitrary declared fixture binding into committed or exact fixture provenance", () => {
    const core = clone(makePublicProposalEnvelope()) as any;
    delete core.envelope_sha256;
    core.producer.trace_id = "direct-fixture-declaration";
    core.fixture_binding = {
      fixture_id: "arbitrary-fixture-binding",
      fixture_content_sha256: "b".repeat(64),
      authenticated_human_approval: false,
    };
    const envelope = createProposalEnvelope(core);
    const base = makePublicProposalBase();
    const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
    const transition = applyCandidateDelta(envelope, delta, base, applicationOptions(envelope));
    const preview = buildWorkshopPublicCuratedProposalPreview(
      envelope,
      transition,
      applicationOptions(envelope),
    );
    const serializedReport = JSON.stringify(preview.report);

    assert.equal(preview.report.declared_producer_kind, "fixture");
    assert.doesNotMatch(
      serializedReport,
      /hand-curated-public|committed.fixture|exact.fixture|public.curated.fixture/i,
    );
  });

  test("reports model-generated content only by its declared canonical producer kind", () => {
    const core = clone(makePublicProposalEnvelope()) as any;
    delete core.envelope_sha256;
    core.producer = {
      kind: "model_generated",
      trace_id: "model-generated-public-proposal",
    };
    core.fixture_binding = null;
    const envelope = createProposalEnvelope(core);
    const base = makePublicProposalBase();
    const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
    const transition = applyCandidateDelta(envelope, delta, base, applicationOptions(envelope));
    const preview = buildWorkshopPublicCuratedProposalPreview(
      envelope,
      transition,
      applicationOptions(envelope),
    );
    const serializedReport = JSON.stringify(preview.report);

    assert.equal(preview.report.declared_producer_kind, "model_generated");
    assert.equal(preview.report.proposal_set_id, envelope.producer.trace_id);
    assert.doesNotMatch(serializedReport, /hand-curated-public|fixture provenance/i);
  });

  test("renders only independently validated proposal delta records, never unrelated merged-base records", () => {
    const envelope = makePublicProposalEnvelope();
    const base = createValidatedCandidate(makeValidBundle(), {
      team_id: envelope.scope.team_id,
      account_id: envelope.scope.account_id,
    });
    const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
    const transition = applyCandidateDelta(envelope, delta, base, applicationOptions(envelope));
    const preview = buildWorkshopPublicCuratedProposalPreview(
      envelope,
      transition,
      applicationOptions(envelope),
    );

    assert.equal(transition.candidate.graph_bundle.account_objects.length, 2);
    assert.equal(preview.report.lens_item_counts.signals, 1);
    assert.equal(preview.report.review_decorated_item_count, 1);
    assert.equal(preview.report.verified_object_count, 0);
    assert.equal(preview.view_model.totals.account_objects, 1);
    assert.equal(preview.view_model.totals.verified_objects, 0);
    assert.equal(
      preview.view_model.lenses.signals.some(
        (item) => item.id === "obj_acme_signal_launch",
      ),
      false,
    );
    assert.doesNotMatch(preview.html, /New logistics platform launch|Source-backed/);
  });
});
