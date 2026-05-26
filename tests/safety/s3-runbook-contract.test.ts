import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const RUNBOOK_PATH = join(REPO_ROOT, "docs", "runbooks", "lab-s3-artifact-validation.md");
const README_PATH = join(REPO_ROOT, "README.md");
const DURABLE_ADAPTER_CONTRACTS_PATH = join(REPO_ROOT, "docs", "architecture", "durable-adapter-contracts.md");

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

  it("keeps the durable adapter architecture aligned with lab-only AWS CLI validation boundaries", () => {
    const architecture = readRepoFile(DURABLE_ADAPTER_CONTRACTS_PATH);

    assert.match(architecture, /AwsCliS3CompatibilityClient/);
    assert.match(architecture, /lab-only/i);
    assert.match(architecture, /operator_approval_ref_present/);
    assert.match(architecture, /operator_cleanup_required/);
    assert.match(architecture, /raw backend errors/i);
    assert.match(architecture, /local paths/i);
    assert.match(architecture, /not .*production-ready/i);
  });

  it("documents no-bucket AWS CLI preflight lifecycle evidence in each durable S3 validation doc", () => {
    for (const path of [RUNBOOK_PATH, README_PATH, DURABLE_ADAPTER_CONTRACTS_PATH]) {
      const docs = readRepoFile(path);

      assert.match(docs, /check-aws-cli|tooling preflight|no-bucket/i);
      assert.match(docs, /`?validation_scope`?:\s*\\?"tooling_preflight_no_bucket_access\\?"/i);
      assert.match(docs, /`?object_lifecycle`?:\s*\\?"not_applicable_no_bucket_access\\?"/i);
      assert.match(docs, /does not .*create objects|no bucket access|does not touch a bucket/i);
    }
  });

  it("documents the lab AWS CLI operation timeout contract in each durable S3 validation doc", () => {
    for (const path of [RUNBOOK_PATH, README_PATH, DURABLE_ADAPTER_CONTRACTS_PATH]) {
      const docs = readRepoFile(path);

      assert.match(docs, /AwsCliS3CompatibilityClient|validate-aws-cli|AWS CLI/i);
      assert.match(docs, /--aws-timeout-ms/i);
      assert.match(docs, /250[^.]*300000|300000[^.]*250/i);
      assert.match(docs, /bounded default timeout|explicit default timeout|10-second AWS CLI operation timeout/i);
      assert.match(docs, /sanitize[^.]*timeout failures|timeout failures[^.]*sanitize/i);
      assert.match(docs, /raw timeout values/i);
      assert.match(docs, /process signals/i);
    }
  });
});
