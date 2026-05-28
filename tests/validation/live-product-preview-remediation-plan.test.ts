import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  planLiveProductPreviewUsefulnessRemediation,
  type LiveProductPreviewRemediationPlan,
} from "../../src/validation/live-product-preview-remediation-plan.ts";
import type { LiveProductPreviewUsefulnessAssessment } from "../../src/validation/live-product-preview-usefulness.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ASSESSMENT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-20260528a-usefulness-assessment.json",
);
const PLAN_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "live-product-preview-20260528a-remediation-plan.json",
);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function weakAssessment(): LiveProductPreviewUsefulnessAssessment {
  return readJson<LiveProductPreviewUsefulnessAssessment>(ASSESSMENT_FIXTURE);
}

function assertNoExecutionApproval(plan: LiveProductPreviewRemediationPlan): void {
  assert.equal(plan.launch_readiness_claim, false);
  assert.equal(plan.product_readiness_claim, false);
  assert.equal(plan.production_readiness_claim, false);
  assert.equal(plan.approves_live_provider_call, false);
  assert.equal(plan.approves_provider_spend, false);
  assert.equal(plan.approves_expansion_or_comparison, false);
  assert.deepEqual(plan.safety, {
    live_provider_call: false,
    provider_spend: false,
    production_writes: false,
    runtime_model_mode_integration: false,
    provider_or_model_comparison: false,
    corpus_expansion: false,
    product_preview_expansion: false,
    web_search_or_tools: false,
  });
}

describe("live product preview usefulness remediation plan", () => {
  test("maps weak-but-valid insufficient lens coverage to no-spend remediation areas", () => {
    const plan = planLiveProductPreviewUsefulnessRemediation(weakAssessment());

    assert.deepEqual(plan, readJson<LiveProductPreviewRemediationPlan>(PLAN_FIXTURE));
    assert.equal(plan.ok, false);
    assert.equal(plan.status, "needs-remediation");
    assert.equal(plan.preview_ref, "live-product-preview-20260528a");
    assert.equal(plan.source_classification, "weak-but-valid");
    assert.deepEqual(plan.source_reason_codes, ["insufficient_useful_lenses"]);
    assert.deepEqual(plan.remediation_areas, [
      "prompt_contract",
      "proposal_schema",
      "workshop_lens_mapping",
      "product_surface_expectations",
      "fixture_coverage",
    ]);
    assert.deepEqual(plan.allowed_next_actions, [
      "no_spend_prompt_contract_revision",
      "proposal_schema_revision",
      "workshop_lens_mapping_review",
      "product_surface_clarification",
      "deterministic_fixture_update",
    ]);
    assert.deepEqual(plan.blocked_next_actions, [
      "live_provider_rerun",
      "provider_comparison",
      "corpus_expansion",
      "product_preview_expansion",
      "launch_readiness_claim",
      "product_readiness_claim",
      "production_readiness_claim",
    ]);
    assert.deepEqual(plan.rules_triggered, [
      {
        reason_code: "insufficient_useful_lenses",
        observed: 1,
        threshold: 2,
        remediation_areas: [
          "prompt_contract",
          "proposal_schema",
          "workshop_lens_mapping",
          "product_surface_expectations",
          "fixture_coverage",
        ],
        allowed_next_actions: [
          "no_spend_prompt_contract_revision",
          "proposal_schema_revision",
          "workshop_lens_mapping_review",
          "product_surface_clarification",
          "deterministic_fixture_update",
        ],
      },
    ]);
    assertNoExecutionApproval(plan);
  });

  test("rejects useful, zero-output, and contract-failure assessments as the wrong remediation entrypoint", () => {
    const useful = {
      ...weakAssessment(),
      ok: true,
      status: "pass",
      preview_usefulness_classification: "useful",
      reasons: [],
      metrics: { ...weakAssessment().metrics, useful_lens_count: 2, useful_lenses: ["signals", "plays"] },
    };
    const zero = {
      ...weakAssessment(),
      preview_usefulness_classification: "zero-output",
      reasons: [{ code: "zero_output", severity: "fail", message: "", observed: 0, threshold: 1 }],
    };
    const contract = {
      ...weakAssessment(),
      preview_usefulness_classification: "contract-failure",
      reasons: [{ code: "validation_chain_failed", severity: "fail", message: "", observed: 0, threshold: 1 }],
    };

    for (const input of [useful, zero, contract]) {
      assert.throws(
        () => planLiveProductPreviewUsefulnessRemediation(input),
        /live product preview remediation assessment rejected/,
      );
    }
  });

  test("rejects unsafe refs, broadening safety flags, and internally inconsistent weak assessments", () => {
    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation({ ...weakAssessment(), preview_ref: "../private" }),
      /live product preview remediation assessment rejected/,
    );
    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation({ ...weakAssessment(), approves_expansion_or_comparison: true }),
      /live product preview remediation assessment rejected/,
    );
    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation({ ...weakAssessment(), safety: { ...weakAssessment().safety, provider_spend: true } }),
      /live product preview remediation assessment rejected/,
    );
    assert.throws(
      () =>
        planLiveProductPreviewUsefulnessRemediation({
          ...weakAssessment(),
          metrics: { ...weakAssessment().metrics, useful_lens_count: 2, useful_lenses: ["signals"] },
        }),
      /live product preview remediation assessment rejected/,
    );
  });

  test("rejects unexpected broadened fields and unsafe reason messages", () => {
    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation({ ...weakAssessment(), approves_live_provider_call: true }),
      /live product preview remediation assessment rejected/,
    );
    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation({ ...weakAssessment(), unexpected_provider_payload: "private" }),
      /live product preview remediation assessment rejected/,
    );
    assert.throws(
      () =>
        planLiveProductPreviewUsefulnessRemediation({
          ...weakAssessment(),
          request_surface: { tools_or_plugins_requested: true, web_search_requested: true },
        }),
      /live product preview remediation assessment rejected/,
    );
    assert.throws(
      () =>
        planLiveProductPreviewUsefulnessRemediation({
          ...weakAssessment(),
          metrics: { ...weakAssessment().metrics, unexpected_payload: "private" },
        }),
      /live product preview remediation assessment rejected/,
    );
    assert.throws(
      () =>
        planLiveProductPreviewUsefulnessRemediation({
          ...weakAssessment(),
          reasons: [{ ...weakAssessment().reasons[0], message: "provider response detail must not be accepted" }],
        }),
      /live product preview remediation assessment rejected/,
    );
    const nonEnumerableReasonsInput = weakAssessment();
    const nonEnumerableReasons = [nonEnumerableReasonsInput.reasons[0]];
    Object.defineProperty(nonEnumerableReasons, "0", {
      value: nonEnumerableReasonsInput.reasons[0],
      enumerable: false,
      configurable: true,
      writable: true,
    });
    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation({ ...nonEnumerableReasonsInput, reasons: nonEnumerableReasons }),
      /live product preview remediation assessment rejected/,
    );

    const nonEnumerableLensInput = weakAssessment();
    const nonEnumerableLenses = ["signals"];
    Object.defineProperty(nonEnumerableLenses, "0", {
      value: "signals",
      enumerable: false,
      configurable: true,
      writable: true,
    });
    assert.throws(
      () =>
        planLiveProductPreviewUsefulnessRemediation({
          ...nonEnumerableLensInput,
          metrics: { ...nonEnumerableLensInput.metrics, useful_lenses: nonEnumerableLenses },
        }),
      /live product preview remediation assessment rejected/,
    );
  });

  test("rejects hostile accessor inputs without leaking getter details", () => {
    const hostile = weakAssessment() as unknown as Record<string, unknown>;
    Object.defineProperty(hostile, "metrics", {
      enumerable: true,
      get() {
        throw new Error("private metrics getter detail must not leak");
      },
    });

    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation(hostile),
      /live product preview remediation assessment rejected/,
    );

    const hostileReasons = weakAssessment();
    const reasons = [hostileReasons.reasons[0]];
    Object.defineProperty(reasons, "0", {
      enumerable: true,
      get() {
        throw new Error("private reason getter detail must not leak");
      },
    });
    assert.throws(
      () => planLiveProductPreviewUsefulnessRemediation({ ...hostileReasons, reasons }),
      /live product preview remediation assessment rejected/,
    );
  });

  test("does not read process.env while planning remediation", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });
    try {
      const plan = planLiveProductPreviewUsefulnessRemediation(weakAssessment());
      assert.equal(plan.status, "needs-remediation");
    } finally {
      if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
    }
  });
});
