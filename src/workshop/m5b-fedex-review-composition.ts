import { parseGraphBundle } from "../graph/schema.ts";
import type { GraphBundle } from "../graph/types.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import {
  M5B_FEDEX_FIXTURE_ORIGIN,
  M5B_FEDEX_PRODUCTION_PINS,
  M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
  M5B_FEDEX_REQUIRED_IDENTITY_CLAIM,
  M5B_FEDEX_REVIEW_STATE,
  M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN,
  M5B_FEDEX_TRUST_STATUS,
  M5bFedExRefusal,
  admitM5bFedExProductionCustodyBytes,
  buildM5bFedExSanitizedSourcePack,
  canonicalM5bFedExJson,
  sha256M5bFedExCanonical,
  snapshotM5bFedExOwnData,
  verifyM5bFedExSanitizedSourcePack,
  type M5bFedExLiteralField,
  type M5bFedExSanitizedSourcePack,
  type M5bFedExTransformation,
} from "./m5b-fedex-system-acquired-source.ts";

const SAFE_HASH = /^[a-f0-9]{64}$/;
const CAPTURED_AT = "2026-07-14T18:41:11.214Z";
const TEAM_ID = "team_atliera_workshop";
const ACCOUNT_ID = "acc_fedex_corp";
const SOURCE_ID = "src_fedex_sec_submissions";

function refuse(code: string): never {
  throw new M5bFedExRefusal(code);
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) refuse(`${label}_object`);
  return value as Readonly<Record<string, unknown>>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) refuse(`${label}_array`);
  return value;
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) refuse(`${label}_envelope`);
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") refuse(`${label}_string`);
  return value;
}

export interface M5bFedExPrewriteCandidate {
  readonly kind: "m5b-fedex-prewrite-graph-candidate";
  readonly schemaVersion: "2";
  readonly fixtureClassification: M5bFedExSanitizedSourcePack["fixtureClassification"];
  readonly origin: M5bFedExSanitizedSourcePack["origin"];
  readonly reviewState: typeof M5B_FEDEX_REVIEW_STATE;
  readonly sourcePackSha256: string;
  readonly bundle: GraphBundle;
  readonly candidateContentSha256: string;
  readonly boundaries: {
    readonly current_effective_authorization: "none";
    readonly prewrite: true;
    readonly writePerformed: false;
    readonly privateReads: 0;
    readonly providerCalls: 0;
    readonly graphDurableWrites: 0;
    readonly acquisitions: 0;
    readonly deployments: 0;
    readonly retries: 0;
    readonly externalProductEffects: 0;
    readonly verifiedObjects: 0;
  };
}

function evidenceBlock(pack: M5bFedExSanitizedSourcePack,
  pointers: readonly M5bFedExLiteralField["jsonPointer"][]): string {
  const fields = pointers.map((pointer) => {
    const field = pack.fields.find((candidate) => candidate.jsonPointer === pointer);
    if (!field) refuse(`candidate_missing_${pointer}`);
    return field;
  });
  return canonicalM5bFedExJson(fields);
}

function proposedExcerpt(id: string, text: string, rawText: string): GraphBundle["excerpts"][number] {
  const charStart = rawText.indexOf(text);
  if (charStart < 0 || rawText.indexOf(text, charStart + 1) >= 0) refuse("candidate_excerpt_locator");
  return { id, source_document_id: SOURCE_ID, text, kind: "literal", char_start: charStart,
    char_end: charStart + text.length, captured_at: CAPTURED_AT, validation_status: "proposed", rejection_reason: null };
}

function candidateBoundaries(): M5bFedExPrewriteCandidate["boundaries"] {
  return Object.freeze({ current_effective_authorization: "none", prewrite: true, writePerformed: false,
    privateReads: 0, providerCalls: 0, graphDurableWrites: 0, acquisitions: 0, deployments: 0, retries: 0,
    externalProductEffects: 0, verifiedObjects: 0 });
}

export function buildM5bFedExPrewriteCandidate(packInput: unknown): Readonly<M5bFedExPrewriteCandidate> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  const identityText = evidenceBlock(pack, ["/name", "/cik", "/tickers", "/exchanges"]);
  const classificationText = evidenceBlock(pack, ["/sic", "/sicDescription"]);
  const filingText = pack.filing ? evidenceBlock(pack, [`/filings/recent/form/${pack.filing.index}`,
    `/filings/recent/filingDate/${pack.filing.index}`, `/filings/recent/accessionNumber/${pack.filing.index}`,
    `/filings/recent/primaryDocument/${pack.filing.index}`]) : null;
  const rawText = [identityText, classificationText, filingText].filter((value): value is string => value !== null).join("\n");
  const excerpts: GraphBundle["excerpts"] = [
    proposedExcerpt("exc_fedex_registrant_identity", identityText, rawText),
    proposedExcerpt("exc_fedex_industry_classification", classificationText, rawText),
  ];
  if (filingText) excerpts.push(proposedExcerpt("exc_fedex_latest_filing_metadata", filingText, rawText));

  const claims: GraphBundle["claims"] = [
    { id: "clm_fedex_registrant_identity", team_id: TEAM_ID, account_id: ACCOUNT_ID,
      claim_type: "sec_registrant_identity", text: M5B_FEDEX_REQUIRED_IDENTITY_CLAIM,
      normalized_subject: "fedex_corp:sec_registrant_identity", confidence: "medium", provenance_status: "unverified",
      status: "active", created_by: "system", created_at: CAPTURED_AT },
    { id: "clm_fedex_industry_classification", team_id: TEAM_ID, account_id: ACCOUNT_ID,
      claim_type: "sec_industry_classification", text: M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
      normalized_subject: "fedex_corp:sec_sic_4513", confidence: "medium", provenance_status: "unverified",
      status: "active", created_by: "system", created_at: CAPTURED_AT },
  ];
  if (pack.filing) claims.push({ id: "clm_fedex_latest_filing_metadata", team_id: TEAM_ID, account_id: ACCOUNT_ID,
    claim_type: "sec_filing_metadata", text: `The SEC submissions metadata lists ${pack.filing.form}, filed ${pack.filing.filingDate}, accession ${pack.filing.accessionNumber}, primary document ${pack.filing.primaryDocument}.`,
    normalized_subject: "fedex_corp:latest_aligned_sec_filing_metadata", confidence: "medium",
    provenance_status: "unverified", status: "active", created_by: "system", created_at: CAPTURED_AT });

  const claimEvidence: GraphBundle["claim_evidence"] = [
    { id: "cev_fedex_registrant_identity", claim_id: "clm_fedex_registrant_identity",
      evidence_excerpt_id: "exc_fedex_registrant_identity", relationship: "supports",
      rationale: "Unratified bounded projection preserves the cited SEC identity literals and pointers.",
      confidence: "medium", created_at: CAPTURED_AT },
    { id: "cev_fedex_industry_classification", claim_id: "clm_fedex_industry_classification",
      evidence_excerpt_id: "exc_fedex_industry_classification", relationship: "supports",
      rationale: "Unratified bounded projection preserves the cited SEC SIC literals and pointers.",
      confidence: "medium", created_at: CAPTURED_AT },
  ];
  if (pack.filing) claimEvidence.push({ id: "cev_fedex_latest_filing_metadata",
    claim_id: "clm_fedex_latest_filing_metadata", evidence_excerpt_id: "exc_fedex_latest_filing_metadata",
    relationship: "supports", rationale: "Unratified bounded projection preserves one uniquely newest same-index filing metadata row.",
    confidence: "medium", created_at: CAPTURED_AT });

  const payloadOrigin = pack.origin;
  const accountObjects: GraphBundle["account_objects"] = [
    { id: "obj_fedex_registrant_identity", team_id: TEAM_ID, account_id: ACCOUNT_ID, object_type: "account_snapshot",
      title: "SEC registrant identity", summary: M5B_FEDEX_REQUIRED_IDENTITY_CLAIM,
      payload_json: { review_state: M5B_FEDEX_REVIEW_STATE, origin: payloadOrigin,
        source_pack_sha256: pack.sourcePackSha256, json_pointers: ["/name", "/cik", "/tickers", "/exchanges"] },
      confidence: "medium", provenance_status: "unverified", status: "active", created_by: "system",
      created_at: CAPTURED_AT, updated_at: CAPTURED_AT },
    { id: "obj_fedex_industry_classification", team_id: TEAM_ID, account_id: ACCOUNT_ID, object_type: "account_snapshot",
      title: "SEC industry classification", summary: M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
      payload_json: { review_state: M5B_FEDEX_REVIEW_STATE, origin: payloadOrigin,
        source_pack_sha256: pack.sourcePackSha256, json_pointers: ["/sic", "/sicDescription"],
        scope_caveat: "SEC SIC label only; not a comprehensive description of the registrant's current business." },
      confidence: "medium", provenance_status: "unverified", status: "active", created_by: "system",
      created_at: CAPTURED_AT, updated_at: CAPTURED_AT },
  ];
  if (pack.filing) accountObjects.push({ id: "obj_fedex_latest_filing_metadata", team_id: TEAM_ID,
    account_id: ACCOUNT_ID, object_type: "signal", title: "Newest aligned SEC filing metadata", summary: claims[2]!.text,
    payload_json: { review_state: M5B_FEDEX_REVIEW_STATE, origin: payloadOrigin,
      source_pack_sha256: pack.sourcePackSha256, metadata_only: true, filing_index: pack.filing.index },
    confidence: "medium", provenance_status: "unverified", status: "active", created_by: "system",
    created_at: CAPTURED_AT, updated_at: CAPTURED_AT });

  const accountObjectClaims: GraphBundle["account_object_claims"] = [
    { id: "oclm_fedex_registrant_identity", account_object_id: "obj_fedex_registrant_identity",
      claim_id: "clm_fedex_registrant_identity", relationship: "primary" },
    { id: "oclm_fedex_industry_classification", account_object_id: "obj_fedex_industry_classification",
      claim_id: "clm_fedex_industry_classification", relationship: "primary" },
  ];
  if (pack.filing) accountObjectClaims.push({ id: "oclm_fedex_latest_filing_metadata",
    account_object_id: "obj_fedex_latest_filing_metadata", claim_id: "clm_fedex_latest_filing_metadata",
    relationship: "primary" });

  const bundle: GraphBundle = {
    sources: [{ id: SOURCE_ID, team_id: TEAM_ID, account_id: ACCOUNT_ID, url: pack.source.url,
      canonical_url: pack.source.url, title: "SEC submissions — FEDEX CORP",
      publisher: "U.S. Securities and Exchange Commission", source_type: pack.source.sourceType,
      fetched_at: pack.source.acquiredAt, accessed_at: pack.source.acquiredAt,
      content_hash: `sha256:${pack.source.sourceSha256}`, raw_text: rawText, reliability: "unknown", status: "active" }],
    excerpts, claims, claim_evidence: claimEvidence, account_objects: accountObjects,
    account_object_claims: accountObjectClaims, research_runs: [], run_artifacts: [], audit_events: [],
  };
  const parsed = parseGraphBundle(bundle);
  if (!parsed.ok) refuse("candidate_schema");
  const report = validateGraphBundle(parsed.value, { mode: "validation" });
  if (!report.ok) refuse("candidate_graph");
  if (bundle.sources.length !== 1 || bundle.excerpts.length > 4 || bundle.claims.length < 2 ||
      bundle.claims.length > 3 || bundle.account_objects.length < 2 || bundle.account_objects.length > 3 ||
      bundle.claims.some((claim) => claim.provenance_status === "verified" || claim.created_by !== "system") ||
      bundle.account_objects.some((object) => object.provenance_status === "verified" || object.created_by !== "system") ||
      bundle.excerpts.some((excerpt) => excerpt.validation_status !== "proposed")) refuse("candidate_scope");
  const candidateContentSha256 = sha256M5bFedExCanonical(bundle);
  return Object.freeze({ kind: "m5b-fedex-prewrite-graph-candidate", schemaVersion: "2",
    fixtureClassification: pack.fixtureClassification, origin: pack.origin, reviewState: M5B_FEDEX_REVIEW_STATE,
    sourcePackSha256: pack.sourcePackSha256, bundle, candidateContentSha256, boundaries: candidateBoundaries() });
}

export function verifyM5bFedExPrewriteCandidate(candidateInput: unknown,
  packInput: unknown): Readonly<M5bFedExPrewriteCandidate> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  if (candidateInput === null || typeof candidateInput !== "object" || Array.isArray(candidateInput)) {
    refuse("review_candidate_required");
  }
  const candidate = record(snapshotM5bFedExOwnData(candidateInput, "reviewCandidate"),
    "reviewCandidate") as unknown as M5bFedExPrewriteCandidate;
  if (candidate.kind !== "m5b-fedex-prewrite-graph-candidate" || candidate.schemaVersion !== "2" ||
      candidate.origin !== pack.origin || candidate.fixtureClassification !== pack.fixtureClassification ||
      candidate.reviewState !== M5B_FEDEX_REVIEW_STATE || candidate.sourcePackSha256 !== pack.sourcePackSha256 ||
      !SAFE_HASH.test(candidate.candidateContentSha256) ||
      candidate.candidateContentSha256 !== sha256M5bFedExCanonical(candidate.bundle) ||
      canonicalM5bFedExJson(candidate.boundaries) !== canonicalM5bFedExJson(candidateBoundaries())) {
    refuse("review_candidate_counterfeit");
  }
  const parsed = parseGraphBundle(candidate.bundle);
  if (!parsed.ok || !validateGraphBundle(parsed.value, { mode: "validation" }).ok) refuse("review_candidate_counterfeit");
  const expected = buildM5bFedExPrewriteCandidate(pack);
  if (canonicalM5bFedExJson(candidate) !== canonicalM5bFedExJson(expected)) refuse("review_candidate_counterfeit");
  return Object.freeze(candidate);
}

export interface M5bFedExEvidenceBinding {
  readonly jsonPointer: M5bFedExLiteralField["jsonPointer"];
  readonly literal: M5bFedExLiteralField["literal"];
  readonly locator: { readonly document: "sanitized-source-pack-canonical-json";
    readonly charStart: number; readonly charEnd: number };
}

export interface M5bFedExReviewProposal {
  readonly proposalId: string;
  readonly proposedLens: "maps" | "signals";
  readonly proposedCard: string;
  readonly proposedClaim: string;
  readonly sourceLiterals: readonly M5bFedExEvidenceBinding[];
  readonly sourceUrl: typeof M5B_FEDEX_PRODUCTION_PINS.sourceUrl;
  readonly sourceContentSha256: string;
  readonly sanitizedSourcePackSha256: string;
  readonly transformations: readonly M5bFedExTransformation[];
  readonly trustStatus: typeof M5B_FEDEX_TRUST_STATUS;
  readonly disposition: "pending";
  readonly allowedDispositions: readonly ["accept", "reject"];
}

export interface M5bFedExZeroEffectBoundaries {
  readonly current_effective_authorization: "none";
  readonly authorizes_provider_call: false;
  readonly authorizes_private_read: false;
  readonly authorizes_graph_ingestion: false;
  readonly authorizes_durable_write: false;
  readonly authorizes_acquisition: false;
  readonly authorizes_deployment: false;
  readonly providerCalls: 0;
  readonly privateReads: 0;
  readonly graphDurableWrites: 0;
  readonly acquisitions: 0;
  readonly deployments: 0;
  readonly externalProductEffects: 0;
  readonly retryCount: 0;
  readonly verifiedObjects: 0;
}

export function m5bFedExZeroEffectBoundaries(): Readonly<M5bFedExZeroEffectBoundaries> {
  return Object.freeze({ current_effective_authorization: "none", authorizes_provider_call: false,
    authorizes_private_read: false, authorizes_graph_ingestion: false, authorizes_durable_write: false,
    authorizes_acquisition: false, authorizes_deployment: false, providerCalls: 0, privateReads: 0,
    graphDurableWrites: 0, acquisitions: 0, deployments: 0, externalProductEffects: 0, retryCount: 0,
    verifiedObjects: 0 });
}

export interface M5bFedExReviewPacketContent {
  readonly kind: "m5b-fedex-unratified-review-draft-packet";
  readonly schemaVersion: "2";
  readonly boundaryMarker: "m5b-gate-a-pre-effect-unarmed";
  readonly fixtureClassification: M5bFedExSanitizedSourcePack["fixtureClassification"];
  readonly current_effective_authorization: "none";
  readonly ratificationState: "unratified-draft";
  readonly satisfiesFutureArming: false;
  readonly sourcePackSha256: string;
  readonly candidateContentSha256: string;
  readonly proposals: readonly M5bFedExReviewProposal[];
  readonly retentionDraft: {
    readonly retentionDraftId: "m5b-fedex-source-retention-beyond-original-deadline";
    readonly deadline: typeof M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline;
    readonly disposition: "pending";
    readonly allowedDispositions: readonly ["accept", "reject"];
    readonly ratificationState: "unratified-draft";
    readonly externalRatificationRequired: true;
    readonly satisfiesFutureArming: false;
  };
  readonly boundaries: M5bFedExZeroEffectBoundaries;
}

export interface M5bFedExReviewPacket extends M5bFedExReviewPacketContent {
  readonly packetSha256: string;
}

function binding(pack: M5bFedExSanitizedSourcePack,
  pointer: M5bFedExLiteralField["jsonPointer"]): M5bFedExEvidenceBinding {
  const field = pack.fields.find((candidate) => candidate.jsonPointer === pointer);
  if (!field) refuse(`missing_${pointer}`);
  const packCanonical = canonicalM5bFedExJson((({ sourcePackSha256: _hash, ...content }) => content)(pack));
  const fieldCanonical = canonicalM5bFedExJson(field);
  const fieldStart = packCanonical.indexOf(fieldCanonical);
  if (fieldStart < 0 || packCanonical.indexOf(fieldCanonical, fieldStart + 1) >= 0) refuse(`locator_${pointer}`);
  const prefix = `${JSON.stringify("literal")}:`;
  const literalRelative = fieldCanonical.indexOf(prefix) + prefix.length;
  const literalCanonical = canonicalM5bFedExJson(field.literal);
  const charStart = fieldStart + literalRelative;
  if (literalRelative < prefix.length ||
      packCanonical.slice(charStart, charStart + literalCanonical.length) !== literalCanonical) refuse(`locator_${pointer}`);
  return Object.freeze({ jsonPointer: pointer, literal: field.literal,
    locator: Object.freeze({ document: "sanitized-source-pack-canonical-json", charStart,
      charEnd: charStart + literalCanonical.length }) });
}

function claimConstruction(id: string, inputs: readonly string[], output: string): M5bFedExTransformation {
  return Object.freeze({ id, inputs: Object.freeze([...inputs]), output,
    description: "Compose the proposed review text deterministically from the cited exact literals; the composition is not itself a source literal." });
}

export function buildM5bFedExReviewPacket(packInput: unknown,
  candidateInput: unknown): Readonly<M5bFedExReviewPacket> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  const candidate = verifyM5bFedExPrewriteCandidate(candidateInput, pack);
  const identityBindings = ["/name", "/cik", "/tickers", "/exchanges"].map((pointer) =>
    binding(pack, pointer as M5bFedExLiteralField["jsonPointer"]));
  const classificationBindings = ["/sic", "/sicDescription"].map((pointer) =>
    binding(pack, pointer as M5bFedExLiteralField["jsonPointer"]));
  const proposalBase = { sourceUrl: M5B_FEDEX_PRODUCTION_PINS.sourceUrl,
    sourceContentSha256: pack.source.sourceSha256, sanitizedSourcePackSha256: pack.sourcePackSha256,
    trustStatus: M5B_FEDEX_TRUST_STATUS, disposition: "pending" as const,
    allowedDispositions: Object.freeze(["accept", "reject"] as const) };
  const proposals: M5bFedExReviewProposal[] = [
    Object.freeze({ proposalId: "m5b-fedex-registrant-identity", proposedLens: "maps", proposedCard: "SEC registrant identity",
      proposedClaim: M5B_FEDEX_REQUIRED_IDENTITY_CLAIM, sourceLiterals: Object.freeze(identityBindings), ...proposalBase,
      transformations: Object.freeze([...pack.transformations.filter((item) => ["normalize-cik-to-sec-10-digit-display",
        "select-aligned-fdx-nyse-pair"].includes(item.id)), claimConstruction("compose-registrant-identity-proposal",
        ["/name", "/cik", "/tickers", "/exchanges"], M5B_FEDEX_REQUIRED_IDENTITY_CLAIM)]) }),
    Object.freeze({ proposalId: "m5b-fedex-industry-classification", proposedLens: "maps",
      proposedCard: "SEC industry classification", proposedClaim: M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
      sourceLiterals: Object.freeze(classificationBindings), ...proposalBase,
      transformations: Object.freeze([claimConstruction("compose-industry-classification-proposal",
        ["/sic", "/sicDescription"], M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM)]) }),
  ];
  if (pack.filing) {
    const filingPointers = [`/filings/recent/form/${pack.filing.index}`,
      `/filings/recent/filingDate/${pack.filing.index}`, `/filings/recent/accessionNumber/${pack.filing.index}`,
      `/filings/recent/primaryDocument/${pack.filing.index}`] as const;
    const claim = `The SEC submissions metadata lists ${pack.filing.form}, filed ${pack.filing.filingDate}, accession ${pack.filing.accessionNumber}, primary document ${pack.filing.primaryDocument}.`;
    proposals.push(Object.freeze({ proposalId: "m5b-fedex-latest-filing-metadata", proposedLens: "signals",
      proposedCard: "Newest aligned SEC filing metadata", proposedClaim: claim,
      sourceLiterals: Object.freeze(filingPointers.map((pointer) => binding(pack, pointer))), ...proposalBase,
      transformations: Object.freeze([...pack.transformations.filter((item) => item.id === "select-unique-newest-aligned-filing-row"),
        claimConstruction("compose-filing-metadata-proposal", filingPointers, claim)]) }));
  }
  if (proposals.length > 3) refuse("proposal_ceiling");
  const content: M5bFedExReviewPacketContent = Object.freeze({
    kind: "m5b-fedex-unratified-review-draft-packet", schemaVersion: "2",
    boundaryMarker: "m5b-gate-a-pre-effect-unarmed", fixtureClassification: pack.fixtureClassification,
    current_effective_authorization: "none", ratificationState: "unratified-draft", satisfiesFutureArming: false,
    sourcePackSha256: pack.sourcePackSha256, candidateContentSha256: candidate.candidateContentSha256,
    proposals: Object.freeze(proposals), retentionDraft: Object.freeze({
      retentionDraftId: "m5b-fedex-source-retention-beyond-original-deadline",
      deadline: M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline, disposition: "pending",
      allowedDispositions: Object.freeze(["accept", "reject"] as const), ratificationState: "unratified-draft",
      externalRatificationRequired: true, satisfiesFutureArming: false }), boundaries: m5bFedExZeroEffectBoundaries(),
  });
  return Object.freeze({ ...content, packetSha256: sha256M5bFedExCanonical(content) });
}

export function verifyM5bFedExReviewPacket(packetInput: unknown, packInput: unknown,
  candidateInput: unknown): Readonly<M5bFedExReviewPacket> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  let candidate: Readonly<M5bFedExPrewriteCandidate>;
  try { candidate = verifyM5bFedExPrewriteCandidate(candidateInput, pack); }
  catch (error) {
    if (error instanceof M5bFedExRefusal) refuse(error.code === "review_candidate_required"
      ? "review_candidate_required" : "review_candidate_counterfeit");
    throw error;
  }
  const packet = record(snapshotM5bFedExOwnData(packetInput, "reviewPacket"),
    "reviewPacket") as unknown as M5bFedExReviewPacket;
  exactKeys(packet as unknown as Readonly<Record<string, unknown>>, ["kind", "schemaVersion", "boundaryMarker",
    "fixtureClassification", "current_effective_authorization", "ratificationState", "satisfiesFutureArming",
    "sourcePackSha256", "candidateContentSha256", "proposals", "retentionDraft", "boundaries", "packetSha256"],
  "review_packet");
  const { packetSha256, ...content } = packet;
  if (!SAFE_HASH.test(packetSha256) || sha256M5bFedExCanonical(content) !== packetSha256) refuse("review_packet_hash");
  if (packet.kind !== "m5b-fedex-unratified-review-draft-packet" || packet.schemaVersion !== "2" ||
      packet.boundaryMarker !== "m5b-gate-a-pre-effect-unarmed" || packet.current_effective_authorization !== "none" ||
      packet.ratificationState !== "unratified-draft" || packet.satisfiesFutureArming !== false ||
      packet.fixtureClassification !== pack.fixtureClassification || packet.sourcePackSha256 !== pack.sourcePackSha256 ||
      packet.candidateContentSha256 !== candidate.candidateContentSha256 ||
      packet.retentionDraft.disposition !== "pending" || packet.retentionDraft.ratificationState !== "unratified-draft" ||
      packet.retentionDraft.externalRatificationRequired !== true || packet.retentionDraft.satisfiesFutureArming !== false ||
      packet.retentionDraft.deadline !== M5B_FEDEX_PRODUCTION_PINS.originalCustodyRetentionDeadline ||
      canonicalM5bFedExJson(packet.boundaries) !== canonicalM5bFedExJson(m5bFedExZeroEffectBoundaries())) {
    refuse("review_packet_boundary");
  }
  const proposals = array(packet.proposals, "reviewPacket.proposals") as readonly M5bFedExReviewProposal[];
  const expectedIds = pack.filing ? ["m5b-fedex-registrant-identity", "m5b-fedex-industry-classification",
    "m5b-fedex-latest-filing-metadata"] : ["m5b-fedex-registrant-identity", "m5b-fedex-industry-classification"];
  if (proposals.length !== expectedIds.length || proposals.some((proposal, index) =>
      proposal.proposalId !== expectedIds[index] || proposal.disposition !== "pending" ||
      proposal.sanitizedSourcePackSha256 !== pack.sourcePackSha256 ||
      proposal.sourceContentSha256 !== pack.source.sourceSha256 || proposal.sourceUrl !== pack.source.url ||
      proposal.trustStatus !== M5B_FEDEX_TRUST_STATUS)) refuse("review_packet_proposals");
  if (proposals[0]?.proposedClaim !== M5B_FEDEX_REQUIRED_IDENTITY_CLAIM ||
      proposals[1]?.proposedClaim !== M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM) refuse("review_packet_claims");
  const expected = buildM5bFedExReviewPacket(pack, candidate);
  if (canonicalM5bFedExJson(packet) !== canonicalM5bFedExJson(expected)) refuse("review_packet_counterfeit");
  return Object.freeze(packet);
}

export interface M5bFedExIndividualDraftSelection {
  readonly proposalId: string;
  readonly disposition: "accept" | "reject";
}

export interface M5bFedExReviewDispositionDraftContent {
  readonly kind: "m5b-fedex-unratified-review-disposition-draft";
  readonly schemaVersion: "2";
  readonly sourcePacketSha256: string;
  readonly sourcePackSha256: string;
  readonly candidateContentSha256: string;
  readonly proposalDispositions: readonly { readonly proposalId: string;
    readonly disposition: "pending" | "accept" | "reject" }[];
  readonly acceptedProposalIds: readonly string[];
  readonly rejectedProposalIds: readonly string[];
  readonly pendingProposalIds: readonly string[];
  readonly allProposalsDecided: boolean;
  readonly allProposalsAccepted: boolean;
  readonly retentionDraft: "pending" | "accept" | "reject";
  readonly retentionRatificationSeparate: true;
  readonly ratificationState: "unratified-draft";
  readonly satisfiesFutureArming: false;
  readonly unarmed: true;
  readonly boundaries: M5bFedExZeroEffectBoundaries;
}

export interface M5bFedExReviewDispositionDraft extends M5bFedExReviewDispositionDraftContent {
  readonly reviewDraftSha256: string;
}

function verifyM5bFedExReviewDispositionDraft(draftInput: unknown, packet: M5bFedExReviewPacket,
  pack: M5bFedExSanitizedSourcePack, candidate: M5bFedExPrewriteCandidate): Readonly<M5bFedExReviewDispositionDraft> {
  const artifact = record(snapshotM5bFedExOwnData(draftInput, "reviewDraft"),
    "reviewDraft") as unknown as M5bFedExReviewDispositionDraft;
  exactKeys(artifact as unknown as Readonly<Record<string, unknown>>, ["kind", "schemaVersion", "sourcePacketSha256",
    "sourcePackSha256", "candidateContentSha256", "proposalDispositions", "acceptedProposalIds", "rejectedProposalIds",
    "pendingProposalIds", "allProposalsDecided", "allProposalsAccepted", "retentionDraft",
    "retentionRatificationSeparate", "ratificationState", "satisfiesFutureArming", "unarmed", "boundaries",
    "reviewDraftSha256"], "review_draft");
  const { reviewDraftSha256, ...content } = artifact;
  if (!SAFE_HASH.test(reviewDraftSha256) || sha256M5bFedExCanonical(content) !== reviewDraftSha256 ||
      artifact.kind !== "m5b-fedex-unratified-review-disposition-draft" || artifact.schemaVersion !== "2" ||
      artifact.sourcePacketSha256 !== packet.packetSha256 || artifact.sourcePackSha256 !== pack.sourcePackSha256 ||
      artifact.candidateContentSha256 !== candidate.candidateContentSha256 ||
      artifact.retentionRatificationSeparate !== true || artifact.ratificationState !== "unratified-draft" ||
      artifact.satisfiesFutureArming !== false || artifact.unarmed !== true ||
      !["pending", "accept", "reject"].includes(artifact.retentionDraft) ||
      canonicalM5bFedExJson(artifact.boundaries) !== canonicalM5bFedExJson(m5bFedExZeroEffectBoundaries())) {
    refuse("review_draft_boundary");
  }
  const dispositions = array(artifact.proposalDispositions, "decisionArtifact.proposalDispositions");
  if (dispositions.length !== packet.proposals.length) refuse("review_draft_dispositions");
  const seen = new Set<string>();
  const derived = { accept: [] as string[], reject: [] as string[], pending: [] as string[] };
  for (const [index, value] of dispositions.entries()) {
    const disposition = record(value, `decisionArtifact.proposalDispositions[${index}]`);
    exactKeys(disposition, ["proposalId", "disposition"], `review_draft_disposition_${index}`);
    const proposalId = string(disposition.proposalId, `decisionArtifact.proposalDispositions[${index}].proposalId`);
    if (proposalId !== packet.proposals[index]?.proposalId || seen.has(proposalId) ||
        !["accept", "reject", "pending"].includes(disposition.disposition as string)) refuse("review_draft_dispositions");
    seen.add(proposalId);
    derived[disposition.disposition as "accept" | "reject" | "pending"].push(proposalId);
  }
  const accepted = array(artifact.acceptedProposalIds, "decisionArtifact.acceptedProposalIds");
  const rejected = array(artifact.rejectedProposalIds, "decisionArtifact.rejectedProposalIds");
  const pending = array(artifact.pendingProposalIds, "decisionArtifact.pendingProposalIds");
  if ([accepted, rejected, pending].some((ids) => ids.some((id) => typeof id !== "string")) ||
      canonicalM5bFedExJson(accepted) !== canonicalM5bFedExJson(derived.accept) ||
      canonicalM5bFedExJson(rejected) !== canonicalM5bFedExJson(derived.reject) ||
      canonicalM5bFedExJson(pending) !== canonicalM5bFedExJson(derived.pending) ||
      artifact.allProposalsDecided !== (derived.pending.length === 0) ||
      artifact.allProposalsAccepted !== (derived.pending.length === 0 && derived.reject.length === 0)) {
    refuse("review_draft_summary");
  }
  return Object.freeze(artifact);
}

export function applyM5bFedExIndividualReviewDraftSelections(packetInput: unknown, packInput: unknown,
  selectionsInput: unknown, candidateInput: unknown): Readonly<M5bFedExReviewDispositionDraft> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  let candidate: Readonly<M5bFedExPrewriteCandidate>;
  try { candidate = verifyM5bFedExPrewriteCandidate(candidateInput, pack); }
  catch { refuse("review_candidate_counterfeit"); }
  const packet = verifyM5bFedExReviewPacket(packetInput, pack, candidate);
  const decisions = array(snapshotM5bFedExOwnData(selectionsInput, "reviewSelections"), "reviewSelections");
  const allowed = new Set(packet.proposals.map((proposal) => proposal.proposalId));
  const applied = new Map<string, "accept" | "reject">();
  for (const [index, item] of decisions.entries()) {
    const decision = record(item, `decisions[${index}]`);
    exactKeys(decision, ["proposalId", "disposition"], `decision_${index}`);
    const proposalId = string(decision.proposalId, `decisions[${index}].proposalId`);
    if (!allowed.has(proposalId)) refuse("decision_unknown_id");
    if (applied.has(proposalId)) refuse("decision_duplicate_id");
    if (decision.disposition !== "accept" && decision.disposition !== "reject") refuse("decision_disposition");
    applied.set(proposalId, decision.disposition);
  }
  const proposalDispositions = packet.proposals.map((proposal) => Object.freeze({ proposalId: proposal.proposalId,
    disposition: applied.get(proposal.proposalId) ?? "pending" as const }));
  const accepted = proposalDispositions.filter((item) => item.disposition === "accept").map((item) => item.proposalId);
  const rejected = proposalDispositions.filter((item) => item.disposition === "reject").map((item) => item.proposalId);
  const pending = proposalDispositions.filter((item) => item.disposition === "pending").map((item) => item.proposalId);
  const content: M5bFedExReviewDispositionDraftContent = Object.freeze({
    kind: "m5b-fedex-unratified-review-disposition-draft", schemaVersion: "2",
    sourcePacketSha256: packet.packetSha256, sourcePackSha256: pack.sourcePackSha256,
    candidateContentSha256: candidate.candidateContentSha256, proposalDispositions: Object.freeze(proposalDispositions),
    acceptedProposalIds: Object.freeze(accepted), rejectedProposalIds: Object.freeze(rejected),
    pendingProposalIds: Object.freeze(pending), allProposalsDecided: pending.length === 0,
    allProposalsAccepted: pending.length === 0 && rejected.length === 0, retentionDraft: "pending",
    retentionRatificationSeparate: true, ratificationState: "unratified-draft", satisfiesFutureArming: false,
    unarmed: true, boundaries: m5bFedExZeroEffectBoundaries(),
  });
  return Object.freeze({ ...content, reviewDraftSha256: sha256M5bFedExCanonical(content) });
}

export function applyM5bFedExRetentionDraftSelection(reviewDraftInput: unknown,
  disposition: "accept" | "reject", packetInput: unknown, packInput: unknown,
  candidateInput: unknown): Readonly<M5bFedExReviewDispositionDraft> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  let candidate: Readonly<M5bFedExPrewriteCandidate>;
  try { candidate = verifyM5bFedExPrewriteCandidate(candidateInput, pack); }
  catch { refuse("review_candidate_counterfeit"); }
  const packet = verifyM5bFedExReviewPacket(packetInput, pack, candidate);
  const artifact = verifyM5bFedExReviewDispositionDraft(reviewDraftInput, packet, pack, candidate);
  const { reviewDraftSha256: _priorHash, ...priorContent } = artifact;
  if (artifact.retentionDraft !== "pending" ||
      (disposition !== "accept" && disposition !== "reject")) refuse("retention_draft_artifact");
  const content: M5bFedExReviewDispositionDraftContent = Object.freeze({ ...priorContent, retentionDraft: disposition });
  return Object.freeze({ ...content, reviewDraftSha256: sha256M5bFedExCanonical(content) });
}

export interface M5bFedExUnarmedFutureComposition {
  readonly kind: "m5b-fedex-unarmed-future-effect-composition";
  readonly schemaVersion: "2";
  readonly sourcePackSha256: string;
  readonly reviewPacketSha256: string;
  readonly reviewDraftSha256: string;
  readonly candidateContentSha256: string;
  readonly acceptedProposalIds: readonly string[];
  readonly custodyAdmissionReestablishedFromSuppliedBytes: true;
  readonly reviewRatificationState: "unratified-draft";
  readonly humanRatificationSatisfied: false;
  readonly eligibleForFutureArming: false;
  readonly laterExternalRatificationArtifactRequired: true;
  readonly boundaryReferences: {
    readonly draftedApproval: "src/workshop/proposal-durable-graph-write-approval-packet.ts";
    readonly exactContentBinding: "src/workshop/m5a-curated-proposal-flow-execution.ts#M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256";
    readonly oneShotArming: "src/workshop/m5a-curated-proposal-flow-operator-arming.ts";
    readonly sharedWriterLock: "src/db/graph-snapshot-write-lock.ts";
    readonly durableWrite: "src/workshop/proposal-durable-graph-write-execution.ts";
    readonly readBack: "src/workshop/durable-graph-snapshots-reader.ts";
    readonly render: "src/workshop/durable-state-render.ts";
  };
  readonly futureLimits: { readonly exactLaterApprovalRequired: true; readonly oneShotArmingRequired: true;
    readonly durableWritesMaximum: 1; readonly readBacks: 1; readonly renders: 1; readonly retries: 0 };
  readonly containsDbPath: false;
  readonly containsWriterCallback: false;
  readonly containsExecutionMethod: false;
  readonly containsWriteCapableClosure: false;
  readonly armed: false;
  readonly effectAuthority: false;
  readonly privateCustodyReadDecisionSeparate: true;
  readonly providerCallDecisionSeparate: true;
  readonly durableWriteDecisionSeparate: true;
  readonly boundaries: M5bFedExZeroEffectBoundaries;
  readonly compositionSha256: string;
}

export function composeM5bFedExUnarmedFutureEffect(packInput: unknown, packetInput: unknown,
  reviewDraftInput: unknown, candidateInput: unknown,
  exactCustodyBytesInput: Uint8Array): Readonly<M5bFedExUnarmedFutureComposition> {
  const suppliedPack = verifyM5bFedExSanitizedSourcePack(packInput);
  let candidate: Readonly<M5bFedExPrewriteCandidate>;
  try { candidate = verifyM5bFedExPrewriteCandidate(candidateInput, suppliedPack); }
  catch { refuse("review_candidate_counterfeit"); }
  let admittedPack: Readonly<M5bFedExSanitizedSourcePack>;
  try {
    admittedPack = buildM5bFedExSanitizedSourcePack(admitM5bFedExProductionCustodyBytes(exactCustodyBytesInput));
  } catch {
    refuse("future_composition_production_admission");
  }
  if (canonicalM5bFedExJson(admittedPack) !== canonicalM5bFedExJson(suppliedPack)) {
    refuse("future_composition_production_admission");
  }
  candidate = verifyM5bFedExPrewriteCandidate(candidate, admittedPack);
  const packet = verifyM5bFedExReviewPacket(packetInput, admittedPack, candidate);
  const decision = verifyM5bFedExReviewDispositionDraft(reviewDraftInput, packet, admittedPack, candidate);
  const expectedProposalIds = packet.proposals.map((proposal) => proposal.proposalId);
  if (decision.allProposalsAccepted !== true || decision.retentionDraft !== "accept" || decision.unarmed !== true ||
      decision.ratificationState !== "unratified-draft" || decision.satisfiesFutureArming !== false) {
    refuse("future_composition_review");
  }
  if (canonicalM5bFedExJson(decision.acceptedProposalIds) !== canonicalM5bFedExJson(expectedProposalIds) ||
      decision.rejectedProposalIds.length !== 0 || decision.pendingProposalIds.length !== 0 ||
      decision.proposalDispositions.some((item, index) => item.proposalId !== expectedProposalIds[index] ||
        item.disposition !== "accept")) refuse("future_composition_proposals");
  const content = Object.freeze({ kind: "m5b-fedex-unarmed-future-effect-composition" as const,
    schemaVersion: "2" as const, sourcePackSha256: admittedPack.sourcePackSha256,
    reviewPacketSha256: packet.packetSha256, reviewDraftSha256: decision.reviewDraftSha256,
    candidateContentSha256: candidate.candidateContentSha256, acceptedProposalIds: decision.acceptedProposalIds,
    custodyAdmissionReestablishedFromSuppliedBytes: true as const, reviewRatificationState: "unratified-draft" as const,
    humanRatificationSatisfied: false as const, eligibleForFutureArming: false as const,
    laterExternalRatificationArtifactRequired: true as const, boundaryReferences: Object.freeze({
      draftedApproval: "src/workshop/proposal-durable-graph-write-approval-packet.ts" as const,
      exactContentBinding: "src/workshop/m5a-curated-proposal-flow-execution.ts#M5A_CURATED_PROPOSAL_FLOW_MATERIALIZATION_INPUT_SHA256" as const,
      oneShotArming: "src/workshop/m5a-curated-proposal-flow-operator-arming.ts" as const,
      sharedWriterLock: "src/db/graph-snapshot-write-lock.ts" as const,
      durableWrite: "src/workshop/proposal-durable-graph-write-execution.ts" as const,
      readBack: "src/workshop/durable-graph-snapshots-reader.ts" as const,
      render: "src/workshop/durable-state-render.ts" as const }),
    futureLimits: Object.freeze({ exactLaterApprovalRequired: true as const, oneShotArmingRequired: true as const,
      durableWritesMaximum: 1 as const, readBacks: 1 as const, renders: 1 as const, retries: 0 as const }),
    containsDbPath: false as const, containsWriterCallback: false as const, containsExecutionMethod: false as const,
    containsWriteCapableClosure: false as const, armed: false as const, effectAuthority: false as const,
    privateCustodyReadDecisionSeparate: true as const, providerCallDecisionSeparate: true as const,
    durableWriteDecisionSeparate: true as const, boundaries: m5bFedExZeroEffectBoundaries() });
  return Object.freeze({ ...content, compositionSha256: sha256M5bFedExCanonical(content) });
}

export function refuseM5bFedExPreEffectExecution(_composition: unknown): Readonly<{
  outcome: "refused_pre_effect"; reason: "later-external-ratification-exact-approval-and-one-shot-arming-required";
  privateReads: 0; providerCalls: 0; graphDurableWrites: 0; acquisitions: 0; deployments: 0; retries: 0;
  externalProductEffects: 0;
}> {
  return Object.freeze({ outcome: "refused_pre_effect",
    reason: "later-external-ratification-exact-approval-and-one-shot-arming-required", privateReads: 0,
    providerCalls: 0, graphDurableWrites: 0, acquisitions: 0, deployments: 0, retries: 0,
    externalProductEffects: 0 });
}
