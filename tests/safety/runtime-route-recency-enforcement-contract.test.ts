import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const RUNBOOK = join(ROOT, "docs", "runbooks", "runtime-route-recency-enforcement-status.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assertAll(label: string, doc: string, patterns: RegExp[]): void {
  for (const pattern of patterns) assert.match(doc, pattern, `${label} must contain ${pattern}`);
}

test("runtime route recency enforcement runbook preserves no-call stale-route boundaries", () => {
  const doc = read(RUNBOOK);

  assertAll("runbook", doc, [
    /Status: no-spend runtime route recency enforcement/i,
    /selectRouteFromCatalog/i,
    /preflightRuntimeModelExecution/i,
    /createRuntimeModelExecutionReport/i,
    /evidenceExpiresAt/i,
    /fresh/i,
    /nearing-expiry/i,
    /expired-needs-revalidation/i,
    /expired route evidence requires fresh approval/i,
    /near-expiry route evidence is surfaced as warning metadata/i,
    /explicit route ref/i,
    /provider_calls_executed: 0/i,
    /provider_spend: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_revalidation_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /runtime_model_mode_integration: false/i,
    /provider_lock_in: false/i,
    /production_readiness_claim: false/i,
    /launch_readiness_claim: false/i,
  ]);

  for (const forbidden of [
    /raw prompt/i,
    /raw request/i,
    /raw response/i,
    /raw output/i,
    /provider payload/i,
    /model output text/i,
    /source text/i,
    /auth header/i,
    /authorization:\s*bearer/i,
    /api[_-]?key\s*[:=]/i,
    /client[_-]?secret\s*[:=]/i,
    /account id/i,
    /request id\b/i,
    /private evidence path/i,
    /\/home\//i,
    /production ready/i,
    /launch ready/i,
    /default model selected/i,
    /authorizes_provider_call:\s*true/i,
    /authorizes_revalidation_run:\s*true/i,
    /authorizes_default_model_selection:\s*true/i,
    /provider_lock_in:\s*true/i,
    /runtime_model_mode_integration:\s*true/i,
  ]) {
    assert.doesNotMatch(doc, forbidden, `runbook must not contain ${forbidden}`);
  }
});
