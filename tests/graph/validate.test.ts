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

function targetAuditEventAtItself(bundle: GraphBundle): void {
  for (const audit of bundle.audit_events) {
    audit.target_type = "audit_event";
    audit.target_id = audit.id;
  }
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

const UNICODE_WHITE_SPACE_CODE_POINTS = [
  ["U+0009", "\u0009"],
  ["U+000A", "\u000A"],
  ["U+000B", "\u000B"],
  ["U+000C", "\u000C"],
  ["U+000D", "\u000D"],
  ["U+0020", "\u0020"],
  ["U+0085", "\u0085"],
  ["U+00A0", "\u00A0"],
  ["U+1680", "\u1680"],
  ["U+2000", "\u2000"],
  ["U+2001", "\u2001"],
  ["U+2002", "\u2002"],
  ["U+2003", "\u2003"],
  ["U+2004", "\u2004"],
  ["U+2005", "\u2005"],
  ["U+2006", "\u2006"],
  ["U+2007", "\u2007"],
  ["U+2008", "\u2008"],
  ["U+2009", "\u2009"],
  ["U+200A", "\u200A"],
  ["U+2028", "\u2028"],
  ["U+2029", "\u2029"],
  ["U+202F", "\u202F"],
  ["U+205F", "\u205F"],
  ["U+3000", "\u3000"],
] as const;

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

describe("validateGraphBundle — audit target references", () => {
  const localTargets = [
    ["source_document", "src_acme_press_001"],
    ["evidence_excerpt", "exc_acme_launch_001"],
    ["claim", "clm_acme_launch"],
    ["claim_evidence", "cev_acme_launch_001"],
    ["account_object", "obj_acme_signal_launch"],
    ["account_object_claim", "oclm_acme_signal_launch_001"],
    ["research_run", "run_acme_phase1_001"],
    ["run_artifact", "art_acme_phase1_report"],
    ["audit_event", "aud_acme_phase1_001"],
  ] as const;

  for (const [targetType, targetId] of localTargets) {
    it(`resolves local ${targetType} targets in the matching collection`, () => {
      const b = clone(makeValidBundle());
      b.audit_events[0]!.target_type = targetType;
      b.audit_events[0]!.target_id = targetId;

      const report = run(b);

      assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
    });
  }

  for (const [label, targetId] of [
    ["missing", "src_missing"],
    ["cross-kind", "clm_acme_launch"],
  ] as const) {
    it(`rejects a ${label} local audit target`, () => {
      const b = clone(makeValidBundle());
      b.audit_events[0]!.target_type = "source_document";
      b.audit_events[0]!.target_id = targetId;

      const report = run(b);

      assert.equal(report.ok, false);
      assert.ok(codes(report).includes("unresolved_local_audit_target"));
    });
  }

  it("rejects an arbitrary unknown audit target type", () => {
    const b = clone(makeValidBundle());
    b.audit_events[0]!.target_type = "external_record";
    b.audit_events[0]!.target_id = "ext_arbitrary";

    const report = run(b);

    assert.equal(report.ok, false);
    assert.deepEqual(report.hard_failures.filter((failure) =>
      failure.code === "unsupported_audit_target_type"
    ), [{
      code: "unsupported_audit_target_type",
      message: "audit_event aud_acme_phase1_001 has unsupported target_type external_record",
      record_kind: "audit_event",
      record_id: "aud_acme_phase1_001",
      field: "target_type",
    }]);
  });

  function makeProposalSetBundle(proposalSetId = "m5a-proposal-set-001"): GraphBundle {
    const b = clone(makeValidBundle());
    const run = b.research_runs[0]!;
    b.audit_events[0] = {
      ...b.audit_events[0]!,
      id: `aud_m5a_${proposalSetId}`,
      team_id: run.team_id,
      event_type: "proposal_set.ratified",
      target_type: "proposal_set",
      target_id: proposalSetId,
      payload_json: { account_id: run.account_id },
    };
    b.run_artifacts[0] = {
      ...b.run_artifacts[0]!,
      id: `art_m5a_${proposalSetId}`,
      research_run_id: run.id,
      artifact_type: "m5a_curated_proposal_set_ratification",
      payload_json: {
        ...b.run_artifacts[0]!.payload_json,
        proposal_set_id: proposalSetId,
      },
    };
    return b;
  }

  it("accepts the legacy M5a proposal_set binding at its 60-character producer boundary", () => {
    const b = makeProposalSetBundle("p".repeat(60));

    const report = run(b);

    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
  });

  it("rejects an M5a proposal_set id at 61 characters", () => {
    const b = makeProposalSetBundle("p".repeat(61));
    b.audit_events[0]!.id = "aud_m5a_overlong_proposal_set";
    b.run_artifacts[0]!.id = "art_m5a_overlong_proposal_set";

    const report = run(b);

    assert.equal(report.ok, false);
    assert.ok(codes(report).includes("invalid_external_audit_target_binding"));
  });

  for (const [label, mutate] of [
    ["event type", (b: GraphBundle) => { b.audit_events[0]!.event_type = "proposal_set.created"; }],
    ["artifact binding", (b: GraphBundle) => { b.run_artifacts[0]!.payload_json.proposal_set_id = "other-set"; }],
    ["missing account binding", (b: GraphBundle) => { delete b.audit_events[0]!.payload_json.account_id; }],
    ["mismatched account binding", (b: GraphBundle) => { b.audit_events[0]!.payload_json.account_id = "acc_other"; }],
    ["artifact type", (b: GraphBundle) => { b.run_artifacts[0]!.artifact_type = "research_report"; }],
  ] as const) {
    it(`rejects a broken M5a proposal_set ${label}`, () => {
      const b = makeProposalSetBundle();
      mutate(b);

      const report = run(b);

      assert.equal(report.ok, false);
      assert.ok(codes(report).includes("invalid_external_audit_target_binding"));
    });
  }

  function makeRejectedCandidateBundle(): GraphBundle {
    const b = clone(makeValidBundle());
    b.audit_events[0] = {
      ...b.audit_events[0]!,
      event_type: "claim.rejected",
      target_type: "account_object_candidate",
      target_id: "obj_fedex_rejected_candidate",
      payload_json: {
        disposition: "reject",
        reason_code: "not_material",
        owner_authorization_id: "m5b-owner-authorization",
        ratification_raw_sha256: "a".repeat(64),
        ratification_artifact_sha256: "b".repeat(64),
        review_packet_sha256: "c".repeat(64),
        candidate_content_sha256: "d".repeat(64),
        execution_commit: "e".repeat(40),
        execution_tree: "f".repeat(40),
        ratification_mode: "repository-native-one-shot-local-write",
      },
    };
    return b;
  }

  it("accepts the legacy M5b rejected account_object_candidate binding", () => {
    const report = run(makeRejectedCandidateBundle());

    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
  });

  for (const [label, mutate] of [
    ["event type", (b: GraphBundle) => { b.audit_events[0]!.event_type = "claim.ratified"; }],
    ["target kind", (b: GraphBundle) => { b.audit_events[0]!.target_id = "clm_acme_launch"; }],
    ["local collision", (b: GraphBundle) => { b.audit_events[0]!.target_id = "obj_acme_signal_launch"; }],
    ["disposition", (b: GraphBundle) => { b.audit_events[0]!.payload_json.disposition = "accept"; }],
    ["reason code", (b: GraphBundle) => { b.audit_events[0]!.payload_json.reason_code = " \t"; }],
    ["ratification binding", (b: GraphBundle) => { b.audit_events[0]!.payload_json.candidate_content_sha256 = "not-a-hash"; }],
  ] as const) {
    it(`rejects a broken M5b account_object_candidate ${label}`, () => {
      const b = makeRejectedCandidateBundle();
      mutate(b);

      const report = run(b);

      assert.equal(report.ok, false);
      assert.ok(codes(report).includes("invalid_external_audit_target_binding"));
    });
  }

  function makeRetentionBundle(): GraphBundle {
    const b = clone(makeValidBundle());
    b.audit_events[0] = {
      ...b.audit_events[0]!,
      actor_id: "reviewer_demo",
      event_type: "source.retention_decided",
      target_type: "source_custody_retention_draft",
      target_id: "m5b-fedex-source-retention-beyond-original-deadline",
      payload_json: {
        ratifier_id: "reviewer_demo",
        ratification_raw_sha256: "a".repeat(64),
        ratification_artifact_sha256: "b".repeat(64),
        review_packet_sha256: "c".repeat(64),
        retention_draft_id: "m5b-fedex-source-retention-beyond-original-deadline",
        deadline: "2026-08-13T18:41:11.277Z",
        disposition: "reject",
        outcome: "beyond-deadline-retention-not-authorized-external-custody-cleanup-required",
        original_custody_deleted: false,
        external_custody_cleanup_required: true,
      },
    };
    return b;
  }

  it("accepts the legacy M5b source_custody_retention_draft binding", () => {
    const report = run(makeRetentionBundle());

    assert.equal(report.ok, true, JSON.stringify(report.hard_failures));
  });

  for (const [label, mutate] of [
    ["event type", (b: GraphBundle) => { b.audit_events[0]!.event_type = "source.retention_proposed"; }],
    ["external target id", (b: GraphBundle) => { b.audit_events[0]!.target_id = "m5b-source-retention-draft"; }],
    ["target id echo", (b: GraphBundle) => { b.audit_events[0]!.payload_json.retention_draft_id = "other-draft"; }],
    ["actor binding", (b: GraphBundle) => { b.audit_events[0]!.payload_json.ratifier_id = "reviewer_other"; }],
    ["ratification raw hash", (b: GraphBundle) => { b.audit_events[0]!.payload_json.ratification_raw_sha256 = "A".repeat(64); }],
    ["ratification artifact hash", (b: GraphBundle) => { b.audit_events[0]!.payload_json.ratification_artifact_sha256 = "b".repeat(63); }],
    ["review packet hash", (b: GraphBundle) => { b.audit_events[0]!.payload_json.review_packet_sha256 = "not-a-hash"; }],
    ["deadline", (b: GraphBundle) => { b.audit_events[0]!.payload_json.deadline = "2026-13-13T18:41:11Z"; }],
    ["outcome consistency", (b: GraphBundle) => { b.audit_events[0]!.payload_json.outcome = "beyond-deadline-retention-approved"; }],
    ["deletion consistency", (b: GraphBundle) => { b.audit_events[0]!.payload_json.original_custody_deleted = true; }],
    ["cleanup consistency", (b: GraphBundle) => { b.audit_events[0]!.payload_json.external_custody_cleanup_required = false; }],
  ] as const) {
    it(`rejects a broken M5b retention ${label}`, () => {
      const b = makeRetentionBundle();
      mutate(b);

      const report = run(b);

      assert.equal(report.ok, false);
      assert.ok(codes(report).includes("invalid_external_audit_target_binding"));
    });
  }
});

describe("validateGraphBundle — subject ownership", () => {
  for (const [label, value] of [
    ["blank", ""],
    ["whitespace-only", " \t\n"],
    ["U+0085-only", "\u0085"],
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
      targetAuditEventAtItself(b);
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

  it("rejects U+FEFF-only intrinsic account-bearing team/account ownership without an explicit subject", () => {
    for (const field of ["team_id", "account_id"] as const) {
      const b = clone(makeValidBundle());
      relabelAccountBearingField(b, field, "\uFEFF");
      if (field === "team_id") {
        for (const audit of b.audit_events) audit.team_id = "\uFEFF";
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
        intrinsicFailures.map((failure) => failure.record_kind),
        ["source_document", "claim", "account_object", "research_run"],
      );
    }
  });

  it("rejects U+FEFF-only audit-event team ownership without an explicit subject", () => {
    const b = makeEmptyBundle();
    b.audit_events = clone(makeValidBundle()).audit_events;
    targetAuditEventAtItself(b);
    b.audit_events[0]!.team_id = "\uFEFF";

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
    for (const [label, authority] of [
      ["blank", ""],
      ["whitespace-only", " \t\n"],
      ["U+0085-only", "\u0085"],
    ] as const) {
      it(`rejects ${label} explicit ${field} authority on an empty bundle`, () => {
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

  it("rejects U+FEFF-only explicit SubjectScope team/account authority", () => {
    for (const field of ["team_id", "account_id"] as const) {
      const subject = {
        team_id: "team_atliera_lab",
        account_id: "acc_acme_robotics",
      };
      subject[field] = "\uFEFF";

      const report = validateGraphBundle(makeEmptyBundle(), {
        mode: "fixture",
        subject,
      });

      assert.equal(report.ok, false);
      assert.deepEqual(codes(report), ["subject_scope_mismatch"]);
      assert.equal(report.hard_failures[0]!.field, field);
    }
  });

  it("rejects every Unicode White_Space code point as intrinsic ownership without an explicit subject", () => {
    for (const [label, authority] of UNICODE_WHITE_SPACE_CODE_POINTS) {
      for (const field of ["team_id", "account_id"] as const) {
        const b = clone(makeValidBundle());
        relabelAccountBearingField(b, field, authority);
        if (field === "team_id") {
          for (const audit of b.audit_events) audit.team_id = authority;
        }

        const report = run(b);

        assert.equal(report.ok, false, `${label} intrinsic ${field}`);
        assert.ok(
          report.hard_failures.some(
            (failure) =>
              failure.code === "subject_scope_mismatch" &&
              failure.field === field &&
              failure.record_kind !== "audit_event",
          ),
          `${label} intrinsic ${field}`,
        );
      }

      const auditOnly = makeEmptyBundle();
      auditOnly.audit_events = clone(makeValidBundle()).audit_events;
      targetAuditEventAtItself(auditOnly);
      auditOnly.audit_events[0]!.team_id = authority;
      const auditReport = run(auditOnly);

      assert.equal(auditReport.ok, false, `${label} intrinsic audit team_id`);
      assert.deepEqual(
        auditReport.hard_failures.map((failure) => ({
          code: failure.code,
          record_kind: failure.record_kind,
          field: failure.field,
        })),
        [
          {
            code: "subject_scope_mismatch",
            record_kind: "audit_event",
            field: "team_id",
          },
        ],
        `${label} intrinsic audit team_id`,
      );
    }
  });

  it("accepts and preserves non-ASCII ownership identifiers with non-whitespace characters", () => {
    const b = clone(makeValidBundle());
    const teamId = "équipe_日本";
    const accountId = "cuenta_Ångström";
    relabelAccountBearingField(b, "team_id", teamId);
    relabelAccountBearingField(b, "account_id", accountId);
    for (const audit of b.audit_events) audit.team_id = teamId;

    const report = run(b);

    assert.equal(
      report.ok,
      true,
      "non-ASCII ownership should validate; got: " +
        JSON.stringify(report.hard_failures),
    );
    assert.equal(b.sources[0]!.team_id, teamId);
    assert.equal(b.sources[0]!.account_id, accountId);
  });

  it("accepts and preserves ownership identifiers containing U+FEFF plus non-whitespace characters", () => {
    const b = clone(makeValidBundle());
    const teamId = "\uFEFFteam_atliera_lab";
    const accountId = "acc_acme_robotics\uFEFF";
    relabelAccountBearingField(b, "team_id", teamId);
    relabelAccountBearingField(b, "account_id", accountId);
    for (const audit of b.audit_events) audit.team_id = teamId;

    const report = run(b);

    assert.equal(
      report.ok,
      true,
      "mixed U+FEFF ownership should validate; got: " +
        JSON.stringify(report.hard_failures),
    );
    assert.equal(b.sources[0]!.team_id, teamId);
    assert.equal(b.sources[0]!.account_id, accountId);
    assert.equal(b.audit_events[0]!.team_id, teamId);
  });

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
    targetAuditEventAtItself(b);

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
