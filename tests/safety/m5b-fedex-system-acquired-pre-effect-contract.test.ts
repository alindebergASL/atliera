import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const STATUS_PATH = "docs/runbooks/m5b-fedex-system-acquired-pre-effect-gate-a-status.md";
const SOURCE_PATH = "src/workshop/m5b-fedex-system-acquired-source.ts";
const REVIEW_PATH = "src/workshop/m5b-fedex-review-composition.ts";
const WORKSHOP_PATH = "src/workshop/m5b-fedex-prewrite-workshop.ts";
const SOURCE_PACK_PATH = "fixtures/validation/m5b-fedex-system-acquired-demo-source-pack.json";
const PACKET_PATH = "fixtures/validation/m5b-fedex-system-acquired-review-packet.json";
const HTML_PATH = "fixtures/workshop/m5b-fedex-system-acquired-prewrite-review.html";

function roadmapRow(document: string): string {
  const rows = document.split("\n").filter((line) => line.startsWith("| **M5b —"));
  assert.equal(rows.length, 1);
  return rows[0]!;
}

test("M5b Gate A status cannot drift to authorization, shipping, or effects", () => {
  const status = read(STATUS_PATH);
  const roadmap = read("docs/strategy/roadmap.md");
  const index = read("docs/runbooks/INDEX.md");
  for (const document of [status, roadmap]) {
    assert.match(document, /implementation_work_authorized: none/);
    assert.match(document, /current_effective_authorization: none/);
  }
  for (const marker of [
    "authorizes_private_custody_read: false",
    "authorizes_provider_call: false",
    "authorizes_acquisition: false",
    "authorizes_graph_ingestion: false",
    "authorizes_durable_write: false",
    "authorizes_deployment: false",
    "authorizes_retry: false",
    "private_reads: 0",
    "provider_calls: 0",
    "acquisitions: 0",
    "graph_writes: 0",
    "deployments: 0",
    "external_product_effects: 0",
    "retries: 0",
    "local_deterministic_fixture_outputs_written: 3",
    "independently_verified_objects: 0",
    "readiness_claim: false",
    "shipped_claim: false",
  ]) assert.ok(status.includes(marker), marker);
  assert.match(roadmapRow(roadmap), /🔶 in progress — repository-native product path implemented for review; real execution unauthorized/);
  assert.doesNotMatch(roadmapRow(roadmap), /✅ shipped/);
  assert.match(index, /m5b-fedex-system-acquired-pre-effect-gate-a-status\.md/);
  assert.match(index, /repository-native[^\n]*M5b|M5b[^\n]*repository-native/i);
  assert.match(status, /next possible private-read gate is not authorized/i);
  assert.match(status, /approval of PR #289 on its then-current exact head/i);
  assert.match(status, /successful post-merge CI/i);
  assert.match(status, /resulting merge commit SHA and tree/i);
  assert.match(status, /exact custody artifact identity plus a separately supplied private path/i);
  assert.match(status, /before `2026-08-13T18:41:11\.277Z` unless a separately ratified bounded retention decision/i);
});

test("M5b production surface stays byte-only, narrow, unarmed, and path-free", () => {
  const source = read(SOURCE_PATH);
  const review = read(REVIEW_PATH);
  const workshop = read(WORKSHOP_PATH);
  assert.match(source, /admitM5bFedExProductionCustodyBytes\(custodyBytes: Uint8Array\)/);
  assert.match(source, /extractM5bFedExCommittedFixtureSource\(responseBytes: Uint8Array\)/);
  assert.doesNotMatch(source, /export function extractM5bFedExBoundedSource\(/);
  assert.doesNotMatch(source, /export interface M5bFedExBoundedExtractionOptions/);
  assert.match(source, /custodyInputBytes: 1_048_576/);
  assert.match(source, /const custodyByteLength = intrinsicUint8ArrayByteLength\(custodyBytes, "custody"\)/);
  assert.match(source, /if \(custodyByteLength > M5B_FEDEX_INPUT_LIMITS\.custodyInputBytes\) refuse\("custody_input_bytes"\)/);
  assert.match(source, /if \(sha256Bytes\(copied\) !== pins\.custodyArtifactSha256\) refuse\("custody_sha256"\)/);
  assert.match(source, /extractM4SecEvidence\(acquisition/);
  assert.match(source, /sanitizedSourcePack: Readonly<M5bFedExSanitizedSourcePack>/);
  assert.match(source, /productionAdmissionEvidence: Readonly<M5bFedExProductionAdmissionEvidence> \| null/);
  assert.match(review, /future_composition_production_admission/);
  assert.match(review, /exactCustodyBytesInput: Uint8Array/);
  assert.match(review, /admitM5bFedExProductionCustodyBytes\(exactCustodyBytesInput\)/);
  assert.match(review, /buildM5bFedExSanitizedSourcePack/);
  assert.match(review, /verifyM5bFedExPrewriteCandidate/);
  assert.match(review, /buildM5bFedExReviewPacket\(packInput: unknown,\s*candidateInput: unknown\)/);
  assert.doesNotMatch(review, /buildM5bFedExReviewPacket\([^)]*candidateContentSha256/);
  assert.match(review, /ratificationState: "unratified-draft"/);
  assert.match(review, /satisfiesFutureArming: false/);
  assert.match(review, /humanRatificationSatisfied: false/);
  assert.match(review, /eligibleForFutureArming: false/);
  assert.match(review, /reviewDraftSha256/);
  assert.doesNotMatch(review, /decisionArtifactSha256/);
  assert.doesNotMatch(source, /readFile|createReadStream|openSync|dbRootDir|writerCallback/);
  assert.doesNotMatch(review, /readFile|createReadStream|openSync|dbRootDir|writerCallback/);
  assert.doesNotMatch(source, /https?\.(get|request)|fetch\(|provider\.invoke|child_process/);
  assert.doesNotMatch(review, /https?\.(get|request)|fetch\(|provider\.invoke|child_process/);
  assert.doesNotMatch(workshop, /https?\.(get|request)|fetch\(|provider\.invoke|child_process/);
  assert.match(review, /containsDbPath: false/);
  assert.match(review, /containsWriterCallback: false/);
  assert.match(review, /containsExecutionMethod: false/);
  assert.match(review, /containsWriteCapableClosure: false/);
  assert.match(review, /effectAuthority: false/);
});

test("hostile-input bounds are named and enforced before proportional reflection or decoding", () => {
  const source = read(SOURCE_PATH);
  for (const name of ["objectOwnPropertyCount", "primitiveLeafAndPropertyCount", "stringUtf8Bytes",
    "cumulativeCanonicalUtf8Bytes", "custodyInputBytes", "responseInputBytes", "recursionDepth", "arraySize", "totalNodes"]) {
    assert.match(source, new RegExp(`${name}:`), name);
  }
  const snapshot = source.slice(source.indexOf("function snapshotM5bFedExOwnDataInternal"),
    source.indexOf("export function snapshotM5bFedExOwnData"));
  assert.ok(snapshot.indexOf("Object.getOwnPropertyNames(value)") <
    snapshot.indexOf("Object.getOwnPropertyDescriptor(value, key)"));
  assert.match(snapshot, /names\.length > M5B_FEDEX_INPUT_LIMITS\.objectOwnPropertyCount/);
  assert.doesNotMatch(snapshot, /Object\.getOwnPropertyDescriptors/);
  const canonical = source.slice(source.indexOf("export function canonicalM5bFedExJson"),
    source.indexOf("export function sha256M5bFedExCanonical"));
  assert.match(canonical, /canonical_utf8_budget/);
  assert.match(canonical, /canonical_recursion_depth/);
  assert.match(canonical, /canonical_cycle/);
  const byteBoundary = source.slice(source.indexOf("function intrinsicUint8ArrayByteLength"),
    source.indexOf("function strictJsonBytes"));
  assert.ok(byteBoundary.indexOf("utilTypes.isProxy(value)") < byteBoundary.indexOf("utilTypes.isUint8Array(value)"));
  assert.match(byteBoundary, /Reflect\.apply\(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, \[\]\)/);
  assert.doesNotMatch(byteBoundary, /value\.byteLength|instanceof Uint8Array/);
  const strictBytes = source.slice(source.indexOf("function strictJsonBytes"),
    source.indexOf("export interface M5bFedExLiteralField"));
  assert.ok(strictBytes.indexOf("intrinsicUint8ArrayByteLength(bytesInput, label)") <
    strictBytes.indexOf("Buffer.from(plainIntrinsicUint8ArrayView(bytesInput, byteLength, label))"));
  assert.doesNotMatch(strictBytes, /Buffer\.from\(bytesInput\)|bytesInput\.byteLength/);
  const custody = source.slice(source.indexOf("export function validateM5bFedExCustodyBytesAgainstPins"),
    source.indexOf("export function admitM5bFedExProductionCustodyBytes"));
  assert.ok(custody.indexOf("intrinsicUint8ArrayByteLength(custodyBytes, \"custody\")") <
    custody.indexOf("Buffer.from(plainIntrinsicUint8ArrayView(custodyBytes, custodyByteLength, \"custody\"))"));
  assert.doesNotMatch(custody, /Buffer\.from\(custodyBytes\)|custodyBytes\.byteLength|instanceof Uint8Array/);
  assert.ok(custody.indexOf("response_base64_bounds") < custody.indexOf('Buffer.from(bodyBase64, "base64")'));
});

test("future composition re-admits supplied custody bytes and never treats serialized hashes as authority", () => {
  const source = read(SOURCE_PATH);
  const review = read(REVIEW_PATH);
  const composer = review.slice(review.indexOf("export function composeM5bFedExUnarmedFutureEffect"),
    review.indexOf("export function refuseM5bFedExPreEffectExecution"));
  assert.match(composer, /admitM5bFedExProductionCustodyBytes\(exactCustodyBytesInput\)/);
  assert.match(composer, /buildM5bFedExSanitizedSourcePack/);
  assert.match(composer, /canonicalM5bFedExJson\(admittedPack\) !== canonicalM5bFedExJson\(suppliedPack\)/);
  assert.match(composer, /verifyM5bFedExPrewriteCandidate\(candidateInput, suppliedPack\)/);
  assert.doesNotMatch(composer, /productionAdmissionEvidence|hasExactSerializedProductionAdmission|WeakSet|Object\.is\(/);
  assert.doesNotMatch(source, /hasExactSerializedProductionAdmission/);
});

test("committed source pack, review packet, and HTML preserve the exact pre-effect product contract", () => {
  const pack = JSON.parse(read(SOURCE_PACK_PATH)) as Record<string, any>;
  const packet = JSON.parse(read(PACKET_PATH)) as Record<string, any>;
  const html = read(HTML_PATH);
  assert.equal(pack.fixtureClassification,
    "synthetic/committed-public pre-effect fixture; exact private source admission not completed");
  assert.equal(pack.schemaVersion, "2");
  assert.equal(pack.exactProductionCustodyAdmissionCompleted, false);
  assert.equal(pack.productionAdmissionEvidence, null);
  assert.equal(pack.origin, "simulated-fixture");
  assert.equal(pack.source.sourceType, "simulated_fixture_sec_submissions_bounded_projection");
  assert.equal(pack.source.sourceSha256, pack.fixtureInputSha256);
  assert.equal(pack.trustStatus, "source-backed-not-independently-verified");
  assert.equal(pack.filing, null);
  assert.equal(pack.filingAlignment, "empty");
  assert.equal(Object.values(pack.exclusions).every((value) => value === true), true);
  assert.doesNotMatch(JSON.stringify(pack), /quotedBodyText|bodyBase64|connectedAddress|resolvedAddresses/);

  assert.equal(packet.boundaryMarker, "m5b-gate-a-pre-effect-unarmed");
  assert.equal(packet.current_effective_authorization, "none");
  assert.equal(packet.ratificationState, "unratified-draft");
  assert.equal(packet.satisfiesFutureArming, false);
  assert.equal(packet.proposals.length, 2);
  assert.equal(packet.proposals[0].proposedClaim,
    "The SEC submissions record identifies FEDEX CORP, CIK 0001048911, with ticker FDX on NYSE.");
  assert.equal(packet.proposals[1].proposedClaim,
    "The SEC classifies the registrant under SIC 4513, “Air Courier Services.”");
  assert.ok(packet.proposals.every((proposal: any) => proposal.disposition === "pending" &&
    proposal.trustStatus === "source-backed-not-independently-verified"));
  assert.equal(packet.retentionDraft.disposition, "pending");
  assert.equal(packet.retentionDraft.ratificationState, "unratified-draft");
  assert.equal(packet.retentionDraft.externalRatificationRequired, true);
  assert.equal(packet.retentionDraft.satisfiesFutureArming, false);
  assert.equal(packet.boundaries.externalProductEffects, 0);
  assert.equal(packet.boundaries.verifiedObjects, 0);

  for (const exact of [
    "FEDEX CORP",
    "FDX · NYSE",
    "CIK 0001048911",
    "SIC 4513 / Air Courier Services",
    "Fixture source timestamp",
    "Simulated SEC fixture source",
    "Fixture source SHA-256",
    "Unratified review draft; external ratification required",
    "Source-backed / not independently verified",
    "one source",
    "zero independently verified objects",
    "No Signals proposed",
    "No Plays proposed",
  ]) assert.ok(html.includes(exact), exact);
  assert.match(html, /Air Courier Services” is not a comprehensive description of FedEx’s current business/);
  assert.doesNotMatch(html, /System-acquired SEC source|Production response SHA-256/);
  assert.doesNotMatch(html, />Verified</);
  assert.doesNotMatch(html, /Meeting Brief|RFI|RFP/);
});

test("the fixed generator has only the committed input and three committed outputs", () => {
  const script = read("scripts/generate-m5b-fedex-system-acquired-prewrite.mts");
  assert.match(script, /fixtures\/validation\/m5b-fedex-system-acquired-demo-source\.json/);
  assert.match(script, /fixtures\/validation\/m5b-fedex-system-acquired-demo-source-pack\.json/);
  assert.match(script, /fixtures\/validation\/m5b-fedex-system-acquired-review-packet\.json/);
  assert.match(script, /fixtures\/workshop\/m5b-fedex-system-acquired-prewrite-review\.html/);
  assert.doesNotMatch(script, /process\.argv|fetch\(|https?:|provider|dbRootDir|private|durable/);
  assert.equal((script.match(/writeFile\(/g) ?? []).length, 3);
});
