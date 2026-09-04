import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const REPO = new URL("../..", import.meta.url).pathname;
const ROOT = join(REPO, "docs", "ux", "c2-governed-account-intelligence-refresh");
const ROADMAP = join(REPO, "docs", "strategy", "roadmap.md");

function markerValue(document: string, key: string): string {
  const prefix = `- ${key}: `;
  const values = document.split("\n").filter((line) => line.startsWith(prefix)).map((line) => line.slice(prefix.length).trim());
  assert.equal(values.length, 1, `expected exactly one ${key} marker`);
  return values[0]!;
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, "utf8"));
}

test("C2 closeout binds the merged implementation and preserves the closed effect boundary", async () => {
  const status = await readJson(join(ROOT, "CURRENT_STATUS.json"));

  assert.equal(status.kind, "atliera.c2-governed-account-intelligence.current-status");
  assert.equal(status.schemaVersion, "1");
  assert.equal(status.statusUponCloseoutMerge, "shipped");
  assert.equal(status.implementationMerged, true);
  assert.equal(status.implementationPullRequest, 315);
  assert.equal(status.approvedImplementationHead, "36afe9429fb5ccfca76157cf87f7e8285938bd43");
  assert.equal(status.approvedImplementationTree, "0edcb95aa304e2df608fd39658058ee6b6598a79");
  assert.equal(status.implementationMergeCommit, "a6e723485b7695c4e73c2cf11f1871bd9a8ea22b");
  assert.equal(status.proposalReviewState, "needs_review");
  assert.equal(status.statusMeaning, "execution completeness only; not content approval");
  assert.equal(status.ownerDisposition, "pending");
  assert.equal(status.c3Eligibility, "blocked_pending_continue");
  assert.equal(status.exactSingleHeadProviderToRenderProof, false);
  assert.deepEqual(status.providerAccounting, {
    authorizationSlug: "c2-fresh-retained-two-account-20260829",
    authorizationBudgetConsumed: 4,
    authorizationBudgetCap: 4,
    actualProviderCallsExecuted: 3,
    validatedSelectedOutputs: 2,
    rejectedOutputs: 1,
    correctionCallsExecuted: 0,
    additionalCallsAuthorized: 0,
    failedReservationsPreProvider: 1,
    perAccountFooterCountingRule: "selected-output calls only",
  });
  assert.deepEqual(status.effects, {
    databaseWrites: 0,
    graphWrites: 0,
    persistenceWrites: 0,
    deployments: 0,
    publications: 0,
    customerActions: 0,
  });
  assert.equal(status.currentEffectiveAuthorization, "none");
});

test("C2 closeout keeps human review distinct from approval and grants no successor effect", async () => {
  const [closeout, roadmap] = await Promise.all([
    readFile(join(REPO, "docs", "reviews", "c2-governed-account-intelligence-closeout-retro.md"), "utf8"),
    readFile(ROADMAP, "utf8"),
  ]);

  assert.match(closeout, /needs_review/u);
  assert.match(closeout, /current_effective_authorization: none/u);
  assert.match(closeout, /implementation_work_authorized: none/u);
  assert.match(closeout, /authorizes_provider_call: false/u);
  assert.match(closeout, /authorizes_private_evidence_read: false/u);
  assert.match(closeout, /authorizes_graph_or_database_write: false/u);
  assert.match(closeout, /authorizes_persistence_or_ratification: false/u);
  assert.match(closeout, /authorizes_deployment: false/u);
  assert.match(closeout, /authorizes_publication_or_customer_action: false/u);
  assert.match(closeout, /readiness_claim: false/u);
  assert.match(closeout, /separate explicit C3 decision/u);
  assert.match(closeout, /not a single-head two-account provider-to-render proof/iu);
  assert.match(closeout, /counts authorizations, not executed calls/u);
  assert.match(closeout, /count selected-output calls only/u);
  assert.match(closeout, /pending an explicit Continue/u);

  const prompts = [...closeout.matchAll(/^\d+\. \*\*(Useful|Grounded|Honest|Navigable|Worth continuing)\*\*/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(prompts, ["Useful", "Grounded", "Honest", "Navigable", "Worth continuing"]);

  assert.equal(markerValue(roadmap, "implementation_work_authorized"), "none");
  assert.equal(markerValue(roadmap, "implementation_start_condition"), "none");
  assert.equal(markerValue(roadmap, "current_effective_authorization"), "none");
  assert.equal(markerValue(roadmap, "authorizes_flow_execution"), "false");
  assert.equal(markerValue(roadmap, "authorizes_durable_write_effect"), "false");
  assert.equal(markerValue(roadmap, "authorizes_provider_call"), "false");
  assert.equal(markerValue(roadmap, "authorizes_system_side_acquisition"), "false");
  assert.equal(markerValue(roadmap, "authorizes_private_evidence_read"), "false");
  assert.equal(markerValue(roadmap, "authorizes_retry"), "false");
  assert.equal(markerValue(roadmap, "authorizes_production_write"), "false");
  assert.equal(markerValue(roadmap, "authorizes_graph_ingestion"), "false");
  assert.equal(markerValue(roadmap, "authorizes_deployment"), "false");
  assert.equal(markerValue(roadmap, "readiness_claim"), "false");
  assert.equal(markerValue(roadmap, "production_readiness_claim"), "false");
  assert.equal(markerValue(roadmap, "product_readiness_claim"), "false");
  assert.equal(markerValue(roadmap, "launch_readiness_claim"), "false");
  assert.equal(markerValue(roadmap, "current_authorized_future_private_reads"), "0");
  assert.equal(markerValue(roadmap, "current_authorized_future_acquisitions"), "0");
  assert.equal(markerValue(roadmap, "graph_durable_writes"), "0");
  assert.equal(markerValue(roadmap, "deployments"), "0");
  assert.equal(markerValue(roadmap, "retries"), "0");
  assert.equal(markerValue(roadmap, "current_authorized_future_external_product_effects"), "0");
  assert.equal(markerValue(roadmap, "product_provider_calls"), "0");
  assert.equal(markerValue(roadmap, "c2_provider_call_authorization_budget_consumed"), "4");
  assert.equal(markerValue(roadmap, "c2_actual_provider_calls_executed"), "3");
  assert.equal(markerValue(roadmap, "c2_validated_selected_outputs"), "2");
  assert.equal(markerValue(roadmap, "c2_additional_provider_calls_authorized"), "0");
  assert.match(roadmap, /^\| \*\*C1 — Calm read-only Account Home\*\* \| ✅ shipped \|/mu);
  assert.match(roadmap, /^\| \*\*C2 — Background Intelligence \/ AI Proposal vertical slice\*\* \| ✅ shipped upon closeout merge \|/mu);
});

test("C2 owner review surface is committed and byte-identical to its pinned hash", async () => {
  const status = await readJson(join(ROOT, "CURRENT_STATUS.json"));
  const surface = status.ownerReviewSurface;

  assert.equal(surface.file, "docs/ux/c2-governed-account-intelligence-refresh/c2-owner-content-review.html");
  const bytes = await readFile(join(REPO, surface.file));
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(digest, surface.sha256);
  const lineage = surface.surfaceLineage.map((entry: any) => entry.sha256);
  assert.deepEqual(lineage, [
    "8803991b95315ddce7e08a4ce79558a8eb1af14e571b1adbf7aa601927355911",
    "894e02b402ac69b18e2a7ae28177ba00d133813176324e0cac4ad634fdae311a",
  ]);
  assert.match(surface.surfaceLineage[0].verification, /externally reported/u);

  const surfaceHtml = bytes.toString("utf8");
  const prompts = [...surfaceHtml.matchAll(/<li><strong>(Useful|Grounded|Honest|Navigable|Worth continuing)<\/strong>/gu)]
    .map((match) => match[1]);
  assert.deepEqual(prompts, [
    "Useful", "Grounded", "Honest", "Navigable", "Worth continuing",
    "Useful", "Grounded", "Honest", "Navigable", "Worth continuing",
  ]);
});
