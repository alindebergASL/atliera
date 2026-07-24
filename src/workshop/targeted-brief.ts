import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { parseGraphBundle } from "../graph/schema.ts";
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
export type TargetedBriefInputClass = "committed_fixture";
export type TargetedBriefSectionKey = "signals" | "maps" | "plays";
export type TargetedBriefGapReason =
  | "selected_target_not_supported"
  | "unsupported_claim_rejected"
  | "trust_not_ready"
  | "missing_accepted_evidence"
  | "record_not_active"
  | "accepted_contradiction";

export interface TargetedBriefSelection {
  readonly governance: "human_selected";
  readonly account_object_ids: readonly string[];
}

export interface TargetedCisoMeetingRequest {
  readonly kind: "ciso_meeting";
  readonly account_id: string;
  readonly meeting: {
    readonly audience: string;
    readonly objective: string;
  };
  readonly selection: TargetedBriefSelection;
}

export type TargetedRfxResponseType = "proposal" | "RFI" | "RFP";

export interface TargetedProposalRfxRequest {
  readonly kind: "proposal_rfx";
  readonly account_id: string;
  readonly response: {
    readonly type: TargetedRfxResponseType;
    readonly requirement_context: string;
    readonly objective: string;
  };
  readonly selection: TargetedBriefSelection;
}

export type TargetedBriefRequest = TargetedCisoMeetingRequest | TargetedProposalRfxRequest;

export interface TargetedBriefTargetRelevance {
  readonly status: "caller_workflow_context_only";
  readonly evidence_gap: string;
}

export interface TargetedBriefPairRequest {
  readonly ciso_meeting: TargetedCisoMeetingRequest;
  readonly proposal_rfx: TargetedProposalRfxRequest;
}

export interface TargetedBriefInputIdentity {
  readonly class: TargetedBriefInputClass;
  readonly ref: string;
  readonly sha256: string;
  readonly byte_length: number;
  readonly validation: "passed";
}

/**
 * An opaque capability returned only after repository-relative fixture bytes
 * have been read, parsed, and validated. The visible identity is informational;
 * builders also require the exact registered object identity.
 */
export interface LoadedTargetedBriefFixture {
  readonly input: TargetedBriefInputIdentity;
}

export interface TargetedBriefEvidenceReference {
  readonly relationship: "supports" | "contradicts";
  readonly claim: Pick<
    Claim,
    "id" | "text" | "claim_type" | "confidence" | "provenance_status" | "status"
  >;
  readonly excerpt: Pick<EvidenceExcerpt, "id" | "text" | "kind" | "validation_status">;
  readonly source: Pick<
    SourceDocument,
    "id" | "title" | "url" | "publisher" | "source_type" | "reliability" | "fetched_at" | "status"
  >;
  readonly evidence_current_through: null;
}

export interface TargetedBriefAssertion {
  readonly id: string;
  readonly section: TargetedBriefSectionKey;
  readonly object_type: AccountObject["object_type"];
  readonly statement: string;
  readonly claim_ids: readonly string[];
  readonly state: "supported" | "contested";
  readonly provenance_status: "verified" | "source_document_only" | "contested";
  readonly trust_label:
    | "Verified"
    | "Source-backed · not independently checked"
    | "Contested · supporting and contradicting evidence";
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
  readonly omitted_item_ids: readonly string[];
  readonly message: string;
  readonly retained_evidence: readonly TargetedBriefEvidenceReference[];
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
  readonly account_id: string;
  readonly target: TargetedBriefRequest;
  readonly target_relevance: TargetedBriefTargetRelevance;
  readonly input: TargetedBriefInputIdentity;
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

export interface TargetedBriefSelectionResult {
  readonly request: TargetedBriefRequest;
  readonly assertions: readonly TargetedBriefAssertion[];
  readonly evidence_gaps: readonly TargetedBriefEvidenceGap[];
}

interface LoadedFixtureState {
  readonly bundle: GraphBundle;
  readonly input: TargetedBriefInputIdentity;
}

interface GapAccumulator {
  readonly itemIds: Set<string>;
  readonly evidenceByKey: Map<string, TargetedBriefEvidenceReference>;
}

const MODULE_REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const loadedFixtureStates = new WeakMap<LoadedTargetedBriefFixture, LoadedFixtureState>();
const renderableBriefs = new WeakSet<TargetedBrief>();

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
    { key: "signals", title: "What changed", purpose: "Selected evidence-backed developments to understand first." },
    { key: "maps", title: "Operating context", purpose: "Selected supported account context for the conversation." },
    { key: "plays", title: "Suggested conversation", purpose: "Selected supported themes to discuss, not automatic actions." },
  ],
  proposal_rfx: [
    { key: "signals", title: "Why now", purpose: "Selected supported developments that may shape the response." },
    { key: "maps", title: "Account context", purpose: "Selected supported context to ground response language." },
    { key: "plays", title: "Response themes", purpose: "Selected evidence-backed themes for human drafting and review." },
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
  selected_target_not_supported:
    "A human-selected workspace object had no factual assertion safe to render; no generic account material was substituted.",
  unsupported_claim_rejected: "Unsupported selected material was omitted rather than presented as fact.",
  trust_not_ready: "Selected material awaiting stronger trust or review was omitted from factual sections.",
  missing_accepted_evidence:
    "A selected claim without accepted active-source supporting evidence was omitted from factual sections.",
  record_not_active: "Inactive, rejected, or superseded selected material was omitted from factual sections.",
  accepted_contradiction:
    "A selected claim was omitted with its accepted contradicting evidence retained for human review.",
};

const GAP_ORDER: readonly TargetedBriefGapReason[] = [
  "selected_target_not_supported",
  "unsupported_claim_rejected",
  "trust_not_ready",
  "missing_accepted_evidence",
  "record_not_active",
  "accepted_contradiction",
];

const TARGET_RELEVANCE_GAP: Record<TargetedBriefKind, string> = {
  ciso_meeting:
    "Evidence gap: the graph supports the selected account facts but does not establish that they are CISO-specific. CISO relevance is caller-provided human workflow context and requires review.",
  proposal_rfx:
    "Evidence gap: the graph supports the selected account facts but does not establish that they satisfy this RFx requirement context. RFx relevance is caller-provided human workflow context and requires review.",
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isContainedPath(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent !== "" && !pathFromParent.startsWith("..") && !isAbsolute(pathFromParent);
}

function assertBoundedCallerText(value: string, field: string, maximumLength = 1_024): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximumLength ||
    /[\r\n\0]/u.test(value)
  ) {
    throw new Error(`${field} must be non-empty, bounded, and single-line`);
  }
}

function assertFixtureRef(inputRef: string): void {
  assertBoundedCallerText(inputRef, "targeted brief input_ref", 512);
  const segments = inputRef.split("/");
  if (
    inputRef !== inputRef.trim() ||
    isAbsolute(inputRef) ||
    inputRef.includes("\\") ||
    !inputRef.startsWith("fixtures/") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("committed fixture input_ref must be an exact repository-relative fixtures/ path");
  }
}

function assertFixtureRunsAreClosed(bundle: GraphBundle): void {
  const fixtureRunsAreClosed = bundle.research_runs.every(
    (run) =>
      run.mode === "fixture" &&
      run.provider === null &&
      run.model === null &&
      run.cost_cap_usd === 0 &&
      run.observed_cost_usd === 0,
  );
  if (!fixtureRunsAreClosed) {
    throw new Error("bundle cannot be represented as a no-call committed fixture input");
  }
}

export async function loadCommittedTargetedBriefFixture(
  inputRef: string,
): Promise<LoadedTargetedBriefFixture> {
  assertFixtureRef(inputRef);
  const repositoryRoot = await realpath(resolve(MODULE_REPOSITORY_ROOT));
  const fixturesRoot = await realpath(resolve(repositoryRoot, "fixtures"));
  const candidatePath = resolve(repositoryRoot, inputRef);
  if (!isContainedPath(fixturesRoot, candidatePath)) {
    throw new Error("committed fixture input_ref must remain within the repository fixtures directory");
  }
  const fixturePath = await realpath(candidatePath);
  if (!isContainedPath(fixturesRoot, fixturePath)) {
    throw new Error("committed fixture input_ref resolved outside the repository fixtures directory");
  }

  const bytes = await readFile(fixturePath);
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`targeted brief fixture ${inputRef} is not valid JSON`);
  }

  const parsed = parseGraphBundle(raw);
  if (!parsed.ok) {
    throw new Error(`targeted brief fixture ${inputRef} failed strict GraphBundle parsing`);
  }
  const validation = validateGraphBundle(parsed.value, { mode: "fixture" });
  if (!validation.ok) {
    throw new Error(`targeted brief fixture ${inputRef} failed deterministic GraphBundle validation`);
  }
  assertFixtureRunsAreClosed(parsed.value);

  const input = deepFreeze<TargetedBriefInputIdentity>({
    class: "committed_fixture",
    ref: inputRef,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byte_length: bytes.byteLength,
    validation: "passed",
  });
  const loaded = deepFreeze<LoadedTargetedBriefFixture>({ input });
  loadedFixtureStates.set(loaded, {
    bundle: deepFreeze(parsed.value),
    input,
  });
  return loaded;
}

function normalizedRequest(request: TargetedBriefRequest): TargetedBriefRequest {
  if (!request || (request.kind !== "ciso_meeting" && request.kind !== "proposal_rfx")) {
    throw new Error("targeted brief request kind must be ciso_meeting or proposal_rfx");
  }
  assertBoundedCallerText(request.account_id, "targeted brief account_id", 256);
  if (
    !request.selection ||
    request.selection.governance !== "human_selected" ||
    !Array.isArray(request.selection.account_object_ids) ||
    request.selection.account_object_ids.length === 0
  ) {
    throw new Error("targeted brief request requires a non-empty human-selected account-object selection");
  }
  for (const objectId of request.selection.account_object_ids) {
    assertBoundedCallerText(objectId, "selected account_object_id", 256);
  }
  const selectedIds = uniqueSorted(request.selection.account_object_ids);
  if (selectedIds.length !== request.selection.account_object_ids.length) {
    throw new Error("targeted brief account-object selection must not contain duplicates");
  }
  const selection: TargetedBriefSelection = {
    governance: "human_selected",
    account_object_ids: selectedIds,
  };

  if (request.kind === "ciso_meeting") {
    if (!request.meeting) throw new Error("CISO meeting request requires meeting context");
    assertBoundedCallerText(request.meeting.audience, "meeting audience");
    assertBoundedCallerText(request.meeting.objective, "meeting objective");
    return deepFreeze({
      kind: "ciso_meeting",
      account_id: request.account_id,
      meeting: {
        audience: request.meeting.audience,
        objective: request.meeting.objective,
      },
      selection,
    });
  }

  if (!request.response) throw new Error("proposal/RFx request requires response context");
  if (!["proposal", "RFI", "RFP"].includes(request.response.type)) {
    throw new Error("proposal/RFx response type must be proposal, RFI, or RFP");
  }
  assertBoundedCallerText(request.response.requirement_context, "response requirement context", 2_048);
  assertBoundedCallerText(request.response.objective, "response objective", 1_024);
  return deepFreeze({
    kind: "proposal_rfx",
    account_id: request.account_id,
    response: {
      type: request.response.type,
      requirement_context: request.response.requirement_context,
      objective: request.response.objective,
    },
    selection,
  });
}

/**
 * Enforces one requested account across the entire bundle, including records
 * whose account is inherited through a relationship. Audit targets must resolve
 * to a local record with that same account.
 */
export function assertTargetedBriefSingleAccountIsolation(
  bundle: GraphBundle,
  requestedAccountId: string,
): void {
  const fail = (detail: string): never => {
    throw new Error(`targeted brief single-account isolation failed: ${detail}`);
  };
  const directRecords = [
    ...bundle.sources.map((record) => ({ id: record.id, accountId: record.account_id })),
    ...bundle.claims.map((record) => ({ id: record.id, accountId: record.account_id })),
    ...bundle.account_objects.map((record) => ({ id: record.id, accountId: record.account_id })),
    ...bundle.research_runs.map((record) => ({ id: record.id, accountId: record.account_id })),
  ];
  const directAccountIds = uniqueSorted(directRecords.map((record) => record.accountId));
  if (directAccountIds.length !== 1 || directAccountIds[0] !== requestedAccountId) {
    fail(`bundle accounts ${JSON.stringify(directAccountIds)} do not equal requested account ${requestedAccountId}`);
  }

  const recordAccountById = new Map<string, string>();
  const bind = (id: string, accountId: string): void => {
    if (accountId !== requestedAccountId) {
      fail(`${id} resolves to account ${accountId}, not ${requestedAccountId}`);
    }
    const existing = recordAccountById.get(id);
    if (existing && existing !== accountId) fail(`${id} resolves to more than one account`);
    recordAccountById.set(id, accountId);
  };
  for (const record of directRecords) bind(record.id, record.accountId);

  for (const excerpt of bundle.excerpts) {
    const sourceAccount =
      recordAccountById.get(excerpt.source_document_id) ??
      fail(`excerpt ${excerpt.id} has an unresolved source reference`);
    bind(excerpt.id, sourceAccount);
  }

  for (const relationship of bundle.claim_evidence) {
    const claimAccount =
      recordAccountById.get(relationship.claim_id) ??
      fail(`claim-evidence ${relationship.id} has an unresolved claim endpoint`);
    const excerptAccount =
      recordAccountById.get(relationship.evidence_excerpt_id) ??
      fail(`claim-evidence ${relationship.id} has an unresolved excerpt endpoint`);
    if (claimAccount !== excerptAccount) fail(`claim-evidence ${relationship.id} crosses accounts`);
    bind(relationship.id, claimAccount);
  }

  for (const relationship of bundle.account_object_claims) {
    const objectAccount =
      recordAccountById.get(relationship.account_object_id) ??
      fail(`account-object claim ${relationship.id} has an unresolved object endpoint`);
    const claimAccount =
      recordAccountById.get(relationship.claim_id) ??
      fail(`account-object claim ${relationship.id} has an unresolved claim endpoint`);
    if (objectAccount !== claimAccount) fail(`account-object claim ${relationship.id} crosses accounts`);
    bind(relationship.id, objectAccount);
  }

  for (const artifact of bundle.run_artifacts) {
    const runAccount =
      recordAccountById.get(artifact.research_run_id) ??
      fail(`run artifact ${artifact.id} has an unresolved research-run reference`);
    bind(artifact.id, runAccount);
  }

  const unresolvedAudits = new Map(bundle.audit_events.map((event) => [event.id, event]));
  let progress = true;
  while (unresolvedAudits.size > 0 && progress) {
    progress = false;
    for (const [id, event] of unresolvedAudits) {
      const targetAccount = recordAccountById.get(event.target_id);
      if (!targetAccount) continue;
      bind(id, targetAccount);
      unresolvedAudits.delete(id);
      progress = true;
    }
  }
  if (unresolvedAudits.size > 0) {
    fail(`audit targets do not resolve locally: ${uniqueSorted([...unresolvedAudits.values()].map((event) => event.target_id)).join(", ")}`);
  }
}

function compareEvidence(left: TargetedBriefEvidenceReference, right: TargetedBriefEvidenceReference): number {
  const relationshipOrder = { supports: 0, contradicts: 1 } as const;
  return (
    left.claim.id.localeCompare(right.claim.id) ||
    relationshipOrder[left.relationship] - relationshipOrder[right.relationship] ||
    left.excerpt.id.localeCompare(right.excerpt.id) ||
    left.source.id.localeCompare(right.source.id)
  );
}

function evidenceKey(evidence: TargetedBriefEvidenceReference): string {
  return [
    evidence.relationship,
    evidence.claim.id,
    evidence.excerpt.id,
    evidence.source.id,
  ].join("\0");
}

function acceptedEvidenceForClaim(
  bundle: GraphBundle,
  claim: Claim,
  excerptById: ReadonlyMap<string, EvidenceExcerpt>,
  sourceById: ReadonlyMap<string, SourceDocument>,
): TargetedBriefEvidenceReference[] {
  const evidence: TargetedBriefEvidenceReference[] = [];
  for (const link of bundle.claim_evidence) {
    if (
      link.claim_id !== claim.id ||
      (link.relationship !== "supports" && link.relationship !== "contradicts")
    ) {
      continue;
    }
    const excerpt = excerptById.get(link.evidence_excerpt_id);
    const source = excerpt ? sourceById.get(excerpt.source_document_id) : undefined;
    if (!excerpt || !source || excerpt.validation_status !== "accepted" || excerpt.kind !== "literal") continue;
    evidence.push({
      relationship: link.relationship,
      claim: {
        id: claim.id,
        text: claim.text,
        claim_type: claim.claim_type,
        confidence: claim.confidence,
        provenance_status: claim.provenance_status,
        status: claim.status,
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
        status: source.status,
      },
      evidence_current_through: null,
    });
  }
  return evidence.sort(compareEvidence);
}

function trustForAssertion(
  object: AccountObject,
  claims: readonly Claim[],
  contested: boolean,
): Pick<TargetedBriefAssertion, "state" | "provenance_status" | "trust_label"> {
  if (contested) {
    return {
      state: "contested",
      provenance_status: "contested",
      trust_label: "Contested · supporting and contradicting evidence",
    };
  }
  const verified =
    object.provenance_status === "verified" &&
    claims.every((claim) => claim.provenance_status === "verified");
  return verified
    ? { state: "supported", provenance_status: "verified", trust_label: "Verified" }
    : {
        state: "supported",
        provenance_status: "source_document_only",
        trust_label: "Source-backed · not independently checked",
      };
}

function addGap(
  gaps: Map<TargetedBriefGapReason, GapAccumulator>,
  reason: TargetedBriefGapReason,
  itemId: string,
  retainedEvidence: readonly TargetedBriefEvidenceReference[] = [],
): void {
  const gap = gaps.get(reason) ?? { itemIds: new Set<string>(), evidenceByKey: new Map() };
  gap.itemIds.add(itemId);
  for (const evidence of retainedEvidence) gap.evidenceByKey.set(evidenceKey(evidence), evidence);
  gaps.set(reason, gap);
}

function finalizedGaps(gaps: ReadonlyMap<TargetedBriefGapReason, GapAccumulator>): TargetedBriefEvidenceGap[] {
  return GAP_ORDER.flatMap((reason) => {
    const gap = gaps.get(reason);
    if (!gap || gap.itemIds.size === 0) return [];
    const omittedItemIds = uniqueSorted([...gap.itemIds]);
    return [{
      id: `gap-${reason}`,
      reason,
      omitted_item_count: omittedItemIds.length,
      omitted_item_ids: omittedItemIds,
      message: GAP_MESSAGES[reason],
      retained_evidence: [...gap.evidenceByKey.values()].sort(compareEvidence),
    }];
  });
}

function objectIsRenderable(
  object: AccountObject,
  gaps: Map<TargetedBriefGapReason, GapAccumulator>,
): boolean {
  let renderable = true;
  if (object.provenance_status === "unsupported") {
    addGap(gaps, "unsupported_claim_rejected", object.id);
    renderable = false;
  } else if (!SUPPORTED_PROVENANCE.has(object.provenance_status)) {
    addGap(gaps, "trust_not_ready", object.id);
    renderable = false;
  }
  if (object.status !== "active") {
    addGap(gaps, "record_not_active", object.id);
    renderable = false;
  }
  return renderable;
}

export function evaluateTargetedBriefSelection(
  bundle: GraphBundle,
  request: TargetedBriefRequest,
): TargetedBriefSelectionResult {
  const target = normalizedRequest(request);
  const validation = validateGraphBundle(bundle, { mode: "fixture" });
  if (!validation.ok) {
    throw new Error("targeted brief input failed deterministic GraphBundle validation");
  }
  assertFixtureRunsAreClosed(bundle);
  assertTargetedBriefSingleAccountIsolation(bundle, target.account_id);

  const objectById = new Map(bundle.account_objects.map((object) => [object.id, object]));
  const claimById = new Map(bundle.claims.map((claim) => [claim.id, claim]));
  const excerptById = new Map(bundle.excerpts.map((excerpt) => [excerpt.id, excerpt]));
  const sourceById = new Map(bundle.sources.map((source) => [source.id, source]));
  const gaps = new Map<TargetedBriefGapReason, GapAccumulator>();
  const assertions: TargetedBriefAssertion[] = [];

  for (const objectId of target.selection.account_object_ids) {
    const object = objectById.get(objectId);
    if (!object) {
      throw new Error(`selected account_object_id ${objectId} does not resolve in the loaded fixture`);
    }
    if (object.account_id !== target.account_id) {
      throw new Error(`selected account_object_id ${objectId} does not belong to requested account ${target.account_id}`);
    }

    const renderableObject = objectIsRenderable(object, gaps);
    const claimIds = uniqueSorted(
      bundle.account_object_claims
        .filter((relationship) => relationship.account_object_id === object.id)
        .map((relationship) => relationship.claim_id),
    );
    if (claimIds.length === 0) addGap(gaps, "missing_accepted_evidence", object.id);

    const acceptedClaims: Claim[] = [];
    const acceptedEvidence: TargetedBriefEvidenceReference[] = [];
    for (const claimId of claimIds) {
      const claim = claimById.get(claimId);
      if (!claim) {
        throw new Error(`selected account object ${object.id} has an unresolved claim ${claimId}`);
      }
      const evidence = acceptedEvidenceForClaim(bundle, claim, excerptById, sourceById);
      const supports = evidence.filter(
        (item) => item.relationship === "supports" && item.source.status === "active",
      );
      const contradictions = evidence.filter((item) => item.relationship === "contradicts");

      let claimIsRenderable = true;
      if (claim.provenance_status === "unsupported") {
        addGap(gaps, "unsupported_claim_rejected", claim.id);
        claimIsRenderable = false;
      } else if (!SUPPORTED_PROVENANCE.has(claim.provenance_status)) {
        addGap(gaps, "trust_not_ready", claim.id);
        claimIsRenderable = false;
      }
      if (claim.status !== "active") {
        addGap(gaps, "record_not_active", claim.id);
        claimIsRenderable = false;
      }
      if (supports.length === 0) {
        addGap(gaps, "missing_accepted_evidence", claim.id);
        claimIsRenderable = false;
      }
      if (contradictions.length > 0 && (!claimIsRenderable || !renderableObject)) {
        addGap(gaps, "accepted_contradiction", claim.id, [...supports, ...contradictions]);
      }
      if (!claimIsRenderable) continue;

      acceptedClaims.push(claim);
      acceptedEvidence.push(...supports, ...contradictions);
    }

    if (!renderableObject || acceptedClaims.length === 0) {
      addGap(gaps, "selected_target_not_supported", object.id);
      continue;
    }

    const evidenceByKey = new Map<string, TargetedBriefEvidenceReference>();
    for (const evidence of acceptedEvidence) evidenceByKey.set(evidenceKey(evidence), evidence);
    const evidence = [...evidenceByKey.values()].sort(compareEvidence);
    const trust = trustForAssertion(
      object,
      acceptedClaims,
      evidence.some((item) => item.relationship === "contradicts"),
    );
    assertions.push({
      id: object.id,
      section: LENS_BY_OBJECT_TYPE[object.object_type],
      object_type: object.object_type,
      statement: uniqueSorted(acceptedClaims.map((claim) => claim.text)).join(" "),
      claim_ids: uniqueSorted(acceptedClaims.map((claim) => claim.id)),
      ...trust,
      confidence: object.confidence,
      evidence,
    });
  }

  const sectionOrder = new Map(SECTION_COPY[target.kind].map((section, index) => [section.key, index]));
  assertions.sort(
    (left, right) =>
      (sectionOrder.get(left.section) ?? Number.MAX_SAFE_INTEGER) -
        (sectionOrder.get(right.section) ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id),
  );
  return deepFreeze({
    request: target,
    assertions,
    evidence_gaps: finalizedGaps(gaps),
  });
}

function buildBrief(
  state: LoadedFixtureState,
  selection: TargetedBriefSelectionResult,
): TargetedBrief {
  const kind = selection.request.kind;
  const sections = SECTION_COPY[kind].map((section) => ({
    ...section,
    assertion_ids: selection.assertions
      .filter((assertion) => assertion.section === section.key)
      .map((assertion) => assertion.id),
  }));
  const brief = deepFreeze<TargetedBrief>({
    schema_version: TARGETED_BRIEF_SCHEMA_VERSION,
    kind,
    title: kind === "ciso_meeting" ? "Targeted CISO meeting brief" : "Proposal / RFI / RFP targeted brief",
    account_id: selection.request.account_id,
    target: selection.request,
    target_relevance: {
      status: "caller_workflow_context_only",
      evidence_gap: TARGET_RELEVANCE_GAP[kind],
    },
    input: state.input,
    summary: `${selection.assertions.length} selected evidence-backed ${selection.assertions.length === 1 ? "point" : "points"} ready for human review.`,
    next_safe_action: "Review the evidence behind the most important point.",
    assertions: selection.assertions,
    sections,
    open_questions: OPEN_QUESTIONS[kind],
    evidence_gaps: selection.evidence_gaps,
    boundary: BOUNDARY,
  });
  renderableBriefs.add(brief);
  return brief;
}

function loadedFixtureState(loaded: LoadedTargetedBriefFixture): LoadedFixtureState {
  const state = loadedFixtureStates.get(loaded);
  if (!state) {
    throw new Error("targeted brief fixture must come from loadCommittedTargetedBriefFixture");
  }
  return state;
}

export function buildTargetedBrief(
  loaded: LoadedTargetedBriefFixture,
  request: TargetedBriefRequest,
): TargetedBrief {
  const state = loadedFixtureState(loaded);
  return buildBrief(state, evaluateTargetedBriefSelection(state.bundle, request));
}

export function buildTargetedBriefPair(
  loaded: LoadedTargetedBriefFixture,
  requests: TargetedBriefPairRequest,
): TargetedBriefPair {
  if (requests.ciso_meeting.kind !== "ciso_meeting" || requests.proposal_rfx.kind !== "proposal_rfx") {
    throw new Error("targeted brief pair requires explicit CISO meeting and proposal/RFx requests");
  }
  const state = loadedFixtureState(loaded);
  return deepFreeze({
    ciso_meeting: buildBrief(
      state,
      evaluateTargetedBriefSelection(state.bundle, requests.ciso_meeting),
    ),
    proposal_rfx: buildBrief(
      state,
      evaluateTargetedBriefSelection(state.bundle, requests.proposal_rfx),
    ),
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeTargetedBriefSourceUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return null;
    return value;
  } catch {
    return null;
  }
}

function renderSource(evidence: TargetedBriefEvidenceReference): string {
  const safeUrl = safeTargetedBriefSourceUrl(evidence.source.url);
  const title = escapeHtml(evidence.source.title);
  const sourceTitle = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" rel="noreferrer noopener">${title}</a>`
    : `${title} <span class="unsafe-url">Source URL omitted</span>`;
  const relationshipLabel =
    evidence.relationship === "supports" ? "Supporting evidence" : "Contradicting evidence";
  return `<div class="evidence-packet evidence-${escapeHtml(evidence.relationship)}">
          <p class="evidence-label">${relationshipLabel} · accepted literal excerpt</p>
          <dl>
            <dt>Claim under review</dt><dd>${escapeHtml(evidence.claim.text)}</dd>
            <dt>Accepted excerpt</dt><dd><blockquote>${escapeHtml(evidence.excerpt.text)}</blockquote></dd>
            <dt>Source record · workspace metadata</dt><dd>${sourceTitle} · ${escapeHtml(evidence.source.publisher ?? "Publisher not supplied")} · ${escapeHtml(evidence.source.reliability)} reliability · ${escapeHtml(evidence.source.status)} record</dd>
            <dt>Source record timestamp</dt><dd>${escapeHtml(evidence.source.fetched_at)}</dd>
            <dt>Evidence current through</dt><dd>Not supplied by source</dd>
          </dl>
        </div>`;
}

function renderAssertion(assertion: TargetedBriefAssertion): string {
  const evidenceSummary =
    assertion.state === "contested"
      ? "View supporting and contradicting evidence"
      : "View supporting evidence";
  return `<article class="assertion" data-assertion-id="${escapeHtml(assertion.id)}">
      <div class="assertion-heading">
        <div>
          <p class="kicker">${escapeHtml(assertion.object_type.replaceAll("_", " "))} · evidence-bound claim text</p>
          <h3>${escapeHtml(assertion.statement)}</h3>
        </div>
        <span class="trust trust-${escapeHtml(assertion.provenance_status)}">${escapeHtml(assertion.trust_label)}</span>
      </div>
      <details>
        <summary>${evidenceSummary}</summary>
        ${assertion.evidence.map(renderSource).join("\n")}
      </details>
    </article>`;
}

function renderSection(brief: TargetedBrief, section: TargetedBriefSection): string {
  const assertions = brief.assertions.filter((assertion) => assertion.section === section.key);
  const body = assertions.length > 0
    ? assertions.map(renderAssertion).join("\n")
    : `<p class="empty-section"><strong>Selection note:</strong> No supported items were selected for this section.</p>`;
  return `<section class="brief-section" data-section="${section.key}">
      <header><div><p class="kicker">${escapeHtml(section.purpose)}</p><h2>${escapeHtml(section.title)}</h2></div><span>${assertions.length} selected and supported</span></header>
      ${body}
    </section>`;
}

function renderGaps(brief: TargetedBrief): string {
  const body = brief.evidence_gaps.length > 0
    ? brief.evidence_gaps
        .map((gap) => {
          const retainedEvidence = gap.retained_evidence.length === 0
            ? ""
            : `<details><summary>Review retained evidence for omitted material</summary>
              ${gap.retained_evidence.map(renderSource).join("\n")}
            </details>`;
          return `<li><strong>Evidence gap</strong> · ${gap.omitted_item_count} omitted<br />${escapeHtml(gap.message)}
            <div class="workspace-records">Workspace record IDs · not account facts: ${gap.omitted_item_ids.map(escapeHtml).join(", ")}</div>
            ${retainedEvidence}</li>`;
        })
        .join("\n")
    : "<li>No unsupported or unbound selected factual material entered this brief.</li>";
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

function renderTargetContext(
  target: TargetedBriefRequest,
  targetRelevance: TargetedBriefTargetRelevance,
): string {
  const selection = `<dt>Human-governed workspace selection · not account facts</dt>
          <dd>${target.selection.account_object_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</dd>`;
  const context = target.kind === "ciso_meeting"
    ? `<dt>Audience · caller-provided, not an account fact</dt><dd>${escapeHtml(target.meeting.audience)}</dd>
          <dt>Objective · caller-provided, not an account fact</dt><dd>${escapeHtml(target.meeting.objective)}</dd>`
    : `<dt>Response type · caller-provided, not an account fact</dt><dd>${escapeHtml(target.response.type)}</dd>
          <dt>Requirement context · caller-provided, not an account fact</dt><dd>${escapeHtml(target.response.requirement_context)}</dd>
          <dt>Objective · caller-provided, not an account fact</dt><dd>${escapeHtml(target.response.objective)}</dd>`;
  return `<section class="target-panel">
      <p class="kicker">Caller / human workflow context · not account facts</p>
      <h2>${target.kind === "ciso_meeting" ? "Meeting target" : "Response target"}</h2>
      <dl>${context}
          ${selection}
      </dl>
      <p class="target-relevance-gap"><strong>Target-relevance evidence gap:</strong> ${escapeHtml(targetRelevance.evidence_gap)}</p>
    </section>`;
}

function renderInputIdentity(input: TargetedBriefInputIdentity): string {
  return `<section class="input-panel">
      <p class="kicker">Deterministic input identity · workspace metadata, not an account fact</p>
      <h2>Validated committed fixture</h2>
      <dl>
        <dt>Repository-relative input ref</dt><dd><code>${escapeHtml(input.ref)}</code></dd>
        <dt>Loaded bytes SHA-256</dt><dd><code>${escapeHtml(input.sha256)}</code></dd>
        <dt>Loaded byte length</dt><dd>${input.byte_length}</dd>
        <dt>GraphBundle validation</dt><dd>${escapeHtml(input.validation)}</dd>
      </dl>
    </section>`;
}

export function renderTargetedBriefHtml(brief: TargetedBrief): string {
  if (!renderableBriefs.has(brief)) {
    throw new Error("only a brief built from a loaded committed fixture may be rendered");
  }
  if (brief.schema_version !== TARGETED_BRIEF_SCHEMA_VERSION) {
    throw new Error("unsupported targeted brief schema version");
  }
  const accountLabel = `Account reference ${escapeHtml(brief.account_id)}`;
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
    .target-panel, .input-panel, .brief-section, .support-panel { margin-top: 20px; border: 1px solid #d8e1ec; border-radius: 20px; padding: 20px; background: #fff; }
    .brief-section > header { display: flex; justify-content: space-between; gap: 16px; align-items: start; border-bottom: 1px solid #e7edf4; padding-bottom: 12px; }
    h2 { margin: 0; font-size: 1.35rem; }
    .assertion { margin-top: 14px; border: 1px solid #dce5ee; border-radius: 16px; padding: 16px; background: #fbfdff; }
    .assertion-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
    .assertion h3 { margin: 0; font-size: 1.08rem; }
    .trust, .template-label { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: .78rem; font-weight: 700; }
    .trust-verified { color: #0b573f; background: #dff6ed; }
    .trust-source_document_only { color: #174a6e; background: #e0f0fb; }
    .trust-contested { color: #7a2f18; background: #ffe6dc; }
    details { margin-top: 12px; border-top: 1px solid #e3e9f0; padding-top: 10px; }
    summary { cursor: pointer; color: #155c73; font-weight: 750; }
    .evidence-packet { margin-top: 12px; border-left: 3px solid #7db9c8; padding: 4px 0 4px 14px; }
    .evidence-contradicts { border-left-color: #d7795c; }
    .evidence-label { color: #506078; font-weight: 750; }
    dl { display: grid; grid-template-columns: minmax(190px, .35fr) minmax(0, 1fr); gap: 7px 14px; }
    dt { color: #627089; font-weight: 700; }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    blockquote { margin: 0; }
    code { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 5px; border-radius: 5px; background: #eef3f8; overflow-wrap: anywhere; }
    a { color: #155c73; }
    .unsafe-url { color: #a33a3a; }
    .support-grid, .identity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
    ul { margin: 12px 0 0; padding-left: 20px; }
    li + li { margin-top: 12px; }
    .template-label { color: #5b3d09; background: #fff1c9; margin-bottom: 4px; }
    .empty-section, .workspace-records { color: #627089; }
    .workspace-records { margin-top: 6px; font-size: .86rem; }
    .target-relevance-gap { margin: 16px 0 0; border-left: 4px solid #d7795c; padding: 10px 12px; background: #fff4ef; color: #65301f; }
    footer { margin-top: 22px; color: #627089; font-size: .86rem; text-align: center; }
    @media (max-width: 760px) {
      main { padding: 16px 14px 36px; }
      .hero { padding: 22px 18px; border-radius: 18px; }
      .support-grid, .identity-grid { grid-template-columns: 1fr; gap: 0; }
      .brief-section > header, .assertion-heading { flex-direction: column; }
      dl { grid-template-columns: 1fr; }
      dt { margin-top: 6px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="kicker">Atliera · ${accountLabel}</p>
      <h1>${escapeHtml(brief.title)}</h1>
      <p class="summary">${escapeHtml(brief.summary)}</p>
      <div class="chips" aria-label="Brief boundaries">
        <span>Read-only · no automatic action</span>
        <span>Explicit human selection only</span>
        <span>Evidence-bound assertions only</span>
        <span>Human review required</span>
      </div>
      <p class="next-action"><strong>Next safe action:</strong> ${escapeHtml(brief.next_safe_action)}</p>
    </section>
    <div class="identity-grid">
      ${renderTargetContext(brief.target, brief.target_relevance)}
      ${renderInputIdentity(brief.input)}
    </div>
    ${brief.sections.map((section) => renderSection(brief, section)).join("\n")}
    <div class="support-grid">
      ${renderQuestions(brief)}
      ${renderGaps(brief)}
    </div>
    <footer>Prepared from the exact loaded committed-fixture bytes identified above. No provider call, network acquisition, production write, submission, or external action occurred.</footer>
  </main>
</body>
</html>`;
}
