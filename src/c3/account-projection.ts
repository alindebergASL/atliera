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
export interface AccountDetailSection {
  readonly title: string;
  readonly evidenceId: string;
  readonly sourceId: string;
  readonly exactText: string;
  /** Bound presentation summary, distinct from the immutable quotation. */
  readonly summary?: string;
}
export interface AccountDetail {
  readonly readingId: string;
  readonly sections: readonly AccountDetailSection[];
}
export interface AccountProjection {
  readonly presentation?: { readonly illustration: { readonly src: string; readonly alt: string; readonly caption: string } };
  /** Exact existing proposal prose, not newly authored account readings. */
  readonly retainedSections: readonly { readonly id: string; readonly title: string; readonly text: string; readonly state: string; readonly evidenceIds: readonly string[] }[];
  readonly details: readonly AccountDetail[];
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
    "The plan sets goals for Missouri’s agricultural and economic programs through sustainability, education and rural medicine expansion.", ["mu_evidence_3_4"],
    { kind: "source-summary", limit: "Stated goals in an undated strategy page; delivery, funding and current status are not established." }),
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
    { kind: "source-summary", limit: "Undated retained material. This establishes a described platform, not current capacity, vendor preference or the whole campus technology estate.", question: "What research-computing services, support and data-governance arrangements are currently offered, if any?" }),
  reading("technology", "health-data-system", "Health-data system & infrastructure",
    "The planned UHAIV system concerns data in the Utah Population Database and health research expertise. The accompanying data-center and broader AI ecosystem investment is described separately.", ["evidence_580385fbb8754676fa3d", "evidence_5c9bdebcc492d29c0154"],
    { kind: "source-summary", limit: "No current clinical deployment, data-access entitlement or complete technology inventory is established." }),
  reading("technology", "research-infrastructure", "Research infrastructure",
    "MizzouForward lists core facility upgrades, high-performance computing and clinical research support as infrastructure investment areas.", ["mu_evidence_4_1", "mu_evidence_4_2"],
    { kind: "source-summary", limit: "Investment areas, not a confirmed installed platform or live service capacity.", question: "What research-computing services, support and data-governance arrangements are currently offered, if any?" }),
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
// Presentation selections from immutable evidence anchors. These add retained scope,
// milestones and roles; they do not create new claim notes or source identities.
type DetailSelection = readonly [title: string, evidenceId: string, from?: string, until?: string];
const DETAIL_SELECTIONS: Readonly<Record<string, readonly DetailSelection[]>> = {
  'responsible-ai-workforce': [['Training scope','evidence_aa06c442d08aad5c8cb8'],['Hiring cycle and early use of funds','evidence_2e20762caf4b11701059']],
  'health-ai-vault': [['Planned system and partners','evidence_580385fbb8754676fa3d'],['Separate infrastructure investment','evidence_5c9bdebcc492d29c0154']],
  'health-data-system': [['Planned system and partners','evidence_580385fbb8754676fa3d'],['Separate infrastructure investment','evidence_5c9bdebcc492d29c0154']],
  'student-success': [['Stated goals','mu_evidence_3_2'],['Named learning investments','mu_evidence_4_3']],
  'research-scholarship': [['Research objectives','mu_evidence_3_3'],['Named infrastructure areas','mu_evidence_4_2']],
  'meaningful-engagement': [['Outreach and engagement goals','mu_evidence_3_4']],
  'system-shared-services': [['System scope','mu_evidence_5_1'],['Centralized functions','mu_evidence_5_2']],
  'learning-environments': [['Named learning investments','mu_evidence_4_3']],
  'public-governance': [['Recorded participation','evidence_3f23e25a0705202a9dde'],['Approval motion','evidence_8598ede0df66bb13f65d']],
  'strategic-reinvestment': [
    ['Program allocations over three years', 'evidence_a9d8e80afbb470e3a5a3'],
    ['Legislative requirement and share', 'evidence_57ea55e4883fc4627b20'],
    ['Reallocation milestones', 'evidence_1022aa3b977809d3004e'],
    ['Recorded approval', 'evidence_8598ede0df66bb13f65d'],
  ],
  'redtail-access': [
    ['Who the resource is for', 'evidence_ac0312bff8c47c1fdd71'],
    ['Management and investment period', 'evidence_bf6c043eac847f7183e3'],
    ['Described model-computing scope', 'evidence_ea94995bdcd28e1409d3'],
  ],
  'chpc': [
    ['Management and investment period', 'evidence_bf6c043eac847f7183e3'],
    ['Organizations served', 'evidence_ac0312bff8c47c1fdd71'],
    ['Health-data partnership', 'evidence_580385fbb8754676fa3d'],
  ],
  'redtail-platform': [
    ['Platform and partnership', 'evidence_91e8773cb89195d27431'],
    ['Multi-server and GPU scope', 'evidence_ea94995bdcd28e1409d3'],
    ['Management and investment period', 'evidence_bf6c043eac847f7183e3'],
  ],
  'health-data-partners': [
    ['Partner roles and planned system', 'evidence_580385fbb8754676fa3d'],
    ['Separate infrastructure investment', 'evidence_5c9bdebcc492d29c0154'],
  ],
  'public-presidency': [
    ['Addressees and reporting period', 'evidence_623311c9e376816166e4', 'To the Board of Trustees', ' In our opinion,'],
    ['University and related reporting scope', 'evidence_623311c9e376816166e4', 'We did not audit', ' Those statements were audited'],
  ],
  'academic-health': [
    ['Department and component units', 'evidence_623311c9e376816166e4', 'We did not audit', ' Those statements were audited'],
    ['Audit responsibility', 'evidence_623311c9e376816166e4', 'Those statements were audited', ' These reports represent'],
  ],
  'mizzouforward': [
    ['Ten-year effort and focus areas', 'mu_evidence_4_1'],
    ['Research facilities and support', 'mu_evidence_4_2'],
    ['Student learning investments', 'mu_evidence_4_3'],
  ],
  'research-infrastructure': [
    ['Ten-year effort and focus areas', 'mu_evidence_4_1'],
    ['Research facilities and support', 'mu_evidence_4_2'],
    ['Research and scholarship objectives', 'mu_evidence_3_3'],
  ],
};
// These summaries activate only after the same exact evidence/source/date/scope bindings
// as the retained passage. They are presentation notes, never admitted claims or model inputs.
const DETAIL_SUMMARIES: Readonly<Record<string, string>> = {
  evidence_aa06c442d08aad5c8cb8: 'The training plan names AI, machine learning, cybersecurity, healthcare and autonomous systems, framed around technology, ethics and innovation. It describes workforce preparation rather than measured delivery outcomes.',
  evidence_2e20762caf4b11701059: 'The report describes a roughly twelve-month faculty hiring cycle. Early funds supported one-time AI teaching and productivity resources, while competition for AI talent refined the staffing plan. It does not give a current staffed capacity.',
  evidence_3f23e25a0705202a9dde: 'Tony Wagner presented the plan and answered Board questions, including questions about AI. This establishes participation at that meeting, not a current operating role or buying authority.',
  evidence_dfb5413c39af688b6fbf: 'The reported measure is new sponsored-activity award funding for the fiscal year ending June 30, 2025: $781.9 million, up 13% from the preceding year. The passage supplies no remaining balance or expenditure measure.',
  mu_evidence_3_1: 'The page reports Board of Curators approval and a September 2024 launch. It organizes the strategy around student success, research and scholarship, and meaningful engagement; the launch date does not date current progress.',
  mu_evidence_3_2: 'Nine stated goals cover graduation and retention, career outcomes, participation in high-impact practices, and applications for awards and fellowships. The passage names measurement areas but provides no achieved values.',
  mu_evidence_3_4: 'Eight stated goals concern Missouri agricultural and economic programs through sustainability, education and rural medicine expansion. Delivery status, responsible teams and funding are not specified in this passage.',
  mu_evidence_5_1: 'The system includes Columbia, Kansas City, Missouri S&T and St. Louis campuses alongside statewide health care, research parks, agricultural research and extension networks. This is system scope, not a list of campus-owned services.',
  mu_evidence_5_2: 'The central office names payroll, benefits management and IT support as centralized functions. Its stated aim is to reduce service duplication and free campus resources for teaching and research; it does not assign individual decision rights.',
  evidence_a9d8e80afbb470e3a5a3: 'The three-year allocations include $4.95 million for engineering, $4.94 million for AI and $3.5 million for behavioral health, alongside civic engagement education, biotechnology, nursing and simulation. These are separate program allocations.',
  evidence_1022aa3b977809d3004e: 'USHE requires degree-granting institutions to reallocate at least 30% of the equivalent funding in FY 2026, 70% in FY 2027 and 100% in FY 2028 to recover set-aside funds. These are system requirements applying to the U, not confirmation of completion.',
  evidence_8598ede0df66bb13f65d: 'The retained minutes record approval of the Year Two plan: Chair Covington moved approval, Vice Chair Cox seconded, and members present voted unanimously. This records a decision, not subsequent delivery.',
  evidence_ac0312bff8c47c1fdd71: 'The described audience spans Utah higher education, state organizations and the commercial sector. Computing access, training and support are named together; present eligibility and availability are not confirmed.',
  evidence_bf6c043eac847f7183e3: 'The source assigns future management to the University of Utah’s Center for High Performance Computing. It describes $50 million of public and private investment over five years; this is an investment period, not an available purchasing balance.',
  evidence_ea94995bdcd28e1409d3: 'The named partners are the State of Utah, the university and Huntsman Family Foundation. The described computing scope includes training, applying and scaling large AI models across multiple servers and GPUs.',
  evidence_91e8773cb89195d27431: 'The @theU article describes a $50 million public-private partnership using HPE supercomputing infrastructure and NVIDIA technologies, including an HPE Cray system. The passage does not establish current service access or procurement needs. Both retained Redtail passages describe a $50 million total; the retained text does not establish that these are separate amounts.',
  evidence_580385fbb8754676fa3d: 'The planned UHAIV system links Huntsman Cancer Institute, the Utah Population Database and CHPC at the university. The source reports $18.6 million under a 2026 funding bill and describes development and hosting in future tense.',
  evidence_5c9bdebcc492d29c0154: 'A separate $15 million is described for a new data center and the broader AI ecosystem. Keep this infrastructure allocation distinct from the UHAIV system funding.',
  mu_evidence_4_1: 'The stated ten-year effort covers faculty and staff development, faculty recruitment, research spaces and instrumentation, among others. Its three focus areas are faculty excellence, infrastructure growth and student success; current milestones are not supplied.',
  mu_evidence_4_2: 'Named infrastructure areas are core facilities, high-performance computing and clinical research support. The short passage supplies no platform inventory, delivery timetable or operating owner.',
  mu_evidence_4_3: 'The student-learning scope names classroom and lab upgrades and software for classroom experiences. It does not name products, budgets or a rollout stage.',
  mu_evidence_3_3: 'The strategic objective connects higher research expenditures and graduate research funding with MizzouForward faculty development and scholarship. These are goals; achieved expenditure or delivery levels are not given.',
};
const AUDIT_DETAIL_SUMMARIES: Readonly<Record<string, string>> = {
  'Addressees and reporting period': 'The FY2025 report addresses the Board of Trustees, Audit Committee and Dr. Taylor R. Randall as university president. These are the report’s historical addressees, not a current-role verification.',
  'University and related reporting scope': 'The audit distinguishes the university from University of Utah Health (Hospitals and Clinics) and named blended component units whose statements were audited separately. Reporting scope does not establish operational or purchasing authority.',
  'Department and component units': 'The report calls University of Utah Health (Hospitals and Clinics) a university department and separately lists ARUP, the research foundation, health insurance plans, Community Nursing Service and the medical-school endowment among blended component units.',
  'Audit responsibility': 'Other auditors audited those financial statements. The report distinguishes that audit responsibility from its own; it does not describe a common procurement owner.',
};
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
  const boundEvidence = (id: string): boolean => {
    const binding = ACCOUNT_READING_ANCHORS[id];
    const retained = byEvidence.get(id);
    return !!binding && !!retained && retained.source.sourceId === binding.sourceId &&
      fingerprints.get(binding.sourceId) === binding.sourceFingerprint &&
      retained.excerpt.sourceId === binding.sourceId && retained.excerpt.exactExcerptSha256 === binding.sha256 &&
      hash(retained.excerpt.exactExcerpt) === binding.sha256 &&
      retained.source.fullBoundedCleanText.slice(retained.excerpt.sourceCharStart, retained.excerpt.sourceCharEnd) === retained.excerpt.exactExcerpt;
  };
  const readings = NOTES.filter(note => note.evidenceIds.every(boundEvidence));
  const details = readings.map(note => ({ readingId: note.id, sections: (DETAIL_SELECTIONS[note.id] ?? note.evidenceIds.map(id => ["Retained source passage", id] as const)).flatMap(selection => {
    const [title, id, from, until] = selection as DetailSelection;
    if (!boundEvidence(id)) return [];
    const {source, excerpt} = byEvidence.get(id)!;
    const start = from ? excerpt.exactExcerpt.indexOf(from) : 0;
    const end = until ? excerpt.exactExcerpt.indexOf(until, Math.max(start, 0)) : excerpt.exactExcerpt.length;
    if (start < 0 || end <= start) return [];
    const exactText = excerpt.exactExcerpt.slice(start, end);
    // Standalone heading anchors stay with the full evidence, not as empty detail sections.
    return exactText.length < 35 ? [] : [{ title, evidenceId: id, sourceId: source.sourceId, exactText, ...(id === 'evidence_623311c9e376816166e4' && AUDIT_DETAIL_SUMMARIES[title] ? {summary:AUDIT_DETAIL_SUMMARIES[title]} : !from && !until && DETAIL_SUMMARIES[id] ? { summary: DETAIL_SUMMARIES[id] } : {}) }];
  }) }));
  const passages = PASSAGES.flatMap(passage => {
    const source = sources.find(item => item.sourceId === passage.sourceId && !item.untrustedInstructionsDetected &&
      Object.values(ACCOUNT_READING_ANCHORS).some(anchor => anchor.sourceId === item.sourceId && anchor.sourceFingerprint === fingerprints.get(item.sourceId)) &&
      item.retrievedContentSha256 === passage.sha256 && hash(item.fullBoundedCleanText) === passage.sha256 && item.fullBoundedCleanText.includes(passage.exactText));
    return source ? [{ id: passage.id, title: passage.title, source, exactText: passage.exactText, limit: passage.limit }] : [];
  });
  const used = new Set(readings.flatMap(note => note.evidenceIds.map(id => byEvidence.get(id)!.source.sourceId)));
  passages.forEach(passage => used.add(passage.source.sourceId));
  details.forEach(detail => detail.sections.forEach(section => used.add(section.sourceId)));
  const proposal = frozen.context.proposal;
  const retainedSections = readings.length ? [] : [
    ...proposal.establishedContext.map((item, index) => ({ ...item, id: `retained-context-${index + 1}`, title: `Retained context ${index + 1}` })),
    ...proposal.meaningfullyChanged.map((item, index) => ({ ...item, id: `retained-development-${index + 1}`, title: `Reported development ${index + 1}` })),
    ...proposal.whyChangeMayMatter.map((item, index) => ({ ...item, id: `retained-interpretation-${index + 1}`, title: `Proposed interpretation ${index + 1}` })),
    ...proposal.stillOpenQuestions.map((item, index) => ({ ...item, id: `retained-question-${index + 1}`, title: `Open question ${index + 1}` })),
  ].filter(item => item.evidenceIds.length > 0 && item.evidenceIds.every(id => {
    const retained = byEvidence.get(id);
    return retained && retained.excerpt.sourceId === retained.source.sourceId &&
      hash(retained.excerpt.exactExcerpt) === retained.excerpt.exactExcerptSha256 &&
      retained.source.fullBoundedCleanText.slice(retained.excerpt.sourceCharStart, retained.excerpt.sourceCharEnd) === retained.excerpt.exactExcerpt;
  }));
  // Optional account presentation, never evidence or a renderer account-name branch.
  const presentation = frozen.context.account.accountId === 'acc_university_of_utah' ? {
    illustration: { src: '/assets/campus-concept.png', alt: 'Illustrative University of Utah campus concept', caption: 'Campus illustration · not a documented photograph' },
  } : undefined;
  return deepFreezeOwnData({ presentation, retainedSections, details, readings: readings.map(note => ({ ...note, evidenceIds: [...note.evidenceIds] })), passages,
    unmatchedSourceIds: sources.filter(source => !used.has(source.sourceId)).map(source => source.sourceId) });
}
