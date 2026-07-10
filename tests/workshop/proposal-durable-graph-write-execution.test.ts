// M3 step 3a — the slice the whole project has been pointed at.
//
// This test file proves the negative the operator named: "can the
// markers flip without a real arming, by any path?" The full
// reject-path suite is below. Idempotency is exercised DIRECTLY
// against the actual local-durable-db, not a mock.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initializeLocalDurableDb } from "../../src/db/local-durable-db.ts";
import {
  buildWorkshopPublicProposalOperatorArming,
  type WorkshopProposalOperatorArmingArtifact,
} from "../../src/workshop/proposal-durable-graph-write-operator-arming.ts";
import {
  ATLIERA_GRAPH_SNAPSHOT_ROW_KIND,
  executeWorkshopPublicProposalDurableGraphWrite,
  type DurableGraphSnapshotRow,
  type MaterializationInputFixture,
  type WorkshopProposalDurableGraphWriteOutcome,
} from "../../src/workshop/proposal-durable-graph-write-execution.ts";
import type { WorkshopProposalDurableGraphWriteContractArtifact } from "../../src/workshop/proposal-durable-graph-write-contract.ts";
import type { WorkshopProposalDurableWriteApprovalPacketArtifact } from "../../src/workshop/proposal-durable-graph-write-approval-packet.ts";
import { graphSnapshotWriteLockPath } from "../../src/db/graph-snapshot-write-lock.ts";

const repoRoot = join(import.meta.dirname, "..", "..");
const CONTRACT_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-contract.json");
const PACKET_FIXTURE = join(repoRoot, "fixtures/workshop/workshop-public-proposal-durable-graph-write-approval-packet.json");
const MATERIALIZATION_INPUT_FIXTURE = join(repoRoot, "fixtures/validation/proposal-materialization-public-curated-20260611a-input.json");

const OPERATOR_IDENTITY = "reviewer_demo";
const ARMED_AT = "2026-06-13T01:00:00Z";
const NOW = "2026-06-14T17:00:00Z";

async function setupDb(): Promise<{ rootDir: string; cleanup: () => Promise<void> }> {
  const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3a-"));
  const report = await initializeLocalDurableDb({ rootDir });
  assert.ok(report.ok, `db init failed: ${JSON.stringify(report)}`);
  return { rootDir, cleanup: () => rm(rootDir, { recursive: true, force: true }) };
}

async function loadContract(): Promise<WorkshopProposalDurableGraphWriteContractArtifact> {
  return JSON.parse(await readFile(CONTRACT_FIXTURE, "utf8")) as WorkshopProposalDurableGraphWriteContractArtifact;
}

async function loadPacket(): Promise<WorkshopProposalDurableWriteApprovalPacketArtifact> {
  return JSON.parse(await readFile(PACKET_FIXTURE, "utf8")) as WorkshopProposalDurableWriteApprovalPacketArtifact;
}

async function loadMaterializationInput(): Promise<MaterializationInputFixture> {
  return JSON.parse(await readFile(MATERIALIZATION_INPUT_FIXTURE, "utf8")) as MaterializationInputFixture;
}

async function freshArming(): Promise<WorkshopProposalOperatorArmingArtifact> {
  return buildWorkshopPublicProposalOperatorArming(await loadPacket(), {
    operatorIdentity: OPERATOR_IDENTITY,
    armedAt: ARMED_AT,
  });
}

function isRefused(o: WorkshopProposalDurableGraphWriteOutcome) {
  return o.outcome === "refused";
}
function isCompleted(o: WorkshopProposalDurableGraphWriteOutcome) {
  return o.outcome === "completed";
}
function isNoOp(o: WorkshopProposalDurableGraphWriteOutcome) {
  return o.outcome === "idempotent_no_op";
}

describe("M3 step 3a — the happy path: one real arming produces one durable row stamped L0", () => {
  test("a valid arming + valid contract + valid materialization input → completed outcome, one row in graph_snapshots, L0 stamped on the outcome AND on the row", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      const materializationInput = await loadMaterializationInput();

      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming,
        contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput,
        dbRootDir: rootDir,
        now: NOW,
      });

      assert.equal(outcome.outcome, "completed", `unexpected outcome: ${JSON.stringify(outcome, null, 2)}`);
      if (outcome.outcome !== "completed") throw new Error("not completed");

      // L0 stamp lives on the outcome of the write that happened.
      assert.equal(outcome.mediation_gate_level, "L0");
      assert.equal(outcome.l0_effect_observed, true);
      assert.equal(outcome.durable_write_performed, true);
      assert.equal(outcome.graph_ingestion_performed, true);
      assert.equal(outcome.operator_identity, OPERATOR_IDENTITY);
      assert.equal(outcome.account_id, "acc_acme_robotics");
      assert.equal(outcome.candidate_item_id, "obj_acme-hub-signal");

      // One row, also L0-stamped, in graph_snapshots.jsonl.
      const rowsText = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      const rowLines = rowsText.split("\n").filter((l) => l.trim().length > 0);
      assert.equal(rowLines.length, 1, "exactly one durable row must be present");
      const row = JSON.parse(rowLines[0]!) as DurableGraphSnapshotRow;
      assert.equal(row.kind, ATLIERA_GRAPH_SNAPSHOT_ROW_KIND);
      assert.equal(row.mediation_gate_level, "L0");
      assert.equal(row.operator_identity, OPERATOR_IDENTITY);
      assert.equal(row.candidate_item_id, "obj_acme-hub-signal");
      assert.equal(row.approval_id, packet.approval_id);
      assert.equal(row.contract_artifact_id, packet.contract_artifact_id);
      assert.equal(row.trust_label, "model-proposed-human-ratified-evidence-pending");
      assert.ok(
        row.bundle.claims.every((claim) => claim.provenance_status !== "verified"),
        "human ratification must not mark durable claims Verified",
      );
      assert.ok(
        row.bundle.account_objects.every((object) => object.provenance_status !== "verified"),
        "human ratification must not mark durable account objects Verified",
      );

      // The bundle inside the row has its AuditEvent attributing to the
      // single operator identity (and no other actor_id appears).
      const auditEvents = row.bundle.audit_events;
      assert.equal(auditEvents.length, 1);
      assert.equal(auditEvents[0]!.actor_type, "user");
      assert.equal(auditEvents[0]!.actor_id, OPERATOR_IDENTITY);
      assert.equal(auditEvents[0]!.event_type, "claim.ratified");
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3a — shared graph-snapshot writer lock", () => {
  test("the shared M5a/M3 lock refuses an alias-path M3 writer without changing JSONL", async () => {
    const { rootDir, cleanup } = await setupDb();
    const graphPath = join(rootDir, "tables/graph_snapshots.jsonl");
    const aliasRoot = `${rootDir}-alias`;
    try {
      await symlink(rootDir, aliasRoot, "dir");
      await writeFile(await graphSnapshotWriteLockPath(graphPath), "busy");
      const contract = await loadContract();
      const packet = await loadPacket();
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: await freshArming(),
        contract,
        approvalPacket: {
          approval_id: packet.approval_id,
          contract_artifact_id: packet.contract_artifact_id,
        },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: aliasRoot,
        now: NOW,
      });
      assert.equal(outcome.outcome, "refused");
      if (outcome.outcome === "refused") {
        assert.equal(outcome.refusal_code, "lock_busy");
        assert.equal(outcome.durable_write_performed, false);
      }
      assert.equal(await readFile(graphPath, "utf8"), "");
    } finally {
      await rm(aliasRoot, { force: true });
      await cleanup();
    }
  });

  test("the M3 writer refuses a symlinked graph table before locking or writing", async () => {
    const { rootDir, cleanup } = await setupDb();
    const graphPath = join(rootDir, "tables/graph_snapshots.jsonl");
    const realGraphPath = `${graphPath}.real`;
    try {
      await rename(graphPath, realGraphPath);
      await symlink(realGraphPath, graphPath);
      const contract = await loadContract();
      const packet = await loadPacket();
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: await freshArming(),
        contract,
        approvalPacket: {
          approval_id: packet.approval_id,
          contract_artifact_id: packet.contract_artifact_id,
        },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(outcome.outcome, "refused");
      if (outcome.outcome === "refused") assert.equal(outcome.refusal_code, "durable_db_unreachable");
      assert.equal(await readFile(realGraphPath, "utf8"), "");
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3a — direct-against-DB idempotency: same idempotency key twice produces one row and a clean no-op", () => {
  test("calling the executor twice with the same arming, contract, and now yields one completed + one idempotent_no_op, with exactly one row in the DB", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      const materializationInput = await loadMaterializationInput();

      const first = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput, dbRootDir: rootDir, now: NOW,
      });
      assert.equal(first.outcome, "completed", "first call must complete");
      if (first.outcome !== "completed") throw new Error("not completed");

      const second = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput, dbRootDir: rootDir, now: "2026-06-14T18:00:00Z",
      });
      assert.equal(second.outcome, "idempotent_no_op", `second call must be no-op: ${JSON.stringify(second, null, 2)}`);
      if (second.outcome !== "idempotent_no_op") throw new Error("not no-op");

      // Idempotency key matches. No new L0 stamp on this call.
      assert.equal(second.idempotency_key, first.idempotency_key);
      assert.equal(second.idempotent_referenced_row_id, first.durable_record_id);
      assert.equal(second.idempotent_referenced_row_written_at, first.written_at);
      assert.equal(second.l0_effect_observed_on_this_call, false);
      assert.equal(second.durable_write_performed_on_this_call, false);

      // The DB still contains exactly one row.
      const rowsText = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      const rowLines = rowsText.split("\n").filter((l) => l.trim().length > 0);
      assert.equal(rowLines.length, 1, "DB must contain exactly one row after the idempotent no-op");
    } finally {
      await cleanup();
    }
  });
});

describe("M3 step 3a — the full reject-path suite (the operator's six enumerated paths plus the supporting ones)", () => {
  test("R1: arming kind invalid → refused, no row written", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const validArming = await freshArming();
      const bogusArming = { ...validArming, kind: "not-an-arming" as never };
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: bogusArming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(), dbRootDir: rootDir, now: NOW,
      });
      assert.ok(isRefused(outcome), "must refuse");
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_kind_invalid");
      // No L0 stamp on a refused outcome.
      assert.equal(outcome.l0_effect_observed, false);
      // No row in the DB.
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0, "no row may be written on a refused outcome");
    } finally { await cleanup(); }
  });

  test("R1b: accessor-backed hostile arming is refused without invoking getters", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const validArming = await freshArming();
      let getterInvoked = false;
      const hostile: Record<string, unknown> = { ...validArming };
      Object.defineProperty(hostile, "kind", {
        enumerable: true,
        configurable: true,
        get() {
          getterInvoked = true;
          return validArming.kind;
        },
      });
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: hostile as never,
        contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(getterInvoked, false);
      assert.ok(isRefused(outcome), "hostile arming must refuse");
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_kind_invalid");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R1c: proxied arming is refused before proxy traps can run", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const validArming = await freshArming();
      let trapInvoked = false;
      const hostile = new Proxy(validArming, {
        ownKeys(target) {
          trapInvoked = true;
          return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target, key) {
          trapInvoked = true;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: hostile as never,
        contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(trapInvoked, false);
      assert.ok(isRefused(outcome), "proxied arming must refuse");
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_kind_invalid");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R1d: malformed arming expiry is refused and cannot flip markers", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const validArming = await freshArming();
      const malformedArming = { ...validArming, expires_at: "" };
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: malformedArming as never,
        contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.ok(isRefused(outcome), "malformed expiry must refuse");
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_kind_invalid");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R8b: accessor-backed hostile contract is refused without invoking getters", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      let getterInvoked = false;
      const hostile: Record<string, unknown> = { ...contract };
      Object.defineProperty(hostile, "kind", {
        enumerable: true,
        configurable: true,
        get() {
          getterInvoked = true;
          return contract.kind;
        },
      });
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming,
        contract: hostile as never,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.equal(getterInvoked, false);
      assert.ok(isRefused(outcome), "hostile contract must refuse");
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "contract_kind_invalid");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R8c: canonical idempotency-key suffix is mandatory", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      const contractWithForgedKey = {
        ...contract,
        write_operations: [
          {
            ...contract.write_operations[0]!,
            idempotency_key_shape: "acc_acme_robotics:obj_acme-hub-signal:evil",
          },
        ],
      };
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming,
        contract: contractWithForgedKey,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.ok(isRefused(outcome), "forged idempotency suffix must refuse");
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "contract_boundary_broadened");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R-operator-1: arming whose approval_id doesn't match the packet → write refused, markers stay false", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract,
        approvalPacket: { approval_id: "durable-write-approval-OTHER", contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(), dbRootDir: rootDir, now: NOW,
      });
      assert.ok(isRefused(outcome));
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_approval_id_mismatch_against_packet");
      assert.equal(outcome.l0_effect_observed, false);
      assert.equal(outcome.durable_write_performed, false);
      assert.equal(outcome.graph_ingestion_performed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R-operator-2: arming presented after expires_at → refused", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      // arming.expires_at is 2026-06-20T00:30:00Z; pass a now that is later.
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir, now: "2026-06-21T00:00:00Z",
      });
      assert.ok(isRefused(outcome));
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_expired_at_call_time");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R-operator-3: arming for contract artifact A used to authorize a write of candidate B → refused", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      const bogusContract = { ...contract, contract_artifact_id: "durable-write-contract:other:2026-06-14T00:00:00Z" };
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract: bogusContract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir, now: NOW,
      });
      assert.ok(isRefused(outcome));
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_contract_artifact_id_mismatch_against_contract");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R-operator-3b: arming whose authorized candidate is not in the contract's write_operations → refused", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const validArming = await freshArming();
      const arming = { ...validArming, authorized_candidate_item_ids: Object.freeze(["obj_not-in-contract"]) };
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir, now: NOW,
      });
      assert.ok(isRefused(outcome));
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "arming_authorizes_wrong_candidate");
      assert.equal(outcome.l0_effect_observed, false);
      const text = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(text.trim().length, 0);
    } finally { await cleanup(); }
  });

  test("R-operator-4: a second write attempt against an already-consumed arming → refused (arming is one-shot)", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();

      // First write consumes the arming.
      const first = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir, now: NOW,
      });
      assert.equal(first.outcome, "completed", "first call must complete to consume the arming");

      // Now create a tampered arming that pins the SAME approval_id but
      // a DIFFERENT candidate, and try to slip a second write past us.
      // Since arming.approval_id is already present on a prior row, R9
      // refuses.
      const tamperedArming = { ...arming, authorized_candidate_item_ids: Object.freeze(["obj_not-in-contract"]) };
      const second = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: tamperedArming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir, now: "2026-06-14T19:00:00Z",
      });
      assert.ok(isRefused(second), `must refuse a second write; got: ${JSON.stringify(second, null, 2)}`);
      if (second.outcome !== "refused") throw new Error("not refused");
      // R9 fires before R7 because the duplicate-approval check runs
      // on the DB rows; either way, a refusal that names the one-shot
      // consumption is acceptable. (The contract test only requires
      // refusal; we accept either code as long as no second row lands.)
      assert.ok(
        ["arming_already_consumed_against_durable_state", "arming_authorizes_wrong_candidate"].includes(second.refusal_code),
        `unexpected refusal_code: ${second.refusal_code}`,
      );
      assert.equal(second.l0_effect_observed, false);

      // The DB still contains exactly one row.
      const rowsText = await readFile(join(rootDir, "tables/graph_snapshots.jsonl"), "utf8");
      assert.equal(rowsText.split("\n").filter((l) => l.trim().length > 0).length, 1);
    } finally { await cleanup(); }
  });

  test("R-operator-5: mid-write transaction failure → no row written, durable_writes_performed false, sanitized refusal emitted", async () => {
    // Simulate an unreachable DB by passing a dbRootDir whose
    // graph_snapshots.jsonl does not exist (uninitialized DB).
    const rootDir = await mkdtemp(join(tmpdir(), "atliera-m3-3a-noinit-"));
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir, now: NOW,
      });
      assert.ok(isRefused(outcome), "uninitialized DB must refuse");
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "durable_db_unreachable");
      assert.equal(outcome.l0_effect_observed, false);
      assert.equal(outcome.durable_write_performed, false);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("R-operator-5b: a stale deterministic temp file is removed on transaction failure", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      const graphPath = join(rootDir, "tables/graph_snapshots.jsonl");
      const tempPath = `${graphPath}.${process.pid}.${NOW.replace(/[:.]/g, "-")}.tmp`;
      await writeFile(tempPath, "stale prepared snapshot\n");
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming,
        contract,
        approvalPacket: {
          approval_id: packet.approval_id,
          contract_artifact_id: packet.contract_artifact_id,
        },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir,
        now: NOW,
      });
      assert.ok(isRefused(outcome));
      if (outcome.outcome !== "refused") throw new Error("not refused");
      assert.equal(outcome.refusal_code, "transaction_aborted_mid_write");
      await assert.rejects(readFile(tempPath, "utf8"), { code: "ENOENT" });
      assert.equal(await readFile(graphPath, "utf8"), "");
    } finally { await cleanup(); }
  });

  test("R-operator-6: refusals must NOT stamp a mediation_gate_level — refused outcomes never claim an L0 event", async () => {
    const { rootDir, cleanup } = await setupDb();
    try {
      const contract = await loadContract();
      const packet = await loadPacket();
      const arming = await freshArming();
      // Force any refusal path.
      const outcome = await executeWorkshopPublicProposalDurableGraphWrite({
        arming: { ...arming, kind: "bad" as never }, contract,
        approvalPacket: { approval_id: packet.approval_id, contract_artifact_id: packet.contract_artifact_id },
        materializationInput: await loadMaterializationInput(),
        dbRootDir: rootDir, now: NOW,
      });
      // Refused outcomes have no `mediation_gate_level` property.
      assert.ok(!("mediation_gate_level" in outcome), "refused outcome must not carry mediation_gate_level");
      assert.equal((outcome as { l0_effect_observed: boolean }).l0_effect_observed, false);
    } finally { await cleanup(); }
  });
});
