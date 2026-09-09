import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ACCOUNT_RESEARCH_CATALOG } from "../../src/c3/account-research-catalog.ts";
import { projectAccountResearch, renderAccountResearch, type AccountResearchInspection } from "../../src/c3/account-research.ts";
import { createC3ModelRequest, createGenerationRecord, reconstructC3ModelRequest } from "../../src/c3/draft.ts";
import { briefContext } from "../../src/c3/planning-render.ts";
import { newPlanningBrief } from "../../src/c3/planning.ts";
import { syntheticMeetingCandidate, syntheticMeetingRequest } from "../fixtures/c3-workshop.ts";
import { loadC3AccountContext } from "../../src/c3/context.ts";
import { loadCuratedC3Context } from "../../src/c3/curated-context.ts";
import { renderC3Page } from "../../src/c3/render.ts";

const utah = () => loadC3AccountContext({ broadInputPath: "fixtures/account-intelligence/c2-01/broad-account-research-input.json", proposalPath: "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json", ownerDecisionPath: "docs/decisions/c2-owner-disposition-record.json", accountId: "acc_university_of_utah" });
const missouri = () => loadCuratedC3Context("fixtures/account-intelligence/c3-curated/missouri.json", "acc_university_of_missouri");
const esc = (text: string) => text.replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const main = (html: string) => html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const research = (html: string) => html.match(/<section id="account-unreviewed-research"[\s\S]*?<!-- end account unreviewed research -->/u)?.[0] ?? "";

test("Account offers a separate unreviewed public research layer with nine exact inspections across two accounts", async () => {
  for (const [context, count] of [[await utah(), 3], [await missouri(), 6]] as const) {
    const html = main(renderC3Page(context, { page: "research", topic: "sources" }, "test"));
    const inspection = research(html);
    assert.ok(inspection, "Account needs a separate unreviewed research section");
    assert.equal((inspection.match(/data-research-excerpt=/gu) ?? []).length, count);
    assert.match(inspection, /Unreviewed research/);
    assert.match(inspection, /No human approval or independent corroboration/);
    assert.match(inspection, /Excluded from approved facts, preparation, Brief and model inputs/);
    assert.doesNotMatch(inspection, /data-evidence-|data-source-id=|<form|<button|\bApprove\b|\bRatify\b/);
    assert.match(html, /id="account-research"/);
    assert.match(renderC3Page(context, { page: "home" }, "test"), />Prepare brief<\/a>/);
    assert.doesNotMatch(html, /no new research has run/);
    for (const match of inspection.matchAll(/<details\b[^>]*data-research-excerpt="([^"]+)"[\s\S]*?<\/details>/gu)) {
      assert.equal((match[0].match(/<details\b/gu) ?? []).length, 2, "exact excerpt inspection has a separate Source details disclosure");
      assert.match(match[0], /<summary>Source details<\/summary>[\s\S]*Acquired/);
      assert.match(match[0], /<summary>Exact excerpt and source details<\/summary>[\s\S]*<blockquote>/);
      assert.match(match[0], /Acquired <time datetime="2026-09-08T05:32:/);
      assert.match(match[0], /Publication date: Unknown/);
      assert.match(match[0], /Current through: Unknown/);
    }
  }
});

test("Public role qualifiers and MU service limitations stay with the attributed research", async () => {
  const u = research(renderC3Page(await utah(), { page: "research", topic: "sources" }, "test"));
  for (const exact of ["Jake Johansen\nChief Information Officer (interim)", "Trevor Long\nChief Information Security Officer (interim)", "Jim Livingston\nChief Technology Officer"]) assert.ok(u.includes(`<blockquote>${esc(exact)}</blockquote>`), exact);
  assert.match(u, /interim Chief Information Officer/);
  assert.match(u, /interim Chief Information Security Officer/);
  assert.match(u, /Last Updated: 6\/30\/26/);
  assert.match(u, /Page label only; not an appointment date or current-through date/);
  const m = research(renderC3Page(await missouri(), { page: "research", topic: "sources" }, "test"));
  for (const exact of ["Benjamin Canlas\nVice President for IT and MU Chief Information Officer", "Rebecca Fowler\nChief Information Security Officer", "Matthew Keeler\nDirector of IT Research Support Solutions"]) assert.ok(m.includes(`<blockquote>${esc(exact)}</blockquote>`), exact);
  assert.match(m, /Service remit is not a deployed product inventory, spend total or contract opportunity/);
  assert.match(m, /Evaluation does not establish a purchase, funded project, deployed agent or product fit/);
  assert.match(m, /no relationship, buying authority or reporting-line inference/);
  assert.match(m, /no buying-owner or campus\/system authority inference/);
});

test("Canonical account identity separates new research without account-name or alias heuristics", async () => {
  const context = await missouri();
  const renamed = { ...context, context: { ...context.context, account: { ...context.context.account, accountName: "University of Utah", knownAliases: ["Utah"] } } };
  const html = research(renderC3Page(renamed, { page: "research", topic: "sources" }, "test"));
  assert.match(html, /Benjamin Canlas/);
  assert.doesNotMatch(html, /Jake Johansen|Trevor Long|Jim Livingston|it.utah.edu/);
  for (const accountId of ["unknown", "acc_university_of_missouri ", "ACC_UNIVERSITY_OF_MISSOURI", "__proto__"]) {
    const unknown = { ...context, context: { ...context.context, account: { ...context.context.account, accountId } } };
    assert.equal(research(renderC3Page(unknown, { page: "research", topic: "sources" }, "test")), "");
  }
});

// Exact public excerpt digests checked against the supplied Batch 02 handoff.
const excerptHashes = {
  "mu-it-operating-context": "dfd93df4c89a1d083eaa72e6a30a104d4e88986d00eeda97055ef966b9bb47e3",
  "mu-it-service-breadth": "c995fe743df40fa9d253d0d00fb4b7107ba38500b65a872f83778a113d185f3b",
  "mu-it-ai-evaluation": "1d743f5a4e6544b7fb2c7301feda06069a9121810c5323e4f826e5e9f59bc74b",
  "mu-it-canlas": "71ba0df69f9ae3dab4dc36f235d01c73bb802fec72522229167da59633a18d54",
  "mu-it-fowler": "3b30a3ac14407bf43f96f9a701adade6878df9ead7e01dff8ce8a6a4f04da408",
  "mu-it-keeler": "947f93d157c9a7e2ee7f7023dfa4c57f0671d25bc3493faeb63d2c0b37d8f110",
  "utah-it-johansen": "d5ce040fa0b81ee3b4f88ef32098ec61fc7e7deedef89073dea800314f7fd514",
  "utah-it-long": "d55cc148bcd27a7925640604e42194a3727ce4d285b9bbafea8574fdc5fe33c7",
  "utah-it-livingston": "c77be92a6191a73e1aff74e5517b87cc59dbe1e4329050dffd5a0a25b2cd0979"
};

test("All four source records and nine exact public excerpts preserve their identities and false trust markers", () => {
  assert.equal(ACCOUNT_RESEARCH_CATALOG.sources.length, 4);
  assert.equal(ACCOUNT_RESEARCH_CATALOG.candidates.length, 9);
  assert.equal(new Set(ACCOUNT_RESEARCH_CATALOG.candidates.map(item => item.id)).size, 9);
  const sourceIdentity = [
    ["missouri-it-about", "https://doit.missouri.edu/about/", "2026-09-08T05:32:33.709393+00:00", null],
    ["missouri-it-services", "https://doit.missouri.edu/services/", "2026-09-08T05:32:34.764274+00:00", null],
    ["missouri-it-leaders", "https://doit.missouri.edu/about/it-leadership-team/", "2026-09-08T05:32:35.415353+00:00", null],
    ["utah-it-leaders", "https://it.utah.edu/cio/uit-leadership.php", "2026-09-08T05:32:36.070083+00:00", "Last Updated: 6/30/26"],
  ];
  assert.deepEqual(ACCOUNT_RESEARCH_CATALOG.sources.map(s => [s.id, s.url, s.acquiredAt, s.sourceUpdatedLabel]), sourceIdentity);
  for (const source of ACCOUNT_RESEARCH_CATALOG.sources) {
    assert.equal(source.publicationDate, null);
    assert.equal(source.evidenceCurrentThrough, null);
    assert.equal(source.humanApproved, false);
  }
  for (const candidate of ACCOUNT_RESEARCH_CATALOG.candidates) {
    assert.equal(hash(candidate.exactExcerpt), excerptHashes[candidate.id]);
    assert.equal(candidate.reviewStatus, "unreviewed_research");
    for (const key of ["approved", "ratified", "includedInBriefProjection", "graphWrite"] as const) assert.equal(candidate[key], false, key);
    assert.ok(!("evidenceId" in candidate));
    const source = ACCOUNT_RESEARCH_CATALOG.sources.find(s => s.id === candidate.sourceId)!;
    assert.equal(source.accountId, candidate.accountId);
    const html = renderAccountResearch(projectAccountResearch(candidate.accountId));
    assert.ok(html.includes(`<blockquote>${esc(candidate.exactExcerpt)}</blockquote>`));
    assert.ok(html.includes(esc(candidate.sourceAttributedSummary)));
    assert.ok(html.includes(esc(candidate.limitation)));
    assert.ok(html.includes(`href="${source.url}" target="_blank" rel="noopener noreferrer"`));
  }
  assert.ok(Object.values(ACCOUNT_RESEARCH_CATALOG.boundaries).every(value => value === false));
  const projected = projectAccountResearch("acc_university_of_utah");
  assert.throws(() => { (projected as unknown[]).push({}); }, TypeError);
  assert.throws(() => { (projected[0]!.candidate as unknown as { approved: boolean }).approved = true; }, TypeError);
  assert.throws(() => { (projected[0]!.source as unknown as { humanApproved: boolean }).humanApproved = true; }, TypeError);
});

test("Inspection escapes every authored field and refuses unsafe source links without losing exact text", () => {
  const attack = '<img src=x onerror="alert(1)"> & \' false';
  const original = projectAccountResearch("acc_university_of_utah")[0]!;
  for (const url of ["javascript:alert(1)", "data:text/html,attack", "//tracking.invalid", "https://user:secret@example.invalid/", "https://example.invalid/\nattack", "invalid"]) {
    const entry = { candidate: { ...original.candidate, id: attack, sourceAttributedSummary: attack, exactExcerpt: attack, limitation: attack, support: attack },
      source: { ...original.source, id: attack, label: attack, acquiredAt: attack, publicationDate: attack, evidenceCurrentThrough: attack, sourceUpdatedLabel: attack, url } } as unknown as AccountResearchInspection;
    const html = renderAccountResearch([entry]);
    assert.ok(html.includes(`<blockquote>${esc(attack)}</blockquote>`));
    assert.ok(html.includes(`datetime="${esc(attack)}"`));
    assert.match(html, /Source link unavailable/);
    assert.doesNotMatch(html, /<img|<script|href=|data-evidence-/);
    assert.ok(!html.includes(url));
  }
  const safe = { ...original, source: { ...original.source, url: 'https://example.invalid/path?a="x"&b=false' } } as unknown as AccountResearchInspection;
  assert.ok(renderAccountResearch([safe]).includes('href="https://example.invalid/path?a=&quot;x&quot;&amp;b=false"'));
});

test("New research stays available with sparse historical context and never leaks between canonical accounts", async () => {
  for (const context of [await utah(), await missouri()]) {
    const sparse = { ...context, context: { ...context.context, admittedSources: [], entities: [], declaredContradictions: ["Conflicting retained scope"] } };
    const html = main(renderC3Page(sparse, { page: "research", topic: "sources" }, "test"));
    assert.match(main(renderC3Page(sparse, { page: "home" }, "test")), /There is not enough matched evidence/);
    assert.match(html, /Conflicting retained scope/);
    assert.match(html, /id="account-research-people"/);
    const inspection = research(html);
    if (context.context.account.accountId === "acc_university_of_utah") {
      assert.match(inspection, /Jake Johansen/);
      assert.doesNotMatch(inspection, /Benjamin Canlas|doit.missouri.edu/);
    } else {
      assert.match(inspection, /Benjamin Canlas/);
      assert.match(html, /id="account-research-technology"/);
      assert.doesNotMatch(inspection, /Jake Johansen|it.utah.edu/);
    }
    const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map(match => match[1]!);
    assert.equal(ids.length, new Set(ids).size);
    for (const link of html.matchAll(/href="#(account-research-[^"]+)"/gu)) assert.ok(ids.includes(link[1]!));
  }
});

test("Account inspection leaves versioned context, model request, raw response and all downstream surfaces unchanged", async () => {
  const contexts = [await utah(), await missouri()] as const;
  const expectedContextHashes = ["d1ca538fe7036ea70d262eb195302d2ab9658623d501f92f2f9465703152c684", "d126dad0ee06c564364050748dee1470333224a13a733b9535ef8973258bea5c"];
  for (const [index, context] of contexts.entries()) {
    const before = JSON.stringify(context);
    assert.equal(hash(before), expectedContextHashes[index], "baseline versioned context bytes");
    const briefBefore = briefContext(context);
    const pages = [{ page: "prepare" as const, request: syntheticMeetingRequest }, { page: "planning" as const, brief: newPlanningBrief("strategy") }];
    const beforePages = pages.map(page => main(renderC3Page(context, page, "test")));
    renderC3Page(context, { page: "research", topic: "sources" }, "test");
    assert.equal(JSON.stringify(context), before);
    assert.equal(briefContext(context), briefBefore);
    assert.deepEqual(pages.map(page => main(renderC3Page(context, page, "test"))), beforePages);
    for (const item of projectAccountResearch(context.context.account.accountId)) {
      for (const downstream of [before, briefBefore, ...beforePages]) {
        assert.ok(!downstream.includes(item.candidate.id));
        assert.ok(!downstream.includes(item.candidate.exactExcerpt));
        assert.ok(!downstream.includes('id="account-unreviewed-research"'));
      }
    }
  }
  const context = contexts[0];
  // Keep the pre-upgrade golden identities under their ORIGINAL absent-marker contract.
  const historicalInput = { meetingRequest: syntheticMeetingRequest, revision: null };
  const modelRequest = reconstructC3ModelRequest(context, historicalInput);
  const freshRequest = createC3ModelRequest(context, syntheticMeetingRequest);
  assert.equal(freshRequest.generationContractVersion, "6");
  assert.equal(hash(JSON.stringify(modelRequest)), "5b295d01635cef3816f6c1c0d815a9eb9c1bf0c5e565b0df32ac7abdc09a1b3b", "baseline request bytes passed to a provider, without calling one");
  const raw = syntheticMeetingCandidate(context); // Hand-authored test data, never an acquired recording.
  const record = createGenerationRecord(modelRequest, raw, context);
  const draftBefore = main(renderC3Page(context, { page: "draft", record, correctionNote: "" }, "test"));
  renderC3Page(context, { page: "research", topic: "sources" }, "test");
  assert.deepEqual(reconstructC3ModelRequest(context, historicalInput), modelRequest);
  assert.deepEqual(createC3ModelRequest(context, syntheticMeetingRequest), freshRequest);
  assert.equal(record.rawResponse, raw);
  assert.equal(hash(JSON.stringify(record)), "8e3bd9887df8d03505e39e690eaeee53cf7f8e0bf15da6addb8271e36c8d2b53");
  assert.match(draftBefore, /data-revision-panel/); // The revised UI is intentionally different; raw/request identities above stay historical.
  assert.equal(main(renderC3Page(context, { page: "draft", record, correctionNote: "" }, "test")), draftBefore);
  assert.doesNotMatch(draftBefore, /Jake Johansen|research-excerpt-utah-it-/);
});

test("Catalog has no runtime acquisition or provider dependencies; downstream modules do not consume it", async () => {
  for (const file of ["account-research.ts", "account-research-catalog.ts"]) {
    const code = await readFile(`src/c3/${file}`, "utf8");
    assert.doesNotMatch(code, /\bfetch\s*\(|process\.env|node:(?:fs|https?|child_process)|\b(?:OpenAI|Anthropic)\b|\.\/provider/);
    assert.doesNotMatch(code, /\/home\/|rawHtml|responseSha256|extractedTextSha256/iu);
  }
  for (const file of ["context.ts", "view-context.ts", "curated-context.ts", "draft.ts", "provider.ts", "planning.ts", "planning-render.ts"]) {
    assert.doesNotMatch(await readFile(`src/c3/${file}`, "utf8"), /account-research/);
  }
});
