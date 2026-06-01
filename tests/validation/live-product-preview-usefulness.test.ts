import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assessLiveProductPreviewUsefulness,
  type LiveProductPreviewUsefulnessInput,
} from "../../src/validation/live-product-preview-usefulness.ts";

function usefulInput(): LiveProductPreviewUsefulnessInput {
  return {
    preview_ref: "live-product-preview-20260528a",
    account_count: 1,
    provider_calls_executed: 1,
    output_counts: { excerpts: 1, claims: 1, account_objects: 1 },
    validation_status: {
      activation_gates: "passed",
      credential_status: "passed",
      provider_call: "passed",
      response_contract: "passed",
      cost_ledger: "succeeded",
      graph_validation: "passed",
      quality_gate: "pass",
      full_pipeline_packaging: "passed",
      bootstrap_evidence_verifier: "passed",
      workshop_preview: "passed",
    },
    request_surface: {
      tools_or_plugins_requested: false,
      online_model_variant_requested: false,
      web_search_requested: false,
    },
    workshop_surface: {
      html_rendered: true,
      provider_calls_made: 0,
      production_writes: false,
      useful_lens_count: 2,
      useful_lenses: ["signals", "plays"],
    },
    runtime_model_mode_integration: false,
  };
}

describe("live product preview usefulness gate", () => {
  test("classifies an already-sanitized one-run product preview as useful without approving expansion", () => {
    const assessment = assessLiveProductPreviewUsefulness(usefulInput());

    assert.equal(assessment.ok, true);
    assert.equal(assessment.status, "pass");
    assert.equal(assessment.preview_usefulness_classification, "useful");
    assert.deepEqual(assessment.reasons, []);
    assert.deepEqual(assessment.metrics, {
      account_count: 1,
      provider_calls_executed: 1,
      output_counts: { excerpts: 1, claims: 1, account_objects: 1 },
      useful_lens_count: 2,
      useful_lenses: ["signals", "plays"],
    });
    assert.deepEqual(assessment.safety, {
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
      provider_or_model_comparison: false,
      corpus_expansion: false,
      product_preview_expansion: false,
      web_search_or_tools: false,
    });
    assert.equal(assessment.launch_readiness_claim, false);
    assert.equal(assessment.product_readiness_claim, false);
    assert.equal(assessment.production_readiness_claim, false);
    assert.equal(assessment.approves_expansion_or_comparison, false);
  });

  test("classifies passed substrate with weak Workshop lens coverage as weak-but-valid", () => {
    const input = usefulInput();
    input.workshop_surface = { ...input.workshop_surface, useful_lens_count: 1, useful_lenses: ["signals"] };

    const assessment = assessLiveProductPreviewUsefulness(input);

    assert.equal(assessment.ok, false);
    assert.equal(assessment.status, "fail");
    assert.equal(assessment.preview_usefulness_classification, "weak-but-valid");
    assert.deepEqual(
      assessment.reasons.map((reason) => reason.code),
      ["insufficient_useful_lenses"],
    );
    assert.equal(assessment.reasons[0]?.observed, 1);
    assert.equal(assessment.reasons[0]?.threshold, 2);
    assert.equal(assessment.launch_readiness_claim, false);
    assert.equal(assessment.approves_expansion_or_comparison, false);
  });

  test("fails closed for contract failure and unsafe request-surface broadening", () => {
    const failed = usefulInput();
    failed.validation_status = { ...failed.validation_status, response_contract: "failed" };
    assert.equal(assessLiveProductPreviewUsefulness(failed).preview_usefulness_classification, "contract-failure");

    const toolBroadening = usefulInput();
    toolBroadening.request_surface = { ...toolBroadening.request_surface, web_search_requested: true };
    const assessment = assessLiveProductPreviewUsefulness(toolBroadening);
    assert.equal(assessment.preview_usefulness_classification, "contract-failure");
    assert.equal(assessment.safety.web_search_or_tools, false);
    assert.deepEqual(
      assessment.reasons.map((reason) => reason.code),
      ["request_surface_broadened"],
    );
  });

  test("classifies a sanitized multi-account product preview batch as useful without approving expansion", () => {
    const input = usefulInput();
    input.preview_ref = "live-product-preview-broader-batch-20260529b";
    input.account_count = 3;
    input.provider_calls_executed = 3;
    input.output_counts = { excerpts: 9, claims: 9, account_objects: 9 };
    input.slot_output_counts = [
      { role: "representative", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "edge-case", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "calibration", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
    ];
    input.workshop_surface = { ...input.workshop_surface, useful_lens_count: 3, useful_lenses: ["signals", "maps", "plays"] };

    const assessment = assessLiveProductPreviewUsefulness(input);

    assert.equal(assessment.ok, true);
    assert.equal(assessment.status, "pass");
    assert.equal(assessment.preview_usefulness_classification, "useful");
    assert.deepEqual(assessment.reasons, []);
    assert.deepEqual(assessment.metrics, {
      account_count: 3,
      provider_calls_executed: 3,
      output_counts: { excerpts: 9, claims: 9, account_objects: 9 },
      slot_output_counts: [
        { role: "representative", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
        { role: "edge-case", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
        { role: "calibration", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      ],
      useful_lens_count: 3,
      useful_lenses: ["signals", "maps", "plays"],
    });
    assert.equal(assessment.launch_readiness_claim, false);
    assert.equal(assessment.product_readiness_claim, false);
    assert.equal(assessment.production_readiness_claim, false);
    assert.equal(assessment.approves_expansion_or_comparison, false);
    assert.equal(assessment.safety.live_provider_call, false);
    assert.equal(assessment.safety.product_preview_expansion, false);
  });

  test("classifies multi-account batches with per-account graph underproduction as weak-but-valid", () => {
    const input = usefulInput();
    input.preview_ref = "live-product-preview-broader-batch-20260529b";
    input.account_count = 3;
    input.provider_calls_executed = 3;
    input.output_counts = { excerpts: 9, claims: 8, account_objects: 9 };
    input.slot_output_counts = [
      { role: "representative", output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "edge-case", output_counts: { excerpts: 3, claims: 0, account_objects: 3 } },
      { role: "calibration", output_counts: { excerpts: 3, claims: 5, account_objects: 3 } },
    ];
    input.workshop_surface = { ...input.workshop_surface, useful_lens_count: 3, useful_lenses: ["signals", "maps", "plays"] };

    const assessment = assessLiveProductPreviewUsefulness(input);

    assert.equal(assessment.ok, false);
    assert.equal(assessment.status, "fail");
    assert.equal(assessment.preview_usefulness_classification, "weak-but-valid");
    assert.deepEqual(
      assessment.reasons.map((reason) => reason.code),
      ["underproduced_graph_output"],
    );
    assert.equal(assessment.reasons[0]?.observed, 0);
    assert.equal(assessment.reasons[0]?.threshold, 1);
    assert.equal(assessment.approves_expansion_or_comparison, false);
  });

  test("rejects malformed and hostile sanitized inputs before assessment", () => {
    assert.throws(
      () => assessLiveProductPreviewUsefulness({ ...usefulInput(), preview_ref: "../private" }),
      /safe live product preview ref/,
    );
    assert.throws(
      () => assessLiveProductPreviewUsefulness({ ...usefulInput(), account_count: 0, provider_calls_executed: 0 }),
      /account_count must be between 1 and 9/,
    );
    assert.throws(
      () => assessLiveProductPreviewUsefulness({ ...usefulInput(), account_count: 10, provider_calls_executed: 10 }),
      /account_count must be between 1 and 9/,
    );
    assert.throws(
      () => assessLiveProductPreviewUsefulness({ ...usefulInput(), account_count: 3, provider_calls_executed: 2 }),
      /provider_calls_executed must equal account_count/,
    );

    assert.throws(
      () => assessLiveProductPreviewUsefulness({ ...usefulInput(), account_count: 3, provider_calls_executed: 3 }),
      /slot_output_counts required for multi-account preview input/,
    );
    assert.throws(
      () =>
        assessLiveProductPreviewUsefulness({
          ...usefulInput(),
          account_count: 3,
          provider_calls_executed: 3,
          slot_output_counts: [
            { role: "representative", output_counts: { excerpts: 1, claims: 1, account_objects: 1 } },
            { role: "representative", output_counts: { excerpts: 1, claims: 1, account_objects: 1 } },
            { role: "calibration", output_counts: { excerpts: 1, claims: 1, account_objects: 1 } },
          ],
        }),
      /slot_output_counts must contain distinct roles/,
    );

    assert.throws(
      () => assessLiveProductPreviewUsefulness({ ...usefulInput(), provider_endpoint: "https://provider.example.invalid" }),
      /invalid live product preview input/,
    );
    assert.throws(
      () =>
        assessLiveProductPreviewUsefulness({
          ...usefulInput(),
          request_surface: { ...usefulInput().request_surface, tool_choice: "auto" },
        }),
      /invalid live product preview input/,
    );
    const symbolic = usefulInput() as unknown as Record<string | symbol, unknown>;
    symbolic[Symbol.for("provider") as symbol] = "hidden";
    assert.throws(() => assessLiveProductPreviewUsefulness(symbolic), /invalid live product preview input/);

    const hostile = usefulInput() as unknown as Record<string, unknown>;
    Object.defineProperty(hostile, "preview_ref", {
      enumerable: true,
      get() {
        throw new Error("secret getter should be sanitized");
      },
    });
    assert.throws(() => assessLiveProductPreviewUsefulness(hostile), /invalid live product preview input/);
  });

  test("rejects accessor-backed and non-enumerable useful lens entries without invoking getters", () => {
    const input = usefulInput();
    const hostileLenses: string[] = ["signals", "plays"];
    let getterReads = 0;
    Object.defineProperty(hostileLenses, "0", {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error("secret lens getter should not run");
      },
    });
    input.workshop_surface = { ...input.workshop_surface, useful_lenses: hostileLenses as never };

    assert.throws(() => assessLiveProductPreviewUsefulness(input), /invalid live product preview input/);
    assert.equal(getterReads, 0);

    const nonEnumerable = usefulInput();
    const hiddenIndex: string[] = ["signals", "plays"];
    Object.defineProperty(hiddenIndex, "1", {
      value: "plays",
      enumerable: false,
      configurable: true,
      writable: true,
    });
    nonEnumerable.workshop_surface = { ...nonEnumerable.workshop_surface, useful_lenses: hiddenIndex as never };
    assert.throws(() => assessLiveProductPreviewUsefulness(nonEnumerable), /invalid live product preview input/);
  });
});
