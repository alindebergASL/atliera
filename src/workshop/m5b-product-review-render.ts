import type {
  M5bProductReviewEvidenceBinding,
  M5bProductReviewPacket,
  M5bProductReviewPacketProposal,
  M5bProductReviewSanitizedSourcePack,
} from "./m5b-product-review-package.ts";

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

function evidenceMarkdown(
  binding: M5bProductReviewEvidenceBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const source = sourcePack.sources.find((candidate) => candidate.sourceId === binding.sourceId)!;
  return [
    `- **Evidence** \`${binding.evidenceId}\` — source \`${source.sourceId}\``,
    `  - Source raw SHA-256: \`${source.originContentSha256}\``,
    `  - Exact excerpt SHA-256: \`${binding.exactQuoteSha256}\``,
    `  - Original source character span: \`[${binding.sourceCharStart}, ${binding.sourceCharEnd})\``,
    `  - Evidence current through: ${escapeMarkdown(displayCurrency(source.evidenceCurrentThrough))}`,
    `  - Exact source text: “${escapeMarkdown(binding.exactQuote)}”`,
  ].join("\n");
}

export function renderM5bProductReviewMeetingBrief(
  sourcePack: M5bProductReviewSanitizedSourcePack,
  packet: M5bProductReviewPacket,
): string {
  const evidence = sourcePack.sources.flatMap((source) => source.evidenceBindings);
  const proposalLines = packet.proposals.map((proposal) => {
    const support = proposal.supportingProposalIds.length === 0
      ? "Directly attributed to exact source text; no analytical dependency."
      : `Supporting proposals: ${proposal.supportingProposalIds.map((id) => `\`${id}\``).join(", ")}.`;
    const caveats = proposal.caveats.length === 0
      ? "No analytical caveat: this source fact only attributes what the source states."
      : `Caveats: ${proposal.caveats.map(escapeMarkdown).join("; ")}`;
    const task = proposal.safeTask === null
      ? ""
      : `\n  - Safe draft task: ${escapeMarkdown(proposal.safeTask.description)} \(non\-executable\).`;
    return [
      `- **${classificationLabel(proposal.classification)} · ${lensLabel(proposal.lens)} · ${escapeMarkdown(proposal.title)}** (\`${proposal.proposalId}\`)`,
      `  - ${escapeMarkdown(proposal.summary)}`,
      `  - Evidence: ${proposal.evidenceBindings.map((binding) => `\`${binding.evidenceId}\``).join(", ")}.`,
      `  - ${support}`,
      `  - ${caveats}${task}`,
    ].join("\n");
  });

  return [
    "# DRAFT targeted meeting brief — NOT SENT / NOT RATIFIED",
    "",
    `Account: **${escapeMarkdown(packet.subject.accountName)}** (\`${packet.subject.accountId}\`)`,
    "",
    "> Preparation artifact only. This brief has not been sent, independently verified, quality-passed, human-ratified, armed, or made durable. It carries no write authority and no apply eligibility.",
    "",
    "## Five customer questions",
    "",
    ...packet.customerQuestions.flatMap((item, index) => [
      `### ${index + 1}. ${item.question}`,
      "",
      escapeMarkdown(item.answer),
      "",
    ]),
    "## Proposed Signals, Maps, and Plays",
    "",
    ...proposalLines,
    "",
    "## Exact evidence register",
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
    "## Zero-effect boundary",
    "",
    "Network calls 0 · provider calls 0 · acquisitions 0 · database writes 0 · graph writes 0 · deployments 0 · outbound actions 0 · apply operations 0.",
    "",
    "Local Accept/Reject review choices, if made in the Workshop page, are local draft state only. They are not saved and are not ratification.",
    "",
  ].join("\n");
}

function evidenceHtml(
  binding: M5bProductReviewEvidenceBinding,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const source = sourcePack.sources.find((candidate) => candidate.sourceId === binding.sourceId)!;
  return `<li class="evidence-item"><blockquote>${escapeHtml(binding.exactQuote)}</blockquote><p><strong>${escapeHtml(binding.evidenceId)}</strong> · ${escapeHtml(source.title)} · ${escapeHtml(source.publisher)}</p><p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(source.evidenceCurrentThrough))} · <strong>Acquired at:</strong> ${escapeHtml(source.acquiredAt)}</p><p>Source <code>${escapeHtml(source.sourceId)}</code> · original span <code>[${binding.sourceCharStart}, ${binding.sourceCharEnd})</code></p><p class="hash">Exact excerpt SHA-256 ${binding.exactQuoteSha256} · source raw SHA-256 ${source.originContentSha256}</p></li>`;
}

function proposalHtml(
  proposal: M5bProductReviewPacketProposal,
  sourcePack: M5bProductReviewSanitizedSourcePack,
): string {
  const dependency = proposal.supportingProposalIds.length === 0
    ? "Direct exact-source attribution; no analytical dependency."
    : `${countLabel(proposal.supportingProposalIds.length, "supporting proposal")}: ${proposal.supportingProposalIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}`;
  const caveats = proposal.caveats.length === 0
    ? "This source fact only attributes exact source text; it does not claim independent verification."
    : `<ul>${proposal.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("")}</ul>`;
  const sourceTrust = proposal.classification === "source_fact"
    ? "Source-backed · not independently verified"
    : "Evidence-informed interpretation · not independently verified";
  const safeTask = proposal.safeTask === null ? "" :
    `<div class="safe-task"><strong>Safe preparation task</strong><p>${escapeHtml(proposal.safeTask.description)}</p><span>Draft only · non-executable · no outbound action</span></div>`;
  const controlId = escapeHtml(proposal.proposalId);
  return `<article class="proposal-card ${proposal.classification}" id="proposal-${controlId}">
    <div class="card-labels"><span class="classification">${classificationLabel(proposal.classification)}</span><span class="lens">${lensLabel(proposal.lens)}</span><span class="pending">Pending</span></div>
    <h3>${escapeHtml(proposal.title)}</h3>
    <p>${escapeHtml(proposal.summary)}</p>
    <p class="trust-line">${sourceTrust} · system-created · proposed · not durable</p>
    <p class="trust-line">Not human-ratified · not quality-passed · current effective authorization: ${escapeHtml("none")}</p>
    <div class="support"><strong>Dependencies</strong><p>${dependency}</p></div>
    <div class="caveats"><strong>${proposal.caveats.length === 1 ? "Caveat" : "Caveats"}</strong>${caveats}</div>
    ${safeTask}
    <details class="evidence"><summary>${countLabel(proposal.evidenceBindings.length, "evidence binding")}</summary><ul>${proposal.evidenceBindings.map((binding) => evidenceHtml(binding, sourcePack)).join("")}</ul></details>
    <fieldset class="local-controls" aria-describedby="local-copy-${controlId}"><legend>Local draft disposition</legend><div class="choice-row"><label class="choice"><input type="radio" name="local-${controlId}" value="accept" />Accept</label><label class="choice"><input type="radio" name="local-${controlId}" value="reject" />Reject</label></div><p id="local-copy-${controlId}">Local draft only · not saved · not ratified · no write authority. This page has no submit, apply, or persist action.</p></fieldset>
  </article>`;
}

export function renderM5bProductReviewWorkshopHtml(
  sourcePack: M5bProductReviewSanitizedSourcePack,
  packet: M5bProductReviewPacket,
): string {
  const signal = packet.proposals.find((proposal) => proposal.lens === "signal")!;
  const map = packet.proposals.find((proposal) => proposal.lens === "map" && proposal.classification === "analysis") ??
    packet.proposals.find((proposal) => proposal.lens === "map")!;
  const play = packet.proposals.find((proposal) => proposal.lens === "play" &&
    proposal.classification === "recommendation")!;
  const meetingAnswers = packet.customerQuestions.map((item) => `<article class="brief-answer"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`).join("");
  const meetingLens = (label: "Signal" | "Map" | "Play", proposal: M5bProductReviewPacketProposal) => {
    const caveats = proposal.caveats.length === 0 ? "" :
      `<p><strong>Needs attention:</strong> ${proposal.caveats.map(escapeHtml).join(" ")}</p>`;
    const safeTask = proposal.safeTask === null ? "" :
      `<p><strong>Safe next task:</strong> ${escapeHtml(proposal.safeTask.description)}</p>`;
    return `<article class="brief-lens"><div class="card-labels"><span class="lens">${label}</span><span class="classification">${classificationLabel(proposal.classification)}</span></div><h3>${escapeHtml(proposal.title)}</h3><p>${escapeHtml(proposal.summary)}</p>${caveats}${safeTask}<p class="trust-line">Proposed · not independently verified · not human-ratified · not durable</p></article>`;
  };
  const custody = sourcePack.sources.map((source) => `<article class="source-card">
    <h3>${escapeHtml(source.title)}</h3>
    <p><code>${escapeHtml(source.sourceId)}</code> · ${escapeHtml(source.publisher)} · ${escapeHtml(source.sourceType)}</p>
    <p><strong>Evidence current through:</strong> ${escapeHtml(displayCurrency(source.evidenceCurrentThrough))}</p>
    <p><strong>Acquired at:</strong> ${escapeHtml(source.acquiredAt)} · <strong>Source kind:</strong> ${escapeHtml(source.sourceKind)} · <strong>Encoding:</strong> ${escapeHtml(source.contentEncoding)}</p>
    <p><strong>Canonical HTTPS source:</strong> <span class="source-url">${escapeHtml(source.canonicalUrl)}</span></p>
    <p class="hash">Outer/origin ${source.originContentSha256}<br />Decoded ${source.decodedContentSha256} (${source.decodedByteSize} bytes)<br />Stored excerpts ${source.storedContentSha256}<br />Transformation ${source.transformationManifestSha256}</p>
  </article>`).join("");
  const questions = packet.customerQuestions.map((item) => `<article class="question-card"><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><link rel="icon" href="data:," />
<title>Atliera draft product review — ${escapeHtml(packet.subject.accountName)}</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18201c;background:#f4f3ed;line-height:1.5}
html,body{max-width:100%;overflow-x:hidden}*,:before,:after{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top right,#dbe9dd 0,transparent 32rem),#f4f3ed;color:#18201c}
a{color:#174d37;text-underline-offset:3px}a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #d37232;outline-offset:3px}
main{width:min(100%,1120px);min-width:0;margin:0 auto;padding:24px;overflow-wrap:anywhere}.boundary{min-width:0;border:1px solid #b56832;background:#fff4e6;border-radius:14px;padding:12px 16px;font-weight:700}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;color:#35634e;margin:22px 0 4px}h1{font-size:clamp(2rem,5vw,4.5rem);line-height:1.02;margin:.1em 0;max-width:15ch}h2{font-size:clamp(1.45rem,3vw,2.2rem);line-height:1.15}h3{line-height:1.25}.lede{font-size:1.12rem;max-width:68ch}.primary-action{display:inline-flex;align-items:center;justify-content:center;min-height:48px;max-width:100%;padding:11px 18px;border-radius:999px;background:#174d37;color:white;font-weight:800;text-decoration:none;margin:8px 0 18px}.signal-spotlight{min-width:0;border-left:8px solid #d37232;border-radius:16px;padding:17px 20px;background:#203f31;color:#f8fff9;box-shadow:0 12px 28px #18372628}.signal-spotlight p{font-size:1.08rem}.signal-spotlight .tag{color:#ffd9ad;text-transform:uppercase;letter-spacing:.1em;font-weight:800;font-size:.76rem}
section{min-width:0;margin:32px 0}.question-grid,.proposal-grid,.source-grid,.brief-answer-grid,.brief-lens-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.question-grid>*,.proposal-grid>*,.source-grid>*,.brief-answer-grid>*,.brief-lens-grid>*{min-width:0}.question-card,.proposal-card,.source-card,.brief-answer,.brief-lens,.trust-key{min-width:0;background:#fff;border:1px solid #cdd4ca;border-radius:16px;padding:18px}.question-card h3,.brief-answer h3{font-size:1rem;color:#35634e}.proposal-card{display:flex;flex-direction:column;gap:8px;border-top:6px solid #7a8f7e}.proposal-card.source_fact{border-top-color:#39795b}.proposal-card.analysis{border-top-color:#6671a8}.proposal-card.recommendation{border-top-color:#d37232}.card-labels{display:flex;flex-wrap:wrap;gap:7px}.card-labels span{border-radius:999px;padding:4px 9px;font-size:.76rem;font-weight:800}.classification{background:#e6efe7}.lens{background:#e9e7f5}.pending{background:#fff0dd}.trust-line{color:#46554d;font-size:.9rem}.support,.caveats,.safe-task{min-width:0;background:#f5f6f1;border-radius:10px;padding:12px}.safe-task{border:1px solid #d37232;background:#fff8ee}.safe-task span{font-size:.88rem;font-weight:700}.evidence{min-width:0}.support strong,.caveats strong,.safe-task strong{display:block;margin-bottom:8px}.evidence summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:800}.evidence ul{padding-left:20px}.evidence-item{min-width:0}.evidence-item blockquote{margin:10px 0;padding-left:12px;border-left:3px solid #9aa99d}.hash,.source-url,code{overflow-wrap:anywhere;word-break:break-word}.hash,.source-url{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.76rem;color:#536059}.local-controls{min-width:0;border:1px solid #829186;border-radius:12px;padding:12px;margin-top:auto}.local-controls legend{font-weight:800}.choice-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.choice{min-width:0;min-height:44px;display:flex;align-items:center;gap:10px;border:1px solid #8b978f;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}.choice input{width:22px;height:22px;flex:0 0 auto}.local-controls p{font-size:.84rem;margin-bottom:0}.trust-key ul{padding-left:20px}#draft-meeting-brief{border:2px solid #39795b;border-radius:18px;background:#edf5ed;padding:20px}.brief-account{font-size:1.08rem}.brief-answer-grid{margin:16px 0}.brief-answer:last-child{grid-column:1/-1}.brief-lens-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.brief-lens{border-top:6px solid #39795b}.brief-lens:nth-child(2){border-top-color:#6671a8}.brief-lens:nth-child(3){border-top-color:#d37232}.source-details{border-top:1px solid #b8c0b7;padding-top:24px}.source-details>summary{min-height:44px;cursor:pointer;font-weight:800;font-size:1.25rem}.zero-effect{background:#182c23;color:#edf9f0;border-radius:14px;padding:16px}.package-binding{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;overflow-wrap:anywhere}.footer-note{font-weight:800;color:#824919}
@media(max-width:720px){main{padding:14px 12px}.question-grid,.proposal-grid,.source-grid,.brief-answer-grid,.brief-lens-grid{grid-template-columns:minmax(0,1fr)}.brief-answer:last-child{grid-column:auto}section{margin:24px 0}.boundary{font-size:.88rem}h1{font-size:2.35rem}.signal-spotlight{padding:14px 15px}.proposal-card,.question-card,.source-card,.brief-answer,.brief-lens{padding:15px}#draft-meeting-brief{padding:15px}}
@media(max-width:420px){.choice-row{grid-template-columns:minmax(0,1fr)}.primary-action{width:100%}}
</style></head><body><main>
<div class="boundary">DRAFT · NOT SENT · NOT RATIFIED · UNARMED · no apply eligibility · current effective authorization: ${escapeHtml(packet.authority.currentEffectiveAuthorization)}</div>
<p class="eyebrow">Product-first account preparation</p><h1>${escapeHtml(packet.subject.accountName)}</h1>
<p class="lede">A source-bound draft for human review. Customer meaning comes first; custody detail follows after the proposed work.</p>
<a class="primary-action" href="#draft-meeting-brief">Review the draft meeting brief</a>
<section class="signal-spotlight" aria-labelledby="early-signal"><span class="tag">Signal · ${classificationLabel(signal.classification)}</span><h2 id="early-signal">${escapeHtml(signal.title)}</h2><p>${escapeHtml(signal.summary)}</p><small>Proposed · source-bound · not independently verified</small></section>
<section aria-labelledby="customer-questions"><p class="eyebrow">Customer meaning</p><h2 id="customer-questions">Five questions for this account</h2><div class="question-grid">${questions}</div></section>
<section class="trust-key" aria-labelledby="trust-key"><h2 id="trust-key">Read the trust labels literally</h2><ul><li><strong>Source-backed</strong> means exact text was found in one pinned source; it does not mean independently verified.</li><li><strong>Human-ratified</strong> and <strong>quality-passed</strong> are different checks; neither has happened.</li><li><strong>Proposed</strong> is not <strong>durable</strong>; this package performs zero graph or database writes.</li><li>Source facts, analysis, and recommendations remain visibly separate below.</li></ul></section>
<section aria-labelledby="proposal-review"><p class="eyebrow">Individual review</p><h2 id="proposal-review">${countLabel(packet.proposals.length, "pending proposal")}</h2><p>Accept or Reject is a truthful local-only draft control for each item. Nothing is submitted, saved, applied, persisted, or ratified.</p><div class="proposal-grid">${packet.proposals.map((proposal) => proposalHtml(proposal, sourcePack)).join("")}</div></section>
<section id="draft-meeting-brief" aria-labelledby="meeting-heading"><p class="eyebrow">Account-specific brief · readable here</p><h2 id="meeting-heading">Draft meeting brief — ${escapeHtml(packet.subject.accountName)}</h2><p class="brief-account"><strong>Account:</strong> ${escapeHtml(packet.subject.accountName)} · <code>${escapeHtml(packet.subject.accountId)}</code></p><p>DRAFT · NOT SENT · NOT RATIFIED. This inline preparation artifact is editable only by changing and revalidating the source package; it is non-executable, not independently verified, not applied, and not durable. Current effective authorization: ${escapeHtml(packet.authority.currentEffectiveAuthorization)}; apply eligibility: ${String(packet.authority.applyEligibility)}.</p><div class="brief-answer-grid">${meetingAnswers}</div><h3>Meeting prompts from proposed Signal, Map, and Play</h3><div class="brief-lens-grid">${meetingLens("Signal", signal)}${meetingLens("Map", map)}${meetingLens("Play", play)}</div><p class="footer-note">Review internally before use · no send, submit, save, ratify, or apply action exists here.</p></section>
<details class="source-details"><summary>Evidence currency, source custody, and package hashes</summary><section aria-labelledby="source-register"><h2 id="source-register">${countLabel(sourcePack.sources.length, "admitted source")}</h2><p>Only bounded exact excerpts are in this package. Full source bytes are not embedded.</p><div class="source-grid">${custody}</div></section><section><h2>Cross-package bindings</h2><p class="package-binding">Package ${escapeHtml(packet.packageBinding.packageId)}<br />Request raw ${packet.packageBinding.requestRawSha256}<br />Request canonical ${packet.packageBinding.requestCanonicalSha256}<br />Source pack ${packet.sourcePackSha256}<br />Candidate ${packet.candidateSha256}<br />Review packet ${packet.reviewPacketSha256}<br />Superseded result ${packet.packageBinding.supersededPackageResultSha256}<br />Execution ${packet.packageBinding.executionCommit} / ${packet.packageBinding.executionTree}<br />Owner authorization ${escapeHtml(packet.packageBinding.ownerAuthorizationId)}</p><p>Supersession preserves the old bytes and producer identity. It does not rewrite the historical package.</p></section></details>
<section class="zero-effect"><strong>Zero-effect boundary</strong><br />Acquisitions 0 · network calls 0 · provider calls 0 · database writes 0 · graph writes 0 · deployments 0 · outbound actions 0 · apply operations 0.</section>
<p class="footer-note">Local draft only · not saved · not ratified · no write authority.</p>
</main></body></html>\n`;
}
