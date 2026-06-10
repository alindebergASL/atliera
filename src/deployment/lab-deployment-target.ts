export interface LabDeploymentTargetViolation {
  readonly field: string;
  readonly reason: string;
}

export interface LabDeploymentTargetDescriptor {
  readonly schemaVersion: "1";
  readonly targetId: string;
  readonly environment: "lab";
  readonly runtimeMode: "fake";
  readonly infrastructure: {
    readonly provider: string;
    readonly regionRef: string;
    readonly hostRef: string;
  };
  readonly http: {
    readonly bindHostRef: string;
    readonly port: number;
    readonly publicBaseUrlRef: string;
    readonly healthcheckPath: "/healthz";
    readonly workshopPath: "/workshop";
  };
  readonly supervision: {
    readonly mode: "systemd-plan";
    readonly serviceName: string;
  };
  readonly backupPolicy: {
    readonly mode: "local-scheduled";
    readonly retentionDays: number;
    readonly scheduleRef: string;
    readonly restoreProofRequiredBeforeMeaningfulData: true;
  };
  readonly boundary: {
    readonly deploymentExecuted: false;
    readonly providerCallsAllowed: false;
    readonly productionWritesAllowed: false;
    readonly readinessClaim: false;
  };
  readonly capabilities?: readonly "serve"[];
  readonly notes?: string;
}

export type LabDeploymentTargetValidationResult =
  | { readonly ok: true; readonly descriptor: LabDeploymentTargetDescriptor }
  | { readonly ok: false; readonly violations: readonly LabDeploymentTargetViolation[] };

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "targetId",
  "environment",
  "runtimeMode",
  "infrastructure",
  "http",
  "supervision",
  "backupPolicy",
  "boundary",
  "capabilities",
  "notes",
] as const;

const INFRASTRUCTURE_KEYS = ["provider", "regionRef", "hostRef"] as const;
const HTTP_KEYS = ["bindHostRef", "port", "publicBaseUrlRef", "healthcheckPath", "workshopPath"] as const;
const SUPERVISION_KEYS = ["mode", "serviceName"] as const;
const BACKUP_POLICY_KEYS = ["mode", "retentionDays", "scheduleRef", "restoreProofRequiredBeforeMeaningfulData"] as const;
const BOUNDARY_KEYS = ["deploymentExecuted", "providerCallsAllowed", "productionWritesAllowed", "readinessClaim"] as const;

const SAFE_ID = /^[a-z][a-z0-9-]{2,62}$/;
const SAFE_SERVICE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{1,62}$/;
const CONFIG_REF = /^[A-Z][A-Z0-9_]{2,127}$/;
const SAFE_PROVIDER = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

function violation(field: string, reason: string): LabDeploymentTargetViolation {
  return { field, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dataValue(input: Record<string, unknown>, key: string): { ok: true; value: unknown } | { ok: false } {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined) return { ok: true, value: undefined };
  if (!("value" in descriptor)) return { ok: false };
  return { ok: true, value: descriptor.value };
}

function ownEnumerableKeys(input: Record<string, unknown>): string[] | undefined {
  try {
    return Object.keys(input);
  } catch {
    return undefined;
  }
}

function validateExactObject(
  input: unknown,
  field: string,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  violations: LabDeploymentTargetViolation[],
): Record<string, unknown> | undefined {
  if (!isRecord(input)) {
    violations.push(violation(field, "must be an object"));
    return undefined;
  }

  const keys = ownEnumerableKeys(input);
  if (keys === undefined) {
    violations.push(violation(field, "must expose enumerable data keys"));
    return undefined;
  }

  for (const key of keys) {
    if (key === "__proto__" || key === "constructor" || key === "prototype" || !allowedKeys.includes(key)) {
      violations.push(violation(field === "$" ? key : `${field}.${key}`, "is not allowed"));
      continue;
    }
    if (!dataValue(input, key).ok) {
      violations.push(violation(field === "$" ? key : `${field}.${key}`, "must be a data property"));
    }
  }

  for (const key of requiredKeys) {
    const candidate = dataValue(input, key);
    if (!candidate.ok) continue;
    if (candidate.value === undefined) {
      violations.push(violation(field === "$" ? key : `${field}.${key}`, "is required"));
    }
  }

  return input;
}

function getRequired(input: Record<string, unknown> | undefined, field: string, key: string, violations: LabDeploymentTargetViolation[]): unknown {
  if (input === undefined) return undefined;
  const candidate = dataValue(input, key);
  if (!candidate.ok) {
    violations.push(violation(field === "$" ? key : `${field}.${key}`, "must be a data property"));
    return undefined;
  }
  return candidate.value;
}

function requireExactString(value: unknown, field: string, expected: string, violations: LabDeploymentTargetViolation[]): string | undefined {
  if (value !== expected) {
    violations.push(violation(field, `must equal ${expected}`));
    return undefined;
  }
  return expected;
}

function requirePattern(value: unknown, field: string, pattern: RegExp, violations: LabDeploymentTargetViolation[], reason = "has invalid format"): string | undefined {
  if (typeof value !== "string" || !pattern.test(value)) {
    violations.push(violation(field, reason));
    return undefined;
  }
  return value;
}

function requireBooleanFalse(value: unknown, field: string, violations: LabDeploymentTargetViolation[]): false | undefined {
  if (value !== false) {
    violations.push(violation(field, "must be false for this plan-only contract"));
    return undefined;
  }
  return false;
}

function rejectLiteralEndpointOrSecretRef(value: string | undefined, field: string, violations: LabDeploymentTargetViolation[]): string | undefined {
  if (value === undefined) return undefined;
  if (value.includes("://") || /secret|token|password|credential|api[_-]?key/i.test(value)) {
    violations.push(violation(field, "must be a non-secret config reference name, not a literal endpoint or credential"));
    return undefined;
  }
  return value;
}

function validatePath<const T extends "/healthz" | "/workshop">(value: unknown, field: string, expected: T, violations: LabDeploymentTargetViolation[]): T | undefined {
  if (value !== expected) {
    violations.push(violation(field, `must equal ${expected}`));
    return undefined;
  }
  return expected;
}

function validatePort(value: unknown, violations: LabDeploymentTargetViolation[]): number | undefined {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 1 || value > 65535) {
    violations.push(violation("http.port", "must be an integer from 1 to 65535"));
    return undefined;
  }
  return value;
}

function validateRetentionDays(value: unknown, violations: LabDeploymentTargetViolation[]): number | undefined {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 1 || value > 365) {
    violations.push(violation("backupPolicy.retentionDays", "must be an integer from 1 to 365"));
    return undefined;
  }
  return value;
}

function validateCapabilities(value: unknown, violations: LabDeploymentTargetViolation[]): readonly "serve"[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    violations.push(violation("capabilities", "must be an array"));
    return undefined;
  }
  const out: "serve"[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const capability = value[index];
    if (capability !== "serve") {
      violations.push(violation("capabilities", "contains unsupported capability"));
      continue;
    }
    if (seen.has(capability)) {
      violations.push(violation("capabilities", "contains duplicate capability"));
      continue;
    }
    seen.add(capability);
    out.push(capability);
  }
  return Object.freeze(out);
}

function freezeDescriptor<T extends object>(value: T): Readonly<T> {
  for (const nested of Object.values(value)) {
    if (typeof nested === "object" && nested !== null) {
      freezeDescriptor(nested as object);
    }
  }
  return Object.freeze(value);
}

export function validateLabDeploymentTargetDescriptor(input: unknown): LabDeploymentTargetValidationResult {
  const violations: LabDeploymentTargetViolation[] = [];
  const root = validateExactObject(input, "$", TOP_LEVEL_KEYS, [
    "schemaVersion",
    "targetId",
    "environment",
    "runtimeMode",
    "infrastructure",
    "http",
    "supervision",
    "backupPolicy",
    "boundary",
  ], violations);

  const infrastructure = validateExactObject(getRequired(root, "$", "infrastructure", violations), "infrastructure", INFRASTRUCTURE_KEYS, INFRASTRUCTURE_KEYS, violations);
  const http = validateExactObject(getRequired(root, "$", "http", violations), "http", HTTP_KEYS, HTTP_KEYS, violations);
  const supervision = validateExactObject(getRequired(root, "$", "supervision", violations), "supervision", SUPERVISION_KEYS, SUPERVISION_KEYS, violations);
  const backupPolicy = validateExactObject(getRequired(root, "$", "backupPolicy", violations), "backupPolicy", BACKUP_POLICY_KEYS, BACKUP_POLICY_KEYS, violations);
  const boundary = validateExactObject(getRequired(root, "$", "boundary", violations), "boundary", BOUNDARY_KEYS, BOUNDARY_KEYS, violations);

  const schemaVersion = requireExactString(getRequired(root, "$", "schemaVersion", violations), "schemaVersion", "1", violations) as "1" | undefined;
  const targetId = requirePattern(getRequired(root, "$", "targetId", violations), "targetId", SAFE_ID, violations);
  const environment = requireExactString(getRequired(root, "$", "environment", violations), "environment", "lab", violations) as "lab" | undefined;
  const runtimeMode = requireExactString(getRequired(root, "$", "runtimeMode", violations), "runtimeMode", "fake", violations) as "fake" | undefined;

  const provider = requirePattern(getRequired(infrastructure, "infrastructure", "provider", violations), "infrastructure.provider", SAFE_PROVIDER, violations);
  const regionRef = rejectLiteralEndpointOrSecretRef(requirePattern(getRequired(infrastructure, "infrastructure", "regionRef", violations), "infrastructure.regionRef", CONFIG_REF, violations), "infrastructure.regionRef", violations);
  const hostRef = rejectLiteralEndpointOrSecretRef(requirePattern(getRequired(infrastructure, "infrastructure", "hostRef", violations), "infrastructure.hostRef", CONFIG_REF, violations), "infrastructure.hostRef", violations);

  const bindHostRef = rejectLiteralEndpointOrSecretRef(requirePattern(getRequired(http, "http", "bindHostRef", violations), "http.bindHostRef", CONFIG_REF, violations), "http.bindHostRef", violations);
  const port = validatePort(getRequired(http, "http", "port", violations), violations);
  const publicBaseUrlRef = rejectLiteralEndpointOrSecretRef(requirePattern(getRequired(http, "http", "publicBaseUrlRef", violations), "http.publicBaseUrlRef", CONFIG_REF, violations), "http.publicBaseUrlRef", violations);
  const healthcheckPath = validatePath(getRequired(http, "http", "healthcheckPath", violations), "http.healthcheckPath", "/healthz", violations);
  const workshopPath = validatePath(getRequired(http, "http", "workshopPath", violations), "http.workshopPath", "/workshop", violations);

  const supervisionMode = requireExactString(getRequired(supervision, "supervision", "mode", violations), "supervision.mode", "systemd-plan", violations) as "systemd-plan" | undefined;
  const serviceName = requirePattern(getRequired(supervision, "supervision", "serviceName", violations), "supervision.serviceName", SAFE_SERVICE_NAME, violations);

  const backupMode = requireExactString(getRequired(backupPolicy, "backupPolicy", "mode", violations), "backupPolicy.mode", "local-scheduled", violations) as "local-scheduled" | undefined;
  const retentionDays = validateRetentionDays(getRequired(backupPolicy, "backupPolicy", "retentionDays", violations), violations);
  const scheduleRef = rejectLiteralEndpointOrSecretRef(requirePattern(getRequired(backupPolicy, "backupPolicy", "scheduleRef", violations), "backupPolicy.scheduleRef", CONFIG_REF, violations), "backupPolicy.scheduleRef", violations);
  const restoreProofRequiredBeforeMeaningfulData = getRequired(backupPolicy, "backupPolicy", "restoreProofRequiredBeforeMeaningfulData", violations) === true ? true : undefined;
  if (restoreProofRequiredBeforeMeaningfulData !== true) {
    violations.push(violation("backupPolicy.restoreProofRequiredBeforeMeaningfulData", "must be true"));
  }

  const deploymentExecuted = requireBooleanFalse(getRequired(boundary, "boundary", "deploymentExecuted", violations), "boundary.deploymentExecuted", violations);
  const providerCallsAllowed = requireBooleanFalse(getRequired(boundary, "boundary", "providerCallsAllowed", violations), "boundary.providerCallsAllowed", violations);
  const productionWritesAllowed = requireBooleanFalse(getRequired(boundary, "boundary", "productionWritesAllowed", violations), "boundary.productionWritesAllowed", violations);
  const readinessClaim = requireBooleanFalse(getRequired(boundary, "boundary", "readinessClaim", violations), "boundary.readinessClaim", violations);

  const capabilities = validateCapabilities(getRequired(root, "$", "capabilities", violations), violations);
  const notesValue = getRequired(root, "$", "notes", violations);
  const notes = notesValue === undefined ? undefined : typeof notesValue === "string" && notesValue.length <= 500 ? notesValue : undefined;
  if (notesValue !== undefined && notes === undefined) {
    violations.push(violation("notes", "must be a string up to 500 characters"));
  }

  if (violations.length > 0) {
    return { ok: false, violations: Object.freeze(violations.map((entry) => Object.freeze({ ...entry }))) };
  }

  const descriptor: LabDeploymentTargetDescriptor = {
    schemaVersion: schemaVersion!,
    targetId: targetId!,
    environment: environment!,
    runtimeMode: runtimeMode!,
    infrastructure: {
      provider: provider!,
      regionRef: regionRef!,
      hostRef: hostRef!,
    },
    http: {
      bindHostRef: bindHostRef!,
      port: port!,
      publicBaseUrlRef: publicBaseUrlRef!,
      healthcheckPath: healthcheckPath!,
      workshopPath: workshopPath!,
    },
    supervision: {
      mode: supervisionMode!,
      serviceName: serviceName!,
    },
    backupPolicy: {
      mode: backupMode!,
      retentionDays: retentionDays!,
      scheduleRef: scheduleRef!,
      restoreProofRequiredBeforeMeaningfulData: true,
    },
    boundary: {
      deploymentExecuted: deploymentExecuted!,
      providerCallsAllowed: providerCallsAllowed!,
      productionWritesAllowed: productionWritesAllowed!,
      readinessClaim: readinessClaim!,
    },
    ...(capabilities === undefined ? {} : { capabilities }),
    ...(notes === undefined ? {} : { notes }),
  };

  return { ok: true, descriptor: freezeDescriptor(descriptor) as LabDeploymentTargetDescriptor };
}

export function parseLabDeploymentTargetDescriptor(text: string): LabDeploymentTargetDescriptor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("deployment target descriptor must be valid JSON");
  }

  const result = validateLabDeploymentTargetDescriptor(parsed);
  if (!result.ok) {
    throw new Error(`deployment target descriptor rejected: ${result.violations.map((entry) => entry.field).join(", ")}`);
  }
  return result.descriptor;
}
