import type { ModelActivationApproval, ModelCostLedgerEntry } from "./activation-gates.ts";
import type { ModelProviderRequest } from "./provider.ts";
import {
  createRuntimeModelOnlyTransportProof,
  type RuntimeModelOnlyInjectedCaller,
  type RuntimeModelOnlyTransportProofResult,
} from "./runtime-model-only-transport-proof.ts";
import { preflightRuntimeModelExecution } from "./runtime-model-execution-preflight.ts";
import type { SelectedModelRoute } from "./validated-route-catalog.ts";

export interface RuntimeModelOnlyCredentialReadiness {
  readonly status: "present" | "missing" | "invalid";
}

export interface RuntimeModelOnlyActivationPreflightProofInput {
  readonly selectedRoute: SelectedModelRoute;
  readonly approval: ModelActivationApproval;
  readonly request: ModelProviderRequest;
  readonly credentialReadiness: RuntimeModelOnlyCredentialReadiness;
  readonly nextEstimatedCostUsd: number;
  readonly now: string;
  readonly caller: RuntimeModelOnlyInjectedCaller;
  readonly costLedgerEntries?: readonly ModelCostLedgerEntry[];
}

export interface RuntimeModelOnlyActivationPreflightProof {
  readonly status: "ready-for-one-synthetic-live-proof";
  readonly route_ref: string;
  readonly provider_ref: string;
  readonly model_label: string;
  readonly provider_calls_executed: 0;
  readonly provider_spend: false;
  readonly authorizes_provider_call: false;
  readonly authorizes_candidate_calls: false;
  readonly authorizes_comparison_run: false;
  readonly ready_for_one_synthetic_live_proof: true;
  readonly model_only_transport_proven: false;
  readonly runtime_model_provider_implemented: false;
  readonly credential_value_observed: false;
  readonly raw_evidence_committed: false;
  readonly transport_proof: RuntimeModelOnlyTransportProofResult;
}

function assertSafeCredentialReadiness(value: RuntimeModelOnlyCredentialReadiness): RuntimeModelOnlyCredentialReadiness {
  if (value === null || typeof value !== "object") throw new Error("runtime model-only credential readiness rejected");
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) throw new Error("runtime model-only credential readiness rejected");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== 1 || keys[0] !== "status") throw new Error("runtime model-only credential readiness rejected");
  const descriptor = descriptors.status;
  if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor) {
    throw new Error("runtime model-only credential readiness rejected");
  }
  const status = descriptor.value;
  if (status !== "present" && status !== "missing" && status !== "invalid") {
    throw new Error("runtime model-only credential readiness rejected");
  }
  return Object.freeze({ status });
}

function assertSyntheticRef(value: unknown, prefix: string): asserts value is string {
  if (typeof value !== "string" || !value.startsWith(prefix) || value.includes("..") || value.includes("://") || value.includes("\\")) {
    throw new Error("runtime model-only synthetic scope rejected");
  }
}

export async function createRuntimeModelOnlyActivationPreflightProof(
  input: RuntimeModelOnlyActivationPreflightProofInput,
): Promise<RuntimeModelOnlyActivationPreflightProof> {
  assertSyntheticRef(input.approval.corpus_ref, "external-corpus/synthetic-");
  const credentialReadiness = assertSafeCredentialReadiness(input.credentialReadiness);
  assertSyntheticRef(input.request.inputGraphRef, "corpus/synthetic-");
  const promptRef = input.request.metadata.prompt_contract_ref;
  assertSyntheticRef(promptRef, "prompts/synthetic-");

  const preflight = preflightRuntimeModelExecution({
    selectedRoute: input.selectedRoute,
    mode: "model",
    corpusRef: input.approval.corpus_ref,
    approval: input.approval,
    costLedgerEntries: input.costLedgerEntries ?? [],
    nextEstimatedCostUsd: input.nextEstimatedCostUsd,
    credentialReady: credentialReadiness.status === "present",
    now: input.now,
    requestMetadata: input.request.metadata,
    requiredRouteEvidenceStatus: "fresh",
  });

  if (!preflight.ok) throw new Error("runtime model-only activation preflight refused");

  const transportProof = createRuntimeModelOnlyTransportProof({
    providerRef: input.selectedRoute.route.providerRef,
    modelLabel: input.selectedRoute.route.modelLabel,
    caller: input.caller,
  });
  const proof = await transportProof.generateNoSpendProof(input.request);

  return Object.freeze({
    status: "ready-for-one-synthetic-live-proof",
    route_ref: input.selectedRoute.route.routeRef,
    provider_ref: input.selectedRoute.route.providerRef,
    model_label: input.selectedRoute.route.modelLabel,
    provider_calls_executed: 0,
    provider_spend: false,
    authorizes_provider_call: false,
    authorizes_candidate_calls: false,
    authorizes_comparison_run: false,
    ready_for_one_synthetic_live_proof: true,
    model_only_transport_proven: false,
    runtime_model_provider_implemented: false,
    credential_value_observed: false,
    raw_evidence_committed: false,
    transport_proof: proof,
  });
}
