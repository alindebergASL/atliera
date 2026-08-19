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
  assert.equal(sha256(golden), "d36322e8e6f4f9415dcf6de80b1f1391cf07b024ac2fbc31951aa20902c2c697");
  const planGolden = await readFile(join(ROOT, "fixtures/workshop/c1-calm-account-home-plan.html"));
  assert.equal(sha256(planGolden), "ee53e47ab74aa444be6850a6139abbffd446fcc129e645a9f713c01900ab80c1");

  const screenshots = [
    ["c1-account-home-desktop-1440.png", [1440, 1100], "5baa3e4a188a4496f680654a7ec2738c04d78d60303ad07e9ec80b2da50133ee"],
    ["c1-account-home-laptop-1280.png", [1280, 900], "c3c4855a83a9bfd8410720ccdd6aad37385e81b2627d76a1ef6a482292a52e2c"],
    ["c1-account-home-tablet-768.png", [768, 900], "d5faac145d59e9940d48632646001d709cb5dae3ba6d76440642615b2b5c682b"],
    ["c1-account-home-mobile-390.png", [390, 844], "14d174a92cd404b05d84a5413a99d94c8f6585393daed083057b8db078ec276b"],
    ["c1-account-home-plan-tablet-768.png", [768, 900], "fdcf54e1e25d4e715b26c461fd0c9a77d5ef19c61d0566ac6b6b6440a608121a"],
    ["c1-account-home-plan-mobile-390.png", [390, 844], "4666ad04fcc2220222b8f140a66be9a2c699303c1260779b51eb8e380511c233"],
  ] as const;
  for (const [name, dimensions, digest] of screenshots) {
    const bytes = await readFile(join(REVIEW_ROOT, name));
    assert.deepEqual(pngDimensions(bytes), dimensions);
    assert.equal(sha256(bytes), digest);
  }

  const proofBytes = await readFile(join(REVIEW_ROOT, "c1-responsive-evidence-browser-proof.json"));
  assert.equal(sha256(proofBytes), "065131e786fb1d3992ad7dc8bbc86449164d7f1906ca017ec9a419fefabef45b");
  const proof: any = JSON.parse(proofBytes.toString("utf8"));
  assert.equal(proof.authority, "EXPLICIT_OWNER_AUTHORIZATION_C1_RESPONSIVE_EVIDENCE_CORRECTION_01");
  assert.equal(proof.scenarios.length, 4);
  for (const scenario of proof.scenarios) {
    assert.equal(scenario.triggerVisible, true);
    assert.equal(scenario.triggerHeadingOverlap, false);
    assert.equal(scenario.primaryFullyVisible, true);
    assert.equal(scenario.noHorizontalOverflow, true);
    assert.equal(scenario.changeEvidence.dialogId, "evidence-change");
    assert.equal(scenario.changeEvidence.open, true);
    assert.ok(scenario.changeEvidence.exactExcerpt.length > 0);
    assert.ok(scenario.changeEvidence.supports.length > 0);
    assert.ok(scenario.changeEvidence.doesNotEstablish.length > 0);
    assert.equal(scenario.escape.closed, true);
    assert.equal(scenario.escape.focusReturnedToEvidenceTrigger, true);
    assert.equal(scenario.closeButton.closed, true);
    assert.equal(scenario.closeButton.focusReturnedToEvidenceTrigger, true);
    assert.equal(scenario.primaryAction.open, true);
    if (scenario.variant === "plan") {
      assert.equal(scenario.primaryTarget, "existing-meeting-plan");
      assert.equal(scenario.primaryAction.questionCount, 3);
    } else {
      assert.equal(scenario.primaryTarget, "evidence-change");
      assert.ok(scenario.primaryAction.exactExcerpt.length > 0);
    }
  }
  assert.equal(proof.reflowChecks.length, 4);
  for (const check of proof.reflowChecks) {
    assert.equal(check.triggerVisible, true);
    assert.equal(check.triggerHeadingOverlap, false);
    assert.equal(check.noHorizontalOverflow, true);
    assert.equal(
      check.primaryTarget,
      check.variant === "plan" ? "existing-meeting-plan" : "evidence-change",
    );
  }

  const review = await readFile(join(REVIEW_ROOT, "review.md"), "utf8");
  for (const required of [
    "trusted prepare-result capability",
    "Established → Open → Next",
    "View existing meeting plan",
    "EXPLICIT_OWNER_AUTHORIZATION_C1_RESPONSIVE_EVIDENCE_CORRECTION_01",
    "c1-responsive-evidence-browser-proof.json",
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
