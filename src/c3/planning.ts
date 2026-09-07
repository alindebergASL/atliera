/** Session planning is deliberately separate from recorded model requests and account truth. */
export type PlanningKind = "strategy" | "next-steps";
export interface PlanningSection {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly authorship: "template" | "user";
}
export interface ProposedNextStep {
  readonly concern: string;
  readonly action: string;
  readonly owner: string;
  readonly targetDate: string;
  readonly questionOrBlocker: string;
  readonly evidenceIds: readonly string[];
}
export interface PlanningBrief {
  readonly proposedNextStep?: ProposedNextStep;
  readonly kind: PlanningKind;
  readonly version: number;
  readonly audience: string;
  readonly intendedOutcome: string;
  readonly detail: string;
  readonly sections: readonly PlanningSection[];
}
export const MEETING_NOTE_SECTIONS = ["Situation for this audience", "Opening", "Questions", "Useful close"] as const;
export type SectionNotes = Readonly<Record<string, string>>;

export function newPlanningBrief(kind: PlanningKind): PlanningBrief {
  const rows = kind === "strategy" ? [
    ["direction", "Direction to explore", "Use the proposed account orientation alongside this brief as a starting hypothesis. Confirm the audience’s priority and what evidence would change it."],
    ["options", "Options and tradeoffs", "Compare a small investigation, a bounded pilot, and waiting for better evidence. For each, identify expected learning, effort, constraints, and a reason to stop. No option is selected yet."],
    ["decision", "Decision and validation", "Identify who can judge the options. Agree the evidence needed, the decision criterion, and a review date. Authority and commitment remain unconfirmed."],
  ] : [
    ["actions", "Proposed actions", "1. Confirm the highest-priority open question in the account context alongside this brief.\n2. Identify the person who can resolve it.\n3. Bring the answer and supporting evidence to a follow-up. These are proposed actions, not commitments."],
    ["owners", "Owners and dependencies", "For each action, record a proposed owner, dependency, and target date. Confirm willingness and authority before treating anyone as assigned. Owners and dates are unconfirmed."],
    ["checkpoint", "Completion and follow-up", "Define what an adequate answer looks like, where it will be reviewed, and when to revisit unresolved items. No outreach, assignment, or scheduling has occurred."],
  ];
  return { kind, version: 0, audience: "", intendedOutcome: "", detail: "",
    sections: rows.map(([id, title, text]) => ({ id: id!, title: title!, text: text!, authorship: "template" })) };
}

export function boundedPlanningText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) {
    throw new Error("Invalid or oversized session text");
  }
  return value;
}

export function updatePlanningBrief(brief: PlanningBrief, value: unknown, knownEvidenceIds: readonly string[] = []): { brief: PlanningBrief; noChange: boolean } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid planning edit");
  const body = value as Record<string, unknown>;
  if (body.version !== brief.version) throw new Error("Displayed planning version is stale. Reopen the brief before saving; copy your unsaved text first.");
  let changed: PlanningBrief;
  if (Object.keys(body).sort().join(",") === "section,text,version") {
    const section = brief.sections.find((item) => item.id === body.section);
    if (!section) throw new Error("Unknown planning section");
    const text = boundedPlanningText(body.text, 4000);
    if (text === section.text) return { brief, noChange: true };
    changed = { ...brief, sections: brief.sections.map((item) => item === section ? { ...item, text, authorship: "user" } : item) };
  } else if (Object.keys(body).sort().join(",") === "audience,detail,intendedOutcome,version") {
    const audience = boundedPlanningText(body.audience, 160);
    const intendedOutcome = boundedPlanningText(body.intendedOutcome, 500);
    const detail = boundedPlanningText(body.detail, 500);
    if (!audience.trim() || !intendedOutcome.trim()) throw new Error("Audience and intended outcome are required");
    if (audience === brief.audience && intendedOutcome === brief.intendedOutcome && detail === brief.detail) return { brief, noChange: true };
    changed = { ...brief, audience, intendedOutcome, detail };
  } else if (Object.keys(body).sort().join(",") === "proposedNextStep,version") {
    if (brief.kind !== "next-steps") throw new Error("Proposed next step requires the next-steps brief");
    const raw = body.proposedNextStep;
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        Object.keys(raw).sort().join(",") !== "action,concern,evidenceIds,owner,questionOrBlocker,targetDate") throw new Error("Invalid proposed next step fields");
    const value = raw as Record<string, unknown>;
    const concern = boundedPlanningText(value.concern, 2000);
    const action = boundedPlanningText(value.action, 4000);
    const owner = boundedPlanningText(value.owner, 160);
    const targetDate = boundedPlanningText(value.targetDate, 10);
    const questionOrBlocker = boundedPlanningText(value.questionOrBlocker, 2000);
    if (!concern.trim() || !action.trim()) throw new Error("Concern and action are required");
    if (targetDate !== "" && (!/^\d{4}-\d{2}-\d{2}$/u.test(targetDate) ||
        !Number.isFinite(Date.parse(targetDate)) || new Date(targetDate).toISOString().slice(0, 10) !== targetDate)) throw new Error("Target date must be a real ISO YYYY-MM-DD date or blank");
    const ids = value.evidenceIds;
    if (!Array.isArray(ids) || ids.length > 32 || new Set(ids).size !== ids.length ||
        ids.some((id) => typeof id !== "string" || !id.length || id.length > 256 || !knownEvidenceIds.includes(id))) throw new Error("Evidence must use unique known account evidence IDs (maximum 32)");
    const proposedNextStep: ProposedNextStep = { concern, action, owner, targetDate, questionOrBlocker, evidenceIds: [...ids] };
    if (JSON.stringify(proposedNextStep) === JSON.stringify(brief.proposedNextStep)) return { brief, noChange: true };
    changed = { ...brief, proposedNextStep };
  } else throw new Error("Invalid planning fields");
  return { brief: { ...changed, version: brief.version + 1 }, noChange: false };
}
