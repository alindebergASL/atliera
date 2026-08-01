// Deterministic Atliera Graph validator.
//
// Implements the hard invariants documented in
// docs/architecture/provenance-and-validation.md. The validator is a
// pure function over a GraphBundle (+ optional LensOutputs) — it never
// mutates inputs, never reads env vars, never imports a provider SDK,
// and never opens a network connection. Quality metrics are aggregated
// alongside hard failures so downstream gates can report pass/borderline
// /fail bands later without changing this surface.

import { createHash } from "node:crypto";

import {
  ID_PREFIXES,
  idHasPrefix,
  isWellFormedId,
  type RecordKind,
} from "./ids.ts";
import { validateAuditTargetReference } from "./audit-target.ts";
import { createSupportEvaluator } from "./support.ts";
import { normalizeText, sourceContainsExcerpt } from "./normalize.ts";
import { parseGraphBundle } from "./schema.ts";
import {
  emptyMetrics,
  type HardFailure,
  type HardFailureCode,
  type ValidationReport,
} from "./report.ts";
import {
  getAccountBearingGraphRecords,
  inspectGraphSubject,
  type SubjectScope,
} from "./subject.ts";
import type {
  GraphBundle,
  LensOutput,
} from "./types.ts";
import type { RuntimeMode } from "../modes/index.ts";

export type { RuntimeMode };

export interface ValidateOptions {
  // `mode` is the runtime mode the validator is being invoked under.
  // Validators always operate in a pure read-only fashion, so the field
  // is recorded mainly for guard reporting: if mode is `validation` the
  // caller is asserting that nothing in this path may issue a production
  // write or a provider call, and validators verify that invariant.
  mode: RuntimeMode;
  // Lens outputs (Signals / Maps / Plays) are validated against the
  // graph: any verified lens item must map back to a verified record.
  lenses?: LensOutput[];
  // Optional account-scoped validation boundary. Raw research-run bundles may
  // omit this and contain multiple isolated accounts; candidate-style callers
  // can supply it to require every subject-bearing record to match.
  subject?: SubjectScope;
}

interface BundleIndex {
  source_ids: Set<string>;
  source_by_id: Map<string, GraphBundle["sources"][number]>;
  excerpt_ids: Set<string>;
  excerpt_by_id: Map<string, GraphBundle["excerpts"][number]>;
  claim_ids: Set<string>;
  claim_by_id: Map<string, GraphBundle["claims"][number]>;
  account_object_ids: Set<string>;
  account_object_by_id: Map<string, GraphBundle["account_objects"][number]>;
  claim_evidence_ids: Set<string>;
  account_object_claim_ids: Set<string>;
  research_run_ids: Set<string>;
  run_artifact_ids: Set<string>;
  audit_event_ids: Set<string>;
}

function indexBundle(bundle: GraphBundle): BundleIndex {
  const idx: BundleIndex = {
    source_ids: new Set(),
    source_by_id: new Map(),
    excerpt_ids: new Set(),
    excerpt_by_id: new Map(),
    claim_ids: new Set(),
    claim_by_id: new Map(),
    account_object_ids: new Set(),
    account_object_by_id: new Map(),
    claim_evidence_ids: new Set(),
    account_object_claim_ids: new Set(),
    research_run_ids: new Set(),
    run_artifact_ids: new Set(),
    audit_event_ids: new Set(),
  };
  for (const s of bundle.sources) {
    idx.source_ids.add(s.id);
    idx.source_by_id.set(s.id, s);
  }
  for (const e of bundle.excerpts) {
    idx.excerpt_ids.add(e.id);
    idx.excerpt_by_id.set(e.id, e);
  }
  for (const c of bundle.claims) {
    idx.claim_ids.add(c.id);
    idx.claim_by_id.set(c.id, c);
  }
  for (const o of bundle.account_objects) {
    idx.account_object_ids.add(o.id);
    idx.account_object_by_id.set(o.id, o);
  }
  for (const ce of bundle.claim_evidence) idx.claim_evidence_ids.add(ce.id);
  for (const oc of bundle.account_object_claims) {
    idx.account_object_claim_ids.add(oc.id);
  }
  for (const r of bundle.research_runs) idx.research_run_ids.add(r.id);
  for (const a of bundle.run_artifacts) idx.run_artifact_ids.add(a.id);
  for (const a of bundle.audit_events) idx.audit_event_ids.add(a.id);
  return idx;
}

function fail(
  failures: HardFailure[],
  code: HardFailureCode,
  message: string,
  extra: Partial<HardFailure> = {},
): void {
  failures.push({ code, message, ...extra });
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && /[^\p{White_Space}\uFEFF]/u.test(value);
}

const CANONICAL_SHA256 = /^[a-f0-9]{64}$/;

function sha256ExactUtf8(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function checkIdShape(
  failures: HardFailure[],
  id: string,
  kind: RecordKind,
  recordPath: string,
  field = "id",
): void {
  if (!isWellFormedId(id)) {
    fail(failures, "invalid_id_format", `${recordPath}.${field}=${JSON.stringify(id)} is not a well-formed id`, {
      record_kind: kind,
      record_id: id,
      field,
    });
    return;
  }
  if (!idHasPrefix(id, kind)) {
    fail(
      failures,
      "wrong_id_prefix",
      `${recordPath}.${field}=${id} does not use prefix '${ID_PREFIXES[kind]}_'`,
      { record_kind: kind, record_id: id, field },
    );
  }
}

function checkDuplicates(
  failures: HardFailure[],
  ids: string[],
  kind: RecordKind,
): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      fail(failures, "duplicate_id", `duplicate ${kind} id: ${id}`, {
        record_kind: kind,
        record_id: id,
      });
    }
    seen.add(id);
  }
}

export function validateGraphBundleRaw(
  raw: unknown,
  options: ValidateOptions,
): ValidationReport {
  const failures: HardFailure[] = [];
  const metrics = emptyMetrics();

  const parsed = parseGraphBundle(raw);
  if (!parsed.ok) {
    for (const e of parsed.errors) {
      const code: HardFailureCode =
        e.kind === "unknown_field" ? "unknown_field" : "schema_parse_failure";
      fail(failures, code, `${e.path}: ${e.message}`);
    }
    return { ok: false, hard_failures: failures, metrics };
  }
  return validateGraphBundle(parsed.value, options);
}

export function validateGraphBundle(
  bundle: GraphBundle,
  options: ValidateOptions,
): ValidationReport {
  const failures: HardFailure[] = [];
  const metrics = emptyMetrics();

  // 1. ID shape + duplicates per kind.
  checkDuplicates(failures, bundle.sources.map((s) => s.id), "source_document");
  checkDuplicates(
    failures,
    bundle.excerpts.map((e) => e.id),
    "evidence_excerpt",
  );
  checkDuplicates(failures, bundle.claims.map((c) => c.id), "claim");
  checkDuplicates(
    failures,
    bundle.claim_evidence.map((c) => c.id),
    "claim_evidence",
  );
  checkDuplicates(
    failures,
    bundle.account_objects.map((o) => o.id),
    "account_object",
  );
  checkDuplicates(
    failures,
    bundle.account_object_claims.map((o) => o.id),
    "account_object_claim",
  );
  checkDuplicates(
    failures,
    bundle.research_runs.map((r) => r.id),
    "research_run",
  );
  checkDuplicates(
    failures,
    bundle.run_artifacts.map((a) => a.id),
    "run_artifact",
  );
  checkDuplicates(
    failures,
    bundle.audit_events.map((a) => a.id),
    "audit_event",
  );

  for (const s of bundle.sources) {
    checkIdShape(failures, s.id, "source_document", "source");
    for (const field of [
      "origin_content_sha256",
      "stored_content_sha256",
    ] as const) {
      if (!CANONICAL_SHA256.test(s[field])) {
        fail(
          failures,
          "invalid_source_integrity_digest",
          `source ${s.id}.${field} must be a bare lowercase 64-hex SHA-256 digest`,
          { record_kind: "source_document", record_id: s.id, field },
        );
      }
    }
    if (
      s.transformation_manifest_sha256 !== null &&
      !CANONICAL_SHA256.test(s.transformation_manifest_sha256)
    ) {
      fail(
        failures,
        "invalid_source_integrity_digest",
        `source ${s.id}.transformation_manifest_sha256 must be null or a bare lowercase 64-hex SHA-256 digest`,
        {
          record_kind: "source_document",
          record_id: s.id,
          field: "transformation_manifest_sha256",
        },
      );
    }
    const recomputedStoredSha256 = sha256ExactUtf8(s.raw_text);
    if (s.stored_content_sha256 !== recomputedStoredSha256) {
      fail(
        failures,
        "stored_content_sha256_mismatch",
        `source ${s.id}.stored_content_sha256 does not match the exact UTF-8 bytes of raw_text`,
        {
          record_kind: "source_document",
          record_id: s.id,
          field: "stored_content_sha256",
        },
      );
    }
    if (
      s.origin_content_sha256 !== s.stored_content_sha256 &&
      s.transformation_manifest_sha256 === null
    ) {
      fail(
        failures,
        "transformation_manifest_sha256_required",
        `source ${s.id} requires a transformation manifest identity when origin and stored content differ`,
        {
          record_kind: "source_document",
          record_id: s.id,
          field: "transformation_manifest_sha256",
        },
      );
    }
  }
  for (const e of bundle.excerpts) {
    checkIdShape(failures, e.id, "evidence_excerpt", "excerpt");
  }
  for (const c of bundle.claims) {
    checkIdShape(failures, c.id, "claim", "claim");
  }
  for (const ce of bundle.claim_evidence) {
    checkIdShape(failures, ce.id, "claim_evidence", "claim_evidence");
  }
  for (const o of bundle.account_objects) {
    checkIdShape(failures, o.id, "account_object", "account_object");
  }
  for (const oc of bundle.account_object_claims) {
    checkIdShape(
      failures,
      oc.id,
      "account_object_claim",
      "account_object_claim",
    );
  }
  for (const r of bundle.research_runs) {
    checkIdShape(failures, r.id, "research_run", "research_run");
  }
  for (const a of bundle.run_artifacts) {
    checkIdShape(failures, a.id, "run_artifact", "run_artifact");
  }
  for (const a of bundle.audit_events) {
    checkIdShape(failures, a.id, "audit_event", "audit_event");
  }

  const idx = indexBundle(bundle);
  const support = createSupportEvaluator(bundle);
  const subjectInspection = inspectGraphSubject(bundle);

  for (const audit of bundle.audit_events) {
    const targetFailure = validateAuditTargetReference(bundle, audit);
    if (targetFailure !== null) failures.push(targetFailure);
  }

  for (const record of getAccountBearingGraphRecords(bundle)) {
    for (const field of ["team_id", "account_id"] as const) {
      if (!isNonBlank(record[field])) {
        fail(
          failures,
          "subject_scope_mismatch",
          `${record.record_kind} ${record.record_id}.${field} must contain at least one non-whitespace character`,
          {
            record_kind: record.record_kind,
            record_id: record.record_id,
            field,
          },
        );
      }
    }
  }
  for (const audit of bundle.audit_events) {
    if (!isNonBlank(audit.team_id)) {
      fail(
        failures,
        "subject_scope_mismatch",
        `audit_event ${audit.id}.team_id must contain at least one non-whitespace character`,
        {
          record_kind: "audit_event",
          record_id: audit.id,
          field: "team_id",
        },
      );
    }
  }

  // A raw research-run bundle may contain more than one account, but never
  // more than one owning team. Beyond their intrinsic nonblank team, audit
  // events are checked against an explicit scope or a unique bundle team.
  if (subjectInspection.team_ids.length > 1) {
    fail(
      failures,
      "bundle_team_mismatch",
      `bundle contains account-bearing records from multiple teams: ${subjectInspection.team_ids.join(", ")}`,
    );
  }

  if (options.subject) {
    for (const field of ["team_id", "account_id"] as const) {
      const authority = options.subject[field];
      if (!isNonBlank(authority)) {
        fail(
          failures,
          "subject_scope_mismatch",
          `subject.${field} must contain at least one non-whitespace character`,
          { field },
        );
      }
    }
    for (const record of getAccountBearingGraphRecords(bundle)) {
      if (
        record.team_id !== options.subject.team_id ||
        record.account_id !== options.subject.account_id
      ) {
        fail(
          failures,
          "subject_scope_mismatch",
          `${record.record_kind} ${record.record_id} has subject ${record.team_id}/${record.account_id}; expected ${options.subject.team_id}/${options.subject.account_id}`,
          {
            record_kind: record.record_kind,
            record_id: record.record_id,
          },
        );
      }
    }
    for (const audit of bundle.audit_events) {
      if (audit.team_id !== options.subject.team_id) {
        fail(
          failures,
          "subject_scope_mismatch",
          `audit_event ${audit.id} has team ${audit.team_id}; expected ${options.subject.team_id}`,
          { record_kind: "audit_event", record_id: audit.id, field: "team_id" },
        );
      }
    }
  } else if (
    subjectInspection.team_ids.length === 0 &&
    subjectInspection.audit_team_ids.length > 1
  ) {
    fail(
      failures,
      "bundle_team_mismatch",
      `bundle contains audit events from multiple teams: ${subjectInspection.audit_team_ids.join(", ")}`,
    );
  } else if (subjectInspection.team_ids.length === 1) {
    const bundleTeam = subjectInspection.team_ids[0]!;
    for (const audit of bundle.audit_events) {
      if (audit.team_id !== bundleTeam) {
        fail(
          failures,
          "bundle_team_mismatch",
          `audit_event ${audit.id} has team ${audit.team_id}; bundle team is ${bundleTeam}`,
          { record_kind: "audit_event", record_id: audit.id, field: "team_id" },
        );
      }
    }
  }

  // 2. Excerpts must point at a real source document. A reference to a
  //    source id that does not exist in the bundle is an "invented"
  //    source id — the agent is referencing something the system never
  //    fetched/stored.
  for (const e of bundle.excerpts) {
    if (!idx.source_ids.has(e.source_document_id)) {
      fail(
        failures,
        "invented_source_document_id",
        `excerpt ${e.id} references unknown source_document_id ${e.source_document_id}`,
        {
          record_kind: "evidence_excerpt",
          record_id: e.id,
          field: "source_document_id",
        },
      );
    }
    // Cross-kind prefix mismatch is treated as a dangling reference so
    // the agent cannot smuggle the wrong record type in.
    if (
      isWellFormedId(e.source_document_id) &&
      !idHasPrefix(e.source_document_id, "source_document")
    ) {
      fail(
        failures,
        "dangling_reference",
        `excerpt ${e.id}.source_document_id is not a source_document id`,
        {
          record_kind: "evidence_excerpt",
          record_id: e.id,
          field: "source_document_id",
        },
      );
    }
  }

  // 3. ClaimEvidence references resolve, and reference the correct kinds.
  for (const ce of bundle.claim_evidence) {
    if (!idx.claim_ids.has(ce.claim_id)) {
      fail(
        failures,
        "invented_claim_id",
        `claim_evidence ${ce.id} references unknown claim_id ${ce.claim_id}`,
        { record_kind: "claim_evidence", record_id: ce.id, field: "claim_id" },
      );
    }
    if (!idx.excerpt_ids.has(ce.evidence_excerpt_id)) {
      fail(
        failures,
        "invented_evidence_excerpt_id",
        `claim_evidence ${ce.id} references unknown evidence_excerpt_id ${ce.evidence_excerpt_id}`,
        {
          record_kind: "claim_evidence",
          record_id: ce.id,
          field: "evidence_excerpt_id",
        },
      );
    }
    if (
      isWellFormedId(ce.claim_id) &&
      !idHasPrefix(ce.claim_id, "claim")
    ) {
      fail(
        failures,
        "dangling_reference",
        `claim_evidence ${ce.id}.claim_id is not a claim id`,
        { record_kind: "claim_evidence", record_id: ce.id, field: "claim_id" },
      );
    }
    if (
      isWellFormedId(ce.evidence_excerpt_id) &&
      !idHasPrefix(ce.evidence_excerpt_id, "evidence_excerpt")
    ) {
      fail(
        failures,
        "dangling_reference",
        `claim_evidence ${ce.id}.evidence_excerpt_id is not an evidence_excerpt id`,
        {
          record_kind: "claim_evidence",
          record_id: ce.id,
          field: "evidence_excerpt_id",
        },
      );
    }

    const claim = idx.claim_by_id.get(ce.claim_id);
    const excerpt = idx.excerpt_by_id.get(ce.evidence_excerpt_id);
    const source = excerpt
      ? idx.source_by_id.get(excerpt.source_document_id)
      : undefined;
    if (
      claim &&
      source &&
      (claim.team_id !== source.team_id ||
        claim.account_id !== source.account_id)
    ) {
      fail(
        failures,
        "relationship_subject_mismatch",
        `claim_evidence ${ce.id} links claim ${claim.id} (${claim.team_id}/${claim.account_id}) to excerpt ${excerpt!.id} owned by source ${source.id} (${source.team_id}/${source.account_id})`,
        { record_kind: "claim_evidence", record_id: ce.id },
      );
    }
  }

  // 4. AccountObjectClaim references resolve.
  for (const oc of bundle.account_object_claims) {
    if (!idx.account_object_ids.has(oc.account_object_id)) {
      fail(
        failures,
        "invented_account_object_id",
        `account_object_claim ${oc.id} references unknown account_object_id ${oc.account_object_id}`,
        {
          record_kind: "account_object_claim",
          record_id: oc.id,
          field: "account_object_id",
        },
      );
    }
    if (!idx.claim_ids.has(oc.claim_id)) {
      fail(
        failures,
        "invented_claim_id",
        `account_object_claim ${oc.id} references unknown claim_id ${oc.claim_id}`,
        {
          record_kind: "account_object_claim",
          record_id: oc.id,
          field: "claim_id",
        },
      );
    }
    const object = idx.account_object_by_id.get(oc.account_object_id);
    const claim = idx.claim_by_id.get(oc.claim_id);
    if (
      object &&
      claim &&
      (object.team_id !== claim.team_id ||
        object.account_id !== claim.account_id)
    ) {
      fail(
        failures,
        "relationship_subject_mismatch",
        `account_object_claim ${oc.id} links object ${object.id} (${object.team_id}/${object.account_id}) to claim ${claim.id} (${claim.team_id}/${claim.account_id})`,
        { record_kind: "account_object_claim", record_id: oc.id },
      );
    }
  }

  // RunArtifact ownership is inherited through its ResearchRun reference.
  // ResearchRun itself remains optional for bundles with no RunArtifacts.
  for (const artifact of bundle.run_artifacts) {
    if (!idx.research_run_ids.has(artifact.research_run_id)) {
      fail(
        failures,
        "invented_research_run_id",
        `run_artifact ${artifact.id} references unknown research_run_id ${artifact.research_run_id}`,
        {
          record_kind: "run_artifact",
          record_id: artifact.id,
          field: "research_run_id",
        },
      );
    }
    if (
      isWellFormedId(artifact.research_run_id) &&
      !idHasPrefix(artifact.research_run_id, "research_run")
    ) {
      fail(
        failures,
        "dangling_reference",
        `run_artifact ${artifact.id}.research_run_id is not a research_run id`,
        {
          record_kind: "run_artifact",
          record_id: artifact.id,
          field: "research_run_id",
        },
      );
    }
  }

  // 5. Accepted excerpts must literally exist in the source text after
  //    deterministic normalisation. Excerpts marked `paraphrase` may
  //    never carry `validation_status: accepted` — paraphrases must
  //    remain proposals or be rejected.
  const sourceById = new Map(bundle.sources.map((s) => [s.id, s]));
  for (const e of bundle.excerpts) {
    if (e.validation_status !== "accepted") continue;
    if (e.kind === "paraphrase") {
      fail(
        failures,
        "accepted_paraphrase",
        `excerpt ${e.id} is a paraphrase but is marked accepted`,
        {
          record_kind: "evidence_excerpt",
          record_id: e.id,
          field: "kind",
        },
      );
      continue;
    }
    const src = sourceById.get(e.source_document_id);
    if (!src) continue; // already reported as invented

    // 5a. char_start/char_end must be integers, in-bounds, and form a
    //     non-empty half-open span [char_start, char_end). This catches
    //     spans that point at nothing, run past the end of the source,
    //     or are flipped/zero-length.
    const len = src.raw_text.length;
    const spanOk =
      Number.isInteger(e.char_start) &&
      Number.isInteger(e.char_end) &&
      e.char_start >= 0 &&
      e.char_end > e.char_start &&
      e.char_end <= len;
    if (!spanOk) {
      fail(
        failures,
        "excerpt_span_out_of_bounds",
        `accepted excerpt ${e.id} has invalid span [${e.char_start}, ${e.char_end}) ` +
          `against source of length ${len}`,
        {
          record_kind: "evidence_excerpt",
          record_id: e.id,
          field: "char_start",
        },
      );
      continue;
    }

    // 5b. The text at [char_start, char_end) must equal the excerpt's
    //     own text after deterministic normalisation. This is the
    //     primary defense against a model proposing a literal-looking
    //     excerpt whose declared offsets actually point at a different
    //     substring of the source.
    const spanText = src.raw_text.slice(e.char_start, e.char_end);
    const spanMatches =
      normalizeText(spanText) === normalizeText(e.text);
    if (!spanMatches) {
      fail(
        failures,
        "excerpt_span_text_mismatch",
        `accepted excerpt ${e.id} text does not match source[${e.char_start}:${e.char_end}) after normalisation`,
        {
          record_kind: "evidence_excerpt",
          record_id: e.id,
          field: "char_start",
        },
      );
    }

    // 5c. Independently of the span check, the excerpt text must
    //     literally appear somewhere in the source after normalisation.
    //     When this fires together with 5b, the bundle gets two
    //     distinct hard failures — "the offsets are wrong" and "the
    //     text is not in the source at all" — which is the truth.
    if (!sourceContainsExcerpt(src.raw_text, e.text)) {
      fail(
        failures,
        "excerpt_text_not_found_in_source",
        `accepted excerpt ${e.id} text not found in source ${src.id} after normalisation`,
        {
          record_kind: "evidence_excerpt",
          record_id: e.id,
          field: "text",
        },
      );
    }
  }

  // 6. Verified / high-confidence claims need structurally accepted support.
  //    Lifecycle history remains valid: inactive sources and claims preserve
  //    their accepted literal evidence, but cannot provide current support.
  for (const c of bundle.claims) {
    const needsEvidence =
      c.provenance_status === "verified" || c.confidence === "high";
    if (!needsEvidence) continue;
    if (!support.hasStructuralSupportingEvidence(c.id)) {
      fail(
        failures,
        "verified_claim_without_evidence",
        `claim ${c.id} is ${c.provenance_status}/${c.confidence} but has no accepted supporting evidence`,
        { record_kind: "claim", record_id: c.id },
      );
    }
  }

  // 7. Verified AccountObjects need a structurally accepted-supporting claim.
  //    Object and claim lifecycle state does not erase historical connection.
  for (const o of bundle.account_objects) {
    if (o.provenance_status !== "verified") continue;
    if (!support.hasStructuralSupportingClaim(o.id)) {
      fail(
        failures,
        "verified_object_without_supporting_claim",
        `account_object ${o.id} is verified but has no accepted-supporting claim`,
        { record_kind: "account_object", record_id: o.id },
      );
    }
  }

  // 8. Lens outputs may not present unsupported model prose as verified.
  if (options.lenses) {
    for (const lens of options.lenses) {
      for (const item of lens.items) {
        if (item.status !== "verified") continue;
        const obj = item.account_object_id
          ? idx.account_object_by_id.get(item.account_object_id)
          : undefined;
        const cl = item.claim_id
          ? idx.claim_by_id.get(item.claim_id)
          : undefined;
        const backedByVerifiedObj =
          obj?.provenance_status === "verified" &&
          support.hasCurrentSupportingClaim(obj.id);
        const backedByVerifiedClaim =
          cl?.provenance_status === "verified" &&
          support.hasCurrentSupportingEvidence(cl.id);
        if (!backedByVerifiedObj && !backedByVerifiedClaim) {
          fail(
            failures,
            "lens_unsupported_prose_marked_verified",
            `${lens.lens} lens item "${item.label}" is marked verified but has no verified backing record`,
            {
              record_kind: "lens_item",
              field: "status",
            },
          );
        }
      }
    }
  }

  // 9. Aggregate metrics for the report. Totals retain all historical rows;
  //    verified counts include only records with current supporting evidence.
  metrics.total_sources = bundle.sources.length;
  metrics.total_excerpts = bundle.excerpts.length;
  for (const e of bundle.excerpts) {
    if (support.isCurrentExcerptEligible(e)) metrics.accepted_excerpts++;
    if (e.validation_status === "rejected") metrics.rejected_excerpts++;
    if (e.validation_status === "proposed") metrics.proposed_excerpts++;
  }
  metrics.total_claims = bundle.claims.length;
  metrics.verified_claims = bundle.claims.filter(
    (c) =>
      c.provenance_status === "verified" &&
      support.hasCurrentSupportingEvidence(c.id),
  ).length;
  metrics.total_account_objects = bundle.account_objects.length;
  metrics.verified_account_objects = bundle.account_objects.filter(
    (o) =>
      o.provenance_status === "verified" &&
      support.hasCurrentSupportingClaim(o.id),
  ).length;

  return {
    ok: failures.length === 0,
    hard_failures: failures,
    metrics,
  };
}

// Guard helpers that surface, as a HardFailure, attempts to escape the
// validation contract. These are used by tests to prove that safe-mode
// paths fail closed and that the validator can refuse to run when the
// runtime is misconfigured.

export function failProductionWriteInValidationMode(
  mode: RuntimeMode,
): HardFailure | null {
  if (mode === "validation" || mode === "fixture" || mode === "fake") {
    return {
      code: "production_write_in_validation_mode",
      message: `attempted production write while in ${mode} mode`,
    };
  }
  return null;
}

export function failProviderCallOutsideModelMode(
  mode: RuntimeMode,
): HardFailure | null {
  if (mode !== "model") {
    return {
      code: "provider_call_outside_model_mode",
      message: `attempted provider/model call while in ${mode} mode`,
    };
  }
  return null;
}
