import type { AtlieraRuntime } from "./composition.ts";
import {
  runRuntimePreflight,
  type RuntimePreflightReport,
} from "./preflight.ts";

export type RuntimeLaunchKind = "app";

export type RuntimeLaunchPlannedService =
  | "app-server"
  | "graph-store"
  | "artifact-store"
  | "job-queue"
  | "model-adapter";

export interface RuntimeLaunchReport {
  readonly ok: boolean;
  readonly kind: RuntimeLaunchKind;
  readonly environment: AtlieraRuntime["config"]["environment"];
  readonly runtime: AtlieraRuntime;
  readonly preflight: RuntimePreflightReport;
  readonly plannedServices: readonly RuntimeLaunchPlannedService[];
  readonly serverStarted: false;
  readonly clientsConstructed: false;
}

const APP_LAUNCH_PLANNED_SERVICES: readonly RuntimeLaunchPlannedService[] = [
  "app-server",
  "graph-store",
  "artifact-store",
  "job-queue",
  "model-adapter",
];

export function prepareRuntimeLaunch(runtime: AtlieraRuntime): RuntimeLaunchReport {
  const preflight = runRuntimePreflight(runtime.config);

  return {
    ok: preflight.ok,
    kind: "app",
    environment: runtime.config.environment,
    runtime,
    preflight,
    plannedServices: APP_LAUNCH_PLANNED_SERVICES,
    serverStarted: false,
    clientsConstructed: false,
  };
}
