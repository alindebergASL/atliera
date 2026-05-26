import { randomUUID } from "node:crypto";

import { assertSafeQueueName, type JobQueue, type JobStatus, type QueuedJob } from "./queue.ts";

export interface DatabaseJobRow {
  id: string;
  queue: string;
  payloadJson: string;
  status: JobStatus;
  attempts: number;
}

export type DatabaseJobInsertResult = { inserted: true } | { inserted: false };
export type DatabaseJobDeleteResult = { deleted: true } | { deleted: false };

export interface DatabaseJobQueueClient {
  insertJob(input: { table: string; id: string; queue: string; payloadJson: string }): Promise<DatabaseJobInsertResult>;
  leaseNextJob(input: { table: string; queue: string }): Promise<DatabaseJobRow | undefined>;
  deleteJob(input: { table: string; id: string }): Promise<DatabaseJobDeleteResult>;
  selectJob(input: { table: string; id: string }): Promise<DatabaseJobRow | undefined>;
}

export type DatabaseJobQueueOperation = "enqueue" | "dequeue" | "complete" | "get";
export type DatabaseJobQueueEventStatus = "start" | "success" | "not_found" | "failure" | "conflict";

export interface DatabaseJobQueueEvent {
  operation: DatabaseJobQueueOperation;
  status: DatabaseJobQueueEventStatus;
  queue?: string;
  jobId?: string;
  durationMs: number;
  failureCategory?: "dependency" | "validation" | "conflict" | "not_found";
}

export class DatabaseJobQueueDependencyError extends Error {
  constructor(operation: DatabaseJobQueueOperation) {
    super(`DatabaseJobQueue ${operation} failed`);
    this.name = "DatabaseJobQueueDependencyError";
  }
}

class UnknownDatabaseJobError extends Error {
  constructor(readonly jobId: string) {
    super("unknown database job");
    this.name = "UnknownDatabaseJobError";
  }
}

export interface DatabaseJobQueueOptions {
  table: string;
  client: DatabaseJobQueueClient;
  generateJobId?: () => string;
  onEvent?: (event: DatabaseJobQueueEvent) => void;
}

const SAFE_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const SAFE_JOB_ID = /^job_[A-Za-z0-9_-]{1,128}$/;

export class DatabaseJobQueue<Payload = unknown> implements JobQueue<Payload> {
  private readonly table: string;
  private readonly client: DatabaseJobQueueClient;
  private readonly generateJobId: () => string;
  private readonly onEvent?: (event: DatabaseJobQueueEvent) => void;

  constructor(options: DatabaseJobQueueOptions) {
    assertSafeTableName(options.table);
    this.table = options.table;
    this.client = options.client;
    this.generateJobId = options.generateJobId ?? (() => `job_${randomUUID().split("-").join("")}`);
    this.onEvent = options.onEvent;
  }

  async enqueue(queue: string, payload: Payload): Promise<QueuedJob<Payload>> {
    assertSafeQueueName(queue);
    const payloadJson = stringifyPayload(payload);
    const id = this.generateJobId();
    assertSafeJobId(id);
    const startedAt = nowMs();
    this.emit({ operation: "enqueue", status: "start", queue, jobId: id, durationMs: 0 });

    try {
      const result = await this.client.insertJob({ table: this.table, id, queue, payloadJson });
      assertDatabaseJobInsertResult(result);
      if (result.inserted === false) {
        this.emit({
          operation: "enqueue",
          status: "conflict",
          queue,
          jobId: id,
          durationMs: elapsedMs(startedAt),
          failureCategory: "conflict",
        });
        throw new DatabaseJobQueueDependencyError("enqueue");
      }
      const job = materializeJob<Payload>({ id, queue, payloadJson, status: "queued", attempts: 0 }, { operation: "enqueue" });
      this.emit({ operation: "enqueue", status: "success", queue, jobId: id, durationMs: elapsedMs(startedAt) });
      return job;
    } catch (error) {
      if (error instanceof DatabaseJobQueueDependencyError) {
        throw error;
      }
      this.emit({
        operation: "enqueue",
        status: "failure",
        queue,
        jobId: id,
        durationMs: elapsedMs(startedAt),
        failureCategory: "dependency",
      });
      throw new DatabaseJobQueueDependencyError("enqueue");
    }
  }

  async dequeue(queue: string): Promise<QueuedJob<Payload> | undefined> {
    assertSafeQueueName(queue);
    const startedAt = nowMs();
    this.emit({ operation: "dequeue", status: "start", queue, durationMs: 0 });

    let row: DatabaseJobRow | undefined;
    try {
      row = await this.client.leaseNextJob({ table: this.table, queue });
    } catch {
      this.emit({
        operation: "dequeue",
        status: "failure",
        queue,
        durationMs: elapsedMs(startedAt),
        failureCategory: "dependency",
      });
      throw new DatabaseJobQueueDependencyError("dequeue");
    }

    if (row === undefined) {
      this.emit({ operation: "dequeue", status: "not_found", queue, durationMs: elapsedMs(startedAt), failureCategory: "not_found" });
      return undefined;
    }

    try {
      const job = materializeJob<Payload>(row, { operation: "dequeue", expectedQueue: queue, expectedStatus: "leased" });
      if (job.attempts < 1) {
        throw new Error("leased job attempts must be positive");
      }
      this.emit({ operation: "dequeue", status: "success", queue, jobId: job.id, durationMs: elapsedMs(startedAt) });
      return job;
    } catch {
      this.emit({
        operation: "dequeue",
        status: "failure",
        queue,
        durationMs: elapsedMs(startedAt),
        failureCategory: "dependency",
      });
      throw new DatabaseJobQueueDependencyError("dequeue");
    }
  }

  async complete(id: string): Promise<void> {
    assertSafeJobId(id);
    const startedAt = nowMs();
    this.emit({ operation: "complete", status: "start", jobId: id, durationMs: 0 });

    try {
      const result = await this.client.deleteJob({ table: this.table, id });
      assertDatabaseJobDeleteResult(result);
      if (result.deleted === false) {
        this.emit({
          operation: "complete",
          status: "not_found",
          jobId: id,
          durationMs: elapsedMs(startedAt),
          failureCategory: "not_found",
        });
        throw new UnknownDatabaseJobError(id);
      }
      this.emit({ operation: "complete", status: "success", jobId: id, durationMs: elapsedMs(startedAt) });
    } catch (error) {
      if (error instanceof UnknownDatabaseJobError) {
        throw new Error(`unknown job: ${id}`);
      }
      this.emit({
        operation: "complete",
        status: "failure",
        jobId: id,
        durationMs: elapsedMs(startedAt),
        failureCategory: "dependency",
      });
      throw new DatabaseJobQueueDependencyError("complete");
    }
  }

  async get(id: string): Promise<QueuedJob<Payload> | undefined> {
    assertSafeJobId(id);
    const startedAt = nowMs();
    this.emit({ operation: "get", status: "start", jobId: id, durationMs: 0 });

    let row: DatabaseJobRow | undefined;
    try {
      row = await this.client.selectJob({ table: this.table, id });
    } catch {
      this.emit({ operation: "get", status: "failure", jobId: id, durationMs: elapsedMs(startedAt), failureCategory: "dependency" });
      throw new DatabaseJobQueueDependencyError("get");
    }

    if (row === undefined) {
      this.emit({ operation: "get", status: "not_found", jobId: id, durationMs: elapsedMs(startedAt), failureCategory: "not_found" });
      return undefined;
    }

    try {
      const job = materializeJob<Payload>(row, { operation: "get", expectedId: id });
      this.emit({ operation: "get", status: "success", queue: job.queue, jobId: id, durationMs: elapsedMs(startedAt) });
      return job;
    } catch {
      this.emit({ operation: "get", status: "failure", jobId: id, durationMs: elapsedMs(startedAt), failureCategory: "dependency" });
      throw new DatabaseJobQueueDependencyError("get");
    }
  }

  private emit(event: DatabaseJobQueueEvent): void {
    try {
      this.onEvent?.({ ...event });
    } catch {
      // Best-effort observability must not alter queue outcomes.
    }
  }
}

export function assertSafeJobId(id: string): void {
  if (id.trim() !== id || !SAFE_JOB_ID.test(id) || id.includes("..") || id.includes(":") || id.includes("/") || id.includes("\\")) {
    throw new Error("job id must be a logical job_ identifier, not a URL, path, traversal string, host:port address, or infrastructure handle");
  }
}

function assertSafeTableName(table: string): void {
  if (table.trim() !== table || !SAFE_TABLE_NAME.test(table)) {
    throw new Error("table name must be a logical SQL identifier using letters, numbers, and underscores");
  }
}

function assertDatabaseJobInsertResult(result: unknown): asserts result is DatabaseJobInsertResult {
  if (typeof result !== "object" || result === null || (!("inserted" in result)) || (result.inserted !== true && result.inserted !== false)) {
    throw new Error("database job insert result invalid");
  }
}

function assertDatabaseJobDeleteResult(result: unknown): asserts result is DatabaseJobDeleteResult {
  if (typeof result !== "object" || result === null || (!("deleted" in result)) || (result.deleted !== true && result.deleted !== false)) {
    throw new Error("database job delete result invalid");
  }
}

function stringifyPayload(payload: unknown): string {
  let payloadJson: string | undefined;
  try {
    const snapshot = snapshotJsonSerializableValue(payload, new Set());
    payloadJson = JSON.stringify(snapshot);
  } catch {
    throw new Error("payload must be JSON serializable");
  }
  if (payloadJson === undefined) {
    throw new Error("payload must be JSON serializable");
  }
  return payloadJson;
}

function snapshotJsonSerializableValue(value: unknown, seen: Set<object>): unknown {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (Number.isFinite(value)) {
        return value;
      }
      throw new Error("invalid json value");
    case "object":
      break;
    default:
      throw new Error("invalid json value");
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    throw new Error("invalid json value");
  }
  seen.add(objectValue);

  try {
    if (Array.isArray(value)) {
      const snapshot: unknown[] = [];
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === "symbol") {
          throw new Error("invalid json value");
        }
        if (key === "length") {
          continue;
        }
        const numericKey = Number(key);
        if (!Number.isInteger(numericKey) || numericKey < 0 || numericKey >= value.length || String(numericKey) !== key) {
          throw new Error("invalid json value");
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          throw new Error("invalid json value");
        }
      }

      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          throw new Error("invalid json value");
        }
        snapshot[index] = snapshotJsonSerializableValue(descriptor.value, seen);
      }
      return snapshot;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("invalid json value");
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === "symbol") {
        throw new Error("invalid json value");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new Error("invalid json value");
      }
      Object.defineProperty(snapshot, key, {
        value: snapshotJsonSerializableValue(descriptor.value, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return snapshot;
  } finally {
    seen.delete(objectValue);
  }
}

function materializeJob<Payload>(
  row: DatabaseJobRow,
  options: { operation: DatabaseJobQueueOperation; expectedId?: string; expectedQueue?: string; expectedStatus?: JobStatus },
): QueuedJob<Payload> {
  assertSafeJobId(row.id);
  assertSafeQueueName(row.queue);
  if (options.expectedId !== undefined && row.id !== options.expectedId) {
    throw new Error("database job row identity mismatch");
  }
  if (options.expectedQueue !== undefined && row.queue !== options.expectedQueue) {
    throw new Error("database job row queue mismatch");
  }
  if (options.expectedStatus !== undefined && row.status !== options.expectedStatus) {
    throw new Error("database job row status mismatch");
  }
  if (row.status !== "queued" && row.status !== "leased") {
    throw new Error("database job row status invalid");
  }
  if (!Number.isSafeInteger(row.attempts) || row.attempts < 0) {
    throw new Error("database job row attempts invalid");
  }
  if (row.status === "queued" && row.attempts !== 0) {
    throw new Error("queued job attempts must be zero");
  }

  let payload: Payload;
  try {
    payload = JSON.parse(row.payloadJson) as Payload;
  } catch {
    throw new Error("database job row payload invalid");
  }

  return {
    id: row.id,
    queue: row.queue,
    payload,
    status: row.status,
    attempts: row.attempts,
  };
}

function nowMs(): number {
  return Date.now();
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, nowMs() - startedAt);
}
