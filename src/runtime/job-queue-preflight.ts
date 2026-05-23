import { assertSafeQueueName, type JobQueue, type QueuedJob } from "../jobs/queue.ts";
import { defineResourcePreflightCheck, type ResourcePreflightCheckDefinition, type ResourcePreflightCheckResult } from "./resource-preflight.ts";

export interface JobQueuePreflightCheckOptions {
  queue: JobQueue;
  queueName: string;
}

const PROBE_PAYLOAD = { purpose: "resource-preflight" } as const;
const JOB_QUEUE_PROBE_METADATA = {
  adapter: "job_queue",
  probe: "enqueue_dequeue_complete",
} as const;

export function defineJobQueuePreflightCheck(
  options: JobQueuePreflightCheckOptions,
): ResourcePreflightCheckDefinition {
  assertSafeQueueName(options.queueName);

  return defineResourcePreflightCheck({
    target: "queue_backend",
    name: "job queue enqueue dequeue probe",
    run: async () => runJobQueueProbe(options.queue, options.queueName),
  });
}

async function runJobQueueProbe(
  queue: JobQueue,
  queueName: string,
): Promise<ResourcePreflightCheckResult> {
  try {
    const enqueued = await queue.enqueue(queueName, { ...PROBE_PAYLOAD });
    const dequeued = await queue.dequeue(queueName);
    if (!matchesProbeJob(dequeued, enqueued.id, queueName)) {
      return jobQueueMismatchResult();
    }

    await queue.complete(dequeued.id);
    const completedJob = await queue.get(dequeued.id);
    if (completedJob !== undefined) {
      return jobQueueMismatchResult();
    }

    return {
      status: "pass",
      code: "queue_backend_reachable",
      message: "job queue enqueue dequeue probe passed",
      metadata: { ...JOB_QUEUE_PROBE_METADATA },
    };
  } catch {
    return {
      status: "fail",
      code: "queue_backend_unreachable",
      message: "job queue enqueue dequeue probe failed",
      metadata: { ...JOB_QUEUE_PROBE_METADATA },
    };
  }
}

function matchesProbeJob(
  job: QueuedJob<unknown> | undefined,
  expectedId: string,
  expectedQueue: string,
): job is QueuedJob<unknown> {
  if (job === undefined) {
    return false;
  }
  return (
    job.id === expectedId &&
    job.queue === expectedQueue &&
    job.status === "leased" &&
    job.attempts >= 1 &&
    isProbePayload(job.payload)
  );
}

function isProbePayload(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    Object.getPrototypeOf(payload) === Object.prototype &&
    (payload as Record<string, unknown>).purpose === PROBE_PAYLOAD.purpose &&
    Reflect.ownKeys(payload).length === 1
  );
}

function jobQueueMismatchResult(): ResourcePreflightCheckResult {
  return {
    status: "fail",
    code: "queue_backend_mismatch",
    message: "job queue enqueue dequeue probe returned mismatched job state",
    metadata: { ...JOB_QUEUE_PROBE_METADATA },
  };
}
