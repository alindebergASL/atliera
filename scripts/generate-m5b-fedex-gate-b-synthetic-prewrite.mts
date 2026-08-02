import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { generateM5bFedExGateBSyntheticArtifacts } from
  "../src/workshop/m5b-fedex-gate-b-unarmed-executor.ts";
import { writeExclusiveArtifactSet } from "./lib/exclusive-artifact-set-writer.mts";

const root = process.cwd();
const fixtureJson = await readFile(join(root,
  "fixtures/validation/m5b-fedex-system-acquired-demo-source.json"), "utf8");
const generated = generateM5bFedExGateBSyntheticArtifacts(fixtureJson);

await writeExclusiveArtifactSet([
  {
    path: join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-source-pack.json"),
    data: generated.sourcePackJson,
  },
  {
    path: join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-candidate.json"),
    data: generated.candidateJson,
  },
  {
    path: join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-review-packet.json"),
    data: generated.reviewPacketJson,
  },
  {
    path: join(root, "fixtures/workshop/m5b-fedex-gate-b-synthetic-prewrite-review.html"),
    data: generated.workshopHtml,
  },
  {
    path: join(root, "fixtures/validation/m5b-fedex-gate-b-synthetic-execution-receipt.json"),
    data: generated.executionReceiptJson,
  },
]);
