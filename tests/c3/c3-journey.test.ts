import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { canonicalJson, loadC3AccountContext, type FrozenC3AccountContext } from "../../src/c3/context.ts";
import { assertReplayIdentity, createC3ModelRequest, createC3RevisionContext, createGenerationRecord, validateC3Candidate } from "../../src/c3/draft.ts";
import { CommandC3ModelProvider } from "../../src/c3/provider.ts";
import { renderC3Page } from "../../src/c3/render.ts";

const ROOT = process.cwd();
const BROAD = resolve(ROOT, "fixtures/account-intelligence/c2-01/broad-account-research-input.json");
const PROPOSAL = resolve(ROOT, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json");
const FEDEX_PROPOSAL = resolve(ROOT, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/fedex-validated-proposal.json");
const OWNER = resolve(ROOT, "docs/decisions/c2-owner-disposition-record.json");

function load(broadInputPath = BROAD) {
  return loadC3AccountContext({ broadInputPath, proposalPath: PROPOSAL, ownerDecisionPath: OWNER,
    accountId: "acc_university_of_utah" });
}

function rawCandidate(context: FrozenC3AccountContext, overrides: Record<string, unknown> = {}): string {
  const evidence = context.context.admittedSources.flatMap((source) => source.excerpts)[0]!.evidenceId;
  return JSON.stringify({
    temporalOutcome: "no_material_change_established",
    objective: { text: "Learn how the audience frames its priorities and agree a useful next step.", evidenceRefs: [], supportCategory: "recommendation" },
    audienceThesis: { text: "The admitted context suggests a focused learning conversation may be useful.", evidenceRefs: [evidence], supportCategory: "cautious_inference" },
    opening: { text: "We recommend validating priorities before suggesting any course of action.", evidenceRefs: [], supportCategory: "recommendation" },
    questions: [
      { question: "Which outcome matters most now?", intendedLearning: "The audience's priority ordering.", evidenceRefs: [], supportCategory: "open_question" },
      { question: "Which constraints should shape the discussion?", intendedLearning: "Material delivery and governance limits.", evidenceRefs: [evidence], supportCategory: "open_question" },
      { question: "What would make a follow-up useful?", intendedLearning: "A mutually useful next step.", evidenceRefs: [], supportCategory: "open_question" },
    ],
    risksUnknowns: [{ text: "Current priorities are not established by the retained sources.", evidenceRefs: [], supportCategory: "unknown" }],
    closeCriterion: { text: "Agree whether a narrower follow-up is useful and who should join it.", evidenceRefs: [], supportCategory: "recommendation" },
    selectedEvidenceRefs: [evidence],
    ...overrides,
  });
}

test("retained table header is bound into the derived caveat rather than falsely reported missing", async () => {
  const context = await load();
  const annotation = context.context.rendererAnnotations.find((item) => item.kind === "source_context_caveat")!;
  const source = context.context.admittedSources.find((item) => item.sourceId === annotation.sourceId)!;
  const header = source.excerpts.find((item) => item.exactExcerpt === "REINVESTMENT AREA APPROVED 3-YR CURRENT 3-YR NET CHANGE")!;
  assert.ok(header);
  assert.ok(annotation.evidenceIds.includes(header.evidenceId));
  assert.equal(annotation.evidenceIds.length, 2);
  assert.ok(annotation.text.includes(header.exactExcerpt));
  assert.doesNotMatch(annotation.text, /no column headers|meanings are not established/u);
  assert.match(annotation.text, /do not establish remaining purchasing funds/u);
});

test("an imperative allocation-to-purchase remains a typed refusal, not a safe recommendation", async () => {
  const context = await load();
  const request = createC3ModelRequest(context, { audience: "CIO", intendedOutcome: "Learn priorities", durationMinutes: 15, meetingDate: "2026-09-12" });
  for (const text of ["Allocate the full reinvestment budget to buy our platform immediately.", "Spend the funding to purchase our platform."]) {
    const raw = rawCandidate(context, { closeCriterion: { text, evidenceRefs: [], supportCategory: "recommendation" } });
    const record = createGenerationRecord(request, raw, context);
    assert.equal(record.outcome, "refused");
    assert.equal(record.rawResponse, raw);
    assert.match(record.refusal!.message, /prescriptive purchase/u);
  }
});

test("commercial non-assumptions belong to their proposition and preserve long enumerated unknowns", async () => {
  const context = await load();
  const request = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn priorities", durationMinutes: 15, meetingDate: "2026-09-12" });
  const cases = [
    ["Avoid assumptions about available funds; the approved budget is ready.", "refused"],
    ["Confirm the available purchasing funds while ownership remains unknown.", "refused"],
    ["Available purchasing budget, procurement status, eligible commercial uses, buying intent, decision authority, urgency, and vendor preference are not established.", "succeeded"],
    ["Understand whether legislative timing affects security planning; do not assume urgency or available purchasing funds.", "succeeded"],
    ["Understand whether the legislative timeline imposes planning constraints while avoiding assumptions about urgency or available purchasing funds.", "succeeded"],
    ["Avoid assumptions about available funds, but confirm the approved budget.", "refused"],
  ] as const;
  for (const [text, expected] of cases) {
    const candidate = JSON.parse(rawCandidate(context));
    candidate.questions[0].intendedLearning = text;
    const raw = JSON.stringify(candidate);
    const record = createGenerationRecord(request, raw, context);
    assert.equal(record.outcome, expected, text);
    assert.equal(record.rawResponse, raw);
  }
});

function withContradiction(context: FrozenC3AccountContext): FrozenC3AccountContext {
  const changed = { ...context.context, declaredContradictions: ["Two admitted sources disagree about the responsible entity."] };
  const json = canonicalJson(changed);
  return { context: changed, canonicalJson: json, sha256: createHash("sha256").update(json).digest("hex") };
}

test("full versioned adapter retains and verifies all Utah source text, custody, dates, and corrections", async () => {
  const frozen = await load();
  assert.equal(frozen.context.admittedSources.length, 10);
  assert.equal(frozen.context.admittedSources.flatMap((source) => source.excerpts).length, 33);
  assert.ok(frozen.context.admittedSources.every((source) => source.fullBoundedCleanText.length > 0));
  assert.ok(frozen.context.admittedSources.every((source) => createHash("sha256").update(source.fullBoundedCleanText).digest("hex") === source.retrievedContentSha256));
  assert.ok(frozen.context.admittedSources.every((source) => source.taxonomyAuthorities.length === source.taxonomyAuthorizationIds.length));
  assert.ok(frozen.context.rendererAnnotations.some((item) => item.kind === "source_context_caveat"));
  assert.ok(frozen.context.rendererAnnotations.some((item) => item.kind === "freshness_recheck"));
  assert.match(frozen.context.ownerCorrections.map((item) => item.text).join(" "), /Redtail and UHAIV/);
  assert.deepEqual(frozen.context.account.canonicalPublicDomains, ["utah.edu"]);
  assert.deepEqual(frozen.context.account.knownAliases, ["U of U"]);
  assert.ok(frozen.context.discoveryLineage.length > 0);
  assert.equal(createHash("sha256").update(frozen.context.ownerDecisionSource.rawJson).digest("hex"),
    frozen.context.ownerDecisionSource.rawSha256);
  assert.equal(frozen.context.priorRevision, null);
  assert.equal(frozen.context.temporalBoundary.legacyMeaningfullyChangedIsTemporalProof, false);
  assert.match(frozen.context.custody.boundedCleanTextMeaning, /not original web\/PDF completeness/);
});

test("FedEx retains its recorded Revise-before-C3 correction and all nine admitted sources", async () => {
  const frozen = await loadC3AccountContext({ broadInputPath: BROAD, proposalPath: FEDEX_PROPOSAL,
    ownerDecisionPath: OWNER, accountId: "acc_fedex_corp" });
  assert.equal(frozen.context.admittedSources.length, 9);
  assert.match(frozen.context.ownerCorrections.map((item) => item.text).join(" "), /Revise before C3/);
  assert.match(frozen.context.ownerCorrections.map((item) => item.text).join(" "), /not enabled/);
  assert.match(frozen.context.ownerDecisionSource.rawJson, /Dataworks\/AI-orchestration and Network 2\.0 \(end-2027\)/);
  assert.match(frozen.context.ownerDecisionSource.rawJson, /demote supplier-portal registration to housekeeping/);
});

test("owner decision byte changes alter context identity without promoting derived interpretation to verbatim text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atliera-c3-owner-identity-"));
  try {
    const original = await load();
    const owner = JSON.parse(await readFile(OWNER, "utf8")) as { decision: string };
    owner.decision = owner.decision.replace("Utah: Continue to C3", "Utah: Continue to C3. Bounded correction changed");
    const changedPath = join(directory, "owner.json");
    await writeFile(changedPath, `${JSON.stringify(owner, null, 2)}\n`);
    const changed = await loadC3AccountContext({ broadInputPath: BROAD, proposalPath: PROPOSAL,
      ownerDecisionPath: changedPath, accountId: "acc_university_of_utah" });
    assert.notEqual(changed.sha256, original.sha256);
    assert.match(changed.context.ownerDecisionSource.rawJson, /Bounded correction changed/);
    assert.ok(changed.context.ownerCorrections.every((item) => item.derivedInterpretation));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("adapter refuses retained clean-text tampering instead of repairing old projection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atliera-c3-tamper-"));
  try {
    const value = JSON.parse(await readFile(BROAD, "utf8")) as { accounts: { request: { accountId: string }; retrievedSources: { retrievedText: string }[] }[] };
    value.accounts.find((account) => account.request.accountId === "acc_university_of_utah")!.retrievedSources[0]!.retrievedText += " tampered";
    const tampered = join(directory, "broad.json");
    await writeFile(tampered, JSON.stringify(value));
    await assert.rejects(load(tampered), /exact excerpt|custody|retrieved source candidate/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("meeting prompt carries full canonical context and differentiates audience priorities without changing facts", async () => {
  const context = await load();
  const base = { intendedOutcome: "Understand priorities and agree a useful follow-up.", durationMinutes: 15, meetingDate: "2026-09-12" };
  const ciso = createC3ModelRequest(context, { ...base, audience: "CISO" });
  const cio = createC3ModelRequest(context, { ...base, audience: "CIO and engineering leaders" });
  assert.notEqual(ciso.meetingRequestSha256, cio.meetingRequestSha256);
  assert.match(ciso.prompt, /security ownership, controls, risk boundaries/);
  assert.match(cio.prompt, /architecture, operating model, integration dependencies/);
  assert.ok(ciso.prompt.includes(context.canonicalJson));
  assert.ok(cio.prompt.includes(context.canonicalJson));
  assert.match(ciso.prompt, /canonicalUrl/);
  assert.match(ciso.prompt, /publicationDate/);
});

test("no-change and insufficient-context outcomes validate while unsupported prior-revision change refuses", async () => {
  const context = await load();
  assert.equal(validateC3Candidate(rawCandidate(context), context).temporalOutcome, "no_material_change_established");
  const sparse = JSON.parse(rawCandidate(context)) as Record<string, unknown>;
  sparse.temporalOutcome = "insufficient_context";
  sparse.audienceThesis = { text: "The available context is insufficient for a responsible thesis.", evidenceRefs: [], supportCategory: "unknown" };
  sparse.opening = { text: "Use the meeting to establish context before suggesting any plan.", evidenceRefs: [], supportCategory: "recommendation" };
  (sparse.questions as { evidenceRefs: string[]; supportCategory: string }[]).forEach((question) => { question.evidenceRefs = []; question.supportCategory = "open_question"; });
  sparse.selectedEvidenceRefs = [];
  assert.equal(validateC3Candidate(JSON.stringify(sparse), context).temporalOutcome, "insufficient_context");
  assert.throws(() => validateC3Candidate(rawCandidate(context, { temporalOutcome: "change_against_prior_revision" }), context), /requires an actual prior revision/);
});

test("known conflict stays in whole-draft warnings even when only one evidence item is selected", async () => {
  const context = withContradiction(await load());
  const draft = validateC3Candidate(rawCandidate(context), context);
  assert.ok(draft.warnings.some((warning) => warning.code === "known_contradiction"));
  assert.ok(draft.warnings.some((warning) => warning.code === "related_context_only"));
  assert.equal(draft.status, "proposed_unreviewed");
  assert.equal(draft.durablySaved, false);
  assert.equal(draft.audienceThesis.supportCategory, "cautious_inference");
});

test("input/output identities replay exactly and invalid or unsafe model candidates become typed refusals", async () => {
  const context = await load();
  const request = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn priorities and agree a next step.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const success = createGenerationRecord(request, rawCandidate(context), context);
  assert.equal(success.outcome, "succeeded");
  assertReplayIdentity(success, context);
  const invalid = createGenerationRecord(request, "```json\n{}\n```", context);
  assert.equal(invalid.outcome, "refused");
  assert.match(invalid.refusal!.message, /strict JSON/);
  const unsafe = JSON.parse(rawCandidate(context)) as { audienceThesis: { text: string } };
  unsafe.audienceThesis.text = "The account may have an available purchasing budget and should buy our product.";
  const refusal = createGenerationRecord(request, JSON.stringify(unsafe), context);
  assert.equal(refusal.outcome, "refused");
  assert.match(refusal.refusal!.message, /unsupported incident, commercial assertion/);
});

test("whole-field support and no-new-account-fact rules cover questions, intended learning, objective, and close", async () => {
  const context = await load();
  const request = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn constraints.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const evidence = context.context.admittedSources[0]!.excerpts[0]!;

  const exact = JSON.parse(rawCandidate(context)) as any;
  exact.opening = { text: evidence.exactExcerpt, evidenceRefs: [evidence.evidenceId], supportCategory: "direct_support" };
  assert.equal(createGenerationRecord(request, JSON.stringify(exact), context).outcome, "succeeded");
  exact.opening.text = `${evidence.exactExcerpt} What should we discuss?`;
  const mixed = createGenerationRecord(request, JSON.stringify(exact), context);
  assert.equal(mixed.outcome, "refused");
  assert.match(mixed.refusal!.message, /whole-field verbatim equality/);

  const directQuestion = JSON.parse(rawCandidate(context)) as any;
  directQuestion.questions[0] = { question: "Given the available purchasing budget, should we buy CyberNova immediately?",
    intendedLearning: "Confirm the already approved purchase.", evidenceRefs: [], supportCategory: "direct_support" };
  assert.equal(createGenerationRecord(request, JSON.stringify(directQuestion), context).outcome, "refused");

  const presupposition = JSON.parse(rawCandidate(context)) as any;
  presupposition.questions[0] = { question: "Given the available purchasing budget, should we buy CyberNova immediately?",
    intendedLearning: "Confirm the already approved purchase.", evidenceRefs: [], supportCategory: "open_question" };
  const questionRefusal = createGenerationRecord(request, JSON.stringify(presupposition), context);
  assert.equal(questionRefusal.outcome, "refused");
  assert.match(questionRefusal.refusal!.message, /unsupported incident, commercial assertion/);

  for (const thesis of [
    "The University of Utah may have suffered a ransomware attack on September 1, 2026 and appointed CyberNova as its recovery partner.",
    "Utah may have $50 million ready to spend on our cybersecurity platform and has chosen CyberNova for the deployment.",
  ]) {
    const attacked = JSON.parse(rawCandidate(context)) as any;
    attacked.audienceThesis = { text: thesis, evidenceRefs: [evidence.evidenceId], supportCategory: "cautious_inference" };
    assert.equal(createGenerationRecord(request, JSON.stringify(attacked), context).outcome, "refused", thesis);
  }

  const caveat = JSON.parse(rawCandidate(context)) as any;
  caveat.audienceThesis = { text: "The retained funding statements do not establish an available purchasing budget; use this meeting to learn constraints.",
    evidenceRefs: [], supportCategory: "unknown" };
  caveat.objective = { text: "Clarify budget and vendor uncertainty without assuming procurement activity or vendor intent.",
    evidenceRefs: [], supportCategory: "recommendation" };
  assert.equal(createGenerationRecord(request, JSON.stringify(caveat), context).outcome, "succeeded");
});

test("bounded non-assumption wording permits only the cautioned commercial mention", async () => {
  const context = await load();
  const request = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn constraints.", durationMinutes: 15, meetingDate: "2026-09-12" });
  for (const learning of [
    "Understand whether legislative timing affects security planning while avoiding assumptions about urgency or available purchasing funds.",
    "Understand legislative timing without assuming that purchasing funding is available.",
  ]) {
    const value = JSON.parse(rawCandidate(context)) as any;
    value.questions.push({ question: "How should legislative timing enter the plan?", intendedLearning: learning,
      evidenceRefs: [], supportCategory: "open_question" });
    assert.equal(createGenerationRecord(request, JSON.stringify(value), context).outcome, "succeeded", learning);
  }
  for (const learning of [
    "Confirm the available purchasing funds.",
    "Avoid assumptions about urgency or available purchasing funds and confirm the available purchasing funds.",
    "Avoid assumptions about available purchasing funds; confirm the approved purchase.",
    "Without assuming available funding, the account suffered a ransomware incident.",
  ]) {
    const value = JSON.parse(rawCandidate(context)) as any;
    value.questions.push({ question: "How should legislative timing enter the plan?", intendedLearning: learning,
      evidenceRefs: [], supportCategory: "open_question" });
    const record = createGenerationRecord(request, JSON.stringify(value), context);
    assert.equal(record.outcome, "refused", learning);
    assert.match(record.refusal!.message, /unsupported incident, commercial assertion/);
  }
});

test("every direct-support-permitted draft slot visibly quotes and attributes exact source text", async () => {
  const context = await load();
  const request = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn constraints.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const source = context.context.admittedSources.find((item) => item.excerpts.some((excerpt) => /[“”'’,:;()-]/u.test(excerpt.exactExcerpt)))!;
  const evidence = source.excerpts.find((excerpt) => /[“”'’,:;()-]/u.test(excerpt.exactExcerpt))!;
  const value = JSON.parse(rawCandidate(context)) as any;
  const direct = { text: evidence.exactExcerpt, evidenceRefs: [evidence.evidenceId], supportCategory: "direct_support" };
  value.audienceThesis = direct;
  value.opening = direct;
  value.risksUnknowns = [direct];
  value.questions[1].evidenceRefs = [evidence.evidenceId];
  value.selectedEvidenceRefs = [evidence.evidenceId];
  const record = createGenerationRecord(request, JSON.stringify(value), context);
  assert.equal(record.outcome, "succeeded");
  assert.equal(record.draft!.opening.text, evidence.exactExcerpt);
  const html = renderC3Page(context, { page: "draft", record, correctionNote: "" }, "test-csrf");
  const escapedExcerpt = evidence.exactExcerpt.replace(/[&<>"']/gu,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
  for (const title of ["Audience thesis", "Opening", "Risks & unknowns"]) {
    const start = html.indexOf(`>${title}<`);
    assert.notEqual(start, -1, title);
    const section = html.slice(start, html.indexOf("</section>", start));
    assert.match(section, new RegExp(`<blockquote[^>]*>${escapedExcerpt.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}</blockquote>`), title);
    assert.ok(section.includes(source.title), `${title} includes source title`);
    assert.ok(section.includes(source.publisher), `${title} includes publisher`);
  }
  assert.match(html, new RegExp(`aria-label="Opening evidence 1: ${source.title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));
  assert.match(html, new RegExp(`aria-label="Question 2 evidence 1: ${source.title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));
  assert.match(html, new RegExp(`aria-label="Risk or unknown 1 evidence 1: ${source.title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));
  assert.match(html, /\.support a,\.warning a\{display:inline-flex;align-items:center;min-height:44px;max-width:100%/);

  const inferred = JSON.parse(rawCandidate(context)) as any;
  const inferenceRecord = createGenerationRecord(request, JSON.stringify(inferred), context);
  const inferredHtml = renderC3Page(context, { page: "draft", record: inferenceRecord, correctionNote: "" }, "test-csrf");
  const inferenceStart = inferredHtml.indexOf(">Audience thesis<");
  const inferenceSection = inferredHtml.slice(inferenceStart, inferredHtml.indexOf("</section>", inferenceStart));
  assert.doesNotMatch(inferenceSection, /<blockquote/);
});

test("initial dated discovery requires selected event-date support, not publication or undated support", async () => {
  const context = await load();
  const undated = context.context.admittedSources.find((source) => source.publicationDate === null && source.eventDate === null)!.excerpts[0]!;
  const value = JSON.parse(rawCandidate(context)) as any;
  value.temporalOutcome = "initial_dated_event_discovery";
  value.audienceThesis.evidenceRefs = [undated.evidenceId];
  value.questions[1].evidenceRefs = [undated.evidenceId];
  value.selectedEvidenceRefs = [undated.evidenceId];
  assert.throws(() => validateC3Candidate(JSON.stringify(value), context), /explicit admitted event date; publication alone is insufficient/);
  const dated = context.context.admittedSources.find((source) => source.eventDate !== null)!.excerpts[0]!;
  value.audienceThesis.evidenceRefs = [dated.evidenceId]; value.questions[1].evidenceRefs = [dated.evidenceId];
  value.selectedEvidenceRefs = [dated.evidenceId];
  assert.equal(validateC3Candidate(JSON.stringify(value), context).temporalOutcome, "initial_dated_event_discovery");
});

test("revision identity includes exact correction and prior raw/draft; replay compares derived bytes and records are deeply frozen", async () => {
  const context = await load();
  const meeting = { audience: "CISO", intendedOutcome: "Learn priorities and agree a next step.", durationMinutes: 15, meetingDate: "2026-09-12" };
  const firstRequest = createC3ModelRequest(context, meeting);
  const first = createGenerationRecord(firstRequest, rawCandidate(context), context);
  const note = "Keep the funding caveat and ask security ownership before architecture.";
  const revision = createC3RevisionContext(first, note, 1);
  const nextRequest = createC3ModelRequest(context, meeting, revision);
  assert.notEqual(nextRequest.revisionSha256, null);
  assert.notEqual(createHash("sha256").update(canonicalJson(firstRequest)).digest("hex"),
    createHash("sha256").update(canonicalJson(nextRequest)).digest("hex"));
  assert.match(nextRequest.prompt, new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(revision.priorRawResponse, first.rawResponse);
  assert.deepEqual(revision.priorDraft, first.draft);
  const revised = createGenerationRecord(nextRequest, rawCandidate(context), context);
  assertReplayIdentity(revised, context);
  assert.equal(Object.isFrozen(revised), true);
  assert.equal(Object.isFrozen(revised.draft?.audienceThesis), true);
  const mutated = JSON.parse(JSON.stringify(revised)) as any;
  mutated.draft.audienceThesis.text = "UNRECORDED replacement thesis";
  assert.throws(() => assertReplayIdentity(mutated, context), /replay mismatch/);
});

test("operator command provider receives one bounded request file, returns raw stdout, and honors cancellation", async () => {
  const context = await load();
  const modelRequest = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn priorities and agree a next step.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const provider = new CommandC3ModelProvider({ command: "/usr/bin/wc", args: ["-c"], timeoutMs: 5_000, maxOutputBytes: 4_096 });
  assert.match(await provider.generate(modelRequest, new AbortController().signal), /^\s*\d+\s+\/tmp\/atliera-c3-request-[^/]+\/model-request\.json\n$/u);

  const controller = new AbortController();
  const pending = new CommandC3ModelProvider({ command: process.execPath,
    args: ["-e", "setTimeout(()=>process.stdout.write('{}'),5000)"], timeoutMs: 10_000 }).generate(modelRequest, controller.signal);
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, /generation cancelled/);
});

test("operator provider decodes stdout once as fatal UTF-8 and preserves exact raw identity", async () => {
  const context = await load();
  const modelRequest = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn priorities.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const expected = '{"message":"€"}';
  const script = `const fs=require('node:fs'),b=Buffer.from(${JSON.stringify(expected)});fs.writeSync(1,b.subarray(0,13));setTimeout(()=>fs.writeSync(1,b.subarray(13)),20)`;
  const provider = new CommandC3ModelProvider({ command: process.execPath, args: ["-e", script], timeoutMs: 5_000 });
  const raw = await provider.generate(modelRequest, new AbortController().signal);
  assert.equal(raw, expected);
  const record = createGenerationRecord(modelRequest, raw, context);
  assert.equal(record.rawResponse, expected);
  assert.equal(record.rawResponseSha256, createHash("sha256").update(expected).digest("hex"));
  const invalid = new CommandC3ModelProvider({ command: process.execPath,
    args: ["-e", "require('node:fs').writeSync(1,Buffer.from([0xc3,0x28]))"], timeoutMs: 5_000 });
  await assert.rejects(invalid.generate(modelRequest, new AbortController().signal), /not valid UTF-8/);

  const bomWire = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(rawCandidate(context), "utf8")]);
  const bomProvider = new CommandC3ModelProvider({ command: process.execPath,
    args: ["-e", `require('node:fs').writeSync(1,Buffer.from('${bomWire.toString("base64")}', 'base64'))`], timeoutMs: 5_000 });
  const bomRaw = await bomProvider.generate(modelRequest, new AbortController().signal);
  const offlineRaw = bomWire.toString("utf8");
  assert.equal(bomRaw, offlineRaw);
  assert.equal(bomRaw.charCodeAt(0), 0xfeff);
  const online = createGenerationRecord(modelRequest, bomRaw, context);
  const offline = createGenerationRecord(modelRequest, offlineRaw, context);
  assert.equal(online.outcome, "refused");
  assert.equal(offline.outcome, "refused");
  assert.deepEqual(online, offline);
  assert.equal(online.rawResponseSha256, createHash("sha256").update(bomWire).digest("hex"));
  assert.match(online.refusal!.message, /strict JSON object/);
});

test("TERM-resistant command and descendant are killed and reaped before the provider accepts later work", async () => {
  const context = await load();
  const modelRequest = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn priorities.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const directory = await mkdtemp(join(tmpdir(), "atliera-c3-lifecycle-"));
  const marker = join(directory, "pids.json");
  const resistant = [
    "const fs=require('node:fs'),{spawn}=require('node:child_process');",
    "const marker=process.argv[1];",
    "if(fs.existsSync(marker)){fs.writeSync(1,'{}');}else{",
    "const child=spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)\"],{stdio:'ignore'});",
    "fs.writeFileSync(marker,JSON.stringify({parent:process.pid,descendant:child.pid}));",
    "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);}",
  ].join("");
  const provider = new CommandC3ModelProvider({ command: process.execPath, args: ["-e", resistant, marker],
    timeoutMs: 5_000, killGraceMs: 30 });
  try {
    const controller = new AbortController();
    const pending = provider.generate(modelRequest, controller.signal);
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await readFile(marker, "utf8"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 5)); }
    }
    const pids = JSON.parse(await readFile(marker, "utf8")) as { parent: number; descendant: number };
    controller.abort();
    await assert.rejects(pending, /generation cancelled; remote billed-work status may be unknown/);
    const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
    assert.equal(alive(pids.parent), false);
    assert.equal(alive(pids.descendant), false);
    assert.equal(await provider.generate(modelRequest, new AbortController().signal), "{}");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("timeout and output overflow also reap TERM-resistant owned commands before settling", async () => {
  const context = await load();
  const modelRequest = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn priorities.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const directory = await mkdtemp(join(tmpdir(), "atliera-c3-stop-paths-"));
  const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
  try {
    for (const mode of ["timeout", "overflow"] as const) {
      const marker = join(directory, `${mode}.pid`);
      const script = `const fs=require('node:fs');fs.writeFileSync(process.argv[1],String(process.pid));process.on('SIGTERM',()=>{});${mode === "overflow" ? "fs.writeSync(1,Buffer.alloc(2048));" : ""}setInterval(()=>{},1000)`;
      // Keep the one-second model timeout, but allow bounded scheduler/reap
      // latency after KILL on a shared CI host. A 30 ms cleanup grace flaked
      // into the provider's legitimate fail-closed HOLD before Node reaped it.
      const provider = new CommandC3ModelProvider({ command: process.execPath, args: ["-e", script, marker],
        timeoutMs: mode === "timeout" ? 1_000 : 5_000, maxOutputBytes: 1_024, killGraceMs: 250 });
      const pending = provider.generate(modelRequest, new AbortController().signal);
      await assert.rejects(pending, mode === "timeout" ? /timed out; remote billed-work status may be unknown/ : /exceeded output bound; remote billed-work status may be unknown/);
      const pid = Number(await readFile(marker, "utf8"));
      assert.equal(alive(pid), false, mode);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("operator provider passes minimal runtime environment and no inherited credential variables", async () => {
  const context = await load();
  const modelRequest = createC3ModelRequest(context, { audience: "CISO", intendedOutcome: "Learn priorities.", durationMinutes: 15, meetingDate: "2026-09-12" });
  const old = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "must-not-reach-command";
  try {
    const provider = new CommandC3ModelProvider({ command: process.execPath,
      args: ["-e", "require('node:fs').writeSync(1,JSON.stringify({hasCredential:'OPENAI_API_KEY' in process.env,hasPath:'PATH' in process.env}))"], timeoutMs: 5_000 });
    assert.deepEqual(JSON.parse(await provider.generate(modelRequest, new AbortController().signal)), { hasCredential: false, hasPath: true });
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old;
  }
});
