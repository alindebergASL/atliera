import assert from "node:assert/strict";
import { link, mkdtemp, mkdir, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { validatedCandidateSha256 } from "../../src/graph/candidate-delta.ts";
import { hydrateValidatedCandidate } from "../../src/graph/validated-candidate.ts";
import {
  M5B_PRODUCT_REVIEW_LIMITS,
  M5bProductReviewRefusal,
  m5bProductReviewCanonicalSha256,
} from "../../src/workshop/m5b-product-review-contract.ts";
import {
  M5B_PRODUCT_REVIEW_PACKET_VERSION,
  M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION,
} from "../../src/workshop/m5b-product-review-package.ts";
import {
  M5B_PRODUCT_REVIEW_PREPARE_RESULT_VERSION,
  prepareM5bProductReview,
  type M5bProductReviewPrepareOptions,
} from "../../src/workshop/m5b-product-review-prepare.ts";
import {
  SYNTHETIC_SOURCE_TEXTS,
  cloneSynthetic,
  createSyntheticM5bProductReviewScenario,
  sha256Fixture,
  writeSyntheticRequest,
  type SyntheticM5bProductReviewScenario,
} from "../fixtures/m5b-product-review-synthetic.ts";

const INVENTORY = [
  "candidate.json",
  "meeting-brief.md",
  "prepare-result.json",
  "review-packet.json",
  "sanitized-source-pack.json",
  "workshop-pre-ratification.html",
] as const;

function optionsFor(
  scenario: SyntheticM5bProductReviewScenario,
  overrides: Partial<M5bProductReviewPrepareOptions> = {},
): M5bProductReviewPrepareOptions {
  return {
    requestPath: scenario.requestPath,
    expectedRequestSha256: sha256Fixture(scenario.requestBytes),
    expectedRequestByteSize: scenario.requestBytes.byteLength,
    sourceFiles: scenario.sourceFiles,
    outputDir: scenario.outputDir,
    ...overrides,
  };
}

async function withScenario<T>(fn: (
  root: string,
  scenario: SyntheticM5bProductReviewScenario,
) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "atliera-product-prepare-"));
  try {
    return await fn(root, await createSyntheticM5bProductReviewScenario(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function refusalCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof M5bProductReviewRefusal);
    return error.code;
  }
  assert.fail("expected M5bProductReviewRefusal");
}

describe("M5b product-review preparation", () => {
  test("keeps package construction behind the prepare-only runtime boundary", async () => {
    const [packageModule, prepareModule, publicModule] = await Promise.all([
      import("../../src/workshop/m5b-product-review-package.ts"),
      import("../../src/workshop/m5b-product-review-prepare.ts"),
      import("../../src/index.ts"),
    ]);
    assert.equal(Object.hasOwn(packageModule, "buildM5bProductReviewPackageData"), false);
    assert.equal(Object.hasOwn(prepareModule, "buildM5bProductReviewPackageData"), false);
    assert.equal(Object.hasOwn(publicModule, "buildM5bProductReviewPackageData"), false);
    for (const renderer of ["renderM5bProductReviewMeetingBrief",
      "renderM5bProductReviewWorkshopHtml"]) {
      assert.equal(Object.hasOwn(prepareModule, renderer), false);
      assert.equal(Object.hasOwn(publicModule, renderer), false);
    }
    assert.equal(typeof publicModule.prepareM5bProductReview, "function");
  });

  test("atomically produces a deterministic complete current-schema package", async () => {
    await withScenario(async (root, scenario) => {
      const result = await prepareM5bProductReview(optionsFor(scenario));
      assert.equal(result.schemaVersion, M5B_PRODUCT_REVIEW_PREPARE_RESULT_VERSION);
      assert.deepEqual((await readdir(scenario.outputDir)).sort(), [...INVENTORY]);
      assert.equal(result.accounting.requestManifestReads, 1);
      assert.equal(result.accounting.evidenceSourceReads, 3);
      assert.equal(result.accounting.syntheticSourceReads, 3);
      assert.equal(result.accounting.retainedCustodyReads, 0);
      assert.equal(result.accounting.retainedCustodyReadAuthorityConsumptions, 0);
      assert.equal(result.accounting.outputFilesWritten, 6);
      for (const key of ["acquisitions", "networkCalls", "providerCalls", "databaseWrites", "graphWrites",
        "deployments", "outboundActions", "applyOperations", "retries"] as const) {
        assert.equal(result.accounting[key], 0);
      }
      assert.equal(result.authority.currentEffectiveAuthorization, "none");
      assert.equal(result.authority.ratificationStatus, "unratified");
      assert.equal(result.authority.armingStatus, "unarmed");
      assert.equal(result.authority.applyEligibility, false);
      assert.equal(result.packageBinding.requestRawSha256, sha256Fixture(scenario.requestBytes));
      assert.deepEqual(result.supersession, {
        preservesOldBytes: true,
        preservesOldProducerIdentity: true,
        rewritesHistoricalPackage: false,
      });

      assert.equal(result.artifacts.length, 5);
      for (const identity of result.artifacts) {
        const bytes = await readFile(join(scenario.outputDir, identity.name));
        assert.equal(bytes.byteLength, identity.byteSize);
        assert.equal(sha256Fixture(bytes), identity.sha256);
      }
      const onDiskResult = JSON.parse(await readFile(join(scenario.outputDir, "prepare-result.json"), "utf8"));
      assert.deepEqual(onDiskResult, result);
      const { resultSha256, ...resultContent } = onDiskResult;
      assert.equal(resultSha256, m5bProductReviewCanonicalSha256(resultContent));

      const sourcePack = JSON.parse(await readFile(join(scenario.outputDir, "sanitized-source-pack.json"), "utf8"));
      assert.equal(sourcePack.schemaVersion, M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION);
      assert.equal(sourcePack.contentPolicy.fullSourceBytesEmbedded, false);
      assert.equal(sourcePack.sources.length, 3);
      assert.equal(sourcePack.sources[1].evidenceCurrentThrough, null);
      assert.equal(sourcePack.sources[0].contentEncoding, "m4_public_http_fetch_custody_v1");
      assert.notEqual(sourcePack.sources[0].originContentSha256, sourcePack.sources[0].decodedContentSha256);
      assert.equal(sourcePack.sources[0].decodedByteSize, scenario.request.sources[0]!.decodedByteSize);
      assert.equal(sourcePack.sources[0].decodedContentSha256, scenario.request.sources[0]!.decodedSha256);
      assert.ok(sourcePack.sources.every((source: any) => /^[a-f0-9]{64}$/.test(source.originContentSha256)));
      assert.ok(sourcePack.sources.every((source: any) => /^[a-f0-9]{64}$/.test(source.decodedContentSha256)));
      assert.ok(sourcePack.sources.every((source: any) => /^[a-f0-9]{64}$/.test(source.storedContentSha256)));
      assert.ok(sourcePack.sources.every((source: any) => /^[a-f0-9]{64}$/.test(source.transformationManifestSha256)));
      assert.ok(sourcePack.sources.every((source: any) =>
        source.provenance.classification === "explicit_synthetic_fixture" &&
        source.provenance.targetPolicySha256 === null && source.provenance.authorityId === null));
      assert.deepEqual(sourcePack.sources.flatMap((source: any) => source.evidenceBindings)
        .map((binding: any) => [binding.evidenceId, binding.evidenceRole]),
      scenario.request.evidenceBindings.map((binding) => [binding.evidenceId, binding.evidenceRole]));
      assert.doesNotMatch(JSON.stringify(sourcePack), /localPath|citrine-launch\.html/);

      const candidateRaw = JSON.parse(await readFile(join(scenario.outputDir, "candidate.json"), "utf8"));
      const candidate = hydrateValidatedCandidate(candidateRaw);
      assert.equal(validatedCandidateSha256(candidate), result.candidateSha256);
      assert.equal(candidate.graph_bundle.sources.length, 3);
      assert.equal(candidate.graph_bundle.account_objects.filter((item) => item.object_type === "signal").length, 1);
      assert.equal(candidate.graph_bundle.account_objects.filter((item) => item.object_type === "account_snapshot").length, 3);
      assert.equal(candidate.graph_bundle.account_objects.filter((item) => item.object_type === "play").length, 1);
      assert.ok(candidate.graph_bundle.excerpts.every((item) => item.validation_status === "proposed"));
      assert.ok(candidate.graph_bundle.claims.every((item) => item.provenance_status === "unverified" &&
        item.created_by === "system" && item.confidence !== "high"));
      assert.ok(candidate.graph_bundle.account_objects.every((item) => item.provenance_status === "unverified" &&
        item.created_by === "system" && item.payload_json.durable === false &&
        Array.isArray(item.payload_json.evidence_roles) &&
        (item.payload_json.authority as any).currentEffectiveAuthorization === "none" &&
        (item.payload_json.authority as any).applyEligibility === false));
      for (const [index, item] of candidate.graph_bundle.account_objects.entries()) {
        const proposal = scenario.request.proposals[index]!;
        assert.deepEqual(item.payload_json.evidence_roles, proposal.evidenceBindingIds.map((evidenceId) => ({
          evidence_id: evidenceId,
          evidence_role: scenario.request.evidenceBindings.find((binding) =>
            binding.evidenceId === evidenceId)!.evidenceRole,
        })));
      }
      for (const excerpt of candidate.graph_bundle.excerpts) {
        const source = candidate.graph_bundle.sources.find((item) => item.id === excerpt.source_document_id)!;
        assert.equal(source.raw_text.slice(excerpt.char_start, excerpt.char_end), excerpt.text);
      }
      const candidateText = JSON.stringify(candidate);
      assert.doesNotMatch(candidateText, /This page and company are synthetic test material/);
      assert.doesNotMatch(candidateText, /Synthetic JSON evidence for tests only/);
      assert.doesNotMatch(candidateText, /Fictional research note for Citrine Works/);

      const packet = JSON.parse(await readFile(join(scenario.outputDir, "review-packet.json"), "utf8"));
      assert.equal(packet.schemaVersion, M5B_PRODUCT_REVIEW_PACKET_VERSION);
      assert.equal(packet.sourcePackSha256, result.sourcePackSha256);
      assert.equal(packet.candidateSha256, result.candidateSha256);
      assert.deepEqual(packet.customerQuestions.map((item: any) => item.answer),
        [scenario.request.customerQuestions.whoIsThisAccount,
          scenario.request.customerQuestions.whatMeaningfullyChanged,
          scenario.request.customerQuestions.whyDoesItMatter,
          scenario.request.customerQuestions.whatNeedsAttention,
          scenario.request.customerQuestions.safeNextTask]);
      assert.deepEqual(packet.customerQuestions.find((item: any) =>
        item.question === "What meaningfully changed?").evidenceBindingIds,
      scenario.request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds);
      assert.ok(packet.proposals.some((proposal: any) => proposal.lens === "signal" &&
        proposal.classification === "source_fact" && proposal.title.includes("Citrine Works")));
      assert.ok(packet.proposals.some((proposal: any) => proposal.lens === "map" &&
        proposal.classification === "analysis" && proposal.summary.includes("exception handling")));
      assert.ok(packet.proposals.some((proposal: any) => proposal.lens === "play" &&
        proposal.classification === "recommendation" && proposal.summary.includes("exception workflows")));
      assert.ok(packet.proposals.every((proposal: any) => proposal.status === "pending"));
      assert.ok(packet.proposals.some((proposal: any) => proposal.classification === "source_fact" &&
        proposal.lens === "signal" && proposal.evidenceBindings.every((binding: any) =>
          binding.evidenceRole === "material_change")));
      assert.ok(packet.proposals.every((proposal: any) =>
        JSON.stringify(proposal.allowedLocalDispositions) === JSON.stringify(["accept", "reject"])));
      assert.ok(packet.proposals.every((proposal: any) => proposal.trust.independentlyVerified === false &&
        proposal.trust.humanRatified === false && proposal.trust.qualityPassed === false &&
        proposal.trust.proposed === true && proposal.trust.durable === false));
      assert.equal(Object.hasOwn(packet.proposals[0], "localSelection"), false);

      const secondOutput = join(root, "prepared-product-review-again");
      await prepareM5bProductReview(optionsFor(scenario, { outputDir: secondOutput }));
      for (const name of INVENTORY) {
        assert.deepEqual(await readFile(join(secondOutput, name)), await readFile(join(scenario.outputDir, name)));
      }
    });
  });

  test("binds evidence roles into transformation, candidate, packet, and result identities", async () => {
    await withScenario(async (root, scenario) => {
      const baselineResult = await prepareM5bProductReview(optionsFor(scenario));
      const baselinePack = JSON.parse(await readFile(
        join(scenario.outputDir, "sanitized-source-pack.json"), "utf8"));

      const changedRequest: any = cloneSynthetic(scenario.request);
      changedRequest.evidenceBindings[1].evidenceRole = "account_identity";
      const changed = await writeSyntheticRequest(root, "role-changed-request.json", changedRequest);
      const changedOutput = join(root, "role-changed-output");
      const changedResult = await prepareM5bProductReview(optionsFor(scenario, {
        requestPath: changed.path,
        expectedRequestSha256: changed.sha256,
        expectedRequestByteSize: changed.bytes.byteLength,
        outputDir: changedOutput,
      }));
      const changedPack = JSON.parse(await readFile(
        join(changedOutput, "sanitized-source-pack.json"), "utf8"));

      assert.equal(baselinePack.sources[1].storedContentSha256,
        changedPack.sources[1].storedContentSha256);
      assert.notEqual(baselinePack.sources[1].transformationManifestSha256,
        changedPack.sources[1].transformationManifestSha256);
      assert.notEqual(baselineResult.sourcePackSha256, changedResult.sourcePackSha256);
      assert.notEqual(baselineResult.candidateSha256, changedResult.candidateSha256);
      assert.notEqual(baselineResult.reviewPacketSha256, changedResult.reviewPacketSha256);
      assert.notEqual(baselineResult.resultSha256, changedResult.resultSha256);
    });
  });

  test("rejects request and source byte tampering before publication", async () => {
    await withScenario(async (_root, scenario) => {
      const requestTamper = Buffer.from(scenario.requestBytes);
      const position = requestTamper.indexOf("Citrine");
      requestTamper[position + 5] = "X".charCodeAt(0);
      await writeFile(scenario.requestPath, requestTamper);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario))), "request_identity_mismatch");
      await assert.rejects(() => readdir(scenario.outputDir), /ENOENT/);
    });

    await withScenario(async (_root, scenario) => {
      const sourcePath = scenario.sourceFiles[0]!.path;
      const sourceTamper = Buffer.from(await readFile(sourcePath));
      sourceTamper[10] = sourceTamper[10] === 65 ? 66 : 65;
      await writeFile(sourcePath, sourceTamper);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario))), "source_identity_mismatch");
      await assert.rejects(() => readdir(scenario.outputDir), /ENOENT/);
    });

    await withScenario(async (_root, scenario) => {
      await writeFile(scenario.sourceFiles[1]!.path, "extra", { flag: "a" });
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario))), "source_size");
      await assert.rejects(() => readdir(scenario.outputDir), /ENOENT/);
    });

    await withScenario(async (root, scenario) => {
      const request: any = cloneSynthetic(scenario.request);
      request.sources[0].decodedSha256 = "0".repeat(64);
      const written = await writeSyntheticRequest(root, "wrong-decoded-identity-request.json", request);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
      }))), "custody_binding");
      await assert.rejects(() => readdir(scenario.outputDir), /ENOENT/);
    });

    await withScenario(async (root, scenario) => {
      const sourcePath = scenario.sourceFiles[0]!.path;
      const envelope = JSON.parse(await readFile(sourcePath, "utf8"));
      envelope.acquisition.quotedBodyText += "tampered";
      const outerBytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, "utf8");
      await writeFile(sourcePath, outerBytes);
      const request: any = cloneSynthetic(scenario.request);
      request.sources[0].expectedByteSize = outerBytes.byteLength;
      request.sources[0].rawSha256 = sha256Fixture(outerBytes);
      const written = await writeSyntheticRequest(root, "wrong-quoted-text-request.json", request);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
      }))), "custody_quoted_text");
      await assert.rejects(() => readdir(scenario.outputDir), /ENOENT/);
    });

    await withScenario(async (root, scenario) => {
      const sourcePath = scenario.sourceFiles[0]!.path;
      const envelope = JSON.parse(await readFile(sourcePath, "utf8"));
      envelope.unexpectedCallerField = "must not be ignored";
      const outerBytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, "utf8");
      await writeFile(sourcePath, outerBytes);
      const request: any = cloneSynthetic(scenario.request);
      request.sources[0].expectedByteSize = outerBytes.byteLength;
      request.sources[0].rawSha256 = sha256Fixture(outerBytes);
      const written = await writeSyntheticRequest(root, "unknown-custody-field-request.json", request);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
      }))), "custody_shape");
      await assert.rejects(() => readdir(scenario.outputDir), /ENOENT/);
    });
  });

  test("rejects invalid UTF-8, ambiguous evidence, and budget excess", async () => {
    await withScenario(async (root, scenario) => {
      const invalidRequest = Buffer.from([0xff, 0xfe, 0xfd, 0x0a]);
      const invalidRequestPath = join(root, "invalid-request.json");
      await writeFile(invalidRequestPath, invalidRequest, { flag: "wx" });
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: invalidRequestPath,
        expectedRequestSha256: sha256Fixture(invalidRequest),
        expectedRequestByteSize: invalidRequest.byteLength,
      }))), "request_utf8");
    });

    await withScenario(async (root, scenario) => {
      const duplicated = Buffer.from(scenario.requestBytes.toString("utf8").replace(
        '"kind": "m5b-product-review-request",',
        '"kind": "m5b-product-review-request",\n  "kind": "m5b-product-review-request",',
      ));
      const duplicatePath = join(root, "duplicate-key-request.json");
      await writeFile(duplicatePath, duplicated, { flag: "wx" });
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: duplicatePath,
        expectedRequestSha256: sha256Fixture(duplicated),
        expectedRequestByteSize: duplicated.byteLength,
      }))), "request_duplicate_key");
    });

    await withScenario(async (root, scenario) => {
      const invalidBytes = Buffer.from([0xff, 0xfe, 0xfd, 0x0a]);
      await writeFile(scenario.sourceFiles[1]!.path, invalidBytes);
      const request: any = cloneSynthetic(scenario.request);
      request.sources[1].expectedByteSize = invalidBytes.byteLength;
      request.sources[1].rawSha256 = sha256Fixture(invalidBytes);
      request.sources[1].decodedByteSize = invalidBytes.byteLength;
      request.sources[1].decodedSha256 = sha256Fixture(invalidBytes);
      const written = await writeSyntheticRequest(root, "invalid-utf8-request.json", request);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
      }))), "source_utf8");
    });

    await withScenario(async (root, scenario) => {
      const source = scenario.request.sources[1]!;
      const repeated = Buffer.from(`${SYNTHETIC_SOURCE_TEXTS.pilot}${scenario.request.evidenceBindings[1]!.exactQuote}\n`);
      await writeFile(source.localPath, repeated);
      const request: any = cloneSynthetic(scenario.request);
      request.sources[1].expectedByteSize = repeated.byteLength;
      request.sources[1].rawSha256 = sha256Fixture(repeated);
      request.sources[1].decodedByteSize = repeated.byteLength;
      request.sources[1].decodedSha256 = sha256Fixture(repeated);
      const written = await writeSyntheticRequest(root, "ambiguous-request.json", request);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
      }))), "evidence_ambiguous");
      await assert.rejects(() => readdir(scenario.outputDir), /ENOENT/);
    });

    await withScenario(async (root, scenario) => {
      const exactOnly = Buffer.from(scenario.request.evidenceBindings[2]!.exactQuote, "utf8");
      await writeFile(scenario.sourceFiles[2]!.path, exactOnly);
      const request: any = cloneSynthetic(scenario.request);
      request.sources[2].expectedByteSize = exactOnly.byteLength;
      request.sources[2].rawSha256 = sha256Fixture(exactOnly);
      request.sources[2].decodedByteSize = exactOnly.byteLength;
      request.sources[2].decodedSha256 = sha256Fixture(exactOnly);
      const written = await writeSyntheticRequest(root, "full-source-excerpt-request.json", request);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
      }))), "full_source_embedding");
    });

    await withScenario(async (_root, scenario) => {
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        expectedRequestByteSize: M5B_PRODUCT_REVIEW_LIMITS.requestBytes + 1,
      }))), "request_identity");
    });

    await withScenario(async (root, scenario) => {
      const request: any = cloneSynthetic(scenario.request);
      request.sources[0].expectedByteSize = M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach + 1;
      const written = await writeSyntheticRequest(root, "oversize-source-request.json", request);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
      }))), "source_identity");
    });
  });

  test("rejects hostile options, duplicate/overlapping paths, symlinks, missing parents, and destinations", async () => {
    await withScenario(async (root, scenario) => {
      let trapCalls = 0;
      const hostile = new Proxy(optionsFor(scenario), {
        ownKeys() {
          trapCalls += 1;
          throw new Error("must not execute");
        },
      });
      assert.equal(await refusalCode(prepareM5bProductReview(hostile)), "prepare_options_plain_data");
      assert.equal(trapCalls, 0);

      const duplicatePaths: any = cloneSynthetic(optionsFor(scenario));
      duplicatePaths.sourceFiles[1].path = duplicatePaths.sourceFiles[0].path;
      assert.equal(await refusalCode(prepareM5bProductReview(duplicatePaths)), "duplicate_source_binding");

      const linkedSource = join(root, "linked-source.html");
      await symlink(scenario.sourceFiles[0]!.path, linkedSource);
      const linkedRequest: any = cloneSynthetic(scenario.request);
      linkedRequest.sources[0].localPath = linkedSource;
      const written = await writeSyntheticRequest(root, "linked-request.json", linkedRequest);
      const linkedBindings: any = cloneSynthetic(scenario.sourceFiles);
      linkedBindings[0].path = linkedSource;
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
        sourceFiles: linkedBindings,
      }))), "symlink_path");

      const hardlinkedSource = join(root, "hardlinked-source.html");
      await link(scenario.sourceFiles[0]!.path, hardlinkedSource);
      const hardlinkRequest: any = cloneSynthetic(scenario.request);
      hardlinkRequest.sources[0].localPath = hardlinkedSource;
      const hardlinkWritten = await writeSyntheticRequest(root, "hardlink-request.json", hardlinkRequest);
      const hardlinkBindings: any = cloneSynthetic(scenario.sourceFiles);
      hardlinkBindings[0].path = hardlinkedSource;
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        requestPath: hardlinkWritten.path,
        expectedRequestSha256: hardlinkWritten.sha256,
        expectedRequestByteSize: hardlinkWritten.bytes.byteLength,
        sourceFiles: hardlinkBindings,
      }))), "hardlink_path");
      await unlink(hardlinkedSource);

      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario, {
        outputDir: join(root, "missing", "prepared"),
      }))), "output_parent_missing");

      await mkdir(scenario.outputDir);
      assert.equal(await refusalCode(prepareM5bProductReview(optionsFor(scenario))), "output_exists");
    });
  });
});
