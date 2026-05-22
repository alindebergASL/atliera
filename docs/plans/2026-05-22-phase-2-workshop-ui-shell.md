# Phase 2 Workshop UI Shell Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Establish the first Atliera Workshop UI shell that renders fixture GraphBundle data into Signals, Maps, and Plays lens views with visible provenance/trust language and no legacy/provider/runtime dependencies.

**Architecture:** Phase 2 should be a narrow browser-renderable shell, not a full app platform or deployment. Build a deterministic graph-to-Workshop view model in `src/workshop/`, render it through a static HTML renderer, and expose a local CLI that writes a smoke-testable fixture page from existing GraphBundle fixtures. All lens panels must be produced from shared graph selectors and provenance helpers so Signals/Maps/Plays cannot fork data paths or trust rules.

**Tech Stack:** TypeScript, Node test runner, existing GraphBundle types/fixtures, static HTML/CSS output. No React/Next/Vite, no DB, no provider/model calls, no network, no deployment in this phase.

---

## Scope

Implement Phase 2 as `Phase 2.1: deterministic Workshop shell renderer`.

In scope:
- Atliera-branded Workshop shell vocabulary.
- Shared graph-derived Workshop view model.
- Signals, Maps, and Plays lens panels generated from the same GraphBundle selectors.
- Evidence/provenance summary labels visible in the rendered HTML.
- Empty-state rendering for an empty GraphBundle.
- Fixture-account rendering from existing graph fixtures.
- Local static HTML CLI output under explicit `--out-root` using the existing path guard.
- Tests proving no legacy/report fallback and no provider/network/secret behavior.

Out of scope:
- No React/Next/Vite dependency yet.
- No DB, migrations, auth, routes, API server, PM2, nginx, or deployment.
- No real model/provider adapter behavior.
- No web fetching or source discovery.
- No user-editable review/approval flows yet.
- No separate lens-specific stores, validators, provenance rules, or data pipelines.
- No legacy report-shape/import/parity/dual rendering/data fill tooling. Avoid spelling the repo-forbidden legacy identifiers in this plan; the exact forbidden strings remain defined only in the existing safety test and whitelisted architecture docs.

## Design decisions

1. **Static renderer first.** A static HTML shell gives us browser-smokeable UI semantics without committing to the final app framework before the graph-to-Workshop contract is proven.
2. **One selector path.** `buildWorkshopViewModel(bundle)` is the only allowed source for lens panels. The renderer must not inspect raw graph records to create lens-specific shortcuts.
3. **Lens classification is graph-derived.** Signals/Maps/Plays are filtered views over `AccountObject.object_type`, not new data models.
4. **Trust is visible by default.** Every rendered item carries a provenance/status/confidence label and evidence count. Verified-looking UI without evidence metadata is a test failure.
5. **No runtime effects.** Renderer and CLI are local deterministic tools only. They do not read provider keys, import provider SDKs, call network APIs, touch a DB, or deploy.

## Proposed file map

Create:
- `src/workshop/view-model.ts`
- `src/workshop/render-html.ts`
- `src/cli/workshop-shell.ts`
- `tests/workshop/view-model.test.ts`
- `tests/workshop/render-html.test.ts`
- `tests/cli/workshop-shell-cli.test.ts`

Modify:
- `package.json`
- `README.md`
- `docs/architecture/atliera-product-architecture.md`

Do not modify:
- Graph validators except if a test exposes an existing mismatch.
- Provider/agent code.
- Deployment files.

## Data contract

Add these Phase 2-only view-model types in `src/workshop/view-model.ts`:

```ts
import type { AccountObject, Claim, EvidenceExcerpt, GraphBundle, ProvenanceStatus } from "../graph/types.ts";

export type WorkshopLens = "signals" | "maps" | "plays";

export interface WorkshopEvidenceSummary {
  accepted_excerpt_count: number;
  source_document_count: number;
  claim_count: number;
}

export interface WorkshopTrustSummary {
  provenance_status: ProvenanceStatus;
  confidence: AccountObject["confidence"];
  evidence: WorkshopEvidenceSummary;
  label: "Verified" | "Source-backed" | "Unverified" | "Unsupported" | "Stale";
}

export interface WorkshopLensItemViewModel {
  id: string;
  lens: WorkshopLens;
  title: string;
  summary: string;
  object_type: AccountObject["object_type"];
  status: AccountObject["status"];
  trust: WorkshopTrustSummary;
  claim_ids: string[];
  source_ids: string[];
  excerpt_ids: string[];
}

export interface WorkshopViewModel {
  product_name: "Atliera";
  surface: "Workshop";
  account_id: string | null;
  generated_from: "graph_bundle";
  lenses: Record<WorkshopLens, WorkshopLensItemViewModel[]>;
  totals: {
    sources: number;
    excerpts: number;
    accepted_excerpts: number;
    claims: number;
    account_objects: number;
    verified_objects: number;
  };
  empty_state: boolean;
}
```

Rules:
- `signals` includes object types: `signal`, `risk`, `open_question`.
- `maps` includes object types: `stakeholder`, `initiative`, `account_snapshot`.
- `plays` includes object types: `play`, `recommendation`.
- All lenses are derived from `bundle.account_objects` and `bundle.account_object_claims`.
- Evidence counts derive through `AccountObject -> AccountObjectClaim -> Claim -> ClaimEvidence -> EvidenceExcerpt -> SourceDocument`.
- `Verified` may render only for `provenance_status === "verified"`.
- `Source-backed` maps to `source_document_only`.
- `Unverified`, `Unsupported`, and `Stale` map directly from provenance status.

---

## Task 1: Add Workshop view-model tests first

**Objective:** Specify graph-to-Workshop behavior before implementation.

**Files:**
- Create: `tests/workshop/view-model.test.ts`
- Later create: `src/workshop/view-model.ts`

**Step 1: Write failing tests**

Create `tests/workshop/view-model.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { makeValidBundle, clone } from "../fixtures/valid-graph.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import type { GraphBundle } from "../../src/graph/types.ts";

function makeEmptyBundle(): GraphBundle {
  return {
    sources: [],
    excerpts: [],
    claims: [],
    claim_evidence: [],
    account_objects: [],
    account_object_claims: [],
    research_runs: [],
    run_artifacts: [],
    audit_events: [],
  };
}

describe("buildWorkshopViewModel", () => {
  test("renders the baseline fixture as a Signals item from the shared graph", () => {
    const vm = buildWorkshopViewModel(makeValidBundle());

    assert.equal(vm.product_name, "Atliera");
    assert.equal(vm.surface, "Workshop");
    assert.equal(vm.generated_from, "graph_bundle");
    assert.equal(vm.empty_state, false);
    assert.equal(vm.lenses.signals.length, 1);
    assert.equal(vm.lenses.maps.length, 0);
    assert.equal(vm.lenses.plays.length, 0);

    const item = vm.lenses.signals[0]!;
    assert.equal(item.id, "obj_acme_signal_launch");
    assert.equal(item.lens, "signals");
    assert.equal(item.trust.label, "Verified");
    assert.equal(item.trust.evidence.accepted_excerpt_count, 1);
    assert.deepEqual(item.claim_ids, ["clm_acme_launch"]);
    assert.deepEqual(item.excerpt_ids, ["exc_acme_launch_001"]);
    assert.deepEqual(item.source_ids, ["src_acme_press_001"]);
  });

  test("routes account-object kinds into Signals, Maps, and Plays without separate data paths", () => {
    const bundle = clone(makeValidBundle());
    const base = bundle.account_objects[0]!;

    bundle.account_objects.push(
      { ...base, id: "obj_acme_stakeholder", object_type: "stakeholder", title: "VP Operations" },
      { ...base, id: "obj_acme_play", object_type: "play", title: "Lead with integration proof" },
    );
    bundle.account_object_claims.push(
      { id: "oclm_map", account_object_id: "obj_acme_stakeholder", claim_id: "clm_acme_launch", relationship: "primary" },
      { id: "oclm_play", account_object_id: "obj_acme_play", claim_id: "clm_acme_launch", relationship: "primary" },
    );

    const vm = buildWorkshopViewModel(bundle);

    assert.deepEqual(vm.lenses.signals.map((item) => item.id), ["obj_acme_signal_launch"]);
    assert.deepEqual(vm.lenses.maps.map((item) => item.id), ["obj_acme_stakeholder"]);
    assert.deepEqual(vm.lenses.plays.map((item) => item.id), ["obj_acme_play"]);
    for (const lens of ["signals", "maps", "plays"] as const) {
      assert.equal(vm.lenses[lens][0]!.trust.evidence.accepted_excerpt_count, 1);
    }
  });

  test("renders an explicit empty state for an empty graph bundle", () => {
    const vm = buildWorkshopViewModel(makeEmptyBundle());

    assert.equal(vm.empty_state, true);
    assert.equal(vm.account_id, null);
    assert.deepEqual(vm.lenses, { signals: [], maps: [], plays: [] });
    assert.deepEqual(vm.totals, {
      sources: 0,
      excerpts: 0,
      accepted_excerpts: 0,
      claims: 0,
      account_objects: 0,
      verified_objects: 0,
    });
  });

  test("labels unsupported and source-document-only material visibly", () => {
    const bundle = clone(makeValidBundle());
    bundle.account_objects[0]!.provenance_status = "unsupported";
    let vm = buildWorkshopViewModel(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.label, "Unsupported");

    bundle.account_objects[0]!.provenance_status = "source_document_only";
    vm = buildWorkshopViewModel(bundle);
    assert.equal(vm.lenses.signals[0]!.trust.label, "Source-backed");
  });
});
```

**Step 2: Run test to verify failure**

Run:

```bash
node --import tsx --test tests/workshop/view-model.test.ts
```

Expected: FAIL because `src/workshop/view-model.ts` does not exist.

---

## Task 2: Implement the Workshop view model

**Objective:** Add the shared graph-derived selector layer for the Workshop shell.

**Files:**
- Create: `src/workshop/view-model.ts`

**Step 1: Write minimal implementation**

Create `src/workshop/view-model.ts` with:

```ts
import type { AccountObject, GraphBundle, ProvenanceStatus } from "../graph/types.ts";

export type WorkshopLens = "signals" | "maps" | "plays";

export interface WorkshopEvidenceSummary {
  accepted_excerpt_count: number;
  source_document_count: number;
  claim_count: number;
}

export interface WorkshopTrustSummary {
  provenance_status: ProvenanceStatus;
  confidence: AccountObject["confidence"];
  evidence: WorkshopEvidenceSummary;
  label: "Verified" | "Source-backed" | "Unverified" | "Unsupported" | "Stale";
}

export interface WorkshopLensItemViewModel {
  id: string;
  lens: WorkshopLens;
  title: string;
  summary: string;
  object_type: AccountObject["object_type"];
  status: AccountObject["status"];
  trust: WorkshopTrustSummary;
  claim_ids: string[];
  source_ids: string[];
  excerpt_ids: string[];
}

export interface WorkshopViewModel {
  product_name: "Atliera";
  surface: "Workshop";
  account_id: string | null;
  generated_from: "graph_bundle";
  lenses: Record<WorkshopLens, WorkshopLensItemViewModel[]>;
  totals: {
    sources: number;
    excerpts: number;
    accepted_excerpts: number;
    claims: number;
    account_objects: number;
    verified_objects: number;
  };
  empty_state: boolean;
}

const LENS_BY_OBJECT_TYPE: Record<AccountObject["object_type"], WorkshopLens> = {
  account_snapshot: "maps",
  signal: "signals",
  stakeholder: "maps",
  initiative: "maps",
  risk: "signals",
  open_question: "signals",
  play: "plays",
  recommendation: "plays",
};

function trustLabel(status: ProvenanceStatus): WorkshopTrustSummary["label"] {
  switch (status) {
    case "verified":
      return "Verified";
    case "source_document_only":
      return "Source-backed";
    case "unverified":
      return "Unverified";
    case "unsupported":
      return "Unsupported";
    case "stale":
      return "Stale";
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function buildWorkshopViewModel(bundle: GraphBundle): WorkshopViewModel {
  const claimById = new Map(bundle.claims.map((claim) => [claim.id, claim]));
  const excerptById = new Map(bundle.excerpts.map((excerpt) => [excerpt.id, excerpt]));
  const sourceById = new Map(bundle.sources.map((source) => [source.id, source]));
  const claimEvidenceByClaim = new Map<string, typeof bundle.claim_evidence>();
  for (const ce of bundle.claim_evidence) {
    const existing = claimEvidenceByClaim.get(ce.claim_id) ?? [];
    existing.push(ce);
    claimEvidenceByClaim.set(ce.claim_id, existing);
  }
  const objectClaimsByObject = new Map<string, typeof bundle.account_object_claims>();
  for (const oc of bundle.account_object_claims) {
    const existing = objectClaimsByObject.get(oc.account_object_id) ?? [];
    existing.push(oc);
    objectClaimsByObject.set(oc.account_object_id, existing);
  }

  const lenses: WorkshopViewModel["lenses"] = {
    signals: [],
    maps: [],
    plays: [],
  };

  for (const obj of bundle.account_objects) {
    const objectClaims = objectClaimsByObject.get(obj.id) ?? [];
    const claimIds = uniqueSorted(objectClaims.map((oc) => oc.claim_id).filter((id) => claimById.has(id)));
    const excerptIds = uniqueSorted(
      claimIds.flatMap((claimId) =>
        (claimEvidenceByClaim.get(claimId) ?? [])
          .map((ce) => ce.evidence_excerpt_id)
          .filter((excerptId) => excerptById.has(excerptId)),
      ),
    );
    const sourceIds = uniqueSorted(
      excerptIds
        .map((excerptId) => excerptById.get(excerptId)!)
        .map((excerpt) => excerpt.source_document_id)
        .filter((sourceId) => sourceById.has(sourceId)),
    );
    const acceptedExcerptCount = excerptIds.filter(
      (excerptId) => excerptById.get(excerptId)?.validation_status === "accepted",
    ).length;
    const lens = LENS_BY_OBJECT_TYPE[obj.object_type];

    lenses[lens].push({
      id: obj.id,
      lens,
      title: obj.title,
      summary: obj.summary,
      object_type: obj.object_type,
      status: obj.status,
      trust: {
        provenance_status: obj.provenance_status,
        confidence: obj.confidence,
        evidence: {
          accepted_excerpt_count: acceptedExcerptCount,
          source_document_count: sourceIds.length,
          claim_count: claimIds.length,
        },
        label: trustLabel(obj.provenance_status),
      },
      claim_ids: claimIds,
      source_ids: sourceIds,
      excerpt_ids: excerptIds,
    });
  }

  return {
    product_name: "Atliera",
    surface: "Workshop",
    account_id: bundle.sources[0]?.account_id ?? bundle.claims[0]?.account_id ?? bundle.account_objects[0]?.account_id ?? null,
    generated_from: "graph_bundle",
    lenses,
    totals: {
      sources: bundle.sources.length,
      excerpts: bundle.excerpts.length,
      accepted_excerpts: bundle.excerpts.filter((excerpt) => excerpt.validation_status === "accepted").length,
      claims: bundle.claims.length,
      account_objects: bundle.account_objects.length,
      verified_objects: bundle.account_objects.filter((obj) => obj.provenance_status === "verified").length,
    },
    empty_state: bundle.account_objects.length === 0,
  };
}
```

**Step 2: Run tests**

Run:

```bash
node --import tsx --test tests/workshop/view-model.test.ts
npm run typecheck
```

Expected: PASS.

---

## Task 3: Add static HTML renderer tests first

**Objective:** Specify the visible Workshop shell and trust labels before writing renderer code.

**Files:**
- Create: `tests/workshop/render-html.test.ts`
- Later create: `src/workshop/render-html.ts`

**Step 1: Write failing tests**

Create `tests/workshop/render-html.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { makeValidBundle } from "../fixtures/valid-graph.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";

describe("renderWorkshopHtml", () => {
  test("renders Atliera Workshop with Signals, Maps, Plays, and provenance language", () => {
    const html = renderWorkshopHtml(buildWorkshopViewModel(makeValidBundle()));

    assert.match(html, /<title>Atliera Workshop<\/title>/);
    assert.match(html, /Atliera Workshop/);
    assert.match(html, /Signals/);
    assert.match(html, /Maps/);
    assert.match(html, /Plays/);
    assert.match(html, /New logistics platform launch/);
    assert.match(html, /Verified/);
    assert.match(html, /1 accepted excerpt/);
    assert.match(html, /Evidence/);
  });

  test("renders an empty graph state without pretending intelligence exists", () => {
    const html = renderWorkshopHtml({
      product_name: "Atliera",
      surface: "Workshop",
      account_id: null,
      generated_from: "graph_bundle",
      lenses: { signals: [], maps: [], plays: [] },
      totals: { sources: 0, excerpts: 0, accepted_excerpts: 0, claims: 0, account_objects: 0, verified_objects: 0 },
      empty_state: true,
    });

    assert.match(html, /No graph-backed intelligence yet/);
    assert.match(html, /Add sources and validated graph records before treating account intelligence as verified/);
    assert.doesNotMatch(html, /legacy/i);
    assert.doesNotMatch(html, /legacy report shape/i);
  });

  test("escapes graph text before rendering HTML", () => {
    const bundle = makeValidBundle();
    bundle.account_objects[0]!.title = "<script>alert('x')</script>";
    const html = renderWorkshopHtml(buildWorkshopViewModel(bundle));

    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /&lt;script&gt;alert/);
  });
});
```

**Step 2: Run test to verify failure**

Run:

```bash
node --import tsx --test tests/workshop/render-html.test.ts
```

Expected: FAIL because `src/workshop/render-html.ts` does not exist.

---

## Task 4: Implement the static HTML renderer

**Objective:** Produce a browser-smokeable HTML Workshop shell from the view model.

**Files:**
- Create: `src/workshop/render-html.ts`

**Step 1: Implement renderer**

Create `src/workshop/render-html.ts` with:

```ts
import type { WorkshopLens, WorkshopLensItemViewModel, WorkshopViewModel } from "./view-model.ts";

const LENS_TITLES: Record<WorkshopLens, string> = {
  signals: "Signals",
  maps: "Maps",
  plays: "Plays",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function renderLensItem(item: WorkshopLensItemViewModel): string {
  const evidence = item.trust.evidence;
  return `<article class="workshop-card" data-lens="${item.lens}" data-object-id="${escapeHtml(item.id)}">
    <div class="card-kicker">${escapeHtml(item.object_type)} · ${escapeHtml(item.status)}</div>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary)}</p>
    <div class="trust-row">
      <span class="trust-pill trust-${escapeHtml(item.trust.provenance_status)}">${escapeHtml(item.trust.label)}</span>
      <span>${escapeHtml(item.trust.confidence)} confidence</span>
      <span>${plural(evidence.accepted_excerpt_count, "accepted excerpt")}</span>
      <span>${plural(evidence.source_document_count, "source document")}</span>
    </div>
    <details class="evidence-drawer">
      <summary>Evidence</summary>
      <dl>
        <dt>Claims</dt><dd>${escapeHtml(item.claim_ids.join(", ") || "none")}</dd>
        <dt>Excerpts</dt><dd>${escapeHtml(item.excerpt_ids.join(", ") || "none")}</dd>
        <dt>Sources</dt><dd>${escapeHtml(item.source_ids.join(", ") || "none")}</dd>
      </dl>
    </details>
  </article>`;
}

function renderLens(lens: WorkshopLens, items: WorkshopLensItemViewModel[]): string {
  const body = items.length
    ? items.map(renderLensItem).join("\n")
    : `<p class="empty-lens">No graph-backed ${LENS_TITLES[lens]} yet.</p>`;
  return `<section class="lens-panel" data-lens="${lens}">
    <header><h2>${LENS_TITLES[lens]}</h2><span>${plural(items.length, "item")}</span></header>
    ${body}
  </section>`;
}

export function renderWorkshopHtml(vm: WorkshopViewModel): string {
  const emptyState = vm.empty_state
    ? `<section class="empty-state"><h2>No graph-backed intelligence yet</h2><p>Add sources and validated graph records before treating account intelligence as verified.</p></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atliera Workshop</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #090b12; color: #edf2ff; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 40px 24px; }
    .hero { border: 1px solid #283044; border-radius: 24px; padding: 28px; background: linear-gradient(135deg, #121827, #0c1020); }
    .eyebrow { color: #99a7c7; text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; }
    h1 { margin: 8px 0; font-size: 42px; }
    .totals, .trust-row { display: flex; gap: 12px; flex-wrap: wrap; color: #aab6d3; }
    .lens-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 22px; }
    .lens-panel, .empty-state { border: 1px solid #283044; border-radius: 20px; padding: 18px; background: #0f1424; }
    .lens-panel header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #283044; margin-bottom: 14px; }
    .workshop-card { border: 1px solid #33405f; border-radius: 16px; padding: 14px; background: #121a2d; margin-bottom: 12px; }
    .card-kicker { color: #93a4c8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .trust-pill { border-radius: 999px; padding: 3px 9px; background: #26324e; color: #dbe7ff; }
    .trust-verified { background: #0f5132; color: #d1fae5; }
    .trust-unsupported { background: #5c1d1d; color: #fee2e2; }
    .evidence-drawer { margin-top: 10px; color: #cbd5e1; }
    dt { color: #93a4c8; }
    dd { margin: 0 0 8px; word-break: break-word; }
    @media (max-width: 900px) { .lens-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="eyebrow">${escapeHtml(vm.product_name)} · ${escapeHtml(vm.surface)}</div>
      <h1>Atliera Workshop</h1>
      <p>Evidence-backed account intelligence rendered from the Atliera Graph.</p>
      <div class="totals">
        <span>${plural(vm.totals.sources, "source")}</span>
        <span>${plural(vm.totals.claims, "claim")}</span>
        <span>${plural(vm.totals.account_objects, "graph object")}</span>
        <span>${plural(vm.totals.verified_objects, "verified object")}</span>
      </div>
    </section>
    ${emptyState}
    <section class="lens-grid" aria-label="Workshop lenses">
      ${renderLens("signals", vm.lenses.signals)}
      ${renderLens("maps", vm.lenses.maps)}
      ${renderLens("plays", vm.lenses.plays)}
    </section>
  </main>
</body>
</html>`;
}
```

**Step 2: Run tests**

Run:

```bash
node --import tsx --test tests/workshop/render-html.test.ts tests/workshop/view-model.test.ts
npm run typecheck
```

Expected: PASS.

---

## Task 5: Add Workshop shell CLI tests first

**Objective:** Specify local fixture HTML generation with guarded output.

**Files:**
- Create: `tests/cli/workshop-shell-cli.test.ts`
- Later create: `src/cli/workshop-shell.ts`
- Later modify: `package.json`

**Step 1: Write failing tests**

Create `tests/cli/workshop-shell-cli.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "atliera-workshop-cli-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/cli/workshop-shell.ts", ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("workshop-shell CLI", () => {
  test("writes a fixture Workshop shell HTML file under an explicit output root", async () => {
    await withTempDir(async (outputRoot) => {
      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
      ]);

      assert.equal(result.code, 0, result.stderr);
      const payload = JSON.parse(result.stdout) as { output_path: string };
      assert.equal(payload.output_path, join(outputRoot, "workshop", "acme.html"));
      const html = await readFile(payload.output_path, "utf8");
      assert.match(html, /Atliera Workshop/);
      assert.match(html, /Signals/);
      assert.match(html, /Verified/);
      assert.match(html, /Evidence/);
    });
  });

  test("requires explicit --out-root and --out-file", async () => {
    const result = await runCli(["write", "fixtures/graph/valid/minimal-pass.json"]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /usage:/i);
  });

  test("rejects duplicate flags and trailing positional arguments", async () => {
    await withTempDir(async (outputRoot) => {
      const duplicate = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
      ]);
      assert.equal(duplicate.code, 2);
      assert.match(duplicate.stderr, /duplicate/i);

      const trailing = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        "extra",
      ]);
      assert.equal(trailing.code, 2);
      assert.match(trailing.stderr, /usage:|unexpected/i);
    });
  });

  test("rejects missing flag values and non-html outputs", async () => {
    await withTempDir(async (outputRoot) => {
      const missing = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
      ]);
      assert.equal(missing.code, 2);
      assert.match(missing.stderr, /missing|usage:/i);

      const nonHtml = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.txt",
      ]);
      assert.notEqual(nonHtml.code, 0);
      assert.match(nonHtml.stderr, /html/i);
    });
  });

  test("refuses absolute output files and traversal outside explicit output root", async () => {
    await withTempDir(async (outputRoot) => {
      const absolute = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        join(outputRoot, "absolute.html"),
      ]);
      assert.notEqual(absolute.code, 0);
      assert.match(absolute.stderr, /relative|absolute|path/i);

      const result = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "../escape.html",
      ]);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /outside output root|invalid output path|path/i);
    });
  });

  test("refuses implicit overwrite", async () => {
    await withTempDir(async (outputRoot) => {
      await mkdir(join(outputRoot, "workshop"), { recursive: true });
      const first = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
      ]);
      assert.equal(first.code, 0, first.stderr);

      const second = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
      ]);
      assert.notEqual(second.code, 0);
      assert.match(second.stderr, /already exists|overwrite/i);

      const overwrite = await runCli([
        "write",
        "fixtures/graph/valid/minimal-pass.json",
        "--out-root",
        outputRoot,
        "--out-file",
        "workshop/acme.html",
        "--allow-overwrite",
      ]);
      assert.equal(overwrite.code, 0, overwrite.stderr);
    });
  });
});
```

**Step 2: Run test to verify failure**

Run:

```bash
node --import tsx --test tests/cli/workshop-shell-cli.test.ts
```

Expected: FAIL because `src/cli/workshop-shell.ts` does not exist.

---

## Task 6: Implement Workshop shell CLI through path guard

**Objective:** Add a guarded local CLI that writes static Workshop HTML from a graph fixture.

**Files:**
- Create: `src/cli/workshop-shell.ts`
- Modify: `package.json`

**Step 1: Add CLI implementation**

Create `src/cli/workshop-shell.ts` with this behavior:
- Command: `write <bundle.json> --out-root <dir> --out-file <relative.html> [--allow-overwrite]`
- Reject duplicate flags and trailing positionals.
- Load bundle with `loadGraphBundleFile`.
- Build view model with `buildWorkshopViewModel`.
- Render HTML with `renderWorkshopHtml`.
- Use `guardOutputPath` with explicit `outputRoot` and `allowOverwrite`.
- Treat `--out-file` as a relative path under `--out-root`: reject absolute `--out-file` values before path construction, then pass `resolve(outputRoot, outFile)` as `targetPath` to `guardOutputPath`.
- Reject traversal after normalization by relying on `guardOutputPath`; do not pass raw `outFile` directly as `targetPath` because that resolves relative to cwd.
- Refuse non-`.html` outputs.
- Write with `flag: "wx"` unless `--allow-overwrite` is present.
- Print JSON with `ok`, `output_path`, and `account_id`.

Implementation outline:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { argv, exit } from "node:process";

import { loadGraphBundleFile } from "../graph/file-store.ts";
import { guardOutputPath } from "../io/path-guard.ts";
import { buildWorkshopViewModel } from "../workshop/view-model.ts";
import { renderWorkshopHtml } from "../workshop/render-html.ts";

// Follow the parser style from src/cli/run-manifest.ts:
// - exact command check
// - allowed flags Set
// - duplicate flag rejection
// - missing value rejection
// - no trailing extras
// - usage exits 2
```

Do not call `assertProductionWriteAllowed`: this CLI writes a local smoke-test HTML artifact, not a production graph artifact. Safety is enforced by explicit output root, path guard, no overwrite by default, and no network/provider behavior.

**Step 2: Add package script**

Modify `package.json` scripts:

```json
"workshop:shell": "tsx src/cli/workshop-shell.ts write"
```

**Step 3: Run tests**

Run:

```bash
node --import tsx --test tests/cli/workshop-shell-cli.test.ts tests/workshop/view-model.test.ts tests/workshop/render-html.test.ts
npm run typecheck
```

Expected: PASS.

---

## Task 7: Documentation updates

**Objective:** Document how to generate and inspect the Phase 2 Workshop shell.

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/atliera-product-architecture.md`

**Step 1: Add README section**

Add after local run artifact manifest docs:

````md
## Workshop shell smoke HTML

Phase 2.1 adds a deterministic static Workshop shell renderer. It renders a GraphBundle into an Atliera Workshop HTML page with Signals, Maps, and Plays lens panels from the same graph-derived view model.

CLI smoke command:

```bash
mkdir -p /tmp/atliera-workshop
npm run workshop:shell -- fixtures/graph/valid/minimal-pass.json --out-root /tmp/atliera-workshop --out-file acme-workshop.html
```

The output is local static HTML only. It does not call providers, read API keys, use the network, touch a database, or deploy. The shell is intentionally fixture/graph-backed: unsupported or inferred material must be visibly labeled, and verified-looking items must carry evidence/provenance metadata.
````

**Step 2: Update architecture doc Phase 2 status**

In `docs/architecture/atliera-product-architecture.md`, update Phase 2 deliverables with a note that Phase 2.1 is static shell first:

```md
Implementation note:
- Phase 2.1 starts with a static, fixture-backed Workshop shell renderer before choosing a full app framework. This locks graph-to-lens/trust semantics without adding DB/auth/deploy/provider scope.
```

**Step 3: Run docs checks**

Run:

```bash
git diff --check
npm run typecheck
```

Expected: PASS.

---

## Task 8: Full verification and safety gates

**Objective:** Prove Phase 2.1 did not regress Phase 1 safety and has smoke-testable output.

**Files:**
- No new files unless tests require small fixes.

**Step 1: Run targeted Workshop tests**

```bash
node --import tsx --test tests/workshop/view-model.test.ts tests/workshop/render-html.test.ts tests/cli/workshop-shell-cli.test.ts
```

Expected:
- all new tests pass.

**Step 2: Run full local CI**

```bash
npm run ci
```

Expected:
- typecheck pass
- build pass
- full tests pass
- fixture gate pass

**Step 3: Generate smoke HTML**

```bash
rm -rf /tmp/atliera-workshop-smoke
mkdir -p /tmp/atliera-workshop-smoke
npm run workshop:shell -- fixtures/graph/valid/minimal-pass.json --out-root /tmp/atliera-workshop-smoke --out-file acme-workshop.html
```

Expected:
- command exits 0
- JSON output includes `/tmp/atliera-workshop-smoke/acme-workshop.html`
- HTML contains `Atliera Workshop`, `Signals`, `Maps`, `Plays`, `Verified`, and `Evidence`.

**Step 4: Run safety greps**

```bash
node --import tsx --test tests/safety/no-legacy-terms.test.ts
if grep -RInE "from ['\"](@anthropic-ai|openai|ai|langchain|@ai-sdk)" src; then exit 1; fi
if grep -RInE "ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY" src; then exit 1; fi
if grep -RInE "from ['\"](node:https|node:http|https|http)['\"]" src; then exit 1; fi
if grep -RIn "fetch(" src; then exit 1; fi
```

Expected:
- no matches.

**Step 5: Optional browser smoke**

If browser tools are available:
- Navigate to `file:///tmp/atliera-workshop-smoke/acme-workshop.html`.
- Verify visible headings: `Atliera Workshop`, `Signals`, `Maps`, `Plays`.
- Verify one visible card: `New logistics platform launch`.
- Verify visible trust/evidence text: `Verified`, `1 accepted excerpt`, `Evidence`.

---

## PR checklist

Open a PR titled:

```text
feat(workshop): add static graph-backed shell renderer
```

PR body must include:
- Summary of graph-derived Workshop view model.
- Statement that Signals/Maps/Plays share one selector path.
- Guardrails: no framework, no DB, no provider, no network, no deployment, no legacy report fallback.
- Verification command outputs.
- Smoke HTML path used locally.
- Safety grep results.

## Merge/readiness criteria

Do not merge if any of these are true:
- A lens panel reads from a separate data structure instead of the shared Workshop view model.
- HTML renders verified-looking content without provenance/evidence metadata.
- Any provider SDK/env/network behavior is introduced.
- Any legacy report-shape terminology or fallback path is introduced.
- CLI can write outside `--out-root` or overwrite implicitly.
- Tests are mostly happy-path and do not cover empty/unsupported/escaping/path-failure behavior.

Ready when:
- New targeted tests pass.
- `npm run ci` passes.
- Smoke HTML renders fixture data visibly.
- Safety greps are clean.
- Review confirms Phase 2.1 is a contained static shell, not a framework/deployment expansion.
