import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const STATUS_PATH = "docs/runbooks/m5b-fedex-system-acquired-pre-effect-gate-a-status.md";
const SOURCE_PATH = "src/workshop/m5b-fedex-system-acquired-source.ts";
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
    "effects: 0",
    "retries: 0",
    "independently_verified_objects: 0",
    "readiness_claim: false",
    "shipped_claim: false",
  ]) assert.ok(status.includes(marker), marker);
  assert.match(roadmapRow(roadmap), /🔶 in progress — Gate A pre-effect, not shipped/);
  assert.doesNotMatch(roadmapRow(roadmap), /✅ shipped/);
  assert.match(index, /m5b-fedex-system-acquired-pre-effect-gate-a-status\.md/);
  assert.match(index, /M5b is 🔶 in progress, not shipped/);
  assert.match(status, /separately authorized (?:private custody read|reader)/);
});

test("M5b production surface stays byte-only, narrow, unarmed, and path-free", () => {
  const source = read(SOURCE_PATH);
  const workshop = read(WORKSHOP_PATH);
  assert.match(source, /admitM5bFedExProductionCustodyBytes\(custodyBytes: Uint8Array\)/);
  assert.match(source, /extractM5bFedExCommittedFixtureSource\(responseBytes: Uint8Array\)/);
  assert.doesNotMatch(source, /export function extractM5bFedExBoundedSource\(/);
  assert.doesNotMatch(source, /export interface M5bFedExBoundedExtractionOptions/);
  assert.match(source, /if \(sha256Bytes\(copied\) !== pins\.custodyArtifactSha256\) refuse\("custody_sha256"\)/);
  assert.match(source, /extractM4SecEvidence\(acquisition/);
  assert.match(source, /sanitizedSourcePack: Readonly<M5bFedExSanitizedSourcePack>/);
  assert.match(source, /future_composition_production_admission/);
  assert.match(source, /productionAdmissionEvidence: Readonly<M5bFedExProductionAdmissionEvidence> \| null/);
  assert.doesNotMatch(source, /readFile|createReadStream|openSync|dbRootDir|writerCallback/);
  assert.doesNotMatch(source, /https?\.(get|request)|fetch\(|provider\.invoke|child_process/);
  assert.doesNotMatch(workshop, /https?\.(get|request)|fetch\(|provider\.invoke|child_process/);
  assert.match(source, /containsDbPath: false/);
  assert.match(source, /containsWriterCallback: false/);
  assert.match(source, /containsExecutionMethod: false/);
  assert.match(source, /containsWriteCapableClosure: false/);
  assert.match(source, /effectAuthority: false/);
});

test("serialized exact-pack verification and composition have no WeakSet or object-identity prerequisite", () => {
  const source = read(SOURCE_PATH);
  const evidenceValidator = source.slice(source.indexOf("function validateProductionAdmissionEvidence"),
    source.indexOf("function hasExactSerializedProductionAdmission"));
  const serializedAdmission = source.slice(source.indexOf("function hasExactSerializedProductionAdmission"),
    source.indexOf("function validateSourcePackSemantics"));
  const verifier = source.slice(source.indexOf("export function verifyM5bFedExSanitizedSourcePack"),
    source.indexOf("export interface M5bFedExEvidenceBinding"));
  const composer = source.slice(source.indexOf("export function composeM5bFedExUnarmedFutureEffect"),
    source.indexOf("export function refuseM5bFedExPreEffectExecution"));
  assert.doesNotMatch(source, /M5B_FEDEX_EXACT_PRODUCTION_SOURCE_PACKS/);
  for (const field of ["state", "custodyArtifactSha256", "decodedResponseBytes", "responseSha256",
    "targetPolicySha256", "capabilityDescriptorSha256", "sourceUrl", "cik", "acquiredAt"]) {
    assert.ok(evidenceValidator.includes(`"${field}"`), field);
    assert.ok(serializedAdmission.includes(`evidence.${field}`), field);
  }
  assert.match(serializedAdmission, /productionAdmissionEvidence/);
  assert.match(verifier, /productionAdmissionEvidence/);
  assert.match(composer, /hasExactSerializedProductionAdmission/);
  assert.doesNotMatch(`${evidenceValidator}\n${serializedAdmission}\n${verifier}\n${composer}`,
    /WeakSet|\.has\(packInput\)|\bpackInput\s*(?:===|!==)|Object\.is\(/);
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
  assert.equal(pack.origin, "system-acquired-public");
  assert.equal(pack.trustStatus, "source-backed-not-independently-verified");
  assert.equal(pack.source.upstreamResponseSha256,
    "ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d");
  assert.equal(pack.filing, null);
  assert.equal(pack.filingAlignment, "empty");
  assert.equal(Object.values(pack.exclusions).every((value) => value === true), true);
  assert.doesNotMatch(JSON.stringify(pack), /quotedBodyText|bodyBase64|connectedAddress|resolvedAddresses/);

  assert.equal(packet.boundaryMarker, "m5b-gate-a-pre-effect-unarmed");
  assert.equal(packet.current_effective_authorization, "none");
  assert.equal(packet.proposals.length, 2);
  assert.equal(packet.proposals[0].proposedClaim,
    "The SEC submissions record identifies FEDEX CORP, CIK 0001048911, with ticker FDX on NYSE.");
  assert.equal(packet.proposals[1].proposedClaim,
    "The SEC classifies the registrant under SIC 4513, “Air Courier Services.”");
  assert.ok(packet.proposals.every((proposal: any) => proposal.disposition === "pending" &&
    proposal.trustStatus === "source-backed-not-independently-verified"));
  assert.equal(packet.retentionDecision.disposition, "pending");
  assert.equal(packet.retentionDecision.separateHumanDecisionRequired, true);
  assert.equal(packet.boundaries.effects, 0);
  assert.equal(packet.boundaries.verifiedObjects, 0);

  for (const exact of [
    "FEDEX CORP",
    "FDX · NYSE",
    "CIK 0001048911",
    "SIC 4513 / Air Courier Services",
    "Acquired-source timestamp",
    "System-acquired SEC source",
    "Pending human ratification before persistence",
    "Source-backed / not independently verified",
    "one source",
    "zero independently verified objects",
    "No Signals proposed",
    "No Plays proposed",
  ]) assert.ok(html.includes(exact), exact);
  assert.match(html, /Air Courier Services” is not a comprehensive description of FedEx’s current business/);
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
