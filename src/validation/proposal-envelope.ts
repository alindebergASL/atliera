import { createHash } from "node:crypto";

import {
  assertExactKeys,
  deepFreezeOwnData,
  sha256CanonicalJson,
  snapshotStrictJson,
  strictJsonArray,
  strictJsonObject,
  StrictJsonBoundaryError,
  type StrictJsonLimits,
  type StrictJsonValue,
} from "../authority/strict-json.ts";
import { idHasPrefix } from "../graph/ids.ts";
import { parseSourceDocument } from "../graph/schema.ts";
import type { AccountObjectKind, SourceDocument } from "../graph/types.ts";
import {
  materializeProposalForValidation,
  type MaterializeProposalForValidationInput,
} from "./proposal-materialization.ts";

export const PROPOSAL_ENVELOPE_KIND = "atliera_proposal_envelope" as const;
export const PROPOSAL_ENVELOPE_VERSION = 1 as const;
export const PROPOSAL_ENVELOPE_PURPOSE = "candidate_validation" as const;
export const PROPOSAL_ENVELOPE_MAX_LIFETIME_MS = 24 * 60 * 60 * 1_000;
export const PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND = 200;
export const PROPOSAL_ENVELOPE_MAX_REFERENCES_PER_RECORD = 50;

export type ProposalProducerKind = "fixture" | "imported" | "model_generated";

export interface ProposalProducer {
  readonly kind: ProposalProducerKind;
  readonly trace_id: string;
}

export interface ProposalScope {
  readonly team_id: string;
  readonly account_id: string;
  readonly subject_id: string;
  readonly purpose: typeof PROPOSAL_ENVELOPE_PURPOSE;
}

export interface ProposalFixtureBinding {
  readonly fixture_id: string;
  readonly fixture_content_sha256: string;
  readonly authenticated_human_approval: false;
}

export interface ProposalSourceAssurances {
  readonly origin_content_sha256_proves_origin_custody: false;
  readonly transformation_manifest_sha256_resolves_transformation_record: false;
}

export interface ProposalAuthorityMarkers {
  readonly proposal_only: true;
  readonly integrity_digest_is_approval: false;
  readonly current_effective_authorization: "none";
  readonly trusted_presentation_authority: false;
  readonly graph_ingestion_authority: false;
  readonly authenticated_human_approval: false;
  readonly ratification: false;
  readonly durable_write_authority: false;
  readonly durable_effect_performed: false;
}

export interface ProposalEnvelopeExcerpt {
  readonly id: string;
  readonly source_id: string;
  readonly text: string;
}

export interface ProposalEnvelopeClaim {
  readonly id: string;
  readonly type: string;
  readonly text: string;
  readonly subject: string;
  readonly confidence: "high" | "medium" | "low";
  readonly excerpt_ids: readonly string[];
}

export interface ProposalEnvelopeAccountObject {
  readonly id: string;
  readonly type: AccountObjectKind;
  readonly title: string;
  readonly summary: string;
  readonly claim_ids: readonly string[];
}

export interface ProposalEnvelopeContent {
  readonly sources: readonly SourceDocument[];
  readonly excerpts: readonly ProposalEnvelopeExcerpt[];
  readonly claims: readonly ProposalEnvelopeClaim[];
  readonly account_objects: readonly ProposalEnvelopeAccountObject[];
}

export interface ProposalEnvelopeCore {
  readonly kind: typeof PROPOSAL_ENVELOPE_KIND;
  readonly version: typeof PROPOSAL_ENVELOPE_VERSION;
  readonly producer: ProposalProducer;
  readonly scope: ProposalScope;
  readonly created_at: string;
  readonly expires_at: string;
  readonly proposal_content: ProposalEnvelopeContent;
  readonly source_assurances: ProposalSourceAssurances;
  readonly fixture_binding: ProposalFixtureBinding | null;
  readonly authority: ProposalAuthorityMarkers;
}

export interface ProposalEnvelope extends ProposalEnvelopeCore {
  readonly envelope_sha256: string;
}

export class ProposalEnvelopeBoundaryError extends Error {
  constructor(detail: string) {
    super(`Proposal envelope refused: ${detail}`);
    this.name = "ProposalEnvelopeBoundaryError";
  }
}

const LIMITS: StrictJsonLimits = Object.freeze({
  max_array_length: PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
  max_depth: 10,
  max_nodes: 5_000,
  max_object_fields: 64,
  max_string_utf8_bytes: 2 * 1024 * 1024,
  max_total_string_utf8_bytes: 8 * 1024 * 1024,
});

const SAFE_TEAM_ID = /^team_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_ACCOUNT_ID = /^acc_[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_PRODUCER_TRACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,120}$/;
const SAFE_PROPOSAL_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const SAFE_CLAIM_TYPE = /^[a-z][a-z0-9_]{0,40}$/;
const SAFE_NORMALIZED_SUBJECT = /^[a-z0-9][a-z0-9_:.-]{0,120}$/;
// These are unkeyed integrity identities only; syntax or self-consistency is
// never authentication, fixture custody, human approval, or authority.
const CANONICAL_SHA256 = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ACCOUNT_OBJECT_KINDS: readonly AccountObjectKind[] = [
  "account_snapshot",
  "signal",
  "stakeholder",
  "initiative",
  "risk",
  "open_question",
  "play",
  "recommendation",
];

const ENVELOPE_CORE_KEYS = [
  "kind",
  "version",
  "producer",
  "scope",
  "created_at",
  "expires_at",
  "proposal_content",
  "source_assurances",
  "fixture_binding",
  "authority",
] as const;

const SOURCE_KEYS = [
  "id",
  "team_id",
  "account_id",
  "url",
  "canonical_url",
  "title",
  "publisher",
  "source_type",
  "fetched_at",
  "accessed_at",
  "origin_content_sha256",
  "stored_content_sha256",
  "transformation_manifest_sha256",
  "raw_text",
  "reliability",
  "status",
] as const;

function refuse(detail: string): never {
  throw new ProposalEnvelopeBoundaryError(detail);
}

function asObject(value: StrictJsonValue | undefined, path: string) {
  try {
    return strictJsonObject(value as StrictJsonValue, path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function exact(
  value: { [key: string]: StrictJsonValue },
  keys: readonly string[],
  path: string,
): void {
  try {
    assertExactKeys(value, keys, path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function asArray(
  value: StrictJsonValue | undefined,
  path: string,
  maxLength: number,
  requireDense = false,
): StrictJsonValue[] {
  try {
    return strictJsonArray(value, path, maxLength, requireDense);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function stringField(
  value: { [key: string]: StrictJsonValue },
  key: string,
  path: string,
): string {
  const field = value[key];
  if (typeof field !== "string") refuse(`${path}.${key} must be a string`);
  return field;
}

function parseCanonicalTimestamp(value: unknown, path: string): string {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) {
    refuse(`${path} must be a canonical UTC timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) refuse(`${path} must be a valid timestamp`);
  const canonical = parsed.toISOString().replace(".000Z", "Z");
  if (canonical !== value) {
    refuse(`${path} must be canonical UTC`);
  }
  return value;
}

function parseProducer(value: StrictJsonValue | undefined): ProposalProducer {
  const producer = asObject(value, "envelope.producer");
  exact(producer, ["kind", "trace_id"], "envelope.producer");
  const kind = stringField(producer, "kind", "envelope.producer");
  const traceId = stringField(producer, "trace_id", "envelope.producer");
  if (!["fixture", "imported", "model_generated"].includes(kind)) {
    refuse("envelope.producer.kind is unsupported");
  }
  if (!SAFE_PRODUCER_TRACE_ID.test(traceId)) {
    refuse("envelope.producer.trace_id is unsafe or exceeds downstream safe-id bounds");
  }
  return { kind: kind as ProposalProducerKind, trace_id: traceId };
}

function parseScope(value: StrictJsonValue | undefined): ProposalScope {
  const scope = asObject(value, "envelope.scope");
  exact(scope, ["team_id", "account_id", "subject_id", "purpose"], "envelope.scope");
  const teamId = stringField(scope, "team_id", "envelope.scope");
  const accountId = stringField(scope, "account_id", "envelope.scope");
  const subjectId = stringField(scope, "subject_id", "envelope.scope");
  if (!SAFE_TEAM_ID.test(teamId)) refuse("envelope.scope.team_id is unsafe");
  if (!SAFE_ACCOUNT_ID.test(accountId)) refuse("envelope.scope.account_id is unsafe");
  if (!SAFE_OPAQUE_ID.test(subjectId)) refuse("envelope.scope.subject_id is unsafe");
  if (scope.purpose !== PROPOSAL_ENVELOPE_PURPOSE) {
    refuse("envelope.scope.purpose is unsupported");
  }
  return {
    team_id: teamId,
    account_id: accountId,
    subject_id: subjectId,
    purpose: PROPOSAL_ENVELOPE_PURPOSE,
  };
}

function parseUniqueStringIds(
  value: StrictJsonValue | undefined,
  path: string,
): readonly string[] {
  const items = asArray(
    value,
    path,
    PROPOSAL_ENVELOPE_MAX_REFERENCES_PER_RECORD,
    true,
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string" || !SAFE_PROPOSAL_ID.test(item)) {
      refuse(`${path} must contain safe proposal ids only`);
    }
    if (seen.has(item)) refuse(`${path} must not contain duplicate references`);
    seen.add(item);
    out.push(item);
  }
  return out;
}

function parseSources(
  value: StrictJsonValue | undefined,
  scope: ProposalScope,
): readonly SourceDocument[] {
  const records = asArray(
    value,
    "envelope.proposal_content.sources",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  );
  const out: SourceDocument[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const path = `envelope.proposal_content.sources[${index}]`;
    const record = asObject(records[index], path);
    exact(record, SOURCE_KEYS, path);
    const parsed = parseSourceDocument(record);
    if (!parsed.ok) refuse(`${path} is not a canonical SourceDocument`);
    const source = parsed.value;
    if (!idHasPrefix(source.id, "source_document")) refuse(`${path}.id is unsafe`);
    if (seen.has(source.id)) refuse(`${path}.id is duplicated`);
    seen.add(source.id);
    if (source.team_id !== scope.team_id || source.account_id !== scope.account_id) {
      refuse(`${path} is outside the envelope scope`);
    }
    if (source.status !== "active") refuse(`${path}.status must be active`);
    if (
      !CANONICAL_SHA256.test(source.origin_content_sha256) ||
      !CANONICAL_SHA256.test(source.stored_content_sha256) ||
      (source.transformation_manifest_sha256 !== null &&
        !CANONICAL_SHA256.test(source.transformation_manifest_sha256))
    ) {
      refuse(`${path} carries a malformed source integrity identity`);
    }
    const stored = createHash("sha256").update(source.raw_text, "utf8").digest("hex");
    if (stored !== source.stored_content_sha256) {
      refuse(`${path}.stored_content_sha256 does not match raw_text`);
    }
    if (
      source.origin_content_sha256 !== source.stored_content_sha256 &&
      source.transformation_manifest_sha256 === null
    ) {
      refuse(`${path} requires a transformation manifest identity`);
    }
    out.push(source);
  }
  return out;
}

function parseContent(value: StrictJsonValue | undefined, scope: ProposalScope): ProposalEnvelopeContent {
  const content = asObject(value, "envelope.proposal_content");
  exact(content, ["sources", "excerpts", "claims", "account_objects"], "envelope.proposal_content");
  const sources = parseSources(content.sources, scope);
  const sourceIds = new Set(sources.map((source) => source.id));

  const excerptValues = asArray(
    content.excerpts,
    "envelope.proposal_content.excerpts",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  );
  const excerptIds = new Set<string>();
  const excerpts = excerptValues.map((value, index): ProposalEnvelopeExcerpt => {
    const path = `envelope.proposal_content.excerpts[${index}]`;
    const record = asObject(value, path);
    exact(record, ["id", "source_id", "text"], path);
    const id = stringField(record, "id", path);
    const sourceId = stringField(record, "source_id", path);
    const text = stringField(record, "text", path);
    if (!SAFE_PROPOSAL_ID.test(id)) refuse(`${path}.id is unsafe`);
    if (excerptIds.has(id)) refuse(`${path}.id is duplicated`);
    excerptIds.add(id);
    if (!sourceIds.has(sourceId)) refuse(`${path}.source_id is unresolved`);
    if (text.trim() === "") refuse(`${path}.text must be non-empty`);
    return { id, source_id: sourceId, text };
  });

  const claimValues = asArray(
    content.claims,
    "envelope.proposal_content.claims",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  );
  const claimIds = new Set<string>();
  const claims = claimValues.map((value, index): ProposalEnvelopeClaim => {
    const path = `envelope.proposal_content.claims[${index}]`;
    const record = asObject(value, path);
    exact(record, ["id", "type", "text", "subject", "confidence", "excerpt_ids"], path);
    const id = stringField(record, "id", path);
    const type = stringField(record, "type", path);
    const text = stringField(record, "text", path);
    const subject = stringField(record, "subject", path);
    const confidence = stringField(record, "confidence", path);
    const references = parseUniqueStringIds(record.excerpt_ids, `${path}.excerpt_ids`);
    if (!SAFE_PROPOSAL_ID.test(id)) refuse(`${path}.id is unsafe`);
    if (claimIds.has(id)) refuse(`${path}.id is duplicated`);
    claimIds.add(id);
    if (!SAFE_CLAIM_TYPE.test(type)) refuse(`${path}.type is unsafe`);
    if (text.trim() === "") refuse(`${path}.text must be non-empty`);
    if (!SAFE_NORMALIZED_SUBJECT.test(subject)) refuse(`${path}.subject is unsafe`);
    if (!["high", "medium", "low"].includes(confidence)) refuse(`${path}.confidence is unsupported`);
    for (const reference of references) {
      if (!excerptIds.has(reference)) refuse(`${path}.excerpt_ids contains an unresolved reference`);
    }
    return {
      id,
      type,
      text,
      subject,
      confidence: confidence as ProposalEnvelopeClaim["confidence"],
      excerpt_ids: references,
    };
  });

  const objectValues = asArray(
    content.account_objects,
    "envelope.proposal_content.account_objects",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  );
  const objectIds = new Set<string>();
  const accountObjects = objectValues.map(
    (value, index): ProposalEnvelopeAccountObject => {
      const path = `envelope.proposal_content.account_objects[${index}]`;
      const record = asObject(value, path);
      exact(record, ["id", "type", "title", "summary", "claim_ids"], path);
      const id = stringField(record, "id", path);
      const type = stringField(record, "type", path);
      const title = stringField(record, "title", path);
      const summary = stringField(record, "summary", path);
      const references = parseUniqueStringIds(record.claim_ids, `${path}.claim_ids`);
      if (!SAFE_PROPOSAL_ID.test(id)) refuse(`${path}.id is unsafe`);
      if (objectIds.has(id)) refuse(`${path}.id is duplicated`);
      objectIds.add(id);
      if (!ACCOUNT_OBJECT_KINDS.includes(type as AccountObjectKind)) {
        refuse(`${path}.type is unsupported`);
      }
      if (title.trim() === "" || summary.trim() === "") {
        refuse(`${path} title and summary must be non-empty`);
      }
      for (const reference of references) {
        if (!claimIds.has(reference)) refuse(`${path}.claim_ids contains an unresolved reference`);
      }
      return {
        id,
        type: type as AccountObjectKind,
        title,
        summary,
        claim_ids: references,
      };
    },
  );

  return { sources, excerpts, claims, account_objects: accountObjects };
}

function parseAssurances(value: StrictJsonValue | undefined): ProposalSourceAssurances {
  const assurances = asObject(value, "envelope.source_assurances");
  exact(
    assurances,
    [
      "origin_content_sha256_proves_origin_custody",
      "transformation_manifest_sha256_resolves_transformation_record",
    ],
    "envelope.source_assurances",
  );
  if (
    assurances.origin_content_sha256_proves_origin_custody !== false ||
    assurances.transformation_manifest_sha256_resolves_transformation_record !== false
  ) {
    refuse("envelope source assurances must remain explicitly closed");
  }
  return {
    origin_content_sha256_proves_origin_custody: false,
    transformation_manifest_sha256_resolves_transformation_record: false,
  };
}

function parseAuthority(value: StrictJsonValue | undefined): ProposalAuthorityMarkers {
  const authority = asObject(value, "envelope.authority");
  exact(
    authority,
    [
      "proposal_only",
      "integrity_digest_is_approval",
      "current_effective_authorization",
      "trusted_presentation_authority",
      "graph_ingestion_authority",
      "authenticated_human_approval",
      "ratification",
      "durable_write_authority",
      "durable_effect_performed",
    ],
    "envelope.authority",
  );
  if (
    authority.proposal_only !== true ||
    authority.integrity_digest_is_approval !== false ||
    authority.current_effective_authorization !== "none" ||
    authority.trusted_presentation_authority !== false ||
    authority.graph_ingestion_authority !== false ||
    authority.authenticated_human_approval !== false ||
    authority.ratification !== false ||
    authority.durable_write_authority !== false ||
    authority.durable_effect_performed !== false
  ) {
    refuse("envelope authority markers must remain proposal-only and non-authorizing");
  }
  return {
    proposal_only: true,
    integrity_digest_is_approval: false,
    current_effective_authorization: "none",
    trusted_presentation_authority: false,
    graph_ingestion_authority: false,
    authenticated_human_approval: false,
    ratification: false,
    durable_write_authority: false,
    durable_effect_performed: false,
  };
}

function parseFixtureBinding(
  value: StrictJsonValue | undefined,
  producer: ProposalProducer,
): ProposalFixtureBinding | null {
  if (value === null) {
    if (producer.kind === "fixture") {
      refuse("fixture envelopes require a declared fixture-content integrity binding");
    }
    return null;
  }
  if (producer.kind !== "fixture") {
    refuse("imported and model-generated envelopes must not fabricate fixture binding");
  }
  const binding = asObject(value, "envelope.fixture_binding");
  exact(
    binding,
    ["fixture_id", "fixture_content_sha256", "authenticated_human_approval"],
    "envelope.fixture_binding",
  );
  const fixtureId = stringField(binding, "fixture_id", "envelope.fixture_binding");
  const digest = stringField(binding, "fixture_content_sha256", "envelope.fixture_binding");
  if (!SAFE_OPAQUE_ID.test(fixtureId) || !CANONICAL_SHA256.test(digest)) {
    refuse("envelope.fixture_binding is malformed");
  }
  if (binding.authenticated_human_approval !== false) {
    refuse("fixture binding is not authenticated human approval");
  }
  return {
    fixture_id: fixtureId,
    fixture_content_sha256: digest,
    authenticated_human_approval: false,
  };
}

function parseCore(root: { [key: string]: StrictJsonValue }): ProposalEnvelopeCore {
  if (root.kind !== PROPOSAL_ENVELOPE_KIND) refuse("envelope.kind is unsupported");
  if (root.version !== PROPOSAL_ENVELOPE_VERSION) refuse("envelope.version is unsupported");
  const producer = parseProducer(root.producer);
  const scope = parseScope(root.scope);
  const createdAt = parseCanonicalTimestamp(root.created_at, "envelope.created_at");
  const expiresAt = parseCanonicalTimestamp(root.expires_at, "envelope.expires_at");
  const lifetime = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  if (lifetime <= 0 || lifetime > PROPOSAL_ENVELOPE_MAX_LIFETIME_MS) {
    refuse("envelope lifetime is outside the conservative maximum");
  }
  const proposalContent = parseContent(root.proposal_content, scope);
  const sourceAssurances = parseAssurances(root.source_assurances);
  const fixtureBinding = parseFixtureBinding(root.fixture_binding, producer);
  const authority = parseAuthority(root.authority);
  return {
    kind: PROPOSAL_ENVELOPE_KIND,
    version: PROPOSAL_ENVELOPE_VERSION,
    producer,
    scope,
    created_at: createdAt,
    expires_at: expiresAt,
    proposal_content: proposalContent,
    source_assurances: sourceAssurances,
    fixture_binding: fixtureBinding,
    authority,
  };
}

function snapshot(raw: unknown, path: string): { [key: string]: StrictJsonValue } {
  try {
    return strictJsonObject(snapshotStrictJson(raw, path, LIMITS), path);
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

export function createProposalEnvelope(rawCore: unknown): ProposalEnvelope {
  try {
    const root = snapshot(rawCore, "envelope");
    exact(root, ENVELOPE_CORE_KEYS, "envelope");
    const core = parseCore(root);
    const envelopeSha256 = sha256CanonicalJson(core as unknown as StrictJsonValue);
    return deepFreezeOwnData({ ...core, envelope_sha256: envelopeSha256 });
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

export function hydrateProposalEnvelope(raw: unknown): ProposalEnvelope {
  try {
    const root = snapshot(raw, "envelope");
    exact(root, [...ENVELOPE_CORE_KEYS, "envelope_sha256"], "envelope");
    const suppliedDigest = root.envelope_sha256;
    if (typeof suppliedDigest !== "string" || !CANONICAL_SHA256.test(suppliedDigest)) {
      refuse("envelope.envelope_sha256 is malformed or missing");
    }
    const core = parseCore(root);
    const expectedDigest = sha256CanonicalJson(core as unknown as StrictJsonValue);
    if (suppliedDigest !== expectedDigest) refuse("envelope integrity digest mismatch");
    return deepFreezeOwnData({ ...core, envelope_sha256: expectedDigest });
  } catch (error) {
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    throw error;
  }
}

function canonicalExpiry(createdAt: string): string {
  return new Date(
    new Date(createdAt).getTime() + PROPOSAL_ENVELOPE_MAX_LIFETIME_MS,
  )
    .toISOString()
    .replace(".000Z", "Z");
}

function adaptPublicCuratedMaterializationInputToProposalEnvelopeInternal(
  input: MaterializeProposalForValidationInput,
  options: { readonly subject_id: string },
): ProposalEnvelope {
  const inputRoot = snapshot(input, "public_curated_materialization_input");
  exact(
    inputRoot,
    ["context", "public_sources", "proposed_excerpts", "proposed_claims", "proposed_account_objects"],
    "public_curated_materialization_input",
  );
  const optionsRoot = snapshot(options, "adapter_options");
  exact(optionsRoot, ["subject_id"], "adapter_options");
  const subjectId = stringField(optionsRoot, "subject_id", "adapter_options");
  if (!SAFE_OPAQUE_ID.test(subjectId)) refuse("adapter_options.subject_id is unsafe");

  const context = asObject(inputRoot.context, "public_curated_materialization_input.context");
  exact(
    context,
    ["origin", "team_id", "account_id", "materialized_at", "proposal_set_id"],
    "public_curated_materialization_input.context",
  );
  if (context.origin !== "hand-curated-public") {
    refuse("adapter accepts the public-curated materialization origin only");
  }
  const teamId = stringField(context, "team_id", "public_curated_materialization_input.context");
  const accountId = stringField(context, "account_id", "public_curated_materialization_input.context");
  const createdAt = parseCanonicalTimestamp(
    context.materialized_at,
    "public_curated_materialization_input.context.materialized_at",
  );
  const proposalSetId = stringField(
    context,
    "proposal_set_id",
    "public_curated_materialization_input.context",
  );

  // Reuse the established public-source, excerpt-span, trust-injection, and
  // topology rules. Unlike the legacy artifact path, the adapter refuses the
  // entire conversion if even one disposition is rejected.
  const materialized = materializeProposalForValidation(input);
  if (
    !materialized.bundle_validation.ok ||
    materialized.dispositions.some((disposition) => disposition.disposition === "rejected")
  ) {
    refuse("public-curated input did not materialize completely and validly");
  }

  const sources = asArray(
    inputRoot.public_sources,
    "public_curated_materialization_input.public_sources",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  );
  const excerpts = asArray(
    inputRoot.proposed_excerpts,
    "public_curated_materialization_input.proposed_excerpts",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  ).map((value, index) => {
    const path = `public_curated_materialization_input.proposed_excerpts[${index}]`;
    const record = asObject(value, path);
    exact(record, ["proposal_id", "source_document_id", "quote"], path);
    return {
      id: stringField(record, "proposal_id", path),
      source_id: stringField(record, "source_document_id", path),
      text: stringField(record, "quote", path),
    };
  });
  const claims = asArray(
    inputRoot.proposed_claims,
    "public_curated_materialization_input.proposed_claims",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  ).map((value, index) => {
    const path = `public_curated_materialization_input.proposed_claims[${index}]`;
    const record = asObject(value, path);
    exact(
      record,
      ["proposal_id", "claim_type", "text", "normalized_subject", "confidence", "supporting_excerpt_proposal_ids"],
      path,
    );
    return {
      id: stringField(record, "proposal_id", path),
      type: stringField(record, "claim_type", path),
      text: stringField(record, "text", path),
      subject: stringField(record, "normalized_subject", path),
      confidence: stringField(record, "confidence", path),
      excerpt_ids: record.supporting_excerpt_proposal_ids,
    };
  });
  const accountObjects = asArray(
    inputRoot.proposed_account_objects,
    "public_curated_materialization_input.proposed_account_objects",
    PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
    true,
  ).map((value, index) => {
    const path = `public_curated_materialization_input.proposed_account_objects[${index}]`;
    const record = asObject(value, path);
    exact(
      record,
      ["proposal_id", "object_type", "title", "summary", "supporting_claim_proposal_ids"],
      path,
    );
    return {
      id: stringField(record, "proposal_id", path),
      type: stringField(record, "object_type", path),
      title: stringField(record, "title", path),
      summary: stringField(record, "summary", path),
      claim_ids: record.supporting_claim_proposal_ids,
    };
  });

  return createProposalEnvelope({
    kind: PROPOSAL_ENVELOPE_KIND,
    version: PROPOSAL_ENVELOPE_VERSION,
    producer: { kind: "fixture", trace_id: proposalSetId },
    scope: {
      team_id: teamId,
      account_id: accountId,
      subject_id: subjectId,
      purpose: PROPOSAL_ENVELOPE_PURPOSE,
    },
    created_at: createdAt,
    expires_at: canonicalExpiry(createdAt),
    proposal_content: {
      sources,
      excerpts,
      claims,
      account_objects: accountObjects,
    },
    source_assurances: {
      origin_content_sha256_proves_origin_custody: false,
      transformation_manifest_sha256_resolves_transformation_record: false,
    },
    fixture_binding: {
      fixture_id: proposalSetId,
      fixture_content_sha256: sha256CanonicalJson(inputRoot),
      authenticated_human_approval: false,
    },
    authority: {
      proposal_only: true,
      integrity_digest_is_approval: false,
      current_effective_authorization: "none",
      trusted_presentation_authority: false,
      graph_ingestion_authority: false,
      authenticated_human_approval: false,
      ratification: false,
      durable_write_authority: false,
      durable_effect_performed: false,
    },
  });
}

export function adaptPublicCuratedMaterializationInputToProposalEnvelope(
  input: MaterializeProposalForValidationInput,
  options: { readonly subject_id: string },
): ProposalEnvelope {
  try {
    return adaptPublicCuratedMaterializationInputToProposalEnvelopeInternal(
      input,
      options,
    );
  } catch (error) {
    if (error instanceof ProposalEnvelopeBoundaryError) throw error;
    if (error instanceof StrictJsonBoundaryError) refuse(error.message);
    if (error instanceof Error) refuse(error.message);
    refuse("public-curated materialization input is invalid");
  }
}
