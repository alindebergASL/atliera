export type AtlieraEnvironment = "development" | "test" | "lab" | "staging" | "production";

export interface AtlieraRuntimeConfig {
  environment: AtlieraEnvironment;
  publicBaseUrl: string | undefined;
  bindHost: string | undefined;
  port: number | undefined;
  databaseUrl: string | undefined;
  artifactStore: string | undefined;
  queueBackend: string | undefined;
  modelProvider: string | undefined;
}

type EnvInput = Record<string, string | undefined>;

const ENVIRONMENTS: readonly AtlieraEnvironment[] = [
  "development",
  "test",
  "lab",
  "staging",
  "production",
];

function readNonEmpty(env: EnvInput, key: string): string | undefined {
  const value = env[key]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

function parseEnvironment(value: string | undefined): AtlieraEnvironment {
  if (value === undefined) {
    return "development";
  }

  if ((ENVIRONMENTS as readonly string[]).includes(value)) {
    return value as AtlieraEnvironment;
  }

  throw new Error(`ATL_ENV must be one of ${ENVIRONMENTS.join(", ")}`);
}

function parsePublicBaseUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("APP_BASE_URL must be a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("APP_BASE_URL must be an http or https URL");
  }

  return value;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }

  return parsed;
}

export function parseAtlieraRuntimeConfig(env: EnvInput): AtlieraRuntimeConfig {
  return {
    environment: parseEnvironment(readNonEmpty(env, "ATL_ENV")),
    publicBaseUrl: parsePublicBaseUrl(readNonEmpty(env, "APP_BASE_URL")),
    bindHost: readNonEmpty(env, "HOST"),
    port: parsePort(env.PORT),
    databaseUrl: readNonEmpty(env, "DATABASE_URL"),
    artifactStore: readNonEmpty(env, "ARTIFACT_STORE"),
    queueBackend: readNonEmpty(env, "QUEUE_BACKEND"),
    modelProvider: readNonEmpty(env, "MODEL_PROVIDER"),
  };
}
