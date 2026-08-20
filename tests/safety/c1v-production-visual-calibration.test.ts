import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { test } from "node:test";

const REPO = process.cwd();
const ROOT = join(REPO, "docs/ux/c1v-production-visual-calibration");
const ALLOWED_TEST = "tests/safety/c1v-production-visual-calibration.test.ts";
const DIRECTIONS = ["direction-a", "direction-b"] as const;

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(path));
    else out.push(relative(ROOT, path).replaceAll("\\", "/"));
  }
  return out.sort();
}

function pngDimensions(bytes: Uint8Array): readonly [number, number] {
  const buffer = Buffer.from(bytes);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)] as const;
}

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
}

const REQUIRED_PARITY = [
  "Citrine Works",
  "fictional fixture",
  "Citrine Works is a fictional operations-software company serving regional planning teams.",
  "Citrine Works introduced Relay Planner on July 14, 2026 for regional operations teams after an approved deployment review.",
  "Exception handling is a plausible discovery focus",
  "Draft a targeted exception-workflow meeting brief for internal review.",
  "Citrine Fixture Press",
  "Not reviewed",
  "Freshness not established",
  "Not saved",
  "Not approved",
  "Not shared",
  "The admitted exact excerpt supports the attributed product-introduction statement.",
  "It does not establish adoption, customer demand, buying intent, budget, or the account's current operating state.",
  "Where do planning exceptions create the most manual coordination today?",
  "What would need to remain stable during any workflow change?",
  "Which result would justify a focused second conversation?",
  "Close without another action unless the audience requests one specific comparison, scenario, or evidence check.",
] as const;

const SCREENSHOTS = [
  ["desktop-default-no-plan.png", [1440, 1100]],
  ["desktop-evidence-open.png", [1440, 1100]],
  ["desktop-admitted-plan.png", [1440, 1100]],
  ["desktop-existing-plan-open.png", [1440, 1100]],
  ["laptop-default.png", [1280, 900]],
  ["tablet-default.png", [768, 900]],
  ["tablet-evidence-open.png", [768, 900]],
  ["tablet-existing-plan-open.png", [768, 900]],
  ["mobile-default.png", [390, 844]],
  ["mobile-evidence-open.png", [390, 844]],
  ["mobile-admitted-plan.png", [390, 844]],
  ["mobile-existing-plan-open.png", [390, 844]],
  ["narrow-320-reflow.png", [320, 844]],
  ["zoom-200-equivalent.png", [640, 900]],
  ["keyboard-focus.png", [390, 844]],
  ["reduced-motion.png", [390, 844]],
  ["component-grammar.png", [1440, 1100]],
  ["future-workshop-compatibility.png", [1440, 900]],
] as const;

test("C1V artifacts are isolated, deterministic, interactive, and effect-free", async () => {
  const status = execFileSync("git", ["status", "--porcelain=v1", "-uall"], { cwd: REPO, encoding: "utf8" });
  for (const line of status.split("\n").filter(Boolean)) {
    const path = line.slice(3).split(" -> ").at(-1)!;
    assert.ok(path.startsWith("docs/ux/c1v-production-visual-calibration/") || path === ALLOWED_TEST, path);
  }

  const runtime = await readFile(join(ROOT, "shared/prototype-runtime.js"), "utf8");
  assert.doesNotMatch(runtime, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB)\b|document\.cookie|serviceWorker|innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/iu);
  assert.match(runtime, /textContent\s*=\s*hostileProbe/u);
  assert.match(runtime, /showModal\(\)/u);
  assert.match(runtime, /data-close-panel/u);
  assert.match(runtime, /setTimeout/u);

  const htmlByDirection = new Map<string, string>();
  for (const direction of DIRECTIONS) {
    const html = await readFile(join(ROOT, direction, "index.html"), "utf8");
    const cssName = direction === "direction-a" ? "editorial-intelligence.css" : "evidence-horizon.css";
    const css = await readFile(join(ROOT, direction, cssName), "utf8");
    htmlByDirection.set(direction, html);

    assert.match(html, /Content-Security-Policy/u);
    assert.match(html, /default-src 'none'/u);
    assert.match(html, /connect-src 'none'/u);
    assert.doesNotMatch(html, /<style\b|<script(?![^>]+src=)|style=|onclick=|onerror=|href="#"|<form\b|<input\b|<select\b|\bdisabled\b/iu);
    assert.doesNotMatch(html, /https?:\/\/|(?:src|href)="\/\//iu);
    assert.doesNotMatch(html, /Package Inspector|\bM5b\b|Prepare for…|Create brief|Generate briefing|Save briefing|Share briefing|Send briefing/iu);
    assert.doesNotMatch(css, /@import|url\s*\(|cursor:\s*pointer[^}]*pointer-events:\s*none/iu);
    assert.match(css, /min-height:\s*(?:44|50)px/u);
    assert.match(css, /:focus-visible/u);
    assert.match(css, /prefers-reduced-motion:\s*reduce/u);
    assert.match(css, /@media\s*\(max-width:/u);

    for (const phrase of REQUIRED_PARITY) assert.ok(visibleText(html).includes(phrase), `${direction}: ${phrase}`);

    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/giu)];
    assert.ok(buttons.length >= 9, direction);
    for (const [, attrs = ""] of buttons) {
      assert.match(attrs, /data-(?:open-panel|close-panel|state-control)/u);
      assert.doesNotMatch(attrs, /\bdisabled\b/u);
    }
    const targets = [...html.matchAll(/data-open-panel="([^"]+)"/gu)].map((match) => match[1]);
    for (const target of targets) assert.match(html, new RegExp(`id="${target}"`, "u"));
    assert.equal((html.match(/data-primary-action/gu) ?? []).length, 2);
    assert.match(html, /data-no-plan-only[^>]+data-open-panel="[ab]-evidence-change"/u);
    assert.match(html, /data-plan-only[^>]+data-open-panel="[ab]-existing-plan"/u);
    assert.equal((html.match(/class="plan-question"/gu) ?? []).length, 3);
    assert.equal((html.match(/class="evidence-panel"/gu) ?? []).length, 4);

    const future = await readFile(join(ROOT, direction, "future-workshop-compatibility.html"), "utf8");
    assert.match(future, /Static future Account and Workshop compatibility frame/u);
    assert.match(future, /Account \| Workshop/u);
    assert.doesNotMatch(future, /<button\b|<input\b|<form\b|<script\b/iu);

    for (const [name, dimensions] of SCREENSHOTS) {
      const bytes = await readFile(join(ROOT, "screenshots", direction, name));
      assert.deepEqual(pngDimensions(bytes), dimensions, `${direction}/${name}`);
    }
    const capture = await readFile(join(ROOT, "screenshots", direction, "interaction-capture.gif"));
    assert.equal(capture.subarray(0, 6).toString("ascii"), "GIF89a");
  }

  assert.notEqual(sha256(htmlByDirection.get("direction-a")!), sha256(htmlByDirection.get("direction-b")!));
  assert.match(htmlByDirection.get("direction-a")!, /insight-hero|question-rail/u);
  assert.doesNotMatch(htmlByDirection.get("direction-a")!, /horizon-stage|stage-grid/u);
  assert.match(htmlByDirection.get("direction-b")!, /horizon-stage|stage-grid/u);
  assert.doesNotMatch(htmlByDirection.get("direction-b")!, /insight-index|question-rail/u);

  const proof: any = JSON.parse(await readFile(join(ROOT, "browser-interaction-proof.json"), "utf8"));
  assert.equal(proof.directions.length, 2);
  for (const direction of proof.directions) {
    assert.equal(direction.scenarios.length, 6);
    for (const scenario of direction.scenarios) {
      assert.equal(scenario.noHorizontalOverflow, true);
      assert.equal(scenario.primaryVisible, true);
      assert.equal(scenario.minimumTouchTarget, true);
      assert.equal(scenario.trustVisible, true);
      assert.equal(scenario.statementEvidenceVisible, true);
    }
    assert.equal(direction.evidence.correctDialog, true);
    assert.equal(direction.evidence.exactExcerptReachable, true);
    assert.equal(direction.evidence.supportBoundaryReachable, true);
    assert.equal(direction.evidence.nonSupportBoundaryReachable, true);
    assert.equal(direction.evidence.closeReturnsFocus, true);
    assert.equal(direction.evidence.escapeReturnsFocus, true);
    assert.equal(direction.plan.primaryActionPreserved, true);
    assert.equal(direction.plan.opensOnlyExistingPlan, true);
    assert.equal(direction.plan.questionCount, 3);
    assert.equal(direction.reducedMotion, true);
    assert.deepEqual(direction.effects, { network: 0, storage: 0, navigation: 0, forms: 0 });
  }

  const files = await listFiles(ROOT);
  const manifest: any = JSON.parse(await readFile(join(ROOT, "artifact-manifest.json"), "utf8"));
  assert.deepEqual(manifest.files.map((entry: any) => entry.path).sort(), files.filter((path) => !["artifact-manifest.json", "SHA256SUMS"].includes(path)));
  for (const entry of manifest.files) {
    const bytes = await readFile(join(ROOT, entry.path));
    assert.equal(bytes.byteLength, entry.byteSize, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
  const sums = await readFile(join(ROOT, "SHA256SUMS"), "utf8");
  for (const entry of manifest.files) assert.ok(sums.includes(`${entry.sha256}  ${entry.path}`), entry.path);
});
