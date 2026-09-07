import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string): string => readFileSync(path, "utf8");
const statusPath = "docs/status/c3-two-account-product-proof-20260907.md";

for (const guide of ["c3-curated-preview", "c3-proposed-next-step"]) {
  test(`${guide} links executed agent proof without implying customer acceptance`, () => {
    const text = read(`docs/guides/${guide}.md`);
    assert.ok(text.includes("../status/c3-two-account-product-proof-20260907.md"));
    assert.ok(text.includes("not customer or screen-reader acceptance"));
    assert.doesNotMatch(text, /full two-account sprint\/persona acceptance remain later|Independent source\/evidence\/security review and two-account desktop\/mobile browser verification remain necessary/);
  });
}

test("two-account proof keeps exact implementation identity and effect boundaries", () => {
  const text = read(statusPath);
  for (const required of [
    "b436652575872244abcc148723187d1e337bdd9a",
    "1667d8b0b1f3b7f54729d43a8a6697b699484a36",
    "agent_verification: passed", "customer_acceptance: not_established",
    "screen_reader_acceptance: not_established", "authorizes_live_product_generation: false",
    "authorizes_retrieval: false", "authorizes_durable_product_writes: false",
    "authorizes_deployment: false", "authorizes_sharing_or_approval: false",
    "same browser context across distinct loopback origins",
    "hand-authored synthetic candidates, not public-account model recordings",
    "GPT-6 Astra", "Operation not permitted",
  ]) assert.ok(text.includes(required), required);
  assert.doesNotMatch(text, /(?:customer_acceptance|screen_reader_acceptance):\s*(?:passed|approved)|authorizes_[a-z_]+:\s*true/);
});

test("public source counts in the proof agree with retained curated input", () => {
  const fixture = JSON.parse(read("fixtures/account-intelligence/c3-curated/missouri.json")) as { sources: { excerpts: unknown[] }[] };
  const text = read(statusPath);
  assert.ok(text.includes(`${fixture.sources.length} official public extracted snapshots`));
  assert.ok(text.includes(`${fixture.sources.reduce((n, source) => n + source.excerpts.length, 0)} exact excerpts`));
});
