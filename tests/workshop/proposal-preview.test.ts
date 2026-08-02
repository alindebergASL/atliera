import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkshopPublicCuratedProposalPreview,
  WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME,
} from "../../src/workshop/proposal-preview.ts";
import { WORKSHOP_MODEL_PROPOSED_REVIEW_BADGE_TEXT } from "../../src/workshop/render-html.ts";
import { WORKSHOP_REVIEW_STATE_MODEL_PROPOSED } from "../../src/workshop/view-model.ts";
import {
  loadPublicProposalInput,
  makePublicProposalTransition,
  PUBLIC_PROPOSAL_NOW,
} from "../fixtures/proposal-authority.ts";

const HTML_FIXTURE = "fixtures/workshop/workshop-public-curated-proposal-preview.html";
const REPORT_FIXTURE = "fixtures/workshop/workshop-public-curated-proposal-preview-report.json";

describe("public curated proposal Workshop preview", () => {
  test("renders the visible model-proposed pending-review treatment without promoting trust", () => {
    const preview = buildWorkshopPublicCuratedProposalPreview(
      makePublicProposalTransition(),
      PUBLIC_PROPOSAL_NOW,
    );

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
    const { report } = buildWorkshopPublicCuratedProposalPreview(
      makePublicProposalTransition(),
      PUBLIC_PROPOSAL_NOW,
    );

    assert.equal(report.current_effective_authorization, "none");
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
    const preview = buildWorkshopPublicCuratedProposalPreview(
      makePublicProposalTransition(),
      PUBLIC_PROPOSAL_NOW,
    );
    const committedHtml = readFileSync(HTML_FIXTURE, "utf8");
    const committedReport = readFileSync(REPORT_FIXTURE, "utf8");

    assert.equal(committedHtml, preview.html);
    assert.equal(committedReport, `${JSON.stringify(preview.report, null, 2)}\n`);
    assert.equal(JSON.parse(committedReport).html_length, committedHtml.length);
  });

  test("raw legacy materialization input cannot call the active preview boundary", () => {
    assert.throws(
      () =>
        buildWorkshopPublicCuratedProposalPreview(
          loadPublicProposalInput(),
          PUBLIC_PROPOSAL_NOW,
        ),
      /Candidate delta refused/,
    );
  });
});
