import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  classifyChange,
  classifyFile,
  compareMaps,
  deescalationsUnauthorized,
  loadFrozenPaths,
  loadMap,
  validateDeclaration,
  REQUIRED_AXES,
  type Declaration,
  type EffectVector,
} from "../../scripts/classify-change-risk.ts";
import {
  assertedAxesFromDeclaration,
  validateDecisionRecord,
  verifyCeremony,
} from "../../scripts/verify-ceremony.ts";

const REPO = new URL("../..", import.meta.url).pathname;
const map = loadMap(readFileSync(join(REPO, "docs", "strategy", "governance-tiers.json"), "utf8"));

const allFalse = Object.fromEntries(REQUIRED_AXES.map((a) => [a, false])) as EffectVector;
const fx = (over: Partial<EffectVector>): EffectVector => ({ ...allFalse, ...over });

// Real repository registries, loaded exactly as CI loads them — this is the
// integration case the v2.0 suite missed (hand-built full-path fixtures masked
// directory-relative manifest entries).
// In-repo, every listed registry exists and this loads the real frozen set.
// In the standalone package the registries are absent and loadFrozenPaths
// correctly THROWS (fail closed, v2.3 BUG 1) — the suite then exercises the
// frozen behaviour with synthetic registries instead.
let FROZEN: Set<string>;
let REGISTRIES_PRESENT = true;
try {
  FROZEN = loadFrozenPaths(map, (p) => {
    const abs = join(REPO, p);
    return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
  });
} catch {
  REGISTRIES_PRESENT = false;
  FROZEN = new Set<string>();
}

test("map loads, rejects duplicates, and prices its own governance files", () => {
  assert.equal(map.algorithm, "max-across-all-matching-prefixes");
  assert.throws(
    () => loadMap(JSON.stringify({ ...map, prefixes: [...map.prefixes, { prefix: "docs/ux/", minTier: 0 }] })),
    /duplicate prefix/u,
  );
  // The governance package prices itself: map, plan, this test, wiring.
  assert.equal(classifyFile(map, "docs/strategy/governance-tiers.json", FROZEN).tier, 2);
  assert.equal(classifyFile(map, "docs/plans/generate-not-reconcile.md", FROZEN).tier, 2);
  assert.equal(classifyFile(map, "tests/safety/governance-tier-classifier.test.ts", FROZEN).tier, 2);
  assert.equal(classifyFile(map, ".github/workflows/governance-classify.yml", FROZEN).tier, 3);
});

test("all four real registries resolve correctly — historical AND fresh", (t) => {
  if (!REGISTRIES_PRESENT) {
    t.diagnostic("registries absent in standalone package; both conventions exercised synthetically below");
    return;
  }
  // v2.1 regression: prepending the registry directory to entries that were
  // ALREADY repository-relative silently dropped every historical artifact.
  const cases: Array<[string, string]> = [
    ["fresh (relative entries)", "docs/ux/c2-governed-account-intelligence-refresh/fresh-fedex.html"],
    ["fresh (relative entries)", "docs/ux/c2-governed-account-intelligence-refresh/fresh-university-of-utah.html"],
    ["historical (repo-relative entries)", "docs/ux/c2-governed-account-intelligence-refresh/fedex.html"],
    ["historical (repo-relative entries)", "docs/ux/c2-governed-account-intelligence-refresh/README.md"],
  ];
  for (const [which, path] of cases) {
    assert.ok(FROZEN.has(path), `${which}: ${path} must be recognized as frozen`);
    const res = classifyChange(map, [path], FROZEN);
    assert.equal(res.violations.length, 1, `${which}: editing ${path} must violate, not classify Tier 1`);
  }
});

test("unsafe registry entries are rejected, never mis-resolved", () => {
  const unsafe: string[] = [];
  const frozen = loadFrozenPaths(
    { ...map, frozenRegistries: ["docs/ux/pkg/SUMS"] },
    () => "0".repeat(64) + "  ../../../etc/passwd\n" + "1".repeat(64) + "  /etc/shadow\n" + "2".repeat(64) + "  ok.html\n",
    unsafe,
  );
  assert.equal(unsafe.length, 2, "traversal and absolute entries must be reported, not resolved");
  assert.ok(frozen.has("docs/ux/pkg/ok.html"));
  assert.ok(![...frozen].some((p) => p.includes("..") || p.startsWith("/")));
});

test("directory-relative registry entries resolve against the registry directory (synthetic)", () => {
  const frozen = loadFrozenPaths(
    { ...map, frozenRegistries: ["docs/ux/pkg/SUMS", "docs/ux/pkg/manifest.json"] },
    (p) =>
      p === "docs/ux/pkg/SUMS"
        ? "0".repeat(64) + "  fresh-a.html\n" + "1".repeat(64) + " *./data/fresh/b.json\n"
        : p === "docs/ux/pkg/manifest.json"
          ? JSON.stringify({
              artifacts: [
                { path: "fresh-c.html" },
                "data/d.json",
                // repository-relative entry in the SAME registry: must be preserved, not doubled
                { path: "docs/ux/pkg/historical-e.html" },
              ],
            })
          : undefined,
  );
  assert.ok(frozen.has("docs/ux/pkg/historical-e.html"), "already-rooted entry must not be double-prefixed");
  assert.ok(!frozen.has("docs/ux/pkg/docs/ux/pkg/historical-e.html"), "no double prefix");
  for (const p of [
    "docs/ux/pkg/fresh-a.html",
    "docs/ux/pkg/data/fresh/b.json",
    "docs/ux/pkg/fresh-c.html",
    "docs/ux/pkg/data/d.json",
    "docs/ux/pkg/SUMS",
    "docs/ux/pkg/manifest.json",
  ]) {
    assert.ok(frozen.has(p), `expected frozen: ${p}`);
  }
  const attack = classifyChange({ ...map }, ["docs/ux/pkg/fresh-a.html"], frozen);
  assert.equal(attack.violations.length, 1, "frozen surface under docs/ux/ must violate, never classify Tier 1");
});

test("file rules match exactly — no alias inheritance", () => {
  assert.equal(classifyFile(map, "README.md", FROZEN).tier, 0);
  assert.equal(classifyFile(map, "README.md.evil", FROZEN).tier, 3, "alias must be unmapped => fail closed");
  assert.equal(classifyFile(map, "package.json", FROZEN).tier, 2);
  assert.equal(classifyFile(map, "package.json.bak", FROZEN).tier, 3);
  // Directory rules still cover their subtrees.
  assert.equal(classifyFile(map, "docs/ux/x/index.html", FROZEN).tier, 1);
});

test("overlapping rules resolve by maximum, and declarations never lower", () => {
  assert.equal(classifyFile(map, "docs/ux/c2-governed-account-intelligence-refresh/CURRENT_STATUS.json", FROZEN).tier, 2);
  // Unmapped infrastructure: Tier 3 with no declaration, and STILL Tier 3 with a complete all-false declaration.
  assert.equal(classifyFile(map, "terraform/main.tf", FROZEN).tier, 3);
  assert.equal(classifyFile(map, "terraform/main.tf", FROZEN, { effects: allFalse }).tier, 3,
    "an all-false declaration must not lower an unmapped path");
  // Declarations escalate mapped paths.
  assert.equal(classifyFile(map, "src/account-intelligence/provider.ts", FROZEN, { effects: fx({ providerExecution: true }) }).tier, 2);
  assert.equal(classifyFile(map, "src/account-intelligence/provider.ts", FROZEN, { effects: fx({ networkOrOutbound: true }) }).tier, 3);
  assert.equal(classifyFile(map, "docs/plans/some-plan.md", FROZEN, { effects: fx({ durableWrite: true }) }).tier, 3);
});

test("declarations are structurally complete or invalid", () => {
  assert.throws(() => validateDeclaration({}), /effects is required/u);
  assert.throws(() => validateDeclaration({ effects: {} }), /must be an explicit boolean/u);
  const partial = Object.fromEntries(REQUIRED_AXES.slice(0, 7).map((a) => [a, false]));
  assert.throws(() => validateDeclaration({ effects: partial }), /must be an explicit boolean/u);
  assert.throws(() => validateDeclaration({ effects: { ...allFalse, extraAxis: true } }), /unknown effect axis/u);
  assert.deepEqual(validateDeclaration({ effects: allFalse }).effects, allFalse);
});

test("supersession must be INCLUDED in the change set, not merely named", () => {
  const frozen = new Set(["docs/ux/pkg/fresh-a.html"]);
  const decl: Declaration = {
    effects: allFalse,
    supersessions: { "docs/ux/pkg/fresh-a.html": "docs/supersessions/a-2026-09.md" },
  };
  // Named but not included: violation.
  const named = classifyChange(map, ["docs/ux/pkg/fresh-a.html"], frozen, decl);
  assert.equal(named.violations.length, 1, "naming a supersession record without committing it is a violation");
  // Named AND added: clears.
  const included = classifyChange(
    map,
    [{ path: "docs/ux/pkg/fresh-a.html", status: "M" }, { path: "docs/supersessions/a-2026-09.md", status: "A" }],
    frozen,
    decl,
  );
  assert.equal(included.violations.length, 0);
  // Named but DELETED in the same change: still a violation (v2.1 accepted this).
  const deleted = classifyChange(
    map,
    [{ path: "docs/ux/pkg/fresh-a.html", status: "M" }, { path: "docs/supersessions/a-2026-09.md", status: "D" }],
    frozen,
    decl,
  );
  assert.equal(deleted.violations.length, 1, "a deleted supersession record must not satisfy inclusion");
  // Wrong prefix: violation even when included.
  const badPrefix = classifyChange(map, ["docs/ux/pkg/fresh-a.html", "docs/reviews/nope.md"], frozen, {
    effects: allFalse,
    supersessions: { "docs/ux/pkg/fresh-a.html": "docs/reviews/nope.md" },
  });
  assert.equal(badPrefix.violations.length, 1);
});

test("guard weakening inherits the guarded tier; strengthening does not", () => {
  const decl: Declaration = {
    effects: allFalse,
    guardWeakening: { "tests/safety/c2-closeout-status.test.ts": "docs/ux/c2-governed-account-intelligence-refresh/CURRENT_STATUS.json" },
  };
  assert.equal(classifyFile(map, "tests/safety/c2-closeout-status.test.ts", FROZEN, decl).tier, 2);
  assert.equal(classifyFile(map, "tests/safety/c2-closeout-status.test.ts", FROZEN, { effects: allFalse }).tier, 1);
});

test("de-escalation between map versions is detected mechanically", () => {
  const lowered = {
    ...map,
    prefixes: map.prefixes.map((e) => (e.prefix === ".github/workflows/" ? { ...e, minTier: 1 } : e)),
  };
  const d1 = compareMaps(map, lowered);
  assert.deepEqual(d1, [{ kind: "rule-lowered", subject: ".github/workflows/", from: 3, to: 1 }]);

  const removedRule = { ...map, prefixes: map.prefixes.filter((e) => e.prefix !== "migrations/") };
  assert.deepEqual(compareMaps(map, removedRule), [{ kind: "rule-removed", subject: "migrations/", from: 3, to: "absent" }]);

  const axisDown = { ...map, axisMinTiers: { ...map.axisMinTiers, durableWrite: 2 } };
  assert.deepEqual(compareMaps(map, axisDown), [{ kind: "axis-lowered", subject: "durableWrite", from: 3, to: 2 }]);

  const regGone = { ...map, frozenRegistries: map.frozenRegistries.slice(1) };
  assert.equal(compareMaps(map, regGone)[0]!.kind, "registry-removed");

  // Escalation is not flagged.
  const raised = { ...map, prefixes: map.prefixes.map((e) => (e.prefix === "docs/reviews/" ? { ...e, minTier: 2 } : e)) };
  assert.deepEqual(compareMaps(map, raised), []);
});

test("PR tier is the maximum across files", () => {
  const change = classifyChange(map, ["README.md", "docs/ux/surface/index.html", "src/account-intelligence/provider.ts", ".github/workflows/ci.yml"], FROZEN, { effects: allFalse });
  assert.equal(change.prTier, 3);
  assert.equal(change.violations.length, 0);
});

test("declaration channel is priced so it never escalates its carrier", () => {
  // P0-2: a required committed declaration that is itself unmapped would price
  // every PR Tier 3 and collapse the tier distinctions.
  assert.equal(classifyFile(map, "change-risk.json", FROZEN).tier, 0);
  assert.equal(classifyFile(map, "ceremony.json", FROZEN).tier, 0);
  const pr = classifyChange(map, ["change-risk.json", "docs/reviews/note.md"], FROZEN, { effects: allFalse });
  assert.equal(pr.prTier, 1, "a docs PR that updates its own declaration stays at the docs tier");
});

test("map validation rejects malformed, weakened, and unsupported maps", () => {
  const base = JSON.parse(readFileSync(join(REPO, "docs", "strategy", "governance-tiers.json"), "utf8"));
  const bad = (mut: (m: any) => void, re: RegExp) => {
    const m = JSON.parse(JSON.stringify(base));
    mut(m);
    assert.throws(() => loadMap(JSON.stringify(m)), re);
  };
  bad((m) => { m.schemaVersion = "1"; }, /schemaVersion/u);
  bad((m) => { m.algorithm = "first-match"; }, /algorithm/u);
  bad((m) => { m.unmappedPathPolicy = "tier0"; }, /unmappedPathPolicy/u);
  bad((m) => { m.axisMinTiers.durableWrite = 1; }, /below policy floor/u);
  bad((m) => { delete m.axisMinTiers.deployment; }, /axisMinTiers.deployment missing/u);
  bad((m) => { m.axisMinTiers.madeUp = 3; }, /unknown effect axis/u);
  bad((m) => { m.frozenRegistries = []; }, /non-empty/u);
  bad((m) => { m.frozenRegistries = ["../escape"]; }, /unsafe frozen registry/u);
  bad((m) => { m.supersessionPathPrefix = "docs/supersessions"; }, /ending in/u);
});

test("BUG 1 — a missing, unreadable, or unparseable frozen registry fails closed", () => {
  // v2.2 silently skipped an absent registry, so deleting it unfroze everything
  // it defined: 0 frozen paths, tier 1, no violation.
  assert.throws(
    () => loadFrozenPaths({ ...map, frozenRegistries: ["docs/ux/pkg/manifest.json"] }, () => undefined),
    /missing or unreadable/u,
  );
  assert.throws(
    () => loadFrozenPaths({ ...map, frozenRegistries: ["docs/ux/pkg/manifest.json"] }, () => "{not json"),
    /does not parse/u,
  );
});

test("BUG 1b — deleting a listed registry is itself a frozen violation", () => {
  const frozen = loadFrozenPaths(
    { ...map, frozenRegistries: ["docs/ux/pkg/manifest.json"] },
    () => JSON.stringify({ artifacts: [{ path: "a.html" }] }),
  );
  const res = classifyChange(map, [{ path: "docs/ux/pkg/manifest.json", status: "D" }], frozen);
  assert.equal(res.violations.length, 1, "the registry path is frozen state; removing it must violate");
  assert.match(res.violations[0]!, /deleted or renamed away/u);
});

test("BUG 2 — renaming a frozen artifact classifies the SOURCE identity", () => {
  const frozen = new Set(["docs/ux/pkg/fresh-a.html"]);
  // v2.2 kept only the rename target, so the frozen source escaped entirely.
  const res = classifyChange(
    map,
    [{ path: "docs/ux/pkg/renamed.html", status: "R", from: "docs/ux/pkg/fresh-a.html" }],
    frozen,
  );
  assert.equal(res.violations.length, 1, "renaming a frozen artifact must violate");
  assert.match(res.violations[0]!, /docs\/ux\/pkg\/fresh-a\.html/u, "the violation must name the frozen SOURCE");
  assert.equal(res.prTier, 3);
  // A rename that touches nothing frozen is unaffected.
  const benign = classifyChange(
    map,
    [{ path: "docs/ux/pkg/b.html", status: "R", from: "docs/ux/pkg/a.html" }],
    frozen,
  );
  assert.equal(benign.violations.length, 0);
});

test("BUG 3 — ceremony consumes schema-v2 records and rejects v1-shaped authority", () => {
  const SHA = "b93f0d61122722715d2db33636cfb7828fbf3f95";
  const DIG = "sha256:" + "a".repeat(64);
  const v2Record = {
    kind: "atliera.owner-decision",
    schemaVersion: "2",
    recordId: "c2-disposition",
    state: "ratified",
    decidedBy: "owner",
    decision: "Utah: Continue.",
    scope: "C2",
    boundSha: SHA,
    proposalDigest: DIG,
    ratification: {
      method: "github-merge-approval",
      ownerIdentity: "alindebergASL",
      eventUrl: "https://github.com/alindebergASL/atliera/pull/318#event-1",
      eventId: "EV1",
      ratifiedProposalDigest: DIG,
      subjectSha: SHA,
      timestamp: "2026-09-05T00:00:00Z",
    },
  };
  // A real v2 ratified record must PASS — v2.2 rejected exactly this (exit 6).
  assert.deepEqual(verifyCeremony(2, SHA, { decisionRecord: v2Record }), []);

  // The v1 shape the v2.2 verifier accepted must now be rejected.
  const v1Record = { state: "effective", decidedBy: "owner", ownerAttestation: { method: "verbatim-statement" }, boundSha: SHA };
  const v1Problems = verifyCeremony(2, SHA, { decisionRecord: v1Record as never });
  assert.ok(v1Problems.some((p) => /not schema v2/u.test(p)));
  assert.ok(v1Problems.some((p) => /v1 'ownerAttestation'/u.test(p)));

  // Cross-field equalities are enforced at runtime (schema cannot express them).
  const digestMismatch = { ...v2Record, ratification: { ...v2Record.ratification, ratifiedProposalDigest: "sha256:" + "b".repeat(64) } };
  assert.ok(verifyCeremony(2, SHA, { decisionRecord: digestMismatch }).some((p) => /does not equal the record's proposalDigest/u.test(p)));
  const subjectMismatch = { ...v2Record, ratification: { ...v2Record.ratification, subjectSha: "c".repeat(40) } };
  assert.ok(verifyCeremony(2, SHA, { decisionRecord: subjectMismatch }).some((p) => /does not equal the record's boundSha/u.test(p)));

  // Exact SHA equality: v2.2 used startsWith, so empty strings matched everything.
  const empties = { ...v2Record, boundSha: "", ratification: { ...v2Record.ratification, subjectSha: "" } };
  assert.ok(verifyCeremony(2, SHA, { decisionRecord: empties }).length > 0, "empty SHAs must not match");
  assert.ok(verifyCeremony(2, "", { decisionRecord: v2Record }).some((p) => /not a 40-hex/u.test(p)));

  // Unratified and agent-authored records carry no authority.
  assert.ok(verifyCeremony(2, SHA, { decisionRecord: { ...v2Record, state: "proposed" } }).some((p) => /only 'ratified'/u.test(p)));
  assert.ok(verifyCeremony(2, SHA, { decisionRecord: { ...v2Record, decidedBy: "agent" } as never }).some((p) => /decidedBy/u.test(p)));

  // Missing schema-required fields are now caught (v2.3.1 finding 1b).
  for (const field of ["recordId", "decision", "scope"] as const) {
    const missing = { ...v2Record } as Record<string, unknown>;
    delete missing[field];
    assert.ok(
      verifyCeremony(2, SHA, { decisionRecord: missing as never }).some((p) => new RegExp(field === "recordId" ? "recordId" : `no ${field}`, "u").test(p)),
      `omitting ${field} must be caught`,
    );
  }
});

test("BUG 4 — asserted effects come from the committed declaration, not the manifest", () => {
  const SHA = "b93f0d61122722715d2db33636cfb7828fbf3f95";
  const DIG = "sha256:" + "a".repeat(64);
  const record = {
    kind: "atliera.owner-decision", schemaVersion: "2", recordId: "r", state: "ratified", decidedBy: "owner",
    decision: "d", scope: "s", boundSha: SHA, proposalDigest: DIG,
    ratification: { method: "github-merge-approval", ownerIdentity: "o", eventUrl: "u", eventId: "e", ratifiedProposalDigest: DIG, subjectSha: SHA, timestamp: "t" },
  };
  const att = { reviewer: "asl_hermes_code", eventUrl: "https://x/y#r1", eventId: "R1", verdict: "PASS", boundSha: SHA };
  const declAssertsDurable = { effects: { durableWrite: true, privateData: false } };

  assert.deepEqual(assertedAxesFromDeclaration(declAssertsDurable), ["durableWrite"]);

  // v2.2 read assertedEffects from the manifest, so omitting it bypassed receipts.
  const bypassed = verifyCeremony(3, SHA, { decisionRecord: record, reviewAttestation: att }, declAssertsDurable);
  assert.ok(bypassed.some((p) => /asserts 'durableWrite'/u.test(p)), "omitting manifest effects must not bypass receipts");

  // A receipt must be bound to the candidate SHA and record an outcome.
  const unbound = verifyCeremony(3, SHA, { decisionRecord: record, reviewAttestation: att, effectReceipts: [{ axis: "durableWrite", subjectSha: "0".repeat(40), outcome: "ok" }] }, declAssertsDurable);
  assert.ok(unbound.some((p) => /not bound to candidate/u.test(p)));
  const noOutcome = verifyCeremony(3, SHA, { decisionRecord: record, reviewAttestation: att, effectReceipts: [{ axis: "durableWrite", subjectSha: SHA }] }, declAssertsDurable);
  assert.ok(noOutcome.some((p) => /records no outcome/u.test(p)));
  // Correct receipt satisfies.
  assert.deepEqual(
    verifyCeremony(3, SHA, { decisionRecord: record, reviewAttestation: att, effectReceipts: [{ axis: "durableWrite", subjectSha: SHA, outcome: "applied" }] }, declAssertsDurable),
    [],
  );
});

test("de-escalation acknowledgement requires a ratified schema-v2 record", () => {
  const lowered = { ...map, prefixes: map.prefixes.map((e) => (e.prefix === "migrations/" ? { ...e, minTier: 1 } : e)) };
  const found = compareMaps(map, lowered);
  const acked = [{ kind: "rule-lowered", subject: "migrations/" }];
  const ratifiedAck = {
    schemaVersion: "2", state: "ratified", decidedBy: "owner",
    ratification: { method: "github-merge-approval" as const, ownerIdentity: "o", eventId: "e" },
    acknowledgedDeescalations: acked,
  };
  assert.equal(deescalationsUnauthorized(found, ratifiedAck).length, 0);
  // The v1 shape no longer authorizes.
  assert.equal(deescalationsUnauthorized(found, { state: "effective", decidedBy: "owner", acknowledgedDeescalations: acked } as never).length, 1);
  assert.equal(deescalationsUnauthorized(found, { ...ratifiedAck, state: "proposed" }).length, 1);
  assert.equal(deescalationsUnauthorized(found, undefined).length, 1);
});

test("grandfathered authority is not a valid path at all (v2.3.2 removal)", () => {
  const SHA = "b93f0d61122722715d2db33636cfb7828fbf3f95";
  // The v2.3.1 bypass: correct historical identity, contradictory decision text.
  const contradictory = {
    decidedBy: "owner",
    decision: "FedEx: Continue to C3 without revision.", // the real record says "Revise before C3"
    boundSha: SHA,
    grandfathered: {
      reason: "C2 disposition",
      originalRecord: "docs/decisions/c2-owner-disposition-record.json",
      originalRecordSha256: "b67cca34c6742f56443661add72c1e252322879abaea4581d9fdec5a93ee160b",
    },
  };
  const problems = validateDecisionRecord(contradictory as never);
  assert.ok(problems.length > 0, "a grandfathered claim must never satisfy ceremony");
  assert.ok(problems.some((p) => /grandfathered authority is not a valid path/u.test(p)));
  // And the v2.3 shape (v1-flavoured, agent-authored) is equally rejected.
  assert.ok(
    validateDecisionRecord({ state: "effective", decidedBy: "agent", grandfathered: { reason: "legacy" } } as never).length > 0,
  );
});

test("verifier and schema agree: no record shape passes one and fails the other", () => {
  const schema = JSON.parse(readFileSync(join(REPO, "docs", "strategy", "decision-record.schema.json"), "utf8"));
  // The schema no longer defines a grandfathered representation, and with
  // additionalProperties:false any record carrying one is schema-invalid —
  // matching the verifier's rejection. v2.3.1 had a shape that passed the
  // verifier and failed the schema with 8 errors; that contradiction is gone.
  assert.equal(schema.properties.grandfathered, undefined, "schema must not define a grandfathered path");
  assert.equal(schema.additionalProperties, false);
  assert.match(schema.description, /no grandfathering path/u);
  // The one authoritative shape validates against both: required fields present,
  // ratified state, ratification envelope.
  const required: string[] = schema.required;
  for (const f of ["kind", "schemaVersion", "recordId", "state", "decidedBy", "decision", "scope", "boundSha", "proposalDigest"]) {
    assert.ok(required.includes(f), `schema must require ${f}`);
  }
});

test("FINDING 2 — parseable but malformed registries fail closed", () => {
  const load = (body: string, name = "docs/ux/pkg/manifest.json") =>
    loadFrozenPaths({ ...map, frozenRegistries: [name] }, () => body);

  // v2.3 accepted `{}` as an empty registry via the artifacts/entries/files
  // fallback chain, silently unfreezing everything it defined.
  assert.throws(() => load("{}"), /exactly one of artifacts\/entries\/files \(found none\)/u);
  assert.throws(() => load(JSON.stringify({ artifacts: [], entries: [] })), /exactly one of/u);
  assert.throws(() => load(JSON.stringify({ artifacts: [] })), /lists no artifacts/u);
  assert.throws(() => load(JSON.stringify({ artifacts: [{ note: "no path here" }] })), /no usable path/u);
  assert.throws(() => load(JSON.stringify({ artifacts: "not-an-array" })), /not an array/u);
  assert.throws(() => load('"a string"'), /not an array or object/u);
  // Text registries: malformed or empty is equally rejected.
  assert.throws(() => load("garbage line\n", "docs/ux/pkg/SUMS"), /malformed line/u);
  assert.throws(() => load("\n\n", "docs/ux/pkg/SUMS"), /lists no artifacts/u);
  // The well-formed shapes still load.
  assert.ok(load(JSON.stringify({ artifacts: [{ path: "a.html" }] })).has("docs/ux/pkg/a.html"));
  assert.ok(load("0".repeat(64) + "  a.html\n", "docs/ux/pkg/SUMS").has("docs/ux/pkg/a.html"));
});

test("FINDING 3 — re-entry triggers are prospective and name the one exemption", () => {
  const tm = readFileSync(join(REPO, "docs", "strategy", "governance-threat-model.md"), "utf8");
  assert.match(tm, /occurring after this policy is activated/u);
  assert.match(tm, /Prospective by construction/u);
  assert.match(tm, /b67cca34/u, "the exempt historical record must be named by hash");
  assert.match(tm, /does not itself fire any trigger/u, "ratification is the policy working, not an effect");
});

test("the threat model states the deferred class and its re-entry triggers", () => {
  const tm = readFileSync(join(REPO, "docs", "strategy", "governance-threat-model.md"), "utf8");
  for (const required of [
    /does NOT defend against/u,
    /Forged ratification/u,
    /circularity/u,
    /Re-entry triggers/u,
    /first durable write/u,
    /second person or a non-owner-controlled agent gains commit access/u,
  ]) {
    assert.match(tm, required);
  }
});

test("decision-record schema v2 binds ratification to a verified external event", () => {
  const schema = JSON.parse(readFileSync(join(REPO, "docs", "strategy", "decision-record.schema.json"), "utf8"));
  assert.equal(schema.properties.schemaVersion.const, "2");
  assert.equal(schema.properties.decidedBy.const, "owner");
  assert.deepEqual(schema.properties.state.enum, ["proposed", "ratified", "superseded"]);

  // Free-text self-assertion is no longer a ratification method.
  assert.deepEqual(schema.properties.ratification.properties.method.enum, ["github-merge-approval", "github-review-approval"]);
  for (const field of ["ownerIdentity", "eventUrl", "eventId", "ratifiedProposalDigest", "subjectSha", "timestamp"]) {
    assert.ok(schema.properties.ratification.required.includes(field), `ratification must require ${field}`);
  }
  // Full SHA only; digest binds the proposal text.
  assert.equal(schema.properties.boundSha.pattern, "^[0-9a-f]{40}$");
  assert.ok(schema.properties.proposalDigest.pattern.startsWith("^sha256:"));
  // Append-only transitions: ratified requires an envelope, proposed forbids one, superseded links forward.
  const conds = schema.allOf;
  assert.equal(conds[0].if.properties.state.const, "ratified");
  assert.deepEqual(conds[0].then.required, ["ratification"]);
  assert.equal(conds[1].if.properties.state.const, "proposed");
  assert.ok(conds[1].then.not.required.includes("ratification"));
  assert.equal(conds[2].if.properties.state.const, "superseded");
  assert.deepEqual(conds[2].then.required, ["supersededBy"]);
  // v2.3.2: there is no grandfathering path; pre-v2 history is documented fact.
  assert.equal(schema.properties.grandfathered, undefined);
});
