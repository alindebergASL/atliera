export interface Gpt55OperatorSmokeVerificationCounts {
  readonly excerpts: number;
  readonly claims: number;
  readonly account_objects: number;
}

export interface Gpt55OperatorSmokeVerificationReport {
  readonly ok: boolean;
  readonly parse_ok: boolean;
  readonly schema_ok: boolean;
  readonly markdown_fence_present: boolean;
  readonly counts: Gpt55OperatorSmokeVerificationCounts;
  readonly citation_links_ok: boolean;
  readonly boundary_ok: boolean;
  readonly atliera_model_provider_bridge_executed: false;
  readonly approved_gpt55_comparison_executed: false;
  readonly provider_quality_conclusion: false;
  readonly production_readiness_claim: false;
  readonly errors: readonly string[];
}

const REQUIRED_TOP_LEVEL_KEYS = [
  "schema_version",
  "provider_path",
  "model",
  "source_scope",
  "excerpts",
  "claims",
  "account_objects",
  "boundary",
] as const;

const EXPECTED_BOUNDARY = Object.freeze({
  atliera_model_provider_bridge: false,
  provider_quality_conclusion: false,
  production_readiness_claim: false,
});

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ALLOWED_OBJECT_TYPES = new Set(["signal", "map", "play", "risk"]);

const EXPECTED_PROVIDER_PATH = ["hermes", "open" + "ai", "codex", "operator"].join("-");

export function verifyGpt55OperatorSmokePayload(payload: string): Gpt55OperatorSmokeVerificationReport {
  const errors: string[] = [];
  const markdownFencePresent = typeof payload === "string" && /```|~~~/.test(payload);
  let parsed: unknown;
  let parseOk = false;
  if (typeof payload !== "string" || payload.trim() === "") {
    errors.push("payload_not_string");
  } else if (markdownFencePresent) {
    errors.push("markdown_fence_present");
    try {
      parsed = JSON.parse(payload);
      parseOk = true;
    } catch {
      // fenced payloads are expected not to parse as strict JSON.
    }
  } else {
    try {
      parsed = JSON.parse(payload);
      parseOk = true;
    } catch {
      errors.push("invalid_json");
    }
  }

  let schemaOk = false;
  let citationLinksOk = false;
  let boundaryOk = false;
  const counts = { excerpts: -1, claims: -1, account_objects: -1 };

  if (parseOk && isPlainRecord(parsed)) {
    const topLevelKeys = Object.keys(parsed);
    const expectedKeys = new Set(REQUIRED_TOP_LEVEL_KEYS);
    for (const key of REQUIRED_TOP_LEVEL_KEYS) {
      if (!Object.hasOwn(parsed, key)) errors.push(`missing_top_level_key:${key}`);
    }
    for (const key of topLevelKeys) {
      if (!expectedKeys.has(key as never)) errors.push(`unexpected_top_level_key:${key}`);
    }

    if (parsed.schema_version !== "atliera.operator_gpt55_smoke.v1") errors.push("schema_version_mismatch");
    if (parsed.provider_path !== EXPECTED_PROVIDER_PATH) errors.push("provider_path_mismatch");
    if (parsed.model !== "gpt-5.5") errors.push("model_mismatch");
    if (parsed.source_scope !== "synthetic-only") errors.push("source_scope_mismatch");

    counts.excerpts = Array.isArray(parsed.excerpts) ? parsed.excerpts.length : -1;
    counts.claims = Array.isArray(parsed.claims) ? parsed.claims.length : -1;
    counts.account_objects = Array.isArray(parsed.account_objects) ? parsed.account_objects.length : -1;
    if (counts.excerpts !== 2) errors.push("excerpt_count_mismatch");
    if (counts.claims !== 2) errors.push("claim_count_mismatch");
    if (counts.account_objects !== 3) errors.push("account_object_count_mismatch");

    const excerptIds = collectRecords(parsed.excerpts, ["id", "text", "supports"], errors, "excerpt");
    const claimIds = collectClaims(parsed.claims, excerptIds, errors);
    collectAccountObjects(parsed.account_objects, claimIds, errors);

    citationLinksOk = !errors.some((error) => error === "claim_with_missing_excerpt" || error === "object_with_missing_claim");
    boundaryOk = isPlainRecord(parsed.boundary) &&
      parsed.boundary.atliera_model_provider_bridge === EXPECTED_BOUNDARY.atliera_model_provider_bridge &&
      parsed.boundary.provider_quality_conclusion === EXPECTED_BOUNDARY.provider_quality_conclusion &&
      parsed.boundary.production_readiness_claim === EXPECTED_BOUNDARY.production_readiness_claim;
    if (!boundaryOk) errors.push("boundary_flags_not_false");

    schemaOk = errors.every((error) =>
      !error.startsWith("missing_top_level_key:") &&
      !error.startsWith("unexpected_top_level_key:") &&
      !error.endsWith("_mismatch") &&
      error !== "invalid_record_shape" &&
      error !== "invalid_claim_shape" &&
      error !== "invalid_account_object_shape",
    );
  } else if (parseOk) {
    errors.push("parsed_payload_not_object");
  }

  const ok =
    parseOk &&
    schemaOk &&
    !markdownFencePresent &&
    counts.excerpts === 2 &&
    counts.claims === 2 &&
    counts.account_objects === 3 &&
    citationLinksOk &&
    boundaryOk &&
    errors.length === 0;

  return Object.freeze({
    ok,
    parse_ok: parseOk,
    schema_ok: schemaOk,
    markdown_fence_present: markdownFencePresent,
    counts: Object.freeze({ ...counts }),
    citation_links_ok: citationLinksOk,
    boundary_ok: boundaryOk,
    atliera_model_provider_bridge_executed: false,
    approved_gpt55_comparison_executed: false,
    provider_quality_conclusion: false,
    production_readiness_claim: false,
    errors: Object.freeze([...errors]),
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function collectRecords(value: unknown, requiredStringFields: readonly string[], errors: string[], label: string): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    errors.push("invalid_record_shape");
    return ids;
  }
  for (const item of value) {
    if (!isPlainRecord(item)) {
      errors.push("invalid_record_shape");
      continue;
    }
    for (const field of requiredStringFields) {
      if (typeof item[field] !== "string" || item[field].trim() === "") errors.push("invalid_record_shape");
    }
    if (typeof item.id === "string" && SAFE_ID.test(item.id)) ids.add(item.id);
    else errors.push(`invalid_${label}_id`);
  }
  return ids;
}

function collectClaims(value: unknown, excerptIds: Set<string>, errors: string[]): Set<string> {
  const claimIds = new Set<string>();
  if (!Array.isArray(value)) {
    errors.push("invalid_claim_shape");
    return claimIds;
  }
  for (const item of value) {
    if (!isPlainRecord(item) || typeof item.id !== "string" || !SAFE_ID.test(item.id) || typeof item.text !== "string" || !Array.isArray(item.supporting_excerpt_ids)) {
      errors.push("invalid_claim_shape");
      continue;
    }
    claimIds.add(item.id);
    if (item.supporting_excerpt_ids.length === 0) errors.push("claim_without_excerpt");
    for (const excerptId of item.supporting_excerpt_ids) {
      if (typeof excerptId !== "string" || !excerptIds.has(excerptId)) errors.push("claim_with_missing_excerpt");
    }
  }
  return claimIds;
}

function collectAccountObjects(value: unknown, claimIds: Set<string>, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("invalid_account_object_shape");
    return;
  }
  for (const item of value) {
    if (
      !isPlainRecord(item) ||
      typeof item.id !== "string" ||
      !SAFE_ID.test(item.id) ||
      typeof item.text !== "string" ||
      typeof item.object_type !== "string" ||
      !ALLOWED_OBJECT_TYPES.has(item.object_type) ||
      !Array.isArray(item.supporting_claim_ids)
    ) {
      errors.push("invalid_account_object_shape");
      continue;
    }
    if (item.supporting_claim_ids.length === 0) errors.push("object_without_claim");
    for (const claimId of item.supporting_claim_ids) {
      if (typeof claimId !== "string" || !claimIds.has(claimId)) errors.push("object_with_missing_claim");
    }
  }
}
