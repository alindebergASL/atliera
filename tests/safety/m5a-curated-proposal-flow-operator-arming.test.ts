// M5a step 3 — curated-source proposal-flow operator arming safety check.
//
// Threat shape: arming-state counterfeit. This suite is deliberately not
// a replay of step 1's input-smuggling probes or step 2's packet-
// counterfeit probes. Step 3's job is to keep one verified packet drafted
// while producing a separate armed, unconsumed authorization for one future
// flow execution, without executing the flow.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  buildM5aCuratedProposalFlowContract,
  type M5aCuratedProposalFlowContractArtifact,
} from "../../src/workshop/m5a-curated-proposal-flow-contract.ts";
import {
  buildM5aCuratedProposalFlowApprovalPacket,
  type M5aCuratedProposalFlowApprovalPacketArtifact,
} from "../../src/workshop/m5a-curated-proposal-flow-approval-packet.ts";
import {
  M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE,
  M5A_OPERATOR_ARMING_KIND,
  M5A_OPERATOR_ARMING_SCHEMA_VERSION,
  M5aOperatorArmingRefusal,
  buildM5aCuratedProposalFlowOperatorArming,
  canonicalM5aOneShotConsumptionKey,
  canonicalM5aOperatorArmingArtifactId,
  verifyM5aCuratedProposalFlowOperatorArming,
  type M5aCuratedProposalFlowOperatorArmingArtifact,
} from "../../src/workshop/m5a-curated-proposal-flow-operator-arming.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/m5a-curated-proposal-flow-operator-arming-status.md");
const INDEX = join(ROOT, "docs/runbooks/INDEX.md");
const MODULE = join(ROOT, "src/workshop/m5a-curated-proposal-flow-operator-arming.ts");
const MATERIALIZATION_INPUT_FIXTURE = join(
  ROOT,
  "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json",
);

const FLOW_ID = "m5a-acme-robotics-20260617a";
const CONTRACT_NOW = "2026-06-17T00:00:00Z";
const PACKET_NOW = "2026-06-17T00:00:00Z";
const PACKET_EXPIRES = "2026-06-18T00:00:00Z";
const DRAFTED_BY = "reviewer_demo";
const ARMED_AT = "2026-06-17T01:00:00Z";
const ARMED_BY = "operator_demo";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function loadContract(flowId = FLOW_ID): M5aCuratedProposalFlowContractArtifact {
  const input = JSON.parse(read(MATERIALIZATION_INPUT_FIXTURE)) as Record<string, unknown>;
  return buildM5aCuratedProposalFlowContract(input, { flowId, now: CONTRACT_NOW });
}

function loadPacket(contract = loadContract()): M5aCuratedProposalFlowApprovalPacketArtifact {
  return buildM5aCuratedProposalFlowApprovalPacket(contract, {
    now: PACKET_NOW,
    expiresAt: PACKET_EXPIRES,
    draftedBy: DRAFTED_BY,
  });
}

function loadLegitimate(): {
  contract: M5aCuratedProposalFlowContractArtifact;
  packet: M5aCuratedProposalFlowApprovalPacketArtifact;
  arming: M5aCuratedProposalFlowOperatorArmingArtifact;
} {
  const contract = loadContract();
  const packet = loadPacket(contract);
  const arming = buildM5aCuratedProposalFlowOperatorArming(contract, packet, {
    armedAt: ARMED_AT,
    armedBy: ARMED_BY,
  });
  return { contract, packet, arming };
}

function mutate<T>(base: T, fn: (clone: any) => void): T {
  const c = JSON.parse(JSON.stringify(base)) as T;
  fn(c);
  return c;
}

function handConstructArming(
  packet: M5aCuratedProposalFlowApprovalPacketArtifact,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const armedAt = (overrides.armed_at as string | undefined) ?? ARMED_AT;
  const armedBy = (overrides.armed_by as string | undefined) ?? ARMED_BY;
  const arming: Record<string, unknown> = {
    kind: M5A_OPERATOR_ARMING_KIND,
    schema_version: M5A_OPERATOR_ARMING_SCHEMA_VERSION,
    disposable: true,
    generated_from: "m5a-curated-proposal-flow-approval-packet",
    arming_artifact_id: canonicalM5aOperatorArmingArtifactId(
      packet.packet_artifact_id,
      packet.references_contract_artifact_id,
      packet.proposal_set_id,
      packet.account_id,
      armedBy,
      armedAt,
    ),
    one_shot_consumption_key: canonicalM5aOneShotConsumptionKey(
      packet.packet_artifact_id,
      packet.references_contract_artifact_id,
      packet.proposal_set_id,
      packet.account_id,
    ),
    packet_artifact_id: packet.packet_artifact_id,
    references_contract_artifact_id: packet.references_contract_artifact_id,
    proposal_set_id: packet.proposal_set_id,
    account_id: packet.account_id,
    packet_lifecycle_before_arming: "drafted",
    lifecycle: "armed",
    armed: true,
    consumed: false,
    executed: false,
    expired: false,
    revoked: false,
    armed_at: armedAt,
    armed_by: armedBy,
    packet_drafted_at: packet.drafted_at,
    packet_expires_at: packet.expires_at,
    authorization_scope: M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE,
    eventual_authorization_scope: "durable-write-of-recorded-proposal-and-render",
    next_required_contract: "m5a-curated-proposal-flow-execution",
    target_store: "local-durable-db",
    recorded_proposal_source_origin: "hand-curated-public",
    trust_tier_pins: {
      required_row_trust_label: "model-proposed-human-ratified-evidence-pending",
      required_per_record_provenance_status: "source_document_only",
      forbidden_per_record_provenance_statuses: ["verified"],
    },
    boundaries: {
      current_effective_authorization: M5A_OPERATOR_ARMING_AUTHORIZATION_SCOPE,
      operator_armed: true,
      arming_is_one_shot: true,
      authorizes_future_flow_execution: true,
      max_flow_executions_authorized: 1,
      remaining_flow_executions: 1,
      consumed_flow_executions: 0,
      retry_budget: 0,
      retry_requires_new_approval: true,
      one_shot_consumption_recorded: false,
      step_4_must_check_expiry_at_execution: true,
      step_4_must_atomically_consume_one_shot_key_in_durable_transaction: true,
      step_4_must_refuse_replay_after_consumption: true,
      authorizes_provider_call: false,
      authorizes_system_side_acquisition: false,
      authorizes_private_evidence_read: false,
      authorizes_fresh_provider_call_on_flow_path: false,
      authorizes_immediate_durable_write: false,
      flow_execution_performed: false,
      durable_write_execution_performed: false,
      durable_writes_performed: false,
      graph_ingestion_performed: false,
      render_performed: false,
      provider_calls_made: 0,
      private_evidence_read: false,
      system_side_acquisition_performed: false,
      production_writes: false,
      readiness_claim: false,
    },
  };
  return { ...arming, ...overrides };
}

describe("M5a step 3 — happy path and constants", () => {
  test("builder produces an armed, unconsumed one-shot authorization and performs no execution", () => {
    const { contract, packet, arming } = loadLegitimate();
    assert.equal(arming.kind, M5A_OPERATOR_ARMING_KIND);
    assert.equal(arming.schema_version, M5A_OPERATOR_ARMING_SCHEMA_VERSION);
    assert.equal(arming.arming_artifact_id, canonicalM5aOperatorArmingArtifactId(
      packet.packet_artifact_id,
      packet.references_contract_artifact_id,
      packet.proposal_set_id,
      packet.account_id,
      ARMED_BY,
      ARMED_AT,
    ));
    assert.equal(arming.arming_artifact_id.length <= 121, true);
    assert.equal(arming.one_shot_consumption_key, canonicalM5aOneShotConsumptionKey(
      packet.packet_artifact_id,
      packet.references_contract_artifact_id,
      packet.proposal_set_id,
      packet.account_id,
    ));
    assert.match(arming.one_shot_consumption_key, /^m5a-one-shot:[a-f0-9]{40}$/);
    assert.equal(arming.packet_artifact_id, packet.packet_artifact_id);
    assert.equal(arming.references_contract_artifact_id, contract.contract_artifact_id);
    assert.equal(arming.packet_lifecycle_before_arming, "drafted");
    assert.equal(arming.lifecycle, "armed");
    assert.equal(arming.armed, true);
    assert.equal(arming.consumed, false);
    assert.equal(arming.executed, false);
    assert.equal(arming.boundaries.max_flow_executions_authorized, 1);
    assert.equal(arming.boundaries.remaining_flow_executions, 1);
    assert.equal(arming.boundaries.retry_budget, 0);
    assert.equal(arming.boundaries.one_shot_consumption_recorded, false);
    assert.equal(arming.boundaries.step_4_must_check_expiry_at_execution, true);
    assert.equal(
      arming.boundaries.step_4_must_atomically_consume_one_shot_key_in_durable_transaction,
      true,
    );
    assert.equal(arming.boundaries.step_4_must_refuse_replay_after_consumption, true);
    assert.equal(arming.boundaries.flow_execution_performed, false);
    assert.equal(arming.boundaries.durable_write_execution_performed, false);
    assert.equal(arming.boundaries.durable_writes_performed, false);
    assert.equal(arming.boundaries.render_performed, false);
    assert.equal(arming.boundaries.authorizes_provider_call, false);
    assert.equal(arming.boundaries.authorizes_system_side_acquisition, false);
    assert.equal(arming.boundaries.authorizes_private_evidence_read, false);
  });

  test("positive trust-tier pins propagate onto the arming artifact", () => {
    const { arming } = loadLegitimate();
    assert.equal(arming.trust_tier_pins.required_row_trust_label, "model-proposed-human-ratified-evidence-pending");
    assert.equal(arming.trust_tier_pins.required_per_record_provenance_status, "source_document_only");
    assert.deepEqual(arming.trust_tier_pins.forbidden_per_record_provenance_statuses, ["verified"]);
  });

  test("verifier accepts both the builder output and a hand-constructed conformant arming", () => {
    const { contract, packet, arming } = loadLegitimate();
    verifyM5aCuratedProposalFlowOperatorArming(arming, packet, contract);
    verifyM5aCuratedProposalFlowOperatorArming(handConstructArming(packet), packet, contract);
  });

  test("canonical arming IDs are distinct for honest artifacts bound to different accounts", () => {
    const inputA = JSON.parse(read(MATERIALIZATION_INPUT_FIXTURE)) as Record<string, unknown>;
    const inputB = JSON.parse(read(MATERIALIZATION_INPUT_FIXTURE)) as Record<string, unknown>;
    (inputB.context as Record<string, unknown>).account_id = "acc_other_honest_account";
    const contractA = buildM5aCuratedProposalFlowContract(inputA, {
      flowId: FLOW_ID,
      now: CONTRACT_NOW,
    });
    const contractB = buildM5aCuratedProposalFlowContract(inputB, {
      flowId: FLOW_ID,
      now: CONTRACT_NOW,
    });
    const packetA = loadPacket(contractA);
    const packetB = loadPacket(contractB);

    assert.notEqual(contractA.account_id, contractB.account_id);
    assert.notEqual(contractA.contract_artifact_id, contractB.contract_artifact_id);
    assert.notEqual(packetA.packet_artifact_id, packetB.packet_artifact_id);

    const armingA = buildM5aCuratedProposalFlowOperatorArming(contractA, packetA, {
      armedAt: ARMED_AT,
      armedBy: ARMED_BY,
    });
    const armingB = buildM5aCuratedProposalFlowOperatorArming(contractB, packetB, {
      armedAt: ARMED_AT,
      armedBy: ARMED_BY,
    });
    assert.notEqual(armingA.arming_artifact_id, armingB.arming_artifact_id);
    verifyM5aCuratedProposalFlowOperatorArming(armingA, packetA, contractA);
    verifyM5aCuratedProposalFlowOperatorArming(armingB, packetB, contractB);
  });

  test("the 160-bit tuple digest keeps the longest valid arming ID inside SAFE_ID", () => {
    const armedBy = `o${"p".repeat(40)}`;
    const armedAt = "2026-06-17T01:00:00.123Z";
    const id = canonicalM5aOperatorArmingArtifactId(
      `p${"x".repeat(120)}`,
      `c${"x".repeat(120)}`,
      `s${"x".repeat(120)}`,
      `a${"x".repeat(120)}`,
      armedBy,
      armedAt,
    );
    assert.ok(id.length <= 121);
    assert.match(id, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/);
    assert.match(id, /^m5a-arm:[a-f0-9]{40}:/);
  });

  test("two arming events over one packet have distinct artifact IDs and one stable consumption key", () => {
    const contract = loadContract();
    const packet = loadPacket(contract);
    const first = buildM5aCuratedProposalFlowOperatorArming(contract, packet, {
      armedAt: "2026-06-17T01:00:00Z",
      armedBy: "operator_one",
    });
    const second = buildM5aCuratedProposalFlowOperatorArming(contract, packet, {
      armedAt: "2026-06-17T02:00:00Z",
      armedBy: "operator_two",
    });

    assert.notEqual(first.arming_artifact_id, second.arming_artifact_id);
    assert.equal(first.one_shot_consumption_key, second.one_shot_consumption_key);
  });

  test("different packet expiry windows produce different arming IDs and consumption keys", () => {
    const contract = loadContract();
    const firstPacket = buildM5aCuratedProposalFlowApprovalPacket(contract, {
      now: PACKET_NOW,
      expiresAt: "2026-06-18T00:00:00Z",
      draftedBy: DRAFTED_BY,
    });
    const secondPacket = buildM5aCuratedProposalFlowApprovalPacket(contract, {
      now: PACKET_NOW,
      expiresAt: "2026-06-19T00:00:00Z",
      draftedBy: DRAFTED_BY,
    });
    const first = buildM5aCuratedProposalFlowOperatorArming(contract, firstPacket, {
      armedAt: ARMED_AT,
      armedBy: ARMED_BY,
    });
    const second = buildM5aCuratedProposalFlowOperatorArming(contract, secondPacket, {
      armedAt: ARMED_AT,
      armedBy: ARMED_BY,
    });

    assert.notEqual(firstPacket.packet_artifact_id, secondPacket.packet_artifact_id);
    assert.notEqual(first.arming_artifact_id, second.arming_artifact_id);
    assert.notEqual(first.one_shot_consumption_key, second.one_shot_consumption_key);
  });

  test("verification is pure and structurally repeatable; it records no consumption", () => {
    const { contract, packet, arming } = loadLegitimate();
    const structuralArming = JSON.parse(JSON.stringify(arming)) as Record<string, unknown>;
    const before = JSON.stringify(structuralArming);

    verifyM5aCuratedProposalFlowOperatorArming(structuralArming, packet, contract);
    verifyM5aCuratedProposalFlowOperatorArming(structuralArming, packet, contract);

    assert.equal(JSON.stringify(structuralArming), before);
    assert.equal(structuralArming.boundaries.one_shot_consumption_recorded, false);
  });
});

describe("M5a step 3 — hostile-probe suite: arming-state counterfeit", () => {
  test("A1 — forged arming for packet A used with packet B is refused", () => {
    const contract = loadContract();
    const packetA = loadPacket(contract);
    const packetB = buildM5aCuratedProposalFlowApprovalPacket(contract, {
      now: PACKET_NOW,
      expiresAt: PACKET_EXPIRES,
      draftedBy: "other_drafter",
    });
    const forged = handConstructArming(packetA);
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packetB, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A2 — forged arming for contract A used with contract B is refused through the packet/contract verifier", () => {
    const contractA = loadContract("m5a-acme-robotics-20260617a");
    const contractB = loadContract("m5a-acme-robotics-20260617b");
    const packetA = loadPacket(contractA);
    const forged = handConstructArming(packetA);
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packetA, contractB),
      M5aOperatorArmingRefusal,
    );
  });

  test("A3 — arming_artifact_id with the wrong packet digest is refused even when the packet/contract triple is correct", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet, {
      arming_artifact_id: canonicalM5aOperatorArmingArtifactId(
        "m5a-pkt:other-safe-id",
        packet.references_contract_artifact_id,
        packet.proposal_set_id,
        packet.account_id,
        ARMED_BY,
        ARMED_AT,
      ),
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A4 — arbitrary safe arming_artifact_id is refused; safe shape is not enough", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet, { arming_artifact_id: "m5a-arm:other-safe-id" });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A4b — forged one_shot_consumption_key is refused", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet, {
      one_shot_consumption_key: "m5a-one-shot:0000000000000000000000000000000000000000",
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A5 — already-consumed arming is refused", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet, { consumed: true });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A6 — executed arming is refused (step 3 cannot perform the flow)", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet, { executed: true });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A7 — expired or revoked arming states are refused", () => {
    const { contract, packet } = loadLegitimate();
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(handConstructArming(packet, { expired: true }), packet, contract),
      M5aOperatorArmingRefusal,
    );
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(handConstructArming(packet, { revoked: true }), packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A8 — armed_at at or after packet expiry is refused", () => {
    const { contract, packet } = loadLegitimate();
    assert.throws(
      () => buildM5aCuratedProposalFlowOperatorArming(contract, packet, {
        armedAt: PACKET_EXPIRES,
        armedBy: ARMED_BY,
      }),
      M5aOperatorArmingRefusal,
    );
  });

  test("A9 — armed_at before packet drafted_at is refused", () => {
    const { contract, packet } = loadLegitimate();
    assert.throws(
      () => buildM5aCuratedProposalFlowOperatorArming(contract, packet, {
        armedAt: "2026-06-16T23:59:59Z",
        armedBy: ARMED_BY,
      }),
      M5aOperatorArmingRefusal,
    );
  });

  test("A10 — attempts to increase max_flow_executions_authorized are refused", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    (forged.boundaries as any).max_flow_executions_authorized = 2;
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A11 — retry_budget broadening is refused", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    (forged.boundaries as any).retry_budget = 1;
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A12 — provider-call / system-acquisition / private-read broadening is refused", () => {
    const { contract, packet } = loadLegitimate();
    for (const key of [
      "authorizes_provider_call",
      "authorizes_system_side_acquisition",
      "authorizes_private_evidence_read",
      "authorizes_fresh_provider_call_on_flow_path",
    ]) {
      const forged = handConstructArming(packet);
      (forged.boundaries as any)[key] = true;
      assert.throws(
        () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
        M5aOperatorArmingRefusal,
        key,
      );
    }
  });

  test("A13 — direct durable-write/render execution markers are refused", () => {
    const { contract, packet } = loadLegitimate();
    for (const key of [
      "authorizes_immediate_durable_write",
      "flow_execution_performed",
      "durable_write_execution_performed",
      "durable_writes_performed",
      "graph_ingestion_performed",
      "render_performed",
    ]) {
      const forged = handConstructArming(packet);
      (forged.boundaries as any)[key] = true;
      assert.throws(
        () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
        M5aOperatorArmingRefusal,
        key,
      );
    }
  });

  test("A14 — top-level mediation_gate_level stamp is refused (L0 only on real effects)", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet, { mediation_gate_level: "L0" });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A15 — nested mediation_gate_level stamp is refused", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    (forged.boundaries as any).mediation_gate_level = "L0";
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A16 — positive trust-tier pin weakening is refused", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    (forged.trust_tier_pins as any).required_row_trust_label = "model-proposed-verified";
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A17 — per-record provenance promotion to verified is refused", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    (forged.trust_tier_pins as any).required_per_record_provenance_status = "verified";
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A17b — Proxy-backed nested trust-tier array is refused without firing its get trap", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    let trapFired = false;
    (forged.trust_tier_pins as any).forbidden_per_record_provenance_statuses = new Proxy(
      ["verified"],
      {
        get(target, prop, receiver) {
          trapFired = true;
          throw new Error(`UNEXPECTED_ARRAY_GET:${String(prop)}`);
        },
      },
    );
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
    assert.equal(trapFired, false);
  });

  test("A17c — accessor-backed nested trust-tier array index is refused without firing its getter", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    let getterFired = false;
    const forbidden: unknown[] = ["verified"];
    Object.defineProperty(forbidden, "0", {
      enumerable: true,
      configurable: true,
      get() {
        getterFired = true;
        throw new Error("UNEXPECTED_ARRAY_INDEX_GET");
      },
    });
    (forged.trust_tier_pins as any).forbidden_per_record_provenance_statuses = forbidden;
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
    assert.equal(getterFired, false);
  });

  test("A18 — Proxy-backed arming is refused before any get trap fires", () => {
    const { contract, packet } = loadLegitimate();
    let trapFired = false;
    const proxy = new Proxy(handConstructArming(packet), {
      get(target, prop, receiver) {
        trapFired = true;
        return Reflect.get(target, prop, receiver);
      },
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(proxy, packet, contract),
      M5aOperatorArmingRefusal,
    );
    assert.equal(trapFired, false);
  });

  test("A19 — accessor-backed armed_by is refused without invoking the getter", () => {
    const { contract, packet } = loadLegitimate();
    const forged = handConstructArming(packet);
    let getterFired = false;
    delete forged.armed_by;
    Object.defineProperty(forged, "armed_by", {
      enumerable: true,
      configurable: true,
      get() {
        getterFired = true;
        return ARMED_BY;
      },
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(forged, packet, contract),
      M5aOperatorArmingRefusal,
    );
    assert.equal(getterFired, false);
  });

  test("A20 — accessor-backed options.armedAt is refused without invoking the getter", () => {
    const { contract, packet } = loadLegitimate();
    let getterFired = false;
    const options: Record<string, unknown> = { armedBy: ARMED_BY };
    Object.defineProperty(options, "armedAt", {
      enumerable: true,
      configurable: true,
      get() {
        getterFired = true;
        return ARMED_AT;
      },
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowOperatorArming(contract, packet, options as never),
      M5aOperatorArmingRefusal,
    );
    assert.equal(getterFired, false);
  });

  test("A21 — Proxy-backed packet is refused before any get trap fires", () => {
    const { contract, packet } = loadLegitimate();
    let trapFired = false;
    const proxy = new Proxy(packet, {
      get(target, prop, receiver) {
        trapFired = true;
        return Reflect.get(target, prop, receiver);
      },
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowOperatorArming(contract, proxy as never, {
        armedAt: ARMED_AT,
        armedBy: ARMED_BY,
      }),
      M5aOperatorArmingRefusal,
    );
    assert.equal(trapFired, false);
  });

  test("A22 — Proxy-backed contract is refused before any get trap fires", () => {
    const contract = loadContract();
    const packet = loadPacket(contract);
    let trapFired = false;
    const proxy = new Proxy(contract, {
      get(target, prop, receiver) {
        trapFired = true;
        return Reflect.get(target, prop, receiver);
      },
    });
    assert.throws(
      () => buildM5aCuratedProposalFlowOperatorArming(proxy as never, packet, {
        armedAt: ARMED_AT,
        armedBy: ARMED_BY,
      }),
      M5aOperatorArmingRefusal,
    );
    assert.equal(trapFired, false);
  });

  test("A23 — symbol keys and unsafe keys on arming are refused", () => {
    const { contract, packet } = loadLegitimate();
    const withSymbol = handConstructArming(packet);
    Object.defineProperty(withSymbol, Symbol("x"), { enumerable: true, value: "x" });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(withSymbol, packet, contract),
      M5aOperatorArmingRefusal,
    );
    const withUnsafe = handConstructArming(packet);
    Object.defineProperty(withUnsafe, "constructor", { enumerable: true, value: "x" });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(withUnsafe, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A23b — contradictory or authorization-shaped unknown fields are refused at root and boundary levels", () => {
    const { contract, packet } = loadLegitimate();
    const rootExtra = handConstructArming(packet, {
      additional_authorization_scope: "unbounded-flow-execution",
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(rootExtra, packet, contract),
      M5aOperatorArmingRefusal,
    );

    const boundaryExtra = handConstructArming(packet);
    (boundaryExtra.boundaries as any).additional_authorization_scope = "unbounded-flow-execution";
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(boundaryExtra, packet, contract),
      M5aOperatorArmingRefusal,
    );
  });

  test("A23c — broadened step-1 root, boundaries, stage, success, and approval shapes are refused", () => {
    const { contract, packet } = loadLegitimate();
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
      const counterfeit = mutate(contract, broaden);
      assert.throws(
        () => verifyM5aCuratedProposalFlowOperatorArming(
          handConstructArming(packet),
          packet,
          counterfeit,
        ),
        M5aOperatorArmingRefusal,
      );
    }
  });

  test("A23d — nested Proxy/accessor contract paths are refused without executing traps", () => {
    const { contract, packet } = loadLegitimate();
    const proxyContract = mutate(contract, () => undefined) as any;
    let trapFired = false;
    proxyContract.boundaries = new Proxy(proxyContract.boundaries, {
      get() {
        trapFired = true;
        throw new Error("UNEXPECTED_CONTRACT_BOUNDARY_GET");
      },
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(
        handConstructArming(packet),
        packet,
        proxyContract,
      ),
      M5aOperatorArmingRefusal,
    );
    assert.equal(trapFired, false);

    const accessorContract = mutate(contract, () => undefined) as any;
    let getterFired = false;
    delete accessorContract.flow_stages[0].stage_closed_markers.authorizes_provider_call;
    Object.defineProperty(
      accessorContract.flow_stages[0].stage_closed_markers,
      "authorizes_provider_call",
      {
        enumerable: true,
        configurable: true,
        get() {
          getterFired = true;
          throw new Error("UNEXPECTED_STAGE_MARKER_GET");
        },
      },
    );
    assert.throws(
      () => verifyM5aCuratedProposalFlowOperatorArming(
        handConstructArming(packet),
        packet,
        accessorContract,
      ),
      M5aOperatorArmingRefusal,
    );
    assert.equal(getterFired, false);
  });

  test("A24 — TOCTOU source guard: canonical arming ID uses validated locals, not fresh a.* reads", () => {
    const moduleText = read(MODULE);
    assert.match(
      moduleText,
      /const expectedArmingArtifactId = canonicalM5aOperatorArmingArtifactId\(\s*packetArtifactId,\s*contractArtifactId,\s*proposalSetId,\s*accountId,\s*armedBy,\s*armedAt,\s*\);/,
    );
    assert.doesNotMatch(
      moduleText,
      /canonicalM5aOperatorArmingArtifactId\(\s*a\.packet_artifact_id/s,
    );
    assert.match(
      moduleText,
      /const expectedOneShotConsumptionKey = canonicalM5aOneShotConsumptionKey\(\s*packetArtifactId,\s*contractArtifactId,\s*proposalSetId,\s*accountId,\s*\);/,
    );
    assert.doesNotMatch(
      moduleText,
      /canonicalM5aOneShotConsumptionKey\(\s*a\.packet_artifact_id/s,
    );
  });
});

describe("M5a step 3 — module purity and runbook/INDEX claims", () => {
  test("module imports M5a snapshot helpers from step 1 and does not hand-roll them", () => {
    const moduleText = read(MODULE);
    assert.match(moduleText, /from "\.\/m5a-curated-proposal-flow-contract\.ts"/);
    assert.match(moduleText, /snapshotPlainOwnData,/);
    assert.match(moduleText, /snapshotPlainArray,/);
    assert.match(moduleText, /requireSafeId,/);
    assert.match(moduleText, /requireCanonicalIsoTimestamp,/);
    assert.ok(!moduleText.match(/^function snapshotPlainOwnData\b/m));
    assert.ok(!moduleText.match(/^function snapshotPlainArray\b/m));
  });

  test("arming module has no provider/network/fs/env/readiness side effects and no mediation_gate_level property stamp", () => {
    const moduleText = read(MODULE);
    for (const forbidden of [
      "openai",
      "anthropic",
      "process.env",
      '"node:http"',
      '"node:https"',
      '"node:net"',
      '"node:fs',
      '"node:child_process"',
      "fetch(",
      "require(",
    ]) {
      assert.ok(!moduleText.includes(forbidden), `module must not contain ${forbidden}`);
    }
    assert.doesNotMatch(moduleText, /mediation_gate_level\s*:/, "arming artifact must not stamp mediation_gate_level");
  });

  test("runbook records arming-not-execution, hostile-probe target, canonical verifier rule, and no-L0-stamp rule", () => {
    const status = read(STATUS);
    assert.match(status, /# M5a Curated Proposal Flow Operator Arming Status/);
    assert.match(status, /Status: active/);
    assert.match(status, /arming is not execution/);
    assert.match(status, /arming-state counterfeit/);
    assert.match(status, /canonicalM5aOperatorArmingArtifactId/);
    assert.match(status, /canonicalM5aOneShotConsumptionKey/);
    assert.match(status, /verifier re-derives/);
    assert.match(status, /no mediation_gate_level/);
    assert.match(status, /hostile-probe-suite-as-done-criterion/);
    assert.match(status, /build-side \/ verify-side asymmetry/);
    assert.match(status, /positive trust-tier pins/);
    assert.match(status, /Path-1/);
    assert.match(status, /No concrete committed arming instance exists/);
    assert.match(status, /only when an operator explicitly supplies/);
    assert.match(status, /not an execution-time expiry check/);
    assert.match(status, /execution_at >= packet_expires_at/);
    assert.match(status, /Step-3 module remains arming-only and implements no execution behavior/i);
    assert.match(status, /full verified tuple/);
    assert.match(status, /same durable transaction/);
    assert.match(status, /refuses? replay after consumption/);
    assert.match(status, /only Step 4 can enforce consumption/i);
  });

  test("runbook index lists this runbook exactly once and frames it as M5a step 3 arming", () => {
    const index = read(INDEX);
    const needle = "| `m5a-curated-proposal-flow-operator-arming-status.md` |";
    assert.equal(index.split(needle).length - 1, 1);
    const row = index.split("\n").find((line) => line.includes(needle));
    assert.ok(row);
    assert.match(row, /active/);
    assert.match(row, /M5a step 3/);
    assert.match(row, /arming/);
    assert.match(row, /no flow execution/);
    assert.match(row, /no concrete committed arming instance exists/);
    assert.match(row, /execution-time expiry/);
  });
});
