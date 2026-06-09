import { once } from "node:events";
import { createServer, type ServerResponse } from "node:http";
import { argv, env, exit, stderr, stdout } from "node:process";

import type { ModelAdapter } from "../src/agent/model-adapter.ts";
import type { ArtifactPutTextOptions, ArtifactStore, TextArtifact } from "../src/artifacts/store.ts";
import { parseAtlieraRuntimeConfig } from "../src/config/runtime.ts";
import { GraphFileParseError, GraphFileSchemaError, loadGraphBundleFile } from "../src/graph/file-store.ts";
import type { GraphStore } from "../src/graph/store.ts";
import type { GraphBundle } from "../src/graph/types.ts";
import type { JobQueue, QueuedJob } from "../src/jobs/queue.ts";
import type { RuntimeMode } from "../src/modes/index.ts";
import { createAtlieraRuntime, type AtlieraRuntime } from "../src/runtime/composition.ts";
import {
  assessFakeModeWorkshopServeReadiness,
  handleFakeModeWorkshopRequest,
  type FakeModeWorkshopServeResponse,
} from "../src/runtime/fake-mode-workshop-server.ts";

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

class StaticGraphStore implements GraphStore {
  constructor(private readonly bundle: GraphBundle) {}

  get snapshot(): GraphBundle {
    return this.bundle;
  }

  commit(): void {
    throw new Error("fake-mode Workshop server must not write graph state");
  }
}

class NoWriteArtifactStore implements ArtifactStore {
  async putText(_key: string, _content: string, _options: ArtifactPutTextOptions): Promise<void> {
    throw new Error("fake-mode Workshop server must not write artifacts");
  }

  async getText(_key: string): Promise<TextArtifact | undefined> {
    throw new Error("fake-mode Workshop server must not read artifacts");
  }
}

class NoQueueOperations implements JobQueue {
  async enqueue(_queue: string, _payload: unknown): Promise<QueuedJob> {
    throw new Error("fake-mode Workshop server must not enqueue jobs");
  }

  async dequeue(_queue: string): Promise<QueuedJob | undefined> {
    throw new Error("fake-mode Workshop server must not dequeue jobs");
  }

  async complete(_id: string): Promise<void> {
    throw new Error("fake-mode Workshop server must not complete jobs");
  }

  async get(_id: string): Promise<QueuedJob | undefined> {
    throw new Error("fake-mode Workshop server must not read jobs");
  }
}

const EMPTY_BUNDLE: GraphBundle = {
  sources: [],
  excerpts: [],
  claims: [],
  claim_evidence: [],
  account_objects: [],
  account_object_claims: [],
  research_runs: [],
  run_artifacts: [],
  audit_events: [],
};

const THROWING_MODEL_ADAPTER: ModelAdapter = {
  name: "fake-mode-workshop-server-throw-if-called",
  async propose(_input: { prompt: string; mode: RuntimeMode }) {
    throw new Error("fake-mode Workshop server must not call model adapters");
  },
};

interface ParsedArgs {
  readonly bundlePath: string | undefined;
}

function usage(): string {
  return [
    "usage:",
    "  tsx scripts/fake-mode-workshop-server.ts [--bundle <graph-bundle.json>]",
    "",
    "required env for a passing fake/local server:",
    "  ATL_ENV=test|development|lab",
    "  ARTIFACT_STORE=memory",
    "  QUEUE_BACKEND=memory",
    "  MODEL_PROVIDER=fake",
    "optional env:",
    "  HOST=<bind host>",
    "  PORT=<port>; omit PORT for an ephemeral local port",
  ].join("\n");
}

function parseArgs(args: string[]): ParsedArgs {
  let bundlePath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--bundle") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new CliUsageError("--bundle requires a path");
      bundlePath = value;
      index += 1;
      continue;
    }
    throw new CliUsageError(`unknown argument: ${arg}`);
  }
  return { bundlePath };
}

async function loadBundle(bundlePath: string | undefined): Promise<GraphBundle> {
  if (bundlePath === undefined) return EMPTY_BUNDLE;
  return loadGraphBundleFile(bundlePath);
}

function printJson(value: unknown): void {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeNodeResponse(target: ServerResponse, response: FakeModeWorkshopServeResponse): void {
  target.writeHead(response.statusCode, response.headers);
  target.end(response.body);
}

function createFakeModeWorkshopHttpServer(runtime: AtlieraRuntime) {
  return createServer((request, response) => {
    handleFakeModeWorkshopRequest(runtime, { method: request.method, path: request.url })
      .then((handled) => writeNodeResponse(response, handled))
      .catch(() =>
        writeNodeResponse(response, {
          statusCode: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            ok: false,
            kind: "fake-mode-workshop-internal-error",
            graphSnapshotRead: false,
            providerCallsMade: 0,
            productionWrites: false,
          }),
        }),
      );
  });
}

function printError(e: unknown): void {
  if (e instanceof CliUsageError) {
    stderr.write(`${e.message}\n${usage()}\n`);
    return;
  }
  if (e instanceof GraphFileSchemaError) {
    stderr.write(`${e.message}\n${JSON.stringify(e.report, null, 2)}\n`);
    return;
  }
  if (e instanceof Error) {
    stderr.write(`${e.message}\n`);
    return;
  }
  stderr.write(`${String(e)}\n`);
}

async function run(): Promise<number> {
  const { bundlePath } = parseArgs(argv.slice(2));
  const config = parseAtlieraRuntimeConfig(env);
  const bundle = await loadBundle(bundlePath);
  const runtime = createAtlieraRuntime({
    config,
    graphStore: new StaticGraphStore(bundle),
    artifactStore: new NoWriteArtifactStore(),
    jobQueue: new NoQueueOperations(),
    modelAdapter: THROWING_MODEL_ADAPTER,
  });
  const readiness = assessFakeModeWorkshopServeReadiness(runtime);
  if (!readiness.ok) {
    printJson({
      ok: false,
      kind: "fake-mode-workshop-server-blocked",
      environment: readiness.environment,
      failureCodes: readiness.failures.map((failure) => failure.code),
      runtimePreflightFailureCodes: readiness.runtimePreflight.failures.map((failure) => failure.code),
      providerCallsMade: 0,
      productionWrites: false,
    });
    return 1;
  }

  const server = createFakeModeWorkshopHttpServer(runtime);
  const host = config.bindHost ?? "localhost";
  const port = config.port ?? 0;
  server.listen(port, host);
  await once(server, "listening");
  const address = server.address();
  printJson({
    ok: true,
    kind: "fake-mode-workshop-server-listening",
    address,
    routes: ["/healthz", "/workshop"],
    providerCallsMade: 0,
    productionWrites: false,
  });
  await once(server, "close");
  return 0;
}

run()
  .then((code) => exit(code))
  .catch((e) => {
    printError(e);
    if (e instanceof CliUsageError) exit(2);
    if (e instanceof GraphFileParseError) exit(2);
    if (e instanceof GraphFileSchemaError) exit(1);
    exit(2);
  });
