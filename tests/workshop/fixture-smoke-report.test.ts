import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

import {
  buildWorkshopFixtureSmokeReport,
  WORKSHOP_FIXTURE_SMOKE_INPUTS,
  WORKSHOP_FIXTURE_SMOKE_REPORT_SCHEMA_VERSION,
  type WorkshopFixtureSmokeReport,
} from "../../src/workshop/fixture-smoke.ts";

const COMMITTED_REPORT_PATH = "fixtures/graph/render/fixture-smoke-report.json";

describe("Workshop fixture smoke report — sync with committed file", () => {
  test("regenerated report deep-equals the committed file", async () => {
    // Read the *committed* report from disk — never compare regenerated
    // output against itself. Any drift between a render fixture and the
    // committed report fails this test loudly.
    const onDisk = JSON.parse(
      await readFile(COMMITTED_REPORT_PATH, "utf8"),
    ) as WorkshopFixtureSmokeReport;
    const regenerated = await buildWorkshopFixtureSmokeReport();

    assert.deepEqual(
      regenerated,
      onDisk,
      "Workshop fixture smoke report drifted. Regenerate with:\n" +
        "  npx tsx -e \"import { buildWorkshopFixtureSmokeReport } from './src/workshop/fixture-smoke.ts'; " +
        "import { writeFile } from 'node:fs/promises'; " +
        "writeFile('fixtures/graph/render/fixture-smoke-report.json', JSON.stringify(await buildWorkshopFixtureSmokeReport(), null, 2) + '\\n')\"\n",
    );
  });

  test("committed report carries the expected provenance, no-spend, and no-readiness markers", async () => {
    const onDisk = JSON.parse(
      await readFile(COMMITTED_REPORT_PATH, "utf8"),
    ) as WorkshopFixtureSmokeReport;

    assert.equal(
      onDisk.schema_version,
      WORKSHOP_FIXTURE_SMOKE_REPORT_SCHEMA_VERSION,
    );
    assert.equal(onDisk.generated_from, "graph_bundle_fixture");
    assert.equal(onDisk.readiness, false);
    assert.equal(onDisk.provider_calls_made, 0);
    assert.equal(onDisk.production_writes, false);

    // The smoke report must cover exactly the declared input set, in order.
    assert.deepEqual(
      onDisk.fixtures.map((f) => f.path),
      [...WORKSHOP_FIXTURE_SMOKE_INPUTS],
    );

    // Every entry must agree with its lens-richness counts: useful_lenses
    // is the list of lenses with non-zero useful counts; empty_lanes is the
    // list of lenses with zero items overall.
    for (const entry of onDisk.fixtures) {
      const usefulLensesFromCounts = (
        ["signals", "maps", "plays"] as const
      ).filter((lens) => entry.useful_lens_richness[lens] > 0);
      assert.deepEqual(
        entry.useful_lenses,
        usefulLensesFromCounts,
        `${entry.path}: useful_lenses must match useful_lens_richness`,
      );

      const emptyFromCounts = (["signals", "maps", "plays"] as const).filter(
        (lens) => entry.lens_richness[lens] === 0,
      );
      assert.deepEqual(
        entry.empty_lanes,
        emptyFromCounts,
        `${entry.path}: empty_lanes must match zero counts in lens_richness`,
      );

      // Trust counts must sum to total account_objects.
      const trustSum = Object.values(entry.trust_state_counts).reduce(
        (a, b) => a + b,
        0,
      );
      assert.equal(
        trustSum,
        entry.totals.account_objects,
        `${entry.path}: trust_state_counts must sum to account_objects`,
      );
    }
  });
});
