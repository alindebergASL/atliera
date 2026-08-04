import { parentPort, workerData } from "node:worker_threads";

import {
  DisposableSqliteSubjectGraphRevisionTransaction,
  type DisposableSqliteSubjectGraphRevisionTestFaultInstruction,
} from "../../src/graph/disposable-sqlite-subject-graph-revision-transaction.ts";

interface RevisionWorkerData {
  readonly database_path: string;
  readonly isolated_temporary_directory: string;
  readonly intent: unknown;
  readonly permit: unknown;
  readonly start_barrier?: SharedArrayBuffer;
  readonly fault_plan?: readonly DisposableSqliteSubjectGraphRevisionTestFaultInstruction[];
}

const data = workerData as RevisionWorkerData;
const view =
  data.start_barrier === undefined
    ? undefined
    : new Int32Array(data.start_barrier);
if (view !== undefined) {
  Atomics.add(view, 0, 1);
  Atomics.notify(view, 0);
  while (Atomics.load(view, 1) === 0) Atomics.wait(view, 1, 0, 5_000);
}

const transaction = new DisposableSqliteSubjectGraphRevisionTransaction({
  database_path: data.database_path,
  isolated_temporary_directory: data.isolated_temporary_directory,
  ...(data.fault_plan === undefined
    ? {}
    : { test_only_fault_plan: data.fault_plan }),
});

parentPort?.postMessage(transaction.consume(data.intent, data.permit));
