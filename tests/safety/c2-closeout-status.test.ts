import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const REPO = new URL("../..", import.meta.url).pathname;
const ROOT = join(REPO, "docs", "ux", "c2-governed-account-intelligence-refresh");

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
  const closeout = await readFile(
    join(REPO, "docs", "reviews", "c2-governed-account-intelligence-closeout-retro.md"),
    "utf8",
  );

  assert.match(closeout, /needs_review/u);
  assert.match(closeout, /current_effective_authorization: none/u);
  assert.match(closeout, /authorizes_provider_call: false/u);
  assert.match(closeout, /authorizes_deployment: false/u);
  assert.match(closeout, /separate explicit C3 decision/u);
  assert.match(closeout, /not a single-head two-account provider-to-render proof/iu);
});
