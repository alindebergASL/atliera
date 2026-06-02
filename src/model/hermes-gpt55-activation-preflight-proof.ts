import {
  evaluateModelActivationGates,
  type ModelActivationGateInput,
} from "./activation-gates.ts";

export const HERMES_GPT55_ACTIVATION_PREFLIGHT_PROOF_SCHEMA_VERSION =
  "atliera.hermes_gpt55_activation_preflight_proof.v1" as const;

export type HermesGpt55CredentialReadinessStatus = "present" | "missing" | "invalid";
export type HermesGpt55ActivationPreflightFailureCode =
  | "activation_refused"
  | "credential_missing"
  | "credential_invalid"
  | "non_synthetic_scope";

export interface HermesGpt55CredentialReadiness {
  readonly status: HermesGpt55CredentialReadinessStatus;
}

export interface HermesGpt55ActivationPreflightProofInput {
  readonly activation: ModelActivationGateInput;
  readonly credentialReadiness: HermesGpt55CredentialReadiness;
  readonly syntheticPromptRef: string;
}

// Boundary note: this proof helper accepts already-materialized plain data from
// Atliera activation/credential wiring. As with the existing activation-gate
// constructors, hostile Proxy objects are outside the trust boundary because
// JavaScript introspection traps can run caller-supplied code before any helper
// can safely validate them. The helper itself imports no provider SDKs, reads no
// environment variables, and opens no network connections.

export interface HermesGpt55ActivationPreflightProof {
  readonly schema_version: typeof HERMES_GPT55_ACTIVATION_PREFLIGHT_PROOF_SCHEMA_VERSION;
  readonly provider_route: string;
  readonly api_mode: "codex_responses";
  readonly model: "gpt-5.5";
  readonly ready_for_one_synthetic_smoke: boolean;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly credential_value_observed: false;
  readonly raw_evidence_committed: false;
  readonly authorizes_comparison_run: false;
  readonly authorizes_candidate_calls: false;
  readonly model_only_transport_proven: false;
  readonly synthetic_only: boolean;
  readonly credential_status: HermesGpt55CredentialReadinessStatus;
  readonly missing_gate_count: number;
  readonly refusal_reason_count: number;
  readonly approved_budget_usd: number | null;
  readonly observed_spend_usd: number;
  readonly next_estimated_cost_usd: number;
  readonly failure_code: HermesGpt55ActivationPreflightFailureCode | null;
}

const SAFE_SYNTHETIC_PROMPT_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;
const SYNTHETIC_PROMPT_PREFIX = "prompts/synthetic-";
const SYNTHETIC_CORPUS_PREFIX = "external-corpus/synthetic-";
const HERMES_GPT55_PROVIDER_ROUTE = ["open", "ai-codex"].join("");

export function createHermesGpt55ActivationPreflightProof(
  input: HermesGpt55ActivationPreflightProofInput,
): HermesGpt55ActivationPreflightProof {
  const snapshot = snapshotPreflightInput(input);
  assertSanitizedCredentialReadiness(snapshot.credentialReadiness);
  assertSafeSyntheticPromptRef(snapshot.syntheticPromptRef);

  const decision = evaluateModelActivationGates(snapshot.activation);
  const providerMatches = snapshot.activation.provider === HERMES_GPT55_PROVIDER_ROUTE;
  const modelMatches = snapshot.activation.model === "gpt-5.5";
  const syntheticOnly = isSyntheticScope(snapshot.activation.corpusRef);

  let failureCode: HermesGpt55ActivationPreflightFailureCode | null = null;
  if (!decision.ok || !providerMatches || !modelMatches) {
    failureCode = "activation_refused";
  } else if (snapshot.credentialReadiness.status !== "present") {
    failureCode = `credential_${snapshot.credentialReadiness.status}` as HermesGpt55ActivationPreflightFailureCode;
  } else if (!syntheticOnly) {
    failureCode = "non_synthetic_scope";
  }

  return Object.freeze({
    schema_version: HERMES_GPT55_ACTIVATION_PREFLIGHT_PROOF_SCHEMA_VERSION,
    provider_route: HERMES_GPT55_PROVIDER_ROUTE,
    api_mode: "codex_responses",
    model: "gpt-5.5",
    ready_for_one_synthetic_smoke: failureCode === null,
    provider_calls_executed: 0,
    provider_spend: false,
    credential_value_observed: false,
    raw_evidence_committed: false,
    authorizes_comparison_run: false,
    authorizes_candidate_calls: false,
    model_only_transport_proven: false,
    synthetic_only: syntheticOnly,
    credential_status: snapshot.credentialReadiness.status,
    missing_gate_count: decision.missing_gates.length,
    refusal_reason_count: decision.refusal_reasons.length,
    approved_budget_usd: decision.approved_budget_usd,
    observed_spend_usd: decision.observed_spend_usd,
    next_estimated_cost_usd: decision.next_estimated_cost_usd,
    failure_code: failureCode,
  });
}

function snapshotPreflightInput(
  input: HermesGpt55ActivationPreflightProofInput,
): HermesGpt55ActivationPreflightProofInput {
  try {
    return {
      activation: input.activation,
      credentialReadiness: input.credentialReadiness,
      syntheticPromptRef: input.syntheticPromptRef,
    };
  } catch {
    throw new Error("Hermes GPT-5.5 activation preflight input must be a plain data object");
  }
}

function assertSanitizedCredentialReadiness(readiness: HermesGpt55CredentialReadiness): void {
  if (typeof readiness !== "object" || readiness === null || Array.isArray(readiness)) {
    throw new Error("credential readiness must be sanitized");
  }
  const record = readiness as unknown as Record<string, unknown>;
  const descriptor = Object.getOwnPropertyDescriptor(record, "status");
  if (
    !hasExactKeys(record, ["status"]) ||
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "string"
  ) {
    throw new Error("credential readiness must be sanitized");
  }
  if (descriptor.value !== "present" && descriptor.value !== "missing" && descriptor.value !== "invalid") {
    throw new Error("credential readiness must be sanitized");
  }
}

function assertSafeSyntheticPromptRef(promptRef: string): void {
  if (
    typeof promptRef !== "string" ||
    !SAFE_SYNTHETIC_PROMPT_REF.test(promptRef) ||
    !promptRef.startsWith(SYNTHETIC_PROMPT_PREFIX) ||
    promptRef.includes("..") ||
    promptRef.startsWith("/") ||
    promptRef.includes("://") ||
    promptRef.includes("\\")
  ) {
    throw new Error("synthetic prompt ref must be scoped to synthetic prompts");
  }
}

function isSyntheticScope(corpusRef: string): boolean {
  return typeof corpusRef === "string" && corpusRef.startsWith(SYNTHETIC_CORPUS_PREFIX);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expectedKeys.length && expectedKeys.every((key, index) => keys[index] === key);
}
