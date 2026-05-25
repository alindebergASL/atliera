import type { WorkshopLens, WorkshopViewModel } from "./view-model.ts";

export type LensUsefulnessStatus = "pass" | "fail";

export type LensUsefulnessReasonCode =
  | "insufficient_useful_lenses"
  | "lens_usefulness_failures_present";

export interface LensUsefulnessThresholds {
  min_useful_lenses: number;
}

export interface LensUsefulnessReason {
  code: LensUsefulnessReasonCode;
  severity: LensUsefulnessStatus;
  message: string;
  observed: number;
  threshold: number;
}

export interface LensUsefulnessMetrics {
  lens_item_counts: Record<WorkshopLens, number>;
  useful_lens_item_counts: Record<WorkshopLens, number>;
  useful_lenses: WorkshopLens[];
  useful_lens_count: number;
}

export interface WorkshopLensUsefulnessReview {
  ok: boolean;
  status: LensUsefulnessStatus;
  launch_readiness_claim: false;
  thresholds: LensUsefulnessThresholds;
  metrics: LensUsefulnessMetrics;
  reasons: LensUsefulnessReason[];
}

export interface NamedWorkshopLensUsefulnessReview extends WorkshopLensUsefulnessReview {
  input: string;
}

export interface LensUsefulnessCorpusMetrics {
  total_accounts: number;
  passing_accounts: number;
  failing_accounts: number;
  useful_account_rate: number | null;
  accounts_with_signals: number;
  accounts_with_maps: number;
  accounts_with_plays: number;
}

export interface WorkshopLensUsefulnessCorpusSummary {
  ok: boolean;
  status: LensUsefulnessStatus;
  launch_readiness_claim: false;
  metrics: LensUsefulnessCorpusMetrics;
  reasons: LensUsefulnessReason[];
  reviews: NamedWorkshopLensUsefulnessReview[];
}

export const DEFAULT_LENS_USEFULNESS_THRESHOLDS: LensUsefulnessThresholds = Object.freeze({
  min_useful_lenses: 2,
});

const LENSES: readonly WorkshopLens[] = ["signals", "maps", "plays"];

function emptyLensCounts(): Record<WorkshopLens, number> {
  return { signals: 0, maps: 0, plays: 0 };
}

function isMateriallyUsefulItem(
  item: WorkshopViewModel["lenses"][WorkshopLens][number],
): boolean {
  return item.trust.provenance_status !== "unsupported" && item.evidence_packets.length > 0;
}

export function evaluateWorkshopLensUsefulness(
  vm: WorkshopViewModel,
  thresholds: LensUsefulnessThresholds = DEFAULT_LENS_USEFULNESS_THRESHOLDS,
): WorkshopLensUsefulnessReview {
  const lensItemCounts = emptyLensCounts();
  const usefulLensItemCounts = emptyLensCounts();

  for (const lens of LENSES) {
    const items = vm.lenses[lens];
    lensItemCounts[lens] = items.length;
    usefulLensItemCounts[lens] = items.filter(isMateriallyUsefulItem).length;
  }

  const usefulLenses = LENSES.filter((lens) => usefulLensItemCounts[lens] > 0);
  const reasons: LensUsefulnessReason[] = [];
  if (usefulLenses.length < thresholds.min_useful_lenses) {
    reasons.push({
      code: "insufficient_useful_lenses",
      severity: "fail",
      message: "fewer than the required number of Workshop lenses are materially useful",
      observed: usefulLenses.length,
      threshold: thresholds.min_useful_lenses,
    });
  }

  return Object.freeze({
    ok: reasons.length === 0,
    status: reasons.length === 0 ? "pass" : "fail",
    launch_readiness_claim: false,
    thresholds: { ...thresholds },
    metrics: {
      lens_item_counts: lensItemCounts,
      useful_lens_item_counts: usefulLensItemCounts,
      useful_lenses: [...usefulLenses],
      useful_lens_count: usefulLenses.length,
    },
    reasons,
  });
}

export function summarizeWorkshopLensUsefulnessReviews(
  reviews: NamedWorkshopLensUsefulnessReview[],
): WorkshopLensUsefulnessCorpusSummary {
  const totalAccounts = reviews.length;
  const passingAccounts = reviews.filter((review) => review.status === "pass").length;
  const failingAccounts = totalAccounts - passingAccounts;
  const metrics: LensUsefulnessCorpusMetrics = {
    total_accounts: totalAccounts,
    passing_accounts: passingAccounts,
    failing_accounts: failingAccounts,
    useful_account_rate: totalAccounts === 0 ? null : passingAccounts / totalAccounts,
    accounts_with_signals: reviews.filter((review) => review.metrics.useful_lenses.includes("signals")).length,
    accounts_with_maps: reviews.filter((review) => review.metrics.useful_lenses.includes("maps")).length,
    accounts_with_plays: reviews.filter((review) => review.metrics.useful_lenses.includes("plays")).length,
  };

  const reasons: LensUsefulnessReason[] = [];
  if (failingAccounts > 0) {
    reasons.push({
      code: "lens_usefulness_failures_present",
      severity: "fail",
      message: "one or more Workshop lens-usefulness reviews failed",
      observed: failingAccounts,
      threshold: 0,
    });
  }

  return Object.freeze({
    ok: reasons.length === 0,
    status: reasons.length === 0 ? "pass" : "fail",
    launch_readiness_claim: false,
    metrics,
    reasons,
    reviews,
  });
}
