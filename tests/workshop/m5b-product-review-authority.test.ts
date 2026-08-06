import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  claimM5bProductEffectAttempt,
  createM5bProductEffectAttempt,
  createM5bProductEffectLedger,
  type M5bProductEffectConsumption,
  type M5bProductEffectExpectedAuthority,
  type M5bProductEffectLedger,
} from "../../src/authority/m5b-product-effect-authority.ts";
import {
  createExactSecArchiveTargetPolicy,
  exactSecArchiveTargetPolicySha256,
  type ExactSecArchiveTargetPolicy,
} from "../../src/capability/exact-sec-archive-target-policy.ts";
import {
  M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID,
  M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256,
  M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID,
  M5B_EXACT_SEC_ARCHIVE_SOURCE_ID,
} from "../../src/capability/m4-sec-live-adapter.ts";
import { admitM4CustodyEnvelopeBytes } from "../../src/capability/m4-custody-envelope-admission.ts";
import { getH2CapabilityRegistryEntry, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID } from "../../src/capability/h2-registry.ts";
import {
  M4_CANONICAL_TARGET_POLICY,
  M4_TARGET_POLICY_REF,
  M4_TARGET_POLICY_SHA256,
} from "../../src/capability/m4-target-policy.ts";
import { M5bProductReviewRefusal } from "../../src/workshop/m5b-product-review-contract.ts";
import {
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

const SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY = createExactSecArchiveTargetPolicy({
  targetRef: "synthetic_sec_archive_primary_document",
  cik: "1048911",
  accessionWithoutDashes: "000110465926082672",
  primaryDocument: "tm2620197d1_8k.htm",
});
const SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY_SHA256 =
  exactSecArchiveTargetPolicySha256(SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY);

function exactCustody(
  body: Buffer,
  activation: Readonly<M5bProductEffectConsumption>,
  acquiredAt = "2026-08-06T01:00:01.000Z",
  targetPolicy: Readonly<ExactSecArchiveTargetPolicy> = SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY,
) {
  const responseSha256 = sha256Fixture(body);
  const targetPolicySha256 = exactSecArchiveTargetPolicySha256(targetPolicy);
  assert.equal(activation.operation, "exact_sec_archive_acquisition");
  assert.equal(activation.targetPolicySha256, targetPolicySha256);
  return {
    kind: "m5b-exact-sec-archive-custody",
    schemaVersion: "1",
    targetPolicy,
    targetPolicySha256,
    adapter: {
      capabilityId: M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID,
      adapterId: M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID,
      adapterSha256: M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256,
    },
    activation,
    acquiredAt,
    acquisition: {
      requestedTargetRef: targetPolicy.targetRef,
      requestedUrl: targetPolicy.url,
      finalUrl: targetPolicy.url,
      sourceHost: targetPolicy.hostname,
      publisher: targetPolicy.publisher,
      method: "GET",
      httpStatus: 200,
      contentType: "text/html",
      contentEncoding: "identity",
      byteCount: body.byteLength,
      responseSha256,
      bodyBase64: body.toString("base64"),
      quotedBodyText: body.toString("utf8"),
      custody: {
        exactBytesPreserved: true,
        exactBytesEncoding: "base64",
        hashAlgorithm: "sha256",
        classification: "untrusted_public_source",
      },
    },
    trust: targetPolicy.contentTrust,
    effectAccounting: {
      dnsAttempts: 1,
      requestAttempts: 1,
      connectionAttempts: 1,
      lookupCallbacks: 1,
      redirects: 0,
      retries: 0,
      networkRequests: 1,
      bytesReceived: body.byteLength,
      responseSha256,
      selectedAddress: "8.8.8.8",
      connectedAddress: "8.8.8.8",
      publicAddressValidated: true,
      pinnedConnectionMatched: true,
    },
  };
}

async function exactAcquisitionLedger(
  root: string,
  targetPolicy: Readonly<ExactSecArchiveTargetPolicy>,
): Promise<{
  readonly ledger: Readonly<M5bProductEffectLedger>;
  readonly consumption: Readonly<M5bProductEffectConsumption>;
}> {
  const ledgerRoot = join(root, "exact-archive-acquisition-ledger");
  await mkdir(ledgerRoot, { mode: 0o700 });
  const ledger = createM5bProductEffectLedger(ledgerRoot);
  const targetPolicySha256 = exactSecArchiveTargetPolicySha256(targetPolicy);
  const expected: M5bProductEffectExpectedAuthority = {
    operation: "exact_sec_archive_acquisition",
    authorityId: "auth_exact_archive_fixture_001",
    consumptionId: "consume_exact_archive_fixture_001",
    ledgerRootSha256: ledger.ledgerRootSha256,
    implementationCommit: "1".repeat(40),
    implementationTree: "2".repeat(40),
    targetPolicySha256,
    sourceIdentities: [{
      sourceId: M5B_EXACT_SEC_ARCHIVE_SOURCE_ID,
      canonicalUrl: targetPolicy.url,
      targetPolicySha256,
      outerSha256: null,
      outerByteSize: null,
      decodedSha256: null,
      decodedByteSize: null,
    }],
  };
  const go = {
    kind: "m5b-product-effect-one-shot-go",
    schemaVersion: "1",
    operation: expected.operation,
    authorityId: expected.authorityId,
    consumptionId: expected.consumptionId,
    ledgerRootSha256: expected.ledgerRootSha256,
    implementation: { commit: expected.implementationCommit, tree: expected.implementationTree },
    targetPolicySha256: expected.targetPolicySha256,
    sourceIdentities: expected.sourceIdentities,
    authorizedAt: "2026-08-06T00:00:00.000Z",
    validFrom: "2026-08-06T00:00:00.000Z",
    validUntil: "2026-08-07T00:00:00.000Z",
    armingStatus: "armed",
    authorizesEffect: true,
    effectBudget: { retainedCustodyReads: 0, dnsAttempts: 1, networkRequests: 1, redirects: 0, retries: 0 },
  };
  const attempt = createM5bProductEffectAttempt(go, ledger, expected, new Date("2026-08-06T00:30:00.000Z"));
  const consumption = claimM5bProductEffectAttempt(
    attempt, "exact_sec_archive_acquisition", new Date("2026-08-06T01:00:00.000Z"));
  return { ledger, consumption };
}

async function exactArchiveScenario(
  root: string,
  targetPolicy: Readonly<ExactSecArchiveTargetPolicy> = SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY,
) {
  const scenario = await createSyntheticM5bProductReviewScenario(root);
  const request: any = cloneSynthetic(scenario.request);
  const body = Buffer.from(SYNTHETIC_SOURCE_TEXTS.launch, "utf8");
  const acquisition = await exactAcquisitionLedger(root, targetPolicy);
  const custody = exactCustody(body, acquisition.consumption, undefined, targetPolicy);
  const custodyBytes = Buffer.from(`${JSON.stringify(custody, null, 2)}\n`, "utf8");
  await writeFile(scenario.sourceFiles[0]!.path, custodyBytes);
  Object.assign(request.sources[0], {
    sourceKind: "exact_public_acquisition_custody",
    contentEncoding: "exact_sec_archive_custody_v1",
    expectedByteSize: custodyBytes.byteLength,
    rawSha256: sha256Fixture(custodyBytes),
    decodedByteSize: body.byteLength,
    decodedSha256: sha256Fixture(body),
    canonicalUrl: targetPolicy.url,
    acquiredAt: custody.acquiredAt,
    publisher: targetPolicy.publisher,
    sourceType: "sec_archive_primary_document",
  });
  const written = await writeSyntheticRequest(root, "production-product-request.json", request);
  const options: M5bProductReviewPrepareOptions = {
    requestPath: written.path,
    expectedRequestSha256: written.sha256,
    expectedRequestByteSize: written.bytes.byteLength,
    sourceFiles: scenario.sourceFiles,
    outputDir: scenario.outputDir,
  };
  return { scenario, request, body, custody, custodyBytes, acquisitionLedger: acquisition.ledger, options };
}

function m4Custody(body: Buffer, acquiredAt = "2026-07-17T10:00:00.000Z") {
  const responseSha256 = sha256Fixture(body);
  const executionId = "capexec_sanitized_m4_product_review";
  const descriptorSha256 = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID).descriptorSha256;
  const acquisition = {
    requestedTargetRef: M4_CANONICAL_TARGET_POLICY.targetRef,
    requestedUrl: M4_CANONICAL_TARGET_POLICY.url,
    finalUrl: M4_CANONICAL_TARGET_POLICY.url,
    sourceHost: M4_CANONICAL_TARGET_POLICY.hostname,
    publisher: M4_CANONICAL_TARGET_POLICY.publisher,
    targetPolicySha256: M4_TARGET_POLICY_SHA256,
    fetchedAt: acquiredAt,
    httpStatus: 200,
    contentType: "application/json",
    byteCount: body.byteLength,
    responseSha256,
    bodyBase64: body.toString("base64"),
    quotedBodyText: body.toString("utf8"),
    trust: M4_CANONICAL_TARGET_POLICY.contentTrust,
    provenance: {
      acquisitionCapability: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      transport: "live_sec_one_shot",
      targetPolicyRef: M4_TARGET_POLICY_REF,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      resolvedAddresses: ["8.8.8.8"],
      connectedAddress: "8.8.8.8",
    },
    custody: {
      exactBytesPreserved: true,
      exactBytesEncoding: "base64",
      hashAlgorithm: "sha256",
      classification: "public_evidence",
    },
  };
  const envelope = {
    kind: "m4-sec-gate-b-custody",
    activation: {
      authorizationId: "auth_sanitized_m4_acquisition_001",
      oneShotConsumptionId: "consume_sanitized_m4_acquisition_001",
      reviewedAdapterCommit: "9".repeat(40),
      authorizedAt: "2026-07-17T09:58:00.000Z",
      validFrom: "2026-07-17T09:58:00.000Z",
      validUntil: "2026-07-17T10:08:00.000Z",
      consumedAt: "2026-07-17T09:59:59.000Z",
      consumptionSha256: "8".repeat(64),
      userAgentSha256: "7".repeat(64),
      userAgentByteLength: 32,
    },
    targetPolicySha256: M4_TARGET_POLICY_SHA256,
    acquiredAt,
    acquisition,
    extraction: {
      kind: "m4-sec-literal-evidence-excerpt",
      value: "sanitized synthetic M4 envelope",
      jsonPointer: "/sicDescription",
      field: "sicDescription",
      context: { synthetic: true },
      sourceUrl: M4_CANONICAL_TARGET_POLICY.url,
      responseSha256,
      provenance: { publisher: M4_CANONICAL_TARGET_POLICY.publisher },
      trustLabel: "Quoted/untrusted public-source content",
      verificationStatus: "Unverified",
    },
    capabilityExecutions: [{
      kind: "CapabilityExecution",
      executionId,
      capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      descriptorSha256,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      authorityKind: "external_gate_b_one_shot_go",
      authorityRef: "auth_sanitized_m4_acquisition_001",
      mediationLevel: "L0",
      targetRef: M4_CANONICAL_TARGET_POLICY.targetRef,
      inputBytes: 128,
      outputBytes: body.byteLength,
      retryCount: 0,
      startedAt: "2026-07-17T09:59:59.000Z",
      completedAt: acquiredAt,
      durationMs: 1000,
      outcome: "completed",
      refusalCode: null,
      effectTelemetry: {
        dnsAttempts: 1,
        requestAttempts: 1,
        connectionAttempts: 1,
        liveNetworkEgress: 1,
        bytesReceived: body.byteLength,
        selectedAddress: "8.8.8.8",
        lookupCallbacks: 1,
        retryCount: 0,
        responseSha256,
        failurePhase: null,
        userAgentAudit: null,
      },
    }],
    auditEvents: [{ id: "aud_sanitized_m4_product_review" }],
    accountingIncrements: [{
      kind: "capability-accounting-increment",
      incrementId: "acct_sanitized_m4_product_review",
      executionId,
      capabilityInvocations: 1,
      capabilityExecutionRecords: 1,
      auditEventsEmitted: 1,
      liveNetworkEgressPerformed: 1,
      dnsAttemptsPerformed: 1,
      requestAttemptsPerformed: 1,
      connectionAttemptsPerformed: 1,
      lookupCallbacksPerformed: 1,
      bytesReceived: body.byteLength,
      selectedAddress: "8.8.8.8",
      failurePhase: null,
      systemSideAcquisitionProofsPerformed: 1,
      retriesPerformed: 0,
      providerCallsExecuted: 0,
      privateReadsPerformed: 0,
      graphWritesPerformed: 0,
      productionWritesPerformed: 0,
      deploymentsPerformed: 0,
    }],
  };
  const bytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  return { envelope, bytes, body };
}

async function combinedProductionScenario(root: string) {
  const scenario = await createSyntheticM5bProductReviewScenario(root);
  const request = cloneSynthetic(scenario.request) as any;
  const exactBody = Buffer.from(SYNTHETIC_SOURCE_TEXTS.launch, "utf8");
  const archiveAcquisition = await exactAcquisitionLedger(root, SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY);
  const archive = exactCustody(exactBody, archiveAcquisition.consumption);
  const archiveBytes = Buffer.from(`${JSON.stringify(archive, null, 2)}\n`, "utf8");
  const m4 = m4Custody(Buffer.from(SYNTHETIC_SOURCE_TEXTS.pilot, "utf8"));
  await writeFile(scenario.sourceFiles[0]!.path, archiveBytes);
  await writeFile(scenario.sourceFiles[1]!.path, m4.bytes);
  Object.assign(request.sources[0], {
    sourceKind: "exact_public_acquisition_custody",
    contentEncoding: "exact_sec_archive_custody_v1",
    expectedByteSize: archiveBytes.byteLength,
    rawSha256: sha256Fixture(archiveBytes),
    decodedByteSize: exactBody.byteLength,
    decodedSha256: sha256Fixture(exactBody),
    canonicalUrl: SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY.url,
    acquiredAt: archive.acquiredAt,
    publisher: SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY.publisher,
    sourceType: "sec_archive_primary_document",
  });
  Object.assign(request.sources[1], {
    sourceKind: "exact_public_acquisition_custody",
    contentEncoding: "m4_public_http_fetch_custody_v1",
    expectedByteSize: m4.bytes.byteLength,
    rawSha256: sha256Fixture(m4.bytes),
    decodedByteSize: m4.body.byteLength,
    decodedSha256: sha256Fixture(m4.body),
    canonicalUrl: M4_CANONICAL_TARGET_POLICY.url,
    acquiredAt: m4.envelope.acquiredAt,
    publisher: M4_CANONICAL_TARGET_POLICY.publisher,
    sourceType: "sec_submissions_document",
  });
  const written = await writeSyntheticRequest(root, "combined-production-product-request.json", request);
  const options: M5bProductReviewPrepareOptions = {
    requestPath: written.path,
    expectedRequestSha256: written.sha256,
    expectedRequestByteSize: written.bytes.byteLength,
    sourceFiles: scenario.sourceFiles,
    outputDir: scenario.outputDir,
  };
  return { scenario, request, archive, archiveBytes, archiveAcquisitionLedger: archiveAcquisition.ledger, m4, options };
}

function readExpected(ledgerRoot: string, source: any, suffix: string): M5bProductEffectExpectedAuthority {
  return {
    operation: "retained_custody_read",
    authorityId: `auth_retained_read_${suffix}`,
    consumptionId: `consume_retained_read_${suffix}`,
    ledgerRootSha256: createM5bProductEffectLedger(ledgerRoot).ledgerRootSha256,
    implementationCommit: "a".repeat(40),
    implementationTree: "b".repeat(40),
    targetPolicySha256: M4_TARGET_POLICY_SHA256,
    sourceIdentities: [{
      sourceId: source.sourceId,
      canonicalUrl: source.canonicalUrl,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      outerSha256: source.rawSha256,
      outerByteSize: source.expectedByteSize,
      decodedSha256: source.decodedSha256,
      decodedByteSize: source.decodedByteSize,
    }],
  };
}

function readGo(expected: M5bProductEffectExpectedAuthority) {
  return {
    kind: "m5b-product-effect-one-shot-go",
    schemaVersion: "1",
    operation: "retained_custody_read",
    authorityId: expected.authorityId,
    consumptionId: expected.consumptionId,
    ledgerRootSha256: expected.ledgerRootSha256,
    implementation: { commit: expected.implementationCommit, tree: expected.implementationTree },
    targetPolicySha256: expected.targetPolicySha256,
    sourceIdentities: expected.sourceIdentities,
    authorizedAt: "2026-08-06T00:00:00.000Z",
    validFrom: "2026-08-06T00:00:00.000Z",
    validUntil: "2026-08-07T00:00:00.000Z",
    armingStatus: "armed",
    authorizesEffect: true,
    effectBudget: { retainedCustodyReads: 1, dnsAttempts: 0, networkRequests: 0, redirects: 0, retries: 0 },
  };
}

function attempt(ledgerRoot: string, source: any, suffix: string) {
  const expected = readExpected(ledgerRoot, source, suffix);
  return createM5bProductEffectAttempt(readGo(expected), createM5bProductEffectLedger(ledgerRoot), expected,
    new Date("2026-08-06T02:00:00.000Z"));
}

async function refusalCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof M5bProductReviewRefusal);
    return error.code;
  }
  assert.fail("expected product-review refusal");
}

async function withRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "atliera-product-authority-"));
  try {
    return await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("M5b product-review retained-custody authority and provenance", () => {
  test("neutral M4 admission returns bytes and receipt identity without an account projection", () => {
    const fixture = m4Custody(Buffer.from(SYNTHETIC_SOURCE_TEXTS.pilot, "utf8"));
    const admitted = admitM4CustodyEnvelopeBytes(fixture.bytes, {
      custodyArtifactSha256: sha256Fixture(fixture.bytes),
      decodedResponseBytes: fixture.body.byteLength,
      responseSha256: sha256Fixture(fixture.body),
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      capabilityDescriptorSha256: getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID).descriptorSha256,
      capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      adapterId: "m4_sec_gate_b_live_one_shot_v1",
      sourceUrl: M4_CANONICAL_TARGET_POLICY.url,
      sourceHost: M4_CANONICAL_TARGET_POLICY.hostname,
      publisher: M4_CANONICAL_TARGET_POLICY.publisher,
      targetRef: M4_CANONICAL_TARGET_POLICY.targetRef,
      targetPolicyRef: M4_TARGET_POLICY_REF,
      acquiredAt: fixture.envelope.acquiredAt,
    });
    assert.deepEqual(Object.keys(admitted).sort(), ["decodedBytes", "receiptIdentity"]);
    assert.deepEqual(admitted.decodedBytes, fixture.body);
    assert.deepEqual(Object.keys(admitted.receiptIdentity).sort(), ["acquisition", "activation", "provenance"]);
    assert.doesNotMatch(JSON.stringify(admitted.receiptIdentity), /\"(?:cik|name|ticker|exchange|account)[^\"]*\"/i);
  });

  test("refuses a combined M4/archive input before source bytes are read when retained M4 authority is absent", async () => {
    await withRoot(async (root) => {
      const fixture = await combinedProductionScenario(root);
      const tampered = Buffer.from(fixture.m4.bytes);
      tampered[tampered.length - 2] = tampered[tampered.length - 2] === 32 ? 33 : 32;
      await writeFile(fixture.scenario.sourceFiles[1]!.path, tampered);
      assert.equal(await refusalCode(prepareM5bProductReview(fixture.options)),
        "retained_custody_read_authority");
    });
  });

  test("prepares combined retained M4 and exact archive custody with one retained-read consumption", async () => {
    await withRoot(async (root) => {
      const fixture = await combinedProductionScenario(root);
      const ledgerRoot = join(root, "trusted-ledger");
      await mkdir(ledgerRoot, { mode: 0o700 });
      const m4Source = fixture.request.sources[1];
      const result = await prepareM5bProductReview(fixture.options, attempt(ledgerRoot, m4Source, "success_001"),
        fixture.archiveAcquisitionLedger);
      assert.equal(result.accounting.retainedCustodyReads, 1);
      assert.equal(result.accounting.syntheticSourceReads, 1);
      assert.equal(result.accounting.retainedCustodyReadAuthorityConsumptions, 1);
      assert.equal(result.accounting.acquisitions, 0);
      assert.equal(result.accounting.networkCalls, 0);
      const pack = JSON.parse(await readFile(join(fixture.options.outputDir, "sanitized-source-pack.json"), "utf8"));
      const archiveProvenance = pack.sources.find((source: any) =>
        source.sourceId === fixture.request.sources[0].sourceId).provenance;
      assert.equal(archiveProvenance.classification, "validated_exact_public_acquisition_custody");
      assert.equal(archiveProvenance.targetPolicySha256, SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY_SHA256);
      assert.equal(archiveProvenance.capabilityId, M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID);
      assert.equal(archiveProvenance.adapterId, M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID);
      assert.equal(archiveProvenance.authorityId, fixture.archive.activation.authorityId);
      assert.equal(archiveProvenance.consumptionId, fixture.archive.activation.consumptionId);
      assert.equal(archiveProvenance.retainedReadAuthorityId, null);
      assert.equal(archiveProvenance.retainedReadConsumptionId, null);
      assert.equal(archiveProvenance.retainedReadLedgerNamespaceSha256, null);
      assert.equal(archiveProvenance.retainedReadLedgerRecordSha256, null);

      const m4Provenance = pack.sources.find((source: any) => source.sourceId === m4Source.sourceId).provenance;
      assert.equal(m4Provenance.classification, "validated_exact_public_acquisition_custody");
      assert.equal(m4Provenance.targetPolicySha256, M4_TARGET_POLICY_SHA256);
      assert.equal(m4Provenance.capabilityId, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
      assert.equal(m4Provenance.adapterId, "m4_sec_gate_b_live_one_shot_v1");
      assert.equal(m4Provenance.outerCustodySha256, m4Source.rawSha256);
      assert.equal(m4Provenance.responseSha256, m4Source.decodedSha256);
      assert.equal(m4Provenance.authorityId, fixture.m4.envelope.activation.authorizationId);
      assert.equal(m4Provenance.consumptionId, fixture.m4.envelope.activation.oneShotConsumptionId);
      assert.equal(m4Provenance.retainedReadAuthorityId, "auth_retained_read_success_001");
      assert.match(m4Provenance.retainedReadLedgerNamespaceSha256, /^[a-f0-9]{64}$/);
      assert.match(m4Provenance.retainedReadLedgerRecordSha256, /^[a-f0-9]{64}$/);

      const copiedGoAttempt = attempt(ledgerRoot, m4Source, "success_001");
      const secondOutput = join(root, "changed-output-path");
      const tampered = Buffer.from(fixture.archiveBytes);
      tampered[20] = tampered[20] === 65 ? 66 : 65;
      await writeFile(fixture.scenario.sourceFiles[0]!.path, tampered);
      assert.equal(await refusalCode(prepareM5bProductReview({ ...fixture.options, outputDir: secondOutput },
        copiedGoAttempt, fixture.archiveAcquisitionLedger)), "retained_custody_read_authority");
    });
  });

  test("a source identity failure after consumption remains durably consumed across restart", async () => {
    await withRoot(async (root) => {
      const fixture = await combinedProductionScenario(root);
      const ledgerRoot = join(root, "trusted-ledger");
      await mkdir(ledgerRoot, { mode: 0o700 });
      const source = fixture.request.sources[1];
      const tampered = Buffer.from(fixture.m4.bytes);
      tampered[30] = tampered[30] === 65 ? 66 : 65;
      await writeFile(fixture.scenario.sourceFiles[1]!.path, tampered);
      assert.equal(await refusalCode(prepareM5bProductReview(fixture.options,
        attempt(ledgerRoot, source, "failed_read_001"), fixture.archiveAcquisitionLedger)), "source_identity_mismatch");
      await writeFile(fixture.scenario.sourceFiles[1]!.path, fixture.m4.bytes);
      assert.equal(await refusalCode(prepareM5bProductReview(fixture.options,
        attempt(ledgerRoot, source, "failed_read_001"), fixture.archiveAcquisitionLedger)),
      "retained_custody_read_authority");
    });
  });

  test("exact archive-only needs no retained read but still rejects forged acquisition receipts", async () => {
    await withRoot(async (root) => {
      const fixture = await exactArchiveScenario(root);
      const result = await prepareM5bProductReview(fixture.options, undefined, fixture.acquisitionLedger);
      assert.equal(result.accounting.retainedCustodyReads, 0);
      assert.equal(result.accounting.retainedCustodyReadAuthorityConsumptions, 0);
      assert.equal(result.accounting.acquisitions, 0);
      assert.equal(result.accounting.networkCalls, 0);
      const pack = JSON.parse(await readFile(join(fixture.options.outputDir, "sanitized-source-pack.json"), "utf8"));
      const provenance = pack.sources[0].provenance;
      assert.equal(provenance.authorityId, fixture.custody.activation.authorityId);
      assert.equal(provenance.consumptionId, fixture.custody.activation.consumptionId);
      assert.equal(provenance.retainedReadAuthorityId, null);
      assert.equal(provenance.retainedReadConsumptionId, null);
      assert.equal(provenance.retainedReadImplementationCommit, null);
      assert.equal(provenance.retainedReadImplementationTree, null);
      assert.equal(provenance.retainedReadLedgerNamespaceSha256, null);
      assert.equal(provenance.retainedReadLedgerRecordSha256, null);
    });

    const mutators: Array<(custody: any) => void> = [
      (custody) => { custody.adapter.adapterSha256 = "0".repeat(64); },
      (custody) => { custody.activation.ledgerRootSha256 = "0".repeat(64); },
      (custody) => { custody.activation.ledgerRecordSha256 = "0".repeat(64); },
      (custody) => { custody.targetPolicy.network.retryBudget = 1; },
      (custody) => { custody.effectAccounting.retries = 1; },
      (custody) => { custody.effectAccounting.selectedAddress = "127.0.0.1";
        custody.effectAccounting.connectedAddress = "127.0.0.1"; },
      (custody) => { custody.acquisition.requestedUrl = "https://www.sec.gov/Archives/edgar/data/1/1/x.htm"; },
      (custody) => { custody.unexpected = true; },
    ];
    let index = 0;
    for (const mutate of mutators) {
      await withRoot(async (root) => {
        const fixture = await exactArchiveScenario(root);
        const custody = structuredClone(fixture.custody);
        mutate(custody);
        const bytes = Buffer.from(`${JSON.stringify(custody, null, 2)}\n`, "utf8");
        await writeFile(fixture.scenario.sourceFiles[0]!.path, bytes);
        const request = cloneSynthetic(fixture.request) as any;
        request.sources[0].expectedByteSize = bytes.byteLength;
        request.sources[0].rawSha256 = sha256Fixture(bytes);
        const written = await writeSyntheticRequest(root, `forged-receipt-${index}.json`, request);
        const options = { ...fixture.options, requestPath: written.path, expectedRequestSha256: written.sha256,
          expectedRequestByteSize: written.bytes.byteLength };
        index += 1;
        assert.match(await refusalCode(prepareM5bProductReview(options, undefined, fixture.acquisitionLedger)),
          /^custody_/);
      });
    }
  });

  test("preparation derives archive policy identity from the strict receipt instead of a global target", async () => {
    await withRoot(async (root) => {
      const alternatePolicy = createExactSecArchiveTargetPolicy({
        targetRef: "synthetic_alternate_sec_archive_document",
        cik: "1",
        accessionWithoutDashes: "000000000000000001",
        primaryDocument: "synthetic-alternate.htm",
      });
      const fixture = await exactArchiveScenario(root, alternatePolicy);
      await prepareM5bProductReview(fixture.options, undefined, fixture.acquisitionLedger);
      const pack = JSON.parse(await readFile(join(fixture.options.outputDir, "sanitized-source-pack.json"), "utf8"));
      assert.equal(pack.sources[0].canonicalUrl, alternatePolicy.url);
      assert.equal(pack.sources[0].provenance.targetPolicySha256,
        exactSecArchiveTargetPolicySha256(alternatePolicy));
      assert.notEqual(pack.sources[0].provenance.targetPolicySha256,
        SYNTHETIC_EXACT_SEC_ARCHIVE_TARGET_POLICY_SHA256);
    });
  });

  test("a self-consistent archive receipt cannot forge provenance without its exact durable ledger record", async () => {
    await withRoot(async (root) => {
      const fixture = await exactArchiveScenario(root);
      assert.equal(await refusalCode(prepareM5bProductReview(fixture.options)), "custody_acquisition_ledger");

      const wrongRoot = join(root, "wrong-exact-archive-ledger");
      await mkdir(wrongRoot, { mode: 0o700 });
      const wrongLedger = createM5bProductEffectLedger(wrongRoot);
      assert.equal(await refusalCode(prepareM5bProductReview(fixture.options, undefined, wrongLedger)),
        "custody_acquisition_ledger");
    });
  });

  test("a production label cannot promote the small synthetic M4 envelope into validated custody", async () => {
    await withRoot(async (root) => {
      const scenario = await createSyntheticM5bProductReviewScenario(root);
      const request = cloneSynthetic(scenario.request) as any;
      const path = scenario.sourceFiles[0]!.path;
      const envelope = JSON.parse(await readFile(path, "utf8"));
      envelope.acquisition.requestedUrl = M4_CANONICAL_TARGET_POLICY.url;
      envelope.acquisition.finalUrl = M4_CANONICAL_TARGET_POLICY.url;
      const bytes = Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, "utf8");
      await writeFile(path, bytes);
      Object.assign(request.sources[0], {
        sourceKind: "exact_public_acquisition_custody",
        expectedByteSize: bytes.byteLength,
        rawSha256: sha256Fixture(bytes),
        canonicalUrl: M4_CANONICAL_TARGET_POLICY.url,
        publisher: M4_CANONICAL_TARGET_POLICY.publisher,
      });
      const written = await writeSyntheticRequest(root, "caller-labeled-m4-production.json", request);
      const ledgerRoot = join(root, "trusted-ledger");
      await mkdir(ledgerRoot, { mode: 0o700 });
      const source = request.sources[0];
      const expected: M5bProductEffectExpectedAuthority = {
        operation: "retained_custody_read",
        authorityId: "auth_retained_read_m4_label_001",
        consumptionId: "consume_retained_read_m4_label_001",
        ledgerRootSha256: createM5bProductEffectLedger(ledgerRoot).ledgerRootSha256,
        implementationCommit: request.execution.commit,
        implementationTree: request.execution.tree,
        targetPolicySha256: M4_TARGET_POLICY_SHA256,
        sourceIdentities: [{
          sourceId: source.sourceId,
          canonicalUrl: source.canonicalUrl,
          targetPolicySha256: M4_TARGET_POLICY_SHA256,
          outerSha256: source.rawSha256,
          outerByteSize: source.expectedByteSize,
          decodedSha256: source.decodedSha256,
          decodedByteSize: source.decodedByteSize,
        }],
      };
      const authority = createM5bProductEffectAttempt(readGo(expected), createM5bProductEffectLedger(ledgerRoot),
        expected, new Date("2026-08-06T02:00:00.000Z"));
      assert.equal(await refusalCode(prepareM5bProductReview({
        requestPath: written.path,
        expectedRequestSha256: written.sha256,
        expectedRequestByteSize: written.bytes.byteLength,
        sourceFiles: scenario.sourceFiles,
        outputDir: scenario.outputDir,
      }, authority)), "custody_shape");
    });
  });

  test("generic product-review preparation has no FedEx product-path dependency", async () => {
    const source = await readFile(join(import.meta.dirname, "..", "..", "src", "workshop",
      "m5b-product-review-prepare.ts"), "utf8");
    const admission = await readFile(join(import.meta.dirname, "..", "..", "src", "capability",
      "m4-custody-envelope-admission.ts"), "utf8");
    assert.match(source, /m4-custody-envelope-admission/);
    assert.doesNotMatch(source, /m5b-fedex-system-acquired-source|M5bFedEx|M5B_FEDEX|0001048911/);
    assert.doesNotMatch(admission, /m5b-fedex-system-acquired-source|M5bFedEx|M5B_FEDEX|FEDEX CORP|0001048911/);
  });
});
