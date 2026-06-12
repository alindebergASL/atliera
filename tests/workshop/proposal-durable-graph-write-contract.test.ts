import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  NEXT_REQUIRED_CONTRACT,
  PINNED_DURABLE_WRITE_TRUST_LABEL,
  PINNED_MEDIATION_GATE_LEVEL,
  PINNED_TARGET_STORE,
  WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME,
  WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_SCHEMA_VERSION,
  buildWorkshopPublicProposalDurableGraphWriteContractArtifact,
  type WorkshopProposalDurableGraphWriteContractArtifact,
} from "../../src/workshop/proposal-durable-graph-write-contract.ts";
import type { WorkshopProposalRatificationPlanArtifact } from "../../src/workshop/proposal-ratification-plan.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const PLAN_FIXTURE = resolve(
  repoRoot,
  "fixtures/workshop/workshop-public-proposal-reviewed-candidate-ratification-plan.json",
);
const CONTRACT_FIXTURE = resolve(
  repoRoot,
  "fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json",
);
const CONTRACTED_AT = "2026-06-12T23:30:00Z";

function loadPlan(): WorkshopProposalRatificationPlanArtifact {
  return JSON.parse(readFileSync(PLAN_FIXTURE, "utf8")) as WorkshopProposalRatificationPlanArtifact;
}

function loadContract(): WorkshopProposalDurableGraphWriteContractArtifact {
  return JSON.parse(readFileSync(CONTRACT_FIXTURE, "utf8")) as WorkshopProposalDurableGraphWriteContractArtifact;
}

describe("public proposal durable graph-write contract artifact", () => {
  test("builds a no-call contract over the ratification plan without authorizing or performing any write", () => {
    const contract = buildWorkshopPublicProposalDurableGraphWriteContractArtifact(loadPlan(), CONTRACTED_AT);

    assert.equal(contract.kind, WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_NAME);
    assert.equal(contract.schema_version, WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_CONTRACT_SCHEMA_VERSION);
    assert.equal(contract.disposable, true);
    assert.equal(contract.generated_from, "workshop-public-proposal-reviewed-candidate-ratification-plan");
    assert.equal(contract.current_effective_authorization, "none");
    assert.equal(contract.next_required_contract, NEXT_REQUIRED_CONTRACT);

    // The contract authorizes nothing. Every closed-state marker the
    // ratification plan carries must remain closed on the contract.
    assert.deepEqual(contract.boundaries, {
      current_effective_authorization: "none",
      authorizes_provider_call: false,
      authorizes_private_evidence_read: false,
      authorizes_graph_ingestion: false,
      graph_ingestion_performed: false,
      provider_calls_executed: 0,
      private_evidence_read: false,
      durable_writes_performed: false,
      production_writes: false,
      readiness_claim: false,
      defines_durable_write_contract: true,
      authorizes_durable_write_execution: false,
      durable_write_execution_performed: false,
      requires_separate_durable_write_approval_packet: true,
      ratification_performed: false,
      plan_only: true,
      requires_separate_ratification_approval: true,
    });

    // Counts are derived, never invented; ratified/durable-write
    // counts are pinned to literal zero.
    assert.equal(contract.counts.accepted_candidate_count, 1);
    assert.equal(contract.counts.planned_candidate_count, 1);
    assert.equal(contract.counts.contracted_candidate_count, 1);
    assert.equal(contract.counts.ratified_candidate_count, 0);
    assert.equal(contract.counts.durable_write_count, 0);

    // Write-operation shape — pinned doctrine alignments and per-record state.
    assert.equal(contract.write_operations.length, 1);
    const op = contract.write_operations[0]!;
    assert.equal(op.candidate_item_id, "obj_acme-hub-signal");
    assert.equal(op.lens, "signals");
    assert.equal(op.target_store, PINNED_TARGET_STORE);
    assert.equal(op.trust_label_on_durable_write, PINNED_DURABLE_WRITE_TRUST_LABEL);
    assert.equal(op.mediation_gate_level, PINNED_MEDIATION_GATE_LEVEL);
    assert.equal(op.retry_budget, 0);
    assert.equal(op.rollback_semantics, "single-transaction-or-noop");
    assert.equal(op.authorizes_durable_write, false);
    assert.equal(op.durable_write_performed, false);
    assert.equal(op.target_record_counts.account_object, 1);
    assert.equal(op.target_record_counts.claim_count, 2);
    assert.equal(op.target_record_counts.excerpt_count, 2);
    assert.equal(op.target_record_counts.source_count, 1);
    assert.equal(op.target_record_counts.ratification_audit_event, 1);

    // Approval-packet shape — what the NEXT slice must produce.
    const ap = contract.approval_packet_shape;
    assert.equal(ap.required_kind, "workshop-public-proposal-durable-graph-write-approval-packet");
    assert.equal(ap.must_reference_contract_artifact_id, contract.contract_artifact_id);
    assert.equal(ap.must_reference_ratification_plan_proposal_set_id, contract.proposal_set_id);
    assert.deepEqual(ap.must_pin_candidate_item_ids, ["obj_acme-hub-signal"]);
    assert.equal(ap.max_durable_writes, 1);
    assert.equal(ap.max_attempts, 1);
    assert.equal(ap.retry_budget, 0);
    assert.equal(ap.retry_requires_new_approval, true);
    assert.equal(ap.expiry_required, true);
    assert.equal(ap.operator_arming_required, true);
    assert.equal(ap.mediation_gate_level, PINNED_MEDIATION_GATE_LEVEL);
    assert.equal(ap.target_store, PINNED_TARGET_STORE);
  });

  test("committed contract fixture regenerates exactly from the committed plan fixture", () => {
    const regenerated = buildWorkshopPublicProposalDurableGraphWriteContractArtifact(loadPlan(), CONTRACTED_AT);
    const committed = loadContract();
    assert.deepEqual(regenerated, committed);
  });

  test("rejects an upstream plan whose own boundary state has broadened", () => {
    const plan = loadPlan();
    const broken = {
      ...plan,
      current_effective_authorization: "operator-armed" as never,
    };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteContractArtifact(broken as never, CONTRACTED_AT),
      /current_effective_authorization not/,
    );
  });

  test("rejects an upstream plan candidate whose durable-write authorization has broadened", () => {
    const plan = loadPlan();
    const broken = {
      ...plan,
      candidates: [
        {
          ...plan.candidates[0],
          authorizes_durable_write: true as never,
        },
      ],
    };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteContractArtifact(broken as never, CONTRACTED_AT),
      /authorizes_durable_write not false/,
    );
  });

  test("rejects a malformed contractedAt", () => {
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteContractArtifact(loadPlan(), "yesterday"),
      /contractedAt malformed/,
    );
  });

  test("rejects a zero-candidate plan (the slice has nothing to contract)", () => {
    const plan = loadPlan();
    const empty = {
      ...plan,
      candidates: [],
    };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteContractArtifact(empty as never, CONTRACTED_AT),
      /carries zero candidates/,
    );
  });

  test("rejects a wrong-kind upstream artifact", () => {
    const plan = loadPlan();
    const broken = { ...plan, kind: "some-other-thing" as never };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteContractArtifact(broken as never, CONTRACTED_AT),
      /ratification_plan.kind not/,
    );
  });

  test("rejects an upstream plan that does not point at this contract step", () => {
    const plan = loadPlan();
    const broken = { ...plan, next_required_contract: "something-else" as never };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteContractArtifact(broken as never, CONTRACTED_AT),
      /next_required_contract not/,
    );
  });

  test("rejects count mismatches and stale contract timestamps", () => {
    const plan = loadPlan();
    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteContractArtifact(
          {
            ...plan,
            counts: {
              ...plan.counts,
              accepted_candidate_count: 2,
            },
          } as never,
          CONTRACTED_AT,
        ),
      /counts must match candidate count/,
    );

    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteContractArtifact(plan, "2026-06-11T12:04:59Z"),
      /contractedAt precedes upstream planned_at/,
    );
  });

  test("rejects hostile accessor-backed upstream records without invoking getters", () => {
    const plan = loadPlan();
    const hostile = { ...plan } as Record<string, unknown>;
    Object.defineProperty(hostile, "proposal_set_id", {
      enumerable: true,
      get() {
        throw new Error("getter must not execute");
      },
    });

    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteContractArtifact(
          hostile as unknown as WorkshopProposalRatificationPlanArtifact,
          CONTRACTED_AT,
        ),
      /plain own-data object/,
    );
  });
});
