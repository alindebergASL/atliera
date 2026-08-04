import { parentPort, workerData } from "node:worker_threads";

import {
  DisposableSqliteSubjectGraphRevisionTransaction,
  type DisposableSqliteSubjectGraphRevisionTestFaultPoint,
} from "../../src/graph/disposable-sqlite-subject-graph-revision-transaction.ts";

interface RevisionWorkerData {
  readonly database_path: string;
  readonly isolated_temporary_directory: string;
  readonly intent: unknown;
  readonly permit: unknown;
  readonly barrier?: SharedArrayBuffer;
  readonly role?: "holder" | "contender";
}

const data = workerData as RevisionWorkerData;
const view = data.barrier === undefined ? undefined : new Int32Array(data.barrier);

function hook(point: DisposableSqliteSubjectGraphRevisionTestFaultPoint): void {
  if (view === undefined) return;
  if (data.role === "holder" && point === "after_begin") {
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0);
    while (Atomics.load(view, 1) === 0) Atomics.wait(view, 1, 0, 5_000);
  }
  if (data.role === "contender" && point === "after_open_before_transaction") {
    Atomics.store(view, 1, 1);
    Atomics.notify(view, 1);
  }
}

const transaction = new DisposableSqliteSubjectGraphRevisionTransaction({
  database_path: data.database_path,
  isolated_temporary_directory: data.isolated_temporary_directory,
  test_only_fault_hook: hook,
});

parentPort?.postMessage(transaction.consume(data.intent, data.permit));
