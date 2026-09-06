import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { classifyFile, loadMap, type EffectVector } from "../../scripts/classify-change-risk.ts";
import {
  computeProposalDigest,
  validateDecisionProposal,
  verifyCeremony,
  type CeremonyManifest,
  type ExternalReview,
  type TrustedPrincipal,
  type TrustPolicy,
} from "../../scripts/verify-ceremony.ts";

const REPO = new URL("../..", import.meta.url).pathname;
const SHA = "b93f0d61122722715d2db33636cfb7828fbf3f95";
const OTHER_SHA = "c".repeat(40);
const map = loadMap(readFileSync(join(REPO, "docs/strategy/governance-tiers.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(REPO, "docs/strategy/decision-proposal.schema.json"), "utf8"));
const OWNER = { login: "atliera-owner", id: 101, type: "User" } as const;
const REVIEWER = { login: "independent-reviewer", id: 202, type: "User" } as const;
const trust: TrustPolicy = {
  repository: "alindebergASL/atliera",
  owner: OWNER,
  technicalReviewers: [REVIEWER],
};
const effects = (over: Partial<EffectVector> = {}): { effects: EffectVector } => ({
  effects: {
    privateData: false,
    providerExecution: false,
    networkOrOutbound: false,
    retryOrRecurrence: false,
    durableWrite: false,
    identityOrAuthorization: false,
    deployment: false,
    customerEffect: false,
    ...over,
  },
});

function proposal(purpose: "build-permission" | "effect-permission", decision = "Permit this bounded change.") {
  const base = {
    kind: "atliera.decision-proposal" as const,
    schemaVersion: "3" as const,
    recordId: purpose === "build-permission" ? "synthetic-build-proposal" : "synthetic-effect-proposal",
    state: "proposed" as const,
    proposedBy: "agent" as const,
    decision,
    scope: "Synthetic test-only PR #99; no production event.",
    purpose,
    proposedAt: "2026-09-05T08:30:00Z",
    ...(purpose === "effect-permission" ? { effectAxes: ["durableWrite"] } : {}),
  };
  return { ...base, proposalDigest: computeProposalDigest(base) };
}

function review(
  principal: TrustedPrincipal,
  p: ReturnType<typeof proposal>,
  id: number,
  submittedAt = "2026-09-05T08:31:00Z",
  overrides: Partial<ExternalReview> = {},
): ExternalReview {
  return {
    id,
    html_url: `https://github.com/alindebergASL/atliera/pull/99#pullrequestreview-${id}`,
    state: p.purpose === "build-permission" ? "COMMENTED" : "APPROVED",
    commit_id: SHA,
    submitted_at: submittedAt,
    author_association: "OWNER",
    user: { login: principal.login, id: principal.id, type: principal.type },
    body: [
      `Atliera-Decision: ${p.decision}`,
      `Atliera-Scope: ${p.scope}`,
      `Atliera-Purpose: ${p.purpose}`,
      `Atliera-Proposal-Digest: ${p.proposalDigest}`,
      ...(p.purpose === "build-permission" ? [
        "Atliera-Review-Kind: independent-technical",
        "Atliera-Review-Actor: agent",
        "Atliera-Implementer-Context: synthetic-implementation",
        "Atliera-Reviewer-Context: synthetic-review",
        "Atliera-Model: gpt-6-astra (synthetic fixture, no model invoked)",
        "Atliera-Evidence: urn:atliera:synthetic:review",
        "Atliera-Coverage: synthetic functional and architecture/security checks",
        "Atliera-Verdict: PASS",
      ] : []),
    ].join("\n"),
    ...overrides,
  };
}

test("authority policy, unknowns, and effects fail high; evidence remains Tier 2", () => {
  assert.equal(classifyFile(map, "docs/strategy/standing-development-policy.md", new Set(), effects()).tier, 3);
  assert.equal(classifyFile(map, "presentation/account-home.ts", new Set(), effects()).tier, 3);
  assert.equal(classifyFile(map, "src/account-intelligence/admission.ts", new Set(), effects()).tier, 2);
  assert.equal(classifyFile(map, "unexpected/new-path.ts", new Set(), effects()).tier, 3);
  assert.equal(classifyFile(map, "presentation/account-home.ts", new Set(), effects({ durableWrite: true })).tier, 3);
});

test("checked-in build proposal digest matches the actual decision and scope", () => {
  const manifest = JSON.parse(readFileSync(join(REPO, "ceremony.json"), "utf8"));
  assert.equal(computeProposalDigest(manifest.buildProposal), manifest.buildProposal.proposalDigest);
});

test("synthetic Tier 1, Tier 2, and Tier 3 paths use explicit stable principal ids", () => {
  const build = proposal("build-permission");
  assert.deepEqual(verifyCeremony(1, SHA, undefined, effects(), [], trust, schema), []);
  assert.deepEqual(verifyCeremony(2, SHA, { buildProposal: build }, effects(), [review(OWNER, build, 1001)], trust, schema), []);
  assert.deepEqual(
    verifyCeremony(3, SHA, { buildProposal: build }, effects(), [review(OWNER, build, 1001), review(REVIEWER, build, 1002)], trust, schema),
    [],
  );
});

test("checked-in publisher permits independent agent reports at Tier 2 and 3 without a human enrollment", () => {
  const protectedTrust = JSON.parse(readFileSync(join(REPO, "docs/strategy/governance-trust.json"), "utf8")) as TrustPolicy;
  const build = proposal("build-permission");
  const owner = protectedTrust.owner!;
  assert.deepEqual(verifyCeremony(2, SHA, { buildProposal: build }, effects(), [review(owner, build, 1101)], protectedTrust, schema), []);
  const tier3 = verifyCeremony(3, SHA, { buildProposal: build }, effects(), [review(owner, build, 1101)], protectedTrust, schema);
  assert.deepEqual(tier3, []);
  assert.equal(protectedTrust.technicalReviewers?.length, 0);
});

test("missing, stale, wrong-binding, wrong stable id, and wrong account type fail closed", () => {
  const build = proposal("build-permission");
  const manifest: CeremonyManifest = { buildProposal: build };
  assert.match(verifyCeremony(2, SHA, manifest, effects(), [], trust, schema).join("\n"), /independent technical review/u);
  assert.match(verifyCeremony(2, SHA, manifest, effects(), [review(OWNER, build, 1201, undefined, { commit_id: OTHER_SHA })], trust, schema).join("\n"), /independent technical review/u);
  assert.match(verifyCeremony(2, SHA, manifest, effects(), [review(OWNER, { ...build, decision: "Different decision" }, 1202)], trust, schema).join("\n"), /independent technical review/u);
  assert.match(verifyCeremony(2, SHA, manifest, effects(), [review({ ...OWNER, id: 999 }, build, 1203)], trust, schema).join("\n"), /stable user id/u);
  assert.match(verifyCeremony(2, SHA, manifest, effects(), [review({ ...OWNER, login: "renamed-owner" }, build, 1204)], trust, schema).join("\n"), /pinned login/u);
  assert.match(verifyCeremony(2, SHA, manifest, effects(), [review({ ...OWNER, type: "Bot" }, build, 1205)], trust, schema).join("\n"), /type is not User/u);
  assert.match(verifyCeremony(2, SHA, manifest, effects(), [review(OWNER, build, 1206)], undefined, schema).join("\n"), /identity trust policy/u);
});

test("later change requests revoke grants regardless of input order; resubmission restores them", () => {
  const build = proposal("build-permission");
  const approved = review(OWNER, build, 1301, "2026-09-05T08:31:00Z");
  const rejected = review(OWNER, build, 1302, "2026-09-05T08:32:00Z", { state: "CHANGES_REQUESTED" });
  for (const events of [[approved, rejected], [rejected, approved]]) {
    assert.match(verifyCeremony(2, SHA, { buildProposal: build }, effects(), events, trust, schema).join("\n"), /independent technical review/u);
  }
  const resubmitted = review(OWNER, build, 1303, "2026-09-05T08:33:00Z");
  assert.deepEqual(verifyCeremony(2, SHA, { buildProposal: build }, effects(), [rejected, resubmitted, approved], trust, schema), []);
  const commented = review(OWNER, build, 1304, "2026-09-05T08:34:00Z", { state: "COMMENTED" });
  assert.deepEqual(verifyCeremony(2, SHA, { buildProposal: build }, effects(), [commented, resubmitted, approved], trust, schema), []);
});

test("a dismissed current-review snapshot holds conservatively in both array orders", () => {
  const build = proposal("build-permission");
  const oldReviewNowDismissed = review(OWNER, build, 1311, "2026-09-05T08:31:00Z", { state: "DISMISSED" });
  const newerStillApproved = review(OWNER, build, 1312, "2026-09-05T08:33:00Z");
  for (const events of [[oldReviewNowDismissed, newerStillApproved], [newerStillApproved, oldReviewNowDismissed]]) {
    const result = verifyCeremony(2, SHA, { buildProposal: build }, effects(), events, trust, schema).join("\n");
    assert.match(result, /dismissal chronology is unavailable/u);
  }
});

test("a later separate effect approval preserves the earlier build grant; a later rejection clears both", () => {
  const build = proposal("build-permission");
  const effect = proposal("effect-permission", "Permit one durable write after merge.");
  const manifest: CeremonyManifest = { buildProposal: build, effectProposal: effect };
  const declared = effects({ durableWrite: true });
  const buildApproval = review(OWNER, build, 1401, "2026-09-05T08:31:00Z");
  const effectApproval = review(OWNER, effect, 1402, "2026-09-05T08:32:00Z");
  const technical = review(REVIEWER, build, 1403, "2026-09-05T08:33:00Z");
  assert.deepEqual(verifyCeremony(3, SHA, manifest, declared, [effectApproval, technical, buildApproval], trust, schema), []);
  const rejected = review(OWNER, build, 1404, "2026-09-05T08:34:00Z", { state: "CHANGES_REQUESTED" });
  const result = verifyCeremony(3, SHA, manifest, declared, [effectApproval, rejected, technical, buildApproval], trust, schema).join("\n");
  assert.match(result, /external owner approval/u);
  assert.match(result, /effect permission/u);
});

test("a COMMENTED technical report cannot double as effect approval; duplicate principal config fails", () => {
  const build = proposal("build-permission");
  const effect = proposal("effect-permission", "Permit one durable write after merge.");
  const declared = effects({ durableWrite: true });
  const manifest: CeremonyManifest = { buildProposal: build, effectProposal: effect };
  const combined = review(OWNER, build, 1501);
  combined.body += `\n${review(OWNER, effect, 1502).body}`;
  assert.match(verifyCeremony(3, SHA, manifest, declared, [combined, review(REVIEWER, build, 1503)], trust, schema).join("\n"), /external owner approval.*effect permission/u);

  const sharedPrincipalTrust: TrustPolicy = { ...trust, technicalReviewers: [{ ...OWNER }] };
  assert.match(
    verifyCeremony(3, SHA, { buildProposal: build }, effects(), [review(OWNER, build, 1504)], sharedPrincipalTrust, schema).join("\n"),
    /reuse GitHub user id|reuse GitHub login/u,
  );
});

test("duplicate event identities and malformed chronology are rejected", () => {
  const build = proposal("build-permission");
  const duplicate = [review(OWNER, build, 1601), review(REVIEWER, build, 1601, "2026-09-05T08:32:00Z")];
  assert.match(verifyCeremony(3, SHA, { buildProposal: build }, effects(), duplicate, trust, schema).join("\n"), /duplicate external review event id/u);
  const malformed = [review(OWNER, build, 1602), review(OWNER, build, 1603, "2026-02-30T08:33:00Z", { state: "CHANGES_REQUESTED" })];
  assert.match(verifyCeremony(2, SHA, { buildProposal: build }, effects(), malformed, trust, schema).join("\n"), /malformed chronology/u);
});

test("proposal validator enforces own properties, real calendar dates, offsets, URIs, and digest", () => {
  const valid = proposal("build-permission");
  const validWith = (changes: Record<string, unknown>) => {
    const changed = { ...valid, ...changes };
    return { ...changed, proposalDigest: computeProposalDigest(changed) };
  };
  assert.deepEqual(validateDecisionProposal(valid, schema), []);
  for (const field of ["kind", "schemaVersion", "recordId", "state", "proposedBy", "decision", "scope", "purpose", "proposedAt", "proposalDigest"] as const) {
    const missing = { ...valid } as Record<string, unknown>;
    delete missing[field];
    assert.ok(validateDecisionProposal(missing, schema).some((p) => p.includes(`${field} is required`)), field);
  }
  for (const key of ["constructor", "__proto__"]) {
    const withInheritedName = JSON.parse(JSON.stringify(valid).replace(/}$/, `,"${key}":true}`));
    assert.ok(validateDecisionProposal(withInheritedName, schema).some((p) => /additional property/u.test(p)), key);
  }
  for (const [field, value] of [
    ["kind", "other-kind"],
    ["schemaVersion", "2"],
    ["recordId", "Bad id"],
    ["state", "ratified"],
    ["proposedBy", "reviewer"],
    ["decision", ""],
    ["scope", ""],
    ["purpose", "receipt"],
    ["proposalDigest", "sha256:short"],
  ] as const) {
    assert.ok(validateDecisionProposal({ ...valid, [field]: value }, schema).length > 0, `${field} constraint`);
  }
  assert.ok(validateDecisionProposal({ ...valid, recordId: 7 }, schema).some((p) => /string/u.test(p)));
  assert.ok(validateDecisionProposal({ ...valid, proposedAt: "2026-02-30T08:30:00Z" }, schema).some((p) => /date-time/u.test(p)));
  assert.ok(validateDecisionProposal({ ...valid, referenceUri: "not a uri" }, schema).some((p) => /URI/iu.test(p)));
  for (const proposedAt of ["2026-09-05T09:00:60Z", "2026-09-05T09:00:59Z\n"]) {
    assert.ok(validateDecisionProposal(validWith({ proposedAt }), schema).some((p) => /date-time/u.test(p)), proposedAt);
  }
  for (const referenceUri of [
    "https://example.com/a b",
    "https://example.com/bad%escape",
    "https://[bad]/",
    "https://example.com:abc/",
    "https://example.com/trailing%",
    "https://example.com/café",
    "https://example.com/path\n",
    "https://example.com/x#one#two",
    "https://example.com/a[b]",
    "https://example.com/?q=[x]",
    "https://example.com/#part[1]",
  ]) {
    assert.ok(validateDecisionProposal(validWith({ referenceUri }), schema).some((p) => /URI/iu.test(p)), referenceUri);
  }
  for (const referenceUri of ["https://[::1]/x?value=a/b?c#part", "https://example.com/a%5Bb%5D#one%23two", "urn:atliera:proposal:synthetic"]) {
    assert.deepEqual(validateDecisionProposal(validWith({ referenceUri }), schema), [], referenceUri);
  }
  const offsetBase = { ...valid, proposedAt: "2026-09-05T10:30:00+02:00", referenceUri: "urn:atliera:proposal:synthetic" };
  const offset = { ...offsetBase, proposalDigest: computeProposalDigest(offsetBase) };
  assert.deepEqual(validateDecisionProposal(offset, schema), []);
  assert.ok(validateDecisionProposal({ ...valid, effectAxes: ["durableWrite"] }, schema).some((p) => /forbidden schema/u.test(p)));
  const effect = proposal("effect-permission");
  assert.deepEqual(validateDecisionProposal(effect, schema), []);
  const noAxes = { ...effect } as Record<string, unknown>;
  delete noAxes.effectAxes;
  assert.ok(validateDecisionProposal(noAxes, schema).some((p) => /effectAxes.*required/u.test(p)));
  assert.ok(validateDecisionProposal({ ...effect, effectAxes: [] }, schema).some((p) => /at least 1/u.test(p)));
  assert.ok(validateDecisionProposal({ ...effect, effectAxes: ["durableWrite", "durableWrite"] }, schema).some((p) => /unique/u.test(p)));
  assert.ok(validateDecisionProposal({ ...effect, effectAxes: ["unknownAxis"] }, schema).some((p) => /allowed value|unknown effect axis/u.test(p)));
  assert.ok(validateDecisionProposal({ ...valid, proposalDigest: "sha256:" + "0".repeat(64) }, schema).some((p) => /computed digest/u.test(p)));
});

test("candidate self-attestation cannot satisfy protected-base ceremony", () => {
  const candidateOnly = {
    decisionRecord: { state: "ratified", decidedBy: "owner", boundSha: SHA },
    reviewAttestation: { reviewer: "atliera-owner", boundSha: SHA, verdict: "PASS" },
  };
  const problems = verifyCeremony(2, SHA, candidateOnly as never, effects(), [], trust, schema);
  assert.ok(problems.some((p) => /build proposal/u.test(p)));
  assert.ok(problems.length > 0, "candidate-authored authority fields are not consumed");
});

test("Astra in separate contexts is valid technical evidence, never a human self-approval", () => {
  const build = proposal("build-permission");
  const report = review(OWNER, build, 1701);
  assert.deepEqual(verifyCeremony(3, SHA, { buildProposal: build }, effects(), [report], trust, schema), []);
  for (const changed of [
    { ...report, state: "APPROVED" },
    { ...report, body: "Ordinary discussion, not a review report." },
    { ...report, body: report.body!.replace("synthetic-review", "synthetic-implementation") },
    { ...report, body: report.body!.replace("Atliera-Review-Actor: agent", "Atliera-Review-Actor: owner-approved") },
    { ...report, body: report.body! + "\nAtliera-Verdict: FAIL" },
    { ...report, body: report.body!.replace("urn:atliera:synthetic:review", "not a uri") },
  ]) assert.ok(verifyCeremony(3, SHA, { buildProposal: build }, effects(), [changed], trust, schema).length > 0);
  for (const field of ["Review-Kind", "Review-Actor", "Implementer-Context", "Reviewer-Context", "Model", "Evidence", "Coverage", "Verdict"]) {
    const missing = { ...report, body: report.body!.split("\n").filter((line) => !line.startsWith(`Atliera-${field}:`)).join("\n") };
    assert.ok(verifyCeremony(3, SHA, { buildProposal: build }, effects(), [missing], trust, schema).length > 0, field);
  }
});

test("later failed technical report supersedes PASS; fresh verified fix can restore it", () => {
  const build = proposal("build-permission");
  const pass = review(OWNER, build, 1711);
  const fail = review(OWNER, build, 1712, "2026-09-05T08:32:00Z");
  fail.body = fail.body!.replace("Atliera-Verdict: PASS", "Atliera-Verdict: FAIL");
  for (const events of [[pass, fail], [fail, pass]]) {
    assert.match(verifyCeremony(3, SHA, { buildProposal: build }, effects(), events, trust, schema).join("\n"), /verdict is not PASS/u);
  }
  const fixed = review(OWNER, build, 1713, "2026-09-05T08:33:00Z");
  assert.deepEqual(verifyCeremony(3, SHA, { buildProposal: build }, effects(), [fixed, fail, pass], trust, schema), []);
});

test("standing build workflow does not grant effect permission or accept a stale effect approval", () => {
  const build = proposal("build-permission");
  const effect = proposal("effect-permission");
  const report = review(OWNER, build, 1721);
  const approval = review(OWNER, effect, 1722);
  for (const invalid of [undefined, { ...approval, state: "COMMENTED" }, { ...approval, commit_id: OTHER_SHA }, { ...approval, author_association: "MEMBER" }]) {
    assert.ok(verifyCeremony(3, SHA, { buildProposal: build, effectProposal: effect }, effects({ durableWrite: true }), [report, ...(invalid ? [invalid] : [])], trust, schema).length > 0);
  }
  assert.deepEqual(verifyCeremony(3, SHA, { buildProposal: build, effectProposal: effect }, effects({ durableWrite: true }), [report, approval], trust, schema), []);
});

test("invalid tier cannot skip the review check", () => {
  for (const tier of [-1, 4, NaN, 1.5]) assert.ok(verifyCeremony(tier, SHA, undefined).length > 0);
});

test("workflow protects enforcement roots, compares candidate map data, and reevaluates edited reviews", () => {
  const workflow = readFileSync(join(REPO, ".github/workflows/governance-classify.yml"), "utf8");
  for (const path of [
    "scripts/classify-pr.sh",
    "scripts/classify-change-risk.ts",
    "scripts/verify-ceremony.ts",
    "docs/strategy/governance-tiers.json",
    "docs/strategy/decision-record.schema.json",
    "docs/strategy/decision-proposal.schema.json",
    "docs/strategy/governance-trust.json",
  ]) assert.match(workflow, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), path);
  assert.match(workflow, /pulls\.listReviews/u);
  assert.match(workflow, /types: \[submitted, edited, dismissed\]/u);
  assert.match(workflow, /ATL_GOVERNANCE_MAP: \.atliera-enforcement\/governance-tiers\.json/u);
  assert.match(workflow, /ATL_GOVERNANCE_CANDIDATE_MAP: docs\/strategy\/governance-tiers\.json/u);
  assert.doesNotMatch(workflow, /bootstrap|admin.*bypass/iu);
});
