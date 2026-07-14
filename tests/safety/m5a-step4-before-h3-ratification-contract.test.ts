import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const ROADMAP_PATH = join(ROOT, "docs", "strategy", "roadmap.md");
const DECISION_PATH = join(ROOT, "docs", "reviews", "m5a-step4-before-h3-ratification.md");
const INDEX_PATH = join(ROOT, "docs", "runbooks", "INDEX.md");

const roadmap = readFileSync(ROADMAP_PATH, "utf8");
const decision = readFileSync(DECISION_PATH, "utf8");
const index = readFileSync(INDEX_PATH, "utf8");

function section(document: string, level: "##" | "###", heading: string): string {
  const opening = `${level} ${heading}`;
  const start = document.indexOf(opening);
  assert.notEqual(start, -1, `missing section ${opening}`);

  const candidateEnds = [document.indexOf(`\n${level} `, start + opening.length)];
  if (level === "###") candidateEnds.push(document.indexOf("\n## ", start + opening.length));
  const existingEnds = candidateEnds.filter((index) => index !== -1);
  const end = existingEnds.length === 0 ? document.length : Math.min(...existingEnds);
  return document.slice(start, end);
}

function tableRow(document: string, label: string): string {
  const rows = document.split("\n").filter((line) => line.startsWith(`| **${label}`));
  assert.equal(rows.length, 1, `expected exactly one table row for ${label}`);
  return rows[0]!;
}

function markerValue(block: string, key: string): string {
  const prefix = `- ${key}: `;
  const matches = block
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());

  assert.equal(matches.length, 1, `expected exactly one ${key} marker in the scoped block`);
  return matches[0]!;
}

test("roadmap records M5a shipped with its visible artifact and closeout successor surface", () => {
  const row = tableRow(roadmap, "M5a — Doctrine-loop proof, curated public sources");

  assert.ok(row.includes("✅ shipped"), "M5a status must be shipped after its closeout");
  assert.ok(row.includes("PRs #278 (`6205c4a`)"), "M5a Step 1 merge must be anchored");
  assert.ok(row.includes("#279 (`d09ac17`)"), "M5a Step 2 merge must be anchored");
  assert.ok(row.includes("#280 (`dc0381f`)"), "M5a Step 3 merge must be anchored");
  assert.ok(row.includes("Step 4 merged through PR #282 (`9661468`)"), "Step 4 merge must be recorded");
  assert.ok(row.includes("fixtures/workshop/m5a-curated-proposal-flow-capstone.html"), "visible artifact must be named");
  assert.ok(row.includes("docs/reviews/m5a-product-closeout-retro.md"), "closeout successor surface must be named");
  assert.doesNotMatch(row, /Step 4 is next/i, "implemented Step 4 must not remain described as next");
  assert.doesNotMatch(row, /not started/i, "the shipped M5a row must not retain its stale status");
});

test("product-track ordering remains M3 to M5a to M4 to M5b", () => {
  const roadmapSequence = section(roadmap, "###", "Default sequence (burden of proof on reordering)");
  const rationale = section(decision, "##", "Ratified rationale");

  assert.ok(
    roadmapSequence.includes(
      "M3 → M5a (loop proof, curated public sources) → M4 (acquisition capstone) → M5b (does-its-job-once, system-acquired sources)",
    ),
    "roadmap must preserve the expanded product-track sequence",
  );
  assert.ok(
    rationale.includes("The product-track sequence remains **M3 → M5a → M4 → M5b**."),
    "ratification must preserve the compact product-track sequence",
  );
});

test("operator ratification selected Step 4 before H3 and the living roadmap preserves that history", () => {
  const provenance = section(decision, "##", "Decision provenance");
  const currentSlice = section(roadmap, "###", "M5a shipped: visible capstone and bounded successor approval");

  assert.ok(provenance.includes("earlier **agent recommendation**"), "agent recommendation must be attributable");
  assert.ok(provenance.includes("was advisory"), "agent recommendation must be explicitly non-authoritative");
  assert.ok(provenance.includes("was not operator ratification"), "agent recommendation must not be conflated with ratification");
  assert.ok(provenance.includes("**operator ratification**"), "operator ratification must be attributable");
  assert.ok(provenance.includes("supersedes that recommendation"), "current ratification must supersede the old queue");
  assert.ok(
    provenance.includes("M5a Step 4 is the next implementation slice"),
    "the historical ratification must preserve the selected Step 4 sequence",
  );
  assert.ok(
    currentSlice.includes("before H3 implementation unless a concrete safety blocker emerged"),
    "the historical Step 4-before-H3 sequence must remain attributable",
  );
  assert.ok(currentSlice.includes("implemented through PR #282"), "living status must record Step 4 implementation");
  assert.match(currentSlice, /M4 has now completed one separately authorized acquisition and its own visible closeout/i);
});

test("H3 plan state and H1/H3 sequencing are reconciled without rewriting history", () => {
  const hTrackNarrative = section(roadmap, "###", "H-track sequencing after the freeze");
  const h1Row = tableRow(roadmap, "H1 — Approvals as typed data");
  const h2Row = tableRow(roadmap, "H2 — Capability registry + CapabilityExecution records + mediation gate skeleton (L0 only) + audit/accounting extension");
  const h3Row = tableRow(roadmap, "H3 — Snapshot-primitive consolidation + negative-control automation");

  assert.ok(hTrackNarrative.includes("H3's plan is complete and merged through PR #277"), "H3 plan must be complete and merged");
  assert.ok(
    hTrackNarrative.includes("selected the separate H2 no-network capability-registry/mediation/echo proof"),
    "the roadmap must preserve the closeout's H2 selection",
  );
  assert.ok(hTrackNarrative.includes("working proof is now implemented"), "the roadmap must record the completed H2 proof");
  assert.ok(h1Row.includes("not next-up"), "H1 must not become a standalone next slice");
  assert.ok(h2Row.includes("✅ shipped"), "H2 must record the working proof as shipped");
  assert.ok(h2Row.includes("fixtures/validation/h2-echo-mediation-proof.json"), "H2 must name its visible artifact");
  assert.ok(h2Row.includes("zero retries and zero network/acquisition/provider/private/filesystem/environment/database/subprocess/production/deployment effects"), "H2 must close retries and adjacent effects");
  assert.ok(h3Row.includes("implementation not started; plan complete/merged; not next-up"), "H3 row must distinguish plan from implementation and stay deferred");
  assert.doesNotMatch(h3Row, /next slice/i, "H3 row must not retain the stale next-slice status");
});

test("Step 4 positive scope is exactly one arming, proposal, local write, read-back, and Workshop artifact", () => {
  const roadmapScope = section(roadmap, "###", "M5a shipped: visible capstone and bounded successor approval");
  const decisionScope = section(decision, "##", "Exact Step 4 implementation boundary");

  assert.equal(markerValue(roadmapScope, "step_4_valid_armings_consumed"), "1");
  assert.equal(markerValue(roadmapScope, "step_4_recorded_curated_proposals_executed"), "1");
  assert.equal(markerValue(roadmapScope, "step_4_durable_local_writes"), "1");
  assert.equal(markerValue(roadmapScope, "step_4_durable_local_write_read_backs"), "1");
  assert.equal(markerValue(roadmapScope, "step_4_workshop_artifacts_rendered"), "1");

  assert.equal(markerValue(decisionScope, "step_4_valid_armings_consumed"), "1");
  assert.equal(markerValue(decisionScope, "step_4_recorded_curated_proposals_executed"), "1");
  assert.equal(markerValue(decisionScope, "step_4_durable_local_writes"), "1");
  assert.equal(markerValue(decisionScope, "step_4_durable_local_write_read_backs"), "1");
  assert.equal(markerValue(decisionScope, "step_4_workshop_artifacts_rendered"), "1");
});

test("Step 4 scope separately closes provider, acquisition, private-read, retry, production, deploy, and readiness paths", () => {
  const roadmapScope = section(roadmap, "###", "M5a shipped: visible capstone and bounded successor approval");
  const decisionScope = section(decision, "##", "Exact Step 4 implementation boundary");

  assert.equal(markerValue(roadmapScope, "step_4_provider_calls"), "0");
  assert.equal(markerValue(roadmapScope, "step_4_system_side_acquisitions"), "0");
  assert.equal(markerValue(roadmapScope, "step_4_private_evidence_reads"), "0");
  assert.equal(markerValue(roadmapScope, "step_4_retries"), "0");
  assert.equal(markerValue(roadmapScope, "step_4_production_writes"), "0");
  assert.equal(markerValue(roadmapScope, "step_4_deployments"), "0");
  assert.equal(markerValue(roadmapScope, "step_4_readiness_claims"), "0");

  assert.equal(markerValue(decisionScope, "step_4_provider_calls"), "0");
  assert.equal(markerValue(decisionScope, "step_4_system_side_acquisitions"), "0");
  assert.equal(markerValue(decisionScope, "step_4_private_evidence_reads"), "0");
  assert.equal(markerValue(decisionScope, "step_4_retries"), "0");
  assert.equal(markerValue(decisionScope, "step_4_production_writes"), "0");
  assert.equal(markerValue(decisionScope, "step_4_deployments"), "0");
  assert.equal(markerValue(decisionScope, "step_4_readiness_claims"), "0");
});

test("living roadmap records the completed M4 implementation slice with authority returned to none", () => {
  assert.equal(markerValue(roadmap, "implementation_work_authorized"), "none");
  assert.equal(markerValue(roadmap, "implementation_start_condition"), "none");
  assert.equal(markerValue(roadmap, "current_effective_authorization"), "none");
  assert.equal(markerValue(roadmap, "authorizes_flow_execution"), "false");
  assert.equal(markerValue(roadmap, "authorizes_durable_write_effect"), "false");
  assert.equal(markerValue(roadmap, "authorizes_provider_call"), "false");
  assert.equal(markerValue(roadmap, "authorizes_system_side_acquisition"), "false");
  assert.equal(markerValue(roadmap, "authorizes_private_evidence_read"), "false");
  assert.equal(markerValue(roadmap, "authorizes_production_write"), "false");
  assert.equal(markerValue(roadmap, "authorizes_deployment"), "false");
  assert.equal(markerValue(roadmap, "readiness_claim"), "false");
  assert.equal(markerValue(index, "current_effective_authorization"), "none");
  assert.match(roadmap, /No repeated acquisition.*M5b provider execution.*is authorized/i);
  assert.equal(markerValue(index, "ratified next bounded implementation"), "none");
  assert.match(index, /M4 is shipped upon closeout merge.*implementation authority has returned to none/i);
  assert.match(index, /live acquisition remains unauthorized/i);
});

test("the historical decision authorizes Step 4 implementation work but no execution effect", () => {
  const authority = section(decision, "##", "Authority and effect boundary");

  assert.equal(markerValue(authority, "implementation_work_authorized"), "M5a-step-4");
  assert.equal(markerValue(authority, "current_effective_authorization"), "none");
  assert.equal(markerValue(authority, "authorizes_flow_execution"), "false");
  assert.equal(markerValue(authority, "authorizes_durable_write_effect"), "false");
  assert.equal(markerValue(authority, "authorizes_provider_call"), "false");
  assert.equal(markerValue(authority, "authorizes_system_side_acquisition"), "false");
  assert.equal(markerValue(authority, "authorizes_private_evidence_read"), "false");
  assert.equal(markerValue(authority, "authorizes_retry"), "false");
  assert.equal(markerValue(authority, "retry_budget"), "0");
  assert.equal(markerValue(authority, "retry_requires_new_approval"), "true");
  assert.equal(markerValue(authority, "authorizes_production_write"), "false");
  assert.equal(markerValue(authority, "authorizes_deployment"), "false");
  assert.equal(markerValue(authority, "authorizes_graph_ingestion"), "false");
  assert.equal(markerValue(authority, "decision_flow_executions_performed"), "0");
  assert.equal(markerValue(authority, "decision_durable_writes_performed"), "0");
  assert.equal(markerValue(authority, "decision_durable_read_backs_performed"), "0");
  assert.equal(markerValue(authority, "decision_workshop_artifacts_rendered"), "0");
  assert.equal(markerValue(authority, "readiness_claim"), "false");
  assert.equal(markerValue(authority, "production_readiness_claim"), "false");
  assert.equal(markerValue(authority, "product_readiness_claim"), "false");
  assert.equal(markerValue(authority, "launch_readiness_claim"), "false");
});
