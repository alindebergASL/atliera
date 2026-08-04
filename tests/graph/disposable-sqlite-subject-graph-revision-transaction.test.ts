import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test, type TestContext } from "node:test";
import { Worker } from "node:worker_threads";

import {
  canonicalJson,
  sha256CanonicalJson,
  snapshotStrictJson,
  type StrictJsonValue,
} from "../../src/authority/strict-json.ts";
import {
  DisposableSqliteSubjectGraphRevisionTransaction,
  SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES,
  SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES,
  type DisposableSqliteSubjectGraphRevisionTestFaultPoint,
} from "../../src/graph/disposable-sqlite-subject-graph-revision-transaction.ts";
import {
  createDisposableSqliteSubjectGraphRevisionLabPermit,
  type SubjectGraphRevisionTransactionResult,
} from "../../src/graph/subject-graph-revision-transaction.ts";
import { clone } from "../fixtures/valid-graph.ts";
import { makePipelineRevisionIntent } from "./subject-graph-revision-transaction-fixture.ts";

interface TempDatabase {
  readonly directory: string;
  readonly path: string;
}

const WORKER_URL = new URL(
  "./subject-graph-revision-transaction-worker.ts",
  import.meta.url,
);

function tempDatabase(t: TestContext, label: string): TempDatabase {
  const directory = mkdtempSync(
    join(tmpdir(), `atliera-subject-graph-revision-${label}-`),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, path: join(directory, "state.sqlite") };
}

function adapter(
  fixture: TempDatabase,
  hook?: (point: DisposableSqliteSubjectGraphRevisionTestFaultPoint) => void,
): DisposableSqliteSubjectGraphRevisionTransaction {
  return new DisposableSqliteSubjectGraphRevisionTransaction({
    database_path: fixture.path,
    isolated_temporary_directory: fixture.directory,
    test_only_fault_hook: hook,
  });
}

function permit() {
  return createDisposableSqliteSubjectGraphRevisionLabPermit();
}

function openRaw(path: string, readOnly = true): DatabaseSync {
  return new DatabaseSync(path, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
    readOnly,
  });
}

function tableCounts(path: string) {
  const db = openRaw(path);
  try {
    const count = (table: string): number => {
      const row = db.prepare(`SELECT count(*) AS count FROM ${table}`).get();
      assert.equal(typeof row?.count, "number");
      return row!.count as number;
    };
    return {
      graph: count("subject_graph_current_state"),
      replay: count("subject_graph_replay_consumptions"),
      audit: count("subject_graph_success_receipts"),
    };
  } finally {
    db.close();
  }
}

function assertRecursivelyFrozen(
  value: unknown,
  seen = new WeakSet<object>(),
): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) assertRecursivelyFrozen(descriptor.value, seen);
  }
}

function rehashIntent(rawIntent: unknown): Record<string, any> {
  const intent = clone(rawIntent) as Record<string, any>;
  delete intent.intent_sha256;
  intent.intent_sha256 = sha256CanonicalJson(intent as StrictJsonValue);
  return intent;
}

function replayCollisionIntent(rawIntent: unknown, replayKey: string) {
  const intent = clone(rawIntent) as Record<string, any>;
  intent.replay_key_to_record = replayKey;
  intent.review_handoff.replay_key_to_record = replayKey;
  intent.review_handoff_sha256 = sha256CanonicalJson(
    intent.review_handoff as StrictJsonValue,
  );
  return rehashIntent(intent);
}

function runWorker(input: Record<string, unknown>): Promise<SubjectGraphRevisionTransactionResult> {
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(WORKER_URL, { workerData: input });
    worker.once("message", (message) => {
      resolveResult(message as SubjectGraphRevisionTransactionResult);
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`revision worker exited with code ${code}`));
    });
  });
}

describe("disposable SQLite SubjectGraphRevisionIntent transaction", () => {
  test("bootstraps, canonically reads back, advances by revision plus digest, and persists across restart", (t) => {
    const fixture = tempDatabase(t, "bootstrap-successor");
    const first = makePipelineRevisionIntent({ variant: "first" });
    const transaction = adapter(fixture);
    const committed = transaction.consume(first.intent, permit());

    assert.equal(committed.outcome, "committed");
    if (committed.outcome !== "committed") return;
    assert.equal(committed.state.revision, "rev_1");
    assert.equal(
      committed.state.snapshot_sha256,
      first.intent.proposed_snapshot_sha256,
    );
    assert.deepEqual(committed.state.snapshot, first.intent.proposed_snapshot);
    assert.notEqual(committed.state.snapshot, first.intent.proposed_snapshot);
    assert.equal(
      committed.receipt.operational_committed_at,
      committed.state.operational_committed_at,
    );
    assert.notEqual(
      committed.receipt.operational_committed_at,
      first.intent.review_handoff.reviewed_at,
    );
    assert.match(
      committed.receipt.operational_committed_at,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
    assertRecursivelyFrozen(committed);

    const restartedRead = adapter(fixture).readCurrent(
      first.intent.graph_identity,
      permit(),
    );
    assert.equal(restartedRead.outcome, "found");
    if (restartedRead.outcome !== "found") return;
    assert.deepEqual(restartedRead.state, committed.state);
    assert.deepEqual(restartedRead.receipt, committed.receipt);
    assert.notEqual(restartedRead.state.snapshot, first.intent.proposed_snapshot);
    assertRecursivelyFrozen(restartedRead);

    const absentRead = adapter(fixture).readCurrent(
      {
        ...first.intent.graph_identity,
        subject_id: "subject_missing",
      },
      permit(),
    );
    assert.deepEqual(absentRead, {
      outcome: "not_found",
      found: false,
      graph_identity: {
        ...first.intent.graph_identity,
        subject_id: "subject_missing",
      },
    });
    assertRecursivelyFrozen(absentRead);

    const second = makePipelineRevisionIntent({
      variant: "second",
      base: first.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    const restarted = adapter(fixture);
    const successor = restarted.consume(second.intent, permit());
    assert.equal(successor.outcome, "committed");
    if (successor.outcome !== "committed") return;
    assert.equal(successor.state.revision, "rev_2");
    assert.equal(
      successor.receipt.predecessor_basis.expected_base_snapshot_sha256,
      first.intent.proposed_snapshot_sha256,
    );
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 2,
      audit: 2,
    });

    const db = openRaw(fixture.path);
    try {
      const row = db
        .prepare("SELECT snapshot_json, revision_token FROM subject_graph_current_state")
        .get();
      assert.equal(row?.revision_token, "rev_2");
      assert.equal(
        row?.snapshot_json,
        canonicalJson(
          snapshotStrictJson(
            second.intent.proposed_snapshot,
            "test_candidate",
            {
              max_array_length: 1_000,
              max_depth: 18,
              max_expanded_json_value_occurrences: 210_000,
              max_nodes: 20_256,
              max_object_fields: 128,
              max_string_utf8_bytes: 2 * 1024 * 1024,
              max_total_string_utf8_bytes: 13 * 1024 * 1024,
            },
          ),
        ),
      );
    } finally {
      db.close();
    }
  });

  test("classifies missing, revision-only, snapshot-only, both-dimension, and bootstrap conflicts truthfully", (t) => {
    const missingFixture = tempDatabase(t, "missing");
    const unrelatedBase = makePipelineRevisionIntent({ variant: "base-missing" });
    const missingIntent = makePipelineRevisionIntent({
      variant: "missing-next",
      base: unrelatedBase.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    const missing = adapter(missingFixture).consume(missingIntent.intent, permit());
    assert.equal(missing.outcome, "conflicted");
    if (missing.outcome === "conflicted") {
      assert.equal(missing.conflict_kind, "missing_graph");
      assert.deepEqual(missing.actual, { revision: null, snapshot_sha256: null });
    }
    assert.deepEqual(tableCounts(missingFixture.path), {
      graph: 0,
      replay: 0,
      audit: 0,
    });

    const fixture = tempDatabase(t, "dimension-conflicts");
    const initial = makePipelineRevisionIntent({ variant: "dim-initial" });
    assert.equal(adapter(fixture).consume(initial.intent, permit()).outcome, "committed");

    const alternate = makePipelineRevisionIntent({ variant: "dim-alternate" });
    const wrongDigest = makePipelineRevisionIntent({
      variant: "wrong-digest",
      base: alternate.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    const snapshotConflict = adapter(fixture).consume(wrongDigest.intent, permit());
    assert.equal(snapshotConflict.outcome, "conflicted");
    if (snapshotConflict.outcome === "conflicted") {
      assert.equal(snapshotConflict.conflict_kind, "snapshot_mismatch");
      assert.equal(snapshotConflict.actual.revision, "rev_1");
      assert.equal(snapshotConflict.actual.snapshot_sha256, initial.intent.proposed_snapshot_sha256);
    }
    const repeatedSnapshotConflict = adapter(fixture).consume(
      wrongDigest.intent,
      permit(),
    );
    assert.equal(repeatedSnapshotConflict.outcome, "conflicted");
    if (
      snapshotConflict.outcome === "conflicted" &&
      repeatedSnapshotConflict.outcome === "conflicted"
    ) {
      assert.deepEqual(
        repeatedSnapshotConflict.receipt,
        snapshotConflict.receipt,
      );
    }

    const successor = makePipelineRevisionIntent({
      variant: "dim-successor",
      base: initial.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    assert.equal(adapter(fixture).consume(successor.intent, permit()).outcome, "committed");
    const staleRevision = makePipelineRevisionIntent({
      variant: "stale-revision",
      base: successor.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    const revisionConflict = adapter(fixture).consume(staleRevision.intent, permit());
    assert.equal(revisionConflict.outcome, "conflicted");
    if (revisionConflict.outcome === "conflicted") {
      assert.equal(revisionConflict.conflict_kind, "revision_mismatch");
      assert.equal(
        revisionConflict.actual.snapshot_sha256,
        staleRevision.intent.base_snapshot_sha256,
      );
    }

    const bothConflictIntent = makePipelineRevisionIntent({
      variant: "both-mismatch",
      base: initial.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    const both = adapter(fixture).consume(bothConflictIntent.intent, permit());
    assert.equal(both.outcome, "conflicted");
    if (both.outcome === "conflicted") {
      assert.equal(both.conflict_kind, "revision_and_snapshot_mismatch");
      assert.equal(both.receipt.persisted, false);
      assertRecursivelyFrozen(both);
    }

    const bootstrapAgain = makePipelineRevisionIntent({ variant: "bootstrap-again" });
    const bootstrapConflict = adapter(fixture).consume(bootstrapAgain.intent, permit());
    assert.equal(bootstrapConflict.outcome, "conflicted");
    if (bootstrapConflict.outcome === "conflicted") {
      assert.equal(
        bootstrapConflict.conflict_kind,
        "revision_and_snapshot_mismatch",
      );
    }
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 2,
      audit: 2,
    });
  });

  test("lost-response retry survives later graph advancement while replay collision applies nothing", (t) => {
    const fixture = tempDatabase(t, "replay");
    const initial = makePipelineRevisionIntent({ variant: "replay-initial" });
    const transaction = adapter(fixture);
    assert.throws(
      () => {
        const lost = transaction.consume(initial.intent, permit());
        assert.equal(lost.outcome, "committed");
        throw new Error("SIMULATED_CALLER_RESPONSE_LOSS");
      },
      /SIMULATED_CALLER_RESPONSE_LOSS/,
    );
    const retry = adapter(fixture).consume(
      JSON.parse(JSON.stringify(initial.intent)),
      permit(),
    );
    assert.equal(retry.outcome, "already_committed");
    if (retry.outcome !== "already_committed") return;

    const db = openRaw(fixture.path);
    try {
      const persisted = db
        .prepare("SELECT receipt_json FROM subject_graph_success_receipts")
        .get();
      assert.equal(
        persisted?.receipt_json,
        canonicalJson(retry.receipt as unknown as StrictJsonValue),
      );
    } finally {
      db.close();
    }

    const successor = makePipelineRevisionIntent({
      variant: "replay-successor",
      base: initial.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    assert.equal(
      adapter(fixture).consume(successor.intent, permit()).outcome,
      "committed",
    );

    const lateRetry = adapter(fixture).consume(
      JSON.parse(JSON.stringify(initial.intent)),
      permit(),
    );
    assert.equal(lateRetry.outcome, "already_committed");
    if (lateRetry.outcome !== "already_committed") return;
    assert.deepEqual(lateRetry.receipt, retry.receipt);

    const collisionSource = makePipelineRevisionIntent({
      variant: "replay-collision",
      base: successor.intent.proposed_snapshot,
      expected_prior_revision: "rev_2",
    });
    const collision = replayCollisionIntent(
      collisionSource.intent,
      initial.intent.replay_key_to_record,
    );
    const refused = adapter(fixture).consume(collision, permit());
    assert.equal(refused.outcome, "refused");
    if (refused.outcome === "refused") {
      assert.equal(refused.reason, "replay_key_collision");
      assert.equal(refused.receipt.persisted, false);
    }
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 2,
      audit: 2,
    });
  });

  test("ordinary historical retry preserves commit truth when the later current head is unhealthy", (t) => {
    for (const [mode, variant] of [
      ["snapshot_corrupt", "retry-snap"],
      ["replay_missing", "retry-link"],
      ["current_missing", "retry-none"],
    ] as const) {
      const fixture = tempDatabase(t, `retry-current-${variant}`);
      const first = makePipelineRevisionIntent({ variant });
      const successor = makePipelineRevisionIntent({
        variant: `${variant}-next`,
        base: first.intent.proposed_snapshot,
        expected_prior_revision: "rev_1",
      });
      assert.equal(adapter(fixture).consume(first.intent, permit()).outcome, "committed");
      assert.equal(
        adapter(fixture).consume(successor.intent, permit()).outcome,
        "committed",
      );

      const db = openRaw(fixture.path, false);
      try {
        if (mode === "snapshot_corrupt") {
          db.prepare(
            "UPDATE subject_graph_current_state SET snapshot_json = ?",
          ).run("{}");
        } else if (mode === "replay_missing") {
          db.prepare(
            "DELETE FROM subject_graph_replay_consumptions WHERE replay_key = ?",
          ).run(successor.intent.replay_key_to_record);
        } else {
          db.prepare("DELETE FROM subject_graph_current_state").run();
        }
      } finally {
        db.close();
      }

      const retry = adapter(fixture).consume(first.intent, permit());
      assert.equal(retry.outcome, "committed_readback_failed");
      if (retry.outcome === "committed_readback_failed") {
        assert.equal(retry.committed, true);
        assert.equal(
          retry.recovery.intent_sha256,
          first.intent.intent_sha256,
        );
      }

      const current = adapter(fixture).readCurrent(
        first.intent.graph_identity,
        permit(),
      );
      if (mode === "current_missing") {
        assert.equal(current.outcome, "not_found");
      } else {
        assert.equal(current.outcome, "dependency_failed");
        if (current.outcome === "dependency_failed") {
          assert.equal(current.failure_code, "durable_state_invalid");
        }
      }
    }
  });

  test("missing or corrupt current replay blocks both exact retry and successor", (t) => {
    for (const [mode, variant] of [
      ["missing", "bad-miss"],
      ["identity_corrupt", "bad-ident"],
      ["intent_corrupt", "bad-intent"],
    ] as const) {
      const fixture = tempDatabase(t, `current-replay-${variant}`);
      const first = makePipelineRevisionIntent({ variant });
      assert.equal(adapter(fixture).consume(first.intent, permit()).outcome, "committed");

      const db = openRaw(fixture.path, false);
      try {
        if (mode === "missing") {
          db.prepare(
            "DELETE FROM subject_graph_replay_consumptions WHERE replay_key = ?",
          ).run(first.intent.replay_key_to_record);
        } else if (mode === "identity_corrupt") {
          db.prepare(
            "UPDATE subject_graph_replay_consumptions SET team_id = ? WHERE replay_key = ?",
          ).run("team_corrupted_link", first.intent.replay_key_to_record);
        } else {
          db.prepare(
            "UPDATE subject_graph_replay_consumptions SET intent_sha256 = ? WHERE replay_key = ?",
          ).run("0".repeat(64), first.intent.replay_key_to_record);
        }
      } finally {
        db.close();
      }
      const before = tableCounts(fixture.path);

      const retry = adapter(fixture).consume(first.intent, permit());
      assert.equal(retry.outcome, "dependency_failed");
      if (retry.outcome === "dependency_failed") {
        assert.equal(retry.committed, false);
        assert.equal(retry.failure_code, "durable_state_invalid");
      }

      const successor = makePipelineRevisionIntent({
        variant: `${variant}-next`,
        base: first.intent.proposed_snapshot,
        expected_prior_revision: "rev_1",
      });
      const advance = adapter(fixture).consume(successor.intent, permit());
      assert.equal(advance.outcome, "dependency_failed");
      if (advance.outcome === "dependency_failed") {
        assert.equal(advance.committed, false);
        assert.equal(advance.failure_code, "durable_state_invalid");
      }
      assert.deepEqual(tableCounts(fixture.path), before);

      const current = adapter(fixture).readCurrent(
        first.intent.graph_identity,
        permit(),
      );
      assert.equal(current.outcome, "dependency_failed");
    }
  });

  test("missing or corrupt historical replay after a healthy successor is durable corruption", (t) => {
    for (const [mode, variant] of [
      ["missing", "hist-miss"],
      ["intent_corrupt", "hist-intent"],
    ] as const) {
      const fixture = tempDatabase(t, variant);
      const first = makePipelineRevisionIntent({ variant: `${variant}-first` });
      const successor = makePipelineRevisionIntent({
        variant: `${variant}-next`,
        base: first.intent.proposed_snapshot,
        expected_prior_revision: "rev_1",
      });
      assert.equal(adapter(fixture).consume(first.intent, permit()).outcome, "committed");
      assert.equal(
        adapter(fixture).consume(successor.intent, permit()).outcome,
        "committed",
      );
      const db = openRaw(fixture.path, false);
      try {
        if (mode === "missing") {
          db.prepare(
            "DELETE FROM subject_graph_replay_consumptions WHERE replay_key = ?",
          ).run(first.intent.replay_key_to_record);
        } else {
          db.prepare(
            "UPDATE subject_graph_replay_consumptions SET intent_sha256 = ? WHERE replay_key = ?",
          ).run("0".repeat(64), first.intent.replay_key_to_record);
        }
      } finally {
        db.close();
      }
      const before = tableCounts(fixture.path);

      const retry = adapter(fixture).consume(first.intent, permit());
      assert.equal(retry.outcome, "dependency_failed");
      if (retry.outcome === "dependency_failed") {
        assert.equal(retry.committed, false);
        assert.equal(retry.failure_code, "durable_state_invalid");
      }
      assert.deepEqual(tableCounts(fixture.path), before);
      const current = adapter(fixture).readCurrent(
        first.intent.graph_identity,
        permit(),
      );
      assert.equal(current.outcome, "found");
      if (current.outcome === "found") {
        assert.equal(current.state.revision, "rev_2");
      }
    }
  });

  test("pre-transaction and mid-transaction injected failures leave graph, replay, and audit empty", (t) => {
    for (const [label, faultPoint, expectedState] of [
      ["before", "before_transaction", "not_started"],
      ["during", "after_graph_write", "rolled_back"],
      ["before-commit", "after_replay_write", "rolled_back"],
    ] as const) {
      const fixture = tempDatabase(t, `fault-${label}`);
      const values = makePipelineRevisionIntent({ variant: `fault-${label}` });
      const secret = `INJECTED_SECRET_${label}`;
      const result = adapter(fixture, (point) => {
        if (point === faultPoint) throw new Error(secret);
      }).consume(values.intent, permit());
      assert.equal(result.outcome, "dependency_failed");
      if (result.outcome === "dependency_failed") {
        assert.equal(result.transaction_state, expectedState);
      }
      assert.deepEqual(tableCounts(fixture.path), {
        graph: 0,
        replay: 0,
        audit: 0,
      });
      const serialized = JSON.stringify(result);
      assert.doesNotMatch(serialized, new RegExp(secret));
      assert.doesNotMatch(serialized, /INSERT|SELECT|subject_graph_current_state/);
      assert.equal(serialized.includes(fixture.path), false);
    }
  });

  test("actual overlapping independent SQLite connections allow exactly one same-predecessor competitor", async (t) => {
    const fixture = tempDatabase(t, "worker-contention");
    const initial = makePipelineRevisionIntent({ variant: "worker-initial" });
    assert.equal(adapter(fixture).consume(initial.intent, permit()).outcome, "committed");
    const competitorA = makePipelineRevisionIntent({
      variant: "worker-a",
      base: initial.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    const competitorB = makePipelineRevisionIntent({
      variant: "worker-b",
      base: initial.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    const barrier = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
    const view = new Int32Array(barrier);
    const holderPromise = runWorker({
      database_path: fixture.path,
      isolated_temporary_directory: fixture.directory,
      intent: competitorA.intent,
      permit: permit(),
      barrier,
      role: "holder",
    });
    assert.equal(Atomics.wait(view, 0, 0, 5_000), "ok");
    assert.equal(Atomics.load(view, 0), 1);
    const contenderPromise = runWorker({
      database_path: fixture.path,
      isolated_temporary_directory: fixture.directory,
      intent: competitorB.intent,
      permit: permit(),
      barrier,
      role: "contender",
    });
    const results = await Promise.all([holderPromise, contenderPromise]);
    assert.equal(Atomics.load(view, 1), 1);
    assert.deepEqual(
      results.map((result) => result.outcome).sort(),
      ["committed", "conflicted"],
    );
    const conflict = results.find((result) => result.outcome === "conflicted");
    assert.equal(conflict?.outcome, "conflicted");
    if (conflict?.outcome === "conflicted") {
      assert.equal(conflict.conflict_kind, "revision_and_snapshot_mismatch");
    }
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 2,
      audit: 2,
    });
  });

  test("overlapping bootstrap contenders create exactly one initial graph, replay, and audit row", async (t) => {
    const fixture = tempDatabase(t, "worker-bootstrap");
    const bootstrapA = makePipelineRevisionIntent({ variant: "bootstrap-worker-a" });
    const bootstrapB = makePipelineRevisionIntent({ variant: "bootstrap-worker-b" });
    const barrier = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
    const view = new Int32Array(barrier);
    const holderPromise = runWorker({
      database_path: fixture.path,
      isolated_temporary_directory: fixture.directory,
      intent: bootstrapA.intent,
      permit: permit(),
      barrier,
      role: "holder",
    });
    assert.equal(Atomics.wait(view, 0, 0, 5_000), "ok");
    const contenderPromise = runWorker({
      database_path: fixture.path,
      isolated_temporary_directory: fixture.directory,
      intent: bootstrapB.intent,
      permit: permit(),
      barrier,
      role: "contender",
    });
    const results = await Promise.all([holderPromise, contenderPromise]);
    assert.equal(Atomics.load(view, 1), 1);
    assert.deepEqual(
      results.map((result) => result.outcome).sort(),
      ["committed", "conflicted"],
    );
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 1,
      audit: 1,
    });
  });

  test("overlapping independent connections both commit different structured graph identities", async (t) => {
    const fixture = tempDatabase(t, "worker-independent");
    const identityA = makePipelineRevisionIntent({
      variant: "independent-a",
      team_id: "team_independent_a",
      account_id: "acc_independent_a",
      subject_id: "subject:independent:a",
    });
    const identityB = makePipelineRevisionIntent({
      variant: "independent-b",
      team_id: "team_independent_b",
      account_id: "acc_independent_b",
      subject_id: "subject:independent:b",
    });
    const barrier = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
    const view = new Int32Array(barrier);
    const holderPromise = runWorker({
      database_path: fixture.path,
      isolated_temporary_directory: fixture.directory,
      intent: identityA.intent,
      permit: permit(),
      barrier,
      role: "holder",
    });
    assert.equal(Atomics.wait(view, 0, 0, 5_000), "ok");
    const contenderPromise = runWorker({
      database_path: fixture.path,
      isolated_temporary_directory: fixture.directory,
      intent: identityB.intent,
      permit: permit(),
      barrier,
      role: "contender",
    });
    const results = await Promise.all([holderPromise, contenderPromise]);
    assert.deepEqual(results.map((result) => result.outcome), ["committed", "committed"]);
    assert.equal(Atomics.load(view, 1), 1);
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 2,
      replay: 2,
      audit: 2,
    });
    const db = openRaw(fixture.path);
    try {
      const identities = db
        .prepare(`
          SELECT team_id, account_id, subject_id, purpose
          FROM subject_graph_current_state ORDER BY team_id
        `)
        .all();
      assert.deepEqual(
        identities.map((row) => Object.values(row)),
        [
          ["team_independent_a", "acc_independent_a", "subject:independent:a", "candidate_validation"],
          ["team_independent_b", "acc_independent_b", "subject:independent:b", "candidate_validation"],
        ],
      );
    } finally {
      db.close();
    }
  });

  test("stored corruption fails closed with sanitized dependency results", (t) => {
    const fixture = tempDatabase(t, "corruption");
    const values = makePipelineRevisionIntent({ variant: "corrupt" });
    assert.equal(adapter(fixture).consume(values.intent, permit()).outcome, "committed");
    const db = openRaw(fixture.path, false);
    try {
      db.prepare("UPDATE subject_graph_current_state SET snapshot_json = ?").run("{}");
    } finally {
      db.close();
    }
    const result = adapter(fixture).consume(values.intent, permit());
    assert.equal(result.outcome, "committed_readback_failed");
    if (result.outcome === "committed_readback_failed") {
      assert.equal(result.committed, true);
      assert.equal(
        result.recovery.intent_sha256,
        values.intent.intent_sha256,
      );
    }
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(fixture.path), false);
    assert.doesNotMatch(serialized, /snapshot_json|UPDATE|\{\}/);
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 1,
      audit: 1,
    });

    const replayFixture = tempDatabase(t, "corrupt-replay-identity");
    const replayValues = makePipelineRevisionIntent({ variant: "corrupt-replay" });
    assert.equal(
      adapter(replayFixture).consume(replayValues.intent, permit()).outcome,
      "committed",
    );
    const replayDb = openRaw(replayFixture.path, false);
    try {
      replayDb
        .prepare("UPDATE subject_graph_replay_consumptions SET team_id = ?")
        .run("team_corrupted_link");
    } finally {
      replayDb.close();
    }
    const corruptRetry = adapter(replayFixture).consume(
      replayValues.intent,
      permit(),
    );
    assert.equal(corruptRetry.outcome, "dependency_failed");
    if (corruptRetry.outcome === "dependency_failed") {
      assert.equal(corruptRetry.failure_code, "durable_state_invalid");
    }
    const corruptRead = adapter(replayFixture).readCurrent(
      replayValues.intent.graph_identity,
      permit(),
    );
    assert.equal(corruptRead.outcome, "dependency_failed");
    if (corruptRead.outcome === "dependency_failed") {
      assert.equal(corruptRead.failure_code, "durable_state_invalid");
    }
  });

  test("uses actual canonical UTF-8 JSON byte limits, including escaping overhead and DB checks", (t) => {
    const fixture = tempDatabase(t, "bytes");
    const escapingSuffix = '\\"'.repeat(70_000);
    assert.ok(
      Buffer.byteLength(escapingSuffix, "utf8") <
        SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES,
    );
    const oversized = makePipelineRevisionIntent({
      variant: "escaped-bytes",
      raw_text_suffix: escapingSuffix,
    });
    const canonicalSnapshot = canonicalJson(
      oversized.intent.proposed_snapshot as unknown as StrictJsonValue,
    );
    assert.ok(
      Buffer.byteLength(canonicalSnapshot, "utf8") >
        SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES,
    );
    const refused = adapter(fixture).consume(oversized.intent, permit());
    assert.equal(refused.outcome, "refused");
    if (refused.outcome === "refused") {
      assert.equal(refused.reason, "snapshot_storage_limit_exceeded");
    }
    assert.equal(existsSync(fixture.path), false);

    const normal = makePipelineRevisionIntent({ variant: "byte-normal" });
    assert.equal(adapter(fixture).consume(normal.intent, permit()).outcome, "committed");
    const db = openRaw(fixture.path, false);
    try {
      assert.throws(() =>
        db
          .prepare("UPDATE subject_graph_current_state SET snapshot_json = ?")
          .run("x".repeat(SUBJECT_GRAPH_REVISION_MAX_CANONICAL_SNAPSHOT_JSON_UTF8_BYTES + 1)),
      );
      assert.throws(() =>
        db
          .prepare("UPDATE subject_graph_success_receipts SET receipt_json = ?")
          .run("x".repeat(SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES + 1)),
      );
      const digestA = "a".repeat(64);
      const digestB = "b".repeat(64);
      const digestC = "c".repeat(64);
      const digestD = "d".repeat(64);
      const digestE = "e".repeat(64);
      assert.throws(() =>
        db.prepare(`
          INSERT INTO subject_graph_success_receipts (
            receipt_sha256, receipt_core_json, receipt_json,
            team_id, account_id, subject_id, purpose,
            predecessor_revision_token, predecessor_snapshot_sha256,
            committed_revision_number, committed_revision_token,
            proposed_snapshot_sha256, intent_sha256, review_handoff_sha256,
            replay_key, operational_committed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          digestA,
          "{}",
          "x".repeat(SUBJECT_GRAPH_REVISION_MAX_CANONICAL_RECEIPT_JSON_UTF8_BYTES + 1),
          "team_byte_check",
          "acc_byte_check",
          "subject:byte-check",
          "candidate_validation",
          null,
          digestB,
          1,
          "rev_1",
          digestC,
          digestD,
          digestE,
          "f".repeat(64),
          "2000-01-01T00:00:00.000Z",
        ),
      );
    } finally {
      db.close();
    }
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 1,
      audit: 1,
    });
  });

  test("reads back the expected SQLite catalog and integrity invariants", (t) => {
    const fixture = tempDatabase(t, "catalog-integrity");
    const values = makePipelineRevisionIntent({ variant: "catalog-integrity" });
    assert.equal(adapter(fixture).consume(values.intent, permit()).outcome, "committed");

    const db = openRaw(fixture.path);
    try {
      assert.equal(db.prepare("PRAGMA journal_mode").get()?.journal_mode, "wal");
      assert.deepEqual(
        db
          .prepare("PRAGMA integrity_check")
          .all()
          .map((row) => row.integrity_check),
        ["ok"],
      );
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

      const tables = db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name LIKE 'subject_graph_%' ORDER BY name",
        )
        .all() as unknown as ReadonlyArray<{
          readonly name: string;
          readonly sql: string;
        }>;
      assert.deepEqual(
        tables.map((row) => row.name),
        [
          "subject_graph_current_state",
          "subject_graph_replay_consumptions",
          "subject_graph_success_receipts",
        ],
      );
      const currentSql = tables.find(
        (row) => row.name === "subject_graph_current_state",
      )?.sql;
      const replaySql = tables.find(
        (row) => row.name === "subject_graph_replay_consumptions",
      )?.sql;
      assert.match(
        currentSql ?? "",
        /PRIMARY KEY\(team_id, account_id, subject_id, purpose\)/,
      );
      assert.match(replaySql ?? "", /intent_sha256 TEXT COLLATE BINARY NOT NULL UNIQUE/);
      assert.match(replaySql ?? "", /receipt_sha256 TEXT COLLATE BINARY NOT NULL UNIQUE/);

      const triggers = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
        )
        .all() as unknown as ReadonlyArray<{ readonly name: string }>;
      assert.deepEqual(
        triggers.map((row) => row.name),
        [
          "subject_graph_success_receipts_immutable_delete",
          "subject_graph_success_receipts_immutable_update",
        ],
      );
    } finally {
      db.close();
    }
  });

  test("rejects malformed or trigger-altered existing catalogs before reads or writes", (t) => {
    const loose = tempDatabase(t, "catalog-loose");
    const looseIntent = makePipelineRevisionIntent({ variant: "catalog-loose" });
    const looseDb = openRaw(loose.path, false);
    try {
      looseDb.exec(`
        CREATE TABLE subject_graph_current_state (junk TEXT);
        CREATE TABLE subject_graph_replay_consumptions (junk TEXT);
        CREATE TABLE subject_graph_success_receipts (junk TEXT);
        INSERT INTO subject_graph_current_state VALUES ('one'), ('two');
        INSERT INTO subject_graph_replay_consumptions VALUES ('one'), ('two');
        INSERT INTO subject_graph_success_receipts VALUES ('one'), ('two');
      `);
    } finally {
      looseDb.close();
    }
    const looseBefore = tableCounts(loose.path);
    const looseRead = adapter(loose).readCurrent(
      looseIntent.intent.graph_identity,
      permit(),
    );
    assert.equal(looseRead.outcome, "dependency_failed");
    if (looseRead.outcome === "dependency_failed") {
      assert.equal(looseRead.failure_code, "durable_state_invalid");
    }
    const looseWrite = adapter(loose).consume(looseIntent.intent, permit());
    assert.equal(looseWrite.outcome, "dependency_failed");
    if (looseWrite.outcome === "dependency_failed") {
      assert.equal(looseWrite.failure_code, "durable_state_invalid");
      assert.equal(looseWrite.transaction_state, "not_started");
    }
    assert.deepEqual(tableCounts(loose.path), looseBefore);

    for (const [mode, variant] of [
      ["expected_noop", "catalog-noop"],
      ["unexpected_mutating", "catalog-extra"],
    ] as const) {
      const fixture = tempDatabase(t, variant);
      const first = makePipelineRevisionIntent({ variant: `${variant}-first` });
      assert.equal(adapter(fixture).consume(first.intent, permit()).outcome, "committed");
      const db = openRaw(fixture.path, false);
      try {
        if (mode === "expected_noop") {
          db.exec(`
            DROP TRIGGER subject_graph_success_receipts_immutable_update;
            CREATE TRIGGER subject_graph_success_receipts_immutable_update
            BEFORE UPDATE ON subject_graph_success_receipts
            BEGIN SELECT 1; END;
          `);
        } else {
          db.exec(`
            CREATE TRIGGER unexpected_subject_graph_mutation
            AFTER INSERT ON subject_graph_replay_consumptions
            BEGIN DELETE FROM subject_graph_current_state; END;
          `);
        }
      } finally {
        db.close();
      }
      const before = tableCounts(fixture.path);
      const read = adapter(fixture).readCurrent(
        first.intent.graph_identity,
        permit(),
      );
      assert.equal(read.outcome, "dependency_failed");
      if (read.outcome === "dependency_failed") {
        assert.equal(read.failure_code, "durable_state_invalid");
      }
      const successor = makePipelineRevisionIntent({
        variant: `${variant}-next`,
        base: first.intent.proposed_snapshot,
        expected_prior_revision: "rev_1",
      });
      const write = adapter(fixture).consume(successor.intent, permit());
      assert.equal(write.outcome, "dependency_failed");
      if (write.outcome === "dependency_failed") {
        assert.equal(write.failure_code, "durable_state_invalid");
        assert.equal(write.transaction_state, "not_started");
      }
      assert.deepEqual(tableCounts(fixture.path), before);
    }
  });

  test("lost acknowledgement recovers its historical receipt after a successor wins the read-back race", (t) => {
    const fixture = tempDatabase(t, "ack-successor-race");
    const first = makePipelineRevisionIntent({ variant: "ack-race-first" });
    const successor = makePipelineRevisionIntent({
      variant: "ack-race-successor",
      base: first.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    let successorOutcome: string | undefined;
    let successorRevision: string | undefined;

    const recovered = adapter(fixture, (point) => {
      if (point !== "after_commit_before_acknowledgement") return;
      const result = adapter(fixture).consume(successor.intent, permit());
      successorOutcome = result.outcome;
      if (result.outcome === "committed") successorRevision = result.state.revision;
      throw new Error("lost revision-one acknowledgement");
    }).consume(first.intent, permit());

    assert.equal(successorOutcome, "committed");
    assert.equal(successorRevision, "rev_2");
    assert.equal(recovered.outcome, "committed");
    if (recovered.outcome !== "committed") return;
    assert.equal(
      recovered.commit_acknowledgement,
      "recovered_after_commit_boundary_failure",
    );
    assert.equal(recovered.receipt.committed_revision, "rev_1");
    assert.equal(recovered.state.revision, "rev_1");
    assert.equal(
      recovered.state.snapshot_sha256,
      first.intent.proposed_snapshot_sha256,
    );

    const current = adapter(fixture).readCurrent(
      first.intent.graph_identity,
      permit(),
    );
    assert.equal(current.outcome, "found");
    if (current.outcome === "found") assert.equal(current.state.revision, "rev_2");
  });

  test("historical commit proof remains committed-aware when the later current head is invalid", (t) => {
    const fixture = tempDatabase(t, "ack-invalid-successor");
    const first = makePipelineRevisionIntent({ variant: "invalid-head-first" });
    const successor = makePipelineRevisionIntent({
      variant: "invalid-head-successor",
      base: first.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
    });
    let successorOutcome: string | undefined;

    const recovered = adapter(fixture, (point) => {
      if (point !== "after_commit_before_acknowledgement") return;
      const result = adapter(fixture).consume(successor.intent, permit());
      successorOutcome = result.outcome;
      const db = openRaw(fixture.path, false);
      try {
        db.prepare(
          "DELETE FROM subject_graph_replay_consumptions WHERE replay_key = ?",
        ).run(successor.intent.replay_key_to_record);
      } finally {
        db.close();
      }
      throw new Error("lost acknowledgement after current-head corruption");
    }).consume(first.intent, permit());

    assert.equal(successorOutcome, "committed");
    assert.equal(recovered.outcome, "committed_readback_failed");
    if (recovered.outcome === "committed_readback_failed") {
      assert.equal(recovered.committed, true);
      assert.equal(
        recovered.recovery.intent_sha256,
        first.intent.intent_sha256,
      );
    }
    const current = adapter(fixture).readCurrent(
      first.intent.graph_identity,
      permit(),
    );
    assert.equal(current.outcome, "dependency_failed");
    if (current.outcome === "dependency_failed") {
      assert.equal(current.failure_code, "durable_state_invalid");
    }
  });

  test("post-commit catalog drift cannot receive a direct acknowledgement", (t) => {
    const fixture = tempDatabase(t, "post-commit-catalog-drift");
    const values = makePipelineRevisionIntent({ variant: "post-catalog" });
    const result = adapter(fixture, (point) => {
      if (point !== "after_commit_before_readback") return;
      const db = openRaw(fixture.path, false);
      try {
        db.exec(
          "CREATE TABLE unexpected_postcommit_object (id INTEGER) STRICT",
        );
      } finally {
        db.close();
      }
    }).consume(values.intent, permit());

    assert.equal(result.outcome, "committed_readback_failed");
    if (result.outcome === "committed_readback_failed") {
      assert.equal(result.committed, true);
      assert.equal(result.failure_code, "post_commit_verification_failed");
    }
    assert.deepEqual(tableCounts(fixture.path), {
      graph: 1,
      replay: 1,
      audit: 1,
    });
    const current = adapter(fixture).readCurrent(
      values.intent.graph_identity,
      permit(),
    );
    assert.equal(current.outcome, "dependency_failed");
    if (current.outcome === "dependency_failed") {
      assert.equal(current.failure_code, "durable_state_invalid");
    }
  });

  test("known post-commit failure, recovered acknowledgement, and indeterminate commit remain distinct", (t) => {
    const readbackFixture = tempDatabase(t, "post-commit-readback");
    const readbackIntent = makePipelineRevisionIntent({ variant: "readback-fault" });
    const readbackFailure = adapter(readbackFixture, (point) => {
      if (point === "after_commit_before_readback") throw new Error("SECRET_READBACK");
    }).consume(readbackIntent.intent, permit());
    assert.equal(readbackFailure.outcome, "committed_readback_failed");
    if (readbackFailure.outcome === "committed_readback_failed") {
      assert.equal(readbackFailure.committed, true);
      assert.equal(readbackFailure.recovery.intent_sha256, readbackIntent.intent.intent_sha256);
    }
    assert.deepEqual(tableCounts(readbackFixture.path), {
      graph: 1,
      replay: 1,
      audit: 1,
    });
    const retry = adapter(readbackFixture).consume(readbackIntent.intent, permit());
    assert.equal(retry.outcome, "already_committed");

    const recoveredFixture = tempDatabase(t, "commit-recovered");
    const recoveredIntent = makePipelineRevisionIntent({ variant: "ack-recovered" });
    const recovered = adapter(recoveredFixture, (point) => {
      if (point === "after_commit_before_acknowledgement") {
        throw new Error("SECRET_COMMIT_ACK");
      }
    }).consume(recoveredIntent.intent, permit());
    assert.equal(recovered.outcome, "committed");
    if (recovered.outcome === "committed") {
      assert.equal(
        recovered.commit_acknowledgement,
        "recovered_after_commit_boundary_failure",
      );
    }

    const indeterminateFixture = tempDatabase(t, "commit-indeterminate");
    const indeterminateIntent = makePipelineRevisionIntent({ variant: "indeterminate" });
    const indeterminate = adapter(indeterminateFixture, (point) => {
      if (
        point === "after_commit_before_acknowledgement" ||
        point === "before_commit_recovery_probe"
      ) {
        throw new Error("SECRET_UNRESOLVED_COMMIT");
      }
    }).consume(indeterminateIntent.intent, permit());
    assert.equal(indeterminate.outcome, "indeterminate");
    if (indeterminate.outcome === "indeterminate") {
      assert.equal(indeterminate.committed, "indeterminate");
    }
    assert.deepEqual(tableCounts(indeterminateFixture.path), {
      graph: 1,
      replay: 1,
      audit: 1,
    });
    assert.doesNotMatch(JSON.stringify(indeterminate), /SECRET|sqlite|INSERT/i);
  });

  test("hostile intent, exact permit, and temporary-path refusals all precede database effect", (t) => {
    const values = makePipelineRevisionIntent({ variant: "hostile" });
    const hostileInputs: unknown[] = [];
    let getterExecuted = false;
    const getterIntent = clone(values.intent) as unknown as Record<string, unknown>;
    Object.defineProperty(getterIntent, "kind", {
      enumerable: true,
      get() {
        getterExecuted = true;
        return values.intent.kind;
      },
    });
    hostileInputs.push(
      getterIntent,
      new Proxy(clone(values.intent), {}),
      Object.assign(clone(values.intent), { [Symbol("hidden")]: true }),
    );
    const sparse = clone(values.intent) as Record<string, any>;
    sparse.proposed_snapshot.graph_bundle.sources = new Array(1);
    hostileInputs.push(sparse);
    const cyclic = clone(values.intent) as Record<string, any>;
    cyclic.loop = cyclic;
    hostileInputs.push(cyclic);

    const forgedPolicy = clone(values.intent) as Record<string, any>;
    forgedPolicy.quality_gate_policy.policy_sha256 = "f".repeat(64);
    forgedPolicy.review_handoff.quality_gate_policy.policy_sha256 = "f".repeat(64);
    forgedPolicy.review_handoff_sha256 = sha256CanonicalJson(
      forgedPolicy.review_handoff as StrictJsonValue,
    );
    hostileInputs.push(rehashIntent(forgedPolicy));

    for (const [index, hostile] of hostileInputs.entries()) {
      const fixture = tempDatabase(t, `hostile-${index}`);
      const result = adapter(fixture).consume(hostile, permit());
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") assert.equal(result.reason, "malformed_intent");
      assert.equal(existsSync(fixture.path), false);
    }
    assert.equal(getterExecuted, false);

    const optionFixture = tempDatabase(t, "option-snapshot");
    const escapedPath = join(
      tmpdir(),
      `${basename(optionFixture.directory)}-escaped.sqlite`,
    );
    t.after(() => rmSync(escapedPath, { force: true }));
    const mutableOptions = {
      database_path: optionFixture.path,
      isolated_temporary_directory: optionFixture.directory,
    };
    const snapshottedAdapter =
      new DisposableSqliteSubjectGraphRevisionTransaction(mutableOptions);
    mutableOptions.database_path = escapedPath;
    const snapshottedResult = snapshottedAdapter.consume(values.intent, permit());
    assert.equal(snapshottedResult.outcome, "committed");
    assert.equal(existsSync(optionFixture.path), true);
    assert.equal(existsSync(escapedPath), false);

    let optionGetterReads = 0;
    const accessorOptions = {
      get database_path() {
        optionGetterReads += 1;
        return optionFixture.path;
      },
      isolated_temporary_directory: optionFixture.directory,
    };
    assert.throws(
      () =>
        new DisposableSqliteSubjectGraphRevisionTransaction(
          accessorOptions as any,
        ),
      /Invalid disposable SQLite transaction options/,
    );
    assert.equal(optionGetterReads, 0);
    assert.throws(
      () =>
        new DisposableSqliteSubjectGraphRevisionTransaction(
          new Proxy(mutableOptions, {}),
        ),
      /Invalid disposable SQLite transaction options/,
    );
    assert.throws(
      () =>
        new DisposableSqliteSubjectGraphRevisionTransaction({
          ...mutableOptions,
          unknown_option: true,
        } as any),
      /Invalid disposable SQLite transaction options/,
    );
    assert.throws(
      () =>
        new DisposableSqliteSubjectGraphRevisionTransaction(
          Object.assign({ ...mutableOptions }, { [Symbol("hidden")]: true }),
        ),
      /Invalid disposable SQLite transaction options/,
    );

    const permitFixture = tempDatabase(t, "bad-permit");
    const invalidPermit = {
      ...permit(),
      production_authority: true,
    };
    const permitRefusal = adapter(permitFixture).consume(values.intent, invalidPermit);
    assert.equal(permitRefusal.outcome, "refused");
    if (permitRefusal.outcome === "refused") {
      assert.equal(permitRefusal.reason, "invalid_lab_permit");
    }
    assert.equal(existsSync(permitFixture.path), false);

    const pathFixture = tempDatabase(t, "bad-path");
    const outsidePath = join(tmpdir(), `${relative(tmpdir(), pathFixture.directory)}-outside.sqlite`);
    const pathRefusal = new DisposableSqliteSubjectGraphRevisionTransaction({
      database_path: outsidePath,
      isolated_temporary_directory: pathFixture.directory,
    }).consume(values.intent, permit());
    assert.equal(pathRefusal.outcome, "refused");
    if (pathRefusal.outcome === "refused") {
      assert.equal(pathRefusal.reason, "unsafe_database_path");
    }
    assert.equal(existsSync(outsidePath), false);

    const symlinkFixture = tempDatabase(t, "symlink-path");
    symlinkSync(join(symlinkFixture.directory, "target.sqlite"), symlinkFixture.path);
    const symlinkRefusal = adapter(symlinkFixture).consume(values.intent, permit());
    assert.equal(symlinkRefusal.outcome, "refused");
    if (symlinkRefusal.outcome === "refused") {
      assert.equal(symlinkRefusal.reason, "unsafe_database_path");
    }
  });

  test("accepts MAX_SAFE_INTEGER-1 as the last predecessor and refuses an unrepresentable successor", (t) => {
    const fixture = tempDatabase(t, "max-revision");
    const base = makePipelineRevisionIntent({ variant: "max-base" });
    const lastRepresentable = makePipelineRevisionIntent({
      variant: "max-next",
      base: base.intent.proposed_snapshot,
      expected_prior_revision: `rev_${Number.MAX_SAFE_INTEGER - 1}`,
    });
    const conflict = adapter(fixture).consume(lastRepresentable.intent, permit());
    assert.equal(conflict.outcome, "conflicted");
    if (conflict.outcome === "conflicted") {
      assert.equal(
        conflict.expected.revision,
        `rev_${Number.MAX_SAFE_INTEGER - 1}`,
      );
    }

    const malformed = clone(lastRepresentable.intent) as Record<string, any>;
    malformed.predecessor_basis.expected_prior_revision = `rev_${Number.MAX_SAFE_INTEGER}`;
    malformed.review_handoff.predecessor_basis.expected_prior_revision =
      `rev_${Number.MAX_SAFE_INTEGER}`;
    malformed.review_handoff_sha256 = sha256CanonicalJson(
      malformed.review_handoff as StrictJsonValue,
    );
    const rehashed = rehashIntent(malformed);
    const refused = adapter(fixture).consume(rehashed, permit());
    assert.equal(refused.outcome, "refused");
    if (refused.outcome === "refused") assert.equal(refused.reason, "malformed_intent");
  });

  test("is absent from the public barrel, runtime composition, CLIs, scripts, and package scripts", () => {
    const portName = "subject-graph-revision-transaction";
    const adapterName = "disposable-sqlite-subject-graph-revision-transaction";
    const publicBarrel = readFileSync("src/index.ts", "utf8");
    const packageJson = readFileSync("package.json", "utf8");
    assert.equal(publicBarrel.includes(portName), false);
    assert.equal(publicBarrel.includes(adapterName), false);
    assert.equal(packageJson.includes(portName), false);
    assert.equal(packageJson.includes(adapterName), false);

    const sourceFiles = readdirSync("src", {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter(
        (path) =>
          !path.endsWith(`${portName}.ts`) &&
          !path.endsWith(`${adapterName}.ts`),
      );
    for (const path of sourceFiles) {
      const source = readFileSync(path, "utf8");
      assert.equal(source.includes(portName), false, path);
      assert.equal(source.includes(adapterName), false, path);
    }
  });
});
