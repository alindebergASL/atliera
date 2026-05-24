import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const workflowPath = join(process.cwd(), ".github", "workflows", "ci.yml");

function ciWorkflow(): string {
  return readFileSync(workflowPath, "utf8");
}

describe("safety: GitHub Actions runtime hygiene", () => {
  test("uses Node 24-compatible first-party actions for CI", () => {
    const workflow = ciWorkflow();

    assert.match(workflow, /uses:\s+actions\/checkout@v5\b/);
    assert.match(workflow, /uses:\s+actions\/setup-node@v5\b/);
    assert.doesNotMatch(workflow, /uses:\s+actions\/(?:checkout|setup-node)@v4\b/);
  });

  test("keeps project CI on the repository-supported Node.js runtime", () => {
    const workflow = ciWorkflow();

    assert.match(workflow, /node-version:\s*22\b/);
  });
});
