import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateFreshUtahC2AccountHome } from "../../src/cli/generate-c2-account-home.ts";

test("CLI generator re-admits the broad Utah run and writes source-derived review output", async () => {
  const output = await mkdtemp(join(tmpdir(), "atliera-c2-render-"));
  const receipt = await generateFreshUtahC2AccountHome(output);
  assert.equal(receipt.accountId, "acc_university_of_utah");
  assert.equal(receipt.admittedSources, 10);
  assert.equal(receipt.admittedExcerpts, 33);
  assert.equal(receipt.discoveryRecords, 35);
  assert.equal(receipt.rendererAnnotations, 4);
  assert.equal(receipt.providerCallsDuringGeneration, 0);
  assert.equal(receipt.ratificationCreated, false);

  const html = await readFile(join(output, "university-of-utah.html"), "utf8");
  assert.match(html, /University of Utah/u);
  assert.match(html, /Redtail/u);
  assert.match(html, /Utah Health AI Vault/u);
  assert.match(html, /table row captured without its column headers/u);
  assert.match(html, /recheck it before meeting use/u);
  assert.match(html, /Related evidence context 1/u);
  assert.match(html, /Exact support 1/u);
  assert.match(html, /Quoted exactly · University of Utah Communications \/ @theU/u);
  assert.doesNotMatch(html, /owner (?:approved|reviewed|said)/iu);

  const generatedResult = JSON.parse(await readFile(join(output, "university-of-utah-validated-result.json"), "utf8"));
  assert.equal(generatedResult.admittedSources.length, 10);
  assert.equal(generatedResult.admittedSources.flatMap((source: { excerpts: unknown[] }) => source.excerpts).length, 33);
  assert.equal(generatedResult.discoveries.length, 35);
  assert.equal(generatedResult.effectReceipt.providerCallsAttempted, 1, "historical effect receipt remains historical");
  assert.equal(receipt.providerCallsDuringGeneration, 0, "this renderer run makes no provider call");
});

test("CLI generator refuses the frozen historical output directory", async () => {
  await assert.rejects(
    () => generateFreshUtahC2AccountHome(join(process.cwd(), "docs/ux/c2-governed-account-intelligence-refresh")),
    /outside the frozen C2 history/u,
  );
});
