import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { loadGraphBundleFile } from "../../src/graph/file-store.ts";
import { buildWorkshopViewModel } from "../../src/workshop/view-model.ts";
import { renderWorkshopHtml } from "../../src/workshop/render-html.ts";
import { validateGraphBundle } from "../../src/graph/validate.ts";
import {
  summarizeLensRichness,
  summarizeUsefulLensRichness,
} from "../../src/workshop/lens-richness.ts";
import type {
  WorkshopLensItemViewModel,
  WorkshopViewModel,
} from "../../src/workshop/view-model.ts";

const ONE_LANE_WEAK = "fixtures/graph/render/one-lane-weak.json";
const MIXED_TRUST = "fixtures/graph/render/mixed-trust.json";
const THREE_LANE = "fixtures/graph/valid/workshop-three-lane.json";

const RENDER_FIXTURES = [ONE_LANE_WEAK, MIXED_TRUST, THREE_LANE];

function allItems(vm: WorkshopViewModel): WorkshopLensItemViewModel[] {
  return [...vm.lenses.signals, ...vm.lenses.maps, ...vm.lenses.plays];
}

function findByObjectType(
  vm: WorkshopViewModel,
  objectType: string,
): WorkshopLensItemViewModel | undefined {
  return allItems(vm).find((item) => item.object_type === objectType);
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("Workshop render — validated richness fixtures", () => {
  test("one-lane-weak reproduces the observed 1-lens (Signals only) weak account", async () => {
    const bundle = await loadGraphBundleFile(ONE_LANE_WEAK);
    const vm = buildWorkshopViewModel(bundle);

    // Parity with the validated metric shape (e.g. live-product-preview-20260528a:
    // graph_supported_lens_item_counts = {signals:1, maps:0, plays:0}).
    assert.deepEqual(summarizeLensRichness(vm), {
      signals: 1,
      maps: 0,
      plays: 0,
    });
    assert.deepEqual(summarizeUsefulLensRichness(vm), {
      signals: 1,
      maps: 0,
      plays: 0,
    });

    const html = renderWorkshopHtml(vm);
    assert.match(html, /Q1 2026 dispatch portal outage/);
    // Maps and Plays lanes render explicit empty states, not fabricated content.
    assert.match(html, /No graph-backed Maps yet/);
    assert.match(html, /No graph-backed Plays yet/);
  });

  test("three-lane fixture is genuinely 3-lens rich", async () => {
    const bundle = await loadGraphBundleFile(THREE_LANE);
    const vm = buildWorkshopViewModel(bundle);

    assert.deepEqual(summarizeLensRichness(vm), {
      signals: 1,
      maps: 1,
      plays: 1,
    });
    assert.deepEqual(summarizeUsefulLensRichness(vm), {
      signals: 1,
      maps: 1,
      plays: 1,
    });

    const html = renderWorkshopHtml(vm);
    assert.doesNotMatch(html, /No graph-backed Signals yet/);
    assert.doesNotMatch(html, /No graph-backed Maps yet/);
    assert.doesNotMatch(html, /No graph-backed Plays yet/);
  });

  test("mixed-trust locks the object_type → lens mapping (incl. risk/open_question → Signals)", async () => {
    const bundle = await loadGraphBundleFile(MIXED_TRUST);
    const vm = buildWorkshopViewModel(bundle);

    // Item counts per lane.
    assert.deepEqual(summarizeLensRichness(vm), {
      signals: 3,
      maps: 2,
      plays: 2,
    });

    // The mapping is the code's, not the architecture prose's: risk and
    // open_question route to Signals, not Maps. This test pins that.
    assert.equal(findByObjectType(vm, "signal")?.lens, "signals");
    assert.equal(findByObjectType(vm, "risk")?.lens, "signals");
    assert.equal(findByObjectType(vm, "open_question")?.lens, "signals");
    assert.equal(findByObjectType(vm, "stakeholder")?.lens, "maps");
    assert.equal(findByObjectType(vm, "account_snapshot")?.lens, "maps");
    assert.equal(findByObjectType(vm, "play")?.lens, "plays");
    assert.equal(findByObjectType(vm, "recommendation")?.lens, "plays");
  });

  test("mixed-trust renders each trust label and never dresses non-verified as verified", async () => {
    const bundle = await loadGraphBundleFile(MIXED_TRUST);
    const vm = buildWorkshopViewModel(bundle);
    const html = renderWorkshopHtml(vm);

    // Every distinct trust pill class appears.
    assert.match(html, /trust-pill trust-verified/);
    assert.match(html, /trust-pill trust-unverified/);
    assert.match(html, /trust-pill trust-source_document_only/);
    assert.match(html, /trust-pill trust-stale/);
    assert.match(html, /trust-pill trust-unsupported/);

    // The unsupported play renders zero evidence packets, structurally, and
    // carries the explicit do-not-trust message.
    const play = findByObjectType(vm, "play");
    assert.ok(play, "expected a play item");
    assert.equal(play!.trust.provenance_status, "unsupported");
    assert.equal(play!.evidence_packets.length, 0);
    assert.match(
      html,
      /No accepted supporting evidence packets for this unsupported object\. Do not treat it as verified\./,
    );

    // Doctrine invariant at the HTML level: exactly as many verified pills as
    // verified objects — no leakage onto non-verified cards.
    const verifiedObjects = bundle.account_objects.filter(
      (o) => o.provenance_status === "verified",
    ).length;
    assert.equal(verifiedObjects, 1);
    assert.equal(countOccurrences(html, "trust-pill trust-verified"), 1);
  });

  test("soft-trust object with accepted evidence still renders non-verified and is excluded from useful richness", async () => {
    const bundle = await loadGraphBundleFile(MIXED_TRUST);
    const vm = buildWorkshopViewModel(bundle);

    // The stakeholder is source_document_only but DOES carry accepted
    // evidence packets — soft trust with evidence, not zero-evidence.
    const stakeholder = findByObjectType(vm, "stakeholder");
    assert.ok(stakeholder, "expected a stakeholder item");
    assert.equal(stakeholder!.trust.provenance_status, "source_document_only");
    assert.ok(
      stakeholder!.evidence_packets.length > 0,
      "stakeholder should carry accepted evidence packets",
    );
    assert.notEqual(stakeholder!.trust.label, "Verified");

    // It must NOT count toward useful richness: useful requires verified.
    // Maps holds the stakeholder (with evidence) + account_snapshot, both
    // non-verified, so useful maps is zero despite the evidence.
    assert.equal(summarizeUsefulLensRichness(vm).maps, 0);
    assert.deepEqual(summarizeUsefulLensRichness(vm), {
      signals: 1,
      maps: 0,
      plays: 0,
    });

    // At the HTML level it renders under the soft-trust pill, not verified.
    const html = renderWorkshopHtml(vm);
    assert.match(html, /trust-pill trust-source_document_only/);
  });

  test("no render fixture marks a non-verified object as verified", async () => {
    for (const path of RENDER_FIXTURES) {
      const bundle = await loadGraphBundleFile(path);
      const vm = buildWorkshopViewModel(bundle);
      const html = renderWorkshopHtml(vm);

      // VM level: a non-verified item must not carry a Verified trust label.
      for (const item of allItems(vm)) {
        if (item.trust.provenance_status !== "verified") {
          assert.notEqual(
            item.trust.label,
            "Verified",
            `${path}: ${item.object_type} ${item.id} mislabeled Verified`,
          );
        }
      }

      // HTML level: verified pill count == verified object count.
      const verifiedObjects = bundle.account_objects.filter(
        (o) => o.provenance_status === "verified",
      ).length;
      assert.equal(
        countOccurrences(html, "trust-pill trust-verified"),
        verifiedObjects,
        `${path}: verified pill count diverged from verified object count`,
      );
    }
  });

  test("render fixtures are valid graphs even though excluded from the launch gate corpus", async () => {
    for (const path of [ONE_LANE_WEAK, MIXED_TRUST]) {
      const bundle = await loadGraphBundleFile(path);
      const report = validateGraphBundle(bundle, { mode: "fixture" });
      assert.equal(
        report.ok,
        true,
        `${path} should be a valid graph: ${JSON.stringify(report.hard_failures)}`,
      );
    }
  });
});
