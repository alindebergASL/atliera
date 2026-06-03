export type RuntimeModelOnlyLiveProofOutcome = "blocked" | "exception" | "completed";

export interface RuntimeModelOnlyLiveProofStatusInput {
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelLabel: string;
  readonly status: RuntimeModelOnlyLiveProofOutcome;
  readonly reasonCode: string;
  readonly providerCallsExecuted: number;
  readonly observedCostUsd: number;
  readonly approvedMaxCostUsd: number;
  readonly acceptedOutputReceived: boolean;
  readonly stableErrorCode: string | null;
}

export interface RuntimeModelOnlyLiveProofStatus {
  readonly status: RuntimeModelOnlyLiveProofOutcome;
  readonly reason_code: string;
  readonly route_ref: string;
  readonly provider_ref: string;
  readonly model_label: string;
  readonly provider_calls_executed: 0 | 1;
  readonly provider_spend: boolean;
  readonly observed_cost_usd: number;
  readonly approved_max_cost_usd: number;
  readonly accepted_output_received: boolean;
  readonly stable_error_code: string | null;
  readonly raw_request_committed: false;
  readonly raw_response_committed: false;
  readonly model_output_committed: false;
  readonly private_evidence_committed: false;
  readonly credential_value_observed: false;
  readonly authorizes_provider_call: false;
  readonly authorizes_candidate_calls: false;
  readonly authorizes_comparison_run: false;
  readonly default_model_selection_claim: false;
  readonly provider_lock_in: false;
  readonly production_readiness_claim: false;
  readonly product_readiness_claim: false;
  readonly launch_readiness_claim: false;
  readonly retry_requires_new_approval: true;
}

const INPUT_KEYS = [
  "acceptedOutputReceived",
  "approvedMaxCostUsd",
  "modelLabel",
  "observedCostUsd",
  "providerCallsExecuted",
  "providerRef",
  "reasonCode",
  "routeRef",
  "stableErrorCode",
  "status",
];
const STATUS_KEYS = [
  "accepted_output_received",
  "approved_max_cost_usd",
  "authorizes_candidate_calls",
  "authorizes_comparison_run",
  "authorizes_provider_call",
  "credential_value_observed",
  "default_model_selection_claim",
  "launch_readiness_claim",
  "model_label",
  "model_output_committed",
  "observed_cost_usd",
  "private_evidence_committed",
  "product_readiness_claim",
  "production_readiness_claim",
  "provider_calls_executed",
  "provider_lock_in",
  "provider_ref",
  "provider_spend",
  "raw_request_committed",
  "raw_response_committed",
  "reason_code",
  "retry_requires_new_approval",
  "route_ref",
  "stable_error_code",
  "status",
];
const SAFE_LOGICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

function snapshotExactOwnDataObject(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(label);
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error(label);
    if (Object.getOwnPropertySymbols(value).length > 0) throw new Error(label);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const descriptor of Object.values(descriptors)) {
      if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) throw new Error(label);
    }
    const actual = Object.keys(descriptors).sort();
    const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(label);
    return Object.freeze(Object.fromEntries(keys.map((key) => [key, descriptors[key]?.value])));
  } catch {
    throw new Error(label);
  }
}

function assertSafeLogicalId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SAFE_LOGICAL_ID.test(value) || value.includes("..") || value.includes("://") || value.includes("\\")) throw new Error(label);
}

function assertSafeNullableCode(value: unknown, label: string): asserts value is string | null {
  if (value === null) return;
  assertSafeLogicalId(value, label);
}

function snapshotInput(input: RuntimeModelOnlyLiveProofStatusInput): RuntimeModelOnlyLiveProofStatusInput {
  const snapshot = snapshotExactOwnDataObject(input, INPUT_KEYS, "runtime model-only live proof status input rejected");
  const routeRef = snapshot.routeRef;
  const providerRef = snapshot.providerRef;
  const modelLabel = snapshot.modelLabel;
  const reasonCode = snapshot.reasonCode;
  const stableErrorCode = snapshot.stableErrorCode;
  const status = snapshot.status;
  const providerCallsExecuted = snapshot.providerCallsExecuted;
  const observedCostUsd = snapshot.observedCostUsd;
  const approvedMaxCostUsd = snapshot.approvedMaxCostUsd;
  const acceptedOutputReceived = snapshot.acceptedOutputReceived;
  assertSafeLogicalId(routeRef, "runtime model-only live proof status input rejected");
  assertSafeLogicalId(providerRef, "runtime model-only live proof status input rejected");
  assertSafeLogicalId(modelLabel, "runtime model-only live proof status input rejected");
  assertSafeLogicalId(reasonCode, "runtime model-only live proof status input rejected");
  assertSafeNullableCode(stableErrorCode, "runtime model-only live proof status input rejected");
  if (status !== "blocked" && status !== "exception" && status !== "completed") throw new Error("runtime model-only live proof status input rejected");
  if (typeof providerCallsExecuted !== "number") throw new Error("runtime model-only live proof status input rejected");
  if (typeof observedCostUsd !== "number") throw new Error("runtime model-only live proof status input rejected");
  if (typeof approvedMaxCostUsd !== "number") throw new Error("runtime model-only live proof status input rejected");
  if (typeof acceptedOutputReceived !== "boolean") throw new Error("runtime model-only live proof status input rejected");
  return Object.freeze({
    routeRef,
    providerRef,
    modelLabel,
    status,
    reasonCode,
    providerCallsExecuted,
    observedCostUsd,
    approvedMaxCostUsd,
    acceptedOutputReceived,
    stableErrorCode,
  });
}

function assertAccounting(input: RuntimeModelOnlyLiveProofStatusInput): void {
  if (input.providerCallsExecuted !== 0 && input.providerCallsExecuted !== 1) throw new Error("runtime model-only live proof status accounting rejected");
  if (typeof input.approvedMaxCostUsd !== "number" || !Number.isFinite(input.approvedMaxCostUsd) || input.approvedMaxCostUsd <= 0 || input.approvedMaxCostUsd > 1) throw new Error("runtime model-only live proof status accounting rejected");
  if (typeof input.observedCostUsd !== "number" || !Number.isFinite(input.observedCostUsd) || input.observedCostUsd < 0 || input.observedCostUsd > input.approvedMaxCostUsd) throw new Error("runtime model-only live proof status accounting rejected");
  if (input.status === "blocked" && (input.providerCallsExecuted !== 0 || input.acceptedOutputReceived || input.stableErrorCode !== null)) throw new Error("runtime model-only live proof status accounting rejected");
  if (input.status === "completed" && (input.providerCallsExecuted !== 1 || !input.acceptedOutputReceived || input.stableErrorCode !== null)) throw new Error("runtime model-only live proof status accounting rejected");
  if (input.status === "exception" && input.acceptedOutputReceived) throw new Error("runtime model-only live proof status accounting rejected");
}

function snapshotStatusForRender(
  status: RuntimeModelOnlyLiveProofStatus,
): RuntimeModelOnlyLiveProofStatus {
  const snapshot = snapshotExactOwnDataObject(status, STATUS_KEYS, "runtime model-only live proof status render input rejected");
  assertSafeLogicalId(snapshot.route_ref, "runtime model-only live proof status render input rejected");
  assertSafeLogicalId(snapshot.provider_ref, "runtime model-only live proof status render input rejected");
  assertSafeLogicalId(snapshot.model_label, "runtime model-only live proof status render input rejected");
  assertSafeLogicalId(snapshot.reason_code, "runtime model-only live proof status render input rejected");
  assertSafeNullableCode(snapshot.stable_error_code, "runtime model-only live proof status render input rejected");
  if (snapshot.status !== "blocked" && snapshot.status !== "exception" && snapshot.status !== "completed") throw new Error("runtime model-only live proof status render input rejected");
  if (snapshot.provider_calls_executed !== 0 && snapshot.provider_calls_executed !== 1) throw new Error("runtime model-only live proof status render input rejected");
  if (typeof snapshot.approved_max_cost_usd !== "number" || !Number.isFinite(snapshot.approved_max_cost_usd) || snapshot.approved_max_cost_usd <= 0 || snapshot.approved_max_cost_usd > 1) throw new Error("runtime model-only live proof status render input rejected");
  if (typeof snapshot.observed_cost_usd !== "number" || !Number.isFinite(snapshot.observed_cost_usd) || snapshot.observed_cost_usd < 0 || snapshot.observed_cost_usd > snapshot.approved_max_cost_usd) throw new Error("runtime model-only live proof status render input rejected");
  if (typeof snapshot.accepted_output_received !== "boolean") throw new Error("runtime model-only live proof status render input rejected");
  if (snapshot.provider_spend !== (snapshot.observed_cost_usd > 0)) throw new Error("runtime model-only live proof status render input rejected");
  if (snapshot.status === "blocked" && (snapshot.provider_calls_executed !== 0 || snapshot.accepted_output_received || snapshot.stable_error_code !== null)) throw new Error("runtime model-only live proof status render input rejected");
  if (snapshot.status === "completed" && (snapshot.provider_calls_executed !== 1 || !snapshot.accepted_output_received || snapshot.stable_error_code !== null)) throw new Error("runtime model-only live proof status render input rejected");
  if (snapshot.status === "exception" && snapshot.accepted_output_received) throw new Error("runtime model-only live proof status render input rejected");
  for (const key of ["raw_request_committed", "raw_response_committed", "model_output_committed", "private_evidence_committed", "credential_value_observed", "authorizes_provider_call", "authorizes_candidate_calls", "authorizes_comparison_run", "default_model_selection_claim", "provider_lock_in", "production_readiness_claim", "product_readiness_claim", "launch_readiness_claim"] as const) {
    if (snapshot[key] !== false) throw new Error("runtime model-only live proof status render input rejected");
  }
  if (snapshot.retry_requires_new_approval !== true) throw new Error("runtime model-only live proof status render input rejected");
  // snapshotExactOwnDataObject already returned a frozen plain object built
  // from the validated own-data descriptor values. Returning it here ensures
  // the renderer reads from the sanitized snapshot instead of re-invoking
  // the original status object (which could be Proxy-backed and inject
  // unsafe markdown via a hostile get trap after validation passes).
  return snapshot as unknown as RuntimeModelOnlyLiveProofStatus;
}

export function createRuntimeModelOnlyLiveProofStatus(input: RuntimeModelOnlyLiveProofStatusInput): RuntimeModelOnlyLiveProofStatus {
  const snapshot = snapshotInput(input);
  assertAccounting(snapshot);
  const providerCallsExecuted = snapshot.providerCallsExecuted as 0 | 1;
  return Object.freeze({
    status: snapshot.status,
    reason_code: snapshot.reasonCode,
    route_ref: snapshot.routeRef,
    provider_ref: snapshot.providerRef,
    model_label: snapshot.modelLabel,
    provider_calls_executed: providerCallsExecuted,
    provider_spend: snapshot.observedCostUsd > 0,
    observed_cost_usd: snapshot.observedCostUsd,
    approved_max_cost_usd: snapshot.approvedMaxCostUsd,
    accepted_output_received: snapshot.acceptedOutputReceived,
    stable_error_code: snapshot.stableErrorCode,
    raw_request_committed: false,
    raw_response_committed: false,
    model_output_committed: false,
    private_evidence_committed: false,
    credential_value_observed: false,
    authorizes_provider_call: false,
    authorizes_candidate_calls: false,
    authorizes_comparison_run: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
    production_readiness_claim: false,
    product_readiness_claim: false,
    launch_readiness_claim: false,
    retry_requires_new_approval: true,
  });
}

export function renderRuntimeModelOnlyLiveProofStatusMarkdown(status: RuntimeModelOnlyLiveProofStatus): string {
  // Take a sanitized descriptor snapshot first, then render exclusively
  // from that frozen plain object — never from the original `status`
  // input after validation.
  const snapshot = snapshotStatusForRender(status);
  return `# Runtime Model-Only Live Proof Status\n\nStatus: ${snapshot.status}\n\n## Sanitized outcome\n\n- route_ref: ${snapshot.route_ref}\n- provider_ref: ${snapshot.provider_ref}\n- model_label: ${snapshot.model_label}\n- reason_code: ${snapshot.reason_code}\n- stable_error_code: ${snapshot.stable_error_code ?? "none"}\n- provider_calls_executed: ${snapshot.provider_calls_executed}\n- provider_spend: ${snapshot.provider_spend}\n- observed_cost_usd: ${snapshot.observed_cost_usd}\n- approved_max_cost_usd: ${snapshot.approved_max_cost_usd}\n- accepted_output_received: ${snapshot.accepted_output_received}\n- raw_request_committed: false\n- raw_response_committed: false\n- model_output_committed: false\n- private_evidence_committed: false\n- credential_value_observed: false\n\n## Interpretation limits\n\n- authorizes_provider_call: false\n- authorizes_candidate_calls: false\n- authorizes_comparison_run: false\n- default_model_selection_claim: false\n- provider_lock_in: false\n- production_readiness_claim: false\n- product_readiness_claim: false\n- launch_readiness_claim: false\n\n## Follow-up\n\n- retry_requires_new_approval: true\n- no automatic retry\n`;
}
