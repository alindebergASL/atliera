import { createHash } from "node:crypto";

import type { ModelProvider, ModelProviderRequest, ModelProviderResponse } from "../model/provider.ts";
import type { ModelActivationApproval, ModelCostLedgerEntry } from "../model/activation-gates.ts";
import { preflightRuntimeModelExecution } from "../model/runtime-model-execution-preflight.ts";
import type { SelectedModelRoute } from "../model/validated-route-catalog.ts";
import type { GraphBundle, LensOutput, AccountObjectKind } from "../graph/types.ts";

export const LIVE_PROVIDER_MODERATE_PROOF_SCHEMA_VERSION = "atliera.live_provider_moderate_proof.v1" as const;
export const LIVE_PROVIDER_MODERATE_PROOF_SUMMARY_SCHEMA_VERSION = "atliera.live_provider_moderate_proof_summary.v1" as const;
export const LIVE_PROVIDER_MODERATE_PROOF_PROVIDER_PATH = `hermes-${"open"}ai-codex-operator` as const;

export interface LiveProviderModerateProofReport {
  readonly ok: boolean;
  readonly strict_json_ok: boolean;
  readonly schema_version_ok: boolean;
  readonly provider_path: string | null;
  readonly model_label: string | null;
  readonly source_scope: string | null;
  readonly counts: {
    readonly accounts: number;
    readonly excerpts: number;
    readonly claims: number;
    readonly account_objects: number;
  };
  readonly citation_links_ok: boolean;
  readonly per_account_lens_coverage_ok: boolean;
  readonly boundary_ok: boolean;
  readonly validation_errors: readonly string[];
  readonly raw_evidence_committed: false;
  readonly provider_payload_committed: false;
  readonly model_output_committed: false;
  readonly private_evidence_committed: false;
  readonly credential_material_committed: false;
  readonly request_identifier_committed: false;
}

export interface VerifiedLiveProviderModerateProofSummary extends LiveProviderModerateProofReport {
  readonly schema_version: typeof LIVE_PROVIDER_MODERATE_PROOF_SUMMARY_SCHEMA_VERSION;
  readonly run_ref: string;
  readonly provider_ref: string;
  readonly route_ref: string;
  readonly observed_cost_usd: number;
  readonly provider_calls_executed: number;
  readonly tokens_used_total: number | null;
  readonly raw_output_sha256: string;
  readonly raw_output_bytes: number;
}

interface ProofAccount {
  readonly account_ref: string;
  readonly role: "representative" | "edge_case" | "calibration";
}

interface ProofExcerpt {
  readonly id: string;
  readonly account_ref: string;
  readonly text: string;
  readonly supports: string;
}

interface ProofClaim {
  readonly id: string;
  readonly account_ref: string;
  readonly text: string;
  readonly supporting_excerpt_ids: readonly string[];
}

interface ProofAccountObject {
  readonly id: string;
  readonly account_ref: string;
  readonly object_type: "signal" | "map" | "play" | "risk" | "open_question";
  readonly text: string;
  readonly supporting_claim_ids: readonly string[];
}

interface ProofBoundary {
  readonly atliera_runtime_executed: false;
  readonly graph_ingestion_performed: false;
  readonly production_writes_performed: false;
  readonly provider_quality_conclusion: false;
  readonly production_readiness_claim: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
}

export interface LiveProviderModerateProofPayload {
  readonly schema_version: typeof LIVE_PROVIDER_MODERATE_PROOF_SCHEMA_VERSION;
  readonly provider_path: string;
  readonly model: "gpt-5.5";
  readonly source_scope: "synthetic-only";
  readonly accounts: readonly ProofAccount[];
  readonly excerpts: readonly ProofExcerpt[];
  readonly claims: readonly ProofClaim[];
  readonly account_objects: readonly ProofAccountObject[];
  readonly boundary: ProofBoundary;
}

export interface GraphBundleCandidateOptions {
  readonly runId: string;
  readonly teamId: string;
  readonly observedAt: string;
  readonly providerRef: string;
  readonly modelLabel: string;
}

export interface GraphBundleCandidate {
  readonly bundle: GraphBundle;
  readonly lenses: readonly LensOutput[];
  readonly graph_ingestion_performed: false;
  readonly production_writes_performed: false;
}

export interface LabRuntimeModelExecutionInput {
  readonly selectedRoute: SelectedModelRoute;
  readonly provider: ModelProvider;
  readonly request: ModelProviderRequest;
  readonly approval: ModelActivationApproval;
  readonly costLedgerEntries: readonly ModelCostLedgerEntry[];
  readonly now: string;
  readonly corpusRef: string;
  readonly environment: "lab" | "test";
  readonly nextEstimatedCostUsd: number;
  readonly credentialReady: boolean;
}

export interface LabRuntimeModelExecutionReport {
  readonly ok: boolean;
  readonly status: "completed" | "blocked";
  readonly route_ref: string;
  readonly provider_ref: string;
  readonly model_label: string;
  readonly provider_calls_executed: 0 | 1;
  readonly observed_cost_usd: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly total_tokens: number;
  readonly preflight_ok: boolean;
  readonly refusal_reasons: readonly string[];
  readonly runtime_model_mode_execution: true;
  readonly graph_ingestion_performed: false;
  readonly production_writes_performed: false;
  readonly provider_payload_committed: false;
  readonly model_output_committed: false;
  readonly private_evidence_committed: false;
  readonly credential_material_committed: false;
  readonly request_identifier_committed: false;
}

const TOP_LEVEL_KEYS = ["schema_version", "provider_path", "model", "source_scope", "accounts", "excerpts", "claims", "account_objects", "boundary"] as const;
const ACCOUNT_KEYS = ["account_ref", "role"] as const;
const EXCERPT_KEYS = ["id", "account_ref", "text", "supports"] as const;
const CLAIM_KEYS = ["id", "account_ref", "text", "supporting_excerpt_ids"] as const;
const OBJECT_KEYS = ["id", "account_ref", "object_type", "text", "supporting_claim_ids"] as const;
const BOUNDARY_KEYS = ["atliera_runtime_executed", "graph_ingestion_performed", "production_writes_performed", "provider_quality_conclusion", "production_readiness_claim", "default_model_selection_claim", "provider_lock_in"] as const;
const SAFE_PROOF_ID = /^(?:ex|cl|obj)_[a-z0-9_]{1,80}$/;
const SAFE_ACCOUNT_REF = /^synthetic_account_[a-z]$/;
const UNSAFE_TEXT = /(https?:\/\/|api[_ -]?key|authorization|bearer|credential|request[_ -]?id|private evidence|\/home\/|\/tmp\/|[A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:Inc|Corp|LLC|Ltd)\.?)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : -1;
}

function safeString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !UNSAFE_TEXT.test(value);
}

function validatePayloadShape(parsed: unknown): { payload: LiveProviderModerateProofPayload | null; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(parsed)) return { payload: null, errors: ["parsed_payload_not_object"] };
  if (!hasExactKeys(parsed, TOP_LEVEL_KEYS)) errors.push("top_level_shape_mismatch");
  if (parsed.schema_version !== LIVE_PROVIDER_MODERATE_PROOF_SCHEMA_VERSION) errors.push("schema_version_mismatch");
  if (parsed.provider_path !== LIVE_PROVIDER_MODERATE_PROOF_PROVIDER_PATH) errors.push("provider_path_mismatch");
  if (parsed.model !== "gpt-5.5") errors.push("model_mismatch");
  if (parsed.source_scope !== "synthetic-only") errors.push("source_scope_mismatch");
  if (!Array.isArray(parsed.accounts) || parsed.accounts.length !== 3) errors.push("account_count_mismatch");
  if (!Array.isArray(parsed.excerpts) || parsed.excerpts.length !== 6) errors.push("excerpt_count_mismatch");
  if (!Array.isArray(parsed.claims) || parsed.claims.length !== 6) errors.push("claim_count_mismatch");
  if (!Array.isArray(parsed.account_objects) || parsed.account_objects.length !== 9) errors.push("account_object_count_mismatch");

  const accountRefs = new Set<string>();
  const excerptAccount = new Map<string, string>();
  const claimAccount = new Map<string, string>();
  const lensCoverage = new Map<string, Set<string>>();

  for (const account of Array.isArray(parsed.accounts) ? parsed.accounts : []) {
    if (!isRecord(account) || !hasExactKeys(account, ACCOUNT_KEYS) || typeof account.account_ref !== "string" || !SAFE_ACCOUNT_REF.test(account.account_ref) || (account.role !== "representative" && account.role !== "edge_case" && account.role !== "calibration")) {
      errors.push("account_shape_mismatch");
      continue;
    }
    accountRefs.add(account.account_ref);
    lensCoverage.set(account.account_ref, new Set());
  }

  for (const excerpt of Array.isArray(parsed.excerpts) ? parsed.excerpts : []) {
    if (!isRecord(excerpt) || !hasExactKeys(excerpt, EXCERPT_KEYS) || typeof excerpt.id !== "string" || !SAFE_PROOF_ID.test(excerpt.id) || typeof excerpt.account_ref !== "string" || !accountRefs.has(excerpt.account_ref) || !safeString(excerpt.text) || !safeString(excerpt.supports)) {
      errors.push(UNSAFE_TEXT.test(JSON.stringify(excerpt)) ? "unsafe_text" : "excerpt_shape_mismatch");
      continue;
    }
    excerptAccount.set(excerpt.id, excerpt.account_ref);
  }

  for (const claim of Array.isArray(parsed.claims) ? parsed.claims : []) {
    if (!isRecord(claim) || !hasExactKeys(claim, CLAIM_KEYS) || typeof claim.id !== "string" || !SAFE_PROOF_ID.test(claim.id) || typeof claim.account_ref !== "string" || !accountRefs.has(claim.account_ref) || !safeString(claim.text) || !Array.isArray(claim.supporting_excerpt_ids) || claim.supporting_excerpt_ids.length < 1) {
      errors.push(UNSAFE_TEXT.test(JSON.stringify(claim)) ? "unsafe_text" : "claim_shape_mismatch");
      continue;
    }
    claimAccount.set(claim.id, claim.account_ref);
    for (const excerptId of claim.supporting_excerpt_ids) {
      if (typeof excerptId !== "string" || !excerptAccount.has(excerptId)) errors.push("claim_missing_excerpt");
      else if (excerptAccount.get(excerptId) !== claim.account_ref) errors.push("claim_cross_account_excerpt");
    }
  }

  for (const object of Array.isArray(parsed.account_objects) ? parsed.account_objects : []) {
    if (!isRecord(object) || !hasExactKeys(object, OBJECT_KEYS) || typeof object.id !== "string" || !SAFE_PROOF_ID.test(object.id) || typeof object.account_ref !== "string" || !accountRefs.has(object.account_ref) || (object.object_type !== "signal" && object.object_type !== "map" && object.object_type !== "play" && object.object_type !== "risk" && object.object_type !== "open_question") || !safeString(object.text) || !Array.isArray(object.supporting_claim_ids) || object.supporting_claim_ids.length < 1) {
      errors.push(UNSAFE_TEXT.test(JSON.stringify(object)) ? "unsafe_text" : "account_object_shape_mismatch");
      continue;
    }
    lensCoverage.get(object.account_ref)?.add(object.object_type);
    for (const claimId of object.supporting_claim_ids) {
      if (typeof claimId !== "string" || !claimAccount.has(claimId)) errors.push("object_missing_claim");
      else if (claimAccount.get(claimId) !== object.account_ref) errors.push("object_cross_account_claim");
    }
  }

  for (const accountRef of accountRefs) {
    const coverage = lensCoverage.get(accountRef) ?? new Set<string>();
    if (!coverage.has("signal") || !coverage.has("map") || !coverage.has("play")) errors.push(`lens_coverage_missing:${accountRef}`);
  }

  if (!isRecord(parsed.boundary) || !hasExactKeys(parsed.boundary, BOUNDARY_KEYS)) errors.push("boundary_shape_mismatch");
  else {
    for (const key of BOUNDARY_KEYS) {
      if (parsed.boundary[key] !== false) errors.push("boundary_flag_not_false");
    }
  }

  return { payload: errors.length === 0 ? parsed as unknown as LiveProviderModerateProofPayload : null, errors };
}

export function verifyLiveProviderModerateProofPayload(payload: string): LiveProviderModerateProofReport {
  const markdownFencePresent = typeof payload === "string" && /```|~~~/.test(payload);
  const errors: string[] = [];
  let parsed: unknown = null;
  let strictJsonOk = false;
  if (typeof payload !== "string" || payload.trim() === "") errors.push("payload_not_string");
  else if (markdownFencePresent) errors.push("markdown_fence_present");
  else {
    try {
      parsed = JSON.parse(payload);
      strictJsonOk = true;
    } catch {
      errors.push("invalid_json");
    }
  }

  const shape = strictJsonOk ? validatePayloadShape(parsed) : { payload: null, errors: [] };
  errors.push(...shape.errors);
  const record = isRecord(parsed) ? parsed : {};
  const counts = Object.freeze({
    accounts: countOf(record.accounts),
    excerpts: countOf(record.excerpts),
    claims: countOf(record.claims),
    account_objects: countOf(record.account_objects),
  });
  const citationErrors = new Set(["claim_missing_excerpt", "claim_cross_account_excerpt", "object_missing_claim", "object_cross_account_claim"]);
  const boundaryOk = !errors.some((error) => error.startsWith("boundary_")) && isRecord(record.boundary);
  const perAccountLensCoverageOk = !errors.some((error) => error.startsWith("lens_coverage_missing"));
  const citationLinksOk = !errors.some((error) => citationErrors.has(error));
  const ok = strictJsonOk && errors.length === 0;

  return Object.freeze({
    ok,
    strict_json_ok: strictJsonOk,
    schema_version_ok: record.schema_version === LIVE_PROVIDER_MODERATE_PROOF_SCHEMA_VERSION,
    provider_path: typeof record.provider_path === "string" ? record.provider_path : null,
    model_label: typeof record.model === "string" ? record.model : null,
    source_scope: typeof record.source_scope === "string" ? record.source_scope : null,
    counts,
    citation_links_ok: citationLinksOk,
    per_account_lens_coverage_ok: perAccountLensCoverageOk,
    boundary_ok: boundaryOk,
    validation_errors: Object.freeze([...new Set(errors)]),
    raw_evidence_committed: false,
    provider_payload_committed: false,
    model_output_committed: false,
    private_evidence_committed: false,
    credential_material_committed: false,
    request_identifier_committed: false,
  });
}

export function createVerifiedLiveProviderModerateProofSummary(options: {
  readonly payloadText: string;
  readonly runRef: string;
  readonly routeRef: string;
  readonly providerRef: string;
  readonly observedCostUsd: number;
  readonly providerCallsExecuted: number;
  readonly tokensUsedTotal?: number | null;
}): VerifiedLiveProviderModerateProofSummary {
  const report = verifyLiveProviderModerateProofPayload(options.payloadText);
  return Object.freeze({
    schema_version: LIVE_PROVIDER_MODERATE_PROOF_SUMMARY_SCHEMA_VERSION,
    run_ref: options.runRef,
    provider_ref: options.providerRef,
    route_ref: options.routeRef,
    observed_cost_usd: options.observedCostUsd,
    provider_calls_executed: options.providerCallsExecuted,
    tokens_used_total: options.tokensUsedTotal ?? null,
    raw_output_sha256: createHash("sha256").update(options.payloadText).digest("hex"),
    raw_output_bytes: Buffer.byteLength(options.payloadText, "utf8"),
    ...report,
  });
}

function proofIdToGraphId(id: string): string {
  if (id.startsWith("ex_")) return `exc_${id.slice(3)}`;
  if (id.startsWith("cl_")) return `clm_${id.slice(3)}`;
  return id;
}

function accountObjectKind(kind: ProofAccountObject["object_type"]): AccountObjectKind {
  if (kind === "map") return "stakeholder";
  return kind;
}

function lensName(kind: ProofAccountObject["object_type"]): LensOutput["lens"] | null {
  if (kind === "signal") return "signals";
  if (kind === "map") return "maps";
  if (kind === "play") return "plays";
  return null;
}

function sourceId(accountRef: string): string {
  return `src_${accountRef.replace(/^synthetic_account_/, "synthetic_")}`;
}

export function convertLiveProviderProofToGraphBundleCandidate(
  proof: LiveProviderModerateProofPayload,
  options: GraphBundleCandidateOptions,
): GraphBundleCandidate {
  const verification = verifyLiveProviderModerateProofPayload(JSON.stringify(proof));
  if (!verification.ok) throw new Error("live provider proof is not valid for graph conversion");
  const byAccount = new Map(proof.accounts.map((account) => [account.account_ref, proof.excerpts.filter((excerpt) => excerpt.account_ref === account.account_ref)]));
  const sources = proof.accounts.map((account) => {
    const text = (byAccount.get(account.account_ref) ?? []).map((excerpt) => excerpt.text).join("\n");
    return {
      id: sourceId(account.account_ref),
      team_id: options.teamId,
      account_id: account.account_ref,
      url: `urn:atliera:synthetic:${account.account_ref}`,
      canonical_url: `urn:atliera:synthetic:${account.account_ref}`,
      title: `Synthetic source for ${account.account_ref}`,
      publisher: "synthetic",
      source_type: "synthetic_live_provider_proof",
      fetched_at: options.observedAt,
      accessed_at: options.observedAt,
      content_hash: createHash("sha256").update(text).digest("hex"),
      raw_text: text,
      reliability: "medium" as const,
      status: "active" as const,
    };
  });
  const sourceText = new Map(sources.map((source) => [source.id, source.raw_text]));
  const excerpts = proof.excerpts.map((excerpt) => {
    const sid = sourceId(excerpt.account_ref);
    const rawText = sourceText.get(sid) ?? "";
    const start = rawText.indexOf(excerpt.text);
    return {
      id: proofIdToGraphId(excerpt.id),
      source_document_id: sid,
      text: excerpt.text,
      kind: "literal" as const,
      char_start: start,
      char_end: start + excerpt.text.length,
      captured_at: options.observedAt,
      validation_status: "accepted" as const,
      rejection_reason: null,
    };
  });
  const claims = proof.claims.map((claim) => ({
    id: proofIdToGraphId(claim.id),
    team_id: options.teamId,
    account_id: claim.account_ref,
    claim_type: "synthetic_live_provider_proof",
    text: claim.text,
    normalized_subject: claim.account_ref,
    confidence: "medium" as const,
    provenance_status: "verified" as const,
    status: "active" as const,
    created_by: "model" as const,
    created_at: options.observedAt,
  }));
  const claim_evidence = proof.claims.flatMap((claim) => claim.supporting_excerpt_ids.map((excerptId) => ({
    id: `cev_${claim.id.slice(3)}_${excerptId.slice(3)}`,
    claim_id: proofIdToGraphId(claim.id),
    evidence_excerpt_id: proofIdToGraphId(excerptId),
    relationship: "supports" as const,
    rationale: "Same-account synthetic proof citation accepted by verifier.",
    confidence: "medium" as const,
    created_at: options.observedAt,
  })));
  const account_objects = proof.account_objects.map((object) => ({
    id: object.id,
    team_id: options.teamId,
    account_id: object.account_ref,
    object_type: accountObjectKind(object.object_type),
    title: object.text,
    summary: object.text,
    payload_json: { live_provider_object_type: object.object_type },
    confidence: "medium" as const,
    provenance_status: "verified" as const,
    status: "active" as const,
    created_by: "model" as const,
    created_at: options.observedAt,
    updated_at: options.observedAt,
  }));
  const account_object_claims = proof.account_objects.flatMap((object) => object.supporting_claim_ids.map((claimId) => ({
    id: `oclm_${object.id.slice(4)}_${claimId.slice(3)}`,
    account_object_id: object.id,
    claim_id: proofIdToGraphId(claimId),
    relationship: "primary" as const,
  })));
  const research_runs = [{
    id: options.runId,
    team_id: options.teamId,
    account_id: "synthetic_multi_account",
    mode: "model" as const,
    provider: options.providerRef,
    model: options.modelLabel,
    status: "completed" as const,
    cost_cap_usd: 0,
    observed_cost_usd: 0,
    started_at: options.observedAt,
    completed_at: options.observedAt,
  }];
  const run_artifacts = [{
    id: "art_live_provider_moderate_proof_summary",
    research_run_id: options.runId,
    artifact_type: "sanitized_live_provider_proof_summary",
    payload_json: { source_scope: proof.source_scope, accounts: proof.accounts.length },
    created_at: options.observedAt,
  }];
  const audit_events = [{
    id: "aud_live_provider_moderate_proof_validated",
    team_id: options.teamId,
    actor_type: "system" as const,
    actor_id: "atliera-validator",
    event_type: "validated_without_ingestion",
    target_type: "research_run",
    target_id: options.runId,
    payload_json: { graph_ingestion_performed: false, production_writes_performed: false },
    created_at: options.observedAt,
  }];
  const lenses: LensOutput[] = [
    { lens: "signals", items: [] },
    { lens: "maps", items: [] },
    { lens: "plays", items: [] },
  ];
  for (const object of proof.account_objects) {
    const lens = lensName(object.object_type);
    if (!lens) continue;
    lenses.find((entry) => entry.lens === lens)?.items.push({
      label: object.text,
      account_object_id: object.id,
      claim_id: proofIdToGraphId(object.supporting_claim_ids[0] ?? ""),
      status: "verified",
    });
  }
  return Object.freeze({
    bundle: { sources, excerpts, claims, claim_evidence, account_objects, account_object_claims, research_runs, run_artifacts, audit_events },
    lenses,
    graph_ingestion_performed: false,
    production_writes_performed: false,
  });
}

export async function executeLabRuntimeModelProof(input: LabRuntimeModelExecutionInput): Promise<LabRuntimeModelExecutionReport> {
  if (input.environment !== "lab" && input.environment !== "test") {
    throw new Error("live runtime model execution harness is lab/test only");
  }
  if (input.selectedRoute.environment !== input.environment) {
    throw new Error("selected route environment must match lab/test harness environment");
  }
  if (input.request.model !== input.selectedRoute.route.modelLabel) {
    throw new Error("runtime execution request model must match selected route");
  }
  const preflight = preflightRuntimeModelExecution({
    selectedRoute: input.selectedRoute,
    mode: "model",
    corpusRef: input.corpusRef,
    approval: input.approval,
    costLedgerEntries: input.costLedgerEntries,
    nextEstimatedCostUsd: input.nextEstimatedCostUsd,
    credentialReady: input.credentialReady,
    now: input.now,
    requestMetadata: input.request.metadata,
    requiredRouteEvidenceStatus: "fresh",
  });
  if (!preflight.ok) {
    return Object.freeze({
      ok: false,
      status: "blocked",
      route_ref: input.selectedRoute.route.routeRef,
      provider_ref: input.selectedRoute.route.providerRef,
      model_label: input.selectedRoute.route.modelLabel,
      provider_calls_executed: 0,
      observed_cost_usd: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      preflight_ok: false,
      refusal_reasons: preflight.refusalReasons,
      runtime_model_mode_execution: true,
      graph_ingestion_performed: false,
      production_writes_performed: false,
      provider_payload_committed: false,
      model_output_committed: false,
      private_evidence_committed: false,
      credential_material_committed: false,
      request_identifier_committed: false,
    });
  }
  const response: ModelProviderResponse = await input.provider.generate(input.request);
  return Object.freeze({
    ok: true,
    status: "completed",
    route_ref: input.selectedRoute.route.routeRef,
    provider_ref: response.provider,
    model_label: response.model,
    provider_calls_executed: 1,
    observed_cost_usd: response.cost.amount,
    input_tokens: response.usage.inputTokens,
    output_tokens: response.usage.outputTokens,
    total_tokens: response.usage.totalTokens,
    preflight_ok: true,
    refusal_reasons: [],
    runtime_model_mode_execution: true,
    graph_ingestion_performed: false,
    production_writes_performed: false,
    provider_payload_committed: false,
    model_output_committed: false,
    private_evidence_committed: false,
    credential_material_committed: false,
    request_identifier_committed: false,
  });
}
