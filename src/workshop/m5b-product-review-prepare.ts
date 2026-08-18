import { constants as fsConstants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, parse, relative, resolve, sep } from "node:path";

import {
  assertExactKeys,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import {
  assertM5bProductEffectConsumptionIntact,
  assertM5bProductEffectLedgerReceipt,
  claimM5bProductEffectAttempt,
  type M5bProductEffectAttempt,
  type M5bProductEffectConsumption,
  type M5bProductEffectLedger,
  type M5bProductEffectSourceIdentity,
} from "../authority/m5b-product-effect-authority.ts";
import {
  exactSecArchiveTargetPolicySha256,
  validateExactSecArchiveTargetPolicy,
} from "../capability/exact-sec-archive-target-policy.ts";
import { getH2CapabilityRegistryEntry, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID } from "../capability/h2-registry.ts";
import {
  M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID,
  M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256,
  M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID,
} from "../capability/m4-sec-live-adapter.ts";
import {
  admitM4CustodyEnvelopeBytes,
  type M4CustodyEnvelopePins,
} from "../capability/m4-custody-envelope-admission.ts";
import {
  M4_CANONICAL_TARGET_POLICY,
  M4_TARGET_POLICY_REF,
  M4_TARGET_POLICY_SHA256,
} from "../capability/m4-target-policy.ts";
import { isPublicAddress } from "../capability/public-http-fetch-policy.ts";
import { validatedCandidateSha256 } from "../graph/candidate-delta.ts";
import type { GraphBundle } from "../graph/types.ts";
import {
  createValidatedCandidate,
  type ValidatedCandidate,
} from "../graph/validated-candidate.ts";
import { assertProposalDerivedRecordsUnverified } from "../validation/proposal-materialization.ts";
import {
  M5B_PRODUCT_REVIEW_LIMITS,
  m5bProductReviewCanonicalSha256,
  refuseM5bProductReview,
  validateM5bProductReviewRequest,
  type M5bProductReviewLens,
  type M5bProductReviewRequest,
} from "./m5b-product-review-contract.ts";
import {
  M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
  M5B_PRODUCT_REVIEW_PACKET_KIND,
  M5B_PRODUCT_REVIEW_PACKET_VERSION,
  M5B_PRODUCT_REVIEW_QUESTION_LABELS,
  M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND,
  M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION,
  M5B_PRODUCT_REVIEW_TRANSFORMATION_VERSION,
  type M5bProductReviewEvidenceBinding,
  type M5bProductReviewPackageBinding,
  type M5bProductReviewPackageData,
  type M5bProductReviewPacket,
  type M5bProductReviewPacketContent,
  type M5bProductReviewPacketProposal,
  type M5bProductReviewSanitizedSource,
  type M5bProductReviewSanitizedSourcePack,
  type M5bProductReviewSanitizedSourcePackContent,
  type M5bProductReviewSourceProvenance,
} from "./m5b-product-review-package.ts";
import {
  validateM5bProductReviewPackageArtifactSelfConsistency,
  type M5bProductReviewPackageArtifactSet,
  type M5bProductReviewTrustedAdmittedPackageArtifacts,
} from "./m5b-product-review-package-admission.ts";

export const M5B_PRODUCT_REVIEW_PREPARE_RESULT_KIND = "m5b-product-review-prepare-result" as const;
export const M5B_PRODUCT_REVIEW_PREPARE_RESULT_VERSION = "2" as const;

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const SOURCE_ID = /^src_[a-z0-9][a-z0-9_-]{0,51}$/;
const SAFE_PROVENANCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const PROVENANCE_KEYS = Object.freeze([
  "classification", "exactUrl", "responseByteSize", "responseSha256", "outerCustodySha256",
  "targetPolicySha256", "capabilityId", "adapterId", "adapterSha256", "authorityId", "consumptionId",
  "implementationCommit", "implementationTree", "acquisitionConsumptionSha256",
  "retainedReadAuthorityId", "retainedReadConsumptionId", "retainedReadImplementationCommit",
  "retainedReadImplementationTree", "retainedReadLedgerNamespaceSha256", "retainedReadLedgerRecordSha256",
] as const);
interface FreshPrepareArtifactPin {
  readonly packageId: string;
  readonly preparedAt: string;
  readonly sourcePackSha256: string;
  readonly candidateSha256: string;
  readonly reviewPacketSha256: string;
  readonly artifactSetSha256: string;
}
const FRESH_PREPARE_ARTIFACT_PINS = new WeakMap<object, FreshPrepareArtifactPin>();
const TRUSTED_PREPARE_RESULT_PINS = new WeakMap<object, FreshPrepareArtifactPin>();

function registerFreshPrepareArtifactSet(
  artifacts: M5bProductReviewPackageArtifactSet,
  packageData: Readonly<M5bProductReviewPackageData>,
): void {
  FRESH_PREPARE_ARTIFACT_PINS.set(artifacts as object, Object.freeze({
    packageId: packageData.packageBinding.packageId,
    preparedAt: packageData.packageBinding.preparedAt,
    sourcePackSha256: packageData.sourcePack.sourcePackSha256,
    candidateSha256: packageData.candidateSha256,
    reviewPacketSha256: packageData.reviewPacket.reviewPacketSha256,
    artifactSetSha256: m5bProductReviewCanonicalSha256(artifacts),
  }));
}

function admitFreshPrepareArtifactSet(
  artifacts: M5bProductReviewPackageArtifactSet,
): Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts> {
  const pin = FRESH_PREPARE_ARTIFACT_PINS.get(artifacts as object);
  if (pin === undefined) refuseM5bProductReview("fresh_prepare_artifact_pin");
  if (m5bProductReviewCanonicalSha256(artifacts) !== pin.artifactSetSha256) {
    refuseM5bProductReview("fresh_prepare_artifact_binding");
  }
  const admitted = validateM5bProductReviewPackageArtifactSelfConsistency(artifacts);
  if (admitted.sourcePack.packageBinding.packageId !== pin.packageId ||
      admitted.sourcePack.packageBinding.preparedAt !== pin.preparedAt ||
      admitted.sourcePack.sourcePackSha256 !== pin.sourcePackSha256 ||
      validatedCandidateSha256(admitted.candidate) !== pin.candidateSha256 ||
      admitted.reviewPacket.reviewPacketSha256 !== pin.reviewPacketSha256) {
    refuseM5bProductReview("fresh_prepare_artifact_binding");
  }
  return Object.freeze({
    sourcePack: admitted.sourcePack,
    candidate: admitted.candidate,
    reviewPacket: admitted.reviewPacket,
    featuredMaterialChangeChain: admitted.featuredMaterialChangeChain,
    admissionAssurance: "trusted_prepare_result_capability_authenticated" as const,
  });
}
const OPTIONS_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 4,
  max_depth: 4,
  max_expanded_json_value_occurrences: 64,
  max_nodes: 16,
  max_object_fields: 5,
  max_string_utf8_bytes: 2_048,
  max_total_string_utf8_bytes: 16 * 1024,
});
const CUSTODY_JSON_LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: 10_000,
  max_depth: 32,
  max_expanded_json_value_occurrences: 80_000,
  max_nodes: 40_000,
  max_object_fields: 256,
  max_string_utf8_bytes: 512 * 1024,
  max_total_string_utf8_bytes: 2 * 1024 * 1024,
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/&/gu, "&amp;")
    .replace(/([\\`*_[\]{}<>#|])/gu, "\\$1")
    .replace(/\s+/gu, " ")
    .trim();
}

function displayCurrency(value: string | null): string {
  return value === null ? "Not supplied" : value;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function lensLabel(value: "signal" | "map" | "play"): string {
  return value === "signal" ? "Signal" : value === "map" ? "Map" : "Play";
}

function classificationLabel(value: "source_fact" | "analysis" | "recommendation"): string {
  return value === "source_fact" ? "Source fact" : value === "analysis" ? "Analysis" : "Recommendation";
}

function evidenceRoleLabel(value: "account_identity" | "account_context" | "material_change"): string {
  switch (value) {
    case "account_identity": return "Account identity";
    case "account_context": return "Account context";
    case "material_change": return "Material change";
    default: return refuseM5bProductReview("render_evidence_role");
  }
}

function materialChangeAssertionLabel(binding: M5bProductReviewEvidenceBinding): string | null {
  const assertion = binding.materialChangeAssertion;
  if (assertion === null) return null;
  const status = assertion.status === "completed" ? "Completed" :
    assertion.status === "announced" ? "Announced" : "Agreement reached";
  return `Account event · Affirmed · ${status}`;
}

function evidenceAnchor(evidenceId: string): string {
  return `evidence-${evidenceId}`;
}

function proposalAnchor(proposalId: string): string {
  return `proposal-${proposalId}`;
}

function markdownEvidenceLink(evidenceId: string): string {
  return `[\`${evidenceId}\`](#${evidenceAnchor(evidenceId)})`;
}

function markdownProposalLink(proposalId: string): string {
  return `[\`${proposalId}\`](#${proposalAnchor(proposalId)})`;
}

function evidenceMarkdown(
  binding: M5bProductReviewEvidenceBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const source = sourcePack.sources.find((candidate) => candidate.sourceId === binding.sourceId)!;
  const assertion = materialChangeAssertionLabel(binding);
  return [
    `<a id="${evidenceAnchor(binding.evidenceId)}"></a>`,
    `- **Evidence** \`${binding.evidenceId}\` — source \`${source.sourceId}\``,
    `  - Evidence role: **${evidenceRoleLabel(binding.evidenceRole)}**`,
    ...(assertion === null ? [] : [`  - Material-change assertion: **${assertion}**`]),
    `  - Package-recorded origin SHA-256: \`${source.originContentSha256}\``,
    `  - Exact excerpt SHA-256: \`${binding.exactQuoteSha256}\``,
    `  - Package-recorded source character span: \`[${binding.sourceCharStart}, ${binding.sourceCharEnd})\``,
    `  - Evidence current through: ${escapeMarkdown(displayCurrency(source.evidenceCurrentThrough))}`,
    `  - Exact package excerpt: “${escapeMarkdown(binding.exactQuote)}”`,
  ].join("\n");
}

function renderM5bProductReviewMeetingBrief(
  artifacts: M5bProductReviewPackageArtifactSet,
): string {
  const admitted = admitFreshPrepareArtifactSet(artifacts);
  const { sourcePack, reviewPacket: packet } = admitted;
  const { signal } = admitted.featuredMaterialChangeChain;
  const materialEvidence = signal.evidenceBindings[0]!;
  const materialSource = sourcePack.sources.find((source) => source.sourceId === materialEvidence.sourceId)!;
  const materialAssertion = materialChangeAssertionLabel(materialEvidence)!;
  const announcedStatusLines = materialEvidence.materialChangeAssertion?.status === "announced"
    ? [
        "- Completion or results: **Not established by this selected source pack.**",
        "- Meeting-use warning: **Reconfirm the current transaction status before a customer meeting.**",
      ]
    : ["- Meeting-use warning: **Reconfirm the current event status before a customer meeting.**"];
  const evidence = sourcePack.sources.flatMap((source) => source.evidenceBindings);
  const proposalLines = packet.proposals.map((proposal) => {
    const support = proposal.supportingProposalIds.length === 0
      ? "Attributed by this package to an exact excerpt; no analytical dependency."
      : `Supporting proposals: ${proposal.supportingProposalIds.map(markdownProposalLink).join(", ")}.`;
    const caveats = proposal.caveats.length === 0
      ? "No analytical caveat: this source fact only reports the package attribution."
      : `Request-supplied caveat quotations: ${proposal.caveats
        .map((value) => `“${escapeMarkdown(value)}”`).join("; ")}`;
    const task = proposal.safeTask === null
      ? ""
      : `\n  - Safe draft task: ${escapeMarkdown(proposal.safeTask.description)} \(non\-executable\).`;
    const heading = proposal.classification === "source_fact"
      ? `${classificationLabel(proposal.classification)} · ${lensLabel(proposal.lens)} · Attributed exact quotation`
      : `${classificationLabel(proposal.classification)} · ${lensLabel(proposal.lens)} · Proposed request narrative`;
    const body = proposal.classification === "source_fact"
      ? [`Attributed quotation: “${escapeMarkdown(proposal.evidenceBindings[0]!.exactQuote)}”`]
      : [
        `Request-supplied title quotation: “${escapeMarkdown(proposal.title)}”`,
        `Request-supplied summary quotation: “${escapeMarkdown(proposal.summary)}”`,
      ];
    return [
      `<a id="${proposalAnchor(proposal.proposalId)}"></a>`,
      `- **${heading}** (\`${proposal.proposalId}\`)`,
      ...body.map((value) => `  - ${value}`),
      `  - Evidence: ${proposal.evidenceBindings.map((binding) =>
        `${markdownEvidenceLink(binding.evidenceId)} (${evidenceRoleLabel(binding.evidenceRole)})`).join(", ")}.`,
      `  - ${support}`,
      `  - ${caveats}${task}`,
    ].join("\n");
  });
  const meetingPlanLines = packet.meetingPlan === undefined ? [] : [
    "## Structured meeting plan",
    "",
    `- **Primary audience:** Request-supplied: “${escapeMarkdown(packet.meetingPlan.primaryAudience)}”`,
    `- **Meeting objective:** Request-supplied: “${escapeMarkdown(packet.meetingPlan.meetingObjective)}”`,
    "",
    ...packet.meetingPlan.orderedQuestions.flatMap((item, index) => [
      `### ${index + 1}. Discovery question`,
      "",
      `Request-supplied question: “${escapeMarkdown(item.question)}”`,
      "",
      "**Why this question:**",
      "",
      `Request-supplied rationale: “${escapeMarkdown(item.whyAsked)}”`,
      "",
      "**Desired learning:**",
      "",
      `Request-supplied learning target: “${escapeMarkdown(item.desiredLearning)}”`,
      "",
      "**Follow-up signal:**",
      "",
      `Request-supplied signal: “${escapeMarkdown(item.followUpSignal)}”`,
      "",
    ]),
    "### Overall close criterion",
    "",
    `Request-supplied close criterion: “${escapeMarkdown(packet.meetingPlan.overallCloseCriterion)}”`,
    "",
  ];

  return [
    "# DRAFT targeted meeting brief — NOT SENT / NOT RATIFIED",
    "",
    `Account: **${escapeMarkdown(packet.subject.accountName)}** (\`${escapeMarkdown(packet.subject.accountId)}\`)`,
    "",
    "> Preparation artifact only. This brief has not been sent, independently verified, quality-passed, human-ratified, armed, or made durable. It carries no write authority and no apply eligibility.",
    "",
    "## Freshness and status",
    "",
    `- Evidence current through: **${escapeMarkdown(displayCurrency(materialSource.evidenceCurrentThrough))}**`,
    `- Package-classified event status: **${materialAssertion}**`,
    ...announcedStatusLines,
    "",
    ...meetingPlanLines,
    "## Five customer questions",
    "",
    ...packet.customerQuestions.flatMap((item, index) => [
      `### ${index + 1}. ${item.question}`,
      "",
      index === 1
        ? `Attributed material-change quotation: “${escapeMarkdown(packet.proposals.find((proposal) =>
          proposal.proposalId === item.proposalBindingIds[0])!.evidenceBindings[0]!.exactQuote)}”`
        : `Request-supplied draft answer quotation: “${escapeMarkdown(item.answer)}”`,
      ...(item.evidenceBindingIds.length === 0 ? [] : [
        "",
        `${index === 1 ? "Material-change" : "Supporting"} evidence: ${item.evidenceBindingIds
          .map(markdownEvidenceLink).join(", ")}.`,
      ]),
      ...(item.proposalBindingIds.length === 0 ? [] : [
        "",
        `Supporting proposals: ${item.proposalBindingIds.map(markdownProposalLink).join(", ")}.`,
      ]),
      "",
    ]),
    "## Proposed Signals, Maps, and Plays",
    "",
    ...proposalLines,
    "",
    "## Package evidence register",
    "",
    ...evidence.flatMap((binding) => [evidenceMarkdown(binding, sourcePack), ""]),
    "## Package bindings",
    "",
    `- Package ID: \`${packet.packageBinding.packageId}\``,
    `- Request raw SHA-256: \`${packet.packageBinding.requestRawSha256}\``,
    `- Request canonical SHA-256: \`${packet.packageBinding.requestCanonicalSha256}\``,
    `- Sanitized source-pack SHA-256: \`${packet.sourcePackSha256}\``,
    `- Validated candidate SHA-256: \`${packet.candidateSha256}\``,
    `- Review-packet SHA-256: \`${packet.reviewPacketSha256}\``,
    `- Superseded package result SHA-256: \`${packet.packageBinding.supersededPackageResultSha256}\``,
    `- Execution commit/tree: \`${packet.packageBinding.executionCommit}\` / \`${packet.packageBinding.executionTree}\``,
    `- Owner authorization ID: \`${packet.packageBinding.ownerAuthorizationId}\``,
    "",
    "Supersession creates a new package. It preserves the old package bytes and producer identity; it does not rewrite historical provenance.",
    "",
    "## Prepare-command effect boundary",
    "",
    "Network calls 0 · provider calls 0 · acquisitions 0 · database writes 0 · graph writes 0 · deployments 0 · outbound actions 0 · apply operations 0.",
    "",
    "These counts cover this prepare command only. Separately authorized source acquisition or retained-custody reads belong in an immutable external execution receipt; they must not be added by editing these generated artifacts.",
    "",
    "Local Accept/Reject review choices, if made in the Workshop page, are local draft state only. They are not saved and are not ratification.",
    "",
  ].join("\n");
}

function evidenceHtml(
  binding: M5bProductReviewEvidenceBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
  anchored = false,
): string {
  const source = sourcePack.sources.find((candidate) => candidate.sourceId === binding.sourceId)!;
  const assertion = materialChangeAssertionLabel(binding);
  const assertionHtml = assertion === null ? "" :
    `<p><strong>Material-change assertion:</strong> ${escapeHtml(assertion)}</p>`;
  const id = anchored ? ` id="${escapeHtml(evidenceAnchor(binding.evidenceId))}"` : "";
  return `<li class="evidence-item"${id}><blockquote>${escapeHtml(binding.exactQuote)}</blockquote><p><strong>Evidence ID:</strong> ${escapeHtml(binding.evidenceId)} · <strong>Evidence role:</strong> ${evidenceRoleLabel(binding.evidenceRole)}</p>${assertionHtml}<p><strong>Source title:</strong> ${escapeHtml(source.title)} · <strong>Publisher:</strong> ${escapeHtml(source.publisher)}</p><p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(source.evidenceCurrentThrough))} · <strong>Acquired at:</strong> ${escapeHtml(source.acquiredAt)}</p><p><strong>Source ID:</strong> <code>${escapeHtml(source.sourceId)}</code> · <strong>Original span:</strong> <code>[${binding.sourceCharStart}, ${binding.sourceCharEnd})</code></p><p class="hash">Exact excerpt SHA-256 ${escapeHtml(binding.exactQuoteSha256)} · source raw SHA-256 ${escapeHtml(source.originContentSha256)}</p></li>`;
}

function proposalHtml(
  proposal: M5bProductReviewPacketProposal,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const dependency = proposal.supportingProposalIds.length === 0
    ? "Direct package attribution to an exact excerpt; no analytical dependency."
    : `${countLabel(proposal.supportingProposalIds.length, "supporting proposal")}: ${proposal.supportingProposalIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}`;
  const caveats = proposal.caveats.length === 0
    ? "This source fact reports the package's exact-excerpt attribution; it does not prove membership in omitted original bytes."
    : `<blockquote><ul>${proposal.caveats.map((caveat) =>
      `<li><strong>Request-supplied caveat:</strong> ${escapeHtml(caveat)}</li>`).join("")}</ul></blockquote>`;
  const sourceTrust = proposal.classification === "source_fact"
    ? "Package-attributed · not independently verified"
    : "Evidence-informed interpretation · not independently verified";
  const safeTask = proposal.safeTask === null ? "" :
    `<div class="safe-task"><strong>Safe preparation task</strong><p>${escapeHtml(proposal.safeTask.description)}</p><span>Draft only · non-executable · no outbound action</span></div>`;
  const controlId = escapeHtml(proposal.proposalId);
  const narrative = proposal.classification === "source_fact"
    ? `<h3>Attributed source excerpt</h3><blockquote>${escapeHtml(proposal.evidenceBindings[0]!.exactQuote)}</blockquote>`
    : `<h3>Proposed ${classificationLabel(proposal.classification).toLocaleLowerCase("en-US")}</h3><blockquote><p><strong>Request-supplied title:</strong> ${escapeHtml(proposal.title)}</p><p><strong>Request-supplied summary:</strong> ${escapeHtml(proposal.summary)}</p></blockquote>`;
  return `<article class="proposal-card ${proposal.classification}" id="proposal-${controlId}">
    <div class="card-labels"><span class="classification">${classificationLabel(proposal.classification)}</span><span class="lens">${lensLabel(proposal.lens)}</span><span class="pending">Pending</span></div>
    ${narrative}
    <p class="trust-line">${sourceTrust} · system-created · proposed · not durable</p>
    <p class="trust-line">Not human-ratified · not quality-passed · current effective authorization: ${escapeHtml("none")}</p>
    <div class="support"><strong>Dependencies</strong><p>${dependency}</p></div>
    <div class="caveats"><strong>${proposal.caveats.length === 1 ? "Caveat" : "Caveats"}</strong>${caveats}</div>
    ${safeTask}
    <details class="evidence"><summary>${countLabel(proposal.evidenceBindings.length, "evidence binding")}</summary><ul>${proposal.evidenceBindings.map((binding) => evidenceHtml(binding, sourcePack)).join("")}</ul></details>
    <fieldset class="local-controls" aria-describedby="local-copy-${controlId}"><legend>Local draft disposition</legend><div class="choice-row"><label class="choice"><input type="radio" name="local-${controlId}" value="accept" />Accept</label><label class="choice"><input type="radio" name="local-${controlId}" value="reject" />Reject</label></div><p id="local-copy-${controlId}">Local draft only · not saved · not ratified · no write authority. This page has no submit, apply, or persist action.</p></fieldset>
  </article>`;
}

function renderM5bProductReviewWorkshopHtml(
  artifacts: M5bProductReviewPackageArtifactSet,
): string {
  const admitted = admitFreshPrepareArtifactSet(artifacts);
  const { sourcePack, reviewPacket: packet } = admitted;
  const { signal, map, play } = admitted.featuredMaterialChangeChain;
  const materialEvidence = signal.evidenceBindings[0]!;
  const materialSource = sourcePack.sources.find((source) => source.sourceId === materialEvidence.sourceId)!;
  const featuredAssertion = materialChangeAssertionLabel(materialEvidence);
  const announcedStatusHtml = materialEvidence.materialChangeAssertion?.status === "announced"
    ? `<p><strong>Completion or results:</strong> Not established by this selected source pack.</p><p><strong>Meeting-use warning:</strong> Reconfirm the current transaction status before a customer meeting.</p>`
    : `<p><strong>Meeting-use warning:</strong> Reconfirm the current event status before a customer meeting.</p>`;
  const questionSupport = (
    item: M5bProductReviewPacket["customerQuestions"][number],
    index: number,
  ) => {
    const evidenceLinks = item.evidenceBindingIds.length === 0 ? "" :
      `<p class="trust-line"><strong>${index === 1 ? "Material-change" : "Supporting"} evidence:</strong> ${item.evidenceBindingIds
        .map((id) => `<a href="#${escapeHtml(evidenceAnchor(id))}"><code>${escapeHtml(id)}</code></a>`).join(", ")}</p>`;
    const proposalLinks = item.proposalBindingIds.length === 0 ? "" :
      `<p class="trust-line"><strong>Supporting proposals:</strong> ${item.proposalBindingIds
        .map((id) => `<a href="#${escapeHtml(proposalAnchor(id))}"><code>${escapeHtml(id)}</code></a>`).join(", ")}</p>`;
    return `${evidenceLinks}${proposalLinks}`;
  };
  const meetingAnswers = packet.customerQuestions.map((item, index) => {
    const answer = index === 1
      ? `<p><strong>Attributed material-change quotation:</strong></p><blockquote>${escapeHtml(materialEvidence.exactQuote)}</blockquote>`
      : `<p><strong>Request-supplied draft answer:</strong></p><blockquote>${escapeHtml(item.answer)}</blockquote>`;
    return `<article class="brief-answer"><h3>${escapeHtml(item.question)}</h3>${answer}${questionSupport(item, index)}</article>`;
  }).join("");
  const meetingPlanHtml = packet.meetingPlan === undefined ? "" :
    `<section class="meeting-plan" aria-labelledby="structured-meeting-plan"><h3 id="structured-meeting-plan">Structured meeting plan</h3><dl class="meeting-plan-summary"><div><dt>Primary audience</dt><dd><blockquote>${escapeHtml(packet.meetingPlan.primaryAudience)}</blockquote></dd></div><div><dt>Meeting objective</dt><dd><blockquote>${escapeHtml(packet.meetingPlan.meetingObjective)}</blockquote></dd></div></dl><ol class="meeting-question-list">${packet.meetingPlan.orderedQuestions.map((item) => `<li class="meeting-question-block"><article><h4>Discovery question</h4><blockquote>${escapeHtml(item.question)}</blockquote><p><strong>Why this question:</strong></p><blockquote>${escapeHtml(item.whyAsked)}</blockquote><p><strong>Desired learning:</strong></p><blockquote>${escapeHtml(item.desiredLearning)}</blockquote><p><strong>Follow-up signal:</strong></p><blockquote>${escapeHtml(item.followUpSignal)}</blockquote></article></li>`).join("")}</ol><div class="meeting-close-criterion"><h4>Overall close criterion</h4><blockquote>${escapeHtml(packet.meetingPlan.overallCloseCriterion)}</blockquote></div></section>`;
  const meetingLens = (label: "Signal" | "Map" | "Play", proposal: M5bProductReviewPacketProposal) => {
    const caveats = proposal.caveats.length === 0 ? "" :
      `<p><strong>Needs attention:</strong></p><blockquote>${proposal.caveats.map((value) =>
        `<p><strong>Request-supplied caveat:</strong> ${escapeHtml(value)}</p>`).join("")}</blockquote>`;
    const safeTask = proposal.safeTask === null ? "" :
      `<p><strong>Safe next task:</strong> ${escapeHtml(proposal.safeTask.description)}</p>`;
    const narrative = proposal.classification === "source_fact"
      ? `<h3>Attributed source excerpt</h3><blockquote>${escapeHtml(proposal.evidenceBindings[0]!.exactQuote)}</blockquote>`
      : `<h3>Proposed ${classificationLabel(proposal.classification).toLocaleLowerCase("en-US")}</h3><blockquote><p><strong>Request-supplied title:</strong> ${escapeHtml(proposal.title)}</p><p><strong>Request-supplied summary:</strong> ${escapeHtml(proposal.summary)}</p></blockquote>`;
    return `<article class="brief-lens"><div class="card-labels"><span class="lens">${label}</span><span class="classification">${classificationLabel(proposal.classification)}</span></div>${narrative}${caveats}${safeTask}<p class="trust-line">Proposed · not independently verified · not human-ratified · not durable</p></article>`;
  };
  const custody = sourcePack.sources.map((source) => `<article class="source-card">
    <h3>Source record</h3><p><strong>Source title:</strong> ${escapeHtml(source.title)}</p>
    <p><strong>Source ID:</strong> <code>${escapeHtml(source.sourceId)}</code> · <strong>Publisher:</strong> ${escapeHtml(source.publisher)} · <strong>Source type:</strong> ${escapeHtml(source.sourceType)}</p>
    <p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(source.evidenceCurrentThrough))}</p>
    <p><strong>Acquired at:</strong> ${escapeHtml(source.acquiredAt)} · <strong>Source kind:</strong> ${escapeHtml(source.sourceKind)} · <strong>Encoding:</strong> ${escapeHtml(source.contentEncoding)}</p>
    <p><strong>Canonical HTTPS source:</strong> <span class="source-url">${escapeHtml(source.canonicalUrl)}</span></p>
    <p class="hash">Outer/origin ${escapeHtml(source.originContentSha256)}<br />Decoded ${escapeHtml(source.decodedContentSha256)} (${source.decodedByteSize} bytes)<br />Stored excerpts ${escapeHtml(source.storedContentSha256)}<br />Transformation ${escapeHtml(source.transformationManifestSha256)}</p>
  </article>`).join("");
  const questions = packet.customerQuestions.map((item, index) => {
    const answer = index === 1
      ? `<p><strong>Attributed material-change quotation:</strong></p><blockquote>${escapeHtml(materialEvidence.exactQuote)}</blockquote>`
      : `<p><strong>Request-supplied draft answer:</strong></p><blockquote>${escapeHtml(item.answer)}</blockquote>`;
    return `<article class="question-card"><h3>${escapeHtml(item.question)}</h3>${answer}${questionSupport(item, index)}</article>`;
  }).join("");
  const evidence = sourcePack.sources.flatMap((source) => source.evidenceBindings);
  const evidenceRegister = evidence.map((binding) => evidenceHtml(binding, sourcePack, true)).join("");
  const sourceRecordLabel = sourcePack.sources.every((source) => source.sourceKind === "synthetic_fixture")
    ? "development source record"
    : "package source record";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><link rel="icon" href="data:," />
<title>Atliera draft product review — ${escapeHtml(packet.subject.accountName)}</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18201c;background:#f4f3ed;line-height:1.5}
html,body{max-width:100%;overflow-x:hidden}*,:before,:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#dbe9dd 0,transparent 32rem),#f4f3ed;color:#18201c}
a{color:#174d37;text-underline-offset:3px}a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #d37232;outline-offset:3px}
main{width:min(100%,1120px);min-width:0;margin:0 auto;padding:24px;overflow-wrap:anywhere}.boundary{min-width:0;border:1px solid #b56832;background:#fff4e6;border-radius:14px;padding:12px 16px;font-weight:700}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;color:#35634e;margin:22px 0 4px}h1{font-size:clamp(2rem,5vw,4.5rem);line-height:1.02;margin:.1em 0;max-width:15ch}h2{font-size:clamp(1.45rem,3vw,2.2rem);line-height:1.15}h3{line-height:1.25}.lede{font-size:1.12rem;max-width:68ch}.primary-action{display:inline-flex;align-items:center;justify-content:center;min-height:48px;max-width:100%;padding:11px 18px;border-radius:999px;background:#174d37;color:white;font-weight:800;text-decoration:none;margin:8px 0 18px}.signal-spotlight{min-width:0;border-left:8px solid #d37232;border-radius:16px;padding:17px 20px;background:#203f31;color:#f8fff9;box-shadow:0 12px 28px #18372628}.signal-spotlight p{font-size:1.08rem}.signal-spotlight .tag{color:#ffd9ad;text-transform:uppercase;letter-spacing:.1em;font-weight:800;font-size:.76rem}
section{min-width:0;margin:32px 0}.question-grid,.proposal-grid,.source-grid,.brief-answer-grid,.brief-lens-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.question-grid>*,.proposal-grid>*,.source-grid>*,.brief-answer-grid>*,.brief-lens-grid>*{min-width:0}.question-card,.proposal-card,.source-card,.brief-answer,.brief-lens,.trust-key{min-width:0;background:#fff;border:1px solid #cdd4ca;border-radius:16px;padding:18px}.question-card h3,.brief-answer h3{font-size:1rem;color:#35634e}.proposal-card{display:flex;flex-direction:column;gap:8px;border-top:6px solid #7a8f7e}.proposal-card.source_fact{border-top-color:#39795b}.proposal-card.analysis{border-top-color:#6671a8}.proposal-card.recommendation{border-top-color:#d37232}.card-labels{display:flex;flex-wrap:wrap;gap:7px}.card-labels span{border-radius:999px;padding:4px 9px;font-size:.76rem;font-weight:800}.classification{background:#e6efe7}.lens{background:#e9e7f5}.pending{background:#fff0dd}.trust-line{color:#46554d;font-size:.9rem}.support,.caveats,.safe-task,.freshness{min-width:0;background:#f5f6f1;border-radius:10px;padding:12px}.safe-task{border:1px solid #d37232;background:#fff8ee}.freshness{border:1px solid #6671a8;background:#f0f1fb;margin:12px 0}.safe-task span{font-size:.88rem;font-weight:700}.evidence{min-width:0}.support strong,.caveats strong,.safe-task strong{display:block;margin-bottom:8px}.evidence summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:800}.evidence ul{padding-left:20px}.evidence-item{min-width:0}.evidence-item blockquote{margin:10px 0;padding-left:12px;border-left:3px solid #9aa99d}.hash,.source-url,code{overflow-wrap:anywhere;word-break:break-word}.hash,.source-url{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.76rem;color:#536059}.local-controls{min-width:0;border:1px solid #829186;border-radius:12px;padding:12px;margin-top:auto}.local-controls legend{font-weight:800}.choice-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.choice{min-width:0;min-height:44px;display:flex;align-items:center;gap:10px;border:1px solid #8b978f;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}.choice input{width:22px;height:22px;flex:0 0 auto}.local-controls p{font-size:.84rem;margin-bottom:0}.trust-key ul{padding-left:20px}#draft-meeting-brief{border:2px solid #39795b;border-radius:18px;background:#edf5ed;padding:20px}.brief-account{font-size:1.08rem}.brief-answer-grid{margin:16px 0}.brief-answer:last-child{grid-column:1/-1}.brief-lens-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.brief-lens{border-top:6px solid #39795b}.brief-lens:nth-child(2){border-top-color:#6671a8}.brief-lens:nth-child(3){border-top-color:#d37232}.source-details{border-top:1px solid #b8c0b7;padding-top:24px}.source-details>summary{min-height:44px;cursor:pointer;font-weight:800;font-size:1.25rem}.zero-effect{background:#182c23;color:#edf9f0;border-radius:14px;padding:16px}.package-binding{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;overflow-wrap:anywhere}.footer-note{font-weight:800;color:#824919}
.meeting-plan{margin:22px 0;padding:18px;border:1px solid #829186;border-radius:16px;background:#f8faf6}.meeting-plan-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0}.meeting-plan-summary>div,.meeting-question-block,.meeting-close-criterion{min-width:0;background:#fff;border:1px solid #cdd4ca;border-radius:12px;padding:14px}.meeting-plan-summary dt{font-weight:800}.meeting-plan-summary dd{margin:0}.meeting-plan-summary blockquote,.meeting-question-block blockquote,.meeting-close-criterion blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #6671a8}.meeting-question-list{display:grid;gap:14px;padding-left:2.2rem}.meeting-question-block{padding-left:16px}.meeting-question-block::marker{font-size:1.2rem;font-weight:900;color:#174d37}.meeting-question-block h4,.meeting-close-criterion h4{margin-top:0}.meeting-close-criterion{margin-top:14px;border-color:#d37232;background:#fff8ee}
@media(max-width:720px){main{padding:14px 12px}.question-grid,.proposal-grid,.source-grid,.brief-answer-grid,.brief-lens-grid,.meeting-plan-summary{grid-template-columns:minmax(0,1fr)}.brief-answer:last-child{grid-column:auto}section{margin:24px 0}.boundary{font-size:.88rem}h1{font-size:2.35rem}.signal-spotlight{padding:14px 15px}.proposal-card,.question-card,.source-card,.brief-answer,.brief-lens{padding:15px}#draft-meeting-brief{padding:15px}}
@media(max-width:420px){.choice-row{grid-template-columns:minmax(0,1fr)}.primary-action{width:100%}}
</style></head><body><main>
<div class="boundary">DRAFT · NOT SENT · NOT RATIFIED · UNARMED · no apply eligibility · current effective authorization: ${escapeHtml(packet.authority.currentEffectiveAuthorization)}</div>
<p class="eyebrow">Product-first account preparation</p><h1>Account review draft</h1>
<p class="lede"><strong>Request-supplied account name:</strong> ${escapeHtml(packet.subject.accountName)}</p><p class="lede">A package-bound draft for human review. Customer meaning comes first; custody detail follows after the proposed work.</p>
<a class="primary-action" href="#draft-meeting-brief">Review the draft meeting brief</a>
<section class="signal-spotlight" aria-labelledby="early-signal"><span class="tag">Signal · ${classificationLabel(signal.classification)}</span><h2 id="early-signal">Attributed material-change quotation</h2><blockquote>${escapeHtml(materialEvidence.exactQuote)}</blockquote><p><strong>Material-change assertion:</strong> ${escapeHtml(featuredAssertion!)}</p><p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(materialSource.evidenceCurrentThrough))}</p>${announcedStatusHtml}<small>Proposed · package-attributed · not independently verified</small></section>
<section aria-labelledby="customer-questions"><p class="eyebrow">Customer meaning</p><h2 id="customer-questions">Five questions for this account</h2><div class="question-grid">${questions}</div></section>
<section class="trust-key" aria-labelledby="trust-key"><h2 id="trust-key">Read the trust labels literally</h2><ul><li><strong>Package-attributed</strong> means the complete artifact set carries a self-consistent exact excerpt and attributes it to the named source; this rendered file does not independently prove membership in omitted original bytes.</li><li><strong>Human-ratified</strong> and <strong>quality-passed</strong> are different checks; neither has happened.</li><li><strong>Proposed</strong> is not <strong>durable</strong>; this package performs zero graph or database writes.</li><li>Source facts, analysis, and recommendations remain visibly separate below.</li></ul></section>
<section aria-labelledby="proposal-review"><p class="eyebrow">Individual review</p><h2 id="proposal-review">${countLabel(packet.proposals.length, "pending proposal")}</h2><p>Accept or Reject is a truthful local-only draft control for each item. Nothing is submitted, saved, applied, persisted, or ratified.</p><div class="proposal-grid">${packet.proposals.map((proposal) => proposalHtml(proposal, sourcePack)).join("")}</div></section>
<section id="draft-meeting-brief" aria-labelledby="meeting-heading"><p class="eyebrow">Account-specific brief · readable here</p><h2 id="meeting-heading">Draft meeting brief</h2><p class="brief-account"><strong>Request-supplied account name:</strong> ${escapeHtml(packet.subject.accountName)} · <strong>Account ID:</strong> <code>${escapeHtml(packet.subject.accountId)}</code></p><div class="freshness"><strong>Freshness and status</strong><p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(materialSource.evidenceCurrentThrough))}</p><p><strong>Package-classified event status:</strong> ${escapeHtml(featuredAssertion!)}</p>${announcedStatusHtml}</div><p>DRAFT · NOT SENT · NOT RATIFIED. This inline preparation artifact is editable only by changing and revalidating the source package; it is non-executable, not independently verified, not applied, and not durable. Current effective authorization: ${escapeHtml(packet.authority.currentEffectiveAuthorization)}; apply eligibility: ${String(packet.authority.applyEligibility)}.</p>${meetingPlanHtml}<div class="brief-answer-grid">${meetingAnswers}</div><h3>Meeting prompts from proposed Signal, Map, and Play</h3><div class="brief-lens-grid">${meetingLens("Signal", signal)}${meetingLens("Map", map)}${meetingLens("Play", play)}</div><p class="footer-note">Review internally before use · no send, submit, save, ratify, or apply action exists here.</p></section>
<details class="source-details"><summary>Evidence currency, source custody, and package hashes</summary><section aria-labelledby="evidence-register"><h2 id="evidence-register">${countLabel(evidence.length, "evidence excerpt")}</h2><ul>${evidenceRegister}</ul></section><section aria-labelledby="source-register"><h2 id="source-register">${countLabel(sourcePack.sources.length, sourceRecordLabel)}</h2><p>Only bounded exact excerpts are in this package. Full source bytes are not embedded.</p><div class="source-grid">${custody}</div></section><section><h2>Cross-package bindings</h2><p class="package-binding">Package ${escapeHtml(packet.packageBinding.packageId)}<br />Request raw ${escapeHtml(packet.packageBinding.requestRawSha256)}<br />Request canonical ${escapeHtml(packet.packageBinding.requestCanonicalSha256)}<br />Source pack ${escapeHtml(packet.sourcePackSha256)}<br />Candidate ${escapeHtml(packet.candidateSha256)}<br />Review packet ${escapeHtml(packet.reviewPacketSha256)}<br />Superseded result ${escapeHtml(packet.packageBinding.supersededPackageResultSha256)}<br />Execution ${escapeHtml(packet.packageBinding.executionCommit)} / ${escapeHtml(packet.packageBinding.executionTree)}<br />Owner authorization ${escapeHtml(packet.packageBinding.ownerAuthorizationId)}</p><p>Supersession preserves the old bytes and producer identity. It does not rewrite the historical package.</p></section></details>
<section class="zero-effect"><strong>Prepare-command effect boundary</strong><br />Acquisitions 0 · network calls 0 · provider calls 0 · database writes 0 · graph writes 0 · deployments 0 · outbound actions 0 · apply operations 0.<p>These counts cover this prepare command only. Separately authorized source acquisition or retained-custody reads belong in an immutable external execution receipt; generated package files must remain unchanged.</p></section>
<p class="footer-note">Local draft only · not saved · not ratified · no write authority.</p>
</main></body></html>\n`;
}


export type M5bProductReviewArtifactName =
  | "sanitized-source-pack.json"
  | "candidate.json"
  | "review-packet.json"
  | "workshop-pre-ratification.html"
  | "meeting-brief.md";

export interface M5bProductReviewSourceFileBinding {
  readonly sourceId: string;
  readonly path: string;
}

export interface M5bProductReviewPrepareOptions {
  readonly requestPath: string;
  readonly expectedRequestSha256: string;
  readonly expectedRequestByteSize: number;
  readonly sourceFiles: readonly M5bProductReviewSourceFileBinding[];
  readonly outputDir: string;
}

export interface M5bProductReviewPreparedArtifactIdentity {
  readonly name: M5bProductReviewArtifactName;
  readonly sha256: string;
  readonly byteSize: number;
}

export interface M5bProductReviewPrepareResultContent {
  readonly kind: typeof M5B_PRODUCT_REVIEW_PREPARE_RESULT_KIND;
  readonly schemaVersion: typeof M5B_PRODUCT_REVIEW_PREPARE_RESULT_VERSION;
  readonly packageBinding: M5bProductReviewPackageBinding;
  readonly sourcePackSha256: string;
  readonly candidateSha256: string;
  readonly reviewPacketSha256: string;
  readonly authority: M5bProductReviewRequest["authority"];
  readonly supersession: {
    readonly preservesOldBytes: true;
    readonly preservesOldProducerIdentity: true;
    readonly rewritesHistoricalPackage: false;
  };
  readonly artifacts: readonly M5bProductReviewPreparedArtifactIdentity[];
  readonly accounting: {
    readonly requestManifestReads: 1;
    readonly evidenceSourceReads: number;
    readonly syntheticSourceReads: number;
    readonly retainedCustodyReads: number;
    readonly retainedCustodyReadAuthorityConsumptions: 0 | 1;
    readonly outputFilesWritten: 6;
    readonly acquisitions: 0;
    readonly networkCalls: 0;
    readonly providerCalls: 0;
    readonly databaseWrites: 0;
    readonly graphWrites: 0;
    readonly deployments: 0;
    readonly outboundActions: 0;
    readonly applyOperations: 0;
    readonly retries: 0;
  };
}

export interface M5bProductReviewPrepareResult extends M5bProductReviewPrepareResultContent {
  readonly resultSha256: string;
}

/**
 * Authenticates an artifact set only against the exact in-memory prepare-result capability returned
 * by this runtime. Parsed/cloned result JSON and caller-computed digests cannot mint this capability.
 */
export function admitM5bProductReviewPackageArtifactsAgainstTrustedPrepareResult(
  artifacts: M5bProductReviewPackageArtifactSet,
  trustedPrepareResult: Readonly<M5bProductReviewPrepareResult>,
): Readonly<M5bProductReviewTrustedAdmittedPackageArtifacts> {
  if (trustedPrepareResult === null || typeof trustedPrepareResult !== "object") {
    refuseM5bProductReview("trusted_prepare_result_capability");
  }
  const pin = TRUSTED_PREPARE_RESULT_PINS.get(trustedPrepareResult as object);
  if (pin === undefined) refuseM5bProductReview("trusted_prepare_result_capability");
  if (m5bProductReviewCanonicalSha256(artifacts) !== pin.artifactSetSha256) {
    refuseM5bProductReview("trusted_prepare_result_artifact_binding");
  }
  const admitted = validateM5bProductReviewPackageArtifactSelfConsistency(artifacts);
  if (admitted.sourcePack.packageBinding.packageId !== pin.packageId ||
      admitted.sourcePack.packageBinding.preparedAt !== pin.preparedAt ||
      admitted.sourcePack.sourcePackSha256 !== pin.sourcePackSha256 ||
      validatedCandidateSha256(admitted.candidate) !== pin.candidateSha256 ||
      admitted.reviewPacket.reviewPacketSha256 !== pin.reviewPacketSha256) {
    refuseM5bProductReview("trusted_prepare_result_artifact_binding");
  }
  return Object.freeze({
    sourcePack: admitted.sourcePack,
    candidate: admitted.candidate,
    reviewPacket: admitted.reviewPacket,
    featuredMaterialChangeChain: admitted.featuredMaterialChangeChain,
    admissionAssurance: "trusted_prepare_result_capability_authenticated" as const,
  });
}

interface M5bProductReviewAdmittedSource {
  readonly sourceId: string;
  readonly text: string;
  readonly decodedByteSize: number;
  readonly decodedSha256: string;
  readonly provenance?: M5bProductReviewSourceProvenance;
}

interface TransformedSource {
  readonly source: M5bProductReviewSanitizedSource;
  readonly storedText: string;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertPackageExactKeys(value: unknown, expected: readonly string[], code: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) refuseM5bProductReview(code);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    refuseM5bProductReview(code);
  }
}

function assertAdmittedSourcesShape(admitted: readonly M5bProductReviewAdmittedSource[]): void {
  m5bProductReviewCanonicalSha256(admitted);
  if (!Array.isArray(admitted) || admitted.length < M5B_PRODUCT_REVIEW_LIMITS.sourceCountMin ||
      admitted.length > M5B_PRODUCT_REVIEW_LIMITS.sourceCountMax) {
    refuseM5bProductReview("admitted_sources");
  }
  for (const source of admitted) {
    if (source === null || typeof source !== "object" || Array.isArray(source) ||
        Object.getPrototypeOf(source) !== Object.prototype) {
      refuseM5bProductReview("admitted_source_shape");
    }
    assertPackageExactKeys(source, Object.hasOwn(source, "provenance")
      ? ["sourceId", "text", "decodedByteSize", "decodedSha256", "provenance"]
      : ["sourceId", "text", "decodedByteSize", "decodedSha256"],
    "admitted_source_shape");
    if (typeof source.sourceId !== "string" || !SOURCE_ID.test(source.sourceId) ||
        typeof source.text !== "string" || Buffer.byteLength(source.text, "utf8") <= 0 ||
        Buffer.byteLength(source.text, "utf8") > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
        !Number.isSafeInteger(source.decodedByteSize) || source.decodedByteSize <= 0 ||
        source.decodedByteSize > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach ||
        typeof source.decodedSha256 !== "string" || !SHA256.test(source.decodedSha256)) {
      refuseM5bProductReview("admitted_source_shape");
    }
    if (source.provenance !== undefined) {
      assertPackageExactKeys(source.provenance, PROVENANCE_KEYS, "source_provenance_shape");
    }
  }
}

function resolvedProvenance(
  sourceRequest: M5bProductReviewRequest["sources"][number],
  admittedSource: M5bProductReviewAdmittedSource,
): M5bProductReviewSourceProvenance {
  const provenance = admittedSource.provenance ?? (sourceRequest.sourceKind === "synthetic_fixture"
    ? Object.freeze({
        classification: "explicit_synthetic_fixture" as const,
        exactUrl: sourceRequest.canonicalUrl,
        responseByteSize: sourceRequest.decodedByteSize,
        responseSha256: sourceRequest.decodedSha256,
        outerCustodySha256: sourceRequest.rawSha256,
        targetPolicySha256: null,
        capabilityId: null,
        adapterId: null,
        adapterSha256: null,
        authorityId: null,
        consumptionId: null,
        implementationCommit: null,
        implementationTree: null,
        acquisitionConsumptionSha256: null,
        retainedReadAuthorityId: null,
        retainedReadConsumptionId: null,
        retainedReadImplementationCommit: null,
        retainedReadImplementationTree: null,
        retainedReadLedgerNamespaceSha256: null,
        retainedReadLedgerRecordSha256: null,
      })
    : refuseM5bProductReview("production_source_provenance"));
  if (provenance.exactUrl !== sourceRequest.canonicalUrl ||
      provenance.responseByteSize !== sourceRequest.decodedByteSize ||
      provenance.responseSha256 !== sourceRequest.decodedSha256 ||
      provenance.outerCustodySha256 !== sourceRequest.rawSha256 ||
      !SHA256.test(provenance.responseSha256) || !SHA256.test(provenance.outerCustodySha256)) {
    refuseM5bProductReview("source_provenance_binding");
  }
  if (sourceRequest.sourceKind === "synthetic_fixture") {
    if (provenance.classification !== "explicit_synthetic_fixture" ||
        [provenance.targetPolicySha256, provenance.capabilityId, provenance.adapterId,
          provenance.adapterSha256, provenance.authorityId, provenance.consumptionId,
          provenance.implementationCommit, provenance.implementationTree,
          provenance.acquisitionConsumptionSha256, provenance.retainedReadAuthorityId,
          provenance.retainedReadConsumptionId, provenance.retainedReadImplementationCommit,
          provenance.retainedReadImplementationTree, provenance.retainedReadLedgerNamespaceSha256,
          provenance.retainedReadLedgerRecordSha256].some((value) => value !== null)) {
      refuseM5bProductReview("source_provenance_classification");
    }
  } else if (provenance.classification !== "validated_exact_public_acquisition_custody" ||
      typeof provenance.targetPolicySha256 !== "string" || !SHA256.test(provenance.targetPolicySha256) ||
      typeof provenance.adapterSha256 !== "string" || !SHA256.test(provenance.adapterSha256) ||
      typeof provenance.acquisitionConsumptionSha256 !== "string" ||
        !SHA256.test(provenance.acquisitionConsumptionSha256) ||
      typeof provenance.implementationCommit !== "string" || !GIT_OID.test(provenance.implementationCommit) ||
      (provenance.implementationTree !== null && (typeof provenance.implementationTree !== "string" ||
        !GIT_OID.test(provenance.implementationTree))) ||
      typeof provenance.capabilityId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.capabilityId) ||
      typeof provenance.adapterId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.adapterId) ||
      typeof provenance.authorityId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.authorityId) ||
      typeof provenance.consumptionId !== "string" || !SAFE_PROVENANCE_ID.test(provenance.consumptionId)) {
    refuseM5bProductReview("production_source_provenance");
  }
  if (sourceRequest.sourceKind !== "synthetic_fixture" &&
      provenance.classification === "validated_exact_public_acquisition_custody") {
    const retainedReadFields = [
      provenance.retainedReadAuthorityId,
      provenance.retainedReadConsumptionId,
      provenance.retainedReadImplementationCommit,
      provenance.retainedReadImplementationTree,
      provenance.retainedReadLedgerNamespaceSha256,
      provenance.retainedReadLedgerRecordSha256,
    ];
    if (sourceRequest.contentEncoding === "m4_public_http_fetch_custody_v1") {
      if (typeof provenance.retainedReadAuthorityId !== "string" ||
          !SAFE_PROVENANCE_ID.test(provenance.retainedReadAuthorityId) ||
          typeof provenance.retainedReadConsumptionId !== "string" ||
          !SAFE_PROVENANCE_ID.test(provenance.retainedReadConsumptionId) ||
          typeof provenance.retainedReadImplementationCommit !== "string" ||
          !GIT_OID.test(provenance.retainedReadImplementationCommit) ||
          typeof provenance.retainedReadImplementationTree !== "string" ||
          !GIT_OID.test(provenance.retainedReadImplementationTree) ||
          typeof provenance.retainedReadLedgerNamespaceSha256 !== "string" ||
          !SHA256.test(provenance.retainedReadLedgerNamespaceSha256) ||
          typeof provenance.retainedReadLedgerRecordSha256 !== "string" ||
          !SHA256.test(provenance.retainedReadLedgerRecordSha256)) {
        refuseM5bProductReview("production_source_provenance");
      }
    } else if (retainedReadFields.some((value) => value !== null)) {
      refuseM5bProductReview("production_source_provenance");
    }
  }
  return Object.freeze({ ...provenance }) as M5bProductReviewSourceProvenance;
}

function countExactOccurrences(text: string, quote: string): number {
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length - quote.length) {
    const next = text.indexOf(quote, cursor);
    if (next === -1) break;
    count += 1;
    cursor = next + 1;
  }
  return count;
}

function makePackageBinding(
  request: M5bProductReviewRequest,
  requestRawSha256: string,
): M5bProductReviewPackageBinding {
  const requestCanonicalSha256 = m5bProductReviewCanonicalSha256(request);
  const seed = {
    kind: "m5b-product-review-package-binding",
    requestRawSha256,
    requestCanonicalSha256,
    supersededPackageResultSha256: request.supersession.supersededPackageResultSha256,
    ownerAuthorizationId: request.authority.ownerAuthorizationId,
    executionCommit: request.execution.commit,
    executionTree: request.execution.tree,
    preparedAt: request.execution.preparedAt,
  };
  return Object.freeze({
    packageId: `m5b-product-review-${m5bProductReviewCanonicalSha256(seed).slice(0, 24)}`,
    requestRawSha256,
    requestCanonicalSha256,
    supersededPackageResultSha256: request.supersession.supersededPackageResultSha256,
    ownerAuthorizationId: request.authority.ownerAuthorizationId,
    executionCommit: request.execution.commit,
    executionTree: request.execution.tree,
    preparedAt: request.execution.preparedAt,
  });
}

function transformSources(
  request: M5bProductReviewRequest,
  admitted: readonly M5bProductReviewAdmittedSource[],
): readonly TransformedSource[] {
  const admittedById = new Map(admitted.map((source) => [source.sourceId, source]));
  if (admittedById.size !== admitted.length || admitted.length !== request.sources.length) {
    refuseM5bProductReview("admitted_sources");
  }

  const resolved = new Map<string, Omit<M5bProductReviewEvidenceBinding, "storedCharStart" | "storedCharEnd">>();
  for (const binding of request.evidenceBindings) {
    const expectedSource = admittedById.get(binding.sourceId)?.text;
    if (expectedSource === undefined) refuseM5bProductReview("evidence_source");
    let admittedOccurrences = 0;
    for (const source of admittedById.values()) {
      admittedOccurrences += countExactOccurrences(source.text, binding.exactQuote);
    }
    const sourceCharStart = expectedSource.indexOf(binding.exactQuote);
    if (admittedOccurrences !== 1 || sourceCharStart < 0) {
      refuseM5bProductReview(admittedOccurrences === 0 ? "evidence_not_found" : "evidence_ambiguous");
    }
    resolved.set(binding.evidenceId, {
      evidenceId: binding.evidenceId,
      sourceId: binding.sourceId,
      exactQuote: binding.exactQuote,
      evidenceRole: binding.evidenceRole,
      materialChangeAssertion: binding.materialChangeAssertion,
      exactQuoteSha256: sha256(Buffer.from(binding.exactQuote, "utf8")),
      sourceCharStart,
      sourceCharEnd: sourceCharStart + binding.exactQuote.length,
    });
  }

  return request.sources.map((sourceRequest) => {
    const admittedSource = admittedById.get(sourceRequest.sourceId);
    if (admittedSource === undefined) refuseM5bProductReview("admitted_source_identity_mismatch");
    const admittedText = admittedSource.text;
    if (admittedSource.decodedByteSize !== sourceRequest.decodedByteSize ||
        admittedSource.decodedSha256 !== sourceRequest.decodedSha256 ||
        Buffer.byteLength(admittedText, "utf8") !== sourceRequest.decodedByteSize ||
        sha256(Buffer.from(admittedText, "utf8")) !== sourceRequest.decodedSha256) {
      refuseM5bProductReview("admitted_source_identity_mismatch");
    }
    const provenance = resolvedProvenance(sourceRequest, admittedSource);
    const sourceEvidence = request.evidenceBindings
      .filter((binding) => binding.sourceId === sourceRequest.sourceId)
      .map((binding) => resolved.get(binding.evidenceId)!);
    let storedText = "";
    const evidenceBindings: M5bProductReviewEvidenceBinding[] = [];
    for (const evidence of sourceEvidence) {
      if (storedText.length > 0) storedText += "\n\n";
      const storedCharStart = storedText.length;
      storedText += evidence.exactQuote;
      evidenceBindings.push(Object.freeze({
        ...evidence,
        storedCharStart,
        storedCharEnd: storedText.length,
      }));
    }
    const excerptOriginBytes = sourceEvidence.reduce(
      (total, evidence) => total + Buffer.byteLength(evidence.exactQuote, "utf8"),
      0,
    );
    if (excerptOriginBytes >= sourceRequest.decodedByteSize) {
      refuseM5bProductReview("full_source_embedding");
    }
    const storedContentSha256 = sha256(Buffer.from(storedText, "utf8"));
    const transformationManifestSha256 = m5bProductReviewCanonicalSha256({
      kind: "m5b-product-review-bounded-excerpt-transformation",
      schemaVersion: M5B_PRODUCT_REVIEW_TRANSFORMATION_VERSION,
      sourceId: sourceRequest.sourceId,
      originContentSha256: sourceRequest.rawSha256,
      decodedContentSha256: sourceRequest.decodedSha256,
      storedContentSha256,
      fullSourceBytesEmbedded: false,
      sourceProvenance: provenance,
      evidenceBindings: evidenceBindings.map((binding) => ({
        evidenceId: binding.evidenceId,
        evidenceRole: binding.evidenceRole,
        materialChangeAssertion: binding.materialChangeAssertion,
        exactQuoteSha256: binding.exactQuoteSha256,
        sourceCharStart: binding.sourceCharStart,
        sourceCharEnd: binding.sourceCharEnd,
        storedCharStart: binding.storedCharStart,
        storedCharEnd: binding.storedCharEnd,
      })),
    });
    return Object.freeze({
      storedText,
      source: Object.freeze({
        sourceId: sourceRequest.sourceId,
        title: sourceRequest.title,
        sourceKind: sourceRequest.sourceKind,
        contentEncoding: sourceRequest.contentEncoding,
        canonicalUrl: sourceRequest.canonicalUrl,
        acquiredAt: sourceRequest.acquiredAt,
        evidenceCurrentThrough: sourceRequest.evidenceCurrentThrough,
        publisher: sourceRequest.publisher,
        sourceType: sourceRequest.sourceType,
        rawByteSize: sourceRequest.expectedByteSize,
        originContentSha256: sourceRequest.rawSha256,
        decodedByteSize: sourceRequest.decodedByteSize,
        decodedContentSha256: sourceRequest.decodedSha256,
        storedContentSha256,
        transformationManifestSha256,
        provenance,
        evidenceBindings: Object.freeze(evidenceBindings),
      }),
    });
  });
}

function buildSourcePack(
  request: M5bProductReviewRequest,
  packageBinding: M5bProductReviewPackageBinding,
  transformed: readonly TransformedSource[],
): M5bProductReviewSanitizedSourcePack {
  const content: M5bProductReviewSanitizedSourcePackContent = Object.freeze({
    kind: M5B_PRODUCT_REVIEW_SOURCE_PACK_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_SOURCE_PACK_VERSION,
    packageBinding,
    subject: request.subject,
    authority: request.authority,
    supersession: Object.freeze({ preservesOldBytes: true, preservesOldProducerIdentity: true,
      rewritesHistoricalPackage: false }),
    effectBoundary: M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
    contentPolicy: Object.freeze({ fullSourceBytesEmbedded: false, boundedExactExcerptsOnly: true }),
    ...(request.meetingPlan === undefined ? {} : {
      meetingPlanSha256: m5bProductReviewCanonicalSha256(request.meetingPlan),
    }),
    sources: Object.freeze(transformed.map((item) => item.source)),
  });
  return Object.freeze({ ...content, sourcePackSha256: m5bProductReviewCanonicalSha256(content) });
}

function objectTypeForLens(lens: M5bProductReviewLens): "signal" | "account_snapshot" | "play" {
  if (lens === "signal") return "signal";
  if (lens === "map") return "account_snapshot";
  return "play";
}

function buildCandidate(
  request: M5bProductReviewRequest,
  packageBinding: M5bProductReviewPackageBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
  transformed: readonly TransformedSource[],
): ValidatedCandidate {
  const evidenceInOrder = request.evidenceBindings.map((binding, index) => ({
    request: binding,
    resolved: transformed.flatMap((item) => item.source.evidenceBindings)
      .find((candidate) => candidate.evidenceId === binding.evidenceId)!,
    graphId: `exc_m5b_product_${String(index + 1).padStart(3, "0")}`,
  }));
  const evidenceById = new Map(evidenceInOrder.map((item) => [item.request.evidenceId, item]));

  const bundle: GraphBundle = {
    sources: transformed.map((item) => {
      const sourceRequest = request.sources.find((source) => source.sourceId === item.source.sourceId)!;
      return {
        id: item.source.sourceId,
        team_id: request.subject.teamId,
        account_id: request.subject.accountId,
        url: item.source.canonicalUrl,
        canonical_url: item.source.canonicalUrl,
        title: item.source.title,
        publisher: item.source.publisher,
        source_type: item.source.sourceType,
        fetched_at: item.source.acquiredAt,
        accessed_at: item.source.acquiredAt,
        origin_content_sha256: sourceRequest.rawSha256,
        stored_content_sha256: item.source.storedContentSha256,
        transformation_manifest_sha256: item.source.transformationManifestSha256,
        raw_text: item.storedText,
        reliability: "unknown" as const,
        status: "active" as const,
      };
    }),
    excerpts: evidenceInOrder.map((item) => ({
      id: item.graphId,
      source_document_id: item.request.sourceId,
      text: item.request.exactQuote,
      kind: "literal" as const,
      char_start: item.resolved.storedCharStart,
      char_end: item.resolved.storedCharEnd,
      captured_at: request.execution.preparedAt,
      validation_status: "proposed" as const,
      rejection_reason: null,
    })),
    claims: request.proposals.map((proposal, index) => ({
      id: `clm_m5b_product_${String(index + 1).padStart(3, "0")}`,
      team_id: request.subject.teamId,
      account_id: request.subject.accountId,
      claim_type: `m5b_product_review_${proposal.classification}`,
      text: proposal.summary,
      normalized_subject: `${request.subject.accountId}:${proposal.proposalId}`,
      confidence: proposal.classification === "source_fact" ? "medium" as const : "low" as const,
      provenance_status: "unverified" as const,
      status: "active" as const,
      created_by: "system" as const,
      created_at: request.execution.preparedAt,
    })),
    claim_evidence: request.proposals.flatMap((proposal, proposalIndex) =>
      proposal.evidenceBindingIds.map((evidenceId, evidenceIndex) => ({
        id: `cev_m5b_${String(proposalIndex + 1).padStart(3, "0")}_${String(evidenceIndex + 1).padStart(2, "0")}`,
        claim_id: `clm_m5b_product_${String(proposalIndex + 1).padStart(3, "0")}`,
        evidence_excerpt_id: evidenceById.get(evidenceId)!.graphId,
        relationship: proposal.classification === "source_fact" ? "supports" as const : "context" as const,
        rationale: proposal.classification === "source_fact"
          ? "The proposed source fact is directly attributed to this exact source excerpt."
          : "The exact excerpt provides context for this proposed interpretation; it is not independent verification.",
        confidence: proposal.classification === "source_fact" ? "medium" as const : "low" as const,
        created_at: request.execution.preparedAt,
      }))),
    account_objects: request.proposals.map((proposal, index) => ({
      id: `obj_m5b_product_${String(index + 1).padStart(3, "0")}`,
      team_id: request.subject.teamId,
      account_id: request.subject.accountId,
      object_type: objectTypeForLens(proposal.lens),
      title: proposal.title,
      summary: proposal.summary,
      payload_json: {
        proposal_id: proposal.proposalId,
        classification: proposal.classification,
        lens: proposal.lens,
        evidence_roles: proposal.evidenceBindingIds.map((evidenceId) => ({
          evidence_id: evidenceId,
          evidence_role: evidenceById.get(evidenceId)!.request.evidenceRole,
          material_change_assertion: evidenceById.get(evidenceId)!.request.materialChangeAssertion,
        })),
        supporting_proposal_ids: [...proposal.supportingProposalIds],
        caveats: [...proposal.caveats],
        safe_task: proposal.safeTask,
        review_status: "proposed_unratified_unarmed",
        source_backed: proposal.classification === "source_fact",
        independently_verified: false,
        human_ratified: false,
        quality_passed: false,
        durable: false,
        system_created: true,
        authority: request.authority,
        package_binding: packageBinding,
        source_pack_sha256: sourcePack.sourcePackSha256,
        zero_effect_boundary: M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
      },
      confidence: proposal.classification === "source_fact" ? "medium" as const : "low" as const,
      provenance_status: "unverified" as const,
      status: "active" as const,
      created_by: "system" as const,
      created_at: request.execution.preparedAt,
      updated_at: request.execution.preparedAt,
    })),
    account_object_claims: request.proposals.map((_proposal, index) => ({
      id: `oclm_m5b_product_${String(index + 1).padStart(3, "0")}`,
      account_object_id: `obj_m5b_product_${String(index + 1).padStart(3, "0")}`,
      claim_id: `clm_m5b_product_${String(index + 1).padStart(3, "0")}`,
      relationship: "primary" as const,
    })),
    research_runs: [],
    run_artifacts: [],
    audit_events: [],
  };
  assertProposalDerivedRecordsUnverified(bundle);
  return createValidatedCandidate(bundle, {
    team_id: request.subject.teamId,
    account_id: request.subject.accountId,
  });
}

function buildReviewPacket(
  request: M5bProductReviewRequest,
  packageBinding: M5bProductReviewPackageBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
  candidateSha256: string,
): M5bProductReviewPacket {
  const evidenceById = new Map(sourcePack.sources.flatMap((source) => source.evidenceBindings)
    .map((binding) => [binding.evidenceId, binding]));
  const proposals: M5bProductReviewPacketProposal[] = request.proposals.map((proposal) => Object.freeze({
    proposalId: proposal.proposalId,
    status: "pending" as const,
    classification: proposal.classification,
    lens: proposal.lens,
    title: proposal.title,
    summary: proposal.summary,
    allowedLocalDispositions: Object.freeze(["accept", "reject"] as const),
    evidenceBindings: Object.freeze(proposal.evidenceBindingIds.map((id) => evidenceById.get(id)!)),
    supportingProposalIds: Object.freeze([...proposal.supportingProposalIds]),
    caveats: Object.freeze([...proposal.caveats]),
    safeTask: proposal.safeTask === null ? null : Object.freeze({ ...proposal.safeTask, nonExecutable: true as const }),
    trust: Object.freeze({
      sourceBacked: proposal.classification === "source_fact",
      independentlyVerified: false as const,
      humanRatified: false as const,
      qualityPassed: false as const,
      proposed: true as const,
      durable: false as const,
      createdBy: "system" as const,
    }),
  }));
  const content: M5bProductReviewPacketContent = Object.freeze({
    kind: M5B_PRODUCT_REVIEW_PACKET_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_PACKET_VERSION,
    packageBinding,
    subject: request.subject,
    sourcePackSha256: sourcePack.sourcePackSha256,
    candidateSha256,
    authority: request.authority,
    effectBoundary: M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
    reviewBoundary: Object.freeze({ localSelectionsOnly: true, selectionsSaved: false,
      selectionsAreRatification: false, writeAuthority: "none" as const }),
    customerQuestions: Object.freeze(M5B_PRODUCT_REVIEW_QUESTION_LABELS.map(([question, key]) => {
      const support = key === "whatMeaningfullyChanged"
        ? {
            evidenceBindingIds: request.customerQuestions.whatMeaningfullyChangedEvidenceBindingIds,
            proposalBindingIds: [request.customerQuestions.whatMeaningfullyChangedSelection.signalProposalId,
              request.customerQuestions.whatMeaningfullyChangedSelection.mapProposalId,
              request.customerQuestions.whatMeaningfullyChangedSelection.playProposalId],
          }
        : key === "whoIsThisAccount"
          ? request.customerQuestions.whoIsThisAccountSupport
          : key === "whyDoesItMatter"
            ? request.customerQuestions.whyDoesItMatterSupport
            : null;
      return Object.freeze({
        question,
        answer: request.customerQuestions[key],
        evidenceBindingIds: Object.freeze([...(support?.evidenceBindingIds ?? [])]),
        proposalBindingIds: Object.freeze([...(support?.proposalBindingIds ?? [])]),
      });
    })),
    ...(request.meetingPlan === undefined ? {} : { meetingPlan: request.meetingPlan }),
    lenses: Object.freeze((["signal", "map", "play"] as const).map((lens) => Object.freeze({
      lens,
      proposalIds: Object.freeze(proposals.filter((proposal) => proposal.lens === lens)
        .map((proposal) => proposal.proposalId)),
    }))),
    sourceRegister: Object.freeze(sourcePack.sources.map((source) => Object.freeze({
      sourceId: source.sourceId,
      title: source.title,
      canonicalUrl: source.canonicalUrl,
      contentEncoding: source.contentEncoding,
      originContentSha256: source.originContentSha256,
      decodedByteSize: source.decodedByteSize,
      decodedContentSha256: source.decodedContentSha256,
      storedContentSha256: source.storedContentSha256,
      transformationManifestSha256: source.transformationManifestSha256,
      provenance: source.provenance,
      evidenceCurrentThrough: source.evidenceCurrentThrough,
    }))),
    proposals: Object.freeze(proposals),
  });
  return Object.freeze({ ...content, reviewPacketSha256: m5bProductReviewCanonicalSha256(content) });
}

function buildM5bProductReviewPackageData(
  request: M5bProductReviewRequest,
  requestRawSha256: string,
  admitted: readonly M5bProductReviewAdmittedSource[],
): Readonly<M5bProductReviewPackageData> {
  if (typeof requestRawSha256 !== "string" || !SHA256.test(requestRawSha256)) {
    refuseM5bProductReview("request_identity");
  }
  const validatedRequest = validateM5bProductReviewRequest(request);
  assertAdmittedSourcesShape(admitted);
  const packageBinding = makePackageBinding(validatedRequest, requestRawSha256);
  const transformed = transformSources(validatedRequest, admitted);
  const sourcePack = buildSourcePack(validatedRequest, packageBinding, transformed);
  const candidate = buildCandidate(validatedRequest, packageBinding, sourcePack, transformed);
  const candidateSha256 = validatedCandidateSha256(candidate);
  const reviewPacket = buildReviewPacket(validatedRequest, packageBinding, sourcePack, candidateSha256);
  return Object.freeze({ packageBinding, sourcePack, candidate, candidateSha256, reviewPacket });
}

function strictObject(value: StrictJsonValue | undefined): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(value as StrictJsonValue, "prepare_options");
  } catch {
    refuseM5bProductReview("prepare_options_shape");
  }
}

function pathValue(value: StrictJsonValue | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048 ||
      /[\u0000-\u001f\u007f]/u.test(value) ||
      !isAbsolute(value) || normalize(value) !== value) {
    refuseM5bProductReview("explicit_absolute_paths_required");
  }
  return value;
}

function validatePrepareOptions(raw: unknown): M5bProductReviewPrepareOptions {
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(raw, "prepare_options", OPTIONS_LIMITS);
  } catch {
    refuseM5bProductReview("prepare_options_plain_data");
  }
  const root = strictObject(snapshot);
  try {
    assertExactKeys(root, ["requestPath", "expectedRequestSha256", "expectedRequestByteSize", "sourceFiles",
      "outputDir"], "prepare_options");
  } catch {
    refuseM5bProductReview("prepare_options_shape");
  }
  if (typeof root.expectedRequestSha256 !== "string" || !SHA256.test(root.expectedRequestSha256) ||
      typeof root.expectedRequestByteSize !== "number" || !Number.isSafeInteger(root.expectedRequestByteSize) ||
      root.expectedRequestByteSize <= 0 || root.expectedRequestByteSize > M5B_PRODUCT_REVIEW_LIMITS.requestBytes) {
    refuseM5bProductReview("request_identity");
  }
  let values: StrictJsonValue[];
  try {
    values = strictJsonArray(root.sourceFiles, "prepare_options.sourceFiles",
      M5B_PRODUCT_REVIEW_LIMITS.sourceCountMax, true);
  } catch {
    refuseM5bProductReview("source_bindings");
  }
  if (values.length < M5B_PRODUCT_REVIEW_LIMITS.sourceCountMin) refuseM5bProductReview("source_bindings");
  const sourceFiles = values.map((value) => {
    const binding = strictObject(value);
    try {
      assertExactKeys(binding, ["sourceId", "path"], "prepare_options.sourceFiles[]");
    } catch {
      refuseM5bProductReview("source_bindings");
    }
    if (typeof binding.sourceId !== "string" || !SOURCE_ID.test(binding.sourceId)) {
      refuseM5bProductReview("source_bindings");
    }
    return Object.freeze({ sourceId: binding.sourceId, path: pathValue(binding.path) });
  });
  if (new Set(sourceFiles.map((binding) => binding.sourceId)).size !== sourceFiles.length ||
      new Set(sourceFiles.map((binding) => binding.path)).size !== sourceFiles.length) {
    refuseM5bProductReview("duplicate_source_binding");
  }
  return Object.freeze({
    requestPath: pathValue(root.requestPath),
    expectedRequestSha256: root.expectedRequestSha256,
    expectedRequestByteSize: root.expectedRequestByteSize,
    sourceFiles: Object.freeze(sourceFiles),
    outputDir: pathValue(root.outputDir),
  });
}

async function canonicalPathWithoutSymlinks(input: string): Promise<string> {
  const absolute = resolve(input);
  const root = parse(absolute).root;
  const segments = absolute.slice(root.length).split(sep).filter((segment) => segment.length > 0);
  let cursor = root;
  for (let index = 0; index < segments.length; index += 1) {
    const next = join(cursor, segments[index]!);
    let metadata;
    try {
      metadata = await lstat(next);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const canonicalParent = await realpath(cursor).catch(() => refuseM5bProductReview("path_parent"));
        return resolve(canonicalParent, ...segments.slice(index));
      }
      refuseM5bProductReview("path_component");
    }
    if (metadata.isSymbolicLink()) refuseM5bProductReview("symlink_path");
    if (index < segments.length - 1 && !metadata.isDirectory()) refuseM5bProductReview("path_component");
    cursor = next;
  }
  return realpath(absolute).catch(() => refuseM5bProductReview("path_component"));
}

async function requireExistingFile(path: string, code: string): Promise<string> {
  const canonical = await canonicalPathWithoutSymlinks(path);
  const metadata = await lstat(path).catch(() => refuseM5bProductReview(code));
  if (!metadata.isFile() || metadata.isSymbolicLink()) refuseM5bProductReview(code);
  return canonical;
}

async function assertDestinationAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  refuseM5bProductReview("output_exists");
}

async function requireNewOutputDirectory(path: string): Promise<string> {
  const canonical = await canonicalPathWithoutSymlinks(path);
  await assertDestinationAbsent(path);
  const parent = await lstat(dirname(path)).catch(() => refuseM5bProductReview("output_parent_missing"));
  if (!parent.isDirectory() || parent.isSymbolicLink()) refuseM5bProductReview("output_parent_missing");
  return canonical;
}

function containsPath(parent: string, child: string): boolean {
  const relationship = relative(parent, child);
  return relationship === "" || (!isAbsolute(relationship) && relationship !== ".." &&
    !relationship.startsWith(`..${sep}`));
}

function pathsOverlap(left: string, right: string): boolean {
  return containsPath(left, right) || containsPath(right, left);
}

async function readPinnedFileOnce(
  path: string,
  expectedByteSize: number,
  expectedSha256: string,
  sizeCode: string,
  identityCode: string,
): Promise<Buffer> {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.size !== expectedByteSize) refuseM5bProductReview(sizeCode);
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.byteLength !== expectedByteSize || after.size !== expectedByteSize ||
        sha256(bytes) !== expectedSha256) {
      refuseM5bProductReview(identityCode);
    }
    return bytes;
  } catch (error) {
    if (error instanceof Error && error.name === "M5bProductReviewRefusal") throw error;
    return refuseM5bProductReview(identityCode);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function decodeUtf8(bytes: Uint8Array, code: string): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    refuseM5bProductReview(code);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    refuseM5bProductReview(code);
  }
}

function assertNoDuplicateJsonObjectKeys(text: string): void {
  let cursor = 0;
  const whitespace = (): void => {
    while (cursor < text.length && /[\u0009\u000a\u000d\u0020]/u.test(text[cursor]!)) cursor += 1;
  };
  const scanString = (): string => {
    const start = cursor;
    cursor += 1;
    while (cursor < text.length) {
      const character = text[cursor]!;
      if (character === "\"") {
        cursor += 1;
        return JSON.parse(text.slice(start, cursor)) as string;
      }
      if (character === "\\") {
        cursor += text[cursor + 1] === "u" ? 6 : 2;
      } else {
        cursor += 1;
      }
    }
    throw new Error("unterminated JSON string");
  };
  const scanValue = (): void => {
    whitespace();
    const character = text[cursor];
    if (character === "{") {
      cursor += 1;
      whitespace();
      const keys = new Set<string>();
      if (text[cursor] === "}") {
        cursor += 1;
        return;
      }
      while (cursor < text.length) {
        if (text[cursor] !== "\"") throw new Error("object key expected");
        const key = scanString();
        if (keys.has(key)) refuseM5bProductReview("request_duplicate_key");
        keys.add(key);
        whitespace();
        if (text[cursor] !== ":") throw new Error("object colon expected");
        cursor += 1;
        scanValue();
        whitespace();
        if (text[cursor] === "}") {
          cursor += 1;
          return;
        }
        if (text[cursor] !== ",") throw new Error("object delimiter expected");
        cursor += 1;
        whitespace();
      }
      throw new Error("unterminated object");
    }
    if (character === "[") {
      cursor += 1;
      whitespace();
      if (text[cursor] === "]") {
        cursor += 1;
        return;
      }
      while (cursor < text.length) {
        scanValue();
        whitespace();
        if (text[cursor] === "]") {
          cursor += 1;
          return;
        }
        if (text[cursor] !== ",") throw new Error("array delimiter expected");
        cursor += 1;
      }
      throw new Error("unterminated array");
    }
    if (character === "\"") {
      scanString();
      return;
    }
    const start = cursor;
    while (cursor < text.length && !/[,\]}\u0009\u000a\u000d\u0020]/u.test(text[cursor]!)) cursor += 1;
    if (cursor === start) throw new Error("JSON value expected");
  };
  scanValue();
  whitespace();
  if (cursor !== text.length) throw new Error("trailing JSON content");
}

function parseRequestBytes(bytes: Uint8Array): M5bProductReviewRequest {
  const text = decodeUtf8(bytes, "request_utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    assertNoDuplicateJsonObjectKeys(text);
  } catch (error) {
    if (error instanceof Error && error.name === "M5bProductReviewRefusal") throw error;
    refuseM5bProductReview("request_json");
  }
  return validateM5bProductReviewRequest(parsed);
}

function decodeM4CustodyEnvelope(
  outerBytes: Uint8Array,
  source: M5bProductReviewRequest["sources"][number],
  readConsumption: Readonly<M5bProductEffectConsumption> | null,
): { readonly bytes: Buffer; readonly provenance: M5bProductReviewSourceProvenance } {
  if (source.sourceKind === "exact_public_acquisition_custody") {
    if (readConsumption === null) refuseM5bProductReview("retained_custody_read_authority");
    const registry = getH2CapabilityRegistryEntry(M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
    const pins: M4CustodyEnvelopePins = {
      custodyArtifactSha256: source.rawSha256,
      decodedResponseBytes: source.decodedByteSize,
      responseSha256: source.decodedSha256,
      targetPolicySha256: M4_TARGET_POLICY_SHA256,
      capabilityDescriptorSha256: registry.descriptorSha256,
      capabilityId: M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID,
      adapterId: "m4_sec_gate_b_live_one_shot_v1",
      sourceUrl: source.canonicalUrl,
      sourceHost: M4_CANONICAL_TARGET_POLICY.hostname,
      publisher: M4_CANONICAL_TARGET_POLICY.publisher,
      targetRef: M4_CANONICAL_TARGET_POLICY.targetRef,
      targetPolicyRef: M4_TARGET_POLICY_REF,
      acquiredAt: source.acquiredAt,
    };
    let admitted;
    try {
      admitted = admitM4CustodyEnvelopeBytes(outerBytes, pins);
    } catch {
      return refuseM5bProductReview("custody_shape");
    }
    const receipt = admitted.receiptIdentity;
    return Object.freeze({
      bytes: Buffer.from(admitted.decodedBytes),
      provenance: productionProvenance(source, readConsumption, {
        targetPolicySha256: receipt.acquisition.targetPolicySha256,
        capabilityId: receipt.provenance.capabilityId,
        adapterId: receipt.provenance.adapterId,
        adapterSha256: receipt.provenance.adapterSha256,
        authorityId: receipt.activation.authorityId,
        consumptionId: receipt.activation.consumptionId,
        implementationCommit: receipt.activation.implementationCommit,
        implementationTree: receipt.activation.implementationTree,
        acquisitionConsumptionSha256: receipt.activation.acquisitionConsumptionSha256,
      }),
    });
  }
  const text = decodeUtf8(outerBytes, "custody_utf8");
  let parsed: unknown;
  try {
    assertNoDuplicateJsonObjectKeys(text);
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.name === "M5bProductReviewRefusal") throw error;
    refuseM5bProductReview("custody_json");
  }
  let snapshot: StrictJsonValue;
  try {
    snapshot = snapshotStrictJson(parsed, "custody", CUSTODY_JSON_LIMITS);
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  let root: { [key: string]: StrictJsonValue };
  let acquisition: { [key: string]: StrictJsonValue };
  try {
    root = strictJsonObject(snapshot, "custody");
    acquisition = strictJsonObject(root.acquisition as StrictJsonValue, "custody.acquisition");
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  try {
    assertExactKeys(root, ["kind", "acquiredAt", "acquisition"], "custody");
    assertExactKeys(acquisition, ["requestedUrl", "finalUrl", "fetchedAt", "httpStatus", "byteCount",
      "responseSha256", "bodyBase64", "quotedBodyText"], "custody.acquisition");
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  if (root.kind !== "m4-sec-gate-b-custody" || root.acquiredAt !== source.acquiredAt ||
      acquisition.requestedUrl !== source.canonicalUrl || acquisition.finalUrl !== source.canonicalUrl ||
      acquisition.fetchedAt !== source.acquiredAt || acquisition.httpStatus !== 200 ||
      acquisition.byteCount !== source.decodedByteSize || acquisition.responseSha256 !== source.decodedSha256 ||
      typeof acquisition.bodyBase64 !== "string" || typeof acquisition.quotedBodyText !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(acquisition.bodyBase64)) {
    refuseM5bProductReview("custody_binding");
  }
  const decoded = Buffer.from(acquisition.bodyBase64, "base64");
  if (decoded.toString("base64") !== acquisition.bodyBase64 ||
      decoded.byteLength !== source.decodedByteSize || sha256(decoded) !== source.decodedSha256) {
    refuseM5bProductReview("custody_decoded_identity");
  }
  const decodedText = decodeUtf8(decoded, "custody_decoded_utf8");
  if (acquisition.quotedBodyText !== decodedText) refuseM5bProductReview("custody_quoted_text");
  return Object.freeze({ bytes: decoded, provenance: syntheticProvenance(source) });
}

function strictIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function syntheticProvenance(
  source: M5bProductReviewRequest["sources"][number],
): M5bProductReviewSourceProvenance {
  return Object.freeze({
    classification: "explicit_synthetic_fixture",
    exactUrl: source.canonicalUrl,
    responseByteSize: source.decodedByteSize,
    responseSha256: source.decodedSha256,
    outerCustodySha256: source.rawSha256,
    targetPolicySha256: null,
    capabilityId: null,
    adapterId: null,
    adapterSha256: null,
    authorityId: null,
    consumptionId: null,
    implementationCommit: null,
    implementationTree: null,
    acquisitionConsumptionSha256: null,
    retainedReadAuthorityId: null,
    retainedReadConsumptionId: null,
    retainedReadImplementationCommit: null,
    retainedReadImplementationTree: null,
    retainedReadLedgerNamespaceSha256: null,
    retainedReadLedgerRecordSha256: null,
  });
}

function productionProvenance(
  source: M5bProductReviewRequest["sources"][number],
  readConsumption: Readonly<M5bProductEffectConsumption> | null,
  acquisition: Omit<Extract<M5bProductReviewSourceProvenance,
    { classification: "validated_exact_public_acquisition_custody" }>,
    "classification" | "exactUrl" | "responseByteSize" | "responseSha256" | "outerCustodySha256" |
    "retainedReadAuthorityId" | "retainedReadConsumptionId" | "retainedReadImplementationCommit" |
    "retainedReadImplementationTree" | "retainedReadLedgerNamespaceSha256" |
    "retainedReadLedgerRecordSha256">,
): M5bProductReviewSourceProvenance {
  return Object.freeze({
    classification: "validated_exact_public_acquisition_custody",
    exactUrl: source.canonicalUrl,
    responseByteSize: source.decodedByteSize,
    responseSha256: source.decodedSha256,
    outerCustodySha256: source.rawSha256,
    ...acquisition,
    retainedReadAuthorityId: readConsumption?.authorityId ?? null,
    retainedReadConsumptionId: readConsumption?.consumptionId ?? null,
    retainedReadImplementationCommit: readConsumption?.implementationCommit ?? null,
    retainedReadImplementationTree: readConsumption?.implementationTree ?? null,
    retainedReadLedgerNamespaceSha256: readConsumption?.ledgerNamespaceSha256 ?? null,
    retainedReadLedgerRecordSha256: readConsumption?.ledgerRecordSha256 ?? null,
  });
}

function decodeExactSecArchiveCustodyEnvelope(
  outerBytes: Uint8Array,
  source: M5bProductReviewRequest["sources"][number],
  acquisitionLedger: Readonly<M5bProductEffectLedger> | undefined,
): { readonly bytes: Buffer; readonly provenance: M5bProductReviewSourceProvenance } {
  if (source.sourceKind !== "exact_public_acquisition_custody") refuseM5bProductReview("custody_binding");
  const text = decodeUtf8(outerBytes, "custody_utf8");
  let snapshot: StrictJsonValue;
  try {
    assertNoDuplicateJsonObjectKeys(text);
    snapshot = snapshotStrictJson(JSON.parse(text), "custody", CUSTODY_JSON_LIMITS);
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  let root: Record<string, StrictJsonValue>;
  let adapter: Record<string, StrictJsonValue>;
  let activation: Record<string, StrictJsonValue>;
  let acquisition: Record<string, StrictJsonValue>;
  let exactCustody: Record<string, StrictJsonValue>;
  let trust: Record<string, StrictJsonValue>;
  let accounting: Record<string, StrictJsonValue>;
  try {
    root = strictJsonObject(snapshot, "custody");
    assertExactKeys(root, ["kind", "schemaVersion", "targetPolicy", "targetPolicySha256", "adapter", "activation",
      "acquiredAt", "acquisition", "trust", "effectAccounting"], "custody");
    adapter = strictJsonObject(root.adapter as StrictJsonValue, "custody.adapter");
    assertExactKeys(adapter, ["capabilityId", "adapterId", "adapterSha256"], "custody.adapter");
    activation = strictJsonObject(root.activation as StrictJsonValue, "custody.activation");
    assertExactKeys(activation, ["operation", "authorityId", "consumptionId", "ledgerRootSha256", "implementationCommit",
      "implementationTree", "targetPolicySha256", "sourceIdentities", "authorizedAt", "validFrom", "validUntil",
      "consumedAt", "ledgerNamespaceSha256", "ledgerRecordSha256", "goCanonicalSha256"], "custody.activation");
    acquisition = strictJsonObject(root.acquisition as StrictJsonValue, "custody.acquisition");
    assertExactKeys(acquisition, ["requestedTargetRef", "requestedUrl", "finalUrl", "sourceHost", "publisher", "method",
      "httpStatus", "contentType", "contentEncoding", "byteCount", "responseSha256", "bodyBase64", "quotedBodyText",
      "custody"], "custody.acquisition");
    exactCustody = strictJsonObject(acquisition.custody as StrictJsonValue, "custody.acquisition.custody");
    assertExactKeys(exactCustody, ["exactBytesPreserved", "exactBytesEncoding", "hashAlgorithm", "classification"],
      "custody.acquisition.custody");
    trust = strictJsonObject(root.trust as StrictJsonValue, "custody.trust");
    assertExactKeys(trust, ["status", "mayProvideInstructions", "controlAuthority", "transportSuccessPromotesTrust"],
      "custody.trust");
    accounting = strictJsonObject(root.effectAccounting as StrictJsonValue, "custody.effectAccounting");
    assertExactKeys(accounting, ["dnsAttempts", "requestAttempts", "connectionAttempts", "lookupCallbacks", "redirects",
      "retries", "networkRequests", "bytesReceived", "responseSha256", "selectedAddress", "connectedAddress",
      "publicAddressValidated", "pinnedConnectionMatched"], "custody.effectAccounting");
  } catch {
    refuseM5bProductReview("custody_shape");
  }
  let targetPolicy;
  try {
    targetPolicy = validateExactSecArchiveTargetPolicy(root.targetPolicy);
  } catch {
    refuseM5bProductReview("custody_target_policy");
  }
  const targetPolicySha256 = exactSecArchiveTargetPolicySha256(targetPolicy);
  let activationSourceIdentities: StrictJsonValue[];
  try {
    activationSourceIdentities = strictJsonArray(activation.sourceIdentities, "custody.activation.sourceIdentities", 1, true);
  } catch {
    refuseM5bProductReview("custody_activation");
  }
  const activationSource = activationSourceIdentities.length === 1
    ? strictJsonObject(activationSourceIdentities[0]!, "custody.activation.sourceIdentities[0]")
    : refuseM5bProductReview("custody_activation");
  try {
    assertExactKeys(activationSource, ["sourceId", "canonicalUrl", "targetPolicySha256", "outerSha256",
      "outerByteSize", "decodedSha256", "decodedByteSize"], "custody.activation.sourceIdentity");
  } catch {
    refuseM5bProductReview("custody_activation");
  }
  const namespaceBinding = {
    kind: "m5b-product-effect-consumption",
    schemaVersion: "1",
    operation: activation.operation,
    authorityId: activation.authorityId,
    consumptionId: activation.consumptionId,
    ledgerRootSha256: activation.ledgerRootSha256,
    implementationCommit: activation.implementationCommit,
    implementationTree: activation.implementationTree,
    targetPolicySha256: activation.targetPolicySha256,
    sourceIdentities: activationSourceIdentities,
  };
  const derivedNamespaceSha256 = m5bProductReviewCanonicalSha256(namespaceBinding);
  const ledgerRecord = {
    ...namespaceBinding,
    authorizedAt: activation.authorizedAt,
    validFrom: activation.validFrom,
    validUntil: activation.validUntil,
    consumedAt: activation.consumedAt,
    ledgerNamespaceSha256: derivedNamespaceSha256,
    goCanonicalSha256: activation.goCanonicalSha256,
  };
  const derivedLedgerRecordSha256 = sha256(Buffer.from(`${JSON.stringify(ledgerRecord, null, 2)}\n`, "utf8"));
  if (root.kind !== "m5b-exact-sec-archive-custody" || root.schemaVersion !== "1" ||
      root.targetPolicySha256 !== targetPolicySha256 || source.canonicalUrl !== targetPolicy.url ||
      root.acquiredAt !== source.acquiredAt || !strictIsoTimestamp(root.acquiredAt) ||
      adapter.capabilityId !== M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID ||
      adapter.adapterId !== M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID ||
      adapter.adapterSha256 !== M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256 ||
      activation.operation !== "exact_sec_archive_acquisition" ||
      typeof activation.authorityId !== "string" || typeof activation.consumptionId !== "string" ||
      typeof activation.ledgerRootSha256 !== "string" || !SHA256.test(activation.ledgerRootSha256) ||
      typeof activation.implementationCommit !== "string" || !/^[a-f0-9]{40}$/u.test(activation.implementationCommit) ||
      typeof activation.implementationTree !== "string" || !/^[a-f0-9]{40}$/u.test(activation.implementationTree) ||
      activation.targetPolicySha256 !== targetPolicySha256 ||
      activationSource.sourceId !== "src_sec_archive_primary_document" ||
      activationSource.canonicalUrl !== targetPolicy.url ||
      activationSource.targetPolicySha256 !== targetPolicySha256 ||
      activationSource.outerSha256 !== null || activationSource.outerByteSize !== null ||
      activationSource.decodedSha256 !== null || activationSource.decodedByteSize !== null ||
      !strictIsoTimestamp(activation.authorizedAt) || !strictIsoTimestamp(activation.validFrom) ||
      !strictIsoTimestamp(activation.validUntil) || !strictIsoTimestamp(activation.consumedAt) ||
      activation.authorizedAt > activation.validFrom || activation.validFrom >= activation.validUntil ||
      activation.consumedAt < activation.validFrom || activation.consumedAt >= activation.validUntil ||
      activation.consumedAt > source.acquiredAt || activation.ledgerNamespaceSha256 !== derivedNamespaceSha256 ||
      activation.ledgerRecordSha256 !== derivedLedgerRecordSha256 ||
      ![activation.ledgerNamespaceSha256, activation.ledgerRecordSha256, activation.goCanonicalSha256]
        .every((value) => typeof value === "string" && SHA256.test(value)) ||
      acquisition.requestedTargetRef !== targetPolicy.targetRef || acquisition.requestedUrl !== targetPolicy.url ||
      acquisition.finalUrl !== targetPolicy.url || acquisition.sourceHost !== targetPolicy.hostname ||
      acquisition.publisher !== targetPolicy.publisher || acquisition.method !== "GET" || acquisition.httpStatus !== 200 ||
      acquisition.contentType !== "text/html" || acquisition.contentEncoding !== "identity" ||
      acquisition.byteCount !== source.decodedByteSize || acquisition.responseSha256 !== source.decodedSha256 ||
      typeof acquisition.bodyBase64 !== "string" || typeof acquisition.quotedBodyText !== "string" ||
      exactCustody.exactBytesPreserved !== true || exactCustody.exactBytesEncoding !== "base64" ||
      exactCustody.hashAlgorithm !== "sha256" || exactCustody.classification !== "untrusted_public_source" ||
      trust.status !== "quoted_untrusted_public_source_content" || trust.mayProvideInstructions !== false ||
      trust.controlAuthority !== "none" || trust.transportSuccessPromotesTrust !== false ||
      accounting.dnsAttempts !== 1 || accounting.requestAttempts !== 1 || accounting.connectionAttempts !== 1 ||
      accounting.lookupCallbacks !== 1 || accounting.redirects !== 0 || accounting.retries !== 0 ||
      accounting.networkRequests !== 1 || accounting.bytesReceived !== source.decodedByteSize ||
      accounting.responseSha256 !== source.decodedSha256 || typeof accounting.selectedAddress !== "string" ||
      accounting.connectedAddress !== accounting.selectedAddress || !isPublicAddress(accounting.selectedAddress) ||
      accounting.publicAddressValidated !== true || accounting.pinnedConnectionMatched !== true) {
    refuseM5bProductReview("custody_binding");
  }
  const bodyBase64 = acquisition.bodyBase64 as string;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(bodyBase64)) {
    refuseM5bProductReview("custody_binding");
  }
  const decoded = Buffer.from(bodyBase64, "base64");
  if (decoded.toString("base64") !== bodyBase64 || decoded.byteLength !== source.decodedByteSize ||
      sha256(decoded) !== source.decodedSha256) {
    refuseM5bProductReview("custody_decoded_identity");
  }
  if (decodeUtf8(decoded, "custody_decoded_utf8") !== acquisition.quotedBodyText) {
    refuseM5bProductReview("custody_quoted_text");
  }
  try {
    assertM5bProductEffectLedgerReceipt(acquisitionLedger, activation, "exact_sec_archive_acquisition");
  } catch {
    refuseM5bProductReview("custody_acquisition_ledger");
  }
  return Object.freeze({
    bytes: decoded,
    provenance: productionProvenance(source, null, {
      targetPolicySha256,
      capabilityId: M5B_EXACT_SEC_ARCHIVE_CAPABILITY_ID,
      adapterId: M5B_EXACT_SEC_ARCHIVE_ADAPTER_ID,
      adapterSha256: M5B_EXACT_SEC_ARCHIVE_ADAPTER_SHA256,
      authorityId: activation.authorityId as string,
      consumptionId: activation.consumptionId as string,
      implementationCommit: activation.implementationCommit as string,
      implementationTree: activation.implementationTree as string,
      acquisitionConsumptionSha256: activation.ledgerRecordSha256 as string,
    }),
  });
}

function decodeAdmittedSource(
  outerBytes: Uint8Array,
  source: M5bProductReviewRequest["sources"][number],
  readConsumption: Readonly<M5bProductEffectConsumption> | null,
  acquisitionLedger: Readonly<M5bProductEffectLedger> | undefined,
): M5bProductReviewAdmittedSource {
  const decodedResult = source.contentEncoding === "raw_utf8"
    ? Object.freeze({ bytes: Buffer.from(outerBytes), provenance: syntheticProvenance(source) })
    : source.contentEncoding === "m4_public_http_fetch_custody_v1"
      ? decodeM4CustodyEnvelope(outerBytes, source, readConsumption)
      : decodeExactSecArchiveCustodyEnvelope(outerBytes, source, acquisitionLedger);
  const decoded = decodedResult.bytes;
  if (decoded.byteLength !== source.decodedByteSize || sha256(decoded) !== source.decodedSha256) {
    refuseM5bProductReview("source_decoded_identity_mismatch");
  }
  return Object.freeze({
    sourceId: source.sourceId,
    text: decodeUtf8(decoded, "source_utf8"),
    decodedByteSize: decoded.byteLength,
    decodedSha256: sha256(decoded),
    provenance: decodedResult.provenance,
  });
}

function artifactIdentity(name: M5bProductReviewArtifactName, bytes: Uint8Array): M5bProductReviewPreparedArtifactIdentity {
  return Object.freeze({ name, sha256: sha256(bytes), byteSize: bytes.byteLength });
}

async function publishDirectory(
  outputDir: string,
  files: Readonly<Record<string, Uint8Array>>,
): Promise<void> {
  await assertDestinationAbsent(outputDir);
  const staging = join(dirname(outputDir), `.${basename(outputDir)}.${process.pid}.${randomUUID()}.tmp`);
  await mkdir(staging, { recursive: false, mode: 0o700 });
  try {
    for (const [name, bytes] of Object.entries(files)) {
      await writeFile(join(staging, name), bytes, { flag: "wx", mode: 0o600 });
    }
    await assertDestinationAbsent(outputDir);
    await rename(staging, outputDir);
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function targetPolicySha256ForRetainedM4Source(
  source: M5bProductReviewRequest["sources"][number],
): string {
  if (source.contentEncoding === "m4_public_http_fetch_custody_v1" &&
      source.canonicalUrl === M4_CANONICAL_TARGET_POLICY.url) return M4_TARGET_POLICY_SHA256;
  return refuseM5bProductReview("production_target_policy");
}

function retainedM4SourceIdentities(
  request: M5bProductReviewRequest,
): readonly M5bProductEffectSourceIdentity[] {
  return Object.freeze(request.sources
    .filter((source) => source.sourceKind === "exact_public_acquisition_custody" &&
      source.contentEncoding === "m4_public_http_fetch_custody_v1")
    .map((source) => Object.freeze({
      sourceId: source.sourceId,
      canonicalUrl: source.canonicalUrl,
      targetPolicySha256: targetPolicySha256ForRetainedM4Source(source),
      outerSha256: source.rawSha256,
      outerByteSize: source.expectedByteSize,
      decodedSha256: source.decodedSha256,
      decodedByteSize: source.decodedByteSize,
    })));
}

function consumeRetainedCustodyReadAuthority(
  request: M5bProductReviewRequest,
  attempt: Readonly<M5bProductEffectAttempt> | undefined,
): Readonly<M5bProductEffectConsumption> | null {
  const identities = retainedM4SourceIdentities(request);
  if (identities.length === 0) {
    if (attempt !== undefined) refuseM5bProductReview("unused_retained_custody_read_authority");
    return null;
  }
  if (attempt === undefined) refuseM5bProductReview("retained_custody_read_authority");
  const policies = new Set(identities.map((identity) => identity.targetPolicySha256));
  if (policies.size !== 1) refuseM5bProductReview("production_policy_set");
  let consumption: Readonly<M5bProductEffectConsumption>;
  try {
    consumption = claimM5bProductEffectAttempt(attempt, "retained_custody_read");
    assertM5bProductEffectConsumptionIntact(consumption, "retained_custody_read");
  } catch {
    refuseM5bProductReview("retained_custody_read_authority");
  }
  if (consumption.implementationCommit !== request.execution.commit ||
      consumption.implementationTree !== request.execution.tree ||
      consumption.targetPolicySha256 !== [...policies][0] ||
      m5bProductReviewCanonicalSha256(consumption.sourceIdentities) !==
        m5bProductReviewCanonicalSha256(identities)) {
    refuseM5bProductReview("retained_custody_read_binding");
  }
  return consumption;
}

export async function prepareM5bProductReview(
  rawOptions: unknown,
  retainedCustodyAttempt?: Readonly<M5bProductEffectAttempt>,
  exactArchiveAcquisitionLedger?: Readonly<M5bProductEffectLedger>,
): Promise<Readonly<M5bProductReviewPrepareResult>> {
  const options = validatePrepareOptions(rawOptions);
  const requestPath = await requireExistingFile(options.requestPath, "request_path");
  const outputDir = await requireNewOutputDirectory(options.outputDir);
  if (pathsOverlap(requestPath, outputDir)) refuseM5bProductReview("path_overlap");

  const requestMetadata = await stat(requestPath);
  if (!requestMetadata.isFile() || requestMetadata.size !== options.expectedRequestByteSize ||
      requestMetadata.size > M5B_PRODUCT_REVIEW_LIMITS.requestBytes) {
    refuseM5bProductReview("request_size");
  }
  if (requestMetadata.nlink !== 1) refuseM5bProductReview("hardlink_path");
  const requestBytes = await readPinnedFileOnce(requestPath, options.expectedRequestByteSize,
    options.expectedRequestSha256, "request_size", "request_identity_mismatch");
  const request = parseRequestBytes(requestBytes);

  if (request.sources.length !== options.sourceFiles.length) refuseM5bProductReview("source_bindings");
  const explicitById = new Map(options.sourceFiles.map((binding) => [binding.sourceId, binding.path]));
  for (const source of request.sources) {
    if (explicitById.get(source.sourceId) !== source.localPath) refuseM5bProductReview("source_binding_mismatch");
  }
  const expectedSourceBytes = request.sources.reduce((total, source) => total + source.expectedByteSize, 0);
  const expectedDecodedBytes = request.sources.reduce((total, source) => total + source.decodedByteSize, 0);
  if (!Number.isSafeInteger(expectedSourceBytes) || !Number.isSafeInteger(expectedDecodedBytes) ||
      expectedSourceBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal ||
      expectedDecodedBytes > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesTotal) {
    refuseM5bProductReview("source_budget");
  }

  const sourcePaths = new Map<string, string>();
  const fileIdentities = new Set([`${requestMetadata.dev}:${requestMetadata.ino}`]);
  for (const source of request.sources) {
    const canonical = await requireExistingFile(source.localPath, "source_path");
    const metadata = await stat(canonical);
    if (!metadata.isFile() || metadata.size !== source.expectedByteSize ||
        metadata.size > M5B_PRODUCT_REVIEW_LIMITS.sourceBytesEach) {
      refuseM5bProductReview("source_size");
    }
    if (metadata.nlink !== 1) refuseM5bProductReview("hardlink_path");
    const fileIdentity = `${metadata.dev}:${metadata.ino}`;
    if (fileIdentities.has(fileIdentity)) refuseM5bProductReview("path_overlap");
    fileIdentities.add(fileIdentity);
    if (pathsOverlap(canonical, requestPath) || pathsOverlap(canonical, outputDir) ||
        [...sourcePaths.values()].some((other) => pathsOverlap(canonical, other))) {
      refuseM5bProductReview("path_overlap");
    }
    sourcePaths.set(source.sourceId, canonical);
  }

  // The durable namespace is consumed only after pure/path preflight, and before the first evidence byte is read.
  const retainedReadConsumption = consumeRetainedCustodyReadAuthority(request, retainedCustodyAttempt);
  const exactArchiveSourceCount = request.sources.filter((source) =>
    source.sourceKind === "exact_public_acquisition_custody" &&
    source.contentEncoding === "exact_sec_archive_custody_v1").length;
  if (exactArchiveSourceCount === 0 && exactArchiveAcquisitionLedger !== undefined) {
    refuseM5bProductReview("unused_exact_archive_acquisition_ledger");
  }

  const admitted: M5bProductReviewAdmittedSource[] = [];
  for (const source of request.sources) {
    const bytes = await readPinnedFileOnce(sourcePaths.get(source.sourceId)!, source.expectedByteSize,
      source.rawSha256, "source_size", "source_identity_mismatch");
    admitted.push(decodeAdmittedSource(bytes, source, retainedReadConsumption, exactArchiveAcquisitionLedger));
  }

  const packageData = buildM5bProductReviewPackageData(request, sha256(requestBytes), admitted);
  const sourcePackBytes = jsonBytes(packageData.sourcePack);
  const candidateBytes = jsonBytes(packageData.candidate);
  const reviewPacketBytes = jsonBytes(packageData.reviewPacket);
  const packageArtifacts = Object.freeze({
    sourcePack: packageData.sourcePack,
    candidate: packageData.candidate,
    reviewPacket: packageData.reviewPacket,
  });
  registerFreshPrepareArtifactSet(packageArtifacts, packageData);
  const meetingBriefBytes = Buffer.from(renderM5bProductReviewMeetingBrief(packageArtifacts), "utf8");
  const workshopBytes = Buffer.from(renderM5bProductReviewWorkshopHtml(packageArtifacts), "utf8");
  const artifacts = Object.freeze([
    artifactIdentity("sanitized-source-pack.json", sourcePackBytes),
    artifactIdentity("candidate.json", candidateBytes),
    artifactIdentity("review-packet.json", reviewPacketBytes),
    artifactIdentity("workshop-pre-ratification.html", workshopBytes),
    artifactIdentity("meeting-brief.md", meetingBriefBytes),
  ]);
  const content: M5bProductReviewPrepareResultContent = Object.freeze({
    kind: M5B_PRODUCT_REVIEW_PREPARE_RESULT_KIND,
    schemaVersion: M5B_PRODUCT_REVIEW_PREPARE_RESULT_VERSION,
    packageBinding: packageData.packageBinding,
    sourcePackSha256: packageData.sourcePack.sourcePackSha256,
    candidateSha256: packageData.candidateSha256,
    reviewPacketSha256: packageData.reviewPacket.reviewPacketSha256,
    authority: request.authority,
    supersession: Object.freeze({ preservesOldBytes: true, preservesOldProducerIdentity: true,
      rewritesHistoricalPackage: false }),
    artifacts,
    accounting: Object.freeze({
      requestManifestReads: 1 as const,
      evidenceSourceReads: request.sources.length,
      syntheticSourceReads: request.sources.filter((source) => source.sourceKind === "synthetic_fixture").length,
      retainedCustodyReads: request.sources.filter((source) =>
        source.sourceKind === "exact_public_acquisition_custody" &&
        source.contentEncoding === "m4_public_http_fetch_custody_v1").length,
      retainedCustodyReadAuthorityConsumptions: retainedReadConsumption === null ? 0 as const : 1 as const,
      outputFilesWritten: 6 as const,
      ...M5B_PRODUCT_REVIEW_EFFECT_BOUNDARY,
      retries: 0 as const,
    }),
  });
  const result: M5bProductReviewPrepareResult = Object.freeze({
    ...content,
    resultSha256: m5bProductReviewCanonicalSha256(content),
  });
  TRUSTED_PREPARE_RESULT_PINS.set(result, FRESH_PREPARE_ARTIFACT_PINS.get(packageArtifacts as object)!);
  await publishDirectory(outputDir, {
    "sanitized-source-pack.json": sourcePackBytes,
    "candidate.json": candidateBytes,
    "review-packet.json": reviewPacketBytes,
    "workshop-pre-ratification.html": workshopBytes,
    "meeting-brief.md": meetingBriefBytes,
    "prepare-result.json": jsonBytes(result),
  });
  return result;
}
