import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compareLiveProductPreviewProviderUsefulness,
  type LiveProductPreviewComparisonUsefulnessInput,
} from "../../src/validation/live-product-preview-comparison-usefulness.ts";
import type { LiveProductPreviewUsefulnessAssessment } from "../../src/validation/live-product-preview-usefulness.ts";

function usefulAssessment(ref: string): LiveProductPreviewUsefulnessAssessment {
  return {
    ok: true,
    status: "pass",
    preview_ref: ref,
    preview_usefulness_classification: "useful",
    launch_readiness_claim: false,
    product_readiness_claim: false,
    production_readiness_claim: false,
    approves_expansion_or_comparison: false,
    metrics: {
      account_count: 6,
      provider_calls_executed: 6,
      output_counts: { excerpts: 18, claims: 18, account_objects: 18 },
      slot_output_counts: [
        { role: "representative-a", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
        { role: "representative-b", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
        { role: "edge-case-a", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
        { role: "edge-case-b", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
        { role: "calibration", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
        { role: "sparse-control", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      ],
      useful_lens_count: 3,
      useful_lenses: ["signals", "maps", "plays"],
    },
    reasons: [],
    safety: {
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
      provider_or_model_comparison: false,
      corpus_expansion: false,
      product_preview_expansion: false,
      web_search_or_tools: false,
    },
  };
}

function comparisonInput(): LiveProductPreviewComparisonUsefulnessInput {
  return {
    comparison_ref: "live-product-preview-gpt55-comparison-20260602a-usefulness",
    baseline: {
      label: "baseline",
      provider_route: "owl-alpha",
      model: "owl-alpha",
      preview_ref: "live-product-preview-six-slot-20260601a",
      assessment: usefulAssessment("live-product-preview-six-slot-20260601a"),
      tokens: { input: 5958, output: 5317 },
      observed_cost_usd: 0,
      estimated_cost_usd: 0.06,
    },
    candidate: {
      label: "candidate",
      provider_route: "openai-codex",
      model: "gpt-5.5",
      preview_ref: "live-product-preview-gpt55-comparison-20260602a",
      assessment: usefulAssessment("live-product-preview-gpt55-comparison-20260602a"),
      tokens: { input: 5929, output: 4630 },
      observed_cost_usd: 0,
      estimated_cost_usd: 0.06,
    },
  };
}

describe("live product preview provider comparison usefulness assessment", () => {
  test("compares sanitized useful baseline and GPT-5.5 candidate facts without selecting a default model", () => {
    const assessment = compareLiveProductPreviewProviderUsefulness(comparisonInput());

    assert.equal(assessment.ok, true);
    assert.equal(assessment.status, "pass");
    assert.equal(assessment.comparison_usefulness_classification, "candidate-comparable-useful");
    assert.equal(assessment.baseline.preview_usefulness_classification, "useful");
    assert.equal(assessment.candidate.preview_usefulness_classification, "useful");
    assert.deepEqual(assessment.deltas.output_counts, { excerpts: 0, claims: 0, account_objects: 0 });
    assert.equal(assessment.deltas.useful_lens_count, 0);
    assert.equal(assessment.deltas.output_tokens, -687);
    assert.equal(assessment.deltas.estimated_cost_usd, 0);
    assert.equal(assessment.recommended_next_step, "provider-neutral-runtime-integration-planning");
    assert.equal(assessment.launch_readiness_claim, false);
    assert.equal(assessment.product_readiness_claim, false);
    assert.equal(assessment.production_readiness_claim, false);
    assert.equal(assessment.default_model_selection_claim, false);
    assert.equal(assessment.provider_lock_in, false);
    assert.equal(assessment.approves_provider_call, false);
    assert.equal(assessment.approves_expansion_or_comparison, false);
    assert.deepEqual(assessment.safety, {
      live_provider_call: false,
      provider_spend: false,
      raw_private_evidence_read: false,
      production_writes: false,
      runtime_model_mode_integration: false,
      provider_or_model_selection: false,
      corpus_expansion: false,
      product_preview_expansion: false,
      web_search_or_tools: false,
    });
    assert.deepEqual(assessment.reasons, [
      "candidate matched the baseline sanitized usefulness floor across six screened slots",
      "candidate matched baseline graph-supported Signals, Maps, and Plays counts",
      "candidate used fewer provider-reported output tokens in this bounded slice",
      "result is not a model-quality, readiness, lock-in, or default-selection claim",
    ]);
  });

  test("fails closed when either side is not a passing useful assessment", () => {
    const input: LiveProductPreviewComparisonUsefulnessInput = {
      ...comparisonInput(),
      candidate: {
        ...comparisonInput().candidate,
        assessment: {
          ...comparisonInput().candidate.assessment,
          ok: false,
          status: "fail",
          preview_usefulness_classification: "weak-but-valid",
          reasons: [
            {
              code: "insufficient_useful_lenses",
              severity: "fail",
              message: "insufficient useful lenses",
              observed: 1,
              threshold: 2,
            },
          ],
        },
      },
    };

    const assessment = compareLiveProductPreviewProviderUsefulness(input);

    assert.equal(assessment.ok, false);
    assert.equal(assessment.status, "fail");
    assert.equal(assessment.comparison_usefulness_classification, "not-comparable");
    assert.equal(assessment.recommended_next_step, "remediate-before-runtime-integration-planning");
    assert.equal(assessment.approves_provider_call, false);
    assert.equal(assessment.default_model_selection_claim, false);
    assert.deepEqual(assessment.reasons, ["candidate assessment is not passing useful"]);
  });

  test("rejects unsafe comparison inputs before reading private-provider-shaped fields", () => {
    assert.throws(
      () => compareLiveProductPreviewProviderUsefulness({ ...comparisonInput(), comparison_ref: "../private" }),
      /comparison_ref must be safe/,
    );
    assert.throws(
      () =>
        compareLiveProductPreviewProviderUsefulness({
          ...comparisonInput(),
          candidate: { ...comparisonInput().candidate, provider_route: "https://provider.example.invalid" },
        }),
      /provider_route must be safe/,
    );
    assert.throws(
      () =>
        compareLiveProductPreviewProviderUsefulness({
          ...comparisonInput(),
          baseline: { ...comparisonInput().baseline, api_key: "forbidden" } as never,
        }),
      /invalid baseline comparison input/,
    );

    const hostile = comparisonInput() as unknown as Record<string, unknown>;
    Object.defineProperty(hostile, "comparison_ref", {
      enumerable: true,
      get() {
        throw new Error("secret getter should not be exposed");
      },
    });
    assert.throws(() => compareLiveProductPreviewProviderUsefulness(hostile as never), /invalid comparison input/);
  });

  test("rejects contradictory nested assessment safety and readiness markers", () => {
    assert.throws(
      () =>
        compareLiveProductPreviewProviderUsefulness({
          ...comparisonInput(),
          candidate: {
            ...comparisonInput().candidate,
            assessment: {
              ...comparisonInput().candidate.assessment,
              launch_readiness_claim: true,
            } as never,
          },
        }),
      /invalid candidate comparison input/,
    );
    assert.throws(
      () =>
        compareLiveProductPreviewProviderUsefulness({
          ...comparisonInput(),
          candidate: {
            ...comparisonInput().candidate,
            assessment: {
              ...comparisonInput().candidate.assessment,
              approves_expansion_or_comparison: true,
            } as never,
          },
        }),
      /invalid candidate comparison input/,
    );
    assert.throws(
      () =>
        compareLiveProductPreviewProviderUsefulness({
          ...comparisonInput(),
          candidate: {
            ...comparisonInput().candidate,
            assessment: {
              ...comparisonInput().candidate.assessment,
              safety: { ...comparisonInput().candidate.assessment.safety, live_provider_call: true },
            } as never,
          },
        }),
      /invalid candidate comparison input/,
    );
  });

  test("rejects nested assessment accessors and private-shaped fields without invoking getters", () => {
    const nestedGetter = comparisonInput();
    let getterReads = 0;
    Object.defineProperty(nestedGetter.candidate.assessment as unknown as Record<string, unknown>, "metrics", {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error("secret getter should not run");
      },
    });
    assert.throws(
      () => compareLiveProductPreviewProviderUsefulness(nestedGetter as never),
      /invalid candidate comparison input/,
    );
    assert.equal(getterReads, 0);

    assert.throws(
      () =>
        compareLiveProductPreviewProviderUsefulness({
          ...comparisonInput(),
          baseline: {
            ...comparisonInput().baseline,
            assessment: { ...comparisonInput().baseline.assessment, source_text: "private" } as never,
          },
        }),
      /invalid baseline comparison input/,
    );
  });
});
