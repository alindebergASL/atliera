import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PROPOSAL_ENVELOPE_MAX_LIFETIME_MS,
  PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND,
  ProposalEnvelopeBoundaryError,
  adaptPublicCuratedMaterializationInputToProposalEnvelope,
  createProposalEnvelope,
  hydrateProposalEnvelope,
  type ProposalEnvelope,
  type ProposalProducerKind,
} from "../../src/validation/proposal-envelope.ts";
import {
  loadPublicProposalInput,
  makePublicProposalEnvelope,
} from "../fixtures/proposal-authority.ts";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function coreFromEnvelope(envelope = makePublicProposalEnvelope()): any {
  const draft = clone(envelope) as any;
  delete draft.envelope_sha256;
  return draft;
}

function envelopeForProducer(kind: ProposalProducerKind): ProposalEnvelope {
  const core = coreFromEnvelope();
  return createProposalEnvelope({
    ...core,
    producer: { kind, trace_id: `${kind}:trace-001` },
    fixture_binding: kind === "fixture" ? core.fixture_binding : null,
  });
}

describe("ProposalEnvelope v1", () => {
  test("constructs strict fixture, imported, and model-generated envelopes and rehydrates after JSON", () => {
    for (const kind of ["fixture", "imported", "model_generated"] as const) {
      const envelope = envelopeForProducer(kind);
      const roundTripped = hydrateProposalEnvelope(
        JSON.parse(JSON.stringify(envelope)),
      );

      assert.deepEqual(roundTripped, envelope);
      assert.equal(envelope.producer.kind, kind);
      assert.match(envelope.envelope_sha256, /^[a-f0-9]{64}$/);
      assert.equal(envelope.authority.proposal_only, true);
      assert.equal(envelope.authority.integrity_digest_is_approval, false);
      assert.equal(envelope.authority.authenticated_human_approval, false);
      assert.equal(envelope.authority.ratification, false);
      assert.equal(envelope.authority.durable_write_authority, false);
      assert.equal(envelope.fixture_binding === null, kind !== "fixture");
    }
  });

  test("adapts the exact current public-curated vocabulary into the sole canonical vocabulary", () => {
    const envelope = makePublicProposalEnvelope();

    assert.equal(envelope.producer.kind, "fixture");
    assert.equal(envelope.producer.trace_id, "public-curated-20260611a");
    assert.equal(envelope.scope.subject_id, "subject_acme_robotics");
    assert.equal(envelope.scope.purpose, "candidate_validation");
    assert.deepEqual(Object.keys(envelope.proposal_content.excerpts[0]!), [
      "id",
      "source_id",
      "text",
    ]);
    assert.deepEqual(Object.keys(envelope.proposal_content.claims[0]!), [
      "id",
      "type",
      "text",
      "subject",
      "confidence",
      "excerpt_ids",
    ]);
    assert.equal(envelope.fixture_binding?.authenticated_human_approval, false);
    assert.match(envelope.fixture_binding?.fixture_content_sha256 ?? "", /^[a-f0-9]{64}$/);
  });

  test("exports and enforces a conservative bounded lifetime", () => {
    assert.equal(PROPOSAL_ENVELOPE_MAX_LIFETIME_MS, 86_400_000);
    const core = coreFromEnvelope();
    core.expires_at = "2026-06-12T00:00:00.001Z";
    assert.throws(() => createProposalEnvelope(core), /lifetime.*maximum/);
  });

  test("requires one canonical timestamp spelling and downstream-safe producer trace length", () => {
    const nonCanonicalTimestamp = coreFromEnvelope();
    nonCanonicalTimestamp.created_at = "2026-06-11T00:00:00.000Z";
    assert.throws(
      () => createProposalEnvelope(nonCanonicalTimestamp),
      /must be canonical UTC/,
    );

    const longestAccepted = coreFromEnvelope();
    longestAccepted.producer.trace_id = "a".repeat(121);
    assert.equal(createProposalEnvelope(longestAccepted).producer.trace_id.length, 121);

    const downstreamUnsafe = coreFromEnvelope();
    downstreamUnsafe.producer.trace_id = "a".repeat(122);
    assert.throws(
      () => createProposalEnvelope(downstreamUnsafe),
      /downstream safe-id bounds/,
    );
  });

  test("rejects extra, legacy, missing-version, missing-digest, and missing-binding shapes", () => {
    const valid = clone(makePublicProposalEnvelope()) as unknown as Record<string, unknown>;
    const variants: Record<string, unknown>[] = [];

    variants.push({ ...valid, status: "approved" });
    const legacy: Record<string, unknown> = { ...valid, schema_version: "proposal.v0" };
    delete legacy.version;
    variants.push(legacy);
    const missingVersion = { ...valid };
    delete missingVersion.version;
    variants.push(missingVersion);
    const missingDigest = { ...valid };
    delete missingDigest.envelope_sha256;
    variants.push(missingDigest);
    const missingBinding = { ...valid, fixture_binding: null };
    variants.push(missingBinding);

    for (const variant of variants) {
      assert.throws(() => hydrateProposalEnvelope(variant), ProposalEnvelopeBoundaryError);
    }
  });

  test("rejects Proxy/accessor input without executing attacker code", () => {
    let trapCalls = 0;
    const proxy = new Proxy(clone(makePublicProposalEnvelope()), {
      get(target, property, receiver) {
        trapCalls += 1;
        return Reflect.get(target, property, receiver);
      },
      ownKeys(target) {
        trapCalls += 1;
        return Reflect.ownKeys(target);
      },
    });
    assert.throws(() => hydrateProposalEnvelope(proxy), ProposalEnvelopeBoundaryError);
    assert.equal(trapCalls, 0);

    let getterCalls = 0;
    const accessor = clone(makePublicProposalEnvelope()) as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "producer", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return { kind: "fixture", trace_id: "hostile" };
      },
    });
    assert.throws(() => hydrateProposalEnvelope(accessor), ProposalEnvelopeBoundaryError);
    assert.equal(getterCalls, 0);
  });

  test("rejects sparse and oversized arrays before trusting their elements", () => {
    const sparse = coreFromEnvelope();
    const sparseExcerpts = clone(sparse.proposal_content.excerpts) as unknown[];
    sparseExcerpts.length += 1;
    sparse.proposal_content.excerpts = sparseExcerpts as never;
    assert.throws(() => createProposalEnvelope(sparse), /dense|array/);

    const oversized = coreFromEnvelope();
    oversized.proposal_content.claims = Array.from(
      { length: PROPOSAL_ENVELOPE_MAX_RECORDS_PER_KIND + 1 },
      () => clone(oversized.proposal_content.claims[0]!),
    );
    assert.throws(() => createProposalEnvelope(oversized), /array bound|dense-array/);
  });

  test("rejects malformed Unicode before hashing", () => {
    const core = coreFromEnvelope();
    core.proposal_content.claims[0]!.text += "\ud800";
    assert.throws(() => createProposalEnvelope(core), /Unicode scalar values/);
  });

  test("snapshots and freezes construction input, then detects serialized mutation", () => {
    const core = coreFromEnvelope();
    const envelope = createProposalEnvelope(core);
    const originalText = envelope.proposal_content.claims[0]!.text;

    core.proposal_content.claims[0]!.text = "Mutated after construction";
    assert.equal(envelope.proposal_content.claims[0]!.text, originalText);
    assert.equal(Object.isFrozen(envelope), true);
    assert.equal(Object.isFrozen(envelope.proposal_content.claims[0]), true);
    assert.throws(() => {
      (envelope.authority as { ratification: boolean }).ratification = true;
    }, TypeError);

    const serialized = clone(envelope) as any;
    serialized.proposal_content.claims[0]!.text = "Mutated after serialization";
    assert.throws(() => hydrateProposalEnvelope(serialized), /integrity digest mismatch/);
  });

  test("rejects unsafe/duplicate ids and unresolved or duplicate topology references", () => {
    const cases: Array<(core: any) => void> = [
      (core) => {
        core.proposal_content.sources.push(clone(core.proposal_content.sources[0]));
      },
      (core) => {
        core.proposal_content.excerpts[0]!.id = "../../unsafe";
      },
      (core) => {
        core.proposal_content.excerpts[1]!.id = core.proposal_content.excerpts[0]!.id;
      },
      (core) => {
        core.proposal_content.excerpts[0]!.source_id = "src_missing";
      },
      (core) => {
        core.proposal_content.claims[0]!.excerpt_ids = ["missing-excerpt"];
      },
      (core) => {
        const id = core.proposal_content.claims[0]!.excerpt_ids[0]!;
        core.proposal_content.claims[0]!.excerpt_ids = [id, id];
      },
      (core) => {
        core.proposal_content.claims[1]!.id = core.proposal_content.claims[0]!.id;
      },
      (core) => {
        core.proposal_content.account_objects[0]!.claim_ids = ["missing-claim"];
      },
      (core) => {
        const id = core.proposal_content.account_objects[0]!.claim_ids[0]!;
        core.proposal_content.account_objects[0]!.claim_ids = [id, id];
      },
      (core) => {
        core.proposal_content.account_objects.push(
          clone(core.proposal_content.account_objects[0]),
        );
      },
    ];

    for (const mutate of cases) {
      const core = coreFromEnvelope();
      mutate(core);
      assert.throws(
        () => createProposalEnvelope(core),
        /unsafe|duplicated|duplicate references|unresolved/,
      );
    }
  });

  test("rejects proposal attempts to inject accepted, verified, ratified, or authorization state", () => {
    for (const [section, key, value] of [
      ["excerpts", "validation_status", "accepted"],
      ["claims", "provenance_status", "verified"],
      ["account_objects", "ratified", true],
      ["account_objects", "durable_write_authority", true],
    ] as const) {
      const core = coreFromEnvelope() as unknown as Record<string, any>;
      core.proposal_content[section][0][key] = value;
      assert.throws(() => createProposalEnvelope(core), /fields must exactly match/);
    }

    const authority = coreFromEnvelope() as unknown as Record<string, any>;
    authority.authority.trusted_presentation_authority = true;
    assert.throws(() => createProposalEnvelope(authority), /non-authorizing/);
  });

  test("keeps fixture approval and source-custody/transformation assertions explicitly false", () => {
    const fixture = clone(makePublicProposalEnvelope()) as Record<string, any>;
    fixture.fixture_binding.authenticated_human_approval = true;
    assert.throws(() => hydrateProposalEnvelope(fixture), /not authenticated human approval/);

    for (const field of [
      "origin_content_sha256_proves_origin_custody",
      "transformation_manifest_sha256_resolves_transformation_record",
    ]) {
      const core = coreFromEnvelope() as unknown as Record<string, any>;
      core.source_assurances[field] = true;
      assert.throws(() => createProposalEnvelope(core), /assurances.*closed/);
    }
  });

  test("imported/model envelopes cannot fabricate fixture binding", () => {
    for (const kind of ["imported", "model_generated"] as const) {
      const core = coreFromEnvelope();
      core.producer = { kind, trace_id: `${kind}:trace` };
      assert.throws(() => createProposalEnvelope(core), /must not fabricate fixture binding/);
    }
  });

  test("the legacy adapter rejects partially accepted legacy input instead of canonizing it", () => {
    const input = loadPublicProposalInput() as unknown as Record<string, any>;
    input.proposed_claims[0].supporting_excerpt_proposal_ids = ["missing"];
    assert.throws(
      () =>
        adaptPublicCuratedMaterializationInputToProposalEnvelope(input as any, {
          subject_id: "subject_acme_robotics",
        }),
      /did not materialize completely/,
    );
  });

  test("the explicit public-curated adapter refuses non-public/private legacy origins", () => {
    const input = loadPublicProposalInput() as unknown as Record<string, any>;
    input.context.origin = "private-fresh-route-proof";
    assert.throws(
      () =>
        adaptPublicCuratedMaterializationInputToProposalEnvelope(input as any, {
          subject_id: "subject_acme_robotics",
        }),
      /public-curated materialization origin only/,
    );
  });

  test("the explicit adapter normalizes strict-array failures to its envelope boundary", () => {
    const input = loadPublicProposalInput() as unknown as Record<string, any>;
    const sparseSources = clone(input.public_sources) as unknown[];
    sparseSources.length += 1;
    input.public_sources = sparseSources;
    assert.throws(
      () =>
        adaptPublicCuratedMaterializationInputToProposalEnvelope(input as any, {
          subject_id: "subject_acme_robotics",
        }),
      ProposalEnvelopeBoundaryError,
    );
  });
});
