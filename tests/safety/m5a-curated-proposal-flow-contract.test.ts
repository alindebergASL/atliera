// M5a step 1 — curated-source proposal-flow contract safety check.
//
// Locks the typed shape, the structural success-criterion claims, the
// Path-1 closed boundary markers, and the runbook's load-bearing
// claims in greppable form. The contract is no-call and disposable;
// this test exercises only the builder + the runbook + the index.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  buildM5aCuratedProposalFlowContract,
  canonicalM5aCuratedProposalFlowContractArtifactId,
  M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME,
  M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION,
  M5A_MAX_PLAIN_ARRAY_LENGTH,
  M5A_NEXT_REQUIRED_ARTIFACT,
  M5A_PINNED_CURATION_ORIGIN,
  M5A_PINNED_MEDIATION_GATE_LEVEL,
  M5A_PINNED_PER_RECORD_PROVENANCE_STATUS,
  M5A_PINNED_ROW_TRUST_LABEL,
  M5A_PINNED_TARGET_STORE,
  M5aContractBuilderRefusal,
  snapshotPlainArray,
  verifyM5aCuratedProposalFlowContract,
} from "../../src/workshop/m5a-curated-proposal-flow-contract.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/m5a-curated-proposal-flow-contract-status.md");
const INDEX = join(ROOT, "docs/runbooks/INDEX.md");
const MODULE = join(ROOT, "src/workshop/m5a-curated-proposal-flow-contract.ts");
const MATERIALIZATION_INPUT_FIXTURE = join(
  ROOT,
  "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json",
);

const FLOW_ID = "m5a-acme-robotics-20260617a";
const NOW = "2026-06-17T00:00:00Z";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function loadCommittedMaterializationInput(): Record<string, unknown> {
  return JSON.parse(readFileSync(MATERIALIZATION_INPUT_FIXTURE, "utf8")) as Record<string, unknown>;
}

function mutate<T>(base: T, fn: (clone: any) => void): T {
  const clone = JSON.parse(JSON.stringify(base)) as T;
  fn(clone);
  return clone;
}

describe("M5a contract — pinned constants", () => {
  test("the module exports the load-bearing constants under their pinned values", () => {
    assert.equal(M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME, "m5a-curated-proposal-flow-contract");
    assert.equal(
      M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION,
      "atliera.m5a_curated_proposal_flow_contract.v1",
    );
    assert.equal(M5A_NEXT_REQUIRED_ARTIFACT, "m5a-curated-proposal-flow-approval-packet");
    assert.equal(M5A_PINNED_CURATION_ORIGIN, "hand-curated-public");
    assert.equal(M5A_PINNED_MEDIATION_GATE_LEVEL, "L0");
    assert.equal(M5A_PINNED_TARGET_STORE, "local-durable-db");
    assert.equal(M5A_PINNED_ROW_TRUST_LABEL, "model-proposed-human-ratified-evidence-pending");
    assert.equal(M5A_PINNED_PER_RECORD_PROVENANCE_STATUS, "source_document_only");
  });
});

describe("M5a contract — happy path against the committed M3-step-3a materialization input", () => {
  test("the existing committed curated materialization input passes the M5a contract builder unchanged", () => {
    const input = loadCommittedMaterializationInput();
    const contract = buildM5aCuratedProposalFlowContract(input, { flowId: FLOW_ID, now: NOW });

    // Identity + provenance.
    assert.equal(contract.kind, M5A_CURATED_PROPOSAL_FLOW_CONTRACT_NAME);
    assert.equal(contract.schema_version, M5A_CURATED_PROPOSAL_FLOW_CONTRACT_SCHEMA_VERSION);
    assert.equal(contract.source_materialization_input_origin, M5A_PINNED_CURATION_ORIGIN);
    assert.equal(contract.next_required_artifact, M5A_NEXT_REQUIRED_ARTIFACT);
    assert.equal(contract.account_id, "acc_acme_robotics");
    assert.equal(contract.proposal_set_id, "public-curated-20260611a");
    assert.equal(contract.flow_id, FLOW_ID);
    assert.equal(contract.contracted_at, NOW);
    assert.equal(
      contract.contract_artifact_id,
      canonicalM5aCuratedProposalFlowContractArtifactId(
        contract.proposal_set_id,
        contract.account_id,
        contract.flow_id,
      ),
    );
    assert.match(contract.contract_artifact_id, /^m5a-flow-contract:[a-f0-9]{40}$/);

    // All top-level closed boundary markers.
    assert.equal(contract.provider_calls_made, 0);
    assert.equal(contract.private_evidence_read, false);
    assert.equal(contract.graph_ingestion_performed, false);
    assert.equal(contract.durable_writes_performed, false);
    assert.equal(contract.production_writes, false);
    assert.equal(contract.readiness_claim, false);
    assert.equal(contract.disposable, true);
    assert.equal(contract.current_effective_authorization, "none");
  });

  test("the boundaries object closes every required marker including the Path-1 markers", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const b = contract.boundaries;
    assert.equal(b.current_effective_authorization, "none");
    assert.equal(b.authorizes_provider_call, false);
    assert.equal(b.authorizes_private_evidence_read, false);
    assert.equal(b.authorizes_graph_ingestion, false);
    assert.equal(b.authorizes_durable_write_execution, false);
    assert.equal(b.graph_ingestion_performed, false);
    assert.equal(b.durable_write_execution_performed, false);
    assert.equal(b.durable_writes_performed, false);
    assert.equal(b.production_writes, false);
    assert.equal(b.readiness_claim, false);
    assert.equal(b.provider_calls_executed, 0);
    // The two Path-1 structural enforcement markers — operator shape
    // requirement 2026-06-17.
    assert.equal(b.forbids_fresh_provider_call_on_flow_path, true);
    assert.equal(b.fresh_provider_call_on_flow_path_executed, false);
    // The M4-acquisition-class closure markers.
    assert.equal(b.authorizes_system_side_acquisition, false);
    assert.equal(b.system_side_acquisition_performed, false);
    // Contract-shape markers.
    assert.equal(b.defines_curated_proposal_flow_contract, true);
    assert.equal(b.authorizes_flow_execution, false);
    assert.equal(b.flow_execution_performed, false);
    assert.equal(b.requires_separate_flow_approval_packet, true);
  });

  test("the five flow stages are present in canonical order with their closed markers", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const kinds = contract.flow_stages.map((s) => s.kind);
    assert.deepEqual(kinds, ["materialize", "validate", "ratify", "durable_write", "render"]);

    // Only the durable_write stage flips the durable_writes_performed
    // marker; only the render stage flips rendered_from_durable_state;
    // every other stage is non-marker-flipping.
    const flips = Object.fromEntries(contract.flow_stages.map((s) => [s.kind, s.flips_marker]));
    assert.equal(flips.materialize, null);
    assert.equal(flips.validate, null);
    assert.equal(flips.ratify, null);
    assert.equal(flips.durable_write, "durable_writes_performed");
    assert.equal(flips.render, "rendered_from_durable_state");

    // Every stage closes the same three stage-level markers.
    for (const stage of contract.flow_stages) {
      assert.equal(stage.stage_closed_markers.authorizes_provider_call, false);
      assert.equal(stage.stage_closed_markers.authorizes_system_side_acquisition, false);
      assert.equal(stage.stage_closed_markers.readiness_claim, false);
    }
  });

  test("curated_provenance_requirements expresses the typed property and the forbidden per-record provenance set", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const r = contract.curated_provenance_requirements;
    assert.equal(r.required_materialization_origin, M5A_PINNED_CURATION_ORIGIN);
    assert.equal(r.required_render_label_text, "Curated public source");
    assert.equal(r.required_per_card_curated_marker_data_attribute, "data-curated-provenance");
    assert.deepEqual(r.forbidden_per_record_provenance_statuses, ["verified"]);
  });

  test("success_criterion expresses every structural claim as a literal true (typed-property-not-prose discipline)", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const s = contract.success_criterion;
    assert.equal(s.all_stages_completed, true);
    assert.equal(s.minimum_populated_lenses, 2);
    assert.equal(s.minimum_ratified_durable_records, 2);
    // The five typed-property-not-prose claims operator-required 2026-06-17.
    assert.equal(s.curated_provenance_must_be_surfaced_per_card, true);
    assert.equal(s.forbids_verified_per_record_provenance_in_render, true);
    assert.equal(s.forbids_fresh_provider_call_on_any_stage, true);
    assert.equal(s.forbids_system_side_acquisition_on_any_stage, true);
  });

  test("approval_packet_shape inherits the Path-1 marker so step 2 cannot quietly relax it", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const p = contract.approval_packet_shape;
    assert.equal(p.required_kind, "m5a-curated-proposal-flow-approval-packet");
    assert.equal(p.must_reference_contract_artifact_id, contract.contract_artifact_id);
    assert.equal(p.must_reference_materialization_input_proposal_set_id, contract.proposal_set_id);
    assert.equal(p.must_reference_account_id, contract.account_id);
    assert.equal(p.drafted_and_unarmed_by_default, true);
    assert.equal(p.max_flow_executions, 1);
    assert.equal(p.retry_budget, 0);
    assert.equal(p.retry_requires_new_approval, true);
    assert.equal(p.expiry_required, true);
    assert.equal(p.operator_arming_required_for_flow_execution, true);
    // Inheritance — step 2 cannot drop these.
    assert.equal(p.inherits_forbids_fresh_provider_call_on_flow_path, true);
    assert.equal(p.inherits_forbids_system_side_acquisition, true);
    assert.equal(p.mediation_gate_level, M5A_PINNED_MEDIATION_GATE_LEVEL);
    assert.equal(p.target_store, M5A_PINNED_TARGET_STORE);
  });

  test("counts surface the input's actual numbers and pin the contract's execution counts to zero", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const c = contract.counts;
    // Surfaced from the input — exact values match the committed
    // fixture (1 source, 2 excerpts, plus claims and possibly account
    // objects).
    assert.ok(c.curated_source_count >= 1);
    assert.ok(c.proposed_excerpt_count >= 1);
    assert.ok(c.proposed_claim_count >= 1);
    assert.ok(c.proposed_account_object_count >= 0);
    // Contract-level execution counts pinned.
    assert.equal(c.described_flow_executions, 1);
    assert.equal(c.flows_executed, 0);
    assert.equal(c.durable_writes_executed, 0);
    assert.equal(c.fresh_provider_calls_on_flow_path, 0);
  });
});

describe("M5a contract — builder refuses every enumerated reject path", () => {
  function baseInput(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(loadCommittedMaterializationInput())) as Record<string, unknown>;
  }

  test("refuses a non-object materialization input", () => {
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(null as unknown, { flowId: FLOW_ID, now: NOW }),
      /plain own-data object/,
    );
    assert.throws(
      () => buildM5aCuratedProposalFlowContract([] as unknown, { flowId: FLOW_ID, now: NOW }),
      /plain own-data object/,
    );
  });

  test("refuses a materialization input lacking the pinned `hand-curated-public` origin (the structural curated-provenance gate)", () => {
    const bad = baseInput();
    (bad.context as Record<string, unknown>).origin = "system-acquired";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
      /hand-curated-public/,
    );
  });

  test("refuses an unsafe account_id, proposal_set_id, or materialized_at", () => {
    const badAccount = baseInput();
    (badAccount.context as Record<string, unknown>).account_id = "../etc/passwd";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(badAccount, { flowId: FLOW_ID, now: NOW }),
      /account_id/,
    );
    const badSet = baseInput();
    (badSet.context as Record<string, unknown>).proposal_set_id = "not safe!";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(badSet, { flowId: FLOW_ID, now: NOW }),
      /proposal_set_id/,
    );
    const badTimestamp = baseInput();
    (badTimestamp.context as Record<string, unknown>).materialized_at = "yesterday";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(badTimestamp, { flowId: FLOW_ID, now: NOW }),
      /materialized_at/,
    );
  });

  test("refuses empty public_sources, proposed_excerpts, or proposed_claims arrays", () => {
    for (const key of ["public_sources", "proposed_excerpts", "proposed_claims"]) {
      const bad = baseInput();
      bad[key] = [];
      assert.throws(
        () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
        new RegExp(key),
      );
    }
  });

  test("refuses an unsafe flowId or malformed `now` timestamp", () => {
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowContract(baseInput(), { flowId: "not safe!", now: NOW }),
      /flowId/,
    );
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowContract(baseInput(), { flowId: FLOW_ID, now: "tomorrow" }),
      /now/,
    );
  });
});

describe("M5a contract — canonical account-distinct identity and bounded array snapshots", () => {
  test("different accounts produce distinct canonical contract IDs", () => {
    const inputA = loadCommittedMaterializationInput();
    const inputB = loadCommittedMaterializationInput();
    (inputB.context as Record<string, unknown>).account_id = "acc_other_honest_account";
    const contractA = buildM5aCuratedProposalFlowContract(inputA, { flowId: FLOW_ID, now: NOW });
    const contractB = buildM5aCuratedProposalFlowContract(inputB, { flowId: FLOW_ID, now: NOW });

    assert.equal(contractA.proposal_set_id, contractB.proposal_set_id);
    assert.equal(contractA.flow_id, contractB.flow_id);
    assert.notEqual(contractA.account_id, contractB.account_id);
    assert.notEqual(contractA.contract_artifact_id, contractB.contract_artifact_id);
  });

  test("longest valid identity inputs still produce a SAFE_ID contract ID", () => {
    const longestSafeId = `a${"x".repeat(120)}`;
    const id = canonicalM5aCuratedProposalFlowContractArtifactId(
      longestSafeId,
      longestSafeId,
      longestSafeId,
    );
    assert.ok(id.length <= 121);
    assert.match(id, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/);
    assert.match(id, /^m5a-flow-contract:[a-f0-9]{40}$/);
  });

  test("legacy and arbitrary safe-shaped contract IDs are refused", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    for (const forgedId of [
      `m5a-flow-contract:${contract.proposal_set_id}:${contract.flow_id}`,
      "m5a-flow-contract:forged-safe-id",
    ]) {
      assert.throws(
        () => verifyM5aCuratedProposalFlowContract(mutate(contract, (c) => {
          c.contract_artifact_id = forgedId;
        })),
        M5aContractBuilderRefusal,
      );
    }
  });

  test("sparse arrays refuse by type without reading an accessor-backed index", () => {
    const sparse: unknown[] = [];
    sparse.length = 4;
    let indexRead = false;
    Object.defineProperty(sparse, "3", {
      enumerable: true,
      configurable: true,
      get() {
        indexRead = true;
        throw new Error("UNEXPECTED_SPARSE_INDEX_READ");
      },
    });

    assert.throws(() => snapshotPlainArray(sparse, "sparse"), M5aContractBuilderRefusal);
    assert.equal(indexRead, false);
  });

  test("oversized arrays refuse by type before allocation or index reads", () => {
    const oversized: unknown[] = [];
    oversized.length = M5A_MAX_PLAIN_ARRAY_LENGTH + 1;
    let indexRead = false;
    Object.defineProperty(oversized, "0", {
      enumerable: true,
      configurable: true,
      get() {
        indexRead = true;
        throw new Error("UNEXPECTED_OVERSIZED_INDEX_READ");
      },
    });

    assert.throws(
      () => snapshotPlainArray(oversized, "oversized"),
      (error: unknown) =>
        error instanceof M5aContractBuilderRefusal &&
        error.detail.includes(String(M5A_MAX_PLAIN_ARRAY_LENGTH)),
    );
    assert.equal(indexRead, false);
  });
});

describe("M5a contract — approval_packet_shape carries POSITIVE trust-tier pins (not only the negative prohibition)", () => {
  test("approval_packet_shape requires the row trust label as a POSITIVE pin", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const p = contract.approval_packet_shape;
    assert.equal(p.required_row_trust_label, M5A_PINNED_ROW_TRUST_LABEL);
    assert.equal(p.required_row_trust_label, "model-proposed-human-ratified-evidence-pending");
  });

  test("approval_packet_shape requires the per-record provenance status as a POSITIVE pin", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const p = contract.approval_packet_shape;
    assert.equal(p.required_per_record_provenance_status, M5A_PINNED_PER_RECORD_PROVENANCE_STATUS);
    assert.equal(p.required_per_record_provenance_status, "source_document_only");
  });

  test("approval_packet_shape ALSO carries the negative prohibition (verified is forbidden), but the positive pins are what step 2 must conform to", () => {
    const contract = buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
    const p = contract.approval_packet_shape;
    assert.deepEqual(p.forbidden_per_record_provenance_statuses, ["verified"]);
    // The gap closed by the 2026-06-17 hardening pass: "not verified"
    // is NOT the same claim as "is this specific pending label." Both
    // appear on the packet shape; step 2 must conform to both.
  });
});

describe("M5a contract — exported runtime verifier closes the full step-1 artifact", () => {
  function legitimateContract() {
    return buildM5aCuratedProposalFlowContract(loadCommittedMaterializationInput(), {
      flowId: FLOW_ID,
      now: NOW,
    });
  }

  test("accepts builder output, whose builder verifies it before returning", () => {
    verifyM5aCuratedProposalFlowContract(legitimateContract());
    const moduleText = read(MODULE);
    assert.match(moduleText, /verifyM5aCuratedProposalFlowContract\(contract\);\s*return contract;/);
  });

  test("refuses broadened root, boundaries, stage, success, and approval shapes", () => {
    const contract = legitimateContract();
    const broadenings: Array<(counterfeit: any) => void> = [
      (counterfeit) => {
        counterfeit.current_effective_authorization = "flow-execution";
      },
      (counterfeit) => {
        counterfeit.boundaries.authorizes_provider_call = true;
      },
      (counterfeit) => {
        counterfeit.flow_stages[0].stage_closed_markers.authorizes_provider_call = true;
      },
      (counterfeit) => {
        counterfeit.success_criterion.forbids_fresh_provider_call_on_any_stage = false;
      },
      (counterfeit) => {
        counterfeit.approval_packet_shape.max_flow_executions = 2;
      },
    ];
    for (const broaden of broadenings) {
      assert.throws(
        () => verifyM5aCuratedProposalFlowContract(mutate(contract, broaden)),
        M5aContractBuilderRefusal,
      );
    }
  });

  test("refuses noncanonical contract identity, negative counts, and unknown authorization keys", () => {
    const contract = legitimateContract();
    assert.throws(
      () => verifyM5aCuratedProposalFlowContract(mutate(contract, (c) => {
        c.contract_artifact_id = "m5a-flow-contract:forged:safe";
      })),
      M5aContractBuilderRefusal,
    );
    assert.throws(
      () => verifyM5aCuratedProposalFlowContract(mutate(contract, (c) => {
        c.counts.proposed_claim_count = -1;
      })),
      M5aContractBuilderRefusal,
    );
    assert.throws(
      () => verifyM5aCuratedProposalFlowContract(mutate(contract, (c) => {
        c.counts.flows_executed = -0;
      })),
      M5aContractBuilderRefusal,
    );
    assert.throws(
      () => verifyM5aCuratedProposalFlowContract(mutate(contract, (c) => {
        c.contracted_at = "2026-06-10T23:59:59Z";
      })),
      M5aContractBuilderRefusal,
    );
    assert.throws(
      () => verifyM5aCuratedProposalFlowContract(mutate(contract, (c) => {
        c.boundaries.additional_authorization_scope = "unbounded";
      })),
      M5aContractBuilderRefusal,
    );
  });

  test("refuses nested Proxy arrays without firing get traps", () => {
    const contract = mutate(legitimateContract(), () => undefined) as any;
    let trapFired = false;
    contract.flow_stages = new Proxy(contract.flow_stages, {
      get(_target, prop) {
        trapFired = true;
        throw new Error(`UNEXPECTED_STAGE_ARRAY_GET:${String(prop)}`);
      },
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowContract(contract),
      M5aContractBuilderRefusal,
    );
    assert.equal(trapFired, false);
  });

  test("refuses deeply nested accessors without firing getters", () => {
    const contract = mutate(legitimateContract(), () => undefined) as any;
    let getterFired = false;
    const markers = contract.flow_stages[0].stage_closed_markers;
    delete markers.authorizes_provider_call;
    Object.defineProperty(markers, "authorizes_provider_call", {
      enumerable: true,
      configurable: true,
      get() {
        getterFired = true;
        throw new Error("UNEXPECTED_NESTED_CONTRACT_GETTER");
      },
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowContract(contract),
      M5aContractBuilderRefusal,
    );
    assert.equal(getterFired, false);
  });
});

describe("M5a contract — hostile-input regression suite (Hermes probes 2026-06-17)", () => {
  // Each probe below is one of the false-claim cases the green CI
  // suite missed and the independent review caught. The regression
  // suite is the actual deliverable of this hardening pass: the green
  // happy-path tests above prove the builder works on legitimate
  // inputs; these prove it fails closed on hostile ones.

  function baseInput(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(loadCommittedMaterializationInput())) as Record<string, unknown>;
  }

  test("Probe 1 — accessor-backed `context` on the root: getter does NOT fire and the builder refuses", () => {
    const bad: Record<string, unknown> = baseInput();
    let getterFired = false;
    delete bad.context;
    Object.defineProperty(bad, "context", {
      enumerable: true,
      configurable: true,
      get() {
        getterFired = true;
        throw new Error("LEAK_ROOT_CONTEXT_GETTER");
      },
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    assert.equal(getterFired, false, "root accessor getter must not fire");
  });

  test("Probe 2 — accessor-backed `origin` nested in `context`: getter does NOT fire and the builder refuses", () => {
    const bad: Record<string, unknown> = baseInput();
    let getterFired = false;
    delete (bad.context as Record<string, unknown>).origin;
    Object.defineProperty(bad.context as object, "origin", {
      enumerable: true,
      configurable: true,
      get() {
        getterFired = true;
        throw new Error("LEAK_ORIGIN_GETTER");
      },
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    assert.equal(getterFired, false, "nested accessor getter must not fire");
  });

  test("Probe 3 — Proxy-backed root materialization input: get trap does NOT fire and the builder refuses", () => {
    let trapFired = false;
    const proxy = new Proxy(baseInput(), {
      get(t, p, r) {
        trapFired = true;
        return Reflect.get(t, p, r);
      },
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(proxy, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    assert.equal(trapFired, false, "Proxy get trap must not fire");
  });

  test("Probe 4 — impossible-component timestamps are refused (regex-shape passes; Date.parse + canonical round-trip rejects)", () => {
    // The exact reviewer-reproduced impossible date: shape-clean but
    // semantically impossible.
    const badCtx: Record<string, unknown> = baseInput();
    (badCtx.context as Record<string, unknown>).materialized_at = "2026-99-99T99:99:99Z";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(badCtx, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowContract(baseInput(), {
          flowId: FLOW_ID,
          now: "2026-99-99T99:99:99Z",
        }),
      M5aContractBuilderRefusal,
    );
    // Sanity: a real impossible-but-shape-legal February 30 also refused.
    const badFeb: Record<string, unknown> = baseInput();
    (badFeb.context as Record<string, unknown>).materialized_at = "2026-02-30T00:00:00Z";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(badFeb, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
  });

  test("Probe 5 — symbol-keyed root and context are refused", () => {
    const symRoot: Record<string | symbol, unknown> = baseInput();
    symRoot[Symbol("hostile")] = "leak";
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowContract(symRoot as unknown, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    const symCtx: Record<string, unknown> = baseInput();
    (symCtx.context as Record<string | symbol, unknown>)[Symbol("hostile")] = "leak";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(symCtx, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
  });

  test("Probe 6 — accessor-backed array index on `public_sources[0]`: getter does NOT fire and the builder refuses", () => {
    const bad: Record<string, unknown> = baseInput();
    let getterFired = false;
    const arr: unknown[] = [null];
    Object.defineProperty(arr, "0", {
      enumerable: true,
      configurable: true,
      get() {
        getterFired = true;
        return null;
      },
    });
    bad.public_sources = arr;
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    assert.equal(getterFired, false, "array-index accessor getter must not fire");
  });

  test("Probe 7 — non-array `proposed_account_objects` is refused (string cannot smuggle a non-number count)", () => {
    const bad: Record<string, unknown> = baseInput();
    bad.proposed_account_objects = "not-an-array";
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    // The fixture has no proposed_account_objects; absence is fine.
    const ok = baseInput();
    delete ok.proposed_account_objects;
    const contract = buildM5aCuratedProposalFlowContract(ok, { flowId: FLOW_ID, now: NOW });
    assert.equal(typeof contract.counts.proposed_account_object_count, "number");
  });

  test("Probe 8 — TOCTOU (validate-then-reread) cannot smuggle unsafe ids/timestamps into the rendered artifact", () => {
    // Synthesize the validate-then-reread divergence: a context whose
    // account_id is accessor-backed and switches between reads. After
    // the snapshot-once-render-from-locals fix, the field is read
    // ONCE into a frozen local and the artifact carries that local —
    // the second-read value cannot reach the artifact. With the
    // hardened builder, the getter is refused outright by snapshot
    // discipline (no accessor descriptors), but the assertion below
    // ALSO confirms the artifact does not carry the second-read
    // value even in adversarial scenarios where validation could be
    // construed to have passed.
    const bad: Record<string, unknown> = baseInput();
    let reads = 0;
    delete (bad.context as Record<string, unknown>).account_id;
    Object.defineProperty(bad.context as object, "account_id", {
      enumerable: true,
      configurable: true,
      get() {
        reads += 1;
        // First read: safe. Subsequent reads: hostile. The snapshot
        // discipline refuses the getter before any read, so reads
        // stays 0 throughout.
        return reads === 1 ? "acc_acme_robotics" : "../etc/passwd";
      },
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
    assert.equal(reads, 0, "account_id getter must not be read at all");
  });

  test("Probe 9 — accessor-backed `flowId` or `now` on the options object is refused", () => {
    let optsGetterFired = false;
    const hostileOpts: Record<string, unknown> = {};
    Object.defineProperty(hostileOpts, "flowId", {
      enumerable: true,
      configurable: true,
      get() {
        optsGetterFired = true;
        return "hostile-flow-id";
      },
    });
    hostileOpts.now = NOW;
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowContract(
          baseInput(),
          hostileOpts as unknown as { flowId: string; now: string },
        ),
      M5aContractBuilderRefusal,
    );
    assert.equal(optsGetterFired, false, "options.flowId getter must not fire");
  });

  test("Probe 10 — Proxy-backed options object is refused before any get trap fires", () => {
    let trapFired = false;
    const proxyOpts = new Proxy(
      { flowId: FLOW_ID, now: NOW },
      {
        get(t, p, r) {
          trapFired = true;
          return Reflect.get(t, p, r);
        },
      },
    );
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowContract(baseInput(), proxyOpts as { flowId: string; now: string }),
      M5aContractBuilderRefusal,
    );
    assert.equal(trapFired, false, "options Proxy get trap must not fire");
  });

  test("Probe 11 — unsafe-key own property on the root or context is refused", () => {
    const bad: Record<string, unknown> = baseInput();
    Object.defineProperty(bad, "constructor", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "leak",
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowContract(bad, { flowId: FLOW_ID, now: NOW }),
      M5aContractBuilderRefusal,
    );
  });
});

describe("M5a contract — runbook and INDEX carry the load-bearing claims", () => {
  test("the status runbook records Path-1 ratification with the ADR-0003 rationale and the two structural shape requirements", () => {
    const status = read(STATUS);
    assert.match(status, /# M5a Curated Proposal Flow Contract Status/);
    assert.match(status, /Status: active/);
    // Path-1 ratification with the recorded operator rationale.
    assert.match(status, /Path 1 ratified/);
    assert.match(status, /conflate real-flow with real-time provider call/);
    assert.match(status, /ADR 0003 guards against/);
    assert.match(status, /diagnostic property that justified curated-before-acquired sequencing/);
    // Two structural shape requirements.
    assert.match(status, /Curated provenance is a typed property of the success criterion, not prose/);
    assert.match(status, /Path 1 is enforced by a closed boundary marker, not merely chosen/);
    assert.match(status, /forbids_fresh_provider_call_on_flow_path: true/);
    assert.match(status, /forbids_fresh_provider_call_on_any_stage: true/);
    // Trust-tier discipline preserved.
    assert.match(status, /forbids_verified_per_record_provenance_in_render: true/);
    assert.match(status, /model-proposed-human-ratified-evidence-pending/);
    assert.match(status, /source_document_only/);
    // The five flow stages named in order.
    assert.match(status, /`materialize` → `validate` → `ratify` → `durable_write` → `render`/);
    // Scope confirmation.
    assert.match(status, /Contract-only slice scope confirmed/);
    assert.match(status, /Namespace `src\/workshop\/m5a-\*` confirmed/);
  });

  test("the contract module is pure (no provider SDK, no network, no env, no I/O imports)", () => {
    const moduleText = read(MODULE);
    assert.ok(!/\bopenai\b/i.test(moduleText));
    assert.ok(!/\banthropic\b/i.test(moduleText));
    assert.ok(!moduleText.includes("process.env"));
    assert.ok(!moduleText.includes('"node:http"'));
    assert.ok(!moduleText.includes('"node:https"'));
    assert.ok(!moduleText.includes('"node:net"'));
    assert.ok(!moduleText.includes('"node:fs'));
    assert.ok(!moduleText.includes('"node:child_process"'));
    assert.ok(!moduleText.includes("fetch("));
    assert.ok(!moduleText.includes("require("));
  });

  test("the runbook index lists this runbook exactly once and frames it as the M5a step 1 contract-only slice", () => {
    const index = read(INDEX);
    const rowCount = index.split("| `m5a-curated-proposal-flow-contract-status.md` |").length - 1;
    assert.equal(rowCount, 1);
    const row = index
      .split("\n")
      .find((l) => l.includes("| `m5a-curated-proposal-flow-contract-status.md` |"));
    assert.ok(row);
    assert.match(row, /active/);
    assert.match(row, /M5a step 1/);
    assert.match(row, /no-call/);
  });
});
