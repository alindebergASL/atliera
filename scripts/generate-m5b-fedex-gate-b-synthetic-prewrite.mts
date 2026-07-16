import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { generateM5bFedExGateBSyntheticArtifacts } from
  "../src/workshop/m5b-fedex-gate-b-unarmed-executor.ts";

const root = process.cwd();
const fixtureJson = await readFile(join(root,
  "fixtures/validation/m5b-fedex-system-acquired-demo-source.json"), "utf8");
const generated = generateM5bFedExGateBSyntheticArtifacts(fixtureJson);

await writeFile(join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-source-pack.json"),
  generated.sourcePackJson, "utf8");
await writeFile(join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-candidate.json"),
  generated.candidateJson, "utf8");
await writeFile(join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-review-packet.json"),
  generated.reviewPacketJson, "utf8");
await writeFile(join(root, "fixtures/workshop/m5b-fedex-gate-b-synthetic-prewrite-review.html"),
  generated.workshopHtml, "utf8");
await writeFile(join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-execution-receipt.json"),
  generated.executionReceiptJson, "utf8");
