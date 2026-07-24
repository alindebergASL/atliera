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
export type TargetedBriefInputClass = "validated_local_fixture";
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

export interface TargetedBriefAuthority {
  readonly team_id: string;
}

export interface TargetedBriefGovernedFactReference {
  readonly account_object_id: string;
  readonly claim_ids: readonly string[];
}

export interface TargetedCisoFactContext extends TargetedBriefGovernedFactReference {
  readonly why_it_matters?: string;
  readonly question_to_ask?: string;
  readonly desired_outcome?: string;
}

export interface TargetedCisoMeetingRequest {
  readonly kind: "ciso_meeting";
  readonly authority: TargetedBriefAuthority;
  readonly account_id: string;
  readonly meeting: {
    readonly audience: string;
    readonly objective: string;
    readonly fact_contexts?: readonly TargetedCisoFactContext[];
  };
  readonly selection: TargetedBriefSelection;
}

export type TargetedRfxResponseType = "proposal" | "RFI" | "RFP";

export interface TargetedRfxRequirementMapping {
  readonly requirement_ref: string;
  readonly requirement_text: string;
  readonly supported_response_point: string;
  readonly available_evidence: string;
  readonly gap_or_limitation?: string;
  readonly account_object_ids: readonly string[];
  readonly claim_ids: readonly string[];
}

export interface TargetedProposalRfxRequest {
  readonly kind: "proposal_rfx";
  readonly authority: TargetedBriefAuthority;
  readonly account_id: string;
  readonly response: {
    readonly type: TargetedRfxResponseType;
    readonly requirement_context: string;
    readonly objective: string;
    readonly requirement_mappings?: readonly TargetedRfxRequirementMapping[];
  };
  readonly selection: TargetedBriefSelection;
}

export type TargetedBriefRequest = TargetedCisoMeetingRequest | TargetedProposalRfxRequest;

export interface TargetedBriefTargetRelevance {
  readonly status: "caller_workflow_context_only";
  readonly evidence_gap: string | null;
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
  readonly tracked_blob_proof: "unavailable";
}

/**
 * An opaque capability returned only after repository-relative local fixture
 * bytes have been read, parsed, and validated. It deliberately does not claim
 * tracked Git-blob identity: this bounded loader has no authoritative commit
 * proof. Builders also require the exact registered object identity.
 */
export interface LoadedTargetedBriefFixture {
  readonly input: TargetedBriefInputIdentity;
}

export interface TargetedBriefEvidenceReference {
  readonly relationship: "supports" | "contradicts";
  readonly activity: "active" | "inactive_provenance";
  readonly ownership: {
    readonly team_id: string;
    readonly account_id: string;
  };
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
  readonly ownership: {
    readonly team_id: string;
    readonly account_id: string;
  };
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
  readonly inactive_evidence: readonly TargetedBriefEvidenceReference[];
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
  readonly authority: TargetedBriefAuthority;
  readonly account_id: string;
  readonly target: TargetedBriefRequest;
  readonly target_relevance: TargetedBriefTargetRelevance;
  readonly input: TargetedBriefInputIdentity;
  readonly summary: string;
  readonly next_safe_action: string;
  readonly assertions: readonly TargetedBriefAssertion[];
  readonly sections: readonly TargetedBriefSection[];
  readonly meeting_contexts: readonly TargetedCisoFactContext[];
  readonly rfx_mappings: readonly TargetedRfxRequirementMapping[];
  readonly preparation_gaps: readonly string[];
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

const GAP_MESSAGES: Record<TargetedBriefGapReason, string> = {
  selected_target_not_supported:
    "A human-selected workspace object had no factual assertion safe to render; no generic account material was substituted.",
  unsupported_claim_rejected: "Unsupported selected material was omitted rather than presented as fact.",
  trust_not_ready: "Selected material awaiting stronger trust or review was omitted from factual sections.",
  missing_accepted_evidence:
    "A selected claim without accepted active-source supporting evidence was omitted from factual sections.",
  record_not_active: "Inactive, rejected, or superseded selected material was omitted from factual sections.",
  accepted_contradiction:
    "A selected claim has active accepted contradictory evidence and remains contested pending human resolution.",
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
    "The selected account facts do not include team-provided meeting context.",
  proposal_rfx:
    "No team-provided requirement mapping connects the selected account facts to this response.",
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

function normalizedOptionalCallerText(
  value: string | undefined,
  field: string,
  maximumLength = 1_024,
): string | undefined {
  if (value === undefined) return undefined;
  assertBoundedCallerText(value, field, maximumLength);
  return value;
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
    throw new Error("local fixture input_ref must be an exact repository-relative fixtures/ path");
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
    throw new Error("local fixture input_ref must remain within the repository fixtures directory");
  }
  const fixturePath = await realpath(candidatePath);
  if (!isContainedPath(fixturesRoot, fixturePath)) {
    throw new Error("local fixture input_ref resolved outside the repository fixtures directory");
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
    class: "validated_local_fixture",
    ref: inputRef,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byte_length: bytes.byteLength,
    validation: "passed",
    tracked_blob_proof: "unavailable",
  });
  const loaded = deepFreeze<LoadedTargetedBriefFixture>({ input });
  loadedFixtureStates.set(loaded, {
    bundle: deepFreeze(parsed.value),
    input,
  });
  return loaded;
}

/** Truthfully named alias for new callers. */
export const loadTargetedBriefFixture = loadCommittedTargetedBriefFixture;

function normalizedRequest(request: TargetedBriefRequest): TargetedBriefRequest {
  if (!request || (request.kind !== "ciso_meeting" && request.kind !== "proposal_rfx")) {
    throw new Error("targeted brief request kind must be ciso_meeting or proposal_rfx");
  }
  if (!request.authority) {
    throw new Error("targeted brief request requires explicit team/workspace generation authority");
  }
  assertBoundedCallerText(request.authority.team_id, "targeted brief authority team_id", 256);
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
    const governedClaimKeys = new Set<string>();
    const factContexts = [...(request.meeting.fact_contexts ?? [])].map((context, index) => {
      assertBoundedCallerText(
        context.account_object_id,
        `meeting fact_contexts[${index}].account_object_id`,
        256,
      );
      if (!Array.isArray(context.claim_ids) || context.claim_ids.length === 0) {
        throw new Error(`meeting fact_contexts[${index}] requires governed claim_ids`);
      }
      for (const claimId of context.claim_ids) {
        assertBoundedCallerText(claimId, `meeting fact_contexts[${index}].claim_id`, 256);
        const key = `${context.account_object_id}\0${claimId}`;
        if (governedClaimKeys.has(key)) {
          throw new Error(`meeting fact context ownership is ambiguous for ${context.account_object_id}/${claimId}`);
        }
        governedClaimKeys.add(key);
      }
      const claimIds = uniqueSorted(context.claim_ids);
      if (claimIds.length !== context.claim_ids.length) {
        throw new Error(`meeting fact_contexts[${index}].claim_ids must not contain duplicates`);
      }
      return {
        account_object_id: context.account_object_id,
        claim_ids: claimIds,
        why_it_matters: normalizedOptionalCallerText(
          context.why_it_matters,
          `meeting fact_contexts[${index}].why_it_matters`,
        ),
        question_to_ask: normalizedOptionalCallerText(
          context.question_to_ask,
          `meeting fact_contexts[${index}].question_to_ask`,
        ),
        desired_outcome: normalizedOptionalCallerText(
          context.desired_outcome,
          `meeting fact_contexts[${index}].desired_outcome`,
        ),
      };
    });
    factContexts.sort(
      (left, right) =>
        left.account_object_id.localeCompare(right.account_object_id) ||
        left.claim_ids.join("\0").localeCompare(right.claim_ids.join("\0")),
    );
    return deepFreeze({
      kind: "ciso_meeting",
      authority: { team_id: request.authority.team_id },
      account_id: request.account_id,
      meeting: {
        audience: request.meeting.audience,
        objective: request.meeting.objective,
        fact_contexts: factContexts,
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
  const requirementRefs = new Set<string>();
  const requirementMappings = [...(request.response.requirement_mappings ?? [])].map(
    (mapping, index) => {
      assertBoundedCallerText(
        mapping.requirement_ref,
        `response requirement_mappings[${index}].requirement_ref`,
        256,
      );
      if (requirementRefs.has(mapping.requirement_ref)) {
        throw new Error(`response requirement_ref ${mapping.requirement_ref} is ambiguous`);
      }
      requirementRefs.add(mapping.requirement_ref);
      assertBoundedCallerText(
        mapping.requirement_text,
        `response requirement_mappings[${index}].requirement_text`,
        2_048,
      );
      assertBoundedCallerText(
        mapping.supported_response_point,
        `response requirement_mappings[${index}].supported_response_point`,
        2_048,
      );
      assertBoundedCallerText(
        mapping.available_evidence,
        `response requirement_mappings[${index}].available_evidence`,
        2_048,
      );
      if (
        !Array.isArray(mapping.account_object_ids) ||
        mapping.account_object_ids.length === 0 ||
        !Array.isArray(mapping.claim_ids) ||
        mapping.claim_ids.length === 0
      ) {
        throw new Error(`response requirement_mappings[${index}] requires governed account-object and claim references`);
      }
      for (const objectId of mapping.account_object_ids) {
        assertBoundedCallerText(
          objectId,
          `response requirement_mappings[${index}].account_object_id`,
          256,
        );
      }
      for (const claimId of mapping.claim_ids) {
        assertBoundedCallerText(
          claimId,
          `response requirement_mappings[${index}].claim_id`,
          256,
        );
      }
      const accountObjectIds = uniqueSorted(mapping.account_object_ids);
      const claimIds = uniqueSorted(mapping.claim_ids);
      if (
        accountObjectIds.length !== mapping.account_object_ids.length ||
        claimIds.length !== mapping.claim_ids.length
      ) {
        throw new Error(`response requirement_mappings[${index}] references must not contain duplicates`);
      }
      return {
        requirement_ref: mapping.requirement_ref,
        requirement_text: mapping.requirement_text,
        supported_response_point: mapping.supported_response_point,
        available_evidence: mapping.available_evidence,
        gap_or_limitation: normalizedOptionalCallerText(
          mapping.gap_or_limitation,
          `response requirement_mappings[${index}].gap_or_limitation`,
          2_048,
        ),
        account_object_ids: accountObjectIds,
        claim_ids: claimIds,
      };
    },
  );
  requirementMappings.sort((left, right) =>
    left.requirement_ref.localeCompare(right.requirement_ref),
  );
  return deepFreeze({
    kind: "proposal_rfx",
    authority: { team_id: request.authority.team_id },
    account_id: request.account_id,
    response: {
      type: request.response.type,
      requirement_context: request.response.requirement_context,
      objective: request.response.objective,
      requirement_mappings: requirementMappings,
    },
    selection,
  });
}

/** Enforces one explicit team/workspace authority and one account exhaustively. */
export function assertTargetedBriefSingleAccountIsolation(
  bundle: GraphBundle,
  requestedAccountId: string,
  requestedTeamId?: string,
): void {
  if (!requestedTeamId || requestedTeamId.trim().length === 0) {
    throw new Error("targeted brief ownership isolation requires explicit team/workspace authority");
  }
  const fail = (detail: string): never => {
    throw new Error(`targeted brief team/account ownership isolation failed: ${detail}`);
  };
  const directRecords = [
    ...bundle.sources.map((record) => ({
      kind: "source",
      id: record.id,
      accountId: record.account_id,
      teamId: record.team_id,
    })),
    ...bundle.claims.map((record) => ({
      kind: "claim",
      id: record.id,
      accountId: record.account_id,
      teamId: record.team_id,
    })),
    ...bundle.account_objects.map((record) => ({
      kind: "account object",
      id: record.id,
      accountId: record.account_id,
      teamId: record.team_id,
    })),
    ...bundle.research_runs.map((record) => ({
      kind: "research run",
      id: record.id,
      accountId: record.account_id,
      teamId: record.team_id,
    })),
  ];
  if (directRecords.length === 0) {
    fail("bundle contains no direct ownership-bearing records");
  }

  interface Owner {
    readonly teamId: string;
    readonly accountId: string;
  }
  const ownerById = new Map<string, Owner>();
  const kindById = new Map<string, string>();
  const bind = (kind: string, id: string, owner: Owner): void => {
    if (ownerById.has(id)) {
      fail(`${id} has ambiguous ownership because more than one graph entity uses that ID`);
    }
    ownerById.set(id, owner);
    kindById.set(id, kind);
  };
  for (const record of directRecords) {
    bind(record.kind, record.id, { teamId: record.teamId, accountId: record.accountId });
  }

  for (const excerpt of bundle.excerpts) {
    const sourceOwner =
      ownerById.get(excerpt.source_document_id) ??
      fail(`excerpt ${excerpt.id} has an unresolved source reference`);
    bind("excerpt", excerpt.id, sourceOwner);
  }

  for (const relationship of bundle.claim_evidence) {
    const claimOwner =
      ownerById.get(relationship.claim_id) ??
      fail(`claim-evidence ${relationship.id} has an unresolved claim endpoint`);
    const excerptOwner =
      ownerById.get(relationship.evidence_excerpt_id) ??
      fail(`claim-evidence ${relationship.id} has an unresolved excerpt endpoint`);
    if (
      claimOwner.accountId !== excerptOwner.accountId ||
      claimOwner.teamId !== excerptOwner.teamId
    ) {
      fail(`claim-evidence ${relationship.id} crosses team/account ownership`);
    }
    bind("claim-evidence relationship", relationship.id, claimOwner);
  }

  for (const relationship of bundle.account_object_claims) {
    const objectOwner =
      ownerById.get(relationship.account_object_id) ??
      fail(`account-object claim ${relationship.id} has an unresolved object endpoint`);
    const claimOwner =
      ownerById.get(relationship.claim_id) ??
      fail(`account-object claim ${relationship.id} has an unresolved claim endpoint`);
    if (
      objectOwner.accountId !== claimOwner.accountId ||
      objectOwner.teamId !== claimOwner.teamId
    ) {
      fail(`account-object claim ${relationship.id} crosses team/account ownership`);
    }
    bind("account-object claim relationship", relationship.id, objectOwner);
  }

  for (const artifact of bundle.run_artifacts) {
    const runOwner =
      ownerById.get(artifact.research_run_id) ??
      fail(`run artifact ${artifact.id} has an unresolved research-run reference`);
    bind("run artifact receipt", artifact.id, runOwner);
  }

  const unresolvedAudits = new Map(bundle.audit_events.map((event) => [event.id, event]));
  let progress = true;
  while (unresolvedAudits.size > 0 && progress) {
    progress = false;
    for (const [id, event] of unresolvedAudits) {
      const targetOwner = ownerById.get(event.target_id);
      if (!targetOwner) continue;
      if (event.team_id !== targetOwner.teamId) {
        fail(
          `audit receipt ${id} declares team ${event.team_id} but its target resolves to team ${targetOwner.teamId}`,
        );
      }
      bind("audit receipt", id, targetOwner);
      unresolvedAudits.delete(id);
      progress = true;
    }
  }
  if (unresolvedAudits.size > 0) {
    fail(`audit targets do not resolve locally: ${uniqueSorted([...unresolvedAudits.values()].map((event) => event.target_id)).join(", ")}`);
  }
  for (const [id, owner] of ownerById) {
    const kind = kindById.get(id) ?? "graph entity";
    if (owner.accountId !== requestedAccountId) {
      fail(`${kind} ${id} resolves to account ${owner.accountId}, not ${requestedAccountId}`);
    }
    if (owner.teamId !== requestedTeamId) {
      fail(`${kind} ${id} resolves to team ${owner.teamId}, not ${requestedTeamId}`);
    }
  }
}

export const assertTargetedBriefOwnershipIsolation =
  assertTargetedBriefSingleAccountIsolation;

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
      activity: source.status === "active" ? "active" : "inactive_provenance",
      ownership: {
        team_id: claim.team_id,
        account_id: claim.account_id,
      },
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

function assertGovernedRequestReferences(
  bundle: GraphBundle,
  target: TargetedBriefRequest,
): void {
  const selectedObjectIds = new Set(target.selection.account_object_ids);
  const supportingLinks = new Set(
    bundle.account_object_claims
      .filter(
        (relationship) =>
          relationship.relationship === "primary" ||
          relationship.relationship === "supporting",
      )
      .map((relationship) => `${relationship.account_object_id}\0${relationship.claim_id}`),
  );
  const assertObject = (objectId: string, field: string): void => {
    if (!selectedObjectIds.has(objectId)) {
      throw new Error(`${field} references account object ${objectId} outside the human selection`);
    }
  };
  const assertPair = (objectId: string, claimId: string, field: string): void => {
    if (!supportingLinks.has(`${objectId}\0${claimId}`)) {
      throw new Error(`${field} references ${objectId}/${claimId} without an explicit supporting assertion relationship`);
    }
  };

  if (target.kind === "ciso_meeting") {
    for (const context of target.meeting.fact_contexts ?? []) {
      assertObject(context.account_object_id, "meeting fact context");
      for (const claimId of context.claim_ids) {
        assertPair(context.account_object_id, claimId, "meeting fact context");
      }
    }
    return;
  }

  for (const mapping of target.response.requirement_mappings ?? []) {
    for (const objectId of mapping.account_object_ids) {
      assertObject(objectId, `requirement mapping ${mapping.requirement_ref}`);
    }
    for (const claimId of mapping.claim_ids) {
      if (
        !mapping.account_object_ids.some((objectId) =>
          supportingLinks.has(`${objectId}\0${claimId}`),
        )
      ) {
        throw new Error(
          `requirement mapping ${mapping.requirement_ref} claim ${claimId} has no governed supporting relationship to its mapped account objects`,
        );
      }
    }
  }
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
  assertTargetedBriefSingleAccountIsolation(
    bundle,
    target.account_id,
    target.authority.team_id,
  );
  assertGovernedRequestReferences(bundle, target);

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
        .filter(
          (relationship) =>
            relationship.account_object_id === object.id &&
            (relationship.relationship === "primary" ||
              relationship.relationship === "supporting"),
        )
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
        (item) => item.relationship === "supports" && item.activity === "active",
      );
      const contradictions = evidence.filter(
        (item) => item.relationship === "contradicts" && item.activity === "active",
      );
      const inactiveEvidence = evidence.filter(
        (item) => item.activity === "inactive_provenance",
      );

      let claimIsRenderable = true;
      if (claim.provenance_status === "unsupported") {
        addGap(gaps, "unsupported_claim_rejected", claim.id);
        claimIsRenderable = false;
      } else if (!SUPPORTED_PROVENANCE.has(claim.provenance_status)) {
        addGap(gaps, "trust_not_ready", claim.id);
        claimIsRenderable = false;
      }
      if (claim.status !== "active") {
        addGap(gaps, "record_not_active", claim.id, evidence);
        claimIsRenderable = false;
      }
      if (supports.length === 0) {
        addGap(gaps, "missing_accepted_evidence", claim.id, evidence);
        claimIsRenderable = false;
      }
      if (contradictions.length > 0) {
        addGap(gaps, "accepted_contradiction", claim.id, [...supports, ...contradictions]);
      }
      if (!claimIsRenderable) continue;

      acceptedClaims.push(claim);
      acceptedEvidence.push(...supports, ...contradictions, ...inactiveEvidence);
    }

    if (!renderableObject || acceptedClaims.length === 0) {
      addGap(gaps, "selected_target_not_supported", object.id);
      continue;
    }

    const evidenceByKey = new Map<string, TargetedBriefEvidenceReference>();
    for (const evidence of acceptedEvidence) evidenceByKey.set(evidenceKey(evidence), evidence);
    const allEvidence = [...evidenceByKey.values()].sort(compareEvidence);
    const evidence = allEvidence.filter((item) => item.activity === "active");
    const inactiveEvidence = allEvidence.filter(
      (item) => item.activity === "inactive_provenance",
    );
    const trust = trustForAssertion(
      object,
      acceptedClaims,
      evidence.some((item) => item.relationship === "contradicts"),
    );
    assertions.push({
      id: object.id,
      ownership: {
        team_id: target.authority.team_id,
        account_id: target.account_id,
      },
      section: LENS_BY_OBJECT_TYPE[object.object_type],
      object_type: object.object_type,
      statement: uniqueSorted(acceptedClaims.map((claim) => claim.text)).join(" "),
      claim_ids: uniqueSorted(acceptedClaims.map((claim) => claim.id)),
      ...trust,
      confidence: object.confidence,
      evidence,
      inactive_evidence: inactiveEvidence,
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

function evidenceGapAction(gaps: readonly TargetedBriefEvidenceGap[]): string | null {
  const first = gaps[0];
  if (!first) return null;
  switch (first.reason) {
    case "accepted_contradiction":
      return "Resolve the accepted contradictory evidence before using the affected point.";
    case "missing_accepted_evidence":
      return "Add active accepted supporting evidence for the first selected point that currently has none.";
    case "record_not_active":
      return "Replace or reactivate the first inactive selected record before using it.";
    case "trust_not_ready":
      return "Complete trust review for the first selected point that is not ready.";
    case "unsupported_claim_rejected":
      return "Supply governed supporting evidence for the first unsupported selected point.";
    case "selected_target_not_supported":
      return "Choose a selected point with an explicit supporting claim and active accepted evidence.";
  }
}

function meetingPreparation(
  request: TargetedCisoMeetingRequest,
  assertions: readonly TargetedBriefAssertion[],
  evidenceGaps: readonly TargetedBriefEvidenceGap[],
): {
  readonly gaps: readonly string[];
  readonly nextAction: string;
} {
  const contexts = request.meeting.fact_contexts ?? [];
  const contextByFact = new Map<string, TargetedCisoFactContext>();
  for (const context of contexts) {
    for (const claimId of context.claim_ids) {
      contextByFact.set(`${context.account_object_id}\0${claimId}`, context);
    }
  }
  const gaps: string[] = [];
  let nextAction: string | null = null;
  for (const assertion of assertions) {
    for (const claimId of assertion.claim_ids) {
      const context = contextByFact.get(`${assertion.id}\0${claimId}`);
      const fact = assertion.evidence.find(
        (item) => item.relationship === "supports" && item.claim.id === claimId,
      )?.claim.text ?? assertion.statement;
      if (!context) {
        gaps.push(`Team-provided meeting context is missing for: ${fact}`);
        nextAction ??= `Add why the selected fact matters for this meeting: ${fact}`;
        continue;
      }
      if (!context.why_it_matters) {
        gaps.push(`The team has not said why this fact matters for the meeting: ${fact}`);
        nextAction ??= `Add why the selected fact matters for this meeting: ${fact}`;
      }
      if (!context.question_to_ask) {
        gaps.push(`The team has not supplied a question to ask about: ${fact}`);
        nextAction ??= `Add a meeting question for the selected fact: ${fact}`;
      }
      if (!context.desired_outcome) {
        gaps.push(`The team has not supplied a desired outcome for: ${fact}`);
        nextAction ??= `Add the desired meeting outcome for the selected fact: ${fact}`;
      }
    }
  }
  const contested = assertions.find((assertion) => assertion.state === "contested");
  nextAction ??= contested
    ? `Resolve the contradictory evidence for this selected fact before the meeting: ${contested.statement}`
    : null;
  nextAction ??= evidenceGapAction(evidenceGaps);
  const firstQuestion = contexts.find((context) => context.question_to_ask)?.question_to_ask;
  nextAction ??= firstQuestion
    ? `Ask the team-provided meeting question: ${firstQuestion}`
    : "Add team-provided context for the first selected fact before the meeting.";
  return { gaps, nextAction };
}

function rfxPreparation(
  request: TargetedProposalRfxRequest,
  assertions: readonly TargetedBriefAssertion[],
  evidenceGaps: readonly TargetedBriefEvidenceGap[],
): {
  readonly gaps: readonly string[];
  readonly nextAction: string;
} {
  const mappings = request.response.requirement_mappings ?? [];
  const renderedClaims = new Set(assertions.flatMap((assertion) => assertion.claim_ids));
  const contestedClaims = new Set(
    assertions
      .filter((assertion) => assertion.state === "contested")
      .flatMap((assertion) => assertion.claim_ids),
  );
  const gaps: string[] = [];
  let nextAction: string | null = null;
  if (mappings.length === 0) {
    gaps.push("The response team has not supplied a governed requirement mapping.");
    nextAction = "Add the first requirement mapping with its governed claim and account-object references.";
  }
  for (const mapping of mappings) {
    const missingEvidence = mapping.claim_ids.some((claimId) => !renderedClaims.has(claimId));
    if (missingEvidence) {
      gaps.push(
        `${mapping.requirement_ref} maps to a claim that lacks active accepted support and cannot establish the response point.`,
      );
      nextAction ??= `Add active accepted proof or narrow the response point for ${mapping.requirement_ref}.`;
    }
    if (mapping.claim_ids.some((claimId) => contestedClaims.has(claimId))) {
      gaps.push(
        `${mapping.requirement_ref} relies on a contested assertion and needs clarification before drafting.`,
      );
      nextAction ??= `Resolve the contested assertion mapped to ${mapping.requirement_ref}.`;
    }
    if (!mapping.gap_or_limitation) {
      gaps.push(
        `${mapping.requirement_ref} is missing a team-provided gap, limitation, or clarification note.`,
      );
      nextAction ??= `Add the gap, limitation, or clarification needed for ${mapping.requirement_ref}.`;
    } else {
      nextAction ??= `Resolve the stated limitation for ${mapping.requirement_ref}: ${mapping.gap_or_limitation}`;
    }
  }
  nextAction ??= evidenceGapAction(evidenceGaps);
  nextAction ??= "Add a governed requirement mapping before drafting a response point.";
  return { gaps, nextAction };
}

function buildBrief(
  state: LoadedFixtureState,
  selection: TargetedBriefSelectionResult,
): TargetedBrief {
  const kind = selection.request.kind;
  const sections = SECTION_COPY[kind]
    .map((section) => ({
      ...section,
      assertion_ids: selection.assertions
        .filter((assertion) => assertion.section === section.key)
        .map((assertion) => assertion.id),
    }))
    .filter((section) => section.assertion_ids.length > 0);
  const preparation = kind === "ciso_meeting"
    ? meetingPreparation(
        selection.request as TargetedCisoMeetingRequest,
        selection.assertions,
        selection.evidence_gaps,
      )
    : rfxPreparation(
        selection.request as TargetedProposalRfxRequest,
        selection.assertions,
        selection.evidence_gaps,
      );
  const meetingContexts =
    selection.request.kind === "ciso_meeting"
      ? selection.request.meeting.fact_contexts ?? []
      : [];
  const rfxMappings =
    selection.request.kind === "proposal_rfx"
      ? selection.request.response.requirement_mappings ?? []
      : [];
  const brief = deepFreeze<TargetedBrief>({
    schema_version: TARGETED_BRIEF_SCHEMA_VERSION,
    kind,
    title: kind === "ciso_meeting" ? "Targeted CISO meeting brief" : "Proposal / RFI / RFP targeted brief",
    authority: selection.request.authority,
    account_id: selection.request.account_id,
    target: selection.request,
    target_relevance: {
      status: "caller_workflow_context_only",
      evidence_gap:
        (kind === "ciso_meeting" ? meetingContexts.length : rfxMappings.length) > 0
          ? null
          : TARGET_RELEVANCE_GAP[kind],
    },
    input: state.input,
    summary: `${selection.assertions.length} selected evidence-backed ${selection.assertions.length === 1 ? "point" : "points"} for ${kind === "ciso_meeting" ? "meeting preparation" : "response planning"}.`,
    next_safe_action: preparation.nextAction,
    assertions: selection.assertions,
    sections,
    meeting_contexts: meetingContexts,
    rfx_mappings: rfxMappings,
    preparation_gaps: preparation.gaps,
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
  const activityLabel =
    evidence.activity === "active" ? "Active current record" : "Inactive provenance only";
  return `<div class="evidence-packet evidence-${escapeHtml(evidence.relationship)}">
          <p class="evidence-label">${relationshipLabel} · ${activityLabel} · accepted literal excerpt</p>
          <dl>
            <dt>Claim under review</dt><dd>${escapeHtml(evidence.claim.text)}</dd>
            <dt>Accepted excerpt</dt><dd><blockquote>${escapeHtml(evidence.excerpt.text)}</blockquote></dd>
            <dt>Source</dt><dd>${sourceTitle} · ${escapeHtml(evidence.source.publisher ?? "Publisher not supplied")} · ${escapeHtml(evidence.source.reliability)} reliability · ${escapeHtml(evidence.source.status)} record</dd>
            <dt>Source record timestamp</dt><dd>${escapeHtml(evidence.source.fetched_at)}</dd>
            <dt>Evidence current through</dt><dd>Not supplied by source</dd>
            <dt>Ownership binding</dt><dd>Team <code>${escapeHtml(evidence.ownership.team_id)}</code> · account <code>${escapeHtml(evidence.ownership.account_id)}</code></dd>
            <dt>Internal references</dt><dd>Claim <code>${escapeHtml(evidence.claim.id)}</code> · excerpt <code>${escapeHtml(evidence.excerpt.id)}</code> · source <code>${escapeHtml(evidence.source.id)}</code></dd>
          </dl>
        </div>`;
}

function renderAssertion(assertion: TargetedBriefAssertion): string {
  return `<article class="assertion">
      <div class="assertion-heading">
        <div>
          <p class="kicker">Selected evidence-backed fact</p>
          <h3>${escapeHtml(assertion.statement)}</h3>
        </div>
        <span class="trust trust-${escapeHtml(assertion.provenance_status)}">${escapeHtml(assertion.trust_label)}</span>
      </div>
    </article>`;
}

function renderSection(brief: TargetedBrief, section: TargetedBriefSection): string {
  const assertions = brief.assertions.filter((assertion) => assertion.section === section.key);
  if (assertions.length === 0) return "";
  return `<section class="brief-section">
      <header><div><p class="kicker">${escapeHtml(section.purpose)}</p><h2>${escapeHtml(section.title)}</h2></div></header>
      ${assertions.map(renderAssertion).join("\n")}
    </section>`;
}

function assertionClaimText(
  brief: TargetedBrief,
  objectId: string,
  claimIds: readonly string[],
): string {
  const claimIdSet = new Set(claimIds);
  const texts = brief.assertions
    .filter((assertion) => assertion.id === objectId)
    .flatMap((assertion) =>
      assertion.evidence
        .filter(
          (evidence) =>
            evidence.relationship === "supports" &&
            claimIdSet.has(evidence.claim.id),
        )
        .map((evidence) => evidence.claim.text),
    );
  return uniqueSorted(texts).join(" ");
}

function renderMeetingPreparation(brief: TargetedBrief): string {
  if (brief.kind !== "ciso_meeting" || brief.meeting_contexts.length === 0) return "";
  const cards = brief.meeting_contexts.flatMap((context) => {
    const fact = assertionClaimText(
      brief,
      context.account_object_id,
      context.claim_ids,
    );
    if (!fact) return [];
    const fields = [
      context.why_it_matters
        ? `<dt>Why it matters for this meeting</dt><dd>${escapeHtml(context.why_it_matters)}</dd>`
        : "",
      context.question_to_ask
        ? `<dt>Question to ask</dt><dd>${escapeHtml(context.question_to_ask)}</dd>`
        : "",
      context.desired_outcome
        ? `<dt>Desired meeting outcome</dt><dd>${escapeHtml(context.desired_outcome)}</dd>`
        : "",
    ].filter(Boolean).join("\n");
    return [`<article class="context-card">
        <p class="team-label">Team-provided meeting context · not a discovered account fact</p>
        <h3>${escapeHtml(fact)}</h3>
        ${fields ? `<dl>${fields}</dl>` : ""}
      </article>`];
  });
  if (cards.length === 0) return "";
  return `<section class="support-panel">
      <p class="kicker">Prepare for the conversation</p>
      <h2>Meeting questions and outcomes</h2>
      ${cards.join("\n")}
    </section>`;
}

function renderRfxMappings(brief: TargetedBrief): string {
  if (brief.kind !== "proposal_rfx" || brief.rfx_mappings.length === 0) return "";
  return `<section class="support-panel">
      <p class="kicker">Team-provided response planning</p>
      <h2>Requirement mappings</h2>
      <p class="mapping-caution">A related capability is not a compliance claim. Treat requirement satisfaction as unconfirmed unless the governed evidence directly establishes it.</p>
      ${brief.rfx_mappings
        .map(
          (mapping) => `<article class="mapping-card">
        <p class="team-label">Team-provided mapping · not a discovered account fact</p>
        <h3>${escapeHtml(mapping.requirement_ref)}</h3>
        <dl>
          <dt>Supplied requirement</dt><dd>${escapeHtml(mapping.requirement_text)}</dd>
          <dt>Supported response point</dt><dd>${escapeHtml(mapping.supported_response_point)}</dd>
          <dt>Available evidence / proof</dt><dd>${escapeHtml(mapping.available_evidence)}</dd>
          ${mapping.gap_or_limitation ? `<dt>Gap, limitation, or clarification needed</dt><dd>${escapeHtml(mapping.gap_or_limitation)}</dd>` : ""}
        </dl>
      </article>`,
        )
        .join("\n")}
    </section>`;
}

function renderMaterialGaps(brief: TargetedBrief): string {
  const messages = [
    ...brief.preparation_gaps,
    ...brief.evidence_gaps.map((gap) => gap.message),
  ];
  if (messages.length === 0) return "";
  return `<section class="support-panel gaps-panel">
      <p class="kicker">What still needs attention</p>
      <h2>Material gaps</h2>
      <ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("\n")}</ul>
    </section>`;
}

function renderPurpose(brief: TargetedBrief): string {
  if (brief.target.kind === "ciso_meeting") {
    return `<section class="purpose-panel">
      <p class="kicker">Purpose · team-provided, not an account fact</p>
      <h2>${escapeHtml(brief.target.meeting.objective)}</h2>
      <p><strong>Audience:</strong> ${escapeHtml(brief.target.meeting.audience)}</p>
    </section>`;
  }
  return `<section class="purpose-panel">
      <p class="kicker">Purpose · team-provided, not an account fact</p>
      <h2>${escapeHtml(brief.target.response.objective)}</h2>
      <p><strong>${escapeHtml(brief.target.response.type)} context:</strong> ${escapeHtml(brief.target.response.requirement_context)}</p>
    </section>`;
}

function renderAssertionEvidence(assertion: TargetedBriefAssertion): string {
  const activeEvidence = assertion.evidence.map(renderSource).join("\n");
  const inactiveEvidence = assertion.inactive_evidence.length > 0
    ? `<section class="inactive-provenance">
          <h4>Inactive material retained as provenance only</h4>
          <p>This material does not support or contradict the current assertion.</p>
          ${assertion.inactive_evidence.map(renderSource).join("\n")}
        </section>`
    : "";
  return `<details class="assertion-evidence">
      <summary aria-label="Evidence for assertion: ${escapeHtml(assertion.statement)}">Evidence for: ${escapeHtml(assertion.statement)}</summary>
      <p class="ownership-note">Governed assertion binding · team <code>${escapeHtml(assertion.ownership.team_id)}</code> · account <code>${escapeHtml(assertion.ownership.account_id)}</code> · object <code>${escapeHtml(assertion.id)}</code> · claims ${assertion.claim_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</p>
      ${activeEvidence}
      ${inactiveEvidence}
    </details>`;
}

function renderEvidenceAndProvenance(brief: TargetedBrief): string {
  const assertionNames = brief.assertions.map((assertion) => assertion.statement).join("; ");
  const retainedGaps = brief.evidence_gaps.flatMap((gap) => {
    if (gap.retained_evidence.length === 0) return [];
    return [`<section class="retained-gap">
        <h3>${escapeHtml(gap.message)}</h3>
        <p>Internal omitted references: ${gap.omitted_item_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</p>
        ${gap.retained_evidence.map(renderSource).join("\n")}
      </section>`];
  });
  const governedReferences = brief.target.kind === "ciso_meeting"
    ? brief.meeting_contexts
        .map(
          (context) =>
            `<li>Meeting context: object <code>${escapeHtml(context.account_object_id)}</code> · claims ${context.claim_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</li>`,
        )
        .join("\n")
    : brief.rfx_mappings
        .map(
          (mapping) =>
            `<li>${escapeHtml(mapping.requirement_ref)}: objects ${mapping.account_object_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")} · claims ${mapping.claim_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</li>`,
        )
        .join("\n");
  return `<details class="evidence-provenance">
      <summary aria-label="Evidence and provenance for selected assertions: ${escapeHtml(assertionNames || "none rendered")}">Evidence and provenance</summary>
      <h2 class="print-only">Evidence and provenance</h2>
      ${brief.assertions.map(renderAssertionEvidence).join("\n")}
      ${retainedGaps.join("\n")}
      <section class="provenance-metadata">
        <h3>Authority and governed selection</h3>
        <dl>
          <dt>Team / workspace authority</dt><dd><code>${escapeHtml(brief.authority.team_id)}</code></dd>
          <dt>Account</dt><dd><code>${escapeHtml(brief.account_id)}</code></dd>
          <dt>Selected account objects</dt><dd>${brief.target.selection.account_object_ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}</dd>
        </dl>
        ${governedReferences ? `<ul>${governedReferences}</ul>` : ""}
        <h3>Validated local fixture identity</h3>
        <p>Validated local fixture bytes only. Authoritative tracked-blob identity was not proven in this environment.</p>
        <dl>
          <dt>Repository-relative local path</dt><dd><code>${escapeHtml(brief.input.ref)}</code></dd>
          <dt>Loaded bytes SHA-256</dt><dd><code>${escapeHtml(brief.input.sha256)}</code></dd>
          <dt>Loaded byte length</dt><dd>${brief.input.byte_length}</dd>
          <dt>GraphBundle validation</dt><dd>${escapeHtml(brief.input.validation)}</dd>
          <dt>Tracked-blob proof</dt><dd>${escapeHtml(brief.input.tracked_blob_proof)}</dd>
        </dl>
        <h3>Generation boundary</h3>
        <p>Read-only generation. No provider call, network acquisition, production write, submission, or external action.</p>
      </section>
    </details>`;
}

export function renderTargetedBriefHtml(brief: TargetedBrief): string {
  if (!renderableBriefs.has(brief)) {
    throw new Error("only a brief built from a validated local fixture may be rendered");
  }
  if (brief.schema_version !== TARGETED_BRIEF_SCHEMA_VERSION) {
    throw new Error("unsupported targeted brief schema version");
  }
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
    main { width: min(1040px, 100%); margin: 0 auto; padding: 32px 22px 56px; }
    .hero { background: linear-gradient(135deg, #13243f, #1f4a5d); color: #f7fbff; border-radius: 24px; padding: 30px; box-shadow: 0 18px 55px rgba(19, 36, 63, .16); }
    .hero h1 { margin: 8px 0; max-width: 760px; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.04; }
    .hero .summary { max-width: 700px; font-size: 1.08rem; color: #e4f0f7; }
    .kicker { margin: 0 0 6px; color: #52617a; font-size: .76rem; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
    .hero .kicker { color: #b9e2e9; }
    .next-action { margin: 18px 0 0; padding: 14px 16px; border-left: 4px solid #85d7c4; background: rgba(255,255,255,.1); }
    .purpose-panel, .brief-section, .support-panel, .evidence-provenance { margin-top: 20px; border: 1px solid #ccd8e5; border-radius: 20px; padding: 20px; background: #fff; }
    .brief-section > header { border-bottom: 1px solid #e1e8f0; padding-bottom: 12px; }
    h2 { margin: 0; font-size: 1.35rem; }
    h3 { line-height: 1.35; }
    .assertion, .context-card, .mapping-card { margin-top: 14px; border: 1px solid #d5e0ea; border-radius: 16px; padding: 16px; background: #fbfdff; break-inside: avoid; }
    .assertion-heading { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
    .assertion h3, .context-card h3, .mapping-card h3 { margin: 0; font-size: 1.08rem; }
    .trust, .team-label { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: .78rem; font-weight: 750; }
    .trust { flex: 0 0 auto; }
    .trust-verified { color: #0b573f; background: #dff6ed; }
    .trust-source_document_only { color: #174a6e; background: #e0f0fb; }
    .trust-contested { color: #762c16; background: #ffe2d7; }
    .team-label { margin: 0 0 9px; color: #604100; background: #ffefbd; }
    .mapping-caution, .gaps-panel { border-left: 4px solid #d7795c; }
    .mapping-caution { padding: 10px 12px; background: #fff4ef; color: #65301f; }
    details { margin-top: 20px; }
    summary { cursor: pointer; color: #0f536a; font-weight: 750; }
    summary:focus-visible, a:focus-visible { outline: 3px solid #e0a31a; outline-offset: 3px; border-radius: 3px; }
    .evidence-provenance > summary { font-size: 1.12rem; }
    .assertion-evidence { border-top: 1px solid #dce5ee; padding-top: 12px; }
    .evidence-packet { margin-top: 12px; border-left: 3px solid #5596aa; padding: 4px 0 4px 14px; break-inside: avoid; }
    .evidence-contradicts { border-left-color: #c65f40; }
    .evidence-label { color: #45546b; font-weight: 750; }
    .inactive-provenance { margin-top: 16px; padding: 12px; border: 1px dashed #7b8798; background: #f4f5f7; }
    .ownership-note { color: #52617a; }
    dl { display: grid; grid-template-columns: minmax(190px, .35fr) minmax(0, 1fr); gap: 8px 14px; }
    dt { color: #52617a; font-weight: 750; }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    blockquote { margin: 0; }
    code { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 5px; border-radius: 5px; background: #e9eff5; overflow-wrap: anywhere; }
    a { color: #0f536a; }
    .unsafe-url { color: #942f2f; }
    ul { margin: 12px 0 0; padding-left: 20px; }
    li + li { margin-top: 10px; }
    .print-only { display: none; }
    footer { margin-top: 22px; color: #52617a; font-size: .86rem; text-align: center; }
    @media (max-width: 760px) {
      main { padding: 16px 14px 36px; }
      .hero { padding: 22px 18px; border-radius: 18px; }
      .assertion-heading { flex-direction: column; }
      dl { grid-template-columns: 1fr; }
      dt { margin-top: 6px; }
    }
    @media print {
      :root { background: #fff; color: #000; }
      main { width: 100%; padding: 0; }
      .hero, .purpose-panel, .brief-section, .support-panel, .evidence-provenance { box-shadow: none; border-color: #777; }
      .hero { background: #fff; color: #000; }
      .hero .summary, .hero .kicker { color: #222; }
      details, details:not([open]), details[open] { display: block; }
      details > *, details:not([open]) > * { display: block !important; }
      details::details-content { content-visibility: visible !important; }
      summary { display: block !important; color: #000; list-style: none; break-after: avoid; }
      .evidence-provenance > summary { display: none !important; }
      .print-only { display: block; }
      h1, h2, h3, h4, summary { break-after: avoid; }
      section, article, .evidence-packet, dl, blockquote { break-inside: avoid; }
      a[href]::after { content: " (" attr(href) ")"; overflow-wrap: anywhere; }
      .next-action, .mapping-caution, .gaps-panel { border-color: #333; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="kicker">Atliera · targeted preparation</p>
      <h1>${escapeHtml(brief.title)}</h1>
      <p class="summary">${escapeHtml(brief.summary)}</p>
      <p class="next-action"><strong>Next safe action:</strong> ${escapeHtml(brief.next_safe_action)}</p>
    </section>
    ${renderPurpose(brief)}
    ${brief.sections.map((section) => renderSection(brief, section)).join("\n")}
    ${renderMeetingPreparation(brief)}
    ${renderRfxMappings(brief)}
    ${renderMaterialGaps(brief)}
    ${renderEvidenceAndProvenance(brief)}
    <footer>Prepared for human use from selected, evidence-backed content.</footer>
  </main>
</body>
</html>`.replace(/[ \t]+$/gm, "");
}
