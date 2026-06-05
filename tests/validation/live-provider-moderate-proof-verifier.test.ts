import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  convertLiveProviderProofToGraphBundleCandidate,
  verifyLiveProviderModerateProofPayload,
} from "../../src/validation/live-provider-moderate-proof-verifier.js";
import { validateGraphBundle } from "../../src/graph/validate.js";

const fixturePath = join(import.meta.dirname, "..", "fixtures", "live-provider-proof", "moderate-valid.json");
const fixtureText = readFileSync(fixturePath, "utf8");

describe("live provider moderate proof verifier", () => {
  test("accepts deterministic synthetic proof fixture and reports sanitized counts", () => {
    const report = verifyLiveProviderModerateProofPayload(fixtureText);

    assert.equal(report.ok, true);
    assert.equal(report.strict_json_ok, true);
    assert.equal(report.schema_version_ok, true);
    assert.equal(report.provider_path, "hermes-openai-codex-operator");
    assert.equal(report.model_label, "gpt-5.5");
    assert.deepEqual(report.counts, { accounts: 3, excerpts: 6, claims: 6, account_objects: 9 });
    assert.equal(report.citation_links_ok, true);
    assert.equal(report.per_account_lens_coverage_ok, true);
    assert.equal(report.boundary_ok, true);
    assert.equal(report.raw_evidence_committed, false);
    assert.equal(report.provider_payload_committed, false);
    assert.equal(report.model_output_committed, false);
    assert.equal(report.request_identifier_committed, false);
    assert.deepEqual(report.validation_errors, []);
  });

  test("rejects shape drift, cross-account citations, missing lens coverage, and broadened boundary flags", () => {
    const base = JSON.parse(fixtureText);
    assert.equal(verifyLiveProviderModerateProofPayload(JSON.stringify({ ...base, extra: true })).ok, false);

    const crossAccount = structuredClone(base);
    crossAccount.claims[0].supporting_excerpt_ids = ["ex_b_1"];
    assert.deepEqual(verifyLiveProviderModerateProofPayload(JSON.stringify(crossAccount)).validation_errors, ["claim_cross_account_excerpt"]);

    const missingLens = structuredClone(base);
    missingLens.account_objects = missingLens.account_objects.filter((item: { object_type: string }) => item.object_type !== "play");
    const missingLensReport = verifyLiveProviderModerateProofPayload(JSON.stringify(missingLens));
    assert.equal(missingLensReport.ok, false);
    assert.equal(missingLensReport.per_account_lens_coverage_ok, false);

    const broadened = structuredClone(base);
    broadened.boundary.graph_ingestion_performed = true;
    const broadenedReport = verifyLiveProviderModerateProofPayload(JSON.stringify(broadened));
    assert.equal(broadenedReport.ok, false);
    assert.equal(broadenedReport.boundary_ok, false);
  });

  test("fails closed for markdown fences and unsafe private-shaped text", () => {
    assert.equal(verifyLiveProviderModerateProofPayload(`\`\`\`json\n${fixtureText}\n\`\`\``).ok, false);

    const unsafe = JSON.parse(fixtureText);
    unsafe.excerpts[0].text = "Synthetic account contains https://example.invalid/private";
    const unsafeReport = verifyLiveProviderModerateProofPayload(JSON.stringify(unsafe));
    assert.equal(unsafeReport.ok, false);
    assert.equal(unsafeReport.validation_errors.includes("unsafe_text"), true);
  });

  test("converts verified proof to a validation-only GraphBundle candidate without ingestion", () => {
    const proof = JSON.parse(fixtureText);
    const candidate = convertLiveProviderProofToGraphBundleCandidate(proof, {
      runId: "run_live_provider_moderate_fixture",
      teamId: "team_synthetic",
      observedAt: "2026-06-05T00:00:00.000Z",
      providerRef: "openai-codex",
      modelLabel: "gpt-5.5",
    });

    assert.equal(candidate.graph_ingestion_performed, false);
    assert.equal(candidate.production_writes_performed, false);
    assert.equal(candidate.bundle.sources.length, 3);
    assert.equal(candidate.bundle.excerpts.length, 6);
    assert.equal(candidate.bundle.claims.length, 6);
    assert.equal(candidate.bundle.claim_evidence.length, 6);
    assert.equal(candidate.bundle.account_objects.length, 9);
    assert.equal(candidate.bundle.account_object_claims.length, 12);
    assert.equal(candidate.lenses.length, 3);

    const report = validateGraphBundle(candidate.bundle, { mode: "validation", lenses: [...candidate.lenses] });
    assert.equal(report.ok, true);
    assert.equal(report.metrics.total_excerpts, 6);
    assert.equal(report.metrics.accepted_excerpts, 6);
    assert.equal(report.metrics.total_claims, 6);
    assert.equal(report.metrics.total_account_objects, 9);
  });
});
