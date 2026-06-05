import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const CLI = join(REPO_ROOT, "src", "cli", "live-provider-proof.ts");
const FIXTURE = join(REPO_ROOT, "tests", "fixtures", "live-provider-proof", "moderate-valid.json");
const TSX = join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function runCli(args: string[], options: { cwd?: string } = {}) {
  return spawnSync(process.execPath, [TSX, CLI, ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
  });
}

test("live provider proof CLI verifies out-of-repo input and writes sanitized summary only", () => {
  const root = mkdtempSync(join(tmpdir(), "atliera-live-proof-cli-"));
  const input = join(root, "private-output.json");
  const output = join(root, "sanitized-summary.json");
  writeFileSync(input, readFileSync(FIXTURE, "utf8"));

  const result = runCli([
    "verify",
    "--input", input,
    "--out", output,
    "--run-ref", "runtime-model-only-live-provider-cli-fixture",
    "--route-ref", "gpt-5.5-openai-codex-repeatability-20260604h",
    "--provider-ref", "openai-codex",
    "--provider-calls", "1",
    "--observed-cost-usd", "0",
    "--tokens-used-total", "10158",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Synthetic account A is expanding/i);
  const summary = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(summary.ok, true);
  assert.equal(summary.schema_version, "atliera.live_provider_moderate_proof_summary.v1");
  assert.equal(summary.provider_calls_executed, 1);
  assert.equal(summary.observed_cost_usd, 0);
  assert.equal(summary.tokens_used_total, 10158);
  assert.deepEqual(summary.counts, { accounts: 3, excerpts: 6, claims: 6, account_objects: 9 });
  assert.equal(summary.model_output_committed, false);
  assert.equal(summary.request_identifier_committed, false);
});

test("live provider proof CLI rejects repo input, repo output, symlinked repo output, and malformed proofs without printing raw body", () => {
  const root = mkdtempSync(join(tmpdir(), "atliera-live-proof-cli-"));
  const malformedInput = join(root, "malformed.json");
  const output = join(root, "summary.json");
  writeFileSync(malformedInput, "{not json");

  const repoInput = runCli(["verify", "--input", FIXTURE, "--out", output]);
  assert.equal(repoInput.status, 2);
  assert.match(repoInput.stderr, /input path must be outside the repository/i);

  const repoInputFromOutsideRepo = runCli(["verify", "--input", FIXTURE, "--out", output], { cwd: root });
  assert.equal(repoInputFromOutsideRepo.status, 2);
  assert.match(repoInputFromOutsideRepo.stderr, /input path must be outside the repository/i);

  const repoOutput = runCli(["verify", "--input", malformedInput, "--out", join(REPO_ROOT, "tmp-summary.json")]);
  assert.equal(repoOutput.status, 2);
  assert.match(repoOutput.stderr, /output path must be outside the repository/i);

  const symlinkedRepoParent = join(root, "repo-link");
  symlinkSync(REPO_ROOT, symlinkedRepoParent, "dir");
  const symlinkedRepoOutput = runCli(["verify", "--input", malformedInput, "--out", join(symlinkedRepoParent, "summary.json")]);
  assert.equal(symlinkedRepoOutput.status, 2);
  assert.match(symlinkedRepoOutput.stderr, /output path must be outside the repository/i);

  const repoSymlinkTarget = join(REPO_ROOT, "tmp-live-provider-proof-symlink-target.json");
  const symlinkedRepoOutputFile = join(root, "summary-link.json");
  try {
    writeFileSync(repoSymlinkTarget, "must not be overwritten");
    symlinkSync(repoSymlinkTarget, symlinkedRepoOutputFile, "file");
    const symlinkedRepoFileOutput = runCli(["verify", "--input", malformedInput, "--out", symlinkedRepoOutputFile]);
    assert.equal(symlinkedRepoFileOutput.status, 2);
    assert.match(symlinkedRepoFileOutput.stderr, /output path must be outside the repository/i);
    assert.equal(readFileSync(repoSymlinkTarget, "utf8"), "must not be overwritten");
  } finally {
    rmSync(repoSymlinkTarget, { force: true });
  }

  const malformed = runCli(["verify", "--input", malformedInput, "--out", output]);
  assert.equal(malformed.status, 1);
  assert.doesNotMatch(malformed.stdout + malformed.stderr, /not json/);
  const summary = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(summary.ok, false);
  assert.equal(summary.validation_errors.includes("invalid_json"), true);
});
