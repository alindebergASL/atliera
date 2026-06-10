import type { LabDeploymentTargetDescriptor } from "./lab-deployment-target.ts";

export type LabDeploymentHealthcheckAuthMode = "not-configured" | "bearer-required-without-token-material";

export interface LabDeploymentHealthcheckExpectedResponse {
  readonly statusCode: 200;
  readonly kind: "fake-mode-workshop-healthcheck";
  readonly graphSnapshotRead: false;
  readonly providerCallsMade: 0;
  readonly productionWrites: false;
  readonly deploymentReadinessClaim: false;
  readonly productionReadinessClaim: false;
}

export interface LabDeploymentHealthcheckBoundaries {
  readonly remoteProbeAllowed: false;
  readonly deploymentExecuted: false;
  readonly providerCallsAllowed: false;
  readonly graphIngestionAllowed: false;
  readonly productionWritesAllowed: false;
  readonly readinessClaimAllowed: false;
}

export interface LabDeploymentHealthcheckPlan {
  readonly kind: "lab-deployment-healthcheck-plan";
  readonly schemaVersion: "1";
  readonly targetId: string;
  readonly environment: "lab";
  readonly runtimeMode: "fake";
  readonly method: "GET";
  readonly bindHostRef: string;
  readonly port: number;
  readonly publicBaseUrlRef: string;
  readonly healthcheckPath: "/healthz";
  readonly workshopPath: "/workshop";
  readonly authMode: LabDeploymentHealthcheckAuthMode;
  readonly expected: LabDeploymentHealthcheckExpectedResponse;
  readonly boundaries: LabDeploymentHealthcheckBoundaries;
}

export interface LabDeploymentHealthcheckPlanOptions {
  readonly authMode: LabDeploymentHealthcheckAuthMode;
}

export interface LabDeploymentHealthcheckHttpResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type LabDeploymentHealthcheckFailureCode =
  | "unexpected_status_code"
  | "invalid_json_body"
  | "unexpected_response_kind"
  | "healthcheck_not_ok"
  | "graph_snapshot_was_read"
  | "provider_calls_made"
  | "production_writes_present"
  | "deployment_readiness_claim_present"
  | "production_readiness_claim_present";

export interface LabDeploymentHealthcheckReport {
  readonly ok: boolean;
  readonly status: "pass" | "fail";
  readonly kind: "lab-deployment-healthcheck-report";
  readonly targetId: string;
  readonly checkedPath: "/healthz";
  readonly method: "GET";
  readonly remoteProbePerformed: false;
  readonly deploymentReadinessClaim: false;
  readonly productionReadinessClaim: false;
  readonly graphSnapshotRead: boolean;
  readonly providerCallsMade: number;
  readonly productionWrites: boolean;
  readonly failureCodes: readonly LabDeploymentHealthcheckFailureCode[];
}

function assertFrozenDescriptor(descriptor: LabDeploymentTargetDescriptor): void {
  if (
    !Object.isFrozen(descriptor) ||
    !Object.isFrozen(descriptor.infrastructure) ||
    !Object.isFrozen(descriptor.http) ||
    !Object.isFrozen(descriptor.supervision) ||
    !Object.isFrozen(descriptor.backupPolicy) ||
    !Object.isFrozen(descriptor.boundary)
  ) {
    throw new Error("lab healthcheck planning requires a validated frozen lab deployment target descriptor");
  }
}

function freezePlan(plan: LabDeploymentHealthcheckPlan): LabDeploymentHealthcheckPlan {
  Object.freeze(plan.expected);
  Object.freeze(plan.boundaries);
  return Object.freeze(plan);
}

export function createLabDeploymentHealthcheckPlan(
  descriptor: LabDeploymentTargetDescriptor,
  options: LabDeploymentHealthcheckPlanOptions,
): LabDeploymentHealthcheckPlan {
  assertFrozenDescriptor(descriptor);

  return freezePlan({
    kind: "lab-deployment-healthcheck-plan",
    schemaVersion: "1",
    targetId: descriptor.targetId,
    environment: "lab",
    runtimeMode: "fake",
    method: "GET",
    bindHostRef: descriptor.http.bindHostRef,
    port: descriptor.http.port,
    publicBaseUrlRef: descriptor.http.publicBaseUrlRef,
    healthcheckPath: descriptor.http.healthcheckPath,
    workshopPath: descriptor.http.workshopPath,
    authMode: options.authMode,
    expected: {
      statusCode: 200,
      kind: "fake-mode-workshop-healthcheck",
      graphSnapshotRead: false,
      providerCallsMade: 0,
      productionWrites: false,
      deploymentReadinessClaim: false,
      productionReadinessClaim: false,
    },
    boundaries: {
      remoteProbeAllowed: false,
      deploymentExecuted: false,
      providerCallsAllowed: false,
      graphIngestionAllowed: false,
      productionWritesAllowed: false,
      readinessClaimAllowed: false,
    },
  });
}

function parseBody(body: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function booleanValue(body: Record<string, unknown> | undefined, key: string): boolean {
  return body?.[key] === true;
}

function numberValue(body: Record<string, unknown> | undefined, key: string): number {
  const value = body?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function evaluateLabDeploymentHealthcheckResponse(
  plan: LabDeploymentHealthcheckPlan,
  response: LabDeploymentHealthcheckHttpResponse,
): LabDeploymentHealthcheckReport {
  const failures: LabDeploymentHealthcheckFailureCode[] = [];
  const body = parseBody(response.body);

  if (response.statusCode !== plan.expected.statusCode) failures.push("unexpected_status_code");
  if (body === undefined) failures.push("invalid_json_body");
  if (body !== undefined && body.kind !== plan.expected.kind) failures.push("unexpected_response_kind");
  if (body !== undefined && body.ok !== true) failures.push("healthcheck_not_ok");

  const graphSnapshotRead = booleanValue(body, "graphSnapshotRead");
  const providerCallsMade = numberValue(body, "providerCallsMade");
  const productionWrites = booleanValue(body, "productionWrites");
  const deploymentReadinessClaim = booleanValue(body, "deploymentReadinessClaim");
  const productionReadinessClaim = booleanValue(body, "productionReadinessClaim");

  if (graphSnapshotRead !== plan.expected.graphSnapshotRead) failures.push("graph_snapshot_was_read");
  if (providerCallsMade !== plan.expected.providerCallsMade) failures.push("provider_calls_made");
  if (productionWrites !== plan.expected.productionWrites) failures.push("production_writes_present");
  if (deploymentReadinessClaim !== plan.expected.deploymentReadinessClaim) failures.push("deployment_readiness_claim_present");
  if (productionReadinessClaim !== plan.expected.productionReadinessClaim) failures.push("production_readiness_claim_present");

  return Object.freeze({
    ok: failures.length === 0,
    status: failures.length === 0 ? "pass" : "fail",
    kind: "lab-deployment-healthcheck-report",
    targetId: plan.targetId,
    checkedPath: plan.healthcheckPath,
    method: plan.method,
    remoteProbePerformed: false,
    deploymentReadinessClaim: false,
    productionReadinessClaim: false,
    graphSnapshotRead,
    providerCallsMade,
    productionWrites,
    failureCodes: Object.freeze(failures.slice()),
  });
}
