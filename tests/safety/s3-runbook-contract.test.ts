import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "lab-s3-artifact-validation.md");
const README_PATH = join(REPO_ROOT, "README.md");

function readRepoFile(path: string): string {
  return readFileSync(path, "utf8");
}

describe("safety: lab S3 validation docs match CLI guardrails", () => {
  it("documents that allow-overwrite is rejected without a paired evidence output target", () => {
    for (const path of [RUNBOOK_PATH, README_PATH]) {
      const docs = readRepoFile(path);

      assert.match(docs, /--allow-overwrite/);
      assert.match(docs, /--out-root/);
      assert.match(docs, /--out-file/);
      assert.match(
        docs,
        /--allow-overwrite[^.]*rejected[^.]*without[^.]*--out-root[^.]*--out-file/i,
      );
    }
  });

  it("documents sanitized evidence boundaries without raw approval refs or backend details", () => {
    for (const path of [RUNBOOK_PATH, README_PATH]) {
      const docs = readRepoFile(path);

      assert.match(docs, /operator_approval_ref_present/);
      assert.match(docs, /not (?:the )?reference value|not emit raw approval references|not echo raw approval/i);
      assert.match(docs, /raw backend errors/i);
      assert.match(docs, /local paths/i);
    }
  });

  it("keeps the real-backend runbook scoped away from production storage and secret persistence", () => {
    const runbook = readRepoFile(RUNBOOK_PATH);

    assert.match(runbook, /lab-only/i);
    assert.match(runbook, /not create production infrastructure/i);
    assert.match(runbook, /not in committed source/i);
    assert.match(runbook, /operator_cleanup_required/);
  });
});
