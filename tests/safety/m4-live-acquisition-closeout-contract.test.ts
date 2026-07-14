import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const PROOF_PATH = "fixtures/validation/m4-live-acquisition-success-proof.json";
const WORKSHOP_PATH = "fixtures/workshop/m4-sec-fedex-live-evidence-preview.html";
const RETRO_PATH = "docs/reviews/m4-live-acquisition-closeout-retro.md";
const RUNBOOK_PATH = "docs/runbooks/m4-public-http-fetch-v1-status-and-fedex-live-packet.md";
const ROADMAP_PATH = "docs/strategy/roadmap.md";
const INDEX_PATH = "docs/runbooks/INDEX.md";
const BLOCKERS_PATH = "docs/BLOCKERS.md";
const GATE3_PATH = "docs/runbooks/lab-gate3-status-reconciliation.md";
const H3_PLAN_PATH = "docs/runbooks/own-data-snapshot-h3-slice-plan-status.md";
const CLOSEOUT_PATHS = [
  PROOF_PATH, WORKSHOP_PATH, RETRO_PATH, RUNBOOK_PATH, ROADMAP_PATH, INDEX_PATH, BLOCKERS_PATH, GATE3_PATH, H3_PLAN_PATH,
] as const;

const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");
const PROOF_RAW = read(PROOF_PATH);
const PROOF = JSON.parse(PROOF_RAW) as Record<string, any>;
const WORKSHOP = read(WORKSHOP_PATH);
const RETRO = read(RETRO_PATH);
const RUNBOOK = read(RUNBOOK_PATH);
const ROADMAP = read(ROADMAP_PATH);
const INDEX = read(INDEX_PATH);

function markerValue(document: string, key: string): string {
  const prefix = `- ${key}: `;
  const values = document.split("\n").filter((line) => line.startsWith(prefix)).map((line) => line.slice(prefix.length).trim());
  assert.equal(values.length, 1, `expected one ${key} marker`);
  return values[0]!;
}

function tableRow(document: string, label: string): string {
  const rows = document.split("\n").filter((line) => line.startsWith(`| **${label}`));
  assert.equal(rows.length, 1, `expected one ${label} row`);
  return rows[0]!;
}

function assertExactKeys(value: unknown, expected: readonly string[], label: string): asserts value is Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} has unknown or missing keys`);
}

test("sanitized proof binds the exact successful consumed M4 acquisition", () => {
  assert.equal(Buffer.byteLength(PROOF_RAW, "utf8"), 5351);
  assert.equal(createHash("sha256").update(PROOF_RAW, "utf8").digest("hex"),
    "31ca97c7e40767078f3d12713bea24f309a9a908123d4a80917c879c25069a35");
  assertExactKeys(PROOF, [
    "kind", "schema_version", "status", "verification_method",
    "external_or_acquisition_target_requests_during_closeout_verification", "canonical_implementation", "authority",
    "execution", "effect_accounting", "workshop", "verified_artifact_identity", "attempt_1_preservation", "privacy",
    "boundaries",
  ], "proof root");
  assert.equal(PROOF.kind, "m4-live-acquisition-sanitized-success-proof");
  assert.equal(PROOF.schema_version, "1");
  assert.equal(PROOF.status, "verified_success_consumed_no_retry");
  assert.equal(PROOF.verification_method, "deterministic_local_exact_artifact_cross_check");
  assert.equal(PROOF.external_or_acquisition_target_requests_during_closeout_verification, 0);
  assertExactKeys(PROOF.canonical_implementation,
    ["commit", "tree", "target_policy_sha256", "capability_descriptor_sha256"], "canonical implementation");
  assert.deepEqual(PROOF.canonical_implementation, {
    commit: "c1372acd14e09722c1e54646b85d89d3a0fd73f1",
    tree: "1eb28fcea7ced5ba2357bd32c35561a7cadc4918",
    target_policy_sha256: "a8ecbbe0706d65db12189a6e4e5c5383fdf1e6071c59e1f0931009aa67eca32a",
    capability_descriptor_sha256: "0abd3c555771006749eaa59604c69e37090d32ea738eeb588dbb36423d1a2fb5",
  });
  assertExactKeys(PROOF.authority, [
    "authorization_id", "consumption_id", "authorized_at", "valid_from", "valid_until", "consumed_at", "claimed_at",
    "permanently_consumed", "current_effective_authorization",
  ], "authority");
  assert.deepEqual(PROOF.authority, {
    authorization_id: "auth_m4_sec_gate_b_attempt2_4d6faf2e4ef34cda89fea785b15fa2a1",
    consumption_id: "consume_m4_sec_gate_b_attempt2_336f9ca5d5c04612aa72916e2b7aebb9",
    authorized_at: "2026-07-14T18:38:46.520Z",
    valid_from: "2026-07-14T18:38:46.520Z",
    valid_until: "2026-07-14T18:48:46.520Z",
    consumed_at: "2026-07-14T18:41:10.970Z",
    claimed_at: "2026-07-14T18:41:10.976Z",
    permanently_consumed: true,
    current_effective_authorization: "none",
  });
  assertExactKeys(PROOF.execution, [
    "started_at", "fetched_at", "completed_at", "retention_until", "http_status", "mime", "response_bytes",
    "response_sha256", "trust_status",
  ], "execution");
  assert.deepEqual(PROOF.execution, {
    started_at: "2026-07-14T18:41:10.986Z",
    fetched_at: "2026-07-14T18:41:11.214Z",
    completed_at: "2026-07-14T18:41:11.277Z",
    retention_until: "2026-08-13T18:41:11.277Z",
    http_status: 200,
    mime: "application/json",
    response_bytes: 160901,
    response_sha256: "ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d",
    trust_status: "quoted_untrusted_public_source_content",
  });
  assertExactKeys(PROOF.effect_accounting, [
    "dns_attempts", "lookup_callbacks", "request_attempts", "connection_attempts", "redirects", "retries",
    "provider_calls", "private_reads", "graph_writes", "production_writes", "deployments",
  ], "effect accounting");
  assert.deepEqual(PROOF.effect_accounting, {
    dns_attempts: 1,
    lookup_callbacks: 1,
    request_attempts: 1,
    connection_attempts: 1,
    redirects: 0,
    retries: 0,
    provider_calls: 0,
    private_reads: 0,
    graph_writes: 0,
    production_writes: 0,
    deployments: 0,
  });
  assertExactKeys(PROOF.workshop, [
    "artifact", "bytes", "sha256", "visible_evidence", "source_field", "source_url", "cik", "publisher",
    "visible_trust_label",
  ], "workshop");
  assertExactKeys(PROOF.verified_artifact_identity, [
    "draft", "final_go", "consumption_record", "execution_claim", "sanitized_attempt_receipt",
    "private_exact_byte_custody", "public_workshop", "private_execution_report",
  ], "verified artifact identity");
  for (const [name, identity] of Object.entries(PROOF.verified_artifact_identity)) {
    assertExactKeys(identity, ["mode", "bytes", "sha256"], `verified artifact identity ${name}`);
  }
  assert.deepEqual(PROOF.verified_artifact_identity, {
    draft: { mode: "0600", bytes: 5228, sha256: "557e102d77164b33abea651f2eaf41664c0e3a835afae56615c3f30d536d5bee" },
    final_go: { mode: "0600", bytes: 2064, sha256: "0067ad07078fbfff4d1a99fb75f9487d916098e70054afb088ed2a9fef4b83d0" },
    consumption_record: { mode: "0600", bytes: 711, sha256: "445ec4ad2f30a135682f507a3365d81f2c02ee9de7457ab75af3809b76bb8a23" },
    execution_claim: { mode: "0600", bytes: 514, sha256: "e91dd64f8653037d081a8870fc233f76c0f148c0d5a2be08e1f5bbb86df09147" },
    sanitized_attempt_receipt: { mode: "0600", bytes: 5470, sha256: "824a611f5396530e0811c62f24b21433f95dc98a57f411d072bee6bf4320d9ac" },
    private_exact_byte_custody: { mode: "0600", bytes: 407195, sha256: "c368ea513220a207ef839b30dd527522a6a76304705c88d7243b64bb6f13eb1f" },
    public_workshop: { mode: "0600", bytes: 2181, sha256: "9e974aeb57c53a49ff75406ae4276b08b168613da2f03bbaa761859a2dc880eb" },
    private_execution_report: { mode: "0600", bytes: 3293, sha256: "c8a57d1a0cfb27f62aaf7f30edb09363609a37cd2eec4b9e19cfa40172d3f4e5" },
  });
  assertExactKeys(PROOF.attempt_1_preservation, [
    "outcome", "permanently_consumed", "byte_identical", "go_sha256", "consumption_sha256",
    "execution_claim_sha256", "execution_report_sha256", "attempt_receipt_sha256", "custody_tombstone_bytes",
    "custody_tombstone_sha256", "workshop_tombstone_bytes", "workshop_tombstone_sha256",
  ], "attempt 1 preservation");
  assert.deepEqual(PROOF.attempt_1_preservation, {
    outcome: "failed_no_evidence",
    permanently_consumed: true,
    byte_identical: true,
    go_sha256: "c2e62706575553dca3fd42135552960de325212ae76afc54b42337f31551369f",
    consumption_sha256: "774a0302f6ab377eb3d1bd5e8072ac31b84a5533510418122f06abe1bc9a1de1",
    execution_claim_sha256: "667c7b477dcb69948dccaf970cf1ec24f1327ed82a5f8b7f67d60aa541659bdc",
    execution_report_sha256: "c39c15197e0d194f21d33f700a43cde700ad8edf3d3d58c7a94783425b5b1809",
    attempt_receipt_sha256: "84a3c781b65e3b1aabde4a49a06490783cbd24c55026803416a525897507a2cc",
    custody_tombstone_bytes: 0,
    custody_tombstone_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    workshop_tombstone_bytes: 0,
    workshop_tombstone_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  });
  assertExactKeys(PROOF.privacy, [
    "raw_user_agent_occurrences", "raw_mailbox_occurrences", "commits_response_bytes_or_base64_custody",
    "commits_private_absolute_paths", "commits_resolved_ip_addresses",
  ], "privacy");
  assert.deepEqual(PROOF.privacy, {
    raw_user_agent_occurrences: 0,
    raw_mailbox_occurrences: 0,
    commits_response_bytes_or_base64_custody: false,
    commits_private_absolute_paths: false,
    commits_resolved_ip_addresses: false,
  });
  assertExactKeys(PROOF.boundaries, [
    "current_effective_authorization", "authorizes_live_acquisition", "authorizes_retry", "authorizes_provider_call",
    "authorizes_private_evidence_read", "authorizes_graph_ingestion", "authorizes_production_write",
    "authorizes_deployment", "authorizes_h3", "authorizes_m5b", "readiness_claim", "next_recommended_work",
  ], "boundaries");
  assert.deepEqual(PROOF.boundaries, {
    current_effective_authorization: "none",
    authorizes_live_acquisition: false,
    authorizes_retry: false,
    authorizes_provider_call: false,
    authorizes_private_evidence_read: false,
    authorizes_graph_ingestion: false,
    authorizes_production_write: false,
    authorizes_deployment: false,
    authorizes_h3: false,
    authorizes_m5b: false,
    readiness_claim: false,
    next_recommended_work: "separate_explicit_M5b_decision",
  });
});

test("sanitized proof chronology is exact and internally consistent", () => {
  const authorizedAt = Date.parse(PROOF.authority.authorized_at);
  const validFrom = Date.parse(PROOF.authority.valid_from);
  const validUntil = Date.parse(PROOF.authority.valid_until);
  const consumedAt = Date.parse(PROOF.authority.consumed_at);
  const claimedAt = Date.parse(PROOF.authority.claimed_at);
  const startedAt = Date.parse(PROOF.execution.started_at);
  const fetchedAt = Date.parse(PROOF.execution.fetched_at);
  const completedAt = Date.parse(PROOF.execution.completed_at);
  const retentionUntil = Date.parse(PROOF.execution.retention_until);
  for (const [name, timestamp] of Object.entries({
    authorizedAt, validFrom, validUntil, consumedAt, claimedAt, startedAt, fetchedAt, completedAt, retentionUntil,
  })) {
    assert.ok(Number.isFinite(timestamp), `${name} must be a valid timestamp`);
  }
  assert.equal(authorizedAt, validFrom);
  assert.equal(validUntil - validFrom, 600_000);
  assert.ok(consumedAt >= validFrom && consumedAt < validUntil, "consumption must occur inside the validity window");
  assert.ok(claimedAt >= validFrom && claimedAt < validUntil, "claim must occur inside the validity window");
  assert.ok(claimedAt > consumedAt, "claim must follow consumption");
  assert.ok(startedAt > claimedAt, "execution start must follow claim");
  assert.ok(fetchedAt > startedAt, "fetch must follow execution start");
  assert.ok(completedAt > fetchedAt, "completion must follow fetch");
  assert.equal(retentionUntil - completedAt, 30 * 24 * 60 * 60 * 1000);
});

test("the committed Workshop is the exact visible success artifact", () => {
  assert.equal(Buffer.byteLength(WORKSHOP, "utf8"), 2181);
  assert.equal(createHash("sha256").update(WORKSHOP, "utf8").digest("hex"),
    "9e974aeb57c53a49ff75406ae4276b08b168613da2f03bbaa761859a2dc880eb");
  for (const visible of [
    "SEC evidence preview",
    "Quoted/untrusted public-source content — Unverified",
    "Air Courier Services",
    "/sicDescription",
    "https://data.sec.gov/submissions/CIK0001048911.json",
    "0001048911",
    "U.S. Securities and Exchange Commission",
    "ab73030ea6e7fc8aa82d2e560988dec769f1f432b2a7648be986505893b22c3d",
    "Transport success does not verify source claims. No graph ingestion was performed.",
  ]) {
    assert.ok(WORKSHOP.includes(visible), `Workshop missing ${visible}`);
    assert.ok(RETRO.includes(visible), `retro missing ${visible}`);
  }
  assert.deepEqual(PROOF.workshop, {
    artifact: WORKSHOP_PATH,
    bytes: 2181,
    sha256: "9e974aeb57c53a49ff75406ae4276b08b168613da2f03bbaa761859a2dc880eb",
    visible_evidence: "Air Courier Services",
    source_field: "/sicDescription",
    source_url: "https://data.sec.gov/submissions/CIK0001048911.json",
    cik: "0001048911",
    publisher: "U.S. Securities and Exchange Commission",
    visible_trust_label: "Quoted/untrusted public-source content — Unverified",
  });
});

test("attempt history stays truthful across failure, repair, and success", () => {
  for (const document of [RETRO, RUNBOOK]) {
    assert.match(document, /attempt 1 remains byte-identical and permanently consumed/i);
    assert.match(document, /failed_no_evidence/);
    assert.match(document, /zero-byte.*tombstones/i);
    assert.match(document, /PR #287/);
    assert.match(document, /family: 4/);
    assert.match(document, /autoSelectFamily: false/);
    assert.match(document, /attempt 2/i);
    assert.match(document, /HTTP status: `200`/);
    assert.match(document, /response bytes: `160,901`/);
    assert.match(document, /redirects: `0`/);
    assert.match(document, /retries: `0`/);
  }
  assert.equal(PROOF.attempt_1_preservation.outcome, "failed_no_evidence");
  assert.equal(PROOF.attempt_1_preservation.permanently_consumed, true);
  assert.equal(PROOF.attempt_1_preservation.byte_identical, true);
  assert.equal(PROOF.attempt_1_preservation.custody_tombstone_bytes, 0);
  assert.equal(PROOF.attempt_1_preservation.custody_tombstone_sha256,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(PROOF.attempt_1_preservation.workshop_tombstone_bytes, 0);
  assert.equal(PROOF.attempt_1_preservation.workshop_tombstone_sha256,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.match(ROADMAP, /Attempt 2 consumed its separately granted one-shot live authority/);
  assert.match(ROADMAP, /Attempts 1 and 2 are both permanently consumed/);
  assert.doesNotMatch(ROADMAP, /only live authority granted for M4/);
});

test("M4 becomes shipped upon merge while every future effect remains closed", () => {
  const m4 = tableRow(ROADMAP, "M4 — Evidence acquisition v1");
  const m5b = tableRow(ROADMAP, "M5b — Does-its-job-once, system-acquired sources");
  assert.ok(m4.includes("✅ shipped upon closeout merge"));
  assert.ok(m4.includes(WORKSHOP_PATH));
  assert.ok(m4.includes(PROOF_PATH));
  assert.ok(m4.includes(RETRO_PATH));
  assert.ok(m5b.includes("⬜ not started"));

  for (const document of [RETRO, RUNBOOK, ROADMAP, INDEX]) {
    assert.equal(markerValue(document, "current_effective_authorization"), "none");
  }
  assert.equal(markerValue(ROADMAP, "implementation_work_authorized"), "none");
  assert.equal(markerValue(ROADMAP, "implementation_start_condition"), "none");
  assert.equal(markerValue(RETRO, "implementation_work_authorized"), "none");
  assert.equal(markerValue(RETRO, "next_recommended_work"), "separate explicit M5b decision");
  assert.equal(markerValue(RUNBOOK, "next_recommended_work"), "separate explicit M5b decision");
  assert.match(INDEX, /next recommended work: separate explicit M5b decision after the M4 closeout merges/);
  assert.equal(PROOF.boundaries.current_effective_authorization, "none");
  assert.equal(PROOF.boundaries.next_recommended_work, "separate_explicit_M5b_decision");
  assert.match(read(BLOCKERS_PATH), /current next recommended work is only a separate explicit M5b decision/i);
  assert.match(read(GATE3_PATH), /current repository-level next recommendation is only a separate explicit M5b decision/i);
  assert.match(INDEX, /current repository-level recommendation is only the separate explicit M5b decision/i);
  assert.doesNotMatch(INDEX, /live M5a-vs-M4 sequencing decision/);
  assert.doesNotMatch(ROADMAP, /queued behind H2|queued behind H3/);
  for (const key of [
    "authorizes_live_acquisition", "authorizes_retry", "authorizes_provider_call", "authorizes_private_evidence_read",
    "authorizes_graph_ingestion", "authorizes_production_write", "authorizes_deployment", "authorizes_h3",
    "authorizes_m5b", "readiness_claim",
  ]) {
    assert.equal(PROOF.boundaries[key], false, `${key} must remain false`);
  }
});

test("closeout commits no private custody, contact, path, or resolved-address material", () => {
  for (const relative of CLOSEOUT_PATHS) {
    const document = read(relative);
    assert.doesNotMatch(document, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, `${relative} contains an email address`);
    assert.ok(!document.includes("/home/"), `${relative} contains a private absolute path`);
    for (const address of document.match(/(?:\d{1,3}\.){3}\d{1,3}/g) ?? []) {
      assert.equal(address, "127.0.0.1", `${relative} contains a non-loopback IPv4 address`);
    }
    assert.doesNotMatch(document, /"bodyBase64"|"quotedBodyText"/, `${relative} contains custody body fields`);
  }
  assert.equal(PROOF.privacy.raw_user_agent_occurrences, 0);
  assert.equal(PROOF.privacy.raw_mailbox_occurrences, 0);
  assert.equal(PROOF.privacy.commits_response_bytes_or_base64_custody, false);
  assert.equal(PROOF.privacy.commits_private_absolute_paths, false);
  assert.equal(PROOF.privacy.commits_resolved_ip_addresses, false);
});

test("retro presents exactly five bounded product questions", () => {
  const evaluation = RETRO.split("## Five-question user evaluation guide\n", 2)[1]?.split("\n## ", 1)[0];
  assert.ok(evaluation);
  assert.equal(evaluation.match(/^\d+\. \*\*Q\d+ —/gm)?.length, 5);
  for (const label of ["Q1 — Useful", "Q2 — Grounded", "Q3 — Honest", "Q4 — Navigable", "Q5 — Worth continuing"]) {
    assert.ok(evaluation.includes(label));
  }
});
