import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "leased";

export interface QueuedJob<Payload = unknown> {
  id: string;
  queue: string;
  payload: Payload;
  status: JobStatus;
  attempts: number;
}

export interface JobQueue<Payload = unknown> {
  enqueue(queue: string, payload: Payload): Promise<QueuedJob<Payload>>;
  dequeue(queue: string): Promise<QueuedJob<Payload> | undefined>;
  complete(id: string): Promise<void>;
  get(id: string): Promise<QueuedJob<Payload> | undefined>;
}

const SAFE_QUEUE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const IPV4_LITERAL = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function assertSafeQueueName(queue: string): void {
  if (
    queue.trim() !== queue ||
    !SAFE_QUEUE_NAME.test(queue) ||
    IPV4_LITERAL.test(queue) ||
    queue.includes("..") ||
    queue.includes("://") ||
    queue.includes(":") ||
    queue.includes("/") ||
    queue.includes("\\")
  ) {
    throw new Error(
      "queue name must be a logical 1-128 character identifier using letters, numbers, dot, underscore, or dash; it must not be a URL, IP address, host:port address, path, or contain '..'",
    );
  }
}

function copyJob<Payload>(job: QueuedJob<Payload>): QueuedJob<Payload> {
  return {
    id: job.id,
    queue: job.queue,
    payload: job.payload,
    status: job.status,
    attempts: job.attempts,
  };
}

export class InMemoryJobQueue<Payload = unknown> implements JobQueue<Payload> {
  private readonly jobs = new Map<string, QueuedJob<Payload>>();
  private readonly order: string[] = [];

  async enqueue(queue: string, payload: Payload): Promise<QueuedJob<Payload>> {
    assertSafeQueueName(queue);

    const job: QueuedJob<Payload> = {
      id: `job_${randomUUID().split("-").join("")}`,
      queue,
      payload,
      status: "queued",
      attempts: 0,
    };

    this.jobs.set(job.id, job);
    this.order.push(job.id);

    return copyJob(job);
  }

  async dequeue(queue: string): Promise<QueuedJob<Payload> | undefined> {
    assertSafeQueueName(queue);

    for (const id of this.order) {
      const job = this.jobs.get(id);
      if (job?.queue === queue && job.status === "queued") {
        job.status = "leased";
        job.attempts += 1;
        return copyJob(job);
      }
    }

    return undefined;
  }

  async complete(id: string): Promise<void> {
    if (!this.jobs.delete(id)) {
      throw new Error(`unknown job: ${id}`);
    }
  }

  async get(id: string): Promise<QueuedJob<Payload> | undefined> {
    const job = this.jobs.get(id);
    return job === undefined ? undefined : copyJob(job);
  }
}
