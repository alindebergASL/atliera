import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  ARMED_LIFECYCLE_STATE,
  WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_NAME,
  buildWorkshopPublicProposalOperatorArming,
} from "../../src/workshop/proposal-durable-graph-write-operator-arming.ts";
import type { WorkshopProposalDurableWriteApprovalPacketArtifact } from "../../src/workshop/proposal-durable-graph-write-approval-packet.ts";

const PACKET_FIXTURE = join(import.meta.dirname, "..", "..", "fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json");

async function loadPacket(): Promise<WorkshopProposalDurableWriteApprovalPacketArtifact> {
  return JSON.parse(await readFile(PACKET_FIXTURE, "utf8")) as WorkshopProposalDurableWriteApprovalPacketArtifact;
}

const PARAMS = { operatorIdentity: "reviewer_demo", armedAt: "2026-06-13T01:00:00Z" };

describe("operator arming artifact", () => {
  test("arming a valid drafted packet flips authorizes_durable_write_execution true on this artifact only", async () => {
    const arming = buildWorkshopPublicProposalOperatorArming(await loadPacket(), PARAMS);

    assert.equal(arming.kind, WORKSHOP_PUBLIC_PROPOSAL_OPERATOR_ARMING_NAME);
    assert.equal(arming.lifecycle_state, ARMED_LIFECYCLE_STATE);
    assert.equal(arming.operator_identity, "reviewer_demo");
    assert.equal(arming.armed_at, PARAMS.armedAt);
    assert.equal(arming.boundaries.authorizes_durable_write_execution, true);
    assert.equal(arming.boundaries.operator_armed, true);
    assert.equal(arming.boundaries.arming_is_one_shot, true);
    assert.equal(arming.boundaries.durable_write_execution_performed, false);
    assert.equal(arming.boundaries.durable_writes_performed, false);
    assert.equal(arming.boundaries.graph_ingestion_performed, false);
    // Every other closed marker stays closed.
    assert.equal(arming.boundaries.authorizes_provider_call, false);
    assert.equal(arming.boundaries.production_writes, false);
    assert.equal(arming.boundaries.readiness_claim, false);
    // L0 has not occurred yet — arming is not itself an L0 effect.
    assert.equal(arming.consumption.l0_effect_observed, false);
    assert.equal(arming.consumption.attempts_remaining, 1);
    // Identity is one field. No roles, no sessions.
    assert.equal(typeof arming.operator_identity, "string");
  });

  test("refuses a packet that is not in drafted state", async () => {
    const packet = await loadPacket();
    const broken = { ...packet, lifecycle_state: "operator-armed" as never };
    assert.throws(() => buildWorkshopPublicProposalOperatorArming(broken as never, PARAMS), /lifecycle_state not/);
  });

  test("refuses a packet whose operator_armed boundary marker is already true", async () => {
    const packet = await loadPacket();
    const broken = { ...packet, boundaries: { ...packet.boundaries, operator_armed: true as never } };
    assert.throws(() => buildWorkshopPublicProposalOperatorArming(broken as never, PARAMS), /operator_armed not/);
  });

  test("refuses a packet whose authorizes_durable_write_execution boundary is already true", async () => {
    const packet = await loadPacket();
    const broken = { ...packet, boundaries: { ...packet.boundaries, authorizes_durable_write_execution: true as never } };
    assert.throws(() => buildWorkshopPublicProposalOperatorArming(broken as never, PARAMS), /authorizes_durable_write_execution not/);
  });

  test("refuses an armedAt at or after the packet's expires_at", async () => {
    const packet = await loadPacket();
    assert.throws(
      () => buildWorkshopPublicProposalOperatorArming(packet, { operatorIdentity: "reviewer_demo", armedAt: packet.expires_at }),
      /armedAt is at or after packet expires_at/,
    );
  });

  test("refuses an armedAt before the packet's drafted_at", async () => {
    const packet = await loadPacket();
    assert.throws(
      () => buildWorkshopPublicProposalOperatorArming(packet, { operatorIdentity: "reviewer_demo", armedAt: "2026-06-12T00:00:00Z" }),
      /armedAt precedes packet drafted_at/,
    );
  });

  test("refuses a malformed operator identity (no roles, no sessions, single safe-id field)", async () => {
    const packet = await loadPacket();
    assert.throws(
      () => buildWorkshopPublicProposalOperatorArming(packet, { operatorIdentity: "Admin Role: Super User", armedAt: PARAMS.armedAt }),
      /operatorIdentity malformed/,
    );
  });

  test("refuses an accessor-backed hostile packet without invoking the getter (descriptor-snapshot discipline)", async () => {
    const packet = await loadPacket();
    let getterInvoked = false;
    const hostile: Record<string, unknown> = { ...packet };
    Object.defineProperty(hostile, "lifecycle_state", {
      enumerable: true, configurable: true,
      get() { getterInvoked = true; return "drafted"; },
    });
    assert.throws(
      () => buildWorkshopPublicProposalOperatorArming(hostile as never, PARAMS),
      /packet must be a plain own-data object/,
    );
    assert.equal(getterInvoked, false);
  });
});
