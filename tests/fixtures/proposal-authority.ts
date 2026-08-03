import { readFileSync } from "node:fs";

import {
  applyCandidateDelta,
  createCandidateDelta,
  type CandidateTransition,
} from "../../src/graph/candidate-delta.ts";
import { createValidatedCandidate } from "../../src/graph/validated-candidate.ts";
import type { GraphBundle } from "../../src/graph/types.ts";
import {
  adaptPublicCuratedMaterializationInputToProposalEnvelope,
  type ProposalEnvelope,
} from "../../src/validation/proposal-envelope.ts";
import type { MaterializeProposalForValidationInput } from "../../src/validation/proposal-materialization.ts";

export const PUBLIC_PROPOSAL_NOW = "2026-06-11T00:00:00Z";
export const PUBLIC_PROPOSAL_SUBJECT_ID = "subject_acme_robotics";
export const PUBLIC_PROPOSAL_INPUT_FIXTURE =
  "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json";

export function loadPublicProposalInput(): MaterializeProposalForValidationInput {
  return JSON.parse(
    readFileSync(PUBLIC_PROPOSAL_INPUT_FIXTURE, "utf8"),
  ) as MaterializeProposalForValidationInput;
}

export function emptyGraphBundle(): GraphBundle {
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

export function makePublicProposalEnvelope(): ProposalEnvelope {
  return adaptPublicCuratedMaterializationInputToProposalEnvelope(
    loadPublicProposalInput(),
    { subject_id: PUBLIC_PROPOSAL_SUBJECT_ID },
  );
}

export function makePublicProposalBase() {
  return createValidatedCandidate(emptyGraphBundle(), {
    team_id: "team_atliera_lab",
    account_id: "acc_acme_robotics",
  });
}

export function makePublicProposalTransition(): CandidateTransition {
  const envelope = makePublicProposalEnvelope();
  const base = makePublicProposalBase();
  const delta = createCandidateDelta(envelope, base, PUBLIC_PROPOSAL_NOW);
  return applyCandidateDelta(envelope, delta, base, {
    now: PUBLIC_PROPOSAL_NOW,
    expected_scope: envelope.scope,
    prior_recorded_replay_keys: [],
  });
}
