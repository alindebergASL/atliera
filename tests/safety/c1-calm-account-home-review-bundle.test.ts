import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const REVIEW_ROOT = join(ROOT, "docs/ux/c1-calm-account-home-review");

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pngDimensions(bytes: Uint8Array): readonly [number, number] {
  const buffer = Buffer.from(bytes);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)] as const;
}

test("C1 review bundle pins the exact golden, screenshots, scorecard, and zero-effect record", async () => {
  const golden = await readFile(join(ROOT, "fixtures/workshop/c1-calm-account-home.html"));
  assert.equal(sha256(golden), "f68cd15760875835f428767ba64dbd778e3eb4f0f9fe8d9bcdead88580ee6fe8");

  const screenshots = [
    ["c1-account-home-desktop-1440.png", [1440, 1100], "5baa3e4a188a4496f680654a7ec2738c04d78d60303ad07e9ec80b2da50133ee"],
    ["c1-account-home-laptop-1280.png", [1280, 900], "c3c4855a83a9bfd8410720ccdd6aad37385e81b2627d76a1ef6a482292a52e2c"],
    ["c1-account-home-tablet-768.png", [768, 900], "d1632cb151074e14c0687944cf3f84e30c1ed799514e17b7689717f56a28deb2"],
    ["c1-account-home-mobile-390.png", [390, 844], "35dbd8c1a29bf5a0fdcdea4d029b71c541d2fc7f6e62a9a7e3b3141b79653b87"],
  ] as const;
  for (const [name, dimensions, digest] of screenshots) {
    const bytes = await readFile(join(REVIEW_ROOT, name));
    assert.deepEqual(pngDimensions(bytes), dimensions);
    assert.equal(sha256(bytes), digest);
  }

  const review = await readFile(join(REVIEW_ROOT, "review.md"), "utf8");
  for (const required of [
    "trusted prepare-result capability",
    "Established → Open → Next",
    "View existing meeting plan",
    "No Package Inspector exposure",
    "200% equivalent",
    "400% reflow equivalent",
    "Weighted total",
    "92.1",
    "Editorial Intelligence",
    "Change Horizon",
    "Question Stage",
    "Evidence Horizon",
    "provider/model calls: 0",
    "network/source acquisition: 0",
    "customer/runtime routes: 0",
    "not customer acceptance",
  ]) assert.ok(review.includes(required), required);
  assert.doesNotMatch(review, /representative-user[^\n]*PASS|zero-training[^\n]*PASS|customer-readiness[^\n]*PASS/iu);
});
