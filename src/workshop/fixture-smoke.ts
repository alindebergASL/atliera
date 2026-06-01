// Deterministic Workshop fixture smoke report.
//
// Walks a fixed set of renderable GraphBundle fixtures, builds each one's
// WorkshopViewModel, and summarises lens richness, useful-lens richness,
// trust-state counts, and empty lanes into a single operator-reviewable
// JSON. The output is deterministic: no timestamps, no fs scans, no
// random IDs. It must round-trip exactly against the committed report
// file at `fixtures/graph/render/fixture-smoke-report.json` so any drift
// between a render fixture and the committed report fails the sync test.
//
// This is a smoke artifact, not a launch-readiness signal. The
// `readiness` field is hard-coded to `false`.

import { loadGraphBundleFile } from "../graph/file-store.ts";
import type { ProvenanceStatus } from "../graph/types.ts";
import { buildWorkshopViewModel } from "./view-model.ts";
import {
  summarizeLensRichness,
  summarizeUsefulLensRichness,
  type WorkshopLensRichness,
} from "./lens-richness.ts";
import type { WorkshopLens } from "./view-model.ts";

export const WORKSHOP_FIXTURE_SMOKE_REPORT_SCHEMA_VERSION =
  "atliera.workshop_fixture_smoke.v1" as const;

// The set of render fixtures the smoke report covers. Ordered explicitly so
// the committed report is stable under filesystem listing order changes.
export const WORKSHOP_FIXTURE_SMOKE_INPUTS: readonly string[] = [
  "fixtures/graph/render/one-lane-weak.json",
  "fixtures/graph/render/mixed-trust.json",
  "fixtures/graph/valid/workshop-three-lane.json",
];

const ALL_PROVENANCE_STATUSES: readonly ProvenanceStatus[] = [
  "verified",
  "source_document_only",
  "unverified",
  "unsupported",
  "stale",
];

const ALL_LENSES: readonly WorkshopLens[] = ["signals", "maps", "plays"];

export interface WorkshopFixtureSmokeTotals {
  sources: number;
  excerpts: number;
  accepted_excerpts: number;
  claims: number;
  account_objects: number;
  verified_objects: number;
}

export type WorkshopTrustStateCounts = Record<ProvenanceStatus, number>;

export interface WorkshopFixtureSmokeEntry {
  path: string;
  account_id: string | null;
  totals: WorkshopFixtureSmokeTotals;
  lens_richness: WorkshopLensRichness;
  useful_lens_richness: WorkshopLensRichness;
  useful_lenses: WorkshopLens[];
  empty_lanes: WorkshopLens[];
  trust_state_counts: WorkshopTrustStateCounts;
}

export interface WorkshopFixtureSmokeReport {
  schema_version: typeof WORKSHOP_FIXTURE_SMOKE_REPORT_SCHEMA_VERSION;
  generated_from: "graph_bundle_fixture";
  readiness: false;
  provider_calls_made: 0;
  production_writes: false;
  fixtures: WorkshopFixtureSmokeEntry[];
}

function zeroTrustCounts(): WorkshopTrustStateCounts {
  const out = {} as WorkshopTrustStateCounts;
  for (const s of ALL_PROVENANCE_STATUSES) out[s] = 0;
  return out;
}

function emptyLanes(richness: WorkshopLensRichness): WorkshopLens[] {
  return ALL_LENSES.filter((lens) => richness[lens] === 0);
}

function usefulLenses(useful: WorkshopLensRichness): WorkshopLens[] {
  return ALL_LENSES.filter((lens) => useful[lens] > 0);
}

export async function buildWorkshopFixtureSmokeReport(
  fixturePaths: readonly string[] = WORKSHOP_FIXTURE_SMOKE_INPUTS,
): Promise<WorkshopFixtureSmokeReport> {
  const fixtures: WorkshopFixtureSmokeEntry[] = [];
  for (const path of fixturePaths) {
    const bundle = await loadGraphBundleFile(path);
    const vm = buildWorkshopViewModel(bundle);
    const lensRichness = summarizeLensRichness(vm);
    const usefulRichness = summarizeUsefulLensRichness(vm);

    const trust = zeroTrustCounts();
    for (const lens of ALL_LENSES) {
      for (const item of vm.lenses[lens]) {
        trust[item.trust.provenance_status] += 1;
      }
    }

    fixtures.push({
      path,
      account_id: vm.account_id,
      totals: {
        sources: vm.totals.sources,
        excerpts: vm.totals.excerpts,
        accepted_excerpts: vm.totals.accepted_excerpts,
        claims: vm.totals.claims,
        account_objects: vm.totals.account_objects,
        verified_objects: vm.totals.verified_objects,
      },
      lens_richness: lensRichness,
      useful_lens_richness: usefulRichness,
      useful_lenses: usefulLenses(usefulRichness),
      empty_lanes: emptyLanes(lensRichness),
      trust_state_counts: trust,
    });
  }

  return {
    schema_version: WORKSHOP_FIXTURE_SMOKE_REPORT_SCHEMA_VERSION,
    generated_from: "graph_bundle_fixture",
    readiness: false,
    provider_calls_made: 0,
    production_writes: false,
    fixtures,
  };
}
