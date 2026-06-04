import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { assessRuntimeSmokeSixSlotExpansionUsefulness } from "../../src/product-preview/runtime-smoke-six-slot-expansion-usefulness-assessment.ts";

const falseBoundaries = Object.freeze({
  provider_call: false,
  provider_spend: false,
  raw_private_evidence_read: false,
  network_access: false,
  graph_ingestion: false,
  production_writes: false,
  runtime_model_mode_integration: false,
  provider_comparison: false,
  default_model_selection: false,
  product_readiness_claim: false,
  launch_readiness_claim: false,
  provider_lock_in: false,
});

type Role = "representative-a" | "representative-b" | "edge-case-a" | "edge-case-b" | "calibration" | "sparse-control";

function validInput() {
  const slot = (role: Role, claims: number, accountObjects: number) => {
    const hasSignal = role !== "calibration";
    const hasPlay = role !== "sparse-control";
    const hasMap = role !== "sparse-control";
    const hasOpenQuestion = role === "edge-case-b" || role === "sparse-control";
    return {
      role,
      status: "completed",
      provider_calls_executed: 1,
      accepted_output_received: true,
      v2_contract_validated: true,
      output_counts: { excerpts: 5, claims, account_objects: accountObjects },
      object_type_counts: {
        account_snapshot: 1,
        signal: hasSignal ? 1 : 0,
        stakeholder: 0,
        initiative: 0,
        risk: 1,
        open_question: hasOpenQuestion ? 1 : 0,
        play: hasPlay ? 1 : 0,
        recommendation: 0,
        map: hasMap ? 1 : 0,
        relationship: 0,
        milestone: 0,
      },
      support_coverage: {
        excerpt_text_presence_count: 5,
        claim_text_presence_count: claims,
        claim_supported_count: claims,
        account_object_summary_presence_count: accountObjects,
        account_object_supported_count: accountObjects,
      },
    };
  };
  return {
    assessment_ref: "runtime-smoke-six-slot-expansion-usefulness-20260604g",
    status_ref: "runtime-model-only-product-preview-runtime-smoke-six-slot-expansion-20260604g",
    source_status: "completed",
    provider_calls_executed: 6,
    screened_account_slots: 6,
    completed_slot_count: 6,
    accepted_output_received: true,
    v2_contract_validated: true,
    required_slot_roles: ["representative-a", "representative-b", "edge-case-a", "edge-case-b", "calibration", "sparse-control"],
    output_counts: { excerpts: 30, claims: 19, account_objects: 29 },
    object_type_counts: {
      account_snapshot: 6,
      signal: 5,
      stakeholder: 0,
      initiative: 0,
      risk: 6,
      open_question: 2,
      play: 5,
      recommendation: 0,
      map: 5,
      relationship: 0,
      milestone: 0,
    },
    support_coverage: {
      excerpt_text_presence_count: 30,
      claim_text_presence_count: 19,
      claim_supported_count: 19,
      account_object_summary_presence_count: 29,
      account_object_supported_count: 29,
    },
    slot_statuses: [
      slot("representative-a", 3, 5),
      slot("representative-b", 3, 5),
      slot("edge-case-a", 3, 5),
      slot("edge-case-b", 4, 6),
      slot("calibration", 3, 4),
      slot("sparse-control", 3, 4),
    ],
    assessment_boundaries: falseBoundaries,
  };
}

test("classifies completed six-slot runtime smoke expansion as useful without authorizing next actions", () => {
  const result = assessRuntimeSmokeSixSlotExpansionUsefulness(validInput());
  assert.equal(result.status, "pass");
  assert.equal(result.usefulness_classification, "useful");
  assert.deepEqual(result.useful_lenses, ["signals", "maps", "plays"]);
  assert.equal(result.metrics.provider_calls_executed_by_assessment, 0);
  assert.equal(result.metrics.provider_calls_executed_source, 6);
  assert.equal(result.metrics.completed_slot_count, 6);
  assert.equal(result.metrics.output_counts.account_objects, 29);
  assert.equal(result.metrics.lens_counts.maps, 11);
  assert.equal(result.metrics.lens_counts.signals, 13);
  assert.equal(result.metrics.lens_counts.plays, 5);
  assert.equal(result.authorizes_provider_call, false);
  assert.equal(result.authorizes_retry, false);
  assert.equal(result.authorizes_product_preview_expansion, false);
  assert.equal(result.authorizes_provider_comparison, false);
  assert.equal(result.authorizes_default_model_selection, false);
  assert.equal(result.authorizes_graph_ingestion, false);
  assert.equal(result.authorizes_production_use, false);
  assert.equal(result.product_readiness_claim, false);
});

test("fails closed when required six-slot shape is missing or underproduced", () => {
  const missing = validInput();
  missing.required_slot_roles = ["representative-a", "representative-b", "edge-case-a", "edge-case-b", "calibration"];
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(missing), /required slot roles/);

  const weak = validInput();
  const weakSlot = weak.slot_statuses[5]!;
  weakSlot.output_counts.account_objects = 0;
  weakSlot.object_type_counts.account_snapshot = 0;
  weakSlot.object_type_counts.signal = 0;
  weakSlot.object_type_counts.risk = 0;
  weakSlot.object_type_counts.open_question = 0;
  weakSlot.support_coverage.account_object_summary_presence_count = 0;
  weakSlot.support_coverage.account_object_supported_count = 0;
  weak.output_counts.account_objects = 25;
  weak.object_type_counts.account_snapshot = 5;
  weak.object_type_counts.signal = 4;
  weak.object_type_counts.risk = 5;
  weak.object_type_counts.open_question = 1;
  weak.support_coverage.account_object_summary_presence_count = 25;
  weak.support_coverage.account_object_supported_count = 25;
  const assessed = assessRuntimeSmokeSixSlotExpansionUsefulness(weak);
  assert.equal(assessed.status, "fail");
  assert.equal(assessed.usefulness_classification, "weak-but-valid");
  assert.match(assessed.reasons.map((reason) => reason.code).join(","), /slot_underproduced/);
});

test("rejects malformed/private-shaped or contradictory sanitized inputs before assessment", () => {
  const extra = validInput() as Record<string, unknown>;
  extra.private_path = "/tmp/private";
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(extra), /exact keys/);

  const broadened = validInput();
  const unsafeBoundaries = { ...(falseBoundaries as unknown as Record<string, boolean>), provider_call: true } as any;
  (broadened as any).assessment_boundaries = unsafeBoundaries;
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(broadened), /must be false/);

  const inconsistent = validInput();
  inconsistent.provider_calls_executed = 7;
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(inconsistent), /provider_calls_executed/);

  const pathShaped = validInput();
  pathShaped.status_ref = "home/ubuntu/private";
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(pathShaped), /status_ref must be safe/);

  const broadenedSlots = validInput();
  broadenedSlots.slot_statuses = [...broadenedSlots.slot_statuses, { ...broadenedSlots.slot_statuses[0]! }];
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(broadenedSlots), /exactly six required roles/);

  const objectTypeMismatchSameTotal = validInput();
  objectTypeMismatchSameTotal.object_type_counts.account_snapshot = 5;
  objectTypeMismatchSameTotal.object_type_counts.relationship = 1;
  const mismatchAssessment = assessRuntimeSmokeSixSlotExpansionUsefulness(objectTypeMismatchSameTotal);
  assert.equal(mismatchAssessment.status, "fail");
  assert.equal(mismatchAssessment.usefulness_classification, "contract-failure");
  assert.match(mismatchAssessment.reasons.map((reason) => reason.code).join(","), /aggregate_count_mismatch/);

  const supportMismatchSameTotal = validInput();
  supportMismatchSameTotal.support_coverage.claim_supported_count = 18;
  supportMismatchSameTotal.support_coverage.claim_text_presence_count = 20;
  const supportAssessment = assessRuntimeSmokeSixSlotExpansionUsefulness(supportMismatchSameTotal);
  assert.equal(supportAssessment.usefulness_classification, "contract-failure");
  assert.match(supportAssessment.reasons.map((reason) => reason.code).join(","), /aggregate_count_mismatch/);

  const perSlotObjectTypeCancellation = validInput();
  perSlotObjectTypeCancellation.slot_statuses[0]!.object_type_counts.account_snapshot = 0;
  perSlotObjectTypeCancellation.slot_statuses[1]!.object_type_counts.account_snapshot = 2;
  const slotObjectTypeAssessment = assessRuntimeSmokeSixSlotExpansionUsefulness(perSlotObjectTypeCancellation);
  assert.equal(slotObjectTypeAssessment.usefulness_classification, "contract-failure");
  assert.match(slotObjectTypeAssessment.reasons.map((reason) => reason.code).join(","), /aggregate_count_mismatch/);

  const perSlotSupportCancellation = validInput();
  perSlotSupportCancellation.slot_statuses[0]!.support_coverage.claim_supported_count = 2;
  perSlotSupportCancellation.slot_statuses[1]!.support_coverage.claim_supported_count = 4;
  const slotSupportAssessment = assessRuntimeSmokeSixSlotExpansionUsefulness(perSlotSupportCancellation);
  assert.equal(slotSupportAssessment.usefulness_classification, "contract-failure");
  assert.match(slotSupportAssessment.reasons.map((reason) => reason.code).join(","), /missing_support_coverage/);
});

test("rejects accessor, symbol, and non-enumerable array fields without invoking getters", () => {
  const input = validInput();
  Object.defineProperty(input, "source_status", {
    enumerable: true,
    get() {
      throw new Error("leak getter invoked");
    },
  });
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(input), /enumerable data/);

  const symbolInput = validInput() as Record<PropertyKey, unknown>;
  symbolInput[Symbol("private")] = "hidden";
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(symbolInput), /symbol fields/);

  const arrayAccessor = validInput();
  Object.defineProperty(arrayAccessor.slot_statuses, "0", {
    enumerable: true,
    get() {
      throw new Error("array getter invoked");
    },
  });
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(arrayAccessor), /enumerable data elements/);

  const extraArrayField = validInput();
  (extraArrayField.slot_statuses as any).privateEvidence = "redacted";
  assert.throws(() => assessRuntimeSmokeSixSlotExpansionUsefulness(extraArrayField), /extra fields/);
});

test("checked runtime-smoke six-slot expansion usefulness fixtures stay in sync", () => {
  const fixtureRoot = join(import.meta.dirname, "..", "..", "fixtures", "validation");
  const input = JSON.parse(readFileSync(join(fixtureRoot, "runtime-smoke-six-slot-expansion-usefulness-input.json"), "utf8"));
  const expected = JSON.parse(readFileSync(join(fixtureRoot, "runtime-smoke-six-slot-expansion-usefulness-assessment.json"), "utf8"));
  assert.deepEqual(assessRuntimeSmokeSixSlotExpansionUsefulness(input), expected);
  assert.equal(expected.status, "pass");
  assert.equal(expected.usefulness_classification, "useful");
  assert.equal(expected.metrics.provider_calls_executed_by_assessment, 0);
  assert.equal(expected.authorizes_provider_call, false);
});
