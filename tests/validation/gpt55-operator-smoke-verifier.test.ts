import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyGpt55OperatorSmokePayload } from "../../src/validation/gpt55-operator-smoke-verifier.ts";

const VALID_PAYLOAD = JSON.stringify({
  schema_version: "atliera.operator_gpt55_smoke.v1",
  provider_path: "hermes-openai-codex-operator",
  model: "gpt-5.5",
  source_scope: "synthetic-only",
  excerpts: [
    { id: "ex1", text: "Services revenue grew in Q1.", supports: "services revenue growth" },
    { id: "ex2", text: "Partner training quality and data migration are risks.", supports: "execution risks" },
  ],
  claims: [
    { id: "cl1", text: "The account has services momentum.", supporting_excerpt_ids: ["ex1"] },
    { id: "cl2", text: "Execution risk remains around partner training and migration.", supporting_excerpt_ids: ["ex2"] },
  ],
  account_objects: [
    { id: "obj1", object_type: "signal", text: "Services revenue growth is a positive signal.", supporting_claim_ids: ["cl1"] },
    { id: "obj2", object_type: "play", text: "Package repeatable onboarding playbooks.", supporting_claim_ids: ["cl2"] },
    { id: "obj3", object_type: "risk", text: "Partner training quality may slow execution.", supporting_claim_ids: ["cl2"] },
  ],
  boundary: {
    atliera_model_provider_bridge: false,
    provider_quality_conclusion: false,
    production_readiness_claim: false,
  },
});

describe("GPT-5.5 operator smoke verifier", () => {
  it("accepts strict synthetic operator-smoke JSON with exact counts, citation links, and false boundaries", () => {
    const report = verifyGpt55OperatorSmokePayload(VALID_PAYLOAD);

    assert.equal(report.ok, true);
    assert.equal(report.parse_ok, true);
    assert.equal(report.schema_ok, true);
    assert.equal(report.markdown_fence_present, false);
    assert.deepEqual(report.counts, { excerpts: 2, claims: 2, account_objects: 3 });
    assert.equal(report.citation_links_ok, true);
    assert.equal(report.boundary_ok, true);
    assert.equal(report.atliera_model_provider_bridge_executed, false);
    assert.equal(report.approved_gpt55_comparison_executed, false);
    assert.equal(report.provider_quality_conclusion, false);
    assert.equal(report.production_readiness_claim, false);
    assert.deepEqual(report.errors, []);
  });

  it("rejects markdown fences, wrong boundary flags, missing citation links, and shape drift", () => {
    assert.equal(verifyGpt55OperatorSmokePayload(`~~~json\n${VALID_PAYLOAD}\n~~~`).ok, false);
    assert.equal(verifyGpt55OperatorSmokePayload(`\`\`\`json\n${VALID_PAYLOAD}\n\`\`\``).markdown_fence_present, true);

    const broadened = JSON.parse(VALID_PAYLOAD);
    broadened.boundary.production_readiness_claim = true;
    const broadenedReport = verifyGpt55OperatorSmokePayload(JSON.stringify(broadened));
    assert.equal(broadenedReport.ok, false);
    assert.equal(broadenedReport.boundary_ok, false);
    assert.match(broadenedReport.errors.join("\n"), /boundary_flags_not_false/);

    const missingCitation = JSON.parse(VALID_PAYLOAD);
    missingCitation.account_objects[0].supporting_claim_ids = ["missing-claim"];
    const missingCitationReport = verifyGpt55OperatorSmokePayload(JSON.stringify(missingCitation));
    assert.equal(missingCitationReport.ok, false);
    assert.equal(missingCitationReport.citation_links_ok, false);
    assert.match(missingCitationReport.errors.join("\n"), /object_with_missing_claim/);

    const extraTopLevel = JSON.parse(VALID_PAYLOAD);
    extraTopLevel.tools_used = true;
    const extraReport = verifyGpt55OperatorSmokePayload(JSON.stringify(extraTopLevel));
    assert.equal(extraReport.ok, false);
    assert.equal(extraReport.schema_ok, false);
    assert.match(extraReport.errors.join("\n"), /unexpected_top_level_key/);
  });

  it("fails closed without reading process.env", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(process, "env");
    Object.defineProperty(process, "env", {
      configurable: true,
      get() {
        throw new Error("process.env must not be read");
      },
    });
    try {
      assert.equal(verifyGpt55OperatorSmokePayload(VALID_PAYLOAD).ok, true);
    } finally {
      if (originalDescriptor) Object.defineProperty(process, "env", originalDescriptor);
    }
  });
});
