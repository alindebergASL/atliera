// Deterministic no-spend controlled-corpus usefulness assessment.
//
// This helper classifies already-produced, already-sanitized account-level
// validation facts. It performs no provider calls, no network access, no
// credential reads, no production writes, and no runtime/model-mode integration.

export type ControlledCorpusAccountRole = "representative" | "edge-case" | "calibration";

export type ControlledCorpusUsefulnessClassification =
  | "useful"
  | "weak-but-valid"
  | "zero-output"
  | "unsupported/invented"
  | "contract failure";

export type ControlledCorpusUsefulnessStatus = "pass" | "fail";

export type ControlledCorpusUsefulnessReasonCode =
  | "weak_quality_signal"
  | "zero_output"
  | "invented_or_unsupported_evidence"
  | "contract_failure"
  | "worst_case_classification_present";

export interface ControlledCorpusOutputCounts {
  excerpts: number;
  claims: number;
  account_objects: number;
}

export interface ControlledCorpusHardInvariants {
  no_invented_ids: boolean;
  provenance_required: boolean;
  graph_validates: boolean;
  no_private_leakage: boolean;
}

export interface ControlledCorpusSoftQualitySignals {
  materiality: boolean;
  specificity: boolean;
  account_usefulness: boolean;
  lens_usefulness: boolean;
  source_fit: boolean;
}

export interface ControlledCorpusUsefulnessAccountInput {
  account_ref: string;
  role: ControlledCorpusAccountRole;
  output_counts: ControlledCorpusOutputCounts;
  hard_invariants: ControlledCorpusHardInvariants;
  soft_quality: ControlledCorpusSoftQualitySignals;
}

export interface ControlledCorpusUsefulnessReason {
  code: ControlledCorpusUsefulnessReasonCode;
  severity: ControlledCorpusUsefulnessStatus;
  message: string;
}

export interface ControlledCorpusUsefulnessAccountAssessment {
  account_ref: string;
  role: ControlledCorpusAccountRole;
  classification: ControlledCorpusUsefulnessClassification;
  status: ControlledCorpusUsefulnessStatus;
  output_counts: ControlledCorpusOutputCounts;
  failed_hard_invariants: readonly (keyof ControlledCorpusHardInvariants)[];
  failed_soft_quality_signals: readonly (keyof ControlledCorpusSoftQualitySignals)[];
  reasons: readonly ControlledCorpusUsefulnessReason[];
}

export interface ControlledCorpusUsefulnessMetrics {
  total_accounts: number;
  useful_accounts: number;
  weak_but_valid_accounts: number;
  zero_output_accounts: number;
  unsupported_or_invented_accounts: number;
  contract_failure_accounts: number;
  classification_counts: Record<ControlledCorpusUsefulnessClassification, number>;
  roles: Record<ControlledCorpusAccountRole, number>;
}

export interface ControlledCorpusUsefulnessSummary {
  ok: boolean;
  status: ControlledCorpusUsefulnessStatus;
  launch_readiness_claim: false;
  overall_classification: ControlledCorpusUsefulnessClassification;
  metrics: ControlledCorpusUsefulnessMetrics;
  reasons: readonly ControlledCorpusUsefulnessReason[];
  accounts: readonly ControlledCorpusUsefulnessAccountAssessment[];
  safety: {
    live_provider_call: false;
    provider_spend: false;
    production_writes: false;
    runtime_model_mode_integration: false;
  };
}

const SAFE_ACCOUNT_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const CLASSIFICATION_RANK: Record<ControlledCorpusUsefulnessClassification, number> = {
  useful: 0,
  "weak-but-valid": 1,
  "zero-output": 2,
  "unsupported/invented": 3,
  "contract failure": 4,
};

const CLASSIFICATIONS: readonly ControlledCorpusUsefulnessClassification[] = [
  "useful",
  "weak-but-valid",
  "zero-output",
  "unsupported/invented",
  "contract failure",
];

const ROLES: readonly ControlledCorpusAccountRole[] = ["representative", "edge-case", "calibration"];

function assertSafeAccountRef(accountRef: unknown): asserts accountRef is string {
  if (
    typeof accountRef !== "string" ||
    !SAFE_ACCOUNT_REF.test(accountRef) ||
    accountRef.includes("..") ||
    accountRef.includes("://") ||
    accountRef.includes("/") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(accountRef)
  ) {
    throw new Error("controlled corpus account_ref must be a safe logical account ref");
  }
}

function assertNonNegativeInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
}

function assertBoolean(field: string, value: boolean): void {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
}

function assertRole(role: ControlledCorpusAccountRole): void {
  if (!(ROLES as readonly string[]).includes(role)) {
    throw new Error("controlled corpus account role must be representative, edge-case, or calibration");
  }
}

function snapshotAccountInput(input: ControlledCorpusUsefulnessAccountInput): ControlledCorpusUsefulnessAccountInput {
  try {
    const accountRef = input.account_ref;
    const role = input.role;
    const outputCounts = input.output_counts;
    const hardInvariants = input.hard_invariants;
    const softQuality = input.soft_quality;

    return {
      account_ref: accountRef,
      role,
      output_counts: {
        excerpts: outputCounts.excerpts,
        claims: outputCounts.claims,
        account_objects: outputCounts.account_objects,
      },
      hard_invariants: {
        no_invented_ids: hardInvariants.no_invented_ids,
        provenance_required: hardInvariants.provenance_required,
        graph_validates: hardInvariants.graph_validates,
        no_private_leakage: hardInvariants.no_private_leakage,
      },
      soft_quality: {
        materiality: softQuality.materiality,
        specificity: softQuality.specificity,
        account_usefulness: softQuality.account_usefulness,
        lens_usefulness: softQuality.lens_usefulness,
        source_fit: softQuality.source_fit,
      },
    };
  } catch {
    throw new Error("controlled corpus account input rejected");
  }
}

function validateAccountInput(input: ControlledCorpusUsefulnessAccountInput): void {
  assertSafeAccountRef(input.account_ref);
  assertRole(input.role);
  assertNonNegativeInteger("output_counts.excerpts", input.output_counts.excerpts);
  assertNonNegativeInteger("output_counts.claims", input.output_counts.claims);
  assertNonNegativeInteger("output_counts.account_objects", input.output_counts.account_objects);

  assertBoolean("hard_invariants.no_invented_ids", input.hard_invariants.no_invented_ids);
  assertBoolean("hard_invariants.provenance_required", input.hard_invariants.provenance_required);
  assertBoolean("hard_invariants.graph_validates", input.hard_invariants.graph_validates);
  assertBoolean("hard_invariants.no_private_leakage", input.hard_invariants.no_private_leakage);

  assertBoolean("soft_quality.materiality", input.soft_quality.materiality);
  assertBoolean("soft_quality.specificity", input.soft_quality.specificity);
  assertBoolean("soft_quality.account_usefulness", input.soft_quality.account_usefulness);
  assertBoolean("soft_quality.lens_usefulness", input.soft_quality.lens_usefulness);
  assertBoolean("soft_quality.source_fit", input.soft_quality.source_fit);
}

function failedHardInvariants(
  input: ControlledCorpusUsefulnessAccountInput,
): (keyof ControlledCorpusHardInvariants)[] {
  const failures: (keyof ControlledCorpusHardInvariants)[] = [];
  if (!input.hard_invariants.no_invented_ids) failures.push("no_invented_ids");
  if (!input.hard_invariants.provenance_required) failures.push("provenance_required");
  if (!input.hard_invariants.graph_validates) failures.push("graph_validates");
  if (!input.hard_invariants.no_private_leakage) failures.push("no_private_leakage");
  return failures;
}

function failedSoftQualitySignals(
  input: ControlledCorpusUsefulnessAccountInput,
): (keyof ControlledCorpusSoftQualitySignals)[] {
  const failures: (keyof ControlledCorpusSoftQualitySignals)[] = [];
  if (!input.soft_quality.materiality) failures.push("materiality");
  if (!input.soft_quality.specificity) failures.push("specificity");
  if (!input.soft_quality.account_usefulness) failures.push("account_usefulness");
  if (!input.soft_quality.lens_usefulness) failures.push("lens_usefulness");
  if (!input.soft_quality.source_fit) failures.push("source_fit");
  return failures;
}

function outputCountTotal(counts: ControlledCorpusOutputCounts): number {
  return counts.excerpts + counts.claims + counts.account_objects;
}

function classifyAccount(
  input: ControlledCorpusUsefulnessAccountInput,
  hardFailures: readonly (keyof ControlledCorpusHardInvariants)[],
  softFailures: readonly (keyof ControlledCorpusSoftQualitySignals)[],
): ControlledCorpusUsefulnessClassification {
  if (hardFailures.includes("graph_validates") || hardFailures.includes("no_private_leakage")) {
    return "contract failure";
  }
  if (hardFailures.includes("no_invented_ids") || hardFailures.includes("provenance_required")) {
    return "unsupported/invented";
  }
  if (outputCountTotal(input.output_counts) === 0) {
    return "zero-output";
  }
  if (softFailures.length > 0) {
    return "weak-but-valid";
  }
  return "useful";
}

function accountReasons(
  classification: ControlledCorpusUsefulnessClassification,
): ControlledCorpusUsefulnessReason[] {
  switch (classification) {
    case "useful":
      return [];
    case "weak-but-valid":
      return [{ code: "weak_quality_signal", severity: "fail", message: "one or more soft quality signals failed" }];
    case "zero-output":
      return [{ code: "zero_output", severity: "fail", message: "validated substrate produced no usable account output" }];
    case "unsupported/invented":
      return [{ code: "invented_or_unsupported_evidence", severity: "fail", message: "hard provenance or invented-id invariant failed" }];
    case "contract failure":
      return [{ code: "contract_failure", severity: "fail", message: "hard validation or leakage invariant failed" }];
  }
}

function emptyClassificationCounts(): Record<ControlledCorpusUsefulnessClassification, number> {
  return {
    useful: 0,
    "weak-but-valid": 0,
    "zero-output": 0,
    "unsupported/invented": 0,
    "contract failure": 0,
  };
}

function emptyRoleCounts(): Record<ControlledCorpusAccountRole, number> {
  return { representative: 0, "edge-case": 0, calibration: 0 };
}

function worstClassification(
  accounts: readonly ControlledCorpusUsefulnessAccountAssessment[],
): ControlledCorpusUsefulnessClassification {
  return accounts.reduce<ControlledCorpusUsefulnessClassification>((worst, account) => {
    return CLASSIFICATION_RANK[account.classification] > CLASSIFICATION_RANK[worst] ? account.classification : worst;
  }, "useful");
}

export function assessControlledCorpusUsefulnessAccount(
  input: ControlledCorpusUsefulnessAccountInput,
): ControlledCorpusUsefulnessAccountAssessment {
  const snapshot = snapshotAccountInput(input);
  validateAccountInput(snapshot);

  const hardFailures = failedHardInvariants(snapshot);
  const softFailures = failedSoftQualitySignals(snapshot);
  const classification = classifyAccount(snapshot, hardFailures, softFailures);

  return Object.freeze({
    account_ref: snapshot.account_ref,
    role: snapshot.role,
    classification,
    status: classification === "useful" ? "pass" : "fail",
    output_counts: Object.freeze({ ...snapshot.output_counts }),
    failed_hard_invariants: Object.freeze([...hardFailures]),
    failed_soft_quality_signals: Object.freeze([...softFailures]),
    reasons: Object.freeze(accountReasons(classification)),
  });
}

export function assessControlledCorpusUsefulness(
  inputs: ControlledCorpusUsefulnessAccountInput[],
): ControlledCorpusUsefulnessSummary {
  if (!Array.isArray(inputs)) {
    throw new Error("controlled corpus input must be an array");
  }

  let accountCount: number;
  try {
    accountCount = inputs.length;
  } catch {
    throw new Error("controlled corpus input rejected");
  }
  if (!Number.isInteger(accountCount) || accountCount < 3 || accountCount > 5) {
    throw new Error("controlled corpus must contain 3-5 accounts");
  }

  const accounts: ControlledCorpusUsefulnessAccountAssessment[] = [];
  for (let index = 0; index < accountCount; index += 1) {
    let input: ControlledCorpusUsefulnessAccountInput;
    try {
      input = inputs[index]!;
    } catch {
      throw new Error("controlled corpus account input rejected");
    }
    accounts.push(assessControlledCorpusUsefulnessAccount(input));
  }
  if (accounts.length < 3 || accounts.length > 5) {
    throw new Error("controlled corpus must contain 3-5 accounts");
  }

  const accountRefs = new Set<string>();
  for (const account of accounts) {
    if (accountRefs.has(account.account_ref)) {
      throw new Error("controlled corpus account_ref values must be unique");
    }
    accountRefs.add(account.account_ref);
  }

  const roles = emptyRoleCounts();
  for (const account of accounts) {
    roles[account.role] += 1;
  }
  if (roles.representative < 1 || roles["edge-case"] < 1 || roles.calibration < 1) {
    throw new Error("controlled corpus must include representative, edge-case, and calibration accounts");
  }

  const classificationCounts = emptyClassificationCounts();
  for (const account of accounts) {
    classificationCounts[account.classification] += 1;
  }

  const overallClassification = worstClassification(accounts);
  const reasons: ControlledCorpusUsefulnessReason[] = overallClassification === "useful"
    ? []
    : [{
        code: "worst_case_classification_present",
        severity: "fail",
        message: "controlled corpus summary preserves the worst per-account classification",
      }];

  return Object.freeze({
    ok: overallClassification === "useful",
    status: overallClassification === "useful" ? "pass" : "fail",
    launch_readiness_claim: false,
    overall_classification: overallClassification,
    metrics: Object.freeze({
      total_accounts: accounts.length,
      useful_accounts: classificationCounts.useful,
      weak_but_valid_accounts: classificationCounts["weak-but-valid"],
      zero_output_accounts: classificationCounts["zero-output"],
      unsupported_or_invented_accounts: classificationCounts["unsupported/invented"],
      contract_failure_accounts: classificationCounts["contract failure"],
      classification_counts: Object.freeze({ ...classificationCounts }),
      roles: Object.freeze({ ...roles }),
    }),
    reasons: Object.freeze(reasons),
    accounts: Object.freeze([...accounts]),
    safety: Object.freeze({
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
    }),
  });
}
