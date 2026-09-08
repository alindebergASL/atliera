import { createHash } from "node:crypto";
import { deepFreezeOwnData } from "../authority/strict-json.ts";
import { ACCOUNT_READING_ANCHORS } from "./account-reading-anchors.ts";
import type { C3ViewSource, FrozenC3ViewContext } from "./view-context.ts";

/** Presentation only. Never fed into context admission, planning, or a model request. */
export type AccountTopic = "overview" | "priorities" | "people" | "technology" | "discoveries" | "hypotheses";
export interface AccountReading {
  readonly id: string;
  readonly topic: AccountTopic;
  readonly title: string;
  readonly text: string;
  readonly evidenceIds: readonly string[];
  readonly kind: "source-summary" | "interpretation" | "hypothesis";
  readonly limit?: string;
  readonly question?: string;
  /** Source-reported period, never an acquisition date or a computed account change. */
  readonly period?: string;
}
export interface AccountSourcePassage {
  readonly id: string;
  readonly title: string;
  readonly source: C3ViewSource;
  readonly exactText: string;
  readonly limit: string;
}
export interface AccountProjection {
  readonly readings: readonly AccountReading[];
  readonly passages: readonly AccountSourcePassage[];
  readonly unmatchedSourceIds: readonly string[];
}

// Authored reading notes bound to exact retained evidence, not an account-name switch or new facts.
// Changing source bytes hides a note until its bindings and meaning are deliberately reviewed.
const reading = (topic: AccountTopic, id: string, title: string, text: string, evidenceIds: readonly string[],
  details: Pick<AccountReading, "kind" | "limit" | "question" | "period"> = { kind: "source-summary" }): AccountReading =>
  ({ topic, id, title, text, evidenceIds, ...details });
const NOTES: readonly AccountReading[] = [
  reading("overview", "reinvestment-compute-health", "Reinvestment, research computing and a planned health-data partnership.",
    "The retained sources connect education and workforce priorities with statewide AI computing and academic-health research. These are distinct initiatives with different funding and operating boundaries.",
    ["evidence_a9d8e80afbb470e3a5a3", "evidence_bf6c043eac847f7183e3", "evidence_580385fbb8754676fa3d"], { kind: "interpretation" }),
  reading("overview", "student-research-engagement", "Student success, research and meaningful engagement.",
    "The campus strategy links student outcomes, research and scholarship, and statewide engagement. MizzouForward describes a 10-year effort across faculty excellence, infrastructure growth and student success.",
    ["mu_evidence_3_1", "mu_evidence_4_1"], { kind: "interpretation" }),
  reading("priorities", "strategic-reinvestment", "Strategic reinvestment",
    "A three-year reinvestment process spans engineering, artificial intelligence, behavioral health, civic engagement education, biotechnology, and nursing and simulation programs.",
    ["evidence_a9d8e80afbb470e3a5a3", "evidence_57ea55e4883fc4627b20"],
    { kind: "source-summary", limit: "Reallocation requirements describe an institutional plan, not an available purchasing budget.", question: "Which reinvestment commitments have been implemented, and what restrictions remain on their use?" }),
  reading("priorities", "responsible-ai-workforce", "Responsible AI workforce",
    "The plan describes interdisciplinary training in AI, machine learning, cybersecurity, healthcare and autonomous systems. The Year Two report describes a roughly 12-month hiring cycle and a competitive AI talent market that refined the staffing plan.",
    ["evidence_aa06c442d08aad5c8cb8", "evidence_c0bc6cf74d035bc8e08a", "evidence_2e20762caf4b11701059"],
    { kind: "source-summary", limit: "Training and staffing intentions do not establish present delivery capacity.", question: "What is the current delivery and staffing status of the Responsible AI workforce program?" }),
  reading("priorities", "redtail-access", "Redtail · statewide AI computing",
    "The retained operating description presents Redtail as a statewide resource for higher education, state organizations and the commercial sector, including advanced computing, training and support.",
    ["evidence_ac0312bff8c47c1fdd71"],
    { kind: "source-summary", limit: "Undated operating description; current access, service readiness and support arrangements need rechecking.", question: "Who can access Redtail today, under which service and support arrangements?" }),
  reading("priorities", "health-ai-vault", "Utah Health AI Vault · planned partnership",
    "UHAIV is described as a system to be developed and housed at the university, joining Huntsman Cancer Institute, the Utah Population Database and CHPC. The source separately reports $18.6 million for the system and another $15 million for a data center and broader AI ecosystem.",
    ["evidence_580385fbb8754676fa3d", "evidence_5c9bdebcc492d29c0154"],
    { kind: "source-summary", limit: "Planned stage in an undated source. These funding categories are not a remaining solution budget.", question: "What are UHAIV’s current development stage, data-access rules and responsibilities across the partners?" }),
  reading("priorities", "student-success", "Student success",
    "The strategic plan sets goals for graduation and retention, career success, high-impact practices, and applications for awards and fellowships.", ["mu_evidence_3_2"],
    { kind: "source-summary", limit: "Goals are not measured achievements; retained dashboard values were not verified.", question: "What do the current student-success measures show, and which goals need attention?" }),
  reading("priorities", "research-scholarship", "Research & scholarship",
    "The plan aims to increase research expenditures, support graduate student research funding and prioritize MizzouForward for faculty development and scholarship.", ["mu_evidence_3_3"],
    { kind: "source-summary", limit: "Stated objectives do not establish expenditure levels or completion status." }),
  reading("priorities", "meaningful-engagement", "Meaningful engagement",
    "The plan sets goals for agricultural and economic programs through sustainability, education and rural medicine expansion.", ["mu_evidence_3_4"]),
  reading("priorities", "mizzouforward", "MizzouForward",
    "A described 10-year effort combines faculty development and recruitment with research spaces, instrumentation and student success. Faculty excellence, infrastructure growth and student success are its stated focus areas.", ["mu_evidence_4_1"],
    { kind: "source-summary", limit: "The retained description does not establish start/end dates, current milestones or funds remaining.", question: "Which MizzouForward investments are in delivery, and what are their current milestones and responsibilities?" }),
  reading("people", "chpc", "CHPC · research computing",
    "The source says the Center for High Performance Computing will manage Redtail. This is an operating function in the university with a statewide resource remit.", ["evidence_bf6c043eac847f7183e3"],
    { kind: "source-summary", limit: "Future-tense, undated source wording; no individual buying owner is established." }),
  reading("people", "health-data-partners", "Health-data collaboration",
    "The UHAIV description connects Huntsman Cancer Institute, the Utah Population Database and CHPC. These partners bring different research, data and computing functions to the planned system.", ["evidence_580385fbb8754676fa3d"],
    { kind: "source-summary", limit: "A named partnership does not establish access rights, reporting lines or purchasing authority." }),
  reading("people", "public-governance", "Board and public role context",
    "The June 2026 Board minutes record Tony Wagner presenting the university’s plan, with Chair Covington and Vice Chair Cox involved in the approval motion.", ["evidence_3f23e25a0705202a9dde", "evidence_8598ede0df66bb13f65d"],
    { kind: "source-summary", limit: "Historical participation does not establish current roles or initiative ownership." }),
  reading("people", "academic-health", "University and academic health",
    "The FY2025 audit describes University of Utah Health (Hospitals and Clinics) as a department of the university and identifies related component units audited by other auditors.", ["evidence_623311c9e376816166e4"],
    { kind: "source-summary", limit: "Financial reporting relationships do not establish a single operating budget or procurement owner." }),
  reading("people", "public-presidency", "Public role context · presidency",
    "The FY2025 audit report is addressed to the Board of Trustees, Audit Committee and Dr. Taylor R. Randall, President of the University of Utah.", ["evidence_623311c9e376816166e4"],
    { kind: "source-summary", limit: "A role named in a historical report is not current role confirmation or evidence of buying ownership." }),
  reading("people", "system-shared-services", "UM System · shared services",
    "The system central office describes centralized payroll, benefits management and IT support for its campuses. Mizzou / Columbia is one campus in the four-campus system.", ["mu_evidence_5_1", "mu_evidence_5_2"],
    { kind: "source-summary", limit: "Systemwide services are related context; they do not establish campus procurement or decision authority.", question: "How are campus and UM System service responsibilities divided, and which public roles are current?" }),
  reading("technology", "redtail-platform", "Redtail · HPE & NVIDIA",
    "The public-private partnership description names HPE supercomputing infrastructure and NVIDIA technologies. The operating source describes high-end GPU computing managed by CHPC.", ["evidence_91e8773cb89195d27431", "evidence_bf6c043eac847f7183e3"],
    { kind: "source-summary", limit: "Undated retained material. This establishes a described platform, not current capacity, vendor preference or the whole campus technology estate.", question: "What does the current service catalog cover beyond research computing, including support and data governance?" }),
  reading("technology", "health-data-system", "Health-data system & infrastructure",
    "The planned UHAIV system concerns data in the Utah Population Database and health research expertise. The accompanying data-center and broader AI ecosystem investment is described separately.", ["evidence_580385fbb8754676fa3d", "evidence_5c9bdebcc492d29c0154"],
    { kind: "source-summary", limit: "No current clinical deployment, data-access entitlement or complete technology inventory is established." }),
  reading("technology", "research-infrastructure", "Research infrastructure",
    "MizzouForward lists core facility upgrades, high-performance computing and clinical research support as infrastructure investment areas.", ["mu_evidence_4_1", "mu_evidence_4_2"],
    { kind: "source-summary", limit: "Investment areas, not a confirmed installed platform or live service capacity.", question: "What does the current service catalog establish about research-computing platforms, support, access and data governance?" }),
  reading("technology", "learning-environments", "Classrooms, labs & learning software",
    "MizzouForward includes classroom and laboratory upgrades and new software intended to enhance classroom experiences and student learning.", ["mu_evidence_4_3"],
    { kind: "source-summary", limit: "No software products, incumbent stack, rollout dates or campus-wide coverage are established." }),
  reading("discoveries", "year-two-approval", "Year Two plan approval recorded",
    "The Board minutes record approval of the university’s Year Two Strategic Reinvestment Plan on June 11, 2026.", ["evidence_8598ede0df66bb13f65d"],
    { kind: "source-summary", period: "June 11, 2026 · source-reported event", limit: "Plan approval is not evidence that implementation outcomes occurred." }),
  reading("discoveries", "sponsored-awards", "FY2025 sponsored awards",
    "The source reports $781.9 million in new award funding for sponsored activities for the year ending June 30, 2025, and a 13% increase over the prior year.", ["evidence_dfb5413c39af688b6fbf"],
    { kind: "source-summary", period: "FY2025 · source-reported comparison", limit: "Sponsored awards are not spend, available budget or consolidated university finances. This is a historical comparison in the source, not a change since an account review." }),
  reading("discoveries", "strategy-launch", "Strategic plan launch reported",
    "The retained strategy page reports a September 2024 launch with Board of Curators approval, organized around student success, research and scholarship, and meaningful engagement.", ["mu_evidence_3_1"],
    { kind: "source-summary", period: "September 2024 · date stated in source text", limit: "Publication and update dates remain unknown. Acquisition in September 2026 does not make this a new development." }),
  reading("hypotheses", "workforce-enablement", "Responsible-AI workforce enablement",
    "Training delivery and AI teaching or productivity support may be useful areas to investigate alongside the workforce plan and stated hiring constraints.", ["evidence_aa06c442d08aad5c8cb8", "evidence_2e20762caf4b11701059"],
    { kind: "hypothesis", limit: "Unvalidated: establish a present delivery constraint and relevant service scope before prioritizing a use case." }),
  reading("hypotheses", "research-compute-enablement", "Research-computing enablement",
    "Access, training and support may be relevant areas to investigate around the statewide computing remit.", ["evidence_ac0312bff8c47c1fdd71", "evidence_bf6c043eac847f7183e3"],
    { kind: "hypothesis", limit: "Unvalidated: the retained remit is not proof of unmet need, product fit or an active project." }),
  reading("hypotheses", "health-data-governance", "Health-data governance",
    "The planned UHAIV partnership may make data-access and governance responsibilities useful areas to investigate across the research, database and computing functions.", ["evidence_580385fbb8754676fa3d"],
    { kind: "hypothesis", limit: "Unvalidated: the source establishes neither a governance gap nor a need for a specific solution." }),
  reading("hypotheses", "student-support-workflows", "Student-support workflows",
    "Student-support workflows may be worth investigating against the stated graduation, retention and career-success objectives.", ["mu_evidence_3_2", "mu_evidence_4_3"],
    { kind: "hypothesis", limit: "Unvalidated: a measurable service or delivery constraint is needed before prioritizing an opportunity." }),
  reading("hypotheses", "research-services", "Research-computing support",
    "Research-computing enablement may align with the stated infrastructure and scholarship priorities.", ["mu_evidence_3_3", "mu_evidence_4_2"],
    { kind: "hypothesis", limit: "Unvalidated: establish current services and an unmet need; an investment area does not establish a buying project." }),
];

const PASSAGES = [
  { id: "public-leadership", title: "Public leadership · President Mun Choi", sourceId: "mu_source_1",
    sha256: "ded3728beff58fe4de550dd2c72887f56ce39b0c73b786e062fd0fa7b4f79e8c",
    exactText: "Led by President Mun Choi, our leadership team includes a collaborative cabinet of proven leaders responsible for setting strategies toward fostering a premier educational environment.",
    limit: "Public role context in the retained About page, outside the selected proposal. Current role confirmation and initiative responsibilities are not established." },
  { id: "research-support-functions", title: "Research support functions", sourceId: "mu_source_4",
    sha256: "acec854c51085603802f9beff2eaaa6e191f509716191b1420f41208f9b55598",
    exactText: "- Support for proposal development, including pre-award and post-award services.",
    limit: "A described support area in MizzouForward, outside the selected proposal; staffing, service availability and owners remain unverified." },
] as const;
const hash = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

/** Fail closed on changed/missing anchors. A source label alone can never activate authored prose. */
export function projectAccount(frozen: FrozenC3ViewContext): AccountProjection {
  const sources = frozen.context.admittedSources;
  const fingerprints = new Map(sources.map(source => [source.sourceId, hash(JSON.stringify([
    source.retrievedContentSha256, source.entity.entityId, source.canonicalUrl,
    source.publicationDate, source.eventDate, source.evidenceCurrentThrough,
  ]))] as const));
  const byEvidence = new Map(sources.filter(source => !source.untrustedInstructionsDetected).flatMap(source =>
    source.excerpts.map(excerpt => [excerpt.evidenceId, { source, excerpt }] as const)));
  const readings = NOTES.filter(note => note.evidenceIds.every(id => {
    const binding = ACCOUNT_READING_ANCHORS[id];
    const retained = byEvidence.get(id);
    return binding && retained && retained.source.sourceId === binding.sourceId &&
      fingerprints.get(binding.sourceId) === binding.sourceFingerprint &&
      retained.excerpt.sourceId === binding.sourceId && retained.excerpt.exactExcerptSha256 === binding.sha256 &&
      hash(retained.excerpt.exactExcerpt) === binding.sha256 &&
      retained.source.fullBoundedCleanText.slice(retained.excerpt.sourceCharStart, retained.excerpt.sourceCharEnd) === retained.excerpt.exactExcerpt;
  }));
  const passages = PASSAGES.flatMap(passage => {
    const source = sources.find(item => item.sourceId === passage.sourceId && !item.untrustedInstructionsDetected &&
      Object.values(ACCOUNT_READING_ANCHORS).some(anchor => anchor.sourceId === item.sourceId && anchor.sourceFingerprint === fingerprints.get(item.sourceId)) &&
      item.retrievedContentSha256 === passage.sha256 && hash(item.fullBoundedCleanText) === passage.sha256 && item.fullBoundedCleanText.includes(passage.exactText));
    return source ? [{ id: passage.id, title: passage.title, source, exactText: passage.exactText, limit: passage.limit }] : [];
  });
  const used = new Set(readings.flatMap(note => note.evidenceIds.map(id => byEvidence.get(id)!.source.sourceId)));
  passages.forEach(passage => used.add(passage.source.sourceId));
  return deepFreezeOwnData({ readings: readings.map(note => ({ ...note, evidenceIds: [...note.evidenceIds] })), passages,
    unmatchedSourceIds: sources.filter(source => !used.has(source.sourceId)).map(source => source.sourceId) });
}
