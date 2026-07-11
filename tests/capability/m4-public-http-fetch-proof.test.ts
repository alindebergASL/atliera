import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { generateM4PublicHttpFetchProof, M4_RECORDED_PROMPT_INJECTION_BODY } from "../../src/capability/m4-public-http-fetch-proof.ts";
import { H2_CAPABILITY_REGISTRY, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID } from "../../src/capability/h2-registry.ts";

const fixture = join(import.meta.dirname, "..", "..", "fixtures", "validation", "m4-public-http-fetch-v1-recorded-proof.json");

test("recorded proof is deterministic and traverses registry, MCP, mediation, custody, audit and accounting", async () => {
  const first = await generateM4PublicHttpFetchProof();
  assert.deepEqual(first, await generateM4PublicHttpFetchProof());
  assert.deepEqual(first, JSON.parse(readFileSync(fixture, "utf8")));
  assert.equal(H2_CAPABILITY_REGISTRY.length, 2);
  assert.equal(H2_CAPABILITY_REGISTRY[1].capabilityId, M4_PUBLIC_HTTP_FETCH_CAPABILITY_ID);
  assert.equal((first.capabilityExecutions as unknown[]).length, 1);
  assert.equal((first.auditEvents as unknown[]).length, 1);
  assert.equal((first.accountingIncrements as unknown[]).length, 1);
  const acquisition = first.acquisition as Record<string, unknown>;
  assert.equal(acquisition.quotedBodyText, M4_RECORDED_PROMPT_INJECTION_BODY);
  assert.equal(Buffer.from(acquisition.bodyBase64 as string, "base64").toString("utf8"), M4_RECORDED_PROMPT_INJECTION_BODY);
  assert.equal((acquisition.trust as Record<string, unknown>).status, "quoted_untrusted_public_source_content");
  assert.deepEqual(first.effects, { recordedInjectedHttpRequests: 1, systemSideAcquisitionProofs: 1,
    liveNetworkEgress: 0, retries: 0, providerCalls: 0, privateReads: 0, graphWrites: 0,
    productionWrites: 0, deployments: 0 });
  const control = first.injectionControlProof as Record<string, unknown>;
  assert.equal(control.targetAfterContent, "fedex_company_overview");
  assert.equal(control.mediationLevelAfterContent, "L0");
  assert.equal(control.contentControlAuthority, "none");
});

test("roadmap and inert packet preserve explicit none authority markers", () => {
  for (const relative of [
    ["docs", "strategy", "roadmap.md"],
    ["docs", "runbooks", "m4-public-http-fetch-v1-status-and-fedex-live-packet.md"],
  ]) {
    const document = readFileSync(join(import.meta.dirname, "..", "..", ...relative), "utf8");
    assert.doesNotMatch(document, /current_effective_authorization:\s*`?\*\*\*/);
    assert.match(document, /current_effective_authorization:\s*`?none`?/);
    assert.doesNotMatch(document, /preserve\s+`?\*\*\*\s+until/i);
    const markerLines = document.split("\n").filter((line) => /^- (?:decision_)?current_effective_authorization:/.test(line));
    assert.ok(markerLines.length > 0);
    for (const line of markerLines) assert.match(line, /current_effective_authorization:\s*`?none`?$/);
  }
  const packet = readFileSync(join(import.meta.dirname, "..", "..", "docs", "runbooks",
    "m4-public-http-fetch-v1-status-and-fedex-live-packet.md"), "utf8");
  assert.match(packet, /preserve `current_effective_authorization: none` until that GO is recorded/);
});

test("capability implementation remains absent from the root model-facing barrel", () => {
  const root = readFileSync(join(import.meta.dirname, "..", "..", "src", "index.ts"), "utf8");
  assert.doesNotMatch(root, /\.\/capability\/|public_http_fetch_v1|M4PublicHttp/);
});
