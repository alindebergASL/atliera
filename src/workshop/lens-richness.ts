// Lens-richness summaries over a built WorkshopViewModel.
//
// These mirror the sanitized metric shape already used by the validation
// fixtures (e.g. fixtures/validation/*-lens-diagnostic-input.json, which
// carry `graph_supported_lens_item_counts` and `useful_lens_item_counts`).
// Emitting the same shape from the render side lets us assert that a
// rendered fixture reproduces an observed validated richness distribution,
// instead of substituting the synthetic three-lane fixture as a stand-in.
//
// Pure functions, no I/O.

import type { WorkshopLens, WorkshopViewModel } from "./view-model.ts";

export interface WorkshopLensRichness {
  signals: number;
  maps: number;
  plays: number;
}

const LENSES: readonly WorkshopLens[] = ["signals", "maps", "plays"];

// Item count per lens — parity with `graph_supported_lens_item_counts`.
export function summarizeLensRichness(
  vm: WorkshopViewModel,
): WorkshopLensRichness {
  const out: WorkshopLensRichness = { signals: 0, maps: 0, plays: 0 };
  for (const lens of LENSES) {
    out[lens] = vm.lenses[lens].length;
  }
  return out;
}

// Per-lens count of items that are both verified and carry at least one
// accepted evidence packet — parity with `useful_lens_item_counts`. This
// is the "would a human treat this lane as materially useful" signal.
export function summarizeUsefulLensRichness(
  vm: WorkshopViewModel,
): WorkshopLensRichness {
  const out: WorkshopLensRichness = { signals: 0, maps: 0, plays: 0 };
  for (const lens of LENSES) {
    out[lens] = vm.lenses[lens].filter(
      (item) =>
        item.trust.provenance_status === "verified" &&
        item.evidence_packets.length > 0,
    ).length;
  }
  return out;
}

// Convenience: how many of the three lenses are populated at all.
export function populatedLensCount(vm: WorkshopViewModel): number {
  const r = summarizeLensRichness(vm);
  return LENSES.filter((lens) => r[lens] > 0).length;
}
