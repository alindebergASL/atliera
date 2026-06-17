// H3 slice plan contract — locks the load-bearing claims of
// docs/runbooks/own-data-snapshot-h3-slice-plan-status.md in greppable
// form. The implementation slice does not exist yet; this test pins
// the doctrine the implementation slice will be measured against.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");
const STATUS = join(ROOT, "docs/runbooks/own-data-snapshot-h3-slice-plan-status.md");
const INDEX = join(ROOT, "docs/runbooks/INDEX.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

test("H3 slice plan status runbook exists and is plan-only", () => {
  const status = read(STATUS);
  assert.match(status, /# Own-Data Snapshot \(H3\) Slice Plan Status/);
  assert.match(status, /Status: active \(plan-only\)/);
  assert.match(status, /This PR ships the plan, not the code/);
  assert.match(status, /`src\/safety\/own-data-snapshot\.ts` does not exist in this PR/);
});

test("the three call sites are enumerated with commit provenance anchors", () => {
  const status = read(STATUS);
  // Executor — PR #271 / 91b7064
  assert.match(status, /Call site 1 — executor/);
  assert.match(status, /proposal-durable-graph-write-execution\.ts/);
  assert.match(status, /PR #271 \(M3 step 3a, squash-merged as `91b7064`\)/);
  // Reader — PR #274 / b2b7a09
  assert.match(status, /Call site 2 — reader/);
  assert.match(status, /durable-graph-snapshots-reader\.ts/);
  assert.match(status, /PR #274 \(M3 step 3b, squash-merged as `b2b7a09`\)/);
  // Render-side composer — 3b hardening cycle
  assert.match(status, /Call site 3 — render-side composer/);
  assert.match(status, /durable-state-render\.ts/);
  assert.match(status, /3b hardening cycle on PR #274/);
  assert.match(status, /`5ed3762`/);
  assert.match(status, /`f281ac0`/);
  assert.match(status, /`1150dc7`/);
  assert.match(status, /`f895fb4`/);
});

test("the union-never-intersection rule is stated verbatim as a load-bearing claim", () => {
  const status = read(STATUS);
  // The verbatim sentence the consolidated module's header must also carry.
  assert.match(
    status,
    /\*\*Union, never intersection\.\*\* The consolidated own-data-snapshot primitive refuses on the union of everything any of the three call sites currently refuses on\. Consolidation never removes a refusal\. If site A checks a condition site B does not, the consolidated primitive checks it for both\./,
  );
});

test("the per-site reject-path discipline (Adjustment 3) is named as load-bearing", () => {
  const status = read(STATUS);
  // The property must be stated as "at each call site through the
  // consolidated primitive", not just at the primitive in isolation.
  assert.match(status, /not "the primitive refuses these shapes\."/);
  assert.match(status, /each of the three call sites, now routed through the primitive, still refuses these shapes at its own boundary/);
  assert.match(status, /existing per-site regression suites continuing to exercise the boundary/);
  assert.match(status, /it may NOT relocate per-site reject-path proofs into that file/);
});

test("each Q in §3 surfaces a divergence between sites and asks for ratification", () => {
  const status = read(STATUS);
  // Q1..Q12 are the substantive ratification surface; Q13 is the no-
  // ratification-needed sanity row. The grep below confirms each Q
  // explicitly carries a ratification ask.
  for (const q of ["Q1.", "Q2.", "Q3.", "Q4.", "Q5.", "Q6.", "Q7.", "Q8.", "Q9.", "Q10.", "Q11.", "Q12."]) {
    assert.ok(status.includes(`### ${q}`), `divergence ${q} must have a heading`);
  }
  // Each ratifiable Q must contain "(R)" indicating an operator-ratifiable item.
  const ratificationBlock = status.slice(status.indexOf("### Q1."), status.indexOf("### Q13."));
  const ratificationAsks = (ratificationBlock.match(/\n- \*\*\(R\)\*\*/g) ?? []).length;
  assert.ok(ratificationAsks >= 12, `expected at least 12 ratification asks in §3, got ${ratificationAsks}`);
});

test("the four seed fixtures from the 3b hardening cycle are named in §6", () => {
  const status = read(STATUS);
  assert.match(status, /Probe 1 \(Round 1\):\*\* post-read nested mutation/);
  assert.match(status, /Probe 2 \(Round 1\):\*\* getter-backed decision artifact/);
  assert.match(status, /Probe 3 \(Round 2\):\*\* accessor-backed array index/);
  assert.match(status, /Probe 4 \(Round 3\):\*\* root-object getter/);
});

test("the implementation-slice done-criterion includes per-site equivalence statements and the at-each-call-site reject-path property", () => {
  const status = read(STATUS);
  assert.match(status, /per-site equivalence statement/);
  assert.match(status, /fail-closed at EACH of the three call sites through the consolidated primitive/);
  assert.match(status, /1,253/); // baseline must be named
});

test("the boundary markers are present and strict (no provider/private/graph/durable/production/readiness)", () => {
  const status = read(STATUS);
  for (const marker of [
    "current_effective_authorization: none",
    "authorizes_provider_call: false",
    "authorizes_private_evidence_read: false",
    "authorizes_graph_ingestion: false",
    "graph_ingestion_performed: false",
    "authorizes_durable_write_execution: false",
    "durable_write_execution_performed: false",
    "durable_writes_performed: false",
    "production_writes: false",
    "readiness_claim: false",
    "provider_calls_executed_by_this_slice: 0",
    "introduces_new_source_module: false",
    "introduces_new_runtime_behavior: false",
  ]) {
    assert.ok(status.includes(marker), `boundary marker missing: ${marker}`);
  }
});

test("the non-goals list includes the 'while I'm here' guard and names refactor-only as the implementation-slice scope", () => {
  const status = read(STATUS);
  assert.match(status, /while I'm here/);
  assert.match(status, /implementation slice is refactor-only/);
  assert.match(status, /No widening of any call site's surfaced refusal-code set/);
  assert.match(status, /No `snapshotDeep` recursive helper/);
  assert.match(status, /No reader array helper/);
});

test("§10 gates the implementation slice on operator ratification AND the live M5a-vs-M4 sequencing call", () => {
  const status = read(STATUS);
  assert.match(status, /Operator ratification of this plan/);
  assert.match(status, /M5a-vs-M4 sequencing decision/);
  assert.match(status, /This plan PR does not authorize either/);
});

test("runbook index classifies the H3 slice plan status exactly once and frames it as plan-only", () => {
  const index = read(INDEX);
  const rowCount = index.split("| `own-data-snapshot-h3-slice-plan-status.md` |").length - 1;
  assert.equal(rowCount, 1);
  const row = index
    .split("\n")
    .find((l) => l.includes("| `own-data-snapshot-h3-slice-plan-status.md` |"));
  assert.ok(row);
  assert.match(row, /active/);
  assert.match(row, /plan-only/);
  assert.match(row, /no source module/);
});
