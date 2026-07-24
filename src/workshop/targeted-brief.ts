import { URL } from "node:url";

import type {
  AccountObject,
  Claim,
  EvidenceExcerpt,
  GraphBundle,
  ProvenanceStatus,
  SourceDocument,
} from "../graph/types.ts";
import { validateGraphBundle } from "../graph/validate.ts";

export const TARGETED_BRIEF_SCHEMA_VERSION = "atliera.targeted_brief.v1" as const;

export type TargetedBriefKind = "ciso_meeting" | "proposal_rfx";
export type TargetedBriefInputClass = "committed_fixture" | "validated_repository_data";
export type TargetedBriefSectionKey = "signals" | "maps" | "plays";
export type TargetedBriefGapReason =
  | "unsupported_claim_rejected"
  | "trust_not_ready"
  | "missing_accepted_evidence"
  | "record_not_active";

export interface TargetedBriefBuildOptions {
  readonly input_class: TargetedBriefInputClass;
  readonly input_ref: string;
}

export interface TargetedBriefEvidenceReference {
  readonly relationship: "supports";
  readonly claim: Pick<Claim, "id" | "text" | "claim_type" | "confidence" | "provenance_status">;
  readonly excerpt: Pick<EvidenceExcerpt, "id" | "text" | "kind" | "validation_status">;
  readonly source: Pick<
    SourceDocument,
    "id" | "title" | "url" | "publisher" | "source_type" | "reliability" | "fetched_at"
  >;
  readonly evidence_current_through: null;
}

export interface TargetedBriefAssertion {
  readonly id: string;
  readonly section: TargetedBriefSectionKey;
  readonly object_type: AccountObject["object_type"];
  readonly title: string;
  readonly statement: string;
  readonly provenance_status: "verified" | "source_document_only";
  readonly trust_label: "Verified" | "Source-backed · not independently checked";
  readonly confidence: AccountObject["confidence"];
  readonly evidence: readonly TargetedBriefEvidenceReference[];
}

export interface TargetedBriefSection {
  readonly key: TargetedBriefSectionKey;
  readonly title: string;
  readonly purpose: string;
  readonly assertion_ids: readonly string[];
}

export interface TargetedBriefEvidenceGap {
  readonly id: string;
  readonly reason: TargetedBriefGapReason;
  readonly omitted_item_count: number;
  readonly message: string;
}

export interface TargetedBriefOpenQuestion {
  readonly id: string;
  readonly label: "Meeting prompt · not an account fact" | "Response prompt · not an account fact";
  readonly text: string;
}

export interface TargetedBrief {
  readonly schema_version: typeof TARGETED_BRIEF_SCHEMA_VERSION;
  readonly kind: TargetedBriefKind;
  readonly title: string;
  readonly account_id: string | null;
  readonly input: {
    readonly class: TargetedBriefInputClass;
    readonly ref: string;
    readonly validation: "passed";
  };
  readonly summary: string;
  readonly next_safe_action: "Review the evidence behind the most important point.";
  readonly assertions: readonly TargetedBriefAssertion[];
  readonly sections: readonly TargetedBriefSection[];
  readonly open_questions: readonly TargetedBriefOpenQuestion[];
  readonly evidence_gaps: readonly TargetedBriefEvidenceGap[];
  readonly boundary: {
    readonly read_only: true;
    readonly provider_calls: false;
    readonly network_acquisition: false;
    readonly production_writes: false;
    readonly external_actions: false;
  };
}

export interface TargetedBriefPair {
  readonly ciso_meeting: TargetedBrief;
  readonly proposal_rfx: TargetedBrief;
}

interface SupportedAssertionSeed extends Omit<TargetedBriefAssertion, "section"> {
  readonly lens: TargetedBriefSectionKey;
}

const LENS_BY_OBJECT_TYPE: Record<AccountObject["object_type"], TargetedBriefSectionKey> = {
  account_snapshot: "maps",
  signal: "signals",
  stakeholder: "maps",
  initiative: "maps",
  risk: "signals",
  open_question: "signals",
  play: "plays",
  recommendation: "plays",
};

const SUPPORTED_PROVENANCE = new Set<ProvenanceStatus>(["verified", "source_document_only"]);
const BOUNDARY: TargetedBrief["boundary"] = Object.freeze({
  read_only: true,
  provider_calls: false,
  network_acquisition: false,
  production_writes: false,
  external_actions: false,
});

const SECTION_COPY: Record<
  TargetedBriefKind,
  readonly { key: TargetedBriefSectionKey; title: string; purpose: string }[]
> = {
  ciso_meeting: [
    { key: "signals", title: "What changed", purpose: "Evidence-backed developments to understand first." },
    { key: "maps", title: "Operating context", purpose: "Supported account context for the conversation." },
    { key: "plays", title: "Suggested conversation", purpose: "Supported themes to discuss, not automatic actions." },
  ],
  proposal_rfx: [
    { key: "signals", title: "Why now", purpose: "Supported developments that may shape the response." },
    { key: "maps", title: "Account context", purpose: "Supported context to ground proposal language." },
    { key: "plays", title: "Response themes", purpose: "Evidence-backed themes for human drafting and review." },
  ],
};

const OPEN_QUESTIONS: Record<TargetedBriefKind, readonly TargetedBriefOpenQuestion[]> = {
  ciso_meeting: [
    {
      id: "ciso-security-controls",
      label: "Meeting prompt · not an account fact",
      text: "Which security controls and review requirements apply to the systems and integrations described in the evidence?",
    },
    {
      id: "ciso-data-resilience",
      label: "Meeting prompt · not an account fact",
      text: "Which identity, data-handling, resilience, and compliance requirements should be confirmed?",
    },
  ],
  proposal_rfx: [
    {
      id: "proposal-requirements",
      label: "Response prompt · not an account fact",
      text: "Which requirements, evaluation criteria, timeline, and procurement constraints should be confirmed?",
    },
    {
      id: "proposal-evidence",
      label: "Response prompt · not an account fact",
      text: "Which response statements need additional evidence before inclusion?",
    },
  ],
};

const GAP_MESSAGES: Record<TargetedBriefGapReason, string> = {
  unsupported_claim_rejected: "Unsupported material was omitted rather than presented as fact.",
  trust_not_ready: "Items awaiting stronger trust or review were omitted from factual sections.",
  missing_accepted_evidence: "Items without accepted supporting evidence were omitted from factual sections.",
  record_not_active: "Inactive, rejected, or superseded material was omitted from factual sections.",
};

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareEvidence(left: TargetedBriefEvidenceReference, right: TargetedBriefEvidenceReference): number {
  return (
    left.claim.id.localeCompare(right.claim.id) ||
    left.excerpt.id.localeCompare(right.excerpt.id) ||
    left.source.id.localeCompare(right.source.id)
  );
}

function assertInputBoundary(bundle: GraphBundle, options: TargetedBriefBuildOptions): void {
  if (!options.input_ref || options.input_ref.length > 512 || /[\r\n\0]/u.test(options.input_ref)) {
    throw new Error("targeted brief input_ref must be a non-empty bounded single-line reference");
  }
  if (options.input_class === "committed_fixture") {
    if (
      options.input_ref.startsWith("/") ||
      options.input_ref.split(/[\\/]/u).includes("..") ||
      !options.input_ref.startsWith("fixtures/")
    ) {
      throw new Error("committed fixture input_ref must be a repository-relative fixtures/ path");
    }
    const fixtureRunsAreClosed = bundle.research_runs.every(
      (run) =>
        run.mode === "fixture" &&
        run.provider === null &&
        run.model === null &&
        run.observed_cost_usd === 0,
    );
    if (!fixtureRunsAreClosed) {
      throw new Error("bundle cannot be represented as a committed fixture input");
    }
  }

  const validation = validateGraphBundle(bundle, { mode: "fixture" });
  if (!validation.ok) {
    throw new Error("targeted brief input failed deterministic GraphBundle validation");
  }
}

function accountId(bundle: GraphBundle): string | null {
  const ids = uniqueSorted([
    ...bundle.sources.map((source) => source.account_id),
    ...bundle.claims.map((claim) => claim.account_id),
    ...bundle.account_objects.map((object) => object.account_id),
  ]);
  return ids.length === 1 ? ids[0]! : null;
}

function trustLabel(status: TargetedBriefAssertion["provenance_status"]): TargetedBriefAssertion["trust_label"] {
  return status === "verified" ? "Verified" : "Source-backed · not independently checked";
}

function evidenceForObject(bundle: GraphBundle, object: AccountObject): TargetedBriefEvidenceReference[] {
  const claimById = new Map(bundle.claims.map((claim) => [claim.id, claim]));
  const excerptById = new Map(bundle.excerpts.map((excerpt) => [excerpt.id, excerpt]));
  const sourceById = new Map(bundle.sources.map((source) => [source.id, source]));
  const objectClaimIds = uniqueSorted(
    bundle.account_object_claims
      .filter(
        (relation) =>
          relation.account_object_id === object.id &&
          (relation.relationship === "primary" || relation.relationship === "supporting"),
      )
      .map((relation) => relation.claim_id),
  );

  const evidence: TargetedBriefEvidenceReference[] = [];
  for (const claimId of objectClaimIds) {
    const claim = claimById.get(claimId);
    if (!claim || claim.status !== "active" || !SUPPORTED_PROVENANCE.has(claim.provenance_status)) continue;

    const links = bundle.claim_evidence
      .filter((link) => link.claim_id === claim.id && link.relationship === "supports")
      .sort((left, right) => left.evidence_excerpt_id.localeCompare(right.evidence_excerpt_id));
    for (const link of links) {
      const excerpt = excerptById.get(link.evidence_excerpt_id);
      const source = excerpt ? sourceById.get(excerpt.source_document_id) : undefined;
      if (
        !excerpt ||
        !source ||
        excerpt.validation_status !== "accepted" ||
        excerpt.kind !== "literal" ||
        source.status !== "active"
      ) {
        continue;
      }
      evidence.push({
        relationship: "supports",
        claim: {
          id: claim.id,
          text: claim.text,
          claim_type: claim.claim_type,
          confidence: claim.confidence,
          provenance_status: claim.provenance_status,
        },
        excerpt: {
          id: excerpt.id,
          text: excerpt.text,
          kind: excerpt.kind,
          validation_status: excerpt.validation_status,
        },
        source: {
          id: source.id,
          title: source.title,
          url: source.url,
          publisher: source.publisher,
          source_type: source.source_type,
          reliability: source.reliability,
          fetched_at: source.fetched_at,
        },
        evidence_current_through: null,
      });
    }
  }

  return evidence.sort(compareEvidence);
}

function classifyGap(object: AccountObject, evidence: readonly TargetedBriefEvidenceReference[]): TargetedBriefGapReason | null {
  if (object.provenance_status === "unsupported") return "unsupported_claim_rejected";
  if (object.status !== "active") return "record_not_active";
  if (!SUPPORTED_PROVENANCE.has(object.provenance_status)) return "trust_not_ready";
  if (evidence.length === 0) return "missing_accepted_evidence";
  return null;
}

function buildSupportedAssertions(bundle: GraphBundle): {
  assertions: SupportedAssertionSeed[];
  gaps: TargetedBriefEvidenceGap[];
} {
  const assertions: SupportedAssertionSeed[] = [];
  const gapCounts = new Map<TargetedBriefGapReason, number>();

  for (const object of [...bundle.account_objects].sort((left, right) => left.id.localeCompare(right.id))) {
    const evidence = evidenceForObject(bundle, object);
    const gapReason = classifyGap(object, evidence);
    if (gapReason) {
      gapCounts.set(gapReason, (gapCounts.get(gapReason) ?? 0) + 1);
      continue;
    }

    const provenanceStatus = object.provenance_status as TargetedBriefAssertion["provenance_status"];
    assertions.push({
      id: object.id,
      lens: LENS_BY_OBJECT_TYPE[object.object_type],
      object_type: object.object_type,
      title: object.title,
      statement: uniqueSorted(evidence.map((item) => item.claim.text)).join(" "),
      provenance_status: provenanceStatus,
      trust_label: trustLabel(provenanceStatus),
      confidence: object.confidence,
      evidence,
    });
  }

  const gapOrder: readonly TargetedBriefGapReason[] = [
    "unsupported_claim_rejected",
    "trust_not_ready",
    "missing_accepted_evidence",
    "record_not_active",
  ];
  const gaps = gapOrder.flatMap((reason) => {
    const count = gapCounts.get(reason) ?? 0;
    return count === 0
      ? []
      : [{ id: `gap-${reason}`, reason, omitted_item_count: count, message: GAP_MESSAGES[reason] }];
  });

  return { assertions, gaps };
}

function buildBrief(
  kind: TargetedBriefKind,
  bundle: GraphBundle,
  options: TargetedBriefBuildOptions,
  supported: ReturnType<typeof buildSupportedAssertions>,
): TargetedBrief {
  const sectionCopy = SECTION_COPY[kind];
  const sectionOrder = new Map(sectionCopy.map((section, index) => [section.key, index]));
  const assertions = supported.assertions
    .map(({ lens, ...assertion }) => ({ ...assertion, section: lens }))
    .sort(
      (left, right) =>
        (sectionOrder.get(left.section) ?? Number.MAX_SAFE_INTEGER) -
          (sectionOrder.get(right.section) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    );
  const sections = sectionCopy.map((section) => ({
    ...section,
    assertion_ids: assertions.filter((assertion) => assertion.section === section.key).map((assertion) => assertion.id),
  }));

  return {
    schema_version: TARGETED_BRIEF_SCHEMA_VERSION,
    kind,
    title: kind === "ciso_meeting" ? "Targeted CISO meeting brief" : "Proposal / RFI / RFP targeted brief",
    account_id: accountId(bundle),
    input: {
      class: options.input_class,
      ref: options.input_ref,
      validation: "passed",
    },
    summary: `${assertions.length} evidence-backed ${assertions.length === 1 ? "point" : "points"} ready for human review.`,
    next_safe_action: "Review the evidence behind the most important point.",
    assertions,
    sections,
    open_questions: OPEN_QUESTIONS[kind],
    evidence_gaps: supported.gaps,
    boundary: BOUNDARY,
  };
}

export function buildTargetedBriefPair(bundle: GraphBundle, options: TargetedBriefBuildOptions): TargetedBriefPair {
  assertInputBoundary(bundle, options);
  const supported = buildSupportedAssertions(bundle);
  return {
    ciso_meeting: buildBrief("ciso_meeting", bundle, options, supported),
    proposal_rfx: buildBrief("proposal_rfx", bundle, options, supported),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return null;
    return value;
  } catch {
    return null;
  }
}

function renderSource(evidence: TargetedBriefEvidenceReference): string {
  const safeUrl = safeHttpUrl(evidence.source.url);
  const title = escapeHtml(evidence.source.title);
  const sourceTitle = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" rel="noreferrer noopener">${title}</a>`
    : `${title} <span class="unsafe-url">Source URL omitted</span>`;
  return `<div class="evidence-packet">
          <dl>
            <dt>Claim</dt><dd>${escapeHtml(evidence.claim.text)}</dd>
            <dt>Accepted excerpt</dt><dd><blockquote>${escapeHtml(evidence.excerpt.text)}</blockquote></dd>
            <dt>Source</dt><dd>${sourceTitle} · ${escapeHtml(evidence.source.publisher ?? "Publisher not supplied")} · ${escapeHtml(evidence.source.reliability)} reliability</dd>
            <dt>Source record timestamp</dt><dd>${escapeHtml(evidence.source.fetched_at)}</dd>
            <dt>Evidence current through</dt><dd>Not supplied by source</dd>
          </dl>
        </div>`;
}

function renderAssertion(assertion: TargetedBriefAssertion): string {
  return `<article class="assertion" data-assertion-id="${escapeHtml(assertion.id)}">
      <div class="assertion-heading">
        <div>
          <p class="kicker">${escapeHtml(assertion.object_type.replaceAll("_", " "))}</p>
          <h3>${escapeHtml(assertion.title)}</h3>
        </div>
        <span class="trust trust-${escapeHtml(assertion.provenance_status)}">${escapeHtml(assertion.trust_label)}</span>
      </div>
      <p>${escapeHtml(assertion.statement)}</p>
      <details>
        <summary>View evidence</summary>
        ${assertion.evidence.map(renderSource).join("\n")}
      </details>
    </article>`;
}

function renderSection(brief: TargetedBrief, section: TargetedBriefSection): string {
  const assertions = brief.assertions.filter((assertion) => assertion.section === section.key);
  const body = assertions.length > 0
    ? assertions.map(renderAssertion).join("\n")
    : `<p class="empty-section"><strong>Evidence gap:</strong> No supported items are available for this section.</p>`;
  return `<section class="brief-section" data-section="${section.key}">
      <header><div><p class="kicker">${escapeHtml(section.purpose)}</p><h2>${escapeHtml(section.title)}</h2></div><span>${assertions.length} supported</span></header>
      ${body}
    </section>`;
}

function renderGaps(brief: TargetedBrief): string {
  const body = brief.evidence_gaps.length > 0
    ? brief.evidence_gaps
        .map(
          (gap) => `<li><strong>Evidence gap</strong> · ${gap.omitted_item_count} omitted<br />${escapeHtml(gap.message)}</li>`,
        )
        .join("\n")
    : "<li>No unsupported or unbound factual material entered this brief.</li>";
  return `<section class="support-panel">
      <p class="kicker">Honest limits</p>
      <h2>Evidence gaps</h2>
      <ul>${body}</ul>
    </section>`;
}

function renderQuestions(brief: TargetedBrief): string {
  return `<section class="support-panel">
      <p class="kicker">Use in the room</p>
      <h2>Open questions</h2>
      <ul>${brief.open_questions
        .map(
          (question) => `<li><span class="template-label">${escapeHtml(question.label)}</span><br />${escapeHtml(question.text)}</li>`,
        )
        .join("\n")}</ul>
    </section>`;
}

export function renderTargetedBriefHtml(brief: TargetedBrief): string {
  if (brief.schema_version !== TARGETED_BRIEF_SCHEMA_VERSION) {
    throw new Error("unsupported targeted brief schema version");
  }
  const accountLabel = brief.account_id ? `Account reference ${escapeHtml(brief.account_id)}` : "Account reference not supplied";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brief.title)} · Atliera</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f4f7fb; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { width: min(1120px, 100%); margin: 0 auto; padding: 32px 22px 56px; }
    .hero { background: linear-gradient(135deg, #13243f, #1f4a5d); color: #f7fbff; border-radius: 24px; padding: 30px; box-shadow: 0 18px 55px rgba(19, 36, 63, .16); }
    .hero h1 { margin: 8px 0; max-width: 760px; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.04; }
    .hero .summary { max-width: 700px; font-size: 1.08rem; color: #dbeaf4; }
    .kicker { margin: 0 0 6px; color: #627089; font-size: .76rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
    .hero .kicker { color: #a9d6df; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .chips span { border: 1px solid rgba(255,255,255,.28); border-radius: 999px; padding: 6px 10px; background: rgba(255,255,255,.08); }
    .next-action { margin: 18px 0 0; padding: 14px 16px; border-left: 4px solid #85d7c4; background: rgba(255,255,255,.08); }
    .brief-section, .support-panel { margin-top: 20px; border: 1px solid #d8e1ec; border-radius: 20px; padding: 20px; background: #fff; }
    .brief-section > header { display: flex; justify-content: space-between; gap: 16px; align-items: start; border-bottom: 1px solid #e7edf4; padding-bottom: 12px; }
    h2 { margin: 0; font-size: 1.35rem; }
    .assertion { margin-top: 14px; border: 1px solid #dce5ee; border-radius: 16px; padding: 16px; background: #fbfdff; }
    .assertion-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
    .assertion h3 { margin: 0; font-size: 1.08rem; }
    .trust, .template-label { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: .78rem; font-weight: 700; }
    .trust-verified { color: #0b573f; background: #dff6ed; }
    .trust-source_document_only { color: #174a6e; background: #e0f0fb; }
    details { margin-top: 12px; border-top: 1px solid #e3e9f0; padding-top: 10px; }
    summary { cursor: pointer; color: #155c73; font-weight: 750; }
    .evidence-packet { margin-top: 12px; border-left: 3px solid #7db9c8; padding: 4px 0 4px 14px; }
    dl { display: grid; grid-template-columns: minmax(150px, .35fr) minmax(0, 1fr); gap: 7px 14px; }
    dt { color: #627089; font-weight: 700; }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    blockquote { margin: 0; }
    a { color: #155c73; }
    .unsafe-url { color: #a33a3a; }
    .support-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
    ul { margin: 12px 0 0; padding-left: 20px; }
    li + li { margin-top: 12px; }
    .template-label { color: #5b3d09; background: #fff1c9; margin-bottom: 4px; }
    .empty-section { color: #627089; }
    footer { margin-top: 22px; color: #627089; font-size: .86rem; text-align: center; }
    @media (max-width: 760px) {
      main { padding: 16px 14px 36px; }
      .hero { padding: 22px 18px; border-radius: 18px; }
      .support-grid { grid-template-columns: 1fr; gap: 0; }
      .brief-section > header, .assertion-heading { flex-direction: column; }
      dl { grid-template-columns: 1fr; }
      dt { margin-top: 6px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="kicker">Atliera · ${escapeHtml(accountLabel)}</p>
      <h1>${escapeHtml(brief.title)}</h1>
      <p class="summary">${escapeHtml(brief.summary)}</p>
      <div class="chips" aria-label="Brief boundaries">
        <span>Read-only · no automatic action</span>
        <span>Evidence-bound assertions only</span>
        <span>Human review required</span>
      </div>
      <p class="next-action"><strong>Next safe action:</strong> ${escapeHtml(brief.next_safe_action)}</p>
    </section>
    ${brief.sections.map((section) => renderSection(brief, section)).join("\n")}
    <div class="support-grid">
      ${renderQuestions(brief)}
      ${renderGaps(brief)}
    </div>
    <footer>Prepared from ${brief.input.class === "committed_fixture" ? "a committed fixture" : "validated repository data"}. No provider call, network acquisition, production write, submission, or external action occurred.</footer>
  </main>
</body>
</html>`;
}
