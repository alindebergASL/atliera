import { timingSafeEqual } from "node:crypto";

export type LocalBearerAuthEnv = Record<string, string | undefined>;

export type LocalBearerAuthConfig =
  | {
      readonly mode: "required";
      readonly token: string;
    }
  | {
      readonly mode: "disabled-local-dev";
    };

export type BearerAuthStatus = "authorized" | "missing" | "invalid" | "disabled-local-dev";

export interface BearerAuthResult {
  readonly ok: boolean;
  readonly status: BearerAuthStatus;
  readonly failureCode: "bearer_token_missing" | "bearer_token_invalid" | undefined;
  readonly providerCallsMade: 0;
  readonly productionWrites: false;
}

export type HttpHeaderValue = string | readonly string[] | undefined;
export type HttpHeadersLike = Record<string, HttpHeaderValue>;

function readNonEmpty(env: LocalBearerAuthEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

export function parseLocalBearerAuthConfig(env: LocalBearerAuthEnv): LocalBearerAuthConfig {
  const mode = readNonEmpty(env, "ATLIERA_LOCAL_AUTH_MODE");
  if (mode !== undefined && mode !== "disabled-local-dev") {
    throw new Error("ATLIERA_LOCAL_AUTH_MODE must be disabled-local-dev when set");
  }
  if (mode === "disabled-local-dev") {
    return { mode };
  }

  const rawToken = env.ATLIERA_LOCAL_BEARER_TOKEN;
  if (rawToken !== undefined && rawToken.trim() === "") {
    throw new Error("ATLIERA_LOCAL_BEARER_TOKEN must be non-empty when auth is required");
  }
  const token = readNonEmpty(env, "ATLIERA_LOCAL_BEARER_TOKEN");
  if (token === undefined) {
    throw new Error("ATLIERA_LOCAL_BEARER_TOKEN is required unless auth is explicitly disabled for local development");
  }
  return { mode: "required", token };
}

function readHeader(headers: HttpHeadersLike, wanted: string): string | undefined {
  const wantedLower = wanted.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== wantedLower) continue;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") return value[0];
    return undefined;
  }
  return undefined;
}

function parseBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) return undefined;
  const match = /^Bearer\s+(.+)$|^bearer\s+(.+)$/.exec(authorization.trim());
  const token = match?.[1] ?? match?.[2];
  if (token === undefined || token.trim() === "") return undefined;
  return token;
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) {
    const max = Math.max(aBuffer.length, bBuffer.length, 1);
    const paddedA = Buffer.alloc(max);
    const paddedB = Buffer.alloc(max);
    aBuffer.copy(paddedA);
    bBuffer.copy(paddedB);
    timingSafeEqual(paddedA, paddedB);
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function result(input: Pick<BearerAuthResult, "ok" | "status" | "failureCode">): BearerAuthResult {
  return {
    ...input,
    providerCallsMade: 0,
    productionWrites: false,
  };
}

export function authorizeBearerTokenRequest(
  headers: HttpHeadersLike,
  config: LocalBearerAuthConfig,
): BearerAuthResult {
  if (config.mode === "disabled-local-dev") {
    return result({ ok: true, status: "disabled-local-dev", failureCode: undefined });
  }

  const supplied = parseBearerToken(readHeader(headers, "authorization"));
  if (supplied === undefined) {
    return result({ ok: false, status: "missing", failureCode: "bearer_token_missing" });
  }

  if (!constantTimeEqual(supplied, config.token)) {
    return result({ ok: false, status: "invalid", failureCode: "bearer_token_invalid" });
  }

  return result({ ok: true, status: "authorized", failureCode: undefined });
}
