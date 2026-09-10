import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createGenerationRecord, type C3GenerationRecord, type C3ModelRequest } from "./draft.ts";
import { createC3VerificationRequest, retainC3Verification, type C3VerificationRequest, type C3Verification } from "./generation-contract-v6.ts";
import type { FrozenC3ViewContext } from "./view-context.ts";
import { canonicalJson } from "./context.ts";

export interface C3ModelProvider {
  readonly name: string;
  readonly executionMode?: "local" | "external";
  generate(request: C3ModelRequest, signal: AbortSignal): Promise<string>;
  /** Independent completion through the SAME admitted route and budget wrapper. No prior conversation. */
  verify?(request: C3VerificationRequest, signal: AbortSignal): Promise<string>;
}

export class DisabledC3ModelProvider implements C3ModelProvider {
  readonly name = "disabled";
  readonly executionMode = "local" as const;
  async generate(_request: C3ModelRequest, _signal: AbortSignal): Promise<string> {
    throw new Error("model generation is disabled; an operator must configure C3_MODEL_COMMAND on the local server");
  }
}

export interface RecordedC3Response {
  readonly request: C3ModelRequest;
  readonly rawResponse: string;
}

/** In-memory replay only: it has no command, network, or synthetic-response fallback. */
export class RecordedReplayC3ModelProvider implements C3ModelProvider {
  readonly name = "recorded-replay";
  readonly executionMode = "local" as const;
  readonly #responses: ReadonlyMap<string, string>;

  constructor(responses: readonly RecordedC3Response[]) {
    if (responses.length === 0) throw new Error("recorded replay requires at least one validated response");
    const exact = new Map<string, string>();
    for (const response of responses) {
      const identity = canonicalJson(response.request);
      if (exact.has(identity)) throw new Error("recorded replay contains a duplicate model request identity");
      exact.set(identity, response.rawResponse);
    }
    this.#responses = exact;
  }

  async generate(request: C3ModelRequest, signal: AbortSignal): Promise<string> {
    if (signal.aborted) throw new Error("recorded replay cancelled");
    const response = this.#responses.get(canonicalJson(request));
    if (response === undefined) {
      throw new Error("Recorded replay refused: no response matches this exact request. Restore the recorded audience, outcome, date, duration, correction, and prior draft identity; no live generation was attempted.");
    }
    return response;
  }
}

export interface CommandC3ModelProviderOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly killGraceMs?: number;
  /** Explicit non-secret wrapper configuration. Provider credentials must stay in the wrapper's private files. */
  readonly environment?: Readonly<Record<string, string>>;
}

/** Opt-in wrapper envelope; omission preserves the existing offline/default configuration.
 * The wrapper must budget transport and durable finalization within these bounds.
 * This configuration neither enables a command nor authorizes a dispatch.
 */
export function commandC3TimingOptions(value: string | undefined): Partial<CommandC3ModelProviderOptions> {
  if (value === undefined) return {};
  if (!/^[1-9][0-9]{3,5}$/u.test(value) || Number(value) < 1_000 || Number(value) > 300_000) {
    throw new Error('C3_MODEL_TIMEOUT_MS timeout refused');
  }
  return { timeoutMs: Number(value), killGraceMs: 15_000,
    environment: { C3_COMMAND_TIMEOUT_MS: value, C3_COMMAND_KILL_GRACE_MS: '15000' } };
}

class CommandCleanupError extends Error { readonly cleanupConfirmed = false; }

export interface C3TransportFailure {
  readonly kind: 'atliera.c3.transport-failure';
  readonly rawResponseBase64: string;
  readonly receivedBytes: number;
  readonly retainedBytes: number;
  readonly truncated: boolean;
  readonly completion: 'failed';
  readonly message: string;
}
export class C3CommandResponseError extends Error {
  constructor(message: string, readonly receipt: C3TransportFailure, readonly cleanupConfirmed = true) { super(message); }
}
/** Arbitrary adapters cannot supply invented original bytes through their error message. */
export function c3TransportFailure(error: unknown): C3TransportFailure {
  if (error instanceof C3CommandResponseError) return error.receipt;
  return {kind:'atliera.c3.transport-failure',rawResponseBase64:'',receivedBytes:0,retainedBytes:0,truncated:false,
    completion:'failed',message:'Provider failed without a transport-byte receipt.'};
}

export class CommandC3ModelProvider implements C3ModelProvider {
  readonly name = "operator-command";
  readonly executionMode = "external" as const;
  readonly #command: string;
  readonly #timeoutMs: number;
  readonly #maxOutputBytes: number;
  readonly #args: readonly string[];
  readonly #killGraceMs: number;
  readonly #environment: Readonly<Record<string, string>>;
  #active = false;
  #cleanupUnconfirmed = false;

  constructor(options: CommandC3ModelProviderOptions) {
    if (typeof options.command !== "string" || options.command.length === 0 || options.command.length > 4096 || options.command.includes("\0")) {
      throw new Error("operator command must be one bounded executable path");
    }
    this.#command = options.command;
    this.#args = Object.freeze([...(options.args ?? [])]);
    if (this.#args.some((arg) => typeof arg !== "string" || arg.length === 0 || arg.length > 4096 || arg.includes("\0"))) {
      throw new Error("operator command arguments refused");
    }
    this.#timeoutMs = options.timeoutMs ?? 120_000;
    this.#maxOutputBytes = options.maxOutputBytes ?? 256 * 1024;
    this.#killGraceMs = options.killGraceMs ?? 1_000;
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs < 1_000 || this.#timeoutMs > 300_000) throw new Error("provider timeout refused");
    if (!Number.isInteger(this.#maxOutputBytes) || this.#maxOutputBytes < 1_024 || this.#maxOutputBytes > 1024 * 1024) throw new Error("provider output bound refused");
    if (!Number.isInteger(this.#killGraceMs) || this.#killGraceMs < 10 || this.#killGraceMs > 15_000) throw new Error("provider kill grace refused");
    this.#environment = commandEnvironment(options.environment ?? {});
  }

  async generate(request: C3ModelRequest, signal: AbortSignal): Promise<string> {
    return this.#execute(request, signal);
  }

  async verify(request: C3VerificationRequest, signal: AbortSignal): Promise<string> {
    return this.#execute(request, signal);
  }

  async #execute(request: C3ModelRequest | C3VerificationRequest, signal: AbortSignal): Promise<string> {
    if (this.#cleanupUnconfirmed) throw new Error("operator command provider is held because owned process cleanup was not confirmed");
    if (this.#active) throw new Error("one generation is already running");
    this.#active = true;
    let directory: string | undefined;
    let cleanupConfirmed = true;
    try {
      directory = await mkdtemp(join(tmpdir(), "atliera-c3-request-"));
      const requestPath = join(directory, "model-request.json");
      const serialized = `${JSON.stringify(request)}\n`;
      if (Buffer.byteLength(serialized, "utf8") > 8 * 1024 * 1024) throw new Error("model request exceeds input bound");
      await writeFile(requestPath, serialized, { encoding: "utf8", mode: 0o600 });
      return await runCommand(this.#command, this.#args, requestPath, this.#timeoutMs, this.#maxOutputBytes,
        this.#killGraceMs, this.#environment, signal);
    } catch (error) {
      if ((error instanceof CommandCleanupError || error instanceof C3CommandResponseError && !error.cleanupConfirmed)) { cleanupConfirmed = false; this.#cleanupUnconfirmed = true; }
      throw error;
    } finally {
      this.#active = false;
      if (directory !== undefined && cleanupConfirmed) await rm(directory, { recursive: true, force: true });
    }
  }
}

const MINIMAL_ENV_KEYS = ["PATH", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "TZ", "SYSTEMROOT", "WINDIR"] as const;

function commandEnvironment(explicit: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const key of MINIMAL_ENV_KEYS) if (process.env[key] !== undefined) result[key] = process.env[key]!;
  for (const [key, value] of Object.entries(explicit)) {
    if (!/^[A-Z_][A-Z0-9_]{0,63}$/u.test(key) || /(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|API_KEY|PRIVATE_KEY)/u.test(key) ||
        typeof value !== "string" || value.length > 4_096 || value.includes("\0")) throw new Error("operator command environment refused");
    result[key] = value;
  }
  return Object.freeze(result);
}

function terminate(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try { process.kill(-child.pid, signal); return; } catch { /* direct child fallback */ }
  try { child.kill(signal); } catch { /* best effort */ }
}

function processGroupAlive(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try { process.kill(process.platform === "win32" ? pid : -pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

function runCommand(command: string, args: readonly string[], requestPath: string, timeoutMs: number, maxOutputBytes: number,
  killGraceMs: number, environment: Readonly<Record<string, string>>, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("generation cancelled")); return; }
    const child = spawn(command, [...args, requestPath], {
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...environment },
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let receivedBytes = 0;
    let settled = false;
    let closeCode: number | null | undefined;
    let stdoutEnded = false;
    let stopError: Error | undefined;
    let escalationTimer: NodeJS.Timeout | undefined;
    let cleanupDeadlineTimer: NodeJS.Timeout | undefined;
    const settle = (error?: Error, value?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (escalationTimer !== undefined) clearTimeout(escalationTimer);
      if (cleanupDeadlineTimer !== undefined) clearTimeout(cleanupDeadlineTimer);
      signal.removeEventListener("abort", onAbort);
      if (error === undefined) resolve(value ?? "");
      else reject(new C3CommandResponseError(error.message, {
        kind: 'atliera.c3.transport-failure', rawResponseBase64: Buffer.concat(chunks, bytes).toString('base64'),
        receivedBytes, retainedBytes: bytes, truncated: receivedBytes > bytes, completion: 'failed', message: error.message,
      }, !(error instanceof CommandCleanupError)));
    };
    const finishStopped = (): void => {
      if (closeCode === undefined || processGroupAlive(child.pid)) return;
      settle(stopError ?? new Error("operator model command stopped"));
    };
    const escalate = (): void => {
      terminate(child, "SIGKILL");
      cleanupDeadlineTimer = setTimeout(() => {
        if (processGroupAlive(child.pid)) {
          settle(new CommandCleanupError("owned process group cleanup could not be confirmed; provider is held"));
        } else finishStopped();
      }, killGraceMs);
      cleanupDeadlineTimer.unref?.();
    };
    const requestStop = (error: Error): void => {
      if (stopError !== undefined || settled) return;
      stopError = error;
      terminate(child, "SIGTERM");
      escalationTimer = setTimeout(escalate, killGraceMs);
      escalationTimer.unref?.();
      finishStopped();
    };
    const onAbort = (): void => requestStop(new Error("generation cancelled; remote billed-work status may be unknown"));
    const finish = (): void => {
      if (stopError !== undefined) { finishStopped(); return; }
      if (!stdoutEnded || closeCode === undefined) return;
      if (processGroupAlive(child.pid)) { requestStop(new Error("operator model command left an owned descendant running")); return; }
      if (closeCode !== 0) { settle(new Error("operator model command failed")); return; }
      try { settle(undefined, new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks, bytes))); }
      catch { settle(new Error("model response was not valid UTF-8")); }
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => requestStop(new Error("generation timed out; remote billed-work status may be unknown")), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.byteLength;
      const remaining = maxOutputBytes - bytes;
      if (remaining > 0) { const retained = chunk.subarray(0, remaining); chunks.push(Buffer.from(retained)); bytes += retained.length; }
      if (receivedBytes > maxOutputBytes) { requestStop(new Error("model response exceeded output bound; remote billed-work status may be unknown")); return; }
      if (stopError !== undefined) return;
    });
    child.stdout.on("end", () => { stdoutEnded = true; finish(); });
    child.on("error", () => { closeCode = null; stopError === undefined ? settle(new Error("operator model command failed")) : finishStopped(); });
    child.on("close", (code) => { closeCode = code; finish(); });
  });
}

/** One candidate and at most one independent verification; never retries, repairs or rewrites.
 * External callers must durably retain the result before it becomes usable session work.
 * Replay must use saved verification instead of invoking this fresh-generation entry point. */
export async function generateVerifiedC3Record(provider: C3ModelProvider, request: C3ModelRequest,
  context: FrozenC3ViewContext, signal: AbortSignal,
  audit?: C3GenerationAudit): Promise<C3GenerationRecord> {
  if (request.generationContractVersion !== '6') throw new Error('Fresh generation requires contract 6.');
  if (provider.executionMode === 'external' && (!provider.verify || !audit || typeof audit.retainCandidate !== 'function' || typeof audit.retainRecord !== 'function' || typeof audit.retainFailure !== 'function')) {
    throw new Error('Fresh generation requires the shared budgeted verification route and private attempt retention.');
  }
  let raw: string;
  try { raw = await provider.generate(request, signal); }
  catch (error) { await audit?.retainFailure(request, c3TransportFailure(error)); throw error; }
  await audit?.retainCandidate(request, raw);
  let verification: C3Verification | undefined;
  let verificationRequest: C3VerificationRequest | undefined;
  try { verificationRequest = createC3VerificationRequest(request, raw, context); }
  catch { /* Structural refusal is retained without dispatching a semantic check. */ }
  if (verificationRequest) {
    let verifierRaw: string | null = null;
    if (!signal.aborted && provider.verify) {
      try { verifierRaw = await provider.verify(verificationRequest, signal); }
      catch (error) { await audit?.retainFailure(verificationRequest, c3TransportFailure(error)); }
    }
    verification = retainC3Verification(verificationRequest, verifierRaw);
  }
  const record = createGenerationRecord(request, raw, context, verification);
  await audit?.retainRecord(record);
  return record;
}

export interface C3GenerationAudit {
  /** Must acknowledge durable storage before verification starts. */
  retainCandidate(request: C3ModelRequest, rawResponse: string): Promise<void>;
  /** Must acknowledge durable storage before acceptance, even for refusals. */
  retainRecord(record: C3GenerationRecord): Promise<void>;
  retainFailure(request: C3ModelRequest | C3VerificationRequest, failure: C3TransportFailure): Promise<void>;
}
