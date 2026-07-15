import { createHash } from "node:crypto";

import { parseGraphBundle } from "../graph/schema.ts";
import type { GraphBundle } from "../graph/types.ts";
import { validateGraphBundle } from "../graph/validate.ts";
import { buildWorkshopViewModel } from "./view-model.ts";
import {
  M5B_FEDEX_PRODUCTION_PINS,
  M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
  M5B_FEDEX_REQUIRED_IDENTITY_CLAIM,
  M5B_FEDEX_REVIEW_STATE,
  M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN,
  M5B_FEDEX_TRUST_STATUS,
  buildM5bFedExReviewPacket,
  buildM5bFedExSanitizedSourcePack,
  canonicalM5bFedExJson,
  extractM5bFedExCommittedFixtureSource,
  snapshotM5bFedExOwnData,
  sha256M5bFedExCanonical,
  verifyM5bFedExReviewPacket,
  verifyM5bFedExSanitizedSourcePack,
  type M5bFedExEvidenceBinding,
  type M5bFedExLiteralField,
  type M5bFedExReviewPacket,
  type M5bFedExReviewProposal,
  type M5bFedExSanitizedSourcePack,
} from "./m5b-fedex-system-acquired-source.ts";

export interface M5bFedExPrewriteCandidate {
  readonly kind: "m5b-fedex-prewrite-graph-candidate";
  readonly schemaVersion: "1";
  readonly fixtureClassification: M5bFedExSanitizedSourcePack["fixtureClassification"];
  readonly origin: typeof M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN;
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
    readonly graphWrites: 0;
    readonly acquisitions: 0;
    readonly deployments: 0;
    readonly effects: 0;
    readonly verifiedObjects: 0;
  };
}

const CAPTURED_AT = "2026-07-14T18:41:11.214Z";
const TEAM_ID = "team_atliera_workshop";
const ACCOUNT_ID = "acc_fedex_corp";
const SOURCE_ID = "src_fedex_sec_submissions";

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function evidenceBlock(pack: M5bFedExSanitizedSourcePack,
  pointers: readonly M5bFedExLiteralField["jsonPointer"][]): string {
  const fields = pointers.map((pointer) => {
    const field = pack.fields.find((candidate) => candidate.jsonPointer === pointer);
    if (!field) throw new Error(`M5b candidate missing source-pack pointer ${pointer}`);
    return field;
  });
  return canonicalM5bFedExJson(fields);
}

function proposedExcerpt(id: string, text: string, rawText: string): GraphBundle["excerpts"][number] {
  const charStart = rawText.indexOf(text);
  if (charStart < 0 || rawText.indexOf(text, charStart + 1) >= 0) throw new Error("M5b candidate excerpt locator refused");
  return { id, source_document_id: SOURCE_ID, text, kind: "literal", char_start: charStart,
    char_end: charStart + text.length, captured_at: CAPTURED_AT, validation_status: "proposed", rejection_reason: null };
}

function candidateBoundaries(): M5bFedExPrewriteCandidate["boundaries"] {
  return Object.freeze({ current_effective_authorization: "none", prewrite: true, writePerformed: false,
    privateReads: 0, providerCalls: 0, graphWrites: 0, acquisitions: 0, deployments: 0, effects: 0, verifiedObjects: 0 });
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
    normalized_subject: "fedex_corp:latest_aligned_sec_filing_metadata", confidence: "medium", provenance_status: "unverified",
    status: "active", created_by: "system", created_at: CAPTURED_AT });

  const claimEvidence: GraphBundle["claim_evidence"] = [
    { id: "cev_fedex_registrant_identity", claim_id: "clm_fedex_registrant_identity",
      evidence_excerpt_id: "exc_fedex_registrant_identity", relationship: "supports",
      rationale: "Pending-ratification bounded projection preserves the cited SEC identity literals and pointers.",
      confidence: "medium", created_at: CAPTURED_AT },
    { id: "cev_fedex_industry_classification", claim_id: "clm_fedex_industry_classification",
      evidence_excerpt_id: "exc_fedex_industry_classification", relationship: "supports",
      rationale: "Pending-ratification bounded projection preserves the cited SEC SIC literals and pointers.",
      confidence: "medium", created_at: CAPTURED_AT },
  ];
  if (pack.filing) claimEvidence.push({ id: "cev_fedex_latest_filing_metadata", claim_id: "clm_fedex_latest_filing_metadata",
    evidence_excerpt_id: "exc_fedex_latest_filing_metadata", relationship: "supports",
    rationale: "Pending-ratification bounded projection preserves one uniquely newest same-index filing metadata row.",
    confidence: "medium", created_at: CAPTURED_AT });

  const accountObjects: GraphBundle["account_objects"] = [
    { id: "obj_fedex_registrant_identity", team_id: TEAM_ID, account_id: ACCOUNT_ID, object_type: "account_snapshot",
      title: "SEC registrant identity", summary: M5B_FEDEX_REQUIRED_IDENTITY_CLAIM,
      payload_json: { review_state: M5B_FEDEX_REVIEW_STATE, origin: M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN,
        source_pack_sha256: pack.sourcePackSha256, json_pointers: ["/name", "/cik", "/tickers", "/exchanges"] },
      confidence: "medium", provenance_status: "unverified", status: "active", created_by: "system",
      created_at: CAPTURED_AT, updated_at: CAPTURED_AT },
    { id: "obj_fedex_industry_classification", team_id: TEAM_ID, account_id: ACCOUNT_ID, object_type: "account_snapshot",
      title: "SEC industry classification", summary: M5B_FEDEX_REQUIRED_CLASSIFICATION_CLAIM,
      payload_json: { review_state: M5B_FEDEX_REVIEW_STATE, origin: M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN,
        source_pack_sha256: pack.sourcePackSha256, json_pointers: ["/sic", "/sicDescription"],
        scope_caveat: "SEC SIC label only; not a comprehensive description of the registrant's current business." },
      confidence: "medium", provenance_status: "unverified", status: "active", created_by: "system",
      created_at: CAPTURED_AT, updated_at: CAPTURED_AT },
  ];
  if (pack.filing) accountObjects.push({ id: "obj_fedex_latest_filing_metadata", team_id: TEAM_ID, account_id: ACCOUNT_ID,
    object_type: "signal", title: "Newest aligned SEC filing metadata", summary: claims[2]!.text,
    payload_json: { review_state: M5B_FEDEX_REVIEW_STATE, origin: M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN,
      source_pack_sha256: pack.sourcePackSha256, metadata_only: true, filing_index: pack.filing.index }, confidence: "medium",
    provenance_status: "unverified", status: "active", created_by: "system", created_at: CAPTURED_AT, updated_at: CAPTURED_AT });

  const accountObjectClaims: GraphBundle["account_object_claims"] = [
    { id: "oclm_fedex_registrant_identity", account_object_id: "obj_fedex_registrant_identity",
      claim_id: "clm_fedex_registrant_identity", relationship: "primary" },
    { id: "oclm_fedex_industry_classification", account_object_id: "obj_fedex_industry_classification",
      claim_id: "clm_fedex_industry_classification", relationship: "primary" },
  ];
  if (pack.filing) accountObjectClaims.push({ id: "oclm_fedex_latest_filing_metadata",
    account_object_id: "obj_fedex_latest_filing_metadata", claim_id: "clm_fedex_latest_filing_metadata", relationship: "primary" });

  const bundle: GraphBundle = {
    sources: [{ id: SOURCE_ID, team_id: TEAM_ID, account_id: ACCOUNT_ID, url: pack.source.url,
      canonical_url: pack.source.url, title: "SEC submissions — FEDEX CORP", publisher: "U.S. Securities and Exchange Commission",
      source_type: "system_acquired_sec_submissions_bounded_projection", fetched_at: pack.source.acquiredAt,
      accessed_at: pack.source.acquiredAt, content_hash: `sha256:${sha256Text(rawText)}`, raw_text: rawText,
      reliability: "unknown", status: "active" }],
    excerpts, claims, claim_evidence: claimEvidence, account_objects: accountObjects,
    account_object_claims: accountObjectClaims, research_runs: [], run_artifacts: [], audit_events: [],
  };
  const parsed = parseGraphBundle(bundle);
  if (!parsed.ok) throw new Error(`M5b candidate schema refused: ${parsed.errors.map((error) => error.path).join(",")}`);
  const report = validateGraphBundle(parsed.value, { mode: "validation" });
  if (!report.ok) throw new Error(`M5b candidate graph refused: ${report.hard_failures.map((failure) => failure.code).join(",")}`);
  if (bundle.sources.length !== 1 || bundle.excerpts.length > 4 || bundle.claims.length < 2 || bundle.claims.length > 3 ||
      bundle.account_objects.length < 2 || bundle.account_objects.length > 3 ||
      bundle.claims.some((claim) => claim.provenance_status === "verified" || claim.created_by !== "system") ||
      bundle.account_objects.some((object) => object.provenance_status === "verified" || object.created_by !== "system") ||
      bundle.excerpts.some((excerpt) => excerpt.validation_status !== "proposed")) {
    throw new Error("M5b candidate scope ceiling refused");
  }
  const candidateContentSha256 = sha256M5bFedExCanonical(bundle);
  return Object.freeze({ kind: "m5b-fedex-prewrite-graph-candidate", schemaVersion: "1",
    fixtureClassification: pack.fixtureClassification, origin: M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN,
    reviewState: M5B_FEDEX_REVIEW_STATE, sourcePackSha256: pack.sourcePackSha256, bundle,
    candidateContentSha256, boundaries: candidateBoundaries() });
}

export function verifyM5bFedExPrewriteCandidate(candidateInput: unknown,
  packInput: unknown): Readonly<M5bFedExPrewriteCandidate> {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  const candidateSnapshot = snapshotM5bFedExOwnData(candidateInput);
  if (candidateSnapshot === null || typeof candidateSnapshot !== "object" || Array.isArray(candidateSnapshot)) {
    throw new Error("M5b candidate refused");
  }
  const candidate = candidateSnapshot as M5bFedExPrewriteCandidate;
  if (candidate.kind !== "m5b-fedex-prewrite-graph-candidate" || candidate.schemaVersion !== "1" ||
      candidate.origin !== M5B_FEDEX_SYSTEM_ACQUIRED_ORIGIN || candidate.reviewState !== M5B_FEDEX_REVIEW_STATE ||
      candidate.sourcePackSha256 !== pack.sourcePackSha256 || candidate.candidateContentSha256 !== sha256M5bFedExCanonical(candidate.bundle) ||
      canonicalM5bFedExJson(candidate.boundaries) !== canonicalM5bFedExJson(candidateBoundaries())) {
    throw new Error("M5b candidate counterfeit refused");
  }
  const parsed = parseGraphBundle(candidate.bundle);
  if (!parsed.ok || !validateGraphBundle(parsed.value, { mode: "validation" }).ok) throw new Error("M5b candidate graph refused");
  const expected = buildM5bFedExPrewriteCandidate(pack);
  if (canonicalM5bFedExJson(candidate) !== canonicalM5bFedExJson(expected)) {
    throw new Error("M5b candidate semantic counterfeit refused");
  }
  return candidate;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderM5bFedExSafeSourceLink(url: string, label = url): string {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return `<span class="source-text">${escapeHtml(label)}</span>`; }
  if (!(["http:", "https:"] as string[]).includes(parsed.protocol) || parsed.username || parsed.password) {
    return `<span class="source-text">${escapeHtml(label)}</span>`;
  }
  return `<a href="${escapeHtml(parsed.toString())}" rel="noreferrer noopener">${escapeHtml(label)}</a>`;
}

function renderBinding(value: M5bFedExEvidenceBinding): string {
  return `<li><code>${escapeHtml(value.jsonPointer)}</code><strong>${escapeHtml(canonicalM5bFedExJson(value.literal))}</strong>` +
    `<span>source-pack span [${value.locator.charStart}, ${value.locator.charEnd})</span></li>`;
}

function renderTransformations(proposal: M5bFedExReviewProposal): string {
  return proposal.transformations.map((item) => `<li><code>${escapeHtml(item.id)}</code> ${escapeHtml(item.description)}</li>`).join("");
}

function renderCard(proposal: M5bFedExReviewProposal): string {
  const caveat = proposal.proposalId === "m5b-fedex-industry-classification"
    ? `<p class="caveat">This is the SEC SIC label only. “Air Courier Services” is not a comprehensive description of FedEx’s current business.</p>` : "";
  return `<article class="card" data-proposal-id="${escapeHtml(proposal.proposalId)}"><div class="card-top">` +
    `<span class="lens">${escapeHtml(proposal.proposedLens === "maps" ? "Map" : "Signal")}</span>` +
    `<span class="pending">Pending human review</span></div><h3>${escapeHtml(proposal.proposedCard)}</h3>` +
    `<p class="claim">${escapeHtml(proposal.proposedClaim)}</p>${caveat}<details open><summary>Evidence binding</summary>` +
    `<ul class="evidence">${proposal.sourceLiterals.map(renderBinding).join("")}</ul></details>` +
    `<details><summary>Deterministic transformations</summary><ul class="transforms">${renderTransformations(proposal)}</ul></details>` +
    `<footer><span>Disposition: pending</span><span>Accept or reject individually</span></footer></article>`;
}

export function renderM5bFedExPrewriteWorkshopHtml(packInput: unknown, packetInput: unknown,
  candidateInput: unknown): string {
  const pack = verifyM5bFedExSanitizedSourcePack(packInput);
  const candidate = verifyM5bFedExPrewriteCandidate(candidateInput, pack);
  const packet = verifyM5bFedExReviewPacket(packetInput, pack);
  if (packet.candidateContentSha256 !== candidate.candidateContentSha256) throw new Error("M5b render candidate hash refused");
  const view = buildWorkshopViewModel(candidate.bundle);
  if (view.totals.sources !== 1 || view.totals.verified_objects !== 0 || view.lenses.maps.length !== 2 ||
      view.lenses.signals.length > 1 || view.lenses.plays.length !== 0) throw new Error("M5b render scope refused");
  const maps = packet.proposals.filter((proposal) => proposal.proposedLens === "maps");
  const signals = packet.proposals.filter((proposal) => proposal.proposedLens === "signals");
  if (maps.length !== 2 || signals.length > 1) throw new Error("M5b render proposal scope refused");
  const sourceLink = renderM5bFedExSafeSourceLink(pack.source.url, pack.source.url);
  const signalHtml = signals.length === 1 ? signals.map(renderCard).join("") :
    `<div class="empty"><strong>No Signals proposed</strong><span>No uniquely newest aligned filing metadata row is available in this fixture.</span></div>`;
  const playHtml = `<div class="empty"><strong>No Plays proposed</strong><span>No recommendation was fabricated from identity or classification metadata.</span></div>`;
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>FedEx — source-backed account snapshot</title><style>` +
    `:root{color-scheme:light;--ink:#152033;--muted:#617089;--line:#dfe5ed;--paper:#fff;--wash:#f4f6f9;--navy:#182d55;--orange:#d97706;font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}` +
    `*{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink)}a{color:#315b9c;overflow-wrap:anywhere}main{max-width:1120px;margin:auto;padding:36px 24px 64px}` +
    `.topline{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;color:var(--muted);font-weight:700}.topline span:first-child{letter-spacing:.12em;text-transform:uppercase}` +
    `.hero{background:linear-gradient(135deg,#172b50,#243e70);color:#fff;border-radius:22px;padding:34px;box-shadow:0 18px 45px #162b501f}.fixture{margin:0 0 24px;color:#ffd7a0;font-size:.82rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}` +
    `.hero-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:30px}.hero h1{font-size:clamp(2.25rem,5vw,4rem);line-height:1;margin:0 0 10px;letter-spacing:-.04em}.market{font-size:1.15rem;font-weight:750;color:#cfdaee}.facts{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:12px 26px;margin-top:26px}.fact span{display:block;color:#aebed9;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em}.fact strong{font-size:1rem}` +
    `.score{text-align:right;min-width:210px}.score strong{font-size:2.5rem;display:block;line-height:1}.score span{color:#cfdaee}.pills{display:flex;gap:9px;flex-wrap:wrap;margin-top:28px}.pill{border:1px solid #ffffff59;background:#ffffff12;border-radius:999px;padding:7px 11px;font-weight:750;font-size:.82rem}` +
    `.identity{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}.identity div{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}.identity span{display:block;color:var(--muted);font-size:.78rem;text-transform:uppercase}.identity code{font-size:.8rem;overflow-wrap:anywhere}` +
    `.section{margin-top:34px}.section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:12px}.section h2{font-size:1.45rem;margin:0}.section-head span{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}` +
    `.card,.empty{background:var(--paper);border:1px solid var(--line);border-radius:17px;padding:22px;box-shadow:0 5px 20px #1520330a}.card-top{display:flex;justify-content:space-between;gap:12px}.lens{color:#43526a;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;font-weight:800}.pending{color:#9a4d08;background:#fff4df;border-radius:999px;padding:3px 8px;font-size:.75rem;font-weight:800}.card h3{font-size:1.25rem;margin:14px 0 8px}.claim{font:600 1.02rem/1.55 ui-serif,Georgia,serif}.caveat{border-left:3px solid var(--orange);padding-left:12px;color:#71420f}` +
    `details{border-top:1px solid var(--line);padding-top:12px;margin-top:16px}summary{cursor:pointer;font-weight:800;color:#3c4b63}.evidence,.transforms{padding-left:20px;margin-bottom:0}.evidence li{margin:10px 0}.evidence code,.evidence strong,.evidence span{display:block}.evidence strong{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.evidence span{color:var(--muted);font-size:.78rem}` +
    `.transforms li{margin:8px 0;color:#46566f}.card footer{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);margin-top:18px;padding-top:14px;color:var(--muted);font-size:.8rem}.empty{display:flex;flex-direction:column;gap:5px;color:var(--muted)}.empty strong{color:var(--ink)}` +
    `.boundary{margin-top:34px;background:#fff8eb;border:1px solid #f0c987;border-radius:16px;padding:20px}.boundary h2{margin:0 0 8px;font-size:1rem}.boundary p{margin:5px 0}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}` +
    `@media(max-width:760px){main{padding:18px 12px 40px}.hero{padding:24px}.hero-grid,.identity,.grid{grid-template-columns:1fr}.score{text-align:left}.facts{grid-template-columns:1fr}.card footer{flex-direction:column}}` +
    `</style></head><body><main><div class="topline"><span>Atliera Workshop</span><span>Pre-write review candidate</span></div>` +
    `<section class="hero"><p class="fixture">${escapeHtml(pack.fixtureClassification)}</p><div class="hero-grid"><div>` +
    `<h1>FEDEX CORP</h1><div class="market">FDX · NYSE</div><div class="facts"><div class="fact"><span>Registrant</span><strong>CIK 0001048911</strong></div>` +
    `<div class="fact"><span>SEC classification</span><strong>SIC 4513 / Air Courier Services</strong></div><div class="fact"><span>Acquired-source timestamp</span><strong>${escapeHtml(pack.source.acquiredAt)}</strong></div>` +
    `<div class="fact"><span>Source count</span><strong>one source</strong></div></div></div><div class="score"><strong>0</strong><span>zero independently verified objects</span></div></div>` +
    `<div class="pills"><span class="pill">System-acquired SEC source</span><span class="pill">Pending human ratification before persistence</span>` +
    `<span class="pill">Source-backed / not independently verified</span></div></section>` +
    `<section class="identity"><div><span>Source</span>${sourceLink}</div><div><span>Production response SHA-256</span><code>${pack.source.upstreamResponseSha256}</code></div>` +
    `<div><span>Sanitized source-pack SHA-256</span><code>${pack.sourcePackSha256}</code></div><div><span>Review packet SHA-256</span><code>${packet.packetSha256}</code></div></section>` +
    `<section class="section"><div class="section-head"><h2>Maps</h2><span>2 proposed cards</span></div><div class="grid">${maps.map(renderCard).join("")}</div></section>` +
    `<section class="section"><div class="section-head"><h2>Signals</h2><span>${signals.length} proposed cards</span></div><div class="grid">${signalHtml}</div></section>` +
    `<section class="section"><div class="section-head"><h2>Plays</h2><span>0 proposed cards</span></div><div class="grid">${playHtml}</div></section>` +
    `<section class="boundary"><h2>Pre-write / no-effect boundary</h2><p>Current effective authorization: <strong>none</strong>. Private reads 0 · provider calls 0 · graph writes 0 · acquisitions 0 · deployments 0 · retries 0.</p>` +
    `<p>Every excerpt is proposed and every claim/object remains unverified pending individual human disposition. Retention beyond ${pack.source.originalCustodyRetentionDeadline} requires a separate human decision.</p>` +
    `<p class="mono">Candidate content SHA-256: ${candidate.candidateContentSha256}</p></section></main></body></html>\n`;
}

export interface M5bFedExGeneratedDemoArtifacts {
  readonly sourcePack: Readonly<M5bFedExSanitizedSourcePack>;
  readonly candidate: Readonly<M5bFedExPrewriteCandidate>;
  readonly reviewPacket: Readonly<M5bFedExReviewPacket>;
  readonly sourcePackJson: string;
  readonly reviewPacketJson: string;
  readonly html: string;
}

export function generateM5bFedExDemoArtifacts(fixtureJsonText: string): M5bFedExGeneratedDemoArtifacts {
  const fixtureBytes = Buffer.from(fixtureJsonText, "utf8");
  const bounded = extractM5bFedExCommittedFixtureSource(fixtureBytes);
  const sourcePack = buildM5bFedExSanitizedSourcePack(bounded);
  const candidate = buildM5bFedExPrewriteCandidate(sourcePack);
  const reviewPacket = buildM5bFedExReviewPacket(sourcePack, candidate.candidateContentSha256);
  const html = renderM5bFedExPrewriteWorkshopHtml(sourcePack, reviewPacket, candidate);
  return Object.freeze({ sourcePack, candidate, reviewPacket, sourcePackJson: `${JSON.stringify(sourcePack, null, 2)}\n`,
    reviewPacketJson: `${JSON.stringify(reviewPacket, null, 2)}\n`, html });
}

// Static cross-check: the M5b production pins intentionally reuse the M4
// target-policy identity, never a re-declared or weakened target.
if (M5B_FEDEX_PRODUCTION_PINS.sourceUrl !== "https://data.sec.gov/submissions/CIK0001048911.json" ||
    M5B_FEDEX_PRODUCTION_PINS.targetPolicySha256 !== "a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a") {
  throw new Error("M5b FedEx source binding drift");
}
