import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test, type TestContext } from "node:test";

import {
  executeSyntheticTransactionWorkshopProof,
} from "../../src/workshop/synthetic-transaction-workshop-proof.ts";
import { makePipelineRevisionIntent } from "../graph/subject-graph-revision-transaction-fixture.ts";

interface TempDatabase {
  readonly directory: string;
  readonly path: string;
}

function tempDatabase(t: TestContext): TempDatabase {
  const directory = mkdtempSync(
    join(tmpdir(), "atliera-synthetic-transaction-workshop-"),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, path: join(directory, "state.sqlite") };
}

function options(fixture: TempDatabase) {
  return {
    database_path: fixture.path,
    isolated_temporary_directory: fixture.directory,
  };
}

function proofInput(
  artifact: ReturnType<typeof makePipelineRevisionIntent>,
  fixture: TempDatabase,
) {
  return {
    envelope: artifact.envelope,
    delta: artifact.delta,
    transition: artifact.transition,
    application_options: artifact.applicationOptions,
    intent: artifact.intent,
    database: options(fixture),
  };
}

function tableCounts(path: string) {
  const db = new DatabaseSync(path, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
    readOnly: true,
  });
  try {
    const count = (table: string): number => {
      const row = db.prepare(`SELECT count(*) AS count FROM ${table}`).get();
      assert.equal(typeof row?.count, "number");
      return row!.count as number;
    };
    return {
      current: count("subject_graph_current_state"),
      receipts: count("subject_graph_success_receipts"),
      replays: count("subject_graph_replay_consumptions"),
    };
  } finally {
    db.close();
  }
}

describe("synthetic transaction Workshop proof", () => {
  test("snapshots exact own input and database data without invoking hostile reads or allowing database identity switching", (t) => {
    const fixture = tempDatabase(t);
    const artifact = makePipelineRevisionIntent({
      variant: "workshop-input-snapshot",
    });
    const validInput = proofInput(artifact, fixture);
    const invalidMessage = "Invalid synthetic transaction Workshop proof input";

    let rootProxyTrapCalls = 0;
    const rootProxy = new Proxy(validInput, {
      get() {
        rootProxyTrapCalls += 1;
        throw new Error("root proxy get trap must not run");
      },
      getOwnPropertyDescriptor() {
        rootProxyTrapCalls += 1;
        throw new Error("root proxy descriptor trap must not run");
      },
      getPrototypeOf() {
        rootProxyTrapCalls += 1;
        throw new Error("root proxy prototype trap must not run");
      },
      ownKeys() {
        rootProxyTrapCalls += 1;
        throw new Error("root proxy ownKeys trap must not run");
      },
    });
    assert.throws(
      () => executeSyntheticTransactionWorkshopProof(rootProxy),
      (error: unknown) =>
        error instanceof TypeError && error.message === invalidMessage,
    );
    assert.equal(rootProxyTrapCalls, 0);

    let rootAccessorReads = 0;
    const rootAccessor = { ...validInput };
    Object.defineProperty(rootAccessor, "envelope", {
      enumerable: true,
      get() {
        rootAccessorReads += 1;
        throw new Error("root accessor must not run");
      },
    });
    assert.throws(
      () => executeSyntheticTransactionWorkshopProof(rootAccessor),
      (error: unknown) =>
        error instanceof TypeError && error.message === invalidMessage,
    );
    assert.equal(rootAccessorReads, 0);

    let databaseProxyTrapCalls = 0;
    const databaseProxy = new Proxy(options(fixture), {
      get() {
        databaseProxyTrapCalls += 1;
        throw new Error("database proxy get trap must not run");
      },
      getOwnPropertyDescriptor() {
        databaseProxyTrapCalls += 1;
        throw new Error("database proxy descriptor trap must not run");
      },
      getPrototypeOf() {
        databaseProxyTrapCalls += 1;
        throw new Error("database proxy prototype trap must not run");
      },
      ownKeys() {
        databaseProxyTrapCalls += 1;
        throw new Error("database proxy ownKeys trap must not run");
      },
    });
    assert.throws(
      () => executeSyntheticTransactionWorkshopProof({
        ...validInput,
        database: databaseProxy,
      }),
      (error: unknown) =>
        error instanceof TypeError && error.message === invalidMessage,
    );
    assert.equal(databaseProxyTrapCalls, 0);

    let databaseAccessorReads = 0;
    const databaseAccessor = {
      isolated_temporary_directory: fixture.directory,
    } as Record<string, unknown>;
    Object.defineProperty(databaseAccessor, "database_path", {
      enumerable: true,
      get() {
        databaseAccessorReads += 1;
        throw new Error("database accessor must not run");
      },
    });
    assert.throws(
      () => executeSyntheticTransactionWorkshopProof({
        ...validInput,
        database: databaseAccessor as ReturnType<typeof options>,
      }),
      (error: unknown) =>
        error instanceof TypeError && error.message === invalidMessage,
    );
    assert.equal(databaseAccessorReads, 0);

    const databaseA = tempDatabase(t);
    const databaseB = tempDatabase(t);
    const currentInB = makePipelineRevisionIntent({
      variant: "workshop-switch-current-b",
      object_title: "DATABASE_B_ONLY_CURRENT_MARKER",
    });
    const committedInB = executeSyntheticTransactionWorkshopProof(
      proofInput(currentInB, databaseB),
    );
    assert.equal(committedInB.transaction.outcome, "committed");
    const refusedInA = makePipelineRevisionIntent({
      variant: "workshop-switch-refused-a",
      object_title: "DATABASE_A_REFUSED_MARKER",
      raw_text_suffix: ` ${"z".repeat(300_000)}`,
    });
    const switchingInput = proofInput(refusedInA, databaseA);
    let databaseGetterReads = 0;
    Object.defineProperty(switchingInput, "database", {
      configurable: true,
      enumerable: true,
      get() {
        databaseGetterReads += 1;
        return databaseGetterReads === 1 ? options(databaseA) : options(databaseB);
      },
    });
    let crossDatabaseProof: ReturnType<
      typeof executeSyntheticTransactionWorkshopProof
    > | undefined;
    assert.throws(
      () => {
        crossDatabaseProof = executeSyntheticTransactionWorkshopProof(
          switchingInput,
        );
      },
      (error: unknown) =>
        error instanceof TypeError && error.message === invalidMessage,
    );
    assert.equal(databaseGetterReads, 0);
    assert.equal(crossDatabaseProof, undefined);
    assert.deepEqual(tableCounts(databaseB.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });
  });

  test("commits through the complete fixture chain, restarts, retries exactly once, and preserves current state after a stale conflict", (t) => {
    const fixture = tempDatabase(t);
    const accepted = makePipelineRevisionIntent({
      variant: "workshop-accepted",
      include_three_lanes: true,
      map_title: 'Known <img src=x onerror="known()"> & baseline',
    });

    const committed = executeSyntheticTransactionWorkshopProof(
      proofInput(accepted, fixture),
    );
    assert.equal(committed.transaction.outcome, "committed");
    assert.equal(committed.readback.outcome, "found");
    assert.ok(committed.workshop);
    assert.equal(committed.workshop.transaction_state, "committed");
    assert.equal(
      committed.workshop.current_state_source,
      "verified_fresh_disposable_sqlite_readback",
    );
    const viewModel = committed.workshop.view_model;
    const lensItems = [
      ...viewModel.lenses.signals,
      ...viewModel.lenses.maps,
      ...viewModel.lenses.plays,
    ];
    const evidenceItem = lensItems.find((item) => item.evidence_packets.length > 0);
    assert.ok(evidenceItem);
    const evidencePacket = evidenceItem.evidence_packets[0];
    assert.ok(evidencePacket);
    assert.equal(Object.isFrozen(committed), true);
    assert.equal(Object.isFrozen(committed.workshop), true);
    assert.equal(Object.isFrozen(viewModel), true);
    assert.equal(Object.isFrozen(viewModel.lenses), true);
    assert.equal(Object.isFrozen(viewModel.lenses.signals), true);
    assert.equal(Object.isFrozen(viewModel.lenses.maps), true);
    assert.equal(Object.isFrozen(viewModel.lenses.plays), true);
    assert.equal(Object.isFrozen(evidenceItem), true);
    assert.equal(Object.isFrozen(evidenceItem.evidence_packets), true);
    assert.equal(Object.isFrozen(evidencePacket), true);
    const htmlBeforeRejectedMutation = committed.workshop.html;
    const structuredBeforeRejectedMutation = JSON.stringify(viewModel);
    const titleBeforeRejectedMutation = evidenceItem.title;
    const evidenceBeforeRejectedMutation = evidencePacket.claim.text;
    assert.throws(() => {
      evidenceItem.title = "mutated title";
    }, TypeError);
    assert.throws(() => {
      evidencePacket.claim.text = "mutated evidence";
    }, TypeError);
    assert.equal(committed.workshop.html, htmlBeforeRejectedMutation);
    assert.equal(JSON.stringify(viewModel), structuredBeforeRejectedMutation);
    assert.equal(evidenceItem.title, titleBeforeRejectedMutation);
    assert.equal(evidencePacket.claim.text, evidenceBeforeRejectedMutation);
    if (
      committed.transaction.outcome !== "committed" ||
      committed.readback.outcome !== "found"
    ) return;
    assert.deepEqual(committed.readback.state, committed.transaction.state);
    assert.deepEqual(committed.readback.receipt, committed.transaction.receipt);
    assert.notEqual(
      committed.readback.state.snapshot,
      committed.transaction.state.snapshot,
    );
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });

    const html = committed.workshop!.html;
    assert.match(html, /Synthetic fixture · disposable lab SQLite · non-production/);
    assert.match(html, /Transaction state: committed/);
    assert.match(html, /<h2>Maps<\/h2><p>What was known/);
    assert.match(html, /What changed durably in this transaction\./);
    assert.match(html, /Why the change was accepted\./);
    assert.match(html, /<h2>Plays<\/h2><p><strong>One next safe action:/);
    assert.match(
      html,
      /Known &lt;img src=x onerror=&quot;known\(\)&quot;&gt; &amp; baseline/,
    );
    assert.doesNotMatch(html, /<img src=x onerror="known\(\)">/);
    assert.match(html, /<details class="technical-details">/);
    assert.doesNotMatch(html, /<details[^>]* open/);
    const mainBeforeDetails = html.slice(0, html.indexOf("<details"));
    assert.doesNotMatch(mainBeforeDetails, /[a-f0-9]{64}/);

    const retry = executeSyntheticTransactionWorkshopProof(
      proofInput(accepted, fixture),
    );
    assert.equal(retry.transaction.outcome, "already_committed");
    assert.ok(retry.workshop);
    assert.equal(retry.workshop.transaction_state, "already committed");
    const retryHtml = retry.workshop.html;
    assert.match(retryHtml, /No second write or application occurred/);
    assert.match(
      retryHtml,
      /This exact retry changed nothing\. The displayed signals belong to the original verified commit; no new write, application, or acceptance occurred\./,
    );
    assert.match(
      retryHtml,
      /The displayed evidence belongs to the original verified commit\./,
    );
    assert.match(
      retryHtml,
      /The original verified commit passed deterministic candidate validation\. This exact retry received no new acceptance\./,
    );
    assert.doesNotMatch(
      retryHtml,
      /What changed durably in this transaction\./,
    );
    assert.doesNotMatch(retryHtml, /Why the change was accepted\./);
    assert.doesNotMatch(retryHtml, /Accepted for this synthetic commit/);
    if (retry.transaction.outcome !== "already_committed") return;
    assert.equal(
      retry.transaction.receipt.receipt_sha256,
      committed.transaction.receipt.receipt_sha256,
    );
    assert.deepEqual(retry.transaction.receipt, committed.transaction.receipt);
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });
    const secondRetry = executeSyntheticTransactionWorkshopProof(
      proofInput(accepted, fixture),
    );
    assert.equal(secondRetry.workshop?.html, retry.workshop.html);

    const stale = makePipelineRevisionIntent({
      variant: "workshop-stale",
      object_title: '<script>STALE_ATTEMPT_ONLY("not durable")</script>',
      raw_text_suffix: " Stale competing fixture text.",
    });
    const conflict = executeSyntheticTransactionWorkshopProof(
      proofInput(stale, fixture),
    );
    assert.equal(conflict.transaction.outcome, "conflicted");
    assert.equal(conflict.readback.outcome, "found");
    assert.ok(conflict.workshop);
    assert.equal(conflict.workshop.transaction_state, "conflicted");
    assert.match(conflict.workshop.html, /stale synthetic attempt was not applied/i);
    assert.match(
      conflict.workshop.html,
      /This attempt changed nothing\. Current durable signals are shown below\./,
    );
    assert.match(
      conflict.workshop.html,
      /This attempt was not accepted\. Current durable evidence is shown below\./,
    );
    assert.match(conflict.workshop.html, /No durable signal changed in this attempt/);
    assert.doesNotMatch(
      conflict.workshop.html,
      /What changed durably in this transaction\./,
    );
    assert.doesNotMatch(conflict.workshop.html, /Why the change was accepted\./);
    assert.doesNotMatch(conflict.workshop.html, /STALE_ATTEMPT_ONLY/);
    assert.doesNotMatch(conflict.workshop.html, /workshop-stale/);
    if (conflict.readback.outcome !== "found") return;
    assert.deepEqual(conflict.readback.state, committed.readback.state);
    assert.deepEqual(conflict.readback.receipt, committed.readback.receipt);
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });
  });

  test("renders a valid historical exact retry only as unchanged beside its later verified current revision", (t) => {
    const fixture = tempDatabase(t);
    const revisionOne = makePipelineRevisionIntent({
      variant: "workshop-hist-rev1",
      object_title: "HISTORICAL_REVISION_ONE_MARKER",
    });
    const firstCommit = executeSyntheticTransactionWorkshopProof(
      proofInput(revisionOne, fixture),
    );
    assert.equal(firstCommit.transaction.outcome, "committed");

    const revisionTwo = makePipelineRevisionIntent({
      variant: "workshop-hist-rev2",
      base: revisionOne.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
      object_title: "SUCCESSOR_ONLY_CURRENT_MARKER",
    });
    const secondCommit = executeSyntheticTransactionWorkshopProof(
      proofInput(revisionTwo, fixture),
    );
    assert.equal(secondCommit.transaction.outcome, "committed");
    assert.equal(secondCommit.readback.outcome, "found");
    if (secondCommit.readback.outcome === "found") {
      assert.equal(secondCommit.readback.state.revision, "rev_2");
    }

    const historicalRetry = executeSyntheticTransactionWorkshopProof(
      proofInput(revisionOne, fixture),
    );
    assert.equal(historicalRetry.transaction.outcome, "already_committed");
    assert.equal(historicalRetry.readback.outcome, "found");
    if (historicalRetry.readback.outcome === "found") {
      assert.equal(historicalRetry.readback.state.revision, "rev_2");
    }
    assert.ok(historicalRetry.workshop);
    assert.equal(
      historicalRetry.workshop.transaction_state,
      "already committed",
    );
    const html = historicalRetry.workshop.html;
    assert.match(html, /This retry changed nothing, and a later verified revision is current\./);
    assert.match(
      html,
      /This exact retry changed nothing\. A later verified revision is current; only its durable signals are shown\./,
    );
    assert.match(html, /SUCCESSOR_ONLY_CURRENT_MARKER/);
    assert.match(html, /No current Signals or Evidence are attributed to this historical retry\./);
    assert.doesNotMatch(html, /What changed durably in this transaction\./);
    assert.doesNotMatch(html, /Why the change was accepted\./);
    assert.doesNotMatch(html, /Accepted for this synthetic commit/);
    assert.doesNotMatch(html, /displayed signals belong to the original verified commit/);
    assert.doesNotMatch(html, /original verified commit passed deterministic candidate validation/);
    assert.match(html, /Candidate policy<\/dt><dd>not applicable to this non-current attempt/);
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 2,
      replays: 2,
    });
  });

  test("fails closed when a historical retry finds a corrupt current durable snapshot", (t) => {
    const fixture = tempDatabase(t);
    const artifact = makePipelineRevisionIntent({
      variant: "workshop-corrupt-retry",
    });
    const committed = executeSyntheticTransactionWorkshopProof(
      proofInput(artifact, fixture),
    );
    assert.equal(committed.transaction.outcome, "committed");
    const countsBeforeCorruption = tableCounts(fixture.path);

    const database = new DatabaseSync(fixture.path, {
      allowExtension: false,
      enableForeignKeyConstraints: true,
    });
    try {
      database.exec(
        "UPDATE subject_graph_current_state SET snapshot_json = '{}'",
      );
    } finally {
      database.close();
    }

    const retry = executeSyntheticTransactionWorkshopProof(
      proofInput(artifact, fixture),
    );
    assert.equal(retry.transaction.outcome, "committed_readback_failed");
    assert.equal(retry.readback.outcome, "dependency_failed");
    if (retry.readback.outcome === "dependency_failed") {
      assert.equal(retry.readback.failure_code, "durable_state_invalid");
    }
    assert.equal(retry.workshop, null);
    assert.deepEqual(tableCounts(fixture.path), countsBeforeCorruption);
  });

  test("renders an exact adapter refusal only alongside independently verified current state and never promotes refused content", (t) => {
    const fixture = tempDatabase(t);
    const accepted = makePipelineRevisionIntent({
      variant: "workshop-refusal-current",
      include_three_lanes: true,
      map_title: 'Known <img src=x onerror="known()"> & baseline',
    });
    const committed = executeSyntheticTransactionWorkshopProof(
      proofInput(accepted, fixture),
    );
    assert.equal(committed.transaction.outcome, "committed");

    assert.equal(committed.readback.outcome, "found");
    const refusedArtifact = makePipelineRevisionIntent({
      variant: "refuse-big",
      base: accepted.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
      object_title: "REFUSED_ATTEMPT_ONLY",
      raw_text_suffix: ` ${"x".repeat(300_000)}`,
    });
    const refused = executeSyntheticTransactionWorkshopProof(
      proofInput(refusedArtifact, fixture),
    );
    assert.equal(refused.transaction.outcome, "refused");
    if (refused.transaction.outcome !== "refused") return;
    assert.equal(refused.transaction.reason, "snapshot_storage_limit_exceeded");
    assert.equal(refused.readback.outcome, "found");
    assert.ok(refused.workshop);
    assert.equal(refused.workshop.transaction_state, "refused");
    assert.match(refused.workshop.html, /Transaction state: refused/);
    assert.match(refused.workshop.html, /was refused and was not persisted/);
    assert.match(refused.workshop.html, /do not treat the refused attempt as durable/i);
    assert.match(
      refused.workshop.html,
      /This attempt changed nothing\. Current durable signals are shown below\./,
    );
    assert.match(
      refused.workshop.html,
      /This attempt was not accepted\. Current durable evidence is shown below\./,
    );
    assert.match(refused.workshop.html, /No durable signal changed in this attempt/);
    assert.doesNotMatch(
      refused.workshop.html,
      /What changed durably in this transaction\./,
    );
    assert.doesNotMatch(refused.workshop.html, /Why the change was accepted\./);
    assert.doesNotMatch(refused.workshop.html, /REFUSED_ATTEMPT_ONLY/);
    if (
      committed.readback.outcome === "found" &&
      refused.readback.outcome === "found"
    ) {
      assert.deepEqual(refused.readback.state, committed.readback.state);
    }
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });

    const emptyFixture = tempDatabase(t);
    const refusedBootstrap = makePipelineRevisionIntent({
      variant: "refuse-empty",
      raw_text_suffix: ` ${"y".repeat(300_000)}`,
    });
    const noCurrent = executeSyntheticTransactionWorkshopProof(
      proofInput(refusedBootstrap, emptyFixture),
    );
    assert.equal(noCurrent.transaction.outcome, "refused");
    assert.equal(noCurrent.workshop, null);
  });

  test("remains absent from product/runtime exports and package wiring", () => {
    const indexSource = readFileSync("src/index.ts", "utf8");
    const packageJson = readFileSync("package.json", "utf8");
    const moduleSource = readFileSync(
      "src/workshop/synthetic-transaction-workshop-proof.ts",
      "utf8",
    );

    assert.doesNotMatch(indexSource, /synthetic-transaction-workshop-proof/);
    assert.doesNotMatch(packageJson, /synthetic-transaction-workshop-proof/);
    assert.doesNotMatch(moduleSource, /from "\.\.\/runtime\//);
    assert.doesNotMatch(moduleSource, /from "\.\.\/cli\//);
    assert.doesNotMatch(moduleSource, /node:(?:http|https|net|tls|child_process)/);
  });
});
