import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN,
  PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_APPROVAL_SURFACE,
  PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_ARTIFACT_NAME,
  PROPOSAL_MATERIALIZATION_REVIEW_STATE,
  assertProposalDerivedRecordsUnverified,
  materializeProposalForValidation,
  type MaterializeProposalForValidationInput,
} from "../../src/validation/proposal-materialization.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const INPUT_FIXTURE = join(
  REPO_ROOT,
  "fixtures",
  "validation",
  "proposal-materialization-public-curated-20260611a-input.json",
);

function fixtureInput(): MaterializeProposalForValidationInput {
  return JSON.parse(readFileSync(INPUT_FIXTURE, "utf8")) as MaterializeProposalForValidationInput;
}

type MutableInput = {
  context: Record<string, unknown>;
  public_sources: Record<string, unknown>[];
  proposed_excerpts: Record<string, unknown>[];
  proposed_claims: Record<string, unknown>[];
  proposed_account_objects: Record<string, unknown>[];
};

function mutableFixtureInput(): MutableInput {
  return JSON.parse(readFileSync(INPUT_FIXTURE, "utf8")) as MutableInput;
}

describe("proposal materialization: public hand-curated happy path", () => {
  const artifact = materializeProposalForValidation(fixtureInput());

  test("materializes a disposable validation artifact with all records accepted", () => {
    assert.equal(artifact.kind, "proposal-materialization-validation-artifact");
    assert.equal(artifact.disposable, true);
    assert.equal(artifact.origin, PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN);
    assert.deepEqual(artifact.accepted_counts, {
      sources: 1,
      excerpts: 2,
      claims: 2,
      account_objects: 1,
    });
    assert.deepEqual(artifact.rejected_counts, {
      sources: 0,
      excerpts: 0,
      claims: 0,
      account_objects: 0,
    });
    assert.ok(artifact.dispositions.every((d) => d.disposition === "accepted" && d.reason_code === null));
  });

  test("the bundle candidate passes the deterministic Graph validator", () => {
    assert.equal(artifact.bundle_validation.ok, true);
    assert.deepEqual(artifact.bundle_validation.hard_failures, []);
    assert.equal(artifact.bundle_validation.metrics.total_claims, 2);
    assert.equal(artifact.bundle_validation.metrics.verified_claims, 0);
    assert.equal(artifact.bundle_validation.metrics.verified_account_objects, 0);
    assert.equal(artifact.bundle_validation.metrics.accepted_excerpts, 0);
    assert.equal(artifact.bundle_validation.metrics.proposed_excerpts, 2);
  });

  test("does not broaden any provider/private/durable/ingestion authorization marker", () => {
    assert.deepEqual(artifact.boundaries, {
      current_effective_authorization: "none",
      authorizes_provider_call: false,
      authorizes_private_evidence_read: false,
      authorizes_graph_ingestion: false,
      graph_ingestion_performed: false,
      provider_calls_executed: 0,
      private_evidence_read: false,
      durable_writes_performed: false,
      production_writes: false,
      readiness_claim: false,
    });
    const run = artifact.bundle_candidate.research_runs[0];
    assert.ok(run);
    assert.equal(run.mode, "fixture");
    assert.equal(run.provider, null);
    assert.equal(run.model, null);
    assert.equal(run.cost_cap_usd, 0);
    assert.equal(run.observed_cost_usd, 0);
  });

  test("marks every materialized record unverified plus model-proposed/pending-human-review", () => {
    assert.deepEqual(artifact.trust_language, {
      provenance_status: "unverified",
      excerpt_validation_status: "proposed",
      review_state: PROPOSAL_MATERIALIZATION_REVIEW_STATE,
      adds_new_truth_status_tier: false,
      confidence_cap: "medium",
    });
    for (const excerpt of artifact.bundle_candidate.excerpts) {
      assert.equal(excerpt.validation_status, "proposed");
    }
    for (const claim of artifact.bundle_candidate.claims) {
      assert.equal(claim.provenance_status, "unverified");
      assert.equal(claim.created_by, "model");
      assert.notEqual(claim.confidence, "high");
    }
    for (const accountObject of artifact.bundle_candidate.account_objects) {
      assert.equal(accountObject.provenance_status, "unverified");
      assert.equal(accountObject.payload_json.review_state, PROPOSAL_MATERIALIZATION_REVIEW_STATE);
      assert.equal(accountObject.payload_json.origin, PROPOSAL_MATERIALIZATION_ALLOWED_ORIGIN);
    }
  });

  test("caps proposal-supplied high confidence at medium", () => {
    const expansion = artifact.bundle_candidate.claims.find((c) => c.id === "clm_acme-hub-expansion");
    assert.ok(expansion);
    assert.equal(expansion.confidence, "medium");
  });

  test("names the next visible Workshop artifact and its approval surface", () => {
    assert.deepEqual(artifact.next_visible_workshop_artifact, {
      name: PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_ARTIFACT_NAME,
      scope:
        "deterministic fake-mode Workshop HTML preview rendered from the accepted public-curated bundle candidate of one proposal set",
      approval_surface: PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_APPROVAL_SURFACE,
      private_fresh_route_proof_input_allowed: false,
      private_fresh_route_proof_requires: "separate-fresh-private-evidence-handling-approval",
    });
    assert.equal(
      PROPOSAL_MATERIALIZATION_NEXT_WORKSHOP_ARTIFACT_NAME,
      "workshop-public-curated-proposal-preview",
    );
  });

  test("the artifact is deeply frozen so trust language cannot be flipped after the fact", () => {
    assert.ok(Object.isFrozen(artifact));
    assert.ok(Object.isFrozen(artifact.boundaries));
    assert.ok(Object.isFrozen(artifact.trust_language));
    assert.ok(Object.isFrozen(artifact.bundle_candidate));
    assert.ok(Object.isFrozen(artifact.bundle_candidate.claims[0]));
    assert.throws(() => {
      (artifact.bundle_candidate.claims[0] as { provenance_status: string }).provenance_status =
        "verified";
    }, TypeError);
    assert.throws(() => {
      (artifact.boundaries as { authorizes_provider_call: boolean }).authorizes_provider_call = true;
    }, TypeError);
  });
});

describe("proposal materialization: origin and input boundaries fail closed", () => {
  test("refuses non-object input and missing arrays", () => {
    assert.throws(() => materializeProposalForValidation(undefined as never), /input object/);
    const input = mutableFixtureInput();
    delete (input as Record<string, unknown>).proposed_claims;
    assert.throws(
      () => materializeProposalForValidation(input as never),
      /proposed_claims/,
    );
  });

  test("refuses private fresh-route proof origins and points at the later approval", () => {
    const input = mutableFixtureInput();
    input.context.origin = "private-fresh-route-proof";
    assert.throws(
      () => materializeProposalForValidation(input as never),
      /hand-curated-public input only.*fresh private-evidence-handling approval/s,
    );
  });

  test("refuses contexts without safe identifiers or ISO timestamps", () => {
    for (const [key, value] of [
      ["team_id", "team/../escape"],
      ["account_id", "ACC_UPPER"],
      ["materialized_at", "yesterday"],
      ["proposal_set_id", "Bad Set Id"],
    ] as const) {
      const input = mutableFixtureInput();
      input.context[key] = value;
      assert.throws(() => materializeProposalForValidation(input as never), /context must carry safe/);
    }
  });
});

describe("proposal materialization: per-record dispositions fail closed with safe reason codes", () => {
  test("rejects sources with missing provenance and cascades rejection downstream", () => {
    const input = mutableFixtureInput();
    delete input.public_sources[0]!.fetched_at;
    delete input.public_sources[0]!.content_hash;
    const artifact = materializeProposalForValidation(input as never);

    const sourceDisposition = artifact.dispositions.find((d) => d.record_kind === "source");
    assert.ok(sourceDisposition);
    assert.equal(sourceDisposition.disposition, "rejected");
    assert.equal(sourceDisposition.reason_code, "missing_source_provenance");

    assert.deepEqual(artifact.accepted_counts, {
      sources: 0,
      excerpts: 0,
      claims: 0,
      account_objects: 0,
    });
    for (const d of artifact.dispositions.filter((x) => x.record_kind === "excerpt")) {
      assert.equal(d.reason_code, "unknown_source_document_id");
    }
    for (const d of artifact.dispositions.filter((x) => x.record_kind === "claim")) {
      assert.equal(d.reason_code, "missing_supporting_excerpt_reference");
    }
    for (const d of artifact.dispositions.filter((x) => x.record_kind === "account_object")) {
      assert.equal(d.reason_code, "missing_supporting_claim_reference");
    }
    assert.deepEqual(artifact.bundle_candidate.sources, []);
    assert.equal(artifact.bundle_validation.ok, true);
  });

  test("rejects sources whose URL is not public http(s)", () => {
    for (const url of [
      "file:local/evidence.json",
      "/private/evidence.json",
      "https:///nohost",
      "http://localhost/source",
      "https://127.0.0.1/source",
      "https://10.1.2.3/source",
      "https://172.16.0.1/source",
      "https://172.31.255.255/source",
      "https://192.168.1.1/source",
      "https://169.254.1.1/source",
      "https://0.0.0.0/source",
      "https://[::1]/source",
      "https://user:pass@example.invalid/source",
      // Obfuscated numeric host encodings that URL parsers normalize to
      // private/loopback addresses must fail closed: octal-looking octets,
      // hex octets, and bare-integer hosts are never canonical
      // dotted-decimal public IPv4.
      "https://012.0.0.1/source",
      "https://0177.0.0.1/source",
      "https://0x7f.0.0.1/source",
      "https://0x0a.0.0.1/source",
      "https://2130706433/source",
    ]) {
      const input = mutableFixtureInput();
      input.public_sources[0]!.url = url;
      const artifact = materializeProposalForValidation(input as never);
      const sourceDisposition = artifact.dispositions.find((d) => d.record_kind === "source");
      assert.equal(sourceDisposition?.reason_code, "non_public_source_url", url);
    }
  });

  test("rejects sources that do not match the declared team/account context", () => {
    const input = mutableFixtureInput();
    input.public_sources[0]!.account_id = "acc_other_account";
    const artifact = materializeProposalForValidation(input as never);
    const sourceDisposition = artifact.dispositions.find((d) => d.record_kind === "source");
    assert.equal(sourceDisposition?.reason_code, "source_context_mismatch");
  });

  test("rejects excerpts referencing unknown sources or text absent from the source", () => {
    const input = mutableFixtureInput();
    input.proposed_excerpts[0]!.source_document_id = "src_not_in_input";
    input.proposed_excerpts[1]!.quote = "This sentence does not appear in the source.";
    const artifact = materializeProposalForValidation(input as never);
    const excerptDispositions = artifact.dispositions.filter((d) => d.record_kind === "excerpt");
    assert.deepEqual(
      excerptDispositions.map((d) => d.reason_code),
      ["unknown_source_document_id", "excerpt_text_not_found_in_source"],
    );
    assert.equal(artifact.accepted_counts.excerpts, 0);
  });

  test("rejects proposal records that try to supply their own trust status", () => {
    const input = mutableFixtureInput();
    input.proposed_excerpts[0]!.validation_status = "accepted";
    input.proposed_claims[0]!.provenance_status = "verified";
    input.proposed_account_objects[0]!.review_state = "human_reviewed";
    const artifact = materializeProposalForValidation(input as never);

    for (const kind of ["excerpt", "claim", "account_object"] as const) {
      const first = artifact.dispositions.find((d) => d.record_kind === kind);
      assert.equal(first?.disposition, "rejected", `${kind} must be rejected`);
      assert.equal(first?.reason_code, "proposal_supplied_trust_status_disallowed");
    }
    assert.equal(
      artifact.bundle_candidate.claims.some((c) => c.provenance_status === "verified"),
      false,
    );
    assert.equal(
      artifact.bundle_candidate.excerpts.some((e) => e.validation_status === "accepted"),
      false,
    );
  });

  test("rejects unsafe and duplicate proposal ids without echoing unsafe input", () => {
    const input = mutableFixtureInput();
    input.proposed_excerpts[0]!.proposal_id = "../../private/evidence";
    input.proposed_claims.push({ ...input.proposed_claims[1]! });
    const artifact = materializeProposalForValidation(input as never);

    const unsafe = artifact.dispositions.find(
      (d) => d.record_kind === "excerpt" && d.reason_code === "unsafe_proposal_id",
    );
    assert.ok(unsafe);
    assert.equal(unsafe.proposal_id, "unidentified");

    const duplicate = artifact.dispositions.filter(
      (d) => d.record_kind === "claim" && d.reason_code === "duplicate_proposal_id",
    );
    assert.equal(duplicate.length, 1);
  });

  test("does not invoke hostile accessors or array iterators while snapshotting inputs", () => {
    const accessorInput = mutableFixtureInput();
    let sourceGetterReads = 0;
    Object.defineProperty(accessorInput.public_sources[0]!, "title", {
      enumerable: true,
      get() {
        sourceGetterReads += 1;
        throw new Error("source getter must not run");
      },
    });
    const accessorArtifact = materializeProposalForValidation(accessorInput as never);
    assert.equal(sourceGetterReads, 0);
    assert.equal(
      accessorArtifact.dispositions.find((d) => d.record_kind === "source")?.reason_code,
      "malformed_proposal_record",
    );

    const elementAccessorInput = mutableFixtureInput();
    let arrayElementReads = 0;
    Object.defineProperty(elementAccessorInput.proposed_excerpts, "0", {
      enumerable: true,
      get() {
        arrayElementReads += 1;
        throw new Error("array element getter must not run");
      },
    });
    assert.throws(
      () => materializeProposalForValidation(elementAccessorInput as never),
      /plain bounded public_sources/,
    );
    assert.equal(arrayElementReads, 0);

    const iteratorInput = mutableFixtureInput();
    Object.defineProperty(iteratorInput.proposed_claims, Symbol.iterator, {
      enumerable: true,
      value: () => {
        throw new Error("iterator must not run");
      },
    });
    assert.throws(
      () => materializeProposalForValidation(iteratorInput as never),
      /plain bounded public_sources/,
    );
  });

  test("an own enumerable __proto__ data property cannot materialize inherited source fields", () => {
    // JSON.parse creates `__proto__` as an own data property (it never swaps
    // prototypes). An unhardened snapshot copy of that key with `out[key] =`
    // would invoke the Object.prototype `__proto__` setter, swapping the
    // snapshot's prototype so parseSourceDocument would read the inherited
    // `title` below and accept the record. The record must instead reject
    // fail-closed as malformed.
    const input = mutableFixtureInput();
    const source = input.public_sources[0]!;
    const smuggledTitle = source.title as string;
    delete source.title;
    input.public_sources[0] = JSON.parse(
      JSON.stringify(source).replace(
        /^\{/,
        () => `{"__proto__":{"title":${JSON.stringify(smuggledTitle)}},`,
      ),
    ) as Record<string, unknown>;
    const artifact = materializeProposalForValidation(input as never);

    const sourceDisposition = artifact.dispositions.find((d) => d.record_kind === "source");
    assert.equal(sourceDisposition?.disposition, "rejected");
    assert.equal(sourceDisposition?.reason_code, "malformed_proposal_record");
    assert.equal(artifact.accepted_counts.sources, 0);
    assert.equal(
      artifact.bundle_candidate.sources.some((s) => s.title === smuggledTitle),
      false,
    );

    // The other prototype-machinery keys reject fail-closed too.
    for (const dangerousKey of ["constructor", "prototype"]) {
      const keyInput = mutableFixtureInput();
      keyInput.proposed_excerpts[0]![dangerousKey] = {};
      const keyArtifact = materializeProposalForValidation(keyInput as never);
      const excerptDisposition = keyArtifact.dispositions.find((d) => d.record_kind === "excerpt");
      assert.equal(excerptDisposition?.reason_code, "malformed_proposal_record", dangerousKey);
    }
  });

  test("never runs prototype getters reachable through an own __proto__ data property", () => {
    const input = mutableFixtureInput();
    const source = input.public_sources[0]!;
    delete source.title;
    let getterRuns = 0;
    const hostileProto = {};
    Object.defineProperty(hostileProto, "title", {
      enumerable: true,
      get() {
        getterRuns += 1;
        throw new Error("prototype getter must not run");
      },
    });
    // Object.defineProperty creates `__proto__` as an own enumerable data
    // property without swapping the record's prototype. An unhardened
    // snapshot copy would swap the snapshot's prototype to hostileProto, run
    // the getter inside parseSourceDocument, and let its raw error escape.
    Object.defineProperty(source, "__proto__", {
      value: hostileProto,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    // Must not throw: the hostile record rejects fail-closed instead.
    const artifact = materializeProposalForValidation(input as never);
    assert.equal(getterRuns, 0);
    const sourceDisposition = artifact.dispositions.find((d) => d.record_kind === "source");
    assert.equal(sourceDisposition?.disposition, "rejected");
    assert.equal(sourceDisposition?.reason_code, "malformed_proposal_record");
  });

  test("rejects unsafe source ids without echoing source-shaped private fragments", () => {
    const input = mutableFixtureInput();
    input.public_sources[0]!.id = "private/evidence/api_key";
    const artifact = materializeProposalForValidation(input as never);
    const sourceDisposition = artifact.dispositions.find((d) => d.record_kind === "source");
    assert.equal(sourceDisposition?.disposition, "rejected");
    assert.equal(sourceDisposition?.proposal_id, "unidentified");
    assert.equal(sourceDisposition?.reason_code, "malformed_proposal_record");
  });

  test("rejects overlong root arrays before element reads", () => {
    const input = mutableFixtureInput();
    let getterReads = 0;
    input.proposed_claims = Array.from({ length: 201 }, () => input.proposed_claims[0]!);
    Object.defineProperty(input.proposed_claims, "200", {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error("overlong element getter must not run");
      },
    });
    assert.throws(() => materializeProposalForValidation(input as never), /plain bounded/);
    assert.equal(getterReads, 0);
  });

  test("rejects unsupported account object types", () => {
    const input = mutableFixtureInput();
    input.proposed_account_objects[0]!.object_type = "map";
    const artifact = materializeProposalForValidation(input as never);
    const objectDisposition = artifact.dispositions.find((d) => d.record_kind === "account_object");
    assert.equal(objectDisposition?.reason_code, "unsupported_account_object_type");
  });
});

describe("proposal materialization: verified marking is impossible by contract", () => {
  test("assertProposalDerivedRecordsUnverified throws on verified or accepted records", () => {
    const artifact = materializeProposalForValidation(fixtureInput());
    const tampered = JSON.parse(JSON.stringify(artifact.bundle_candidate));
    tampered.claims[0].provenance_status = "verified";
    assert.throws(() => assertProposalDerivedRecordsUnverified(tampered), /must stay unverified/);

    const tamperedExcerpt = JSON.parse(JSON.stringify(artifact.bundle_candidate));
    tamperedExcerpt.excerpts[0].validation_status = "accepted";
    assert.throws(
      () => assertProposalDerivedRecordsUnverified(tamperedExcerpt),
      /must stay in proposed validation status/,
    );

    const tamperedConfidence = JSON.parse(JSON.stringify(artifact.bundle_candidate));
    tamperedConfidence.account_objects[0].confidence = "high";
    assert.throws(
      () => assertProposalDerivedRecordsUnverified(tamperedConfidence),
      /capped confidence/,
    );
  });
});
