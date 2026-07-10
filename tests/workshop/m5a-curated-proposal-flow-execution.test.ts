import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { initializeLocalDurableDb } from "../../src/db/local-durable-db.ts";
import { readWorkshopPublicProposalDurableGraphSnapshots } from "../../src/workshop/durable-graph-snapshots-reader.ts";
import {
  buildM5aCuratedProposalFlowApprovalPacket,
  type M5aCuratedProposalFlowApprovalPacketArtifact,
} from "../../src/workshop/m5a-curated-proposal-flow-approval-packet.ts";
import {
  buildM5aCuratedProposalFlowContract,
  type M5aCuratedProposalFlowContractArtifact,
} from "../../src/workshop/m5a-curated-proposal-flow-contract.ts";
import {
  canonicalM5aCuratedProposalFlowDurableRecordId,
  evaluateM5aCuratedProposalWorkshopBundle,
  executeM5aCuratedProposalFlow,
  M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
  type M5aCuratedProposalFlowExecutionOptions,
} from "../../src/workshop/m5a-curated-proposal-flow-execution.ts";
import { graphSnapshotWriteLockPath } from "../../src/db/graph-snapshot-write-lock.ts";
import {
  buildM5aCuratedProposalFlowOperatorArming,
  type M5aCuratedProposalFlowOperatorArmingArtifact,
} from "../../src/workshop/m5a-curated-proposal-flow-operator-arming.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const INPUT_PATH = join(
  ROOT,
  "fixtures/validation/m5a-curated-proposal-flow-capstone-20260710a-input.json",
);
const CONTRACTED_AT = "2026-07-10T09:00:00Z";
const EXPIRES_AT = "2026-07-11T09:00:00Z";
const ARMED_AT = "2026-07-10T10:00:00Z";
const EXECUTED_AT = "2026-07-10T11:00:00Z";

type InputFixture = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function reverseOwnKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => reverseOwnKeyOrder(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([key, item]) => [key, reverseOwnKeyOrder(item)]),
    );
  }
  return value;
}

async function fixture(): Promise<InputFixture> {
  return JSON.parse(await readFile(INPUT_PATH, "utf8")) as InputFixture;
}

async function authorization(input?: InputFixture, draftedBy = "reviewer_demo"): Promise<{
  contract: M5aCuratedProposalFlowContractArtifact;
  packet: M5aCuratedProposalFlowApprovalPacketArtifact;
  arming: M5aCuratedProposalFlowOperatorArmingArtifact;
}> {
  const materializationInput = input ?? await fixture();
  const contract = buildM5aCuratedProposalFlowContract(materializationInput, {
    flowId: "m5a-capstone-flow-20260710a",
    now: CONTRACTED_AT,
  });
  const packet = buildM5aCuratedProposalFlowApprovalPacket(contract, {
    now: CONTRACTED_AT,
    draftedBy,
    expiresAt: EXPIRES_AT,
  });
  const arming = buildM5aCuratedProposalFlowOperatorArming(contract, packet, {
    armedAt: ARMED_AT,
    armedBy: "operator_demo",
  });
  return { contract, packet, arming };
}

async function setup() {
  const dbRootDir = await mkdtemp(join(tmpdir(), "atliera-m5a-step4-"));
  const initialized = await initializeLocalDurableDb({
    rootDir: dbRootDir,
    now: "2026-07-10T08:00:00.000Z",
  });
  assert.equal(initialized.ok, true);
  return {
    dbRootDir,
    graphPath: join(dbRootDir, "tables/graph_snapshots.jsonl"),
    cleanup: () => rm(dbRootDir, { recursive: true, force: true }),
  };
}

async function validOptions(dbRootDir: string): Promise<M5aCuratedProposalFlowExecutionOptions> {
  const input = await fixture();
  const { contract, packet, arming } = await authorization(input);
  return {
    contract,
    approvalPacket: packet,
    arming,
    materializationInput: input,
    dbRootDir,
    now: EXECUTED_AT,
  };
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

describe("M5a Step 4 curated-flow capstone", () => {
  test("one arming writes one full proposal-set row, reads it back, and renders curated cards", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const outcome = await executeM5aCuratedProposalFlow(options);
      assert.equal(outcome.outcome, "completed", JSON.stringify(outcome));
      if (outcome.outcome !== "completed") return;

      assert.deepEqual(outcome.stage_order, [
        "materialize",
        "validate",
        "ratify",
        "durable_write",
        "render",
      ]);
      assert.equal(outcome.counts.curated_proposal_flows, 1);
      assert.equal(outcome.counts.proposal_sets, 1);
      assert.equal(outcome.counts.durable_transactions, 1);
      assert.equal(outcome.counts.durable_rows_written, 1);
      assert.equal(outcome.counts.durable_read_backs, 1);
      assert.equal(outcome.counts.rendered_artifacts, 1);
      assert.ok(outcome.counts.ratified_durable_records >= 2);
      assert.ok(outcome.counts.populated_lenses >= 2);
      assert.equal(outcome.counts.rendered_cards, outcome.counts.ratified_durable_records);
      assert.equal(outcome.counts.curated_labeled_cards, outcome.counts.rendered_cards);
      assert.equal(outcome.mediation_gate_level, "L0");
      assert.equal(outcome.operator_identity, "operator_demo");
      assert.equal(outcome.durable_write_performed, true);
      assert.equal(outcome.durable_read_back_performed, true);
      assert.equal(outcome.rendered_from_durable_state, true);
      assert.deepEqual(outcome.boundaries, {
        provider_calls_made: 0,
        fresh_provider_calls: 0,
        acquisition_operations: 0,
        private_evidence_reads: 0,
        retry_attempts: 0,
        production_writes: 0,
        readiness_claim: false,
      });
      assert.equal(
        outcome.materialization_input_sha256,
        M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
      );
      assert.match(outcome.durable_record_id, /^m5a-flow:[0-9a-f]{40}$/);
      assert.equal(
        outcome.durable_record_id,
        canonicalM5aCuratedProposalFlowDurableRecordId(
          outcome.one_shot_consumption_key,
          outcome.materialization_input_sha256,
        ),
      );

      const html = outcome.rendered_artifact.html;
      assert.equal(
        html,
        await readFile(
          join(ROOT, "fixtures/workshop/m5a-curated-proposal-flow-capstone.html"),
          "utf8",
        ),
      );
      assert.equal(
        html.split('data-curated-provenance="hand-curated-public"').length - 1,
        outcome.counts.rendered_cards,
      );
      assert.equal(
        html.split("Curated public source").length - 1,
        outcome.counts.rendered_cards,
      );
      assert.doesNotMatch(html, /Verified/);
      assert.doesNotMatch(html, /pending human review/i);

      const readBack = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: db.dbRootDir,
        now: EXECUTED_AT,
      });
      assert.equal(readBack.refusals.length, 0);
      assert.equal(readBack.rows.length, 1);
      const row = readBack.rows[0]!;
      assert.equal(row.idempotency_key, outcome.one_shot_consumption_key);
      assert.equal(row.bundle.account_objects.length, 3);
      assert.equal(row.bundle.claims.length, 3);
      assert.ok(row.bundle.excerpts.every((record) => record.validation_status === "accepted"));
      assert.ok(row.bundle.claims.every((record) => record.provenance_status === "source_document_only"));
      assert.ok(row.bundle.account_objects.every((record) => record.provenance_status === "source_document_only"));
      assert.equal(
        row.bundle.run_artifacts[0]?.payload_json.materialization_input_sha256,
        M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
      );
    } finally {
      await db.cleanup();
    }
  });

  test("same arming replay and a different event-specific arming over the same packet both refuse", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const first = await executeM5aCuratedProposalFlow(options);
      assert.equal(first.outcome, "completed");
      const replay = await executeM5aCuratedProposalFlow({ ...options, now: "2026-07-10T11:01:00Z" });
      assert.equal(replay.outcome, "refused");
      if (replay.outcome === "refused") {
        assert.equal(replay.refusal_code, "one_shot_replay");
        assert.equal(hasOwn(replay, "mediation_gate_level"), false);
        assert.equal(replay.rendered_artifacts, 0);
      }

      const secondArming = buildM5aCuratedProposalFlowOperatorArming(
        options.contract as M5aCuratedProposalFlowContractArtifact,
        options.approvalPacket as M5aCuratedProposalFlowApprovalPacketArtifact,
        { armedAt: "2026-07-10T10:30:00Z", armedBy: "operator_second" },
      );
      assert.equal(secondArming.one_shot_consumption_key, options.arming &&
        (options.arming as M5aCuratedProposalFlowOperatorArmingArtifact).one_shot_consumption_key);
      const secondEvent = await executeM5aCuratedProposalFlow({
        ...options,
        arming: secondArming,
        now: "2026-07-10T11:02:00Z",
      });
      assert.equal(secondEvent.outcome, "refused");
      if (secondEvent.outcome === "refused") assert.equal(secondEvent.refusal_code, "one_shot_replay");
      assert.equal((await readFile(db.graphPath, "utf8")).trim().split("\n").length, 1);
    } finally {
      await db.cleanup();
    }
  });

  test("expired and malformed execution timestamps refuse without effects", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const expired = await executeM5aCuratedProposalFlow({ ...options, now: EXPIRES_AT });
      assert.equal(expired.outcome, "refused");
      if (expired.outcome === "refused") assert.equal(expired.refusal_code, "authorization_expired");
      const malformed = await executeM5aCuratedProposalFlow({ ...options, now: "2026-99-99T99:99:99Z" });
      assert.equal(malformed.outcome, "refused");
      if (malformed.outcome === "refused") assert.equal(malformed.refusal_code, "input_invalid");
      assert.equal(await readFile(db.graphPath, "utf8"), "");
    } finally {
      await db.cleanup();
    }
  });

  test("tuple mismatch, materialization identity drift, count drift, and broadened boundaries refuse", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const otherInput = await fixture();
      (otherInput.context as Record<string, unknown>).account_id = "acc_other_account";
      const other = await authorization(otherInput);
      const tupleMismatch = await executeM5aCuratedProposalFlow({
        ...options,
        approvalPacket: other.packet,
      });
      assert.equal(tupleMismatch.outcome, "refused");

      const identityDrift = clone(options.materializationInput as InputFixture);
      (identityDrift.context as Record<string, unknown>).proposal_set_id = "different-proposal-set";
      const identity = await executeM5aCuratedProposalFlow({ ...options, materializationInput: identityDrift });
      assert.equal(identity.outcome, "refused");
      if (identity.outcome === "refused") {
        assert.equal(identity.refusal_code, "recorded_proposal_digest_mismatch");
      }

      const countDrift = clone(options.materializationInput as InputFixture);
      (countDrift.proposed_account_objects as unknown[]).push(
        clone((countDrift.proposed_account_objects as unknown[])[0]),
      );
      const count = await executeM5aCuratedProposalFlow({ ...options, materializationInput: countDrift });
      assert.equal(count.outcome, "refused");
      if (count.outcome === "refused") {
        assert.equal(count.refusal_code, "recorded_proposal_digest_mismatch");
      }

      const broadened = clone(options.arming as M5aCuratedProposalFlowOperatorArmingArtifact);
      (broadened.boundaries as { retry_budget: number }).retry_budget = 1;
      const broadenedResult = await executeM5aCuratedProposalFlow({ ...options, arming: broadened });
      assert.equal(broadenedResult.outcome, "refused");
      assert.equal(await readFile(db.graphPath, "utf8"), "");
    } finally {
      await db.cleanup();
    }
  });

  test("fixture digest refuses valid source, claim, and object text drift with unchanged structural identity", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const drift = clone(options.materializationInput as InputFixture);
      ((drift.public_sources as Record<string, unknown>[])[0]!).title = "Changed valid public source title";
      ((drift.proposed_claims as Record<string, unknown>[])[0]!).text = "Changed valid claim text";
      ((drift.proposed_account_objects as Record<string, unknown>[])[0]!).summary =
        "Changed valid account object summary";
      const result = await executeM5aCuratedProposalFlow({ ...options, materializationInput: drift });
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") {
        assert.equal(result.refusal_code, "recorded_proposal_digest_mismatch");
        assert.equal(result.durable_writes_performed, false);
      }
      assert.equal(await readFile(db.graphPath, "utf8"), "");
    } finally {
      await db.cleanup();
    }
  });

  test("fixture digest is canonical across object key insertion order", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const result = await executeM5aCuratedProposalFlow({
        ...options,
        materializationInput: reverseOwnKeyOrder(options.materializationInput),
      });
      assert.equal(result.outcome, "completed", JSON.stringify(result));
      if (result.outcome === "completed") {
        assert.equal(
          result.materialization_input_sha256,
          M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
        );
      }
    } finally {
      await db.cleanup();
    }
  });

  test("typed evaluation ignores valid text containing trust and curated-label words", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const outcome = await executeM5aCuratedProposalFlow(options);
      assert.equal(outcome.outcome, "completed");
      if (outcome.outcome !== "completed") return;
      const readBack = await readWorkshopPublicProposalDurableGraphSnapshots({
        dbRootDir: db.dbRootDir,
        now: EXECUTED_AT,
      });
      const bundle = clone(readBack.rows[0]!.bundle);
      bundle.sources[0]!.title = "Verified — Curated public source";
      bundle.claims[0]!.text = "Verified and Curated public source are ordinary claim words";
      bundle.account_objects[0]!.title = "Verified account title";
      bundle.account_objects[0]!.summary = "Curated public source in a valid summary";
      const evaluation = evaluateM5aCuratedProposalWorkshopBundle(
        bundle,
        (options.contract as M5aCuratedProposalFlowContractArtifact).success_criterion,
      );
      assert.equal(evaluation.ok, true);
      if (evaluation.ok) {
        assert.equal(evaluation.curated_labeled_cards, bundle.account_objects.length);
        assert.equal(evaluation.rendered_cards, bundle.account_objects.length);
      }
    } finally {
      await db.cleanup();
    }
  });

  test("an otherwise compatible JSONL directory without the local DB manifest refuses before locking", async () => {
    const dbRootDir = await mkdtemp(join(tmpdir(), "atliera-m5a-step4-no-manifest-"));
    const graphPath = join(dbRootDir, "tables/graph_snapshots.jsonl");
    try {
      await mkdir(join(dbRootDir, "tables"), { recursive: true });
      await writeFile(graphPath, "");
      await writeFile(join(dbRootDir, "tables/job_queue.jsonl"), "");
      await writeFile(join(dbRootDir, "tables/schema_migrations.jsonl"), "");
      const result = await executeM5aCuratedProposalFlow(await validOptions(dbRootDir));
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") assert.equal(result.refusal_code, "durable_db_invalid");
      assert.equal(await readFile(graphPath, "utf8"), "");
      await assert.rejects(readFile(await graphSnapshotWriteLockPath(graphPath), "utf8"), { code: "ENOENT" });
    } finally {
      await rm(dbRootDir, { recursive: true, force: true });
    }
  });

  test("canonical durable identity is stable, authorization-distinct, and conflict-refusing", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const first = await executeM5aCuratedProposalFlow(options);
      assert.equal(first.outcome, "completed");
      if (first.outcome !== "completed") return;
      const different = await authorization(await fixture(), "reviewer_other");
      assert.notEqual(
        canonicalM5aCuratedProposalFlowDurableRecordId(
          different.arming.one_shot_consumption_key,
          M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256,
        ),
        first.durable_record_id,
      );

      const row = JSON.parse((await readFile(db.graphPath, "utf8")).trim()) as Record<string, unknown>;
      row.idempotency_key = "m5a-one-shot:0000000000000000000000000000000000000000";
      await writeFile(db.graphPath, `${JSON.stringify(row)}\n`);
      const before = await readFile(db.graphPath, "utf8");
      const conflict = await executeM5aCuratedProposalFlow({ ...options, now: "2026-07-10T11:01:00Z" });
      assert.equal(conflict.outcome, "refused");
      if (conflict.outcome === "refused") {
        assert.equal(conflict.refusal_code, "durable_record_id_conflict");
      }
      assert.equal(await readFile(db.graphPath, "utf8"), before);
    } finally {
      await db.cleanup();
    }
  });

  test("duplicate durable_record_id values already in JSONL fail closed", async () => {
    const db = await setup();
    try {
      const options = await validOptions(db.dbRootDir);
      const first = await executeM5aCuratedProposalFlow(options);
      assert.equal(first.outcome, "completed");
      const row = JSON.parse((await readFile(db.graphPath, "utf8")).trim()) as Record<string, unknown>;
      const duplicate = { ...row, idempotency_key: "m5a-one-shot:1111111111111111111111111111111111111111" };
      await writeFile(db.graphPath, `${JSON.stringify(row)}\n${JSON.stringify(duplicate)}\n`);
      const before = await readFile(db.graphPath, "utf8");
      const result = await executeM5aCuratedProposalFlow({ ...options, now: "2026-07-10T11:01:00Z" });
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") assert.equal(result.refusal_code, "durable_state_invalid");
      assert.equal(await readFile(db.graphPath, "utf8"), before);
    } finally {
      await db.cleanup();
    }
  });

  test("malformed existing durable rows fail closed before append", async () => {
    const db = await setup();
    try {
      const malformed = '{"kind":"counterfeit-row"}\n';
      await writeFile(db.graphPath, malformed);
      const result = await executeM5aCuratedProposalFlow(await validOptions(db.dbRootDir));
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") assert.equal(result.refusal_code, "durable_state_invalid");
      assert.equal(await readFile(db.graphPath, "utf8"), malformed);
    } finally {
      await db.cleanup();
    }
  });

  test("busy lock refuses with no retry, write, read-back, render, or L0 stamp", async () => {
    const db = await setup();
    try {
      await writeFile(await graphSnapshotWriteLockPath(db.graphPath), "busy");
      const result = await executeM5aCuratedProposalFlow(await validOptions(db.dbRootDir));
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") {
        assert.equal(result.refusal_code, "lock_busy");
        assert.equal(result.retry_attempts, 0);
        assert.equal(result.durable_writes_performed, false);
        assert.equal(result.durable_read_backs_performed, false);
        assert.equal(result.rendered_artifacts, 0);
        assert.equal(hasOwn(result, "mediation_gate_level"), false);
      }
      assert.equal(await readFile(db.graphPath, "utf8"), "");
    } finally {
      await db.cleanup();
    }
  });

  test("a symlink alias to one DB root resolves to the same shared writer lock", async () => {
    const db = await setup();
    const aliasRoot = `${db.dbRootDir}-alias`;
    try {
      await symlink(db.dbRootDir, aliasRoot, "dir");
      const aliasGraphPath = join(aliasRoot, "tables/graph_snapshots.jsonl");
      assert.equal(
        await graphSnapshotWriteLockPath(aliasGraphPath),
        await graphSnapshotWriteLockPath(db.graphPath),
      );
      await writeFile(await graphSnapshotWriteLockPath(db.graphPath), "busy");
      const result = await executeM5aCuratedProposalFlow(await validOptions(aliasRoot));
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") assert.equal(result.refusal_code, "lock_busy");
      assert.equal(await readFile(db.graphPath, "utf8"), "");
    } finally {
      await rm(aliasRoot, { force: true });
      await db.cleanup();
    }
  });

  test("an initialized manifest with a symlinked graph table fails local DB inspection", async () => {
    const db = await setup();
    try {
      const realGraphPath = `${db.graphPath}.real`;
      await rename(db.graphPath, realGraphPath);
      await symlink(realGraphPath, db.graphPath);
      const result = await executeM5aCuratedProposalFlow(await validOptions(db.dbRootDir));
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") assert.equal(result.refusal_code, "durable_db_invalid");
      assert.equal(await readFile(realGraphPath, "utf8"), "");
    } finally {
      await db.cleanup();
    }
  });

  test("deterministic exclusive-temp failure leaves the original file byte-identical", async () => {
    const db = await setup();
    try {
      const before = await readFile(db.graphPath, "utf8");
      await mkdir(`${db.graphPath}.m5a-step4.tmp`);
      const result = await executeM5aCuratedProposalFlow(await validOptions(db.dbRootDir));
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") {
        assert.equal(result.refusal_code, "transaction_aborted");
        assert.equal(result.durable_writes_performed, false);
        assert.equal(hasOwn(result, "mediation_gate_level"), false);
      }
      assert.equal(await readFile(db.graphPath, "utf8"), before);
    } finally {
      await db.cleanup();
    }
  });
});
