/**
 * classify-change-risk v2.1 — computes the governance tier of a change set.
 *
 * Tier is COMPUTED, never chosen. Per-file tier = max(matching path-rule
 * minimums, declared-effect axis minimums); PR tier = max per-file tier.
 * Path rules: a rule ending in "/" is a directory prefix; any other rule
 * matches by EXACT equality only (so "README.md.evil" never inherits
 * "README.md"'s tier — it is unmapped and fails closed).
 * Unmapped paths are Tier 3 always; declarations only RAISE tiers.
 * Frozen-registry paths are hard violations unless the change set INCLUDES a
 * supersession record under the supersession prefix. Registry entries resolve
 * from the registry's own directory to repository-relative paths.
 * Candidate-map de-escalation from the protected pricing map is detected
 * mechanically (compareMaps) and refused. No candidate-authored exception is
 * a live authority input.
 *
 * CLI (CI usage; pure — reads inputs, writes nothing):
 *   node --experimental-strip-types scripts/classify-change-risk.ts \
 *     [--map protected-governance-tiers.json] [--candidate-map governance-tiers.json] \
 *     [--declaration change-risk.json] [--require-declaration] file1 file2 ...
 * Exit 2: frozen violation. Exit 3: missing/invalid declaration when required.
 * Exit 4: candidate de-escalation detected (HOLD).
 */

import { readFileSync } from "node:fs";

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

export type EffectVector = Record<(typeof REQUIRED_AXES)[number], boolean>;

/** Change-set entry: path plus its git name-status, so deletions cannot satisfy inclusion checks. */
export interface ChangeEntry {
  path: string;
  /** git name-status letter: A added, M modified, D deleted, R renamed (rename target). */
  status?: "A" | "M" | "D" | "R";
  /** For a rename/copy, the SOURCE path — classified as a removal of that identity. */
  from?: string;
}

export interface Declaration {
  effects: EffectVector;
  /** Paths whose change weakens a guard; each names the guarded subject path. Self-reported; see policy §4.4 for the review duty and diff heuristic that back it. */
  guardWeakening?: Record<string, string>;
  /** Frozen paths this change supersedes; each names a supersession record path that MUST be included in the change set. */
  supersessions?: Record<string, string>;
}

export interface TierMap {
  kind: string;
  schemaVersion: string;
  algorithm: string;
  unmappedPathPolicy: string;
  axisMinTiers: Record<string, number>;
  prefixes: Array<{ prefix: string; minTier: number; note?: string }>;
  frozenRegistries: string[];
  supersessionPathPrefix: string;
}

export interface FileClassification {
  path: string;
  tier: number;
  reasons: string[];
  violation?: string;
}

export interface ChangeClassification {
  prTier: number;
  files: FileClassification[];
  violations: string[];
}

const UNMAPPED_TIER = 3;

export const EXPECTED_MAP = {
  kind: "atliera.governance-tier-map",
  schemaVersion: "2",
  algorithm: "max-across-all-matching-prefixes",
  unmappedPathPolicy: "tier3-always-declarations-never-lower",
} as const;

export function loadMap(json: string): TierMap {
  const map = JSON.parse(json) as TierMap;
  if (map.kind !== EXPECTED_MAP.kind) throw new Error(`unexpected map kind: ${map.kind}`);
  if (map.schemaVersion !== EXPECTED_MAP.schemaVersion)
    throw new Error(`unsupported map schemaVersion: ${map.schemaVersion}`);
  if (map.algorithm !== EXPECTED_MAP.algorithm) throw new Error(`unsupported algorithm: ${map.algorithm}`);
  if (map.unmappedPathPolicy !== EXPECTED_MAP.unmappedPathPolicy)
    throw new Error(`unsupported unmappedPathPolicy: ${map.unmappedPathPolicy}`);

  // Every axis must be present with a sane minimum; effect axes may never be
  // priced below the floors the policy fixes.
  const AXIS_FLOOR: Record<string, number> = {
    privateData: 2,
    providerExecution: 2,
    networkOrOutbound: 3,
    retryOrRecurrence: 3,
    durableWrite: 3,
    identityOrAuthorization: 3,
    deployment: 3,
    customerEffect: 3,
  };
  for (const axis of REQUIRED_AXES) {
    const min = map.axisMinTiers?.[axis];
    if (!Number.isInteger(min)) throw new Error(`axisMinTiers.${axis} missing`);
    if ((min as number) < AXIS_FLOOR[axis]!) throw new Error(`axisMinTiers.${axis} below policy floor ${AXIS_FLOOR[axis]}`);
  }
  for (const axis of Object.keys(map.axisMinTiers ?? {})) {
    if (!(REQUIRED_AXES as readonly string[]).includes(axis)) throw new Error(`unknown effect axis in map: ${axis}`);
  }

  if (!Array.isArray(map.frozenRegistries) || map.frozenRegistries.length === 0)
    throw new Error("frozenRegistries must be a non-empty array");
  for (const reg of map.frozenRegistries) {
    if (typeof reg !== "string" || reg.startsWith("/") || reg.split("/").includes(".."))
      throw new Error(`unsafe frozen registry path: ${reg}`);
  }
  if (typeof map.supersessionPathPrefix !== "string" || !map.supersessionPathPrefix.endsWith("/"))
    throw new Error("supersessionPathPrefix must be a directory prefix ending in /");
  if (!Array.isArray(map.prefixes) || map.prefixes.length === 0) throw new Error("prefixes must be a non-empty array");

  const seen = new Set<string>();
  for (const entry of map.prefixes) {
    if (typeof entry.prefix !== "string" || entry.prefix.length === 0) throw new Error("empty prefix");
    if (!Number.isInteger(entry.minTier) || entry.minTier < 0 || entry.minTier > 3)
      throw new Error(`minTier out of range for ${entry.prefix}`);
    if (seen.has(entry.prefix)) throw new Error(`duplicate prefix: ${entry.prefix}`);
    seen.add(entry.prefix);
  }
  return map;
}

/** Declarations are structurally complete or invalid: all eight axes, booleans, no extras. */
export function validateDeclaration(decl: unknown): Declaration {
  if (typeof decl !== "object" || decl === null) throw new Error("declaration must be an object");
  const d = decl as Record<string, unknown>;
  if (typeof d.effects !== "object" || d.effects === null) throw new Error("declaration.effects is required");
  const effects = d.effects as Record<string, unknown>;
  for (const axis of REQUIRED_AXES) {
    if (typeof effects[axis] !== "boolean") throw new Error(`declaration.effects.${axis} must be an explicit boolean`);
  }
  for (const key of Object.keys(effects)) {
    if (!(REQUIRED_AXES as readonly string[]).includes(key)) throw new Error(`unknown effect axis: ${key}`);
  }
  return decl as Declaration;
}

function ruleMatches(rule: string, path: string): boolean {
  return rule.endsWith("/") ? path.startsWith(rule) : path === rule;
}

function axisTier(map: TierMap, effects: EffectVector | undefined): { tier: number; reasons: string[] } {
  if (!effects) return { tier: -1, reasons: [] };
  let tier = -1;
  const reasons: string[] = [];
  for (const [axis, on] of Object.entries(effects)) {
    if (!on) continue;
    const min = map.axisMinTiers[axis];
    if (min === undefined) throw new Error(`unknown effect axis: ${axis}`);
    if (min > tier) tier = min;
    reasons.push(`effect ${axis} => tier >= ${min}`);
  }
  return { tier, reasons };
}

export function classifyFile(
  map: TierMap,
  path: string,
  frozenPaths: Set<string>,
  declaration?: Declaration,
  changedPaths?: Map<string, string>,
): FileClassification {
  const reasons: string[] = [];

  // Frozen paths: hard violation unless the supersession record is INCLUDED in
  // this change set under the supersession prefix — naming it is not including it.
  if (frozenPaths.has(path)) {
    const ownStatus = changedPaths?.get(path);
    if (ownStatus === "D") {
      return {
        path,
        tier: 3,
        reasons: ["frozen artifact"],
        violation: `frozen artifact deleted or renamed away: ${path} (supersede, never remove)`,
      };
    }
    const record = declaration?.supersessions?.[path];
    // The record must be PRESENT at the candidate head: added or modified in
    // this change set (a deleted path is not a record), or already existing.
    const status = record !== undefined ? changedPaths?.get(record) : undefined;
    const included = record !== undefined && status !== undefined && status !== "D";
    if (!record || !record.startsWith(map.supersessionPathPrefix) || !included) {
      return {
        path,
        tier: 3,
        reasons: ["frozen artifact"],
        violation: `frozen artifact modified without an included supersession record: ${path}`,
      };
    }
    reasons.push(`frozen artifact superseded via included record ${record}`);
  }

  // Path minimums: maximum across ALL matching rules. Directory rules end in
  // "/"; file rules match exactly — no alias inheritance.
  const matches = map.prefixes.filter((e) => ruleMatches(e.prefix, path));
  let tier = -1;
  for (const m of matches) {
    if (m.minTier > tier) tier = m.minTier;
    reasons.push(`rule ${m.prefix} => tier >= ${m.minTier}`);
  }

  const declared = axisTier(map, declaration?.effects);
  if (matches.length === 0) {
    // Fail closed, always: declarations never lower an unmapped path.
    tier = Math.max(UNMAPPED_TIER, declared.tier);
    reasons.push(`unmapped path => fail closed tier ${UNMAPPED_TIER} (declarations never lower)`);
  } else if (declared.tier > tier) {
    tier = declared.tier;
  }
  reasons.push(...declared.reasons);

  const guarded = declaration?.guardWeakening?.[path];
  if (guarded) {
    const subject = classifyFile(map, guarded, frozenPaths);
    if (subject.tier > tier) tier = subject.tier;
    reasons.push(`weakens guard of ${guarded} => inherits tier ${subject.tier}`);
  }

  return { path, tier, reasons };
}

export function classifyChange(
  map: TierMap,
  entries: Array<string | ChangeEntry>,
  frozenPaths: Set<string>,
  declaration?: Declaration,
): ChangeClassification {
  const norm: ChangeEntry[] = entries.map((e) => (typeof e === "string" ? { path: e, status: "M" } : e));

  // A rename is TWO identities: the source disappears and the target appears.
  // v2.2 classified only the target, so renaming a frozen artifact escaped the
  // frozen check entirely. Expand renames into an explicit source removal.
  const expanded: ChangeEntry[] = [];
  for (const e of norm) {
    if (e.status === "R" && e.from && e.from !== e.path) {
      expanded.push({ path: e.from, status: "D" });
    }
    expanded.push(e);
  }

  const changed = new Map(expanded.map((e) => [e.path, e.status ?? "M"]));
  const files = expanded.map((e) => classifyFile(map, e.path, frozenPaths, declaration, changed));
  const violations = files.filter((f) => f.violation).map((f) => f.violation!);
  const prTier = files.reduce((t, f) => Math.max(t, f.tier), 0);
  return { prTier, files, violations };
}

export interface Deescalation {
  kind: "rule-lowered" | "rule-removed" | "axis-lowered" | "axis-removed" | "registry-removed";
  subject: string;
  from: number | string;
  to: number | string;
}

/** Mechanical de-escalation detection between the protected pricing map and candidate map data (policy §4.5). */
export function compareMaps(base: TierMap, next: TierMap): Deescalation[] {
  const out: Deescalation[] = [];
  const nextRules = new Map(next.prefixes.map((e) => [e.prefix, e.minTier]));
  for (const e of base.prefixes) {
    const now = nextRules.get(e.prefix);
    if (now === undefined) out.push({ kind: "rule-removed", subject: e.prefix, from: e.minTier, to: "absent" });
    else if (now < e.minTier) out.push({ kind: "rule-lowered", subject: e.prefix, from: e.minTier, to: now });
  }
  for (const [axis, min] of Object.entries(base.axisMinTiers)) {
    const now = next.axisMinTiers[axis];
    if (now === undefined) out.push({ kind: "axis-removed", subject: axis, from: min, to: "absent" });
    else if (now < min) out.push({ kind: "axis-lowered", subject: axis, from: min, to: now });
  }
  for (const reg of base.frozenRegistries) {
    if (!next.frozenRegistries.includes(reg)) out.push({ kind: "registry-removed", subject: reg, from: "frozen", to: "absent" });
  }
  return out;
}

/** Resolve registry entries (relative to the registry's directory) to repository-relative paths. */
export class RegistryError extends Error {}

export function loadFrozenPaths(
  map: TierMap,
  readFile: (p: string) => string | undefined,
  unsafeOut?: string[],
): Set<string> {
  const frozen = new Set<string>();
  const unsafe = unsafeOut ?? [];
  for (const registry of map.frozenRegistries) {
    const raw = readFile(registry);
    // FAIL CLOSED (v2.3): a missing or unreadable registry previously loaded
    // zero frozen paths for it, so deleting a registry silently unfroze
    // everything it defined. Every map-listed registry must exist and parse.
    if (raw === undefined) {
      throw new RegistryError(`frozen registry missing or unreadable at candidate head: ${registry}`);
    }
    frozen.add(registry);
    const base = registry.includes("/") ? registry.slice(0, registry.lastIndexOf("/") + 1) : "";
    // Registries differ in convention: the historical manifests/SHA256SUMS carry
    // repository-relative paths; the fresh ones carry entries relative to the
    // registry's own directory. Preserve entries already rooted under the
    // registry directory; resolve the rest against it. Reject unsafe entries
    // (absolute, parent traversal) rather than silently mis-resolving them.
    const resolve = (raw: string): string | undefined => {
      const clean = raw.replace(/^\.\//u, "").trim();
      if (clean === "" || clean.startsWith("/") || clean.split("/").includes("..")) return undefined;
      if (base !== "" && clean.startsWith(base)) return clean; // already repository-relative
      return base + clean;
    };
    if (registry.endsWith(".json")) {
      let doc: any;
      try {
        doc = JSON.parse(raw);
      } catch (err) {
        throw new RegistryError(`frozen registry does not parse: ${registry}: ${(err as Error).message}`);
      }
      // Exactly one recognized array shape (v2.3.1). v2.3 fell through
      // artifacts -> entries -> files -> [], so a registry containing `{}`
      // parsed as "empty" and silently unfroze everything it defined — the
      // same drift class as the v2.1 regression.
      let entries: unknown;
      if (Array.isArray(doc)) {
        entries = doc;
      } else if (doc !== null && typeof doc === "object") {
        const shapes = (["artifacts", "entries", "files"] as const).filter((k) => k in doc);
        if (shapes.length !== 1) {
          throw new RegistryError(
            `frozen registry ${registry} must contain exactly one of artifacts/entries/files (found ${shapes.length === 0 ? "none" : shapes.join(", ")})`,
          );
        }
        entries = (doc as Record<string, unknown>)[shapes[0]!];
      } else {
        throw new RegistryError(`frozen registry ${registry} is not an array or object`);
      }
      if (!Array.isArray(entries)) {
        throw new RegistryError(`frozen registry ${registry} entry list is not an array`);
      }
      if (entries.length === 0) {
        throw new RegistryError(`frozen registry ${registry} lists no artifacts; an empty registry freezes nothing`);
      }
      for (const e of entries) {
        const p = typeof e === "string" ? e : (e as { path?: string; file?: string })?.path ?? (e as { file?: string })?.file;
        if (typeof p !== "string" || p.trim() === "") {
          throw new RegistryError(`frozen registry ${registry} contains an entry with no usable path`);
        }
        const r = resolve(p);
        if (r === undefined) unsafe.push(`${registry}: ${p}`);
        else frozen.add(r);
      }
    } else {
      let matched = 0;
      for (const line of raw.split("\n")) {
        if (line.trim() === "") continue;
        const m = line.match(/^[0-9a-f]{64}\s+\*?(.+)$/u);
        if (!m) {
          throw new RegistryError(`frozen registry ${registry} has a malformed line: ${line.slice(0, 60)}`);
        }
        matched += 1;
        const r = resolve(m[1]!.trim());
        if (r === undefined) unsafe.push(`${registry}: ${m[1]!.trim()}`);
        else frozen.add(r);
      }
      if (matched === 0) {
        throw new RegistryError(`frozen registry ${registry} lists no artifacts; an empty registry freezes nothing`);
      }
    }
  }
  return frozen;
}

// ---- CLI ----
const isMain = process.argv[1]?.endsWith("classify-change-risk.ts");
if (isMain) {
  const argv = process.argv.slice(2);
  let mapPath = "docs/strategy/governance-tiers.json";
  let candidateMapPath: string | undefined;
  let declPath: string | undefined;
  let statusPath: string | undefined;
  let requireDeclaration = false;
  const paths: string[] = [];

  // Everything after "--" is a path, never an option (option-like filename safety).
  let optionsDone = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (optionsDone) { paths.push(a); continue; }
    if (a === "--") { optionsDone = true; continue; }
    if (a === "--map") mapPath = argv[++i]!;
    else if (a === "--candidate-map") candidateMapPath = argv[++i]!;
    else if (a === "--declaration") declPath = argv[++i]!;
    else if (a === "--name-status") statusPath = argv[++i]!;
    else if (a === "--require-declaration") requireDeclaration = true;
    else paths.push(a);
  }

  const fail = (code: number, message: string): never => {
    process.stderr.write(`${message}\n`);
    process.exit(code);
  };

  let map: TierMap;
  try {
    map = loadMap(readFileSync(mapPath, "utf8"));
  } catch (err) {
    fail(5, `invalid tier map: ${(err as Error).message}`);
  }

  // Change set: NUL-delimited `git diff --name-status -z` when provided, else bare paths.
  let entries: ChangeEntry[];
  if (statusPath) {
    const raw = statusPath === "-" ? readFileSync(0, "utf8") : readFileSync(statusPath, "utf8");
    const fields = raw.split("\0").filter((f) => f !== "");
    entries = [];
    for (let i = 0; i < fields.length; i++) {
      const code = fields[i]!;
      const letter = code[0] as ChangeEntry["status"];
      if (letter === "R" || code[0] === "C") {
        // rename/copy: <code>\0<source>\0<target> — BOTH identities are classified
        const source = fields[++i]!;
        const target = fields[++i]!;
        entries.push({ path: target, status: "R", from: source });
      } else {
        i += 1;
        entries.push({ path: fields[i]!, status: letter });
      }
    }
  } else {
    entries = paths.map((p) => ({ path: p, status: "M" as const }));
  }
  if (entries.length === 0) {
    process.stdout.write(JSON.stringify({ prTier: 0, files: [], violations: [], deescalations: [] }, null, 2) + "\n");
    process.exit(0);
  }

  let declaration: Declaration | undefined;
  if (declPath) {
    try {
      declaration = validateDeclaration(JSON.parse(readFileSync(declPath, "utf8")));
    } catch (err) {
      fail(3, `invalid effect declaration: ${(err as Error).message}`);
    }
  } else if (requireDeclaration) {
    fail(3, "effect declaration required and not provided");
  }

  const unsafeRegistryEntries: string[] = [];
  let frozen: Set<string>;
  try {
    frozen = loadFrozenPaths(
      map!,
      (p) => {
        try {
          return readFileSync(p, "utf8");
        } catch {
          return undefined;
        }
      },
      unsafeRegistryEntries,
    );
  } catch (err) {
    // A missing, unreadable, or unparseable registry fails closed: without it
    // the frozen set is incomplete and no classification can be trusted.
    fail(5, `frozen registry state invalid: ${(err as Error).message}`);
  }
  if (unsafeRegistryEntries.length > 0) {
    fail(5, `unsafe frozen-registry entries: ${unsafeRegistryEntries.join(", ")}`);
  }

  const result = classifyChange(map!, entries, frozen!, declaration);

  let deescalations: Deescalation[] = [];
  if (candidateMapPath) {
    try {
      const candidateMap = loadMap(readFileSync(candidateMapPath, "utf8"));
      deescalations = compareMaps(map!, candidateMap);
    } catch (err) {
      fail(5, `invalid candidate governance map: ${(err as Error).message}`);
    }
  }

  process.stdout.write(
    JSON.stringify({ ...result, deescalations, unauthorizedDeescalations: deescalations }, null, 2) + "\n",
  );

  // Exit contract (propagated verbatim by scripts/classify-pr.sh):
  //   2 frozen violation · 3 declaration invalid · 4 candidate de-escalation HOLD · 5 invalid map/registry
  if (result.violations.length > 0) process.exit(2);
  if (deescalations.length > 0) {
    process.stderr.write("HOLD: candidate governance rule lowering/removal requires a future separately authorized gate; no candidate acknowledgement or administrator bypass is accepted\n");
    process.exit(4);
  }
}
