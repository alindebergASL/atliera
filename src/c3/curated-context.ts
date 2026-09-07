import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { canonicalJson, C3_ACCOUNT_CONTEXT_KIND, C3_ACCOUNT_CONTEXT_VERSION } from "./context.ts";
import { deepFreezeOwnData } from "../authority/strict-json.ts";
import type { AccountEntityBoundary, IntelligenceStatement } from "../account-intelligence/contracts.ts";
import type { C3ViewContext, C3ViewSource, FrozenC3ViewContext } from "./view-context.ts";
const hash = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const MAX = 1024 * 1024;
function obj(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("curated object required");
  const r = v as Record<string, unknown>;
  if (Object.keys(r).length !== keys.length || keys.some(k => !Object.hasOwn(r, k)) || Object.keys(r).some(k => !keys.includes(k))) throw new Error("unknown or missing curated field");
  return r;
}
function text(v: unknown, max = 2000): string { if (typeof v !== "string" || !v.trim() || v.length > max) throw new Error("invalid curated text"); return v; }
function id(v: unknown): string { const s = text(v, 100); if (!/^[a-zA-Z0-9_-]+$/u.test(s)) throw new Error("invalid curated identifier"); return s; }
function list(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max) throw new Error("invalid curated list"); return v; }
function instant(v: unknown): string { const s = text(v, 50); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/u.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s.slice(0, 10)) throw new Error("invalid acquisition timestamp"); return s; }
/** Strict bounded JSON only; no authority admission or network acquisition occurs here. */
export function parseCuratedC3Context(raw: string, expectedAccountId: string): FrozenC3ViewContext {
  if (Buffer.byteLength(raw) > MAX) throw new Error("curated input too large");
  const root = obj(JSON.parse(raw), ["kind", "account", "entities", "sources", "statements", "gaps"]);
  if (root.kind !== "atliera.c3.curated-input.v1") throw new Error("unknown curated input kind");
  const a = obj(root.account, ["id", "name", "domains", "aliases", "sector", "geography", "contextAt"]);
  const accountId = id(a.id);
  if (accountId !== expectedAccountId) throw new Error("curated account mismatch");
  const entities: AccountEntityBoundary[] = list(root.entities, 10).map(value => {
    const e = obj(value, ["id", "name", "scope"]);
    return { entityId: id(e.id), name: text(e.name), kind: e.id === accountId ? "account" : "other_related_entity", relationshipToAccount: text(e.scope) };
  });
  const entityIds = new Set(entities.map(e => e.entityId));
  if (entityIds.size !== entities.length || !entityIds.has(accountId)) throw new Error("duplicate or missing account entity");
  const sourceIds = new Set<string>(); const evidence = new Map<string, { entityId: string; text: string }>();
  const sources: C3ViewSource[] = list(root.sources, 15).map(value => {
    const s = obj(value, ["id", "entityId", "url", "title", "publisher", "acquiredAt", "text", "sha256", "excerpts"]);
    const sourceId = id(s.id); const entity = entities.find(e => e.entityId === s.entityId);
    if (sourceIds.has(sourceId) || !entity) throw new Error("duplicate source or unknown source entity"); sourceIds.add(sourceId);
    const url = text(s.url); const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) throw new Error("unsafe source URL");
    const full = text(s.text, 200000);
    if (s.sha256 !== hash(full)) throw new Error("retained text hash mismatch");
    const excerpts = list(s.excerpts, 30).map(value => {
      const e = obj(value, ["id", "text"]); const evidenceId = id(e.id); const exactExcerpt = text(e.text, 10000);
      const sourceCharStart = full.indexOf(exactExcerpt);
      if (sourceCharStart < 0 || evidence.has(evidenceId)) throw new Error("excerpt mismatch or duplicate reference");
      evidence.set(evidenceId, { entityId: entity.entityId, text: exactExcerpt });
      return { evidenceId, sourceId, exactExcerpt, exactExcerptSha256: hash(exactExcerpt), sourceCharStart, sourceCharEnd: sourceCharStart + exactExcerpt.length };
    });
    if (!excerpts.length) throw new Error("source excerpts required");
    return { sourceId, entity, canonicalUrl: url, title: text(s.title), publisher: text(s.publisher), retrievedAt: instant(s.acquiredAt),
      publicationDate: null, eventDate: null, evidenceCurrentThrough: null, retrievedContentSha256: hash(full), retrievedByteSize: Buffer.byteLength(full),
      fullBoundedCleanText: full, untrustedInstructionsDetected: null, excerpts };
  });
  if (!sources.length) throw new Error("curated sources required");
  const statements: IntelligenceStatement[] = list(root.statements, 30).map((value, i) => {
    const s = obj(value, ["kind", "text", "entityId", "evidenceIds"]);
    if (s.kind !== "quote" && s.kind !== "interpretation" && s.kind !== "recommendation") throw new Error("unknown statement kind");
    const entityId = id(s.entityId); const evidenceIds = list(s.evidenceIds, 20).map(id); const content = text(s.text, 10000);
    if (!entityIds.has(entityId) || new Set(evidenceIds).size !== evidenceIds.length || evidenceIds.some(e => evidence.get(e)?.entityId !== entityId)) throw new Error("unknown or mismatched entity/evidence reference");
    if (!evidenceIds.length || (s.kind === "quote" && !evidenceIds.some(e => evidence.get(e)?.text === content))) throw new Error("statement requires exact source support");
    return { statementId: `curated_${i}`, state: s.kind === "quote" ? "source-backed fact" : s.kind === "interpretation" ? "evidence-informed interpretation" : "recommendation", text: content, entityIds: [entityId], evidenceIds, riskFlags: [] };
  });
  const thesis = statements.find(s => s.state === "evidence-informed interpretation");
  const next = statements.find(s => s.state === "recommendation");
  if (!thesis || !next) throw new Error("curated interpretation and recommendation required");
  const gaps = list(root.gaps, 20).map(v => text(v));
  const context: C3ViewContext = {
    kind: C3_ACCOUNT_CONTEXT_KIND, schemaVersion: C3_ACCOUNT_CONTEXT_VERSION,
    account: { accountId, accountName: text(a.name), canonicalPublicDomains: list(a.domains, 10).map(v => text(v)), knownAliases: list(a.aliases, 10).map(v => text(v)),
      admittedContext: { sector: text(a.sector), geography: text(a.geography), notes: ["Agent-curated proposed context, not admitted account truth."] }, requestedAt: instant(a.contextAt) },
    priorRevision: null, temporalBoundary: { priorRevisionAvailable: false, legacyMeaningfullyChangedIsTemporalProof: false,
      allowedOutcomes: ["initial_dated_event_discovery", "no_material_change_established", "insufficient_context"] },
    entities, relationships: entities.map(e => ({ entityId: e.entityId, relationshipToAccount: e.relationshipToAccount })), discoveryLineage: [], admittedSources: sources,
    proposal: { accountThesis: thesis, establishedContext: statements.filter(s => s.state === "source-backed fact"), meaningfullyChanged: [],
      whyChangeMayMatter: statements.filter(s => s.state === "evidence-informed interpretation"), stillOpenQuestions: [], recommendedNextMove: next },
    declaredContradictions: [], materialGaps: gaps,
    rendererAnnotations: sources.map(s => ({ kind: "source_context_caveat", sourceId: s.sourceId, evidenceIds: s.excerpts.map(e => e.evidenceId),
      text: `${s.entity.relationshipToAccount} Acquired ${s.retrievedAt}; not a publication date. Unreviewed extracted text; inspection/template context only, not model evidence.` })),
    ownerDecisionSource: null, ownerCorrections: [], relevanceCandidates: [],
    custody: { policyReceipt: null, boundedCleanTextMeaning: "full supplied bounded-clean-text projection; not original web/PDF completeness", localTestOnly: true, authorizesPersistence: false },
    provenance: { kind: "agent_curated_proposed_template", modelGenerated: false, humanApproved: false, owner: null, meetingDate: null },
  };
  const canonical = canonicalJson(context);
  return Object.freeze({ context: deepFreezeOwnData(context), canonicalJson: canonical, sha256: hash(canonical) });
}
export async function loadCuratedC3Context(path: string, accountId: string): Promise<FrozenC3ViewContext> {
  const info = await stat(path); if (!info.isFile() || info.size > MAX) throw new Error("curated input must be a bounded file");
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(path));
  return parseCuratedC3Context(raw, accountId);
}
