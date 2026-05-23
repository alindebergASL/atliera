import { assertSafeQueueName } from "../jobs/queue.ts";
import type { AtlieraRuntime } from "./composition.ts";
import {
  runRuntimePreflight,
  type RuntimePreflightReport,
} from "./preflight.ts";

export type WorkerRuntimeLaunchKind = "worker";

export type WorkerRuntimePlannedService =
  | "worker-loop"
  | "job-queue"
  | "graph-store"
  | "artifact-store"
  | "model-adapter";

export interface WorkerRuntimeLaunchOptions {
  readonly queues: readonly string[];
  readonly maxConcurrentJobs?: number;
}

export interface WorkerRuntimeLaunchReport {
  readonly ok: boolean;
  readonly kind: WorkerRuntimeLaunchKind;
  readonly environment: AtlieraRuntime["config"]["environment"];
  readonly runtime: AtlieraRuntime;
  readonly preflight: RuntimePreflightReport;
  readonly queues: readonly string[];
  readonly maxConcurrentJobs: number;
  readonly plannedServices: readonly WorkerRuntimePlannedService[];
  readonly pollingStarted: false;
  readonly jobsDequeued: false;
  readonly jobsExecuted: false;
  readonly clientsConstructed: false;
}

const WORKER_RUNTIME_PLANNED_SERVICES: readonly WorkerRuntimePlannedService[] = [
  "worker-loop",
  "job-queue",
  "graph-store",
  "artifact-store",
  "model-adapter",
];

export function prepareWorkerRuntimeLaunch(
  runtime: AtlieraRuntime,
  options: WorkerRuntimeLaunchOptions,
): WorkerRuntimeLaunchReport {
  for (const queue of options.queues) {
    assertSafeQueueName(queue);
  }
  const maxConcurrentJobs = options.maxConcurrentJobs ?? 1;
  if (!Number.isInteger(maxConcurrentJobs) || maxConcurrentJobs < 1) {
    throw new Error("maxConcurrentJobs must be a positive integer");
  }

  const preflight = runRuntimePreflight(runtime.config);

  return {
    ok: preflight.ok,
    kind: "worker",
    environment: runtime.config.environment,
    runtime,
    preflight,
    queues: [...options.queues],
    maxConcurrentJobs,
    plannedServices: WORKER_RUNTIME_PLANNED_SERVICES,
    pollingStarted: false,
    jobsDequeued: false,
    jobsExecuted: false,
    clientsConstructed: false,
  };
}
