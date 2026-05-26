import { spawn, type ChildProcess } from "node:child_process";

import {
  assertSafeModelProviderRequest,
  type ModelProvider,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "./provider.ts";

const ONE_MEGABYTE = 1024 * 1024;
const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 300_000;
const SAFE_PROVIDER_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface ExternalCommandModelProviderOptions {
  readonly name: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly timeoutMs: number;
  readonly env?: Readonly<Record<string, string>>;
  readonly inheritEnvironment?: boolean;
}

export class ExternalCommandModelProvider implements ModelProvider {
  readonly name: string;
  private readonly command: string;
  private readonly args: readonly string[];
  private readonly timeoutMs: number;
  private readonly env: Readonly<Record<string, string>> | undefined;
  private readonly inheritEnvironment: boolean;

  constructor(options: ExternalCommandModelProviderOptions) {
    const snapshot = snapshotOptions(options);
    if (!SAFE_PROVIDER_NAME.test(snapshot.name)) {
      throw new Error("external provider name rejected");
    }
    if (!isSafeArg(snapshot.command)) {
      throw new Error("external provider command rejected");
    }
    for (const arg of snapshot.args) {
      if (!isSafeArg(arg)) {
        throw new Error("external provider command rejected");
      }
    }
    if (!Number.isInteger(snapshot.timeoutMs) || snapshot.timeoutMs < MIN_TIMEOUT_MS || snapshot.timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error("external provider timeout rejected");
    }

    this.name = snapshot.name;
    this.command = snapshot.command;
    this.args = Object.freeze([...snapshot.args]);
    this.timeoutMs = snapshot.timeoutMs;
    this.env = snapshot.env === undefined ? undefined : Object.freeze({ ...snapshot.env });
    this.inheritEnvironment = snapshot.inheritEnvironment;
  }

  async generate(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    assertSafeModelProviderRequest(request);
    const stdin = JSON.stringify(request);
    let stdout: string;
    try {
      stdout = await runExternalCommand({
        command: this.command,
        args: this.args,
        stdin,
        timeoutMs: this.timeoutMs,
        env: this.env,
        inheritEnvironment: this.inheritEnvironment,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "external provider command timed out") {
        throw error;
      }
      throw new Error("external provider command failed");
    }

    try {
      return parseModelProviderResponse(JSON.parse(stdout));
    } catch {
      throw new Error("external provider command returned invalid response");
    }
  }
}

function snapshotOptions(options: ExternalCommandModelProviderOptions): Required<Omit<ExternalCommandModelProviderOptions, "env" | "inheritEnvironment">> & { readonly env?: Readonly<Record<string, string>>; readonly inheritEnvironment: boolean } {
  try {
    const args = options.args === undefined ? [] : [...options.args];
    const env = options.env === undefined ? undefined : copyEnv(options.env);
    return Object.freeze({
      name: options.name,
      command: options.command,
      args: Object.freeze(args),
      timeoutMs: options.timeoutMs,
      inheritEnvironment: options.inheritEnvironment === true,
      ...(env === undefined ? {} : { env: Object.freeze(env) }),
    });
  } catch {
    throw new Error("external provider options rejected");
  }
}

function copyEnv(env: Readonly<Record<string, string>>): Record<string, string> {
  if (typeof env !== "object" || env === null || Array.isArray(env)) {
    throw new Error("external provider env rejected");
  }
  const copy: Record<string, string> = {};
  for (const key of Object.keys(env)) {
    const descriptor = Object.getOwnPropertyDescriptor(env, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string") {
      throw new Error("external provider env rejected");
    }
    if (!isSafeEnvName(key) || key.endsWith("_API_KEY") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token")) {
      throw new Error("external provider env rejected");
    }
    copy[key] = descriptor.value;
  }
  return copy;
}

function isSafeArg(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !value.includes("\0");
}

function isSafeEnvName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]{0,127}$/.test(value);
}

interface ExternalCommandRunOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly stdin: string;
  readonly timeoutMs: number;
  readonly env: Readonly<Record<string, string>> | undefined;
  readonly inheritEnvironment: boolean;
}

function runExternalCommand(options: ExternalCommandRunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, [...options.args], {
      env: externalCommandEnvironment(options),
      stdio: ["pipe", "pipe", "ignore"],
      detached: process.platform !== "win32",
    });
    const stdoutChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let timedOut = false;
    let settled = false;
    let killTimer: NodeJS.Timeout | null = null;
    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      terminateExternalCommand(child, "SIGTERM");
      killTimer = setTimeout(() => terminateExternalCommand(child, "SIGKILL"), 100);
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > ONE_MEGABYTE && !settled) {
        settled = true;
        clearTimeout(timer);
        if (killTimer !== null) clearTimeout(killTimer);
        terminateExternalCommand(child, "SIGTERM");
        reject(new Error("external provider command failed"));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer !== null) clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer !== null) clearTimeout(killTimer);
      if (timedOut) {
        reject(new Error("external provider command timed out"));
      } else if (code === 0) {
        resolve(Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8"));
      } else {
        reject(new Error("external provider command failed"));
      }
    });
    child.stdin.on("error", () => {
      // The command may exit before reading stdin. Close/error handling below returns a sanitized failure.
    });
    child.stdin.end(options.stdin);
  });
}

function externalCommandEnvironment(options: ExternalCommandRunOptions): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = options.inheritEnvironment
    ? { ...process.env }
    : { PATH: "/usr/local/bin:/usr/bin:/bin" };
  return options.env === undefined ? base : { ...base, ...options.env };
}

function terminateExternalCommand(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, signal);
      return;
    }
  } catch {
    // Fall back to killing the direct child below.
  }
  try {
    child.kill(signal);
  } catch {
    // Best-effort cleanup only; callers return sanitized timeout/failure errors.
  }
}

function parseModelProviderResponse(value: unknown): ModelProviderResponse {
  if (!isRecord(value) || !isRecord(value.output) || !isRecord(value.usage) || !isRecord(value.cost)) {
    throw new Error("invalid response");
  }
  const inputTokens = value.usage.inputTokens;
  const outputTokens = value.usage.outputTokens;
  const totalTokens = value.usage.totalTokens;
  const amount = value.cost.amount;
  if (
    typeof value.provider !== "string" ||
    typeof value.model !== "string" ||
    typeof value.idempotencyKey !== "string" ||
    !Array.isArray(value.output.excerpts) ||
    !Array.isArray(value.output.claims) ||
    !Array.isArray(value.output.account_objects) ||
    typeof inputTokens !== "number" ||
    !Number.isInteger(inputTokens) ||
    typeof outputTokens !== "number" ||
    !Number.isInteger(outputTokens) ||
    typeof totalTokens !== "number" ||
    !Number.isInteger(totalTokens) ||
    value.cost.currency !== "USD" ||
    typeof amount !== "number" ||
    !Number.isFinite(amount)
  ) {
    throw new Error("invalid response");
  }
  const safeInputTokens = inputTokens as number;
  const safeOutputTokens = outputTokens as number;
  const safeTotalTokens = totalTokens as number;
  return Object.freeze({
    provider: value.provider,
    model: value.model,
    idempotencyKey: value.idempotencyKey,
    output: Object.freeze({
      excerpts: Object.freeze([...value.output.excerpts]) as never[],
      claims: Object.freeze([...value.output.claims]) as never[],
      account_objects: Object.freeze([...value.output.account_objects]) as never[],
    }),
    usage: Object.freeze({
      inputTokens: safeInputTokens,
      outputTokens: safeOutputTokens,
      totalTokens: safeTotalTokens,
    }),
    cost: Object.freeze({ currency: "USD", amount }),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
