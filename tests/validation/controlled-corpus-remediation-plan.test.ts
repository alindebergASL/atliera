import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  planControlledCorpusWeaknessRemediation,
} from "../../src/validation/controlled-corpus-remediation-plan.ts";
import {
  diagnoseControlledCorpusWeakness,
  type ControlledCorpusWeaknessDiagnosisInput,
  type ControlledCorpusWeaknessDiagnosisSummary,
} from "../../src/validation/controlled-corpus-weakness-diagnosis.ts";

type AccountOverrides = Partial<Omit<ControlledCorpusWeaknessDiagnosisInput, "output_counts" | "hard_invariants" | "soft_quality">> & {
  output_counts?: Partial<ControlledCorpusWeaknessDiagnosisInput["output_counts"]>;
  hard_invariants?: Partial<ControlledCorpusWeaknessDiagnosisInput["hard_invariants"]>;
  soft_quality?: Partial<ControlledCorpusWeaknessDiagnosisInput["soft_quality"]>;
};

function account(
  account_ref: string,
  role: ControlledCorpusWeaknessDiagnosisInput["role"],
  overrides: AccountOverrides = {},
): ControlledCorpusWeaknessDiagnosisInput {
  return {
    account_ref,
    role,
    output_counts: { excerpts: 2, claims: 2, account_objects: 1, ...overrides.output_counts },
    hard_invariants: {
      no_invented_ids: true,
      provenance_required: true,
      graph_validates: true,
      no_private_leakage: true,
      ...overrides.hard_invariants,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
      ...overrides.soft_quality,
    },
  };
}

function weakDiagnosis(): ControlledCorpusWeaknessDiagnosisSummary {
  return diagnoseControlledCorpusWeakness([
    account("remediate-representative", "representative", {
      output_counts: { excerpts: 1, claims: 1, account_objects: 0 },
      soft_quality: { materiality: false, account_usefulness: false },
    }),
    account("remediate-edge", "edge-case", {
      output_counts: { excerpts: 1, claims: 0, account_objects: 1 },
      soft_quality: { specificity: false, lens_usefulness: false },
    }),
    account("remediate-calibration", "calibration", {
      output_counts: { excerpts: 1, claims: 1, account_objects: 1 },
      soft_quality: { source_fit: false },
    }),
  ]);
}

describe("controlled corpus weakness remediation plan", () => {
  test("maps weak-but-valid diagnosis buckets to no-spend remediation areas", () => {
    const plan = planControlledCorpusWeaknessRemediation(weakDiagnosis());

    assert.equal(plan.ok, false);
    assert.equal(plan.status, "needs-remediation");
    assert.equal(plan.launch_readiness_claim, false);
    assert.equal(plan.approves_live_provider_call, false);
    assert.equal(plan.approves_provider_spend, false);
    assert.equal(plan.approves_expansion_or_comparison, false);
    assert.deepEqual(plan.safety, {
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
    });

    assert.deepEqual(plan.remediation_areas, [
      "prompt_contract",
      "proposal_schema",
      "evidence_policy",
      "rubric_thresholds",
      "fixture_coverage",
    ]);
    assert.deepEqual(plan.allowed_next_actions, [
      "no_spend_prompt_contract_revision",
      "proposal_schema_revision",
      "rubric_clarification",
      "evidence_policy_clarification",
      "deterministic_fixture_update",
    ]);
    assert.deepEqual(plan.blocked_next_actions, [
      "live_provider_rerun",
      "provider_comparison",
      "corpus_expansion",
      "launch_readiness_claim",
      "product_readiness_claim",
    ]);
    assert.deepEqual(plan.rules_triggered.map((rule) => [rule.diagnosis_code, rule.remediation_areas]), [
      ["low_materiality", ["prompt_contract", "rubric_thresholds"]],
      ["low_specificity", ["prompt_contract", "rubric_thresholds"]],
      ["missing_account_objects", ["prompt_contract", "proposal_schema"]],
      ["missing_lens_usefulness", ["proposal_schema"]],
      ["insufficient_evidence_density", ["prompt_contract", "evidence_policy", "fixture_coverage"]],
      ["rubric_threshold_gap", ["rubric_thresholds"]],
      ["proposal_layer_underproduction", ["proposal_schema"]],
      ["evidence_policy_gap", ["evidence_policy", "rubric_thresholds"]],
    ]);
  });

  test("blocks remediation-only planning when diagnosis contains non-weak blockers", () => {
    const diagnosis = diagnoseControlledCorpusWeakness([
      account("remediate-useful", "representative"),
      account("remediate-zero", "edge-case", { output_counts: { excerpts: 0, claims: 0, account_objects: 0 } }),
      account("remediate-contract", "calibration", { hard_invariants: { graph_validates: false } }),
    ]);

    const plan = planControlledCorpusWeaknessRemediation(diagnosis);

    assert.equal(plan.status, "blocked-by-non-weak-failure");
    assert.deepEqual(plan.remediation_areas, ["substrate_contract"]);
    assert.deepEqual(plan.allowed_next_actions, ["fix_hard_substrate_or_contract_blocker"]);
    assert.deepEqual(plan.blocked_next_actions, [
      "live_provider_rerun",
      "provider_comparison",
      "corpus_expansion",
      "launch_readiness_claim",
      "product_readiness_claim",
    ]);
    assert.deepEqual(plan.rules_triggered, [
      {
        diagnosis_code: "non_weak_blocker",
        count: 2,
        remediation_areas: ["substrate_contract"],
        allowed_next_actions: ["fix_hard_substrate_or_contract_blocker"],
      },
    ]);
  });

  test("rejects malformed diagnosis summaries without leaking hostile getter details", () => {
    const malformed = {
      ...weakDiagnosis(),
      metrics: {
        total_accounts: 3,
        weak_but_valid_accounts: 3,
        non_weak_blocker_accounts: 0,
        diagnosis_counts: { low_materiality: -1 },
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(malformed),
      /controlled corpus remediation diagnosis rejected/,
    );

    const hostile = new Proxy(weakDiagnosis() as unknown as Record<string, unknown>, {
      get(target, property, receiver) {
        if (property === "metrics") throw new Error("private metrics getter detail must not leak");
        return Reflect.get(target, property, receiver);
      },
    });
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(hostile as unknown as ControlledCorpusWeaknessDiagnosisSummary),
      /controlled corpus remediation diagnosis rejected/,
    );

    const { proxy, revoke } = Proxy.revocable(weakDiagnosis() as unknown as Record<string, unknown>, {});
    revoke();
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(proxy as unknown as ControlledCorpusWeaknessDiagnosisSummary),
      /controlled corpus remediation diagnosis rejected/,
    );
  });

  test("rejects internally inconsistent diagnosis summaries before planning", () => {
    const usefulWithContractFailure = {
      ...weakDiagnosis(),
      ok: false,
      status: "fail",
      overall_classification: "contract failure",
      metrics: {
        total_accounts: 3,
        weak_but_valid_accounts: 0,
        non_weak_blocker_accounts: 0,
        diagnosis_counts: {
          low_materiality: 0,
          low_specificity: 0,
          missing_account_objects: 0,
          missing_lens_usefulness: 0,
          insufficient_evidence_density: 0,
          rubric_threshold_gap: 0,
          proposal_layer_underproduction: 0,
          evidence_policy_gap: 0,
          non_weak_blocker: 0,
        },
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(usefulWithContractFailure),
      /controlled corpus remediation diagnosis rejected/,
    );

    const weakWithoutWeakBuckets = {
      ...usefulWithContractFailure,
      overall_classification: "weak-but-valid",
      metrics: {
        ...usefulWithContractFailure.metrics,
        weak_but_valid_accounts: 3,
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(weakWithoutWeakBuckets),
      /controlled corpus remediation diagnosis rejected/,
    );

    const nonWeakMismatch = {
      ...usefulWithContractFailure,
      overall_classification: "contract failure",
      metrics: {
        ...usefulWithContractFailure.metrics,
        non_weak_blocker_accounts: 2,
        diagnosis_counts: {
          ...usefulWithContractFailure.metrics.diagnosis_counts,
          non_weak_blocker: 1,
        },
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(nonWeakMismatch),
      /controlled corpus remediation diagnosis rejected/,
    );
  });

  test("rejects impossible useful and nested safety contradiction summaries", () => {
    const base = weakDiagnosis();
    const impossibleUsefulAccounts = base.accounts.map((item) => ({
      ...item,
      classification: "useful",
      status: "pass",
      diagnosis_codes: [],
      output_counts: { excerpts: 0, claims: 0, account_objects: 0 },
      failed_hard_invariants: [],
      failed_soft_quality_signals: [],
    }));
    const impossibleUsefulSummary = {
      ...base,
      ok: true,
      status: "pass",
      overall_classification: "useful",
      metrics: {
        total_accounts: 3,
        weak_but_valid_accounts: 0,
        non_weak_blocker_accounts: 0,
        diagnosis_counts: {
          low_materiality: 0,
          low_specificity: 0,
          missing_account_objects: 0,
          missing_lens_usefulness: 0,
          insufficient_evidence_density: 0,
          rubric_threshold_gap: 0,
          proposal_layer_underproduction: 0,
          evidence_policy_gap: 0,
          non_weak_blocker: 0,
        },
      },
      next_required_actions: [],
      accounts: impossibleUsefulAccounts,
      usefulness_summary: {
        ...base.usefulness_summary,
        ok: true,
        status: "pass",
        overall_classification: "useful",
        accounts: impossibleUsefulAccounts,
        metrics: {
          ...base.usefulness_summary.metrics,
          useful_accounts: 3,
          weak_but_valid_accounts: 0,
          zero_output_accounts: 0,
          unsupported_or_invented_accounts: 0,
          contract_failure_accounts: 0,
          classification_counts: {
            useful: 3,
            "weak-but-valid": 0,
            "zero-output": 0,
            "unsupported/invented": 0,
            "contract failure": 0,
          },
        },
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(impossibleUsefulSummary),
      /controlled corpus remediation diagnosis rejected/,
    );

    const nestedSafetyContradiction = {
      ...base,
      usefulness_summary: {
        ...base.usefulness_summary,
        safety: {
          live_provider_call: true,
          provider_spend: true,
          production_writes: true,
          runtime_model_mode_integration: true,
        },
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(nestedSafetyContradiction),
      /controlled corpus remediation diagnosis rejected/,
    );
  });

  test("rejects unsafe logical account refs even when summary layers agree", () => {
    for (const unsafeRef of ["../secret", "http://example", "acct..bad", ["127", "0", "0", "1"].join(".")]) {
      const base = weakDiagnosis();
      const unsafeSummary = {
        ...base,
        accounts: base.accounts.map((item, index) => index === 0 ? { ...item, account_ref: unsafeRef } : item),
        usefulness_summary: {
          ...base.usefulness_summary,
          accounts: base.usefulness_summary.accounts.map((item, index) => index === 0 ? { ...item, account_ref: unsafeRef } : item),
        },
      } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
      assert.throws(
        () => planControlledCorpusWeaknessRemediation(unsafeSummary),
        /controlled corpus remediation diagnosis rejected/,
      );
    }
  });

  test("rejects duplicate account refs and missing required corpus roles", () => {
    const base = weakDiagnosis();
    const duplicateAccountRefs = {
      ...base,
      accounts: base.accounts.map((item, index) => index === 1 ? { ...item, account_ref: base.accounts[0]!.account_ref } : item),
      usefulness_summary: {
        ...base.usefulness_summary,
        accounts: base.usefulness_summary.accounts.map((item, index) => index === 1 ? { ...item, account_ref: base.accounts[0]!.account_ref } : item),
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(duplicateAccountRefs),
      /controlled corpus remediation diagnosis rejected/,
    );

    const missingCalibrationRole = {
      ...base,
      accounts: base.accounts.map((item, index) => index === 2 ? { ...item, role: "representative" } : item),
      usefulness_summary: {
        ...base.usefulness_summary,
        accounts: base.usefulness_summary.accounts.map((item, index) => index === 2 ? { ...item, role: "representative" } : item),
        metrics: {
          ...base.usefulness_summary.metrics,
          roles: { representative: 2, "edge-case": 1, calibration: 0 },
        },
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(missingCalibrationRole),
      /controlled corpus remediation diagnosis rejected/,
    );
  });

  test("rejects nested diagnosis contradictions instead of prompt-only remediation", () => {
    const base = weakDiagnosis();
    const nestedAccountContradiction = {
      ...base,
      accounts: [
        {
          ...base.accounts[0],
          classification: "contract failure",
          status: "fail",
          diagnosis_codes: ["non_weak_blocker"],
        },
        base.accounts[1],
        base.accounts[2],
      ],
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(nestedAccountContradiction),
      /controlled corpus remediation diagnosis rejected/,
    );

    const nestedUsefulnessOrderContradiction = {
      ...base,
      usefulness_summary: {
        ...base.usefulness_summary,
        accounts: [
          base.usefulness_summary.accounts[1],
          base.usefulness_summary.accounts[0],
          base.usefulness_summary.accounts[2],
        ],
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(nestedUsefulnessOrderContradiction),
      /controlled corpus remediation diagnosis rejected/,
    );

    const nestedUsefulnessContradiction = {
      ...base,
      usefulness_summary: {
        ...base.usefulness_summary,
        overall_classification: "contract failure",
        accounts: [
          {
            ...base.usefulness_summary.accounts[0],
            classification: "contract failure",
            status: "fail",
          },
          base.usefulness_summary.accounts[1],
          base.usefulness_summary.accounts[2],
        ],
        metrics: {
          ...base.usefulness_summary.metrics,
          weak_but_valid_accounts: 2,
          contract_failure_accounts: 1,
          classification_counts: {
            ...base.usefulness_summary.metrics.classification_counts,
            "weak-but-valid": 2,
            "contract failure": 1,
          },
        },
      },
    } as unknown as ControlledCorpusWeaknessDiagnosisSummary;
    assert.throws(
      () => planControlledCorpusWeaknessRemediation(nestedUsefulnessContradiction),
      /controlled corpus remediation diagnosis rejected/,
    );
  });
});
