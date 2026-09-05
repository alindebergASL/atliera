/**
 * verify-ceremony v2.3 — enforces the ceremony a computed tier requires.
 *
 * classify-change-risk.ts computes the tier and refuses frozen mutation; it does
 * NOT check that the tier's evidence exists. This script does, and runs as a
 * separate required check so a green classification can never be mistaken for a
 * satisfied ceremony.
 *
 * v2.3 corrections (from the v2.2 adoption review):
 *  - Consumes ONLY schema-v2 decision records (`state: "ratified"` plus a
 *    ratification envelope). v2.2 shipped schema v2 while the verifier still
 *    required v1's `state: "effective"` / free-text `ownerAttestation`, so a
 *    valid v2 record was rejected and a v1-shaped one accepted. v1-shaped
 *    records are now rejected outright except explicitly grandfathered history.
 *  - Exact 40-hex SHA equality (v2.2 used `startsWith`, so an empty string
 *    matched every SHA).
 *  - Cross-field equality is enforced at runtime: ratification.subjectSha ===
 *    boundSha and ratification.ratifiedProposalDigest === proposalDigest.
 *    JSON Schema cannot express these.
 *  - Asserted effect axes are derived from the COMMITTED change-risk.json, not
 *    from a ceremony manifest field an author can omit.
 *
 * KNOWN AND DEFERRED — read docs/strategy/governance-threat-model.md before
 * relying on this for adversarial assurance. This verifier checks internal
 * consistency of committed evidence. It does NOT resolve the claimed GitHub
 * event live, validate owner identity against an allowlist, or recompute the
 * proposal digest from a normative canonicalization. A determined author with
 * write access to the branch can still author self-consistent evidence. That
 * class is deferred deliberately while Atliera produces zero durable, outbound,
 * or customer effects; the threat model states the re-entry triggers.
 *
 * Usage:
 *   node --experimental-strip-types scripts/verify-ceremony.ts \
 *     --tier <0|1|2|3> --sha <40-hex> [--manifest ceremony.json] \
 *     [--declaration change-risk.json]
 * Exit 0 satisfied · 6 missing/invalid ceremony evidence · 5 bad inputs.
 * Pure: reads inputs, writes only its report.
 */

import { readFileSync } from "node:fs";

const SHA40 = /^[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export interface Ratification {
  method?: string;
  ownerIdentity?: string;
  eventUrl?: string;
  eventId?: string;
  ratifiedProposalDigest?: string;
  subjectSha?: string;
  timestamp?: string;
}

export interface DecisionRecordV2 {
  kind?: string;
  schemaVersion?: string;
  recordId?: string;
  state?: string;
  decidedBy?: string;
  decision?: string;
  scope?: string;
  boundSha?: string;
  proposalDigest?: string;
  ratification?: Ratification;
  /** Present only on rejected legacy input; carries no authority. */
  grandfathered?: unknown;
  /** v1 leftovers — their presence is itself a rejection signal. */
  ownerAttestation?: unknown;
}

export interface ReviewAttestation {
  reviewer?: string;
  eventUrl?: string;
  eventId?: string;
  verdict?: string;
  boundSha?: string;
}

export interface CeremonyManifest {
  decisionRecord?: DecisionRecordV2;
  reviewAttestation?: ReviewAttestation;
  /** Receipts, each bound to the subject SHA and an effect axis. */
  effectReceipts?: Array<{ axis?: string; subjectSha?: string; outcome?: string; path?: string }>;
}

export const REQUIRED_AXES = [
  "privateData",
  "providerExecution",
  "networkOrOutbound",
  "retryOrRecurrence",
  "durableWrite",
  "identityOrAuthorization",
  "deployment",
  "customerEffect",
] as const;

/** Asserted axes come from the committed declaration — never from the ceremony manifest. */
export function assertedAxesFromDeclaration(declaration: unknown): string[] {
  if (typeof declaration !== "object" || declaration === null) return [];
  const effects = (declaration as { effects?: Record<string, unknown> }).effects;
  if (typeof effects !== "object" || effects === null) return [];
  return REQUIRED_AXES.filter((axis) => effects[axis] === true);
}

/** Structural validation of a schema-v2 decision record, including cross-field equalities. */
export function validateDecisionRecord(record: DecisionRecordV2 | undefined): string[] {
  const problems: string[] = [];
  if (!record) return ["no owner decision record supplied"];

  // v2.3.2: the grandfather mechanism is REMOVED, not repaired. It existed to
  // let one already-closed historical decision pass a check nothing needs to
  // run on it, and it produced a bypass in each of its two revisions (v2.3:
  // early return admitted any v1/agent record; v2.3.1: correct identity with
  // contradictory decision text). A record claiming grandfathered authority is
  // now simply invalid; the historical C2 disposition remains a documented
  // historical fact and needs no machine-checkable authority path.
  if ("grandfathered" in record && record.grandfathered !== undefined) {
    problems.push("grandfathered authority is not a valid path; every decision must be a ratified v2 record");
  }

  if (record.schemaVersion !== "2") {
    problems.push(`decision record is not schema v2 (got ${record.schemaVersion ?? "none"}); v1 authority is not accepted`);
  }
  if ("ownerAttestation" in record && record.ownerAttestation !== undefined) {
    problems.push("record carries a v1 'ownerAttestation'; v2 authority requires a ratification envelope");
  }
  if (record.kind !== "atliera.owner-decision") problems.push("unexpected record kind");
  if (!record.recordId) problems.push("record has no recordId");
  if (!record.decision) problems.push("record states no decision");
  if (!record.scope) problems.push("record states no scope");
  if (record.decidedBy !== "owner") problems.push("decidedBy is not 'owner'");
  if (record.state !== "ratified") {
    problems.push(`record state is '${record.state ?? "none"}'; only 'ratified' carries authority`);
  }
  if (!record.boundSha || !SHA40.test(record.boundSha)) problems.push("boundSha is not a 40-hex commit SHA");
  if (!record.proposalDigest || !DIGEST.test(record.proposalDigest)) problems.push("proposalDigest is not a sha256:<64-hex> digest");

  const r = record.ratification;
  if (!r) {
    problems.push("ratified record carries no ratification envelope");
  } else {
    if (r.method !== "github-merge-approval" && r.method !== "github-review-approval") {
      problems.push(`ratification method '${r.method ?? "none"}' is not an externally verifiable event`);
    }
    if (!r.ownerIdentity) problems.push("ratification names no ownerIdentity");
    if (!r.eventUrl) problems.push("ratification has no eventUrl");
    if (!r.eventId) problems.push("ratification has no eventId");
    if (!r.timestamp) problems.push("ratification has no timestamp");
    // Cross-field equalities — the bindings JSON Schema cannot express.
    if (!r.subjectSha || !SHA40.test(r.subjectSha)) problems.push("ratification.subjectSha is not a 40-hex SHA");
    else if (record.boundSha && r.subjectSha !== record.boundSha) {
      problems.push("ratification.subjectSha does not equal the record's boundSha");
    }
    if (!r.ratifiedProposalDigest || !DIGEST.test(r.ratifiedProposalDigest)) {
      problems.push("ratification.ratifiedProposalDigest is not a valid digest");
    } else if (record.proposalDigest && r.ratifiedProposalDigest !== record.proposalDigest) {
      problems.push("ratification.ratifiedProposalDigest does not equal the record's proposalDigest");
    }
  }
  return problems;
}

export function verifyCeremony(
  tier: number,
  sha: string,
  manifest: CeremonyManifest | undefined,
  declaration?: unknown,
): string[] {
  const problems: string[] = [];
  if (!SHA40.test(sha)) return [`candidate sha is not a 40-hex commit SHA: '${sha}'`];
  if (tier <= 1) return problems;

  const m = manifest ?? {};
  const record = m.decisionRecord;
  problems.push(...validateDecisionRecord(record).map((p) => `decision record: ${p}`));
  if (record?.boundSha && SHA40.test(record.boundSha) && record.boundSha !== sha) {
    problems.push(`decision record boundSha ${record.boundSha} does not equal candidate ${sha}`);
  }

  if (tier >= 3) {
    const att = m.reviewAttestation;
    if (!att) {
      problems.push("tier 3 requires an external SHA-bound review attestation; none supplied");
    } else {
      if (!att.reviewer) problems.push("review attestation names no reviewer");
      if (!att.eventUrl) problems.push("review attestation has no immutable event URL");
      if (!att.eventId) problems.push("review attestation has no event id");
      if ((att.verdict ?? "").toUpperCase() !== "PASS") problems.push("review attestation verdict is not PASS");
      if (!att.boundSha || !SHA40.test(att.boundSha)) problems.push("review attestation boundSha is not a 40-hex SHA");
      else if (att.boundSha !== sha) problems.push(`review attestation boundSha ${att.boundSha} does not equal candidate ${sha}`);
    }

    // Receipts are demanded by the COMMITTED declaration, not by the manifest.
    const asserted = assertedAxesFromDeclaration(declaration);
    const receipts = m.effectReceipts ?? [];
    for (const axis of asserted) {
      const receipt = receipts.find((r) => r.axis === axis);
      if (!receipt) {
        problems.push(`declaration asserts '${axis}' but no effect receipt for that axis is supplied`);
        continue;
      }
      if (!receipt.subjectSha || receipt.subjectSha !== sha) {
        problems.push(`effect receipt for '${axis}' is not bound to candidate ${sha}`);
      }
      if (!receipt.outcome) problems.push(`effect receipt for '${axis}' records no outcome`);
    }
  }

  return problems;
}

const isMain = process.argv[1]?.endsWith("verify-ceremony.ts");
if (isMain) {
  const argv = process.argv.slice(2);
  let tier: number | undefined;
  let sha: string | undefined;
  let manifestPath: string | undefined;
  let declarationPath: string | undefined = "change-risk.json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tier") tier = Number(argv[++i]);
    else if (argv[i] === "--sha") sha = argv[++i];
    else if (argv[i] === "--manifest") manifestPath = argv[++i];
    else if (argv[i] === "--declaration") declarationPath = argv[++i];
  }
  if (tier === undefined || Number.isNaN(tier) || !sha) {
    process.stderr.write("usage: verify-ceremony.ts --tier <0|1|2|3> --sha <40-hex> [--manifest ceremony.json] [--declaration change-risk.json]\n");
    process.exit(5);
  }
  const readJson = (p: string | undefined, label: string): unknown => {
    if (!p) return undefined;
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch (err) {
      if (label === "declaration") return undefined; // absent declaration => no asserted effects
      process.stderr.write(`invalid ${label}: ${(err as Error).message}\n`);
      process.exit(5);
    }
  };
  const manifest = readJson(manifestPath, "ceremony manifest") as CeremonyManifest | undefined;
  const declaration = readJson(declarationPath, "declaration");

  const problems = verifyCeremony(tier, sha, manifest, declaration);
  process.stdout.write(
    JSON.stringify(
      {
        tier,
        sha,
        satisfied: problems.length === 0,
        problems,
        assuranceScope: "internal consistency of committed evidence; live event resolution deferred (see docs/strategy/governance-threat-model.md)",
      },
      null,
      2,
    ) + "\n",
  );
  if (problems.length > 0) process.exit(6);
}
