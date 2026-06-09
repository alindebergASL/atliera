import type { AtlieraRuntime } from "./composition.ts";
import { runRuntimePreflight, type RuntimePreflightReport } from "./preflight.ts";
import { prepareRuntimeWorkshopHtmlPreview } from "./workshop-preview.ts";

export type FakeModeWorkshopServeFailureCode =
  | "fake_mode_workshop_server_requires_non_production_environment"
  | "fake_mode_workshop_server_requires_fake_model_provider"
  | "fake_mode_workshop_server_requires_memory_artifact_store"
  | "fake_mode_workshop_server_requires_memory_queue_backend"
  | "fake_mode_workshop_server_must_not_construct_model_provider_client"
  | "runtime_preflight_failed";

export interface FakeModeWorkshopServeFailure {
  readonly code: FakeModeWorkshopServeFailureCode;
  readonly message: string;
}

export interface FakeModeWorkshopServeReadiness {
  readonly ok: boolean;
  readonly kind: "fake-mode-workshop-serve-readiness";
  readonly environment: AtlieraRuntime["config"]["environment"];
  readonly runtimePreflight: RuntimePreflightReport;
  readonly failures: readonly FakeModeWorkshopServeFailure[];
  readonly graphSnapshotRead: false;
  readonly clientsConstructed: false;
  readonly modelProviderClientConstructed: false;
  readonly providerCallsMade: 0;
  readonly productionWrites: false;
}

export interface FakeModeWorkshopServeRequest {
  readonly method: string | undefined;
  readonly path: string | undefined;
}

export interface FakeModeWorkshopServeResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

const NON_PRODUCTION_ENVIRONMENTS = new Set(["development", "test", "lab"]);

function makeFailure(
  code: FakeModeWorkshopServeFailureCode,
  message: string,
): FakeModeWorkshopServeFailure {
  return { code, message };
}

export function assessFakeModeWorkshopServeReadiness(
  runtime: AtlieraRuntime,
): FakeModeWorkshopServeReadiness {
  const runtimePreflight = runRuntimePreflight(runtime.config);
  const failures: FakeModeWorkshopServeFailure[] = [];

  if (!NON_PRODUCTION_ENVIRONMENTS.has(runtime.config.environment)) {
    failures.push(
      makeFailure(
        "fake_mode_workshop_server_requires_non_production_environment",
        "fake-mode Workshop serving is only allowed for development, test, or lab environments",
      ),
    );
  }
  if (runtime.config.modelProvider !== "fake") {
    failures.push(
      makeFailure(
        "fake_mode_workshop_server_requires_fake_model_provider",
        "fake-mode Workshop serving requires MODEL_PROVIDER=fake",
      ),
    );
  }
  if (runtime.config.artifactStore !== "memory") {
    failures.push(
      makeFailure(
        "fake_mode_workshop_server_requires_memory_artifact_store",
        "fake-mode Workshop serving requires ARTIFACT_STORE=memory",
      ),
    );
  }
  if (runtime.config.queueBackend !== "memory") {
    failures.push(
      makeFailure(
        "fake_mode_workshop_server_requires_memory_queue_backend",
        "fake-mode Workshop serving requires QUEUE_BACKEND=memory",
      ),
    );
  }
  if (runtime.modelProvider !== undefined) {
    failures.push(
      makeFailure(
        "fake_mode_workshop_server_must_not_construct_model_provider_client",
        "fake-mode Workshop serving must not receive a constructed model provider client",
      ),
    );
  }
  if (!runtimePreflight.ok) {
    failures.push(
      makeFailure(
        "runtime_preflight_failed",
        "runtime preflight failed before fake-mode Workshop serving",
      ),
    );
  }

  return {
    ok: failures.length === 0,
    kind: "fake-mode-workshop-serve-readiness",
    environment: runtime.config.environment,
    runtimePreflight,
    failures,
    graphSnapshotRead: false,
    clientsConstructed: false,
    modelProviderClientConstructed: false,
    providerCallsMade: 0,
    productionWrites: false,
  };
}

function routeOf(path: string | undefined): string {
  const raw = path?.trim();
  if (!raw) return "/";
  const queryIndex = raw.indexOf("?");
  return queryIndex === -1 ? raw : raw.slice(0, queryIndex);
}

function jsonResponse(statusCode: number, body: Record<string, unknown>): FakeModeWorkshopServeResponse {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: `${JSON.stringify(body, null, 2)}\n`,
  };
}

function htmlResponse(statusCode: number, body: string): FakeModeWorkshopServeResponse {
  return {
    statusCode,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
    body,
  };
}

function readinessBody(
  readiness: FakeModeWorkshopServeReadiness,
  kind: "fake-mode-workshop-healthcheck" | "fake-mode-workshop-serve-blocked",
): Record<string, unknown> {
  return {
    ok: readiness.ok,
    kind,
    environment: readiness.environment,
    failureCodes: readiness.failures.map((failure) => failure.code),
    runtimePreflightOk: readiness.runtimePreflight.ok,
    runtimePreflightFailureCodes: readiness.runtimePreflight.failures.map((failure) => failure.code),
    graphSnapshotRead: readiness.graphSnapshotRead,
    clientsConstructed: readiness.clientsConstructed,
    modelProviderClientConstructed: readiness.modelProviderClientConstructed,
    providerCallsMade: readiness.providerCallsMade,
    productionWrites: readiness.productionWrites,
  };
}

export async function handleFakeModeWorkshopRequest(
  runtime: AtlieraRuntime,
  request: FakeModeWorkshopServeRequest,
): Promise<FakeModeWorkshopServeResponse> {
  const method = request.method?.toUpperCase() ?? "GET";
  const route = routeOf(request.path);
  const readiness = assessFakeModeWorkshopServeReadiness(runtime);

  if (method !== "GET") {
    return jsonResponse(405, {
      ok: false,
      kind: "fake-mode-workshop-method-not-allowed",
      allowedMethods: ["GET"],
      graphSnapshotRead: false,
      providerCallsMade: 0,
      productionWrites: false,
    });
  }

  if (route === "/healthz") {
    return jsonResponse(
      readiness.ok ? 200 : 503,
      readinessBody(readiness, "fake-mode-workshop-healthcheck"),
    );
  }

  if (route !== "/workshop") {
    return jsonResponse(404, {
      ok: false,
      kind: "fake-mode-workshop-not-found",
      route,
      graphSnapshotRead: false,
      providerCallsMade: 0,
      productionWrites: false,
    });
  }

  if (!readiness.ok) {
    return jsonResponse(503, readinessBody(readiness, "fake-mode-workshop-serve-blocked"));
  }

  const report = prepareRuntimeWorkshopHtmlPreview(runtime);
  if (!report.ok || report.html === undefined) {
    return jsonResponse(503, {
      ok: false,
      kind: "fake-mode-workshop-render-blocked",
      previewFailureCodes: report.workshopPreview.previewFailures.map((failure) => failure.code),
      runtimePreflightOk: report.workshopPreview.preflight.ok,
      runtimePreflightFailureCodes: report.workshopPreview.preflight.failures.map((failure) => failure.code),
      graphSnapshotRead: report.graphSnapshotRead,
      clientsConstructed: report.clientsConstructed,
      modelProviderClientConstructed: false,
      providerCallsMade: report.providerCallsMade,
      productionWrites: report.productionWrites,
    });
  }

  return htmlResponse(200, report.html);
}
