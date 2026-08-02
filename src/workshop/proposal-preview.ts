import type { ProposalMaterializationBoundaries, ProposalMaterializationTrustLanguage } from "../validation/proposal-materialization.ts";
import { hydrateCandidateTransition } from "../graph/candidate-delta.ts";
import { renderWorkshopHtml } from "./render-html.ts";
import { buildWorkshopViewModel, WORKSHOP_REVIEW_STATE_MODEL_PROPOSED, type WorkshopLens, type WorkshopViewModel } from "./view-model.ts";

export const WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME =
  "workshop-public-curated-proposal-preview" as const;

export const WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_SCHEMA_VERSION =
  "atliera.workshop_public_curated_proposal_preview.v1" as const;

export interface WorkshopPublicCuratedProposalPreviewReport {
  readonly schema_version: typeof WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_SCHEMA_VERSION;
  readonly artifact_name: typeof WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME;
  readonly generated_from: "proposal_materialization_public_curated_fixture";
  readonly current_effective_authorization: "none";
  readonly input_origin: "hand-curated-public";
  readonly proposal_set_id: string;
  readonly account_id: string;
  readonly boundaries: ProposalMaterializationBoundaries;
  readonly trust_language: ProposalMaterializationTrustLanguage;
  readonly preview_mode: "validation";
  readonly html_rendered: true;
  readonly html_length: number;
  readonly lens_item_counts: Record<WorkshopLens, number>;
  readonly review_decorated_item_count: number;
  readonly verified_object_count: 0;
  readonly provider_calls_made: 0;
  readonly private_evidence_read: false;
  readonly graph_ingestion_performed: false;
  readonly durable_writes_performed: false;
  readonly production_writes: false;
  readonly readiness_claim: false;
}

export interface WorkshopPublicCuratedProposalPreview {
  readonly kind: "workshop-public-curated-proposal-preview";
  readonly report: WorkshopPublicCuratedProposalPreviewReport;
  readonly view_model: WorkshopViewModel;
  readonly html: string;
}

function lensItemCounts(viewModel: WorkshopViewModel): Record<WorkshopLens, number> {
  return {
    signals: viewModel.lenses.signals.length,
    maps: viewModel.lenses.maps.length,
    plays: viewModel.lenses.plays.length,
  };
}

function reviewDecoratedItemCount(viewModel: WorkshopViewModel): number {
  let count = 0;
  for (const lens of ["signals", "maps", "plays"] as const) {
    for (const item of viewModel.lenses[lens]) {
      if (item.review_state === WORKSHOP_REVIEW_STATE_MODEL_PROPOSED) count += 1;
    }
  }
  return count;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

export function buildWorkshopPublicCuratedProposalPreview(
  transitionInput: unknown,
  now: string,
): WorkshopPublicCuratedProposalPreview {
  // This active boundary accepts successful, replay-consumed canonical
  // candidate-transition evidence only. Raw legacy materialization input is
  // not presentation authority, even for this visibly untrusted preview.
  const transition = hydrateCandidateTransition(transitionInput, now);
  if (transition.producer.kind !== "fixture" || transition.fixture_binding === null) {
    throw new Error("public curated proposal preview requires an exact fixture-bound transition");
  }
  const viewModel = buildWorkshopViewModel(transition.candidate);
  const html = renderWorkshopHtml(viewModel, { previewMode: "validation" });
  const decorated = reviewDecoratedItemCount(viewModel);

  if (viewModel.totals.verified_objects !== 0) {
    throw new Error("public curated proposal preview must not render proposal-derived objects as verified");
  }
  if (decorated !== transition.delta.records.account_objects.length) {
    throw new Error("public curated proposal preview must decorate every accepted proposal-derived account object");
  }

  const frozenViewModel = deepFreeze(viewModel);
  const boundaries: ProposalMaterializationBoundaries = Object.freeze({
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
  const trustLanguage: ProposalMaterializationTrustLanguage = Object.freeze({
    provenance_status: "unverified",
    excerpt_validation_status: "proposed",
    review_state: WORKSHOP_REVIEW_STATE_MODEL_PROPOSED,
    adds_new_truth_status_tier: false,
    confidence_cap: "medium",
  });

  return Object.freeze({
    kind: WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME,
    report: Object.freeze({
      schema_version: WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_SCHEMA_VERSION,
      artifact_name: WORKSHOP_PUBLIC_CURATED_PROPOSAL_PREVIEW_NAME,
      generated_from: "proposal_materialization_public_curated_fixture",
      current_effective_authorization: "none",
      input_origin: "hand-curated-public",
      proposal_set_id: transition.producer.trace_id,
      account_id: transition.scope.account_id,
      boundaries,
      trust_language: trustLanguage,
      preview_mode: "validation",
      html_rendered: true,
      html_length: html.length,
      lens_item_counts: lensItemCounts(viewModel),
      review_decorated_item_count: decorated,
      verified_object_count: 0,
      provider_calls_made: 0,
      private_evidence_read: false,
      graph_ingestion_performed: false,
      durable_writes_performed: false,
      production_writes: false,
      readiness_claim: false,
    }),
    view_model: frozenViewModel,
    html,
  });
}
