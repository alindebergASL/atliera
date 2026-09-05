import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { C3ModelRequest } from "./draft.ts";

export interface C3ModelProvider {
  readonly name: string;
  generate(request: C3ModelRequest, signal: AbortSignal): Promise<string>;
}

export class DisabledC3ModelProvider implements C3ModelProvider {
  readonly name = "disabled";
  async generate(_request: C3ModelRequest, _signal: AbortSignal): Promise<string> {
    throw new Error("model generation is disabled; an operator must configure C3_MODEL_COMMAND on the local server");
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

class CommandCleanupError extends Error { readonly cleanupConfirmed = false; }

export class CommandC3ModelProvider implements C3ModelProvider {
  readonly name = "operator-command";
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
      if (error instanceof CommandCleanupError) { cleanupConfirmed = false; this.#cleanupUnconfirmed = true; }
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
      error === undefined ? resolve(value ?? "") : reject(error);
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
      try { settle(undefined, new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes))); }
      catch { settle(new Error("model response was not valid UTF-8")); }
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => requestStop(new Error("generation timed out; remote billed-work status may be unknown")), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      if (stopError !== undefined) return;
      bytes += chunk.byteLength;
      if (bytes > maxOutputBytes) { requestStop(new Error("model response exceeded output bound; remote billed-work status may be unknown")); return; }
      chunks.push(Buffer.from(chunk));
    });
    child.stdout.on("end", () => { stdoutEnded = true; finish(); });
    child.on("error", () => { closeCode = null; stopError === undefined ? settle(new Error("operator model command failed")) : finishStopped(); });
    child.on("close", (code) => { closeCode = code; finish(); });
  });
}
