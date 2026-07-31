// No-write fake-mode runtime Workshop preview CLI.
//
// Usage:
//   tsx src/cli/runtime-workshop-preview.ts report <bundle.json> --expected-team-id <team> --expected-account-id <account>
//   tsx src/cli/runtime-workshop-preview.ts html <bundle.json> --expected-team-id <team> --expected-account-id <account>
//
// This CLI is an operator smoke path for the runtime Workshop preview seam.
// It constructs a deterministic test/fake runtime around a supplied graph
// bundle and emits either a sanitized JSON report or rendered HTML to stdout.
// It does not write files, start servers, construct external clients, call a
// model provider, or read process.env for provider/runtime configuration.

import { argv, exit } from "node:process";

import type { ModelAdapter } from "../agent/model-adapter.ts";
import type { ArtifactStore, ArtifactPutTextOptions, TextArtifact } from "../artifacts/store.ts";
import { parseAtlieraRuntimeConfig } from "../config/runtime.ts";
import { GraphFileParseError, GraphFileSchemaError, loadGraphBundleFile } from "../graph/file-store.ts";
import type { GraphStore } from "../graph/store.ts";
import type { SubjectScope } from "../graph/subject.ts";
import type { GraphBundle } from "../graph/types.ts";
import type { JobQueue, QueuedJob } from "../jobs/queue.ts";
import type { RuntimeMode } from "../modes/index.ts";
import { createAtlieraRuntime } from "../runtime/composition.ts";
import { prepareRuntimeWorkshopHtmlPreview } from "../runtime/workshop-preview.ts";
import { WorkshopGraphValidationError } from "../workshop/view-model.ts";

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
    throw new Error("runtime Workshop preview CLI must not write graph state");
  }
}

class NoWriteArtifactStore implements ArtifactStore {
  async putText(_key: string, _content: string, _options: ArtifactPutTextOptions): Promise<void> {
    throw new Error("runtime Workshop preview CLI must not write artifacts");
  }

  async getText(_key: string): Promise<TextArtifact | undefined> {
    throw new Error("runtime Workshop preview CLI must not read artifacts");
  }
}

class NoQueueOperations implements JobQueue {
  async enqueue(_queue: string, _payload: unknown): Promise<QueuedJob> {
    throw new Error("runtime Workshop preview CLI must not enqueue jobs");
  }

  async dequeue(_queue: string): Promise<QueuedJob | undefined> {
    throw new Error("runtime Workshop preview CLI must not dequeue jobs");
  }

  async complete(_id: string): Promise<void> {
    throw new Error("runtime Workshop preview CLI must not complete jobs");
  }

  async get(_id: string): Promise<QueuedJob | undefined> {
    throw new Error("runtime Workshop preview CLI must not read jobs");
  }
}

const THROWING_MODEL_ADAPTER: ModelAdapter = {
  name: "fake-preview-throw-if-called",
  async propose(_input: { prompt: string; mode: RuntimeMode }) {
    throw new Error("runtime Workshop preview CLI must not call model adapters");
  },
};

function usage(): string {
  return [
    "usage:",
    "  tsx src/cli/runtime-workshop-preview.ts report <bundle.json> --expected-team-id <team> --expected-account-id <account>",
    "  tsx src/cli/runtime-workshop-preview.ts html <bundle.json> --expected-team-id <team> --expected-account-id <account>",
  ].join("\n");
}

function parseArgs(args: string[]): {
  command: "report" | "html";
  inputPath: string;
  subject: SubjectScope;
} {
  const [command, inputPath, ...flags] = args;
  if (command !== "report" && command !== "html") {
    throw new CliUsageError("unknown command");
  }
  if (!inputPath) {
    throw new CliUsageError("missing bundle.json path");
  }
  if (inputPath.startsWith("--")) {
    throw new CliUsageError(`unknown flag: ${inputPath}`);
  }
  const allowedFlags = new Set([
    "--expected-team-id",
    "--expected-account-id",
  ]);
  const seen = new Set<string>();
  let expectedTeamId: string | null = null;
  let expectedAccountId: string | null = null;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index]!;
    if (!flag.startsWith("--")) {
      throw new CliUsageError(`unexpected positional argument: ${flag}`);
    }
    if (!allowedFlags.has(flag)) throw new CliUsageError(`unknown flag: ${flag}`);
    if (seen.has(flag)) throw new CliUsageError(`duplicate flag: ${flag}`);
    seen.add(flag);
    const value = flags[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliUsageError(`missing value for ${flag}`);
    }
    index += 1;
    if (flag === "--expected-team-id") expectedTeamId = value;
    if (flag === "--expected-account-id") expectedAccountId = value;
  }
  if (!expectedTeamId) throw new CliUsageError("missing --expected-team-id");
  if (!expectedAccountId) throw new CliUsageError("missing --expected-account-id");
  return {
    command,
    inputPath,
    subject: {
      team_id: expectedTeamId,
      account_id: expectedAccountId,
    },
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printError(e: unknown): void {
  if (e instanceof CliUsageError) {
    process.stderr.write(`${e.message}\n${usage()}\n`);
    return;
  }
  if (e instanceof GraphFileSchemaError) {
    process.stderr.write(`${e.message}\n${JSON.stringify(e.report, null, 2)}\n`);
    return;
  }
  if (e instanceof WorkshopGraphValidationError) {
    process.stderr.write(`${e.message}\n${JSON.stringify(e.report, null, 2)}\n`);
    return;
  }
  if (e instanceof Error) {
    process.stderr.write(`${e.message}\n`);
    return;
  }
  process.stderr.write(`${String(e)}\n`);
}

async function buildPreview(inputPath: string, subject: SubjectScope) {
  const bundle = await loadGraphBundleFile(inputPath);
  const config = parseAtlieraRuntimeConfig({
    ATL_ENV: "test",
    ARTIFACT_STORE: "memory",
    QUEUE_BACKEND: "memory",
    MODEL_PROVIDER: "fake",
  });
  const runtime = createAtlieraRuntime({
    config,
    graphStore: new StaticGraphStore(bundle),
    artifactStore: new NoWriteArtifactStore(),
    jobQueue: new NoQueueOperations(),
    modelAdapter: THROWING_MODEL_ADAPTER,
  });
  return prepareRuntimeWorkshopHtmlPreview(runtime, subject);
}

function lensItemCounts(viewModel: ReturnType<typeof prepareRuntimeWorkshopHtmlPreview>["workshopPreview"]["viewModel"]): Record<"signals" | "maps" | "plays", number> | undefined {
  if (!viewModel) return undefined;
  return {
    signals: viewModel.lenses.signals.length,
    maps: viewModel.lenses.maps.length,
    plays: viewModel.lenses.plays.length,
  };
}

function lensEvidencePacketCounts(viewModel: ReturnType<typeof prepareRuntimeWorkshopHtmlPreview>["workshopPreview"]["viewModel"]): Record<"signals" | "maps" | "plays", number> | undefined {
  if (!viewModel) return undefined;
  return {
    signals: viewModel.lenses.signals.reduce((count, item) => count + item.evidence_packets.length, 0),
    maps: viewModel.lenses.maps.reduce((count, item) => count + item.evidence_packets.length, 0),
    plays: viewModel.lenses.plays.reduce((count, item) => count + item.evidence_packets.length, 0),
  };
}

function toSanitizedReport(
  report: ReturnType<typeof prepareRuntimeWorkshopHtmlPreview>,
  command: "report" | "html",
): Record<string, unknown> {
  return {
    ok: report.ok,
    command,
    kind: "runtime-workshop-preview-cli",
    environment: report.environment,
    modelProvider: "fake",
    preflight: report.workshopPreview.preflight,
    previewFailures: report.workshopPreview.previewFailures,
    accountId: report.workshopPreview.viewModel?.account_id,
    totals: report.workshopPreview.viewModel?.totals,
    lensItemCounts: lensItemCounts(report.workshopPreview.viewModel),
    lensEvidencePacketCounts: lensEvidencePacketCounts(report.workshopPreview.viewModel),
    htmlRendered: report.htmlRendered,
    htmlLength: report.html?.length ?? 0,
    graphSnapshotRead: report.graphSnapshotRead,
    serverStarted: report.serverStarted,
    clientsConstructed: report.clientsConstructed,
    providerCallsMade: report.providerCallsMade,
    productionWrites: report.productionWrites,
  };
}

async function run(): Promise<number> {
  const { command, inputPath, subject } = parseArgs(argv.slice(2));
  const report = await buildPreview(inputPath, subject);
  if (command === "html") {
    if (!report.ok || report.html === undefined) {
      printJson(toSanitizedReport(report, command));
      return 1;
    }
    process.stdout.write(report.html);
    return 0;
  }

  printJson(toSanitizedReport(report, command));
  return report.ok ? 0 : 1;
}

run()
  .then((code) => exit(code))
  .catch((e) => {
    printError(e);
    if (e instanceof CliUsageError) exit(2);
    if (e instanceof GraphFileParseError) exit(2);
    if (e instanceof GraphFileSchemaError) exit(1);
    if (e instanceof WorkshopGraphValidationError) exit(1);
    exit(2);
  });
