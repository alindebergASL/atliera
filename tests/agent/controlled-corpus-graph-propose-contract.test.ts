import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION,
  buildControlledCorpusGraphProposePromptContract,
  listControlledCorpusGraphProposePromptContracts,
} from "../../src/agent/controlled-corpus-graph-propose-contract.ts";

describe("controlled corpus graph.propose prompt/proposal contract", () => {
  test("builds a no-spend structured graph.propose contract for each controlled corpus role", () => {
    const contracts = listControlledCorpusGraphProposePromptContracts();
    assert.deepEqual(contracts.map((contract) => contract.role).sort(), ["calibration", "edge-case", "representative"]);

    for (const contract of contracts) {
      assert.equal(contract.schema_version, CONTROLLED_CORPUS_GRAPH_PROPOSE_PROMPT_SCHEMA_VERSION);
      assert.equal(contract.operation, "graph.propose");
      assert.equal(contract.mode, "no-spend-contract");
      assert.equal(contract.launch_readiness_claim, false);
      assert.equal(contract.approves_live_provider_call, false);
      assert.equal(contract.approves_provider_spend, false);
      assert.equal(contract.approves_expansion_or_comparison, false);
      assert.deepEqual(contract.prompt_contract_operations, [
        "propose.excerpts",
        "propose.claims",
        "propose.account_objects",
        "summarize.lens",
      ]);
      assert.deepEqual(contract.required_response_keys, ["excerpts", "claims", "account_objects", "lens_summaries"]);
      assert.deepEqual(contract.blocked_next_actions, [
        "live_provider_rerun",
        "provider_comparison",
        "corpus_expansion",
        "launch_readiness_claim",
        "product_readiness_claim",
      ]);
      assert.equal(Object.isFrozen(contract), true);
      assert.equal(Object.isFrozen(contract.prompt_contract_operations), true);
      assert.equal(Object.isFrozen(contract.required_response_keys), true);
      assert.equal(Object.isFrozen(contract.blocked_next_actions), true);

      assert.match(contract.prompt_template, /return only strict json/i);
      assert.match(contract.prompt_template, /excerpts/i);
      assert.match(contract.prompt_template, /claims/i);
      assert.match(contract.prompt_template, /account_objects/i);
      assert.match(contract.prompt_template, /lens_summaries/i);
      assert.match(contract.prompt_template, /internal proposal id/i);
      assert.match(contract.prompt_template, /non-empty literal source span/i);
      assert.match(contract.prompt_template, /source_document_id/i);
      assert.match(contract.prompt_template, /supporting_excerpt/i);
      assert.match(contract.prompt_template, /supporting_claim/i);
      assert.match(contract.prompt_template, /Signals/i);
      assert.match(contract.prompt_template, /Maps/i);
      assert.match(contract.prompt_template, /Plays/i);
      assert.match(contract.prompt_template, /do not invent/i);
      assert.match(contract.prompt_template, /Do not include private identifiers/i);
      assert.doesNotMatch(contract.prompt_template, /OpenRouter|owl-alpha|Anthropic|OpenAI|api[_-]?key|secret|https?:\/\//i);
    }
  });

  test("specializes role instructions without changing the response schema", () => {
    const representative = buildControlledCorpusGraphProposePromptContract({ role: "representative" });
    const edgeCase = buildControlledCorpusGraphProposePromptContract({ role: "edge-case" });
    const calibration = buildControlledCorpusGraphProposePromptContract({ role: "calibration" });

    assert.match(representative.prompt_template, /normal account-shape evidence/i);
    assert.match(edgeCase.prompt_template, /sparse, ambiguous, or conflicting evidence/i);
    assert.match(calibration.prompt_template, /known expected weak\/useful\/failure calibration/i);

    assert.deepEqual(representative.required_response_keys, edgeCase.required_response_keys);
    assert.deepEqual(edgeCase.required_response_keys, calibration.required_response_keys);
    assert.notEqual(representative.prompt_template, edgeCase.prompt_template);
    assert.notEqual(edgeCase.prompt_template, calibration.prompt_template);
  });

  test("rejects untrusted role input and remains process.env independent", () => {
    assert.throws(
      () => buildControlledCorpusGraphProposePromptContract({ role: "comparison" as never }),
      /controlled corpus graph propose role is not supported/,
    );

    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read by controlled corpus prompt contracts");
      },
    });
    try {
      assert.equal(buildControlledCorpusGraphProposePromptContract({ role: "edge-case" }).role, "edge-case");
      assert.equal(listControlledCorpusGraphProposePromptContracts().length, 3);
    } finally {
      if (originalDescriptor !== undefined) Object.defineProperty(process, "env", originalDescriptor);
    }
  });

  test("returns defensive immutable copies", () => {
    const first = buildControlledCorpusGraphProposePromptContract({ role: "representative" });
    const second = buildControlledCorpusGraphProposePromptContract({ role: "representative" });

    assert.notEqual(first, second);
    assert.throws(
      () => ((first as { role: string }).role = "edge-case"),
      /read only|Cannot assign/i,
    );
    assert.throws(
      () => ((first.required_response_keys as string[])[0] = "raw_text"),
      /read only|Cannot assign/i,
    );
  });
});
