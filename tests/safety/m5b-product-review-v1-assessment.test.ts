import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..", "..");

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

test("schema-v1 real package assessment blocks ratification/apply and selects the v2 evidence gate", () => {
  const assessment = read("docs/reviews/m5b-product-review-v1-real-package-assessment.md");
  assert.match(assessment, /external, nonbinding sanitized package/i);
  assert.match(assessment, /canonical prepare result: `cf682913fc6de8540cfab203df39c3882b6889ae80aa095bac99c4cc490a2e04`/i);
  for (const [file, bytes, sha256] of [
    ["sanitized-source-pack.json", "7,569", "137782a2e5546ccbb1be8cc1e74fb513cf56840f35f025b167b864a462be4a6d"],
    ["candidate.json", "18,512", "73c0fa38102c6ce408b2de1c64188607466d26b67fdedfbba2b008393f34de0a"],
    ["review-packet.json", "13,449", "cf051cb0e7bc365151295ea97018a3f6b6247ace2491de3cacd12b11e1cb55bf"],
    ["workshop-pre-ratification.html", "25,357", "f05fdaf5e743e3c0151d540fd71e9f16abd5447e8bbe5a0b0161a08c6cdfaa9d"],
    ["meeting-brief.md", "4,839", "0a65bfe27b16d58dd3bab1a8907eda8c8a7a55fef3701f4d2667d893ed26e515"],
    ["prepare-result.json", "2,663", "b34ec2f507079e606e16d53b8ce4e04dd722f7e90ebddfc0ef9a8f370508fb22"],
  ] as const) {
    assert.match(assessment, new RegExp("\\| `" + file.replace(".", "\\.") +
      "` \\| " + bytes + " \\| `" + sha256 + "` \\|"));
  }
  assert.match(assessment, /six files total 72,389 bytes/i);
  for (const canonical of [
    "c4bfafda0db60aa042d8b07cd8eeb11f70c1f3bf10be474fee6ed50f36393f40",
    "1bebf5c7240023e230eca5236ffb7f89333e4c3302e9bb51c4831adaec810263",
    "e9b383c2ced1f79bdd66f7dbfb2d377082164b7162cb10f61e1efa339ddfef03",
  ]) assert.match(assessment, new RegExp(canonical));
  assert.match(assessment, /Six-file byte ledger\s*\| Pass/i);
  assert.match(assessment, /Product usefulness\s*\| Fail/i);
  assert.match(assessment, /Exact execution provenance\s*\| Hold/i);
  assert.match(assessment, /107,366-byte primary 8-K contributes only `FEDEX CORPORATION`/i);
  assert.match(assessment, /Workshop was post-processed after prepare/i);
  assert.match(assessment, /014532ecb0148d56482ca51b0507caa321b04c50b4ba0eb595fc86db750444be/);
  assert.match(assessment, /0042bb2aa7513285dce86d323360183a86568ab0aa5a35875859f2a83e9932f0/);
  assert.match(assessment, /one retained-custody read/i);
  assert.match(assessment, /one archive acquisition\/network request/i);
  assert.match(assessment, /Do not ratify, apply, or use this package as a durable successor baseline/i);
  assert.match(assessment, /material_change.*source-fact Signal.*Map analysis.*every Play/is);
  assert.match(assessment, /authorizes no source read, acquisition, ratification, apply, graph\/database write/i);
});

test("current authority documents agree on product fail, provenance hold, and generic schema v2", () => {
  for (const path of ["docs/strategy/roadmap.md", "docs/runbooks/INDEX.md", "docs/BLOCKERS.md"]) {
    const document = read(path);
    assert.match(document,
      /SCHEMA[_ -]V1[_ -]PACKAGE[:=]?(?:`)?\s*PRODUCT_FAIL|schema-v1 package (?:is `PRODUCT_FAIL`|failed)/i);
    assert.match(document,
      /EXACT[_ -]EXECUTION[_ -]PROVENANCE[:=]?(?:`)?\s*HOLD|execution provenance (?:`HOLD`|on hold|remains on hold)/i);
    assert.match(document, /generic schema-v2|schema-v2 generic/i);
    assert.match(document, /CURRENT_EFFECTIVE_AUTHORIZATION[:=]NONE|current_effective_authorization:\s*none/i);
    assert.match(document, /QUALIFIED_REAL_SOURCE_READS[:=] ?0/);
    assert.match(document, /EXTERNALLY_REPORTED_HISTORICAL_ARCHIVE_ACQUISITIONS[:=] ?1/);
    assert.match(document, /EXTERNALLY_REPORTED_HISTORICAL_ARCHIVE_NETWORK_REQUESTS[:=] ?1/);
    assert.match(document, /PACKAGE_RECORDED_HISTORICAL_RETAINED_CUSTODY_READS[:=] ?1/);
    assert.match(document, /CURRENT_AUTHORIZED_FUTURE_SOURCE_EFFECTS[:=] ?0/);
    assert.doesNotMatch(document, /(?:^|\n)-? ?REAL_SOURCE_READS[:=] ?0(?:\n|;|$)/);
    assert.doesNotMatch(document, /(?:^|\n)- private_reads: 0(?:\n|$)/);
    assert.doesNotMatch(document, /(?:^|\n)- acquisitions: 0(?:\n|$)/);
  }
});
