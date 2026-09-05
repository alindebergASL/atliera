/**
 * verify-ceremony v3 — verifies a candidate proposal against review evidence
 * obtained outside the candidate tree.
 *
 * The candidate may contain only proposed decisions. The workflow supplies raw
 * GitHub review objects, while the schema and identity trust policy are loaded
 * from the protected base. A candidate-authored ratification or review claim is
 * never an authority input.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const SHA40 = /^[0-9a-f]{40}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;

export const REQUIRED_AXES = [
  "privateData", "providerExecution", "networkOrOutbound", "retryOrRecurrence",
  "durableWrite", "identityOrAuthorization", "deployment", "customerEffect",
] as const;

export type ProposalPurpose = "build-permission" | "effect-permission";
export interface DecisionProposal {
  kind: "atliera.decision-proposal";
  schemaVersion: "3";
  recordId: string;
  state: "proposed";
  proposedBy: "agent" | "owner";
  decision: string;
  scope: string;
  purpose: ProposalPurpose;
  proposedAt: string;
  referenceUri?: string;
  effectAxes?: string[];
  proposalDigest: string;
}

export interface CeremonyManifest {
  buildProposal?: DecisionProposal;
  effectProposal?: DecisionProposal;
}

export interface ExternalReview {
  id?: number | string;
  html_url?: string;
  state?: string;
  commit_id?: string;
  submitted_at?: string;
  author_association?: string;
  body?: string;
  user?: { login?: string; id?: number; type?: string };
}

export interface TrustedPrincipal {
  login?: string;
  id?: number;
  type?: string;
}

export interface TrustPolicy {
  repository?: string;
  owner?: TrustedPrincipal;
  technicalReviewers?: TrustedPrincipal[];
  technicalReviewerHold?: string;
}

type JsonSchema = Record<string, any>;
const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

function rfc3339Epoch(value: string): number | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/u);
  if (!match || match[0] !== value) return undefined;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetSign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]! &&
    hour <= 23 && minute <= 59 && second <= 59 && offsetHour <= 23 && offsetMinute <= 59)) return undefined;
  const fraction = value.match(/\.(\d+)/u)?.[1] ?? "";
  const millis = Number((fraction + "000").slice(0, 3));
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(hour, minute, second, millis);
  const offsetDirection = offsetSign === "-" ? -1 : 1;
  const offsetMillis = offsetDirection * (offsetHour * 60 + offsetMinute) * 60_000;
  return instant.getTime() - offsetMillis;
}

const isRfc3339DateTime = (value: string): boolean => rfc3339Epoch(value) !== undefined;

function isAbsoluteUri(value: string): boolean {
  const match = value.match(/^[A-Za-z][A-Za-z0-9+.-]*:(?:[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=-]|%[0-9A-Fa-f]{2})*$/u);
  if (match?.[0] !== value) return false;
  try { new URL(value); return true; } catch { return false; }
}

function schemaProblems(value: unknown, schema: JsonSchema, path = "decision proposal"): string[] {
  const out: string[] = [];
  if (schema.const !== undefined && value !== schema.const) out.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) out.push(`${path} is not an allowed value`);

  if (schema.type === "object" || schema.properties || schema.required || schema.additionalProperties !== undefined) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [...out, `${path} must be an object`];
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!hasOwn(obj, key)) out.push(`${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) if (!hasOwn(schema.properties ?? {}, key)) out.push(`${path}.${key} is an additional property`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (hasOwn(obj, key)) out.push(...schemaProblems(obj[key], child as JsonSchema, `${path}.${key}`));
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return [...out, `${path} must be an array`];
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push(`${path} must contain at least ${schema.minItems} item(s)`);
    if (schema.uniqueItems === true && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) out.push(`${path} must contain unique items`);
    if (schema.items) value.forEach((v, i) => out.push(...schemaProblems(v, schema.items, `${path}[${i}]`)));
  } else if (schema.type === "string") {
    if (typeof value !== "string") return [...out, `${path} must be a string`];
    if (schema.minLength !== undefined && value.length < schema.minLength) out.push(`${path} is shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) out.push(`${path} does not match its required pattern`);
    if (schema.format === "uri" && !isAbsoluteUri(value)) out.push(`${path} is not an absolute URI`);
    if (schema.format === "date-time" && !isRfc3339DateTime(value)) out.push(`${path} is not in the supported RFC3339 date-time subset`);
  } else if (schema.type === "number" && typeof value !== "number") out.push(`${path} must be a number`);
  else if (schema.type === "integer" && !Number.isInteger(value)) out.push(`${path} must be an integer`);
  else if (schema.type === "boolean" && typeof value !== "boolean") out.push(`${path} must be a boolean`);

  for (const rule of schema.allOf ?? []) out.push(...schemaProblems(value, rule, path));
  if (schema.if && schemaProblems(value, schema.if, path).length === 0 && schema.then) out.push(...schemaProblems(value, schema.then, path));
  if (schema.not && schemaProblems(value, schema.not, path).length === 0) out.push(`${path} matches a forbidden schema`);
  return out;
}

function canonicalProposal(proposal: Omit<DecisionProposal, "proposalDigest"> | DecisionProposal): string {
  const effectAxes = proposal.effectAxes ? [...proposal.effectAxes].sort() : undefined;
  return JSON.stringify({
    kind: proposal.kind,
    schemaVersion: proposal.schemaVersion,
    recordId: proposal.recordId,
    state: proposal.state,
    proposedBy: proposal.proposedBy,
    decision: proposal.decision,
    scope: proposal.scope,
    purpose: proposal.purpose,
    proposedAt: proposal.proposedAt,
    ...(proposal.referenceUri ? { referenceUri: proposal.referenceUri } : {}),
    ...(effectAxes ? { effectAxes } : {}),
  });
}

export function computeProposalDigest(proposal: Omit<DecisionProposal, "proposalDigest"> | DecisionProposal): string {
  return `sha256:${createHash("sha256").update(canonicalProposal(proposal), "utf8").digest("hex")}`;
}

export function validateDecisionProposal(record: unknown, schema: JsonSchema | undefined): string[] {
  if (!schema || typeof schema !== "object") return ["protected decision-proposal schema is unavailable"];
  const problems = schemaProblems(record, schema);
  if (typeof record === "object" && record !== null) {
    const r = record as Partial<DecisionProposal>;
    if (typeof r.proposalDigest === "string" && DIGEST.test(r.proposalDigest) && r.proposalDigest !== computeProposalDigest(r as DecisionProposal)) {
      problems.push("decision proposal proposalDigest does not equal the computed digest");
    }
    if (r.purpose === "effect-permission") {
      const axes = r.effectAxes ?? [];
      if (axes.some((a) => !(REQUIRED_AXES as readonly string[]).includes(a))) problems.push("decision proposal contains an unknown effect axis");
    }
  }
  return problems;
}

/** Historical schema-shape validation only. Its result is never consumed by live authority acceptance. */
export function validateHistoricalDecisionRecordV2(record: unknown, schema?: JsonSchema): string[] {
  return schema ? schemaProblems(record, schema, "historical decision record") : ["historical decision-record schema is unavailable"];
}

export function assertedAxesFromDeclaration(declaration: unknown): string[] {
  if (typeof declaration !== "object" || declaration === null) return [];
  const effects = (declaration as { effects?: Record<string, unknown> }).effects;
  if (typeof effects !== "object" || effects === null) return [];
  return REQUIRED_AXES.filter((axis) => effects[axis] === true);
}

function expectedLines(p: DecisionProposal): string[] {
  return [
    `Atliera-Decision: ${p.decision}`,
    `Atliera-Scope: ${p.scope}`,
    `Atliera-Purpose: ${p.purpose}`,
    `Atliera-Proposal-Digest: ${p.proposalDigest}`,
  ];
}

function principalProblems(principal: TrustedPrincipal | undefined, path: string): string[] {
  const problems: string[] = [];
  if (!principal || typeof principal !== "object") return [`${path} is unavailable`];
  if (typeof principal.login !== "string" || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u.test(principal.login) || principal.login.includes("--")) {
    problems.push(`${path}.login is not a valid pinned GitHub login`);
  }
  if (!Number.isSafeInteger(principal.id) || (principal.id ?? 0) <= 0) problems.push(`${path}.id is not a positive safe integer`);
  if (principal.type !== "User") problems.push(`${path}.type must be User`);
  return problems;
}

function trustProblems(trust: TrustPolicy | undefined, repository: string | undefined): string[] {
  if (!trust || typeof trust !== "object") return ["protected identity trust policy is unavailable"];
  const problems: string[] = [];
  if (typeof trust.repository !== "string" || trust.repository.length === 0) problems.push("protected identity trust policy names no repository");
  else if (repository && repository !== trust.repository) problems.push(`repository ${repository} does not match protected trust policy`);
  problems.push(...principalProblems(trust.owner, "protected owner principal"));
  if (!Array.isArray(trust.technicalReviewers)) problems.push("protected technical reviewer list is unavailable");
  else {
    trust.technicalReviewers.forEach((principal, index) => problems.push(...principalProblems(principal, `protected technical reviewer principal ${index}`)));
    if (trust.technicalReviewers.length === 0 && (typeof trust.technicalReviewerHold !== "string" || trust.technicalReviewerHold.length === 0)) {
      problems.push("empty protected technical reviewer list must carry an explicit HOLD reason");
    }
  }
  const principals = [trust.owner, ...(trust.technicalReviewers ?? [])].filter((p): p is TrustedPrincipal => p !== undefined);
  const ids = new Set<number>();
  const logins = new Set<string>();
  for (const principal of principals) {
    if (typeof principal.id === "number" && ids.has(principal.id)) problems.push(`protected principals reuse GitHub user id ${principal.id}`);
    if (typeof principal.login === "string" && logins.has(principal.login.toLowerCase())) problems.push(`protected principals reuse GitHub login ${principal.login}`);
    if (typeof principal.id === "number") ids.add(principal.id);
    if (typeof principal.login === "string") logins.add(principal.login.toLowerCase());
  }
  return problems;
}

interface ReviewGrant {
  event: ExternalReview & { id: number; submitted_at: string; user: { login: string; id: number; type: string } };
  principal: TrustedPrincipal & { login: string; id: number; type: "User" };
}

function reduceReviews(
  events: ExternalReview[],
  proposals: DecisionProposal[],
  trust: TrustPolicy,
): { grants: Map<number, Map<string, ReviewGrant>>; problems: string[] } {
  const problems: string[] = [];
  const principals = [trust.owner, ...(trust.technicalReviewers ?? [])]
    .filter((p): p is ReviewGrant["principal"] => typeof p?.login === "string" && typeof p.id === "number" && p.type === "User");
  const authorityStates = new Set(["APPROVED", "CHANGES_REQUESTED", "DISMISSED"]);
  const seenEventIds = new Set<number>();
  const valid: Array<ReviewGrant["event"] & { state: string }> = [];

  for (const raw of events) {
    const state = raw.state?.toUpperCase() ?? "";
    if (!authorityStates.has(state)) continue;
    if (!Number.isSafeInteger(raw.id) || Number(raw.id) <= 0) {
      problems.push("external review event id is not a positive safe integer");
      continue;
    }
    const eventId = raw.id as number;
    if (seenEventIds.has(eventId)) {
      problems.push(`duplicate external review event id ${eventId}`);
      continue;
    }
    seenEventIds.add(eventId);
    if (typeof raw.submitted_at !== "string" || !isRfc3339DateTime(raw.submitted_at)) {
      problems.push(`external review event ${eventId} has malformed chronology`);
      continue;
    }
    const byLogin = principals.find((p) => p.login.toLowerCase() === raw.user?.login?.toLowerCase());
    const byId = principals.find((p) => p.id === raw.user?.id);
    if (byLogin !== byId && (byLogin !== undefined || byId !== undefined)) {
      problems.push(`external review event ${eventId} does not match the pinned login and stable user id for one principal`);
      continue;
    }
    if (!byLogin) continue;
    if (raw.user?.type !== "User") {
      problems.push(`external review event ${eventId} principal type is not User`);
      continue;
    }
    if (!SHA40.test(raw.commit_id ?? "") || typeof raw.html_url !== "string" || !/^https:\/\/github\.com\//u.test(raw.html_url)) {
      problems.push(`external review event ${eventId} has malformed immutable metadata`);
      continue;
    }
    if (state === "DISMISSED") {
      problems.push(`external review event ${eventId} dismissal chronology is unavailable from the current review snapshot`);
      continue;
    }
    valid.push(raw as ReviewGrant["event"] & { state: string });
  }

  valid.sort((a, b) => {
    const time = rfc3339Epoch(a.submitted_at)! - rfc3339Epoch(b.submitted_at)!;
    return time === 0 ? a.id - b.id : time;
  });
  const grants = new Map<number, Map<string, ReviewGrant>>();
  for (const event of valid) {
    const principal = principals.find((p) => p.id === event.user.id)!;
    const principalGrants = grants.get(principal.id) ?? new Map<string, ReviewGrant>();
    grants.set(principal.id, principalGrants);
    if (event.state === "CHANGES_REQUESTED") {
      principalGrants.clear();
      continue;
    }
    for (const proposal of proposals) {
      if (event.commit_id === undefined || expectedLines(proposal).some((line) => !(event.body ?? "").split(/\r?\n/u).includes(line))) continue;
      principalGrants.set(proposal.proposalDigest, { event, principal });
    }
  }
  return { grants, problems };
}

export function verifyCeremony(
  tier: number,
  sha: string,
  manifest: CeremonyManifest | undefined,
  declaration?: unknown,
  externalReviews: ExternalReview[] = [],
  trust?: TrustPolicy,
  schema?: JsonSchema,
  repository?: string,
): string[] {
  if (!SHA40.test(sha)) return [`candidate sha is not a 40-hex commit SHA: '${sha}'`];
  if (tier <= 1) return [];
  const problems: string[] = [];
  const identityProblems = trustProblems(trust, repository);
  problems.push(...identityProblems);

  const build = manifest?.buildProposal;
  problems.push(...validateDecisionProposal(build, schema).map((p) => `build proposal: ${p}`));
  if (build?.purpose !== "build-permission") problems.push("build proposal purpose is not build-permission");
  const effect = assertedAxesFromDeclaration(declaration).length > 0 ? manifest?.effectProposal : undefined;
  const proposals = [build, effect].filter((p): p is DecisionProposal => p !== undefined);
  const reduced = trust && identityProblems.length === 0 ? reduceReviews(externalReviews, proposals, trust) : { grants: new Map<number, Map<string, ReviewGrant>>(), problems: [] };
  problems.push(...reduced.problems);
  const ownerId = trust?.owner?.id;
  const buildApproval = build && typeof ownerId === "number" ? reduced.grants.get(ownerId)?.get(build.proposalDigest) : undefined;
  if (buildApproval?.event.commit_id !== sha || buildApproval?.event.author_association !== "OWNER") {
    if (buildApproval) reduced.grants.get(ownerId!)?.delete(build!.proposalDigest);
  }
  const acceptedBuildApproval = build && typeof ownerId === "number" ? reduced.grants.get(ownerId)?.get(build.proposalDigest) : undefined;
  if (build && trust && !acceptedBuildApproval) {
    problems.push("no external owner approval matches the exact candidate head, identity, decision, scope, purpose, and digest");
  }

  const asserted = assertedAxesFromDeclaration(declaration);
  let acceptedEffectApproval: ReviewGrant | undefined;
  if (asserted.length > 0) {
    problems.push(...validateDecisionProposal(effect, schema).map((p) => `effect permission: ${p}`));
    if (effect?.purpose !== "effect-permission") problems.push("effect permission purpose is not effect-permission");
    if (effect && JSON.stringify([...(effect.effectAxes ?? [])].sort()) !== JSON.stringify([...asserted].sort())) {
      problems.push("effect permission axes do not exactly match the declared effects");
    }
    const effectApproval = effect && typeof ownerId === "number" ? reduced.grants.get(ownerId)?.get(effect.proposalDigest) : undefined;
    acceptedEffectApproval = effectApproval?.event.commit_id === sha && effectApproval.event.author_association === "OWNER" ? effectApproval : undefined;
    if (effect && trust && !acceptedEffectApproval) {
      problems.push("no external owner approval matches the effect permission and exact candidate head");
    } else if (acceptedEffectApproval && acceptedBuildApproval && acceptedEffectApproval.event.id === acceptedBuildApproval.event.id) {
      problems.push("build permission and effect permission require distinct external owner review events");
    }
  }

  if (tier >= 3) {
    const reviewerApprovals = (trust?.technicalReviewers ?? []).map((reviewer) =>
      typeof reviewer.id === "number" && build ? reduced.grants.get(reviewer.id)?.get(build.proposalDigest) : undefined,
    ).filter((grant): grant is ReviewGrant => grant?.event.commit_id === sha);
    const technicalApproval = reviewerApprovals.find((grant) =>
      grant.principal.id !== ownerId && grant.event.id !== acceptedBuildApproval?.event.id && grant.event.id !== acceptedEffectApproval?.event.id,
    );
    if (!build || !technicalApproval) {
      const hold = trust?.technicalReviewers?.length === 0 ? ` (${trust.technicalReviewerHold ?? "HOLD: no independently verified technical reviewer principal"})` : "";
      problems.push(`tier 3 requires an independent technical review bound to the build proposal and exact candidate head${hold}`);
    }
  }
  return problems;
}

const isMain = process.argv[1]?.endsWith("verify-ceremony.ts");
if (isMain) {
  const argv = process.argv.slice(2);
  const value = (flag: string): string | undefined => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const tier = Number(value("--tier"));
  const sha = value("--sha");
  if (!Number.isInteger(tier) || !sha) {
    process.stderr.write("usage: verify-ceremony.ts --tier N --sha SHA [--manifest FILE] --events FILE --trust FILE --proposal-schema FILE [--declaration FILE] [--repository OWNER/REPO]\n");
    process.exit(5);
  }
  const readJson = (path: string | undefined): unknown => path ? JSON.parse(readFileSync(path, "utf8")) : undefined;
  try {
    const problems = verifyCeremony(
      tier, sha, readJson(value("--manifest")) as CeremonyManifest | undefined,
      readJson(value("--declaration")), (readJson(value("--events")) ?? []) as ExternalReview[],
      readJson(value("--trust")) as TrustPolicy | undefined, readJson(value("--proposal-schema")) as JsonSchema | undefined,
      value("--repository"),
    );
    process.stdout.write(JSON.stringify({ tier, sha, satisfied: problems.length === 0, problems,
      assuranceScope: "pinned GitHub principal ids, chronology-reduced external reviews, exact head, and explicit proposal binding; human-vs-delegated credential provenance remains an operational trust root" }, null, 2) + "\n");
    if (problems.length > 0) process.exit(6);
  } catch (err) {
    process.stderr.write(`invalid ceremony input: ${(err as Error).message}\n`);
    process.exit(5);
  }
}
