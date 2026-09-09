import { mkdir, readFile, writeFile, realpath, readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { canonicalJson, loadC3AccountContext } from "./context.ts";
import { loadCuratedC3Context } from "./curated-context.ts";
import { isCuratedContext, type FrozenC3ViewContext as FrozenC3AccountContext } from "./view-context.ts";
import { assertReplayIdentity, reconstructC3ModelRequest, createC3ModelRequest, createC3RevisionContext, createGenerationRecord,
  type C3GenerationRecord, type C3ModelRequest } from "./draft.ts";
import { CommandC3ModelProvider, DisabledC3ModelProvider, RecordedReplayC3ModelProvider } from "./provider.ts";
import { renderC3Page } from "./render.ts";
import { startC3Server } from "./service.ts";
import { C3GenerationJournal } from "./generation-journal.ts";
import { buildC3RetainedEvaluationCases, runC3VerifierEvaluation, type C3EvaluationCase } from './generation-evaluation.ts';
import type { C3Verification } from "./generation-contract-v6.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const BROAD = resolve(REPO, "fixtures/account-intelligence/c2-01/broad-account-research-input.json");
const OWNER = resolve(REPO, "docs/decisions/c2-owner-disposition-record.json");
const PROPOSALS: Readonly<Record<string, string>> = Object.freeze({
  acc_university_of_utah: resolve(REPO, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/university-of-utah-validated-proposal.json"),
  acc_fedex_corp: resolve(REPO, "docs/ux/c2-governed-account-intelligence-refresh/data/fresh/fedex-validated-proposal.json"),
});

const CURATED_INPUTS: Readonly<Record<string, string>> = Object.freeze({
  acc_university_of_missouri: resolve(REPO, "fixtures/account-intelligence/c3-curated/missouri.json"),
});

async function contextFor(accountId: string) {
  const curated = CURATED_INPUTS[accountId];
  if (curated !== undefined) return loadCuratedC3Context(curated, accountId);
  const proposalPath = PROPOSALS[accountId];
  if (proposalPath === undefined) throw new Error(`no configured validated C2 proposal for ${accountId}`);
  return loadC3AccountContext({ broadInputPath: BROAD, proposalPath, ownerDecisionPath: OWNER, accountId });
}

async function ensureOutput(directory: string): Promise<string> {
  const output = resolve(directory);
  const repository = await realpath(REPO);
  const outside = (candidate: string): boolean => {
    const path = relative(repository, candidate);
    return path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
  };
  let ancestor = output;
  let canonicalAncestor: string;
  while (true) {
    try { canonicalAncestor = await realpath(ancestor); break; }
    catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || dirname(ancestor) === ancestor) throw error;
      ancestor = dirname(ancestor);
    }
  }
  const canonicalTarget = resolve(canonicalAncestor, relative(ancestor, output));
  if (!outside(output) || !outside(canonicalTarget)) {
    throw new Error("C3 evaluation output directory must be outside the repository");
  }
  await mkdir(output, { recursive: true });
  if (!outside(await realpath(output))) throw new Error("C3 canonical output must be outside the repository");
  if ((await readdir(output)).length !== 0) throw new Error("C3 evaluation output directory must be empty; existing files are not overwritten");
  return output;
}

async function loadContextCommand(args: readonly string[]): Promise<void> {
  const [accountId, outputDirectory] = args;
  if (accountId === undefined || outputDirectory === undefined || args.length !== 2) throw new Error("usage: load-context ACCOUNT_ID OUTPUT_DIRECTORY");
  const frozen = await contextFor(accountId);
  const output = await ensureOutput(outputDirectory);
  await Promise.all([
    writeFile(resolve(output, "account-context.json"), `${JSON.stringify(frozen.context, null, 2)}\n`, { mode: 0o600, flag: "wx" }),
    writeFile(resolve(output, "account-context-identity.json"), `${JSON.stringify({ kind: "atliera.c3.account-context-identity", schemaVersion: "1", sha256: frozen.sha256 }, null, 2)}\n`, { mode: 0o600, flag: "wx" }),
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
  await writeFile(resolve(output, "model-request.json"), `${JSON.stringify(request, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  process.stdout.write(`${JSON.stringify({ accountId, contextSha256: frozen.sha256, meetingRequestSha256: request.meetingRequestSha256 })}\n`);
}

function recordedRequest(value: unknown): ReturnType<typeof createC3ModelRequest> {
  if (value === null || Array.isArray(value) || typeof value !== "object") throw new Error("recorded model request must be an object");
  return value as ReturnType<typeof createC3ModelRequest>;
}

async function boundedFile(path: string, maxBytes: number, label: string): Promise<Buffer> {
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > maxBytes) throw new Error(`${label} must be a bounded regular file`);
  return readFile(path);
}

function fatalText(bytes: Buffer, label: string, preserveBom: boolean): string {
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: preserveBom }).decode(bytes); }
  catch { throw new Error(`${label} must be valid UTF-8`); }
}

interface LoadedRecording { readonly request: C3ModelRequest; readonly record: C3GenerationRecord; }

async function loadRecording(context: FrozenC3AccountContext, directory: string, label: string): Promise<LoadedRecording> {
  const requestPath = resolve(directory, "model-request.json");
  const rawPath = resolve(directory, "raw-response.txt");
  const requestText = fatalText(await boundedFile(requestPath, 8 * 1024 * 1024, `${label} model request`), `${label} model request`, false);
  let value: unknown;
  try { value = JSON.parse(requestText); } catch { throw new Error(`${label} model request must be strict JSON`); }
  const supplied = recordedRequest(value);
  const expected = reconstructC3ModelRequest(context, supplied);
  if (canonicalJson(supplied) !== canonicalJson(expected)) throw new Error(`${label} recorded model request identity or prompt mismatch`);
  const rawResponse = fatalText(await boundedFile(rawPath, 256 * 1024, `${label} raw response`), `${label} raw response`, true);
  let verification: C3Verification | undefined;
  if (expected.generationContractVersion === '6') {
    verification = JSON.parse(fatalText(await boundedFile(resolve(directory, 'verification.json'), 8 * 1024 * 1024,
      `${label} verification`), `${label} verification`, false)) as C3Verification;
  }
  const record = createGenerationRecord(expected, rawResponse, context, verification);
  assertReplayIdentity(record, context);
  if (record.outcome !== "succeeded") throw new Error(`${label} recorded candidate refused without repair: ${record.refusal!.message}`);
  return { request: expected, record };
}

export interface C3RecordedReplayBundle {
  readonly provider: RecordedReplayC3ModelProvider;
  readonly initialRequest: C3ModelRequest["meetingRequest"];
  readonly correctionNote: string;
  readonly priorRecord: C3GenerationRecord;
  readonly revisionRecord: C3GenerationRecord;
}

/** Fully reads, recreates, validates, and links both recordings before a socket can be opened. */
export async function loadC3RecordedReplay(context: FrozenC3AccountContext, recordingDirectory: string): Promise<C3RecordedReplayBundle> {
  const root = resolve(recordingDirectory);
  const prior = await loadRecording(context, resolve(root, "prior"), "prior");
  const revision = await loadRecording(context, resolve(root, "revision"), "revision");
  if (prior.request.revision !== null) throw new Error("prior recording must be an initial request without revision context");
  if (revision.request.revision === null) throw new Error("revision recording must include revision context");
  const linkedRevision = createC3RevisionContext(prior.record, revision.request.revision.correctionNote,
    revision.request.revision.revisionNumber);
  const exactRevisionRequest = reconstructC3ModelRequest(context, {...revision.request, meetingRequest: prior.request.meetingRequest, revision: linkedRevision});
  if (canonicalJson(revision.request) !== canonicalJson(exactRevisionRequest)) {
    throw new Error("revision recording does not exactly bind the supplied correction to the supplied prior response and draft identity");
  }
  const exactRevisionRecord = createGenerationRecord(exactRevisionRequest, revision.record.rawResponse, context, revision.record.verification);
  assertReplayIdentity(exactRevisionRecord, context);
  if (exactRevisionRecord.recordId !== revision.record.recordId ||
      canonicalJson(exactRevisionRecord.draft) !== canonicalJson(revision.record.draft)) {
    throw new Error("revision recording changed while linking exact prior and response identities");
  }
  return { provider: new RecordedReplayC3ModelProvider([
    { request: prior.request, rawResponse: prior.record.rawResponse },
    { request: exactRevisionRequest, rawResponse: exactRevisionRecord.rawResponse },
  ]), initialRequest: prior.request.meetingRequest, correctionNote: linkedRevision.correctionNote,
  priorRecord: prior.record, revisionRecord: exactRevisionRecord };
}

async function renderRecordedCommand(args: readonly string[]): Promise<void> {
  const [accountId, requestPath, rawResponsePath, outputDirectory] = args;
  if ([accountId, requestPath, rawResponsePath, outputDirectory].some((value) => value === undefined) || args.length !== 4) {
    throw new Error("usage: render-recorded-draft ACCOUNT_ID MODEL_REQUEST_JSON RAW_RESPONSE_TEXT OUTPUT_DIRECTORY");
  }
  const frozen = await contextFor(accountId!);
  const supplied = recordedRequest(JSON.parse(await readFile(resolve(requestPath!), "utf8")));
  const expected = reconstructC3ModelRequest(frozen, supplied);
  if (JSON.stringify(supplied) !== JSON.stringify(expected)) throw new Error("recorded model request identity or prompt mismatch");
  const rawResponse = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(await readFile(resolve(rawResponsePath!)));
  let verification: C3Verification | undefined;
  if (expected.generationContractVersion === '6') {
    try { verification = JSON.parse(fatalText(await boundedFile(resolve(dirname(requestPath!), 'verification.json'), 8 * 1024 * 1024, 'recorded verification'), 'recorded verification', false)) as C3Verification; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    // Missing verification yields a retained typed refusal, never acceptance or a fresh call.
  }
  const record = createGenerationRecord(expected, rawResponse, frozen, verification);
  assertReplayIdentity(record, frozen);
  const output = await ensureOutput(outputDirectory!);
  const page = record.outcome === "succeeded"
    ? renderC3Page(frozen, { page: "draft", record, correctionNote: "" }, "recorded-read-only")
    : renderC3Page(frozen, { page: "prepare", request: expected.meetingRequest,
      error: `Recorded candidate refused without repair: ${record.refusal!.message}` }, "recorded-read-only");
  await Promise.all([
    writeFile(resolve(output, "generation-record.json"), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: "wx" }),
    writeFile(resolve(output, "draft.html"), page, { mode: 0o600, flag: "wx" }),
  ]);
  process.stdout.write(`${JSON.stringify({ recordId: record.recordId, outcome: record.outcome,
    rawResponseSha256: record.rawResponseSha256, output: resolve(output, "draft.html") })}\n`);
}

function configuredWorkStore(): {root:string;principal:string} | undefined {
  const root=process.env.C3_WORK_STORE_ROOT;
  const principal=process.env.C3_OPERATOR_PRINCIPAL;
  if(root===undefined && principal===undefined)return undefined;
  if(!root || !principal)throw Error('C3_WORK_STORE_ROOT and C3_OPERATOR_PRINCIPAL must both be explicitly configured');
  return {root,principal};
}

async function serveCommand(args: readonly string[]): Promise<void> {
  const [accountId = "acc_university_of_utah"] = args;
  if (args.length > 1) throw new Error("usage: serve [ACCOUNT_ID]");
  const frozen = await contextFor(accountId);
  const command = process.env.C3_MODEL_COMMAND;
  const provider = command === undefined || isCuratedContext(frozen) ? new DisabledC3ModelProvider() : new CommandC3ModelProvider({ command });
  const portText = process.env.C3_PORT ?? "4317";
  if (!/^\d{1,5}$/u.test(portText) || Number(portText) < 1 || Number(portText) > 65535) throw new Error("C3_PORT refused");
  const auditRoot = process.env.C3_GENERATION_AUDIT_ROOT;
  if (provider.executionMode === 'external' && !auditRoot) throw new Error('C3_GENERATION_AUDIT_ROOT is required for fresh generation.');
  const generationAudit = auditRoot ? new C3GenerationJournal(auditRoot) : undefined;
  const running = await startC3Server({ context: frozen, provider, generationAudit, workStore: configuredWorkStore(), port: Number(portText) });
  process.stdout.write(`${running.origin}\n`);
  const stop = (): void => { void running.close().then(() => process.exit(0)); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}

async function serveRecordedCommand(args: readonly string[]): Promise<void> {
  const [recordingDirectory, accountId = "acc_university_of_utah"] = args;
  if (recordingDirectory === undefined || args.length > 2) throw new Error("usage: serve-recorded RECORDING_DIRECTORY [ACCOUNT_ID]");
  const frozen = await contextFor(accountId);
  // C3_MODEL_COMMAND is intentionally neither read nor passed: this command has no external-provider path.
  const replay = await loadC3RecordedReplay(frozen, recordingDirectory);
  const portText = process.env.C3_PORT ?? "4317";
  if (!/^\d{1,5}$/u.test(portText) || Number(portText) < 1 || Number(portText) > 65535) throw new Error("C3_PORT refused");
  const running = await startC3Server({ context: frozen, provider: replay.provider, workStore: configuredWorkStore(), port: Number(portText),
    recordedReplay: { initialRequest: replay.initialRequest, correctionNote: replay.correctionNote, priorRecord: replay.priorRecord, revisionRecord: replay.revisionRecord } });
  process.stdout.write(`${running.origin}\n`);
  const stop = (): void => { void running.close().then(() => process.exit(0)); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}

/** Offline preparation is separate from explicit, wrapper-controlled model execution. */
async function prepareVerifierEvaluation(args: readonly string[]): Promise<void> {
  if (args.length !== 1) throw new Error('usage: prepare-verifier-evaluation OUTPUT_DIRECTORY');
  const [utah, fedex] = await Promise.all([contextFor('acc_university_of_utah'), contextFor('acc_fedex_corp')]);
  const cases = buildC3RetainedEvaluationCases(utah, fedex);
  const output = await ensureOutput(args[0]!);
  await writeFile(resolve(output, 'evaluation-cases.json'), JSON.stringify(cases, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  process.stdout.write(JSON.stringify({cases: cases.length, modelCalls: 0, output}) + '\n');
}

async function runVerifierEvaluation(args: readonly string[]): Promise<void> {
  const [casePath, outputPath, deadline, maxCallsText, admission] = args;
  if (args.length !== 5 || admission !== '--budgeted' || !/^(?:[0-9]|1[0-9]|2[0-4])$/u.test(maxCallsText!)) {
    throw new Error('usage: run-verifier-evaluation CASES_JSON OUTPUT_DIRECTORY DEADLINE_ISO MAX_CALLS --budgeted');
  }
  const command = process.env.C3_MODEL_COMMAND;
  if (!command) throw new Error('C3_MODEL_COMMAND must name the existing approved route budget wrapper.');
  const cases = JSON.parse(fatalText(await boundedFile(resolve(casePath!), 32 * 1024 * 1024, 'evaluation cases'), 'evaluation cases', false)) as C3EvaluationCase[];
  const output = await ensureOutput(outputPath!);
  const audit = new C3GenerationJournal(resolve(output, 'attempts'));
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const report = await runC3VerifierEvaluation(cases, new CommandC3ModelProvider({command}), audit,
      {deadline: deadline!, maxCalls: Number(maxCallsText), signal: controller.signal,
        onRow: async row => { await writeFile(resolve(output, `row-${row.recordId}.json`), JSON.stringify(row, null, 2) + '\n', {mode: 0o600, flag: 'wx'}); }});
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
    process.stdout.write(JSON.stringify({completedCases: report.completedCases, calls: report.calls, stopped: report.stopped, output}) + '\n');
  } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const [command, ...args] = argv;
  if (command === "prepare-verifier-evaluation") return prepareVerifierEvaluation(args);
  if (command === "run-verifier-evaluation") return runVerifierEvaluation(args);
  if (command === "load-context") return loadContextCommand(args);
  if (command === "emit-model-request") return emitRequestCommand(args);
  if (command === "render-recorded-draft") return renderRecordedCommand(args);
  if (command === "serve") return serveCommand(args);
  if (command === "serve-recorded") return serveRecordedCommand(args);
  throw new Error("usage: c3 <load-context|emit-model-request|render-recorded-draft|serve|serve-recorded> ...");
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
