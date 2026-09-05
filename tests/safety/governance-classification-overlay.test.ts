import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const REPO = new URL("../..", import.meta.url).pathname;
const REQUIRED = [
  "scripts/classify-pr.sh", "scripts/classify-change-risk.ts", "scripts/verify-ceremony.ts",
  "docs/strategy/governance-tiers.json", "docs/strategy/decision-record.schema.json",
] as const;

function overlayScript(): string {
  const workflow = readFileSync(join(REPO, ".github/workflows/governance-classify.yml"), "utf8");
  const start = workflow.indexOf("      - name: Overlay protected enforcement code and config onto the candidate workspace\n");
  const end = workflow.indexOf("      - name: Fetch pinned base for comparison\n", start);
  assert.ok(start >= 0 && end > start, "exercise the actual workflow copy step");
  const chunk = workflow.slice(start, end).split("        run: |\n")[1];
  assert.ok(chunk);
  return chunk.split("\n").map((line) => line.startsWith("          ") ? line.slice(10) : line).join("\n")
    .replaceAll("${{ github.event.pull_request.base.sha }}", "a".repeat(40));
}

function fixture(omit?: string): string {
  const root = mkdtempSync(join(tmpdir(), "atliera-protected-overlay-"));
  mkdirSync(join(root, "candidate/scripts"), { recursive: true });
  for (const file of REQUIRED) {
    if (file === omit) continue;
    const path = join(root, "enforcement", file);
    mkdirSync(dirname(path), { recursive: true });
    // Inert synthetic bytes: this test executes only copy/chmod/hash, not enforcement.
    writeFileSync(path, `protected fixture for ${file}\n`);
    if (file.startsWith("scripts/")) writeFileSync(join(root, "candidate", file), "candidate bytes must not decide enforcement\n");
  }
  return root;
}

test("classification overlay uses protected roots without requiring ceremony-only additions", () => {
  const root = fixture();
  try {
    const result = spawnSync("bash", ["-c", overlayScript()], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    for (const file of REQUIRED) {
      const destination = file.startsWith("scripts/") ? file : `.atliera-enforcement/${file.split("/").at(-1)}`;
      assert.equal(readFileSync(join(root, "candidate", destination), "utf8"), readFileSync(join(root, "enforcement", file), "utf8"));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("classification overlay still refuses missing required protected enforcement", () => {
  for (const missing of ["scripts/classify-change-risk.ts", "docs/strategy/governance-tiers.json"]) {
    const root = fixture(missing);
    try {
      const result = spawnSync("bash", ["-c", overlayScript()], { cwd: root, encoding: "utf8" });
      assert.notEqual(result.status, 0, `must refuse absent ${missing}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
