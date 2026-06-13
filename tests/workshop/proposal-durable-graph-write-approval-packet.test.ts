import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DRAFTED_LIFECYCLE_STATE,
  APPROVAL_PACKET_NEXT_REQUIRED_CONTRACT,
  OPERATOR_ARMING_ACTION_KIND,
  WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME,
  WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_SCHEMA_VERSION,
  buildWorkshopPublicProposalDurableGraphWriteApprovalPacket,
  type WorkshopProposalDurableWriteApprovalPacketArtifact,
} from "../../src/workshop/proposal-durable-graph-write-approval-packet.ts";
import type { WorkshopProposalDurableGraphWriteContractArtifact } from "../../src/workshop/proposal-durable-graph-write-contract.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const CONTRACT_FIXTURE = resolve(
  repoRoot,
  "fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json",
);
const PACKET_FIXTURE = resolve(
  repoRoot,
  "fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json",
);
const PARAMS = {
  approvalId: "durable-write-approval-20260613a",
  draftedAt: "2026-06-13T00:30:00Z",
  expiresAt: "2026-06-20T00:30:00Z",
};

function loadContract(): WorkshopProposalDurableGraphWriteContractArtifact {
  return JSON.parse(readFileSync(CONTRACT_FIXTURE, "utf8")) as WorkshopProposalDurableGraphWriteContractArtifact;
}

function loadPacket(): WorkshopProposalDurableWriteApprovalPacketArtifact {
  return JSON.parse(readFileSync(PACKET_FIXTURE, "utf8")) as WorkshopProposalDurableWriteApprovalPacketArtifact;
}

describe("public proposal durable graph-write approval packet artifact", () => {
  test("builds a drafted, unarmed, non-authorizing packet from the contract", () => {
    const packet = buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), PARAMS);

    assert.equal(packet.kind, WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_NAME);
    assert.equal(packet.schema_version, WORKSHOP_PUBLIC_PROPOSAL_DURABLE_GRAPH_WRITE_APPROVAL_PACKET_SCHEMA_VERSION);
    assert.equal(packet.disposable, true);
    assert.equal(packet.generated_from, "workshop-public-proposal-durable-graph-write-contract");
    assert.equal(packet.current_effective_authorization, "none");
    assert.equal(packet.next_required_contract, APPROVAL_PACKET_NEXT_REQUIRED_CONTRACT);

    // The load-bearing safety properties: a drafted packet is never
    // armed, never authorizes execution, and carries a null armed_at.
    assert.equal(packet.lifecycle_state, DRAFTED_LIFECYCLE_STATE);
    assert.equal(packet.armed_at, null);

    assert.deepEqual(packet.boundaries, {
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
      defines_arming_surface: true,
      operator_armed: false,
      requires_operator_arming: true,
      authorizes_durable_write_execution: false,
      durable_write_execution_performed: false,
      arming_performed_by_this_artifact: false,
      ratification_performed: false,
      requires_separate_ratification_approval: true,
    });

    // Conformance to the contract's published approval_packet_shape.
    assert.equal(packet.contract_artifact_id, "durable-write-contract:public-curated-20260611a:2026-06-12T23:30:00Z");
    assert.equal(packet.proposal_set_id, "public-curated-20260611a");
    assert.deepEqual(packet.pinned_candidate_item_ids, ["obj_acme-hub-signal"]);
    assert.equal(packet.max_durable_writes, 1);
    assert.equal(packet.max_attempts, 1);
    assert.equal(packet.retry_budget, 0);
    assert.equal(packet.retry_requires_new_approval, true);
    assert.equal(packet.mediation_gate_level, "L0");
    assert.equal(packet.target_store, "local-durable-db");
    assert.equal(packet.expires_at, PARAMS.expiresAt);
    assert.equal(packet.drafted_at, PARAMS.draftedAt);

    // Write scope is copied from the contract, never widened.
    assert.equal(packet.write_scopes.length, 1);
    const scope = packet.write_scopes[0]!;
    assert.equal(scope.candidate_item_id, "obj_acme-hub-signal");
    assert.equal(scope.lens, "signals");
    assert.equal(scope.target_store, "local-durable-db");
    assert.equal(scope.mediation_gate_level, "L0");
    assert.deepEqual(scope.claim_ids, ["clm_acme-hub-expansion", "clm_acme-hub-logistics"]);
    assert.deepEqual(scope.excerpt_ids, ["exc_acme-hub-delivery", "exc_acme-hub-open"]);
    assert.deepEqual(scope.source_ids, ["src_acme_press_public_001"]);

    // Arming surface is DEFINED, not performed.
    const arming = packet.arming_surface;
    assert.equal(arming.required_action_kind, OPERATOR_ARMING_ACTION_KIND);
    assert.equal(arming.must_reference_approval_id, packet.approval_id);
    assert.equal(arming.must_match_contract_artifact_id, packet.contract_artifact_id);
    assert.equal(arming.must_be_invoked_by_operator_identity, true);
    assert.equal(arming.must_occur_before_expires_at, PARAMS.expiresAt);
    assert.equal(arming.transitions_lifecycle_from, "drafted");
    assert.equal(arming.transitions_lifecycle_to, "operator-armed");
    assert.equal(arming.on_arming_authorizes, "single-durable-write-attempt-under-this-packet");
    assert.equal(arming.still_requires_separate_write_execution_slice, true);
    assert.equal(arming.arming_grants_provider_call, false);
    assert.equal(arming.arming_grants_production_write, false);
    assert.equal(arming.arming_grants_readiness_claim, false);

    assert.equal(packet.counts.contracted_candidate_count, 1);
    assert.equal(packet.counts.pinned_candidate_count, 1);
    assert.equal(packet.counts.armed_count, 0);
    assert.equal(packet.counts.durable_write_count, 0);
  });

  test("committed packet fixture regenerates exactly from the committed contract fixture", () => {
    const regenerated = buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), PARAMS);
    const committed = loadPacket();
    assert.deepEqual(regenerated, committed);
  });

  test("there is no parameter that produces an armed packet (arming is a separate operator action)", () => {
    // Smuggling armed state through params is structurally inert: the
    // builder reads only approvalId/draftedAt/expiresAt and hard-codes
    // the lifecycle, so even a hostile caller passing operator_armed /
    // armed_at / lifecycle_state gets a DRAFTED, unarmed packet. This is
    // a stronger guarantee than a throw — the armed state is
    // unreachable by construction, not merely guarded.
    const hostile = buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), {
      ...PARAMS,
      lifecycle_state: "operator-armed",
      operator_armed: true,
      armed_at: "2026-06-13T01:00:00Z",
      current_effective_authorization: "operator-armed",
    } as never);
    assert.equal(hostile.lifecycle_state, "drafted");
    assert.equal(hostile.boundaries.operator_armed, false);
    assert.equal(hostile.boundaries.authorizes_durable_write_execution, false);
    assert.equal(hostile.armed_at, null);
    assert.equal(hostile.current_effective_authorization, "none");
    assert.equal(hostile.counts.armed_count, 0);
    // And it still regenerates identically to the clean build — the
    // smuggled keys left no trace.
    const clean = buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), PARAMS);
    assert.deepEqual(hostile, clean);
  });

  test("rejects a contract whose closed boundary state has broadened", () => {
    const contract = loadContract();
    const broken = {
      ...contract,
      boundaries: { ...contract.boundaries, authorizes_durable_write_execution: true as never },
    };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(broken as never, PARAMS),
      /contract\.boundaries\.authorizes_durable_write_execution not false/,
    );
  });

  test("rejects a contract whose current_effective_authorization is not none", () => {
    const contract = loadContract();
    const broken = { ...contract, current_effective_authorization: "operator-armed" as never };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(broken as never, PARAMS),
      /contract\.current_effective_authorization not "none"/,
    );
  });

  test("rejects a contract whose pinned ids disagree with its write operations", () => {
    const contract = loadContract();
    const broken = {
      ...contract,
      approval_packet_shape: {
        ...contract.approval_packet_shape,
        must_pin_candidate_item_ids: ["obj_some-other-id"],
      },
    };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(broken as never, PARAMS),
      /pinned candidate ids do not match write operations/,
    );
  });

  test("rejects an expiry that is not strictly after drafting", () => {
    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), {
          ...PARAMS,
          expiresAt: PARAMS.draftedAt,
        }),
      /expiresAt must be strictly after draftedAt/,
    );
  });

  test("rejects drafting earlier than the contract was contracted", () => {
    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), {
          ...PARAMS,
          draftedAt: "2026-06-12T00:00:00Z",
        }),
      /draftedAt precedes contract contracted_at/,
    );
  });

  test("rejects a malformed approvalId and malformed timestamps", () => {
    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), {
          ...PARAMS,
          approvalId: "not a safe id!",
        }),
      /params\.approvalId malformed/,
    );
    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(loadContract(), {
          ...PARAMS,
          expiresAt: "soon",
        }),
      /params\.expiresAt malformed/,
    );
  });

  test("rejects a contract whose write scope would upgrade trust or spoof idempotency", () => {
    const contract = loadContract();
    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(
          {
            ...contract,
            write_operations: [
              {
                ...contract.write_operations[0]!,
                trust_label_on_durable_write: "verified" as never,
              },
            ],
          } as never,
          PARAMS,
        ),
      /trust_label_on_durable_write not/,
    );

    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(
          {
            ...contract,
            write_operations: [
              {
                ...contract.write_operations[0]!,
                idempotency_key_shape: "http://example.invalid/leak" as never,
              },
            ],
          } as never,
          PARAMS,
        ),
      /idempotency_key_shape malformed/,
    );

    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(
          {
            ...contract,
            write_operations: [
              {
                ...contract.write_operations[0]!,
                account_object_id: "obj_other-safe-id" as never,
                idempotency_key_shape: "acc_acme_robotics:obj_other-safe-id:ratified-durable-write-v1" as never,
              },
            ],
          } as never,
          PARAMS,
        ),
      /account_object_id must match candidate_item_id/,
    );
  });

  test("rejects contract artifact ids that do not match the pinned proposal set and timestamp", () => {
    const contract = loadContract();
    assert.throws(
      () =>
        buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(
          {
            ...contract,
            contract_artifact_id: "durable-write-contract:public-curated-20260611a:2026-06-13T99:99:99Z",
          } as never,
          PARAMS,
        ),
      /contract_artifact_id does not match proposal_set_id and contracted_at/,
    );
  });

  test("rejects an accessor-backed hostile contract without invoking the getter", () => {
    const contract = loadContract();
    let getterInvoked = false;
    const hostile: Record<string, unknown> = { ...contract };
    Object.defineProperty(hostile, "current_effective_authorization", {
      enumerable: true,
      configurable: true,
      get() {
        getterInvoked = true;
        return "none";
      },
    });
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(hostile as never, PARAMS),
      /contract must be a plain own-data object/,
    );
    assert.equal(getterInvoked, false);
  });

  test("rejects a wrong-kind upstream artifact", () => {
    const contract = loadContract();
    const broken = { ...contract, kind: "not-a-contract" as never };
    assert.throws(
      () => buildWorkshopPublicProposalDurableGraphWriteApprovalPacket(broken as never, PARAMS),
      /contract\.kind not/,
    );
  });
});
