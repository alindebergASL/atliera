import assert from "node:assert/strict";
import test from "node:test";

import { admitAccountResearch } from "../../src/account-intelligence/admission.ts";
import { createAccountResearchPlan, snapshotAccountResearchRequest } from "../../src/account-intelligence/research-plan.ts";
import { snapshotAdmittedResearchPolicy } from "../../src/account-intelligence/research-policy.ts";
import { makeC2FixtureInput } from "../fixtures/c2-account-intelligence.ts";

test("ordinary account request cannot self-authorize official hosts or entities", () => {
  const input = makeC2FixtureInput();
  const smuggled = {
    ...input.request,
    admittedContext: {
      ...input.request.admittedContext,
      trustedOfficialHosts: [{ hostname: "attacker.example.net", allowSubdomains: true, entityIds: [input.request.accountId] }],
    },
  };
  assert.throws(() => snapshotAccountResearchRequest(smuggled), /fields must exactly match/u);
});

test("authorized research policy is snapshotted once and emits an inspectable no-write receipt", () => {
  const input = makeC2FixtureInput();
  const mutable = structuredClone(input.researchPolicy) as any;
  const snapshot = snapshotAdmittedResearchPolicy(mutable);
  mutable.trustedOfficialHosts[0].hostname = "attacker.example.net";
  mutable.admittedEntities[0].name = "Mutated entity";
  mutable.sourceCustody[0].title = "Mutated title";
  mutable.taxonomyAuthorities[0].taxonomy = "procurement";
  assert.equal(snapshot.policy.trustedOfficialHosts[0]!.hostname, input.request.canonicalPublicDomains[0]);
  assert.notEqual(snapshot.policy.admittedEntities[0]!.name, "Mutated entity");
  assert.notEqual(snapshot.policy.sourceCustody[0]!.title, "Mutated title");
  assert.notEqual(snapshot.policy.taxonomyAuthorities[0]!.taxonomy, "procurement");
  assert.match(snapshot.receipt.policySha256, /^[a-f0-9]{64}$/u);
  assert.match(snapshot.receipt.entityCatalogSha256, /^[a-f0-9]{64}$/u);
  assert.match(snapshot.receipt.sourceCustodySha256, /^[a-f0-9]{64}$/u);
  assert.match(snapshot.receipt.taxonomyAuthoritiesSha256, /^[a-f0-9]{64}$/u);
  assert.equal(snapshot.receipt.scope, "local_test_only");
  assert.equal(snapshot.receipt.authorizesPersistence, false);
  assert.equal(snapshot.receipt.authorizesPrivateSources, false);
  assert.ok(Object.isFrozen(snapshot.policy));
});

test("admission rejects a separately authorized policy for another account", () => {
  const input = makeC2FixtureInput();
  const wrong = structuredClone(input.researchPolicy) as any;
  wrong.accountId = "acct-other";
  wrong.primaryAccountEntity.entityId = "acct-other";
  wrong.admittedEntities[0].entityId = "acct-other";
  wrong.trustedOfficialHosts[0].entityIds = ["acct-other"];
  wrong.sourceCustody[0].accountId = "acct-other";
  wrong.sourceCustody[0].primaryEntityId = "acct-other";
  for (const authority of wrong.taxonomyAuthorities) authority.accountId = "acct-other";
  const policy = snapshotAdmittedResearchPolicy(wrong);
  assert.throws(() => admitAccountResearch(input.request, createAccountResearchPlan(input.request), policy,
    input.discoveries, input.retrievedSources), /policy account identity mismatch/u);
});

test("trusted host rules may reference only controller-cataloged entity ids", () => {
  const input = makeC2FixtureInput();
  const wrong = structuredClone(input.researchPolicy) as any;
  wrong.trustedOfficialHosts[0].entityIds = ["entity-invented"];
  assert.throws(() => snapshotAdmittedResearchPolicy(wrong), /cataloged entities/u);
});
