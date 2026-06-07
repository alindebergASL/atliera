import {
  evaluateModelActivationGates,
  type ModelActivationApproval,
  type ModelCostLedgerEntry,
} from "./activation-gates.ts";
import type { RuntimeMode } from "../modes/index.ts";
import type { SelectedModelRoute, SelectedRouteEvidenceStatus } from "./validated-route-catalog.ts";

export interface RuntimeModelExecutionPreflightInput {
  readonly selectedRoute: SelectedModelRoute;
  readonly mode: RuntimeMode;
  readonly corpusRef: string;
  readonly approval: ModelActivationApproval | null;
  readonly costLedgerEntries: readonly ModelCostLedgerEntry[];
  readonly nextEstimatedCostUsd: number;
  readonly credentialReady: boolean;
  readonly now: string;
  readonly requestMetadata: Record<string, string>;
}

export interface RuntimeModelExecutionPreflightDecision {
  readonly ok: boolean;
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly refusalReasons: readonly string[];
  readonly activationMissingGates: readonly string[];
  readonly activationRefusalReasons: readonly string[];
  readonly credentialReady: boolean;
  readonly routeEvidenceStatus: SelectedRouteEvidenceStatus;
  readonly routeEvidenceExpiresAt: string;
  readonly routeRequiresFreshApprovalBeforeUse: boolean;
  readonly routeUsableWithoutRevalidation: boolean;
  readonly providerCallsExecuted: 0;
  readonly providerSpend: false;
  readonly authorizesProviderCall: false;
  readonly runtimeModelModeIntegration: false;
  readonly defaultModelSelectionClaim: false;
  readonly providerLockIn: false;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const FORBIDDEN_METADATA_KEYS = new Set([
  "tool",
  "tools",
  "shell",
  "file",
  "files",
  "web",
  "web_search",
  "plugin",
  "plugins",
  "retrieval",
  "mcp",
]);

function snapshotMetadata(metadata: Record<string, string>): Record<string, string> | string {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "metadata must be a plain record";
  }
  const symbols = Object.getOwnPropertySymbols(metadata);
  if (symbols.length > 0) return "metadata symbol fields rejected";
  const descriptors = Object.getOwnPropertyDescriptors(metadata);
  const snapshot: Record<string, string> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) return "metadata non-enumerable fields rejected";
    if ("get" in descriptor || "set" in descriptor) return "metadata accessor rejected";
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) return `forbidden metadata key rejected: ${key}`;
    if (typeof descriptor.value !== "string") return "metadata values must be strings";
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function parseStrictIsoInstant(value: string): number | null {
  if (!ISO_INSTANT.test(value)) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== value) return null;
  return parsed;
}

function computeRouteEvidenceStatusAtPreflight(
  selectedRoute: SelectedModelRoute,
  now: string,
): SelectedRouteEvidenceStatus | "invalid-route-evidence-timestamp" {
  const nowMs = parseStrictIsoInstant(now);
  const expiresMs = parseStrictIsoInstant(selectedRoute.routeEvidenceExpiresAt);
  if (nowMs === null || expiresMs === null || selectedRoute.route.evidenceExpiresAt !== selectedRoute.routeEvidenceExpiresAt) {
    return "invalid-route-evidence-timestamp";
  }
  if (expiresMs < nowMs) return "expired-needs-revalidation";
  return selectedRoute.routeEvidenceStatus;
}

export function preflightRuntimeModelExecution(
  input: RuntimeModelExecutionPreflightInput,
): RuntimeModelExecutionPreflightDecision {
  const metadata = snapshotMetadata(input.requestMetadata);
  const localRefusals: string[] = [];
  const routeEvidenceStatusAtPreflight = computeRouteEvidenceStatusAtPreflight(input.selectedRoute, input.now);
  if (typeof metadata === "string") localRefusals.push(metadata);
  if (!input.credentialReady) localRefusals.push("credential readiness is required before runtime model execution");
  if (routeEvidenceStatusAtPreflight === "invalid-route-evidence-timestamp") {
    localRefusals.push("route evidence timestamp invalid before runtime model execution");
  }
  if (routeEvidenceStatusAtPreflight === "expired-needs-revalidation" || input.selectedRoute.routeRequiresFreshApprovalBeforeUse || !input.selectedRoute.routeUsableWithoutRevalidation) {
    localRefusals.push("route evidence expired requires revalidation before runtime model execution");
  }
  if (input.selectedRoute.runtimeModelModeIntegration !== false) localRefusals.push("selected route cannot authorize runtime integration");
  if (input.selectedRoute.defaultModelSelectionClaim !== false) localRefusals.push("selected route cannot claim default model selection");
  if (input.selectedRoute.providerLockIn !== false) localRefusals.push("selected route cannot claim provider lock-in");

  const activation = evaluateModelActivationGates({
    mode: input.mode,
    provider: input.selectedRoute.route.providerRef,
    model: input.selectedRoute.route.modelLabel,
    corpusRef: input.corpusRef,
    approval: input.approval,
    costLedgerEntries: input.costLedgerEntries,
    nextEstimatedCostUsd: input.nextEstimatedCostUsd,
    now: input.now,
  });

  const activationMissingGates = activation.missing_gates.map(String);
  const activationRefusalReasons = activation.refusal_reasons.map(String);
  const refusalReasons = [...localRefusals, ...activationMissingGates, ...activationRefusalReasons];

  return Object.freeze({
    ok: refusalReasons.length === 0 && activation.ok,
    routeRef: input.selectedRoute.route.routeRef,
    providerRef: input.selectedRoute.route.providerRef,
    modelLabel: input.selectedRoute.route.modelLabel,
    refusalReasons: Object.freeze(refusalReasons),
    activationMissingGates: Object.freeze(activationMissingGates),
    activationRefusalReasons: Object.freeze(activationRefusalReasons),
    credentialReady: input.credentialReady,
    routeEvidenceStatus: routeEvidenceStatusAtPreflight === "invalid-route-evidence-timestamp" ? input.selectedRoute.routeEvidenceStatus : routeEvidenceStatusAtPreflight,
    routeEvidenceExpiresAt: input.selectedRoute.routeEvidenceExpiresAt,
    routeRequiresFreshApprovalBeforeUse: routeEvidenceStatusAtPreflight === "expired-needs-revalidation" ? true : input.selectedRoute.routeRequiresFreshApprovalBeforeUse,
    routeUsableWithoutRevalidation: routeEvidenceStatusAtPreflight === "expired-needs-revalidation" ? false : input.selectedRoute.routeUsableWithoutRevalidation,
    providerCallsExecuted: 0,
    providerSpend: false,
    authorizesProviderCall: false,
    runtimeModelModeIntegration: false,
    defaultModelSelectionClaim: false,
    providerLockIn: false,
  });
}
