import assert from "node:assert/strict";
import test from "node:test";

import { runModelOnlyHarnessJob } from "../../src/model/model-only-harness.ts";

const baseJob = {
  job_id: "job-controlled-corpus-001",
  idempotency_key: "idem-controlled-corpus-001",
  approval_ref: "docs/runbooks/model-only-controlled-corpus-approval.md",
  route_ref: "gpt-5.5-openai-codex-20260602a",
  provider_ref: "openai-codex",
  model_label: "gpt-5.5",
  transport_kind: "model-only-codex-auth",
  corpus_ref: "controlled-corpus/model-only-harness-smoke-v1",
  prompt_contract_ref: "prompts/controlled-corpus-model-only-v1",
  max_attempts: 1,
  approved_max_cost_usd: 1,
  requested_output_contract: {
    excerpts: [],
    claims: [],
    account_objects: [],
  },
  boundary: {
    tools: false,
    shell: false,
    file_access: false,
    web_search: false,
    plugins: false,
    mcp: false,
    retrieval: false,
    session_carryover: false,
  },
} as const;

const baseApproval = {
  approval_ref: baseJob.approval_ref,
  route_ref: baseJob.route_ref,
  provider_ref: baseJob.provider_ref,
  model_label: baseJob.model_label,
  transport_kind: baseJob.transport_kind,
  corpus_ref: baseJob.corpus_ref,
  prompt_contract_ref: baseJob.prompt_contract_ref,
  max_attempts: 1,
  approved_max_cost_usd: 1,
} as const;

test("model-only harness completes a fake-mode approved job with one injected transport call and sanitized status", async () => {
  let calls = 0;
  const status = await runModelOnlyHarnessJob({
    job: baseJob,
    approval: baseApproval,
    now: "2026-06-03T23:00:00.000Z",
    transport: async (request) => {
      calls += 1;
      assert.deepEqual(request.output_contract_keys, ["account_objects", "claims", "excerpts"]);
      assert.equal(Object.isFrozen(request), true);
      return {
        output_text: JSON.stringify({ excerpts: [], claims: [], account_objects: [] }),
        input_tokens: 11,
        output_tokens: 7,
        observed_cost_usd: 0,
      };
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(status, {
    status: "completed",
    reason_code: "model_only_harness_completed",
    stable_error_code: null,
    job_id: baseJob.job_id,
    approval_ref: baseJob.approval_ref,
    route_ref: baseJob.route_ref,
    provider_ref: baseJob.provider_ref,
    model_label: baseJob.model_label,
    transport_kind: baseJob.transport_kind,
    corpus_ref: baseJob.corpus_ref,
    prompt_contract_ref: baseJob.prompt_contract_ref,
    provider_calls_executed: 1,
    accepted_output_received: true,
    observed_cost_usd: 0,
    approved_max_cost_usd: 1,
    input_tokens_observed: 11,
    output_tokens_observed: 7,
    completed_at: "2026-06-03T23:00:00.000Z",
    authorizes_provider_call: false,
    authorizes_retry: false,
    default_model_selection_claim: false,
    provider_lock_in: false,
    production_readiness_claim: false,
    product_readiness_claim: false,
    launch_readiness_claim: false,
  });
});

test("model-only harness rejects boundary or approval mismatches before transport access", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return { output_text: "{}", input_tokens: 1, output_tokens: 1, observed_cost_usd: 0 };
  };

  const broadened = await runModelOnlyHarnessJob({
    job: { ...baseJob, boundary: { ...baseJob.boundary, web_search: true } },
    approval: baseApproval,
    now: "2026-06-03T23:00:00.000Z",
    transport,
  });
  assert.equal(broadened.status, "rejected");
  assert.equal(broadened.reason_code, "model_only_harness_rejected");
  assert.equal(broadened.stable_error_code, "boundary_flag_open");
  assert.equal(broadened.provider_calls_executed, 0);

  const mismatch = await runModelOnlyHarnessJob({
    job: baseJob,
    approval: { ...baseApproval, model_label: "other-model" },
    now: "2026-06-03T23:00:00.000Z",
    transport,
  });
  assert.equal(mismatch.status, "rejected");
  assert.equal(mismatch.stable_error_code, "approval_scope_mismatch");
  assert.equal(mismatch.provider_calls_executed, 0);
  assert.equal(calls, 0);
});

test("model-only harness sanitizes transport errors and malformed output", async () => {
  const thrown = await runModelOnlyHarnessJob({
    job: baseJob,
    approval: baseApproval,
    now: "2026-06-03T23:00:00.000Z",
    transport: async () => {
      throw new Error("raw provider body should not leak");
    },
  });
  assert.equal(thrown.status, "exception");
  assert.equal(thrown.provider_calls_executed, 1);
  assert.equal(thrown.stable_error_code, "transport_failed");
  assert.doesNotMatch(JSON.stringify(thrown), /raw provider body/i);

  const malformed = await runModelOnlyHarnessJob({
    job: baseJob,
    approval: baseApproval,
    now: "2026-06-03T23:00:00.000Z",
    transport: async () => ({
      output_text: "```json\n{}\n```",
      input_tokens: 1,
      output_tokens: 1,
      observed_cost_usd: 0,
    }),
  });
  assert.equal(malformed.status, "exception");
  assert.equal(malformed.provider_calls_executed, 1);
  assert.equal(malformed.stable_error_code, "output_contract_failed");
});

test("model-only harness does not read process.env", async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
  Object.defineProperty(process, "env", {
    configurable: true,
    get() {
      throw new Error("process.env must not be read");
    },
  });

  try {
    const status = await runModelOnlyHarnessJob({
      job: baseJob,
      approval: baseApproval,
      now: "2026-06-03T23:00:00.000Z",
      transport: async () => ({
        output_text: JSON.stringify({ excerpts: [], claims: [], account_objects: [] }),
        input_tokens: 1,
        output_tokens: 1,
        observed_cost_usd: 0,
      }),
    });
    assert.equal(status.status, "completed");
  } finally {
    if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
  }
});
