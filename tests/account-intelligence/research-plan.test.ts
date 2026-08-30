import assert from "node:assert/strict";
import test from "node:test";

import { ACCOUNT_RESEARCH_TAXONOMY } from "../../src/account-intelligence/contracts.ts";
import { createAccountResearchPlan, snapshotAccountResearchRequest } from "../../src/account-intelligence/research-plan.ts";
import { makeC2FixtureInput } from "../fixtures/c2-account-intelligence.ts";

test("generic taxonomy adapts to account input without changing product code", () => {
  const utah = makeC2FixtureInput({ accountId: "acct-utah-eval", accountName: "University of Utah", domain: "utah.edu" }).request;
  const fedex = makeC2FixtureInput({ accountId: "acct-fedex-eval", accountName: "FedEx Corporation", domain: "fedex.com" }).request;
  const utahPlan = createAccountResearchPlan(utah);
  const fedexPlan = createAccountResearchPlan(fedex);
  assert.deepEqual(utahPlan.priorities, ACCOUNT_RESEARCH_TAXONOMY);
  assert.deepEqual(fedexPlan.priorities, ACCOUNT_RESEARCH_TAXONOMY);
  assert.equal(utahPlan.queries.length, 10);
  assert.equal(fedexPlan.queries.length, 10);
  assert.notEqual(utahPlan.generatedFromRequestSha256, fedexPlan.generatedFromRequestSha256);
  assert.notDeepEqual(utahPlan.queries.map((item) => item.query), fedexPlan.queries.map((item) => item.query));
  assert.ok(utahPlan.queries.every((item) => item.query.includes("University of Utah") && item.query.includes("site:utah.edu")));
  assert.ok(fedexPlan.queries.every((item) => item.query.includes("FedEx Corporation") && item.query.includes("site:fedex.com")));
  assert.deepEqual(utahPlan.queries.map((item) => item.taxonomy), fedexPlan.queries.map((item) => item.taxonomy));
});

test("account request rejects unsafe domains, impossible dates, extra fields, and accessors", () => {
  const base = makeC2FixtureInput().request;
  assert.throws(() => snapshotAccountResearchRequest({ ...base, canonicalPublicDomains: ["localhost"] }), /canonicalPublicDomains refused/u);
  assert.throws(() => snapshotAccountResearchRequest({ ...base, requestedAt: "2026-02-30T00:00:00.000Z" }), /strict ISO/u);
  assert.throws(() => snapshotAccountResearchRequest({ ...base, extra: true }), /fields must exactly match/u);
  const hostile = { ...base } as Record<string, unknown>;
  Object.defineProperty(hostile, "accountName", { enumerable: true, get: () => "getter ran" });
  assert.throws(() => snapshotAccountResearchRequest(hostile), /own-data|accessor/u);
});

test("request arrays are bounded, unique, and immutable after snapshot", () => {
  const base = makeC2FixtureInput().request;
  assert.throws(() => snapshotAccountResearchRequest({ ...base, knownAliases: ["Same", "same"] }), /unique/u);
  assert.throws(() => snapshotAccountResearchRequest({ ...base, canonicalPublicDomains: Array.from({ length: 9 }, (_, i) => `a${String(i)}.example.org`) }), /bounded/u);
  const snap = snapshotAccountResearchRequest(base);
  assert.ok(Object.isFrozen(snap));
  assert.ok(Object.isFrozen(snap.canonicalPublicDomains));
});
