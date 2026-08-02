import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { generateM5bFedExDemoArtifacts } from "../src/workshop/m5b-fedex-prewrite-workshop.ts";
import { writeExclusiveArtifactSet } from "./lib/exclusive-artifact-set-writer.mts";

const root = process.cwd();
const inputPath = join(root, "fixtures/validation/m5b-fedex-system-acquired-demo-source.json");
const sourcePackPath = join(root, "fixtures/validation/m5b-fedex-system-acquired-demo-source-pack.json");
const reviewPacketPath = join(root, "fixtures/validation/m5b-fedex-system-acquired-review-packet.json");
const htmlPath = join(root, "fixtures/workshop/m5b-fedex-system-acquired-prewrite-review.html");

const fixtureJson = await readFile(inputPath, "utf8");
const generated = generateM5bFedExDemoArtifacts(fixtureJson);

await writeExclusiveArtifactSet([
  { path: sourcePackPath, data: generated.sourcePackJson },
  { path: reviewPacketPath, data: generated.reviewPacketJson },
  { path: htmlPath, data: generated.html },
]);
