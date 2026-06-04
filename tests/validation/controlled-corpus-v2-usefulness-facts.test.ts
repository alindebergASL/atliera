import assert from "node:assert/strict";
import test from "node:test";

import {
  assessControlledCorpusV2UsefulnessFacts,
  validateControlledCorpusV2UsefulnessFacts,
} from "../../src/validation/controlled-corpus-v2-usefulness-facts.ts";

const usefulFacts = [
  {
    account_ref: "acct-representative",
    role: "representative",
    output_counts: { excerpts: 3, claims: 2, account_objects: 1 },
    hard_invariants: {
      v2_contract_validated: true,
      canonical_account_ref: true,
      no_invented_ids: true,
      all_claims_supported: true,
      all_account_objects_supported: true,
      no_private_leakage: true,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
    },
  },
  {
    account_ref: "acct-edge-case",
    role: "edge-case",
    output_counts: { excerpts: 3, claims: 2, account_objects: 1 },
    hard_invariants: {
      v2_contract_validated: true,
      canonical_account_ref: true,
      no_invented_ids: true,
      all_claims_supported: true,
      all_account_objects_supported: true,
      no_private_leakage: true,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
    },
  },
  {
    account_ref: "acct-calibration",
    role: "calibration",
    output_counts: { excerpts: 3, claims: 3, account_objects: 1 },
    hard_invariants: {
      v2_contract_validated: true,
      canonical_account_ref: true,
      no_invented_ids: true,
      all_claims_supported: true,
      all_account_objects_supported: true,
      no_private_leakage: true,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
    },
  },
] as const;

test("validates sanitized per-account v2 usefulness facts and summarizes a useful corpus without authorizing next actions", () => {
  const facts = validateControlledCorpusV2UsefulnessFacts([...usefulFacts]);
  const assessment = assessControlledCorpusV2UsefulnessFacts(facts);

  assert.equal(assessment.ok, true);
  assert.equal(assessment.status, "pass");
  assert.equal(assessment.overall_classification, "useful_bounded_signal");
  assert.equal(assessment.metrics.total_accounts, 3);
  assert.equal(assessment.metrics.useful_accounts, 3);
  assert.equal(assessment.metrics.weak_accounts, 0);
  assert.equal(assessment.metrics.hard_blocked_accounts, 0);
  assert.deepEqual(assessment.metrics.roles, { representative: 1, "edge-case": 1, calibration: 1 });
  assert.deepEqual(assessment.metrics.output_counts, { excerpts: 9, claims: 7, account_objects: 3 });
  assert.equal(assessment.safety.provider_calls_executed_by_assessment, 0);
  assert.equal(assessment.safety.provider_spend_by_assessment, false);
  assert.equal(assessment.safety.raw_or_model_output_read_by_assessment, false);
  assert.equal(assessment.safety.authorizes_product_preview_run, false);
  assert.equal(assessment.safety.authorizes_provider_call, false);
  assert.equal(assessment.safety.authorizes_default_model_selection, false);
  assert.equal(assessment.launch_readiness_claim, false);

  assert.throws(() => {
    (facts as unknown as unknown[]).push({});
  }, /Cannot add property|object is not extensible/i);
});

test("classifies structurally valid but weak per-account facts without approving product preview", () => {
  const weakFacts = structuredClone(usefulFacts) as unknown as unknown[];
  (weakFacts[1] as { soft_quality: { lens_usefulness: boolean } }).soft_quality.lens_usefulness = false;

  const assessment = assessControlledCorpusV2UsefulnessFacts(
    validateControlledCorpusV2UsefulnessFacts(weakFacts),
  );

  assert.equal(assessment.ok, false);
  assert.equal(assessment.status, "weak-but-valid");
  assert.equal(assessment.overall_classification, "weak_but_structurally_valid");
  assert.equal(assessment.metrics.useful_accounts, 2);
  assert.equal(assessment.metrics.weak_accounts, 1);
  assert.equal(assessment.metrics.hard_blocked_accounts, 0);
  assert.equal(assessment.safety.authorizes_product_preview_run, false);
});

test("fails closed for hard invariant blockers instead of hiding them as weak usefulness", () => {
  const blockedFacts = structuredClone(usefulFacts) as unknown as unknown[];
  (blockedFacts[0] as { hard_invariants: { all_account_objects_supported: boolean } }).hard_invariants.all_account_objects_supported = false;

  const assessment = assessControlledCorpusV2UsefulnessFacts(
    validateControlledCorpusV2UsefulnessFacts(blockedFacts),
  );

  assert.equal(assessment.ok, false);
  assert.equal(assessment.status, "fail");
  assert.equal(assessment.overall_classification, "hard_invariant_blocked");
  assert.equal(assessment.metrics.hard_blocked_accounts, 1);
  assert.equal(assessment.safety.authorizes_provider_call, false);
});

test("rejects malformed, private-shaped, duplicate, and role-incomplete sanitized fact inputs", () => {
  for (const bad of [
    [],
    [usefulFacts[0], usefulFacts[1]],
    [{ ...usefulFacts[0], api_key: "not allowed" }, usefulFacts[1], usefulFacts[2]],
    [{ ...usefulFacts[0], account_ref: "acct/repr" }, usefulFacts[1], usefulFacts[2]],
    [usefulFacts[0], { ...usefulFacts[1], account_ref: "acct-representative" }, usefulFacts[2]],
    [usefulFacts[0], { ...usefulFacts[1], role: "representative" }, usefulFacts[2]],
    [usefulFacts[0], usefulFacts[1], { ...usefulFacts[2], output_counts: { excerpts: -1, claims: 3, account_objects: 1 } }],
  ]) {
    assert.throws(
      () => validateControlledCorpusV2UsefulnessFacts(bad),
      /controlled-corpus v2 usefulness facts rejected/i,
    );
  }
});

test("rejects accessor-backed inputs without leaking getter details or reading process.env", () => {
  const hostile = structuredClone(usefulFacts) as unknown as unknown[];
  Object.defineProperty(hostile[0], "account_ref", {
    enumerable: true,
    get() {
      throw new Error("leaked account getter detail");
    },
  });

  const originalEnv = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });
  try {
    assert.throws(
      () => validateControlledCorpusV2UsefulnessFacts(hostile),
      (error: unknown) => error instanceof Error &&
        /controlled-corpus v2 usefulness facts rejected/i.test(error.message) &&
        !/leaked account getter detail/i.test(error.message),
    );
  } finally {
    if (originalEnv) Object.defineProperty(process, "env", originalEnv);
  }
});
