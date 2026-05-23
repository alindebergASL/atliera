import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

import {
  PROMPT_CONTRACT_SCHEMA_VERSION,
  PROMPT_CONTRACTS,
  getPromptContract,
  listPromptContracts,
} from "../../src/agent/prompt-contracts.ts";

describe("Agent prompt contract placeholders", () => {
  it("defines frozen placeholders for excerpts, claims, account objects, and lens summaries", () => {
    const contracts = listPromptContracts();
    const operations = contracts.map((contract) => contract.operation).sort();

    assert.deepEqual(operations, [
      "propose.account_objects",
      "propose.claims",
      "propose.excerpts",
      "summarize.lens",
    ]);

    for (const contract of contracts) {
      assert.equal(contract.schema_version, PROMPT_CONTRACT_SCHEMA_VERSION);
      assert.equal(Object.isFrozen(contract), true);
      assert.equal(Object.isFrozen(contract.required_input_refs), true);
      assert.equal(Object.isFrozen(contract.allowed_output_record_kinds), true);
      assert.equal(contract.mode, "placeholder");
      assert.match(contract.id, /^prompt_[a-z0-9_]+$/);
      assert.ok(contract.required_input_refs.length > 0);
      assert.ok(contract.allowed_output_record_kinds.length > 0);
      assert.equal(contract.provider, null);
      assert.equal(contract.model, null);
    }

    assert.deepEqual(getPromptContract("propose.excerpts").allowed_output_record_kinds, ["evidence_excerpt"]);
    assert.deepEqual(getPromptContract("propose.claims").allowed_output_record_kinds, ["claim", "claim_evidence"]);
    assert.deepEqual(getPromptContract("propose.account_objects").allowed_output_record_kinds, ["account_object", "account_object_claim"]);
    assert.deepEqual(getPromptContract("summarize.lens").allowed_output_record_kinds, ["lens_summary"]);
  });

  it("encodes active safety requirements rather than provider instructions", () => {
    for (const contract of PROMPT_CONTRACTS) {
      assert.match(contract.contract, /must cite existing source_document_id/i);
      assert.match(contract.contract, /must not invent/i);
      assert.match(contract.contract, /relationship IDs/i);
      assert.match(contract.contract, /Graph validators/i);
      assert.match(contract.contract, /quality gate/i);
      assert.doesNotMatch(JSON.stringify(contract), /api[_-]?key|secret|baseUrl|endpoint|https?:\/\//i);
    }
  });

  it("returns defensive immutable copies and rejects unknown operations", () => {
    const listed = listPromptContracts();
    assert.notEqual(listed, PROMPT_CONTRACTS);
    assert.notEqual(listed[0], PROMPT_CONTRACTS[0]);

    assert.throws(() => getPromptContract("propose.sources" as never), /prompt contract operation/i);
    assert.throws(() => ((listed[0] as { id: string }).id = "prompt_changed"), /read only|Cannot assign/i);
  });

  it("does not read process.env while listing or retrieving contracts", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read by prompt contracts");
      },
    });

    try {
      assert.equal(listPromptContracts().length, 4);
      assert.equal(getPromptContract("propose.claims").operation, "propose.claims");
    } finally {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(process, "env", originalDescriptor);
      }
    }
  });
});
