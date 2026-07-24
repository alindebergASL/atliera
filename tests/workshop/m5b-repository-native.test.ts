import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { LocalFileVersionedGraphStore } from "../../src/graph/local-file-versioned-store.ts";
import {
  assertProductionWriteAllowed,
  assertProviderAllowed,
  isSafeMode,
  ModelModeNotActivatedError,
} from "../../src/modes/index.ts";
import {
  M5B_REPOSITORY_NATIVE_RATIFICATION_KIND,
  M5bRepositoryNativeRefusal,
  applyM5bRepositoryNative,
  prepareM5bRepositoryNative,
  verifyM5bRepositoryNativeRatificationArtifactHash,
  type M5bRepositoryNativeRatification,
  type M5bRepositoryNativeRatificationContent,
} from "../../src/workshop/m5b-repository-native.ts";

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

function ratificationFor(prepare: Awaited<ReturnType<typeof prepareM5bRepositoryNative>>): M5bRepositoryNativeRatification {
  const fixture = JSON.parse(readFileSync(RATIFICATION_FIXTURE, "utf8")) as {
    ratifierId: string;
    ratifiedAt: string;
    retentionDisposition: "accept" | "reject";
    decisions: Array<{ proposalId: string; disposition: "accept" | "reject"; reasonCode: string }>;
  };
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
    ratifierId: fixture.ratifierId,
    ratifiedAt: fixture.ratifiedAt,
    retentionDisposition: fixture.retentionDisposition,
    decisions: fixture.decisions,
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

async function writeRatification(root: string, ratification: M5bRepositoryNativeRatification): Promise<string> {
  const path = join(root, "human-ratification.json");
  await writeFile(path, `${JSON.stringify(ratification, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return path;
}

function assertRefusalCode(error: unknown, code: string): boolean {
  if (!(error instanceof M5bRepositoryNativeRefusal)) return false;
  assert.equal(error.code, code);
  return true;
}

describe("M5b repository-native product completion", () => {
  test("prepares exact explicit input and writes only the inspectable pre-ratification surface", async () => {
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
      assert.equal(statSync(join(preparedDir, "prepare-result.json")).isFile(), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("applies one externally bound ratification, reads durable state back, and renders final Workshop", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratification = ratificationFor(prepare);
      const ratificationPath = await writeRatification(root, ratification);
      const graphStoreRoot = join(root, "graph-store");
      const outputDir = join(root, "applied");
      const result = await applyM5bRepositoryNative({ preparedDir, ratificationPath, graphStoreRoot, outputDir });
      assert.equal(result.revision, "rev_1");
      assert.equal(result.durableBundleSha256, result.readBackBundleSha256);
      assert.deepEqual(result.acceptedProposalIds,
        ratification.decisions.filter((item) => item.disposition === "accept").map((item) => item.proposalId));
      assert.deepEqual(result.rejectedProposalIds,
        ratification.decisions.filter((item) => item.disposition === "reject").map((item) => item.proposalId));
      assert.deepEqual(result.accounting, {
        explicitPreparedArtifactReads: 5,
        explicitRatificationReads: 1,
        durableLocalGraphReads: 3,
        durableLocalGraphWrites: 1,
        durableLocalGraphReadBacks: 1,
        workshopPagesRendered: 1,
        outputFilesWritten: 2,
        providerCalls: 0,
        acquisitions: 0,
        networkCalls: 0,
        deployments: 0,
        retries: 0,
      });
      const store = new LocalFileVersionedGraphStore(graphStoreRoot);
      const durable = await store.load(result.graphId);
      if (!durable) throw new Error("durable graph read-back missing");
      assert.equal(durable.revision, "rev_1");
      assert.equal(durable.bundle.audit_events.length, ratification.decisions.length);
      assert.equal(durable.bundle.account_objects.length, 1);
      assert.deepEqual(durable.bundle.audit_events.map((event) => event.event_type),
        ["claim.ratified", "claim.rejected"]);
      assert.equal(durable.bundle.audit_events[1]?.payload_json.reason_code,
        "synthetic_fixture_rejection_proof");
      assert.ok(durable.bundle.excerpts.every((item) => item.validation_status === "accepted"));
      assert.ok(durable.bundle.claims.every((item) => item.provenance_status === "source_document_only"));
      assert.ok(durable.bundle.account_objects.every((item) => item.provenance_status === "source_document_only"));
      const html = readFileSync(join(outputDir, "workshop-final.html"), "utf8");
      assert.match(html, /Durable system-acquired preview \(local graph\)/);
      assert.match(html, /System-acquired public source/);
      assert.match(html, /SEC registrant identity/);
      assert.doesNotMatch(html, /SEC industry classification/);
      assert.doesNotMatch(html, /pending human review/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("refuses exact replay without a second graph revision or output", async () => {
    const root = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(root);
      const ratificationPath = await writeRatification(root, ratificationFor(prepare));
      const graphStoreRoot = join(root, "graph-store");
      const first = await applyM5bRepositoryNative({
        preparedDir, ratificationPath, graphStoreRoot, outputDir: join(root, "applied-first"),
      });
      await assert.rejects(() => applyM5bRepositoryNative({
        preparedDir, ratificationPath, graphStoreRoot, outputDir: join(root, "applied-replay"),
      }), (error) => assertRefusalCode(error, "apply_replay"));
      const durable = await new LocalFileVersionedGraphStore(graphStoreRoot).load(first.graphId);
      assert.equal(durable?.revision, "rev_1");
      await assert.rejects(() => stat(join(root, "applied-replay")), /ENOENT/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("refuses source, prepared-artifact, and ratification tampering before durable state", async () => {
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

    const preparedTamperRoot = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(preparedTamperRoot);
      await writeFile(join(preparedDir, "candidate.json"), "{}\n");
      const ratificationPath = await writeRatification(preparedTamperRoot, ratificationFor(prepare));
      await assert.rejects(() => applyM5bRepositoryNative({
        preparedDir,
        ratificationPath,
        graphStoreRoot: join(preparedTamperRoot, "graph-store"),
        outputDir: join(preparedTamperRoot, "applied"),
      }), (error) => assertRefusalCode(error, "prepared_artifact_tamper"));
      await assert.rejects(() => stat(join(preparedTamperRoot, "graph-store")), /ENOENT/);
    } finally {
      rmSync(preparedTamperRoot, { recursive: true, force: true });
    }

    const ratificationTamperRoot = scenarioRoot();
    try {
      const { preparedDir, result: prepare } = await preparedScenario(ratificationTamperRoot);
      const valid = ratificationFor(prepare);
      const validRatificationPath = await writeRatification(ratificationTamperRoot, valid);
      await assert.rejects(() => applyM5bRepositoryNative({
        preparedDir,
        ratificationPath: validRatificationPath,
        graphStoreRoot: preparedDir,
        outputDir: join(ratificationTamperRoot, "overlap-output"),
      }), (error: unknown) => assertRefusalCode(error, "explicit_path_overlap"));
      const { ratificationArtifactSha256: _old, ...content } = valid;
      const tamperedContent = { ...content, executionTree: "c".repeat(40) };
      const tampered = { ...tamperedContent,
        ratificationArtifactSha256: verifyM5bRepositoryNativeRatificationArtifactHash(tamperedContent) };
      const ratificationPath = join(ratificationTamperRoot, "tampered-ratification.json");
      writeFileSync(ratificationPath, `${JSON.stringify(tampered, null, 2)}\n`);
      await assert.rejects(() => applyM5bRepositoryNative({
        preparedDir,
        ratificationPath,
        graphStoreRoot: join(ratificationTamperRoot, "graph-store"),
        outputDir: join(ratificationTamperRoot, "applied"),
      }), (error) => assertRefusalCode(error, "ratification_binding"));
      await assert.rejects(() => stat(join(ratificationTamperRoot, "graph-store")), /ENOENT/);
    } finally {
      rmSync(ratificationTamperRoot, { recursive: true, force: true });
    }
  });

  test("keeps the product surface repository-native and effect-closed", async () => {
    assert.equal(isSafeMode("local-product"), false);
    assert.doesNotThrow(() => assertProductionWriteAllowed("local-product"));
    assert.throws(() => assertProviderAllowed("local-product"), ModelModeNotActivatedError);
    const source = await readFile(join(ROOT, "src/workshop/m5b-repository-native.ts"), "utf8");
    const cli = await readFile(join(ROOT, "src/cli/m5b-repository-native.ts"), "utf8");
    for (const text of [source, cli]) {
      assert.doesNotMatch(text, /\/home\/|\.hermes|maintenance.?lock|worktree.?registry|gateway|kanban/i);
      assert.doesNotMatch(text, /\bfetch\s*\(|node:https|node:http|child_process|provider\.invoke|\bdeploy\s*\(/i);
    }
    assert.match(cli, /missing required argument/);
    assert.match(source, /LocalFileVersionedGraphStore/);
    assert.match(source, /renderWorkshopHtml/);
  });
});
