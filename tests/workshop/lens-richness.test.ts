import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  populatedLensCount,
  summarizeLensRichness,
  summarizeUsefulLensRichness,
} from "../../src/workshop/lens-richness.ts";
import type {
  WorkshopLensItemViewModel,
  WorkshopViewModel,
} from "../../src/workshop/view-model.ts";

function item(
  overrides: Partial<WorkshopLensItemViewModel> & {
    lens: WorkshopLensItemViewModel["lens"];
  },
): WorkshopLensItemViewModel {
  return {
    id: overrides.id ?? "obj_x",
    lens: overrides.lens,
    title: overrides.title ?? "title",
    summary: overrides.summary ?? "summary",
    object_type: overrides.object_type ?? "signal",
    status: overrides.status ?? "active",
    trust: overrides.trust ?? {
      provenance_status: "verified",
      confidence: "high",
      evidence: {
        accepted_excerpt_count: 1,
        source_document_count: 1,
        claim_count: 1,
      },
      label: "Verified",
    },
    claim_ids: overrides.claim_ids ?? [],
    source_ids: overrides.source_ids ?? [],
    excerpt_ids: overrides.excerpt_ids ?? [],
    evidence_packets: overrides.evidence_packets ?? [],
  };
}

function vm(
  lenses: Partial<WorkshopViewModel["lenses"]>,
): WorkshopViewModel {
  return {
    product_name: "Atliera",
    surface: "Workshop",
    account_id: "acc_test",
    generated_from: "graph_bundle",
    lenses: {
      signals: lenses.signals ?? [],
      maps: lenses.maps ?? [],
      plays: lenses.plays ?? [],
    },
    totals: {
      sources: 0,
      excerpts: 0,
      accepted_excerpts: 0,
      claims: 0,
      account_objects: 0,
      verified_objects: 0,
    },
    empty_state: false,
  };
}

// A minimal non-empty evidence packet for "useful" cases.
const PACKET = {
  claim: {
    id: "clm_x",
    text: "t",
    claim_type: "c",
    confidence: "high" as const,
    provenance_status: "verified" as const,
  },
  excerpt: {
    id: "exc_x",
    text: "t",
    validation_status: "accepted" as const,
    kind: "literal" as const,
  },
  source: {
    id: "src_x",
    title: "s",
    url: "https://example.invalid/x",
    publisher: null,
    source_type: "company_page",
    reliability: "high" as const,
  },
};

describe("lens-richness summaries", () => {
  test("empty view model yields all-zero richness", () => {
    const v = vm({});
    assert.deepEqual(summarizeLensRichness(v), {
      signals: 0,
      maps: 0,
      plays: 0,
    });
    assert.deepEqual(summarizeUsefulLensRichness(v), {
      signals: 0,
      maps: 0,
      plays: 0,
    });
    assert.equal(populatedLensCount(v), 0);
  });

  test("summarizeLensRichness counts every item regardless of trust", () => {
    const v = vm({
      signals: [
        item({ lens: "signals" }),
        item({
          lens: "signals",
          trust: {
            provenance_status: "unverified",
            confidence: "low",
            evidence: {
              accepted_excerpt_count: 0,
              source_document_count: 0,
              claim_count: 0,
            },
            label: "Unverified",
          },
        }),
      ],
      maps: [item({ lens: "maps" })],
    });
    assert.deepEqual(summarizeLensRichness(v), {
      signals: 2,
      maps: 1,
      plays: 0,
    });
    assert.equal(populatedLensCount(v), 2);
  });

  test("summarizeUsefulLensRichness counts only verified items with evidence packets", () => {
    const v = vm({
      signals: [
        // verified + packet → useful
        item({ lens: "signals", evidence_packets: [PACKET] }),
        // verified but no packets → not useful
        item({ lens: "signals", id: "obj_y", evidence_packets: [] }),
        // packets present but not verified → not useful
        item({
          lens: "signals",
          id: "obj_z",
          evidence_packets: [PACKET],
          trust: {
            provenance_status: "source_document_only",
            confidence: "medium",
            evidence: {
              accepted_excerpt_count: 1,
              source_document_count: 1,
              claim_count: 1,
            },
            label: "Source-backed",
          },
        }),
      ],
    });
    assert.deepEqual(summarizeUsefulLensRichness(v), {
      signals: 1,
      maps: 0,
      plays: 0,
    });
  });
});
