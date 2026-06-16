// M3 step 3b safety contract: durable-state readers must fail closed at the
// row trust boundary before reflection/value reads on hostile objects.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initializeLocalDurableDb } from "../../src/db/local-durable-db.ts";
import { buildWorkshopPublicProposalOperatorArming } from "../../src/workshop/proposal-durable-graph-write-operator-arming.ts";
import {
  executeWorkshopPublicProposalDurableGraphWrite,
  type DurableGraphSnapshotRow,
  type MaterializationInputFixture,
} from "../../src/workshop/proposal-durable-graph-write-execution.ts";
import type { WorkshopProposalDurableGraphWriteContractArtifact } from "../../src/workshop/proposal-durable-graph-write-contract.ts";
import type { WorkshopProposalDurableWriteApprovalPacketArtifact } from "../../src/workshop/proposal-durable-graph-write-approval-packet.ts";
import { snapshotDurableGraphSnapshotRow } from "../../src/workshop/durable-graph-snapshots-reader.ts";
import { buildWorkshopViewModelFromDurableState } from "../../src/workshop/durable-state-view-model.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";
import type { WorkshopProposalHumanReviewDecisionArtifact } from "../../src/workshop/proposal-review-decision.ts";

const repoRoot = join(import.meta.dirname, "..", "..");
const CONTRACT_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json");
const PACKET_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json");
const MATERIALIZATION_INPUT_FIXTURE = join(repoRoot, "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json");
const DECISION_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-human-review-decision-artifact.json");
const OPERATOR_IDENTITY = "reviewer_demo";
const ARMED_AT = "2026-06-13T01:00:00Z";
const NOW = "2026-06-14T17:00:00Z";

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function validDurableRow(): Promise<DurableGraphSnapshotRow> {
  const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3b-safety-"));
  try {
    const report = await initializeLocalDurableDb({ rootDir });
    assert.ok(report.ok, `db init failed: ${JSON.stringify(report)}`);
    const packet = await loadJson<WorkshopProposalDurableWriteApprovalPacketArtifact>(PACKET_FIXTURE);
    const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
      arming: buildWorkshopPublicProposalOperatorArming(packet, {
        operatorIdentity: OPERATOR_IDENTITY,
        armedAt: ARMED_AT,
      }),
      contract: await loadJson<WorkshopProposalDurableGraphWriteContractArtifact>(CONTRACT_FIXTURE),
      approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
      materializationInput: await loadJson<MaterializationInputFixture>(MATERIALIZATION_INPUT_FIXTURE),
      dbRootDir: rootDir,
      now: NOW,
    });
    assert.equal(outcome.outcome, "completed");
    const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
    return JSON.parse(text.trim()) as DurableGraphSnapshotRow;
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function reviewArtifactWithOneRejected(): Promise<WorkshopProposalHumanReviewDecisionArtifact> {
  const artifact = await loadJson<WorkshopProposalHumanReviewDecisionArtifact>(DECISION_FIXTURE);
  const accepted = artifact.decisions[0]!;
  return {
    ...artifact,
    decisions: [{
      ...accepted,
      item_id: "obj_rejected_safety_fixture",
      decision: "reject",
      rationale: "Rejected in safety fixture.",
      graph_candidate_ref: null,
      promotion_performed: false,
    }],
    counts: {
      accepted_for_graph_candidate: 0,
      rejected: 1,
      needs_more_evidence: 0,
      deferred: 0,
    },
  };
}

describe("M3 step 3b durable state read safety", () => {
  test("refuses Proxy-backed rows before descriptor reflection traps can run", async () => {
    const row = await validDurableRow();
    let trapInvoked = false;
    const hostile = new Proxy(row, {
      ownKeys(target) {
        trapInvoked = true;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        trapInvoked = true;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      get(target, key, receiver) {
        trapInvoked = true;
        return Reflect.get(target, key, receiver);
      },
    });

    assert.throws(
      () => snapshotDurableGraphSnapshotRow(hostile),
      /durable graph snapshot row must not be a Proxy/,
    );
    assert.equal(trapInvoked, false, "Proxy traps must not run before refusal");
  });

  test("refuses accessor-backed rows without invoking getter values", async () => {
    const row = await validDurableRow();
    let getterInvoked = false;
    const hostile: Record<string, unknown> = { ...row };
    Object.defineProperty(hostile, "trust_label", {
      enumerable: true,
      configurable: true,
      get() {
        getterInvoked = true;
        return row.trust_label;
      },
    });

    assert.throws(
      () => snapshotDurableGraphSnapshotRow(hostile),
      /durable graph snapshot row must be a plain own-data object/,
    );
    assert.equal(getterInvoked, false, "accessor getter must not run before refusal");
  });

  test("refuses Proxy-backed row arrays before array traps can run", async () => {
    const row = await validDurableRow();
    let trapInvoked = false;
    const hostileRows = new Proxy([row], {
      get(target, key, receiver) {
        trapInvoked = true;
        return Reflect.get(target, key, receiver);
      },
      getOwnPropertyDescriptor(target, key) {
        trapInvoked = true;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      ownKeys(target) {
        trapInvoked = true;
        return Reflect.ownKeys(target);
      },
    });

    assert.throws(
      () => buildWorkshopViewModelFromDurableState(hostileRows),
      /durable state rows must not be a Proxy/,
    );
    assert.equal(trapInvoked, false, "row-array Proxy traps must not run before refusal");
  });

  test("refuses accessor-backed row arrays without invoking index getters", async () => {
    const row = await validDurableRow();
    let getterInvoked = false;
    const hostileRows: unknown[] = [];
    Object.defineProperty(hostileRows, "0", {
      enumerable: true,
      configurable: true,
      get() {
        getterInvoked = true;
        return row;
      },
    });
    Object.defineProperty(hostileRows, "length", {
      value: 1,
      writable: true,
      enumerable: false,
      configurable: false,
    });

    assert.throws(
      () => buildWorkshopViewModelFromDurableState(hostileRows),
      /durable state rows must contain only enumerable own-data array items/,
    );
    assert.equal(getterInvoked, false, "row-array index getter must not run before refusal");
  });

  test("refuses nested Proxy-backed bundles before nested traps can run", async () => {
    const row = await validDurableRow();
    let trapInvoked = false;
    const hostileBundle = new Proxy(row.bundle, {
      ownKeys(target) {
        trapInvoked = true;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        trapInvoked = true;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      get(target, key, receiver) {
        trapInvoked = true;
        return Reflect.get(target, key, receiver);
      },
    });
    const hostile = { ...row, bundle: hostileBundle };

    assert.throws(
      () => snapshotDurableGraphSnapshotRow(hostile),
      /durable graph snapshot row\.bundle must not be a Proxy/,
    );
    assert.equal(trapInvoked, false, "nested Proxy traps must not run before refusal");
  });

  test("refuses pending-review durable rows that carry verified contained records", async () => {
    const row = await validDurableRow();
    const tampered = {
      ...row,
      bundle: {
        ...row.bundle,
        account_objects: [{ ...row.bundle.account_objects[0]!, provenance_status: "verified" }],
      },
    };

    assert.throws(
      () => buildWorkshopViewModelFromDurableState([tampered]),
      /pending-review durable row must not carry verified records/,
    );
  });

  test("refuses durable rows whose M3 trust label is not the pending-review label", async () => {
    const row = await validDurableRow();
    const tampered = {
      ...row,
      trust_label: "unexpected-safe-trust-label",
    };

    assert.throws(
      () => buildWorkshopViewModelFromDurableState([tampered]),
      /trust_label must be the M3 pending-review trust label/,
    );
  });

  test("refuses accessor-backed review artifacts without invoking getters", async () => {
    const row = await validDurableRow();
    const artifact = await reviewArtifactWithOneRejected();
    let getterInvoked = false;
    const hostile: Record<string, unknown> = { ...artifact };
    Object.defineProperty(hostile, "provider_calls_made", {
      enumerable: true,
      configurable: true,
      get() {
        getterInvoked = true;
        return 0;
      },
    });

    assert.throws(
      () => buildWorkshopViewModelFromDurableState([row], { reviewDecisionArtifact: hostile as never }),
      /human review decision artifact must be a plain own-data object/,
    );
    assert.equal(getterInvoked, false, "review artifact getter must not run before refusal");
  });

  test("refuses review artifacts that broaden provider or private-evidence boundaries", async () => {
    const row = await validDurableRow();
    const artifact = await reviewArtifactWithOneRejected();
    const broadened = {
      ...artifact,
      provider_calls_made: 1,
      private_evidence_read: true,
      boundaries: {
        ...artifact.boundaries,
        provider_calls_executed: 1,
        private_evidence_read: true,
      },
    };

    assert.throws(
      () => buildWorkshopViewModelFromDurableState([row], { reviewDecisionArtifact: broadened as never }),
      /closed human-review decision artifact/,
    );
  });

  test("source_document_only durable records render conservatively and never as a Verified pill", async () => {
    const row = await validDurableRow();
    assert.equal(row.bundle.account_objects[0]!.provenance_status, "source_document_only");

    const vm = buildWorkshopViewModelFromDurableState([row]);
    const html = renderWorkshopHtml(vm, { previewMode: "validation" });

    assert.equal(vm.totals.verified_objects, 0);
    assert.match(html, />Unverified<\/span>/);
    assert.doesNotMatch(html, />Verified<\/span>/);
  });
});
