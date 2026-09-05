import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadC3AccountContext } from "./context.ts";
import { assertReplayIdentity, createC3ModelRequest, createGenerationRecord, type C3GenerationRecord } from "./draft.ts";
import { CommandC3ModelProvider, DisabledC3ModelProvider } from "./provider.ts";
import { renderC3Page } from "./render.ts";
import { startC3Server } from "./service.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const BROAD = resolve(REPO, "fixtures/account-intelligence/c2-01/broad-account-research-input.json");
const OWNER = resolve(REPO, "docs/decisions/c2-owner-disposition-record.json");
const PROPOSALS: Readonly<Record<string, string>> = Object.freeze({
  acc_university_of_utah: resolve(REPO, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json"),
  acc_fedex_corp: resolve(REPO, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/fedex-validated-proposal.json"),
});

async function contextFor(accountId: string) {
  const proposalPath = PROPOSALS[accountId];
  if (proposalPath === undefined) throw new Error(`no configured validated C2 proposal for ${accountId}`);
  return loadC3AccountContext({ broadInputPath: BROAD, proposalPath, ownerDecisionPath: OWNER, accountId });
}

async function ensureOutput(directory: string): Promise<string> {
  const output = resolve(directory);
  const fromRepository = relative(REPO, output);
  if (fromRepository === "" || (fromRepository !== ".." && !fromRepository.startsWith(`..${sep}`) && !isAbsolute(fromRepository))) {
    throw new Error("C3 evaluation output directory must be outside the repository");
  }
  await mkdir(output, { recursive: true });
  return output;
}

async function loadContextCommand(args: readonly string[]): Promise<void> {
  const [accountId, outputDirectory] = args;
  if (accountId === undefined || outputDirectory === undefined || args.length !== 2) throw new Error("usage: load-context ACCOUNT_ID OUTPUT_DIRECTORY");
  const frozen = await contextFor(accountId);
  const output = await ensureOutput(outputDirectory);
  await Promise.all([
    writeFile(resolve(output, "account-context.json"), `${JSON.stringify(frozen.context, null, 2)}\n`),
    writeFile(resolve(output, "account-context-identity.json"), `${JSON.stringify({ kind: "atliera.c3.account-context-identity", schemaVersion: "1", sha256: frozen.sha256 }, null, 2)}\n`),
  ]);
  process.stdout.write(`${JSON.stringify({ accountId, contextSha256: frozen.sha256, sources: frozen.context.admittedSources.length })}\n`);
}

async function emitRequestCommand(args: readonly string[]): Promise<void> {
  const [accountId, audience, intendedOutcome, meetingDate, outputDirectory] = args;
  if ([accountId, audience, intendedOutcome, meetingDate, outputDirectory].some((value) => value === undefined) || args.length !== 5) {
    throw new Error("usage: emit-model-request ACCOUNT_ID AUDIENCE INTENDED_OUTCOME MEETING_DATE OUTPUT_DIRECTORY");
  }
  const frozen = await contextFor(accountId!);
  const request = createC3ModelRequest(frozen, { audience, intendedOutcome, durationMinutes: 15, meetingDate });
  const output = await ensureOutput(outputDirectory!);
  await writeFile(resolve(output, "model-request.json"), `${JSON.stringify(request, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ accountId, contextSha256: frozen.sha256, meetingRequestSha256: request.meetingRequestSha256 })}\n`);
}

function recordedRequest(value: unknown): ReturnType<typeof createC3ModelRequest> {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error("recorded model request must be an object");
  return value as ReturnType<typeof createC3ModelRequest>;
}

async function renderRecordedCommand(args: readonly string[]): Promise<void> {
  const [accountId, requestPath, rawResponsePath, outputDirectory] = args;
  if ([accountId, requestPath, rawResponsePath, outputDirectory].some((value) => value === undefined) || args.length !== 4) {
    throw new Error("usage: render-recorded-draft ACCOUNT_ID MODEL_REQUEST_JSON RAW_RESPONSE_TEXT OUTPUT_DIRECTORY");
  }
  const frozen = await contextFor(accountId!);
  const supplied = recordedRequest(JSON.parse(await readFile(resolve(requestPath!), "utf8")));
  const expected = createC3ModelRequest(frozen, supplied.meetingRequest, supplied.revision);
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) throw new Error("recorded model request identity or prompt mismatch");
  const rawResponse = await readFile(resolve(rawResponsePath!), "utf8");
  const record = createGenerationRecord(expected, rawResponse, frozen);
  assertReplayIdentity(record, frozen);
  const output = await ensureOutput(outputDirectory!);
  const page = record.outcome === "succeeded"
    ? renderC3Page(frozen, { page: "draft", record, correctionNote: "" }, "recorded-read-only")
    : renderC3Page(frozen, { page: "prepare", request: expected.meetingRequest,
      error: `Recorded candidate refused without repair: ${record.refusal!.message}` }, "recorded-read-only");
  await Promise.all([
    writeFile(resolve(output, "generation-record.json"), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 }),
    writeFile(resolve(output, "draft.html"), page),
  ]);
  process.stdout.write(`${JSON.stringify({ recordId: record.recordId, outcome: record.outcome,
    rawResponseSha256: record.rawResponseSha256, output: resolve(output, "draft.html") })}\n`);
}

async function serveCommand(args: readonly string[]): Promise<void> {
  const [accountId = "acc_university_of_utah"] = args;
  if (args.length > 1) throw new Error("usage: serve [ACCOUNT_ID]");
  const frozen = await contextFor(accountId);
  const command = process.env.C3_MODEL_COMMAND;
  const provider = command === undefined ? new DisabledC3ModelProvider() : new CommandC3ModelProvider({ command });
  const portText = process.env.C3_PORT ?? "4317";
  if (!/^\d{1,5}$/u.test(portText) || Number(portText) < 1 || Number(portText) > 65535) throw new Error("C3_PORT refused");
  const running = await startC3Server({ context: frozen, provider, port: Number(portText) });
  process.stdout.write(`${running.origin}\n`);
  const stop = (): void => { void running.close().then(() => process.exit(0)); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, ...args] = argv;
  if (command === "load-context") return loadContextCommand(args);
  if (command === "emit-model-request") return emitRequestCommand(args);
  if (command === "render-recorded-draft") return renderRecordedCommand(args);
  if (command === "serve") return serveCommand(args);
  throw new Error("usage: c3 <load-context|emit-model-request|render-recorded-draft|serve> ...");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
