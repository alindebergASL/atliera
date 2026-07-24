import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";

import { LocalFileVersionedGraphStore } from "../../src/graph/local-file-versioned-store.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";
import {
  M5B_REPOSITORY_NATIVE_RATIFICATION_KIND,
  M5bRepositoryNativeRefusal,
  applyM5bRepositoryNative,
  m5bRepositoryNativePreviewModeForSourceKind,
  prepareM5bRepositoryNative,
  verifyM5bRepositoryNativeRatificationArtifactHash,
  type M5bRepositoryNativeApplyOptions,
  type M5bRepositoryNativeRatification,
  type M5bRepositoryNativeRatificationContent,
} from "../../src/workshop/m5b-repository-native.ts";
import { makeValidBundle } from "../fixtures/valid-graph.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const SOURCE = join(ROOT, "fixtures/validation/m5b-fedex-system-acquired-demo-source.json");
const RATIFICATION_FIXTURE = join(ROOT, "fixtures/validation/m5b-repository-native-synthetic-ratification.json");
const COMMIT = "a".repeat(40);
const TREE = "b".repeat(40);
const OWNER_AUTHORIZATION = "owner_fixture_m5b_repository_native_001";

function hash(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function scenarioRoot(): string {
  return mkdtempSync(join(tmpdir(), "atliera-m5b-repository-native-"));
}

async function preparedScenario(root: string) {
  const bytes = readFileSync(SOURCE);
  const preparedDir = join(root, "prepared");
  const result = await prepareM5bRepositoryNative({
    sourcePath: SOURCE,
    outputDir: preparedDir,
    expectedSource: { kind: "committed-synthetic-fixture", sha256: hash(bytes), size: bytes.byteLength },
    ownerAuthorizationId: OWNER_AUTHORIZATION,
    executionCommit: COMMIT,
    executionTree: TREE,
  });
  return { preparedDir, result };
}

type DecisionMode = "all-accept" | "mixed" | "reject-all";

function ratificationFor(
  prepare: Awaited<ReturnType<typeof prepareM5bRepositoryNative>>,
  options: {
    decisionMode?: DecisionMode;
    retentionDisposition?: "accept" | "reject";
    ratifierId?: string;
  } = {},
): M5bRepositoryNativeRatification {
  const fixture = JSON.parse(readFileSync(RATIFICATION_FIXTURE, "utf8")) as {
    ratifierId: string;
    ratifiedAt: string;
    retentionDisposition: "accept" | "reject";
    decisions: Array<{ proposalId: string; disposition: "accept" | "reject"; reasonCode: string }>;
  };
  const decisionMode = options.decisionMode ?? "mixed";
  const decisions = fixture.decisions.map((decision, index) => {
    const disposition = decisionMode === "all-accept"
      ? "accept" as const
      : decisionMode === "reject-all"
        ? "reject" as const
        : decision.disposition;
    return {
      proposalId: decision.proposalId,
      disposition,
      reasonCode: disposition === "accept" ? `accepted_source_binding_${index}` : `rejected_human_decision_${index}`,
    };
  });
  const content: M5bRepositoryNativeRatificationContent = {
    kind: M5B_REPOSITORY_NATIVE_RATIFICATION_KIND,
    schemaVersion: "1",
    prepareResultSha256: prepare.resultSha256,
    sourceSha256: prepare.sourceIdentity.sha256,
    sourceSize: prepare.sourceIdentity.size,
    sourcePackSha256: prepare.sourcePackSha256,
    candidateContentSha256: prepare.candidateContentSha256,
    reviewPacketSha256: prepare.reviewPacketSha256,
    ownerAuthorizationId: prepare.ownerAuthorizationId,
    executionCommit: prepare.executionCommit,
    executionTree: prepare.executionTree,
    ratifierId: options.ratifierId ?? fixture.ratifierId,
    ratifiedAt: fixture.ratifiedAt,
    retentionDisposition: options.retentionDisposition ?? fixture.retentionDisposition,
    decisions,
    currentEffectiveAuthorization: "one-shot-local-durable-graph-write",
    authorizesDurableLocalWrite: true,
    maximumDurableLocalWrites: 1,
    authorizesProviderCall: false,
    authorizesAcquisition: false,
    authorizesNetwork: false,
    authorizesDeployment: false,
    retries: 0,
  };
  return { ...content, ratificationArtifactSha256: verifyM5bRepositoryNativeRatificationArtifactHash(content) };
}

async function writeRatification(
  path: string,
  ratification: M5bRepositoryNativeRatification,
): Promise<{ path: string; rawSha256: string }> {
  const bytes = Buffer.from(`${JSON.stringify(ratification, null, 2)}\n`, "utf8");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  return { path, rawSha256: hash(bytes) };
}

function applyOptions(
  preparedDir: string,
  ratification: { path: string; rawSha256: string },
  graphStoreRoot: string,
  outputDir: string,
): M5bRepositoryNativeApplyOptions {
  return {
    preparedDir,
    ratificationPath: ratification.path,
    graphStoreRoot,
    outputDir,
    expectedRatificationSha256: ratification.rawSha256,
    expectedOwnerAuthorizationId: OWNER_AUTHORIZATION,
    expectedExecutionCommit: COMMIT,
    expectedExecutionTree: TREE,
  };
}

function assertRefusalCode(error: unknown, code: string): boolean {
  if (!(error instanceof M5bRepositoryNativeRefusal)) return false;
  assert.equal(error.code, code);
  return true;
}

describe("M5b repository-native product completion", () => {
  test("prepares one exact content read and only the inspectable pre-ratification surface", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result } = await preparedScenario(root);
      assert.equal(result.sourceIdentity.kind, "committed-synthetic-fixture");
      assert.equal(result.executionCommit, COMMIT);
      assert.equal(result.executionTree, TREE);
      assert.deepEqual(result.accounting, {
        explicitSourceReads: 1,
        outputFilesWritten: 5,
        preRatificationWorkshopPages: 1,
        providerCalls: 0,
        acquisitions: 0,
        networkCalls: 0,
        durableLocalGraphWrites: 0,
        deployments: 0,
        retries: 0,
      });
      assert.deepEqual(result.artifacts.map((item) => item.name), [
        "source-pack.json",
        "candidate.json",
        "review-packet.json",
        "workshop-pre-ratification.html",
      ]);
      const html = readFileSync(join(preparedDir, "workshop-pre-ratification.html"), "utf8");
      assert.match(html, /Pending human review/);
      assert.match(html, /Current effective authorization: <strong>none<\/strong>/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("all-accept creates durable objects, records accepted retention, and labels the fixture truthfully", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratification = ratificationFor(prepare, {
        decisionMode: "all-accept",
        retentionDisposition: "accept",
      });
      const ratificationFile = await writeRatification(join(root, "ratification", "human.json"), ratification);
      const graphStoreRoot = join(root, "graph-store");
      const outputDir = join(root, "applied");
      const result = await applyM5bRepositoryNative(
        applyOptions(preparedDir, ratificationFile, graphStoreRoot, outputDir),
      );

      assert.equal(result.graphCommitDisposition, "newly-created");
      assert.equal(result.ratificationRawSha256, ratificationFile.rawSha256);
      assert.equal(result.durableBundleSha256, result.readBackBundleSha256);
      assert.deepEqual(result.decisions, ratification.decisions);
      assert.deepEqual(result.acceptedProposalIds, ratification.decisions.map((item) => item.proposalId));
      assert.deepEqual(result.rejectedProposalIds, []);
      assert.deepEqual(result.retentionDecision, {
        retentionDraftId: "m5b-fedex-source-retention-beyond-original-deadline",
        deadline: "2026-08-13T18:41:11.277Z",
        disposition: "accept",
        outcome: "beyond-deadline-retention-approved",
        originalCustodyDeleted: false,
        externalCustodyCleanupRequired: false,
      });
      assert.equal(result.accounting.durableLocalGraphWrites, 1);
      assert.equal(result.accounting.retries, 0);

      const durable = await new LocalFileVersionedGraphStore(graphStoreRoot).load(result.graphId);
      assert.equal(durable?.bundle.account_objects.length, 2);
      assert.deepEqual(durable?.bundle.audit_events.map((event) => event.event_type), [
        "claim.ratified",
        "claim.ratified",
        "source.retention_decided",
      ]);
      const retention = durable?.bundle.audit_events[2];
      assert.equal(retention?.actor_id, ratification.ratifierId);
      assert.equal(retention?.payload_json.ratification_raw_sha256, ratificationFile.rawSha256);
      assert.equal(retention?.payload_json.original_custody_deleted, false);

      const html = await readFile(join(outputDir, "workshop-final.html"), "utf8");
      assert.match(html, /Durable synthetic-fixture preview \(local graph\)/);
      assert.match(html, /Durable synthetic fixture/);
      assert.doesNotMatch(html, /System-acquired public source/);
      assert.doesNotMatch(html, /pending human review/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("mixed decisions preserve rejection reasons and rejected retention without claiming deletion", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratification = ratificationFor(prepare, {
        decisionMode: "mixed",
        retentionDisposition: "reject",
      });
      const ratificationFile = await writeRatification(join(root, "ratification", "human.json"), ratification);
      const graphStoreRoot = join(root, "graph-store");
      const result = await applyM5bRepositoryNative(
        applyOptions(preparedDir, ratificationFile, graphStoreRoot, join(root, "applied")),
      );
      const durable = await new LocalFileVersionedGraphStore(graphStoreRoot).load(result.graphId);

      assert.equal(durable?.bundle.account_objects.length, 1);
      assert.equal(durable?.bundle.audit_events[1]?.event_type, "claim.rejected");
      assert.equal(durable?.bundle.audit_events[1]?.payload_json.reason_code, "rejected_human_decision_1");
      assert.equal(result.retentionDecision.disposition, "reject");
      assert.equal(result.retentionDecision.externalCustodyCleanupRequired, true);
      assert.equal(result.retentionDecision.originalCustodyDeleted, false);
      assert.match(result.retentionDecision.outcome, /not-authorized-external-custody-cleanup-required/);
      assert.equal(durable?.bundle.audit_events[2]?.payload_json.external_custody_cleanup_required, true);
      assert.equal(durable?.bundle.audit_events[2]?.payload_json.original_custody_deleted, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reject-all is a durable terminal outcome with zero promoted account objects", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratification = ratificationFor(prepare, { decisionMode: "reject-all" });
      const ratificationFile = await writeRatification(join(root, "ratification", "human.json"), ratification);
      const graphStoreRoot = join(root, "graph-store");
      const outputDir = join(root, "applied");
      const result = await applyM5bRepositoryNative(
        applyOptions(preparedDir, ratificationFile, graphStoreRoot, outputDir),
      );
      const durable = await new LocalFileVersionedGraphStore(graphStoreRoot).load(result.graphId);

      assert.deepEqual(result.acceptedProposalIds, []);
      assert.equal(result.rejectedProposalIds.length, 2);
      assert.deepEqual(result.decisions, ratification.decisions);
      assert.equal(durable?.bundle.account_objects.length, 0);
      assert.equal(durable?.bundle.claims.length, 0);
      assert.equal(durable?.bundle.excerpts.length, 0);
      assert.equal(durable?.bundle.audit_events.length, 3);
      assert.ok(durable?.bundle.audit_events.slice(0, 2).every((event) => event.event_type === "claim.rejected"));
      const html = await readFile(join(outputDir, "workshop-final.html"), "utf8");
      assert.match(html, /No graph-backed intelligence yet/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("preflights a missing output parent before graph commit", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratificationFile = await writeRatification(
        join(root, "ratification", "human.json"),
        ratificationFor(prepare),
      );
      const graphStoreRoot = join(root, "graph-store");
      await assert.rejects(
        () => applyM5bRepositoryNative(applyOptions(
          preparedDir,
          ratificationFile,
          graphStoreRoot,
          join(root, "absent-parent", "applied"),
        )),
        (error) => assertRefusalCode(error, "output_parent_missing"),
      );
      await assert.rejects(() => stat(graphStoreRoot), /ENOENT/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("finalizes an exact existing rev_1 without a second graph write", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratificationFile = await writeRatification(
        join(root, "ratification", "human.json"),
        ratificationFor(prepare),
      );
      const graphStoreRoot = join(root, "graph-store");
      const outputDir = join(root, "applied");
      const first = await applyM5bRepositoryNative(
        applyOptions(preparedDir, ratificationFile, graphStoreRoot, outputDir),
      );
      const [graphFile] = await readdir(join(graphStoreRoot, "graphs"));
      const graphBytesBefore = await readFile(join(graphStoreRoot, "graphs", graphFile!));
      await rm(outputDir, { recursive: true });

      const recovered = await applyM5bRepositoryNative(
        applyOptions(preparedDir, ratificationFile, graphStoreRoot, outputDir),
      );
      const durable = await new LocalFileVersionedGraphStore(graphStoreRoot).load(first.graphId);

      assert.equal(recovered.graphCommitDisposition, "existing-exact-finalized-without-write");
      assert.equal(recovered.accounting.durableLocalGraphWrites, 0);
      assert.equal(recovered.accounting.durableLocalGraphReads, 1);
      assert.equal(durable?.revision, "rev_1");
      assert.deepEqual(await readFile(join(graphStoreRoot, "graphs", graphFile!)), graphBytesBefore);
      assert.equal((await stat(join(outputDir, "workshop-final.html"))).isFile(), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("recovers read-only from a final output publication failure after rev_1 commits", {
    concurrency: false,
  }, async () => {
    const root = scenarioRoot();
    const originalCommit = LocalFileVersionedGraphStore.prototype.commit;
    let commitCalls = 0;
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratificationFile = await writeRatification(
        join(root, "ratification", "human.json"),
        ratificationFor(prepare),
      );
      const graphStoreRoot = join(root, "graph-store");
      const outputDir = join(root, "applied");
      const options = applyOptions(preparedDir, ratificationFile, graphStoreRoot, outputDir);

      LocalFileVersionedGraphStore.prototype.commit = async function (
        this: LocalFileVersionedGraphStore,
        ...args: Parameters<typeof originalCommit>
      ) {
        commitCalls += 1;
        const committed = await originalCommit.call(this, ...args);
        await mkdir(outputDir, { mode: 0o700 });
        await writeFile(join(outputDir, "publication-blocker"), "block final rename\n", {
          flag: "wx",
          mode: 0o600,
        });
        return committed;
      };

      await assert.rejects(
        () => applyM5bRepositoryNative(options),
        (error: unknown) => {
          const code = (error as NodeJS.ErrnoException).code;
          assert.ok(code === "EEXIST" || code === "ENOTEMPTY");
          return true;
        },
      );
      assert.equal(commitCalls, 1);
      assert.equal(await readFile(join(outputDir, "publication-blocker"), "utf8"), "block final rename\n");
      await assert.rejects(() => stat(join(outputDir, "workshop-final.html")), /ENOENT/);

      const graphFiles = await readdir(join(graphStoreRoot, "graphs"));
      assert.equal(graphFiles.length, 1);
      const graphFilePath = join(graphStoreRoot, "graphs", graphFiles[0]!);
      const graphBytesAfterFailure = await readFile(graphFilePath);
      const durableAfterFailure = await new LocalFileVersionedGraphStore(graphStoreRoot).load(
        `accounts/acc_fedex_corp/m5b/${prepare.candidateContentSha256}`,
      );
      assert.equal(durableAfterFailure?.revision, "rev_1");

      await rm(outputDir, { recursive: true });
      const recovered = await applyM5bRepositoryNative(options);
      const durableAfterRecovery = await new LocalFileVersionedGraphStore(graphStoreRoot).load(recovered.graphId);

      assert.equal(commitCalls, 1);
      assert.equal(recovered.graphCommitDisposition, "existing-exact-finalized-without-write");
      assert.equal(recovered.accounting.durableLocalGraphWrites, 0);
      assert.equal(recovered.accounting.durableLocalGraphReads, 1);
      assert.deepEqual(durableAfterRecovery, durableAfterFailure);
      assert.deepEqual(await readFile(graphFilePath), graphBytesAfterFailure);
      assert.equal((await stat(join(outputDir, "workshop-final.html"))).isFile(), true);
    } finally {
      LocalFileVersionedGraphStore.prototype.commit = originalCommit;
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("refuses a differing bundle or ratification binding at an existing graph", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const firstRatification = await writeRatification(
        join(root, "ratification", "first.json"),
        ratificationFor(prepare, { decisionMode: "mixed" }),
      );
      const graphStoreRoot = join(root, "graph-store");
      await applyM5bRepositoryNative(
        applyOptions(preparedDir, firstRatification, graphStoreRoot, join(root, "first-output")),
      );
      const secondRatification = await writeRatification(
        join(root, "ratification", "second.json"),
        ratificationFor(prepare, { decisionMode: "mixed", ratifierId: "different_reviewer" }),
      );

      await assert.rejects(
        () => applyM5bRepositoryNative(
          applyOptions(preparedDir, secondRatification, graphStoreRoot, join(root, "second-output")),
        ),
        (error) => assertRefusalCode(error, "existing_graph_mismatch"),
      );
      const graphFiles = await import("node:fs/promises").then((fs) => fs.readdir(join(graphStoreRoot, "graphs")));
      assert.equal(graphFiles.length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("enforces raw ratification hash, owner, commit, and tree pins inside apply", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratificationFile = await writeRatification(
        join(root, "ratification", "human.json"),
        ratificationFor(prepare),
      );
      const base = applyOptions(preparedDir, ratificationFile, join(root, "graph-store"), join(root, "output"));
      const cases: Array<[Partial<M5bRepositoryNativeApplyOptions>, string]> = [
        [{ expectedRatificationSha256: "f".repeat(64) }, "ratification_raw_sha256"],
        [{ expectedOwnerAuthorizationId: "different_owner" }, "expected_owner_authorization"],
        [{ expectedExecutionCommit: "c".repeat(40) }, "expected_execution_commit"],
        [{ expectedExecutionTree: "d".repeat(40) }, "expected_execution_tree"],
      ];
      for (const [override, code] of cases) {
        await assert.rejects(
          () => applyM5bRepositoryNative({ ...base, ...override }),
          (error) => assertRefusalCode(error, code),
        );
      }
      await assert.rejects(
        () => applyM5bRepositoryNative({ ...base, expectedRatificationSha256: "bad" }),
        (error) => assertRefusalCode(error, "expected_ratification_sha256"),
      );
      await assert.rejects(() => stat(base.graphStoreRoot), /ENOENT/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("refuses source, prepared artifact, and internally rehashed ratification tampering", async () => {
    const sourceBytes = readFileSync(SOURCE);
    const wrongSourceRoot = scenarioRoot();
    try {
      await assert.rejects(() => prepareM5bRepositoryNative({
        sourcePath: SOURCE,
        outputDir: join(wrongSourceRoot, "prepared"),
        expectedSource: { kind: "committed-synthetic-fixture", sha256: "0".repeat(64), size: sourceBytes.byteLength },
        ownerAuthorizationId: OWNER_AUTHORIZATION,
        executionCommit: COMMIT,
        executionTree: TREE,
      }), (error) => assertRefusalCode(error, "source_identity_mismatch"));
    } finally {
      rmSync(wrongSourceRoot, { recursive: true, force: true });
    }

    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      await writeFile(join(preparedDir, "candidate.json"), "{}\n");
      const ratificationFile = await writeRatification(
        join(root, "ratification", "human.json"),
        ratificationFor(prepare),
      );
      await assert.rejects(
        () => applyM5bRepositoryNative(
          applyOptions(preparedDir, ratificationFile, join(root, "graph-store"), join(root, "output")),
        ),
        (error) => assertRefusalCode(error, "prepared_artifact_tamper"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    const ratificationRoot = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(ratificationRoot);
      const valid = ratificationFor(prepare);
      const { ratificationArtifactSha256: _old, ...content } = valid;
      const tamperedContent = { ...content, executionTree: "c".repeat(40) };
      const tampered = {
        ...tamperedContent,
        ratificationArtifactSha256: verifyM5bRepositoryNativeRatificationArtifactHash(tamperedContent),
      };
      const ratificationFile = await writeRatification(
        join(ratificationRoot, "ratification", "tampered.json"),
        tampered,
      );
      await assert.rejects(
        () => applyM5bRepositoryNative(
          applyOptions(preparedDir, ratificationFile, join(ratificationRoot, "graph-store"), join(ratificationRoot, "output")),
        ),
        (error) => assertRefusalCode(error, "ratification_binding"),
      );
    } finally {
      rmSync(ratificationRoot, { recursive: true, force: true });
    }
  });

  test("rejects nested apply locations across prepared, ratification, graph-store, and output", async () => {
    const cases: Array<(input: {
      root: string;
      preparedDir: string;
      ratificationFile: { path: string; rawSha256: string };
    }) => Promise<M5bRepositoryNativeApplyOptions>> = [
      async ({ root, preparedDir, ratificationFile }) => {
        const nested = join(preparedDir, "nested-ratification.json");
        await writeFile(nested, await readFile(ratificationFile.path));
        return applyOptions(preparedDir, { path: nested, rawSha256: ratificationFile.rawSha256 },
          join(root, "graph-store"), join(root, "output"));
      },
      async ({ root, preparedDir, ratificationFile }) =>
        applyOptions(preparedDir, ratificationFile, join(preparedDir, "graph-store"), join(root, "output")),
      async ({ root, preparedDir, ratificationFile }) =>
        applyOptions(preparedDir, ratificationFile, join(root, "graph-store"), join(preparedDir, "output")),
      async ({ root, preparedDir, ratificationFile }) => {
        const graph = dirname(ratificationFile.path);
        return applyOptions(preparedDir, ratificationFile, graph, join(root, "output"));
      },
      async ({ root, preparedDir, ratificationFile }) =>
        applyOptions(preparedDir, ratificationFile, join(root, "graph-store"), join(ratificationFile.path, "output")),
      async ({ root, preparedDir, ratificationFile }) => {
        const graph = join(root, "graph-store");
        await mkdir(graph);
        return applyOptions(preparedDir, ratificationFile, graph, join(graph, "output"));
      },
    ];

    for (const buildCase of cases) {
      const root = scenarioRoot();
      try {
        const { preparedDir, result: prepare } = await preparedScenario(root);
        const ratificationFile = await writeRatification(
          join(root, "ratification", "human.json"),
          ratificationFor(prepare),
        );
        const options = await buildCase({ root, preparedDir, ratificationFile });
        await assert.rejects(
          () => applyM5bRepositoryNative(options),
          (error) => error instanceof M5bRepositoryNativeRefusal,
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("rejects a prepare output nested through the source-file path", async () => {
    const root = scenarioRoot();
    try {
      const sourceBytes = readFileSync(SOURCE);
      await assert.rejects(
        () => prepareM5bRepositoryNative({
          sourcePath: SOURCE,
          outputDir: join(SOURCE, "nested-output"),
          expectedSource: {
            kind: "committed-synthetic-fixture",
            sha256: hash(sourceBytes),
            size: sourceBytes.byteLength,
          },
          ownerAuthorizationId: OWNER_AUTHORIZATION,
          executionCommit: COMMIT,
          executionTree: TREE,
        }),
        (error) => error instanceof M5bRepositoryNativeRefusal,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects symlink aliases for source, prepared, ratification, graph-store, and output components", async () => {
    const sourceRoot = scenarioRoot();
    try {
      const sourceAlias = join(sourceRoot, "source-alias.json");
      await symlink(SOURCE, sourceAlias);
      const sourceBytes = readFileSync(SOURCE);
      await assert.rejects(
        () => prepareM5bRepositoryNative({
          sourcePath: sourceAlias,
          outputDir: join(sourceRoot, "prepared"),
          expectedSource: {
            kind: "committed-synthetic-fixture",
            sha256: hash(sourceBytes),
            size: sourceBytes.byteLength,
          },
          ownerAuthorizationId: OWNER_AUTHORIZATION,
          executionCommit: COMMIT,
          executionTree: TREE,
        }),
        (error) => assertRefusalCode(error, "symlink_path"),
      );
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }

    for (const aliasKind of ["prepared", "ratification", "graph-store", "output-parent"] as const) {
      const root = scenarioRoot();
      try {
        const { preparedDir, result: prepare } = await preparedScenario(root);
        const ratificationFile = await writeRatification(
          join(root, "ratification", "human.json"),
          ratificationFor(prepare),
        );
        const graphStoreRoot = join(root, "graph-store");
        let options = applyOptions(preparedDir, ratificationFile, graphStoreRoot, join(root, "output"));
        if (aliasKind === "prepared") {
          const alias = join(root, "prepared-alias");
          await symlink(preparedDir, alias, "dir");
          options = { ...options, preparedDir: alias };
        } else if (aliasKind === "ratification") {
          const alias = join(root, "ratification-alias.json");
          await symlink(ratificationFile.path, alias);
          options = { ...options, ratificationPath: alias };
        } else if (aliasKind === "graph-store") {
          await mkdir(graphStoreRoot);
          const alias = join(root, "graph-store-alias");
          await symlink(graphStoreRoot, alias, "dir");
          options = { ...options, graphStoreRoot: alias };
        } else {
          const actualParent = join(root, "actual-output-parent");
          const aliasParent = join(root, "output-parent-alias");
          await mkdir(actualParent);
          await symlink(actualParent, aliasParent, "dir");
          options = { ...options, outputDir: join(aliasParent, "output") };
        }
        await assert.rejects(
          () => applyM5bRepositoryNative(options),
          (error) => assertRefusalCode(error, "symlink_path"),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("maps bound source kinds to exact positive and negative final provenance labels", () => {
    const vm = buildWorkshopViewModel(makeValidBundle());
    const production = renderWorkshopHtml(vm, {
      previewMode: m5bRepositoryNativePreviewModeForSourceKind("exact-production-custody"),
    });
    assert.match(production, /System-acquired public source/);
    assert.doesNotMatch(production, /Durable synthetic fixture/);

    const synthetic = renderWorkshopHtml(vm, {
      previewMode: m5bRepositoryNativePreviewModeForSourceKind("committed-synthetic-fixture"),
    });
    assert.match(synthetic, /Durable synthetic fixture/);
    assert.doesNotMatch(synthetic, /System-acquired public source/);
  });

  test("keeps the product surface repository-native and effect-closed", async () => {
    const source = await readFile(join(ROOT, "src/workshop/m5b-repository-native.ts"), "utf8");
    const cli = await readFile(join(ROOT, "src/cli/m5b-repository-native.ts"), "utf8");
    const barrel = await readFile(join(ROOT, "src/index.ts"), "utf8");
    for (const text of [source, cli]) {
      assert.doesNotMatch(text, /\/home\/|\.hermes|maintenance.?lock|worktree.?registry|gateway|kanban/i);
      assert.doesNotMatch(text, /\bfetch\s*\(|node:https|node:http|child_process|provider\.invoke|\bdeploy\s*\(/i);
    }
    assert.doesNotMatch(barrel, /m5b-repository-native|local-file-versioned-store/);
  });
});
