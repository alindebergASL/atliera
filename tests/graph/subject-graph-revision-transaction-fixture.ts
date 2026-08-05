import { createHash } from "node:crypto";

import {
  applyCandidateDelta,
  createCandidateDelta,
  validatedCandidateSha256,
  type CandidateTransition,
} from "../../src/graph/candidate-delta.ts";
import {
  SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
  SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
  createSubjectGraphRevisionIntent,
  type SubjectGraphRevisionPredecessorBasis,
  type SubjectGraphRevisionReviewHandoff,
} from "../../src/graph/subject-graph-revision-intent.ts";
import {
  createValidatedCandidate,
  type ValidatedCandidate,
} from "../../src/graph/validated-candidate.ts";
import {
  adaptPublicCuratedMaterializationInputToProposalEnvelope,
  type ProposalEnvelope,
} from "../../src/validation/proposal-envelope.ts";
import type { MaterializeProposalForValidationInput } from "../../src/validation/proposal-materialization.ts";
import {
  PUBLIC_PROPOSAL_NOW,
  emptyGraphBundle,
  loadPublicProposalInput,
} from "../fixtures/proposal-authority.ts";
import { clone } from "../fixtures/valid-graph.ts";

interface PipelineIntentOptions {
  readonly variant: string;
  readonly team_id?: string;
  readonly account_id?: string;
  readonly subject_id?: string;
  readonly base?: ValidatedCandidate;
  readonly expected_prior_revision?: `rev_${number}` | null;
  readonly raw_text_suffix?: string;
  readonly object_title?: string;
  readonly include_three_lanes?: boolean;
  readonly map_title?: string;
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function variantInput(options: PipelineIntentOptions): MaterializeProposalForValidationInput {
  const input = clone(loadPublicProposalInput()) as Record<string, any>;
  const teamId = options.team_id ?? "team_atliera_lab";
  const accountId = options.account_id ?? "acc_acme_robotics";
  const suffix = options.variant;
  const sourceId = `src_acme_press_public_${suffix}`;
  const excerptOpen = `hub-open-${suffix}`;
  const excerptDelivery = `hub-delivery-${suffix}`;
  const claimExpansion = `hub-expansion-${suffix}`;
  const claimLogistics = `hub-logistics-${suffix}`;

  input.context.team_id = teamId;
  input.context.account_id = accountId;
  input.context.proposal_set_id = `public-curated-${suffix}`;
  input.public_sources[0].id = sourceId;
  input.public_sources[0].team_id = teamId;
  input.public_sources[0].account_id = accountId;
  input.proposed_excerpts[0].proposal_id = excerptOpen;
  input.proposed_excerpts[0].source_document_id = sourceId;
  input.proposed_excerpts[1].proposal_id = excerptDelivery;
  input.proposed_excerpts[1].source_document_id = sourceId;
  input.proposed_claims[0].proposal_id = claimExpansion;
  input.proposed_claims[0].supporting_excerpt_proposal_ids = [excerptOpen];
  input.proposed_claims[1].proposal_id = claimLogistics;
  input.proposed_claims[1].supporting_excerpt_proposal_ids = [excerptDelivery];
  input.proposed_account_objects[0].proposal_id = `hub-signal-${suffix}`;
  input.proposed_account_objects[0].supporting_claim_proposal_ids = [
    claimExpansion,
    claimLogistics,
  ];
  if (options.object_title !== undefined) {
    input.proposed_account_objects[0].title = options.object_title;
  }
  if (options.include_three_lanes === true) {
    input.proposed_account_objects.push(
      {
        proposal_id: `hub-map-${suffix}`,
        object_type: "initiative",
        title: options.map_title ?? "European distribution operating map",
        summary:
          "The European hub is part of Acme Robotics' current distribution footprint.",
        supporting_claim_proposal_ids: [claimExpansion],
      },
      {
        proposal_id: `hub-play-${suffix}`,
        object_type: "play",
        title: "Review the synthetic hub evidence",
        summary:
          "Review the fixture evidence before preparing any later synthetic update.",
        supporting_claim_proposal_ids: [claimLogistics],
      },
    );
  }
  if (options.raw_text_suffix !== undefined) {
    input.public_sources[0].raw_text += options.raw_text_suffix;
    const contentSha256 = sha256Utf8(
      input.public_sources[0].raw_text,
    );
    input.public_sources[0].origin_content_sha256 = contentSha256;
    input.public_sources[0].stored_content_sha256 = contentSha256;
  }
  return input as MaterializeProposalForValidationInput;
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

function reviewFor(
  transition: CandidateTransition,
  basis: SubjectGraphRevisionPredecessorBasis,
): SubjectGraphRevisionReviewHandoff {
  return {
    kind: SUBJECT_GRAPH_REVISION_REVIEW_HANDOFF_KIND,
    version: 1,
    disposition: SUBJECT_GRAPH_REVISION_REVIEW_DISPOSITION,
    graph_identity: { ...transition.scope },
    predecessor_basis: { ...basis },
    envelope_sha256: transition.delta.envelope_sha256,
    delta_sha256: transition.delta.delta_sha256,
    transition_sha256: transition.transition_sha256,
    base_snapshot_sha256: validatedCandidateSha256(transition.base_candidate),
    proposed_snapshot_sha256: transition.candidate_sha256,
    quality_gate_policy: { ...transition.delta.quality_gate_policy },
    quality_gate_report_sha256: transition.delta.quality_gate_report_sha256,
    replay_key_to_record: transition.replay_key_to_record,
    reviewer_ref: "reviewer:transaction-fixture",
    reviewed_at: PUBLIC_PROPOSAL_NOW,
    rationale:
      "Fixture-only transaction review handoff for exact disposable SQLite boundary tests.",
    authority: reviewAuthority(),
  };
}

export function makePipelineRevisionIntent(options: PipelineIntentOptions) {
  const teamId = options.team_id ?? "team_atliera_lab";
  const accountId = options.account_id ?? "acc_acme_robotics";
  const subjectId = options.subject_id ?? "subject_acme_robotics";
  const envelope: ProposalEnvelope =
    adaptPublicCuratedMaterializationInputToProposalEnvelope(
      variantInput(options),
      { subject_id: subjectId },
    );
  const base =
    options.base ??
    createValidatedCandidate(emptyGraphBundle(), {
      team_id: teamId,
      account_id: accountId,
    });
  const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
  const applicationOptions = {
    now: PUBLIC_PROPOSAL_NOW,
    expected_scope: envelope.scope,
    prior_recorded_replay_keys: [],
  };
  const transition = applyCandidateDelta(
    envelope,
    delta,
    base,
    applicationOptions,
  );
  const expectedPriorRevision = options.expected_prior_revision ?? null;
  const basis: SubjectGraphRevisionPredecessorBasis = {
    mode: expectedPriorRevision === null ? "bootstrap" : "successor",
    expected_prior_revision: expectedPriorRevision,
    expected_base_snapshot_sha256: validatedCandidateSha256(base),
  };
  const review = reviewFor(transition, basis);
  const intent = createSubjectGraphRevisionIntent(
    envelope,
    transition,
    applicationOptions,
    basis,
    review,
  );
  return {
    intent,
    envelope,
    base,
    delta,
    transition,
    applicationOptions,
    basis,
    review,
  };
}
