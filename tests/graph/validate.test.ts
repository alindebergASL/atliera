// Adversarial validator tests.
//
// Each test starts from a valid baseline and breaks exactly one rule so
// the failure code under test is unambiguous. The valid baseline test
// runs first and acts as a smoke test that the baseline really is valid.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateGraphBundle } from "../../src/graph/validate.ts";
import type { ValidationReport } from "../../src/graph/report.ts";
import type {
  GraphBundle,
  LensOutput,
} from "../../src/graph/types.ts";
import { clone, makeValidBundle } from "../fixtures/valid-graph.ts";

function run(
  bundle: GraphBundle,
  lenses?: LensOutput[],
): ValidationReport {
  return validateGraphBundle(bundle, { mode: "fixture", lenses });
}

function codes(report: ValidationReport): string[] {
  return report.hard_failures.map((f) => f.code);
}

function makeEmptyBundle(): GraphBundle {
  return {
    sources: [],
    excerpts: [],
    claims: [],
    claim_evidence: [],
    account_objects: [],
    account_object_claims: [],
    research_runs: [],
    run_artifacts: [],
    audit_events: [],
  };
}

function relabelAccountBearingField(
  bundle: GraphBundle,
  field: "team_id" | "account_id",
  value: string,
): void {
  for (const record of bundle.sources) record[field] = value;
  for (const record of bundle.claims) record[field] = value;
  for (const record of bundle.account_objects) record[field] = value;
  for (const record of bundle.research_runs) record[field] = value;
}

describe("validateGraphBundle — baseline", () => {
  it("accepts the valid baseline bundle", () => {
    const report = run(makeValidBundle());
    assert.equal(
      report.ok,
      true,
      "baseline should validate; got: " + JSON.stringify(report.hard_failures),
    );
    assert.deepEqual(report.hard_failures, []);
    assert.equal(report.metrics.total_sources, 1);
    assert.equal(report.metrics.accepted_excerpts, 1);
    assert.equal(report.metrics.verified_claims, 1);
    assert.equal(report.metrics.verified_account_objects, 1);
  });
});

describe("validateGraphBundle — invented IDs", () => {
  it("rejects an invented SourceDocument id referenced by an excerpt", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.source_document_id = "src_does_not_exist";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invented_source_document_id"));
  });

  it("rejects an invented EvidenceExcerpt id referenced by claim_evidence", () => {
    const b = clone(makeValidBundle());
    b.claim_evidence[0]!.evidence_excerpt_id = "exc_phantom";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invented_evidence_excerpt_id"));
  });

  it("rejects an invented Claim id referenced by claim_evidence", () => {
    const b = clone(makeValidBundle());
    b.claim_evidence[0]!.claim_id = "clm_phantom";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invented_claim_id"));
  });

  it("rejects an invented Claim id referenced by account_object_claim", () => {
    const b = clone(makeValidBundle());
    b.account_object_claims[0]!.claim_id = "clm_phantom";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invented_claim_id"));
  });

  it("rejects an invented AccountObject id referenced by account_object_claim", () => {
    const b = clone(makeValidBundle());
    b.account_object_claims[0]!.account_object_id = "obj_phantom";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invented_account_object_id"));
  });

  it("rejects ids with the wrong record-kind prefix (smuggled edge id)", () => {
    const b = clone(makeValidBundle());
    // Point a claim_evidence row at an id that is well-formed but uses
    // the wrong prefix — this represents a model swapping kinds.
    b.claim_evidence[0]!.claim_id = "obj_acme_signal_launch";
    const report = run(b);
    assert.equal(report.ok, false);
    const cs = codes(report);
    assert.ok(
      cs.includes("dangling_reference") || cs.includes("invented_claim_id"),
      "should flag wrong-prefix as dangling/invented",
    );
  });

  it("rejects malformed ids outright", () => {
    const b = clone(makeValidBundle());
    b.claims[0]!.id = "not a real id at all!";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invalid_id_format"));
  });
});

describe("validateGraphBundle — dangling references", () => {
  it("flags both invented + dangling when an excerpt points at a wrong-kind source id", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.source_document_id = "clm_acme_launch";
    const report = run(b);
    assert.equal(report.ok, false);
    const cs = codes(report);
    assert.ok(cs.includes("invented_source_document_id"));
    assert.ok(cs.includes("dangling_reference"));
  });

  it("rejects a RunArtifact whose ResearchRun target is missing", () => {
    const b = clone(makeValidBundle());
    b.run_artifacts[0]!.research_run_id = "run_missing";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invented_research_run_id"));
  });
});

describe("validateGraphBundle — subject ownership", () => {
  for (const [label, value] of [
    ["blank", ""],
    ["whitespace-only", " \t\n"],
  ] as const) {
    for (const field of ["team_id", "account_id"] as const) {
      it(`rejects coherently ${label} intrinsic account-bearing ${field} values without an explicit subject`, () => {
        const b = clone(makeValidBundle());
        relabelAccountBearingField(b, field, value);
        if (field === "team_id") {
          for (const audit of b.audit_events) audit.team_id = value;
        }

        const report = run(b);
        const intrinsicFailures = report.hard_failures.filter(
          (failure) =>
            failure.code === "subject_scope_mismatch" &&
            failure.field === field &&
            failure.record_kind !== "audit_event",
        );

        assert.equal(report.ok, false);
        assert.deepEqual(
          intrinsicFailures.map((failure) => ({
            record_kind: failure.record_kind,
            record_id: failure.record_id,
            field: failure.field,
          })),
          [
            {
              record_kind: "source_document",
              record_id: b.sources[0]!.id,
              field,
            },
            {
              record_kind: "claim",
              record_id: b.claims[0]!.id,
              field,
            },
            {
              record_kind: "account_object",
              record_id: b.account_objects[0]!.id,
              field,
            },
            {
              record_kind: "research_run",
              record_id: b.research_runs[0]!.id,
              field,
            },
          ],
        );
      });
    }

    it(`rejects an intrinsic ${label} audit team without an explicit subject`, () => {
      const b = makeEmptyBundle();
      b.audit_events = clone(makeValidBundle()).audit_events;
      b.audit_events[0]!.team_id = value;

      const report = run(b);

      assert.equal(report.ok, false);
      assert.deepEqual(report.hard_failures, [
        {
          code: "subject_scope_mismatch",
          message: `audit_event ${b.audit_events[0]!.id}.team_id must contain at least one non-whitespace character`,
          record_kind: "audit_event",
          record_id: b.audit_events[0]!.id,
          field: "team_id",
        },
      ]);
    });
  }

  it("rejects cross-account ClaimEvidence laundering", () => {
    const b = clone(makeValidBundle());
    b.sources[0]!.account_id = "acc_other";

    const report = run(b);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("relationship_subject_mismatch"));
  });

  it("rejects cross-account AccountObjectClaim laundering", () => {
    const b = clone(makeValidBundle());
    b.account_objects[0]!.account_id = "acc_other";

    const report = run(b);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("relationship_subject_mismatch"));
  });

  it("rejects disconnected cross-team bundle contamination", () => {
    const b = clone(makeValidBundle());
    b.research_runs.push({
      ...b.research_runs[0]!,
      id: "run_other_team",
      team_id: "team_other",
      account_id: "acc_other",
    });

    const report = run(b);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("bundle_team_mismatch"));
  });

  it("enforces every account- and team-bearing record against an explicit subject scope", () => {
    const b = clone(makeValidBundle());
    b.research_runs[0]!.account_id = "acc_other";

    const report = validateGraphBundle(b, {
      mode: "fixture",
      subject: {
        team_id: "team_atliera_lab",
        account_id: "acc_acme_robotics",
      },
    });

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("subject_scope_mismatch"));
  });

  for (const field of ["team_id", "account_id"] as const) {
    for (const authority of ["", " \t\n"]) {
      it(`rejects ${authority === "" ? "blank" : "whitespace-only"} explicit ${field} authority on an empty bundle`, () => {
        const subject = {
          team_id: "team_atliera_lab",
          account_id: "acc_acme_robotics",
        };
        subject[field] = authority;

        const report = validateGraphBundle(makeEmptyBundle(), {
          mode: "fixture",
          subject,
        });

        assert.equal(report.ok, false);
        assert.deepEqual(codes(report), ["subject_scope_mismatch"]);
        assert.equal(report.hard_failures[0]!.field, field);
      });
    }
  }

  it("rejects an audit team mismatch when the bundle team is unambiguous", () => {
    const b = clone(makeValidBundle());
    b.audit_events[0]!.team_id = "team_other";

    const report = run(b);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("bundle_team_mismatch"));
  });

  it("rejects audit events from multiple teams when no account-bearing team exists", () => {
    const b = clone(makeValidBundle());
    b.sources = [];
    b.excerpts = [];
    b.claims = [];
    b.claim_evidence = [];
    b.account_objects = [];
    b.account_object_claims = [];
    b.research_runs = [];
    b.run_artifacts = [];
    b.audit_events.push({
      ...b.audit_events[0]!,
      id: "aud_other_team",
      team_id: "team_other",
    });

    const report = run(b);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("bundle_team_mismatch"));
  });

  it("rejects an audit event outside an explicit subject scope", () => {
    const b = clone(makeValidBundle());
    b.audit_events[0]!.team_id = "team_other";

    const report = validateGraphBundle(b, {
      mode: "fixture",
      subject: {
        team_id: "team_atliera_lab",
        account_id: "acc_acme_robotics",
      },
    });

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("subject_scope_mismatch"));
  });

  it("preserves isolated multi-account raw research-run bundles", () => {
    const b = clone(makeValidBundle());
    b.research_runs.push({
      ...b.research_runs[0]!,
      id: "run_other_account",
      account_id: "acc_other",
    });

    const report = run(b);

    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
  });

  it("does not require a ResearchRun record when no RunArtifact references one", () => {
    const b = clone(makeValidBundle());
    b.research_runs = [];
    b.run_artifacts = [];

    const report = run(b);

    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
  });
});

describe("validateGraphBundle — excerpt text integrity", () => {
  it("rejects an accepted excerpt whose text is not in the source", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.text = "Acme Robotics secretly acquired Beta Logistics.";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("excerpt_text_not_found_in_source"));
  });

  it("accepts excerpts that differ only in whitespace/quote normalisation", () => {
    const b = clone(makeValidBundle());
    // Curly quotes and double spaces should still match after normalisation.
    b.excerpts[0]!.text =
      "Acme  Robotics announced a new logistics platform on March 1, 2026.";
    const report = run(b);
    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
  });

  it("rejects a paraphrase that is marked accepted", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.kind = "paraphrase";
    // Even if the paraphrase happens to overlap the source text, it
    // must not be accepted; it should remain a proposal or be rejected.
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("accepted_paraphrase"));
  });
});

describe("validateGraphBundle — accepted excerpt span validation", () => {
  it("rejects an accepted excerpt whose char_end runs past the source", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.char_end = b.sources[0]!.raw_text.length + 50;
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("excerpt_span_out_of_bounds"));
  });

  it("rejects an accepted excerpt with a flipped span (char_end <= char_start)", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.char_start = 30;
    b.excerpts[0]!.char_end = 10;
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("excerpt_span_out_of_bounds"));
  });

  it("rejects an accepted excerpt with a zero-length span", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.char_start = 5;
    b.excerpts[0]!.char_end = 5;
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("excerpt_span_out_of_bounds"));
  });

  it("rejects an accepted excerpt with a negative char_start", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.char_start = -1;
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("excerpt_span_out_of_bounds"));
  });

  it("rejects an accepted excerpt with a non-integer char_start", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.char_start = 0.5;
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("excerpt_span_out_of_bounds"));
  });

  it("rejects an accepted excerpt whose declared span points at a different substring of the source", () => {
    // The excerpt text remains a real, literal substring of the source,
    // but the declared char_start/char_end point at a different region.
    // This is the canonical "right citation, wrong offset" attack.
    const b = clone(makeValidBundle());
    const src = b.sources[0]!.raw_text;
    const text = "logistics platform";
    const realStart = src.indexOf(text);
    assert.ok(realStart > 0, "test setup: expected substring");
    b.excerpts[0]!.text = text;
    // Declare offsets that point somewhere else in the source.
    b.excerpts[0]!.char_start = 0;
    b.excerpts[0]!.char_end = text.length;
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("excerpt_span_text_mismatch"));
  });

  it("accepts an excerpt whose declared span correctly indexes the source", () => {
    const b = clone(makeValidBundle());
    const src = b.sources[0]!.raw_text;
    const text = "logistics platform";
    const realStart = src.indexOf(text);
    b.excerpts[0]!.text = text;
    b.excerpts[0]!.char_start = realStart;
    b.excerpts[0]!.char_end = realStart + text.length;
    const report = run(b);
    assert.equal(
      report.ok,
      true,
      "expected ok, got: " + JSON.stringify(report.hard_failures),
    );
  });

  it("does not enforce span rules on proposed or rejected excerpts", () => {
    const b = clone(makeValidBundle());
    b.excerpts[0]!.validation_status = "proposed";
    b.excerpts[0]!.char_start = -999;
    b.excerpts[0]!.char_end = -1;
    // Downgrade the verified claim so the absent evidence doesn't trip a
    // different invariant.
    b.claims[0]!.provenance_status = "unverified";
    b.claims[0]!.confidence = "low";
    b.account_objects[0]!.provenance_status = "unverified";
    const report = run(b);
    assert.equal(
      report.ok,
      true,
      "expected ok for proposed excerpt, got: " +
        JSON.stringify(report.hard_failures),
    );
  });
});

describe("validateGraphBundle — verified records need evidence", () => {
  it("rejects a verified/high-confidence claim with no accepted supporting excerpt", () => {
    const b = clone(makeValidBundle());
    // Mark all excerpts as proposed, so the supporting excerpt is no
    // longer accepted.
    for (const e of b.excerpts) e.validation_status = "proposed";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("verified_claim_without_evidence"));
    assert.ok(codes(report).includes("verified_object_without_supporting_claim"));
  });

  it("rejects a verified AccountObject linked only to an unverified, unsupported claim", () => {
    const b = clone(makeValidBundle());
    // Downgrade the claim and drop its supporting evidence.
    b.claims[0]!.provenance_status = "unverified";
    b.claims[0]!.confidence = "low";
    b.claim_evidence = [];
    // Object is still marked verified.
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("verified_object_without_supporting_claim"));
  });

  it("keeps a context-only object/claim edge as valid history without treating it as support", () => {
    const b = clone(makeValidBundle());
    b.account_objects[0]!.provenance_status = "unverified";
    b.account_object_claims[0]!.relationship = "context";

    const report = run(b);

    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
    assert.equal(b.account_object_claims[0]!.relationship, "context");
    assert.equal(report.metrics.verified_claims, 1);
    assert.equal(report.metrics.verified_account_objects, 0);
  });

  it("does not accept a context-only claim link as support for a verified object", () => {
    const b = clone(makeValidBundle());
    b.account_object_claims[0]!.relationship = "context";

    const report = run(b);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("verified_object_without_supporting_claim"));
    assert.equal(report.metrics.verified_claims, 1);
    assert.equal(report.metrics.verified_account_objects, 0);
  });

  for (const sourceStatus of ["stale", "unavailable", "rejected"] as const) {
    it(`keeps accepted support on a ${sourceStatus} source structurally valid but not current`, () => {
      const b = clone(makeValidBundle());
      b.sources[0]!.status = sourceStatus;

      const report = run(b);

      assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
      assert.deepEqual(report.hard_failures, []);
      assert.equal(report.metrics.accepted_excerpts, 0);
      assert.equal(report.metrics.verified_claims, 0);
      assert.equal(report.metrics.verified_account_objects, 0);
    });
  }

  for (
    const claimStatus of [
      "contradicted",
      "stale",
      "rejected",
      "superseded",
    ] as const
  ) {
    it(`keeps a structurally supported ${claimStatus} claim as history but not current`, () => {
      const b = clone(makeValidBundle());
      b.claims[0]!.status = claimStatus;

      const report = run(b);

      assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
      assert.deepEqual(report.hard_failures, []);
      assert.equal(report.metrics.verified_claims, 0);
      assert.equal(report.metrics.verified_account_objects, 0);
    });
  }

  for (const provenanceStatus of ["stale", "unsupported"] as const) {
    it(`keeps an active ${provenanceStatus}-provenance claim as structurally supported history but not current support`, () => {
      const b = clone(makeValidBundle());
      b.claims[0]!.provenance_status = provenanceStatus;

      const report = run(b);

      assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
      assert.deepEqual(report.hard_failures, []);
      assert.equal(report.metrics.verified_claims, 0);
      assert.equal(report.metrics.verified_account_objects, 0);
    });
  }

  for (const objectStatus of ["rejected", "superseded", "stale"] as const) {
    it(`keeps a structurally supported ${objectStatus} object as history but not current`, () => {
      const b = clone(makeValidBundle());
      b.account_objects[0]!.status = objectStatus;

      const report = run(b);

      assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
      assert.deepEqual(report.hard_failures, []);
      assert.equal(report.metrics.verified_account_objects, 0);
    });
  }
});

describe("validateGraphBundle — lens output safety", () => {
  it("rejects a lens item marked verified with no graph backing", () => {
    const b = makeValidBundle();
    const lenses: LensOutput[] = [
      {
        lens: "signals",
        items: [
          {
            label: "Imminent acquisition (model speculation)",
            account_object_id: null,
            claim_id: null,
            status: "verified",
          },
        ],
      },
    ];
    const report = run(b, lenses);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("lens_unsupported_prose_marked_verified"));
  });

  it("accepts a lens item marked verified that points at a verified object", () => {
    const b = makeValidBundle();
    const lenses: LensOutput[] = [
      {
        lens: "signals",
        items: [
          {
            label: "New logistics platform launch",
            account_object_id: "obj_acme_signal_launch",
            claim_id: null,
            status: "verified",
          },
        ],
      },
    ];
    const report = run(b, lenses);
    assert.equal(
      report.ok,
      true,
      "lens-backed verified item should validate: " +
        JSON.stringify(report.hard_failures),
    );
  });

  it("rejects a verified lens item backed only by an inactive-source object and claim", () => {
    const b = clone(makeValidBundle());
    b.sources[0]!.status = "stale";
    const lenses: LensOutput[] = [
      {
        lens: "signals",
        items: [
          {
            label: "New logistics platform launch",
            account_object_id: "obj_acme_signal_launch",
            claim_id: "clm_acme_launch",
            status: "verified",
          },
        ],
      },
    ];

    const report = run(b, lenses);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("lens_unsupported_prose_marked_verified"));
  });

  it("does not flag inferred/note items even without backing", () => {
    const b = makeValidBundle();
    const lenses: LensOutput[] = [
      {
        lens: "plays",
        items: [
          {
            label: "Possible expansion angle",
            account_object_id: null,
            claim_id: null,
            status: "inferred",
          },
        ],
      },
    ];
    const report = run(b, lenses);
    assert.equal(report.ok, true);
  });
});

describe("validateGraphBundle — duplicates", () => {
  it("rejects duplicate ids within a kind", () => {
    const b = clone(makeValidBundle());
    b.sources.push({ ...b.sources[0]! });
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("duplicate_id"));
  });

  for (const kind of ["research_runs", "run_artifacts", "audit_events"] as const) {
    it(`rejects duplicate ids in ${kind}`, () => {
      const b = clone(makeValidBundle());
      b[kind].push({ ...b[kind][0]! } as never);

      const report = run(b);

      assert.equal(report.ok, false);
      assert.ok(codes(report).includes("duplicate_id"));
    });
  }
});
