// ADR 0003 I-9 (Phase 0 tripwire): no third-party skill load path.
//
// Before M2.5 there is no skill loader at all, and this test pins that
// absence: no skill-named module exists in src/, and no SKILL.md package
// exists anywhere in the tree. The tripwire fires the moment someone
// adds either, forcing a conscious rewrite of this test into the full
// I-8/I-9 loader assertions (in-repo-only source, hash pinning,
// rejection of execution affordances) rather than letting a loader
// arrive without its safety contract.
//
// When M2.5 lands: replace the absence assertions below with
//   - loader rejects packages containing scripts/ directories,
//     executable bits, or granting frontmatter (I-8,
//     `test_skill_package_rejects_execution_affordances`);
//   - loader resolves only the in-repo skills tree; no remote/url/
//     marketplace path exists (`test_no_third_party_skill_load_path`);
//   - packages are hash-pinned and approval packets reference versions
//     (I-9, `test_skill_hash_pinned_first_party`).

import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const SRC_ROOT = join(REPO_ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("ADR 0003 I-9 (Phase 0 tripwire)", () => {
  test("test_no_third_party_skill_load_path", () => {
    // (a) No skill loader module exists in src/ yet.
    const skillNamedSrc = walk(SRC_ROOT).filter((path) =>
      /skill/i.test(relative(SRC_ROOT, path)),
    );
    assert.deepEqual(
      skillNamedSrc.map((p) => relative(REPO_ROOT, p)),
      [],
      "a skill-named module appeared in src/ — rewrite this tripwire into the full I-8/I-9 loader assertions before merging it",
    );

    // (b) No SKILL.md package exists anywhere in the tree yet.
    const skillPackages = walk(REPO_ROOT).filter((path) =>
      /(^|\/)SKILL\.md$/i.test(path),
    );
    assert.deepEqual(
      skillPackages.map((p) => relative(REPO_ROOT, p)),
      [],
      "a SKILL.md package appeared — the loader and its I-8/I-9 contract tests must land in the same change",
    );
  });
});
