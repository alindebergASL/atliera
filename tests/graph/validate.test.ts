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

describe("validateGraphBundle — verified records need evidence", () => {
  it("rejects a verified/high-confidence claim with no accepted supporting excerpt", () => {
    const b = clone(makeValidBundle());
    // Mark all excerpts as proposed, so the supporting excerpt is no
    // longer accepted.
    for (const e of b.excerpts) e.validation_status = "proposed";
    const report = run(b);
    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("verified_claim_without_evidence"));
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
});
