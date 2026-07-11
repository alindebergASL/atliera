import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const RETRO = readFileSync(join(ROOT, "docs", "reviews", "m5a-product-closeout-retro.md"), "utf8");
const ROADMAP = readFileSync(join(ROOT, "docs", "strategy", "roadmap.md"), "utf8");
const INDEX = readFileSync(join(ROOT, "docs", "runbooks", "INDEX.md"), "utf8");
const HTML_PATH = "fixtures/workshop/m5a-curated-proposal-flow-capstone.html";
const HTML = readFileSync(join(ROOT, HTML_PATH), "utf8");
const HTML_TEXT = HTML.replaceAll("&#39;", "'");

function markerValue(document: string, key: string): string {
  const prefix = `- ${key}: `;
  const matches = document
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
  assert.equal(matches.length, 1, `expected exactly one ${key} marker`);
  return matches[0]!;
}

function tableRow(document: string, label: string): string {
  const rows = document.split("\n").filter((line) => line.startsWith(`| **${label}`));
  assert.equal(rows.length, 1, `expected exactly one table row for ${label}`);
  return rows[0]!;
}

test("M5a ships only with its visible capstone and bounded successor approval surface", () => {
  const m5a = tableRow(ROADMAP, "M5a — Doctrine-loop proof, curated public sources");
  const h2 = tableRow(ROADMAP, "H2 — Capability registry + CapabilityExecution records + mediation gate skeleton (L0 only) + audit/accounting extension");
  const m4 = tableRow(ROADMAP, "M4 — Evidence acquisition v1");

  assert.ok(m5a.includes("✅ shipped"));
  assert.ok(m5a.includes(HTML_PATH));
  assert.ok(m5a.includes("docs/reviews/m5a-product-closeout-retro.md"));
  assert.ok(h2.includes("✅ shipped"));
  assert.ok(h2.includes("fixtures/validation/h2-echo-mediation-proof.json"));
  assert.ok(h2.includes("first registered inert echo"));
  assert.ok(h2.includes("one `CapabilityExecution`, one `AuditEvent`, and one accounting increment"));
  assert.ok(h2.includes("I-3, I-4, I-5, I-10 and I-11"));
  assert.ok(h2.includes("reviewed second entry"));
  assert.ok(m4.includes("🔶 in progress"));
  assert.ok(m4.includes("implementation slice complete, not shipped"));
  assert.ok(m4.includes("zero live egress"));

  assert.equal(markerValue(ROADMAP, "implementation_work_authorized"), "none");
  assert.equal(markerValue(ROADMAP, "implementation_start_condition"), "completed-after-H2-merge-and-verification");
  assert.equal(markerValue(ROADMAP, "current_effective_authorization"), "none");
  assert.equal(markerValue(ROADMAP, "authorizes_flow_execution"), "false");
  assert.equal(markerValue(ROADMAP, "authorizes_provider_call"), "false");
  assert.equal(markerValue(ROADMAP, "authorizes_system_side_acquisition"), "false");
  assert.equal(markerValue(ROADMAP, "authorizes_production_write"), "false");
  assert.equal(markerValue(ROADMAP, "authorizes_deployment"), "false");
  assert.equal(markerValue(ROADMAP, "readiness_claim"), "false");
  assert.equal(markerValue(INDEX, "current_effective_authorization"), "none");
  assert.equal(markerValue(INDEX, "ratified next bounded implementation"), "none");
  assert.match(INDEX, /M4 implementation slice is complete/i);
  assert.match(INDEX, /live acquisition remains unauthorized/i);

  for (const document of [RETRO, ROADMAP, INDEX]) {
    assert.doesNotMatch(document, /H2-minimum-mediation-plus-M4-public_http_fetch_v1/);
  }

  for (const requiredH2Proof of [
    "inert echo as the first capability",
    "orchestrator-only with topology/import isolation",
    "consumed approval or approved schedule",
    "descriptor and pin its hash",
    "invocation-time descriptor hash",
    "retry budget of zero",
    "one `CapabilityExecution`, one `AuditEvent`, and one accounting increment",
    "I-3, I-4, I-5, I-10 and I-11",
  ]) {
    assert.ok(RETRO.includes(requiredH2Proof), `retro missing mandatory H2 proof: ${requiredH2Proof}`);
  }

  assert.equal(markerValue(RETRO, "current_effective_authorization"), "none");
  assert.equal(markerValue(RETRO, "authorizes_system_side_acquisition"), "false");
  assert.equal(markerValue(RETRO, "authorizes_provider_call"), "false");
  assert.equal(markerValue(RETRO, "authorizes_private_evidence_read"), "false");
  assert.equal(markerValue(RETRO, "authorizes_production_write"), "false");
  assert.equal(markerValue(RETRO, "authorizes_deployment"), "false");
  assert.equal(markerValue(RETRO, "authorizes_m5b_provider_execution"), "false");
  assert.equal(markerValue(RETRO, "readiness_claim"), "false");
});

test("the closeout tells Andrew exactly how to view and evaluate the visible product artifact", () => {
  assert.ok(RETRO.includes(HTML_PATH));
  assert.ok(RETRO.includes("npm run workshop:m5a-capstone"));
  assert.ok(RETRO.includes("python3 -m http.server 4173 --bind 127.0.0.1 --directory fixtures/workshop"));
  assert.ok(RETRO.includes("http://127.0.0.1:4173/m5a-curated-proposal-flow-capstone.html"));
  assert.match(RETRO, /Optional local reproduction check/);
  const evaluation = RETRO.split("## Five-question user evaluation guide\n", 2)[1]?.split("\n## ", 1)[0];
  assert.ok(evaluation, "missing bounded five-question evaluation section");
  assert.equal(evaluation.match(/^\d+\. \*\*Q\d+ —/gm)?.length, 5, "evaluation guide must contain exactly five numbered questions");
  for (const question of ["Q1 — Useful", "Q2 — Grounded", "Q3 — Honest", "Q4 — Navigable", "Q5 — Worth continuing"]) {
    assert.ok(evaluation.includes(question), `missing evaluation prompt: ${question}`);
  }
});

test("the shipped artifact visibly contains grounded intelligence in all three Workshop lenses", () => {
  for (const visible of [
    "2 sources",
    "3 claims",
    "3 graph objects",
    "0 verified objects",
    "Signals",
    "Maps",
    "Plays",
    "Regional fulfillment capacity expanded",
    "Network operations leader identified",
    "Prepare for a healthcare lane planning session",
    "Source-backed",
    "Curated public source",
    "1 accepted excerpt",
  ]) {
    assert.ok(HTML.includes(visible), `artifact missing visible product fact: ${visible}`);
  }

  for (const groundedDetail of [
    "Northstar expands its regional fulfillment network",
    "Northstar introduces healthcare lane planning sessions",
    "Northstar Logistics opened two regional fulfillment centers in June 2026.",
    "Maya Chen is Northstar's vice president of network operations.",
    "Northstar also named Maya Chen vice president of network operations.",
    "Northstar plans quarterly healthcare lane planning sessions beginning in August 2026.",
    "Northstar will offer healthcare shippers a quarterly lane planning session beginning in August 2026.",
  ]) {
    assert.ok(HTML_TEXT.includes(groundedDetail), `artifact missing grounded detail: ${groundedDetail}`);
    assert.ok(RETRO.includes(groundedDetail), `retro missing grounded detail: ${groundedDetail}`);
  }
});

test("the retro separates the accepted fixture proof from still-unproven real acquisition and model work", () => {
  assert.match(RETRO, /What M5a proved/);
  assert.match(RETRO, /What remains unproven/);
  assert.match(RETRO, /fictional Northstar Logistics account/i);
  assert.match(RETRO, /no Atliera HTTP acquisition occurred/i);
  assert.match(RETRO, /FedEx/);
  assert.match(RETRO, /provider\/model execution remains unauthorized/i);
  assert.match(RETRO, /one explicit operator GO/i);
});
