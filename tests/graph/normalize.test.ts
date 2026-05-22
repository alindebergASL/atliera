import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeText,
  sourceContainsExcerpt,
} from "../../src/graph/normalize.ts";

describe("normalizeText", () => {
  it("folds whitespace and case", () => {
    assert.equal(normalizeText("  Hello\tWorld\n"), "hello world");
  });

  it("normalises curly quotes and dashes", () => {
    assert.equal(
      normalizeText("“hello—world”"),
      '"hello-world"',
    );
  });
});

describe("sourceContainsExcerpt", () => {
  it("returns true for a literal substring", () => {
    assert.equal(
      sourceContainsExcerpt("Acme launched a platform.", "launched a platform"),
      true,
    );
  });

  it("returns true across whitespace variation", () => {
    assert.equal(
      sourceContainsExcerpt("Acme   launched\na platform.", "launched a platform"),
      true,
    );
  });

  it("returns false for a paraphrase", () => {
    assert.equal(
      sourceContainsExcerpt(
        "Acme launched a platform.",
        "Acme has unveiled a new offering.",
      ),
      false,
    );
  });

  it("returns false for an empty excerpt", () => {
    assert.equal(sourceContainsExcerpt("anything", ""), false);
  });
});
