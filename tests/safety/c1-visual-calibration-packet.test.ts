import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = join(
  process.cwd(),
  "docs/ux/visual-calibration/atliera-evidence-horizon-system-v3.1",
);
const EXPECTED_MANIFEST_SHA256 = "2c173165c2ce68d24e28b0a082e91bc999f5abe5f52632be3251fdfc745756a8";
const EXPECTED_SUMS_SHA256 = "ec1e761acce66285909f5c6759bd9e28c7d985f4600b8646f354168d319ebd33";
const EXPECTED_PREDECESSORS = Object.freeze({
  "lineage/v2-owner-references/01-editorial-intelligence.png": "b9e7203c7d0c2180d913a093b87e9a81159e87149fab0d43fa1a84ad75536add",
  "lineage/v2-owner-references/02-change-horizon.png": "385692c44039d840052e2b61808dcebe74d628aab0e070892c4576d0acd8dd31",
  "lineage/v2-owner-references/03-question-stage.png": "cf0ca80a4b38b07f0cb96959521e9e06839fd7ab357ae3968b0dbc241f2d98fc",
  "lineage/v2-owner-references/04-evidence-horizon-recommended.png": "8a64f0c0f4b784f34a5e4fcd63a7ef6fc03b18f7ce953d2ec55b9e771ffe169e",
});

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pngDimensions(value: Buffer): [number, number] {
  assert.equal(value.subarray(1, 4).toString("ascii"), "PNG");
  return [value.readUInt32BE(16), value.readUInt32BE(20)];
}

test("owner-approved C1 visual packet remains complete, exact, and ZIP-free", async () => {
  const manifestBytes = await readFile(join(ROOT, "packet-manifest.json"));
  const sumsBytes = await readFile(join(ROOT, "SHA256SUMS"));
  assert.equal(sha256(manifestBytes), EXPECTED_MANIFEST_SHA256);
  assert.equal(sha256(sumsBytes), EXPECTED_SUMS_SHA256);

  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(manifest.packet_id, "atliera-evidence-horizon-system-v3.1");
  assert.equal(manifest.version, "3.1.0");
  assert.equal(manifest.status, "owner_approved_calibration_amendment");
  assert.equal(manifest.approved_by, "Andrew Lindeberg");
  assert.deepEqual(manifest.repository_baseline, {
    commit: "3766e4502103e20ae00d8a38f36ba213b470354e",
    tree: "4e9ec3b3c83b2e81ae7c8528276b70c6cc7dbad6",
  });
  assert.equal(manifest.files.length, 21);

  const listed = new Map<string, string>();
  for (const line of sumsBytes.toString("utf8").trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
    assert.ok(match, line);
    listed.set(match[2]!, match[1]!);
  }
  assert.equal(listed.size, 22);

  for (const entry of manifest.files) {
    const bytes = await readFile(join(ROOT, entry.path));
    assert.equal(bytes.byteLength, entry.bytes, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
    assert.equal(listed.get(entry.path), entry.sha256, entry.path);
    if (entry.path.endsWith(".png")) {
      const expected = /^([0-9]+)x([0-9]+)$/u.exec(entry.dimensions);
      assert.ok(expected, entry.path);
      assert.deepEqual(pngDimensions(bytes), [Number(expected[1]), Number(expected[2])], entry.path);
    }
  }
  assert.equal(listed.get("packet-manifest.json"), EXPECTED_MANIFEST_SHA256);
  for (const [path, expected] of Object.entries(EXPECTED_PREDECESSORS)) {
    assert.equal(sha256(await readFile(join(ROOT, path))), expected, path);
  }

  const files = (await readdir(ROOT, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(ROOT.length + 1).replaceAll("\\", "/"))
    .sort();
  const expectedFiles = [...listed.keys(), "SHA256SUMS"].sort();
  assert.deepEqual(files, expectedFiles);
  assert.equal(files.some((path) => path.toLowerCase().endsWith(".zip")), false);
});
