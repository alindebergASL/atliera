import assert from "node:assert/strict";
import test from "node:test";

import { admitAccountResearch } from "../../src/account-intelligence/admission.ts";
import {
  createAccountIntelligencePrompt,
  parseAccountIntelligenceModelJson,
  snapshotAccountIntelligenceProposal,
} from "../../src/account-intelligence/proposal.ts";
import { createAccountResearchPlan } from "../../src/account-intelligence/research-plan.ts";
import { makeC2FixtureInput, proposalFromModelPrompt } from "../fixtures/c2-account-intelligence.ts";

function context() {
  const input = makeC2FixtureInput();
  const plan = createAccountResearchPlan(input.request);
  const admitted = admitAccountResearch(input.request, plan, input.discoveries, input.retrievedSources);
  const prompt = createAccountIntelligencePrompt(input.request, plan, admitted.sources);
  const proposal = proposalFromModelPrompt(prompt);
  return { input, admitted, proposal };
}
function mutable<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

test("raw model boundary accepts exactly one strict JSON object only", () => {
  const c = context();
  const json = JSON.stringify(c.proposal);
  assert.equal(parseAccountIntelligenceModelJson(json, c.input.request, c.admitted.sources).accountId,
    c.input.request.accountId);
  for (const raw of [
    `\`\`\`json\n${json}\n\`\`\``,
    `${json}${json}`,
    `${json}\ntrailing`,
    `[${json}]`,
    `\ufeff${json}`,
  ]) {
    assert.throws(() => parseAccountIntelligenceModelJson(raw, c.input.request, c.admitted.sources),
      /strict JSON text|exactly one JSON object|plain object/u);
  }
});

test("model cannot supply approval, trust, ratification, durability, authorization, confidence authority, effects, or publication fields", () => {
  const c = context();
  for (const field of ["approval", "approved", "ratification", "trust", "durability", "persisted",
    "authorization", "confidenceAuthority", "effects", "publication", "published"] as const) {
    const proposal = mutable(c.proposal) as unknown as Record<string, unknown>;
    proposal[field] = field === "effects" ? { writes: 0 } : true;
    assert.throws(() => snapshotAccountIntelligenceProposal(proposal, c.input.request, c.admitted.sources),
      /fields must exactly match/u, field);
  }
  for (const field of ["approved", "validated", "ratified", "persisted", "authorized", "confidence", "published"] as const) {
    const proposal = mutable(c.proposal) as unknown as {
      establishedContext: Array<Record<string, unknown>>;
    };
    proposal.establishedContext[0]![field] = true;
    assert.throws(() => snapshotAccountIntelligenceProposal(proposal, c.input.request, c.admitted.sources),
      /fields must exactly match/u, field);
  }
});

test("hostile getters and toJSON are rejected without execution", () => {
  const c = context();
  let executions = 0;
  const proposal = mutable(c.proposal) as unknown as Record<string, unknown>;
  Object.defineProperty(proposal, "approval", {
    enumerable: true,
    get() { executions += 1; throw new Error("getter executed"); },
  });
  assert.throws(() => snapshotAccountIntelligenceProposal(proposal, c.input.request, c.admitted.sources),
    /own-data|accessor|enumerable/u);
  assert.equal(executions, 0);

  const nested = mutable(c.proposal) as unknown as { accountThesis: Record<string, unknown> };
  Object.defineProperty(nested.accountThesis, "toJSON", {
    enumerable: true,
    value: () => { executions += 1; return { approved: true }; },
  });
  assert.throws(() => snapshotAccountIntelligenceProposal(nested, c.input.request, c.admitted.sources),
    /JSON data only|fields must exactly match/u);
  assert.equal(executions, 0);
});

test("cross-account evidence and related-entity leakage fail closed", () => {
  const c = context();
  const evidence = mutable(c.proposal) as unknown as {
    establishedContext: Array<{ evidenceIds: string[] }>;
  };
  evidence.establishedContext[0]!.evidenceIds = ["evidence_other_account"];
  assert.throws(() => snapshotAccountIntelligenceProposal(evidence, c.input.request, c.admitted.sources),
    /unknown evidence/u);

  const entity = mutable(c.proposal) as unknown as {
    establishedContext: Array<{ entityIds: string[] }>;
    sourceAndEntityBoundaries: Array<{ entityId: string; boundary: string }>;
  };
  entity.establishedContext[0]!.entityIds = ["entity_other_account"];
  entity.sourceAndEntityBoundaries.push({ entityId: "entity_other_account", boundary: "Injected unrelated account." });
  assert.throws(() => snapshotAccountIntelligenceProposal(entity, c.input.request, c.admitted.sources),
    /unknown entity/u);
});
