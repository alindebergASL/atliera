import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test, type TestContext } from "node:test";

import {
  sha256CanonicalJson,
  type StrictJsonValue,
} from "../../src/authority/strict-json.ts";
import {
  SYNTHETIC_HUMAN_REVIEW_ASSURANCE,
  SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_KIND,
  SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_VERSION,
  createSyntheticHumanReviewLabVerifier,
  executeSyntheticHumanReviewLoop,
  renderSyntheticHumanReviewPendingProposal,
  verifySyntheticHumanReviewDecision,
  type SyntheticHumanReviewAuthContext,
  type SyntheticHumanReviewDecisionArtifact,
  type SyntheticHumanReviewDecisionRequest,
  type SyntheticHumanReviewLabVerifier,
} from "../../src/workshop/synthetic-human-review-loop.ts";
import { PINNED_DURABLE_WRITE_TRUST_LABEL } from "../../src/workshop/proposal-durable-graph-write-contract.ts";
import { makePipelineRevisionIntent } from "../graph/subject-graph-revision-transaction-fixture.ts";

const SECRET = "lab-secret-SYNTHETIC-DO-NOT-PERSIST-91d25b";
const ISSUED_AT = "2026-06-10T23:55:00Z";
const REVIEWED_AT = "2026-06-11T00:00:00Z";
const EXPIRES_AT = "2026-06-11T00:10:00Z";

interface TempDatabase {
  readonly directory: string;
  readonly path: string;
}

function tempDatabase(t: TestContext): TempDatabase {
  const directory = mkdtempSync(join(tmpdir(), "atliera-human-review-loop-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, path: join(directory, "state.sqlite") };
}

function databaseOptions(fixture: TempDatabase) {
  return {
    database_path: fixture.path,
    isolated_temporary_directory: fixture.directory,
  };
}

type Pipeline = ReturnType<typeof makePipelineRevisionIntent>;

function verificationInput(
  pipeline: Pipeline,
  fixture: TempDatabase,
  request: SyntheticHumanReviewDecisionRequest,
  authorization: string | undefined = `Bearer ${SECRET}`,
) {
  return {
    request,
    headers: authorization === undefined ? {} : { authorization },
    database: databaseOptions(fixture),
    envelope: pipeline.envelope,
    delta: pipeline.delta,
    transition: pipeline.transition,
    application_options: pipeline.applicationOptions,
    intent: pipeline.intent,
  };
}

function effectInput(
  pipeline: Pipeline,
  fixture: TempDatabase,
  decisionArtifact: unknown,
  authContext: unknown,
) {
  return effectInputWithDatabase(
    pipeline,
    databaseOptions(fixture),
    decisionArtifact,
    authContext,
  );
}

function effectInputWithDatabase(
  pipeline: Pipeline,
  database: unknown,
  decisionArtifact: unknown,
  authContext: unknown,
) {
  return {
    auth_context: authContext,
    decision_artifact: decisionArtifact,
    envelope: pipeline.envelope,
    delta: pipeline.delta,
    transition: pipeline.transition,
    application_options: pipeline.applicationOptions,
    intent: pipeline.intent,
    database,
  };
}

function tableCountsOrZero(path: string) {
  return existsSync(path)
    ? tableCounts(path)
    : { current: 0, receipts: 0, replays: 0 };
}

function verifier(
  clock: { now: string },
  overrides: Partial<Parameters<typeof createSyntheticHumanReviewLabVerifier>[0]> = {},
): SyntheticHumanReviewLabVerifier {
  return createSyntheticHumanReviewLabVerifier({
    actor_id: 'lab-reviewer:<Ada & "team">',
    assurance: SYNTHETIC_HUMAN_REVIEW_ASSURANCE,
    session_id: "lab-session-2026-06-11",
    issued_at: ISSUED_AT,
    expires_at: EXPIRES_AT,
    bearer_auth: { mode: "required", token: SECRET },
    clock: () => clock.now,
    ...overrides,
  });
}

function verify(
  pipeline: Pipeline,
  fixture: TempDatabase,
  clock: { now: string },
  decision: SyntheticHumanReviewDecisionRequest["decision"] =
    "accept_for_graph_candidate",
  reason = 'Store only this <synthetic & "bounded"> fixture.',
) {
  const result = verifySyntheticHumanReviewDecision(
    verificationInput(pipeline, fixture, { decision, reason }),
    verifier(clock),
  );
  assert.equal(result.outcome, "verified");
  if (result.outcome !== "verified") throw new Error("verification failed");
  return result;
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

function rehash(raw: SyntheticHumanReviewDecisionArtifact): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(raw)) as Record<string, any>;
  delete clone.decision_sha256;
  clone.decision_sha256 = sha256CanonicalJson(clone as StrictJsonValue);
  return clone;
}

function mutateAndRehash(
  artifact: SyntheticHumanReviewDecisionArtifact,
  mutate: (draft: Record<string, any>) => void,
): Record<string, any> {
  const draft = JSON.parse(JSON.stringify(artifact)) as Record<string, any>;
  mutate(draft);
  delete draft.decision_sha256;
  draft.decision_sha256 = sha256CanonicalJson(draft as StrictJsonValue);
  return draft;
}

function assertZeroEffects(value: {
  readonly counters: {
    readonly provider_calls: 0;
    readonly mcp_invocations: 0;
    readonly product_network_operations: 0;
    readonly production_effects: 0;
  };
}): void {
  assert.deepEqual(value.counters, {
    provider_calls: 0,
    mcp_invocations: 0,
    product_network_operations: 0,
    production_effects: 0,
  });
}

function assertSingleEarlySafeAction(
  html: string,
  detailMarkers: readonly string[],
): void {
  const heading = "<h2>One safe next action</h2>";
  const actionIndex = html.indexOf(heading);
  assert.notEqual(actionIndex, -1);
  assert.equal((html.match(/<h2>One safe next action<\/h2>/g) ?? []).length, 1);
  assert.ok(html.indexOf("<div class=\"boundary\">") < actionIndex);
  assert.ok(html.indexOf("<h1>Atliera Workshop</h1>") < actionIndex);
  assert.ok(html.indexOf("<h2>") < actionIndex);
  assert.ok(html.indexOf("<section class=\"detail\">") > actionIndex);
  for (const marker of detailMarkers) {
    const detailIndex = html.indexOf(marker);
    assert.notEqual(detailIndex, -1, marker);
    assert.ok(actionIndex < detailIndex, marker);
  }
  assert.doesNotMatch(html, /<(?:a\b|form\b|script\b)/i);
}

describe("synthetic human-review loop", () => {
  test("renders the zero-effect pending proposal before verified acceptance and exact-current ratified read-back", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({
      variant: "pending-sequence",
      include_three_lanes: true,
      object_title: "Pending signal proposal",
      map_title: "Pending operating map",
    });
    const pendingInput = {
      envelope: pipeline.envelope,
      delta: pipeline.delta,
      transition: pipeline.transition,
      application_options: pipeline.applicationOptions,
      intent: pipeline.intent,
    };
    assert.deepEqual(Object.keys(pendingInput).sort(), [
      "application_options",
      "delta",
      "envelope",
      "intent",
      "transition",
    ]);
    assert.equal(existsSync(fixture.path), false);

    const pending = renderSyntheticHumanReviewPendingProposal(pendingInput);
    assert.equal(pending.state, "pending_human_review");
    assert.equal(pending.envelope_sha256, pipeline.envelope.envelope_sha256);
    assert.equal(pending.delta_sha256, pipeline.delta.delta_sha256);
    assert.equal(pending.transition_sha256, pipeline.transition.transition_sha256);
    assert.equal(pending.pending_intent_sha256, pipeline.intent.intent_sha256);
    assert.equal(pending.candidate_sha256, pipeline.transition.candidate_sha256);
    assert.equal(pending.quality_gate_report.validation_report.ok, true);
    assert.equal(pending.quality_gate_report.status, "borderline");
    assert.equal(pending.quality_gate_report.ok, false);
    assert.equal(pending.quality_gate_report.metrics.accepted_excerpts, 0);
    assert.equal(pending.quality_gate_report.metrics.accepted_excerpt_rate, 0);
    assert.equal(
      pending.quality_gate_report.thresholds.min_accepted_excerpt_rate,
      0.5,
    );
    assertZeroEffects(pending);
    assert.equal(existsSync(fixture.path), false);
    assert.equal(Object.isFrozen(pending), true);
    assert.equal(Object.isFrozen(pending.workshop), true);
    assert.equal(Object.isFrozen(pending.workshop.view_model), true);
    assert.equal(Object.isFrozen(pending.workshop.view_model.lenses.maps), true);
    assert.equal(Object.isFrozen(pending.quality_gate_report), true);

    const pendingHtml = pending.workshop.html;
    assertSingleEarlySafeAction(pendingHtml, [
      "<h3>Maps</h3>",
      "<h3>Signals</h3>",
      "<h3>Plays</h3>",
      "<h3>Evidence &amp; provenance</h3>",
    ]);
    assert.match(pendingHtml, /<strong>Unverified<\/strong>/);
    assert.match(pendingHtml, /Model-proposed · pending human review/);
    assert.match(pendingHtml, /Proposed excerpt \(pending human review\)/);
    assert.match(pendingHtml, /<dt>Structural validation<\/dt><dd>Succeeded<\/dd>/);
    assert.match(pendingHtml, /Admitted because launch quality was non-failing; this is not a quality pass/);
    assert.match(pendingHtml, /<dt>Launch quality<\/dt><dd>Borderline \(ok=false\)<\/dd>/);
    assert.match(pendingHtml, /<dt>Accepted excerpts<\/dt><dd>0<\/dd>/);
    assert.match(pendingHtml, /<dt>Accepted-excerpt rate<\/dt><dd>0<\/dd>/);
    assert.match(pendingHtml, /<dt>Threshold<\/dt><dd>0\.5<\/dd>/);
    assert.match(pendingHtml, /<h3>Maps<\/h3>/);
    assert.match(pendingHtml, /<h3>Signals<\/h3>/);
    assert.match(pendingHtml, /<h3>Plays<\/h3>/);
    assert.match(pendingHtml, /Pending operating map/);
    assert.match(pendingHtml, /Pending signal proposal/);
    assert.match(pendingHtml, /Review the synthetic hub evidence/);
    assert.match(pendingHtml, /<h3>Evidence &amp; provenance<\/h3>/);
    assert.match(pendingHtml, /contains no authoritative decision or durable-state evidence/);
    assert.match(pendingHtml, /Rendering itself performs no authentication, database operation, or effect/);
    assert.match(pendingHtml, /does not establish or claim whether a decision or effect occurred elsewhere/);
    assert.match(pendingHtml, /does not verify facts or sources or grant production approval/);
    assert.doesNotMatch(pendingHtml, /No human decision or ratification has occurred/);
    assert.doesNotMatch(pendingHtml, /no database effect has occurred/i);
    assert.doesNotMatch(pendingHtml, /human-ratified/);
    assert.doesNotMatch(pendingHtml, /storage-current/);
    assert.doesNotMatch(pendingHtml, /durable storage/i);
    assert.equal((pendingHtml.match(/One safe next action/g) ?? []).length, 1);
    assert.match(
      pendingHtml,
      /Inspect the Borderline result, bound reasons, and proposed evidence before accepting or rejecting\./,
    );
    assert.doesNotMatch(JSON.stringify(pending), new RegExp(SECRET));
    assert.doesNotMatch(pendingHtml, new RegExp(SECRET));

    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, fixture, clock);
    const committed = executeSyntheticHumanReviewLoop(
      effectInput(
        pipeline,
        fixture,
        verified.decision_artifact,
        verified.auth_context,
      ),
    );
    assert.equal(committed.outcome, "committed");
    assert.equal(committed.transaction?.outcome, "committed");
    assert.equal(committed.readback?.outcome, "found");
    assert.equal(
      committed.workshop.storage_currentness,
      "exact_decision_bound_current_commit",
    );
    assert.match(
      committed.workshop.html,
      /Model-proposed · human-ratified · evidence pending/,
    );
    assert.match(committed.workshop.html, /fresh adapter verified the exact decision-bound commit/i);
    assert.doesNotMatch(committed.workshop.html, /read-only connection/i);
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });
    assertZeroEffects(committed);
  });

  test("verified acceptance commits exactly once, restarts for read-back, renders truthful Workshop, and persists no credential", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({
      variant: "human-loop-accepted",
      include_three_lanes: true,
      object_title: '<img src=x onerror="objectAttack()">',
    });
    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, fixture, clock);
    const artifact = verified.decision_artifact;

    assert.equal(artifact.decision, "accept_for_graph_candidate");
    assert.equal(artifact.assurance, "verified-local-lab-bearer-only");
    assert.equal(
      artifact.database_target_sha256,
      sha256CanonicalJson({
        kind: SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_KIND,
        version: SYNTHETIC_HUMAN_REVIEW_DATABASE_TARGET_VERSION,
        database_path: fixture.path,
        isolated_temporary_directory: fixture.directory,
      }),
    );
    assert.match(artifact.database_target_sha256, /^[0-9a-f]{64}$/);
    assert.equal(artifact.effect_contract.lifecycle_state, "operator-armed");
    assert.equal(
      artifact.effect_contract.current_effective_authorization,
      "single-armed-durable-write-attempt",
    );
    assert.equal(artifact.effect_contract.maximum_attempts, 1);
    assert.equal(artifact.effect_contract.retry_budget, 0);
    assert.equal(
      artifact.trust_label_on_accepted_durable_write,
      PINNED_DURABLE_WRITE_TRUST_LABEL,
    );
    assert.equal(artifact.quality_gate_report.status, "borderline");
    assert.equal(artifact.quality_gate_report.ok, false);
    assert.equal(artifact.quality_gate_report.metrics.accepted_excerpts, 0);
    assert.equal(artifact.quality_gate_report.metrics.accepted_excerpt_rate, 0);
    assert.equal(
      artifact.quality_gate_report.thresholds.min_accepted_excerpt_rate,
      0.5,
    );
    assert.deepEqual(artifact.quality_gate_report, pipeline.transition.quality_gate);
    assert.deepEqual(artifact.delta, pipeline.delta);
    assert.deepEqual(artifact.transition, pipeline.transition);
    assert.equal(artifact.pending_intent_sha256, pipeline.intent.intent_sha256);
    assert.equal(
      artifact.pending_review_handoff_sha256,
      pipeline.intent.review_handoff_sha256,
    );
    assert.deepEqual(artifact.pending_intent, pipeline.intent);
    assert.ok(artifact.transaction_intent);
    assert.ok(artifact.transaction_review_handoff);
    assert.notEqual(artifact.intent_sha256, artifact.pending_intent_sha256);
    assert.notEqual(
      artifact.review_handoff_sha256,
      artifact.pending_review_handoff_sha256,
    );
    assert.equal(
      artifact.transaction_intent?.intent_sha256,
      artifact.intent_sha256,
    );
    assert.equal(
      artifact.transaction_review_handoff?.reviewer_ref,
      `lab-auth-context:${artifact.auth_context_id}`,
    );
    assert.equal(artifact.transaction_review_handoff?.reviewed_at, REVIEWED_AT);
    assert.equal(
      artifact.transaction_review_handoff?.rationale,
      artifact.reason,
    );
    assert.equal(
      artifact.transaction_review_handoff?.authority.authenticated_human_approval,
      false,
    );
    assert.equal(artifact.transaction_review_handoff?.authority.ratification, false);
    assert.equal(pipeline.intent.authority.authenticated_human_approval, false);
    assert.equal(pipeline.intent.authority.ratification, false);
    assert.equal(artifact.authority.decision_integrity_digest_is_authority, false);
    assert.equal(artifact.authority.quality_gate_pass, false);

    const result = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, artifact, verified.auth_context),
    );
    assert.equal(result.outcome, "committed");
    assert.equal(result.transaction?.outcome, "committed");
    assert.equal(result.readback?.outcome, "found");
    assert.equal(
      result.workshop.storage_currentness,
      "exact_decision_bound_current_commit",
    );
    if (result.transaction?.outcome === "committed" && result.readback?.outcome === "found") {
      assert.deepEqual(result.transaction.state, result.readback.state);
      assert.notEqual(result.transaction.state.snapshot, result.readback.state.snapshot);
      assert.equal(result.transaction.receipt.authority.authenticated_human_approval, false);
      assert.equal(result.transaction.receipt.authority.ratification, false);
      assert.equal(result.readback.state.intent_sha256, artifact.intent_sha256);
      assert.equal(result.readback.state.snapshot_sha256, artifact.candidate_sha256);
      assert.equal(result.readback.receipt.replay_key, artifact.transaction_replay_key);
      assert.equal(
        result.readback.receipt.review_handoff_sha256,
        artifact.review_handoff_sha256,
      );
    }
    assert.deepEqual(tableCounts(fixture.path), { current: 1, receipts: 1, replays: 1 });
    assert.match(result.workshop.html, /Model-proposed · human-ratified · evidence pending/);
    assert.match(result.workshop.html, /ratifies this exact synthetic proposal for durable storage only/i);
    assert.match(result.workshop.html, /does not pass quality, verify facts or sources, grant production approval/i);
    assert.match(result.workshop.html, /<dt>Structural validation<\/dt><dd>Succeeded<\/dd>/);
    assert.match(result.workshop.html, /Admitted because launch quality was non-failing; this is not a quality pass/);
    assert.match(result.workshop.html, /<dt>Launch quality<\/dt><dd>Borderline \(ok=false\)<\/dd>/);
    assert.match(result.workshop.html, /<dt>Accepted excerpts<\/dt><dd>0<\/dd>/);
    assert.match(result.workshop.html, /<dt>Accepted-excerpt rate<\/dt><dd>0<\/dd>/);
    assert.match(result.workshop.html, /<dt>Threshold<\/dt><dd>0\.5<\/dd>/);
    assert.match(result.workshop.html, /Proposed evidence; not fact\/source verified/);
    assert.match(result.workshop.html, /<h3>Maps<\/h3>/);
    assert.match(result.workshop.html, /<h3>Signals<\/h3>/);
    assert.match(result.workshop.html, /<h3>Plays<\/h3>/);
    assert.match(result.workshop.html, /European distribution operating map/);
    assert.match(result.workshop.html, /Review the synthetic hub evidence/);
    assert.match(result.workshop.html, /&lt;img src=x onerror=&quot;objectAttack\(\)&quot;&gt;/);
    assert.match(result.workshop.html, /<h3>Evidence &amp; provenance<\/h3>/);
    assert.match(result.workshop.html, /Proposed excerpt · pending human review · provenance not verified/);
    assert.doesNotMatch(result.workshop.html, />Verified</);
    assert.match(result.workshop.html, /lab-reviewer:&lt;Ada &amp; &quot;team&quot;&gt;/);
    assert.match(result.workshop.html, /Store only this &lt;synthetic &amp; &quot;bounded&quot;&gt; fixture/);
    assert.doesNotMatch(result.workshop.html, /<img src=x onerror="objectAttack\(\)">/);
    assert.match(result.workshop.html, /One safe next action/);
    assertSingleEarlySafeAction(result.workshop.html, [
      "<h3>Maps</h3>",
      "<h3>Signals</h3>",
      "<h3>Plays</h3>",
      "<h3>Evidence &amp; provenance</h3>",
    ]);
    assert.match(result.workshop.html, /overflow-wrap:anywhere/);
    assert.match(result.workshop.html, /@media\(max-width:560px\)/);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.workshop), true);
    assert.equal(Object.isFrozen(result.decision_artifact), true);
    assert.equal(Object.isFrozen(result.decision_artifact?.quality_gate_report), true);
    assert.equal(Object.isFrozen(result.decision_artifact?.pending_intent), true);
    assert.equal(Object.isFrozen(result.decision_artifact?.transaction_intent), true);
    assert.equal(
      Object.isFrozen(result.decision_artifact?.transaction_review_handoff),
      true,
    );
    assert.equal(Object.isFrozen(result.workshop.view_model?.lenses.signals), true);
    assert.throws(() => {
      (artifact as { reason: string }).reason = "mutated";
    }, TypeError);

    const serialized = `${JSON.stringify(verified)}\n${JSON.stringify(result)}\n${verified.html}\n${result.workshop.html}`;
    assert.doesNotMatch(serialized, new RegExp(SECRET));
    assert.doesNotMatch(serialized, new RegExp(fixture.path));
    assert.doesNotMatch(serialized, new RegExp(fixture.directory));
    const sqliteBytes = readFileSync(fixture.path);
    assert.equal(sqliteBytes.includes(Buffer.from(SECRET, "utf8")), false);
    assert.equal(sqliteBytes.includes(Buffer.from(fixture.path, "utf8")), false);
    assert.equal(sqliteBytes.includes(Buffer.from(fixture.directory, "utf8")), false);
    assertZeroEffects(verified);
    assertZeroEffects(result);
  });

  test("exact accepted replay presents bounded idempotence and the original retained decision", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-replay" });
    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, fixture, clock);
    const first = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(first.outcome, "committed");
    const replay = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(replay.outcome, "already_committed");
    assert.equal(replay.transaction?.outcome, "already_committed");
    assert.match(replay.workshop.html, /Original retained human decision/);
    assert.match(replay.workshop.html, /lab-reviewer:&lt;Ada &amp; &quot;team&quot;&gt;/);
    assert.match(replay.workshop.html, /Store only this &lt;synthetic &amp; &quot;bounded&quot;&gt; fixture/);
    assert.match(replay.workshop.html, new RegExp(verified.decision_artifact.decision_sha256));
    assert.match(replay.workshop.html, new RegExp(verified.decision_artifact.decision_replay_identity));
    assert.match(replay.workshop.html, /Idempotent durable replay under the stated V1 lab boundary: no second committed graph revision, receipt, replay-consumption row, admission, acceptance, ratification, approval, or authority\./);
    assert.match(replay.workshop.html, /Replay creates no new ratification or authority\./);
    assert.doesNotMatch(replay.workshop.html, /No second write/);
    assert.doesNotMatch(replay.workshop.html, /read-only connection/i);
    assert.equal(
      replay.workshop.storage_currentness,
      "exact_decision_bound_current_commit",
    );
    assert.deepEqual(tableCounts(fixture.path), { current: 1, receipts: 1, replays: 1 });
  });

  test("one verifier-issued accepted decision is usable only at its exact disposable SQLite target", (t) => {
    const bound = tempDatabase(t);
    const second = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-target-binding" });
    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, bound, clock);
    const secondTargetDecision = verify(pipeline, second, clock);
    assert.notEqual(
      secondTargetDecision.decision_artifact.database_target_sha256,
      verified.decision_artifact.database_target_sha256,
    );
    assert.notEqual(
      secondTargetDecision.decision_artifact.auth_context_id,
      verified.decision_artifact.auth_context_id,
    );
    assert.notEqual(
      secondTargetDecision.decision_artifact.decision_replay_identity,
      verified.decision_artifact.decision_replay_identity,
    );
    assert.notEqual(
      secondTargetDecision.decision_artifact.intent_sha256,
      verified.decision_artifact.intent_sha256,
    );
    assert.notEqual(
      secondTargetDecision.decision_artifact.review_handoff_sha256,
      verified.decision_artifact.review_handoff_sha256,
    );

    const committed = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, bound, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(committed.outcome, "committed");
    assert.deepEqual(tableCounts(bound.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });

    const crossTarget = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, second, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(crossTarget.outcome, "refused");
    assert.equal(crossTarget.preflight, null);
    assert.equal(crossTarget.transaction, null);
    assert.equal(crossTarget.readback, null);
    assert.match(crossTarget.workshop.html, /exact-target binding/);
    assert.equal(existsSync(second.path), false);
    assert.deepEqual(tableCountsOrZero(second.path), {
      current: 0,
      receipts: 0,
      replays: 0,
    });

    const changedPath = join(bound.directory, "different-state.sqlite");
    const pathSubstitution = executeSyntheticHumanReviewLoop(
      effectInputWithDatabase(
        pipeline,
        {
          database_path: changedPath,
          isolated_temporary_directory: bound.directory,
        },
        verified.decision_artifact,
        verified.auth_context,
      ),
    );
    assert.equal(pathSubstitution.outcome, "refused");
    assert.equal(pathSubstitution.preflight, null);
    assert.equal(pathSubstitution.transaction, null);
    assert.equal(existsSync(changedPath), false);

    const directorySubstitution = executeSyntheticHumanReviewLoop(
      effectInputWithDatabase(
        pipeline,
        {
          database_path: bound.path,
          isolated_temporary_directory: second.directory,
        },
        verified.decision_artifact,
        verified.auth_context,
      ),
    );
    assert.equal(directorySubstitution.outcome, "refused");
    assert.equal(directorySubstitution.preflight, null);
    assert.equal(directorySubstitution.transaction, null);
    assert.deepEqual(tableCounts(bound.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });

    const publicSurface = `${JSON.stringify(verified)}\n${JSON.stringify(secondTargetDecision)}\n${JSON.stringify(committed)}\n${verified.html}\n${committed.workshop.html}`;
    for (const rawPath of [bound.path, bound.directory, second.path, second.directory]) {
      assert.equal(publicSurface.includes(rawPath), false);
    }
    const sqliteBytes = readFileSync(bound.path);
    assert.equal(sqliteBytes.includes(Buffer.from(SECRET, "utf8")), false);
    assert.equal(sqliteBytes.includes(Buffer.from(bound.path, "utf8")), false);
    assert.equal(sqliteBytes.includes(Buffer.from(bound.directory, "utf8")), false);
  });

  test("a different verified actor or reason cannot borrow the first durable ratification", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "decision-collision" });
    const clock = { now: REVIEWED_AT };
    const first = verify(
      pipeline,
      fixture,
      clock,
      "accept_for_graph_candidate",
      "First actor accepts only this exact synthetic storage attempt.",
    );
    const committed = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, first.decision_artifact, first.auth_context),
    );
    assert.equal(committed.outcome, "committed");

    const secondActor = "second-reviewer-must-not-borrow";
    const secondReason = "A different reason must produce a different durable intent.";
    const second = verifySyntheticHumanReviewDecision(
      verificationInput(pipeline, fixture, {
        decision: "accept_for_graph_candidate",
        reason: secondReason,
      }),
      verifier(clock, {
        actor_id: secondActor,
        session_id: "second-distinct-lab-session",
      }),
    );
    assert.equal(second.outcome, "verified");
    if (second.outcome !== "verified") return;
    assert.notEqual(
      second.decision_artifact.intent_sha256,
      first.decision_artifact.intent_sha256,
    );
    assert.notEqual(
      second.decision_artifact.review_handoff_sha256,
      first.decision_artifact.review_handoff_sha256,
    );

    const collision = executeSyntheticHumanReviewLoop(
      effectInput(
        pipeline,
        fixture,
        second.decision_artifact,
        second.auth_context,
      ),
    );
    assert.equal(collision.outcome, "refused");
    assert.equal(collision.transaction?.outcome, "refused");
    if (collision.transaction?.outcome === "refused") {
      assert.equal(collision.transaction.reason, "replay_key_collision");
    }
    assert.equal(collision.readback?.outcome, "found");
    if (collision.readback?.outcome === "found") {
      assert.equal(
        collision.readback.state.intent_sha256,
        first.decision_artifact.intent_sha256,
      );
    }
    assert.equal(collision.workshop.storage_currentness, "unavailable");
    assert.doesNotMatch(collision.workshop.html, /human-ratified/);
    assert.doesNotMatch(collision.workshop.html, new RegExp(secondActor));
    assert.doesNotMatch(collision.workshop.html, new RegExp(secondReason));
    assert.doesNotMatch(collision.workshop.html, /Borderline \(ok=false\)/);
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });
  });

  test("verified rejection opens no transaction and creates no database or ratification claim", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-reject" });
    const clock = { now: REVIEWED_AT };
    const verified = verify(
      pipeline,
      fixture,
      clock,
      "reject",
      "Reject this fixture.",
    );
    assert.equal(verified.decision_artifact.effect_contract.lifecycle_state, "rejected");
    assert.equal(verified.decision_artifact.effect_contract.current_effective_authorization, "none");
    assert.equal(verified.decision_artifact.transaction_intent, null);
    assert.equal(verified.decision_artifact.transaction_review_handoff, null);
    assert.equal(verified.decision_artifact.intent_sha256, null);
    assert.match(verified.decision_artifact.database_target_sha256, /^[0-9a-f]{64}$/);
    assert.equal(
      JSON.stringify(verified.decision_artifact).includes(fixture.path),
      false,
    );
    assert.equal(
      JSON.stringify(verified.decision_artifact).includes(fixture.directory),
      false,
    );
    const result = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(result.outcome, "rejected");
    assert.equal(result.preflight, null);
    assert.equal(result.transaction, null);
    assert.equal(result.readback, null);
    assert.equal(existsSync(fixture.path), false);
    assert.match(result.workshop.html, /graph transaction was not opened/i);
    assert.match(result.workshop.html, /No human ratification or durable application is claimed/);
    assert.doesNotMatch(result.workshop.html, /human-ratified/);
  });

  test("missing, invalid, disabled, forged, and expired authentication refuse before graph state opens", (t) => {
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-auth-refusals" });

    for (const [label, auth, expected] of [
      ["missing", null, "missing_bearer"],
      ["invalid", "Bearer definitely-wrong", "invalid_bearer"],
    ] as const) {
      const fixture = tempDatabase(t);
      const clock = { now: REVIEWED_AT };
      const result = verifySyntheticHumanReviewDecision(
        {
          ...verificationInput(
            pipeline,
            fixture,
            { decision: "accept_for_graph_candidate", reason: label },
          ),
          headers: auth === null ? {} : { authorization: auth },
        },
        verifier(clock),
      );
      assert.equal(result.outcome, "refused");
      if (result.outcome === "refused") assert.equal(result.reason, expected);
      assert.equal(existsSync(fixture.path), false);
      assert.doesNotMatch(result.html, /human-ratified/);
    }

    const verificationFixture = tempDatabase(t);
    const disabledClock = { now: REVIEWED_AT };
    const disabled = verifySyntheticHumanReviewDecision(
      verificationInput(pipeline, verificationFixture, {
        decision: "accept_for_graph_candidate",
        reason: "disabled",
      }),
      verifier(disabledClock, { bearer_auth: { mode: "disabled-local-dev" } }),
    );
    assert.equal(disabled.outcome, "refused");
    if (disabled.outcome === "refused") assert.equal(disabled.reason, "disabled_local_dev");

    const expired = verifySyntheticHumanReviewDecision(
      verificationInput(pipeline, verificationFixture, {
        decision: "accept_for_graph_candidate",
        reason: "expired",
      }),
      verifier({ now: EXPIRES_AT }),
    );
    assert.equal(expired.outcome, "refused");
    if (expired.outcome === "refused") assert.equal(expired.reason, "expired_at_verification");

    const notYet = verifySyntheticHumanReviewDecision(
      verificationInput(pipeline, verificationFixture, {
        decision: "accept_for_graph_candidate",
        reason: "early",
      }),
      verifier({ now: "2026-06-10T23:54:59.000Z" }),
    );
    assert.equal(notYet.outcome, "refused");
    if (notYet.outcome === "refused") assert.equal(notYet.reason, "not_yet_valid");

    const fixture = tempDatabase(t);
    const forged = executeSyntheticHumanReviewLoop(
      effectInput(
        pipeline,
        fixture,
        { decision_sha256: "0".repeat(64) },
        {
          authenticated: true,
          actor_id: "caller-name",
          assurance: SYNTHETIC_HUMAN_REVIEW_ASSURANCE,
          self_hash: "0".repeat(64),
        } as unknown as SyntheticHumanReviewAuthContext,
      ),
    );
    assert.equal(forged.outcome, "refused");
    assert.equal(forged.transaction, null);
    assert.equal(existsSync(fixture.path), false);
    assert.match(forged.workshop.html, /forged or was not verifier-issued/);

    const callerAuthority = verifySyntheticHumanReviewDecision(
      {
        ...verificationInput(pipeline, verificationFixture, {
          decision: "accept_for_graph_candidate",
          reason: "caller authority",
        }),
        request: {
          decision: "accept_for_graph_candidate",
          reason: "caller authority",
          actor_id: "caller-name",
          authenticated: true,
          self_hash: "0".repeat(64),
        },
      },
      verifier({ now: REVIEWED_AT }),
    );
    assert.equal(callerAuthority.outcome, "refused");
  });

  test("auth expiry is rechecked at effect time and refuses without opening graph state", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-effect-expiry" });
    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, fixture, clock);
    clock.now = EXPIRES_AT;
    const result = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(result.outcome, "refused");
    assert.equal(result.preflight, null);
    assert.equal(result.transaction, null);
    assert.equal(existsSync(fixture.path), false);
    assert.match(result.workshop.html, /expired or was not valid at effect time/);
  });

  test("effect time cannot regress before reviewed_at, while equality with reviewed_at is valid", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-effect-clock" });
    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, fixture, clock);

    clock.now = "2026-06-10T23:59:59.999Z";
    const regressed = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(regressed.outcome, "refused");
    assert.equal(regressed.preflight, null);
    assert.equal(regressed.transaction, null);
    assert.equal(regressed.readback, null);
    assert.equal(existsSync(fixture.path), false);
    assert.match(regressed.workshop.html, /regressed before the verified review time/);

    clock.now = REVIEWED_AT;
    const exactReviewTime = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, verified.decision_artifact, verified.auth_context),
    );
    assert.equal(exactReviewTime.outcome, "committed");
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });
  });

  test("all exact decision bindings reject substitution and self-rehashed mutation before mutation", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-bindings" });
    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, fixture, clock);
    const mutations: readonly [string, (draft: Record<string, any>) => void][] = [
      ["team", (d) => { d.graph_identity.team_id = "team_other"; }],
      ["account", (d) => { d.graph_identity.account_id = "acc_other"; }],
      ["subject", (d) => { d.graph_identity.subject_id = "subject_other"; }],
      ["purpose", (d) => { d.graph_identity.purpose = "other"; }],
      ["envelope", (d) => { d.envelope_sha256 = "1".repeat(64); }],
      ["delta-sha", (d) => { d.delta_sha256 = "2".repeat(64); }],
      ["delta-exact", (d) => { d.delta.created_at = "2026-06-11T00:00:01.000Z"; }],
      ["transition-sha", (d) => { d.transition_sha256 = "3".repeat(64); }],
      ["transition-exact", (d) => { d.transition.created_at = "2026-06-11T00:00:01.000Z"; }],
      ["pending-intent-sha", (d) => { d.pending_intent_sha256 = "4".repeat(64); }],
      ["pending-handoff-sha", (d) => { d.pending_review_handoff_sha256 = "5".repeat(64); }],
      ["pending-intent-exact", (d) => { d.pending_intent.review_handoff.rationale = "substituted pending rationale"; }],
      ["transaction-intent-sha", (d) => { d.intent_sha256 = "d".repeat(64); }],
      ["transaction-handoff-sha", (d) => { d.review_handoff_sha256 = "e".repeat(64); }],
      ["transaction-intent-exact", (d) => { d.transaction_intent.intent_sha256 = "f".repeat(64); }],
      ["transaction-handoff-exact", (d) => { d.transaction_review_handoff.rationale = "substituted transaction rationale"; }],
      ["candidate", (d) => { d.candidate_sha256 = "6".repeat(64); }],
      ["predecessor-revision", (d) => { d.predecessor_basis.expected_prior_revision = "rev_8"; }],
      ["predecessor-digest", (d) => { d.predecessor_basis.expected_base_snapshot_sha256 = "7".repeat(64); }],
      ["base-digest", (d) => { d.base_snapshot_sha256 = "8".repeat(64); }],
      ["quality-policy", (d) => { d.quality_gate_policy.policy_sha256 = "9".repeat(64); }],
      ["quality-report", (d) => { d.quality_gate_report.metrics.total_sources += 1; }],
      ["actor", (d) => { d.verified_actor = "another-actor"; }],
      ["auth-context", (d) => { d.auth_context_id = "a".repeat(64); }],
      ["database-target", (d) => { d.database_target_sha256 = "0".repeat(64); }],
      ["session", (d) => { d.session_id = "another-session"; }],
      ["decision", (d) => { d.decision = "reject"; }],
      ["reason", (d) => { d.reason = "substituted"; }],
      ["issued", (d) => { d.issued_at = "2026-06-10T23:55:01.000Z"; }],
      ["reviewed", (d) => { d.reviewed_at = "2026-06-11T00:00:01.000Z"; }],
      ["expires", (d) => { d.expires_at = "2026-06-11T00:09:59.000Z"; }],
      ["transaction-replay", (d) => { d.transaction_replay_key = "b".repeat(64); }],
      ["decision-replay", (d) => { d.decision_replay_identity = "c".repeat(64); }],
    ];
    for (const [label, mutate] of mutations) {
      const hostile = mutateAndRehash(verified.decision_artifact, mutate);
      const result = executeSyntheticHumanReviewLoop(
        effectInput(pipeline, fixture, hostile, verified.auth_context),
      );
      assert.equal(result.outcome, "refused", label);
      assert.equal(result.preflight, null, label);
      assert.equal(result.transaction, null, label);
      assert.equal(existsSync(fixture.path), false, label);
    }

    const unchangedSelfRehash = rehash(verified.decision_artifact);
    assert.equal(unchangedSelfRehash.decision_sha256, verified.decision_artifact.decision_sha256);
  });

  test("hostile Proxy and accessor inputs are refused without invoking traps or opening graph state", (t) => {
    const fixture = tempDatabase(t);
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-hostile" });
    const clock = { now: REVIEWED_AT };
    const verified = verify(pipeline, fixture, clock);
    let proxyCalls = 0;
    const hostileArtifact = new Proxy(verified.decision_artifact, {
      get() {
        proxyCalls += 1;
        throw new Error("must not read");
      },
      ownKeys() {
        proxyCalls += 1;
        throw new Error("must not enumerate");
      },
    });
    const proxyResult = executeSyntheticHumanReviewLoop(
      effectInput(pipeline, fixture, hostileArtifact, verified.auth_context),
    );
    assert.equal(proxyResult.outcome, "refused");
    assert.equal(proxyCalls, 0);

    let accessorReads = 0;
    const raw = effectInput(
      pipeline,
      fixture,
      verified.decision_artifact,
      verified.auth_context,
    );
    Object.defineProperty(raw, "decision_artifact", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return verified.decision_artifact;
      },
    });
    const accessorResult = executeSyntheticHumanReviewLoop(raw);
    assert.equal(accessorResult.outcome, "refused");
    assert.equal(accessorReads, 0);
    assert.equal(existsSync(fixture.path), false);
  });

  test("a predecessor conflict spends the zero-retry context before any repaired-target reuse", (t) => {
    const fixture = tempDatabase(t);
    const clock = { now: REVIEWED_AT };
    const firstPipeline = makePipelineRevisionIntent({ variant: "human-loop-current" });
    const firstVerified = verify(firstPipeline, fixture, clock);
    const first = executeSyntheticHumanReviewLoop(
      effectInput(firstPipeline, fixture, firstVerified.decision_artifact, firstVerified.auth_context),
    );
    assert.equal(first.outcome, "committed");

    const stalePipeline = makePipelineRevisionIntent({ variant: "human-loop-stale" });
    const staleVerified = verify(stalePipeline, fixture, clock);
    const stale = executeSyntheticHumanReviewLoop(
      effectInput(stalePipeline, fixture, staleVerified.decision_artifact, staleVerified.auth_context),
    );
    assert.equal(stale.outcome, "conflicted");
    assert.equal(stale.transaction?.outcome, "conflicted");
    assert.match(stale.workshop.html, /No new revision was created/);
    assert.doesNotMatch(stale.workshop.html, /human-ratified/);
    assert.doesNotMatch(stale.workshop.html, /Quality result/);
    assert.deepEqual(tableCounts(fixture.path), { current: 1, receipts: 1, replays: 1 });

    rmSync(fixture.path);
    const repairedDecision = verify(firstPipeline, fixture, clock);
    const repaired = executeSyntheticHumanReviewLoop(
      effectInput(
        firstPipeline,
        fixture,
        repairedDecision.decision_artifact,
        repairedDecision.auth_context,
      ),
    );
    assert.equal(repaired.outcome, "committed");
    const beforeReuse = tableCounts(fixture.path);

    const staleReuse = executeSyntheticHumanReviewLoop(
      effectInput(
        stalePipeline,
        fixture,
        staleVerified.decision_artifact,
        staleVerified.auth_context,
      ),
    );
    assert.equal(staleReuse.outcome, "refused");
    assert.equal(staleReuse.preflight, null);
    assert.equal(staleReuse.transaction, null);
    assert.equal(staleReuse.readback, null);
    assert.match(staleReuse.workshop.html, /terminal zero-retry outcome/);
    assert.deepEqual(tableCounts(fixture.path), beforeReuse);
  });

  test("corrupt preflight spends its context; repair requires a newly verified decision", (t) => {
    const fixture = tempDatabase(t);
    const clock = { now: REVIEWED_AT };
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-corrupt-spend" });
    const initial = verify(pipeline, fixture, clock);
    assert.equal(
      executeSyntheticHumanReviewLoop(
        effectInput(pipeline, fixture, initial.decision_artifact, initial.auth_context),
      ).outcome,
      "committed",
    );

    const db = new DatabaseSync(fixture.path, {
      allowExtension: false,
      enableForeignKeyConstraints: true,
    });
    try {
      db.exec("UPDATE subject_graph_current_state SET snapshot_json = '{}'");
    } finally {
      db.close();
    }
    const corruptDecision = verify(pipeline, fixture, clock);
    const before = tableCounts(fixture.path);
    const corruptPreflight = executeSyntheticHumanReviewLoop(
      effectInput(
        pipeline,
        fixture,
        corruptDecision.decision_artifact,
        corruptDecision.auth_context,
      ),
    );
    assert.equal(corruptPreflight.outcome, "dependency_failed");
    assert.equal(corruptPreflight.preflight?.outcome, "dependency_failed");
    assert.equal(corruptPreflight.transaction, null);
    assert.equal(corruptPreflight.readback, null);
    assert.match(corruptPreflight.workshop.html, /transaction was not attempted/);
    assert.doesNotMatch(corruptPreflight.workshop.html, /human-ratified/);
    assert.deepEqual(tableCounts(fixture.path), before);

    rmSync(fixture.path);
    const spentReuse = executeSyntheticHumanReviewLoop(
      effectInput(
        pipeline,
        fixture,
        corruptDecision.decision_artifact,
        corruptDecision.auth_context,
      ),
    );
    assert.equal(spentReuse.outcome, "refused");
    assert.equal(spentReuse.preflight, null);
    assert.equal(spentReuse.transaction, null);
    assert.equal(spentReuse.readback, null);
    assert.equal(existsSync(fixture.path), false);
    assert.match(spentReuse.workshop.html, /terminal zero-retry outcome/);

    const newDecision = verify(pipeline, fixture, clock);
    assert.notEqual(newDecision.auth_context, corruptDecision.auth_context);
    const recovered = executeSyntheticHumanReviewLoop(
      effectInput(
        pipeline,
        fixture,
        newDecision.decision_artifact,
        newDecision.auth_context,
      ),
    );
    assert.equal(recovered.outcome, "committed");
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 1,
      replays: 1,
    });

    const publicSurface = JSON.stringify({
      corruptDecision,
      corruptPreflight,
      spentReuse,
      newDecision,
      recovered,
    });
    assert.equal(publicSurface.includes(SECRET), false);
    assert.equal(publicSurface.includes(fixture.path), false);
    assert.equal(publicSurface.includes(fixture.directory), false);
    assert.doesNotMatch(publicSurface, /attempt_state|target_file_identity|birthtime_nanoseconds/);
    const sqliteBytes = readFileSync(fixture.path);
    assert.equal(sqliteBytes.includes(Buffer.from(SECRET, "utf8")), false);
    assert.equal(sqliteBytes.includes(Buffer.from(fixture.path, "utf8")), false);
    assert.equal(sqliteBytes.includes(Buffer.from(fixture.directory, "utf8")), false);
    assert.equal(sqliteBytes.includes(Buffer.from("target_file_identity", "utf8")), false);
  });

  test("a successful context cannot bootstrap again after its target is deleted or recreated", (t) => {
    const fixture = tempDatabase(t);
    const clock = { now: REVIEWED_AT };
    const pipeline = makePipelineRevisionIntent({ variant: "human-loop-success-delete" });
    const successfulDecision = verify(pipeline, fixture, clock);
    assert.equal(
      executeSyntheticHumanReviewLoop(
        effectInput(
          pipeline,
          fixture,
          successfulDecision.decision_artifact,
          successfulDecision.auth_context,
        ),
      ).outcome,
      "committed",
    );

    rmSync(fixture.path);
    const deletedTargetReplay = executeSyntheticHumanReviewLoop(
      effectInput(
        pipeline,
        fixture,
        successfulDecision.decision_artifact,
        successfulDecision.auth_context,
      ),
    );
    assert.equal(deletedTargetReplay.outcome, "refused");
    assert.equal(deletedTargetReplay.transaction, null);
    assert.equal(existsSync(fixture.path), false);
    assert.match(deletedTargetReplay.workshop.html, /cannot bootstrap another commit/);

    const recreatedFixture = tempDatabase(t);
    const recreatedPipeline = makePipelineRevisionIntent({
      variant: "success-recreated",
    });
    const originalDecision = verify(recreatedPipeline, recreatedFixture, clock);
    assert.equal(
      executeSyntheticHumanReviewLoop(
        effectInput(
          recreatedPipeline,
          recreatedFixture,
          originalDecision.decision_artifact,
          originalDecision.auth_context,
        ),
      ).outcome,
      "committed",
    );
    rmSync(recreatedFixture.path);

    const replacementDecision = verify(recreatedPipeline, recreatedFixture, clock);
    assert.equal(
      executeSyntheticHumanReviewLoop(
        effectInput(
          recreatedPipeline,
          recreatedFixture,
          replacementDecision.decision_artifact,
          replacementDecision.auth_context,
        ),
      ).outcome,
      "committed",
    );
    const replacementCounts = tableCounts(recreatedFixture.path);
    const recreatedTargetReuse = executeSyntheticHumanReviewLoop(
      effectInput(
        recreatedPipeline,
        recreatedFixture,
        originalDecision.decision_artifact,
        originalDecision.auth_context,
      ),
    );
    assert.equal(recreatedTargetReuse.outcome, "refused");
    assert.equal(recreatedTargetReuse.preflight?.outcome, "found");
    assert.equal(recreatedTargetReuse.transaction, null);
    assert.match(recreatedTargetReuse.workshop.html, /absent, recreated, or unreadable target/);
    assert.deepEqual(tableCounts(recreatedFixture.path), replacementCounts);
  });

  test("historical replay beside a later current revision borrows no approval, currentness, or quality", (t) => {
    const fixture = tempDatabase(t);
    const clock = { now: REVIEWED_AT };
    const revisionOne = makePipelineRevisionIntent({ variant: "human-loop-history-1" });
    const decisionOne = verify(revisionOne, fixture, clock);
    assert.equal(
      executeSyntheticHumanReviewLoop(
        effectInput(revisionOne, fixture, decisionOne.decision_artifact, decisionOne.auth_context),
      ).outcome,
      "committed",
    );
    const revisionTwo = makePipelineRevisionIntent({
      variant: "human-loop-history-2",
      base: revisionOne.intent.proposed_snapshot,
      expected_prior_revision: "rev_1",
      object_title: "LATER_STORAGE_CURRENT_MARKER",
    });
    const decisionTwo = verify(revisionTwo, fixture, clock);
    assert.equal(
      executeSyntheticHumanReviewLoop(
        effectInput(revisionTwo, fixture, decisionTwo.decision_artifact, decisionTwo.auth_context),
      ).outcome,
      "committed",
    );

    const historical = executeSyntheticHumanReviewLoop(
      effectInput(revisionOne, fixture, decisionOne.decision_artifact, decisionOne.auth_context),
    );
    assert.equal(historical.outcome, "already_committed");
    assert.equal(historical.workshop.storage_currentness, "historical_or_overtaken");
    assert.match(historical.workshop.html, /Original retained human decision/);
    assert.match(historical.workshop.html, /<dt>Actor<\/dt><dd>lab-reviewer:&lt;Ada &amp; &quot;team&quot;&gt;<\/dd>/);
    assert.match(historical.workshop.html, /<dt>Bound reason<\/dt><dd>Store only this &lt;synthetic &amp; &quot;bounded&quot;&gt; fixture\.<\/dd>/);
    assert.match(historical.workshop.html, new RegExp(decisionOne.decision_artifact.decision_sha256));
    assert.match(historical.workshop.html, new RegExp(decisionOne.decision_artifact.decision_replay_identity));
    assert.match(historical.workshop.html, /Idempotent durable replay under the stated V1 lab boundary: no second committed graph revision, receipt, replay-consumption row, admission, acceptance, ratification, approval, or authority\./);
    assert.match(historical.workshop.html, /Replay creates no new ratification or authority\./);
    assert.match(historical.workshop.html, /None of the original retained human-decision attribution applies to or ratifies the later storage-current state/);
    assert.match(historical.workshop.html, /later state remains storage-only, unverified, and pending human review/);
    assert.match(historical.workshop.html, /no borrowed ratification, currentness, quality, admission, acceptance, approval, or authority/);
    assert.match(historical.workshop.html, /LATER_STORAGE_CURRENT_MARKER/);
    assert.match(historical.workshop.html, /Storage-current only · no decision attribution/);
    assert.match(historical.workshop.html, /<h3>Evidence &amp; provenance<\/h3>/);
    assert.match(historical.workshop.html, /Unverified proposed evidence/);
    assert.match(historical.workshop.html, /Proposed excerpt \(pending human review\)/);
    assert.match(historical.workshop.html, /Factual, source, and provenance verification remain pending/);
    assert.match(historical.workshop.html, /not fact\/source or provenance verified/);
    assert.match(historical.workshop.html, /provenance not verified/);
    assert.match(historical.workshop.html, /Acme Robotics opens European distribution hub/);
    assert.match(historical.workshop.html, /The hub supports same-week delivery for enterprise warehouse customers/);
    assert.doesNotMatch(historical.workshop.html, /human-ratified/);
    assert.doesNotMatch(historical.workshop.html, /Human acceptance by/);
    assert.doesNotMatch(historical.workshop.html, /Borderline \(ok=false\)/);
    assert.doesNotMatch(historical.workshop.html, /Policy\/candidate admission/);
    assert.doesNotMatch(historical.workshop.html, /Accepted excerpts/);
    assert.equal(
      (historical.workshop.html.match(/One safe next action/g) ?? []).length,
      1,
    );
    assertSingleEarlySafeAction(historical.workshop.html, [
      "<h3>Maps</h3>",
      "<h3>Signals</h3>",
      "<h3>Plays</h3>",
      "<h3>Evidence &amp; provenance</h3>",
    ]);
    assert.match(historical.workshop.html, /overflow-wrap:anywhere/);
    assert.match(historical.workshop.html, /@media\(max-width:560px\)/);
    assert.deepEqual(tableCounts(fixture.path), { current: 1, receipts: 2, replays: 2 });

    const repeatedHistorical = executeSyntheticHumanReviewLoop(
      effectInput(
        revisionOne,
        fixture,
        decisionOne.decision_artifact,
        decisionOne.auth_context,
      ),
    );
    assert.equal(repeatedHistorical.outcome, "already_committed");
    assert.equal(repeatedHistorical.transaction?.outcome, "already_committed");
    assert.equal(
      repeatedHistorical.workshop.storage_currentness,
      "historical_or_overtaken",
    );
    assert.match(repeatedHistorical.workshop.html, /LATER_STORAGE_CURRENT_MARKER/);
    assert.match(repeatedHistorical.workshop.html, /Storage-current only · no decision attribution/);
    assert.match(repeatedHistorical.workshop.html, /<h3>Evidence &amp; provenance<\/h3>/);
    assert.match(repeatedHistorical.workshop.html, /Original retained human decision/);
    assert.match(repeatedHistorical.workshop.html, new RegExp(decisionOne.decision_artifact.decision_sha256));
    assert.match(repeatedHistorical.workshop.html, new RegExp(decisionOne.decision_artifact.decision_replay_identity));
    assert.match(repeatedHistorical.workshop.html, /Replay creates no new ratification or authority\./);
    assert.doesNotMatch(repeatedHistorical.workshop.html, /human-ratified/);
    assert.doesNotMatch(repeatedHistorical.workshop.html, /Human acceptance by/);
    assert.doesNotMatch(repeatedHistorical.workshop.html, /Borderline \(ok=false\)/);
    assert.doesNotMatch(repeatedHistorical.workshop.html, /Launch quality/);
    assert.doesNotMatch(repeatedHistorical.workshop.html, /Policy\/candidate admission/);
    assert.doesNotMatch(repeatedHistorical.workshop.html, /Accepted excerpts/);
    assertSingleEarlySafeAction(repeatedHistorical.workshop.html, [
      "<h3>Maps</h3>",
      "<h3>Signals</h3>",
      "<h3>Plays</h3>",
      "<h3>Evidence &amp; provenance</h3>",
    ]);
    assert.deepEqual(tableCounts(fixture.path), {
      current: 1,
      receipts: 2,
      replays: 2,
    });
  });

  test("architecture contract states the bounded V1 threat model and future prerequisites", () => {
    const architecture = readFileSync(
      "docs/architecture/synthetic-human-review-loop-v1.md",
      "utf8",
    );
    for (const boundary of [
      "trusted single process with serialized coordinator calls;",
      "process-owned private mode-0700 disposable directory;",
      "synthetic data only;",
      "no concurrent same-UID or out-of-band filesystem mutation;",
      "no runtime, route, deployment, real-data, or production authority.",
    ]) assert.match(architecture, new RegExp(boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(architecture, /Idempotent durable replay under the stated V1 lab boundary: no second committed graph revision, receipt, replay-consumption row, admission, acceptance, ratification, approval, or authority\./);
    assert.match(architecture, /Hostile concurrent filesystem replacement, true handle-bound read-only replay, and physical database\/SQLite sidecar immutability must be solved before multi-process, real-data, runtime, or production use\./);
    assert.match(architecture, /These are not V1 merge blockers under the stated lab boundary\./);
  });

  test("module remains an internal lab seam with no product, CLI, route, or package wiring", () => {
    const source = readFileSync("src/workshop/synthetic-human-review-loop.ts", "utf8");
    const index = readFileSync("src/index.ts", "utf8");
    const packageJson = readFileSync("package.json", "utf8");
    assert.doesNotMatch(index, /synthetic-human-review-loop/);
    assert.doesNotMatch(packageJson, /synthetic-human-review-loop/);
    assert.doesNotMatch(source, /\.\.\/db\/local-durable-db/);
    assert.doesNotMatch(source, /m5b-repository-native/);
    assert.doesNotMatch(source, /node:(?:http|https|net|tls|child_process)/);
    assert.match(source, /executeSyntheticTransactionWorkshopProof/);
    assert.match(source, /preflightSyntheticTransactionWorkshopRead/);
  });
});
