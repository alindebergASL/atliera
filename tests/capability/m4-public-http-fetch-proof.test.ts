import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { generateM4PublicHttpFetchProof, generateM4SecWorkshopFixture, M4_RECORDED_SEC_SUBMISSIONS_BODY } from "../../src/capability/m4-public-http-fetch-proof.ts";
import { H2_CAPABILITY_REGISTRY, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID } from "../../src/capability/h2-registry.ts";
import { M4_TARGET_POLICY_SHA256 } from "../../src/capability/m4-target-policy.ts";

const root = join(import.meta.dirname, "..", "..");
const fixture = join(root, "fixtures", "validation", "m4-public-http-fetch-v1-recorded-proof.json");
const workshop = join(root, "fixtures", "workshop", "m4-sec-fedex-submissions-evidence-preview.html");

test("recorded SEC proof and Workshop fixture are deterministic through registry/MCP/mediation/extraction", async () => {
  const first = await generateM4PublicHttpFetchProof();
  assert.deepEqual(first, await generateM4PublicHttpFetchProof());
  assert.deepEqual(first, JSON.parse(readFileSync(fixture, "utf8")));
  assert.equal(await generateM4SecWorkshopFixture(), readFileSync(workshop, "utf8"));
  assert.equal(H2_CAPABILITY_REGISTRY.length, 2);
  assert.equal(H2_CAPABILITY_REGISTRY[1].capabilityId, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
  const acquisition = first.acquisition as Record<string, unknown>;
  assert.equal(acquisition.targetPolicySha256, M4_TARGET_POLICY_SHA256);
  assert.equal(Buffer.from(acquisition.bodyBase64 as string, "base64").toString("utf8"), M4_RECORDED_SEC_SUBMISSIONS_BODY);
  assert.equal((first.extraction as Record<string, unknown>).value, "AIR COURIER SERVICES");
  assert.equal((first.extraction as Record<string, unknown>).jsonPointer, "/sicDescription");
  assert.deepEqual(first.effects, { recordedInertExchangesConsumed: 1, systemSideAcquisitionProofs: 1,
    liveNetworkEgress: 0, retries: 0, providerCalls: 0, privateReads: 0, graphWrites: 0,
    productionWrites: 0, deployments: 0 });
  assert.match(readFileSync(workshop, "utf8"), /Quoted\/untrusted public-source content — Unverified/);
  assert.doesNotMatch(readFileSync(workshop, "utf8"), />Verified</);
});

test("roadmap and Gate A packet preserve none authority and one inert target", () => {
  for (const relative of [["docs", "strategy", "roadmap.md"], ["docs", "runbooks", "m4-public-http-fetch-v1-status-and-fedex-live-packet.md"]]) {
    const document = readFileSync(join(root, ...relative), "utf8");
    assert.match(document, /current_effective_authorization:\s*`?none`?/);
    assert.doesNotMatch(document, /authorizes_live[^\n]*true/i);
  }
  const packet = readFileSync(join(root, "docs", "runbooks", "m4-public-http-fetch-v1-status-and-fedex-live-packet.md"), "utf8");
  assert.match(packet, /data\.sec\.gov\/submissions\/CIK0001048911\.json/);
  assert.match(packet, /ATLIERA_M4_SEC_USER_AGENT/);
  assert.match(packet, /^- current_implementation_work_authorized: `none`$/m);
  assert.match(packet, /^- historical_implementation_work_authorized: `Atliera-M4-Gate-A-only` \(completed; no current authority\)$/m);
  assert.doesNotMatch(packet, /^- implementation_work_authorized: `Atliera-M4-Gate-A-only`$/m);
  const index = readFileSync(join(root, "docs", "runbooks", "INDEX.md"), "utf8");
  assert.match(index, /next recommended work: repair and exact-head approval of PR #286; after merge, Gate B/);
  assert.match(index, /the compact packet exists but is inert; exact-head approval\/merge plus one private commit\/policy\/User-Agent-bound GO/);
  assert.doesNotMatch(index, /one compact URL\/budget\/retention\/legal packet and one explicit operator GO are still required/);
  assert.doesNotMatch(index, /next recommended work: independent Gate A review/);
  assert.match(packet, new RegExp(M4_TARGET_POLICY_SHA256));
  const template = JSON.parse(readFileSync(join(root, "fixtures", "validation", "m4-sec-gate-b-go-template.json"), "utf8"));
  assert.equal(template.authorizesLiveAcquisition, false);
  assert.equal(template.targetRef, "sec_fedex_submissions");
  assert.equal(template.reviewedAdapterCommit, "<GATE_B_REVIEWED_ADAPTER_COMMIT_AFTER_MERGE>");
  assert.equal(template.oneShotConsumptionPath, "<EXTERNAL_ABSOLUTE_CONSUMPTION_RECORD_PATH_ENDING_IN_ID>");
  assert.equal(template.userAgentSha256, "<SHA256_OF_EXACT_APPROVED_USER_AGENT_BYTES>");
  assert.equal(template.userAgentByteLength, "<UTF8_BYTE_LENGTH_OF_EXACT_APPROVED_USER_AGENT>");
  assert.deepEqual(template.networkBudget, { scheme: "https", effectivePort: 443, method: "GET", addressFamily: 4,
    maxTargets: 1, maxRequests: 1, onePinnedAddress: true, oneConnectionAttempt: true, redirectLimit: 0,
    retryBudget: 0, totalDeadlineMs: 10_000, maxBodyBytes: 1_048_576, acceptedContentTypes: ["application/json"] });
  assert.equal(template.retentionDays, 30);
  assert.equal(template.takedownPosture, "quarantine_and_stop_downstream_use; retain_minimum_audit_hash_unless_deletion_required");
  assert.equal(template.expectedAttemptOutput, "artifacts/m4-sec-gate-b/sec-fedex-submissions-attempt.json");
  assert.equal(template.expectedCustodyOutput, "artifacts/m4-sec-gate-b/sec-fedex-submissions-custody.json");
  assert.equal(template.expectedWorkshopOutput, "artifacts/m4-sec-gate-b/sec-fedex-submissions-workshop.html");
  assert.equal(template.failureBehavior, "consume_once; zero_retry; destroy_resources; persist_sanitized_attempt_receipt; write_no_evidence_output");
  assert.equal(template.rollbackBehavior, "remain_unarmed; require_new_explicit_go_for_any_later_attempt");
});

test("capability implementation remains absent from the root model-facing barrel", () => {
  const source = readFileSync(join(root, "src", "index.ts"), "utf8");
  assert.doesNotMatch(source, /\.\/capability\/|public_http_fetch_v1|M4PublicHttp/);
});
