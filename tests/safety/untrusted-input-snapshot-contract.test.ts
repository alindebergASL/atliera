import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CONTRACT_PATH = join(REPO_ROOT, "docs", "safety", "untrusted-input-snapshot-contract.md");
const README_PATH = join(REPO_ROOT, "README.md");

function readContract(): string {
  return readFileSync(CONTRACT_PATH, "utf8");
}

describe("safety: untrusted input snapshot contract", () => {
  it("documents the read-once snapshot boundary for provider and adapter inputs", () => {
    const contract = readContract();

    assert.match(contract, /read once/i);
    assert.match(contract, /plain snapshot|plain data/i);
    assert.match(contract, /own enumerable/i);
    assert.match(contract, /no live untrusted objects/i);
    assert.match(contract, /provider/i);
    assert.match(contract, /adapter/i);
  });

  it("documents no-reread and sanitized accessor or proxy failure requirements", () => {
    const contract = readContract();

    assert.match(contract, /no reread|must not reread/i);
    assert.match(contract, /getter/i);
    assert.match(contract, /accessor/i);
    assert.match(contract, /proxy/i);
    assert.match(contract, /stable sanitized error/i);
    assert.match(contract, /raw thrown|raw exception|exception text/i);
  });

  it("documents exact validation allowlists and sanitized evidence persistence", () => {
    const contract = readContract();

    assert.match(contract, /exact(?:-match)? allowlist/i);
    assert.match(contract, /prefix/i);
    assert.match(contract, /spoof/i);
    assert.match(contract, /persisted evidence|manifests|reports/i);
    assert.match(contract, /sanitized snapshots only/i);
    assert.match(contract, /prompts/i);
    assert.match(contract, /credentials|secrets/i);
    assert.match(contract, /backend details/i);
    assert.match(contract, /local paths/i);
    assert.match(contract, /approval refs/i);
  });

  it("documents normative examples and a high-friction deviation path", () => {
    const contract = readContract();

    assert.match(contract, /normative examples/i);
    assert.match(contract, /artifact metadata/i);
    assert.match(contract, /database queue payload/i);
    assert.match(contract, /provider request/i);
    assert.match(contract, /provider validation/i);
    assert.match(contract, /manifest|reporting evidence/i);
    assert.match(contract, /deviations/i);
    assert.match(contract, /security review/i);
    assert.match(contract, /specific test/i);
    assert.match(contract, /exceptional/i);
  });

  it("keeps the top-level README linked to the accepted snapshot-boundary contract", () => {
    const readme = readFileSync(README_PATH, "utf8");

    assert.match(readme, /docs\/safety\/untrusted-input-snapshot-contract\.md/);
    assert.match(readme, /snapshot-boundary safety contract/i);
  });
});
