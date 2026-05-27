// Deterministic no-spend controlled-corpus weakness diagnosis.
//
// This helper explains why already-produced controlled-corpus facts landed in a
// weak-but-valid or worse usefulness state. It performs no provider calls, no
// network access, no credential reads, no production writes, and no
// runtime/model-mode integration.

import {
  assessControlledCorpusUsefulness,
  type ControlledCorpusAccountRole,
  type ControlledCorpusUsefulnessAccountAssessment,
  type ControlledCorpusUsefulnessAccountInput,
  type ControlledCorpusUsefulnessClassification,
  type ControlledCorpusUsefulnessSummary,
  type ControlledCorpusUsefulnessStatus,
} from "./controlled-corpus-usefulness.ts";

export type ControlledCorpusWeaknessDiagnosisInput = ControlledCorpusUsefulnessAccountInput;

export type ControlledCorpusWeaknessDiagnosisCode =
  | "low_materiality"
  | "low_specificity"
  | "missing_account_objects"
  | "missing_lens_usefulness"
  | "insufficient_evidence_density"
  | "rubric_threshold_gap"
  | "proposal_layer_underproduction"
  | "evidence_policy_gap"
  | "non_weak_blocker";

export type ControlledCorpusWeaknessNextAction =
  | "inspect_rubric"
  | "inspect_prompts"
  | "inspect_proposal_layer"
  | "inspect_evidence_policy";

export interface ControlledCorpusWeaknessAccountDiagnosis {
  account_ref: string;
  role: ControlledCorpusAccountRole;
  classification: ControlledCorpusUsefulnessClassification;
  status: ControlledCorpusUsefulnessStatus;
  diagnosis_codes: readonly ControlledCorpusWeaknessDiagnosisCode[];
  failed_soft_quality_signals: ControlledCorpusUsefulnessAccountAssessment["failed_soft_quality_signals"];
  failed_hard_invariants: ControlledCorpusUsefulnessAccountAssessment["failed_hard_invariants"];
  output_counts: ControlledCorpusUsefulnessAccountAssessment["output_counts"];
}

export interface ControlledCorpusWeaknessDiagnosisMetrics {
  total_accounts: number;
  weak_but_valid_accounts: number;
  non_weak_blocker_accounts: number;
  diagnosis_counts: Record<ControlledCorpusWeaknessDiagnosisCode, number>;
}

export interface ControlledCorpusWeaknessDiagnosisSummary {
  ok: boolean;
  status: ControlledCorpusUsefulnessStatus;
  launch_readiness_claim: false;
  approves_expansion_or_comparison: false;
  overall_classification: ControlledCorpusUsefulnessClassification;
  usefulness_summary: ControlledCorpusUsefulnessSummary;
  metrics: ControlledCorpusWeaknessDiagnosisMetrics;
  next_required_actions: readonly ControlledCorpusWeaknessNextAction[];
  accounts: readonly ControlledCorpusWeaknessAccountDiagnosis[];
  safety: {
    live_provider_call: false;
    provider_spend: false;
    production_writes: false;
    runtime_model_mode_integration: false;
  };
}

const DIAGNOSIS_CODES: readonly ControlledCorpusWeaknessDiagnosisCode[] = [
  "low_materiality",
  "low_specificity",
  "missing_account_objects",
  "missing_lens_usefulness",
  "insufficient_evidence_density",
  "rubric_threshold_gap",
  "proposal_layer_underproduction",
  "evidence_policy_gap",
  "non_weak_blocker",
];

const NEXT_ACTIONS: readonly ControlledCorpusWeaknessNextAction[] = [
  "inspect_rubric",
  "inspect_prompts",
  "inspect_proposal_layer",
  "inspect_evidence_policy",
];

function emptyDiagnosisCounts(): Record<ControlledCorpusWeaknessDiagnosisCode, number> {
  return {
    low_materiality: 0,
    low_specificity: 0,
    missing_account_objects: 0,
    missing_lens_usefulness: 0,
    insufficient_evidence_density: 0,
    rubric_threshold_gap: 0,
    proposal_layer_underproduction: 0,
    evidence_policy_gap: 0,
    non_weak_blocker: 0,
  };
}

function totalOutput(account: ControlledCorpusUsefulnessAccountAssessment): number {
  return account.output_counts.excerpts + account.output_counts.claims + account.output_counts.account_objects;
}

function includesSoftFailure(
  account: ControlledCorpusUsefulnessAccountAssessment,
  signal: ControlledCorpusUsefulnessAccountAssessment["failed_soft_quality_signals"][number],
): boolean {
  return account.failed_soft_quality_signals.includes(signal);
}

function diagnoseAccount(account: ControlledCorpusUsefulnessAccountAssessment): ControlledCorpusWeaknessDiagnosisCode[] {
  const codes: ControlledCorpusWeaknessDiagnosisCode[] = [];

  if (account.classification !== "weak-but-valid") {
    if (account.classification !== "useful") codes.push("non_weak_blocker");
    return codes;
  }

  if (includesSoftFailure(account, "materiality")) {
    codes.push("low_materiality");
  }
  if (includesSoftFailure(account, "specificity")) {
    codes.push("low_specificity");
  }
  if (includesSoftFailure(account, "account_usefulness") || account.output_counts.account_objects === 0) {
    codes.push("missing_account_objects");
  }
  if (includesSoftFailure(account, "lens_usefulness")) {
    codes.push("missing_lens_usefulness");
  }
  if (totalOutput(account) < 3 || account.output_counts.excerpts === 0 || account.output_counts.claims === 0) {
    codes.push("insufficient_evidence_density");
  }
  if (includesSoftFailure(account, "materiality") || includesSoftFailure(account, "specificity")) {
    codes.push("rubric_threshold_gap");
  }
  if (
    includesSoftFailure(account, "account_usefulness") ||
    includesSoftFailure(account, "lens_usefulness") ||
    account.output_counts.account_objects === 0
  ) {
    codes.push("proposal_layer_underproduction");
  }
  if (includesSoftFailure(account, "source_fit")) {
    codes.push("evidence_policy_gap");
  }

  return codes;
}

function uniqueActionsForCounts(
  counts: Record<ControlledCorpusWeaknessDiagnosisCode, number>,
): ControlledCorpusWeaknessNextAction[] {
  const actions: ControlledCorpusWeaknessNextAction[] = [];
  if (counts.low_materiality > 0 || counts.low_specificity > 0 || counts.rubric_threshold_gap > 0) {
    actions.push("inspect_rubric");
  }
  if (counts.low_specificity > 0 || counts.low_materiality > 0) {
    actions.push("inspect_prompts");
  }
  if (counts.missing_account_objects > 0 || counts.missing_lens_usefulness > 0 || counts.proposal_layer_underproduction > 0) {
    actions.push("inspect_proposal_layer");
  }
  if (counts.evidence_policy_gap > 0 || counts.insufficient_evidence_density > 0) {
    actions.push("inspect_evidence_policy");
  }
  return actions.length === 0 && counts.non_weak_blocker > 0 ? [...NEXT_ACTIONS] : actions;
}

export function diagnoseControlledCorpusWeakness(
  inputs: ControlledCorpusWeaknessDiagnosisInput[],
): ControlledCorpusWeaknessDiagnosisSummary {
  const usefulnessSummary = assessControlledCorpusUsefulness(inputs);
  const diagnosisCounts = emptyDiagnosisCounts();
  const accounts: ControlledCorpusWeaknessAccountDiagnosis[] = [];

  for (const account of usefulnessSummary.accounts) {
    const diagnosisCodes = diagnoseAccount(account);
    for (const code of diagnosisCodes) {
      diagnosisCounts[code] += 1;
    }
    accounts.push(Object.freeze({
      account_ref: account.account_ref,
      role: account.role,
      classification: account.classification,
      status: account.status,
      diagnosis_codes: Object.freeze([...diagnosisCodes]),
      failed_soft_quality_signals: Object.freeze([...account.failed_soft_quality_signals]),
      failed_hard_invariants: Object.freeze([...account.failed_hard_invariants]),
      output_counts: Object.freeze({ ...account.output_counts }),
    }));
  }

  let weakButValidAccounts = 0;
  let nonWeakBlockerAccounts = 0;
  for (const account of accounts) {
    if (account.classification === "weak-but-valid") weakButValidAccounts += 1;
    if (account.diagnosis_codes.includes("non_weak_blocker")) nonWeakBlockerAccounts += 1;
  }

  for (const code of DIAGNOSIS_CODES) {
    if (!Number.isInteger(diagnosisCounts[code])) {
      throw new Error("controlled corpus weakness diagnosis count rejected");
    }
  }

  return Object.freeze({
    ok: usefulnessSummary.overall_classification === "useful",
    status: usefulnessSummary.overall_classification === "useful" ? "pass" : "fail",
    launch_readiness_claim: false,
    approves_expansion_or_comparison: false,
    overall_classification: usefulnessSummary.overall_classification,
    usefulness_summary: usefulnessSummary,
    metrics: Object.freeze({
      total_accounts: accounts.length,
      weak_but_valid_accounts: weakButValidAccounts,
      non_weak_blocker_accounts: nonWeakBlockerAccounts,
      diagnosis_counts: Object.freeze({ ...diagnosisCounts }),
    }),
    next_required_actions: Object.freeze(uniqueActionsForCounts(diagnosisCounts)),
    accounts: Object.freeze([...accounts]),
    safety: Object.freeze({
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
    }),
  });
}
