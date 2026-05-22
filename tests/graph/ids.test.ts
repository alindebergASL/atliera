import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { idHasPrefix, isWellFormedId, idPrefix } from "../../src/graph/ids.ts";

describe("ids", () => {
  it("accepts well-formed ids", () => {
    assert.equal(isWellFormedId("src_acme_001"), true);
    assert.equal(isWellFormedId("exc_a-b-c"), true);
  });

  it("rejects malformed ids", () => {
    assert.equal(isWellFormedId(""), false);
    assert.equal(isWellFormedId("src "), false);
    assert.equal(isWellFormedId("SRC_ACME"), false);
    assert.equal(isWellFormedId("acme_001"), true); // valid token shape
    assert.equal(isWellFormedId("_acme"), false);
    assert.equal(isWellFormedId(42 as unknown), false);
  });

  it("extracts prefix correctly", () => {
    assert.equal(idPrefix("src_acme"), "src");
    assert.equal(idPrefix("exc_acme_001"), "exc");
    assert.equal(idPrefix("noprefix"), null);
  });

  it("matches expected prefixes per record kind", () => {
    assert.equal(idHasPrefix("src_acme", "source_document"), true);
    assert.equal(idHasPrefix("exc_acme", "evidence_excerpt"), true);
    assert.equal(idHasPrefix("clm_acme", "claim"), true);
    assert.equal(idHasPrefix("cev_acme", "claim_evidence"), true);
    assert.equal(idHasPrefix("obj_acme", "account_object"), true);
    assert.equal(idHasPrefix("oclm_acme", "account_object_claim"), true);
    assert.equal(idHasPrefix("run_acme", "research_run"), true);
    assert.equal(idHasPrefix("art_acme", "run_artifact"), true);
    assert.equal(idHasPrefix("aud_acme", "audit_event"), true);

    assert.equal(idHasPrefix("clm_acme", "source_document"), false);
    assert.equal(idHasPrefix("src_acme", "claim"), false);
  });
});
