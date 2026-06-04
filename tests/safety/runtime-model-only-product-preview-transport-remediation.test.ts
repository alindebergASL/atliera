import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DOC = join(import.meta.dirname, "..", "..", "docs", "runbooks", "runtime-model-only-product-preview-transport-remediation.md");

test("product-preview transport remediation stays no-spend and non-authorizing", () => {
  const doc = readFileSync(DOC, "utf8");

  for (const required of [
    /Status: no-spend remediation preflight/i,
    /This document does not approve or execute a provider call/i,
    /prior_approval_consumed: true/i,
    /prior_retry_requires_new_approval: true/i,
    /provider_api_requests_executed_during_prior_attempt: 0/i,
    /provider_api_requests_executed_during_remediation: 0/i,
    /provider_spend_during_remediation: false/i,
    /raw_request_committed: false/i,
    /raw_response_committed: false/i,
    /raw_screened_account_text_committed: false/i,
    /model_output_committed: false/i,
    /private_evidence_committed: false/i,
    /package_index_dns_tcp443_reachable: true/i,
    /model_route_dns_tcp443_reachable: true/i,
    /firewall_or_network_blocker_observed: false/i,
    /http_provider_request_sent: false/i,
    /provider_auth_sent: false/i,
    /provider_body_sent: false/i,
    /authorizes_provider_call: false/i,
    /authorizes_retry: false/i,
    /authorizes_product_preview_run: false/i,
    /authorizes_provider_comparison: false/i,
    /authorizes_default_model_selection: false/i,
    /authorizes_background_orchestrator_bypass: false/i,
    /authorizes_production_use: false/i,
    /authorizes_graph_ingestion: false/i,
    /fresh product-preview retry still requires a separate docs\/tests-only approval packet/i,
  ]) assert.match(doc, required);

  for (const forbidden of [
    /authorizes_provider_call: true/i,
    /authorizes_retry: true/i,
    /authorizes_product_preview_run: true/i,
    /authorizes_provider_comparison: true/i,
    /authorizes_default_model_selection: true/i,
    /authorizes_background_orchestrator_bypass: true/i,
    /authorizes_production_use: true/i,
    /authorizes_graph_ingestion: true/i,
    /provider_api_requests_executed_during_remediation: [1-9]/i,
    /provider_spend_during_remediation: true/i,
    /http_provider_request_sent: true/i,
    /provider_auth_sent: true/i,
    /provider_body_sent: true/i,
    /api[_-]?key/i,
    /authorization header/i,
    /bearer /i,
    /private-provider-evidence/i,
    /raw_provider_output_text/i,
    /raw_harness_transport_request/i,
    /raw_provider_metadata/i,
    /production ready/i,
    /launch ready/i,
    /default production model/i,
  ]) assert.doesNotMatch(doc, forbidden);
});
