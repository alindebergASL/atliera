// Deterministic no-spend remediation planning for controlled-corpus weakness.
//
// This helper converts an already-produced controlled-corpus weakness diagnosis
// into a bounded remediation plan. It does not call providers, spend budget,
// read credentials/env, write files, approve reruns/comparisons, or make any
// readiness claim.

import {
  type ControlledCorpusWeaknessDiagnosisCode,
  type ControlledCorpusWeaknessDiagnosisSummary,
} from "./controlled-corpus-weakness-diagnosis.ts";

export type ControlledCorpusRemediationArea =
  | "prompt_contract"
  | "proposal_schema"
  | "evidence_policy"
  | "rubric_thresholds"
  | "fixture_coverage"
  | "substrate_contract";

export type ControlledCorpusRemediationAllowedAction =
  | "no_spend_prompt_contract_revision"
  | "proposal_schema_revision"
  | "rubric_clarification"
  | "evidence_policy_clarification"
  | "deterministic_fixture_update"
  | "fix_hard_substrate_or_contract_blocker";

export type ControlledCorpusRemediationBlockedAction =
  | "live_provider_rerun"
  | "provider_comparison"
  | "corpus_expansion"
  | "launch_readiness_claim"
  | "product_readiness_claim";

export type ControlledCorpusRemediationStatus =
  | "no-remediation-needed"
  | "needs-remediation"
  | "blocked-by-non-weak-failure";

export interface ControlledCorpusRemediationRuleTrigger {
  diagnosis_code: ControlledCorpusWeaknessDiagnosisCode;
  count: number;
  remediation_areas: readonly ControlledCorpusRemediationArea[];
  allowed_next_actions: readonly ControlledCorpusRemediationAllowedAction[];
}

export interface ControlledCorpusRemediationPlan {
  ok: boolean;
  status: ControlledCorpusRemediationStatus;
  launch_readiness_claim: false;
  approves_live_provider_call: false;
  approves_provider_spend: false;
  approves_expansion_or_comparison: false;
  source_overall_classification: ControlledCorpusWeaknessDiagnosisSummary["overall_classification"];
  remediation_areas: readonly ControlledCorpusRemediationArea[];
  allowed_next_actions: readonly ControlledCorpusRemediationAllowedAction[];
  blocked_next_actions: readonly ControlledCorpusRemediationBlockedAction[];
  rules_triggered: readonly ControlledCorpusRemediationRuleTrigger[];
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

const REMEDIATION_AREA_ORDER: readonly ControlledCorpusRemediationArea[] = [
  "prompt_contract",
  "proposal_schema",
  "evidence_policy",
  "rubric_thresholds",
  "fixture_coverage",
  "substrate_contract",
];

const ALLOWED_ACTION_ORDER: readonly ControlledCorpusRemediationAllowedAction[] = [
  "no_spend_prompt_contract_revision",
  "proposal_schema_revision",
  "rubric_clarification",
  "evidence_policy_clarification",
  "deterministic_fixture_update",
  "fix_hard_substrate_or_contract_blocker",
];

const BLOCKED_NEXT_ACTIONS: readonly ControlledCorpusRemediationBlockedAction[] = [
  "live_provider_rerun",
  "provider_comparison",
  "corpus_expansion",
  "launch_readiness_claim",
  "product_readiness_claim",
];

const RULES = {
  low_materiality: {
    remediation_areas: ["prompt_contract", "rubric_thresholds"],
    allowed_next_actions: ["no_spend_prompt_contract_revision", "rubric_clarification"],
  },
  low_specificity: {
    remediation_areas: ["prompt_contract", "rubric_thresholds"],
    allowed_next_actions: ["no_spend_prompt_contract_revision", "rubric_clarification"],
  },
  missing_account_objects: {
    remediation_areas: ["prompt_contract", "proposal_schema"],
    allowed_next_actions: ["no_spend_prompt_contract_revision", "proposal_schema_revision"],
  },
  missing_lens_usefulness: {
    remediation_areas: ["proposal_schema"],
    allowed_next_actions: ["proposal_schema_revision"],
  },
  insufficient_evidence_density: {
    remediation_areas: ["prompt_contract", "evidence_policy", "fixture_coverage"],
    allowed_next_actions: [
      "no_spend_prompt_contract_revision",
      "evidence_policy_clarification",
      "deterministic_fixture_update",
    ],
  },
  rubric_threshold_gap: {
    remediation_areas: ["rubric_thresholds"],
    allowed_next_actions: ["rubric_clarification"],
  },
  proposal_layer_underproduction: {
    remediation_areas: ["proposal_schema"],
    allowed_next_actions: ["proposal_schema_revision"],
  },
  evidence_policy_gap: {
    remediation_areas: ["evidence_policy", "rubric_thresholds"],
    allowed_next_actions: ["evidence_policy_clarification", "rubric_clarification"],
  },
  non_weak_blocker: {
    remediation_areas: ["substrate_contract"],
    allowed_next_actions: ["fix_hard_substrate_or_contract_blocker"],
  },
} as const satisfies Readonly<Record<ControlledCorpusWeaknessDiagnosisCode, {
  remediation_areas: readonly ControlledCorpusRemediationArea[];
  allowed_next_actions: readonly ControlledCorpusRemediationAllowedAction[];
}>>;

function rejectDiagnosis(): never {
  throw new Error("controlled corpus remediation diagnosis rejected");
}

function asRecord(value: unknown): Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) rejectDiagnosis();
  } catch {
    rejectDiagnosis();
  }
  return value as Record<string, unknown>;
}

function readProperty(container: Record<string, unknown>, key: string): unknown {
  try {
    return container[key];
  } catch {
    rejectDiagnosis();
  }
}

function readBoolean(container: Record<string, unknown>, key: string): boolean {
  const value = readProperty(container, key);
  if (typeof value !== "boolean") rejectDiagnosis();
  return value;
}

function readString(container: Record<string, unknown>, key: string): string {
  const value = readProperty(container, key);
  if (typeof value !== "string") rejectDiagnosis();
  return value;
}

function readBooleanFalse(container: Record<string, unknown>, key: string): false {
  const value = readProperty(container, key);
  if (value !== false) rejectDiagnosis();
  return false;
}

function readNonNegativeInteger(container: Record<string, unknown>, key: string): number {
  const value = readProperty(container, key);
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0) rejectDiagnosis();
  return value;
}

function readClassification(value: unknown): ControlledCorpusWeaknessDiagnosisSummary["overall_classification"] {
  if (
    value !== "useful" &&
    value !== "weak-but-valid" &&
    value !== "zero-output" &&
    value !== "unsupported/invented" &&
    value !== "contract failure"
  ) {
    rejectDiagnosis();
  }
  return value;
}

function readStatusValue(value: unknown): "pass" | "fail" {
  if (value !== "pass" && value !== "fail") rejectDiagnosis();
  return value;
}

function readArray(value: unknown, minLength: number, maxLength: number): unknown[] {
  try {
    if (!Array.isArray(value)) rejectDiagnosis();
  } catch {
    rejectDiagnosis();
  }
  let length: number;
  try {
    length = value.length;
  } catch {
    rejectDiagnosis();
  }
  if (!Number.isInteger(length) || length < minLength || length > maxLength) rejectDiagnosis();
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    try {
      snapshot.push(value[index]);
    } catch {
      rejectDiagnosis();
    }
  }
  return snapshot;
}

function classificationRank(classification: ControlledCorpusWeaknessDiagnosisSummary["overall_classification"]): number {
  switch (classification) {
    case "useful":
      return 0;
    case "weak-but-valid":
      return 1;
    case "zero-output":
      return 2;
    case "unsupported/invented":
      return 3;
    case "contract failure":
      return 4;
  }
}

function expectedNextActionsForCounts(counts: Record<ControlledCorpusWeaknessDiagnosisCode, number>): string[] {
  const actions: string[] = [];
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
  return actions.length === 0 && counts.non_weak_blocker > 0
    ? ["inspect_rubric", "inspect_prompts", "inspect_proposal_layer", "inspect_evidence_policy"]
    : actions;
}

function readDiagnosisCodeArray(value: unknown): ControlledCorpusWeaknessDiagnosisCode[] {
  const items = readArray(value, 0, DIAGNOSIS_CODES.length);
  const codes: ControlledCorpusWeaknessDiagnosisCode[] = [];
  const seen = new Set<ControlledCorpusWeaknessDiagnosisCode>();
  for (const item of items) {
    if (!DIAGNOSIS_CODES.includes(item as ControlledCorpusWeaknessDiagnosisCode)) rejectDiagnosis();
    const code = item as ControlledCorpusWeaknessDiagnosisCode;
    if (seen.has(code)) rejectDiagnosis();
    seen.add(code);
    codes.push(code);
  }
  return codes;
}

function readNextActionArray(value: unknown): string[] {
  const allowed = new Set(["inspect_rubric", "inspect_prompts", "inspect_proposal_layer", "inspect_evidence_policy"]);
  const items = readArray(value, 0, 4);
  const actions: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) rejectDiagnosis();
    seen.add(item);
    actions.push(item);
  }
  return actions;
}

function snapshotDiagnosisCounts(value: unknown): Record<ControlledCorpusWeaknessDiagnosisCode, number> {
  const record = asRecord(value);
  const counts = {} as Record<ControlledCorpusWeaknessDiagnosisCode, number>;
  for (const code of DIAGNOSIS_CODES) {
    counts[code] = readNonNegativeInteger(record, code);
  }
  return counts;
}

function readStringArray(value: unknown, maxLength: number): string[] {
  const items = readArray(value, 0, maxLength);
  const strings: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") rejectDiagnosis();
    strings.push(item);
  }
  return strings;
}

function readOutputCounts(value: unknown): { excerpts: number; claims: number; account_objects: number } {
  const counts = asRecord(value);
  return {
    excerpts: readNonNegativeInteger(counts, "excerpts"),
    claims: readNonNegativeInteger(counts, "claims"),
    account_objects: readNonNegativeInteger(counts, "account_objects"),
  };
}

function readRole(value: unknown): "representative" | "edge-case" | "calibration" {
  if (value !== "representative" && value !== "edge-case" && value !== "calibration") rejectDiagnosis();
  return value;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameOutputCounts(
  left: { excerpts: number; claims: number; account_objects: number },
  right: { excerpts: number; claims: number; account_objects: number },
): boolean {
  return left.excerpts === right.excerpts && left.claims === right.claims && left.account_objects === right.account_objects;
}

const SAFE_ACCOUNT_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function assertSafeAccountRef(accountRef: string): void {
  if (
    !SAFE_ACCOUNT_REF.test(accountRef) ||
    accountRef.includes("..") ||
    accountRef.includes("://") ||
    accountRef.includes("/") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(accountRef)
  ) {
    rejectDiagnosis();
  }
}

const HARD_INVARIANT_FAILURES = ["no_invented_ids", "provenance_required", "graph_validates", "no_private_leakage"] as const;
const SOFT_QUALITY_FAILURES = ["materiality", "specificity", "account_usefulness", "lens_usefulness", "source_fit"] as const;

function readAllowedStringArray(value: unknown, allowedValues: readonly string[]): string[] {
  const values = readStringArray(value, allowedValues.length);
  const allowed = new Set(allowedValues);
  const seen = new Set<string>();
  for (const item of values) {
    if (!allowed.has(item) || seen.has(item)) rejectDiagnosis();
    seen.add(item);
  }
  return values;
}

function deriveClassificationFromAccountFacts(
  outputCounts: { excerpts: number; claims: number; account_objects: number },
  failedHardInvariants: readonly string[],
  failedSoftQualitySignals: readonly string[],
): ControlledCorpusWeaknessDiagnosisSummary["overall_classification"] {
  if (failedHardInvariants.includes("graph_validates") || failedHardInvariants.includes("no_private_leakage")) {
    return "contract failure";
  }
  if (failedHardInvariants.includes("no_invented_ids") || failedHardInvariants.includes("provenance_required")) {
    return "unsupported/invented";
  }
  if (outputCounts.excerpts + outputCounts.claims + outputCounts.account_objects === 0) return "zero-output";
  if (failedSoftQualitySignals.length > 0) return "weak-but-valid";
  return "useful";
}

function deriveDiagnosisCodesFromAccountFacts(
  classification: ControlledCorpusWeaknessDiagnosisSummary["overall_classification"],
  outputCounts: { excerpts: number; claims: number; account_objects: number },
  failedSoftQualitySignals: readonly string[],
): ControlledCorpusWeaknessDiagnosisCode[] {
  const codes: ControlledCorpusWeaknessDiagnosisCode[] = [];
  if (classification !== "weak-but-valid") {
    if (classification !== "useful") codes.push("non_weak_blocker");
    return codes;
  }
  if (failedSoftQualitySignals.includes("materiality")) codes.push("low_materiality");
  if (failedSoftQualitySignals.includes("specificity")) codes.push("low_specificity");
  if (failedSoftQualitySignals.includes("account_usefulness") || outputCounts.account_objects === 0) codes.push("missing_account_objects");
  if (failedSoftQualitySignals.includes("lens_usefulness")) codes.push("missing_lens_usefulness");
  if (outputCounts.excerpts + outputCounts.claims + outputCounts.account_objects < 3 || outputCounts.excerpts === 0 || outputCounts.claims === 0) {
    codes.push("insufficient_evidence_density");
  }
  if (failedSoftQualitySignals.includes("materiality") || failedSoftQualitySignals.includes("specificity")) codes.push("rubric_threshold_gap");
  if (failedSoftQualitySignals.includes("account_usefulness") || failedSoftQualitySignals.includes("lens_usefulness") || outputCounts.account_objects === 0) {
    codes.push("proposal_layer_underproduction");
  }
  if (failedSoftQualitySignals.includes("source_fit")) codes.push("evidence_policy_gap");
  return codes;
}

function snapshotAccountConsistency(value: unknown): {
  account_ref: string;
  role: "representative" | "edge-case" | "calibration";
  classification: ControlledCorpusWeaknessDiagnosisSummary["overall_classification"];
  status: "pass" | "fail";
  diagnosis_codes: readonly ControlledCorpusWeaknessDiagnosisCode[];
  output_counts: { excerpts: number; claims: number; account_objects: number };
  failed_hard_invariants: readonly string[];
  failed_soft_quality_signals: readonly string[];
} {
  const account = asRecord(value);
  const accountRef = readString(account, "account_ref");
  assertSafeAccountRef(accountRef);
  const role = readRole(readProperty(account, "role"));
  const classification = readClassification(readProperty(account, "classification"));
  const status = readStatusValue(readProperty(account, "status"));
  const diagnosisCodes = readDiagnosisCodeArray(readProperty(account, "diagnosis_codes"));
  const outputCounts = readOutputCounts(readProperty(account, "output_counts"));
  const failedHardInvariants = readAllowedStringArray(readProperty(account, "failed_hard_invariants"), HARD_INVARIANT_FAILURES);
  const failedSoftQualitySignals = readAllowedStringArray(readProperty(account, "failed_soft_quality_signals"), SOFT_QUALITY_FAILURES);
  const expectedClassification = deriveClassificationFromAccountFacts(outputCounts, failedHardInvariants, failedSoftQualitySignals);
  if (classification !== expectedClassification) rejectDiagnosis();
  const expectedDiagnosisCodes = deriveDiagnosisCodesFromAccountFacts(classification, outputCounts, failedSoftQualitySignals);
  if (!sameStringArray(diagnosisCodes, expectedDiagnosisCodes)) rejectDiagnosis();
  const expectedOk = classification === "useful";
  if (status !== (expectedOk ? "pass" : "fail")) rejectDiagnosis();
  if (classification === "useful" && diagnosisCodes.length !== 0) rejectDiagnosis();
  if (classification === "weak-but-valid") {
    if (diagnosisCodes.length === 0 || diagnosisCodes.includes("non_weak_blocker")) rejectDiagnosis();
  }
  if (
    (classification === "zero-output" || classification === "unsupported/invented" || classification === "contract failure") &&
    !diagnosisCodes.includes("non_weak_blocker")
  ) {
    rejectDiagnosis();
  }
  return {
    account_ref: accountRef,
    role,
    classification,
    status,
    diagnosis_codes: diagnosisCodes,
    output_counts: outputCounts,
    failed_hard_invariants: failedHardInvariants,
    failed_soft_quality_signals: failedSoftQualitySignals,
  };
}

function assertUsefulnessSummaryConsistent(
  value: unknown,
  classification: ControlledCorpusWeaknessDiagnosisSummary["overall_classification"],
  ok: boolean,
  status: "pass" | "fail",
  totalAccounts: number,
  weakButValidAccounts: number,
  nonWeakBlockerAccounts: number,
  expectedAccounts: readonly ReturnType<typeof snapshotAccountConsistency>[],
): void {
  const summary = asRecord(value);
  if (readBoolean(summary, "ok") !== ok) rejectDiagnosis();
  if (readStatusValue(readProperty(summary, "status")) !== status) rejectDiagnosis();
  readBooleanFalse(summary, "launch_readiness_claim");
  const summarySafety = asRecord(readProperty(summary, "safety"));
  readBooleanFalse(summarySafety, "live_provider_call");
  readBooleanFalse(summarySafety, "provider_spend");
  readBooleanFalse(summarySafety, "production_writes");
  readBooleanFalse(summarySafety, "runtime_model_mode_integration");
  if (readClassification(readProperty(summary, "overall_classification")) !== classification) rejectDiagnosis();
  const metrics = asRecord(readProperty(summary, "metrics"));
  if (readNonNegativeInteger(metrics, "total_accounts") !== totalAccounts) rejectDiagnosis();
  const usefulAccounts = readNonNegativeInteger(metrics, "useful_accounts");
  if (readNonNegativeInteger(metrics, "weak_but_valid_accounts") !== weakButValidAccounts) rejectDiagnosis();
  const zeroOutputAccounts = readNonNegativeInteger(metrics, "zero_output_accounts");
  const unsupportedAccounts = readNonNegativeInteger(metrics, "unsupported_or_invented_accounts");
  const contractFailureAccounts = readNonNegativeInteger(metrics, "contract_failure_accounts");
  if (usefulAccounts + weakButValidAccounts + zeroOutputAccounts + unsupportedAccounts + contractFailureAccounts !== totalAccounts) {
    rejectDiagnosis();
  }
  if (zeroOutputAccounts + unsupportedAccounts + contractFailureAccounts !== nonWeakBlockerAccounts) rejectDiagnosis();

  const classificationCounts = asRecord(readProperty(metrics, "classification_counts"));
  const expectedMetricCounts: Record<ControlledCorpusWeaknessDiagnosisSummary["overall_classification"], number> = {
    useful: usefulAccounts,
    "weak-but-valid": weakButValidAccounts,
    "zero-output": zeroOutputAccounts,
    "unsupported/invented": unsupportedAccounts,
    "contract failure": contractFailureAccounts,
  };
  for (const expectedClassification of [
    "useful",
    "weak-but-valid",
    "zero-output",
    "unsupported/invented",
    "contract failure",
  ] as const) {
    if (readNonNegativeInteger(classificationCounts, expectedClassification) !== expectedMetricCounts[expectedClassification]) {
      rejectDiagnosis();
    }
  }

  const accounts = readArray(readProperty(summary, "accounts"), totalAccounts, totalAccounts);
  const roleCounts: Record<"representative" | "edge-case" | "calibration", number> = {
    representative: 0,
    "edge-case": 0,
    calibration: 0,
  };
  const accountClassificationCounts: Record<ControlledCorpusWeaknessDiagnosisSummary["overall_classification"], number> = {
    useful: 0,
    "weak-but-valid": 0,
    "zero-output": 0,
    "unsupported/invented": 0,
    "contract failure": 0,
  };
  let worstClassification: ControlledCorpusWeaknessDiagnosisSummary["overall_classification"] = "useful";
  for (let index = 0; index < accounts.length; index += 1) {
    const expectedAccount = expectedAccounts[index];
    if (expectedAccount === undefined) rejectDiagnosis();
    const account = asRecord(accounts[index]);
    const accountRef = readString(account, "account_ref");
    const accountRole = readRole(readProperty(account, "role"));
    const accountClassification = readClassification(readProperty(account, "classification"));
    const accountStatus = readStatusValue(readProperty(account, "status"));
    const outputCounts = readOutputCounts(readProperty(account, "output_counts"));
    const failedHardInvariants = readAllowedStringArray(readProperty(account, "failed_hard_invariants"), HARD_INVARIANT_FAILURES);
    const failedSoftQualitySignals = readAllowedStringArray(readProperty(account, "failed_soft_quality_signals"), SOFT_QUALITY_FAILURES);
    const expectedClassificationFromFacts = deriveClassificationFromAccountFacts(outputCounts, failedHardInvariants, failedSoftQualitySignals);
    if (accountClassification !== expectedClassificationFromFacts) rejectDiagnosis();
    if (accountRef !== expectedAccount.account_ref) rejectDiagnosis();
    if (accountRole !== expectedAccount.role) rejectDiagnosis();
    if (accountClassification !== expectedAccount.classification) rejectDiagnosis();
    if (accountStatus !== expectedAccount.status) rejectDiagnosis();
    if (!sameOutputCounts(outputCounts, expectedAccount.output_counts)) rejectDiagnosis();
    if (!sameStringArray(failedHardInvariants, expectedAccount.failed_hard_invariants)) rejectDiagnosis();
    if (!sameStringArray(failedSoftQualitySignals, expectedAccount.failed_soft_quality_signals)) rejectDiagnosis();
    roleCounts[accountRole] += 1;
    if (accountStatus !== (accountClassification === "useful" ? "pass" : "fail")) rejectDiagnosis();
    accountClassificationCounts[accountClassification] += 1;
    if (classificationRank(accountClassification) > classificationRank(worstClassification)) {
      worstClassification = accountClassification;
    }
  }
  if (worstClassification !== classification) rejectDiagnosis();
  const metricRoles = asRecord(readProperty(metrics, "roles"));
  for (const role of ["representative", "edge-case", "calibration"] as const) {
    if (readNonNegativeInteger(metricRoles, role) !== roleCounts[role]) rejectDiagnosis();
  }
  for (const expectedClassification of [
    "useful",
    "weak-but-valid",
    "zero-output",
    "unsupported/invented",
    "contract failure",
  ] as const) {
    if (accountClassificationCounts[expectedClassification] !== expectedMetricCounts[expectedClassification]) rejectDiagnosis();
  }
}

function snapshotDiagnosis(diagnosis: ControlledCorpusWeaknessDiagnosisSummary): {
  overall_classification: ControlledCorpusWeaknessDiagnosisSummary["overall_classification"];
  counts: Record<ControlledCorpusWeaknessDiagnosisCode, number>;
  non_weak_blocker_accounts: number;
} {
  const root = asRecord(diagnosis);
  const ok = readBoolean(root, "ok");
  const status = readString(root, "status");
  readBooleanFalse(root, "launch_readiness_claim");
  readBooleanFalse(root, "approves_expansion_or_comparison");

  const safety = asRecord(readProperty(root, "safety"));
  readBooleanFalse(safety, "live_provider_call");
  readBooleanFalse(safety, "provider_spend");
  readBooleanFalse(safety, "production_writes");
  readBooleanFalse(safety, "runtime_model_mode_integration");

  const metrics = asRecord(readProperty(root, "metrics"));
  const totalAccounts = readNonNegativeInteger(metrics, "total_accounts");
  const weakButValidAccounts = readNonNegativeInteger(metrics, "weak_but_valid_accounts");
  const nonWeakBlockerAccounts = readNonNegativeInteger(metrics, "non_weak_blocker_accounts");
  const counts = snapshotDiagnosisCounts(readProperty(metrics, "diagnosis_counts"));

  const classification = readClassification(readProperty(root, "overall_classification"));

  const expectedOk = classification === "useful";
  if (ok !== expectedOk) rejectDiagnosis();
  if (status !== (expectedOk ? "pass" : "fail")) rejectDiagnosis();
  if (totalAccounts < 3 || totalAccounts > 5) rejectDiagnosis();
  if (weakButValidAccounts + nonWeakBlockerAccounts > totalAccounts) rejectDiagnosis();
  if (counts.non_weak_blocker !== nonWeakBlockerAccounts) rejectDiagnosis();

  let weakDiagnosisCount = 0;
  let totalDiagnosisCount = 0;
  for (const code of DIAGNOSIS_CODES) {
    totalDiagnosisCount += counts[code];
    if (code !== "non_weak_blocker") weakDiagnosisCount += counts[code];
  }

  const accountItems = readArray(readProperty(root, "accounts"), totalAccounts, totalAccounts);
  const countsFromAccounts = Object.fromEntries(DIAGNOSIS_CODES.map((code) => [code, 0])) as Record<
    ControlledCorpusWeaknessDiagnosisCode,
    number
  >;
  const accountSnapshots: ReturnType<typeof snapshotAccountConsistency>[] = [];
  const accountRefs = new Set<string>();
  const roleCounts: Record<"representative" | "edge-case" | "calibration", number> = {
    representative: 0,
    "edge-case": 0,
    calibration: 0,
  };
  let weakAccountsFromAccounts = 0;
  let nonWeakAccountsFromAccounts = 0;
  for (const item of accountItems) {
    const account = snapshotAccountConsistency(item);
    if (accountRefs.has(account.account_ref)) rejectDiagnosis();
    accountRefs.add(account.account_ref);
    roleCounts[account.role] += 1;
    accountSnapshots.push(account);
    if (account.classification === "weak-but-valid") weakAccountsFromAccounts += 1;
    if (account.diagnosis_codes.includes("non_weak_blocker")) nonWeakAccountsFromAccounts += 1;
    for (const code of account.diagnosis_codes) countsFromAccounts[code] += 1;
  }
  if (roleCounts.representative < 1 || roleCounts["edge-case"] < 1 || roleCounts.calibration < 1) rejectDiagnosis();
  if (weakAccountsFromAccounts !== weakButValidAccounts) rejectDiagnosis();
  if (nonWeakAccountsFromAccounts !== nonWeakBlockerAccounts) rejectDiagnosis();
  for (const code of DIAGNOSIS_CODES) {
    if (countsFromAccounts[code] !== counts[code]) rejectDiagnosis();
  }

  assertUsefulnessSummaryConsistent(
    readProperty(root, "usefulness_summary"),
    classification,
    ok,
    status,
    totalAccounts,
    weakButValidAccounts,
    nonWeakBlockerAccounts,
    accountSnapshots,
  );
  const actualNextActions = readNextActionArray(readProperty(root, "next_required_actions"));
  const expectedNextActions = expectedNextActionsForCounts(counts);
  if (actualNextActions.length !== expectedNextActions.length) rejectDiagnosis();
  for (let index = 0; index < expectedNextActions.length; index += 1) {
    if (actualNextActions[index] !== expectedNextActions[index]) rejectDiagnosis();
  }

  if (classification === "useful") {
    if (weakButValidAccounts !== 0 || nonWeakBlockerAccounts !== 0 || totalDiagnosisCount !== 0) rejectDiagnosis();
  } else if (classification === "weak-but-valid") {
    if (weakButValidAccounts === 0 || nonWeakBlockerAccounts !== 0 || weakDiagnosisCount === 0) rejectDiagnosis();
  } else if (nonWeakBlockerAccounts === 0) {
    rejectDiagnosis();
  }

  return {
    overall_classification: classification,
    counts,
    non_weak_blocker_accounts: nonWeakBlockerAccounts,
  };
}

function orderAreas(values: ReadonlySet<ControlledCorpusRemediationArea>): ControlledCorpusRemediationArea[] {
  const ordered: ControlledCorpusRemediationArea[] = [];
  for (const area of REMEDIATION_AREA_ORDER) {
    if (values.has(area)) ordered.push(area);
  }
  return ordered;
}

function orderActions(values: ReadonlySet<ControlledCorpusRemediationAllowedAction>): ControlledCorpusRemediationAllowedAction[] {
  const ordered: ControlledCorpusRemediationAllowedAction[] = [];
  for (const action of ALLOWED_ACTION_ORDER) {
    if (values.has(action)) ordered.push(action);
  }
  return ordered;
}

function buildTrigger(code: ControlledCorpusWeaknessDiagnosisCode, count: number): ControlledCorpusRemediationRuleTrigger {
  const rule = RULES[code];
  return Object.freeze({
    diagnosis_code: code,
    count,
    remediation_areas: Object.freeze([...rule.remediation_areas]),
    allowed_next_actions: Object.freeze([...rule.allowed_next_actions]),
  });
}

export function planControlledCorpusWeaknessRemediation(
  diagnosis: ControlledCorpusWeaknessDiagnosisSummary,
): ControlledCorpusRemediationPlan {
  const snapshot = snapshotDiagnosis(diagnosis);
  const areaSet = new Set<ControlledCorpusRemediationArea>();
  const actionSet = new Set<ControlledCorpusRemediationAllowedAction>();
  const triggers: ControlledCorpusRemediationRuleTrigger[] = [];

  if (snapshot.counts.non_weak_blocker > 0 || snapshot.non_weak_blocker_accounts > 0) {
    const trigger = buildTrigger("non_weak_blocker", Math.max(snapshot.counts.non_weak_blocker, snapshot.non_weak_blocker_accounts));
    for (const area of trigger.remediation_areas) areaSet.add(area);
    for (const action of trigger.allowed_next_actions) actionSet.add(action);
    triggers.push(trigger);
  } else {
    for (const code of DIAGNOSIS_CODES) {
      if (code === "non_weak_blocker") continue;
      const count = snapshot.counts[code];
      if (count === 0) continue;
      const trigger = buildTrigger(code, count);
      for (const area of trigger.remediation_areas) areaSet.add(area);
      for (const action of trigger.allowed_next_actions) actionSet.add(action);
      triggers.push(trigger);
    }
  }

  const hasTriggers = triggers.length > 0;
  const blockedByNonWeak = triggers.length === 1 && triggers[0]?.diagnosis_code === "non_weak_blocker";

  return Object.freeze({
    ok: !hasTriggers && snapshot.overall_classification === "useful",
    status: blockedByNonWeak ? "blocked-by-non-weak-failure" : hasTriggers ? "needs-remediation" : "no-remediation-needed",
    launch_readiness_claim: false,
    approves_live_provider_call: false,
    approves_provider_spend: false,
    approves_expansion_or_comparison: false,
    source_overall_classification: snapshot.overall_classification,
    remediation_areas: Object.freeze(orderAreas(areaSet)),
    allowed_next_actions: Object.freeze(orderActions(actionSet)),
    blocked_next_actions: Object.freeze([...BLOCKED_NEXT_ACTIONS]),
    rules_triggered: Object.freeze([...triggers]),
    safety: Object.freeze({
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
    }),
  });
}
