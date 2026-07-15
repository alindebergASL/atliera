import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { extractM4SecEvidence } from "../../src/capability/m4-sec-extraction.ts";
import { M4_TARGET_POLICY_SHA256 } from "../../src/capability/m4-target-policy.ts";
import { acquireM4ProofRecordedEvidence } from "../../src/capability/public-http-fetch-policy.ts";
import { parseGraphBundle } from "../../src/graph/schema.ts";
import { validateGraphBundle } from "../../src/graph/validate.ts";
import {
  M5B_FEDEX_DEMO_FIXTURE_NOTICE,
  M5B_FEDEX_INPUT_LIMITS,
  M5B_FEDEX_PRODUCTION_PINS,
  M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
  M5B_FEDEX_REQUIRED_IDENTITY_CLAIM,
  M5B_FEDEX_RESTRAINED_PLAY,
  admitM5bFedExProductionCustodyBytes,
  buildM5bFedExOptionalModelRequest,
  buildM5bFedExSanitizedSourcePack,
  canonicalM5bFedExJson,
  extractM5bFedExCommittedFixtureSource,
  sha256M5bFedExCanonical,
  snapshotM5bFedExOwnData,
  validateM5bFedExCustodyBytesAgainstPins,
  validateM5bFedExOptionalModelOutput,
  verifyM5bFedExSanitizedSourcePack,
  type M5bFedExProductionPins,
} from "../../src/workshop/m5b-fedex-system-acquired-source.ts";
import {
  applyM5bFedExIndividualReviewDraftSelections,
  applyM5bFedExRetentionDraftSelection,
  buildM5bFedExPrewriteCandidate,
  buildM5bFedExReviewPacket,
  composeM5bFedExUnarmedFutureEffect,
  refuseM5bFedExPreEffectExecution,
  verifyM5bFedExPrewriteCandidate,
  verifyM5bFedExReviewPacket,
} from "../../src/workshop/m5b-fedex-review-composition.ts";
import {
  generateM5bFedExDemoArtifacts,
  renderM5bFedExPrewriteWorkshopHtml,
  renderM5bFedExSafeSourceLink,
} from "../../src/workshop/m5b-fedex-prewrite-workshop.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const DEMO_SOURCE = readFileSync(join(ROOT, "fixtures/validation/m5b-fedex-system-acquired-demo-source.json"), "utf8");

function hashBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function secBody(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(JSON.stringify({
    name: "FEDEX CORP",
    cik: 1048911,
    tickers: ["FDX"],
    exchanges: ["NYSE"],
    sic: "4513",
    sicDescription: "Air Courier Services",
    filings: { recent: { form: [], filingDate: [], accessionNumber: [], primaryDocument: [] } },
    ...overrides,
  }), "utf8");
}

function custodyFor(body = secBody()): { envelope: Record<string, any>; bytes: Buffer; pins: M5bFedExProductionPins } {
  const acquisitionResult = acquireM4ProofRecordedEvidence("sec_fedex_submissions", {
    fetchedAt: M5B_FEDEX_PRODUCTION_PINS.acquiredAt,
    resolvedAddresses: ["8.8.8.8"],
    status: 200,
    contentType: "application/json",
    location: null,
    connectedAddress: "8.8.8.8",
    finalUrl: M5B_FEDEX_PRODUCTION_PINS.sourceUrl,
    bodyBase64: body.toString("base64"),
    cancelAt: "none",
  });
  assert.equal(acquisitionResult.ok, true);
  if (!acquisitionResult.ok) throw new Error("synthetic M4 evidence refused");
  const acquisition = clone(acquisitionResult.evidence) as Record<string, any>;
  acquisition.provenance.transport = "live_sec_one_shot";
  const extraction = extractM4SecEvidence(acquisition as any);
  const executionId = "capexec_test_m5b";
  const envelope: Record<string, any> = {
    kind: "m4-sec-gate-b-custody",
    activation: {
      authorizationId: "auth_test_m5b",
      oneShotConsumptionId: "consume_test_m5b",
      reviewedAdapterCommit: "a".repeat(40),
      authorizedAt: "2026-07-14T18:40:00.000Z",
      validFrom: "2026-07-14T18:40:00.000Z",
      validUntil: "2026-07-14T18:50:00.000Z",
      consumedAt: "2026-07-14T18:41:00.000Z",
      consumptionSha256: "b".repeat(64),
      userAgentSha256: "c".repeat(64),
      userAgentByteLength: 32,
    },
    targetPolicySha256: M4_TARGET_POLICY_SHA256,
    acquiredAt: M5B_FEDEX_PRODUCTION_PINS.acquiredAt,
    acquisition,
    extraction,
    capabilityExecutions: [{
      kind: "CapabilityExecution",
      executionId,
      capabilityId: "public_http_fetch_v1",
      descriptorSha256: M5B_FEDEX_PRODUCTION_PINS.capabilityDescriptorSha256,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      authorityKind: "external_gate_b_one_shot_go",
      authorityRef: "auth_test_m5b",
      mediationLevel: "L0",
      targetRef: "sec_fedex_submissions",
      inputBytes: 100,
      outputBytes: body.byteLength,
      retryCount: 0,
      startedAt: "2026-07-14T18:41:11.000Z",
      completedAt: "2026-07-14T18:41:11.277Z",
      durationMs: 277,
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
        responseSha256: hashBytes(body),
        failurePhase: null,
        userAgentAudit: null,
      },
    }],
    auditEvents: [{ id: "aud_test_m5b" }],
    accountingIncrements: [{
      kind: "capability-accounting-increment",
      incrementId: "acct_test_m5b",
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
  const pins: M5bFedExProductionPins = {
    ...M5B_FEDEX_PRODUCTION_PINS,
    custodyArtifactSha256: hashBytes(bytes),
    decodedResponseBytes: body.byteLength,
    responseSha256: hashBytes(body),
  };
  return { envelope, bytes, pins };
}

function rebuiltCustody(value: ReturnType<typeof custodyFor>): ReturnType<typeof custodyFor> {
  const bytes = Buffer.from(`${JSON.stringify(value.envelope, null, 2)}\n`, "utf8");
  return { envelope: value.envelope, bytes, pins: { ...value.pins, custodyArtifactSha256: hashBytes(bytes) } };
}

function boundedFrom(overrides: Record<string, unknown> = {}) {
  return extractM5bFedExCommittedFixtureSource(secBody(overrides));
}

function assertRefusalCode(operation: () => unknown, code: string): void {
  assert.throws(operation, (error: any) => {
    assert.equal(error.code, code);
    return true;
  });
}

describe("M5b exact source admission and bounded extraction", () => {
  test("pins every supplied production identity and rejects synthetic bytes at the outer hash first", () => {
    assert.deepEqual(M5B_FEDEX_PRODUCTION_PINS, {
      custodyArtifactSha256: "c368ea513220a207ef839b30dd527522a6a76304705c88d7243b64bb6f13eb1f",
      decodedResponseBytes: 160901,
      responseSha256: "ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d",
      targetPolicySha256: "a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a",
      capabilityDescriptorSha256: "0abd3c555771006749eaa59604c69e37090d32ea738eeb588dbb36423d1a2fb5",
      sourceUrl: "https://data.sec.gov/submissions/CIK0001048911.json",
      cik: "0001048911",
      acquiredAt: "2026-07-14T18:41:11.214Z",
      originalCustodyRetentionDeadline: "2026-08-13T18:41:11.277Z",
    });
    assert.throws(() => admitM5bFedExProductionCustodyBytes(Buffer.from("not-json")), (error: any) => {
      assert.equal(error.code, "custody_sha256");
      return true;
    });
    assert.throws(() => admitM5bFedExProductionCustodyBytes(custodyFor().bytes), /custody_sha256/);
  });

  test("validates a synthetic exact envelope without weakening the production wrapper", () => {
    const fixture = custodyFor();
    const bounded = validateM5bFedExCustodyBytesAgainstPins(fixture.bytes, fixture.pins);
    assert.equal(bounded.name, "FEDEX CORP");
    assert.equal(bounded.cik, "0001048911");
    assert.equal(bounded.sicDescriptionLiteral, "Air Courier Services");
    assert.equal(bounded.exactProductionCustodyAdmissionCompleted, false);
    assert.equal(bounded.fixtureNotice, M5B_FEDEX_DEMO_FIXTURE_NOTICE);
  });

  test("keeps committed-fixture extraction synthetic and rejects a caller-fabricated admitted source", () => {
    const bounded = extractM5bFedExCommittedFixtureSource(secBody());
    assert.equal(bounded.exactProductionCustodyAdmissionCompleted, false);
    assert.equal(bounded.fixtureNotice, M5B_FEDEX_DEMO_FIXTURE_NOTICE);
    const counterfeit = clone(bounded) as any;
    counterfeit.exactProductionCustodyAdmissionCompleted = true;
    counterfeit.fixtureNotice = null;
    assert.throws(() => buildM5bFedExSanitizedSourcePack(counterfeit), /bounded_source_unadmitted/);
  });

  test("rejects strict UTF-8, base64, count, response hash, target, descriptor, and timestamp drift", () => {
    const base = custodyFor();

    const invalidUtf8 = Buffer.from([0xc3, 0x28]);
    const utfPins = { ...base.pins, custodyArtifactSha256: hashBytes(invalidUtf8) };
    assert.throws(() => validateM5bFedExCustodyBytesAgainstPins(invalidUtf8, utfPins), /custody_utf8/);
    assert.throws(() => extractM5bFedExCommittedFixtureSource(invalidUtf8), /response_utf8/);

    const cases: Array<(fixture: ReturnType<typeof custodyFor>) => void> = [
      (fixture) => { fixture.envelope.acquisition.bodyBase64 += "\n"; },
      (fixture) => { fixture.envelope.acquisition.byteCount += 1; },
      (fixture) => { fixture.envelope.acquisition.responseSha256 = "0".repeat(64); },
      (fixture) => { fixture.envelope.targetPolicySha256 = "0".repeat(64); },
      (fixture) => { fixture.envelope.capabilityExecutions[0].descriptorSha256 = "0".repeat(64); },
      (fixture) => { fixture.envelope.acquiredAt = "2026-07-14T18:41:11.215Z"; },
      (fixture) => { fixture.envelope.acquisition.quotedBodyText += " "; },
    ];
    for (const mutate of cases) {
      const fixture = custodyFor();
      mutate(fixture);
      const rebuilt = rebuiltCustody(fixture);
      assert.throws(() => validateM5bFedExCustodyBytesAgainstPins(rebuilt.bytes, rebuilt.pins));
    }
  });

  test("rejects proxy/accessor/symbol/unsafe-key inputs without invoking traps or getters", () => {
    let traps = 0;
    const proxy = new Proxy({ name: "FEDEX CORP" }, {
      ownKeys() { traps += 1; throw new Error("must not run"); },
      getPrototypeOf() { traps += 1; throw new Error("must not run"); },
    });
    assert.throws(() => snapshotM5bFedExOwnData(proxy), /proxy/);
    assert.equal(traps, 0);

    let getters = 0;
    const accessor = Object.defineProperty({}, "name", { enumerable: true, get() { getters += 1; return "FEDEX CORP"; } });
    assert.throws(() => snapshotM5bFedExOwnData(accessor), /own_data/);
    assert.equal(getters, 0);

    const symbol = { name: "FEDEX CORP" } as Record<PropertyKey, unknown>;
    symbol[Symbol("hidden")] = true;
    assert.throws(() => snapshotM5bFedExOwnData(symbol), /symbols/);
    assert.throws(() => snapshotM5bFedExOwnData(JSON.parse('{"__proto__":{"polluted":true}}')), /unsafe_key/);
  });

  test("enforces proportional hostile-input ceilings before reflection, copying, encoding, or decoding", () => {
    const flat = Object.fromEntries(Array.from({ length: M5B_FEDEX_INPUT_LIMITS.objectOwnPropertyCount + 1 },
      (_, index) => [`p${index}`, index]));
    assertRefusalCode(() => snapshotM5bFedExOwnData(flat), "input_own_property_count");

    const primitiveArrayLength = Math.ceil(M5B_FEDEX_INPUT_LIMITS.primitiveLeafAndPropertyCount / (128 * 2)) + 1;
    const primitiveHeavy = Object.fromEntries(Array.from({ length: 128 }, (_, index) =>
      [`p${index}`, Array.from({ length: primitiveArrayLength }, () => null)]));
    assertRefusalCode(() => snapshotM5bFedExOwnData(primitiveHeavy), "input_primitive_budget");
    assertRefusalCode(() => snapshotM5bFedExOwnData("x".repeat(M5B_FEDEX_INPUT_LIMITS.stringUtf8Bytes + 1)),
      "input_string_bytes");
    const canonicalStringCount = Math.floor(M5B_FEDEX_INPUT_LIMITS.cumulativeCanonicalUtf8Bytes /
      M5B_FEDEX_INPUT_LIMITS.stringUtf8Bytes) + 1;
    assertRefusalCode(() => canonicalM5bFedExJson({ values: Array.from({ length: canonicalStringCount },
      () => "x".repeat(M5B_FEDEX_INPUT_LIMITS.stringUtf8Bytes)) }),
      "canonical_utf8_budget");

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assertRefusalCode(() => snapshotM5bFedExOwnData(cyclic), "input_cycle");
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let depth = 0; depth <= M5B_FEDEX_INPUT_LIMITS.recursionDepth; depth += 1) {
      const next: Record<string, unknown> = {};
      cursor.next = next;
      cursor = next;
    }
    assertRefusalCode(() => snapshotM5bFedExOwnData(deep), "input_recursion_depth");
    const outerNodeCount = 201;
    const innerNodeCount = Math.ceil(M5B_FEDEX_INPUT_LIMITS.totalNodes / outerNodeCount);
    const nodeHeavy = Array.from({ length: outerNodeCount }, () =>
      Array.from({ length: innerNodeCount }, () => ({})));
    assertRefusalCode(() => snapshotM5bFedExOwnData(nodeHeavy), "input_total_nodes");
    assertRefusalCode(() => snapshotM5bFedExOwnData(
      Array.from({ length: M5B_FEDEX_INPUT_LIMITS.arraySize + 1 }, () => null)), "input_array_size");
    assertRefusalCode(() => admitM5bFedExProductionCustodyBytes(
      Buffer.alloc(M5B_FEDEX_INPUT_LIMITS.custodyInputBytes + 1)), "custody_input_bytes");

    const oversizedBase64 = custodyFor();
    oversizedBase64.envelope.acquisition.bodyBase64 = "A".repeat(1_000);
    const rebuilt = rebuiltCustody(oversizedBase64);
    assertRefusalCode(() => validateM5bFedExCustodyBytesAgainstPins(rebuilt.bytes, rebuilt.pins),
      "response_base64_bounds");
  });

  test("uses trap-free intrinsic byte lengths before any proportional custody or fixture copy", () => {
    const boundaries: ReadonlyArray<{
      readonly label: "custody" | "response";
      readonly maximumBytes: number;
      readonly admit: (input: Uint8Array) => unknown;
      readonly postCopyRefusal: string;
    }> = [
      {
        label: "custody",
        maximumBytes: M5B_FEDEX_INPUT_LIMITS.custodyInputBytes,
        admit: (input) => admitM5bFedExProductionCustodyBytes(input),
        postCopyRefusal: "custody_sha256",
      },
      {
        label: "response",
        maximumBytes: M5B_FEDEX_INPUT_LIMITS.responseInputBytes,
        admit: (input) => extractM5bFedExCommittedFixtureSource(input),
        postCopyRefusal: "response_json",
      },
    ];

    for (const boundary of boundaries) {
      let ownByteLengthGetterReads = 0;
      const ownGetterBytes = new Uint8Array(boundary.maximumBytes + 1);
      Object.defineProperty(ownGetterBytes, "byteLength", {
        configurable: true,
        get() {
          ownByteLengthGetterReads += 1;
          return 0;
        },
      });
      assertRefusalCode(() => boundary.admit(ownGetterBytes), `${boundary.label}_input_bytes`);
      assert.equal(ownByteLengthGetterReads, 0, `${boundary.label}: own byteLength getter must not run`);

      let subclassByteLengthGetterReads = 0;
      class MisleadingByteLengthUint8Array extends Uint8Array {
        override get byteLength(): number {
          subclassByteLengthGetterReads += 1;
          return 0;
        }
      }
      const subclassBytes = new MisleadingByteLengthUint8Array(boundary.maximumBytes + 1);
      assertRefusalCode(() => boundary.admit(subclassBytes), `${boundary.label}_input_bytes`);
      assert.equal(subclassByteLengthGetterReads, 0, `${boundary.label}: subclass byteLength getter must not run`);

      let proxyTraps = 0;
      const proxyBytes = new Proxy(new Uint8Array(boundary.maximumBytes + 1), {
        get() {
          proxyTraps += 1;
          throw new Error("byte proxy get trap must not run");
        },
        getPrototypeOf() {
          proxyTraps += 1;
          throw new Error("byte proxy prototype trap must not run");
        },
      });
      assertRefusalCode(() => boundary.admit(proxyBytes), `${boundary.label}_bytes`);
      assert.equal(proxyTraps, 0, `${boundary.label}: proxy traps must not run`);

      const counterfeitView = Object.create(Uint8Array.prototype) as Uint8Array;
      assertRefusalCode(() => boundary.admit(counterfeitView), `${boundary.label}_bytes`);

      let valueOfCalls = 0;
      let lengthGetterReads = 0;
      class CopyDispatchUint8Array extends Uint8Array {
        override valueOf(): this {
          valueOfCalls += 1;
          return new Uint8Array(boundary.maximumBytes + 1) as this;
        }

        override get length(): number {
          lengthGetterReads += 1;
          throw new Error("byte length getter must not run during copy");
        }
      }
      const copyDispatchBytes = new CopyDispatchUint8Array(Buffer.from("not-json", "utf8"));
      assertRefusalCode(() => boundary.admit(copyDispatchBytes), boundary.postCopyRefusal);
      assert.equal(valueOfCalls, 0, `${boundary.label}: valueOf must not dispatch during copy`);
      assert.equal(lengthGetterReads, 0, `${boundary.label}: length getter must not run during copy`);
    }
  });

  test("preserves ordinary Uint8Array and Node Buffer fixture inputs", () => {
    const ordinary = new Uint8Array(secBody());
    const fromOrdinary = extractM5bFedExCommittedFixtureSource(ordinary);
    const fromBuffer = extractM5bFedExCommittedFixtureSource(secBody());
    assert.equal(fromOrdinary.name, "FEDEX CORP");
    assert.equal(fromBuffer.name, "FEDEX CORP");
    assert.equal(fromOrdinary.inputSha256, fromBuffer.inputSha256);
  });

  test("omits ambiguous filing alignment and selects only one uniquely newest canonical same-index row", () => {
    const ambiguous = [
      { filings: { recent: { form: ["10-K"], filingDate: [], accessionNumber: ["0001048911-26-000001"], primaryDocument: ["fdx.htm"] } } },
      { filings: { recent: { form: ["10-K"], filingDate: ["2026-99-99"], accessionNumber: ["0001048911-26-000001"], primaryDocument: ["fdx.htm"] } } },
      { filings: { recent: { form: ["10-K", "8-K"], filingDate: ["2026-01-01", "2026-01-01"],
        accessionNumber: ["0001048911-26-000001", "0001048911-26-000002"], primaryDocument: ["a.htm", "b.htm"] } } },
      { filings: { recent: { form: ["10-K"], filingDate: ["2026-01-01"], accessionNumber: ["bad"], primaryDocument: ["fdx.htm"] } } },
    ];
    for (const value of ambiguous) {
      const bounded = boundedFrom(value);
      assert.equal(bounded.filing, null);
      assert.equal(bounded.filingAlignment, "omitted_ambiguous");
      const pack = buildM5bFedExSanitizedSourcePack(bounded);
      const candidate = buildM5bFedExPrewriteCandidate(pack);
      const packet = buildM5bFedExReviewPacket(pack, candidate);
      const html = renderM5bFedExPrewriteWorkshopHtml(pack, packet, candidate);
      assert.match(html, /No Signals proposed/);
      assert.match(html, /No Plays proposed/);
    }

    const aligned = boundedFrom({ filings: { recent: {
      form: ["10-Q", "8-K"], filingDate: ["2026-01-01", "2026-02-02"],
      accessionNumber: ["0001048911-26-000001", "0001048911-26-000002"], primaryDocument: ["a.htm", "b.htm"],
    } } });
    assert.deepEqual(aligned.filing, { index: 1, form: "8-K", filingDate: "2026-02-02",
      accessionNumber: "0001048911-26-000002", primaryDocument: "b.htm" });
    const pack = buildM5bFedExSanitizedSourcePack(aligned);
    const candidate = buildM5bFedExPrewriteCandidate(pack);
    assert.equal(candidate.bundle.account_objects.length, 3);
    assert.equal(candidate.bundle.account_objects.filter((item) => item.object_type === "signal").length, 1);
    assert.equal(candidate.bundle.account_objects.filter((item) => item.object_type === "play").length, 0);
  });
});

describe("M5b source pack, packet, unratified review drafts, and composition", () => {
  const generated = generateM5bFedExDemoArtifacts(DEMO_SOURCE);

  test("binds exact pointers/literals/spans and records every deterministic claim transformation", () => {
    const packet = generated.reviewPacket;
    assert.equal(packet.proposals[0]?.proposedClaim, M5B_FEDEX_REQUIRED_IDENTITY_CLAIM);
    assert.equal(packet.proposals[1]?.proposedClaim, M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM);
    assert.deepEqual(packet.proposals[0]?.sourceLiterals.map((item) => [item.jsonPointer, item.literal]), [
      ["/name", "FEDEX CORP"], ["/cik", 1048911], ["/tickers", ["FDX"]], ["/exchanges", ["NYSE"]],
    ]);
    assert.deepEqual(packet.proposals[1]?.sourceLiterals.map((item) => [item.jsonPointer, item.literal]), [
      ["/sic", "4513"], ["/sicDescription", "Air Courier Services"],
    ]);
    const { sourcePackSha256: _hash, ...packContent } = generated.sourcePack;
    const canonical = canonicalM5bFedExJson(packContent);
    for (const proposal of packet.proposals) {
      for (const evidence of proposal.sourceLiterals) {
        assert.equal(canonical.slice(evidence.locator.charStart, evidence.locator.charEnd),
          canonicalM5bFedExJson(evidence.literal));
      }
      assert.ok(proposal.transformations.some((item) => item.id.startsWith("compose-")));
    }
    assert.equal(packet.proposals[0]?.transformations.some((item) => item.id === "normalize-cik-to-sec-10-digit-display"), true);
  });

  test("source-pack and packet hashes are deterministic and counterfeit content refuses", () => {
    const again = generateM5bFedExDemoArtifacts(DEMO_SOURCE);
    assert.equal(again.sourcePackJson, generated.sourcePackJson);
    assert.equal(again.reviewPacketJson, generated.reviewPacketJson);
    assert.equal(again.html, generated.html);
    assert.equal(sha256M5bFedExCanonical({ b: 2, a: 1 }), sha256M5bFedExCanonical({ a: 1, b: 2 }));
    assert.equal(generated.sourcePack.productionAdmissionEvidence, null);

    const badPack = clone(generated.sourcePack) as any;
    badPack.selectedIdentity.name = "OTHER";
    const { sourcePackSha256: _oldPackHash, ...badPackContent } = badPack;
    badPack.sourcePackSha256 = sha256M5bFedExCanonical(badPackContent);
    assert.throws(() => verifyM5bFedExSanitizedSourcePack(badPack), /source_pack_boundary/);

    const badPacket = clone(generated.reviewPacket) as any;
    badPacket.boundaryMarker = "armed";
    const { packetSha256: _oldPacketHash, ...badPacketContent } = badPacket;
    badPacket.packetSha256 = sha256M5bFedExCanonical(badPacketContent);
    assert.throws(() => verifyM5bFedExReviewPacket(badPacket, generated.sourcePack, generated.candidate),
      /review_packet_boundary/);

    const semanticPack = clone(generated.sourcePack) as any;
    semanticPack.fields.find((field: any) => field.jsonPointer === "/sicDescription").literal = "AIR COURIER SERVICES";
    semanticPack.selectedIdentity.sicDescription = "AIR COURIER SERVICES";
    const { sourcePackSha256: _semanticPackHash, ...semanticPackContent } = semanticPack;
    semanticPack.sourcePackSha256 = sha256M5bFedExCanonical(semanticPackContent);
    assert.throws(() => verifyM5bFedExSanitizedSourcePack(semanticPack), /source_pack_identity_semantics/);

    const semanticPacket = clone(generated.reviewPacket) as any;
    semanticPacket.proposals[0].proposedCard = "Counterfeit card";
    const { packetSha256: _semanticPacketHash, ...semanticPacketContent } = semanticPacket;
    semanticPacket.packetSha256 = sha256M5bFedExCanonical(semanticPacketContent);
    assert.throws(() => verifyM5bFedExReviewPacket(semanticPacket, generated.sourcePack, generated.candidate),
      /review_packet_counterfeit/);
  });

  test("requires the exact verified candidate instead of a caller-selected digest at every review boundary", () => {
    assertRefusalCode(() => buildM5bFedExReviewPacket(generated.sourcePack, "a".repeat(64) as any),
      "review_candidate_required");
    assert.doesNotThrow(() => buildM5bFedExReviewPacket(generated.sourcePack, generated.candidate as any));

    const counterfeit = clone(generated.candidate) as any;
    counterfeit.bundle.account_objects[0].title = "Counterfeit card";
    counterfeit.candidateContentSha256 = sha256M5bFedExCanonical(counterfeit.bundle);
    assertRefusalCode(() => verifyM5bFedExReviewPacket(generated.reviewPacket, generated.sourcePack, counterfeit),
      "review_candidate_counterfeit");
    assertRefusalCode(() => applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack, [], counterfeit),
      "review_candidate_counterfeit");
    assertRefusalCode(() => applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack, [],
      "b".repeat(64) as any), "review_candidate_counterfeit");

    const all = applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack,
      generated.reviewPacket.proposals.map((proposal) => ({ proposalId: proposal.proposalId, disposition: "accept" as const })),
      generated.candidate);
    assertRefusalCode(() => applyM5bFedExRetentionDraftSelection(all, "accept", generated.reviewPacket,
      generated.sourcePack, counterfeit), "review_candidate_counterfeit");
    assertRefusalCode(() => composeM5bFedExUnarmedFutureEffect(generated.sourcePack, generated.reviewPacket, all,
      counterfeit, Buffer.from(DEMO_SOURCE, "utf8")), "review_candidate_counterfeit");
  });

  test("applies accept/reject individually, permits honest partial state, and keeps retention separate", () => {
    const partial = applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack, [
      { proposalId: "m5b-fedex-registrant-identity", disposition: "accept" },
    ], generated.candidate);
    assert.equal(partial.allProposalsDecided, false);
    assert.equal(partial.unarmed, true);
    assert.deepEqual(partial.pendingProposalIds, ["m5b-fedex-industry-classification"]);
    assert.equal(partial.retentionDraft, "pending");
    assert.equal(partial.ratificationState, "unratified-draft");
    assert.equal(partial.satisfiesFutureArming, false);
    assert.throws(() => composeM5bFedExUnarmedFutureEffect(generated.sourcePack, generated.reviewPacket, partial,
      generated.candidate, Buffer.from(DEMO_SOURCE, "utf8")));

    assert.throws(() => applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack, [
      { proposalId: "m5b-fedex-registrant-identity", disposition: "accept" },
      { proposalId: "m5b-fedex-registrant-identity", disposition: "reject" },
    ], generated.candidate), /decision_duplicate_id/);
    assert.throws(() => applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack, [
      { proposalId: "unknown", disposition: "accept" },
    ], generated.candidate), /decision_unknown_id/);
    assert.throws(() => applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack, [
      { disposition: "accept" },
    ], generated.candidate), /envelope/);

    const all = applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack,
      generated.reviewPacket.proposals.map((proposal) => ({ proposalId: proposal.proposalId, disposition: "accept" as const })),
      generated.candidate);
    assert.equal(all.allProposalsAccepted, true);
    assert.equal(all.retentionDraft, "pending");
    const retained = applyM5bFedExRetentionDraftSelection(all, "accept", generated.reviewPacket, generated.sourcePack,
      generated.candidate);
    assert.equal(retained.retentionDraft, "accept");
    assert.equal(retained.ratificationState, "unratified-draft");
    assert.equal(retained.satisfiesFutureArming, false);
    assert.notEqual(retained.reviewDraftSha256, all.reviewDraftSha256);

    const counterfeitDecision = clone(all) as any;
    counterfeitDecision.acceptedProposalIds = [];
    const { reviewDraftSha256: _draftHash, ...counterfeitDecisionContent } = counterfeitDecision;
    counterfeitDecision.reviewDraftSha256 = sha256M5bFedExCanonical(counterfeitDecisionContent);
    assert.throws(() => applyM5bFedExRetentionDraftSelection(counterfeitDecision, "accept", generated.reviewPacket,
      generated.sourcePack, generated.candidate), /review_draft_summary/);
  });

  test("refuses the committed demo and a rehashed flag/classification flip without serialized admission evidence", () => {
    const all = applyM5bFedExIndividualReviewDraftSelections(generated.reviewPacket, generated.sourcePack,
      generated.reviewPacket.proposals.map((proposal) => ({ proposalId: proposal.proposalId, disposition: "accept" as const })),
      generated.candidate);
    const retained = applyM5bFedExRetentionDraftSelection(all, "accept", generated.reviewPacket, generated.sourcePack,
      generated.candidate);
    assert.throws(() => composeM5bFedExUnarmedFutureEffect(generated.sourcePack, generated.reviewPacket, retained,
      generated.candidate, Buffer.from(DEMO_SOURCE, "utf8")),
      /future_composition_production_admission/);

    const productionLookingPack = clone(generated.sourcePack) as any;
    productionLookingPack.exactProductionCustodyAdmissionCompleted = true;
    productionLookingPack.fixtureClassification = "exact-production-custody-admitted";
    const { sourcePackSha256: _fixtureHash, ...productionLookingContent } = productionLookingPack;
    productionLookingPack.sourcePackSha256 = sha256M5bFedExCanonical(productionLookingContent);
    assert.equal(productionLookingPack.productionAdmissionEvidence, null);
    assert.throws(() => verifyM5bFedExSanitizedSourcePack(productionLookingPack), /source_pack_admission_evidence/);
    assert.throws(() => composeM5bFedExUnarmedFutureEffect(productionLookingPack, generated.reviewPacket, retained,
      generated.candidate, Buffer.from(DEMO_SOURCE, "utf8")),
      /source_pack_admission_evidence/);

    assert.deepEqual(refuseM5bFedExPreEffectExecution({ kind: "synthetic-pack-never-composed" }), {
      outcome: "refused_pre_effect",
      reason: "later-external-ratification-exact-approval-and-one-shot-arming-required",
      privateReads: 0, providerCalls: 0, graphDurableWrites: 0, acquisitions: 0, deployments: 0, retries: 0,
      externalProductEffects: 0,
    });
  });

  test("refuses the complete public-constant admission forgery when supplied non-custody fixture bytes", () => {
    const forgedPack = clone(generated.sourcePack) as any;
    forgedPack.exactProductionCustodyAdmissionCompleted = true;
    forgedPack.fixtureClassification = "exact-production-custody-admitted";
    forgedPack.fixtureInputSha256 = null;
    forgedPack.origin = "system-acquired-public";
    forgedPack.source.sourceType = "system_acquired_sec_submissions_bounded_projection";
    forgedPack.source.sourceSha256 = M5B_FEDEX_PRODUCTION_PINS.responseSha256;
    forgedPack.productionAdmissionEvidence = {
      state: "exact-production-custody-admission-completed",
      custodyArtifactSha256: M5B_FEDEX_PRODUCTION_PINS.custodyArtifactSha256,
      decodedResponseBytes: M5B_FEDEX_PRODUCTION_PINS.decodedResponseBytes,
      responseSha256: M5B_FEDEX_PRODUCTION_PINS.responseSha256,
      targetPolicySha256: M5B_FEDEX_PRODUCTION_PINS.targetPolicySha256,
      capabilityDescriptorSha256: M5B_FEDEX_PRODUCTION_PINS.capabilityDescriptorSha256,
      sourceUrl: M5B_FEDEX_PRODUCTION_PINS.sourceUrl,
      cik: M5B_FEDEX_PRODUCTION_PINS.cik,
      acquiredAt: M5B_FEDEX_PRODUCTION_PINS.acquiredAt,
    };
    const { sourcePackSha256: _oldPackHash, ...forgedPackContent } = forgedPack;
    forgedPack.sourcePackSha256 = sha256M5bFedExCanonical(forgedPackContent);
    const forgedCandidate = buildM5bFedExPrewriteCandidate(forgedPack);
    const forgedPacket = buildM5bFedExReviewPacket(forgedPack, forgedCandidate);
    const forgedDecisions = applyM5bFedExIndividualReviewDraftSelections(forgedPacket, forgedPack,
      forgedPacket.proposals.map((proposal) => ({ proposalId: proposal.proposalId, disposition: "accept" as const })),
      forgedCandidate);
    const forgedRetention = applyM5bFedExRetentionDraftSelection(forgedDecisions, "accept", forgedPacket, forgedPack,
      forgedCandidate);
    assertRefusalCode(() => composeM5bFedExUnarmedFutureEffect(forgedPack, forgedPacket, forgedRetention,
      forgedCandidate, Buffer.from(DEMO_SOURCE, "utf8")), "future_composition_production_admission");
  });
});

describe("M5b candidate, visible review, optional model seam, and regeneration", () => {
  const generated = generateM5bFedExDemoArtifacts(DEMO_SOURCE);

  test("candidate parses and validates with one source, two Maps, proposal ceilings, and zero verified records", () => {
    const bundle = generated.candidate.bundle;
    const parsed = parseGraphBundle(bundle);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const report = validateGraphBundle(parsed.value, { mode: "validation" });
    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
    assert.equal(bundle.sources.length, 1);
    assert.equal(bundle.claims.length, 2);
    assert.ok(bundle.excerpts.length <= 4);
    assert.ok(bundle.account_objects.length <= 3);
    assert.equal(bundle.account_objects.filter((item) => item.object_type === "account_snapshot").length, 2);
    assert.ok(bundle.excerpts.every((item) => item.validation_status === "proposed"));
    assert.ok(bundle.claims.every((item) => item.provenance_status === "unverified" && item.created_by === "system"));
    assert.ok(bundle.account_objects.every((item) => item.provenance_status === "unverified" && item.created_by === "system" &&
      item.payload_json.review_state === "pending human review"));
    assert.equal(report.metrics.verified_claims, 0);
    assert.equal(report.metrics.verified_account_objects, 0);

    const counterfeit = clone(generated.candidate) as any;
    counterfeit.bundle.account_objects[0].title = "Counterfeit card";
    counterfeit.candidateContentSha256 = sha256M5bFedExCanonical(counterfeit.bundle);
    assert.throws(() => verifyM5bFedExPrewriteCandidate(counterfeit, generated.sourcePack),
      /review_candidate_counterfeit/);
  });

  test("renders exact hero/copy, literal evidence, honest empty lenses, and only identity/classification claims", () => {
    const html = generated.html;
    for (const copy of [
      "FEDEX CORP", "FDX · NYSE", "CIK 0001048911", "SIC 4513 / Air Courier Services",
      "Fixture source timestamp", "2026-07-14T18:41:11.214Z", "one source", "zero independently verified objects",
      "Simulated SEC fixture source", "Unratified review draft; external ratification required",
      "Source-backed / not independently verified", "SEC registrant identity", "SEC industry classification",
      M5B_FEDEX_REQUIRED_IDENTITY_CLAIM, M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
      "/name", "/cik", "/tickers", "/exchanges", "/sic", "/sicDescription",
      "No Signals proposed", "No Plays proposed", "Current effective authorization: <strong>none</strong>",
    ]) assert.ok(html.includes(copy), `missing visible copy: ${copy}`);
    assert.match(html, /not a comprehensive description of FedEx’s current business/);
    assert.match(html, /rel="noreferrer noopener"/);
    assert.doesNotMatch(generated.candidate.bundle.claims.map((claim) => claim.text).join(" "),
      /stakeholder|personnel|strategic priorit|financial performance|financial trend|security need|technology need|buying intent|competitive|meeting brief|RFI|RFP/i);
  });

  test("labels committed machine and HTML artifacts only as simulated fixture provenance", () => {
    assert.equal(generated.sourcePack.origin, "simulated-fixture");
    assert.equal(generated.candidate.origin, "simulated-fixture");
    assert.equal(generated.candidate.bundle.sources[0]?.source_type,
      "simulated_fixture_sec_submissions_bounded_projection");
    assert.doesNotMatch(canonicalM5bFedExJson(generated.sourcePack), /system-acquired-public/);
    assert.doesNotMatch(canonicalM5bFedExJson(generated.candidate),
      /system_acquired_sec_submissions_bounded_projection/);
    assert.match(generated.html, /Simulated SEC fixture source/);
    assert.match(generated.html, /Fixture source SHA-256/);
    assert.doesNotMatch(generated.html, /System-acquired SEC source|Production response SHA-256/);
  });

  test("escapes labels and only emits safe credential-free http/https links", () => {
    const safe = renderM5bFedExSafeSourceLink("https://example.com/a?x=1&y=2", "<SEC & source>");
    assert.match(safe, /^<a /);
    assert.match(safe, /rel="noreferrer noopener"/);
    assert.match(safe, /&lt;SEC &amp; source&gt;/);
    for (const unsafe of ["javascript:alert(1)", "https://user:pass@example.com/", "file:///tmp/private", "not a url"]) {
      const rendered = renderM5bFedExSafeSourceLink(unsafe, "<unsafe>");
      assert.doesNotMatch(rendered, /<a /);
      assert.match(rendered, /&lt;unsafe&gt;/);
    }
  });

  test("keeps the optional model transport closed and rejects invented citations or both item types", () => {
    const aligned = boundedFrom({ filings: { recent: {
      form: ["8-K"], filingDate: ["2026-02-02"], accessionNumber: ["0001048911-26-000002"], primaryDocument: ["b.htm"],
    } } });
    const pack = buildM5bFedExSanitizedSourcePack(aligned);
    const candidate = buildM5bFedExPrewriteCandidate(pack);
    const request = buildM5bFedExOptionalModelRequest(pack, candidate.bundle.excerpts.map((item) => item.id));
    assert.equal(request.input, "exact-sanitized-source-pack");
    assert.equal(request.sourcePackSha256, pack.sourcePackSha256);
    assert.deepEqual(request.sanitizedSourcePack, pack);
    assert.deepEqual({ transport: request.transport, maxFutureCalls: request.maxFutureCalls, retries: request.retries,
      provider: request.provider, model: request.model, authorizesProviderCall: request.authorizesProviderCall,
      tools: request.tools, shell: request.shell, files: request.files, web: request.web, mcp: request.mcp,
      retrieval: request.retrieval, plugins: request.plugins, sessionCarryover: request.sessionCarryover },
    { transport: "model-only", maxFutureCalls: 1, retries: 0, provider: null, model: null, authorizesProviderCall: false,
      tools: false, shell: false, files: false, web: false, mcp: false, retrieval: false, plugins: false,
      sessionCarryover: false });
    const cited = [candidate.bundle.excerpts[2]!.id];
    const play = validateM5bFedExOptionalModelOutput(request, { signal: null,
      play: { text: M5B_FEDEX_RESTRAINED_PLAY, citedExcerptIds: cited, provenanceStatus: "unverified" } }, pack);
    assert.equal(play.play?.text, M5B_FEDEX_RESTRAINED_PLAY);
    assert.throws(() => validateM5bFedExOptionalModelOutput(request, { signal: null,
      play: { text: M5B_FEDEX_RESTRAINED_PLAY, citedExcerptIds: ["exc_invented"], provenanceStatus: "unverified" } }, pack),
    /model_filing_citation_exact/);
    const signal = { text: request.allowedSignalText, citedExcerptIds: cited, provenanceStatus: "unverified" };
    assert.throws(() => validateM5bFedExOptionalModelOutput(request, { signal,
      play: { text: M5B_FEDEX_RESTRAINED_PLAY, citedExcerptIds: cited, provenanceStatus: "unverified" } }, pack), /model_both_items/);
    assert.throws(() => validateM5bFedExOptionalModelOutput(request, { signal: null,
      play: { text: "Discuss strategic priorities.", citedExcerptIds: cited, provenanceStatus: "unverified" } }, pack), /model_item_content/);
    assert.throws(() => validateM5bFedExOptionalModelOutput(request, { signal: null,
      play: { text: M5B_FEDEX_RESTRAINED_PLAY, citedExcerptIds: cited, provenanceStatus: "verified" } }, pack),
    /model_item_content/);

    for (const invalidCitations of [
      ["exc_fedex_latest_filing_metadata", "exc_fedex_latest_filing_metadata"],
      ["exc_fedex_registrant_identity"],
      ["exc_fedex_industry_classification"],
      ["exc_fedex_latest_filing_metadata", "exc_fedex_registrant_identity"],
      ["exc_invented"],
      [],
    ]) {
      assertRefusalCode(() => validateM5bFedExOptionalModelOutput(request, { signal: null,
        play: { text: M5B_FEDEX_RESTRAINED_PLAY, citedExcerptIds: invalidCitations,
          provenanceStatus: "unverified" } }, pack), "model_filing_citation_exact");
    }

    const counterfeitRequest = { ...request, allowedSignalText: "FedEx financial performance changed." };
    assert.throws(() => validateM5bFedExOptionalModelOutput(counterfeitRequest, { signal: null, play: null }, pack),
      /model_request_counterfeit/);

    const mismatchedPackRequest = { ...request, sanitizedSourcePack: generated.sourcePack };
    assert.throws(() => validateM5bFedExOptionalModelOutput(mismatchedPackRequest, { signal: null, play: null }, pack),
      /model_request_source_pack/);
    const counterfeitPackRequest = clone(request) as any;
    counterfeitPackRequest.sanitizedSourcePack.selectedIdentity.name = "OTHER";
    const { sourcePackSha256: _embeddedHash, ...embeddedContent } = counterfeitPackRequest.sanitizedSourcePack;
    counterfeitPackRequest.sanitizedSourcePack.sourcePackSha256 = sha256M5bFedExCanonical(embeddedContent);
    assert.throws(() => validateM5bFedExOptionalModelOutput(counterfeitPackRequest, { signal: null, play: null }, pack),
      /source_pack_boundary/);
  });

  test("regenerates all three committed artifacts byte-for-byte from only the committed fixture", () => {
    assert.equal(generated.sourcePackJson,
      readFileSync(join(ROOT, "fixtures/validation/m5b-fedex-system-acquired-demo-source-pack.json"), "utf8"));
    assert.equal(generated.reviewPacketJson,
      readFileSync(join(ROOT, "fixtures/validation/m5b-fedex-system-acquired-review-packet.json"), "utf8"));
    assert.equal(generated.html,
      readFileSync(join(ROOT, "fixtures/workshop/m5b-fedex-system-acquired-prewrite-review.html"), "utf8"));
  });

  test("leaves characterized M4 and M5a production source bytes unchanged", () => {
    const expected = new Map([
      ["src/capability/m4-sec-extraction.ts", "47ce47151bc43cc89d9147e555e0467312002d9b359ae82b077e6332dfa6e3d2"],
      ["src/capability/m4-target-policy.ts", "446499764aa1592cd526a3be0d3ed1c6898a0a61b35d4b29e8bd5c3d017c0e7a"],
      ["src/workshop/m5a-curated-proposal-flow-contract.ts", "af92b138a702d9bf762ee8c470863af7e580bc30d0b9a5f0c0a22f329eed3db5"],
      ["src/workshop/m5a-curated-proposal-flow-execution.ts", "abd29063d47448fd1a667e4669467306683881e833a4eebaa07a04c9c36e902b"],
    ]);
    for (const [relative, digest] of expected) {
      assert.equal(hashBytes(readFileSync(join(ROOT, relative))), digest, relative);
    }
  });
});
