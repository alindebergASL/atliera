export type ValidatedModelRouteKind = "candidate" | "validation" | "fake";

export interface ValidatedModelRouteInput {
  routeRef: string;
  providerRef: string;
  modelLabel: string;
  routeKind: ValidatedModelRouteKind;
  validationRefs: string[];
  validatedAt: string;
  evidenceExpiresAt: string;
  defaultModelSelectionClaim: false;
  providerLockIn: false;
  productionReadinessClaim: false;
}

export interface ValidatedModelRoute {
  routeRef: string;
  providerRef: string;
  modelLabel: string;
  routeKind: ValidatedModelRouteKind;
  validationRefs: readonly string[];
  validatedAt: string;
  evidenceExpiresAt: string;
  defaultModelSelectionClaim: false;
  providerLockIn: false;
  productionReadinessClaim: false;
}

export interface ValidatedRouteCatalog {
  routes: readonly ValidatedModelRoute[];
  providerCallsExecuted: 0;
  providerSpend: false;
  runtimeModelModeIntegration: false;
  defaultModelSelectionClaim: false;
  providerLockIn: false;
}

export interface ValidateRouteCatalogOptions {
  now?: string;
  maxValidationAgeDays?: number;
}

export type RuntimeSelectionEnvironment = "development" | "test" | "lab" | "staging" | "production";
export type SelectedRouteEvidenceStatus = "fresh" | "nearing-expiry" | "expired-needs-revalidation";

export interface RouteSelectionInput {
  routeRef?: string;
  modelLabel?: string;
  environment: RuntimeSelectionEnvironment;
  approvalRef?: string;
  now: string;
  maxValidationAgeDays: number;
  nearingExpiryDays?: number;
}

export interface SelectedModelRoute {
  route: ValidatedModelRoute;
  selectionReason: "explicit-route-ref";
  approvalRef: string | null;
  environment: RuntimeSelectionEnvironment;
  validationAgeDays: number;
  routeEvidenceStatus: SelectedRouteEvidenceStatus;
  routeEvidenceExpiresAt: string;
  routeRequiresFreshApprovalBeforeUse: boolean;
  routeUsableWithoutRevalidation: boolean;
  providerCallsExecuted: 0;
  providerSpend: false;
  runtimeModelModeIntegration: false;
  defaultModelSelectionClaim: false;
  providerLockIn: false;
}

const ROUTE_KEYS = [
  "routeRef",
  "providerRef",
  "modelLabel",
  "routeKind",
  "validationRefs",
  "validatedAt",
  "evidenceExpiresAt",
  "defaultModelSelectionClaim",
  "providerLockIn",
  "productionReadinessClaim",
] as const;

const ROUTE_KEY_SET = new Set<string>(ROUTE_KEYS);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertPlainRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain record`);
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must use Object prototype`);
  }
}

function enumerableOwnKeys(record: Record<string, unknown>, label: string): string[] {
  const symbols = Object.getOwnPropertySymbols(record);
  if (symbols.length > 0) throw new Error(`${label} symbol fields rejected`);

  const descriptors = Object.getOwnPropertyDescriptors(record);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) throw new Error(`${label} non-enumerable fields rejected`);
    if ("get" in descriptor || "set" in descriptor) throw new Error(`${label} accessor field rejected`);
    if (!ROUTE_KEY_SET.has(key)) throw new Error(`${label} unexpected route field: ${key}`);
  }

  for (const key of ROUTE_KEYS) {
    if (!Object.hasOwn(record, key)) throw new Error(`${label} missing route field: ${key}`);
  }

  return Object.keys(record);
}

function readString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${label}.${key} must be a string`);
  if (value.length === 0) throw new Error(`${label}.${key} must be non-empty`);
  return value;
}

function readFalse(record: Record<string, unknown>, key: string, label: string): false {
  if (record[key] !== false) throw new Error(`${label}.${key} must be false`);
  return false;
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value) || value.includes("..")) throw new Error(`${label} must be a safe logical id`);
}

function assertSafeRef(value: string, label: string): void {
  if (!SAFE_REF.test(value) || value.includes("..") || value.includes("://") || value.startsWith("/")) {
    throw new Error(`${label} must be a safe relative ref`);
  }
}

function assertIsoInstant(value: string, label: string): void {
  if (!ISO_INSTANT.test(value)) {
    throw new Error(`${label} must be an ISO instant`);
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${label} must be an ISO instant`);
  }
}

function snapshotArrayValues(value: unknown, label: string, min: number, max: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error(`${label} array prototype rejected`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) throw new Error(`${label} symbol fields rejected`);
  const length = value.length;
  if (length < min || length > max) throw new Error(`${label} length invalid`);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "length") continue;
    if (!/^\d+$/.test(key)) throw new Error(`${label} unexpected array field rejected`);
    if (!descriptor.enumerable) throw new Error(`${label} non-enumerable fields rejected`);
    if ("get" in descriptor || "set" in descriptor) throw new Error(`${label} accessor field rejected`);
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor) {
      throw new Error(`${label}[${index}] descriptor invalid`);
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}

function readValidationRefs(record: Record<string, unknown>, label: string): string[] {
  const refs = snapshotArrayValues(record.validationRefs, `${label}.validationRefs`, 1, 12);
  return refs.map((entry, index) => {
    if (typeof entry !== "string") throw new Error(`${label}.validationRefs[${index}] must be a string`);
    assertSafeRef(entry, `${label}.validationRefs[${index}]`);
    return entry;
  });
}

export function snapshotValidatedModelRoute(input: ValidatedModelRouteInput): ValidatedModelRoute {
  assertPlainRecord(input, "route");
  enumerableOwnKeys(input, "route");

  const routeRef = readString(input, "routeRef", "route");
  const providerRef = readString(input, "providerRef", "route");
  const modelLabel = readString(input, "modelLabel", "route");
  const routeKind = readString(input, "routeKind", "route");
  if (routeKind !== "candidate" && routeKind !== "validation" && routeKind !== "fake") {
    throw new Error("route.routeKind invalid");
  }

  assertSafeId(routeRef, "route.routeRef");
  assertSafeId(providerRef, "route.providerRef");
  assertSafeId(modelLabel, "route.modelLabel");

  const validatedAt = readString(input, "validatedAt", "route");
  const evidenceExpiresAt = readString(input, "evidenceExpiresAt", "route");
  assertIsoInstant(validatedAt, "route.validatedAt");
  assertIsoInstant(evidenceExpiresAt, "route.evidenceExpiresAt");

  return Object.freeze({
    routeRef,
    providerRef,
    modelLabel,
    routeKind,
    validationRefs: Object.freeze(readValidationRefs(input, "route")),
    validatedAt,
    evidenceExpiresAt,
    defaultModelSelectionClaim: readFalse(input, "defaultModelSelectionClaim", "route"),
    providerLockIn: readFalse(input, "providerLockIn", "route"),
    productionReadinessClaim: readFalse(input, "productionReadinessClaim", "route"),
  });
}

export function validateRouteCatalog(
  routes: readonly ValidatedModelRouteInput[],
  options: ValidateRouteCatalogOptions = {},
): ValidatedRouteCatalog {
  if (!Array.isArray(routes)) throw new Error("route catalog must be an array");
  if (routes.length < 1 || routes.length > 50) throw new Error("route catalog length invalid");

  const seen = new Set<string>();
  const nowMs = options.now ? Date.parse(options.now) : undefined;
  if (options.now) assertIsoInstant(options.now, "options.now");

  const routeInputs = snapshotArrayValues(routes, "route catalog", 1, 50);
  const snapshots = routeInputs.map((route) => {
    const snapshot = snapshotValidatedModelRoute(route as ValidatedModelRouteInput);
    if (seen.has(snapshot.routeRef)) throw new Error(`duplicate routeRef: ${snapshot.routeRef}`);
    seen.add(snapshot.routeRef);

    if (options.maxValidationAgeDays !== undefined) {
      if (!Number.isInteger(options.maxValidationAgeDays) || options.maxValidationAgeDays < 0) {
        throw new Error("maxValidationAgeDays must be a non-negative integer");
      }
      const ageMs = (nowMs ?? Date.now()) - Date.parse(snapshot.validatedAt);
      if (ageMs > options.maxValidationAgeDays * 24 * 60 * 60 * 1000) {
        throw new Error(`validation evidence is stale for ${snapshot.routeRef}`);
      }
    }

    return snapshot;
  });

  return Object.freeze({
    routes: Object.freeze(snapshots),
    providerCallsExecuted: 0,
    providerSpend: false,
    runtimeModelModeIntegration: false,
    defaultModelSelectionClaim: false,
    providerLockIn: false,
  });
}

function isProductionLike(environment: RuntimeSelectionEnvironment): boolean {
  return environment === "production" || environment === "staging";
}

function classifySelectedRouteEvidence(
  route: ValidatedModelRoute,
  now: string,
  nearingExpiryDays: number,
): SelectedRouteEvidenceStatus {
  const remainingMs = Date.parse(route.evidenceExpiresAt) - Date.parse(now);
  if (remainingMs < 0) {
    throw new Error(`expired route evidence requires fresh approval before use: ${route.routeRef}`);
  }
  const remainingDays = remainingMs / (24 * 60 * 60 * 1000);
  return remainingDays <= nearingExpiryDays ? "nearing-expiry" : "fresh";
}

export function selectRouteFromCatalog(catalog: ValidatedRouteCatalog, input: RouteSelectionInput): SelectedModelRoute {
  assertPlainRecord(input, "selection");
  if (!Object.hasOwn(input, "routeRef") || typeof input.routeRef !== "string" || input.routeRef.length === 0) {
    throw new Error("selection.routeRef is required; model/provider defaults are not allowed");
  }
  assertSafeId(input.routeRef, "selection.routeRef");
  if (Object.hasOwn(input, "modelLabel")) {
    throw new Error("selection by modelLabel is not allowed; routeRef is required");
  }
  if (!Number.isInteger(input.maxValidationAgeDays) || input.maxValidationAgeDays < 0) {
    throw new Error("selection.maxValidationAgeDays must be a non-negative integer");
  }
  const nearingExpiryDays = input.nearingExpiryDays ?? 0;
  if (!Number.isInteger(nearingExpiryDays) || nearingExpiryDays < 0) {
    throw new Error("selection.nearingExpiryDays must be a non-negative integer");
  }
  assertIsoInstant(input.now, "selection.now");

  const route = catalog.routes.find((candidate) => candidate.routeRef === input.routeRef);
  if (!route) throw new Error(`routeRef not found: ${input.routeRef}`);

  if (isProductionLike(input.environment)) {
    if (typeof input.approvalRef !== "string" || input.approvalRef.length === 0) {
      throw new Error("approvalRef is required for production-like route selection");
    }
    assertSafeRef(input.approvalRef, "selection.approvalRef");
    if (route.routeKind === "fake") {
      throw new Error("fake routes are not allowed for production-like route selection");
    }
  }

  const ageMs = Date.parse(input.now) - Date.parse(route.validatedAt);
  const validationAgeDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (ageMs > input.maxValidationAgeDays * 24 * 60 * 60 * 1000) {
    throw new Error(`route validation evidence is stale for ${route.routeRef}`);
  }

  const routeEvidenceStatus = classifySelectedRouteEvidence(route, input.now, nearingExpiryDays);

  return Object.freeze({
    route,
    selectionReason: "explicit-route-ref",
    approvalRef: input.approvalRef ?? null,
    environment: input.environment,
    validationAgeDays,
    routeEvidenceStatus,
    routeEvidenceExpiresAt: route.evidenceExpiresAt,
    routeRequiresFreshApprovalBeforeUse: false,
    routeUsableWithoutRevalidation: true,
    providerCallsExecuted: 0,
    providerSpend: false,
    runtimeModelModeIntegration: false,
    defaultModelSelectionClaim: false,
    providerLockIn: false,
  });
}
