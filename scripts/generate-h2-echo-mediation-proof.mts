import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { generateH2EchoMediationProof } from "../src/capability/h2-proof.ts";

const proof = await generateH2EchoMediationProof();
const rendered = `${JSON.stringify(proof, null, 2)}\n`;

if (process.argv.includes("--write")) {
  const outputPath = join(process.cwd(), "fixtures/validation/h2-echo-mediation-proof.json");
  await writeFile(outputPath, rendered, "utf8");
  process.stdout.write(`${outputPath}\n`);
} else {
  process.stdout.write(rendered);
}
