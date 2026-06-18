// M5a step 2 — curated-source proposal-flow approval packet safety check.
//
// THREAT SHAPE (operator GO 2026-06-17): step 2 produces a drafted-
// and-unarmed approval packet over the step-1 contract. The primary
// adversary is approval-state counterfeit — a packet that claims to
// conform to `approval_packet_shape` but doesn't carry the required
// positive trust-tier pins, or whose Path-1 markers are present-but-
// falsified, or that arrives already-armed when the contract says
// drafted-and-unarmed-by-default, or that references a
// contract_artifact_id that doesn't match the step-1 contract it
// claims to be over. The hostile-probe suite below is built against
// THAT threat, not re-aimed at step 1's input-smuggling.

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
  verifyM5aCuratedProposalFlowApprovalPacket,
  M5A_APPROVAL_PACKET_KIND,
  M5A_APPROVAL_PACKET_SCHEMA_VERSION,
  M5A_EVENTUAL_AUTHORIZATION_SCOPE,
  M5aApprovalPacketRefusal,
  type M5aCuratedProposalFlowApprovalPacketArtifact,
} from "../../src/workshop/m5a-curated-proposal-flow-approval-packet.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/m5a-curated-proposal-flow-approval-packet-status.md");
const INDEX = join(ROOT, "docs/runbooks/INDEX.md");
const MODULE = join(ROOT, "src/workshop/m5a-curated-proposal-flow-approval-packet.ts");
const MATERIALIZATION_INPUT_FIXTURE = join(
  ROOT,
  "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json",
);

const FLOW_ID = "m5a-acme-robotics-20260617a";
const CONTRACT_NOW = "2026-06-17T00:00:00Z";
const NOW = "2026-06-17T00:00:00Z";
const EXPIRES = "2026-06-18T00:00:00Z";
const DRAFTED_BY = "reviewer_demo";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function loadContract(): M5aCuratedProposalFlowContractArtifact {
  const input = JSON.parse(readFileSync(MATERIALIZATION_INPUT_FIXTURE, "utf8")) as Record<string, unknown>;
  return buildM5aCuratedProposalFlowContract(input, { flowId: FLOW_ID, now: CONTRACT_NOW });
}

function loadLegitimatePacket(): {
  contract: M5aCuratedProposalFlowContractArtifact;
  packet: M5aCuratedProposalFlowApprovalPacketArtifact;
} {
  const contract = loadContract();
  const packet = buildM5aCuratedProposalFlowApprovalPacket(contract, {
    now: NOW,
    expiresAt: EXPIRES,
    draftedBy: DRAFTED_BY,
  });
  return { contract, packet };
}

// Helper to mutate a frozen packet in tests. JSON-roundtrip strips
// Object.freeze; we then mutate the clone.
function mutate<T>(base: T, fn: (clone: any) => void): T {
  const c = JSON.parse(JSON.stringify(base)) as T;
  fn(c);
  return c;
}

describe("M5a step 2 — pinned constants and exports", () => {
  test("module exports the load-bearing constants under their pinned values", () => {
    assert.equal(M5A_APPROVAL_PACKET_KIND, "m5a-curated-proposal-flow-approval-packet");
    assert.equal(
      M5A_APPROVAL_PACKET_SCHEMA_VERSION,
      "atliera.m5a_curated_proposal_flow_approval_packet.v1",
    );
    assert.equal(M5A_EVENTUAL_AUTHORIZATION_SCOPE, "durable-write-of-recorded-proposal-and-render");
  });
});

describe("M5a step 2 — happy path: legitimate packet build + verify", () => {
  test("the builder produces a drafted-and-unarmed packet over the committed step-1 contract", () => {
    const { contract, packet } = loadLegitimatePacket();
    assert.equal(packet.kind, M5A_APPROVAL_PACKET_KIND);
    assert.equal(packet.schema_version, M5A_APPROVAL_PACKET_SCHEMA_VERSION);
    assert.equal(packet.disposable, true);
    assert.equal(packet.current_effective_authorization, "none");
    assert.equal(packet.lifecycle, "drafted");
    assert.equal(packet.armed, false);
    assert.equal(packet.consumed, false);
    assert.equal(packet.executed, false);
    assert.equal(packet.provider_calls_made, 0);
    assert.equal(packet.private_evidence_read, false);
    assert.equal(packet.graph_ingestion_performed, false);
    assert.equal(packet.durable_writes_performed, false);
    assert.equal(packet.production_writes, false);
    assert.equal(packet.readiness_claim, false);
    // Contract-reference integrity.
    assert.equal(packet.references_contract_artifact_id, contract.contract_artifact_id);
    assert.equal(packet.proposal_set_id, contract.proposal_set_id);
    assert.equal(packet.account_id, contract.account_id);
    // Identity / lifecycle metadata.
    assert.equal(packet.drafted_at, NOW);
    assert.equal(packet.expires_at, EXPIRES);
    assert.equal(packet.drafted_by, DRAFTED_BY);
    assert.ok(packet.packet_artifact_id.startsWith("m5a-pkt:"));
  });

  test("positive trust-tier pins are present (model-proposed-human-ratified-evidence-pending, source_document_only) plus the negative prohibition", () => {
    const { packet } = loadLegitimatePacket();
    // Positive pins — the load-bearing distinction. "Not verified" is
    // not "is pending"; both must be carried.
    assert.equal(packet.trust_tier_pins.required_row_trust_label, "model-proposed-human-ratified-evidence-pending");
    assert.equal(packet.trust_tier_pins.required_per_record_provenance_status, "source_document_only");
    // Negative prohibition.
    assert.deepEqual(packet.trust_tier_pins.forbidden_per_record_provenance_statuses, ["verified"]);
  });

  test("eventual_authorization encodes the M5a-specific Path-1 sharpening (write/render of recorded proposal, no fresh call)", () => {
    const { packet } = loadLegitimatePacket();
    assert.equal(packet.eventual_authorization.authorization_scope, M5A_EVENTUAL_AUTHORIZATION_SCOPE);
    assert.equal(packet.eventual_authorization.authorizes_durable_write_of_recorded_proposal, true);
    assert.equal(packet.eventual_authorization.authorizes_render_of_durable_state, true);
    assert.equal(packet.eventual_authorization.authorizes_provider_call, false);
    assert.equal(packet.eventual_authorization.authorizes_system_side_acquisition, false);
    assert.equal(packet.eventual_authorization.authorizes_private_evidence_read, false);
    assert.equal(packet.eventual_authorization.recorded_proposal_source_origin, "hand-curated-public");
  });

  test("flow_constraints carries drafted-and-unarmed defaults + Path-1 + M4-acquisition closure markers", () => {
    const { packet } = loadLegitimatePacket();
    const fc = packet.flow_constraints;
    assert.equal(fc.drafted_and_unarmed_by_default, true);
    assert.equal(fc.max_flow_executions, 1);
    assert.equal(fc.retry_budget, 0);
    assert.equal(fc.retry_requires_new_approval, true);
    assert.equal(fc.expiry_required, true);
    assert.equal(fc.operator_arming_required_for_flow_execution, true);
    assert.equal(fc.mediation_gate_level, "L0");
    assert.equal(fc.target_store, "local-durable-db");
    assert.equal(fc.forbids_fresh_provider_call_on_flow_path, true);
    assert.equal(fc.forbids_system_side_acquisition, true);
  });

  test("the verifier accepts the legitimately-built packet", () => {
    const { contract, packet } = loadLegitimatePacket();
    // Should not throw.
    verifyM5aCuratedProposalFlowApprovalPacket(packet, contract);
  });
});

describe("M5a step 2 — hostile-probe regression suite (approval-state counterfeit)", () => {
  // The standing rule recorded in step 1: a contract slice over an
  // upstream artifact is not done when the happy-path suite is green;
  // it is done when the hostile-probe suite is green. The threat
  // shape here is different from step 1's (input-smuggling); it is
  // approval-state counterfeit. Each probe below is one counterfeit
  // shape the operator named at step 2 GO.

  test("Counterfeit C1 — packet missing the positive `required_row_trust_label` is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      delete p.trust_tier_pins.required_row_trust_label;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C2 — packet whose `required_row_trust_label` is falsified to a non-pending value is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.trust_tier_pins.required_row_trust_label = "model-proposed-verified";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C3 — packet whose `required_per_record_provenance_status` is falsified to `verified` is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.trust_tier_pins.required_per_record_provenance_status = "verified";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C4 — packet missing the negative `forbidden_per_record_provenance_statuses: [verified]` is refused (positive + negative are both required)", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.trust_tier_pins.forbidden_per_record_provenance_statuses = [];
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C5 — packet whose `eventual_authorization.authorizes_provider_call` is falsified to true is refused (Path-1 violation)", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.eventual_authorization.authorizes_provider_call = true;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C6 — packet arriving already-armed (lifecycle: armed) is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.lifecycle = "armed";
      p.armed = true;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C7 — packet whose drafted-state markers are inconsistent (armed=true at drafted lifecycle) is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.armed = true;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C8 — packet referencing a non-matching contract_artifact_id is refused (contract-reference integrity)", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.references_contract_artifact_id = "m5a-flow-contract:other:other";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C9 — packet whose account_id does not match the contract is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.account_id = "acc_other";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C10 — packet with max_flow_executions > 1 is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.flow_constraints.max_flow_executions = 5;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C11 — packet with retry_budget > 0 is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.flow_constraints.retry_budget = 3;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C12 — packet with expiry_required: false is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.flow_constraints.expiry_required = false;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C13 — packet that says arming is not required for execution is refused (would allow drafted packet to authorize directly)", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.flow_constraints.operator_arming_required_for_flow_execution = false;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C14 — packet whose Path-1 marker `forbids_fresh_provider_call_on_flow_path` is falsified to false is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.flow_constraints.forbids_fresh_provider_call_on_flow_path = false;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C15 — packet with drafted_and_unarmed_by_default: false is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.flow_constraints.drafted_and_unarmed_by_default = false;
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C16 — packet whose authorization_scope is falsified to authorize a fresh model call is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.eventual_authorization.authorization_scope = "fresh-model-call";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Counterfeit C17 — Proxy-backed packet is refused before any get trap fires (snapshot discipline propagated from step 1)", () => {
    const { contract, packet } = loadLegitimatePacket();
    let trapFired = false;
    const proxy = new Proxy(packet, {
      get(t, p, r) {
        trapFired = true;
        return Reflect.get(t, p, r);
      },
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(proxy as unknown, contract),
      M5aApprovalPacketRefusal,
    );
    assert.equal(trapFired, false, "Proxy get trap must not fire");
  });

  test("Counterfeit C18 — accessor-backed `lifecycle` on the packet is refused without firing the getter", () => {
    const { contract, packet } = loadLegitimatePacket();
    let lcGetter = false;
    const c: Record<string, unknown> = JSON.parse(JSON.stringify(packet));
    delete c.lifecycle;
    Object.defineProperty(c, "lifecycle", {
      enumerable: true,
      configurable: true,
      get() {
        lcGetter = true;
        return "drafted";
      },
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
    assert.equal(lcGetter, false, "lifecycle getter must not fire");
  });

  test("Counterfeit C19 — packet expiry not strictly after drafted_at is refused", () => {
    const { contract, packet } = loadLegitimatePacket();
    const c = mutate(packet, (p) => {
      p.expires_at = "2026-06-16T00:00:00Z";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(c, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Build-side counterfeit — a contract whose approval_packet_shape carries a falsified positive pin is refused at build time", () => {
    const contract = loadContract();
    const counterfeitContract = JSON.parse(JSON.stringify(contract));
    counterfeitContract.approval_packet_shape.required_row_trust_label = "verified";
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowApprovalPacket(
          counterfeitContract,
          { now: NOW, expiresAt: EXPIRES, draftedBy: DRAFTED_BY },
        ),
      M5aApprovalPacketRefusal,
    );
  });

  test("Build-side counterfeit — a contract whose approval_packet_shape lacks the Path-1 inheritance marker is refused at build time", () => {
    const contract = loadContract();
    const counterfeitContract = JSON.parse(JSON.stringify(contract));
    counterfeitContract.approval_packet_shape.inherits_forbids_fresh_provider_call_on_flow_path = false;
    assert.throws(
      () =>
        buildM5aCuratedProposalFlowApprovalPacket(
          counterfeitContract,
          { now: NOW, expiresAt: EXPIRES, draftedBy: DRAFTED_BY },
        ),
      M5aApprovalPacketRefusal,
    );
  });
});

describe("M5a step 2 — packet_artifact_id uniqueness (the SAFE_ID-truncation safety check)", () => {
  // The packet ID was originally shortened to fit SAFE_ID's 121-char
  // cap. The first shortening dropped flow_id, which would have
  // collided across two contracts sharing a proposal_set_id but
  // differing in flow_id. The fix encodes the full contractArtifactId
  // (which itself encodes proposal_set_id + flow_id from step 1) in
  // the packet ID. These tests lock the property a downstream slice
  // depends on: packet_artifact_id is uniquely identifying.

  test("two contracts over the same proposal_set_id but different flow_ids produce distinct packet_artifact_ids", () => {
    const input = JSON.parse(readFileSync(MATERIALIZATION_INPUT_FIXTURE, "utf8")) as Record<string, unknown>;
    const contractA = buildM5aCuratedProposalFlowContract(input, {
      flowId: "m5a-acme-robotics-20260617a",
      now: CONTRACT_NOW,
    });
    const contractB = buildM5aCuratedProposalFlowContract(input, {
      flowId: "m5a-acme-robotics-20260617b",
      now: CONTRACT_NOW,
    });
    // The two contracts have the same proposal_set_id but different
    // contract_artifact_ids — exactly the collision-risk shape.
    assert.equal(contractA.proposal_set_id, contractB.proposal_set_id);
    assert.notEqual(contractA.contract_artifact_id, contractB.contract_artifact_id);

    const packetA = buildM5aCuratedProposalFlowApprovalPacket(contractA, {
      now: NOW,
      expiresAt: EXPIRES,
      draftedBy: DRAFTED_BY,
    });
    const packetB = buildM5aCuratedProposalFlowApprovalPacket(contractB, {
      now: NOW,
      expiresAt: EXPIRES,
      draftedBy: DRAFTED_BY,
    });
    assert.notEqual(
      packetA.packet_artifact_id,
      packetB.packet_artifact_id,
      "packets over distinct contracts must not share a packet_artifact_id",
    );
    // The triple also differs at the contract_artifact_id slot.
    assert.notEqual(
      packetA.references_contract_artifact_id,
      packetB.references_contract_artifact_id,
    );
  });

  test("packet_artifact_id encodes the contract_artifact_id (so the ID and the contract-reference triple cannot point at different contracts)", () => {
    const { contract, packet } = loadLegitimatePacket();
    assert.ok(
      packet.packet_artifact_id.includes(contract.contract_artifact_id),
      "packet_artifact_id must encode the contract_artifact_id verbatim, not a fragment of it",
    );
  });

  test("packet_artifact_id stays within SAFE_ID's 121-char cap on the committed fixture", () => {
    const { packet } = loadLegitimatePacket();
    assert.ok(
      packet.packet_artifact_id.length <= 121,
      `packet_artifact_id length ${packet.packet_artifact_id.length} exceeds SAFE_ID cap of 121`,
    );
  });
});

describe("M5a step 2 — packet_artifact_id canonical-form enforcement on the VERIFY path (Hermes catch 2026-06-17)", () => {
  // Hermes ran tree-side hostile probes on the live verifier and found
  // that the canonical-form regressions above tested the BUILD path
  // only — they all started from a built packet and asserted properties
  // of its ID. The verifier accepted hand-constructed packets whose
  // packet_artifact_id was safe-shaped but forged.
  //
  // The fix re-derives the canonical ID in the verifier from its own
  // validated locals (references_contract_artifact_id, drafted_by,
  // drafted_at) and refuses on mismatch. The three regressions below
  // construct forged packets by hand (NOT from the builder) and feed
  // them to the verifier — the property under test is the verify-side
  // enforcement, not the build-side construction.

  test("Hermes H1 — a hand-constructed packet with the LEGACY SHORTENED id is refused (the regressed builder bug, now reachable through forgery)", () => {
    const { contract, packet } = loadLegitimatePacket();
    const forged = mutate(packet, (p) => {
      p.packet_artifact_id = "m5a-pkt:public-curated-20260611a:reviewer_demo:2026-06-17T00:00:00Z";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(forged, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Hermes H2 — a hand-constructed packet with an ARBITRARY SAFE id is refused (safe-shape is not enough)", () => {
    const { contract, packet } = loadLegitimatePacket();
    const forged = mutate(packet, (p) => {
      p.packet_artifact_id = "m5a-pkt:other-safe-id";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(forged, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Hermes H3 — a hand-constructed packet whose ID embeds a DIFFERENT contract reference is refused EVEN WHEN the contract-reference triple is otherwise correct (the load-bearing ID-triple-disagreement case)", () => {
    // The load-bearing forgery: the triple stays correct (the verifier
    // would accept it on the triple check alone), but the ID embeds a
    // different contract reference, signaling intent or downstream
    // confusion. The canonical-form re-derivation catches this even
    // though every other field is honest.
    const { contract, packet } = loadLegitimatePacket();
    const forged = mutate(packet, (p) => {
      // ID embeds "other-flow" where the real contract_artifact_id has
      // "m5a-acme-robotics-20260617a". Triple untouched.
      p.packet_artifact_id =
        "m5a-pkt:m5a-flow-contract:public-curated-20260611a:other-flow:reviewer_demo:2026-06-17T00:00:00Z";
    });
    assert.throws(
      () => verifyM5aCuratedProposalFlowApprovalPacket(forged, contract),
      M5aApprovalPacketRefusal,
    );
  });

  test("Hermes H4 — the canonical-form re-derivation uses the VERIFIER'S OWN validated locals, not fresh reads of the packet object (TOCTOU-safe)", () => {
    // The re-derivation in the verifier reads from `references_contract_
    // artifact_id`, `drafted_by`, and `drafted_at` — values already
    // validated and stored in locals by the time the canonical-form
    // check runs. To confirm the implementation does not accidentally
    // re-read `p.*` at the comparison site, we inspect the module
    // source for the canonical-form line and assert it references the
    // local names, not field paths.
    const moduleText = read(MODULE);
    assert.match(
      moduleText,
      /const expectedPacketArtifactId = `m5a-pkt:\$\{referencesContractId\}:\$\{draftedBy\}:\$\{draftedAt\}`;/,
      "canonical-form expected ID must be derived from validated locals (referencesContractId, draftedBy, draftedAt), not from p.* re-reads",
    );
  });

  test("Hermes H5 — the legitimate built packet still verifies under the new canonical-form check (no regression on the honest path)", () => {
    const { contract, packet } = loadLegitimatePacket();
    // Should not throw.
    verifyM5aCuratedProposalFlowApprovalPacket(packet, contract);
  });
});

describe("M5a step 2 — input snapshot discipline imported from step 1", () => {
  test("the module imports `snapshotPlainOwnData`, `requireSafeId`, `requireCanonicalIsoTimestamp` and `M5aContractBuilderRefusal` from step 1 (single-site M5a-layer consolidation)", () => {
    const moduleText = read(MODULE);
    assert.match(moduleText, /from "\.\/m5a-curated-proposal-flow-contract\.ts"/);
    assert.match(moduleText, /snapshotPlainOwnData,/);
    assert.match(moduleText, /requireSafeId,/);
    assert.match(moduleText, /requireCanonicalIsoTimestamp,/);
    assert.match(moduleText, /M5aContractBuilderRefusal,/);
    // The module must NOT hand-roll a second snapshot helper.
    assert.ok(
      !moduleText.match(/^function snapshotPlainOwnData\b/m),
      "step 2 must not re-define snapshotPlainOwnData; import from step 1",
    );
    assert.ok(
      !moduleText.match(/^function snapshotPlainArray\b/m),
      "step 2 must not re-define snapshotPlainArray; import from step 1",
    );
  });

  test("step 1's safety contract test still passes — step 1's module is backward-compatible after adding `export` to its helpers", () => {
    // Indirect assertion: this test running is itself proof that step
    // 1's module compiles, and the targeted suite covers the rest. We
    // assert one structural fact here: step 1's module exports the
    // helpers (the only change made to step 1 by this PR).
    const step1ModuleText = read(join(ROOT, "src/workshop/m5a-curated-proposal-flow-contract.ts"));
    for (const name of [
      "snapshotPlainOwnData",
      "snapshotPlainArray",
      "isCanonicalIsoTimestamp",
      "requireSafeId",
      "requireCanonicalIsoTimestamp",
    ]) {
      assert.ok(
        step1ModuleText.includes(`export function ${name}`),
        `step 1 must export ${name} for step 2 to import (this is the import-not-hand-roll branch)`,
      );
    }
  });
});

describe("M5a step 2 — module purity and runbook/INDEX claims", () => {
  test("the packet module imports no provider SDK, no network, no env, no I/O", () => {
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

  test("the status runbook records the threat-shape difference, the counterfeit probe set, and the import-from-step-1 decision", () => {
    const status = read(STATUS);
    assert.match(status, /# M5a Curated Proposal Flow Approval Packet Status/);
    assert.match(status, /Status: active/);
    // Threat shape: approval-state counterfeit, not input smuggling.
    assert.match(status, /approval-state counterfeit/);
    assert.match(status, /not re-aimed at input-smuggling/);
    // Positive trust-tier pins as load-bearing inheritance.
    assert.match(status, /required_row_trust_label/);
    assert.match(status, /required_per_record_provenance_status/);
    assert.match(status, /Not verified.*is not.*is pending/);
    // Drafted-and-unarmed, with arming structurally separate.
    assert.match(status, /drafted-and-unarmed/);
    assert.match(status, /arming is its own slice/);
    // Path-1 sharpening.
    assert.match(status, /durable-write-of-recorded-proposal-and-render/);
    // Contract-reference integrity.
    assert.match(status, /Contract-reference integrity/);
    // Snapshot-helper provenance: imported from step 1.
    assert.match(status, /imports the snapshot helpers from step 1/);
    assert.match(status, /H3 retro input/);
  });

  test("the runbook index lists this runbook exactly once and frames it as the M5a step 2 drafted-and-unarmed packet slice", () => {
    const index = read(INDEX);
    const rowCount = index.split("| `m5a-curated-proposal-flow-approval-packet-status.md` |").length - 1;
    assert.equal(rowCount, 1);
    const row = index
      .split("\n")
      .find((l) => l.includes("| `m5a-curated-proposal-flow-approval-packet-status.md` |"));
    assert.ok(row);
    assert.match(row, /active/);
    assert.match(row, /M5a step 2/);
    assert.match(row, /drafted-and-unarmed/);
  });
});
