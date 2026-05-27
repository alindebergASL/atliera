import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  diagnoseControlledCorpusWeakness,
  type ControlledCorpusWeaknessDiagnosisInput,
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

describe("controlled corpus weakness diagnosis", () => {
  test("diagnoses weak-but-valid accounts without approving expansion or readiness", () => {
    const diagnosis = diagnoseControlledCorpusWeakness([
      account("diag-representative", "representative", {
        output_counts: { excerpts: 1, claims: 1, account_objects: 0 },
        soft_quality: { materiality: false, account_usefulness: false },
      }),
      account("diag-edge", "edge-case", {
        output_counts: { excerpts: 1, claims: 0, account_objects: 1 },
        soft_quality: { specificity: false, lens_usefulness: false },
      }),
      account("diag-calibration", "calibration", {
        output_counts: { excerpts: 1, claims: 1, account_objects: 1 },
        soft_quality: { source_fit: false },
      }),
    ]);

    assert.equal(diagnosis.ok, false);
    assert.equal(diagnosis.status, "fail");
    assert.equal(diagnosis.overall_classification, "weak-but-valid");
    assert.equal(diagnosis.launch_readiness_claim, false);
    assert.equal(diagnosis.approves_expansion_or_comparison, false);
    assert.deepEqual(diagnosis.safety, {
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
    });
    assert.deepEqual(diagnosis.next_required_actions, [
      "inspect_rubric",
      "inspect_prompts",
      "inspect_proposal_layer",
      "inspect_evidence_policy",
    ]);
    assert.deepEqual(diagnosis.metrics.diagnosis_counts, {
      low_materiality: 1,
      low_specificity: 1,
      missing_account_objects: 1,
      missing_lens_usefulness: 1,
      insufficient_evidence_density: 2,
      rubric_threshold_gap: 2,
      proposal_layer_underproduction: 2,
      evidence_policy_gap: 1,
      non_weak_blocker: 0,
    });
    assert.deepEqual(
      diagnosis.accounts.map((item) => [item.account_ref, item.diagnosis_codes]),
      [
        [
          "diag-representative",
          [
            "low_materiality",
            "missing_account_objects",
            "insufficient_evidence_density",
            "rubric_threshold_gap",
            "proposal_layer_underproduction",
          ],
        ],
        [
          "diag-edge",
          [
            "low_specificity",
            "missing_lens_usefulness",
            "insufficient_evidence_density",
            "rubric_threshold_gap",
            "proposal_layer_underproduction",
          ],
        ],
        ["diag-calibration", ["evidence_policy_gap"]],
      ],
    );
  });

  test("preserves non-weak blockers instead of hiding zero-output or contract failures", () => {
    const diagnosis = diagnoseControlledCorpusWeakness([
      account("diag-useful", "representative"),
      account("diag-zero", "edge-case", { output_counts: { excerpts: 0, claims: 0, account_objects: 0 } }),
      account("diag-contract", "calibration", { hard_invariants: { graph_validates: false } }),
    ]);

    assert.equal(diagnosis.overall_classification, "contract failure");
    assert.equal(diagnosis.metrics.non_weak_blocker_accounts, 2);
    assert.equal(diagnosis.metrics.diagnosis_counts.non_weak_blocker, 2);
    assert.deepEqual(
      diagnosis.accounts.map((item) => [item.account_ref, item.classification, item.diagnosis_codes]),
      [
        ["diag-useful", "useful", []],
        ["diag-zero", "zero-output", ["non_weak_blocker"]],
        ["diag-contract", "contract failure", ["non_weak_blocker"]],
      ],
    );
  });

  test("rejects unsafe corpus input and snapshots array elements before diagnosis", () => {
    assert.throws(
      () => diagnoseControlledCorpusWeakness({ length: 3 } as unknown as ControlledCorpusWeaknessDiagnosisInput[]),
      /controlled corpus input must be an array/,
    );

    const arrayWithCustomMap = [
      account("diag-array-one", "representative"),
      account("diag-array-two", "edge-case"),
      account("diag-array-three", "calibration"),
    ];
    Object.defineProperty(arrayWithCustomMap, "map", {
      value: () => {
        throw new Error("custom map should never run");
      },
    });
    assert.equal(diagnoseControlledCorpusWeakness(arrayWithCustomMap).metrics.total_accounts, 3);

    const proxyWithThrowingLength = new Proxy([
      account("diag-proxy-one", "representative"),
      account("diag-proxy-two", "edge-case"),
      account("diag-proxy-three", "calibration"),
    ], {
      get(target, property, receiver) {
        if (property === "length") throw new Error("private length detail must not leak");
        return Reflect.get(target, property, receiver);
      },
    });
    assert.throws(
      () => diagnoseControlledCorpusWeakness(proxyWithThrowingLength),
      /controlled corpus input rejected/,
    );

    const overlongWithThrowingElement = [
      account("diag-too-many-one", "representative"),
      account("diag-too-many-two", "edge-case"),
      account("diag-too-many-three", "calibration"),
      account("diag-too-many-four", "representative"),
      account("diag-too-many-five", "edge-case"),
      account("diag-too-many-six", "calibration"),
    ];
    Object.defineProperty(overlongWithThrowingElement, "5", {
      get() {
        throw new Error("private overlong element detail must not leak");
      },
    });
    assert.throws(
      () => diagnoseControlledCorpusWeakness(overlongWithThrowingElement),
      /controlled corpus must contain 3-5 accounts/,
    );
  });
});
