import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assessControlledCorpusUsefulness,
  assessControlledCorpusUsefulnessAccount,
  type ControlledCorpusUsefulnessAccountInput,
} from "../../src/validation/controlled-corpus-usefulness.ts";

function usefulAccount(
  account_ref: string,
  role: ControlledCorpusUsefulnessAccountInput["role"] = "representative",
): ControlledCorpusUsefulnessAccountInput {
  return {
    account_ref,
    role,
    output_counts: { excerpts: 2, claims: 2, account_objects: 1 },
    hard_invariants: {
      no_invented_ids: true,
      provenance_required: true,
      graph_validates: true,
      no_private_leakage: true,
    },
    soft_quality: {
      materiality: true,
      specificity: true,
      account_usefulness: true,
      lens_usefulness: true,
      source_fit: true,
    },
  };
}

describe("controlled corpus usefulness assessment", () => {
  test("classifies one account from hard invariants, output counts, and soft quality", () => {
    assert.equal(assessControlledCorpusUsefulnessAccount(usefulAccount("acct-representative")).classification, "useful");

    assert.equal(
      assessControlledCorpusUsefulnessAccount({
        ...usefulAccount("acct-weak"),
        soft_quality: { ...usefulAccount("unused").soft_quality, specificity: false },
      }).classification,
      "weak-but-valid",
    );

    assert.equal(
      assessControlledCorpusUsefulnessAccount({
        ...usefulAccount("acct-zero"),
        output_counts: { excerpts: 0, claims: 0, account_objects: 0 },
      }).classification,
      "zero-output",
    );

    assert.equal(
      assessControlledCorpusUsefulnessAccount({
        ...usefulAccount("acct-invented"),
        hard_invariants: { ...usefulAccount("unused").hard_invariants, no_invented_ids: false },
      }).classification,
      "unsupported/invented",
    );

    assert.equal(
      assessControlledCorpusUsefulnessAccount({
        ...usefulAccount("acct-contract"),
        hard_invariants: { ...usefulAccount("unused").hard_invariants, graph_validates: false },
      }).classification,
      "contract failure",
    );
  });

  test("summarizes a 3-5 account corpus while preserving worst-case classification", () => {
    const summary = assessControlledCorpusUsefulness([
      usefulAccount("acct-representative", "representative"),
      {
        ...usefulAccount("acct-edge", "edge-case"),
        soft_quality: { ...usefulAccount("unused").soft_quality, materiality: false },
      },
      {
        ...usefulAccount("acct-calibration", "calibration"),
        output_counts: { excerpts: 0, claims: 0, account_objects: 0 },
      },
    ]);

    assert.equal(summary.ok, false);
    assert.equal(summary.status, "fail");
    assert.equal(summary.overall_classification, "zero-output");
    assert.equal(summary.launch_readiness_claim, false);
    assert.deepEqual(summary.safety, {
      live_provider_call: false,
      provider_spend: false,
      production_writes: false,
      runtime_model_mode_integration: false,
    });
    assert.deepEqual(summary.metrics.classification_counts, {
      useful: 1,
      "weak-but-valid": 1,
      "zero-output": 1,
      "unsupported/invented": 0,
      "contract failure": 0,
    });
    assert.deepEqual(
      summary.accounts.map((account) => [account.account_ref, account.classification]),
      [
        ["acct-representative", "useful"],
        ["acct-edge", "weak-but-valid"],
        ["acct-calibration", "zero-output"],
      ],
    );
  });

  test("requires 3-5 distinct accounts with representative, edge-case, and calibration roles", () => {
    assert.throws(
      () => assessControlledCorpusUsefulness({
        map: () => {
          throw new Error("custom map should never run");
        },
      } as unknown as ControlledCorpusUsefulnessAccountInput[]),
      /controlled corpus input must be an array/,
    );

    const arrayWithCustomMap = [
      usefulAccount("array-one", "representative"),
      usefulAccount("array-two", "edge-case"),
      usefulAccount("array-three", "calibration"),
    ];
    Object.defineProperty(arrayWithCustomMap, "map", {
      value: () => {
        throw new Error("custom array map should never run");
      },
    });
    assert.equal(assessControlledCorpusUsefulness(arrayWithCustomMap).metrics.total_accounts, 3);

    const arrayWithThrowingGetter = [
      usefulAccount("getter-one", "representative"),
      usefulAccount("getter-two", "edge-case"),
      usefulAccount("getter-three", "calibration"),
    ];
    Object.defineProperty(arrayWithThrowingGetter, "1", {
      get() {
        throw new Error("private getter detail must not leak");
      },
    });
    assert.throws(
      () => assessControlledCorpusUsefulness(arrayWithThrowingGetter),
      /controlled corpus account input rejected/,
    );

    const proxyWithThrowingLength = new Proxy([
      usefulAccount("proxy-one", "representative"),
      usefulAccount("proxy-two", "edge-case"),
      usefulAccount("proxy-three", "calibration"),
    ], {
      get(target, property, receiver) {
        if (property === "length") throw new Error("private length detail must not leak");
        return Reflect.get(target, property, receiver);
      },
    });
    assert.throws(
      () => assessControlledCorpusUsefulness(proxyWithThrowingLength),
      /controlled corpus input rejected/,
    );

    const overlongWithThrowingElement = [
      usefulAccount("too-many-one", "representative"),
      usefulAccount("too-many-two", "edge-case"),
      usefulAccount("too-many-three", "calibration"),
      usefulAccount("too-many-four", "representative"),
      usefulAccount("too-many-five", "edge-case"),
      usefulAccount("too-many-six", "calibration"),
    ];
    Object.defineProperty(overlongWithThrowingElement, "5", {
      get() {
        throw new Error("private overlong element detail must not leak");
      },
    });
    assert.throws(
      () => assessControlledCorpusUsefulness(overlongWithThrowingElement),
      /controlled corpus must contain 3-5 accounts/,
    );

    assert.throws(
      () => assessControlledCorpusUsefulness([usefulAccount("one"), usefulAccount("two")]),
      /controlled corpus must contain 3-5 accounts/,
    );

    assert.throws(
      () => assessControlledCorpusUsefulness([
        usefulAccount("same-account", "representative"),
        usefulAccount("same-account", "edge-case"),
        usefulAccount("same-account", "calibration"),
      ]),
      /controlled corpus account_ref values must be unique/,
    );

    assert.throws(
      () => assessControlledCorpusUsefulness([
        usefulAccount("one", "representative"),
        usefulAccount("two", "representative"),
        usefulAccount("three", "calibration"),
      ]),
      /controlled corpus must include representative, edge-case, and calibration accounts/,
    );
  });

  test("rejects unsafe refs, private leakage, negative counts, and non-boolean signals", () => {
    const loopbackRef = ["127", "0", "0", "1"].join(".");
    assert.throws(() => assessControlledCorpusUsefulnessAccount(usefulAccount("../private")), /safe logical account ref/);
    assert.throws(() => assessControlledCorpusUsefulnessAccount(usefulAccount(loopbackRef)), /safe logical account ref/);
    assert.throws(
      () => assessControlledCorpusUsefulnessAccount({ ...usefulAccount("acct-negative"), output_counts: { excerpts: -1, claims: 0, account_objects: 0 } }),
      /non-negative integer/,
    );
    assert.throws(
      () => assessControlledCorpusUsefulnessAccount({
        ...usefulAccount("acct-malformed"),
        account_ref: new String("acct-boxed") as unknown as string,
      }),
      /safe logical account ref/,
    );
    assert.throws(
      () => assessControlledCorpusUsefulnessAccount({
        ...usefulAccount("acct-malformed-object"),
        account_ref: {
          toString: () => "acct-coerced",
          includes: () => false,
        } as unknown as string,
      }),
      /safe logical account ref/,
    );
    assert.throws(
      () => assessControlledCorpusUsefulnessAccount({
        ...usefulAccount("acct-malformed"),
        hard_invariants: { ...usefulAccount("unused").hard_invariants, no_private_leakage: "yes" as unknown as boolean },
      }),
      /boolean/,
    );
  });

  test("snapshots untrusted account input before reporting and does not reread getters", () => {
    let accountReads = 0;
    const input = usefulAccount("acct-snapshot");
    Object.defineProperty(input, "account_ref", {
      enumerable: true,
      get() {
        accountReads += 1;
        if (accountReads > 1) throw new Error("account_ref reread leaked private detail");
        return "acct-snapshot";
      },
    });

    const result = assessControlledCorpusUsefulnessAccount(input);

    assert.equal(result.account_ref, "acct-snapshot");
    assert.equal(result.classification, "useful");
    assert.equal(accountReads, 1);
  });
});
