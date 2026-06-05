import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const REMEDIATION_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-contract-remediation.md",
);
const DIAGNOSIS_DOC = join(
  REPO_ROOT,
  "docs/runbooks/runtime-model-only-tiny-live-runtime-proof-exception-diagnosis.md",
);

const CANONICAL_TYPES = [
  "account_snapshot",
  "signal",
  "risk",
  "play",
  "map",
  "relationship",
  "milestone",
  "recommendation",
  "stakeholder",
  "initiative",
  "open_question",
] as const;

function assertNoLeakageOrBroadening(label: string, doc: string): void {
  const forbidden = [
    /raw prompt/i,
    /raw output/i,
    /raw request/i,
    /raw response/i,
    /provider body/i,
    /provider metadata/i,
    /wrapper log/i,
    /auth header/i,
    /credential value/i,
    /secret material/i,
    /source material/i,
    /local evidence location/i,
    /private[-_ ]provider[-_ ]evidence/i,
    /request id/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_retry:\s*true/i,
    /authorizes_runtime_model_mode_execution:\s*true/i,
    /authorizes_provider_comparison:\s*true/i,
    /authorizes_product_preview_expansion:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /authorizes_tools:\s*true/i,
    /authorizes_web_search:\s*true/i,
    /authorizes_plugins:\s*true/i,
    /authorizes_retrieval:\s*true/i,
    /graph_ingestion_performed:\s*true/i,
    /production_writes:\s*true/i,
    /default_model_selection_claim:\s*true/i,
    /provider_lock_in:\s*true/i,
    /product_readiness_claim:\s*true/i,
    /production_readiness_claim:\s*true/i,
    /launch_readiness_claim:\s*true/i,
    /retry is authorized/i,
    /may retry without/i,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(doc, pattern, `${label} contains forbidden pattern ${pattern}`);
  }
}

test("tiny live runtime proof contract remediation aligns prompt and validator allowlist without approving retry", () => {
  const remediation = readFileSync(REMEDIATION_DOC, "utf8");
  const diagnosis = readFileSync(DIAGNOSIS_DOC, "utf8");

  assert.match(diagnosis, /stable_diagnosis_code: account_object_type_allowlist_mismatch/i);
  assert.match(diagnosis, /Provider retry is not authorized/i);

  assert.match(remediation, /Status: no-spend prompt-contract remediation/i);
  assert.match(remediation, /source_diagnosis: `runtime-model-only-tiny-live-runtime-proof-exception-diagnosis\.md`/i);
  assert.match(remediation, /remediation_provider_calls_executed: 0/i);
  assert.match(remediation, /remediation_provider_spend: false/i);
  assert.match(remediation, /network_access_during_remediation: false/i);
  assert.match(remediation, /raw_or_model_output_committed: false/i);
  assert.match(remediation, /private_evidence_committed: false/i);
  assert.match(remediation, /prompt_contract_amended: true/i);
  assert.match(remediation, /validator_allowlist_aligned: true/i);
  assert.match(remediation, /canonical_account_object_type_allowlist:/i);

  const allowlistLine = remediation
    .split("\n")
    .find((line) => line.includes("canonical_account_object_type_allowlist:"));
  assert.ok(allowlistLine);
  for (const type of CANONICAL_TYPES) assert.match(allowlistLine, new RegExp(`\\b${type}\\b`, "i"));
  assert.doesNotMatch(allowlistLine, /product_preview_runtime_smoke_summary/i);

  assert.match(remediation, /The prompt contract must instruct future attempts to use only the canonical allowlist/i);
  assert.match(remediation, /The validator allowlist remains the same canonical public v2 vocabulary/i);
  assert.match(remediation, /unknown account-object type labels remain contract failures/i);
  assert.match(remediation, /stable_future_error_code: account_object_type_allowlist_mismatch/i);

  assert.match(remediation, /authorizes_provider_call: false/i);
  assert.match(remediation, /authorizes_retry: false/i);
  assert.match(remediation, /authorizes_runtime_model_mode_execution: false/i);
  assert.match(remediation, /authorizes_provider_comparison: false/i);
  assert.match(remediation, /authorizes_product_preview_expansion: false/i);
  assert.match(remediation, /authorizes_default_model_selection: false/i);
  assert.match(remediation, /authorizes_tools: false/i);
  assert.match(remediation, /authorizes_web_search: false/i);
  assert.match(remediation, /authorizes_plugins: false/i);
  assert.match(remediation, /authorizes_retrieval: false/i);
  assert.match(remediation, /retry_requires_separate_approval_packet: true/i);
  assert.match(remediation, /product_readiness_claim: false/i);
  assert.match(remediation, /production_readiness_claim: false/i);
  assert.match(remediation, /launch_readiness_claim: false/i);

  assertNoLeakageOrBroadening("tiny live contract remediation", remediation);
});
