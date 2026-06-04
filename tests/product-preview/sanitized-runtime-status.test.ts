import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, test } from "node:test";

import {
  buildProductPreviewDryRunPlan,
  compareSanitizedProductPreviewStatuses,
  renderProductPreviewStatusMarkdown,
  validateSanitizedProductPreviewStatus,
  type ProductPreviewExecutionStatus,
} from "../../src/product-preview/sanitized-runtime-status.ts";

const boundaries = {
  raw_private_evidence_read: false,
  raw_or_model_output_committed: false,
  provider_comparison_performed: false,
  graph_ingestion_performed: false,
  runtime_model_mode_integration: false,
  production_writes: false,
  readiness_claim: false,
  default_model_selection_claim: false,
  provider_lock_in: false,
  authorizes_provider_call: false,
} as const;

function baselineStatus(): ProductPreviewExecutionStatus {
  return {
    status_ref: "live-product-preview-six-slot-20260601a",
    status: "completed",
    route_ref: "owl-alpha",
    provider_ref: "openrouter",
    model_label: "owl-alpha",
    transport_kind: "graph-propose",
    corpus_ref: "external-corpus/live-product-preview-six-slot",
    provider_calls_executed: 6,
    approved_max_provider_calls: 6,
    accepted_output_received: true,
    v2_contract_validated: true,
    observed_cost_usd: 0,
    approved_max_cost_usd: 3,
    input_tokens_observed: 5958,
    output_tokens_observed: 5317,
    output_counts: { excerpts: 18, claims: 18, account_objects: 18 },
    slot_statuses: [
      { role: "representative-a", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "representative-b", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "edge-case-a", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "edge-case-b", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "calibration", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
      { role: "sparse-control", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 3, claims: 3, account_objects: 3 } },
    ],
    boundaries,
  };
}

function candidateStatus(): ProductPreviewExecutionStatus {
  return {
    status_ref: "product-preview-tiny-expansion-20260604c",
    status: "completed",
    route_ref: "gpt-5.5-openai-codex-20260602a",
    provider_ref: "openai-codex",
    model_label: "gpt-5.5",
    transport_kind: "model-only-codex-auth",
    corpus_ref: "product-preview/tiny-screened-three-slot-v1",
    provider_calls_executed: 3,
    approved_max_provider_calls: 3,
    accepted_output_received: true,
    v2_contract_validated: true,
    observed_cost_usd: 0,
    approved_max_cost_usd: 3,
    input_tokens_observed: 1075,
    output_tokens_observed: 1614,
    output_counts: { excerpts: 12, claims: 10, account_objects: 5 },
    slot_statuses: [
      { role: "representative", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 4, claims: 3, account_objects: 1 } },
      { role: "edge-case", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 4, claims: 4, account_objects: 3 } },
      { role: "calibration", status: "completed", provider_calls_executed: 1, accepted_output_received: true, v2_contract_validated: true, output_counts: { excerpts: 4, claims: 3, account_objects: 1 } },
    ],
    boundaries,
  };
}

describe("sanitized product-preview runtime status hardening", () => {
  test("validates, compares, and renders sanitized records without authorizing provider calls", () => {
    const validated = validateSanitizedProductPreviewStatus(candidateStatus());
    assert.equal(validated.status, "completed");
    assert.equal(validated.provider_calls_executed, 3);
    assert.equal(validated.boundaries.authorizes_provider_call, false);

    const comparison = compareSanitizedProductPreviewStatuses({
      comparison_ref: "runtime-model-only-gpt55-tiny-vs-owl-alpha-six-slot-20260604c",
      baseline: baselineStatus(),
      candidate: candidateStatus(),
    });
    assert.equal(comparison.status, "pass");
    assert.equal(comparison.classification, "candidate-contract-valid-lower-scope");
    assert.equal(comparison.recommended_next_lane, "runtime-model-mode-smoke-approval");
    assert.deepEqual(comparison.deltas, {
      provider_calls_executed: -3,
      excerpts: -6,
      claims: -8,
      account_objects: -13,
      input_tokens_observed: -4883,
      output_tokens_observed: -3703,
      observed_cost_usd: 0,
    });
    assert.equal(comparison.authorizes_provider_call, false);
    assert.equal(comparison.authorizes_default_model_selection, false);
    assert.equal(comparison.provider_lock_in, false);
    assert.deepEqual(comparison.safety, {
      provider_call: false,
      provider_spend: false,
      raw_private_evidence_read: false,
      network_access: false,
      graph_ingestion: false,
      production_writes: false,
      runtime_model_mode_integration: false,
    });

    const markdown = renderProductPreviewStatusMarkdown(candidateStatus());
    assert.match(markdown, /provider_calls_executed: 3/);
    assert.match(markdown, /authorizes_provider_call: false/);
    assert.match(markdown, /default_model_selection_claim: false/);
    assert.doesNotMatch(markdown, /api[_-]?key|bearer |private-provider-evidence|raw_provider_output/i);
  });

  test("dry-run planner emits planned metadata only", () => {
    const plan = buildProductPreviewDryRunPlan({
      job_id: "product-preview-runtime-smoke-20260604d",
      approval_ref: "docs/runbooks/runtime-model-only-product-preview-runtime-smoke-approval-packet.md",
      route_ref: "gpt-5.5-openai-codex-20260602a",
      provider_ref: "openai-codex",
      model_label: "gpt-5.5",
      transport_kind: "model-only-codex-auth",
      corpus_ref: "product-preview/runtime-smoke-single-slot-v1",
      prompt_contract_ref: "prompts/product-preview-model-only-v1",
      max_provider_calls: 1,
      max_cost_usd: 1,
      slot_roles: ["calibration"],
      runtime_mode: "model-only-smoke",
    });
    assert.equal(plan.dry_run, true);
    assert.equal(plan.provider_calls_executed, 0);
    assert.equal(plan.provider_spend_authorized_by_plan, false);
    assert.equal(plan.network_access_performed, false);
    assert.equal(plan.authorizes_provider_call, false);
    assert.deepEqual(plan.boundary, {
      tools: false,
      shell: false,
      file_access: false,
      web_search: false,
      plugins: false,
      mcp: false,
      retrieval: false,
      graph_ingestion: false,
      production_writes: false,
      background_orchestrator: false,
    });
  });

  test("rejects accessors, unsafe fields, and impossible sanitized records", () => {
    const hostile = candidateStatus() as unknown as Record<string, unknown>;
    Object.defineProperty(hostile, "status_ref", {
      enumerable: true,
      get() {
        throw new Error("private getter should not run");
      },
    });
    assert.throws(() => validateSanitizedProductPreviewStatus(hostile), /enumerable data properties/);

    assert.throws(
      () => validateSanitizedProductPreviewStatus({ ...candidateStatus(), status_ref: "../private" }),
      /status_ref must be safe/,
    );
    assert.throws(
      () => validateSanitizedProductPreviewStatus({ ...candidateStatus(), provider_calls_executed: 9 }),
      /slot provider call sum mismatch/,
    );
    assert.throws(
      () => validateSanitizedProductPreviewStatus({ ...candidateStatus(), observed_cost_usd: 4 }),
      /observed cost exceeds approval/,
    );
    assert.throws(
      () =>
        buildProductPreviewDryRunPlan({
          job_id: "bad",
          approval_ref: "docs/runbooks/x.md",
          route_ref: "route",
          provider_ref: "provider",
          model_label: "model",
          transport_kind: "transport",
          corpus_ref: "corpus",
          prompt_contract_ref: "prompt",
          max_provider_calls: 2,
          max_cost_usd: 1,
          slot_roles: ["calibration"],
          runtime_mode: "model-only-smoke",
        }),
      /max_provider_calls must be 1..slot_roles.length/,
    );
  });

  test("CLI dry-run planner prints JSON and performs no provider call", () => {
    const child = spawnSync(
      "npx",
      [
        "tsx",
        "src/cli/product-preview-plan.ts",
        "plan",
        "--job-id",
        "product-preview-runtime-smoke-20260604d",
        "--approval-ref",
        "docs/runbooks/runtime-model-only-product-preview-runtime-smoke-approval-packet.md",
        "--route-ref",
        "gpt-5.5-openai-codex-20260602a",
        "--provider-ref",
        "openai-codex",
        "--model-label",
        "gpt-5.5",
        "--transport-kind",
        "model-only-codex-auth",
        "--corpus-ref",
        "product-preview/runtime-smoke-single-slot-v1",
        "--prompt-contract-ref",
        "prompts/product-preview-model-only-v1",
        "--max-provider-calls",
        "1",
        "--max-cost-usd",
        "1",
        "--slot-roles",
        "calibration",
        "--runtime-mode",
        "model-only-smoke",
      ],
      { encoding: "utf8", cwd: process.cwd() },
    );
    assert.equal(child.status, 0, child.stderr);
    const plan = JSON.parse(child.stdout) as { provider_calls_executed: number; authorizes_provider_call: boolean; dry_run: boolean };
    assert.equal(plan.dry_run, true);
    assert.equal(plan.provider_calls_executed, 0);
    assert.equal(plan.authorizes_provider_call, false);
  });
});
