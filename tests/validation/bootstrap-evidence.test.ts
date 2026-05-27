import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import { verifyBootstrapValidationEvidence } from "../../src/validation/bootstrap-evidence.ts";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function fullPipelineSummary(overrides: Record<string, unknown> = {}): unknown {
  const summary = {
    ok: true,
    command: "package",
    manifest_path: "openrouter-owl-alpha-current-full-pipeline-20260527/manifest.json",
    graph_bundle_path: "openrouter-owl-alpha-current-full-pipeline-20260527/graph-bundle.json",
    quality_gate_report_path: "openrouter-owl-alpha-current-full-pipeline-20260527/quality-gate-report.json",
    model_provider_validation_report_path:
      "openrouter-owl-alpha-current-full-pipeline-20260527/model-provider-validation-report.json",
    agent_run_record_path: "openrouter-owl-alpha-current-full-pipeline-20260527/agent-run-record.json",
    summary: {
      schema_version: "atliera.full_pipeline_validation.v1",
      ok: true,
      run_slug: "openrouter-owl-alpha-current-full-pipeline-20260527",
      provider_validation: {
        ok: true,
        provider: "openrouter",
        model: "owl-alpha",
        operation: "graph.propose",
        idempotency_key: "run_owl_alpha_current_1779903845560_1",
        cost_ledger_status: "succeeded",
        observed_cost_usd: 0,
        check_failures: [],
      },
      quality_gate: {
        ok: true,
        status: "pass",
        reason_codes: [],
      },
      artifacts: {
        manifest_path: "openrouter-owl-alpha-current-full-pipeline-20260527/manifest.json",
        graph_bundle_path: "openrouter-owl-alpha-current-full-pipeline-20260527/graph-bundle.json",
        quality_gate_report_path: "openrouter-owl-alpha-current-full-pipeline-20260527/quality-gate-report.json",
        model_provider_validation_report_path:
          "openrouter-owl-alpha-current-full-pipeline-20260527/model-provider-validation-report.json",
        agent_run_record_path: "openrouter-owl-alpha-current-full-pipeline-20260527/agent-run-record.json",
      },
      safety: {
        live_provider_call: false,
        network: false,
        credentials_read: false,
      },
    },
  };
  return { ...summary, ...overrides };
}

function manifestText(overrides: Record<string, unknown> = {}): string {
  const manifest = {
    schema_version: "atliera.run_manifest.v1",
    run_slug: "openrouter-owl-alpha-current-full-pipeline-20260527",
    created_at: "2026-05-27T17:45:05.559Z",
    artifacts: [
      { artifact_type: "graph_bundle", path: "openrouter-owl-alpha-current-full-pipeline-20260527/graph-bundle.json" },
      {
        artifact_type: "quality_gate_report",
        path: "openrouter-owl-alpha-current-full-pipeline-20260527/quality-gate-report.json",
      },
      {
        artifact_type: "model_provider_validation_report",
        path: "openrouter-owl-alpha-current-full-pipeline-20260527/model-provider-validation-report.json",
      },
      {
        artifact_type: "agent_run_record",
        path: "openrouter-owl-alpha-current-full-pipeline-20260527/agent-run-record.json",
      },
    ],
    quality_gate: { ok: true, status: "pass", reason_codes: [] },
    model_run: {
      provider: "openrouter",
      model: "owl-alpha",
      operation: "graph.propose",
      idempotency_key: "run_owl_alpha_current_1779903845560_1",
      status: "succeeded",
    },
    cost_ledger: { status: "succeeded", total_cost: 0, estimated_cost: 0, input_tokens: 106, output_tokens: 11 },
    agent_run: {
      id: "agn_openrouter-owl-alpha-current-full-pipeline-20260527",
      status: "succeeded",
      record_path: "openrouter-owl-alpha-current-full-pipeline-20260527/agent-run-record.json",
    },
    ...overrides,
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

describe("verifyBootstrapValidationEvidence", () => {
  test("accepts a deterministic no-spend bootstrap package and emits a sanitized no-readiness summary", () => {
    const manifest = manifestText();
    const expectedHash = sha256(manifest);
    const result = verifyBootstrapValidationEvidence({
      summary: fullPipelineSummary(),
      rerunSummary: fullPipelineSummary(),
      manifestText: manifest,
      checkoutCommit: "f862bbf",
      expectedManifestHash: expectedHash,
      npmCi: "passed",
      npmRunCi: "passed",
    });

    assert.equal(result.schema_version, "atliera.bootstrap_validation_evidence.v1");
    assert.equal(result.ok, true);
    assert.equal(result.checkout_commit, "f862bbf");
    assert.deepEqual(result.ci, { npm_ci: "passed", npm_run_ci: "passed" });
    assert.equal(result.full_pipeline.summary_ok, true);
    assert.equal(result.full_pipeline.rerun_ok, true);
    assert.equal(result.full_pipeline.manifest_hash, sha256(manifestText()));
    assert.equal(result.full_pipeline.deterministic, true);
    assert.deepEqual(result.full_pipeline.safety, {
      live_provider_call: false,
      network: false,
      credentials_read: false,
    });
    assert.equal(result.readiness_claim, false);
    assert.doesNotMatch(JSON.stringify(result), /\/home\//i);
    assert.doesNotMatch(JSON.stringify(result), /\b(?:\d{1,3}\.){3}\d{1,3}\b/i);
    assert.doesNotMatch(JSON.stringify(result), /lab\d*\.atliera\.com/i);
  });

  test("rejects non-deterministic or unsafe bootstrap evidence", () => {
    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary(),
        rerunSummary: fullPipelineSummary({ ok: false }),
        manifestText: manifestText(),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText()),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /rerun summary must be ok/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary(),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText(),
        checkoutCommit: "f862bbf",
        expectedManifestHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /manifest hash must match expected hash/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary({ manifest_path: "/tmp/private/manifest.json" }),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText(),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText()),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /artifact paths must be relative/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary({
          summary: {
            ...(fullPipelineSummary() as { summary: Record<string, unknown> }).summary,
            safety: { live_provider_call: false, network: true, credentials_read: false },
          },
        }),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText(),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText()),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /safety flags must prove no live provider call, network, or credential read/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary({ manifest_path: "C:/secret/manifest.json" }),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText(),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText()),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /artifact paths must be relative/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary(),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText({
          agent_run: {
            id: "agn_openrouter-owl-alpha-current-full-pipeline-20260527",
            status: "succeeded",
            record_path: "C:/secret/agent-run-record.json",
          },
        }),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText({
          agent_run: {
            id: "agn_openrouter-owl-alpha-current-full-pipeline-20260527",
            status: "succeeded",
            record_path: "C:/secret/agent-run-record.json",
          },
        })),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /artifact paths must be relative/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary(),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText({
          agent_run: {
            id: "agn_openrouter-owl-alpha-current-full-pipeline-20260527",
            status: "succeeded",
            record_path: "other/agent-run-record.json",
          },
        }),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText({
          agent_run: {
            id: "agn_openrouter-owl-alpha-current-full-pipeline-20260527",
            status: "succeeded",
            record_path: "other/agent-run-record.json",
          },
        })),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /manifest agent run record path must match summary artifacts/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary(),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText({ raw_provider_response: { body: "raw provider payload" } }),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText({ raw_provider_response: { body: "raw provider payload" } })),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /manifest must not contain private evidence markers/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary(),
        rerunSummary: fullPipelineSummary(),
        manifestText: manifestText({
          artifacts: [
            { artifact_type: "graph_bundle", path: "other/graph-bundle.json" },
            { artifact_type: "quality_gate_report", path: "other/quality-gate-report.json" },
            { artifact_type: "model_provider_validation_report", path: "other/model-provider-validation-report.json" },
            { artifact_type: "agent_run_record", path: "other/agent-run-record.json" },
          ],
        }),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText({
          artifacts: [
            { artifact_type: "graph_bundle", path: "other/graph-bundle.json" },
            { artifact_type: "quality_gate_report", path: "other/quality-gate-report.json" },
            { artifact_type: "model_provider_validation_report", path: "other/model-provider-validation-report.json" },
            { artifact_type: "agent_run_record", path: "other/agent-run-record.json" },
          ],
        })),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /manifest artifact paths must match summary artifacts/,
    );

    assert.throws(
      () => verifyBootstrapValidationEvidence({
        summary: fullPipelineSummary(),
        rerunSummary: fullPipelineSummary({
          summary: {
            ...(fullPipelineSummary() as { summary: Record<string, unknown> }).summary,
            provider_validation: {
              ...((fullPipelineSummary() as { summary: { provider_validation: Record<string, unknown> } }).summary.provider_validation),
              idempotency_key: "different_rerun_key",
            },
          },
        }),
        manifestText: manifestText(),
        checkoutCommit: "f862bbf",
        expectedManifestHash: sha256(manifestText()),
        npmCi: "passed",
        npmRunCi: "passed",
      }),
      /rerun summary must match original validation summary/,
    );
  });
});
